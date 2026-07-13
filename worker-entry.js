import defaultExport from "./.open-next/worker.js";

export default {
  ...defaultExport,
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCronJob(env, ctx));
  }
};

async function runCronJob(env, ctx) {
  try {
    console.log("[CRON] Iniciando envío automático de estados de cuenta...");
    const cronSecret = env.CRON_SECRET || "default_cron_secret";
    const request = new Request("http://localhost/api/cron-job", {
      method: "POST",
      headers: {
        "x-cron-secret": cronSecret,
      },
    });
    
    // Pass ctx to OpenNext defaultExport.fetch
    const response = await defaultExport.fetch(request, env, ctx);
    console.log(`[CRON] Respuesta del endpoint: ${response.status}`);
  } catch (error) {
    console.error("[CRON] Error ejecutando tarea programada:", error);
  }
}
