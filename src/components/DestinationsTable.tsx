"use client";

import { useState } from "react";
import type { FlightPrice } from "@/lib/flights/types";

export interface TemperatureByTimeOfDay {
  morning: number; // 6h-12h
  midday: number; // 12h-15h
  afternoon: number; // 15h-18h
  evening: number; // 18h-21h
  night: number; // 21h-6h
}

export interface DestinationRow {
  destination: string;
  airportCode: string;
  avgTemp: number;
  tempByTimeOfDay?: TemperatureByTimeOfDay;
  lowestPrice: number | null;
  currency: string;
  flightDuration?: string; // Human-readable duration like "5h 30m"
  departureTime?: string; // Format: "YYYY-MM-DD HH:MM"
  arrivalTime?: string; // Format: "YYYY-MM-DD HH:MM"
  airline?: string;
  score: number;
  stationId: string;
  stationName?: string;
  flightUrl?: string;
}

interface DestinationsTableProps {
  rows: DestinationRow[];
  onOpenFlights: (row: DestinationRow) => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  onClear?: () => void;
}

export default function DestinationsTable({
  rows,
  onOpenFlights,
  onLoadMore,
  isLoadingMore = false,
  onClear,
}: DestinationsTableProps) {
  const [sortBy, setSortBy] = useState<keyof DestinationRow>("score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleSort = (column: keyof DestinationRow) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    const multiplier = sortOrder === "asc" ? 1 : -1;

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === "number" && typeof bVal === "number") {
      return (aVal - bVal) * multiplier;
    }

    return String(aVal).localeCompare(String(bVal)) * multiplier;
  });

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <tr>
              <th
                className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                onClick={() => handleSort("destination")}
              >
                Destination
                {sortBy === "destination" && (
                  <span className="ml-1 text-gray-500">{sortOrder === "asc" ? "↑" : "↓"}</span>
                )}
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                onClick={() => handleSort("avgTemp")}
              >
                Temperature (°C)
                {sortBy === "avgTemp" && (
                  <span className="ml-1 text-gray-500">{sortOrder === "asc" ? "↑" : "↓"}</span>
                )}
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                onClick={() => handleSort("lowestPrice")}
              >
                Lowest Price
                {sortBy === "lowestPrice" && (
                  <span className="ml-1 text-gray-500">{sortOrder === "asc" ? "↑" : "↓"}</span>
                )}
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Flight Times
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Airline
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                onClick={() => handleSort("score")}
              >
                Score
                {sortBy === "score" && (
                  <span className="ml-1 text-gray-500">{sortOrder === "asc" ? "↑" : "↓"}</span>
                )}
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-gray-500 font-medium">No destinations yet</p>
                    <p className="text-sm text-gray-400 mt-1">Select a destination airport to see flight options</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedRows.map((row, idx) => (
                <tr 
                  key={`${row.stationId}-${idx}`} 
                  className="hover:bg-gray-50 transition-all duration-200 border-b border-gray-100"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {row.destination}
                      </div>
                      <div className="text-xs text-gray-500 font-medium">{row.airportCode}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {row.tempByTimeOfDay && row.arrivalTime ? (() => {
                      // Determine arrival time period based on arrivalTime
                      // Format: "YYYY-MM-DD HH:MM" (local time at destination)
                      let arrivalPeriod: "morning" | "midday" | "evening" = "midday";
                      let temperature = row.avgTemp; // Default to average
                      let periodLabel = "";
                      
                      try {
                        // Parse the hour directly from the string format "YYYY-MM-DD HH:MM"
                        // Extract hour from format like "2025-11-13 07:36"
                        const timeMatch = row.arrivalTime.match(/(\d{2}):(\d{2})/);
                        if (timeMatch) {
                          const hour = parseInt(timeMatch[1], 10);
                          
                          if (hour < 12) {
                            arrivalPeriod = "morning";
                            temperature = row.tempByTimeOfDay.morning;
                            periodLabel = "Morning";
                          } else if (hour >= 12 && hour < 17) {
                            arrivalPeriod = "midday";
                            temperature = row.tempByTimeOfDay.midday;
                            periodLabel = "Midday";
                          } else {
                            arrivalPeriod = "evening";
                            temperature = row.tempByTimeOfDay.evening;
                            periodLabel = "Evening";
                          }
                        } else {
                          // Fallback: try parsing as Date and use local hours
                          const arrivalDate = new Date(row.arrivalTime);
                          const hour = arrivalDate.getHours(); // Use local hours, not UTC
                          
                          if (hour < 12) {
                            arrivalPeriod = "morning";
                            temperature = row.tempByTimeOfDay.morning;
                            periodLabel = "Morning";
                          } else if (hour >= 12 && hour < 17) {
                            arrivalPeriod = "midday";
                            temperature = row.tempByTimeOfDay.midday;
                            periodLabel = "Midday";
                          } else {
                            arrivalPeriod = "evening";
                            temperature = row.tempByTimeOfDay.evening;
                            periodLabel = "Evening";
                          }
                        }
                      } catch (e) {
                        // Default to average if parsing fails
                        temperature = row.avgTemp;
                        periodLabel = "Avg";
                      }

                      // Get color based on temperature (same as heatmap legend)
                      // Cold (< 10°C): blue, Moderate (10-20°C): yellow, Warm (20-30°C): orange, Hot (>= 30°C): red
                      let tempColor = "#666"; // Default gray
                      if (temperature < 10) {
                        tempColor = "#007bff"; // Blue for Cold
                      } else if (temperature >= 10 && temperature < 20) {
                        tempColor = "#ffc107"; // Yellow for Moderate
                      } else if (temperature >= 20 && temperature < 30) {
                        tempColor = "#fd7e14"; // Orange for Warm
                      } else {
                        tempColor = "#dc3545"; // Red for Hot
                      }

                      return (
                        <div>
                          <span className="text-sm font-semibold" style={{ color: tempColor }}>
                            {temperature.toFixed(1)}°C
                          </span>
                          <div className="text-xs text-gray-500 mt-0.5">
                            ({periodLabel})
                          </div>
                        </div>
                      );
                    })() : (() => {
                      // Also apply color for average temperature if no arrival time
                      let tempColor = "#666"; // Default gray
                      if (row.avgTemp < 10) {
                        tempColor = "#007bff"; // Blue for Cold
                      } else if (row.avgTemp >= 10 && row.avgTemp < 20) {
                        tempColor = "#ffc107"; // Yellow for Moderate
                      } else if (row.avgTemp >= 20 && row.avgTemp < 30) {
                        tempColor = "#fd7e14"; // Orange for Warm
                      } else {
                        tempColor = "#dc3545"; // Red for Hot
                      }
                      return (
                        <span className="text-sm font-semibold" style={{ color: tempColor }}>
                          {row.avgTemp.toFixed(1)}°C
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {row.lowestPrice !== null ? (
                      <span className="text-sm font-bold text-gray-900">
                        {row.currency} {row.lowestPrice.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {row.departureTime || row.arrivalTime ? (
                      <div className="text-sm font-medium text-gray-900">
                        {row.departureTime ? (
                          <div className="mb-1">
                            <span className="text-xs text-gray-500">Dep:</span> {row.departureTime}
                          </div>
                        ) : null}
                        {row.arrivalTime ? (
                          <div>
                            <span className="text-xs text-gray-500">Arr:</span> {row.arrivalTime}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {row.flightDuration ? (
                      <span className="text-sm font-medium text-gray-900">
                        {row.flightDuration}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {row.airline ? (
                      <span className="text-sm font-medium text-gray-900">
                        {row.airline}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full ${
                        row.score >= 0.8
                          ? "bg-green-100 text-green-800" // 80-100%: Green (current green)
                          : row.score >= 0.6
                          ? "bg-yellow-200 text-yellow-900" // 60-80%: Yellow-green (lime-like)
                          : row.score >= 0.3
                          ? "bg-yellow-100 text-yellow-800" // 30-60%: Yellow
                          : "bg-red-100 text-red-800" // 0-30%: Red
                      }`}
                      style={row.score >= 0.6 && row.score < 0.8 ? { backgroundColor: '#d9f99d', color: '#365314' } : {}}
                    >
                      {(row.score * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => onOpenFlights(row)}
                      className="text-blue-600 hover:text-blue-700 font-medium text-base transition-colors duration-200 bg-transparent border-0 p-0 cursor-pointer hover:underline"
                      style={{ color: '#3366FF' }}
                    >
                      View Flights
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Action Buttons */}
      {(onLoadMore || onClear) && (
        <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
          {onClear && (
            <button
              onClick={onClear}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Clear
            </button>
          )}
          {onLoadMore && (
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoadingMore ? "Loading..." : "More Destinations"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

