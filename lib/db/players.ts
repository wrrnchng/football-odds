import { db } from "@/db";
import { players, matchPlayers, matches } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

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

  // TODO: Extract goals and assists from match details
  // This would require parsing the match details/statistics
  // For now, return basic stats
  return {
    appearances: appearances.length,
    goals: 0, // To be populated from match details
    assists: 0, // To be populated from match details
    currentTeamId: mostRecentMatch[0]?.teamId || null,
  };
}

