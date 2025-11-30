import { db } from "@/db";
import { matches, matchPlayers, matchOdds, matchStatistics, playerMatchStats } from "@/db/schema";
import { eq, and, or, desc, gte, lte } from "drizzle-orm";

export async function upsertMatch(data: {
  espnEventId: string;
  leagueId: number | null;
  homeTeamId: number;
  awayTeamId: number;
  date: Date;
  venue?: string;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
}) {
  const existing = await db
    .select()
    .from(matches)
    .where(eq(matches.espnEventId, data.espnEventId))
    .limit(1);

  if (existing.length > 0) {
    // Update existing match
    const [updated] = await db
      .update(matches)
      .set({
        leagueId: data.leagueId,
        homeTeamId: data.homeTeamId,
        awayTeamId: data.awayTeamId,
        date: data.date,
        venue: data.venue,
        status: data.status,
        homeScore: data.homeScore,
        awayScore: data.awayScore,
      })
      .where(eq(matches.espnEventId, data.espnEventId))
      .returning();

    return updated;
  }

  const [match] = await db
    .insert(matches)
    .values({
      espnEventId: data.espnEventId,
      leagueId: data.leagueId,
      homeTeamId: data.homeTeamId,
      awayTeamId: data.awayTeamId,
      date: data.date,
      venue: data.venue,
      status: data.status,
      homeScore: data.homeScore,
      awayScore: data.awayScore,
    })
    .returning();

  return match;
}

export async function getMatchByEspnEventId(espnEventId: string) {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.espnEventId, espnEventId))
    .limit(1);

  return match;
}

export async function getUpcomingMatches() {
  const now = new Date();
  return db
    .select()
    .from(matches)
    .where(
      and(
        gte(matches.date, now),
        or(
          eq(matches.status, "scheduled"),
          eq(matches.status, "upcoming")
        )
      )
    )
    .orderBy(matches.date);
}

/**
 * Get the most recent match date from the database
 * Returns null if no matches exist
 */
export async function getLatestMatchDate(): Promise<Date | null> {
  const [latestMatch] = await db
    .select({ date: matches.date })
    .from(matches)
    .orderBy(desc(matches.date))
    .limit(1);

  return latestMatch?.date || null;
}

export async function insertMatchPlayer(data: {
  matchId: number;
  playerId: number;
  teamId: number;
  isHome: boolean;
}) {
  // Check if already exists
  const existing = await db
    .select()
    .from(matchPlayers)
    .where(
      and(
        eq(matchPlayers.matchId, data.matchId),
        eq(matchPlayers.playerId, data.playerId),
        eq(matchPlayers.teamId, data.teamId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const [matchPlayer] = await db
    .insert(matchPlayers)
    .values({
      matchId: data.matchId,
      playerId: data.playerId,
      teamId: data.teamId,
      isHome: data.isHome,
    })
    .returning();

  return matchPlayer;
}

export async function insertMatchOdds(data: {
  matchId: number;
  homeOdds?: number | null;
  drawOdds?: number | null;
  awayOdds?: number | null;
  provider?: string;
}) {
  const [odds] = await db
    .insert(matchOdds)
    .values({
      matchId: data.matchId,
      homeOdds: data.homeOdds,
      drawOdds: data.drawOdds,
      awayOdds: data.awayOdds,
      provider: data.provider,
    })
    .returning();

  return odds;
}

export async function insertMatchStatistics(data: {
  matchId: number;
  teamId: number;
  possession?: number | null;
  shots?: number | null;
  shotsOnTarget?: number | null;
  corners?: number | null;
  fouls?: number | null;
  yellowCards?: number | null;
  redCards?: number | null;
}) {
  const [stats] = await db
    .insert(matchStatistics)
    .values({
      matchId: data.matchId,
      teamId: data.teamId,
      possession: data.possession,
      shots: data.shots,
      shotsOnTarget: data.shotsOnTarget,
      corners: data.corners,
      fouls: data.fouls,
      yellowCards: data.yellowCards ?? 0,
      redCards: data.redCards ?? 0,
    })
    .returning();

  return stats;
}

export async function upsertPlayerMatchStats(data: {
  matchId: number;
  playerId: number;
  teamId: number;
  goals?: number;
  shotsOnTarget?: number;
  assists?: number;
  passes?: number;
  passesCompleted?: number;
  tackles?: number;
  interceptions?: number;
  saves?: number;
  yellowCards?: number;
  redCards?: number;
}) {
  // Check if already exists
  const existing = await db
    .select()
    .from(playerMatchStats)
    .where(
      and(
        eq(playerMatchStats.matchId, data.matchId),
        eq(playerMatchStats.playerId, data.playerId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing stats - REPLACE values, don't accumulate (per-match stats)
    const [updated] = await db
      .update(playerMatchStats)
      .set({
        goals: data.goals !== undefined ? data.goals : (existing[0].goals || 0),
        shotsOnTarget: data.shotsOnTarget !== undefined 
          ? data.shotsOnTarget 
          : (existing[0].shotsOnTarget || 0),
        assists: data.assists !== undefined ? data.assists : (existing[0].assists || 0),
        passes: data.passes !== undefined ? data.passes : (existing[0].passes || 0),
        passesCompleted: data.passesCompleted !== undefined ? data.passesCompleted : (existing[0].passesCompleted || 0),
        tackles: data.tackles !== undefined ? data.tackles : (existing[0].tackles || 0),
        interceptions: data.interceptions !== undefined ? data.interceptions : (existing[0].interceptions || 0),
        saves: data.saves !== undefined ? data.saves : (existing[0].saves || 0),
        yellowCards: data.yellowCards !== undefined ? data.yellowCards : (existing[0].yellowCards || 0),
        redCards: data.redCards !== undefined ? data.redCards : (existing[0].redCards || 0),
      })
      .where(
        and(
          eq(playerMatchStats.matchId, data.matchId),
          eq(playerMatchStats.playerId, data.playerId)
        )
      )
      .returning();

    return updated;
  }

  // Insert new stats
  const [stats] = await db
    .insert(playerMatchStats)
    .values({
      matchId: data.matchId,
      playerId: data.playerId,
      teamId: data.teamId,
      goals: data.goals || 0,
      shotsOnTarget: data.shotsOnTarget || 0,
      assists: data.assists || 0,
      passes: data.passes || 0,
      passesCompleted: data.passesCompleted || 0,
      tackles: data.tackles || 0,
      interceptions: data.interceptions || 0,
      saves: data.saves || 0,
      yellowCards: data.yellowCards || 0,
      redCards: data.redCards || 0,
    })
    .returning();

  return stats;
}

