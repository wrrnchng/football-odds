import { db } from "../db";
import { teams, matches, leagues } from "../db/schema";
import { eq, or, desc, sql } from "drizzle-orm";

async function checkTeamLeagues() {
  console.log("=== Checking Team Leagues ===\n");

  // Find Barracas Central (try exact match first, then partial)
  let barracasCentral = await db
    .select()
    .from(teams)
    .where(eq(teams.name, "Barracas Central"))
    .limit(1);

  if (barracasCentral.length === 0) {
    // Try case-insensitive search
    barracasCentral = await db
      .select()
      .from(teams)
      .where(sql`LOWER(${teams.name}) LIKE LOWER('%Barracas%')`)
      .limit(5);
  }

  if (barracasCentral.length > 0) {
    const team = barracasCentral[0];
    console.log(`Found team: ${team.name} (ID: ${team.id})`);

    // Get matches for this team
    const teamMatches = await db
      .select({
        leagueId: matches.leagueId,
        leagueName: leagues.name,
        matchDate: matches.date,
      })
      .from(matches)
      .leftJoin(leagues, eq(matches.leagueId, leagues.id))
      .where(
        or(
          eq(matches.homeTeamId, team.id),
          eq(matches.awayTeamId, team.id)
        )
      )
      .orderBy(desc(matches.date))
      .limit(10);

    console.log(`\nRecent matches and leagues:`);
    const leagueCounts = new Map<string, number>();
    teamMatches.forEach((match) => {
      const leagueName = match.leagueName || "Unknown";
      leagueCounts.set(leagueName, (leagueCounts.get(leagueName) || 0) + 1);
      const dateStr = match.matchDate instanceof Date
        ? match.matchDate.toISOString().split("T")[0]
        : new Date(match.matchDate).toISOString().split("T")[0];
      console.log(`  - ${dateStr}: ${leagueName}`);
    });

    console.log(`\nLeague frequency:`);
    leagueCounts.forEach((count, league) => {
      console.log(`  - ${league}: ${count} matches`);
    });
  } else {
    console.log("Barracas Central not found in database");
  }

  console.log("\n" + "=".repeat(50) + "\n");

  // Find PSV Eindhoven (try exact match first, then partial)
  let psvEindhoven = await db
    .select()
    .from(teams)
    .where(eq(teams.name, "PSV Eindhoven"))
    .limit(1);

  if (psvEindhoven.length === 0) {
    // Try case-insensitive search
    psvEindhoven = await db
      .select()
      .from(teams)
      .where(sql`LOWER(${teams.name}) LIKE LOWER('%PSV%')`)
      .limit(5);
  }

  if (psvEindhoven.length > 0) {
    const team = psvEindhoven[0];
    console.log(`Found team: ${team.name} (ID: ${team.id})`);

    // Get matches for this team
    const teamMatches = await db
      .select({
        leagueId: matches.leagueId,
        leagueName: leagues.name,
        matchDate: matches.date,
      })
      .from(matches)
      .leftJoin(leagues, eq(matches.leagueId, leagues.id))
      .where(
        or(
          eq(matches.homeTeamId, team.id),
          eq(matches.awayTeamId, team.id)
        )
      )
      .orderBy(desc(matches.date))
      .limit(10);

    console.log(`\nRecent matches and leagues:`);
    const leagueCounts = new Map<string, number>();
    teamMatches.forEach((match) => {
      const leagueName = match.leagueName || "Unknown";
      leagueCounts.set(leagueName, (leagueCounts.get(leagueName) || 0) + 1);
      const dateStr = match.matchDate instanceof Date
        ? match.matchDate.toISOString().split("T")[0]
        : new Date(match.matchDate).toISOString().split("T")[0];
      console.log(`  - ${dateStr}: ${leagueName}`);
    });

    console.log(`\nLeague frequency:`);
    leagueCounts.forEach((count, league) => {
      console.log(`  - ${league}: ${count} matches`);
    });
  } else {
    console.log("PSV Eindhoven not found in database");
  }

  console.log("\n=== Check Complete ===");
}

checkTeamLeagues()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

