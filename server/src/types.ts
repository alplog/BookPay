export interface FbaOffer {
  seller: string;
  condition: string;
  price: number;
  shipping: number;
  total: number;
}

export interface OfferGroup {
  lowestTotal: number | null;
  count: number;
  offers: FbaOffer[];
}

export interface BookPricesResponse {
  isbn: string;
  title: string | null;
  imageUrl: string | null;
  format: string | null;
  weightLbs: number | null;
  /** Amazon sales rank: overall BSR, else the 90-day median of the root "Books" rank. Never a sub-category rank. */
  asr: number | null;
  asrCategory: string | null;
  listPrice: number | null;
  /** "cache" = Logimu warehouse snapshot (instant, may be older); "live" = fetched from Amazon now. */
  source: "live" | "cache";
  /** When the seller list was observed (ISO timestamp). */
  asOf: string | null;
  totalOffers: number;
  currency: "USD";
  /** Merchant-fulfilled used / new offers. */
  mu: OfferGroup;
  mn: OfferGroup;
  /** Amazon-fulfilled (FBA or sold by Amazon) used / new offers. */
  fbu: OfferGroup;
  fbn: OfferGroup;
}

export interface ApiErrorBody {
  error: string;
}
