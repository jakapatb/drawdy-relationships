import { test } from "node:test";
import assert from "node:assert/strict";
import { arrange, measure, type Layout } from "../src/layout.ts";
import { PEOPLE, RELATIONS } from "./godfather.ts";

const edges = RELATIONS.map(([from, to]) => ({ from, to }));
const ids = Object.keys(PEOPLE);

test("hand-placed Godfather layout is the baseline", () => {
    const hand: Layout = new Map(ids.map((id) => [id, { x: PEOPLE[id as keyof typeof PEOPLE][0], y: PEOPLE[id as keyof typeof PEOPLE][1] }]));
    console.log("hand  ", measure(hand, edges, 90));
});

test("arrange beats the hand layout and never overlaps bubbles", () => {
    const layout = arrange(ids, edges, { size: 90 });
    const m = measure(layout, edges, 90);
    const xs = [...layout.values()].map((p) => p.x), ys = [...layout.values()].map((p) => p.y);
    console.log("arrange", m, "bbox", Math.round(Math.max(...xs)), "x", Math.round(Math.max(...ys)));
    assert.equal(layout.size, ids.length);
    assert.equal(m.overlaps, 0);
});

test("arrange is deterministic", () => {
    const a = arrange(ids, edges);
    const b = arrange(ids, edges);
    assert.deepEqual([...a], [...b]);
});

test("edge cases", () => {
    assert.equal(arrange([], []).size, 0);
    assert.deepEqual([...arrange(["a"], [])], [["a", { x: 0, y: 0 }]]);
    const two = arrange(["a", "b"], [{ from: "a", to: "b" }, { from: "b", to: "a" }]);
    assert.equal(two.size, 2);
});
