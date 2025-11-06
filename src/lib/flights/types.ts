export interface FlightSearchParams {
  from: string;
  to: string;
  outbound_date: string;
  return_date?: string;
  type?: "one-way" | "round-trip";
  deep_search?: boolean;
  sort_by?: number; // 2 = price
  stops?: number; // 1 = non-stop only
}

export interface FlightPrice {
  price: number;
  currency: string;
  airline?: string;
  duration?: string; // Duration in format like "5h 30m" or total minutes as string
  durationMinutes?: number; // Duration in minutes
  departureTime?: string; // Format: "YYYY-MM-DD HH:MM"
  arrivalTime?: string; // Format: "YYYY-MM-DD HH:MM"
  stops?: number;
  url?: string;
}

export interface FlightSearchResult {
  cheapest: FlightPrice | null;
  all: FlightPrice[];
  searchParams: FlightSearchParams;
}

