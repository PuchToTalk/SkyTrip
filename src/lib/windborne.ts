const BASE = process.env.WINDBORNE_BASE!;
const LIMIT = 20;
const WINDOW = 60_000;

let stamps: number[] = [];

async function rlFetch<T>(path: string): Promise<T> {
  const now = Date.now();
  stamps = stamps.filter((t) => now - t < WINDOW);
  if (stamps.length >= LIMIT) {
    const wait = WINDOW - (now - stamps[0]);
    await new Promise((r) => setTimeout(r, wait));
  }
  stamps.push(Date.now());

  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate: 60 } });
    if (!res.ok) {
      throw new Error(`WindBorne ${res.status}`);
    }
    
    const text = await res.text();
    if (!text || text.trim().length === 0) {
      throw new Error("Empty response from WindBorne API");
    }
    
    try {
      return JSON.parse(text) as T;
    } catch (parseError) {
      console.error(`JSON parse error for ${path}:`, parseError);
      console.error(`Response text (first 500 chars):`, text.substring(0, 500));
      throw new Error(`Invalid JSON response from WindBorne API`);
    }
  } catch (error: any) {
    if (error.message && error.message.includes("WindBorne") || error.message.includes("JSON") || error.message.includes("Empty")) {
      throw error;
    }
    throw new Error(`WindBorne fetch error: ${error.message}`);
  }
}

export type Station = {
  id: string;
  name?: string;
  lat?: number;
  lon?: number;
  [k: string]: unknown;
};

export type WX = {
  timestamp: string;
  temperature?: number | string | null;
  [k: string]: unknown;
};

// WindBorne API returns stations with different field names, transform them
type WindBorneStation = {
  station_id: string;
  station_name?: string;
  latitude?: number;
  longitude?: number;
  [k: string]: unknown;
};

export const getStations = async (): Promise<Station[]> => {
  const data = await rlFetch<WindBorneStation[]>("/stations");
  return data.map((s) => ({
    id: s.station_id,
    name: s.station_name,
    lat: s.latitude,
    lon: s.longitude,
    ...s, // Keep original data for reference
  }));
};

export async function getHistory(stationId: string): Promise<WX[]> {
  try {
    const response = await rlFetch<any>(
      `/historical_weather?station=${encodeURIComponent(stationId)}`
    );
    
    // WindBorne API returns data in { points: [...] } format
    let data: WX[];
    if (Array.isArray(response)) {
      data = response;
    } else if (response && Array.isArray(response.points)) {
      data = response.points;
    } else {
      // No data or unexpected format
      console.warn(`Unexpected response format for station ${stationId}:`, typeof response);
      return [];
    }
    
    // Convert Fahrenheit to Celsius if needed and clean data
    const cleaned = clean(data.map((d: any) => {
      // If temperature looks like Fahrenheit (> 50), convert to Celsius
      const temp = Number(d.temperature);
      if (temp > 50 && temp < 150) {
        // Likely Fahrenheit, convert to Celsius
        return {
          ...d,
          temperature: (temp - 32) * 5 / 9,
        };
      }
      return d;
    }));
    
    return cleaned;
  } catch (error: any) {
    console.error(`Error fetching history for station ${stationId}:`, error.message);
    // Return empty array instead of throwing to allow graceful degradation
    return [];
  }
}

// minimal corruption handling; show "Data Quality" in UI
export function clean(arr: WX[]) {
  return arr.filter((p) => {
    const t = new Date(p.timestamp).getTime();
    if (Number.isNaN(t)) return false;
    const temp = Number(p.temperature);
    if (!Number.isFinite(temp)) return false;
    // Accept wider range after conversion (in Celsius, -50 to 50 is reasonable)
    if (temp < -50 || temp > 50) return false;
    return true;
  });
}

