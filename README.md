# Book Price Lookup

Enter an ISBN-10 or ISBN-13 and see the current Amazon US FBA Used (FBU) and FBA New (FBN) prices from the [Logimu API](https://api.logimu.com/docs).

- `web/` – React + TypeScript + Vite + Tailwind CSS UI
- `server/` – Express + TypeScript API (`GET /api/book/:isbn`); holds the API key

## Setup

Requires Node.js 22+.

```bash
cd server && npm install && cp .env.example .env   # then set LOGIMU_API_KEY in .env
cd ../web && npm install
```

## Run (development)

One command (installs dependencies, checks `server/.env`, starts both servers):

```bash
./start.sh
```

Or manually, in two terminals:

```bash
cd server && npm run dev   # http://localhost:3001
cd web && npm run dev      # http://localhost:5173 (proxies /api to the server)
```

Open http://localhost:5173 and try `9780812968255`.

## Production

```bash
cd server && npm run build && npm start
cd web && npm run build    # static files in web/dist; serve them behind a proxy that forwards /api to the server
```

## Notes

- Logimu returns prices as USD decimals (e.g. `24.99`). Total = `price` + `shipping_cost` (when > 0).
- Amazon-fulfilled means `fulfillment` is `FBA` (third party) or `AMZ` (sold by Amazon itself). FBN = Amazon-fulfilled with `condition_class === "new"`; FBU = Amazon-fulfilled with `condition_class` `used` or `used_*`.
- Logimu fetches live from Amazon (4–30 s per lookup, longer for books with many offers), and each lookup with offers costs API credits.
- To feel instant, the UI first shows a saved snapshot from Logimu's warehouse (`GET /api/book/:isbn/cached`, ~0.2 s, dimmed and labelled with its date; may be older than live), then replaces it with the live result. Both calls are billed. The server also keeps live results for 5 minutes, so repeat lookups of the same ISBN are instant and free.
- ASR is the overall Amazon sales rank when Logimu has one, otherwise the median of the root "Books" rank over the last 90 days (`bsr_history`). Sub-category ranks (`bsr_leaf`) are never used, since they are far smaller than the Books rank. It shows `—` when there is no recent reading.
- `LOGIMU_API_KEY` lives only in `server/.env`; it is never sent to the browser.
