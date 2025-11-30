import { storeEvents } from "../lib/services/match-storage";
import { ESPNScoreboardResponse } from "../lib/types/espn";

const ESPN_API_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard";

// Rate limiting configuration
const RATE_LIMIT_DELAY_MS = 200; // 200ms between requests (5 requests per second)
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 1000; // Base delay for exponential backoff

// Statistics tracking
interface FetchStats {
  totalDays: number;
  successfulDays: number;
  failedDays: number;
  totalEvents: number;
  totalRequests: number;
  retries: number;
  startTime: Date;
}

/**
 * Format date to YYYYMMDD format for ESPN API
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch scoreboard data from ESPN API with retry logic
 */
async function fetchScoreboardFromESPN(
  dateStr: string,
  retryCount: number = 0
): Promise<ESPNScoreboardResponse> {
  const url = `${ESPN_API_BASE}?dates=${dateStr}`;

  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Handle rate limiting (429) and server errors (5xx)
      if (response.status === 429 || response.status >= 500) {
        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAY_BASE_MS * Math.pow(2, retryCount); // Exponential backoff
          console.log(
            `  ⚠️  Rate limited or server error (${response.status}). Retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`
          );
          await sleep(delay);
          return fetchScoreboardFromESPN(dateStr, retryCount + 1);
        }
      }
      throw new Error(`ESPN API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    // Handle timeout and network errors
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY_BASE_MS * Math.pow(2, retryCount);
        console.log(
          `  ⚠️  Request timeout. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`
        );
        await sleep(delay);
        return fetchScoreboardFromESPN(dateStr, retryCount + 1);
      }
    }

    // Re-throw if we've exhausted retries or it's a different error
    throw error;
  }
}

/**
 * Fetch and store games for a single date
 */
async function fetchGamesForDate(
  dateStr: string,
  stats: FetchStats
): Promise<number> {
  try {
    const response = await fetchScoreboardFromESPN(dateStr);
    stats.totalRequests++;

    if (response.events && response.events.length > 0) {
      console.log(`  ✓ Found ${response.events.length} events`);
      await storeEvents(response.events);
      stats.totalEvents += response.events.length;
      stats.successfulDays++;
      return response.events.length;
    } else {
      console.log(`  - No events found`);
      stats.successfulDays++;
      return 0;
    }
  } catch (error: any) {
    stats.failedDays++;
    console.error(`  ✗ Error: ${error.message}`);
    return 0;
  }
}

/**
 * Main function to fetch games from the past year
 */
async function fetchPastYearGames(): Promise<void> {
  console.log("=== Fetching Games from Past Year ===\n");

  const stats: FetchStats = {
    totalDays: 0,
    successfulDays: 0,
    failedDays: 0,
    totalEvents: 0,
    totalRequests: 0,
    retries: 0,
    startTime: new Date(),
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  oneYearAgo.setHours(0, 0, 0, 0);

  const daysDiff = Math.ceil((today.getTime() - oneYearAgo.getTime()) / (1000 * 60 * 60 * 24));
  stats.totalDays = daysDiff;

  console.log(`Date range: ${formatDate(oneYearAgo)} to ${formatDate(today)}`);
  console.log(`Total days to fetch: ${daysDiff}\n`);

  let processedDays = 0;

  // Fetch each day individually with rate limiting
  for (let dayOffset = 0; dayOffset < daysDiff; dayOffset++) {
    const targetDate = new Date(oneYearAgo);
    targetDate.setDate(oneYearAgo.getDate() + dayOffset);

    // Skip future dates (shouldn't happen, but safety check)
    if (targetDate > today) {
      break;
    }

    const dateStr = formatDate(targetDate);
    processedDays++;

    // Calculate progress percentage
    const progress = ((processedDays / daysDiff) * 100).toFixed(1);
    const elapsed = (Date.now() - stats.startTime.getTime()) / 1000;
    const avgTimePerDay = elapsed / processedDays;
    const remainingDays = daysDiff - processedDays;
    const estimatedRemaining = (remainingDays * avgTimePerDay / 60).toFixed(1);

    console.log(
      `[${processedDays}/${daysDiff}] (${progress}%) Fetching ${dateStr}... (Est. ${estimatedRemaining} min remaining)`
    );

    await fetchGamesForDate(dateStr, stats);

    // Rate limiting: wait between requests (except for the last one)
    if (dayOffset < daysDiff - 1) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }

    // Progress update every 50 days
    if (processedDays % 50 === 0) {
      console.log(
        `\n📊 Progress: ${processedDays}/${daysDiff} days | Events: ${stats.totalEvents} | Success: ${stats.successfulDays} | Failed: ${stats.failedDays}\n`
      );
    }
  }

  // Final statistics
  const endTime = new Date();
  const totalTime = (endTime.getTime() - stats.startTime.getTime()) / 1000 / 60; // minutes

  console.log("\n" + "=".repeat(60));
  console.log("=== Fetch Complete ===");
  console.log("=".repeat(60));
  console.log(`Total days processed: ${stats.totalDays}`);
  console.log(`Successful days: ${stats.successfulDays}`);
  console.log(`Failed days: ${stats.failedDays}`);
  console.log(`Total events stored: ${stats.totalEvents}`);
  console.log(`Total API requests: ${stats.totalRequests}`);
  console.log(`Total time: ${totalTime.toFixed(2)} minutes`);
  console.log(`Average events per day: ${(stats.totalEvents / stats.successfulDays).toFixed(2)}`);
  console.log("=".repeat(60));
}

// Run the script
fetchPastYearGames()
  .then(() => {
    console.log("\n✓ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Fatal error:", error);
    process.exit(1);
  });

