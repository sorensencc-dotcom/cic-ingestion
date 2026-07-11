/**
 * CIC Orchestrator v3.0.0 — Scheduler
 */

export function createScheduler() {
  const tasks = [];

  return {
    schedule(fn) {
      tasks.push(fn);
    },
    async tick(context) {
      for (const fn of tasks) {
        await fn(context);
      }
    }
  };
}
