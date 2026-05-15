import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.CONVEX_URL || "https://quixotic-partridge-824.convex.cloud";

if (!convexUrl) {
  throw new Error("CONVEX_URL environment variable is not set");
}

export const convex = new ConvexHttpClient(convexUrl);
