"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Circle, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Station } from "@/lib/windborne";
import { getSeason, temperatureToColor, getDefaultHeatmapStations } from "@/lib/airports";

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

// Component to render circle zone with dynamic radius based on zoom
function ZoneCircle({
  station,
  zoneColor,
  onStationClick,
}: {
  station: StationWithTemp;
  zoneColor: string;
  onStationClick: (station: Station) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  // Listen to zoom changes
  useEffect(() => {
    const updateZoom = () => {
      setZoom(map.getZoom());
    };
    
    map.on("zoom", updateZoom);
    map.on("zoomend", updateZoom);
    
    return () => {
      map.off("zoom", updateZoom);
      map.off("zoomend", updateZoom);
    };
  }, [map]);

  // Calculate radius based on zoom level
  // Lower zoom = wider view = larger circles
  // Higher zoom = closer view = smaller circles
  const calculateRadius = (currentZoom: number): number => {
    // Base radius at zoom level 4 (wide view): ~200km (much larger for better coverage)
    // At zoom level 8 (city view): ~50km
    // At zoom level 12 (street view): ~12km
    const baseRadius = 200000; // 200km at zoom 4 (even larger)
    const baseZoom = 4;
    
    // Scale factor: each zoom level doubles/halves the scale
    // So radius should be divided by 2^(zoom - baseZoom)
    const zoomDiff = currentZoom - baseZoom;
    const scaleFactor = Math.pow(2, zoomDiff);
    
    return baseRadius / scaleFactor;
  };

  const radius = calculateRadius(zoom);

  if (station.lat === undefined || station.lon === undefined) return null;

  return (
    <>
      {/* Large heatmap circle zone covering the city area */}
      <Circle
        center={[station.lat, station.lon]}
        radius={radius}
        pathOptions={{
          fillColor: zoneColor,
          fillOpacity: zoneColor === "#808080" ? 0.25 : 0.15, // More visible for grey (no data) stations
          color: zoneColor === "#808080" ? "#666666" : zoneColor, // Darker border for grey stations
          weight: zoneColor === "#808080" ? 2 : 0.5, // Thicker border for grey stations to make them active
          opacity: zoneColor === "#808080" ? 0.7 : 0.3, // More visible border for grey stations
        }}
        eventHandlers={{
          click: () => onStationClick(station),
          mouseover: (e) => {
            // Add hover effect for better interactivity
            const layer = e.target;
            layer.setStyle({
              weight: zoneColor === "#808080" ? 3 : 1,
              opacity: zoneColor === "#808080" ? 0.9 : 0.5,
            });
          },
          mouseout: (e) => {
            // Restore original style
            const layer = e.target;
            layer.setStyle({
              weight: zoneColor === "#808080" ? 2 : 0.5,
              opacity: zoneColor === "#808080" ? 0.7 : 0.3,
            });
          },
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
      </Circle>
      
      {/* Small center marker for precise location - larger for grey stations */}
      <CircleMarker
        center={[station.lat, station.lon]}
        radius={zoneColor === "#808080" ? 12 : 8} // Larger for grey (no data) stations
        pathOptions={{
          fillColor: zoneColor,
          fillOpacity: 1,
          color: zoneColor === "#808080" ? "#666666" : "#ffffff", // Darker border for grey
          weight: zoneColor === "#808080" ? 3 : 2, // Thicker border for grey
          opacity: 1,
        }}
        eventHandlers={{
          click: () => onStationClick(station),
        }}
      />
    </>
  );
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
  const [dataLoaded, setDataLoaded] = useState(false); // Track if data has been loaded (static after first load)
  
  // Get season from outbound date
  const season = useMemo(() => {
    if (outboundDate) {
      return getSeason(new Date(outboundDate));
    }
    return getSeason(new Date());
  }, [outboundDate]);

  // Initialize stations immediately with default color, then load weather data
  // Reload when stations change (e.g., when destination filter changes)
  useEffect(() => {
    console.log(`MapView: Received ${stations.length} stations`);
    
    // Create a unique key from station IDs to detect changes
    const stationsKey = stations.map(s => s.id).sort().join(',');
    
    // Check which stations already have data loaded (never reload those)
    // This must be defined at the top level of useEffect so it's accessible everywhere
    const existingStationsData = new Map(stationsWithTemp.map(s => [s.id, s]));
    const stationsWithData = Array.from(existingStationsData.values()).filter(s => s.avgTemp !== undefined);
    const stationsWithDataIds = new Set(stationsWithData.map(s => s.id));
    
    // Separate stations into: existing with data, existing without data, and new
    const newStations = stations.filter(s => !existingStationsData.has(s.id));
    
    // Merge: keep existing stations with their data, preserve stations without data, add new ones in grey
    const mergedStations = stations.map((station) => {
      const existing = existingStationsData.get(station.id);
      if (existing) {
        // Always keep existing station data (even if avgTemp is undefined, keep it as is)
        return existing;
      } else {
        // Completely new station - show as loading
        return {
          ...station,
          avgTemp: undefined,
          color: "#808080", // Grey for loading/no data
        };
      }
    });
    
    setStationsWithTemp(mergedStations);
    
    // Only load data for stations that don't have data yet (new stations only)
    const stationsToLoad = newStations.filter(s => !stationsWithDataIds.has(s.id));
    
    if (stationsToLoad.length > 0) {
      console.log(`MapView: Loading data for ${stationsToLoad.length} new stations (${stationsWithData.length} stations already have data and will be kept)`);
      setIsLoadingWeather(true);
        
      // Load weather data for new stations only (never reload existing data)
      const loadWeatherDataForNewStations = async () => {
        // Process stations in batches to respect API rate limit (20 req/min)
        const batchSize = 20;
        const batches = [];
        for (let i = 0; i < stationsToLoad.length; i += batchSize) {
          batches.push(stationsToLoad.slice(i, i + batchSize));
        }

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          
          // Wait 60 seconds between batches (except for first batch)
          if (batchIndex > 0) {
            console.log(`Waiting 60 seconds before loading next batch (${batchIndex + 1}/${batches.length})...`);
            await new Promise((resolve) => setTimeout(resolve, 60 * 1000));
          }
          
          console.log(`Loading weather data for new stations batch ${batchIndex + 1}/${batches.length} (${batch.length} stations)`);
          
          const newStationsWithData = await Promise.all(
              batch.map(async (station) => {
                try {
                  const res = await fetch(`/api/weather?station=${station.id}`);
                  if (!res.ok) {
                    return { ...station, avgTemp: undefined, color: "#808080" };
                  }

                  const weatherData = await res.json();
                  if (!Array.isArray(weatherData) || weatherData.length === 0) {
                    return { ...station, avgTemp: undefined, color: "#808080" };
                  }

                  // Calculate average temperature
                  const now = Date.now();
                  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
                  const recentData = weatherData.filter((d: any) => {
                    const timestamp = new Date(d.timestamp).getTime();
                    return timestamp >= sevenDaysAgo && timestamp <= now;
                  });

                  let dataToUse = recentData;
                  if (recentData.length === 0) {
                    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
                    dataToUse = weatherData.filter((d: any) => {
                      const timestamp = new Date(d.timestamp).getTime();
                      return timestamp >= thirtyDaysAgo && timestamp <= now;
                    });
                  }

                  if (dataToUse.length === 0 && weatherData.length > 0) {
                    dataToUse = weatherData;
                  }

                  if (dataToUse.length === 0) {
                    return { ...station, avgTemp: undefined, color: "#808080" };
                  }

                  const avgTemp =
                    dataToUse.reduce((sum: number, d: any) => sum + Number(d.temperature), 0) /
                    dataToUse.length;

                  const color = temperatureToColor(avgTemp);

                  return { ...station, avgTemp, color };
                } catch (error) {
                  console.error(`Error loading weather for station ${station.id}:`, error);
                  return { ...station, avgTemp: undefined, color: "#808080" };
                }
              })
            );

          // Update only the new stations (never overwrite existing data)
          setStationsWithTemp((prev) => {
            const updated = [...prev];
            newStationsWithData.forEach((newStation) => {
                const index = updated.findIndex((s) => s.id === newStation.id);
                if (index !== -1) {
                  // Only update if station doesn't already have data
                  if (updated[index].avgTemp === undefined) {
                    updated[index] = newStation;
                    console.log(`MapView: Updated station ${newStation.id} with temperature data (${newStation.avgTemp?.toFixed(1)}°C)`);
                  } else {
                    console.log(`MapView: Skipping update for station ${newStation.id} - already has data`);
                  }
                } else {
                  // If not found, add it (shouldn't happen but safety check)
                  updated.push(newStation);
                }
            });
            return updated;
          });
        }
        
        setIsLoadingWeather(false);
      };
      
      loadWeatherDataForNewStations();
      return; // Don't reload existing stations - we've handled new stations above
    }
    
    // Check if all stations already have data (no loading needed)
    // existingStationsData is already defined above
    if (stations.length > 0) {
      const allStationsHaveData = stations.every(s => {
        const existing = existingStationsData.get(s.id);
        return existing && existing.avgTemp !== undefined;
      });
      
      if (allStationsHaveData) {
        console.log('MapView: All stations already have data, no loading needed');
        setIsLoadingWeather(false);
        return;
      }
      
      // Check if this is a completely new set of stations (none match existing)
      const hasAnyMatching = stations.some(s => existingStationsData.has(s.id));
      if (!hasAnyMatching) {
        // Completely new set - initialize all stations in grey
        console.log('MapView: Completely new set of stations, initializing');
        const initialStations = stations.map((station) => ({
          ...station,
          avgTemp: undefined,
          color: "#808080", // Grey for loading/no data
        }));
        setStationsWithTemp(initialStations);
        setDataLoaded(false);
        
        // Load weather data for all new stations
        setIsLoadingWeather(true);
        const loadWeatherData = async () => {
          // Process stations in batches to respect API rate limit (20 req/min)
          const batchSize = 20;
          const batches = [];
          for (let i = 0; i < stations.length; i += batchSize) {
            batches.push(stations.slice(i, i + batchSize));
          }

          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            
            // Wait 60 seconds between batches (except for first batch)
            if (batchIndex > 0) {
              console.log(`Waiting 60 seconds before loading next batch (${batchIndex + 1}/${batches.length})...`);
              await new Promise((resolve) => setTimeout(resolve, 60 * 1000));
            }
            
            console.log(`Loading weather data for batch ${batchIndex + 1}/${batches.length} (${batch.length} stations)`);
            
            const stationsWithData = await Promise.all(
              batch.map(async (station) => {
                try {
                  const res = await fetch(`/api/weather?station=${station.id}`);
                  if (!res.ok) {
                    return { ...station, avgTemp: undefined, color: "#808080" }; // Grey on API error
                  }

                  const weatherData = await res.json();
                  if (!Array.isArray(weatherData) || weatherData.length === 0) {
                    return { ...station, avgTemp: undefined, color: "#808080" }; // Grey if no data
                  }

                  // Calculate average temperature for last 7 days
                  const now = Date.now();
                  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
                  const recentData = weatherData.filter((d: any) => {
                    const timestamp = new Date(d.timestamp).getTime();
                    return timestamp >= sevenDaysAgo && timestamp <= now;
                  });

                  // If no data in last 7 days, try last 30 days
                  let dataToUse = recentData;
                  if (recentData.length === 0) {
                    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
                    dataToUse = weatherData.filter((d: any) => {
                      const timestamp = new Date(d.timestamp).getTime();
                      return timestamp >= thirtyDaysAgo && timestamp <= now;
                    });
                  }

                  // If still no data, use all available data
                  if (dataToUse.length === 0 && weatherData.length > 0) {
                    dataToUse = weatherData;
                  }

                  if (dataToUse.length === 0) {
                    console.log(`Station ${station.id}: No data available`);
                    return { ...station, avgTemp: undefined, color: "#808080" }; // Grey if no data at all
                  }

                  const avgTemp =
                    dataToUse.reduce((sum: number, d: any) => sum + Number(d.temperature), 0) /
                    dataToUse.length;

                  console.log(`Station ${station.id}: Calculated avg temp ${avgTemp.toFixed(1)}°C from ${dataToUse.length} data points`);

                  const color = temperatureToColor(avgTemp); // No season parameter needed

                  return { ...station, avgTemp, color };
                } catch (error) {
                  console.error(`Error loading weather for station ${station.id}:`, error);
                  return { ...station, avgTemp: undefined, color: "#808080" }; // Grey on fetch error
                }
              })
            );

            // Update stations incrementally (only if they don't already have data)
            setStationsWithTemp((prev) => {
              const updated = [...prev];
              stationsWithData.forEach((newStation) => {
                // Try multiple matching strategies in case ID doesn't match exactly
                let index = updated.findIndex((s) => s.id === newStation.id);
                
                // If no match by ID, try by name
                if (index === -1 && newStation.name) {
                  index = updated.findIndex((s) => s.name === newStation.name);
                }
                
                // If still no match, try by coordinates (within 0.01 degrees)
                if (index === -1 && newStation.lat !== undefined && newStation.lon !== undefined) {
                  index = updated.findIndex((s) => {
                    if (s.lat === undefined || s.lon === undefined) return false;
                    return Math.abs(s.lat - newStation.lat!) < 0.01 && 
                           Math.abs(s.lon - newStation.lon!) < 0.01;
                  });
                }
                
                if (index !== -1) {
                  // Only update if station doesn't already have data
                  if (updated[index].avgTemp === undefined) {
                    console.log(`Updating station ${newStation.id || newStation.name}: ${newStation.avgTemp !== undefined ? `temp=${newStation.avgTemp.toFixed(1)}°C, color=${newStation.color}` : 'no data'}`);
                    updated[index] = newStation;
                  } else {
                    console.log(`Skipping update for station ${newStation.id || newStation.name} - already has data (${updated[index].avgTemp?.toFixed(1)}°C)`);
                  }
                } else {
                  console.warn(`Could not find station to update: ${newStation.id || newStation.name}`);
                }
              });
              return updated;
            });

            // No delay needed here - we wait 60 seconds before next batch
          }
          setIsLoadingWeather(false);
          setDataLoaded(true); // Mark data as loaded - no more updates
        };

        loadWeatherData();
        return;
      }
    }
    
    // If we reach here, some stations have data and some don't
    // This case should be handled by the newStations block above
    setIsLoadingWeather(false);
  }, [stations, season]);
  // Default center (San Francisco)
  const defaultCenter: [number, number] = [37.7749, -122.4194];
  const defaultZoom = 3;
  
  // US center coordinates (for default heatmap view)
  const usCenter: [number, number] = [39.8283, -98.5795];

  // Use destination center if provided, otherwise calculate from stations
  const validStations = stationsWithTemp.filter(
    (s) => s.lat !== undefined && s.lon !== undefined
  );
  
  let center: [number, number];
  let zoom = defaultZoom;
  
  if (destinationCenter) {
    // Center on destination airport
    center = [destinationCenter.lat, destinationCenter.lon];
    
    // Check if this is the default US center (default heatmap view)
    const isDefaultUSView = 
      Math.abs(destinationCenter.lat - usCenter[0]) < 0.1 &&
      Math.abs(destinationCenter.lon - usCenter[1]) < 0.1;
    
    if (isDefaultUSView && validStations.length > 10) {
      // Wide view for default heatmap covering all US stations
      zoom = 4;
    } else {
      // Closer zoom for specific destination area
      zoom = 8;
    }
  } else if (validStations.length > 0) {
    // Calculate center from stations
    center = [
      validStations.reduce((sum, s) => sum + (s.lat || 0), 0) /
        validStations.length,
      validStations.reduce((sum, s) => sum + (s.lon || 0), 0) /
        validStations.length,
    ];
    // Adjust zoom based on number of stations (more stations = wider view)
    if (validStations.length > 20) {
      zoom = 4;
    } else if (validStations.length > 10) {
      zoom = 5;
    } else {
      zoom = 6;
    }
  } else {
    center = defaultCenter;
  }

  return (
    <div className="w-full h-full relative">
      {/* No stations message - only show if truly no stations available */}
      {stations.length === 0 && stationsWithTemp.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90 z-[1000]">
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <p className="text-gray-600 mb-2">No stations found</p>
            <p className="text-sm text-gray-500">Please select a destination airport to see specific stations</p>
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
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#007bff" }}></div>
            <span className="text-xs text-gray-600">Cold (&lt; 10°C)</span>
          </div>
          <div className="flex items-center space-x-2 mb-1">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#ffc107" }}></div>
            <span className="text-xs text-gray-600">Moderate (10-20°C)</span>
          </div>
          <div className="flex items-center space-x-2 mb-1">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#fd7e14" }}></div>
            <span className="text-xs text-gray-600">Warm (20-30°C)</span>
          </div>
          <div className="flex items-center space-x-2 mb-1">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#dc3545" }}></div>
            <span className="text-xs text-gray-600">Hot (&ge; 30°C)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#808080" }}></div>
            <span className="text-xs text-gray-600">No Data / Loading</span>
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
              // Color based on temperature
              const zoneColor = station.color || "#808080"; // Default grey for no data/loading
              
              return (
                <ZoneCircle
                  key={station.id}
                  station={station}
                  zoneColor={zoneColor}
                  onStationClick={onStationClick}
                />
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

