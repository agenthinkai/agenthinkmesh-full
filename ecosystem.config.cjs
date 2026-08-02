/**
 * Mesh Enterprise Platform — PM2 Ecosystem Configuration
 * Enterprise Certification Sprint — CR-4 (Runtime Reliability)
 *
 * Usage:
 *   npm install -g pm2
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup   # Auto-restart on server reboot
 *   pm2 logs mesh-enterprise  # Tail logs
 *   pm2 monit                 # Live monitoring dashboard
 *   pm2 reload mesh-enterprise # Zero-downtime reload
 *   pm2 stop mesh-enterprise  # Graceful stop
 */

module.exports = {
  apps: [
    {
      name: "mesh-enterprise",
      script: "dist/server/_core/index.js",
      cwd: __dirname,

      // ── Instance configuration ─────────────────────────────────────────────
      instances: 1,           // Single instance (scale to "max" for cluster mode)
      exec_mode: "fork",      // Use "cluster" for multi-core scaling

      // ── Restart policy ────────────────────────────────────────────────────
      autorestart: true,
      max_restarts: 10,       // Stop auto-restart after 10 consecutive crashes
      min_uptime: "30s",      // Must stay up 30s to count as a successful start
      restart_delay: 4000,    // Wait 4s between restart attempts
      exp_backoff_restart_delay: 100, // Exponential backoff on repeated crashes

      // ── Memory management ─────────────────────────────────────────────────
      max_memory_restart: "512M", // Restart if memory exceeds 512MB

      // ── Graceful shutdown ─────────────────────────────────────────────────
      kill_timeout: 10000,    // Wait 10s for graceful shutdown before SIGKILL
      listen_timeout: 10000,  // Wait 10s for app to start listening

      // ── Logging ───────────────────────────────────────────────────────────
      log_file: "logs/combined.log",
      out_file: "logs/out.log",
      error_file: "logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // ── Environment ───────────────────────────────────────────────────────
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      env_staging: {
        NODE_ENV: "production",
        PORT: 3001,
      },

      // ── Health monitoring ─────────────────────────────────────────────────
      // PM2 will watch for the process to stop responding and restart it
      // The /api/health endpoint provides external health verification
    },
  ],
};
