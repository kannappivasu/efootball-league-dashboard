import assert from "node:assert/strict";
import test from "node:test";
import type { CompletedMatchWithPlayers } from "../src/lib/standings";
import { computeStandings, fixturesTotal } from "../src/lib/standings";

const players = [
  { id: "a", name: "Alpha", avatar: null },
  { id: "b", name: "Bravo", avatar: null },
  { id: "c", name: "Charlie", avatar: null },
];

function match(
  id: string,
  homePlayerId: string,
  awayPlayerId: string,
  homeGoals: number,
  awayGoals: number,
  playedAt: Date
): CompletedMatchWithPlayers {
  const homePlayer = players.find((player) => player.id === homePlayerId)!;
  const awayPlayer = players.find((player) => player.id === awayPlayerId)!;
  return {
    id,
    homePlayerId,
    awayPlayerId,
    homeGoals,
    awayGoals,
    playedAt,
    leg: "home",
    status: "completed",
    homePlayer,
    awayPlayer,
  };
}

test("computes points, goal difference, sort order, and recent form", () => {
  const matches = [
    match("1", "a", "b", 2, 0, new Date("2026-01-01T00:00:00Z")),
    match("2", "c", "a", 1, 1, new Date("2026-01-02T00:00:00Z")),
    match("3", "b", "c", 3, 1, new Date("2026-01-03T00:00:00Z")),
  ];

  const result = computeStandings(players, matches, "2026-01-03T00:00:00Z");

  assert.deepEqual(result.rows.map((row) => row.name), ["Alpha", "Bravo", "Charlie"]);
  assert.deepEqual(
    result.rows.map(({ pts, gd, form }) => ({ pts, gd, form })),
    [
      { pts: 4, gd: 2, form: ["D", "W"] },
      { pts: 3, gd: 0, form: ["W", "L"] },
      { pts: 1, gd: -2, form: ["L", "D"] },
    ]
  );
  assert.equal(result.lastUpdated, "2026-01-03T00:00:00Z");
});

test("ignores incomplete matches", () => {
  const incomplete = {
    ...match("1", "a", "b", 2, 0, new Date("2026-01-01T00:00:00Z")),
    awayGoals: null,
  };

  const { rows } = computeStandings(players, [incomplete]);
  assert.ok(rows.every((row) => row.mp === 0 && row.pts === 0));
});

test("calculates double round-robin fixture totals", () => {
  assert.equal(fixturesTotal(0), 0);
  assert.equal(fixturesTotal(1), 0);
  assert.equal(fixturesTotal(6), 30);
});
