import { storeEvents } from "@/lib/services/match-storage";
import { getLatestMatchDate } from "@/lib/db/matches";
import { ESPNScoreboardResponse } from "@/lib/types/espn";

const ESPN_API_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard";

/**
 * Fetch scoreboard data directly from ESPN API (server-side)
 */
async function fetchScoreboardFromESPN(dates?: string): Promise<ESPNScoreboardResponse> {
  let url = ESPN_API_BASE;
  if (dates) {
    url += `?dates=${dates}`;
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    throw new Error(`ESPN API returned ${response.status}`);
  }

  return response.json();
}

/**
 * Format date to YYYYMMDD format for ESPN API
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Fetch upcoming games for today + next 7 days
 * Fetches each day individually to ensure all leagues are included
 */
export async function fetchUpcomingGames(): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let totalEvents = 0;
    
    // Fetch each day individually (today through day+7)
    for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + dayOffset);
      
      const dateStr = formatDate(targetDate);
      console.log(`[Auto-fetch] Fetching upcoming games for ${dateStr}...`);

      try {
        const response = await fetchScoreboardFromESPN(dateStr);

        if (response.events && response.events.length > 0) {
          console.log(`[Auto-fetch] Found ${response.events.length} events for ${dateStr}. Storing...`);
          await storeEvents(response.events);
          totalEvents += response.events.length;
        } else {
          console.log(`[Auto-fetch] No events found for ${dateStr}`);
        }
      } catch (error) {
        console.error(`[Auto-fetch] Error fetching games for ${dateStr}:`, error);
        // Continue with next day even if one fails
      }
      
      // Small delay to avoid rate limiting
      if (dayOffset < 7) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[Auto-fetch] Successfully stored ${totalEvents} upcoming games across 8 days`);
  } catch (error) {
    console.error("[Auto-fetch] Error fetching upcoming games:", error);
    throw error;
  }
}

/**
 * Fetch past games from the latest game date in database up to today
 * Fetches each day individually to ensure all leagues are included
 */
export async function fetchPastGames(): Promise<void> {
  try {
    const latestMatchDate = await getLatestMatchDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day

    let startDate: Date;

    if (!latestMatchDate) {
      // No matches in database, fetch last 90 days
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 90);
      console.log("[Auto-fetch] No existing matches found. Fetching past 90 days...");
    } else {
      // Start from day after latest match
      startDate = new Date(latestMatchDate);
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(0, 0, 0, 0);

      // If latest match is today or in the future, no past games to fetch
      if (startDate > today) {
        console.log("[Auto-fetch] Latest match is today or in the future. No past games to fetch.");
        return;
      }

      console.log(
        `[Auto-fetch] Latest match date: ${latestMatchDate.toISOString()}. Fetching from ${startDate.toISOString()} to today...`
      );
    }

    // Calculate number of days to fetch
    const daysDiff = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 0) {
      console.log("[Auto-fetch] No days to fetch for past games");
      return;
    }

    let totalEvents = 0;
    const maxDays = Math.min(daysDiff, 90); // Limit to 90 days max to avoid too many requests

    // Fetch each day individually
    for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
      const targetDate = new Date(startDate);
      targetDate.setDate(startDate.getDate() + dayOffset);
      
      // Stop if we've reached today
      if (targetDate > today) {
        break;
      }

      const dateStr = formatDate(targetDate);
      console.log(`[Auto-fetch] Fetching past games for ${dateStr}...`);

      try {
        const response = await fetchScoreboardFromESPN(dateStr);

        if (response.events && response.events.length > 0) {
          console.log(`[Auto-fetch] Found ${response.events.length} events for ${dateStr}. Storing...`);
          await storeEvents(response.events);
          totalEvents += response.events.length;
        } else {
          console.log(`[Auto-fetch] No events found for ${dateStr}`);
        }
      } catch (error) {
        console.error(`[Auto-fetch] Error fetching games for ${dateStr}:`, error);
        // Continue with next day even if one fails
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`[Auto-fetch] Successfully stored ${totalEvents} past games`);
  } catch (error) {
    console.error("[Auto-fetch] Error fetching past games:", error);
    throw error;
  }
}

/**
 * Fetch all games on server startup (upcoming + past)
 * Runs synchronously and blocks until complete
 */
export async function fetchAllGamesOnStartup(): Promise<void> {
  console.log("[Auto-fetch] Starting automatic game fetch on server startup...");

  try {
    // Fetch past games first, then upcoming games
    await fetchPastGames();
    await fetchUpcomingGames();

    console.log("[Auto-fetch] Automatic game fetch completed successfully");
  } catch (error) {
    console.error("[Auto-fetch] Error during automatic game fetch:", error);
    // Don't throw - allow server to start even if fetch fails
  }
}

