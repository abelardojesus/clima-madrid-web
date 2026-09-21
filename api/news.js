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

async function fetchCategory(sources) {
  const items = [];
  for (const { name, url } of sources) {
    if (items.length >= PER_CATEGORY) break;
    try {
      const feed = await parser.parseURL(url);
      for (const entry of feed.items) {
        if (items.length >= PER_CATEGORY) break;
        const title = (entry.title || "").trim();
        if (title) {
          items.push({
            title,
            source: name,
            link: entry.link || null,
            image: extractImage(entry),
          });
        }
      }
    } catch (error) {
      continue;
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

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  res.status(200).json(news);
}
