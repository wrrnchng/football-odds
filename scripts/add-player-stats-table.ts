import Database from "better-sqlite3";
import path from "path";

/**
 * Migration script to add player_match_stats table
 * Run this once to add the table to existing databases
 */
function addPlayerStatsTable() {
  try {
    // Get database path (same logic as db/index.ts)
    const isApiRoute = process.cwd().endsWith("football-odds") || !process.cwd().includes("frontend");
    const dbPath = isApiRoute 
      ? path.join(process.cwd(), "frontend", "football-odds.db")
      : path.join(process.cwd(), "football-odds.db");

    console.log(`Connecting to database at: ${dbPath}`);
    const sqlite = new Database(dbPath);

    console.log("Adding player_match_stats table...");

    // Create the table if it doesn't exist
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS player_match_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id INTEGER NOT NULL REFERENCES matches(id),
        player_id INTEGER NOT NULL REFERENCES players(id),
        team_id INTEGER NOT NULL REFERENCES teams(id),
        goals INTEGER NOT NULL DEFAULT 0,
        assists INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Create indexes for better query performance
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_player_match_stats_player_id 
      ON player_match_stats(player_id)
    `);

    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_player_match_stats_match_id 
      ON player_match_stats(match_id)
    `);

    sqlite.close();
    console.log("✅ Successfully added player_match_stats table and indexes");
  } catch (error) {
    console.error("❌ Error adding player_match_stats table:", error);
    throw error;
  }
}

try {
  addPlayerStatsTable();
  console.log("Migration completed successfully");
  process.exit(0);
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
}

