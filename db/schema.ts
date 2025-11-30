import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// Leagues table
export const leagues = sqliteTable("leagues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug"),
  espnLeagueCode: text("espn_league_code").unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Teams table
export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  espnTeamId: text("espn_team_id").notNull().unique(),
  name: text("name").notNull(),
  abbreviation: text("abbreviation"),
  logoUrl: text("logo_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Players table
export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  espnPlayerId: text("espn_player_id").notNull().unique(),
  name: text("name").notNull(),
  position: text("position"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Matches table
export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  espnEventId: text("espn_event_id").notNull().unique(),
  leagueId: integer("league_id").references(() => leagues.id),
  homeTeamId: integer("home_team_id").references(() => teams.id).notNull(),
  awayTeamId: integer("away_team_id").references(() => teams.id).notNull(),
  date: integer("date", { mode: "timestamp" }).notNull(),
  venue: text("venue"),
  status: text("status").notNull(), // upcoming, live, completed, etc.
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Match players table - ensures correct player-team mapping at match time
export const matchPlayers = sqliteTable("match_players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id").references(() => matches.id).notNull(),
  playerId: integer("player_id").references(() => players.id).notNull(),
  teamId: integer("team_id").references(() => teams.id).notNull(),
  isHome: integer("is_home", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Match odds table
export const matchOdds = sqliteTable("match_odds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id").references(() => matches.id).notNull(),
  homeOdds: real("home_odds"),
  drawOdds: real("draw_odds"),
  awayOdds: real("away_odds"),
  provider: text("provider"),
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Match statistics table
export const matchStatistics = sqliteTable("match_statistics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id").references(() => matches.id).notNull(),
  teamId: integer("team_id").references(() => teams.id).notNull(),
  possession: real("possession"),
  shots: integer("shots"),
  shotsOnTarget: integer("shots_on_target"),
  corners: integer("corners"),
  fouls: integer("fouls"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Player match statistics table - tracks goals, shots on target per match
export const playerMatchStats = sqliteTable("player_match_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id").references(() => matches.id).notNull(),
  playerId: integer("player_id").references(() => players.id).notNull(),
  teamId: integer("team_id").references(() => teams.id).notNull(),
  goals: integer("goals").notNull().default(0),
  shotsOnTarget: integer("shots_on_target").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Relations
export const leaguesRelations = relations(leagues, ({ many }) => ({
  matches: many(matches),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  homeMatches: many(matches, { relationName: "homeTeam" }),
  awayMatches: many(matches, { relationName: "awayTeam" }),
  matchPlayers: many(matchPlayers),
  matchStatistics: many(matchStatistics),
}));

export const playersRelations = relations(players, ({ many }) => ({
  matchPlayers: many(matchPlayers),
  playerMatchStats: many(playerMatchStats),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  league: one(leagues, {
    fields: [matches.leagueId],
    references: [leagues.id],
  }),
  homeTeam: one(teams, {
    fields: [matches.homeTeamId],
    references: [teams.id],
    relationName: "homeTeam",
  }),
  awayTeam: one(teams, {
    fields: [matches.awayTeamId],
    references: [teams.id],
    relationName: "awayTeam",
  }),
  matchPlayers: many(matchPlayers),
  matchOdds: many(matchOdds),
  matchStatistics: many(matchStatistics),
}));

export const matchPlayersRelations = relations(matchPlayers, ({ one }) => ({
  match: one(matches, {
    fields: [matchPlayers.matchId],
    references: [matches.id],
  }),
  player: one(players, {
    fields: [matchPlayers.playerId],
    references: [players.id],
  }),
  team: one(teams, {
    fields: [matchPlayers.teamId],
    references: [teams.id],
  }),
}));

export const matchOddsRelations = relations(matchOdds, ({ one }) => ({
  match: one(matches, {
    fields: [matchOdds.matchId],
    references: [matches.id],
  }),
}));

export const matchStatisticsRelations = relations(matchStatistics, ({ one }) => ({
  match: one(matches, {
    fields: [matchStatistics.matchId],
    references: [matches.id],
  }),
  team: one(teams, {
    fields: [matchStatistics.teamId],
    references: [teams.id],
  }),
}));

export const playerMatchStatsRelations = relations(playerMatchStats, ({ one }) => ({
  match: one(matches, {
    fields: [playerMatchStats.matchId],
    references: [matches.id],
  }),
  player: one(players, {
    fields: [playerMatchStats.playerId],
    references: [players.id],
  }),
  team: one(teams, {
    fields: [playerMatchStats.teamId],
    references: [teams.id],
  }),
}));

