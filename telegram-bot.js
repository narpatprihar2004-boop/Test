/**
 * Telegram Bot launcher for the Mini App dashboard.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=<bot_token> WEBAPP_URL=https://your-domain.com node telegram-bot.js
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || 'http://localhost:3000';

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN in environment variables.');
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function callTelegram(method, payload) {
  const response = await fetch(`${API_BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || 'Telegram API call failed.');
  }

  return data.result;
}

async function processUpdate(update) {
  const message = update.message;
  if (!message || !message.text) {
    return;
  }

  if (message.text.startsWith('/start')) {
    await callTelegram('sendMessage', {
      chat_id: message.chat.id,
      text: '⚡ Global Support & Lead Management System is online. Open the secure dashboard:',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Open Cyber Dashboard',
              web_app: {
                url: WEBAPP_URL
              }
            }
          ]
        ]
      }
    });
  }
}

async function startPolling() {
  let offset = 0;
  console.log('Telegram bot polling started...');

  while (true) {
    try {
      const updates = await callTelegram('getUpdates', {
        timeout: 25,
        offset
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        await processUpdate(update);
      }
    } catch (error) {
      console.error('Polling error:', error.message);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
}

startPolling();
