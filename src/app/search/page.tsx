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
import { getIATAFromStation, MAJOR_AIRPORTS, filterStationsByAirport, getClosestStationsToDestination, getDefaultHeatmapStations, getDefaultUSCenter, getAirportCoordinates, getSeason, temperatureToColor } from "@/lib/airports";
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

  // Handle station click
  const handleStationClick = useCallback(
    (station: Station) => {
      setSelectedStation(station);
      setShowDrawer(true);
    },
    []
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
        <div className="flex-1 relative">
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
        <div className="w-full md:w-96 lg:w-[500px] p-4 overflow-y-auto bg-gray-50">
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

