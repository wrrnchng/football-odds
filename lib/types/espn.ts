// ESPN API Response Types

export interface ESPNScoreboardResponse {
  leagues: ESPNLeague[];
  season: ESPNSeason;
  day: ESPNDay;
  events: ESPNEvent[];
}

export interface ESPNLeague {
  calendar: unknown[];
}

export interface ESPNSeason {
  type: number;
  year: number;
}

export interface ESPNDay {
  date: string;
}

export interface ESPNEvent {
  id: string;
  uid: string;
  date: string;
  name: string;
  shortName: string;
  season: ESPNSeason;
  competitions: ESPNCompetition[];
  status?: ESPNStatus;
  venue?: ESPNVenue;
  links?: ESPNLink[];
  odds?: ESPNOdds[];
}

export interface ESPNCompetition {
  id: string;
  uid: string;
  date: string;
  startDate: string;
  attendance?: number;
  timeValid: boolean;
  recent: boolean;
  status: ESPNStatus;
  venue: ESPNVenue;
  format: ESPNFormat;
  notes: unknown[];
  geoBroadcasts?: ESPNGeoBroadcast[];
  broadcasts?: ESPNBroadcast[];
  broadcast?: string;
  competitors: ESPNCompetitor[];
  details?: ESPNEventDetail[];
  odds?: ESPNOdds[];
  wasSuspended?: boolean;
  playByPlayAvailable?: boolean;
  playByPlayAthletes?: boolean;
}

export interface ESPNStatus {
  clock?: number;
  displayClock?: string;
  period: number;
  type: ESPNStatusType;
}

export interface ESPNStatusType {
  id: string;
  name: string;
  state: string;
  completed: boolean;
  description: string;
  detail: string;
  shortDetail: string;
}

export interface ESPNVenue {
  id?: string;
  fullName?: string;
  displayName?: string;
  address?: {
    city: string;
    country: string;
  };
}

export interface ESPNFormat {
  regulation: {
    periods: number;
  };
}

export interface ESPNGeoBroadcast {
  type: {
    id: string;
    shortName: string;
  };
  market: {
    id: string;
    type: string;
  };
  media: {
    shortName: string;
  };
  lang: string;
  region: string;
}

export interface ESPNBroadcast {
  market: string;
  names: string[];
}

export interface ESPNCompetitor {
  id: string;
  uid: string;
  type: string;
  order: number;
  homeAway: "home" | "away";
  winner?: boolean;
  form?: string;
  score?: string;
  records?: ESPNRecord[];
  team: ESPNTeam;
  statistics?: ESPNStatistic[];
}

export interface ESPNRecord {
  name: string;
  type: string;
  summary: string;
  abbreviation: string;
}

export interface ESPNTeam {
  id: string;
  uid: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  name: string;
  location: string;
  color?: string;
  alternateColor?: string;
  isActive: boolean;
  logo: string;
  links?: ESPNLink[];
  venue?: {
    id: string;
  };
}

export interface ESPNLink {
  language: string;
  rel: string[];
  href: string;
  text: string;
  shortText?: string;
  isExternal: boolean;
  isPremium: boolean;
  isHidden: boolean;
}

export interface ESPNStatistic {
  name: string;
  abbreviation: string;
  displayValue: string;
  athletes?: ESPNAthlete[];
}

export interface ESPNAthlete {
  id: string;
  displayName: string;
  shortName?: string;
  fullName?: string;
  jersey?: string;
  team?: {
    id: string;
  };
  links?: ESPNLink[];
  position?: string;
}

export interface ESPNEventDetail {
  type: {
    id: string;
    text: string;
  };
  clock?: {
    value: number;
    displayValue: string;
  };
  team?: {
    id: string;
  };
  scoreValue?: number;
  scoringPlay: boolean;
  redCard: boolean;
  yellowCard: boolean;
  penaltyKick: boolean;
  ownGoal: boolean;
  shootout: boolean;
  athletesInvolved?: ESPNAthlete[];
}

export interface ESPNOdds {
  overUnder?: number;
  link?: ESPNLink;
  provider: {
    id: string;
    name: string;
    priority: number;
  };
  drawOdds?: {
    moneyLine: number;
    link?: ESPNLink;
  };
  total?: {
    displayName: string;
    shortDisplayName: string;
    over: {
      open?: { line: string; odds: string };
      close?: { line: string; odds: string };
      current?: { line: string; odds: string };
    };
    under: {
      open?: { line: string; odds: string };
      close?: { line: string; odds: string };
      current?: { line: string; odds: string };
    };
  };
  pointSpread?: {
    displayName: string;
    shortDisplayName: string;
    home: {
      open?: { line: string; odds: string };
      close?: { line: string; odds: string };
      current?: { line: string; odds: string };
    };
    away: {
      open?: { line: string; odds: string };
      close?: { line: string; odds: string };
      current?: { line: string; odds: string };
    };
  };
  moneyline: {
    displayName: string;
    shortDisplayName: string;
    home: {
      open?: { odds: string };
      close?: { odds: string };
      current?: { odds: string };
    };
    away: {
      open?: { odds: string };
      close?: { odds: string };
      current?: { odds: string };
    };
    draw: {
      open?: { odds: string };
      close?: { odds: string };
      current?: { odds: string };
    };
  };
  details?: string;
  wasSuspended?: boolean;
  playByPlayAvailable?: boolean;
  playByPlayAthletes?: boolean;
}

// Dashboard display types
export interface DashboardMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  time: string;
  venue: string;
  homeOdds: number | null;
  drawOdds: number | null;
  awayOdds: number | null;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
}

