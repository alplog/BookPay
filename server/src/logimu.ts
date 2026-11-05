import type { BookPricesResponse, FbaOffer, OfferGroup } from "./types.js";

const OFFERS_URL = "https://api.logimu.com/v1/offers";
const PRODUCT_URL = "https://api.logimu.com/v1/product";
const TIMEOUT_MS = 45_000; // Logimu fetches live; docs say typically 4-12 s
const CACHED_TIMEOUT_MS = 10_000; // warehouse reads answer in well under a second
const RESULT_TTL_MS = 5 * 60_000;
const CACHED_TTL_MS = 30_000;
const MAX_CACHED_RESULTS = 500;

export class LogimuError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Prices are plain USD decimals (e.g. 24.99), per Logimu docs. */
function toCents(n: number): number {
  return Math.round(n * 100);
}

type Column = "fbn" | "fbu" | "mn" | "mu";

function parseSeller(raw: unknown): { offer: FbaOffer; column: Column } | null {
  if (!isObject(raw)) return null;
  // AMZ = sold by Amazon itself (also shipped by Amazon); FBA = third party fulfilled by Amazon.
  const amazonFulfilled = raw.fulfillment === "FBA" || raw.fulfillment === "AMZ";
  if (!amazonFulfilled && raw.fulfillment !== "FBM") return null;
  if (typeof raw.price !== "number" || !Number.isFinite(raw.price)) return null;
  if (typeof raw.condition_class !== "string") return null;

  const isNew = raw.condition_class === "new";
  const isUsed = raw.condition_class === "used" || raw.condition_class.startsWith("used_");
  if (!isNew && !isUsed) return null;

  const shipping =
    typeof raw.shipping_cost === "number" && Number.isFinite(raw.shipping_cost) && raw.shipping_cost > 0
      ? raw.shipping_cost
      : 0;

  return {
    column: amazonFulfilled ? (isNew ? "fbn" : "fbu") : isNew ? "mn" : "mu",
    offer: {
      seller: typeof raw.seller === "string" ? raw.seller : "Unknown seller",
      condition: typeof raw.condition === "string" ? raw.condition : raw.condition_class,
      price: raw.price,
      shipping,
      total: (toCents(raw.price) + toCents(shipping)) / 100,
    },
  };
}

function toGroup(offers: FbaOffer[]): OfferGroup {
  const sorted = [...offers].sort((a, b) => a.total - b.total);
  return { lowestTotal: sorted[0]?.total ?? null, count: sorted.length, offers: sorted };
}

type BookMeta = Pick<
  BookPricesResponse,
  "imageUrl" | "format" | "weightLbs" | "asr" | "asrCategory" | "listPrice"
>;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

const ASR_WINDOW_DAYS = 90;

/** Median of the root-category ("Books") rank over the last 90 days of Logimu's BSR history. */
function rootRank(history: unknown): { rank: number; category: string } | null {
  if (!isObject(history) || !Array.isArray(history.series)) return null;
  const root = history.series.find((s): s is Json => isObject(s) && s.is_root === true && Array.isArray(s.points));
  if (!root || !Array.isArray(root.points)) return null;

  const cutoff = Date.now() - ASR_WINDOW_DAYS * 86_400_000;
  const ranks: number[] = [];
  for (const p of root.points) {
    if (!isObject(p) || typeof p.date !== "string") continue;
    const rank = num(p.rank);
    if (rank !== null && Date.parse(p.date) >= cutoff) ranks.push(rank);
  }
  if (ranks.length === 0) return null;

  ranks.sort((a, b) => a - b);
  const mid = Math.floor(ranks.length / 2);
  const rank = ranks.length % 2 ? (ranks[mid] as number) : ((ranks[mid - 1] as number) + (ranks[mid] as number)) / 2;
  return { rank: Math.round(rank), category: typeof root.category_name === "string" ? root.category_name : "Books" };
}

function parseMeta(body: Json): BookMeta {
  const images = Array.isArray(body.images) ? body.images : [];
  const imageUrl = [body.image_url, body.image, images[0]].find((v): v is string => typeof v === "string") ?? null;

  const dims = isObject(body.dimensions) ? body.dimensions : {};
  const weightG = num(dims.weight_g);
  const weightLbs = num(dims.weight_value) !== null && dims.weight_unit === "lb"
    ? num(dims.weight_value)
    : weightG !== null
      ? Math.round((weightG / 453.592) * 100) / 100
      : null;

  // Books rarely carry an overall `bsr` and `bsr_leaf` is a small sub-category rank, so use the root "Books" rank.
  const overall = num(body.bsr);
  const root = overall === null ? rootRank(body.bsr_history) : null;
  const current = isObject(body.deal_history) && isObject(body.deal_history.current) ? body.deal_history.current : {};

  return {
    imageUrl,
    format: typeof body.format === "string" ? body.format : null,
    weightLbs,
    asr: overall ?? root?.rank ?? null,
    asrCategory: root?.category ?? null,
    listPrice: num(current.list_price),
  };
}

