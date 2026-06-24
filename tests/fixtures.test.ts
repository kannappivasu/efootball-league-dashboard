import assert from "node:assert/strict";
import test from "node:test";
import { generateFixturesForAll, generateFixturesForPlayer } from "../src/lib/fixtures";

test("generates every ordered pairing exactly once", () => {
  const fixtures = generateFixturesForAll(["a", "b", "c", "d"]);
  const pairings = fixtures.map((fixture) => `${fixture.homePlayerId}:${fixture.awayPlayerId}`);

  assert.equal(fixtures.length, 12);
  assert.equal(new Set(pairings).size, 12);
  assert.ok(fixtures.every((fixture) =>
    fixture.homePlayerId !== fixture.awayPlayerId && fixture.status === "scheduled"
  ));
});

test("adds home and away fixtures for a new player", () => {
  const fixtures = generateFixturesForPlayer("new", [{ id: "a" }, { id: "b" }]);

  assert.deepEqual(
    fixtures.map(({ homePlayerId, awayPlayerId }) => [homePlayerId, awayPlayerId]),
    [["new", "a"], ["a", "new"], ["new", "b"], ["b", "new"]]
  );
});
