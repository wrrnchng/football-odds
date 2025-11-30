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
import { db } from "@/db";
import { playerMatchStats } from "@/db/schema";
import { eq } from "drizzle-orm";

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
                  assists: 0,
                  passes: 0,
                  passesCompleted: 0,
                  tackles: 0,
                  interceptions: 0,
                  saves: 0,
                  yellowCards: 0,
                  redCards: 0,
                });
              }

              const playerStat = playerStatsMap.get(statKey)!;

              // Map ESPN statistic names to our stats
              const statName = stat.name?.toLowerCase() || "";
              const statAbbr = stat.abbreviation?.toLowerCase() || "";

              // Helper function to extract player value from athlete object
              const extractPlayerValue = (): number => {
                if (athlete.value !== undefined && athlete.value !== null) {
                  return athlete.value;
                } else if (athlete.stat !== undefined && athlete.stat !== null) {
                  return athlete.stat;
                } else if (athlete.displayValue) {
                  const parsedValue = parseFloat(athlete.displayValue);
                  if (!isNaN(parsedValue)) {
                    return parsedValue;
                  }
                }
                // If player appears in the stat list, they have at least 1
                return 1;
              };

              // Parse different statistics from ESPN API
              const playerValue = extractPlayerValue();

              // Shots on Target
              if (
                (statName.includes("shot") && statName.includes("target")) ||
                statAbbr.includes("sot") ||
                statName === "shotsontarget" ||
                statName === "shots on target"
              ) {
                playerStat.shotsOnTarget = Math.max(playerStat.shotsOnTarget, playerValue);
              }
              // Assists
              else if (
                statName.includes("assist") ||
                statAbbr.includes("ast") ||
                statAbbr === "a"
              ) {
                playerStat.assists = Math.max(playerStat.assists, playerValue);
              }
              // Passes
              else if (
                statName.includes("pass") && !statName.includes("complete") ||
                statAbbr.includes("pass")
              ) {
                playerStat.passes = Math.max(playerStat.passes, playerValue);
              }
              // Passes Completed
              else if (
                statName.includes("pass") && statName.includes("complete") ||
                statName.includes("completed pass") ||
                statAbbr.includes("comp")
              ) {
                playerStat.passesCompleted = Math.max(playerStat.passesCompleted, playerValue);
              }
              // Tackles
              else if (
                statName.includes("tackle") ||
                statAbbr.includes("tkl") ||
                statAbbr === "tk"
              ) {
                playerStat.tackles = Math.max(playerStat.tackles, playerValue);
              }
              // Interceptions
              else if (
                statName.includes("intercept") ||
                statAbbr.includes("int") ||
                statAbbr === "i"
              ) {
                playerStat.interceptions = Math.max(playerStat.interceptions, playerValue);
              }
              // Saves (for goalkeepers)
              else if (
                statName.includes("save") ||
                statAbbr.includes("sv") ||
                statAbbr === "s"
              ) {
                playerStat.saves = Math.max(playerStat.saves, playerValue);
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
                    assists: 0,
                    passes: 0,
                    passesCompleted: 0,
                    tackles: 0,
                    interceptions: 0,
                    saves: 0,
                    yellowCards: 0,
                    redCards: 0,
                  });
                }
              }
              
              // Track assists (second athlete in scoring play is typically the assist provider)
              if (isGoal && i === 1 && detail.athletesInvolved.length > 1) {
                const statKey = `${player.id}-${match.id}`;
                if (playerStatsMap.has(statKey)) {
                  playerStatsMap.get(statKey)!.assists += 1;
                } else {
                  playerStatsMap.set(statKey, {
                    playerId: player.id,
                    teamId,
                    goals: 0,
                    shotsOnTarget: 0,
                    assists: 1,
                    passes: 0,
                    passesCompleted: 0,
                    tackles: 0,
                    interceptions: 0,
                    saves: 0,
                    yellowCards: 0,
                    redCards: 0,
                  });
                }
              }
              
              // Track yellow and red cards
              if (detail.yellowCard || detail.redCard) {
                const statKey = `${player.id}-${match.id}`;
                if (!playerStatsMap.has(statKey)) {
                  playerStatsMap.set(statKey, {
                    playerId: player.id,
                    teamId,
                    goals: 0,
                    shotsOnTarget: 0,
                    assists: 0,
                    passes: 0,
                    passesCompleted: 0,
                    tackles: 0,
                    interceptions: 0,
                    saves: 0,
                    yellowCards: 0,
                    redCards: 0,
                  });
                }
                const playerStat = playerStatsMap.get(statKey)!;
                if (detail.yellowCard) {
                  playerStat.yellowCards += 1;
                }
                if (detail.redCard) {
                  playerStat.redCards += 1;
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

  // 7. Count cards from event details per team
  const teamCardsMap = new Map<number, { yellowCards: number; redCards: number }>();
  teamCardsMap.set(homeTeam.id, { yellowCards: 0, redCards: 0 });
  teamCardsMap.set(awayTeam.id, { yellowCards: 0, redCards: 0 });

  if (competition.details) {
    for (const detail of competition.details) {
      // Check if this detail has a card
      if (!detail.yellowCard && !detail.redCard) {
        continue;
      }

      let teamId: number | null = null;

      // Try to get team from detail.team first
      if (detail.team?.id) {
        const athleteTeam = competitors.find(
          (c) => c.team.id === detail.team?.id
        );
        if (athleteTeam) {
          const isHome = athleteTeam.homeAway === "home";
          teamId = isHome ? homeTeam.id : awayTeam.id;
        }
      }

      // If no team from detail.team, try to get from athletesInvolved
      if (!teamId && detail.athletesInvolved && detail.athletesInvolved.length > 0) {
        const athlete = detail.athletesInvolved[0];
        if (athlete.team?.id) {
          const athleteTeam = competitors.find(
            (c) => c.team.id === athlete.team?.id
          );
          if (athleteTeam) {
            const isHome = athleteTeam.homeAway === "home";
            teamId = isHome ? homeTeam.id : awayTeam.id;
          }
        }
      }

      // Count the card if we found a team
      if (teamId) {
        const cards = teamCardsMap.get(teamId)!;
        if (detail.yellowCard) {
          cards.yellowCards += 1;
        }
        if (detail.redCard) {
          cards.redCards += 1;
        }
      }
    }
  }

  // 8. Store match statistics
  for (const competitor of competitors) {
    const isHome = competitor.homeAway === "home";
    const teamId = isHome ? homeTeam.id : awayTeam.id;

    const cards = teamCardsMap.get(teamId)!;

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
        yellowCards: cards.yellowCards,
        redCards: cards.redCards,
      });
    } else {
      // Still store cards even if no other statistics
      await insertMatchStatistics({
        matchId: match.id,
        teamId,
        yellowCards: cards.yellowCards,
        redCards: cards.redCards,
      });
    }
  }

  // 8. Store all collected player match statistics
  // Delete existing stats for this match first to avoid duplicates/accumulation
  await db
    .delete(playerMatchStats)
    .where(eq(playerMatchStats.matchId, match.id));
  
  // Then insert all fresh stats
  for (const [statKey, playerStat] of playerStatsMap.entries()) {
    await upsertPlayerMatchStats({
      matchId: match.id,
      playerId: playerStat.playerId,
      teamId: playerStat.teamId,
      goals: playerStat.goals,
      shotsOnTarget: playerStat.shotsOnTarget,
      assists: playerStat.assists,
      passes: playerStat.passes,
      passesCompleted: playerStat.passesCompleted,
      tackles: playerStat.tackles,
      interceptions: playerStat.interceptions,
      saves: playerStat.saves,
      yellowCards: playerStat.yellowCards,
      redCards: playerStat.redCards,
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

