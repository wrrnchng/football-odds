import { storeEvents } from "../lib/services/match-storage";
import type { ESPNScoreboardResponse } from "../lib/types/espn";

const ESPN_API_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard";

async function fetchScoreboardFromESPN(dates: string): Promise<ESPNScoreboardResponse> {
  const url = `${ESPN_API_BASE}?dates=${dates}`;
  
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

async function populateDatabase() {
  try {
    // Calculate date range for past 90 days
    const today = new Date();
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(today.getDate() - 90);

    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}${month}${day}`;
    };

    const startDate = formatDate(ninetyDaysAgo);
    const endDate = formatDate(today);
    const dates = `${startDate}-${endDate}`;

    console.log(`Fetching games from ${startDate} to ${endDate}...`);

    // Fetch games from ESPN API directly
    const response = await fetchScoreboardFromESPN(dates);

    if (!response.events || response.events.length === 0) {
      console.log("No events found for the specified date range");
      return;
    }

    console.log(`Found ${response.events.length} events. Storing in database...`);

    // Store events in database
    await storeEvents(response.events);

    console.log(`Successfully stored ${response.events.length} games in the database!`);
  } catch (error) {
    console.error("Error populating database:", error);
    process.exit(1);
  }
}

// Run the script
populateDatabase()
  .then(() => {
    console.log("Database population complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

