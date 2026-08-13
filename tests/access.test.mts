/**
 * Access model.
 *
 * These exist because of a real outage: migration 0049 made tier 1 a
 * full-access administrator, but the UI still gated on `tier >= minTier`,
 * which reads tier 1 as the *least* privileged. A tier-1 user lost four nav
 * items and five routes, including the ability to create a project.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  canEdit,
  canSeeFinancials,
  hasAccess,
  isAdmin,
  type Tier,
} from "../lib/types/index.ts";
import { NAV_ITEMS } from "../components/layout/nav.ts";

const TIERS: Tier[] = [1, 2, 3];

test("tier 2 is the only restricted tier", () => {
  assert.deepEqual(TIERS.map(isAdmin), [true, false, true]);
  assert.deepEqual(TIERS.map(canSeeFinancials), [true, false, true]);
  assert.deepEqual(TIERS.map(canEdit), [true, true, true]);
});

test("hasAccess resolves through the predicates, never through tier order", () => {
  for (const t of TIERS) {
    assert.equal(hasAccess(t, "all"), true, `tier ${t} must reach "all" pages`);
    assert.equal(hasAccess(t, "admin"), isAdmin(t));
    assert.equal(hasAccess(t, "money"), canSeeFinancials(t));
  }
});

test("administrators see every nav item", () => {
  for (const t of TIERS.filter(isAdmin)) {
    const hidden = NAV_ITEMS.filter((i) => !hasAccess(t, i.access)).map((i) => i.href);
    assert.deepEqual(hidden, [], `tier ${t} is an administrator and must see everything`);
  }
});

test("tier 2 is kept out of the admin areas and nothing else", () => {
  const hidden = NAV_ITEMS.filter((i) => !hasAccess(2, i.access)).map((i) => i.href);
  assert.deepEqual(hidden.sort(), ["/settings", "/sites"]);
});

test("no nav item gates on a tier number", () => {
  for (const item of NAV_ITEMS) {
    assert.ok(
      ["all", "money", "admin"].includes(item.access),
      `${item.href} must use a named access level`,
    );
  }
});
