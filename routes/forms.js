const express = require('express');
const { readDb, withDb } = require('../db');

const router = express.Router();

router.get('/forms', (req, res) => {
  const { userId } = req.query;
  const db = readDb();
  const forms = userId ? db.forms.filter((form) => form.userId === userId) : db.forms;
  return res.json({ forms });
});

router.post('/forms/:formId/host', (req, res) => {
  const { formId } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  try {
    const hostedForm = withDb((db) => {
      const form = db.forms.find((entry) => entry.id === formId && entry.userId === userId);
      if (!form) {
        throw new Error('FORM_NOT_FOUND');
      }

      if (form.hosted) {
        throw new Error('ALREADY_HOSTED');
      }

      const user = db.users.find((entry) => entry.id === userId);
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      if (user.credits < 30) {
        throw new Error('INSUFFICIENT_CREDITS_FOR_HOSTING');
      }

      user.credits -= 30;
      form.hosted = true;
      form.hostedAt = new Date().toISOString();
      form.hostingEndpoint = '/api/collect-data';
      form.hostingRequest = {
        formId: form.id,
        userId: form.userId,
        payload: {
          name: '',
          email: '',
          message: ''
        }
      };
      return form;
    });

    return res.json({ message: 'Form hosted. 30 credits deducted.', form: hostedForm });
  } catch (error) {
    if (error.message === 'FORM_NOT_FOUND') {
      return res.status(404).json({ error: 'Form not found for this user.' });
    }

    if (error.message === 'ALREADY_HOSTED') {
      return res.status(409).json({ error: 'Form is already hosted.' });
    }

    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (error.message === 'INSUFFICIENT_CREDITS_FOR_HOSTING') {
      return res.status(402).json({ error: 'Not enough credits to host this form.' });
    }

    return res.status(500).json({ error: 'Unexpected hosting failure.' });
  }
});

router.get('/forms/:formId/download', (req, res) => {
  const { formId } = req.params;
  const db = readDb();
  const form = db.forms.find((entry) => entry.id === formId);

  if (!form) {
    return res.status(404).json({ error: 'Form not found.' });
  }

  return res.json({
    filename: `${form.title.replace(/\s+/g, '-').toLowerCase()}.json`,
    payload: form
  });
});

module.exports = router;
