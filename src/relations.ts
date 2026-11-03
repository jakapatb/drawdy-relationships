import type { UpdateableProperties } from "@drawdy/driver-protocol";
import { call, getCtx } from "./ctx";
import { isBubble } from "./people";
import type { Preset } from "./presets";

const SPREAD = 60;

/** Bubbles among the current selection, in the order they were selected. */
export const selectedBubbles = async () => {
    const { driverId, requestId } = getCtx();
    const { drawdyElementIds } = await call({
        type: "command:scene:get-current-selected-drawdy-elements",
        driverId,
        requestId: requestId(),
        req: undefined,
    });
    if (!drawdyElementIds.length) return [];
    const { drawdyElements } = await call({
        type: "command:scene:get-drawdy-elements",
        driverId,
        requestId: requestId(),
        req: {
            drawdyElementIds,
            properties: ["type", "componentType", "x", "y", "width", "height"],
        },
    });
    const byId = new Map(drawdyElements.map((e) => [e.id, e]));
    return drawdyElementIds.map((id) => byId.get(id)).filter((e) => !!e && isBubble(e));
};

/**
 * Connect two bubbles with a labeled arrow. Arrows already linking the pair
 * (either direction) push the new one out to a free side, so a deep story
 * between two people stays readable.
 */
export const connect = async (
    fromId: string,
    toId: string,
    label: string,
    preset: Preset
) => {
    const { generateId, driverId, requestId } = getCtx();
    const rects = (
        await call({
            type: "command:scene:get-drawdy-elements",
            driverId,
            requestId: requestId(),
            req: {
                properties: ["type", "x", "y", "width", "height", "meta", "startBinding", "endBinding"],
            },
        })
    ).drawdyElements;
    const a = rects.find((e) => e.id === fromId)!;
    const b = rects.find((e) => e.id === toId)!;
    const existing = rects.filter((e) => {
        const s = e.startBinding?.drawdyElementId;
        const t = e.endBinding?.drawdyElementId;
        return (s === fromId && t === toId) || (s === toId && t === fromId);
    });

    // 0, +1, -1, +2, -2 ... times SPREAD, measured from the from→to normal.
    const n = existing.length;
    const side = n === 0 ? 0 : (n % 2 === 1 ? 1 : -1) * Math.ceil(n / 2);

    const ax = (a.x ?? 0) + (a.width ?? 0) / 2;
    const ay = (a.y ?? 0) + (a.height ?? 0) / 2;
    const bx = (b.x ?? 0) + (b.width ?? 0) / 2;
    const by = (b.y ?? 0) + (b.height ?? 0) / 2;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const bend: [number, number][] = side
        ? [[(ax + bx) / 2 - (dy / len) * side * SPREAD, (ay + by) / 2 + (dx / len) * side * SPREAD]]
        : [];

    // Attach on each bubble's rim, facing the other end (anchors are 0..1 of the bounding box).
    const ux = dx / len;
    const uy = dy / len;
    const anchor = (sign: 1 | -1) => ({
        anchorX: 0.5 + 0.5 * ux * sign,
        anchorY: 0.5 + 0.5 * uy * sign,
    });

    // Label sits on the arrow's midpoint, or on its bend when there is one.
    const mid = bend[0] ?? [(ax + bx) / 2, (ay + by) / 2];
    const labelWidth = Math.max(60, label.length * 8 + 16);

    const arrowId = generateId();
    const labelId = generateId();
    await call({
        type: "command:scene:add-drawdy-elements",
        driverId,
        requestId: requestId(),
        req: {
            elements: [
                {
                    type: "arrow",
                    drawdyElementId: arrowId,
                    startBinding: { drawdyElementId: fromId, ...anchor(1) },
                    endBinding: { drawdyElementId: toId, ...anchor(-1) },
                    ...(bend.length ? { bend } : {}),
                    color: preset.color,
                    strokeWidth: 2,
                    strokeDash: preset.dash ?? "solid",
                    meta: { relationships: "relation", preset: preset.id, label, labelId },
                },
                {
                    type: "text",
                    drawdyElementId: labelId,
                    x: mid[0] - labelWidth / 2,
                    y: mid[1] - 24,
                    width: labelWidth,
                    text: label,
                    fontSize: 14,
                    color: preset.color,
                    textAlign: "center",
                    meta: { relationships: "label", of: arrowId },
                },
            ],
        },
    });
    return arrowId;
};

