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
  // US airports
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
  // Europe
  CDG: { lat: 49.0097, lon: 2.5479 }, // Paris Charles de Gaulle
  LHR: { lat: 51.4700, lon: -0.4543 }, // London Heathrow
  BER: { lat: 52.3667, lon: 13.5033 }, // Berlin Brandenburg
  MAD: { lat: 40.4839, lon: -3.5680 }, // Madrid Barajas
  FCO: { lat: 41.8045, lon: 12.2510 }, // Rome Fiumicino
  GVA: { lat: 46.2380, lon: 6.1090 }, // Geneva
  // Asia
  PEK: { lat: 40.0801, lon: 116.5845 }, // Beijing Capital
  PVG: { lat: 31.1443, lon: 121.8083 }, // Shanghai Pudong
  NRT: { lat: 35.7647, lon: 140.3863 }, // Tokyo Narita
  HND: { lat: 35.5494, lon: 139.7798 }, // Tokyo Haneda
  ICN: { lat: 37.4602, lon: 126.4407 }, // Seoul Incheon
  // Africa
  CMN: { lat: 33.3675, lon: -7.5899 }, // Casablanca
  CAI: { lat: 30.1126, lon: 31.3999 }, // Cairo
  JNB: { lat: -26.1392, lon: 28.2460 }, // Johannesburg
  NBO: { lat: -1.3192, lon: 36.9278 }, // Nairobi
  CPT: { lat: -33.9715, lon: 18.6021 }, // Cape Town
  ADD: { lat: 8.9779, lon: 38.7993 }, // Addis Ababa
  LAD: { lat: -8.8584, lon: 13.2312 }, // Luanda
  DAR: { lat: -6.8710, lon: 39.2026 }, // Dar es Salaam
  TUN: { lat: 36.8510, lon: 10.2272 }, // Tunis
  ALG: { lat: 36.6910, lon: 3.2154 }, // Algiers
  LAG: { lat: 6.5244, lon: 3.3792 }, // Lagos
  ACC: { lat: 5.6037, lon: -0.1870 }, // Accra
  KRT: { lat: 15.5895, lon: 32.5532 }, // Khartoum
  KGL: { lat: -1.9686, lon: 30.1394 }, // Kigali
  ABJ: { lat: 5.2614, lon: -4.0257 }, // Abidjan
  // Additional Europe
  AMS: { lat: 52.3105, lon: 4.7683 }, // Amsterdam
  FRA: { lat: 50.0379, lon: 8.5622 }, // Frankfurt
  BCN: { lat: 41.2971, lon: 2.0785 }, // Barcelona
  VIE: { lat: 48.1103, lon: 16.5697 }, // Vienna
  ZUR: { lat: 47.4647, lon: 8.5492 }, // Zurich
  CPH: { lat: 55.6180, lon: 12.6500 }, // Copenhagen
  OSL: { lat: 60.1939, lon: 11.1004 }, // Oslo
  STO: { lat: 59.6519, lon: 17.9186 }, // Stockholm (Arlanda)
  ATH: { lat: 37.9364, lon: 23.9445 }, // Athens
  // Additional Asia
  HKG: { lat: 22.3080, lon: 113.9185 }, // Hong Kong
  SIN: { lat: 1.3644, lon: 103.9915 }, // Singapore
  BKK: { lat: 13.6811, lon: 100.7473 }, // Bangkok
  DXB: { lat: 25.2532, lon: 55.3657 }, // Dubai
  DEL: { lat: 28.5562, lon: 77.1000 }, // Delhi
  BOM: { lat: 19.0896, lon: 72.8656 }, // Mumbai
  SYD: { lat: -33.9399, lon: 151.1753 }, // Sydney
  MEL: { lat: -37.6690, lon: 144.8410 }, // Melbourne
  KUL: { lat: 2.7456, lon: 101.7099 }, // Kuala Lumpur
  TPE: { lat: 25.0797, lon: 121.2342 }, // Taipei
};

