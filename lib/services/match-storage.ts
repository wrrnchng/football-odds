import { ESPNEvent, ESPNCompetition } from "@/lib/types/espn";
import { upsertLeague, getLeagueByEspnCode } from "@/lib/db/leagues";
import { upsertTeam, getTeamByEspnId } from "@/lib/db/teams";
import { upsertPlayer } from "@/lib/db/players";
import {
  upsertMatch,
  insertMatchPlayer,
  insertMatchOdds,
  insertMatchStatistics,
  upsertPlayerMatchStats,
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

  // 5. Store match players and their statistics (from competitors statistics)
  // Track player stats per match (goals, shots on target, etc.)
  const playerStatsMap = new Map<string, { playerId: number; teamId: number; goals: number; shotsOnTarget: number }>();

  for (const competitor of competitors) {
    const isHome = competitor.homeAway === "home";
    const teamId = isHome ? homeTeam.id : awayTeam.id;

    if (competitor.statistics) {
      for (const stat of competitor.statistics) {
        // Parse player-level statistics from athletes array
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

              // Track player stats for this match
              const statKey = `${player.id}-${match.id}`;
              if (!playerStatsMap.has(statKey)) {
                playerStatsMap.set(statKey, {
                  playerId: player.id,
                  teamId,
                  goals: 0,
                  shotsOnTarget: 0,
                });
              }

              const playerStat = playerStatsMap.get(statKey)!;

              // Parse statistic value - ESPN provides displayValue in the stat object
              // For player stats, we need to check the stat name and extract the value
              const statValue = parseFloat(stat.displayValue);
              if (!isNaN(statValue)) {
                // Map ESPN statistic names to our stats
                const statName = stat.name?.toLowerCase() || "";
                const statAbbr = stat.abbreviation?.toLowerCase() || "";

                // Check for shots on target variations
              // ESPN provides player-level stats in the athletes array
              // The stat name indicates what metric, and athletes are ranked by that metric
              if (
                (statName.includes("shot") && statName.includes("target")) ||
                statAbbr.includes("sot") ||
                statName === "shotsontarget" ||
                statName === "shots on target"
              ) {
                // ESPN athletes array contains players ranked by this stat
                // We need to extract individual player values if available
                // For now, we'll track that this stat exists for this player
                // The actual value extraction may need to be adjusted based on ESPN API response structure
              }
              }
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
        // Track goals: if scoringPlay is true, the first athlete is the scorer
        const isGoal = detail.scoringPlay && !detail.ownGoal && !detail.penaltyKick;
        const isAssist = detail.scoringPlay && detail.athletesInvolved.length > 1;
        
        for (let i = 0; i < detail.athletesInvolved.length; i++) {
          const athlete = detail.athletesInvolved[i];
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

              // Track goals for scoring plays
              if (isGoal && i === 0) {
                // First athlete is the goal scorer
                const statKey = `${player.id}-${match.id}`;
                if (playerStatsMap.has(statKey)) {
                  playerStatsMap.get(statKey)!.goals += 1;
                } else {
                  playerStatsMap.set(statKey, {
                    playerId: player.id,
                    teamId,
                    goals: 1,
                    shotsOnTarget: 0,
                  });
                }
              }
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

  // 8. Store all collected player match statistics
  for (const [statKey, playerStat] of playerStatsMap.entries()) {
    await upsertPlayerMatchStats({
      matchId: match.id,
      playerId: playerStat.playerId,
      teamId: playerStat.teamId,
      goals: playerStat.goals,
      shotsOnTarget: playerStat.shotsOnTarget,
    });
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

