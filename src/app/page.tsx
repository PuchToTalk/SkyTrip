"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FiltersBar, { type FilterState } from "@/components/FiltersBar";

export default function Home() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>({
    origin: "",
    destination: "",
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

  const handleSearch = () => {
    if (!filters.destination) {
      alert("Please select a destination airport");
      return;
    }

    const params = new URLSearchParams({
      origin: filters.origin,
      outbound_date: filters.outboundDate,
      budget: filters.budget.toString(),
      temp_min: filters.tempMin.toString(),
      temp_max: filters.tempMax.toString(),
      type: filters.type,
      non_stop: filters.nonStopOnly.toString(),
    });

    if (filters.destination) {
      params.set("destination", filters.destination);
    }
    if (filters.returnDate) {
      params.set("return_date", filters.returnDate);
    }

    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">S</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">SkyTrip</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="#" className="text-gray-600 hover:text-gray-900">How it works</a>
              <a href="#" className="text-gray-600 hover:text-gray-900">About</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative flex-1 bg-gradient-to-br from-blue-50 via-white to-cyan-50">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          {/* Main Heading */}
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
              Find Your Perfect
              <span className="text-blue-600"> Destination</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Combine real-time weather data with flight prices to discover the best travel destinations based on your preferences.
            </p>
          </div>

          {/* Search Card */}
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 border border-gray-100">
              <FiltersBar filters={filters} onChange={setFilters} variant="compact" />
              
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleSearch}
                  disabled={!filters.destination}
                  className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg"
                >
                  Find Destinations
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              Why SkyTrip?
            </h3>
            <p className="text-lg text-gray-600">
              Make informed travel decisions with data-driven insights
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Real Weather Data</h4>
              <p className="text-gray-600">
                Access historical weather data from WindBorne stations to understand climate patterns before you travel.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Best Prices</h4>
              <p className="text-gray-600">
                Compare flight prices from Google Flights to find the most affordable options for your trip.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Smart Scoring</h4>
              <p className="text-gray-600">
                Get personalized recommendations based on your temperature preferences and budget constraints.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-600">
            <p>Powered by WindBorne Systems & Google Flights</p>
            <p className="text-sm mt-2">© 2025 SkyTrip. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
