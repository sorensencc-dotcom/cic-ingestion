import axios from "axios";

export async function checkRepro(score: number, snapshotHashOk: boolean, fsHashOk: boolean) {
  if (score < 0.7) {
    await notify("ReproLow", `Reproducibility degraded: ${score}`);
  }

  if (!snapshotHashOk) {
    await notify("SnapshotMismatch", "Snapshot hash mismatch");
  }

  if (!fsHashOk) {
    await notify("FilesystemMismatch", "Filesystem/env hash mismatch");
  }
}

async function notify(type: string, message: string) {
  await axios.post(process.env.SLACK_WEBHOOK!, {
    text: `[${type}] ${message}`
  });

  await axios.post(process.env.PAGERDUTY_EVENT_URL!, {
    event_action: "trigger",
    payload: {
      summary: message,
      severity: "critical"
    }
  });
}
