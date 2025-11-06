# SkyTrip

A React/TypeScript web application that combines WindBorne weather data with Google Flights pricing (via SerpApi) to help you find travel destinations based on weather and flight prices.

![SkyTrip Demo](./public/demo.gif)

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- React Query (@tanstack/react-query)
- Leaflet (Map visualization)
- Recharts (Temperature charts)

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── stations/route.ts    # Proxy to WindBorne /stations
│   │   ├── weather/route.ts      # Proxy to /historical_weather
│   │   └── flights/route.ts      # Proxy to SerpApi Google Flights
│   ├── layout.tsx                # Root layout with providers
│   ├── page.tsx                  # Main page (map + filters + table)
│   └── globals.css               # Global styles
├── components/
│   ├── MapView.tsx               # Interactive map with markers
│   ├── FiltersBar.tsx            # Filter controls
│   ├── ChartPanel.tsx            # Temperature chart
│   ├── DestinationsTable.tsx     # Results table
│   └── StationDrawer.tsx         # Station details drawer
└── lib/
    ├── windborne.ts              # WindBorne API client with rate limiting
    ├── cache.ts                  # Server-side in-memory cache
    ├── scoring.ts                # Weather × price scoring
    ├── airports.ts               # Station → IATA mapping
    └── flights/
        ├── types.ts              # Flight types
        ├── provider.ts           # Flight provider interface
        └── provider.serpapi.ts  # SerpApi implementation
```

## API Routes

### `/api/stations`
Fetches all WindBorne weather stations. Cached for 5 minutes.

### `/api/weather?station={id}`
Fetches historical weather data for a station. Cached for 2 minutes. Includes data cleaning to filter out corrupted entries.

### `/api/flights?from={code}&to={code}&outbound_date={date}`
Searches for flights via SerpApi. Cached for 15 minutes.

Query parameters:
- `from`: Origin airport code (required)
- `to`: Destination airport code (required)
- `outbound_date`: Departure date (required, YYYY-MM-DD)
- `return_date`: Return date (optional, YYYY-MM-DD)
- `type`: "one-way" or "round-trip" (optional)
- `stops`: Number of stops, 1 = non-stop only (optional)
- `sort_by`: 2 = price (default)

## How to Start

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

Required environment variables:
- `WINDBORNE_BASE`: WindBorne API base URL (default: https://sfc.windbornesystems.com)
- `SERPAPI_KEY`: Your SerpApi API key (get one at https://serpapi.com)
- `ORIGIN_IATA`: Default origin airport code (e.g., SFO)

3. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
