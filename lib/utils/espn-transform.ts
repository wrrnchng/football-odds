import { ESPNEvent, DashboardMatch } from "@/lib/types/espn";

/**
 * Parse league name from season slug
 * Example: "2025-26-english-premier-league" -> "Premier League"
 */
function parseLeagueName(slug: string): string {
  if (!slug) return "Unknown League";

  // Remove year prefix (e.g., "2025-26-")
  const withoutYear = slug.replace(/^\d{4}-\d{2}-/, "");

  // Convert to title case and replace hyphens with spaces
  const words = withoutYear.split("-");
  const titleCase = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // Common league name mappings
  const leagueMap: Record<string, string> = {
    "English Premier League": "Premier League",
    "Spanish La Liga": "La Liga",
    "Italian Serie A": "Serie A",
    "German Bundesliga": "Bundesliga",
    "French Ligue 1": "Ligue 1",
    "Major League Soccer": "MLS",
  };

  return leagueMap[titleCase] || titleCase;
}

/**
 * Convert American odds to decimal odds
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
 * Transform ESPN API event to dashboard match format
 */
export function transformEventToMatch(event: ESPNEvent): DashboardMatch | null {
  if (!event.competitions || event.competitions.length === 0) {
    return null;
  }

  const competition = event.competitions[0];
  const competitors = competition.competitors || [];

  if (competitors.length < 2) {
    return null;
  }

  // Find home and away teams
  const homeCompetitor = competitors.find((c) => c.homeAway === "home");
  const awayCompetitor = competitors.find((c) => c.homeAway === "away");

  if (!homeCompetitor || !awayCompetitor) {
    return null;
  }

  const homeTeam = homeCompetitor.team.displayName;
  const awayTeam = awayCompetitor.team.displayName;

  // Get league name
  const leagueSlug = event.season?.slug || "";
  const league = parseLeagueName(leagueSlug);

  // Get venue
  const venue = competition.venue?.fullName || competition.venue?.displayName || "TBD";

  // Get status
  const statusType = competition.status?.type;
  const isCompleted = statusType?.completed || false;
  const statusState = statusType?.state || "";
  const matchDate = new Date(event.date);
  const now = new Date();
  const isFuture = matchDate > now;

  // Determine status: check completion, state, and date
  let status: string;
  if (isCompleted) {
    status = "completed";
  } else if (statusState === "in" || statusState === "live") {
    status = "live";
  } else if (isFuture) {
    status = "scheduled";
  } else {
    // Default to scheduled if we can't determine
    status = "scheduled";
  }

  // Get scores
  const homeScore = homeCompetitor.score ? parseInt(homeCompetitor.score) : null;
  const awayScore = awayCompetitor.score ? parseInt(awayCompetitor.score) : null;

  // Get odds
  let homeOdds: number | null = null;
  let drawOdds: number | null = null;
  let awayOdds: number | null = null;

  if (competition.odds && competition.odds.length > 0) {
    const odds = competition.odds[0];
    if (odds && odds.moneyline) {
      if (odds.moneyline.home?.current?.odds) {
        homeOdds = americanToDecimal(odds.moneyline.home.current.odds);
      }
      if (odds.moneyline.draw?.current?.odds) {
        drawOdds = americanToDecimal(odds.moneyline.draw.current.odds);
      }
      if (odds.moneyline.away?.current?.odds) {
        awayOdds = americanToDecimal(odds.moneyline.away.current.odds);
      }
    }
  }

  return {
    id: event.id,
    homeTeam,
    awayTeam,
    league,
    time: event.date,
    venue,
    homeOdds,
    drawOdds,
    awayOdds,
    status,
    homeScore,
    awayScore,
  };
}

/**
 * Transform multiple ESPN events to dashboard matches
 */
export function transformEventsToMatches(events: ESPNEvent[]): DashboardMatch[] {
  return events
    .map(transformEventToMatch)
    .filter((match): match is DashboardMatch => match !== null);
}

