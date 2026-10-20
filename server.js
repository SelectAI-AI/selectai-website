'use strict';
require('dotenv').config();

/* ── Required environment variable check ─────────────────── */
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
const MISSING_ENV  = REQUIRED_ENV.filter(k => !process.env[k]);
if (MISSING_ENV.length) {
  console.error('[SelectAI] ✗ Missing required environment variables:', MISSING_ENV.join(', '));
  console.error('[SelectAI]   Copy .env.example to .env and fill in all values.');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('[SelectAI] ✗ JWT_SECRET must be at least 32 characters long.');
  process.exit(1);
}

const express = require('express');
const mongoose = require('mongoose');
const helmet   = require('helmet');
const cors     = require('cors');
const { configureTrustProxy, createLimiter } = require('./lib/rateLimit');

const app  = express();
const PORT = process.env.PORT || 3000;

configureTrustProxy(app);

/* ── Security ─────────────────────────────────────────── */
/* CSP disabled — this is an API-only server; static HTML is served by nginx.
   All other helmet protections (HSTS, X-Frame-Options, etc.) remain active. */
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false   /* allow embedding in same-origin iframes */
}));
/* Explicitly remove the X-Powered-By header (helmet does this too, belt-and-braces) */
app.disable('x-powered-by');
const DEV_ORIGINS = process.env.NODE_ENV !== 'production'
  ? ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500', 'http://127.0.0.1:3000', 'null']
  : [];
app.use(cors({
  origin: [
    process.env.FRONTEND_URL   || 'https://www.selectai.it.com',
    'https://www.selectai.it.com',
    'https://selectai.it.com',
    'https://www.selectai.com',
    'https://selectai.com',
    'http://selectai.it.com',
    'http://3.7.130.187',
    ...DEV_ORIGINS
  ],
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

/* Normalise body — ensures destructuring never throws on missing Content-Type */
app.use((req, res, next) => { req.body = req.body || {}; next(); });

/* ── Global API rate limit ────────────────────────────── */
app.use('/api/', createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  statusCode: 429,
  message: { message: 'Too many requests. Please try again later.' }
}));

/* ── Routes ───────────────────────────────────────────── */
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/otp',       require('./routes/otp'));
app.use('/api/enquiries', require('./routes/enquiries'));
app.use('/api/sessions',  require('./routes/sessions'));
app.use('/api/admin',     require('./routes/admin'));

/* ── Health check ─────────────────────────────────────── */
app.get('/api/health', (req, res) =>
  res.json({ ok: true, env: process.env.NODE_ENV, ts: new Date() })
);

/* ── 404 ──────────────────────────────────────────────── */
app.use((req, res) =>
  res.status(404).json({ message: 'API route not found.' })
);

/* ── Global error handler ─────────────────────────────── */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[SelectAI]', err.stack || err.message);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error.' });
});

/* ── Connect MongoDB → start server ───────────────────── */
mongoose
  .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log('[SelectAI] ✓ MongoDB connected');
    app.listen(PORT, '0.0.0.0', () =>
      console.log('[SelectAI] ✓ API server listening on port', PORT)
    );
  })
  .catch(err => {
    console.error('[SelectAI] ✗ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;
