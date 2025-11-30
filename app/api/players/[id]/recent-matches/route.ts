import { NextRequest, NextResponse } from "next/server";
import { getPlayerStats } from "@/lib/db/players";
import { getRecentMatches } from "@/lib/db/teams";
import { db } from "@/db";
import { players, teams, playerMatchStats, matchPlayers } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

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

    // Batch fetch all teams and player stats in one query each
    const matchIds = teamMatches.map(m => m.id);
    const teamIds = new Set<number>();
    teamMatches.forEach(m => {
      teamIds.add(m.homeTeamId);
      teamIds.add(m.awayTeamId);
    });

    // Get all teams in one query
    const allTeams = await db
      .select()
      .from(teams)
      .where(inArray(teams.id, Array.from(teamIds)));
    const teamsMap = new Map(allTeams.map(t => [t.id, t]));

    // Get all player match stats in one query
    const allPlayerStats = await db
      .select({
        matchId: playerMatchStats.matchId,
        goals: playerMatchStats.goals,
        shotsOnTarget: playerMatchStats.shotsOnTarget,
        assists: playerMatchStats.assists,
        passes: playerMatchStats.passes,
        passesCompleted: playerMatchStats.passesCompleted,
        tackles: playerMatchStats.tackles,
        interceptions: playerMatchStats.interceptions,
        saves: playerMatchStats.saves,
        yellowCards: playerMatchStats.yellowCards,
        redCards: playerMatchStats.redCards,
      })
      .from(playerMatchStats)
      .where(
        and(
          inArray(playerMatchStats.matchId, matchIds),
          eq(playerMatchStats.playerId, playerId)
        )
      );
    const playerStatsMap = new Map(allPlayerStats.map(s => [s.matchId, s]));

    // Get all matches where player actually played (to filter out matches they didn't play in)
    const playerMatches = await db
      .select({
        matchId: matchPlayers.matchId,
      })
      .from(matchPlayers)
      .where(
        and(
          inArray(matchPlayers.matchId, matchIds),
          eq(matchPlayers.playerId, playerId)
        )
      );
    const playerMatchIds = new Set(playerMatches.map(m => m.matchId));

    // Format matches for frontend - only include matches where player actually played
    const formattedMatches = teamMatches
      .filter(match => playerMatchIds.has(match.id)) // Only show matches where player played
      .map((match) => {
        try {
          const homeTeam = teamsMap.get(match.homeTeamId);
          const awayTeam = teamsMap.get(match.awayTeamId);

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

          // Get player's stats from map
          // If player played but has no stats record, default to 0
          const playerStats = playerStatsMap.get(match.id);

          return {
            id: match.id,
            opponent: opponent?.name || "Unknown",
            score: `${teamScore ?? "?"}-${opponentScore ?? "?"}`,
            result,
            date: dateStr,
            isHome,
            goals: playerStats ? (playerStats.goals ?? 0) : 0,
            shotsOnTarget: playerStats ? (playerStats.shotsOnTarget ?? 0) : 0,
            assists: playerStats ? (playerStats.assists ?? 0) : 0,
            passes: playerStats ? (playerStats.passes ?? 0) : 0,
            passesCompleted: playerStats ? (playerStats.passesCompleted ?? 0) : 0,
            tackles: playerStats ? (playerStats.tackles ?? 0) : 0,
            interceptions: playerStats ? (playerStats.interceptions ?? 0) : 0,
            saves: playerStats ? (playerStats.saves ?? 0) : 0,
            yellowCards: playerStats ? (playerStats.yellowCards ?? 0) : 0,
            redCards: playerStats ? (playerStats.redCards ?? 0) : 0,
          };
        } catch (matchError) {
          console.error(`Error formatting match ${match.id}:`, matchError);
          return null;
        }
      });

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

