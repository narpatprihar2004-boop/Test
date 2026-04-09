const express = require('express');
const { readDb, withDb } = require('../db');

const router = express.Router();

router.get('/marketplace', (req, res) => {
  const db = readDb();
  return res.json({ templates: db.marketplace });
});

router.post('/marketplace/purchase', (req, res) => {
  const { userId, templateId } = req.body;

  if (!userId || !templateId) {
    return res.status(400).json({ error: 'userId and templateId are required.' });
  }

  try {
    const receipt = withDb((db) => {
      const user = db.users.find((entry) => entry.id === userId);
      const template = db.marketplace.find((entry) => entry.id === templateId);

      if (!user || !template) {
        throw new Error('NOT_FOUND');
      }

      if (user.credits < template.price) {
        throw new Error('INSUFFICIENT_CREDITS');
      }

      user.credits -= template.price;

      return {
        receiptId: `rcpt-${Date.now()}`,
        userId,
        templateId,
        amount: template.price,
        purchasedAt: new Date().toISOString()
      };
    });

    return res.json({ message: 'Template purchased.', receipt });
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'User or template not found.' });
    }

    if (error.message === 'INSUFFICIENT_CREDITS') {
      return res.status(402).json({ error: 'Not enough credits.' });
    }

    return res.status(500).json({ error: 'Purchase failed.' });
  }
});

router.get('/vip-zone', (req, res) => {
  const db = readDb();
  return res.json({ vipTemplates: db.vipTemplates });
});

module.exports = router;
