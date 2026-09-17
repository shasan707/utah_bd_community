// Runs the test suites and prints one table.
//
//   npm test                  the suites that only read
//   ALLOW_DB_TESTS=1 npm test every suite, including the ones that write
//
// Several suites exercise the money code end to end, which means creating
// rows in whatever database .env.local points at and deleting them again.
// They are held behind ALLOW_DB_TESTS on purpose: running them by accident
// against the live site would write and remove real-looking registrations.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

/** writes: creates and deletes rows. read: touches nothing. */
const SUITES = [
  { file: "suite-logic.mts", writes: false, what: "pricing, parsing, dates, addresses" },
  { file: "suite-msg.mts", writes: false, what: "email and text wording" },
  { file: "suite-live.mjs", writes: false, what: "the deployed site" },
  { file: "suite-db.mjs", writes: false, what: "database constraints (rejections only)" },
  { file: "suite-desk.mts", writes: true, what: "the door and the coupon desk" },
  { file: "suite-firstpay.mts", writes: true, what: "the first payment on a code" },
  { file: "suite-topup.mts", writes: true, what: "adding to an existing code" },
  { file: "suite-reverse.mts", writes: true, what: "coupons or a donation first, seats after" },
  { file: "suite-owing.mts", writes: true, what: "a balance owing holds everything back" },
];

const allowWrites = process.env.ALLOW_DB_TESTS === "1";
const only = process.argv[2];

function run(file) {
  return new Promise((done) => {
    const args = ["--experimental-strip-types", "--experimental-loader", `file://${path.join(HERE, "hook.mjs").replace(/\\/g, "/")}`, path.join(HERE, file)];
    const child = spawn(process.execPath, args, { cwd: ROOT, env: process.env });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => {
      const m = out.match(/(\d+) passed, (\d+) failed/);
      done({ pass: m ? +m[1] : 0, fail: m ? +m[2] : 0, code, out });
    });
  });
}

let pass = 0, fail = 0, skipped = 0;
const failed = [];

for (const s of SUITES) {
  if (only && !s.file.includes(only)) continue;
  if (s.writes && !allowWrites) {
    skipped++;
    console.log(`  skip  ${s.file.padEnd(22)} ${s.what}  (set ALLOW_DB_TESTS=1)`);
    continue;
  }
  const r = await run(s.file);
  pass += r.pass;
  fail += r.fail;
  const mark = r.fail === 0 && r.code === 0 ? "ok  " : "FAIL";
  if (mark === "FAIL") failed.push({ file: s.file, out: r.out });
  // Asked for one suite by name: show its own output, since the point of
  // naming one is usually to read what it says.
  if (only) console.log(r.out);
  console.log(`  ${mark}  ${s.file.padEnd(22)} ${String(r.pass).padStart(3)} passed, ${r.fail} failed   ${s.what}`);
}

for (const f of failed) {
  console.log(`\n${"-".repeat(64)}\n${f.file}\n${"-".repeat(64)}`);
  console.log(f.out.split("\n").filter((l) => /FAIL|THREW|Error/.test(l)).join("\n") || f.out.slice(-1500));
}

console.log(`\n${"=".repeat(64)}`);
console.log(`${pass} passed, ${fail} failed${skipped ? `, ${skipped} suite(s) skipped` : ""}`);
process.exit(fail || failed.length ? 1 : 0);
