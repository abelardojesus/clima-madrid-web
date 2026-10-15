import Parser from "rss-parser";

const PER_BOARD = 5;
const FEED_TIMEOUT_MS = 6000;
const OG_IMAGE_TIMEOUT_MS = 2500;

// Guerra y Defensa mezcla una fuente especializada (todo su contenido es relevante)
// con fuentes generalistas filtradas por palabra clave.
const WAR_KEYWORDS =
  /\b(guerra\w*|ucrania\w*|rusia\w*|ruso\w*|kremlin\w*|putin\w*|zelensk\w*|ir[aá]n\w*|israel\w*|gaza\w*|hamas\w*|hamás\w*|hezbol\w*|otan|nato|misil\w*|dron\w*|militar\w*|ej[eé]rcito\w*|tropas\w*|armamento\w*|defensa\w*|nuclear\w*|b[eé]lic\w*|ofensiva\w*|bombarde\w*|invasi[oó]n\w*)\b/i;

// El orden de este array es el orden de los tablones en la web.
const BOARDS = [
  {
    title: "Guerra y Defensa",
    sources: [
      { name: "Infodefensa", url: "https://www.infodefensa.com/feed/all" },
      { name: "ABC", url: "https://www.abc.es/rss/2.0/internacional/", filter: WAR_KEYWORDS },
      { name: "BBC Mundo", url: "https://feeds.bbci.co.uk/mundo/rss.xml", filter: WAR_KEYWORDS },
    ],
  },
  {
    title: "Venezuela",
    sources: [
      { name: "Crónica Uno", url: "https://cronica.uno/feed/" },
      { name: "Efecto Cocuyo", url: "https://efectococuyo.com/feed/" },
    ],
  },
  {
    title: "España",
    sources: [
      { name: "ABC", url: "https://www.abc.es/rss/2.0/portada/" },
      { name: "20minutos", url: "https://www.20minutos.es/rss/madrid/" },
    ],
  },
  {
    title: "Mundo",
    sources: [
      { name: "BBC Mundo", url: "https://feeds.bbci.co.uk/mundo/rss.xml" },
      { name: "France24", url: "https://www.france24.com/es/rss" },
    ],
  },
];

const parser = new Parser({
  timeout: FEED_TIMEOUT_MS,
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});

// Los feeds son contenido no confiable: solo se aceptan URLs http(s) y las imágenes se fuerzan a https.
function httpUrl(value, { base, upgrade = false } = {}) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (upgrade) url.protocol = "https:";
    return url.href;
  } catch {
    return null;
  }
}

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
  return match ? match[1] : null;
}

async function fetchOgImage(link) {
  try {
    const response = await fetch(link, {
      signal: AbortSignal.timeout(OG_IMAGE_TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ClimaMadridBot/1.0)" },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    return httpUrl(match?.[1], { base: link, upgrade: true });
  } catch {
    return null;
  }
}

async function fetchFeed(url) {
  try {
    const feed = await parser.parseURL(url);
    return feed.items
      .map((entry) => {
        const title = (entry.title || "").replace(/\s+/g, " ").trim();
        if (!title) return null;
        const link = httpUrl(entry.link);
        const published = entry.isoDate && !Number.isNaN(Date.parse(entry.isoDate)) ? entry.isoDate : null;
        return {
          title,
          link,
          image: httpUrl(extractImage(entry), { base: link || url, upgrade: true }),
          published,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Intercala las fuentes para que ninguna acapare el tablón, y salta lo ya usado en otro tablón.
function interleave(lists, used) {
  const items = [];
  const key = (item) => item.link || item.title;
  for (let i = 0; items.length < PER_BOARD && lists.some((list) => i < list.length); i++) {
    for (const list of lists) {
      if (items.length >= PER_BOARD) break;
      const item = list[i];
      if (!item || used.has(key(item))) continue;
      used.add(key(item));
      items.push(item);
    }
  }
  return items;
}

async function buildNews() {
  const urls = [...new Set(BOARDS.flatMap((board) => board.sources.map((source) => source.url)))];
  const feeds = new Map(await Promise.all(urls.map(async (url) => [url, await fetchFeed(url)])));

  const used = new Set();
  return BOARDS.map(({ title, sources }) => {
    const perSource = sources.map(({ name, url, filter }) =>
      feeds
        .get(url)
        .filter((item) => !filter || filter.test(item.title))
        .map((item) => ({ ...item, source: name }))
    );
    return [title, interleave(perSource, used)];
  });
}

// Devuelve [[titulo, items], ...] en el orden de los tablones.
// fillImages=false evita las peticiones extra a las páginas de las noticias (Telegram no usa imágenes).
export async function getBoards({ fillImages = true } = {}) {
  const boards = await buildNews();
  if (fillImages) {
    const missingImage = boards.flatMap(([, items]) => items).filter((item) => !item.image && item.link);
    await Promise.all(
      missingImage.map(async (item) => {
        item.image = await fetchOgImage(item.link);
      })
    );
  }
  return boards;
}
