import Parser from "rss-parser";

const MADRID_LAT = 40.4168;
const MADRID_LON = -3.7038;

const WEATHER_CODES = {
  0: ["Cielo despejado", "☀️"],
  1: ["Mayormente despejado", "🌤️"],
  2: ["Parcialmente nublado", "⛅"],
  3: ["Nublado", "☁️"],
  45: ["Niebla", "🌫️"],
  48: ["Niebla con escarcha", "🌫️"],
  51: ["Llovizna ligera", "🌦️"],
  53: ["Llovizna moderada", "🌦️"],
  55: ["Llovizna intensa", "🌧️"],
  61: ["Lluvia ligera", "🌧️"],
  63: ["Lluvia moderada", "🌧️"],
  65: ["Lluvia intensa", "🌧️"],
  71: ["Nieve ligera", "🌨️"],
  73: ["Nieve moderada", "🌨️"],
  75: ["Nieve intensa", "🌨️"],
  80: ["Chubascos ligeros", "🌦️"],
  81: ["Chubascos moderados", "🌧️"],
  82: ["Chubascos fuertes", "⛈️"],
  95: ["Tormenta", "⛈️"],
  96: ["Tormenta con granizo", "⛈️"],
  99: ["Tormenta fuerte con granizo", "⛈️"],
};

const NEWS_FEEDS = {
  "🇻🇪 Venezuela": [
    { name: "El Nacional", url: "https://www.elnacional.com/feed/" },
    { name: "Efecto Cocuyo", url: "https://efectococuyo.com/feed/" },
  ],
  "🇪🇸 España": [
    { name: "ABC", url: "https://www.abc.es/rss/2.0/portada/" },
    { name: "20minutos", url: "https://www.20minutos.es/rss/madrid/" },
  ],
  "🌍 Mundo": [
    { name: "BBC Mundo", url: "https://feeds.bbci.co.uk/mundo/rss.xml" },
    { name: "France24", url: "https://www.france24.com/es/rss" },
  ],
};
const NEWS_PER_CATEGORY = 5;
const NUMBER_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
const parser = new Parser({ timeout: 8000 });

const WEEKDAY_MAP = {
  Monday: "lunes", Tuesday: "martes", Wednesday: "miércoles",
  Thursday: "jueves", Friday: "viernes", Saturday: "sábado", Sunday: "domingo",
};
const MONTH_MAP = {
  January: "enero", February: "febrero", March: "marzo", April: "abril",
  May: "mayo", June: "junio", July: "julio", August: "agosto",
  September: "septiembre", October: "octubre", November: "noviembre", December: "diciembre",
};

export function nowInMadridParts() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return {
    weekdayEn: parts.weekday,
    day: parseInt(parts.day, 10),
    monthEn: parts.month,
    year: parts.year,
    hour: parseInt(parts.hour === "24" ? "0" : parts.hour, 10),
    minute: parts.minute,
  };
}

export async function getWeather() {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${MADRID_LAT}&longitude=${MADRID_LON}` +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code" +
    "&daily=sunrise,sunset,precipitation_probability_max,temperature_2m_max,temperature_2m_min" +
    "&timezone=Europe%2FMadrid";
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo respondió ${response.status}`);
  return response.json();
}

export async function getNews() {
  const news = {};
  for (const [category, sources] of Object.entries(NEWS_FEEDS)) {
    const items = [];
    for (const { name, url } of sources) {
      if (items.length >= NEWS_PER_CATEGORY) break;
      try {
        const feed = await parser.parseURL(url);
        for (const entry of feed.items) {
          if (items.length >= NEWS_PER_CATEGORY) break;
          const title = (entry.title || "").trim();
          if (title) items.push({ title, source: name });
        }
      } catch (e) {
        continue;
      }
    }
    news[category] = items;
  }
  return news;
}

function recommendation(apparentTemp, rainProb, windSpeed) {
  const tips = [];
  if (rainProb >= 40) tips.push("lleva paraguas");
  if (apparentTemp <= 10) tips.push("abrígate bien, hace frío");
  else if (apparentTemp <= 17) tips.push("chaqueta recomendada");
  else if (apparentTemp >= 28) tips.push("ropa ligera, hace calor");
  if (windSpeed >= 30) tips.push("cuidado con el viento fuerte");
  if (tips.length === 0) tips.push("condiciones normales, sin nada especial que llevar");
  const joined = tips.join(", ");
  return joined.charAt(0).toUpperCase() + joined.slice(1) + ".";
}

function greeting(hour) {
  if (hour < 12) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function formatMessage(data, news, madrid) {
  const current = data.current;
  const daily = data.daily;
  const [desc, emoji] = WEATHER_CODES[current.weather_code] || ["Condición desconocida", "🌡️"];
  const sunrise = daily.sunrise[0].slice(11, 16);
  const sunset = daily.sunset[0].slice(11, 16);
  const rec = recommendation(
    current.apparent_temperature,
    daily.precipitation_probability_max[0],
    current.wind_speed_10m
  );
  const fecha = `${WEEKDAY_MAP[madrid.weekdayEn]}, ${madrid.day} de ${MONTH_MAP[madrid.monthEn]} de ${madrid.year}`;

  const lines = [
    `${greeting(madrid.hour)}! 👋`,
    "",
    `📍 Madrid — ${fecha}`,
    `🕐 Hora local: ${String(madrid.hour).padStart(2, "0")}:${madrid.minute}`,
    "",
    `${emoji} ${desc}`,
    `🌡️ Temperatura: ${current.temperature_2m}°C (sensación ${current.apparent_temperature}°C)`,
    `📈 Máx/Mín hoy: ${daily.temperature_2m_max[0]}°C / ${daily.temperature_2m_min[0]}°C`,
    `💧 Humedad: ${current.relative_humidity_2m}%`,
    `☔ Prob. de lluvia: ${daily.precipitation_probability_max[0]}%`,
    `💨 Viento: ${current.wind_speed_10m} km/h`,
    `🌅 Amanece: ${sunrise} · 🌇 Anochece: ${sunset}`,
    "",
    `👕 Para salir a trabajar: ${rec}`,
  ];

  for (const [category, items] of Object.entries(news)) {
    lines.push("");
    lines.push("▬▬▬▬▬▬▬▬▬▬▬▬▬▬");
    lines.push(`📰 ${category.toUpperCase()}`);
    lines.push("▬▬▬▬▬▬▬▬▬▬▬▬▬▬");
    if (items.length) {
      items.forEach((item, i) => {
        const num = NUMBER_EMOJIS[i] || `${i + 1}.`;
        lines.push(`${num} ${item.title}`);
        lines.push(`    📎 Fuente: ${item.source}`);
      });
    } else {
      lines.push("(sin noticias disponibles ahora mismo)");
    }
  }

  return lines.join("\n");
}

export async function sendTelegramMessage(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ chat_id: chatId, text }),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`Telegram respondió ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

export async function buildClimaMessage(madrid) {
  const [weather, news] = await Promise.all([getWeather(), getNews()]);
  return formatMessage(weather, news, madrid);
}
