import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { players, teams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPlayerStats } from "@/lib/db/players";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const playerId = parseInt(id);

    if (isNaN(playerId)) {
      return NextResponse.json({ error: "Invalid player ID" }, { status: 400 });
    }

    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const stats = await getPlayerStats(playerId);
    let currentTeamName: string | null = null;

    if (stats.currentTeamId) {
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, stats.currentTeamId))
        .limit(1);
      currentTeamName = team?.name || null;
    }

    return NextResponse.json({
      id: player.id,
      name: player.name,
      position: player.position,
      team: currentTeamName,
      goals: stats.goals,
      shotsOnTarget: stats.shotsOnTarget,
      appearances: stats.appearances,
      rating: 0, // TODO: Calculate from performance metrics
    });
  } catch (error) {
    console.error("Error fetching player:", error);
    return NextResponse.json(
      { error: "Failed to fetch player" },
      { status: 500 }
    );
  }
}

