// Scheduler interno usando node-cron
// Alternativa ao CronJob do Kubernetes para ambientes que preferem
// ter o agendamento dentro da aplicação

import cron from "node-cron";
import getDb from "./db";
import { syncDataSource } from "./sync";
import { createSyncSession, initializeSyncQueue } from "./sync-queue";
import { triggerSyncChunk } from "./base-url";

let isSchedulerStarted = false;

export function startScheduler() {
  // Evitar múltiplas instâncias do scheduler
  if (isSchedulerStarted) {
    console.log("⏰ Scheduler already running");
    return;
  }

  console.log("⏰ Starting internal scheduler...");

  // Sincronização completa a cada 6 horas (0 */6 * * *)
  // Usar sync-start para sincronização em chunks (melhor para grandes volumes)
  cron.schedule("0 */6 * * *", async () => {
    console.log("⏰ Running scheduled sync (chunked)...");
    try {
      const sessionId = await createSyncSession();
      const totalChunks = await initializeSyncQueue(sessionId);

      if (totalChunks === 0) {
        console.log("✓ No active sources to sync");
        return;
      }

      // Trigger chunk processing
      const authHeader = `Bearer ${process.env.CRON_SECRET || ""}`;
      await triggerSyncChunk(authHeader);

      console.log(`✓ Sync started - Session: ${sessionId}, Chunks: ${totalChunks}`);
    } catch (error) {
      console.error("✗ Scheduled sync error:", error);
    }
  });

  // Sincronização simples a cada hora (para fontes pequenas, se necessário)
  // Descomente se preferir sync simples para algumas fontes
  /*
  cron.schedule("0 * * * *", async () => {
    console.log("⏰ Running simple sync...");
    try {
      const db = getDb();
      const sources = await db("data_sources")
        .where("is_active", true)
        .whereRaw(`
          last_sync IS NULL 
          OR last_sync < NOW() - (sync_interval || ' minutes')::interval
        `)
        .limit(5); // Limitar para evitar sobrecarga

      for (const source of sources) {
        try {
          await syncDataSource(source);
          console.log(`✓ Synced: ${source.name}`);
        } catch (error) {
          console.error(`✗ Error syncing ${source.name}:`, error);
        }
      }
    } catch (error) {
      console.error("✗ Simple sync error:", error);
    }
  });
  */

  isSchedulerStarted = true;
  console.log("✓ Scheduler started successfully");
}

export function stopScheduler() {
  // node-cron não tem um stop global, mas podemos usar uma flag
  isSchedulerStarted = false;
  console.log("⏰ Scheduler stopped");
}

// Iniciar automaticamente se não estiver em desenvolvimento
// e se a variável de ambiente ENABLE_INTERNAL_SCHEDULER estiver definida
if (
  process.env.NODE_ENV === "production" &&
  process.env.ENABLE_INTERNAL_SCHEDULER === "true"
) {
  startScheduler();
}
