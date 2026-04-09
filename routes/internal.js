const express = require('express');

const router = express.Router();

function extractInputFields(html) {
  const fieldRegex = /<(input|textarea|select)([^>]*)>/gi;
  const fields = [];
  let match;

  while ((match = fieldRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2] || '';

    const nameMatch = attrs.match(/name=["']?([^"'\s>]+)/i);
    const typeMatch = attrs.match(/type=["']?([^"'\s>]+)/i);
    const placeholderMatch = attrs.match(/placeholder=["']([^"']+)/i);

    fields.push({
      tag,
      name: nameMatch ? nameMatch[1] : `field_${fields.length + 1}`,
      type: typeMatch ? typeMatch[1] : tag === 'textarea' ? 'textarea' : 'text',
      placeholder: placeholderMatch ? placeholderMatch[1] : 'Enter value'
    });
  }

  return fields;
}

router.post('/mock-ai/analyze', (req, res) => {
  const { html } = req.body;
  if (!html) {
    return res.status(400).json({ fields: [], error: 'html is required.' });
  }

  const fields = extractInputFields(html);
  return res.json({
    model: 'mock-ai-v1',
    fields,
    note: 'Designed for easy Gemini prompt injection later.'
  });
});

module.exports = router;
