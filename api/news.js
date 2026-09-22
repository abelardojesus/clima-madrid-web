import Parser from "rss-parser";

const NEWS_FEEDS = {
  "Venezuela": [
    { name: "Crónica Uno", url: "https://cronica.uno/feed/" },
    { name: "Efecto Cocuyo", url: "https://efectococuyo.com/feed/" },
  ],
  "España": [
    { name: "ABC", url: "https://www.abc.es/rss/2.0/portada/" },
    { name: "20minutos", url: "https://www.20minutos.es/rss/madrid/" },
  ],
  "Mundo": [
    { name: "BBC Mundo", url: "https://feeds.bbci.co.uk/mundo/rss.xml" },
    { name: "France24", url: "https://www.france24.com/es/rss" },
  ],
};

// Fuente dedicada a industria y desarrollo militar (todo su contenido es
// relevante). Las fuentes generalistas aportan la actualidad bélica
// (Ucrania, Irán, etc.) pero se filtran por palabra clave para no mezclar
// noticias ajenas al tablón.
const WAR_PRIMARY_FEED = { name: "Infodefensa", url: "https://www.infodefensa.com/feed/all" };
const WAR_FILTERED_FEEDS = [
  { name: "ABC", url: "https://www.abc.es/rss/2.0/internacional/" },
  { name: "BBC Mundo", url: "https://feeds.bbci.co.uk/mundo/rss.xml" },
];
const WAR_KEYWORDS =
  /\b(guerra\w*|ucrania\w*|rusia\w*|ruso\w*|kremlin\w*|putin\w*|zelensk\w*|ir[aá]n\w*|israel\w*|gaza\w*|hamas\w*|hamás\w*|hezbol\w*|otan|nato|misil\w*|dron\w*|militar\w*|ej[eé]rcito\w*|tropas\w*|armamento\w*|defensa\w*|nuclear\w*|b[eé]lic\w*|ofensiva\w*|bombarde\w*|invasi[oó]n\w*)\b/i;

const PER_CATEGORY = 5;
const parser = new Parser({
  timeout: 8000,
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});

function extractImage(entry) {
  if (entry.enclosure?.url && (entry.enclosure.type || "").startsWith("image")) {
    return entry.enclosure.url;
  }
  const mediaContent = Array.isArray(entry.mediaContent) ? entry.mediaContent : [];
  const fromMediaContent = mediaContent.find((m) => m?.$?.url)?.$?.url;
  if (fromMediaContent) return fromMediaContent;

  if (entry.mediaThumbnail?.$?.url) return entry.mediaThumbnail.$.url;

  const html = entry["content:encoded"] || entry.content || entry.summary || "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match) return match[1];

  return null;
}

async function fetchOgImage(link) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(link, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ClimaMadridBot/1.0)" },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const html = await response.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

async function fetchSource({ name, url }) {
  try {
    const feed = await parser.parseURL(url);
    return feed.items
      .map((entry) => {
        const title = (entry.title || "").trim();
        if (!title) return null;
        return { title, source: name, link: entry.link || null, image: extractImage(entry) };
      })
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

// Intercala las fuentes en vez de agotar la primera: así una fuente sin
// imágenes en su feed (p. ej. bloqueada por Cloudflare al pedir la imagen
// og:image) no acapara la categoría entera dejándola sin fotos.
function interleave(lists) {
  const items = [];
  for (let i = 0; items.length < PER_CATEGORY && lists.some((list) => i < list.length); i++) {
    for (const list of lists) {
      if (items.length >= PER_CATEGORY) break;
      if (list[i]) items.push(list[i]);
    }
  }
  return items;
}

async function fetchCategory(sources) {
  const perSource = await Promise.all(sources.map(fetchSource));
  return interleave(perSource);
}

async function fetchWarCategory() {
  const [primary, ...filteredRaw] = await Promise.all([
    fetchSource(WAR_PRIMARY_FEED),
    ...WAR_FILTERED_FEEDS.map(fetchSource),
  ]);
  const filtered = filteredRaw.map((list) => list.filter((item) => WAR_KEYWORDS.test(item.title)));
  return interleave([primary, ...filtered]);
}

export default async function handler(req, res) {
  const categories = Object.keys(NEWS_FEEDS);
  const results = await Promise.all([
    ...categories.map((category) => fetchCategory(NEWS_FEEDS[category])),
    fetchWarCategory(),
  ]);

  const news = {};
  news["Guerra y Defensa"] = results[categories.length];
  categories.forEach((category, i) => {
    news[category] = results[i];
  });

  const missingImage = Object.values(news)
    .flat()
    .filter((item) => !item.image && item.link);
  await Promise.all(
    missingImage.map(async (item) => {
      item.image = await fetchOgImage(item.link);
    })
  );

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  res.status(200).json(news);
}
