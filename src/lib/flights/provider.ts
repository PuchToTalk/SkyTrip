import type { FlightSearchParams, FlightSearchResult } from "./types";

export interface FlightProvider {
  search(params: FlightSearchParams): Promise<FlightSearchResult>;
}

