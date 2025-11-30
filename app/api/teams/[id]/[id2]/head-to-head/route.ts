import { NextRequest, NextResponse } from "next/server";
import { getHeadToHead } from "@/lib/db/teams";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; id2: string }> }
) {
  try {
    const { id, id2 } = await params;
    const team1Id = parseInt(id);
    const team2Id = parseInt(id2);

    if (isNaN(team1Id) || isNaN(team2Id)) {
      return NextResponse.json({ error: "Invalid team IDs" }, { status: 400 });
    }

    const [team1] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, team1Id))
      .limit(1);
    const [team2] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, team2Id))
      .limit(1);

    if (!team1 || !team2) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const h2h = await getHeadToHead(team1Id, team2Id);

    // Format matches for response
    const formattedMatches = h2h.matches.map((match) => {
      const date = match.date instanceof Date
        ? match.date
        : new Date(match.date);
      const dateStr = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      return {
        id: match.id,
        date: dateStr,
        homeTeam: match.team1IsHome ? team1.name : team2.name,
        awayTeam: match.team1IsHome ? team2.name : team1.name,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        team1Score: match.team1Score,
        team2Score: match.team2Score,
        team1IsHome: match.team1IsHome,
      };
    });

    return NextResponse.json({
      team1Wins: h2h.team1Wins,
      team2Wins: h2h.team2Wins,
      draws: h2h.draws,
      matches: formattedMatches,
    });
  } catch (error) {
    console.error("Error fetching head-to-head:", error);
    return NextResponse.json(
      { error: "Failed to fetch head-to-head" },
      { status: 500 }
    );
  }
}

