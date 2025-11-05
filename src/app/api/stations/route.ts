import { NextResponse } from "next/server";
import { getStations } from "@/lib/windborne";
import { getCache, setCache } from "@/lib/cache";

export async function GET() {
  const key = "stations:v1";
  const c = getCache(key);
  if (c) return NextResponse.json(c);

  const s = await getStations();
  setCache(key, s, 5 * 60_000);
  return NextResponse.json(s);
}

