import { NextRequest, NextResponse } from "next/server";
import { getAllPlayersWithStats } from "@/lib/db/players";

// Map database league names to display names with countries (same as teams API)
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
  "Liga Profesional": "Liga Professional (Argentina)",
  "Liga Profesional De Futbol": "Liga Professional (Argentina)",
  "Liga Profesional Argentina": "Liga Professional (Argentina)",
  "Torneo Clausura": "Liga Professional (Argentina)",
  "Argentine Liga Professional": "Liga Professional (Argentina)",
};

function mapLeagueNameToDisplay(dbLeagueName: string | null): string | null {
  if (!dbLeagueName) return null;
  return leagueNameMapping[dbLeagueName] || dbLeagueName;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const leagueFilter = searchParams.get("league");
    
    // Reverse mapping: display name -> database name
    const displayToDbMapping: Record<string, string> = {
      "Premier League (England)": "Premier League",
      "La Liga (Spain)": "La Liga",
      "Bundesliga (Germany)": "Bundesliga",
      "Serie A (Italy)": "Serie A",
      "Ligue 1 (France)": "Ligue 1",
      "Ligue 2 (France)": "Ligue 2",
      "Liga Professional (Argentina)": "Liga Professional",
    };
    
    // Convert display league name to database league name for filtering
    const dbLeagueFilter = leagueFilter && leagueFilter !== "All Leagues"
      ? (displayToDbMapping[leagueFilter] || leagueFilter)
      : null;

    // Use optimized batch query function with league filter at database level
    let playersWithStats = await getAllPlayersWithStats(dbLeagueFilter);

    // Map league names to display format
    playersWithStats = playersWithStats.map((player) => ({
      ...player,
      league: mapLeagueNameToDisplay(player.league),
      leagueDb: player.league, // Keep original for reference
    }));

    return NextResponse.json(playersWithStats);
  } catch (error) {
    console.error("Error fetching players:", error);
    return NextResponse.json(
      { error: "Failed to fetch players" },
      { status: 500 }
    );
  }
}

