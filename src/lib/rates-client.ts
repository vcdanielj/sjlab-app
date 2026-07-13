export interface Rates {
  usdParallel: number;
  usdBcv: number;
  eurBcv: number;
}

let cachedPromise: Promise<Rates> | null = null;
let cachedDate: string | null = null;

export function fetchRatesWithCache(dateStr: string): Promise<Rates> {
  if (!dateStr) {
    return Promise.reject(new Error('La fecha es requerida'));
  }

  // Si ya tenemos la promesa cacheada para esta fecha, la retornamos
  if (cachedPromise && cachedDate === dateStr) {
    return cachedPromise;
  }

  cachedDate = dateStr;
  cachedPromise = fetch(`/api/rates?date=${dateStr}`)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Error al obtener tasas: ${res.statusText}`);
      }
      return res.json();
    })
    .then((data) => {
      if (!data || !data.data) {
        throw new Error('Formato de respuesta de tasas inválido');
      }
      return data.data as Rates;
    })
    .catch((err) => {
      // Limpiar caché en caso de fallo para permitir reintentos
      cachedPromise = null;
      cachedDate = null;
      throw err;
    });

  return cachedPromise;
}