/** Recolor every arrow tagged with this preset. */
export const applyPreset = async (preset: Preset) => {
    const { driverId, requestId } = getCtx();
    const { drawdyElements } = await call({
        type: "command:scene:get-drawdy-elements",
        driverId,
        requestId: requestId(),
        req: { properties: ["meta"] },
    });
    const arrows = drawdyElements.filter(
        (e) => e.meta?.relationships === "relation" && e.meta?.preset === preset.id
    );
    const arrowsOfPreset = new Set(arrows.map((e) => e.id));
    const updates: { drawdyElementId: string; properties: UpdateableProperties }[] = arrows.map((e) => ({
        drawdyElementId: e.id,
        properties: { strokeColor: preset.color, strokeDash: preset.dash ?? "solid" },
    }));
    for (const e of drawdyElements) {
        if (e.meta?.relationships === "label" && arrowsOfPreset.has(e.meta.of as string)) {
            updates.push({ drawdyElementId: e.id, properties: { textColor: preset.color, strokeColor: preset.color } });
        }
    }
    if (!updates.length) return 0;
    await call({
        type: "command:scene:update-drawdy-elements",
        driverId,
        requestId: requestId(),
        req: { updates },
    });
    return updates.length;
};

/**
 * After a drag ends, put every relation's label back on the arrow's
 * midpoint (or on its bend, when it has one).
 */
export const relayoutLabels = async () => {
    const { driverId, requestId } = getCtx();

    // The host re-routes bound arrows one drag step behind; re-asserting each
    // bubble's position makes it settle them on the final frame.
    const bubbles = (
        await call({
            type: "command:scene:get-drawdy-elements",
            driverId,
            requestId: requestId(),
            req: { properties: ["type", "componentType", "x", "y", "width", "height"] },
        })
    ).drawdyElements.filter(isBubble);
    if (bubbles.length) {
        await call({
            type: "command:scene:update-drawdy-elements",
            driverId,
            requestId: requestId(),
            req: {
                updates: bubbles.map((b) => ({
                    drawdyElementId: b.id,
                    properties: { transform: { x: b.x!, y: b.y! } },
                })),
            },
        });
    }
    const { drawdyElements } = await call({
        type: "command:scene:get-drawdy-elements",
        driverId,
        requestId: requestId(),
        req: { properties: ["x", "y", "width", "height", "points", "meta", "startBinding", "endBinding"] },
    });
    const byId = new Map(drawdyElements.map((e) => [e.id, e]));
    const updates: { drawdyElementId: string; properties: UpdateableProperties }[] = [];
    for (const arrow of drawdyElements) {
        if (arrow.meta?.relationships !== "relation") continue;
        const label = byId.get(arrow.meta.labelId as string);
        const pts = arrow.points;
        if (!label || !pts?.length) continue;
        const mid = pts.length > 2 ? pts[2]! : [(pts[0]![0] + pts[pts.length - 1]![0]) / 2, (pts[0]![1] + pts[pts.length - 1]![1]) / 2];
        updates.push({
            drawdyElementId: label.id,
            properties: { transform: { x: mid[0]! - (label.width ?? 0) / 2, y: mid[1]! - 24 } },
        });
    }
    if (!updates.length) return;
    await call({ type: "command:scene:update-drawdy-elements", driverId, requestId: requestId(), req: { updates } });
};
