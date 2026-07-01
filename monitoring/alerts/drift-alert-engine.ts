import axios from "axios";

export async function checkDrift(driftScore: number, driftTrend: number) {
  if (driftScore > 0.75) {
    await notify("DriftHigh", `Drift score high: ${driftScore}`);
  }

  if (driftTrend > 0.15) {
    await notify("DriftSpike", `Drift spike detected: trend ${driftTrend}`);
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
      severity: type === "DriftSpike" ? "critical" : "warning"
    }
  });
}
