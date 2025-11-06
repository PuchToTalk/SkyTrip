"use client";

import { useState, useCallback, useMemo, useEffect, useRef, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import MapView from "@/components/MapView";
import FiltersBar, { type FilterState } from "@/components/FiltersBar";
import DestinationsTable, {
  type DestinationRow,
} from "@/components/DestinationsTable";
import StationDrawer from "@/components/StationDrawer";
import type { Station, WX } from "@/lib/windborne";
import { getIATAFromStation, MAJOR_AIRPORTS, filterStationsByAirport, getClosestStationsToDestination, getDefaultHeatmapStations, getDefaultUSCenter, getAirportCoordinates, getSeason, temperatureToColor, calculateDistance, AIRPORTS_BY_CONTINENT } from "@/lib/airports";
import { composite } from "@/lib/scoring";
import type { FlightSearchResult } from "@/lib/flights/types";
import type { TemperatureByTimeOfDay } from "@/components/DestinationsTable";

// Dynamically import MapView to avoid SSR issues with Leaflet
const DynamicMapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
});

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Initialize filters from URL params or defaults
  const getDefaultFilters = (): FilterState => {
    const defaultOutbound = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    
    return {
      origin: searchParams.get("origin") || "",
      destination: searchParams.get("destination") || "",
      outboundDate: searchParams.get("outbound_date") || defaultOutbound,
      returnDate: searchParams.get("return_date") || undefined,
      budget: parseFloat(searchParams.get("budget") || "1000"),
      tempMin: parseFloat(searchParams.get("temp_min") || "15"),
      tempMax: parseFloat(searchParams.get("temp_max") || "30"),
      type: (searchParams.get("type") as "one-way" | "round-trip") || "one-way",
      nonStopOnly: searchParams.get("non_stop") === "true",
    };
  };

  const [filters, setFilters] = useState<FilterState>(getDefaultFilters);

  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [weatherData, setWeatherData] = useState<WX[]>([]);
  const [dataQuality, setDataQuality] = useState<number>(100);
  const [destinations, setDestinations] = useState<DestinationRow[]>([]);
  const [isLoadingFlight, setIsLoadingFlight] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [heatmapBatch, setHeatmapBatch] = useState(0); // Track which batch of cities to load (0, 1, or 2)
  
  // Table width state for resizing
  const [tableWidth, setTableWidth] = useState<number>(850); // Default width in pixels
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(850);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = tableWidth;
  }, [tableWidth]);

  // Handle resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = resizeStartX.current - e.clientX; // Negative when dragging left (table expands)
      const newWidth = Math.max(400, Math.min(1200, resizeStartWidth.current + deltaX));
      setTableWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);
  
  // Background-loaded stations (loaded while destination filter is active, displayed when inactive)
  const [backgroundStations, setBackgroundStations] = useState<Station[]>([]);
  const [backgroundBatch, setBackgroundBatch] = useState(0); // Track background loading batch (0, 1, 2 = 3, 6, 9 per continent)
  
  // Track how many cities have been loaded per continent
  const [loadedCitiesCount, setLoadedCitiesCount] = useState<Record<string, number>>({
    US: 0,
    Europe: 0,
    Asia: 0,
    Africa: 0,
  });

  // Reset filters function
  const resetFilters = () => {
    const defaultOutbound = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    
    setFilters({
      origin: "",
      destination: "", // Reset to empty to show default heatmap
      outboundDate: defaultOutbound,
      returnDate: undefined,
      budget: 1000,
      tempMin: 15,
      tempMax: 30,
      type: "one-way",
      nonStopOnly: false,
    });
    
    // Reset other state (but keep destinations - user can clear manually)
    setSelectedStation(null);
    setWeatherData([]);
    setDataQuality(100);
    // Don't clear destinations - let user clear manually with Clear button
    setShowDrawer(false);
  };

  // Fetch stations (must be declared before useEffect that uses it)
  const { data: stations = [], isLoading: loadingStations } = useQuery({
    queryKey: ["stations"],
    queryFn: async () => {
      const res = await fetch("/api/stations");
      if (!res.ok) throw new Error("Failed to fetch stations");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // When destination changes to empty, reset heatmap batch (but keep destinations list)
  useEffect(() => {
    if (!filters.destination) {
      // Don't clear destinations - let user clear manually with Clear button
      setSelectedStation(null);
      setShowDrawer(false);
      setHeatmapBatch(0); // Reset to initial batch
      // Reset loaded cities count
      setLoadedCitiesCount({
        US: 0,
        Europe: 0,
        Asia: 0,
        Africa: 0,
      });
    } else {
      // When destination is set, reset background batch to start loading from beginning
      setBackgroundBatch(0);
      setBackgroundStations([]);
      // Reset loaded cities count when destination changes
      setLoadedCitiesCount({
        US: 0,
        Europe: 0,
        Asia: 0,
        Africa: 0,
      });
    }
  }, [filters.destination]);

  // Clear destinations function
  const handleClearDestinations = useCallback(() => {
    setDestinations([]);
    setLoadedCitiesCount({
      US: 0,
      Europe: 0,
      Asia: 0,
      Africa: 0,
    });
  }, []);

  // Background loading: start loading stations when destination is set
  useEffect(() => {
    if (filters.destination && stations.length > 0 && backgroundBatch < 3) {
      // Load stations in background (3 per continent per batch, max 9 per continent = 3 batches)
      const loadBackgroundStations = async () => {
        const STATIONS_PER_BATCH = 3; // 3 stations per continent per batch
        const MAX_STATIONS_PER_CONTINENT = 9; // Max 9 stations per continent (3 batches)
        
        // Calculate how many cities per continent for this batch
        const citiesPerContinent = Math.min((backgroundBatch + 1) * STATIONS_PER_BATCH, MAX_STATIONS_PER_CONTINENT);
        
        // Determine which continent the destination belongs to (prioritize it)
        let destinationContinent: keyof typeof AIRPORTS_BY_CONTINENT | null = null;
        const continents: (keyof typeof AIRPORTS_BY_CONTINENT)[] = ['US', 'Europe', 'Asia', 'Africa'];
        
        for (const continent of continents) {
          if (AIRPORTS_BY_CONTINENT[continent].some(a => a.code === filters.destination)) {
            destinationContinent = continent;
            break;
          }
        }
        
        // Reorder continents to start with destination's continent
        const orderedContinents = destinationContinent 
          ? [destinationContinent, ...continents.filter(c => c !== destinationContinent)]
          : continents;
        
        const loadedStations: Station[] = [];
        const addedStationIds = new Set<string>();
        
        // Load stations for each continent
        for (const continent of orderedContinents) {
          const airportsForBatch = AIRPORTS_BY_CONTINENT[continent].slice(0, citiesPerContinent);
          
          for (const airport of airportsForBatch) {
            const closest = getClosestStationsToDestination(
              stations,
              airport.code,
              150, // Max distance in km
              1 // 1 station per airport
            );
            
            for (const station of closest) {
              const stationId = station.id || `${station.lat}-${station.lon}`;
              if (stationId && !addedStationIds.has(stationId)) {
                loadedStations.push(station);
                addedStationIds.add(stationId);
              }
            }
          }
        }
        
        // Update background stations (merge with existing)
        setBackgroundStations((prev) => {
          const existingIds = new Set(prev.map(s => s.id || `${s.lat}-${s.lon}`));
          const newStations = loadedStations.filter(s => {
            const id = s.id || `${s.lat}-${s.lon}`;
            return !existingIds.has(id);
          });
          return [...prev, ...newStations];
        });
        
        // Load next batch after a delay (respecting API rate limit)
        if (backgroundBatch < 2) {
          setTimeout(() => {
            setBackgroundBatch((prev) => prev + 1);
          }, 60 * 1000); // 1 minute delay between batches
        }
      };
      
      loadBackgroundStations();
    }
  }, [filters.destination, stations, backgroundBatch]);

  // Progressive loading for default heatmap: load more cities every minute
  useEffect(() => {
    if (!filters.destination && stations.length > 0 && heatmapBatch < 2) {
      // Load next batch after 1 minute (60 seconds)
      const timer = setTimeout(() => {
        setHeatmapBatch((prev) => {
          const nextBatch = prev + 1;
          console.log(`Loading heatmap batch ${nextBatch} (5 more cities per continent)`);
          return nextBatch;
        });
      }, 60 * 1000); // 1 minute delay

      return () => clearTimeout(timer);
    }
  }, [filters.destination, stations.length, heatmapBatch]);
  
  // Reset background loading when destination is cleared
  useEffect(() => {
    if (!filters.destination) {
      // Keep background stations but reset batch counter
      setBackgroundBatch(0);
    }
  }, [filters.destination]);

  // Auto-fetch flights when destination is selected
  useEffect(() => {
    const fetchFlightsForDestination = async () => {
      // Only fetch if destination and origin are selected
      if (!filters.destination || !filters.origin || stations.length === 0) {
        return;
      }

      setIsLoadingFlight(true);
      // Don't clear previous results - add to existing list

      try {
        const airportCode = filters.destination; // Use destination directly as airport code
        const airport = MAJOR_AIRPORTS.find((a) => a.code === airportCode);
        
        if (!airport) {
          console.warn(`Airport ${airportCode} not found in major airports list`);
          setIsLoadingFlight(false);
          return;
        }

        console.log(`Fetching top 3 flights for ${airportCode} (${airport.name})`);

        // Get closest station to this airport for temperature data
        const closestStations = getClosestStationsToDestination(
          stations,
          airportCode,
          150, // 150km radius
          1 // Just need 1 closest station for temperature
        );

        let avgTemp = 0;
        let tempByTimeOfDay: TemperatureByTimeOfDay | undefined;
        let stationId = "";
        let stationName = "";

        // Helper function to calculate temperature by time of day
        const calculateTempByTimeOfDay = (weatherData: any[], fallbackAvg: number): TemperatureByTimeOfDay | undefined => {
          if (!weatherData || weatherData.length === 0) return undefined;

          const tempsByPeriod = {
            morning: [] as number[], // 6h-12h
            midday: [] as number[], // 12h-15h
            afternoon: [] as number[], // 15h-18h
            evening: [] as number[], // 18h-21h
            night: [] as number[], // 21h-6h
          };

          weatherData.forEach((d: any) => {
            const date = new Date(d.timestamp);
            const hour = date.getUTCHours(); // Use UTC hours
            const temp = Number(d.temperature);
            
            if (!Number.isFinite(temp)) return;

            if (hour >= 6 && hour < 12) {
              tempsByPeriod.morning.push(temp);
            } else if (hour >= 12 && hour < 15) {
              tempsByPeriod.midday.push(temp);
            } else if (hour >= 15 && hour < 18) {
              tempsByPeriod.afternoon.push(temp);
            } else if (hour >= 18 && hour < 21) {
              tempsByPeriod.evening.push(temp);
            } else {
              // Night: 21h-6h
              tempsByPeriod.night.push(temp);
            }
          });

          // Calculate averages for each period
          const calculateAvg = (arr: number[]) => {
            if (arr.length === 0) return fallbackAvg; // Fallback to overall average
            return arr.reduce((sum, t) => sum + t, 0) / arr.length;
          };

          return {
            morning: calculateAvg(tempsByPeriod.morning),
            midday: calculateAvg(tempsByPeriod.midday),
            afternoon: calculateAvg(tempsByPeriod.afternoon),
            evening: calculateAvg(tempsByPeriod.evening),
            night: calculateAvg(tempsByPeriod.night),
          };
        };

        if (closestStations.length > 0) {
          const closestStation = closestStations[0];
          stationId = closestStation.id;
          stationName = closestStation.name || "";

          // Fetch weather data for temperature
          try {
            const weatherRes = await fetch(`/api/weather?station=${stationId}`);
            if (weatherRes.ok) {
              const weatherDataArray = await weatherRes.json();
              if (Array.isArray(weatherDataArray) && weatherDataArray.length > 0) {
                const now = Date.now();
                const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
                const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
                
                let dataToUse = weatherDataArray.filter((d: any) => {
                  const timestamp = new Date(d.timestamp).getTime();
                  return timestamp >= sevenDaysAgo && timestamp <= now;
                });
                
                if (dataToUse.length === 0) {
                  dataToUse = weatherDataArray.filter((d: any) => {
                    const timestamp = new Date(d.timestamp).getTime();
                    return timestamp >= thirtyDaysAgo && timestamp <= now;
                  });
                }
                
                if (dataToUse.length === 0 && weatherDataArray.length > 0) {
                  dataToUse = weatherDataArray;
                }
                
                if (dataToUse.length > 0) {
                  avgTemp = dataToUse.reduce((sum: number, d: any) => sum + Number(d.temperature), 0) / dataToUse.length;
                  // Calculate temperature by time of day
                  tempByTimeOfDay = calculateTempByTimeOfDay(dataToUse, avgTemp);
                }
              }
            }
          } catch (error) {
            console.warn(`Failed to fetch weather for station ${stationId}:`, error);
          }
        }

        // Fetch flight prices - get top 3 flights for this airport
        const flightParams = new URLSearchParams({
          from: filters.origin,
          to: airportCode,
          outbound_date: filters.outboundDate,
          type: filters.type,
          sort_by: "2", // Sort by price
        });

        if (filters.returnDate && filters.type === "round-trip") {
          flightParams.set("return_date", filters.returnDate);
        }

        if (filters.nonStopOnly) {
          flightParams.set("stops", "0"); // 0 stops = non-stop
        }

        const flightRes = await fetch(`/api/flights?${flightParams.toString()}`);
        if (!flightRes.ok) {
          let errorMessage = `Failed to fetch flights (${flightRes.status})`;
          try {
            const errorData = await flightRes.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
          console.error(`Flight API error for ${airportCode}: ${errorMessage}`);
          setIsLoadingFlight(false);
          return;
        }

        const flightResult: FlightSearchResult = await flightRes.json();
        
        // Check if the result contains an error
        if (flightResult.cheapest === null && flightResult.all.length === 0) {
          console.log(`No flights found for ${airportCode}`);
          setIsLoadingFlight(false);
          return;
        }
        
        const topFlights = flightResult.all.slice(0, 3); // Get top 3 flights only

        if (topFlights.length === 0) {
          console.log(`No flights found for ${airportCode}`);
          setIsLoadingFlight(false);
          return;
        }

        // Find shortest duration for comparison
        const shortestDuration = Math.min(
          ...topFlights.map(f => f.durationMinutes || Infinity).filter(d => d !== Infinity)
        );
        const shortestDurationMinutes = shortestDuration !== Infinity ? shortestDuration : 0;

        // Create rows for top 3 flights
        const allFlights: DestinationRow[] = topFlights.map((flight) => {
          const dur = flight.durationMinutes || Infinity;
          const durationMinutes = dur !== Infinity ? dur : 0;
          
          const score = composite(
            avgTemp,
            flight.price,
            { min: filters.tempMin, max: filters.tempMax },
            filters.budget,
            durationMinutes,
            shortestDurationMinutes || durationMinutes // Fallback to current duration if no shortest
          );

          return {
            destination: airport.name,
            airportCode,
            avgTemp,
            tempByTimeOfDay,
            lowestPrice: flight.price,
            currency: flight.currency || "USD",
            flightDuration: flight.duration || undefined,
            departureTime: flight.departureTime || undefined,
            arrivalTime: flight.arrivalTime || undefined,
            airline: flight.airline || undefined,
            score: score / 100, // Convert to 0-1 range for display
            stationId,
            stationName,
            flightUrl: flight.url,
          };
        });

        // Sort by score (descending)
        allFlights.sort((a, b) => b.score - a.score);
        
        // Add to existing destinations (avoid duplicates)
        setDestinations((prev) => {
          const existingKeys = new Set(prev.map(d => `${d.airportCode}-${d.departureTime}-${d.airline}`));
          const uniqueNew = allFlights.filter(d => 
            !existingKeys.has(`${d.airportCode}-${d.departureTime}-${d.airline}`)
          );
          return [...prev, ...uniqueNew].sort((a, b) => b.score - a.score);
        });
        
        // Update loaded cities count for the destination's continent
        const destContinent = Object.keys(AIRPORTS_BY_CONTINENT).find(continent =>
          AIRPORTS_BY_CONTINENT[continent as keyof typeof AIRPORTS_BY_CONTINENT].some(a => a.code === airportCode)
        );
        if (destContinent) {
          setLoadedCitiesCount(prev => ({
            ...prev,
            [destContinent]: (prev[destContinent as keyof typeof AIRPORTS_BY_CONTINENT] || 0) + 1,
          }));
        }
        
        console.log(`✅ Loaded ${allFlights.length} flights for ${airportCode} (${airport.name})`);
      } catch (error) {
        console.error("Error fetching flights for destination:", error);
      } finally {
        setIsLoadingFlight(false);
      }
    };

    // Debounce: wait 500ms after destination changes before fetching
    const timer = setTimeout(() => {
      fetchFlightsForDestination();
    }, 500);

    return () => clearTimeout(timer);
  }, [filters.destination, filters.origin, filters.outboundDate, filters.returnDate, filters.type, filters.tempMin, filters.tempMax, filters.budget, filters.nonStopOnly, stations]);

  // Load more destinations (15 cities total, works even without destination)
  const handleLoadMoreDestinations = useCallback(async () => {
    // Require at least stations to be loaded
    if (stations.length === 0) {
      console.warn("Stations not loaded yet");
      return;
    }

    // Use default origin if not provided
    const originAirport = filters.origin || "SFO"; // Default to San Francisco

    setIsLoadingMore(true);

    try {
      // Get already loaded airport codes
      const loadedAirportCodes = new Set(destinations.map(d => d.airportCode));
      
      // Helper function to fetch flights for an airport
      const fetchFlightsForAirport = async (airportCode: string, airportName: string) => {
        // Get closest station for temperature
        const closestStations = getClosestStationsToDestination(
          stations,
          airportCode,
          150,
          1
        );

        let avgTemp = 0;
        let tempByTimeOfDay: TemperatureByTimeOfDay | undefined;
        let stationId = "";
        let stationName = "";

        // Helper function to calculate temperature by time of day
        const calculateTempByTimeOfDay = (weatherData: any[], fallbackAvg: number): TemperatureByTimeOfDay | undefined => {
          if (!weatherData || weatherData.length === 0) return undefined;

          const tempsByPeriod = {
            morning: [] as number[],
            midday: [] as number[],
            afternoon: [] as number[],
            evening: [] as number[],
            night: [] as number[],
          };

          weatherData.forEach((d: any) => {
            const date = new Date(d.timestamp);
            const hour = date.getUTCHours();
            const temp = Number(d.temperature);
            
            if (!Number.isFinite(temp)) return;

            if (hour >= 6 && hour < 12) {
              tempsByPeriod.morning.push(temp);
            } else if (hour >= 12 && hour < 15) {
              tempsByPeriod.midday.push(temp);
            } else if (hour >= 15 && hour < 18) {
              tempsByPeriod.afternoon.push(temp);
            } else if (hour >= 18 && hour < 21) {
              tempsByPeriod.evening.push(temp);
            } else {
              tempsByPeriod.night.push(temp);
            }
          });

          const calculateAvg = (arr: number[]) => {
            if (arr.length === 0) return fallbackAvg;
            return arr.reduce((sum, t) => sum + t, 0) / arr.length;
          };

          return {
            morning: calculateAvg(tempsByPeriod.morning),
            midday: calculateAvg(tempsByPeriod.midday),
            afternoon: calculateAvg(tempsByPeriod.afternoon),
            evening: calculateAvg(tempsByPeriod.evening),
            night: calculateAvg(tempsByPeriod.night),
          };
        };

        if (closestStations.length > 0) {
          const closestStation = closestStations[0];
          stationId = closestStation.id;
          stationName = closestStation.name || "";

          try {
            const weatherRes = await fetch(`/api/weather?station=${stationId}`);
            if (weatherRes.ok) {
              const weatherDataArray = await weatherRes.json();
              if (Array.isArray(weatherDataArray) && weatherDataArray.length > 0) {
                const now = Date.now();
                const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
                const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
                
                let dataToUse = weatherDataArray.filter((d: any) => {
                  const timestamp = new Date(d.timestamp).getTime();
                  return timestamp >= sevenDaysAgo && timestamp <= now;
                });
                
                if (dataToUse.length === 0) {
                  dataToUse = weatherDataArray.filter((d: any) => {
                    const timestamp = new Date(d.timestamp).getTime();
                    return timestamp >= thirtyDaysAgo && timestamp <= now;
                  });
                }
                
                if (dataToUse.length === 0 && weatherDataArray.length > 0) {
                  dataToUse = weatherDataArray;
                }
                
                if (dataToUse.length > 0) {
                  avgTemp = dataToUse.reduce((sum: number, d: any) => sum + Number(d.temperature), 0) / dataToUse.length;
                  tempByTimeOfDay = calculateTempByTimeOfDay(dataToUse, avgTemp);
                }
              }
            }
          } catch (error) {
            console.warn(`Failed to fetch weather for station ${stationId}:`, error);
          }
        }

        // Fetch flights
        const flightParams = new URLSearchParams({
          from: originAirport,
          to: airportCode,
          outbound_date: filters.outboundDate,
          type: filters.type,
          sort_by: "2",
        });

        if (filters.returnDate && filters.type === "round-trip") {
          flightParams.set("return_date", filters.returnDate);
        }

        if (filters.nonStopOnly) {
          flightParams.set("stops", "0");
        }

        const flightRes = await fetch(`/api/flights?${flightParams.toString()}`);
        if (!flightRes.ok) {
          return null;
        }

        const flightResult: FlightSearchResult = await flightRes.json();
        const topFlights = flightResult.all.slice(0, 3);

        if (topFlights.length === 0) {
          return null;
        }

        // Find shortest duration for comparison
        const shortestDuration = Math.min(
          ...topFlights.map(f => f.durationMinutes || Infinity).filter(d => d !== Infinity)
        );
        const shortestDurationMinutes = shortestDuration !== Infinity ? shortestDuration : 0;

        // Create rows for top 3 flights
        return topFlights.map((flight) => {
          const dur = flight.durationMinutes || Infinity;
          const durationMinutes = dur !== Infinity ? dur : 0;
          
          const score = composite(
            avgTemp,
            flight.price,
            { min: filters.tempMin, max: filters.tempMax },
            filters.budget,
            durationMinutes,
            shortestDurationMinutes || durationMinutes // Fallback to current duration if no shortest
          );

          return {
            destination: airportName,
            airportCode,
            avgTemp,
            tempByTimeOfDay,
            lowestPrice: flight.price,
            currency: flight.currency || "USD",
            flightDuration: flight.duration || undefined,
            departureTime: flight.departureTime || undefined,
            arrivalTime: flight.arrivalTime || undefined,
            airline: flight.airline || undefined,
            score: score / 100,
            stationId,
            stationName,
            flightUrl: flight.url,
          };
        });
      };

      // Get 15 new cities total (distributed across continents, excluding already loaded ones)
      const newDestinations: DestinationRow[] = [];
      const continents: (keyof typeof AIRPORTS_BY_CONTINENT)[] = ['US', 'Europe', 'Asia', 'Africa'];
      
      // Calculate how many cities per continent (15 total = ~4 per continent, round up)
      const citiesPerContinent = Math.ceil(15 / continents.length);
      let totalLoaded = 0;
      const maxCities = 15;

      for (const continent of continents) {
        if (totalLoaded >= maxCities) break;
        
        const airports = AIRPORTS_BY_CONTINENT[continent];
        const currentCount = loadedCitiesCount[continent] || 0;
        
        // Get airports that haven't been loaded yet
        const remainingSlots = maxCities - totalLoaded;
        const slotsForThisContinent = Math.min(citiesPerContinent, remainingSlots);
        
        const airportsToLoad = airports
          .slice(currentCount) // Start from current count
          .filter(airport => !loadedAirportCodes.has(airport.code))
          .slice(0, slotsForThisContinent);

        if (airportsToLoad.length === 0) continue;

        // Fetch flights for each airport (limit to prevent too many API calls)
        for (const airport of airportsToLoad) {
          if (totalLoaded >= maxCities) break;
          
          const rows = await fetchFlightsForAirport(airport.code, airport.name);
          if (rows && rows.length > 0) {
            newDestinations.push(...rows);
            totalLoaded++;
            // Add delay to respect API rate limit (20 req/min = 3 seconds between requests)
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds between requests
          }
        }

        // Update count for this continent
        setLoadedCitiesCount(prev => ({
          ...prev,
          [continent]: (prev[continent] || 0) + airportsToLoad.length,
        }));
      }

      // Add new destinations to existing list
      if (newDestinations.length > 0) {
        setDestinations(prev => {
          const existingCodes = new Set(prev.map(d => `${d.airportCode}-${d.departureTime}`));
          const uniqueNew = newDestinations.filter(d => 
            !existingCodes.has(`${d.airportCode}-${d.departureTime}`)
          );
          return [...prev, ...uniqueNew].sort((a, b) => b.score - a.score);
        });
      }
    } catch (error) {
      console.error("Error loading more destinations:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [filters, destinations, stations, loadedCitiesCount]);

  // Fetch weather when station is selected
  const { data: weather, isLoading: loadingWeather } = useQuery({
    queryKey: ["weather", selectedStation?.id],
    queryFn: async () => {
      if (!selectedStation) return null;
      const res = await fetch(`/api/weather?station=${selectedStation.id}`);
      if (!res.ok) throw new Error("Failed to fetch weather");
      return res.json();
    },
    enabled: !!selectedStation,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Update weather data and quality when query completes
  useMemo(() => {
    if (weather) {
      // Check if weather is an error response
      if (weather.error) {
        console.warn(`Weather API error for station ${selectedStation?.id}:`, weather.error);
        setWeatherData([]);
        setDataQuality(0);
      } else if (Array.isArray(weather)) {
        console.log(`Weather data loaded for station ${selectedStation?.id}: ${weather.length} records`);
        setWeatherData(weather);
        setDataQuality(weather.length > 0 ? 100 : 0);
      } else {
        console.warn(`Unexpected weather data format for station ${selectedStation?.id}`);
        setWeatherData([]);
        setDataQuality(0);
      }
    } else if (selectedStation && !loadingWeather) {
      setWeatherData([]);
      setDataQuality(0);
    }
  }, [weather, selectedStation, loadingWeather]);

  // Handle station click - automatically fetch flights for top 3 options
  const handleStationClick = useCallback(
    async (station: Station) => {
      setSelectedStation(station);
      setShowDrawer(true);

      // Find the closest airport to this station
      if (!station.lat || !station.lon) {
        console.warn("Station missing coordinates, cannot find airport");
        return;
      }

      // Try to get IATA from station ID/name first
      let airportCode = getIATAFromStation(station);
      
      // If not found, find the closest airport by coordinates
      if (!airportCode) {
        let minDistance = Infinity;
        let closestAirport: { code: string; name: string } | null = null;
        
        for (const airport of MAJOR_AIRPORTS) {
          const coords = getAirportCoordinates(airport.code);
          if (coords) {
            const distance = calculateDistance(
              station.lat!,
              station.lon!,
              coords.lat,
              coords.lon
            );
            if (distance < minDistance && distance <= 150) { // Within 150km
              minDistance = distance;
              closestAirport = airport;
            }
          }
        }
        
        if (closestAirport) {
          airportCode = closestAirport.code;
          console.log(`Found closest airport ${airportCode} (${closestAirport.name}) at ${minDistance.toFixed(1)}km from station ${station.id}`);
        } else {
          console.warn(`No airport found within 150km of station ${station.id}`);
          return;
        }
      }

      // Check if origin is selected
      if (!filters.origin) {
        alert("Please select an origin airport first");
        return;
      }

      setIsLoadingFlight(true);
      try {
        // Helper function to calculate temperature by time of day
        const calculateTempByTimeOfDay = (weatherData: any[], avgTemp: number): TemperatureByTimeOfDay | undefined => {
          if (!weatherData || weatherData.length === 0) return undefined;

          const tempsByPeriod = {
            morning: [] as number[], // 6h-12h
            midday: [] as number[], // 12h-15h
            afternoon: [] as number[], // 15h-18h
            evening: [] as number[], // 18h-21h
            night: [] as number[], // 21h-6h
          };

          weatherData.forEach((d: any) => {
            const date = new Date(d.timestamp);
            const hour = date.getUTCHours();
            const temp = Number(d.temperature);
            
            if (!Number.isFinite(temp)) return;

            if (hour >= 6 && hour < 12) {
              tempsByPeriod.morning.push(temp);
            } else if (hour >= 12 && hour < 15) {
              tempsByPeriod.midday.push(temp);
            } else if (hour >= 15 && hour < 18) {
              tempsByPeriod.afternoon.push(temp);
            } else if (hour >= 18 && hour < 21) {
              tempsByPeriod.evening.push(temp);
            } else {
              tempsByPeriod.night.push(temp);
            }
          });

          const calculateAvg = (arr: number[]) => {
            if (arr.length === 0) return avgTemp;
            return arr.reduce((sum, t) => sum + t, 0) / arr.length;
          };

          return {
            morning: calculateAvg(tempsByPeriod.morning),
            midday: calculateAvg(tempsByPeriod.midday),
            afternoon: calculateAvg(tempsByPeriod.afternoon),
            evening: calculateAvg(tempsByPeriod.evening),
            night: calculateAvg(tempsByPeriod.night),
          };
        };

        // Fetch weather data for temperature calculation
        const weatherRes = await fetch(`/api/weather?station=${station.id}`);
        let avgTemp = 0;
        let tempByTimeOfDay: TemperatureByTimeOfDay | undefined;
        
        if (weatherRes.ok) {
          const weatherDataArray = await weatherRes.json();
          if (Array.isArray(weatherDataArray) && weatherDataArray.length > 0) {
            // Calculate average temperature (last 7 days, or last 30, or all)
            const now = Date.now();
            const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
            const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
            
            let dataToUse = weatherDataArray.filter((d: any) => {
              const timestamp = new Date(d.timestamp).getTime();
              return timestamp >= sevenDaysAgo && timestamp <= now;
            });
            
            if (dataToUse.length === 0) {
              dataToUse = weatherDataArray.filter((d: any) => {
                const timestamp = new Date(d.timestamp).getTime();
                return timestamp >= thirtyDaysAgo && timestamp <= now;
              });
            }
            
            if (dataToUse.length === 0 && weatherDataArray.length > 0) {
              dataToUse = weatherDataArray;
            }
            
            if (dataToUse.length > 0) {
              avgTemp = dataToUse.reduce((sum: number, d: any) => sum + Number(d.temperature), 0) / dataToUse.length;
              tempByTimeOfDay = calculateTempByTimeOfDay(dataToUse, avgTemp);
            }
          }
        }

        // Fetch flight prices - get top flights
        const flightParams = new URLSearchParams({
          from: filters.origin,
          to: airportCode,
          outbound_date: filters.outboundDate,
          type: filters.type,
          sort_by: "2", // Sort by price
        });

        if (filters.returnDate && filters.type === "round-trip") {
          flightParams.set("return_date", filters.returnDate);
        }

        if (filters.nonStopOnly) {
          flightParams.set("stops", "0"); // 0 stops = non-stop
        }

        const flightRes = await fetch(`/api/flights?${flightParams.toString()}`);
        if (!flightRes.ok) {
          let errorMessage = `Failed to fetch flights (${flightRes.status})`;
          try {
            const errorData = await flightRes.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch (e) {
            // Ignore JSON parse errors, use default message
          }
          console.error(`Flight API error: ${errorMessage}`);
          alert(`Unable to fetch flights: ${errorMessage}`);
          setIsLoadingFlight(false);
          return;
        }

        const flightResult: FlightSearchResult = await flightRes.json();
        
        // Check if the result contains an error
        if (flightResult.cheapest === null && flightResult.all.length === 0) {
          console.warn("No flights found in API response");
          alert("No flights found for this destination");
          setIsLoadingFlight(false);
          return;
        }

        // Get top 3 flights (or all if less than 3)
        const topFlights = flightResult.all.slice(0, 3);

        if (topFlights.length === 0) {
          alert("No flights found for this destination");
          setIsLoadingFlight(false);
          return;
        }

        // Find shortest duration for comparison
        const shortestDuration = Math.min(
          ...topFlights.map(f => f.durationMinutes || Infinity).filter(d => d !== Infinity)
        );
        const shortestDurationMinutes = shortestDuration !== Infinity ? shortestDuration : 0;

        // Find airport name
        const airport = MAJOR_AIRPORTS.find((a) => a.code === airportCode);

        // Create rows for each top flight
        const newRows: DestinationRow[] = topFlights.map((flight, index) => {
          const dur = flight.durationMinutes || Infinity;
          const durationMinutes = dur !== Infinity ? dur : 0;
          
          const score = composite(
            avgTemp,
            flight.price,
            { min: filters.tempMin, max: filters.tempMax },
            filters.budget,
            durationMinutes,
            shortestDurationMinutes || durationMinutes // Fallback to current duration if no shortest
          );

          return {
            destination: airport?.name || airportCode,
            airportCode,
            avgTemp,
            tempByTimeOfDay,
            lowestPrice: flight.price,
            currency: flight.currency || "USD",
            flightDuration: flight.duration || undefined,
            departureTime: flight.departureTime || undefined,
            arrivalTime: flight.arrivalTime || undefined,
            airline: flight.airline || undefined,
            score: score / 100, // Convert to 0-1 range for display (DestinationsTable multiplies by 100)
            stationId: station.id,
            stationName: station.name,
            flightUrl: flight.url,
          };
        });

        // Update destinations table (replace existing entries for this station or add new ones)
        setDestinations((prev) => {
          // Remove old entries for this station
          const filtered = prev.filter((r) => r.stationId !== station.id);
          // Add new rows
          return [...filtered, ...newRows];
        });

        console.log(`Added ${newRows.length} flights for station ${station.id} (${airportCode})`);
      } catch (error: any) {
        console.error("Error fetching flights:", error);
        alert(`Failed to fetch flight prices: ${error.message || "Please try again."}`);
      } finally {
        setIsLoadingFlight(false);
      }
    },
    [filters]
  );

  // Handle airport selection from drawer
  const handleSelectAirport = useCallback(
    async (airportCode: string) => {
      if (!selectedStation) return;

      setIsLoadingFlight(true);
      try {
        // Calculate average temperature (last 7 days)
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        const recentData = weatherData.filter((d) => {
          const timestamp = new Date(d.timestamp).getTime();
          return timestamp >= sevenDaysAgo && timestamp <= now;
        });

        const avgTemp =
          recentData.length > 0
            ? recentData.reduce((sum, d) => sum + Number(d.temperature), 0) /
              recentData.length
            : 0;

        // Fetch flight prices
        const flightParams = new URLSearchParams({
          from: filters.origin,
          to: airportCode,
          outbound_date: filters.outboundDate,
          sort_by: "2", // price
        });

        if (filters.returnDate && filters.type === "round-trip") {
          flightParams.set("return_date", filters.returnDate);
        }

        if (filters.nonStopOnly) {
          flightParams.set("stops", "1");
        }

        const flightRes = await fetch(`/api/flights?${flightParams.toString()}`);
        if (!flightRes.ok) throw new Error("Failed to fetch flights");

        const flightResult: FlightSearchResult = await flightRes.json();

        // Calculate score
        // For single flight selection, rank is 1 (no comparison needed)
        // For single flight, use its duration as both current and shortest
        const singleFlightDuration = flightResult.cheapest?.durationMinutes || 0;
        const score = composite(
          avgTemp,
          flightResult.cheapest?.price || Infinity,
          { min: filters.tempMin, max: filters.tempMax },
          filters.budget,
          singleFlightDuration,
          singleFlightDuration // Same duration for comparison (single flight = perfect score)
        );

        // Find airport name
        const airport = MAJOR_AIRPORTS.find((a) => a.code === airportCode);

        // Add to destinations table
        const newRow: DestinationRow = {
          destination: airport?.name || airportCode,
          airportCode,
          avgTemp,
          lowestPrice: flightResult.cheapest?.price || null,
          currency: flightResult.cheapest?.currency || "USD",
          score,
          stationId: selectedStation.id,
          stationName: selectedStation.name,
          flightUrl: flightResult.cheapest?.url,
        };

        setDestinations((prev) => {
          // Avoid duplicates
          const existing = prev.find(
            (r) => r.stationId === selectedStation.id && r.airportCode === airportCode
          );
          if (existing) return prev;
          return [...prev, newRow];
        });

        setShowDrawer(false);
      } catch (error) {
        console.error("Error fetching flights:", error);
        alert("Failed to fetch flight prices. Please try again.");
      } finally {
        setIsLoadingFlight(false);
      }
    },
    [selectedStation, weatherData, filters]
  );

  // Handle open flights
  const handleOpenFlights = useCallback((row: DestinationRow) => {
    if (row.flightUrl) {
      window.open(row.flightUrl, "_blank");
    } else {
      // Fallback: construct Google Flights URL
      const params = new URLSearchParams({
        from: filters.origin,
        to: row.airportCode,
        outbound_date: filters.outboundDate,
      });
      if (filters.returnDate && filters.type === "round-trip") {
        params.set("return_date", filters.returnDate);
      }
      window.open(
        `https://www.google.com/travel/flights?${params.toString()}`,
        "_blank"
      );
    }
  }, [filters]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div 
            onClick={() => router.push('/')}
            className="cursor-pointer hover:opacity-90 transition-opacity"
          >
            <h1 className="text-2xl font-bold">SkyTrip</h1>
            <p className="text-sm text-blue-100">
              Weather & Flight Planning with WindBorne Data
            </p>
          </div>
          <button
            onClick={resetFilters}
            className="px-4 py-2 bg-white text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
          >
            New Search
          </button>
        </div>
      </header>

      {/* Filters */}
      <FiltersBar filters={filters} onChange={setFilters} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map Section */}
        <div className="flex-1 min-w-[300px] relative" style={{ minWidth: '300px' }}>
          {loadingStations ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-gray-600">Loading stations...</div>
            </div>
          ) : (
            <DynamicMapView
              stations={
                filters.destination
                  ? (() => {
                      // Only filter by destination, get 5 closest stations
                      const closest = getClosestStationsToDestination(
                        stations,
                        filters.destination,
                        150, // 150km radius
                        5 // Limit to 5 closest stations
                      );
                      console.log(`Filtered stations: ${closest.length} (destination: ${filters.destination})`);
                      return closest;
                    })()
                  : (() => {
                      // If background stations are loaded, use them; otherwise use default heatmap
                      if (backgroundStations.length > 0) {
                        console.log(`Using background-loaded stations: ${backgroundStations.length} stations`);
                        return backgroundStations;
                      }
                      
                      // Default heatmap: Load cities progressively based on batch number
                      // Batch 0: 5 cities per continent (20 total)
                      // Batch 1: 10 cities per continent (40 total) - loaded after 1 minute
                      // Batch 2: 15 cities per continent (60 total) - loaded after 2 minutes
                      const defaultStations = getDefaultHeatmapStations(stations, 1, heatmapBatch);
                      console.log(`Default heatmap stations (batch ${heatmapBatch}): ${defaultStations.length} stations`);
                      return defaultStations;
                    })()
              }
              onStationClick={handleStationClick}
              selectedStation={selectedStation}
              destinationCenter={
                filters.destination
                  ? getAirportCoordinates(filters.destination)
                  : getDefaultUSCenter() // Center on US when no destination selected
              }
              outboundDate={filters.outboundDate}
            />
          )}
        </div>

        {/* Resizer */}
        <div
          onMouseDown={handleResizeStart}
          className={`hidden md:flex w-2 bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-all relative items-center justify-center ${
            isResizing ? 'bg-blue-500' : ''
          }`}
          style={{ userSelect: 'none' }}
          title="Drag to resize table"
        >
          <div className="w-0.5 h-12 bg-gray-400 rounded-full hover:bg-blue-500 transition-colors" />
        </div>

        {/* Table Section */}
        <div 
          className="w-full p-4 overflow-y-auto bg-gray-50 flex-shrink-0"
          style={{ width: `${tableWidth}px`, minWidth: '400px', maxWidth: '1200px' } as React.CSSProperties}
        >
          <h2 className="text-xl font-semibold mb-4">Destinations</h2>
          <DestinationsTable 
            rows={destinations} 
            onOpenFlights={handleOpenFlights}
            onLoadMore={handleLoadMoreDestinations}
            isLoadingMore={isLoadingMore}
            onClear={handleClearDestinations}
          />
        </div>
      </div>

      {/* Station Drawer */}
      {showDrawer && selectedStation && (
        <StationDrawer
          station={selectedStation}
          weatherData={weatherData}
          dataQuality={dataQuality}
          onClose={() => setShowDrawer(false)}
          isLoading={loadingWeather}
        />
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}

