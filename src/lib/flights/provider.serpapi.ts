import type { FlightProvider } from "./provider";
import type { FlightSearchParams, FlightSearchResult, FlightPrice } from "./types";

export class SerpApiFlightProvider implements FlightProvider {
  private apiKey: string;
  private baseUrl: string;
  private hl: string;
  private gl: string;
  private currency: string;

  constructor() {
    this.apiKey = process.env.SERPAPI_KEY || "";
    this.baseUrl = process.env.SERPAPI_FLIGHTS_ENDPOINT || "https://serpapi.com/search.json";
    this.hl = process.env.SERPAPI_DEFAULT_HL || "en";
    this.gl = process.env.SERPAPI_DEFAULT_GL || "us";
    this.currency = process.env.SERPAPI_DEFAULT_CURRENCY || "USD";
    
    // Log configuration (without exposing key)
    if (!this.apiKey || this.apiKey === "your_serpapi_key_here") {
      console.warn("⚠️ SERPAPI_KEY is not set or is default value");
    } else {
      console.log(`✅ SerpApi configured (key length: ${this.apiKey.length})`);
    }
  }

  async search(params: FlightSearchParams): Promise<FlightSearchResult> {
    const searchParams = new URLSearchParams({
      engine: "google_flights",
      api_key: this.apiKey,
      departure_id: params.from,
      arrival_id: params.to,
      outbound_date: params.outbound_date,
      hl: this.hl,
      gl: this.gl,
      currency: this.currency,
    });

    // Set trip type: explicitly set for both one-way and round-trip
    // SerpApi Google Flights API: type=2 for one-way, type=1 for round-trip
    if (params.type === "round-trip") {
      searchParams.set("type", "1"); // 1 = Round trip
      if (params.return_date) {
        searchParams.set("return_date", params.return_date);
      } else {
        // If round-trip but no return_date, SerpApi will error
        // Default to one-way in this case
        console.warn("Round-trip selected but no return_date provided, defaulting to one-way");
        searchParams.set("type", "2"); // 2 = One-way
      }
    } else {
      // For one-way or undefined, explicitly set type to 2
      searchParams.set("type", "2"); // 2 = One-way
    }

    if (params.deep_search) {
      searchParams.set("deep_search", "true");
    }

    if (params.sort_by !== undefined) {
      searchParams.set("sort_by", params.sort_by.toString());
    } else {
      searchParams.set("sort_by", "2"); // default to price
    }

    if (params.stops !== undefined) {
      searchParams.set("stops", params.stops.toString());
    }

    const url = `${this.baseUrl}?${searchParams.toString()}`;
    console.log(`🔍 SerpApi request: ${url.replace(this.apiKey, "***")}`);
    
    const response = await fetch(url);
    const responseText = await response.text();
    
    console.log(`📡 SerpApi response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`❌ SerpApi HTTP error: ${response.status}`);
      console.error(`Response (first 500 chars): ${responseText.substring(0, 500)}`);
      
      let errorMessage = `SerpApi error: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        // Handle structured SerpApi errors
        if (errorData.error) {
          errorMessage = errorData.error;
          if (errorData.details && errorData.details.detail) {
            errorMessage += `: ${errorData.details.detail}`;
          }
          console.error("Error details:", JSON.stringify(errorData, null, 2));
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // If not JSON, use the text
        errorMessage = responseText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("❌ Failed to parse SerpApi response as JSON");
      console.error("Response (first 500 chars):", responseText.substring(0, 500));
      throw new Error("Invalid JSON response from SerpApi");
    }
    
    // Check if SerpApi returned an error in the response body
    if (data.error) {
      const errorMsg = data.details?.detail || data.error || "SerpApi returned an error";
      console.error("❌ SerpApi error in response:", JSON.stringify(data, null, 2));
      throw new Error(errorMsg);
    }
    
    console.log(`✅ SerpApi response parsed successfully`);

    // Parse SerpApi response
    const flights: FlightPrice[] = [];
    let cheapest: FlightPrice | null = null;

    console.log(`📊 Parsing flights from response:`);
    console.log(`  - best_flights: ${data.best_flights ? data.best_flights.length : 0}`);
    console.log(`  - other_flights: ${data.other_flights ? data.other_flights.length : 0}`);
    console.log(`  - Available keys: ${Object.keys(data).join(", ")}`);

    // Helper function to extract flight details from SerpApi flight object
    const extractFlightDetails = (flightObj: any): Partial<FlightPrice> => {
      const details: Partial<FlightPrice> = {};
      
      // Extract departure time from first flight segment and arrival time from last segment
      if (flightObj.flights && Array.isArray(flightObj.flights) && flightObj.flights.length > 0) {
        const firstFlight = flightObj.flights[0];
        const lastFlight = flightObj.flights[flightObj.flights.length - 1];
        
        if (firstFlight.departure_airport && firstFlight.departure_airport.time) {
          details.departureTime = firstFlight.departure_airport.time;
        }
        
        if (lastFlight.arrival_airport && lastFlight.arrival_airport.time) {
          details.arrivalTime = lastFlight.arrival_airport.time;
        }
        
        // Extract airline from first flight segment (or use "Multiple" if different airlines)
        const airlines = new Set<string>();
        flightObj.flights.forEach((f: any) => {
          if (f.airline) airlines.add(f.airline);
        });
        if (airlines.size === 1) {
          details.airline = Array.from(airlines)[0];
        } else if (airlines.size > 1) {
          details.airline = "Multiple airlines";
        }
      }
      
      // Extract total duration (in minutes)
      if (flightObj.total_duration !== undefined) {
        details.durationMinutes = flightObj.total_duration;
        // Convert to human-readable format
        const hours = Math.floor(flightObj.total_duration / 60);
        const minutes = flightObj.total_duration % 60;
        details.duration = `${hours}h ${minutes}m`;
      } else if (flightObj.flights && Array.isArray(flightObj.flights)) {
        // Calculate total duration from individual segments
        const totalMinutes = flightObj.flights.reduce((sum: number, f: any) => {
          return sum + (f.duration || 0);
        }, 0);
        if (totalMinutes > 0) {
          details.durationMinutes = totalMinutes;
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          details.duration = `${hours}h ${minutes}m`;
        }
      }
      
      // Extract flight link
      if (flightObj.flight_link) {
        details.url = flightObj.flight_link;
      }
      
      // Extract stops
      if (flightObj.layovers && Array.isArray(flightObj.layovers)) {
        details.stops = flightObj.layovers.length;
      } else if (flightObj.flights && Array.isArray(flightObj.flights)) {
        details.stops = flightObj.flights.length - 1;
      }
      
      return details;
    };

    // SerpApi Google Flights response structure
    if (data.best_flights && Array.isArray(data.best_flights)) {
      console.log(`  Processing ${data.best_flights.length} best_flights...`);
      for (const flightObj of data.best_flights) {
        const price = this.extractPrice(flightObj.price);
        if (price) {
          const flightDetails = extractFlightDetails(flightObj);
          const flightPrice: FlightPrice = {
            price,
            currency: this.currency,
            airline: flightDetails.airline,
            duration: flightDetails.duration,
            durationMinutes: flightDetails.durationMinutes,
            departureTime: flightDetails.departureTime,
            arrivalTime: flightDetails.arrivalTime,
            stops: flightDetails.stops,
            url: flightDetails.url,
          };
          flights.push(flightPrice);
          if (!cheapest || price < cheapest.price) {
            cheapest = flightPrice;
          }
        } else {
          console.warn(`  ⚠️ Could not extract price from flight:`, JSON.stringify(flightObj.price, null, 2));
        }
      }
    }

    // Also check other_flights if available
    if (data.other_flights && Array.isArray(data.other_flights)) {
      console.log(`  Processing ${data.other_flights.length} other_flights...`);
      for (const flightObj of data.other_flights) {
        const price = this.extractPrice(flightObj.price);
        if (price) {
          const flightDetails = extractFlightDetails(flightObj);
          const flightPrice: FlightPrice = {
            price,
            currency: this.currency,
            airline: flightDetails.airline,
            duration: flightDetails.duration,
            durationMinutes: flightDetails.durationMinutes,
            departureTime: flightDetails.departureTime,
            arrivalTime: flightDetails.arrivalTime,
            stops: flightDetails.stops,
            url: flightDetails.url,
          };
          flights.push(flightPrice);
          if (!cheapest || price < cheapest.price) {
            cheapest = flightPrice;
          }
        } else {
          console.warn(`  ⚠️ Could not extract price from flight:`, JSON.stringify(flightObj.price, null, 2));
        }
      }
    }

    // Check for alternative response structures
    if (flights.length === 0) {
      console.warn("⚠️ No flights found in best_flights or other_flights");
      console.warn("Response structure:", JSON.stringify(data, null, 2).substring(0, 1000));
      
      // Try alternative structure: flights array
      if (data.flights && Array.isArray(data.flights)) {
        console.log(`  Trying alternative structure: flights array (${data.flights.length} items)`);
        for (const flight of data.flights) {
          const price = this.extractPrice(flight.price);
          if (price) {
            const flightPrice: FlightPrice = {
              price,
              currency: this.currency,
              airline: flight.airline,
              duration: flight.duration,
              stops: flight.stops,
              url: flight.flight_link || flight.url,
            };
            flights.push(flightPrice);
            if (!cheapest || price < cheapest.price) {
              cheapest = flightPrice;
            }
          }
        }
      }
    }

    console.log(`✅ Extracted ${flights.length} flights (cheapest: ${cheapest?.price || "N/A"})`);

    return {
      cheapest,
      all: flights.sort((a, b) => a.price - b.price),
      searchParams: params,
    };
  }

  private extractPrice(priceObj: any): number | null {
    if (typeof priceObj === "number") return priceObj;
    if (typeof priceObj === "string") {
      const num = parseFloat(priceObj.replace(/[^0-9.]/g, ""));
      return Number.isFinite(num) ? num : null;
    }
    if (priceObj && typeof priceObj === "object") {
      if (typeof priceObj.value === "number") return priceObj.value;
      if (typeof priceObj.price === "number") return priceObj.price;
    }
    return null;
  }
}

