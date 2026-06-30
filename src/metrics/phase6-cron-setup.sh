#!/bin/bash
# Phase 6 Nightly Metrics Cron Setup
# Runs nightly metrics computation at 2 AM UTC

# Add to crontab:
# 0 2 * * * /usr/local/bin/phase6-metrics-runner.sh

# Or use systemd timer:
# /etc/systemd/system/phase6-metrics.service
# /etc/systemd/system/phase6-metrics.timer

cat > /etc/systemd/system/phase6-metrics.service <<EOF
[Unit]
Description=Phase 6 Nightly Metrics Computation
After=network.target postgresql.service

[Service]
Type=oneshot
User=cic
WorkingDirectory=/opt/cic-ingestion
ExecStart=/usr/bin/node -e "
  const { Pool } = require('pg');
  const { MetricsEngine } = require('./dist/metrics/MetricsEngine');
  const { NightlyMetricsPipeline } = require('./dist/metrics/NightlyMetricsPipeline');

  const pool = new Pool({
    user: process.env.DB_USER || 'cic',
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'cic_lineage'
  });

  (async () => {
    try {
      const engine = new MetricsEngine(pool);
      const pipeline = new NightlyMetricsPipeline(pool, engine);
      await pipeline.run();
      console.log('[Phase6] Nightly metrics pipeline completed successfully');
    } catch (err) {
      console.error('[Phase6] Nightly metrics pipeline failed:', err);
      process.exit(1);
    } finally {
      await pool.end();
    }
  })();
"
StandardOutput=journal
StandardError=journal
SyslogIdentifier=phase6-metrics

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/phase6-metrics.timer <<EOF
[Unit]
Description=Phase 6 Nightly Metrics Timer
Requires=phase6-metrics.service

[Timer]
OnCalendar=*-*-* 02:00:00 UTC
Unit=phase6-metrics.service
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable phase6-metrics.timer
systemctl start phase6-metrics.timer

echo "Phase 6 nightly metrics timer installed and started"
