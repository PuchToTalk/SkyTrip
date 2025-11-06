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
  variant?: "default" | "compact";
}

export default function FiltersBar({ filters, onChange, variant = "default" }: FiltersBarProps) {
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

  const isCompact = variant === "compact";
  const containerClass = isCompact
    ? "bg-white p-6"
    : "bg-white border-b border-gray-200 p-4 shadow-sm";
  const gridClass = isCompact
    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
    : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4";

  return (
    <div className={containerClass}>
      {/* Airbnb-style horizontal search bar */}
      <div className="flex items-center gap-0 bg-white rounded-full border border-gray-300 shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
        {/* Origin */}
        <div className="flex-1 px-6 py-4 border-r border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
          <label className="block text-xs font-semibold text-gray-800 mb-1">
            Where from
          </label>
          <select
            value={filters.origin}
            onChange={(e) => updateFilter("origin", e.target.value)}
            className="w-full text-sm text-gray-900 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 cursor-pointer"
          >
            <option value="">Add origin</option>
            {MAJOR_AIRPORTS.map((airport) => (
              <option key={airport.code} value={airport.code}>
                {airport.name}
              </option>
            ))}
          </select>
        </div>

        {/* Destination */}
        <div className="flex-1 px-6 py-4 border-r border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
          <label className="block text-xs font-semibold text-gray-800 mb-1">
            Where to
          </label>
          <select
            value={filters.destination || ""}
            onChange={(e) => updateFilter("destination", e.target.value)}
            className="w-full text-sm text-gray-900 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 cursor-pointer"
          >
            <option value="">Add destination</option>
            {MAJOR_AIRPORTS.map((airport) => (
              <option key={airport.code} value={airport.code}>
                {airport.name}
              </option>
            ))}
          </select>
        </div>

        {/* Outbound Date */}
        <div className="flex-1 px-6 py-4 border-r border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
          <label className="block text-xs font-semibold text-gray-800 mb-1">
            Check in
          </label>
          <input
            type="date"
            value={filters.outboundDate || defaultOutbound}
            min={today}
            onChange={(e) => updateFilter("outboundDate", e.target.value)}
            className="w-full text-sm text-gray-900 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 cursor-pointer"
          />
        </div>

        {/* Return Date */}
        {filters.type === "round-trip" && (
          <div className="flex-1 px-6 py-4 border-r border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
            <label className="block text-xs font-semibold text-gray-800 mb-1">
              Check out
            </label>
            <input
              type="date"
              value={filters.returnDate || ""}
              min={filters.outboundDate || today}
              onChange={(e) => updateFilter("returnDate", e.target.value)}
              className="w-full text-sm text-gray-900 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 cursor-pointer"
            />
          </div>
        )}

        {/* Additional filters - compact */}
        <div className="flex items-center gap-4 px-6 py-4">
          {/* Budget */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-800">Budget</label>
            <input
              type="number"
              value={filters.budget}
              min="0"
              step="50"
              onChange={(e) => updateFilter("budget", parseFloat(e.target.value) || 0)}
              className="w-20 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
              placeholder="$1000"
            />
          </div>

          {/* Temp Range */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-800">Temp</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={filters.tempMin}
                min="-50"
                max="50"
                onChange={(e) => updateFilter("tempMin", parseFloat(e.target.value) || 0)}
                className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                placeholder="Min"
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                value={filters.tempMax}
                min="-50"
                max="50"
                onChange={(e) => updateFilter("tempMax", parseFloat(e.target.value) || 0)}
                className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                placeholder="Max"
              />
              <span className="text-xs text-gray-500">°C</span>
            </div>
          </div>

          {/* Trip Type */}
          <select
            value={filters.type}
            onChange={(e) =>
              updateFilter("type", e.target.value as "one-way" | "round-trip")
            }
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
          >
            <option value="one-way">One-way</option>
            <option value="round-trip">Round-trip</option>
          </select>

          {/* Non-stop Only */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.nonStopOnly}
              onChange={(e) => updateFilter("nonStopOnly", e.target.checked)}
              className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-400"
            />
            <span className="text-xs font-medium text-gray-700">Non-stop</span>
          </label>
        </div>
      </div>
    </div>
  );
}

