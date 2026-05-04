/**
 * Validates `mapIntervalsActivityJson` against the checked-in fixture (no network).
 * Run: npx tsx scripts/verify-intervals-map.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { mapIntervalsActivityJson } from "../src/lib/integrations/intervals/mapActivity";

const root = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(
  root,
  "../src/lib/integrations/intervals/fixtures/sample-activity.json",
);
const raw: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));

const mapped = mapIntervalsActivityJson(raw);
assert.ok(mapped, "expected mapped activity");
assert.equal(mapped.externalId, "987654321");
assert.equal(mapped.sportType, "Run");
assert.equal(mapped.title, "Morning easy");
assert.equal(mapped.durationSeconds, 3240);
assert.ok(mapped.distanceM && mapped.distanceM > 10000);
assert.equal(mapped.avgHr, 142);
assert.equal(mapped.maxHr, 158);
assert.equal(mapped.elapsedSeconds, 3400);
assert.equal(mapped.avgCadence, 172);
assert.equal(mapped.maxCadence, 185);
assert.equal(mapped.calories, 420);
assert.equal(mapped.icuTrainingLoad, 55.2);
assert.ok(mapped.paceSecPerKm != null && mapped.paceSecPerKm > 200 && mapped.paceSecPerKm < 400);

console.log("verify-intervals-map: OK");
