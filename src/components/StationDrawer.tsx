"use client";

import type { Station, WX } from "@/lib/windborne";
import ChartPanel from "./ChartPanel";

interface StationDrawerProps {
  station: Station | null;
  weatherData: WX[];
  dataQuality: number;
  onClose: () => void;
  isLoading?: boolean;
}

export default function StationDrawer({
  station,
  weatherData,
  dataQuality,
  onClose,
  isLoading,
}: StationDrawerProps) {
  if (!station) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-xl z-50 overflow-y-auto">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{station.name || station.id}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Station Info */}
        <div className="mb-4 space-y-2">
          <p className="text-sm text-gray-600">
            <span className="font-medium">ID:</span> {station.id}
          </p>
          {station.lat !== undefined && station.lon !== undefined && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Location:</span> {station.lat.toFixed(4)}
              °N, {station.lon.toFixed(4)}°E
            </p>
          )}
        </div>

        {/* Chart */}
        <div className="mb-6">
          <ChartPanel data={weatherData} dataQuality={dataQuality} />
        </div>

        {weatherData.length === 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              No weather data available for this station.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

