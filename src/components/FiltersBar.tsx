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
  passengers?: number;
  cabinClass?: "Economy" | "Business" | "Premiere";
}

interface FiltersBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  variant?: "default" | "compact" | "landing";
  onSearch?: () => void;
}

export default function FiltersBar({ filters, onChange, variant = "default", onSearch }: FiltersBarProps) {
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
  const isLanding = variant === "landing";
  
  if (isLanding) {
    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200 p-6">
        {/* Google Flights Style Search Bar */}
        <div className="relative">
          {/* Top Row - Trip Type, Passengers, Class */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
            <div className="flex items-center gap-4">
              {/* Trip Type Dropdown */}
              <div className="relative">
                <select
                  value={filters.type}
                  onChange={(e) => updateFilter("type", e.target.value as "one-way" | "round-trip")}
                  className="appearance-none flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors bg-transparent border-0 cursor-pointer pr-6 focus:outline-none"
                >
                  <option value="one-way">One-way</option>
                  <option value="round-trip">Round-trip</option>
                </select>
                <svg className="w-4 h-4 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              
              {/* Passengers Dropdown */}
              <div className="relative flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <select
                  value={filters.passengers || 1}
                  onChange={(e) => updateFilter("passengers", parseInt(e.target.value) || 1)}
                  className="appearance-none text-gray-700 hover:text-gray-900 transition-colors bg-transparent border-0 cursor-pointer pr-6 focus:outline-none text-sm"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
                <svg className="w-4 h-4 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            
            {/* Cabin Class Dropdown */}
            <div className="relative">
              <select
                value={filters.cabinClass || "Economy"}
                onChange={(e) => updateFilter("cabinClass", e.target.value as "Economy" | "Business" | "Premiere")}
                className="appearance-none text-gray-700 hover:text-gray-900 transition-colors text-sm bg-transparent border-0 cursor-pointer pr-6 focus:outline-none"
              >
                <option value="Economy">Economy</option>
                <option value="Business">Business</option>
                <option value="Premiere">Premiere</option>
              </select>
              <svg className="w-4 h-4 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Main Search Fields */}
          <div className="flex items-center gap-2">
            {/* Origin */}
            <div className="flex-1 bg-gray-50 rounded-xl border border-gray-300 hover:border-blue-500 transition-colors px-4 py-3 cursor-pointer">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <select
                    value={filters.origin}
                    onChange={(e) => updateFilter("origin", e.target.value)}
                    className="w-full text-sm text-gray-900 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 cursor-pointer"
                  >
                    <option value="">Select origin</option>
                    {MAJOR_AIRPORTS.map((airport) => (
                      <option key={airport.code} value={airport.code} className="bg-white">
                        {airport.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Swap Button */}
            <button className="w-10 h-10 rounded-full bg-gray-50 border border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>

            {/* Destination */}
            <div className="flex-1 bg-gray-50 rounded-xl border-2 border-blue-600 hover:border-blue-500 transition-colors px-4 py-3 cursor-pointer">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <select
                    value={filters.destination || ""}
                    onChange={(e) => updateFilter("destination", e.target.value)}
                    className="w-full text-sm text-gray-900 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 cursor-pointer"
                  >
                    <option value="">Destination</option>
                    {MAJOR_AIRPORTS.map((airport) => (
                      <option key={airport.code} value={airport.code} className="bg-white">
                        {airport.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="flex-1 bg-gray-50 rounded-xl border border-gray-300 hover:border-blue-500 transition-colors px-4 py-3 cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Departure</label>
                  <input
                    type="date"
                    value={filters.outboundDate || defaultOutbound}
                    min={today}
                    onChange={(e) => updateFilter("outboundDate", e.target.value)}
                    className="w-full text-sm text-gray-900 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 cursor-pointer"
                  />
                </div>
                {filters.type === "round-trip" && (
                  <>
                    <div className="w-px h-6 bg-gray-300"></div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Return</label>
                      <input
                        type="date"
                        value={filters.returnDate || ""}
                        min={filters.outboundDate || today}
                        onChange={(e) => updateFilter("returnDate", e.target.value)}
                        className="w-full text-sm text-gray-900 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 cursor-pointer"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Search Button - Central with magnifying glass */}
            <button
              onClick={(e) => {
                e.preventDefault();
                if (onSearch) {
                  onSearch();
                }
              }}
              disabled={!onSearch}
              className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg flex items-center justify-center"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>

          {/* Additional Filters */}
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Budget</label>
              <input
                type="number"
                value={filters.budget}
                min="0"
                step="50"
                onChange={(e) => updateFilter("budget", parseFloat(e.target.value) || 0)}
                className="w-20 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="$1000"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Temp</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={filters.tempMin}
                  min="-50"
                  max="50"
                  onChange={(e) => updateFilter("tempMin", parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1.5 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  value={filters.tempMax}
                  min="-50"
                  max="50"
                  onChange={(e) => updateFilter("tempMax", parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1.5 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-xs text-gray-500">°C</span>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.nonStopOnly}
                onChange={(e) => updateFilter("nonStopOnly", e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600">Non-stop</span>
            </label>
          </div>
        </div>
      </div>
    );
  }

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

