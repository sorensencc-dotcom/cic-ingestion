// cic-ingestion/src/ingestion/queue/index.ts
// semver: 0.1.0
// date: 2026-06-29

export interface IngestionJob {
  type: string;
  payload: {
    path: string;
  };
}

export class IngestionQueue {
  private jobs: IngestionJob[] = [];

  enqueue(job: IngestionJob): void {
    this.jobs.push(job);
  }

  dequeue(): IngestionJob | undefined {
    return this.jobs.shift();
  }

  getJobs(): IngestionJob[] {
    return [...this.jobs];
  }

  clear(): void {
    this.jobs = [];
  }
}

export const queue = new IngestionQueue();
