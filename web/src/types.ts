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
  currency: 'USD'
  fbu: OfferGroup
  fbn: OfferGroup
}
