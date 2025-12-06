import { type Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Prevent Drizzle from trying to modify PostGIS system tables (tables created and managed by an extension)
  // This way we can exclude these tables from the schema.ts file
  extensionsFilters: ["postgis"],
} satisfies Config;