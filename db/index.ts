import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// Database path - matches drizzle.config.ts
// In Next.js, when running from frontend directory, use relative path
// When running from project root (API routes), need to go to frontend directory
const isApiRoute = process.cwd().endsWith("football-odds") || !process.cwd().includes("frontend");
const dbPath = isApiRoute 
  ? path.join(process.cwd(), "frontend", "football-odds.db")
  : path.join(process.cwd(), "football-odds.db");

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

