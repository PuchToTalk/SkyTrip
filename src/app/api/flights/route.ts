import { NextResponse } from "next/server";
import { SerpApiFlightProvider } from "@/lib/flights/provider.serpapi";
import { getCache, setCache } from "@/lib/cache";
import type { FlightSearchParams } from "@/lib/flights/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const outbound_date = url.searchParams.get("outbound_date");
  const return_date = url.searchParams.get("return_date") || undefined;
  const type = url.searchParams.get("type") as "one-way" | "round-trip" | null;
  const deep_search = url.searchParams.get("deep_search") === "true";
  const sort_by = url.searchParams.get("sort_by")
    ? parseInt(url.searchParams.get("sort_by")!)
    : 2;
  const stops = url.searchParams.get("stops")
    ? parseInt(url.searchParams.get("stops")!)
    : undefined;

  if (!from || !to || !outbound_date) {
    return NextResponse.json(
      { error: "from, to, and outbound_date are required" },
      { status: 400 }
    );
  }

  const params: FlightSearchParams = {
    from,
    to,
    outbound_date,
    return_date,
    type: type || undefined,
    deep_search,
    sort_by,
    stops,
  };

  // Create cache key
  const cacheKey = `flights:${JSON.stringify(params)}`;
  const cached = getCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const provider = new SerpApiFlightProvider();
    const result = await provider.search(params);
    // Cache for 15 minutes
    setCache(cacheKey, result, 15 * 60_000);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Flight search failed" },
      { status: 500 }
    );
  }
}

