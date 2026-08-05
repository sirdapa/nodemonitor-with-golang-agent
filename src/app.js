'use strict';

const express = require('express');
const { setupMiddleware } = require('./middleware');
const apiRoutes = require('./routes/api');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');

function createApp() {
  const app = express();

  setupMiddleware(app);

  // Auth routes must be mounted before the dashboard.
  app.use('/', authRoutes);
  app.use('/api', apiRoutes);
  app.use('/', dashboardRoutes);

  return app;
}

module.exports = { createApp };
