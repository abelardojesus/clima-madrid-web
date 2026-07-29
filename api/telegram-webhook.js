import { nowInMadridParts, buildClimaMessage, sendTelegramMessage } from "../lib/clima.js";

export default async function handler(req, res) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const allowedChatIds = (process.env.TELEGRAM_CHAT_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (req.method !== "POST") {
    res.status(200).json({ ok: true });
    return;
  }

  if (webhookSecret) {
    const providedSecret = req.headers["x-telegram-bot-api-secret-token"];
    if (providedSecret !== webhookSecret) {
      res.status(401).json({ ok: false });
      return;
    }
  }

  const update = req.body || {};
  const message = update.message || update.channel_post;
  const text = (message && message.text) || "";
  const chatId = message && message.chat && message.chat.id;

  const isClimaCommand = /^\/clima(@\w+)?\b/.test(text.trim());

  if (!isClimaCommand || !chatId) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  if (!allowedChatIds.includes(String(chatId))) {
    res.status(200).json({ ok: true, ignored: true, reason: "chat no autorizado" });
    return;
  }

  try {
    const madrid = nowInMadridParts();
    const climaMessage = await buildClimaMessage(madrid);
    for (const id of allowedChatIds) {
      await sendTelegramMessage(token, id, climaMessage);
    }
    res.status(200).json({ ok: true, sent: true, chatIds: allowedChatIds });
  } catch (error) {
    res.status(200).json({ ok: true, sent: false, error: String(error) });
  }
}
