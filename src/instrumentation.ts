// Instrumentation hook do Next.js
// Executado quando o servidor inicia
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Apenas no servidor Node.js (não no Edge Runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Importa e inicializa o scheduler
    await import("./lib/scheduler");
  }
}
