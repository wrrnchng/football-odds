import { db } from "@/db";
import { players, matchPlayers, matches, teams, playerMatchStats, leagues } from "@/db/schema";
import { eq, desc, and, sql, inArray, or, lt, isNotNull } from "drizzle-orm";

export async function upsertPlayer(data: {
  espnPlayerId: string;
  name: string;
  position?: string;
}) {
  const existing = await db
    .select()
    .from(players)
    .where(eq(players.espnPlayerId, data.espnPlayerId))
    .limit(1);

  if (existing.length > 0) {
    // Update if needed
    const [updated] = await db
      .update(players)
      .set({
        name: data.name,
        position: data.position,
      })
      .where(eq(players.espnPlayerId, data.espnPlayerId))
      .returning();

    return updated;
  }

  const [player] = await db
    .insert(players)
    .values({
      espnPlayerId: data.espnPlayerId,
      name: data.name,
      position: data.position,
    })
    .returning();

  return player;
}

export async function getPlayerByEspnId(espnPlayerId: string) {
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.espnPlayerId, espnPlayerId))
    .limit(1);

  return player;
}

export async function getAllPlayers() {
  return db.select().from(players);
}

export async function getPlayerStats(playerId: number) {
  // Get appearances (matches played)
  const appearances = await db
    .select()
    .from(matchPlayers)
    .where(eq(matchPlayers.playerId, playerId));

  // Get current team from most recent match
  const mostRecentMatch = await db
    .select({
      teamId: matchPlayers.teamId,
      matchDate: matches.date,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
    .where(eq(matchPlayers.playerId, playerId))
    .orderBy(desc(matches.date))
    .limit(1);

  // Get goals and shots on target from player match stats
  const stats = await db
    .select({
      goals: sql<number>`sum(${playerMatchStats.goals})`.as("goals"),
      shotsOnTarget: sql<number>`sum(${playerMatchStats.shotsOnTarget})`.as("shotsOnTarget"),
    })
    .from(playerMatchStats)
    .where(eq(playerMatchStats.playerId, playerId));

  const totalGoals = stats[0] ? Number(stats[0].goals) || 0 : 0;
  const totalShotsOnTarget = stats[0] ? Number(stats[0].shotsOnTarget) || 0 : 0;

  return {
    appearances: appearances.length,
    goals: totalGoals,
    shotsOnTarget: totalShotsOnTarget,
    currentTeamId: mostRecentMatch[0]?.teamId || null,
  };
}

export async function getPlayerRecentMatches(playerId: number, limit: number = 10) {
  const now = new Date();
  
  // Get completed matches for this player
  const completedMatches = await db
    .select({
      matchId: matchPlayers.matchId,
      teamId: matchPlayers.teamId,
      isHome: matchPlayers.isHome,
      matchDate: matches.date,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      status: matches.status,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
    .where(
      and(
        eq(matchPlayers.playerId, playerId),
        lt(matches.date, now),
        or(
          eq(matches.status, "completed"),
          and(
            isNotNull(matches.homeScore),
            isNotNull(matches.awayScore)
          )
        )
      )
    )
    .orderBy(desc(matches.date))
    .limit(limit);

  return completedMatches;
}

/**
 * Optimized function to get stats for all players in batch
 * This avoids N+1 query problems by using aggregations and JOINs
 * @param leagueFilter - Optional league name (database format) to filter players by
 */
/**
 * Get all possible database names for a display league name
 * Handles variations like "La Liga" vs "Laliga" vs "Spanish La Liga"
 */
function getLeagueNameVariations(displayLeagueName: string): string[] {
  const variations: Record<string, string[]> = {
    "Premier League": ["Premier League", "English Premier League"],
    "La Liga": ["La Liga", "Laliga", "Liga", "Spanish La Liga"],
    "Bundesliga": ["Bundesliga", "German Bundesliga"],
    "Serie A": ["Serie A", "Italian Serie A"],
    "Ligue 1": ["Ligue 1", "French Ligue 1"],
    "Ligue 2": ["Ligue 2", "French Ligue 2"],
    "Liga Professional": [
      "Liga Professional",
      "Liga Profesional",
      "Liga Profesional De Futbol",
      "Liga Profesional Argentina",
      "Torneo Clausura",
      "Argentine Liga Professional",
    ],
  };

  // Return variations for the given name, or just the name itself if no variations found
  return variations[displayLeagueName] || [displayLeagueName];
}

export async function getAllPlayersWithStats(leagueFilter?: string | null) {
  let playerIds: number[];
  let allPlayers;

  if (leagueFilter) {
    // Get all possible variations of the league name
    const leagueVariations = getLeagueNameVariations(leagueFilter);
    
    // Filter players at database level by league (checking all variations)
    // Join: matchPlayers -> matches -> leagues to find players in this league
    const playersInLeague = await db
      .select({
        playerId: matchPlayers.playerId,
      })
      .from(matchPlayers)
      .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
      .innerJoin(leagues, eq(matches.leagueId, leagues.id))
      .where(inArray(leagues.name, leagueVariations));

    // Get unique player IDs
    const uniquePlayerIds = Array.from(new Set(playersInLeague.map((p) => p.playerId)));
    playerIds = uniquePlayerIds;

    if (playerIds.length === 0) {
      return [];
    }

    // Get the actual player records
    allPlayers = await db
      .select()
      .from(players)
      .where(inArray(players.id, playerIds));
  } else {
    // Get all players if no filter
    allPlayers = await db.select().from(players);
    playerIds = allPlayers.map((p) => p.id);
  }

  if (playerIds.length === 0) {
    return [];
  }

  // Get appearance counts for all players in one query
  const appearanceCounts = await db
    .select({
      playerId: matchPlayers.playerId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(matchPlayers)
    .where(inArray(matchPlayers.playerId, playerIds))
    .groupBy(matchPlayers.playerId);

  // Create a map for quick lookup
  const appearancesMap = new Map(
    appearanceCounts.map((a) => [a.playerId, Number(a.count)])
  );

  // Get goals and shots on target for all players in one query
  const playerStats = await db
    .select({
      playerId: playerMatchStats.playerId,
      goals: sql<number>`sum(${playerMatchStats.goals})`.as("goals"),
      shotsOnTarget: sql<number>`sum(${playerMatchStats.shotsOnTarget})`.as("shotsOnTarget"),
    })
    .from(playerMatchStats)
    .where(inArray(playerMatchStats.playerId, playerIds))
    .groupBy(playerMatchStats.playerId);

  // Create maps for goals and shots on target
  const goalsMap = new Map(
    playerStats.map((s) => [s.playerId, Number(s.goals) || 0])
  );
  const shotsOnTargetMap = new Map(
    playerStats.map((s) => [s.playerId, Number(s.shotsOnTarget) || 0])
  );

  // Get most recent team and league for each player
  const mostRecentMatches = await db
    .select({
      playerId: matchPlayers.playerId,
      teamId: matchPlayers.teamId,
      leagueId: matches.leagueId,
      leagueName: leagues.name,
      matchDate: matches.date,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
    .leftJoin(leagues, eq(matches.leagueId, leagues.id))
    .where(inArray(matchPlayers.playerId, playerIds))
    .orderBy(desc(matches.date));

  // Group by player and take the first (most recent) for each
  // Since results are ordered by date DESC, first occurrence per player is most recent
  const currentTeamMap = new Map<number, number>();
  const playerLeagueMap = new Map<number, string | null>();
  for (const row of mostRecentMatches) {
    if (!currentTeamMap.has(row.playerId)) {
      currentTeamMap.set(row.playerId, row.teamId);
      playerLeagueMap.set(row.playerId, row.leagueName);
    }
  }

  // Get all unique team IDs
  const teamIds = Array.from(new Set(currentTeamMap.values()));
  
  // Get team names in one query
  let teamsMap = new Map<number, string>();
  if (teamIds.length > 0) {
    const teamRecords = await db
      .select({
        id: teams.id,
        name: teams.name,
      })
      .from(teams)
      .where(inArray(teams.id, teamIds));
    
    teamsMap = new Map(teamRecords.map((t) => [t.id, t.name]));
  }

  // Combine all data
  return allPlayers.map((player) => {
    const appearances = appearancesMap.get(player.id) || 0;
    const goals = goalsMap.get(player.id) || 0;
    const shotsOnTarget = shotsOnTargetMap.get(player.id) || 0;
    const currentTeamId = currentTeamMap.get(player.id) || null;
    const currentTeamName = currentTeamId ? teamsMap.get(currentTeamId) || null : null;
    const league = playerLeagueMap.get(player.id) || null;

    // Calculate a basic rating based on goals, shots on target, and appearances
    // Formula: Base rating of 5.0, +0.5 per goal, +0.2 per shot on target, +0.1 per appearance
    // Capped at 10.0
    let rating = 5.0;
    rating += goals * 0.5;
    rating += Math.min(shotsOnTarget * 0.2, 2.0); // Cap shots on target bonus at 2.0
    rating += Math.min(appearances * 0.1, 2.0); // Cap appearance bonus at 2.0
    rating = Math.min(rating, 10.0); // Cap at 10.0
    rating = Math.max(rating, 0.0); // Floor at 0.0

    return {
      id: player.id,
      name: player.name,
      position: player.position,
      team: currentTeamName,
      league,
      goals,
      shotsOnTarget,
      appearances,
      rating: Number(rating.toFixed(1)),
      leagueDb: league,
    };
  });
}

