import { NextResponse } from "next/server";
import { getHistory } from "@/lib/windborne";
import { getCache, setCache } from "@/lib/cache";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("station");
  if (!id)
    return NextResponse.json({ error: "station required" }, { status: 400 });

  const key = `wx:${id}`;
  const c = getCache(key);
  if (c) return NextResponse.json(c);

  try {
    const h = await getHistory(id);
    setCache(key, h, 2 * 60_000);
    return NextResponse.json(h);
  } catch (error: any) {
    console.error(`Weather API error for station ${id}:`, error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch weather data" },
      { status: 500 }
    );
  }
}

