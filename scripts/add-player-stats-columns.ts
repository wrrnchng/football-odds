import Database from "better-sqlite3";
import path from "path";

/**
 * Migration script to add new player statistics columns to player_match_stats table
 */
async function addPlayerStatsColumns() {
  const dbPath = path.join(process.cwd(), "football-odds.db");
  const db = new Database(dbPath);

  console.log("Starting migration: Add new player statistics columns...\n");

  try {
    // Check existing columns
    const tableInfo = db.prepare("PRAGMA table_info(player_match_stats)").all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    const existingColumns = new Set(tableInfo.map((col) => col.name));
    const columnsToAdd = [
      { name: "assists", type: "INTEGER NOT NULL DEFAULT 0" },
      { name: "passes", type: "INTEGER NOT NULL DEFAULT 0" },
      { name: "passes_completed", type: "INTEGER NOT NULL DEFAULT 0" },
      { name: "tackles", type: "INTEGER NOT NULL DEFAULT 0" },
      { name: "interceptions", type: "INTEGER NOT NULL DEFAULT 0" },
      { name: "saves", type: "INTEGER NOT NULL DEFAULT 0" },
      { name: "yellow_cards", type: "INTEGER NOT NULL DEFAULT 0" },
      { name: "red_cards", type: "INTEGER NOT NULL DEFAULT 0" },
    ];

    let addedCount = 0;
    for (const column of columnsToAdd) {
      if (!existingColumns.has(column.name)) {
        console.log(`Adding column: ${column.name}...`);
        db.exec(`ALTER TABLE player_match_stats ADD COLUMN ${column.name} ${column.type}`);
        addedCount++;
        console.log(`✓ Added ${column.name}`);
      } else {
        console.log(`✓ Column ${column.name} already exists`);
      }
    }

    if (addedCount === 0) {
      console.log("\n✓ All columns already exist. Migration already completed.");
    } else {
      console.log(`\n✓ Migration completed successfully! Added ${addedCount} column(s).`);
    }
  } catch (error) {
    console.error("\n✗ Migration failed:", error);
    throw error;
  } finally {
    db.close();
  }
}

addPlayerStatsColumns()
  .then(() => {
    console.log("\n✓ Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Error:", error);
    process.exit(1);
  });

