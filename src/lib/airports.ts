// Minimal station→IATA helper (MVP)
// Maps major ASOS regions to nearest IATA codes
const STATION_TO_IATA: Record<string, string> = {
  // West Coast
  SFO: "SFO",
  LAX: "LAX",
  SEA: "SEA",
  PDX: "PDX",
  SAN: "SAN",
  // East Coast
  JFK: "JFK",
  LGA: "LGA",
  EWR: "EWR",
  BOS: "BOS",
  MIA: "MIA",
  ATL: "ATL",
  // Central
  ORD: "ORD",
  DFW: "DFW",
  DEN: "DEN",
  IAH: "IAH",
  MSP: "MSP",
  // Add more as needed
};

// Try to extract IATA from station name or ID
export function getIATAFromStation(station: {
  id?: string;
  name?: string;
}): string | null {
  const searchStr = `${station.name || ""} ${station.id || ""}`.toUpperCase();
  
  // Direct match
  for (const [key, value] of Object.entries(STATION_TO_IATA)) {
    if (searchStr.includes(key)) return value;
  }
  
  // Fallback: return null to prompt user
  return null;
}

// Airport coordinates (lat, lon)
const AIRPORT_COORDINATES: Record<string, { lat: number; lon: number }> = {
  SFO: { lat: 37.6213, lon: -122.379 },
  LAX: { lat: 33.9425, lon: -118.4081 },
  SEA: { lat: 47.4502, lon: -122.3088 },
  PDX: { lat: 45.5898, lon: -122.5951 },
  SAN: { lat: 32.7338, lon: -117.1933 },
  JFK: { lat: 40.6413, lon: -73.7781 },
  LGA: { lat: 40.7769, lon: -73.874 },
  EWR: { lat: 40.6895, lon: -74.1745 },
  BOS: { lat: 42.3656, lon: -71.0096 },
  MIA: { lat: 25.7959, lon: -80.287 },
  ATL: { lat: 33.6407, lon: -84.4277 },
  ORD: { lat: 41.9742, lon: -87.9073 },
  DFW: { lat: 32.8998, lon: -97.0403 },
  DEN: { lat: 39.8561, lon: -104.6737 },
  IAH: { lat: 29.9902, lon: -95.3368 },
  MSP: { lat: 44.8848, lon: -93.2223 },
};

// List of major airports for dropdown
export const MAJOR_AIRPORTS = [
  { code: "SFO", name: "San Francisco, CA" },
  { code: "LAX", name: "Los Angeles, CA" },
  { code: "SEA", name: "Seattle, WA" },
  { code: "JFK", name: "New York, NY (JFK)" },
  { code: "LGA", name: "New York, NY (LGA)" },
  { code: "BOS", name: "Boston, MA" },
  { code: "MIA", name: "Miami, FL" },
  { code: "ATL", name: "Atlanta, GA" },
  { code: "ORD", name: "Chicago, IL" },
  { code: "DFW", name: "Dallas, TX" },
  { code: "DEN", name: "Denver, CO" },
  { code: "IAH", name: "Houston, TX" },
  { code: "MSP", name: "Minneapolis, MN" },
];

// Get airport coordinates
export function getAirportCoordinates(code: string): { lat: number; lon: number } | null {
  return AIRPORT_COORDINATES[code] || null;
}

// Calculate distance between two coordinates in kilometers (Haversine formula)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Filter stations by proximity to an airport
export function filterStationsByAirport<T extends { lat?: number; lon?: number }>(
  stations: T[],
  airportCode: string | null,
  maxDistanceKm: number = 150 // Default: 150km radius
): T[] {
  if (!airportCode) return stations;

  const airportCoords = getAirportCoordinates(airportCode);
  if (!airportCoords) return stations;

  return stations.filter((station) => {
    if (station.lat === undefined || station.lon === undefined) return false;
    const distance = calculateDistance(
      airportCoords.lat,
      airportCoords.lon,
      station.lat,
      station.lon
    );
    return distance <= maxDistanceKm;
  });
}

// Filter stations by proximity to destination airport (alias for backward compatibility)
export function filterStationsByDestination<T extends { lat?: number; lon?: number }>(
  stations: T[],
  destinationCode: string | null,
  maxDistanceKm: number = 150
): T[] {
  return filterStationsByAirport(stations, destinationCode, maxDistanceKm);
}

