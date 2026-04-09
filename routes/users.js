const express = require('express');
const { readDb } = require('../db');

const router = express.Router();

router.get('/profile/:userId', (req, res) => {
  const { userId } = req.params;
  const db = readDb();
  const user = db.users.find((entry) => entry.id === userId);

  if (!user) {
    return res.status(404).json({ error: 'User profile not found.' });
  }

  return res.json({ user });
});

module.exports = router;
