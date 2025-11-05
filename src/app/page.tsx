"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import MapView from "@/components/MapView";
import FiltersBar, { type FilterState } from "@/components/FiltersBar";
import DestinationsTable, {
  type DestinationRow,
} from "@/components/DestinationsTable";
import StationDrawer from "@/components/StationDrawer";
import type { Station, WX } from "@/lib/windborne";
import { getIATAFromStation, MAJOR_AIRPORTS, filterStationsByAirport, filterStationsByOriginAndDestination, getAirportCoordinates, getSeason, temperatureToColor } from "@/lib/airports";
import { composite } from "@/lib/scoring";
import type { FlightSearchResult } from "@/lib/flights/types";

// Dynamically import MapView to avoid SSR issues with Leaflet
const DynamicMapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
});

export default function Home() {
  const [filters, setFilters] = useState<FilterState>({
    origin: "", // Empty by default - no stations shown until origin is selected
    destination: "", // No destination by default - show all stations near origin
    outboundDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    returnDate: undefined,
    budget: 1000,
    tempMin: 15,
    tempMax: 30,
    type: "one-way",
    nonStopOnly: false,
  });

  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [weatherData, setWeatherData] = useState<WX[]>([]);
  const [dataQuality, setDataQuality] = useState<number>(100);
  const [destinations, setDestinations] = useState<DestinationRow[]>([]);
  const [isLoadingFlight, setIsLoadingFlight] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  // Fetch stations
  const { data: stations = [], isLoading: loadingStations } = useQuery({
    queryKey: ["stations"],
    queryFn: async () => {
      const res = await fetch("/api/stations");
      if (!res.ok) throw new Error("Failed to fetch stations");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

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
        // Calculate data quality (simplified - assume all returned data is valid after cleaning)
        // In a real scenario, you'd compare original vs cleaned
        setDataQuality(weather.length > 0 ? 100 : 0);
      } else {
        // Unexpected format
        console.warn(`Unexpected weather data format for station ${selectedStation?.id}`);
        setWeatherData([]);
        setDataQuality(0);
      }
    } else if (selectedStation && !loadingWeather) {
      // No data available
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
        <h1 className="text-2xl font-bold">SkyTrip</h1>
        <p className="text-sm text-blue-100">
          Weather & Flight Planning with WindBorne Data
        </p>
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
                filters.origin
                  ? (() => {
                      const filtered = filterStationsByOriginAndDestination(
                        stations,
                        filters.origin,
                        filters.destination || null,
                        150 // 150km radius
                      );
                      console.log(`Filtered stations: ${filtered.length} (origin: ${filters.origin}, dest: ${filters.destination || "none"})`);
                      return filtered;
                    })()
                  : [] // No stations if no origin selected
              }
              onStationClick={handleStationClick}
              selectedStation={selectedStation}
              destinationCenter={
                filters.destination
                  ? getAirportCoordinates(filters.destination)
                  : filters.origin
                  ? getAirportCoordinates(filters.origin)
                  : null
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

