import { NextRequest, NextResponse } from "next/server";
import { getRecentMatches } from "@/lib/db/teams";
import { db } from "@/db";
import { teams, matchStatistics } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const teamId = parseInt(id);

    if (isNaN(teamId)) {
      return NextResponse.json({ error: "Invalid team ID" }, { status: 400 });
    }

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    console.log(`Fetching recent matches for team ID: ${teamId}`);
    const matches = await getRecentMatches(teamId, 10);
    console.log(`Found ${matches.length} recent matches`);

    if (matches.length === 0) {
      return NextResponse.json([]);
    }

    // Batch fetch all team names and match statistics in one query each
    const matchIds = matches.map(m => m.id);
    const teamIds = new Set<number>();
    matches.forEach(m => {
      teamIds.add(m.homeTeamId);
      teamIds.add(m.awayTeamId);
    });

    // Get all teams in one query
    const allTeams = await db
      .select()
      .from(teams)
      .where(inArray(teams.id, Array.from(teamIds)));
    const teamsMap = new Map(allTeams.map(t => [t.id, t]));

    // Get all match statistics in one query
    const allMatchStats = await db
      .select({
        matchId: matchStatistics.matchId,
        teamId: matchStatistics.teamId,
        shotsOnTarget: matchStatistics.shotsOnTarget,
        corners: matchStatistics.corners,
        yellowCards: matchStatistics.yellowCards,
        redCards: matchStatistics.redCards,
      })
      .from(matchStatistics)
      .where(
        and(
          inArray(matchStatistics.matchId, matchIds),
          eq(matchStatistics.teamId, teamId)
        )
      );
    const statsMap = new Map(allMatchStats.map(s => [s.matchId, s]));

    // Format matches for frontend
    const formattedMatches = matches.map((match) => {
      try {
        const homeTeam = teamsMap.get(match.homeTeamId);
        const awayTeam = teamsMap.get(match.awayTeamId);

        const isHome = match.homeTeamId === teamId;
        const opponent = isHome ? awayTeam : homeTeam;
        const teamScore = isHome ? match.homeScore : match.awayScore;
        const opponentScore = isHome ? match.awayScore : match.homeScore;

        let result: "win" | "draw" | "loss" = "draw";
        if (teamScore !== null && opponentScore !== null) {
          if (teamScore > opponentScore) result = "win";
          else if (teamScore < opponentScore) result = "loss";
        }

        // Handle date - it might be a Date object or timestamp
        let dateStr: string;
        if (match.date instanceof Date) {
          dateStr = match.date.toISOString().split("T")[0];
        } else if (typeof match.date === "number") {
          dateStr = new Date(match.date).toISOString().split("T")[0];
        } else {
          dateStr = String(match.date).split("T")[0];
        }

        // Get match statistics from map
        const teamStats = statsMap.get(match.id);

        return {
          id: match.id,
          opponent: opponent?.name || "Unknown",
          score: `${teamScore ?? "?"}-${opponentScore ?? "?"}`,
          result,
          date: dateStr,
          isHome,
          shotsOnTarget: teamStats?.shotsOnTarget ?? null,
          corners: teamStats?.corners ?? null,
          yellowCards: teamStats?.yellowCards ?? null,
          redCards: teamStats?.redCards ?? null,
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
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json(
      { 
        error: "Failed to fetch recent matches",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

