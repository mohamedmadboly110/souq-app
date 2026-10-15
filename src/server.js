'use strict';

const app = require('./app');
const config = require('./config/env');
const db = require('./config/database');

const server = app.listen(config.port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Souq API listening on 0.0.0.0:${config.port} [${config.nodeEnv}]`);
});

/** Graceful shutdown: stop accepting connections, then close the pool. */
function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await db.closePool();
      // eslint-disable-next-line no-console
      console.log('Database pool closed. Bye.');
      process.exit(0);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error during shutdown:', error.message);
      process.exit(1);
    }
  });

  // Force-exit if connections refuse to drain.
  setTimeout(() => process.exit(1), 10000).unref();
}

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => shutdown(signal));
});

process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[fatal] Unhandled promise rejection:', reason);
  process.exitCode = 1;
});

module.exports = server;
