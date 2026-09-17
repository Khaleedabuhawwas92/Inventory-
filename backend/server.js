const env = require('./config/env');
const { connectDB } = require('./config/db');
const app = require('./app');
const { startBackupScheduler } = require('./services/backupScheduler');

async function start() {
  try {
    await connectDB();
    const server = app.listen(env.PORT, () => {
      console.log(`[Server] Running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    });

    const backupInterval = startBackupScheduler();

    const shutdown = (signal) => {
      console.log(`[Server] Received ${signal}, shutting down gracefully...`);
      clearInterval(backupInterval);
      server.close(() => {
        console.log('[Server] Closed');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('unhandledRejection', (err) => {
      console.error('[UnhandledRejection]', err);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
  }
}

start();
