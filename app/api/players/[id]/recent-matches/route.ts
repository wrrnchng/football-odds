import { NextRequest, NextResponse } from "next/server";
import { getPlayerStats } from "@/lib/db/players";
import { getRecentMatches } from "@/lib/db/teams";
import { db } from "@/db";
import { players, teams, playerMatchStats } from "@/db/schema";
import { eq, and } from "drizzle-orm";

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

    // Get player's current team
    const playerStats = await getPlayerStats(playerId);
    const currentTeamId = playerStats.currentTeamId;

    if (!currentTeamId) {
      return NextResponse.json([]);
    }

    // Get the team's recent matches
    const teamMatches = await getRecentMatches(currentTeamId, 10);

    if (teamMatches.length === 0) {
      return NextResponse.json([]);
    }

    // Format matches for frontend
    const formattedMatches = await Promise.all(
      teamMatches.map(async (match) => {
        try {
          const [homeTeam] = await db
            .select()
            .from(teams)
            .where(eq(teams.id, match.homeTeamId))
            .limit(1);
          const [awayTeam] = await db
            .select()
            .from(teams)
            .where(eq(teams.id, match.awayTeamId))
            .limit(1);

          const isHome = match.homeTeamId === currentTeamId;
          const opponent = isHome ? awayTeam : homeTeam;
          const teamScore = isHome ? match.homeScore : match.awayScore;
          const opponentScore = isHome ? match.awayScore : match.homeScore;

          let result: "win" | "draw" | "loss" = "draw";
          if (teamScore !== null && opponentScore !== null) {
            if (teamScore > opponentScore) result = "win";
            else if (teamScore < opponentScore) result = "loss";
          }

          // Handle date
          let dateStr: string;
          if (match.date instanceof Date) {
            dateStr = match.date.toISOString().split("T")[0];
          } else if (typeof match.date === "number") {
            dateStr = new Date(match.date).toISOString().split("T")[0];
          } else {
            dateStr = String(match.date).split("T")[0];
          }

          // Get player's shots on target for this match
          const [playerStats] = await db
            .select({
              shotsOnTarget: playerMatchStats.shotsOnTarget,
            })
            .from(playerMatchStats)
            .where(
              and(
                eq(playerMatchStats.matchId, match.id),
                eq(playerMatchStats.playerId, playerId)
              )
            )
            .limit(1);

          return {
            id: match.id,
            opponent: opponent?.name || "Unknown",
            score: `${teamScore ?? "?"}-${opponentScore ?? "?"}`,
            result,
            date: dateStr,
            isHome,
            shotsOnTarget: playerStats?.shotsOnTarget ?? null,
          };
        } catch (matchError) {
          console.error(`Error formatting match ${match.id}:`, matchError);
          return null;
        }
      })
    );

    // Filter out any null results
    const validMatches = formattedMatches.filter((m): m is NonNullable<typeof m> => m !== null);

    return NextResponse.json(validMatches);
  } catch (error) {
    console.error("Error fetching recent matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent matches" },
      { status: 500 }
    );
  }
}

