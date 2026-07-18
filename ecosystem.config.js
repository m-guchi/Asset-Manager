module.exports = {
  apps: [
    {
      name: "asset-manager",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3102,
      },
    },
    {
      name: "asset-manager-fetch-index-values",
      script: "node_modules/.bin/tsx",
      args: "scripts/fetch-index-values.ts",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: false,
      cron_restart: "0 18 * * *",
      watch: false,
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
