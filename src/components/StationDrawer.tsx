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
    <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl z-50 overflow-y-auto border-l border-gray-200">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {station.name || station.id}
            </h2>
            {isLoading && (
              <p className="text-xs text-gray-500 mt-1">
                Loading...
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-all duration-200 text-2xl w-10 h-10 flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Station Info */}
        <div className="mb-6 space-y-3">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-semibold text-gray-900">Station ID:</span>{" "}
              <span className="font-mono text-gray-600">{station.id}</span>
            </p>
            {station.lat !== undefined && station.lon !== undefined && (
              <p className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900">Coordinates:</span>{" "}
                <span className="font-mono text-gray-600">
                  {station.lat.toFixed(4)}°N, {station.lon.toFixed(4)}°E
                </span>
              </p>
            )}
          </div>
          
          {dataQuality > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-700 font-medium">
                Data Quality: <span className="font-bold">{dataQuality}%</span>
              </p>
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <ChartPanel data={weatherData} dataQuality={dataQuality} />
          </div>
        </div>

        {weatherData.length === 0 && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 font-medium">
              No weather data available for this station.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

