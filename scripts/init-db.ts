import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "../db/schema";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";

const sqlite = new Database(path.join(process.cwd(), "football-odds.db"));
const db = drizzle(sqlite, { schema });

// This will create tables if they don't exist
migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

console.log("Database initialized successfully!");
sqlite.close();

