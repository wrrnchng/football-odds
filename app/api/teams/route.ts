import { NextResponse } from "next/server";
import { getAllTeams } from "@/lib/db/teams";
import { db } from "@/db";
import { matches, leagues, matchStatistics } from "@/db/schema";
import { eq, or, desc, inArray } from "drizzle-orm";

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
    const allTeams = await getAllTeams();
    const teamIds = allTeams.map(t => t.id);

    if (teamIds.length === 0) {
      return NextResponse.json([]);
    }

    // Batch fetch all team stats in optimized queries
    // 1. Get all completed matches for all teams in one query
    const allMatches = await db
      .select()
      .from(matches)
      .where(
        or(
          inArray(matches.homeTeamId, teamIds),
          inArray(matches.awayTeamId, teamIds)
        )
      );

    // 2. Get all match statistics for all teams in one query
    const allMatchStats = await db
      .select({
        teamId: matchStatistics.teamId,
        shotsOnTarget: matchStatistics.shotsOnTarget,
        corners: matchStatistics.corners,
      })
      .from(matchStatistics)
      .where(inArray(matchStatistics.teamId, teamIds));

    // 3. Get league info for all matches in one query
    const matchesWithLeagues = await db
      .select({
        matchId: matches.id,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        leagueId: matches.leagueId,
        leagueName: leagues.name,
        date: matches.date,
      })
      .from(matches)
      .leftJoin(leagues, eq(matches.leagueId, leagues.id))
      .where(
        or(
          inArray(matches.homeTeamId, teamIds),
          inArray(matches.awayTeamId, teamIds)
        )
      )
      .orderBy(desc(matches.date));

    // Process data in memory
    const teamStatsMap = new Map<number, {
      wins: number;
      draws: number;
      losses: number;
      goalsScored: number;
      goalsConceded: number;
      shotsOnTarget: number;
      corners: number;
    }>();

    const teamLeagueMap = new Map<number, Map<string, number>>();

    // Initialize stats for all teams
    teamIds.forEach(id => {
      teamStatsMap.set(id, {
        wins: 0,
        draws: 0,
        losses: 0,
        goalsScored: 0,
        goalsConceded: 0,
        shotsOnTarget: 0,
        corners: 0,
      });
      teamLeagueMap.set(id, new Map());
    });

    // Process matches
    for (const match of allMatches) {
      if (match.status !== "completed" || match.homeScore === null || match.awayScore === null) {
        continue;
      }

      const homeTeamId = match.homeTeamId;
      const awayTeamId = match.awayTeamId;

      if (teamIds.includes(homeTeamId)) {
        const stats = teamStatsMap.get(homeTeamId)!;
        stats.goalsScored += match.homeScore;
        stats.goalsConceded += match.awayScore;
        if (match.homeScore > match.awayScore) stats.wins++;
        else if (match.homeScore === match.awayScore) stats.draws++;
        else stats.losses++;
      }

      if (teamIds.includes(awayTeamId)) {
        const stats = teamStatsMap.get(awayTeamId)!;
        stats.goalsScored += match.awayScore;
        stats.goalsConceded += match.homeScore;
        if (match.awayScore > match.homeScore) stats.wins++;
        else if (match.awayScore === match.homeScore) stats.draws++;
        else stats.losses++;
      }
    }

    // Process match statistics
    for (const stat of allMatchStats) {
      const stats = teamStatsMap.get(stat.teamId);
      if (stats) {
        stats.shotsOnTarget += stat.shotsOnTarget || 0;
        stats.corners += stat.corners || 0;
      }
    }

    // Process leagues (get most common league from recent matches per team)
    for (const match of matchesWithLeagues) {
      if (!match.leagueName) continue;

      if (teamIds.includes(match.homeTeamId)) {
        const leagueCounts = teamLeagueMap.get(match.homeTeamId)!;
        leagueCounts.set(match.leagueName, (leagueCounts.get(match.leagueName) || 0) + 1);
      }
      if (teamIds.includes(match.awayTeamId)) {
        const leagueCounts = teamLeagueMap.get(match.awayTeamId)!;
        leagueCounts.set(match.leagueName, (leagueCounts.get(match.leagueName) || 0) + 1);
      }
    }

    // Format response
    const teamsWithStats = allTeams.map(team => {
      const stats = teamStatsMap.get(team.id)!;
      const leagueCounts = teamLeagueMap.get(team.id)!;
      
      let primaryLeague: string | null = null;
      let maxCount = 0;
      leagueCounts.forEach((count, leagueName) => {
        if (count > maxCount) {
          maxCount = count;
          primaryLeague = leagueName;
        }
      });

      const displayLeague = mapLeagueNameToDisplay(primaryLeague);

      return {
        id: team.id,
        name: team.name,
        abbreviation: team.abbreviation,
        logoUrl: team.logoUrl,
        league: displayLeague,
        leagueDb: primaryLeague,
        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,
        goalsScored: stats.goalsScored,
        goalsConceded: stats.goalsConceded,
        points: stats.wins * 3 + stats.draws,
        shotsOnTarget: stats.shotsOnTarget,
        corners: stats.corners,
      };
    });

    return NextResponse.json(teamsWithStats);
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
}

