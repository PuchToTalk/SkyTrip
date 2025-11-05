"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { WX } from "@/lib/windborne";

interface ChartPanelProps {
  data: WX[];
  dataQuality: number; // percentage
}

export default function ChartPanel({ data, dataQuality }: ChartPanelProps) {
  // Get last 7 days of data, or all available data if less than 7 days
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // First, try to get last 7 days
  let recentData = data
    .filter((d) => {
      const timestamp = new Date(d.timestamp).getTime();
      return timestamp >= sevenDaysAgo && timestamp <= now;
    })
    .map((d) => ({
      timestamp: new Date(d.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      temperature: Number(d.temperature),
      fullDate: d.timestamp,
    }))
    .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());

  // If no data in last 7 days, use all available data (last 30 days or all if less)
  if (recentData.length === 0 && data.length > 0) {
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    recentData = data
      .filter((d) => {
        const timestamp = new Date(d.timestamp).getTime();
        return timestamp >= thirtyDaysAgo && timestamp <= now;
      })
      .map((d) => ({
        timestamp: new Date(d.timestamp).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        temperature: Number(d.temperature),
        fullDate: d.timestamp,
      }))
      .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
    
    // If still no data, use all available data
    if (recentData.length === 0) {
      recentData = data
        .map((d) => ({
          timestamp: new Date(d.timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          temperature: Number(d.temperature),
          fullDate: d.timestamp,
        }))
        .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime())
        .slice(-30); // Limit to last 30 points for readability
    }
  }

  const avgTemp =
    recentData.length > 0
      ? recentData.reduce((sum, d) => sum + d.temperature, 0) / recentData.length
      : null;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">
          Temperature {recentData.length > 0 && data.length > 0 && recentData.length < data.length 
            ? `(${recentData.length} recent points)` 
            : "(Last 7 Days)"}
        </h3>
        <div className="flex items-center space-x-4">
          {avgTemp !== null && (
            <div className="text-sm">
              <span className="text-gray-600">Avg: </span>
              <span className="font-semibold">{avgTemp.toFixed(1)}°C</span>
            </div>
          )}
          <div className="text-sm">
            <span className="text-gray-600">Data Quality: </span>
            <span
              className={`font-semibold ${
                dataQuality >= 80
                  ? "text-green-600"
                  : dataQuality >= 60
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}
            >
              {dataQuality.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {recentData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={recentData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis
              label={{ value: "Temperature (°C)", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(1)}°C`, "Temperature"]}
            />
            <Line
              type="monotone"
              dataKey="temperature"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[300px] flex items-center justify-center text-gray-500">
          {data.length === 0 
            ? "No weather data available for this station" 
            : "No recent data available (last 30 days)"}
        </div>
      )}
    </div>
  );
}

