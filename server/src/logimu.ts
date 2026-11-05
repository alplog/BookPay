import type { BookPricesResponse, FbaOffer, OfferGroup } from "./types.js";

const OFFERS_URL = "https://api.logimu.com/v1/offers";
const TIMEOUT_MS = 45_000; // Logimu fetches live; docs say typically 4-12 s

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

function parseSeller(raw: unknown): { offer: FbaOffer; conditionClass: string } | null {
  if (!isObject(raw)) return null;
  if (raw.fulfillment !== "FBA") return null;
  if (typeof raw.price !== "number" || !Number.isFinite(raw.price)) return null;
  if (typeof raw.condition_class !== "string") return null;

  const shipping =
    typeof raw.shipping_cost === "number" && Number.isFinite(raw.shipping_cost) && raw.shipping_cost > 0
      ? raw.shipping_cost
      : 0;

  return {
    conditionClass: raw.condition_class,
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

export function parseOffers(isbn: string, body: unknown): BookPricesResponse {
  if (!isObject(body)) throw new LogimuError("Malformed response from pricing provider.", 502);

  const result: BookPricesResponse = {
    isbn,
    currency: "USD",
    fbu: toGroup([]),
    fbn: toGroup([]),
  };

  const cs = body.current_sellers;
  if (cs === null || cs === undefined) {
    if (body.no_sellers === true) return result;
    throw new LogimuError("Malformed response from pricing provider.", 502);
  }
  if (!isObject(cs) || !Array.isArray(cs.sellers)) {
    throw new LogimuError("Malformed response from pricing provider.", 502);
  }

  const fbn: FbaOffer[] = [];
  const fbu: FbaOffer[] = [];
  for (const raw of cs.sellers) {
    const parsed = parseSeller(raw);
    if (!parsed) continue;
    if (parsed.conditionClass === "new") fbn.push(parsed.offer);
    else if (parsed.conditionClass === "used" || parsed.conditionClass.startsWith("used_")) fbu.push(parsed.offer);
  }

  result.fbn = toGroup(fbn);
  result.fbu = toGroup(fbu);
  return result;
}

export async function fetchBookPrices(isbn: string, apiKey: string): Promise<BookPricesResponse> {
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
