import { writeFileSync } from "node:fs";
import { arrange } from "../src/layout.ts";
import { PEOPLE, RELATIONS } from "./godfather.ts";

const out = process.argv[2]!;
const ids = Object.keys(PEOPLE);
const layout = arrange(ids, RELATIONS.map(([from, to]) => ({ from, to })), { size: 90 });
const color = (l: string) =>
    /father|brother|adopted/.test(l) ? "#3b82f6" : /marr/.test(l) ? "#ec4899" : /trust|loyal|consigliere|protect/.test(l) ? "#16a34a" : "#dc2626";
let svg = "";
const pad = 120;
let w = 0, h = 0;
for (const p of layout.values()) { w = Math.max(w, p.x); h = Math.max(h, p.y); }
for (const [a, b, l] of RELATIONS) {
    const p = layout.get(a)!, q = layout.get(b)!;
    svg += `<line x1="${p.x + pad}" y1="${p.y + pad}" x2="${q.x + pad}" y2="${q.y + pad}" stroke="${color(l)}" stroke-width="2" opacity=".8"/>`;
    svg += `<text x="${(p.x + q.x) / 2 + pad}" y="${(p.y + q.y) / 2 + pad - 4}" fill="${color(l)}" font-size="12" text-anchor="middle">${l}</text>`;
}
for (const [id, p] of layout) {
    svg += `<circle cx="${p.x + pad}" cy="${p.y + pad}" r="45" fill="#e0e7ff" stroke="#6366f1" stroke-width="3"/><text x="${p.x + pad}" y="${p.y + pad + 5}" text-anchor="middle" font-size="14" fill="#312e81">${id}</text>`;
}
writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" width="${w + pad * 2}" height="${h + pad * 2}"><rect width="100%" height="100%" fill="#fff"/>${svg}</svg>`);
