"use client";

import { useState, useCallback, useMemo, useEffect, Suspense } from "react";
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
import { getIATAFromStation, MAJOR_AIRPORTS, filterStationsByAirport, getClosestStationsToDestination, getDefaultHeatmapStations, getDefaultUSCenter, getAirportCoordinates, getSeason, temperatureToColor, calculateDistance } from "@/lib/airports";
import { composite } from "@/lib/scoring";
import type { FlightSearchResult } from "@/lib/flights/types";

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
  const [showDrawer, setShowDrawer] = useState(false);
  const [heatmapBatch, setHeatmapBatch] = useState(0); // Track which batch of cities to load (0, 1, or 2)

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
    
    // Reset other state
    setSelectedStation(null);
    setWeatherData([]);
    setDataQuality(100);
    setDestinations([]);
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

  // When destination changes to empty, reset destinations list and heatmap batch
  useEffect(() => {
    if (!filters.destination) {
      setDestinations([]);
      setSelectedStation(null);
      setShowDrawer(false);
      setHeatmapBatch(0); // Reset to initial batch
    }
  }, [filters.destination]);

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

  // Auto-fetch flights when destination is selected
  useEffect(() => {
    const fetchFlightsForDestination = async () => {
      // Only fetch if destination and origin are selected
      if (!filters.destination || !filters.origin || stations.length === 0) {
        return;
      }

      setIsLoadingFlight(true);
      setDestinations([]); // Clear previous results

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
        let stationId = "";
        let stationName = "";

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
          console.error(`Failed to fetch flights for ${airportCode}: ${flightRes.status}`);
          setIsLoadingFlight(false);
          return;
        }

        const flightResult: FlightSearchResult = await flightRes.json();
        const topFlights = flightResult.all.slice(0, 3); // Get top 3 flights only

        if (topFlights.length === 0) {
          console.log(`No flights found for ${airportCode}`);
          setIsLoadingFlight(false);
          return;
        }

        // Create rows for top 3 flights
        const allFlights: DestinationRow[] = topFlights.map((flight) => {
          const score = composite(
            avgTemp,
            flight.price,
            { min: filters.tempMin, max: filters.tempMax },
            filters.budget
          );

          return {
            destination: airport.name,
            airportCode,
            avgTemp,
            lowestPrice: flight.price,
            currency: flight.currency || "USD",
            score: score / 100, // Convert to 0-1 range for display
            stationId,
            stationName,
            flightUrl: flight.url,
          };
        });

        // Sort by score (descending)
        allFlights.sort((a, b) => b.score - a.score);
        
        // Update destinations with top 3 flights
        setDestinations(allFlights);
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
        // Fetch weather data for temperature calculation
        const weatherRes = await fetch(`/api/weather?station=${station.id}`);
        let avgTemp = 0;
        
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
          throw new Error("Failed to fetch flights");
        }

        const flightResult: FlightSearchResult = await flightRes.json();

        // Get top 3 flights (or all if less than 3)
        const topFlights = flightResult.all.slice(0, 3);

        if (topFlights.length === 0) {
          alert("No flights found for this destination");
          setIsLoadingFlight(false);
          return;
        }

        // Find airport name
        const airport = MAJOR_AIRPORTS.find((a) => a.code === airportCode);

        // Create rows for each top flight
        const newRows: DestinationRow[] = topFlights.map((flight, index) => {
          const score = composite(
            avgTemp,
            flight.price,
            { min: filters.tempMin, max: filters.tempMax },
            filters.budget
          );

          return {
            destination: airport?.name || airportCode,
            airportCode,
            avgTemp,
            lowestPrice: flight.price,
            currency: flight.currency || "USD",
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
        const score = composite(
          avgTemp,
          flightResult.cheapest?.price || Infinity,
          { min: filters.tempMin, max: filters.tempMax },
          filters.budget
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
          <div>
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
        <div className="flex-1 min-w-0 relative">
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

        {/* Table Section */}
        <div className="w-full md:w-[500px] lg:w-[650px] xl:w-[700px] p-4 overflow-y-auto bg-gray-50 flex-shrink-0">
          <h2 className="text-xl font-semibold mb-4">Destinations</h2>
          <DestinationsTable rows={destinations} onOpenFlights={handleOpenFlights} />
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

