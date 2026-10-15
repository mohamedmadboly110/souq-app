'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const config = require('./config/env');
const apiRoutes = require('./routes');
const healthRoutes = require('./routes/health.routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Behind a proxy (Railway), trust X-Forwarded-* so req.protocol/ip are accurate.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));

// Request logging. Keep automated tests quiet.
if (!config.isTest) {
  app.use(morgan(config.logLevel));
}

// Root: friendly entry point so `GET /` is not a confusing 404.
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'Souq API',
      version: '1.0.0',
      status: 'running',
      health: '/health',
      api: '/api',
      docs: 'See README.md and postman/Souq.postman_collection.json',
    },
  });
});

// Health checks are mounted outside /api.
app.use('/health', healthRoutes);

// Versioned API surface.
app.use('/api', apiRoutes);

// Unknown route + centralised error handling (must be last).
app.use(notFound);
app.use(errorHandler);

module.exports = app;
