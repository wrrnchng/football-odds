import { NextResponse } from "next/server";
import { getAllPlayers, getPlayerStats } from "@/lib/db/players";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const players = await getAllPlayers();

    // Get stats for each player
    const playersWithStats = await Promise.all(
      players.map(async (player) => {
        const stats = await getPlayerStats(player.id);
        let currentTeamName: string | null = null;

        if (stats.currentTeamId) {
          const [team] = await db
            .select()
            .from(teams)
            .where(eq(teams.id, stats.currentTeamId))
            .limit(1);
          currentTeamName = team?.name || null;
        }

        return {
          id: player.id,
          name: player.name,
          position: player.position,
          team: currentTeamName,
          goals: stats.goals,
          assists: stats.assists,
          appearances: stats.appearances,
          rating: 0, // TODO: Calculate from performance metrics
        };
      })
    );

    return NextResponse.json(playersWithStats);
  } catch (error) {
    console.error("Error fetching players:", error);
    return NextResponse.json(
      { error: "Failed to fetch players" },
      { status: 500 }
    );
  }
}