// Filter stations near both origin and destination airports
export function filterStationsByOriginAndDestination<T extends { lat?: number; lon?: number }>(
  stations: T[],
  originCode: string | null,
  destinationCode: string | null,
  maxDistanceKm: number = 150
): T[] {
  if (!originCode && !destinationCode) return stations;
  
  // If only origin, filter by origin
  if (originCode && !destinationCode) {
    return filterStationsByAirport(stations, originCode, maxDistanceKm);
  }
  
  // If only destination, filter by destination
  if (!originCode && destinationCode) {
    return filterStationsByAirport(stations, destinationCode, maxDistanceKm);
  }
  
  // If both, get stations near origin OR destination
  const originCoords = getAirportCoordinates(originCode!);
  const destCoords = getAirportCoordinates(destinationCode!);
  
  if (!originCoords || !destCoords) return stations;
  
  return stations.filter((station) => {
    if (station.lat === undefined || station.lon === undefined) return false;
    
    const distToOrigin = calculateDistance(
      originCoords.lat,
      originCoords.lon,
      station.lat,
      station.lon
    );
    
    const distToDest = calculateDistance(
      destCoords.lat,
      destCoords.lon,
      station.lat,
      station.lon
    );
    
    // Include station if it's within range of either origin or destination
    return distToOrigin <= maxDistanceKm || distToDest <= maxDistanceKm;
  });
}

// Get season from date (for temperature adaptation)
export function getSeason(date: Date): "winter" | "spring" | "summer" | "fall" {
  const month = date.getMonth(); // 0-11
  if (month >= 2 && month <= 4) return "spring"; // Mar-May
  if (month >= 5 && month <= 7) return "summer"; // Jun-Aug
  if (month >= 8 && month <= 10) return "fall"; // Sep-Nov
  return "winter"; // Dec-Feb
}

// Get temperature range for season (in Celsius)
export function getSeasonalTempRange(season: "winter" | "spring" | "summer" | "fall"): {
  min: number;
  max: number;
} {
  switch (season) {
    case "winter":
      return { min: -20, max: 15 };
    case "spring":
      return { min: 5, max: 25 };
    case "summer":
      return { min: 15, max: 40 };
    case "fall":
      return { min: 0, max: 25 };
    default:
      return { min: -20, max: 40 };
  }
}

// Convert temperature to color (blue -> orange -> red)
export function temperatureToColor(
  temp: number,
  season: "winter" | "spring" | "summer" | "fall" = "summer"
): string {
  const range = getSeasonalTempRange(season);
  const { min, max } = range;
  
  // Clamp temperature to range
  const clampedTemp = Math.max(min, Math.min(max, temp));
  
  // Normalize to 0-1
  const normalized = (clampedTemp - min) / (max - min);
  
  // Blue (cold) -> Cyan -> Green -> Yellow -> Orange -> Red (hot)
  if (normalized < 0.2) {
    // Blue to Cyan (0-0.2)
    const t = normalized / 0.2;
    const r = Math.floor(0);
    const g = Math.floor(100 + t * 155);
    const b = Math.floor(200 + t * 55);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (normalized < 0.4) {
    // Cyan to Green (0.2-0.4)
    const t = (normalized - 0.2) / 0.2;
    const r = Math.floor(0);
    const g = Math.floor(255);
    const b = Math.floor(255 - t * 255);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (normalized < 0.6) {
    // Green to Yellow (0.4-0.6)
    const t = (normalized - 0.4) / 0.2;
    const r = Math.floor(0 + t * 255);
    const g = Math.floor(255);
    const b = Math.floor(0);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (normalized < 0.8) {
    // Yellow to Orange (0.6-0.8)
    const t = (normalized - 0.6) / 0.2;
    const r = Math.floor(255);
    const g = Math.floor(255 - t * 100);
    const b = Math.floor(0);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Orange to Red (0.8-1.0)
    const t = (normalized - 0.8) / 0.2;
    const r = Math.floor(255);
    const g = Math.floor(155 - t * 155);
    const b = Math.floor(0);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

