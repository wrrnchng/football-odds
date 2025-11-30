export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Only run in Node.js runtime (server-side)
    const { fetchAllGamesOnStartup } = await import("./lib/services/auto-fetch");
    
    console.log("[Instrumentation] Server starting, initializing auto-fetch...");
    
    // Run fetch synchronously (blocking) as per requirements
    await fetchAllGamesOnStartup();
  }
}

