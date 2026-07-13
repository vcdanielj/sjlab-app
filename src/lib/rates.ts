import * as schema from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { DrizzleD1Database } from 'drizzle-orm/d1';

export interface RATES_KV_BINDING {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

// In-Memory cache at isolate level
const memoryCache: Record<string, { rates: { usdParallel: number; usdBcv: number; eurBcv: number }; expiresAt: number }> = {};

// Helper to format date as YYYY-MM-DD in Caracas time
export function formatDateCaracas(timestampOrDate: number | Date | string): string {
  let date: Date;
  if (typeof timestampOrDate === 'number') {
    date = new Date(timestampOrDate * 1000);
  } else if (typeof timestampOrDate === 'string') {
    date = new Date(timestampOrDate);
  } else {
    date = timestampOrDate;
  }
  
  // Format in America/Caracas timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  
  return `${year}-${month}-${day}`;
}

export interface Rates {
  usdParallel: number;
  usdBcv: number;
  eurBcv: number;
}

// Fetch helper with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Helper to parse DolarApi data
function extractRate(data: unknown): number | null {
  if (!data) return null;
  let obj: Record<string, unknown> | null = null;
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    const first = data[0];
    if (first && typeof first === 'object') {
      obj = first as Record<string, unknown>;
    }
  } else if (typeof data === 'object') {
    obj = data as Record<string, unknown>;
  }
  if (!obj) return null;
  const val = obj.promedio || obj.venta || obj.compra || null;
  return val ? Number(val) : null;
}

// Fallback API using static JSON CDN or backup endpoint
async function fetchFallbackRates(): Promise<Rates | null> {
  try {
    // DolarVZLA on GitHub hosts a static daily-updated JSON
    const res = await fetchWithTimeout('https://raw.githubusercontent.com/dolarvzla/dolar-vzla-api/main/dolar.json', {}, 4000);
    if (!res.ok) return null;
    const data = await res.json() as Record<string, string | number>;
    
    const usdBcv = parseFloat(String(data.bcv || data.usd_bcv));
    const usdParallel = parseFloat(String(data.paralelo || data.usd_paralelo));
    const eurBcv = parseFloat(String(data.eur || data.eur_bcv)) || (usdBcv * 1.08); // fallback approximation
    
    if (usdParallel > 0 && usdBcv > 0) {
      return {
        usdParallel: Number(usdParallel.toFixed(2)),
        usdBcv: Number(usdBcv.toFixed(2)),
        eurBcv: Number(eurBcv.toFixed(2)),
      };
    }
  } catch (err) {
    console.error('Fallback API fetch failed:', err);
  }
  return null;
}

// Fetch from DolarApi.com (live or historical)
async function fetchDolarApi(dateStr: string): Promise<Rates | null> {
  const todayStr = formatDateCaracas(new Date());
  const isToday = dateStr === todayStr;
  
  try {
    let parallelUrl: string;
    let bcvUrl: string;
    let eurUrl: string;
    
    if (isToday) {
      parallelUrl = 'https://ve.dolarapi.com/v1/dolares/paralelo';
      bcvUrl = 'https://ve.dolarapi.com/v1/dolares/oficial';
      eurUrl = 'https://ve.dolarapi.com/v1/euros/oficial';
    } else {
      const urlDate = dateStr.replace(/-/g, '/'); // YYYY/MM/DD
      parallelUrl = `https://ve.dolarapi.com/v1/historicos/dolares/paralelo/${urlDate}`;
      bcvUrl = `https://ve.dolarapi.com/v1/historicos/dolares/oficial/${urlDate}`;
      eurUrl = `https://ve.dolarapi.com/v1/historicos/euros/oficial/${urlDate}`;
    }
    
    const [pRes, bRes, eRes] = await Promise.allSettled([
      fetchWithTimeout(parallelUrl, {}, 4000).then(r => r.json()),
      fetchWithTimeout(bcvUrl, {}, 4000).then(r => r.json()),
      fetchWithTimeout(eurUrl, {}, 4000).then(r => r.json()),
    ]);
    
    const pVal = pRes.status === 'fulfilled' ? extractRate(pRes.value) : null;
    const bVal = bRes.status === 'fulfilled' ? extractRate(bRes.value) : null;
    const eVal = eRes.status === 'fulfilled' ? extractRate(eRes.value) : null;
    
    if (pVal && bVal) {
      return {
        usdParallel: Number(pVal.toFixed(2)),
        usdBcv: Number(bVal.toFixed(2)),
        eurBcv: eVal ? Number(eVal.toFixed(2)) : Number((bVal * 1.08).toFixed(2)), // default fallback if EUR is missing
      };
    }
  } catch (err) {
    console.error('DolarApi fetch failed:', err);
  }
  return null;
}

