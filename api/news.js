import { getBoards } from "../lib/news.js";

export default async function handler(req, res) {
  try {
    const boards = await getBoards();
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
    res.status(200).json(Object.fromEntries(boards));
  } catch {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: "No se pudieron obtener las noticias" });
  }
}
