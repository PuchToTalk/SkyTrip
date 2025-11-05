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

    // Set trip type: only include if round-trip
    if (params.type === "round-trip") {
      searchParams.set("type", "1");
      if (params.return_date) {
        searchParams.set("return_date", params.return_date);
      }
    }
    // For one-way, don't include type parameter

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
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `SerpApi error: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // If not JSON, use the text
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Parse SerpApi response
    const flights: FlightPrice[] = [];
    let cheapest: FlightPrice | null = null;

    // SerpApi Google Flights response structure
    if (data.best_flights && Array.isArray(data.best_flights)) {
      for (const flight of data.best_flights) {
        const price = this.extractPrice(flight.price);
        if (price) {
          const flightPrice: FlightPrice = {
            price,
            currency: this.currency,
            airline: flight.airline,
            duration: flight.duration,
            stops: flight.stops,
            url: flight.flight_link,
          };
          flights.push(flightPrice);
          if (!cheapest || price < cheapest.price) {
            cheapest = flightPrice;
          }
        }
      }
    }

    // Also check other_flights if available
    if (data.other_flights && Array.isArray(data.other_flights)) {
      for (const flight of data.other_flights) {
        const price = this.extractPrice(flight.price);
        if (price) {
          const flightPrice: FlightPrice = {
            price,
            currency: this.currency,
            airline: flight.airline,
            duration: flight.duration,
            stops: flight.stops,
            url: flight.flight_link,
          };
          flights.push(flightPrice);
          if (!cheapest || price < cheapest.price) {
            cheapest = flightPrice;
          }
        }
      }
    }

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

