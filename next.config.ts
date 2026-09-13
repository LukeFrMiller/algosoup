import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Reuse a visited page's payload for 30s when navigating back to it (Dashboard ↔ Videos ↔ Hypotheses).
  experimental: { staleTimes: { dynamic: 30 } },
}

export default nextConfig
