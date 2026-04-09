const express = require('express');
const { withDb } = require('../db');

const router = express.Router();

router.post('/clone', async (req, res) => {
  const { userId, url, title } = req.body;

  if (!userId || !url) {
    return res.status(400).json({ error: 'userId and url are required.' });
  }

  try {
    const contentResponse = await fetch(url);
    if (!contentResponse.ok) {
      return res.status(400).json({ error: 'Could not fetch target URL.' });
    }

    const html = await contentResponse.text();
    const port = process.env.PORT || 3000;

    const analyzeResponse = await fetch(`http://127.0.0.1:${port}/internal/mock-ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html })
    });

    const analysis = await analyzeResponse.json();

    if (!analysis.fields || analysis.fields.length === 0) {
      return res.status(422).json({
        error: 'High Security: Manual Setup Required',
        details: 'No input fields were discovered in the target HTML.'
      });
    }

    const form = withDb((db) => {
      const user = db.users.find((entry) => entry.id === userId);
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      if (user.credits < 3) {
        throw new Error('INSUFFICIENT_CREDITS_FOR_CLONE');
      }

      user.credits -= 3;

      const newForm = {
        id: `frm-${Date.now()}`,
        userId,
        title: title || `Cloned Form ${db.forms.length + 1}`,
        sourceUrl: url,
        hosted: false,
        createdAt: new Date().toISOString(),
        fields: analysis.fields
      };

      db.forms.push(newForm);
      return newForm;
    });

    return res.json({
      message: 'Form generated successfully. 3 credits deducted.',
      form
    });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (error.message === 'INSUFFICIENT_CREDITS_FOR_CLONE') {
      return res.status(402).json({ error: 'Not enough credits for generating a form.' });
    }

    return res.status(500).json({ error: 'Clone operation failed.', detail: error.message });
  }
});

module.exports = router;