// Database lookup fallback (find any transaction registered on that day)
async function fetchDbRates(db: DrizzleD1Database<typeof schema>, dateStr: string): Promise<Rates | null> {
  try {
    const startOfDay = Math.floor(new Date(`${dateStr}T00:00:00-04:00`).getTime() / 1000);
    const endOfDay = Math.floor(new Date(`${dateStr}T23:59:59-04:00`).getTime() / 1000);
    
    // Find in payments
    const paymentsList = await db
      .select({
        parallelExchangeRate: schema.payments.parallelExchangeRate,
        exchangeRate: schema.payments.exchangeRate,
        appliedExchangeRateType: schema.payments.appliedExchangeRateType,
      })
      .from(schema.payments)
      .where(
        and(
          eq(schema.payments.status, 'active'),
          sql`${schema.payments.paymentDate} >= ${startOfDay}`,
          sql`${schema.payments.paymentDate} <= ${endOfDay}`
        )
      )
      .limit(5);
      
    for (const p of paymentsList) {
      if (p.parallelExchangeRate && p.parallelExchangeRate > 1.0) {
        const parallel = p.parallelExchangeRate;
        let bcv = parallel * 0.9; // rough fallback approximation
        let eur = parallel * 0.95;
        
        if (p.appliedExchangeRateType === 'USD_BCV' && p.exchangeRate) {
          bcv = p.exchangeRate;
        } else if (p.appliedExchangeRateType === 'EUR_BCV' && p.exchangeRate) {
          eur = p.exchangeRate;
        }
        
        return {
          usdParallel: Number(parallel.toFixed(2)),
          usdBcv: Number(bcv.toFixed(2)),
          eurBcv: Number(eur.toFixed(2)),
        };
      }
    }
  } catch (err) {
    console.error('Database rates lookup failed:', err);
  }
  return null;
}

// Main rate fetching service with caching, fallback, and weekend propagation
export async function getRatesForDate(
  db: DrizzleD1Database<typeof schema>,
  kv: RATES_KV_BINDING | null | undefined,
  dateStr: string,
  depth = 0
): Promise<Rates> {
  const todayStr = formatDateCaracas(new Date());
  const isToday = dateStr === todayStr;
  
  // 1. Check Isolate Memory Cache
  const cached = memoryCache[dateStr];
  const nowMs = Date.now();
  if (cached && cached.expiresAt > nowMs) {
    return cached.rates;
  }
  
  // 2. Check Cloudflare KV Cache (if available)
  const kvKey = `rate:${dateStr}`;
  if (kv) {
    try {
      const kvVal = await kv.get(kvKey);
      if (kvVal) {
        const rates = JSON.parse(kvVal) as Rates;
        const ttl = isToday ? 15 * 60 * 1000 : 24 * 60 * 60 * 1000;
        memoryCache[dateStr] = { rates, expiresAt: nowMs + ttl };
        return rates;
      }
    } catch (err) {
      console.error('KV get failed:', err);
    }
  }
  
  // 3. Try DolarApi
  let rates = await fetchDolarApi(dateStr);
  
  // 4. Try Fallback API (if DolarApi fails)
  if (!rates) {
    rates = await fetchFallbackRates();
  }
  
  // 5. Try Database Lookup (if APIs fail)
  if (!rates) {
    rates = await fetchDbRates(db, dateStr);
  }
  
  // 6. Handle Weekends / Holidays (Propagate backwards)
  if (!rates && !isToday && depth < 4) {
    const dateObj = new Date(`${dateStr}T12:00:00-04:00`);
    dateObj.setDate(dateObj.getDate() - 1);
    const prevDateStr = formatDateCaracas(dateObj);
    console.log(`Rate not found for ${dateStr}, propagating backward to ${prevDateStr}`);
    
    try {
      rates = await getRatesForDate(db, kv, prevDateStr, depth + 1);
    } catch {
      // ignore
    }
  }
  
  // 7. Ultimate Fallback (to avoid crashing the app)
  if (!rates) {
    rates = {
      usdParallel: 45.0,
      usdBcv: 40.0,
      eurBcv: 42.0,
    };
  }
  
  // Save to KV and Memory caches
  if (rates) {
    const ttl = isToday ? 15 * 60 * 1000 : 24 * 60 * 60 * 1000;
    memoryCache[dateStr] = { rates, expiresAt: nowMs + ttl };
    
    if (kv) {
      try {
        const options = isToday ? { expirationTtl: 3600 } : undefined;
        await kv.put(kvKey, JSON.stringify(rates), options);
      } catch (err) {
        console.error('KV put failed:', err);
      }
    }
  }
  
  return rates;
}
