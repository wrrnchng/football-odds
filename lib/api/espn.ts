import { ESPNScoreboardResponse } from "@/lib/types/espn";

const API_BASE = "/api/espn/scoreboard";

export interface FetchScoreboardOptions {
  dates?: string; // YYYYMMDD or YYYYMMDD-YYYYMMDD
}

/**
 * Fetch scoreboard data from ESPN API via Next.js proxy
 */
export async function fetchScoreboard(
  options: FetchScoreboardOptions = {}
): Promise<ESPNScoreboardResponse> {
  const params = new URLSearchParams();
  if (options.dates) {
    params.append("dates", options.dates);
  }

  const url = `${API_BASE}${params.toString() ? `?${params.toString()}` : ""}`;

  const response = await fetch(url, {
    cache: "no-store", // Always fetch fresh data
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch scoreboard: ${response.statusText}`);
  }

  return response.json();
}

