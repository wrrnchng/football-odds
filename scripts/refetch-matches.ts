import { fetchAllGamesOnStartup } from "../lib/services/auto-fetch";

/**
 * Quick script to refetch all match data
 * This will:
 * 1. Fetch past games from the latest match date to today
 * 2. Fetch upcoming games for the next 7 days
 */
async function refetchMatches() {
  console.log("=== Refetching Match Data ===\n");
  
  try {
    await fetchAllGamesOnStartup();
    console.log("\n✅ Match data refetch completed successfully!");
  } catch (error) {
    console.error("\n❌ Error refetching match data:", error);
    process.exit(1);
  }
}

refetchMatches()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

