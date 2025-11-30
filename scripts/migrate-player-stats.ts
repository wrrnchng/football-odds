import Database from "better-sqlite3";
import path from "path";

/**
 * Migration script to update player_match_stats table:
 * - Remove assists column
 * - Add shots_on_target column
 */
async function migratePlayerStats() {
  const dbPath = path.join(process.cwd(), "football-odds.db");
  const db = new Database(dbPath);

  console.log("Starting migration: Update player_match_stats table...\n");

  try {
    // Check if assists column exists
    const tableInfo = db.prepare("PRAGMA table_info(player_match_stats)").all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    const hasAssists = tableInfo.some((col) => col.name === "assists");
    const hasShotsOnTarget = tableInfo.some((col) => col.name === "shots_on_target");

    if (!hasAssists && hasShotsOnTarget) {
      console.log("✓ Migration already completed. Table structure is up to date.");
      db.close();
      return;
    }

    // Step 1: Create new table with updated schema
    console.log("Step 1: Creating new table structure...");
    db.exec(`
      CREATE TABLE IF NOT EXISTS player_match_stats_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id INTEGER NOT NULL REFERENCES matches(id),
        player_id INTEGER NOT NULL REFERENCES players(id),
        team_id INTEGER NOT NULL REFERENCES teams(id),
        goals INTEGER NOT NULL DEFAULT 0,
        shots_on_target INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Step 2: Copy existing data (excluding assists)
    console.log("Step 2: Migrating existing data...");
    if (hasAssists) {
      db.exec(`
        INSERT INTO player_match_stats_new (id, match_id, player_id, team_id, goals, shots_on_target, created_at)
        SELECT id, match_id, player_id, team_id, goals, 0 as shots_on_target, created_at
        FROM player_match_stats
      `);
    } else {
      // If assists doesn't exist, just copy everything
      db.exec(`
        INSERT INTO player_match_stats_new (id, match_id, player_id, team_id, goals, shots_on_target, created_at)
        SELECT id, match_id, player_id, team_id, goals, 0 as shots_on_target, created_at
        FROM player_match_stats
      `);
    }

    // Step 3: Drop old table
    console.log("Step 3: Dropping old table...");
    db.exec(`DROP TABLE IF EXISTS player_match_stats`);

    // Step 4: Rename new table
    console.log("Step 4: Renaming new table...");
    db.exec(`ALTER TABLE player_match_stats_new RENAME TO player_match_stats`);

    // Step 5: Recreate indexes
    console.log("Step 5: Recreating indexes...");
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_player_match_stats_match_id ON player_match_stats(match_id);
      CREATE INDEX IF NOT EXISTS idx_player_match_stats_player_id ON player_match_stats(player_id);
      CREATE INDEX IF NOT EXISTS idx_player_match_stats_team_id ON player_match_stats(team_id);
    `);

    console.log("\n✓ Migration completed successfully!");
    console.log("  - Removed 'assists' column");
    console.log("  - Added 'shots_on_target' column");
    console.log("  - Preserved all existing data");
  } catch (error) {
    console.error("\n✗ Migration failed:", error);
    throw error;
  } finally {
    db.close();
  }
}

migratePlayerStats()
  .then(() => {
    console.log("\n✓ Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Error:", error);
    process.exit(1);
  });

