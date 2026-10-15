'use strict';

const db = require('../config/database');

const healthController = {
  /** Liveness: the process is running and able to serve requests. */
  live: (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    });
  },

  /** Readiness: the process can reach its database. */
  ready: async (req, res) => {
    try {
      const connected = await db.checkConnection();
      res.status(200).json({
        success: true,
        data: { status: 'ready', database: connected ? 'up' : 'down' },
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        message: 'Database is not reachable',
        error: { code: 'SERVICE_UNAVAILABLE' },
      });
    }
  },
};

module.exports = healthController;
