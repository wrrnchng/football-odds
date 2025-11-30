/**
 * Diagnostic script to inspect ESPN API response structure for player statistics
 * This helps understand how individual player shots on target are provided
 */

import type { ESPNScoreboardResponse, ESPNEvent } from "../lib/types/espn";

const ESPN_API_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard";

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

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function inspectPlayerStats() {
  try {
    console.log("Fetching a recent completed match to inspect player statistics...\n");
    
    // Fetch events from yesterday (more likely to have completed matches with stats)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = formatDate(yesterday);
    
    const response = await fetchScoreboardFromESPN(dateStr);
    const events: ESPNEvent[] = response.events || [];
    
    if (events.length === 0) {
      console.log("No events found for yesterday. Trying today...");
      const today = formatDate(new Date());
      const todayResponse = await fetchScoreboardFromESPN(today);
      const todayEvents: ESPNEvent[] = todayResponse.events || [];
      
      if (todayEvents.length === 0) {
        console.log("No events found. Try fetching past games first.");
        return;
      }
      
      events.push(...todayEvents);
    }

    // Find a completed match with statistics
    const completedEvent = events.find(
      (event) =>
        event.competitions?.[0]?.status?.type?.completed &&
        event.competitions?.[0]?.competitors?.[0]?.statistics
    );

    if (!completedEvent) {
      console.log("No completed match with statistics found.");
      return;
    }

    const competition = completedEvent.competitions[0];
    console.log(`Match: ${competition.competitors[0]?.team?.displayName} vs ${competition.competitors[1]?.team?.displayName}\n`);

    // Inspect statistics for each team
    for (const competitor of competition.competitors) {
      console.log(`\n=== ${competitor.team?.displayName} Statistics ===`);
      
      if (!competitor.statistics) {
        console.log("No statistics available");
        continue;
      }

      // Look for shots on target statistic
      const shotsOnTargetStat = competitor.statistics.find(
        (stat) =>
          stat.name?.toLowerCase().includes("shot") &&
          stat.name?.toLowerCase().includes("target") ||
          stat.abbreviation?.toLowerCase().includes("sot")
      );

      if (shotsOnTargetStat) {
        console.log(`\nFound "Shots on Target" statistic:`);
        console.log(`  Name: ${shotsOnTargetStat.name}`);
        console.log(`  Abbreviation: ${shotsOnTargetStat.abbreviation}`);
        console.log(`  Display Value (Team Total): ${shotsOnTargetStat.displayValue}`);
        console.log(`  Athletes Count: ${shotsOnTargetStat.athletes?.length || 0}`);

        if (shotsOnTargetStat.athletes && shotsOnTargetStat.athletes.length > 0) {
          console.log(`\n  First 5 Players in Shots on Target list:`);
          shotsOnTargetStat.athletes.slice(0, 5).forEach((athlete, index) => {
            console.log(`    ${index + 1}. ${athlete.displayName}`);
            console.log(`       - ID: ${athlete.id}`);
            console.log(`       - Position: ${athlete.position || "N/A"}`);
            console.log(`       - Value: ${(athlete as any).value ?? "N/A"}`);
            console.log(`       - Stat: ${(athlete as any).stat ?? "N/A"}`);
            console.log(`       - DisplayValue: ${(athlete as any).displayValue ?? "N/A"}`);
            console.log(`       - Full object keys: ${Object.keys(athlete).join(", ")}`);
          });
        }
      } else {
        console.log("\nNo 'Shots on Target' statistic found in this match.");
      }

      // Show all available statistics
      console.log(`\nAll available statistics (${competitor.statistics.length}):`);
      competitor.statistics.forEach((stat) => {
        console.log(`  - ${stat.name} (${stat.abbreviation}): ${stat.displayValue}`);
        if (stat.athletes && stat.athletes.length > 0) {
          console.log(`    Has ${stat.athletes.length} athletes`);
        }
      });
    }
  } catch (error) {
    console.error("Error inspecting player stats:", error);
  }
}

inspectPlayerStats()
  .then(() => {
    console.log("\n✓ Inspection complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Error:", error);
    process.exit(1);
  });

