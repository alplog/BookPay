export interface FbaOffer {
  seller: string
  condition: string
  price: number
  shipping: number
  total: number
}

export interface OfferGroup {
  lowestTotal: number | null
  count: number
  offers: FbaOffer[]
}

export interface BookPrices {
  isbn: string
  title: string | null
  imageUrl: string | null
  format: string | null
  weightLbs: number | null
  asr: number | null
  asrCategory: string | null
  listPrice: number | null
  source: 'live' | 'cache'
  asOf: string | null
  totalOffers: number
  currency: 'USD'
  mu: OfferGroup
  mn: OfferGroup
  fbu: OfferGroup
  fbn: OfferGroup
}
