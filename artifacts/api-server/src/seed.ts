import { convex } from "./lib/convex";

async function seed() {
  console.log("Seeding via Convex admin mutation...");
  await (convex as any).mutation("admin:seedDemo", {});
  console.log("Seed complete.");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
