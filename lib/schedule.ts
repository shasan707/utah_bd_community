import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * The running order for an event, written by hand in data/schedule.html.
 *
 * The file is trusted: it is committed with the code, so nothing a visitor
 * can influence ever reaches it and it is placed on the page as written.
 * Anything from a form or the database must never be pasted into it.
 *
 * HTML comments are stripped before the emptiness test, so the guidance at
 * the top of the file does not count as content and the page keeps saying
 * "Coming soon" until a real row is added.
 *
 * next.config.ts names this file in outputFileTracingIncludes. Without that
 * Next cannot see through the path built here and would leave it out of the
 * deployment, where the read would fail and the section would quietly say
 * "Coming soon" for ever.
 */
export function eventScheduleHtml(): string {
  try {
    const file = path.join(process.cwd(), "data", "schedule.html");
    const raw = fs.readFileSync(file, "utf8");
    const withoutComments = raw.replace(/<!--[\s\S]*?-->/g, "").trim();
    return withoutComments;
  } catch {
    // A missing or unreadable file is not worth breaking the page over.
    return "";
  }
}
