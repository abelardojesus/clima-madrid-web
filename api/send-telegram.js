import { nowInMadridParts, buildClimaMessage, sendReplacingPrevious, madridDateKey } from "../lib/clima.js";
import { stateAvailable, getValue, setValue } from "../lib/state.js";

const TARGET_HOUR_MADRID = 9;

export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIdsRaw = process.env.TELEGRAM_CHAT_ID || "";
  const chatIds = chatIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = req.headers.authorization;
    const providedSecret = req.query.secret;
    const authorized = authHeader === `Bearer ${cronSecret}` || providedSecret === cronSecret;
    if (!authorized) {
      res.status(401).json({ error: "No autorizado" });
      return;
    }
  }

  if (!token || chatIds.length === 0) {
    res.status(500).json({ error: "Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID en las variables de entorno de Vercel" });
    return;
  }

  const force = req.query.force === "1";
  const madrid = nowInMadridParts();

  if (!force && madrid.hour !== TARGET_HOUR_MADRID) {
    res.status(200).json({
      sent: false,
      reason: `Hora actual en Madrid: ${madrid.hour}:${madrid.minute} (objetivo: ${TARGET_HOUR_MADRID}:00)`,
    });
    return;
  }

  const today = madridDateKey();
  try {
    if (!force && stateAvailable() && (await getValue("last_sent_date")) === today) {
      res.status(200).json({ sent: false, reason: `Ya se envió el mensaje hoy (${today})` });
      return;
    }

    const message = await buildClimaMessage(madrid);
    const results = [];
    for (const chatId of chatIds) {
      results.push(await sendReplacingPrevious(token, chatId, message));
    }
    if (!force && stateAvailable()) await setValue("last_sent_date", today);
    res.status(200).json({ sent: true, results, madridTime: `${madrid.hour}:${madrid.minute}` });
  } catch (error) {
    res.status(502).json({ sent: false, error: String(error) });
  }
}
