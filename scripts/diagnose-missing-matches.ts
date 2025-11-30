import { db } from "../db";
import { matches, teams } from "../db/schema";
import { storeEvents } from "../lib/services/match-storage";
import { ESPNScoreboardResponse } from "../lib/types/espn";
import { eq, and, or, lt, isNotNull, desc, ne } from "drizzle-orm";

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

async function diagnoseMissingMatches() {
  console.log("=== Diagnosing Missing Matches ===\n");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(today.getDate() - 90);

  console.log(`Fetching games from ${formatDate(ninetyDaysAgo)} to ${formatDate(today)}...\n`);

  // First, fetch all games from ESPN API for the last 90 days
  const allFetchedEvents: any[] = [];
  const fetchedDates = new Set<string>();

  for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
    const targetDate = new Date(ninetyDaysAgo);
    targetDate.setDate(ninetyDaysAgo.getDate() + dayOffset);
    const dateStr = formatDate(targetDate);

    try {
      console.log(`Fetching ${dateStr}...`);
      const response = await fetchScoreboardFromESPN(dateStr);

      if (response.events && response.events.length > 0) {
        console.log(`  Found ${response.events.length} events`);
        allFetchedEvents.push(...response.events);
        fetchedDates.add(dateStr);
      }
    } catch (error) {
      console.error(`  Error fetching ${dateStr}:`, error);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\nTotal events fetched from ESPN: ${allFetchedEvents.length}`);
  console.log(`Dates with games: ${fetchedDates.size}\n`);

  // Store all fetched events
  console.log("Storing all fetched events in database...");
  await storeEvents(allFetchedEvents);
  console.log("Events stored.\n");

  // Now check what's in the database
  const now = new Date();
  const allDbMatches = await db
    .select()
    .from(matches)
    .where(lt(matches.date, now))
    .orderBy(desc(matches.date));

  console.log(`Total matches in database (past): ${allDbMatches.length}\n`);

  // Check for teams and their recent matches
  const allTeams = await db.select().from(teams);
  console.log(`Checking recent matches for ${allTeams.length} teams...\n`);

  for (const team of allTeams.slice(0, 10)) { // Check first 10 teams
    // Get all matches for this team from database
    const teamMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          or(eq(matches.homeTeamId, team.id), eq(matches.awayTeamId, team.id)),
          lt(matches.date, now)
        )
      )
      .orderBy(desc(matches.date))
      .limit(20);

    // Get what should be shown as recent matches (using the same query as the API)
    const recentMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          or(eq(matches.homeTeamId, team.id), eq(matches.awayTeamId, team.id)),
          lt(matches.date, now),
          or(
            eq(matches.status, "completed"),
            and(isNotNull(matches.homeScore), isNotNull(matches.awayScore))
          )
        )
      )
      .orderBy(desc(matches.date))
      .limit(10);

    console.log(`\n${team.name} (ID: ${team.id}):`);
    console.log(`  Total matches in DB: ${teamMatches.length}`);
    console.log(`  Recent matches (with filter): ${recentMatches.length}`);

    // Find matches that are excluded
    const excludedMatches = teamMatches.filter(
      (match) =>
        !recentMatches.some((rm) => rm.id === match.id) &&
        match.date < now
    );

    if (excludedMatches.length > 0) {
      console.log(`  ⚠️  Excluded matches: ${excludedMatches.length}`);
      excludedMatches.slice(0, 5).forEach((match) => {
        const matchDate = match.date instanceof Date 
          ? match.date.toISOString().split("T")[0]
          : new Date(match.date).toISOString().split("T")[0];
        console.log(
          `    - Match ID ${match.id} on ${matchDate}: status="${match.status}", scores=${match.homeScore}-${match.awayScore}`
        );
      });
    }
  }

  // Check for matches with scores but wrong status
  const matchesWithScoresButNotCompleted = await db
    .select()
    .from(matches)
    .where(
      and(
        lt(matches.date, now),
        isNotNull(matches.homeScore),
        isNotNull(matches.awayScore),
        ne(matches.status, "completed")
      )
    )
    .limit(20);

  console.log(`\n\nMatches with scores but status != 'completed': ${matchesWithScoresButNotCompleted.length}`);
  if (matchesWithScoresButNotCompleted.length > 0) {
    console.log("Sample matches:");
    matchesWithScoresButNotCompleted.slice(0, 5).forEach((match) => {
      const matchDate = match.date instanceof Date 
        ? match.date.toISOString().split("T")[0]
        : new Date(match.date).toISOString().split("T")[0];
      console.log(
        `  - Match ID ${match.id} on ${matchDate}: status="${match.status}", scores=${match.homeScore}-${match.awayScore}`
      );
    });
  }

  console.log("\n=== Diagnosis Complete ===");
}

diagnoseMissingMatches()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