// List of major airports organized by continent
export const AIRPORTS_BY_CONTINENT = {
  US: [
    { code: "SFO", name: "San Francisco, CA" },
    { code: "LAX", name: "Los Angeles, CA" },
    { code: "SEA", name: "Seattle, WA" },
    { code: "JFK", name: "New York, NY (JFK)" },
    { code: "BOS", name: "Boston, MA" },
    { code: "MIA", name: "Miami, FL" },
    { code: "ATL", name: "Atlanta, GA" },
    { code: "ORD", name: "Chicago, IL" },
    { code: "DFW", name: "Dallas, TX" },
    { code: "DEN", name: "Denver, CO" },
    { code: "IAH", name: "Houston, TX" },
    { code: "MSP", name: "Minneapolis, MN" },
    { code: "LGA", name: "New York, NY (LGA)" },
    { code: "PDX", name: "Portland, OR" },
    { code: "SAN", name: "San Diego, CA" },
  ],
  Europe: [
    { code: "CDG", name: "Paris, France" },
    { code: "LHR", name: "London, UK" },
    { code: "BER", name: "Berlin, Germany" },
    { code: "MAD", name: "Madrid, Spain" },
    { code: "FCO", name: "Rome, Italy" },
    { code: "GVA", name: "Geneva, Switzerland" },
    { code: "AMS", name: "Amsterdam, Netherlands" },
    { code: "FRA", name: "Frankfurt, Germany" },
    { code: "BCN", name: "Barcelona, Spain" },
    { code: "VIE", name: "Vienna, Austria" },
    { code: "ZUR", name: "Zurich, Switzerland" },
    { code: "CPH", name: "Copenhagen, Denmark" },
    { code: "OSL", name: "Oslo, Norway" },
    { code: "STO", name: "Stockholm, Sweden" },
    { code: "ATH", name: "Athens, Greece" },
  ],
  Asia: [
    { code: "PEK", name: "Beijing, China" },
    { code: "PVG", name: "Shanghai, China" },
    { code: "NRT", name: "Tokyo, Japan (Narita)" },
    { code: "HND", name: "Tokyo, Japan (Haneda)" },
    { code: "ICN", name: "Seoul, South Korea" },
    { code: "HKG", name: "Hong Kong" },
    { code: "SIN", name: "Singapore" },
    { code: "BKK", name: "Bangkok, Thailand" },
    { code: "DXB", name: "Dubai, UAE" },
    { code: "DEL", name: "Delhi, India" },
    { code: "BOM", name: "Mumbai, India" },
    { code: "SYD", name: "Sydney, Australia" },
    { code: "MEL", name: "Melbourne, Australia" },
    { code: "KUL", name: "Kuala Lumpur, Malaysia" },
    { code: "TPE", name: "Taipei, Taiwan" },
  ],
  Africa: [
    { code: "CMN", name: "Casablanca, Morocco" },
    { code: "CAI", name: "Cairo, Egypt" },
    { code: "JNB", name: "Johannesburg, South Africa" },
    { code: "NBO", name: "Nairobi, Kenya" },
    { code: "CPT", name: "Cape Town, South Africa" },
    { code: "ADD", name: "Addis Ababa, Ethiopia" },
    { code: "LAD", name: "Luanda, Angola" },
    { code: "DAR", name: "Dar es Salaam, Tanzania" },
    { code: "TUN", name: "Tunis, Tunisia" },
    { code: "ALG", name: "Algiers, Algeria" },
    { code: "LAG", name: "Lagos, Nigeria" },
    { code: "ACC", name: "Accra, Ghana" },
    { code: "KRT", name: "Khartoum, Sudan" },
    { code: "KGL", name: "Kigali, Rwanda" },
    { code: "ABJ", name: "Abidjan, Ivory Coast" },
  ],
};