export function parseOffers(
  isbn: string,
  body: unknown,
  source: BookPricesResponse["source"] = "live",
): BookPricesResponse {
  if (!isObject(body)) throw new LogimuError("Malformed response from pricing provider.", 502);

  const cs = body.current_sellers;
  const asOf =
    isObject(cs) && typeof cs.as_of === "string"
      ? cs.as_of
      : typeof body.observed_at === "string"
        ? body.observed_at
        : null;

  const result: BookPricesResponse = {
    isbn,
    title: typeof body.title === "string" ? body.title : null,
    ...parseMeta(body),
    source,
    asOf,
    totalOffers: 0,
    currency: "USD",
    mu: toGroup([]),
    mn: toGroup([]),
    fbu: toGroup([]),
    fbn: toGroup([]),
  };

  if (cs === null || cs === undefined) {
    if (body.no_sellers === true) return result;
    throw new LogimuError("Malformed response from pricing provider.", 502);
  }
  if (!isObject(cs) || !Array.isArray(cs.sellers)) {
    throw new LogimuError("Malformed response from pricing provider.", 502);
  }

  result.totalOffers = cs.sellers.length;

  const columns: Record<Column, FbaOffer[]> = { fbn: [], fbu: [], mn: [], mu: [] };
  for (const raw of cs.sellers) {
    const parsed = parseSeller(raw);
    if (parsed) columns[parsed.column].push(parsed.offer);
  }

  result.fbn = toGroup(columns.fbn);
  result.fbu = toGroup(columns.fbu);
  result.mn = toGroup(columns.mn);
  result.mu = toGroup(columns.mu);
  return result;
}

type Memo<T> = Map<string, { at: number; promise: Promise<T> }>;

/** Short-lived promise cache: repeat and concurrent calls for the same key share one upstream request. */
function memoize<T>(store: Memo<T>, key: string, ttlMs: number, run: () => Promise<T>, keepFailures = false): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.promise;

  const promise = run();
  if (store.size >= MAX_CACHED_RESULTS) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  const entry = { at: Date.now(), promise };
  store.set(key, entry);
  if (!keepFailures) {
    promise.catch(() => {
      if (store.get(key) === entry) store.delete(key);
    });
  }
  return promise;
}

const liveResults: Memo<BookPricesResponse> = new Map();
const cachedResults: Memo<BookPricesResponse | null> = new Map();

/** Live lookup (slow, accurate), enriched with ASR / list price from the warehouse snapshot. */
export function fetchBookPrices(isbn: string, apiKey: string): Promise<BookPricesResponse> {
  return memoize(liveResults, isbn, RESULT_TTL_MS, async () => {
    const [live, snapshot] = await Promise.all([fetchLivePrices(isbn, apiKey), fetchCachedBookPrices(isbn, apiKey)]);
    if (!snapshot) return live;
    return {
      ...live,
      title: live.title ?? snapshot.title,
      imageUrl: live.imageUrl ?? snapshot.imageUrl,
      format: snapshot.format,
      weightLbs: snapshot.weightLbs,
      asr: snapshot.asr,
      asrCategory: snapshot.asrCategory,
      listPrice: snapshot.listPrice,
    };
  });
}

/** Instant (~0.2 s) read from Logimu's warehouse. May be older than a live read; returns null if unavailable. */
export function fetchCachedBookPrices(isbn: string, apiKey: string): Promise<BookPricesResponse | null> {
  return memoize(cachedResults, isbn, CACHED_TTL_MS, () => fetchSnapshot(isbn, apiKey), true);
}

async function fetchSnapshot(isbn: string, apiKey: string): Promise<BookPricesResponse | null> {
  const url = new URL(PRODUCT_URL);
  url.searchParams.set("gtin", isbn);
  url.searchParams.set("country", "us");
  url.searchParams.set("mode", "cache");
  url.searchParams.set("include_used", "true");
  url.searchParams.set("bsr_history", "true"); // root "Books" rank series; no extra credits

  try {
    const res = await fetch(url, {
      headers: { "X-API-KEY": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(CACHED_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return parseOffers(isbn, await res.json(), "cache");
  } catch {
    return null;
  }
}

async function fetchLivePrices(isbn: string, apiKey: string): Promise<BookPricesResponse> {
  const url = new URL(OFFERS_URL);
  url.searchParams.set("gtin", isbn);
  url.searchParams.set("country", "us");
  url.searchParams.set("include_used", "true");

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "X-API-KEY": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new LogimuError("Could not reach the pricing provider. Please try again.", 504);
  }

  if (res.status === 404) throw new LogimuError("No Amazon listing found for this ISBN.", 404);
  if (res.status === 429) throw new LogimuError("Rate limit reached. Please wait a moment and try again.", 429);
  if (res.status === 401 || res.status === 403) {
    console.error("Logimu rejected the API key (status %d)", res.status);
    throw new LogimuError("Pricing service is not configured correctly.", 502);
  }
  if (res.status === 503) throw new LogimuError("Amazon is busy right now. Please try again shortly.", 503);
  if (!res.ok) {
    console.error("Logimu error status %d", res.status);
    throw new LogimuError("Pricing provider returned an error. Please try again.", 502);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new LogimuError("Malformed response from pricing provider.", 502);
  }
  return parseOffers(isbn, body);
}
