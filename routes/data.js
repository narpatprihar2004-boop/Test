const express = require('express');
const { readDb, withDb } = require('../db');

const router = express.Router();

router.post('/collect-data', (req, res) => {
  const { formId, userId, payload } = req.body;

  if (!formId || !userId || !payload) {
    return res.status(400).json({ error: 'formId, userId, and payload are required.' });
  }

  try {
    const record = withDb((db) => {
      const form = db.forms.find((entry) => entry.id === formId && entry.userId === userId);
      if (!form) {
        throw new Error('FORM_NOT_FOUND');
      }

      const submission = {
        id: `sub-${Date.now()}`,
        formId,
        userId,
        name: payload.name || '',
        email: payload.email || '',
        message: payload.message || '',
        rawPayload: payload,
        capturedAt: new Date().toISOString()
      };

      db.submissions.push(submission);
      return submission;
    });

    return res.status(201).json({ message: 'Lead captured securely.', record });
  } catch (error) {
    if (error.message === 'FORM_NOT_FOUND') {
      return res.status(404).json({ error: 'Form not found or user mismatch.' });
    }

    return res.status(500).json({ error: 'Data collection failed.' });
  }
});

router.get('/client-data', (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  const db = readDb();

  const records = db.submissions
    .filter((entry) => entry.userId === userId)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

  return res.json({ records });
});

module.exports = router;
