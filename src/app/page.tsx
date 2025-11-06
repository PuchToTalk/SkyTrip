"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CloudRain, DollarSign, TrendingUp } from "lucide-react";
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
    passengers: 1,
    cabinClass: "Economy",
  });

  const handleSearch = () => {
    // Allow search even without destination - redirects to map page without filters
    const params = new URLSearchParams();

    // Only add parameters if they have values
    if (filters.origin) {
      params.set("origin", filters.origin);
    }
    if (filters.destination) {
      params.set("destination", filters.destination);
    }
    if (filters.outboundDate) {
      params.set("outbound_date", filters.outboundDate);
    }
    if (filters.returnDate) {
      params.set("return_date", filters.returnDate);
    }
    if (filters.budget) {
      params.set("budget", filters.budget.toString());
    }
    if (filters.tempMin) {
      params.set("temp_min", filters.tempMin.toString());
    }
    if (filters.tempMax) {
      params.set("temp_max", filters.tempMax.toString());
    }
    if (filters.type) {
      params.set("type", filters.type);
    }
    if (filters.nonStopOnly) {
      params.set("non_stop", filters.nonStopOnly.toString());
    }
    if (filters.passengers) {
      params.set("passengers", filters.passengers.toString());
    }
    if (filters.cabinClass) {
      params.set("cabin_class", filters.cabinClass);
    }

    // Navigate to search page with or without params
    router.push(`/search${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center relative">
                <Image 
                  src="/skytrip.png" 
                  alt="SkyTrip Logo" 
                  width={40}
                  height={40}
                  className="object-contain"
                  priority
                />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">SkyTrip</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="https://github.com/PuchToTalk/SkyTrip" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-900 transition-colors">How it works</a>
              <a href="https://www.pauldanzhechu.com/" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-900 transition-colors">About Me</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative flex-1 bg-gradient-to-br from-blue-50 via-white to-cyan-50">
        {/* Background Image with low opacity */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url("https://images.unsplash.com/photo-1436491865332-7a61a109cc05?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80")',
            opacity: 1.0
          }}
        ></div>
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/80 via-white/60 to-cyan-50/80"></div>
        
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          {/* Main Heading */}
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
              <span className="text-white">Find Your Perfect</span>
              <span className="text-blue-600"> Destination</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Combine real-time weather data with flight prices to discover the best travel destinations based on your preferences.
            </p>
          </div>

          {/* Search Card - Google Flights Style */}
          <div className="max-w-6xl mx-auto">
            <FiltersBar filters={filters} onChange={setFilters} variant="landing" onSearch={handleSearch} />
          </div>
          
          {/* Video/GIF Section */}
          <div className="mt-20 max-w-5xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-white/80 backdrop-blur-sm">
              <div className="aspect-video bg-gradient-to-br from-blue-50/50 to-cyan-50/50 flex items-center justify-center">
                {/* Placeholder for video/GIF - replace with actual video or GIF */}
                <div className="text-center p-8">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">See SkyTrip in Action</h3>
                  <p className="text-gray-600">Watch how we combine weather data and flight prices to help you find your perfect destination</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">
              Why SkyTrip?
            </h3>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Make informed travel decisions with data-driven insights
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Real Weather Data */}
            <div className="group text-center p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 hover:from-blue-100 hover:to-blue-50 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-xl">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                <CloudRain className="w-10 h-10 text-white" strokeWidth={2.5} />
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-3">Real Weather Data</h4>
              <p className="text-gray-700 leading-relaxed">
                Access historical weather data from WindBorne stations to understand climate patterns before you travel.
              </p>
            </div>

            {/* Best Prices */}
            <div className="group text-center p-8 rounded-2xl bg-gradient-to-br from-cyan-50 to-cyan-100/50 hover:from-cyan-100 hover:to-cyan-50 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-xl">
              <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                <DollarSign className="w-10 h-10 text-white" strokeWidth={2.5} />
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-3">Best Prices</h4>
              <p className="text-gray-700 leading-relaxed">
                Compare flight prices from Google Flights to find the most affordable options for your trip.
              </p>
            </div>

            {/* Smart Scoring */}
            <div className="group text-center p-8 rounded-2xl bg-gradient-to-br from-green-50 to-green-100/50 hover:from-green-100 hover:to-green-50 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-xl">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="w-10 h-10 text-white" strokeWidth={2.5} />
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-3">Smart Scoring</h4>
              <p className="text-gray-700 leading-relaxed">
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
