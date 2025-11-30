import Database from "better-sqlite3";
import path from "path";

/**
 * Migration script to add yellow_cards and red_cards columns to match_statistics table
 */
async function addCardsToMatchStats() {
  const dbPath = path.join(process.cwd(), "football-odds.db");
  const db = new Database(dbPath);

  console.log("Starting migration: Add yellow_cards and red_cards to match_statistics...\n");

  try {
    // Check if columns already exist
    const tableInfo = db.prepare("PRAGMA table_info(match_statistics)").all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    const hasYellowCards = tableInfo.some((col) => col.name === "yellow_cards");
    const hasRedCards = tableInfo.some((col) => col.name === "red_cards");

    if (hasYellowCards && hasRedCards) {
      console.log("✓ Migration already completed. Columns already exist.");
      db.close();
      return;
    }

    // Add yellow_cards column if it doesn't exist
    if (!hasYellowCards) {
      console.log("Step 1: Adding yellow_cards column...");
      db.exec(`
        ALTER TABLE match_statistics 
        ADD COLUMN yellow_cards INTEGER NOT NULL DEFAULT 0
      `);
      console.log("✓ Added yellow_cards column");
    }

    // Add red_cards column if it doesn't exist
    if (!hasRedCards) {
      console.log("Step 2: Adding red_cards column...");
      db.exec(`
        ALTER TABLE match_statistics 
        ADD COLUMN red_cards INTEGER NOT NULL DEFAULT 0
      `);
      console.log("✓ Added red_cards column");
    }

    console.log("\n✓ Migration completed successfully!");
    console.log("  - Added 'yellow_cards' column (default: 0)");
    console.log("  - Added 'red_cards' column (default: 0)");
    console.log("\nNote: Existing records will have 0 for cards. Cards will be populated for new matches.");
  } catch (error) {
    console.error("\n✗ Migration failed:", error);
    throw error;
  } finally {
    db.close();
  }
}

addCardsToMatchStats()
  .then(() => {
    console.log("\n✓ Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Error:", error);
    process.exit(1);
  });

