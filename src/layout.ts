/**
 * Pure graph layout for relationship maps. No Drawdy calls, so it runs in
 * tests: people go in, centers come out.
 */

export type LayoutEdge = { from: string; to: string };
export type Point = { x: number; y: number };
export type Layout = Map<string, Point>;

export type LayoutOptions = {
    /** Bubble diameter. */
    size?: number;
    /** Preferred gap between two directly related bubbles, edge to edge. */
    gap?: number;
    /** How many random starts to try; the best-scoring layout wins. */
    starts?: number;
};

const DEFAULTS = { size: 120, gap: 40, starts: 40 };

/** Small deterministic PRNG so the same board always arranges the same way. */
const mulberry32 = (seed: number) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const ccw = (a: Point, b: Point, c: Point) => (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);

const segmentsCross = (a: Point, b: Point, c: Point, d: Point) =>
    ccw(a, c, d) * ccw(b, c, d) < 0 && ccw(a, b, c) * ccw(a, b, d) < 0;

const distToSegment = (p: Point, a: Point, b: Point) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

export type LayoutMetrics = {
    /** Pairs of distinct edges that cross. */
    crossings: number;
    /** Edges that pass through a bubble that is not one of their ends. */
    bubbleHits: number;
    /** Pairs of bubbles closer than a bubble plus a little air. */
    overlaps: number;
};

/** Distinct person pairs, so five arrows between two people count once. */
const uniquePairs = (edges: LayoutEdge[]) => {
    const seen = new Set<string>();
    const out: LayoutEdge[] = [];
    for (const e of edges) {
        if (e.from === e.to) continue;
        const key = e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(e);
    }
    return out;
};

export const measure = (layout: Layout, edges: LayoutEdge[], size = DEFAULTS.size): LayoutMetrics => {
    const pairs = uniquePairs(edges);
    let crossings = 0;
    for (let i = 0; i < pairs.length; i++) {
        for (let j = i + 1; j < pairs.length; j++) {
            const e = pairs[i]!;
            const f = pairs[j]!;
            if (e.from === f.from || e.from === f.to || e.to === f.from || e.to === f.to) continue;
            if (segmentsCross(layout.get(e.from)!, layout.get(e.to)!, layout.get(f.from)!, layout.get(f.to)!)) {
                crossings++;
            }
        }
    }
    let bubbleHits = 0;
    for (const e of pairs) {
        for (const [id, p] of layout) {
            if (id === e.from || id === e.to) continue;
            if (distToSegment(p, layout.get(e.from)!, layout.get(e.to)!) < size / 2 + 6) bubbleHits++;
        }
    }
    let overlaps = 0;
    const pts = [...layout.values()];
    for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
            if (Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y) < size + 20) overlaps++;
        }
    }
    return { crossings, bubbleHits, overlaps };
};

const score = (m: LayoutMetrics, layout: Layout, edges: LayoutEdge[], ideal: number) => {
    let length = 0;
    for (const e of uniquePairs(edges)) {
        const a = layout.get(e.from)!;
        const b = layout.get(e.to)!;
        length += Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - ideal) / ideal;
    }
    return m.overlaps * 1000 + m.bubbleHits * 12 + m.crossings * 4 + length * 0.3;
};

/** One force-directed run from a seeded starting ring. */
const relax = (ids: string[], pairs: LayoutEdge[], degree: Map<string, number>, ideal: number, rand: () => number) => {
    const n = ids.length;
    const pos = new Map<string, Point>();
    const order = [...ids].sort(() => rand() - 0.5);
    const radius = Math.max(ideal, (ideal * n) / (2 * Math.PI));
    order.forEach((id, i) => {
        const a = (2 * Math.PI * i) / n + rand() * 0.3;
        pos.set(id, { x: Math.cos(a) * radius, y: Math.sin(a) * radius });
    });

    const iterations = 350;
    for (let step = 0; step < iterations; step++) {
        const temp = ideal * 0.35 * (1 - step / iterations) + 1;
        const force = new Map<string, Point>(ids.map((id) => [id, { x: 0, y: 0 }]));
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const a = pos.get(ids[i]!)!;
                const b = pos.get(ids[j]!)!;
                let dx = a.x - b.x;
                let dy = a.y - b.y;
                let d = Math.hypot(dx, dy);
                if (d < 1) {
                    dx = rand() - 0.5;
                    dy = rand() - 0.5;
                    d = Math.hypot(dx, dy);
                }
                const push = (ideal * ideal) / d;
                force.get(ids[i]!)!.x += (dx / d) * push;
                force.get(ids[i]!)!.y += (dy / d) * push;
                force.get(ids[j]!)!.x -= (dx / d) * push;
                force.get(ids[j]!)!.y -= (dy / d) * push;
            }
        }
        for (const e of pairs) {
            const a = pos.get(e.from)!;
            const b = pos.get(e.to)!;
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const d = Math.hypot(dx, dy) || 1;
            // Hubs pull less so a leader does not drag everyone onto a single ring.
            const pull = (d * d) / ideal / Math.sqrt(Math.max(degree.get(e.from)!, degree.get(e.to)!));
            force.get(e.from)!.x -= (dx / d) * pull;
            force.get(e.from)!.y -= (dy / d) * pull;
            force.get(e.to)!.x += (dx / d) * pull;
            force.get(e.to)!.y += (dy / d) * pull;
        }
        for (const id of ids) {
            const f = force.get(id)!;
            const m = Math.hypot(f.x, f.y) || 1;
            const p = pos.get(id)!;
            p.x += (f.x / m) * Math.min(m, temp);
            p.y += (f.y / m) * Math.min(m, temp);
        }
    }
    return pos;
};

export const arrange = (ids: string[], edges: LayoutEdge[], options: LayoutOptions = {}): Layout => {
    const { size, gap, starts } = { ...DEFAULTS, ...options };
    if (ids.length === 0) return new Map();
    if (ids.length === 1) return new Map([[ids[0]!, { x: 0, y: 0 }]]);

    const ideal = size + gap;
    const pairs = uniquePairs(edges.filter((e) => ids.includes(e.from) && ids.includes(e.to)));
    const degree = new Map(ids.map((id) => [id, 1]));
    for (const e of pairs) {
        degree.set(e.from, degree.get(e.from)! + 1);
        degree.set(e.to, degree.get(e.to)! + 1);
    }

    let best: Layout | null = null;
    let bestScore = Infinity;
    for (let s = 0; s < starts; s++) {
        const layout = relax(ids, pairs, degree, ideal, mulberry32(1000 + s * 7919));
        const sc = score(measure(layout, pairs, size), layout, pairs, ideal);
        if (sc < bestScore) {
            bestScore = sc;
            best = layout;
        }
    }

    // Anchor the result at the origin so callers can drop it anywhere.
    let minX = Infinity;
    let minY = Infinity;
    for (const p of best!.values()) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
    }
    for (const p of best!.values()) {
        p.x -= minX;
        p.y -= minY;
    }
    return best!;
};
