"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Station } from "@/lib/windborne";
import { getSeason, temperatureToColor } from "@/lib/airports";

// Fix for default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface MapViewProps {
  stations: Station[];
  onStationClick: (station: Station) => void;
  selectedStation?: Station | null;
  destinationCenter?: { lat: number; lon: number } | null;
  outboundDate?: string;
}

interface StationWithTemp extends Station {
  avgTemp?: number;
  color?: string;
}

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function MapView({
  stations,
  onStationClick,
  selectedStation,
  destinationCenter,
  outboundDate,
}: MapViewProps) {
  const [stationsWithTemp, setStationsWithTemp] = useState<StationWithTemp[]>([]);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  
  // Get season from outbound date
  const season = useMemo(() => {
    if (outboundDate) {
      return getSeason(new Date(outboundDate));
    }
    return getSeason(new Date());
  }, [outboundDate]);

  // Initialize stations immediately with default color, then load weather data
  useEffect(() => {
    console.log(`MapView: Received ${stations.length} stations`);
    // First, show all stations with default color
    const initialStations = stations.map((station) => ({
      ...station,
      avgTemp: undefined,
      color: "#3388ff", // Default blue
    }));
    console.log(`MapView: Setting ${initialStations.length} stations with default color`);
    setStationsWithTemp(initialStations);

    // Then load weather data asynchronously (limit to 10 stations at a time to avoid rate limiting)
    if (stations.length > 0) {
      setIsLoadingWeather(true);
      const loadWeatherData = async () => {
        // Process stations in batches to avoid overwhelming the API
        const batchSize = 10;
        const batches = [];
        for (let i = 0; i < stations.length; i += batchSize) {
          batches.push(stations.slice(i, i + batchSize));
        }

        for (const batch of batches) {
          const stationsWithData = await Promise.all(
            batch.map(async (station) => {
              try {
                const res = await fetch(`/api/weather?station=${station.id}`);
                if (!res.ok) {
                  return { ...station, avgTemp: undefined, color: "#3388ff" };
                }

                const weatherData = await res.json();
                if (!Array.isArray(weatherData) || weatherData.length === 0) {
                  return { ...station, avgTemp: undefined, color: "#3388ff" };
                }

                // Calculate average temperature for last 7 days
                const now = Date.now();
                const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
                const recentData = weatherData.filter((d: any) => {
                  const timestamp = new Date(d.timestamp).getTime();
                  return timestamp >= sevenDaysAgo && timestamp <= now;
                });

                if (recentData.length === 0) {
                  return { ...station, avgTemp: undefined, color: "#3388ff" };
                }

                const avgTemp =
                  recentData.reduce((sum: number, d: any) => sum + Number(d.temperature), 0) /
                  recentData.length;

                const color = temperatureToColor(avgTemp, season);

                return { ...station, avgTemp, color };
              } catch (error) {
                console.error(`Error loading weather for station ${station.id}:`, error);
                return { ...station, avgTemp: undefined, color: "#3388ff" };
              }
            })
          );

          // Update stations incrementally
          setStationsWithTemp((prev) => {
            const updated = [...prev];
            stationsWithData.forEach((newStation) => {
              const index = updated.findIndex((s) => s.id === newStation.id);
              if (index !== -1) {
                updated[index] = newStation;
              }
            });
            return updated;
          });

          // Small delay between batches to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        setIsLoadingWeather(false);
      };

      loadWeatherData();
    } else {
      setIsLoadingWeather(false);
    }
  }, [stations, season]);
  // Default center (San Francisco)
  const defaultCenter: [number, number] = [37.7749, -122.4194];
  const defaultZoom = 3;

  // Use destination center if provided, otherwise calculate from stations
  const validStations = stationsWithTemp.filter(
    (s) => s.lat !== undefined && s.lon !== undefined
  );
  
  let center: [number, number];
  let zoom = defaultZoom;
  
  if (destinationCenter) {
    // Center on destination airport with closer zoom
    center = [destinationCenter.lat, destinationCenter.lon];
    zoom = 8; // Closer zoom for destination area
  } else if (validStations.length > 0) {
    // Calculate center from stations
    center = [
      validStations.reduce((sum, s) => sum + (s.lat || 0), 0) /
        validStations.length,
      validStations.reduce((sum, s) => sum + (s.lon || 0), 0) /
        validStations.length,
    ];
  } else {
    center = defaultCenter;
  }

  return (
    <div className="w-full h-full relative">
      {/* No stations message */}
      {stations.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90 z-[1000]">
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <p className="text-gray-600 mb-2">No stations found</p>
            <p className="text-sm text-gray-500">Please select an origin airport to see stations</p>
          </div>
        </div>
      )}
      
      {/* Loading indicator */}
      {isLoadingWeather && stationsWithTemp.length > 0 && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000] border border-gray-200">
          <p className="text-xs text-gray-600">
            Loading temperature data... ({stationsWithTemp.filter(s => s.avgTemp !== undefined).length}/{stationsWithTemp.length})
          </p>
        </div>
      )}
      
      {/* Heatmap Legend */}
      {stationsWithTemp.length > 0 && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000] border border-gray-200">
          <h4 className="text-sm font-semibold mb-2">Temperature Heatmap</h4>
          <div className="flex items-center space-x-2 mb-1">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#0066cc" }}></div>
            <span className="text-xs text-gray-600">Cold</span>
          </div>
          <div className="flex items-center space-x-2 mb-1">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#00ff00" }}></div>
            <span className="text-xs text-gray-600">Moderate</span>
          </div>
          <div className="flex items-center space-x-2 mb-1">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#ffaa00" }}></div>
            <span className="text-xs text-gray-600">Warm</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#ff0000" }}></div>
            <span className="text-xs text-gray-600">Hot</span>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500 capitalize">Season: {season}</p>
          </div>
        </div>
      )}
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {stationsWithTemp.length > 0 && (
          <>
            {stationsWithTemp.map((station) => {
              if (station.lat === undefined || station.lon === undefined) return null;
              
              const lat = station.lat;
              const lon = station.lon;
              
              // Create custom icon with color based on temperature
              const iconColor = station.color || "#3388ff"; // Default blue if no temp data
              const customIcon = L.divIcon({
                className: "custom-marker",
                html: `<div style="
                  background-color: ${iconColor};
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  border: 2px solid white;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                "></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              });

              return (
                <Marker
                  key={station.id}
                  position={[lat, lon]}
                  icon={customIcon}
                  eventHandlers={{
                    click: () => onStationClick(station),
                  }}
                >
                  <Popup>
                    <div className="p-2">
                      <h3 className="font-semibold">{station.name || station.id}</h3>
                      {station.avgTemp !== undefined ? (
                        <p className="text-sm">
                          Avg Temp: <span className="font-medium">{station.avgTemp.toFixed(1)}°C</span>
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">Loading temperature data...</p>
                      )}
                      <p className="text-sm text-gray-600">Click to view details</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </>
        )}
        {selectedStation &&
          selectedStation.lat !== undefined &&
          selectedStation.lon !== undefined && (
            <MapController center={[selectedStation.lat, selectedStation.lon]} />
          )}
      </MapContainer>
    </div>
  );
}

