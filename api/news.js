import Parser from "rss-parser";

const NEWS_FEEDS = {
  "Venezuela": [
    { name: "El Nacional", url: "https://www.elnacional.com/feed/" },
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
async function fetchCategory(sources) {
  const perSource = await Promise.all(sources.map(fetchSource));
  const items = [];
  for (let i = 0; items.length < PER_CATEGORY && perSource.some((list) => i < list.length); i++) {
    for (const list of perSource) {
      if (items.length >= PER_CATEGORY) break;
      if (list[i]) items.push(list[i]);
    }
  }
  return items;
}

export default async function handler(req, res) {
  const categories = Object.keys(NEWS_FEEDS);
  const results = await Promise.all(
    categories.map((category) => fetchCategory(NEWS_FEEDS[category]))
  );

  const news = {};
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
