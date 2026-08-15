/**
 * Admin bulk course import (spec §5.5).
 *
 * Loads a CSV of courses into the catalog — the intended path for
 * loading full-term catalogs (Summer 2026, Fall 2026, Spring 2027)
 * exported from the UMN registrar's Class Search.
 *
 * CSV FORMAT (header row optional, extra columns ignored):
 *     department_code,course_number,course_name
 *     CSCI,1133,Introduction to Computing and Programming Concepts
 *     MATH,1371,"CSE Calculus I"
 *
 * USAGE (needs .env.local with the service-role key — see .env.example):
 *     npm run import-courses -- path/to/courses.csv
 *
 * Rows that already exist are skipped (same find-or-create rule as the
 * in-app "Add a missing course"); malformed rows are reported and
 * skipped, never imported half-broken.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/** Same shape rules as the database CHECK constraints. */
const DEPT_RE = /^[A-Z]{2,8}$/;
const NUM_RE = /^[0-9]{1,4}[A-Z]{0,3}$/;

/**
 * Minimal CSV line parser that understands double-quoted fields (course
 * names contain commas: "Algorithms, Data Structures, ..."). We avoid a
 * CSV dependency on purpose — this is the only place we'd use it.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'; // escaped quote inside a quoted field
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: npm run import-courses -- path/to/courses.csv");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n\n" +
        "The npm script loads .env.local automatically, so this usually means\n" +
        "the file doesn't exist yet or is missing the service-role key:\n" +
        "  cp .env.example .env.local     # then fill in both values\n\n" +
        "Find the service_role key in the Supabase dashboard under\n" +
        "Project Settings → API. (Alternatively, export both variables\n" +
        "into your shell before running.)",
    );
    process.exit(1);
  }

  // Service-role client: bypasses RLS. That's why this script lives on an
  // admin's machine and the key never ships to browsers.
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: university, error: uniError } = await supabase
    .from("universities")
    .select("id")
    .eq("email_domain", "umn.edu")
    .single();
  if (uniError || !university) {
    console.error("Could not find the UMN university row — run migrations + seed first.");
    process.exit(1);
  }

  const lines = readFileSync(csvPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  let imported = 0;
  let skippedExisting = 0;
  const badRows: string[] = [];

  for (const [index, line] of lines.entries()) {
    const [rawDept, rawNum, rawName] = parseCsvLine(line);
    const dept = (rawDept ?? "").toUpperCase();
    const num = (rawNum ?? "").toUpperCase();
    const name = rawName ?? "";

    // Skip a header row if present.
    if (index === 0 && dept === "DEPARTMENT_CODE") continue;

    if (!DEPT_RE.test(dept) || !NUM_RE.test(num) || !name || name.length > 200) {
      badRows.push(`line ${index + 1}: ${line}`);
      continue;
    }

    const { error } = await supabase.from("courses").insert({
      university_id: university.id,
      department_code: dept,
      course_number: num,
      course_name: name,
    });

    if (!error) {
      imported++;
    } else if (error.code === "23505") {
      // unique_violation — course already exists; that's fine.
      skippedExisting++;
    } else {
      badRows.push(`line ${index + 1}: ${error.message}`);
    }
  }

  console.log(`Imported ${imported} new courses.`);
  console.log(`Skipped ${skippedExisting} that already existed.`);
  if (badRows.length > 0) {
    console.error(`\n${badRows.length} rows had problems:`);
    for (const row of badRows) console.error("  " + row);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
