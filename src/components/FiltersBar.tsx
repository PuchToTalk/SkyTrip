"use client";

import { MAJOR_AIRPORTS } from "@/lib/airports";

export interface FilterState {
  origin: string;
  destination: string; // Destination airport code
  outboundDate: string;
  returnDate?: string;
  budget: number;
  tempMin: number;
  tempMax: number;
  type: "one-way" | "round-trip";
  nonStopOnly: boolean;
}

interface FiltersBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export default function FiltersBar({ filters, onChange }: FiltersBarProps) {
  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const today = new Date().toISOString().split("T")[0];
  const defaultOutbound = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  return (
    <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Origin */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Origin Airport
          </label>
          <select
            value={filters.origin}
            onChange={(e) => updateFilter("origin", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Origin</option>
            {MAJOR_AIRPORTS.map((airport) => (
              <option key={airport.code} value={airport.code}>
                {airport.name}
              </option>
            ))}
          </select>
        </div>

        {/* Destination - Only show if origin is selected */}
        {filters.origin && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Destination Airport
            </label>
            <select
              value={filters.destination || ""}
              onChange={(e) => updateFilter("destination", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Stations</option>
              {MAJOR_AIRPORTS.map((airport) => (
                <option key={airport.code} value={airport.code}>
                  {airport.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Outbound Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Outbound Date
          </label>
          <input
            type="date"
            value={filters.outboundDate || defaultOutbound}
            min={today}
            onChange={(e) => updateFilter("outboundDate", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Return Date */}
        {filters.type === "round-trip" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Return Date
            </label>
            <input
              type="date"
              value={filters.returnDate || ""}
              min={filters.outboundDate || today}
              onChange={(e) => updateFilter("returnDate", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Trip Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Trip Type
          </label>
          <select
            value={filters.type}
            onChange={(e) =>
              updateFilter("type", e.target.value as "one-way" | "round-trip")
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="one-way">One-way</option>
            <option value="round-trip">Round-trip</option>
          </select>
        </div>

        {/* Budget */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Budget ($)
          </label>
          <input
            type="number"
            value={filters.budget}
            min="0"
            step="50"
            onChange={(e) => updateFilter("budget", parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Temp Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min Temp (°C)
          </label>
          <input
            type="number"
            value={filters.tempMin}
            min="-50"
            max="50"
            onChange={(e) => updateFilter("tempMin", parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Temp (°C)
          </label>
          <input
            type="number"
            value={filters.tempMax}
            min="-50"
            max="50"
            onChange={(e) => updateFilter("tempMax", parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Non-stop Only */}
        <div className="flex items-end">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.nonStopOnly}
              onChange={(e) => updateFilter("nonStopOnly", e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Non-stop only
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

