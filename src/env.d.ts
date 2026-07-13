// ============================================
// SJ Lab — Cloudflare Environment Extension
// ============================================
// Extends the CloudflareEnv interface with our D1 binding name
// so getCloudflareContext().env.DB is typed.

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    RESEND_API_KEY?: string;
    RESEND_SENDER_EMAIL?: string;
    CRON_SECRET?: string;
  }
}

export {};
