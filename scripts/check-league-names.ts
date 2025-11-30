import { db } from "../db";
import { leagues, matches, matchPlayers } from "../db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Script to check what league names are actually stored in the database
 * and how many players are in each league
 */
async function checkLeagueNames() {
  console.log("=== Checking League Names in Database ===\n");

  try {
    // Get all leagues
    const allLeagues = await db.select().from(leagues);
    console.log(`Total leagues in database: ${allLeagues.length}\n`);

    if (allLeagues.length === 0) {
      console.log("No leagues found in database!");
      return;
    }

    // For each league, count matches and players
    for (const league of allLeagues) {
      const matchCount = await db
        .select({ count: sql<number>`count(*)`.as("count") })
        .from(matches)
        .where(eq(matches.leagueId, league.id));

      const playerCount = await db
        .select({ count: sql<number>`count(distinct ${matchPlayers.playerId})`.as("count") })
        .from(matchPlayers)
        .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
        .where(eq(matches.leagueId, league.id));

      console.log(`League: "${league.name}"`);
      console.log(`  - ID: ${league.id}`);
      console.log(`  - Slug: ${league.slug || "N/A"}`);
      console.log(`  - ESPN Code: ${league.espnLeagueCode || "N/A"}`);
      console.log(`  - Matches: ${Number(matchCount[0]?.count) || 0}`);
      console.log(`  - Players: ${Number(playerCount[0]?.count) || 0}`);
      console.log();
    }

    // Check for La Liga variations specifically
    console.log("\n=== Checking La Liga Variations ===");
    const laLigaVariations = ["La Liga", "Laliga", "Liga", "Spanish La Liga"];
    
    for (const variation of laLigaVariations) {
      const league = await db
        .select()
        .from(leagues)
        .where(eq(leagues.name, variation))
        .limit(1);

      if (league.length > 0) {
        const matchCount = await db
          .select({ count: sql<number>`count(*)`.as("count") })
          .from(matches)
          .where(eq(matches.leagueId, league[0].id));

        const playerCount = await db
          .select({ count: sql<number>`count(distinct ${matchPlayers.playerId})`.as("count") })
          .from(matchPlayers)
          .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
          .where(eq(matches.leagueId, league[0].id));

        console.log(`\nFound "${variation}":`);
        console.log(`  - Matches: ${Number(matchCount[0]?.count) || 0}`);
        console.log(`  - Players: ${Number(playerCount[0]?.count) || 0}`);
      } else {
        console.log(`\n"${variation}" not found in database`);
      }
    }
  } catch (error) {
    console.error("Error checking league names:", error);
    throw error;
  }
}

checkLeagueNames()
  .then(() => {
    console.log("\n✓ Check completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Error:", error);
    process.exit(1);
  });

