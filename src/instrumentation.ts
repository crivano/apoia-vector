// Instrumentation hook do Next.js
// Executado quando o servidor inicia
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Apenas no servidor Node.js (não no Edge Runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // NOTA: O scheduler interno foi substituído por CronJob do OpenShift
    // Ver: openshift-cronjob.yaml
    // Para habilitar o scheduler interno, defina: ENABLE_INTERNAL_SCHEDULER=true
    await import("./lib/scheduler");
  }
}
