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
