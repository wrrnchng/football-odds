import { ESPNEvent, ESPNCompetition } from "@/lib/types/espn";
import { upsertLeague, getLeagueByEspnCode } from "@/lib/db/leagues";
import { upsertTeam, getTeamByEspnId } from "@/lib/db/teams";
import { upsertPlayer } from "@/lib/db/players";
import {
  upsertMatch,
  insertMatchPlayer,
  insertMatchOdds,
  insertMatchStatistics,
} from "@/lib/db/matches";

/**
 * Parse league name from season slug
 */
function parseLeagueName(slug: string): string {
  if (!slug) return "Unknown League";
  const withoutYear = slug.replace(/^\d{4}-\d{2}-/, "");
  const words = withoutYear.split("-");
  const titleCase = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const leagueMap: Record<string, string> = {
    "English Premier League": "Premier League",
    "Spanish La Liga": "La Liga",
    "Italian Serie A": "Serie A",
    "German Bundesliga": "Bundesliga",
    "French Ligue 1": "Ligue 1",
    "French Ligue 2": "Ligue 2",
    "Argentine Liga Professional": "Liga Professional",
    "Liga Professional": "Liga Professional",
    "Liga Profesional": "Liga Professional", // Alternative spelling
    "Liga Profesional De Futbol": "Liga Professional",
    "Liga Profesional Argentina": "Liga Professional",
    "Torneo Clausura": "Liga Professional",
    "Major League Soccer": "MLS",
  };

  return leagueMap[titleCase] || titleCase;
}

/**
 * Convert American odds to decimal
 */
function americanToDecimal(americanOdds: string): number | null {
  const odds = parseFloat(americanOdds);
  if (isNaN(odds)) return null;
  if (odds > 0) {
    return 1 + odds / 100;
  } else {
    return 1 + 100 / Math.abs(odds);
  }
}

/**
 * Store a single ESPN event in the database
 */
export async function storeEvent(event: ESPNEvent): Promise<void> {
  if (!event.competitions || event.competitions.length === 0) {
    return;
  }

  const competition = event.competitions[0];
  const competitors = competition.competitors || [];

  if (competitors.length < 2) {
    return;
  }

  // 1. Store/update league
  const leagueSlug = event.season?.slug || "";
  const leagueName = parseLeagueName(leagueSlug);
  const league = await upsertLeague({
    name: leagueName,
    slug: leagueSlug,
    espnLeagueCode: event.season?.type?.toString(),
  });

  // 2. Store/update teams
  const homeCompetitor = competitors.find((c) => c.homeAway === "home");
  const awayCompetitor = competitors.find((c) => c.homeAway === "away");

  if (!homeCompetitor || !awayCompetitor) {
    return;
  }

  const homeTeam = await upsertTeam({
    espnTeamId: homeCompetitor.team.id,
    name: homeCompetitor.team.displayName,
    abbreviation: homeCompetitor.team.abbreviation,
    logoUrl: homeCompetitor.team.logo,
  });

  const awayTeam = await upsertTeam({
    espnTeamId: awayCompetitor.team.id,
    name: awayCompetitor.team.displayName,
    abbreviation: awayCompetitor.team.abbreviation,
    logoUrl: awayCompetitor.team.logo,
  });

  // 3. Determine match status
  const statusType = competition.status?.type;
  const isCompleted = statusType?.completed || false;
  const status = isCompleted
    ? "completed"
    : statusType?.state === "in"
    ? "live"
    : "scheduled";

  // 4. Store/update match
  const matchDate = new Date(event.date);
  const homeScore = homeCompetitor.score ? parseInt(homeCompetitor.score) : null;
  const awayScore = awayCompetitor.score ? parseInt(awayCompetitor.score) : null;

  const match = await upsertMatch({
    espnEventId: event.id,
    leagueId: league.id,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    date: matchDate,
    venue: competition.venue?.fullName || competition.venue?.displayName,
    status,
    homeScore,
    awayScore,
  });

  // 5. Store match players (from statistics and details)
  // Store players from competitors statistics
  for (const competitor of competitors) {
    const isHome = competitor.homeAway === "home";
    const teamId = isHome ? homeTeam.id : awayTeam.id;

    if (competitor.statistics) {
      for (const stat of competitor.statistics) {
        if (stat.athletes) {
          for (const athlete of stat.athletes) {
            if (athlete.id) {
              const player = await upsertPlayer({
                espnPlayerId: athlete.id,
                name: athlete.displayName,
                position: athlete.position,
              });

              await insertMatchPlayer({
                matchId: match.id,
                playerId: player.id,
                teamId,
                isHome,
              });
            }
          }
        }
      }
    }
  }

  // Store players from event details (goals, cards, etc.)
  if (competition.details) {
    for (const detail of competition.details) {
      if (detail.athletesInvolved) {
        for (const athlete of detail.athletesInvolved) {
          if (athlete.id && athlete.team?.id) {
            // Find which team this athlete belongs to
            const athleteTeam = competitors.find(
              (c) => c.team.id === athlete.team?.id
            );
            if (athleteTeam) {
              const isHome = athleteTeam.homeAway === "home";
              const teamId = isHome ? homeTeam.id : awayTeam.id;

              const player = await upsertPlayer({
                espnPlayerId: athlete.id,
                name: athlete.displayName,
                position: athlete.position,
              });

              await insertMatchPlayer({
                matchId: match.id,
                playerId: player.id,
                teamId,
                isHome,
              });
            }
          }
        }
      }
    }
  }

  // 6. Store odds if available
  if (competition.odds && competition.odds.length > 0) {
    const odds = competition.odds[0];
    if (odds && odds.moneyline) {
      const homeOdds = odds.moneyline.home?.current?.odds
        ? americanToDecimal(odds.moneyline.home.current.odds)
        : null;
      const drawOdds = odds.moneyline.draw?.current?.odds
        ? americanToDecimal(odds.moneyline.draw.current.odds)
        : null;
      const awayOdds = odds.moneyline.away?.current?.odds
        ? americanToDecimal(odds.moneyline.away.current.odds)
        : null;

      await insertMatchOdds({
        matchId: match.id,
        homeOdds,
        drawOdds,
        awayOdds,
        provider: odds.provider?.name,
      });
    }
  }

  // 7. Store match statistics
  for (const competitor of competitors) {
    const isHome = competitor.homeAway === "home";
    const teamId = isHome ? homeTeam.id : awayTeam.id;

    if (competitor.statistics) {
      let possession: number | null = null;
      let shots: number | null = null;
      let shotsOnTarget: number | null = null;
      let corners: number | null = null;
      let fouls: number | null = null;

      for (const stat of competitor.statistics) {
        const value = parseFloat(stat.displayValue);
        if (isNaN(value)) continue;

        switch (stat.name) {
          case "possessionPct":
            possession = value;
            break;
          case "totalShots":
            shots = value;
            break;
          case "shotsOnTarget":
            shotsOnTarget = value;
            break;
          case "wonCorners":
            corners = value;
            break;
          case "foulsCommitted":
            fouls = value;
            break;
        }
      }

      await insertMatchStatistics({
        matchId: match.id,
        teamId,
        possession,
        shots,
        shotsOnTarget,
        corners,
        fouls,
      });
    }
  }
}

/**
 * Store multiple ESPN events
 */
export async function storeEvents(events: ESPNEvent[]): Promise<void> {
  for (const event of events) {
    try {
      await storeEvent(event);
    } catch (error) {
      console.error(`Error storing event ${event.id}:`, error);
      // Continue with next event
    }
  }
}

