/**
 * PM2 Ecosystem Configuration — Aperti
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 start ecosystem.config.js --env production
 *   pm2 logs aperti-api
 *   pm2 monit
 */
module.exports = {
  apps: [
    {
      name: "aperti-api",
      cwd: "./artifacts/api-server",
      script: "./dist/index.mjs",
      interpreter: "node",
      interpreter_args: "--enable-source-maps",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: "10s",
      env: {
        NODE_ENV: "development",
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      error_file: "./logs/api-error.log",
      out_file: "./logs/api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "aperti-web",
      cwd: "./artifacts/aperti",
      script: "pnpm",
      args: "run preview",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      error_file: "./logs/web-error.log",
      out_file: "./logs/web-out.log",
      autorestart: true,
      watch: false,
    },
  ],
};
