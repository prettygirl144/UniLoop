/**
 * One-time seed: Add Academic year 2024-25 past winners to Triathlon.
 * Run: npx tsx scripts/seed-past-winner-2024-25.ts
 *
 * Does not modify 2025-26 winners. This inserts a new record that appears after
 * 2025-26 in the Past Winners list (ordered by announcedAt desc).
 */
import "dotenv/config";
import { db } from "../server/db";
import { triathlonPastWinners, users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  // Get first admin user for announcedBy (required by schema)
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);

  const announcedBy = admin?.id;
  if (!announcedBy) {
    throw new Error("No admin user found. Create an admin first.");
  }

  // Check if 2024-25 already exists
  const existing = await db
    .select()
    .from(triathlonPastWinners)
    .where(eq(triathlonPastWinners.label, "Academic year 2024-25"));

  if (existing.length > 0) {
    console.log("Academic year 2024-25 already exists. Skipping.");
    process.exit(0);
  }

  // Insert with announcedAt in past so it appears after 2025-26 (newer records first)
  const [inserted] = await db
    .insert(triathlonPastWinners)
    .values({
      label: "Academic year 2024-25",
      announcedAt: new Date("2025-06-01T00:00:00Z"), // Before 2025-26 announcement
      academicFirstPlaceTeamId: null,
      academicFirstPlaceName: "Hamel Hawks",
      culturalFirstPlaceTeamId: null,
      culturalFirstPlaceName: "Hamel Hawks",
      sportsFirstPlaceTeamId: null,
      sportsFirstPlaceName: "Friedman Foxes",
      overallFirstPlaceTeamId: null,
      overallFirstPlaceName: "Friedman Foxes",
      announcedBy,
    })
    .returning();

  console.log("Inserted past winner:", inserted);
  console.log("Academic year 2024-25 added successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
