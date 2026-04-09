const express = require('express');
const path = require('path');

const cloneRoutes = require('./routes/clone');
const formRoutes = require('./routes/forms');
const dataRoutes = require('./routes/data');
const marketplaceRoutes = require('./routes/marketplace');
const userRoutes = require('./routes/users');
const internalRoutes = require('./routes/internal');

const app = express();
const PORT = process.env.PORT || 3000;


app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

const requestWindowMs = 60 * 1000;
const maxRequestsPerWindow = 120;
const requestBuckets = new Map();

app.use('/api', (req, res, next) => {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const bucket = requestBuckets.get(ip) || { count: 0, startedAt: now };

  if (now - bucket.startedAt > requestWindowMs) {
    bucket.count = 0;
    bucket.startedAt = now;
  }

  bucket.count += 1;
  requestBuckets.set(ip, bucket);

  if (bucket.count > maxRequestsPerWindow) {
    return res.status(429).json({ error: 'Too many requests. Please retry shortly.' });
  }

  return next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Global Support & Lead Management System' });
});

app.use('/api', userRoutes);
app.use('/api', cloneRoutes);
app.use('/api', formRoutes);
app.use('/api', dataRoutes);
app.use('/api', marketplaceRoutes);

// Internal localhost-only process routes (kept out of the frontend contract).
app.use('/internal', internalRoutes);

app.listen(PORT, () => {
  console.log(`Cyber dashboard running on http://localhost:${PORT}`);
});
