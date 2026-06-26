import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// ponytail: postgres.js covers local docker + Neon over TCP. Swap to
// drizzle-orm/neon-http only if you need edge/serverless HTTP pooling.
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _db = drizzle(postgres(url, { max: 10 }), { schema });
  }
  return _db;
}

export { schema };
export * from "./schema";
