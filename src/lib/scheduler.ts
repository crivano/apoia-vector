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

  // Sincronização completa às 2:15 da manhã (0 15 2 * * *)
  // Usar sync-start para sincronização em chunks (melhor para grandes volumes)
  cron.schedule("0 15 2 * * *", async () => {
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

  isSchedulerStarted = true;
  console.log("✓ Scheduler started successfully");
}

export function stopScheduler() {
  // node-cron não tem um stop global, mas podemos usar uma flag
  isSchedulerStarted = false;
  console.log("⏰ Scheduler stopped");
}

console.log("⏰ Scheduler module loaded (use ENABLE_INTERNAL_SCHEDULER=true to enable)");

// NOTA: Scheduler interno desabilitado por padrão
// Este projeto agora usa CronJob do OpenShift (ver openshift-cronjob.yaml)
// Para habilitar o scheduler interno novamente, defina:
// ENABLE_INTERNAL_SCHEDULER=true
if (
  process.env.ENABLE_INTERNAL_SCHEDULER === "true"
) {
  console.log("⚠️  Enabling internal scheduler (not recommended with OpenShift CronJob)");
  startScheduler();
}