// Flattened list for dropdown (all airports)
export const MAJOR_AIRPORTS = [
  ...AIRPORTS_BY_CONTINENT.US,
  ...AIRPORTS_BY_CONTINENT.Europe,
  ...AIRPORTS_BY_CONTINENT.Asia,
  ...AIRPORTS_BY_CONTINENT.Africa,
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

// Get stations sorted by distance to destination, limited to N closest
export function getClosestStationsToDestination<T extends { lat?: number; lon?: number }>(
  stations: T[],
  destinationCode: string | null,
  maxDistanceKm: number = 150,
  limit: number = 5
): T[] {
  if (!destinationCode) return [];
  
  const destCoords = getAirportCoordinates(destinationCode);
  if (!destCoords) return [];
  
  // Filter stations within range and calculate distances
  const stationsWithDistance = stations
    .filter((station) => {
      if (station.lat === undefined || station.lon === undefined) return false;
      const distance = calculateDistance(
        destCoords.lat,
        destCoords.lon,
        station.lat,
        station.lon
      );
      return distance <= maxDistanceKm;
    })
    .map((station) => {
      const distance = calculateDistance(
        destCoords.lat,
        destCoords.lon,
        station.lat!,
        station.lon!
      );
      return { station, distance };
    })
    .sort((a, b) => a.distance - b.distance) // Sort by distance (closest first)
    .slice(0, limit) // Take only the N closest
    .map((item) => item.station); // Extract stations
  
  return stationsWithDistance;
}

// Get default heatmap stations with progressive loading (5 per continent initially, max 15 per continent)
export function getDefaultHeatmapStations<T extends { id?: string; lat?: number; lon?: number }>(
  allStations: T[],
  limitPerAirport: number = 1,
  batchNumber: number = 0 // 0 = initial (5 per continent), 1 = second batch (5 more), 2 = third batch (5 more)
): T[] {
  const defaultStations: T[] = [];
  const addedStationIds = new Set<string>();
  const CITIES_PER_BATCH = 5;
  const MAX_CITIES_PER_CONTINENT = 15;

  // Get airports for this batch 
  // batch 0: first 5 cities (0-5)
  // batch 1: first 10 cities (0-10) 
  // batch 2: first 15 cities (0-15)
  const getAirportsForBatch = (continent: keyof typeof AIRPORTS_BY_CONTINENT) => {
    const totalCities = Math.min((batchNumber + 1) * CITIES_PER_BATCH, MAX_CITIES_PER_CONTINENT);
    return AIRPORTS_BY_CONTINENT[continent].slice(0, totalCities);
  };

  // Process each continent
  const continents: (keyof typeof AIRPORTS_BY_CONTINENT)[] = ['US', 'Europe', 'Asia', 'Africa'];
  
  for (const continent of continents) {
    const airportsForBatch = getAirportsForBatch(continent);
    
    for (const airport of airportsForBatch) {
      // Find the closest station to the current major airport
      const closest = getClosestStationsToDestination(
        allStations,
        airport.code,
        150, // Max distance in km
        limitPerAirport
      );

      // Add unique stations from the 'closest' list to the defaultStations array
      for (const station of closest) {
        // Use id if available, otherwise use lat/lon as unique identifier
        const stationId = station.id || `${station.lat}-${station.lon}`;
        if (stationId && !addedStationIds.has(stationId)) {
          defaultStations.push(station);
          addedStationIds.add(stationId);
        }
      }
    }
  }
  
  return defaultStations;
}

// Get default center for world view (centered to show US, Europe, Asia, Africa)
export function getDefaultUSCenter(): { lat: number; lon: number } {
  // Center point between US and Europe/Asia for better global view
  return { lat: 40.0, lon: 20.0 }; // Adjusted to show global coverage
}

// Convert temperature to color (discrete ranges)
export function temperatureToColor(temp: number): string {
  if (temp < 10) {
    return "#007bff"; // Blue for Cold (< 10°C)
  } else if (temp >= 10 && temp < 20) {
    return "#ffc107"; // Yellow for Moderate (10-20°C)
  } else if (temp >= 20 && temp < 30) {
    return "#fd7e14"; // Orange for Warm (20-30°C)
  } else {
    // temp >= 30
    return "#dc3545"; // Red for Hot (>= 30°C)
  }
}

