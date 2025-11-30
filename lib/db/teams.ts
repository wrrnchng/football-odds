import { db } from "@/db";
import { teams, matches, matchPlayers, matchStatistics } from "@/db/schema";
import { eq, and, or, desc, lt, isNotNull, sql } from "drizzle-orm";

export async function upsertTeam(data: {
  espnTeamId: string;
  name: string;
  abbreviation?: string;
  logoUrl?: string;
}) {
  const existing = await db
    .select()
    .from(teams)
    .where(eq(teams.espnTeamId, data.espnTeamId))
    .limit(1);

  if (existing.length > 0) {
    // Update if needed
    const [updated] = await db
      .update(teams)
      .set({
        name: data.name,
        abbreviation: data.abbreviation,
        logoUrl: data.logoUrl,
      })
      .where(eq(teams.espnTeamId, data.espnTeamId))
      .returning();

    return updated;
  }

  const [team] = await db
    .insert(teams)
    .values({
      espnTeamId: data.espnTeamId,
      name: data.name,
      abbreviation: data.abbreviation,
      logoUrl: data.logoUrl,
    })
    .returning();

  return team;
}

export async function getTeamByEspnId(espnTeamId: string) {
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.espnTeamId, espnTeamId))
    .limit(1);

  return team;
}

export async function getAllTeams() {
  return db.select().from(teams);
}

export async function getTeamStats(teamId: number) {
  const teamMatches = await db
    .select()
    .from(matches)
    .where(
      or(
        eq(matches.homeTeamId, teamId),
        eq(matches.awayTeamId, teamId)
      )
    );

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsScored = 0;
  let goalsConceded = 0;

  for (const match of teamMatches) {
    if (match.status !== "completed" || match.homeScore === null || match.awayScore === null) {
      continue;
    }

    const isHome = match.homeTeamId === teamId;
    const teamScore = isHome ? match.homeScore : match.awayScore;
    const opponentScore = isHome ? match.awayScore : match.homeScore;

    goalsScored += teamScore;
    goalsConceded += opponentScore;

    if (teamScore > opponentScore) {
      wins++;
    } else if (teamScore === opponentScore) {
      draws++;
    } else {
      losses++;
    }
  }

  const points = wins * 3 + draws;

  // Get aggregated shots on target and corners from match statistics
  const matchStats = await db
    .select({
      shotsOnTarget: sql<number>`sum(${matchStatistics.shotsOnTarget})`.as("shotsOnTarget"),
      corners: sql<number>`sum(${matchStatistics.corners})`.as("corners"),
    })
    .from(matchStatistics)
    .where(eq(matchStatistics.teamId, teamId));

  const totalShotsOnTarget = matchStats[0] ? Number(matchStats[0].shotsOnTarget) || 0 : 0;
  const totalCorners = matchStats[0] ? Number(matchStats[0].corners) || 0 : 0;

  return {
    wins,
    draws,
    losses,
    goalsScored,
    goalsConceded,
    points,
    shotsOnTarget: totalShotsOnTarget,
    corners: totalCorners,
  };
}

export async function getRecentMatches(teamId: number, limit: number = 10) {
  const now = new Date();
  
  // Get completed matches that have already happened (date < now)
  // A match is considered completed if:
  // 1. Status is "completed" (show regardless of scores), OR
  // 2. Both scores are set (even if status isn't "completed" - ESPN API sometimes doesn't mark them as completed)
  // This ensures we catch all completed matches even if ESPN API status is inconsistent
  const completedMatches = await db
    .select()
    .from(matches)
    .where(
      and(
        or(
          eq(matches.homeTeamId, teamId),
          eq(matches.awayTeamId, teamId)
        ),
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

export async function getHeadToHead(team1Id: number, team2Id: number) {
  const now = new Date();
  const h2hMatches = await db
    .select()
    .from(matches)
    .where(
      and(
        or(
          and(eq(matches.homeTeamId, team1Id), eq(matches.awayTeamId, team2Id)),
          and(eq(matches.homeTeamId, team2Id), eq(matches.awayTeamId, team1Id))
        ),
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
    .limit(5); // Get last 5 matches

  let team1Wins = 0;
  let team2Wins = 0;
  let draws = 0;

  const matchDetails = [];

  for (const match of h2hMatches) {
    if (match.homeScore === null || match.awayScore === null) continue;

    const team1IsHome = match.homeTeamId === team1Id;
    const team1Score = team1IsHome ? match.homeScore : match.awayScore;
    const team2Score = team1IsHome ? match.awayScore : match.homeScore;

    if (team1Score > team2Score) {
      team1Wins++;
    } else if (team2Score > team1Score) {
      team2Wins++;
    } else {
      draws++;
    }

    // Store match details for the last 5 matches
    matchDetails.push({
      id: match.id,
      date: match.date,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      team1IsHome,
      team1Score,
      team2Score,
    });
  }

  return {
    team1Wins,
    team2Wins,
    draws,
    matches: matchDetails,
  };
}

