import { NextResponse } from "next/server";
import { getAllTeams, getTeamStats } from "@/lib/db/teams";
import { db } from "@/db";
import { matches, leagues } from "@/db/schema";
import { eq, or, desc } from "drizzle-orm";

// Map database league names to display names with countries
// This handles various possible database names and maps them to display format
const leagueNameMapping: Record<string, string> = {
  "Premier League": "Premier League (England)",
  "English Premier League": "Premier League (England)",
  "La Liga": "La Liga (Spain)",
  "Laliga": "La Liga (Spain)",
  "Liga": "La Liga (Spain)",
  "Spanish La Liga": "La Liga (Spain)",
  "Bundesliga": "Bundesliga (Germany)",
  "German Bundesliga": "Bundesliga (Germany)",
  "Serie A": "Serie A (Italy)",
  "Italian Serie A": "Serie A (Italy)",
  "Ligue 1": "Ligue 1 (France)",
  "French Ligue 1": "Ligue 1 (France)",
  "Ligue 2": "Ligue 2 (France)",
  "French Ligue 2": "Ligue 2 (France)",
  "Liga Professional": "Liga Professional (Argentina)",
  "Liga Profesional": "Liga Professional (Argentina)", // Alternative spelling
  "Liga Profesional De Futbol": "Liga Professional (Argentina)",
  "Liga Profesional Argentina": "Liga Professional (Argentina)",
  "Torneo Clausura": "Liga Professional (Argentina)",
  "Argentine Liga Professional": "Liga Professional (Argentina)",
};

function mapLeagueNameToDisplay(dbLeagueName: string | null): string | null {
  if (!dbLeagueName) return null;
  return leagueNameMapping[dbLeagueName] || dbLeagueName;
}

export async function GET() {
  try {
    const teams = await getAllTeams();

    // Get stats and league for each team
    const teamsWithStats = await Promise.all(
      teams.map(async (team) => {
        const stats = await getTeamStats(team.id);
        
        // Get the most recent league for this team from their matches
        const teamMatches = await db
          .select({
            leagueId: matches.leagueId,
            leagueName: leagues.name,
          })
          .from(matches)
          .leftJoin(leagues, eq(matches.leagueId, leagues.id))
          .where(
            or(
              eq(matches.homeTeamId, team.id),
              eq(matches.awayTeamId, team.id)
            )
          )
          .orderBy(desc(matches.date))
          .limit(10);

        // Find the most common league from recent matches
        const leagueCounts = new Map<string, number>();
        teamMatches.forEach((match) => {
          if (match.leagueName) {
            leagueCounts.set(
              match.leagueName,
              (leagueCounts.get(match.leagueName) || 0) + 1
            );
          }
        });

        let primaryLeague: string | null = null;
        let maxCount = 0;
        leagueCounts.forEach((count, leagueName) => {
          if (count > maxCount) {
            maxCount = count;
            primaryLeague = leagueName;
          }
        });

        // Map to display name
        const displayLeague = mapLeagueNameToDisplay(primaryLeague);

        return {
          id: team.id,
          name: team.name,
          abbreviation: team.abbreviation,
          logoUrl: team.logoUrl,
          league: displayLeague,
          leagueDb: primaryLeague, // Keep original for filtering
          ...stats,
        };
      })
    );

    return NextResponse.json(teamsWithStats);
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
}

