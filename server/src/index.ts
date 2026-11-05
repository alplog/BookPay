import express from "express";
import { normalizeIsbn } from "./isbn.js";
import { fetchBookPrices, fetchCachedBookPrices, LogimuError } from "./logimu.js";
import type { ApiErrorBody, BookPricesResponse } from "./types.js";

try {
  process.loadEnvFile();
} catch {
  // no .env file; rely on the real environment
}

const apiKey = process.env.LOGIMU_API_KEY;
if (!apiKey) {
  console.error("LOGIMU_API_KEY is not set. Copy .env.example to .env and add your key.");
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3001);
const app = express();
app.disable("x-powered-by");

app.get("/api/book/:isbn/cached", async (req, res: express.Response<BookPricesResponse | ApiErrorBody>) => {
  const isbn = normalizeIsbn(req.params.isbn);
  if (!isbn) {
    res.status(400).json({ error: "Invalid ISBN. Enter a valid ISBN-10 or ISBN-13." });
    return;
  }
  const cached = await fetchCachedBookPrices(isbn, apiKey);
  if (!cached) {
    res.status(404).json({ error: "No saved data for this ISBN." });
    return;
  }
  res.json(cached);
});

app.get("/api/book/:isbn", async (req, res: express.Response<BookPricesResponse | ApiErrorBody>) => {
  const isbn = normalizeIsbn(req.params.isbn);
  if (!isbn) {
    res.status(400).json({ error: "Invalid ISBN. Enter a valid ISBN-10 or ISBN-13." });
    return;
  }
  try {
    res.json(await fetchBookPrices(isbn, apiKey));
  } catch (err) {
    if (err instanceof LogimuError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Unexpected server error." });
  }
});

app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
