import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * data/schedule.html is read at request time by lib/schedule.ts. Next works
   * out which files a route needs by reading the code, and it cannot see
   * through a path assembled from process.cwd(), so the file has to be named
   * here or it is left out of the deployment. The read would then fail in
   * production only, and the schedule would say "Coming soon" for ever with
   * nothing in the logs to explain it.
   */
  outputFileTracingIncludes: {
    "/events/[slug]": ["./data/schedule.html"],
  },
};

export default nextConfig;
