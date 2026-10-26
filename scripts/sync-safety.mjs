#!/usr/bin/env node
// Keeps one canonical copy of the safety rules. Run after editing src/lib/safety-rules.ts.
import { readFile, writeFile } from "node:fs/promises";

const HEADER = "// GENERATED FILE. Edit src/lib/safety-rules.ts and run `npm run safety:sync`.\n";
const source = await readFile("src/lib/safety-rules.ts", "utf8");
const target = "supabase/functions/generate-tree/safety-rules.ts";

if (process.argv.includes("--check")) {
  const current = await readFile(target, "utf8").catch(() => "");
  if (current !== HEADER + source) {
    console.error(`Safety rules are out of date: ${target}`);
    console.error("Run `npm run safety:sync` and commit the result.");
    process.exit(1);
  }
  console.log("Safety rules are in sync.");
} else {
  await writeFile(target, HEADER + source);
  console.log(`Wrote ${target}`);
}
