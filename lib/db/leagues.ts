import { db } from "@/db";
import { leagues } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function upsertLeague(data: {
  name: string;
  slug?: string;
  espnLeagueCode?: string;
}) {
  const existing = await db
    .select()
    .from(leagues)
    .where(eq(leagues.espnLeagueCode, data.espnLeagueCode || ""))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const [league] = await db
    .insert(leagues)
    .values({
      name: data.name,
      slug: data.slug,
      espnLeagueCode: data.espnLeagueCode,
    })
    .returning();

  return league;
}

export async function getLeagueByEspnCode(espnLeagueCode: string) {
  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.espnLeagueCode, espnLeagueCode))
    .limit(1);

  return league;
}

export async function getAllLeagues() {
  return db.select().from(leagues);
}

