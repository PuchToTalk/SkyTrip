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
      // Some WindBorne API responses are JSON fragments (e.g., "points": [...] instead of {"points": [...]})
      // Try to fix common cases
      const trimmed = text.trim();
      
      // Check if response starts with "points": (most common case)
      if (trimmed.startsWith('"points":') || trimmed.startsWith("'points':")) {
        try {
          // Extract the array part after "points":
          // Find where the array starts
          const colonIndex = trimmed.indexOf(':');
          if (colonIndex !== -1) {
            const arrayPart = trimmed.substring(colonIndex + 1).trim();
            // Wrap in proper object
            const fixed = `{"points": ${arrayPart}}`;
            const parsed = JSON.parse(fixed) as T;
            console.log(`Fixed JSON fragment for ${path} (wrapped "points": in object)`);
            return parsed;
          }
        } catch (fixError: any) {
          console.error(`Could not fix JSON fragment for ${path}:`, fixError.message);
        }
      }
      
      // Check if response starts with "points" (with or without quotes and colon) - more flexible
      const pointsPattern = /^["']?points["']?\s*:/i;
      if (pointsPattern.test(trimmed)) {
        try {
          // Remove leading "points": if present, then wrap in object
          const match = trimmed.match(pointsPattern);
          if (match) {
            const afterMatch = trimmed.substring(match[0].length).trim();
            const fixed = `{"points": ${afterMatch}}`;
            const parsed = JSON.parse(fixed) as T;
            console.log(`Fixed JSON fragment for ${path} (pattern matched, wrapped in object)`);
            return parsed;
          }
        } catch (fixError: any) {
          console.error(`Could not fix JSON fragment for ${path}:`, fixError.message);
        }
      }
      
      // If response is just an array starting with [, wrap it
      if (trimmed.startsWith('[')) {
        try {
          const fixed = `{"points": ${trimmed}}`;
          const parsed = JSON.parse(fixed) as T;
          console.log(`Fixed JSON array for ${path} (wrapped array in object)`);
          return parsed;
        } catch (fixError: any) {
          console.error(`Could not fix JSON array for ${path}:`, fixError.message);
        }
      }
      
      // If response looks like it might be a fragment with other content, try to extract
      const pointsMatch = trimmed.match(/"points"\s*:\s*\[/);
      if (pointsMatch) {
        try {
          // Find the matching closing bracket
          let bracketCount = 0;
          let startIdx = pointsMatch.index! + pointsMatch[0].length - 1;
          let endIdx = startIdx;
          
          for (let i = startIdx; i < trimmed.length; i++) {
            if (trimmed[i] === '[') bracketCount++;
            if (trimmed[i] === ']') bracketCount--;
            if (bracketCount === 0) {
              endIdx = i + 1;
              break;
            }
          }
          
          if (endIdx > startIdx) {
            const arrayContent = trimmed.substring(startIdx, endIdx);
            const fixed = `{"points": ${arrayContent}}`;
            const parsed = JSON.parse(fixed) as T;
            console.log(`Extracted and fixed JSON fragment for ${path}`);
            return parsed;
          }
        } catch (extractError: any) {
          console.error(`Could not extract JSON fragment for ${path}:`, extractError.message);
        }
      }
      
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
    // First, analyze all temperatures to determine if they're in Fahrenheit
    const temps = data.map((d: any) => Number(d.temperature)).filter(t => Number.isFinite(t));
    
    if (temps.length === 0) {
      return clean(data);
    }
    
    const avgTemp = temps.reduce((sum, t) => sum + t, 0) / temps.length;
    const maxTemp = Math.max(...temps);
    const minTemp = Math.min(...temps);
    
    // Determine if data is in Fahrenheit based on multiple criteria:
    // 1. Typical Fahrenheit range: 32-100°F (0-38°C)
    // 2. If most values are in 32-100 range, likely Fahrenheit
    // 3. If average is reasonable for Fahrenheit but too high for Celsius in that location
    const tempsInFahrenheitRange = temps.filter(t => t >= 32 && t <= 100).length;
    const fahrenheitRatio = tempsInFahrenheitRange / temps.length;
    
    // Check if data looks like Fahrenheit:
    // - Most temps (70%+) are in typical Fahrenheit range (32-100)
    // - Average is in typical Fahrenheit range (32-100) and max is reasonable (< 130)
    // - OR if we see values > 50 but < 130, likely Fahrenheit (since > 50°C is very rare)
    const likelyFahrenheit = 
      fahrenheitRatio > 0.7 || // Most temps in Fahrenheit range
      (avgTemp >= 32 && avgTemp <= 100 && maxTemp < 130) || // Typical Fahrenheit average
      (minTemp >= 32 && maxTemp <= 100 && temps.length > 5) || // All temps in Fahrenheit range
      (maxTemp > 50 && maxTemp < 130 && avgTemp > 40); // Suspiciously high but not impossible for Fahrenheit
    
    if (likelyFahrenheit) {
      console.log(`Station ${stationId}: Detected Fahrenheit temperatures (avg: ${avgTemp.toFixed(1)}°F, range: ${minTemp.toFixed(1)}-${maxTemp.toFixed(1)}°F, ${(fahrenheitRatio * 100).toFixed(0)}% in 32-100 range), converting to Celsius`);
    } else if (maxTemp > 50) {
      // Log warning for suspiciously high temperatures that might be Fahrenheit
      console.warn(`Station ${stationId}: High temperatures detected (max: ${maxTemp.toFixed(1)}°C, avg: ${avgTemp.toFixed(1)}°C). If these seem incorrect, data might be in Fahrenheit.`);
    }
    
    const cleaned = clean(data.map((d: any) => {
      const temp = Number(d.temperature);
      if (!Number.isFinite(temp)) return d;
      
      // Convert if we determined data is in Fahrenheit
      if (likelyFahrenheit) {
        const celsius = (temp - 32) * 5 / 9;
        return {
          ...d,
          temperature: celsius,
        };
      }
      
      // Additional check: if temperature is in suspicious range but wasn't caught by likelyFahrenheit,
      // and it's in a range that's common for Fahrenheit but rare for Celsius, convert it
      // This handles edge cases where the dataset is mixed or has unusual patterns
      if (temp >= 32 && temp <= 100 && maxTemp > 50 && maxTemp < 130) {
        // This looks like Fahrenheit (values in 32-100 range) but max is > 50
        // which suggests it might be Fahrenheit that wasn't caught
        const celsius = (temp - 32) * 5 / 9;
        console.log(`Station ${stationId}: Converting suspicious temp ${temp.toFixed(1)} to Celsius (${celsius.toFixed(1)}°C)`);
        return {
          ...d,
          temperature: celsius,
        };
      }
      
      return d;
    }));
    
    // Final validation: check if converted temperatures make sense
    const convertedTemps = cleaned.map((d: any) => Number(d.temperature)).filter(t => Number.isFinite(t));
    if (convertedTemps.length > 0) {
      const maxConverted = Math.max(...convertedTemps);
      const avgConverted = convertedTemps.reduce((sum, t) => sum + t, 0) / convertedTemps.length;
      
      // If converted temperatures are still suspiciously high (> 50°C average is very rare),
      // log a warning - might indicate data is already in Celsius or conversion issue
      if (avgConverted > 50 && likelyFahrenheit) {
        console.warn(`Station ${stationId}: After conversion, average temp is ${avgConverted.toFixed(1)}°C (max: ${maxConverted.toFixed(1)}°C). This is unusually high - please verify conversion.`);
      }
    }
    
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

