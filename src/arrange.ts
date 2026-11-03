import type { UpdateableProperties } from "@drawdy/driver-protocol";
import { call, getCtx } from "./ctx";
import { arrange } from "./layout";
import { isBubble } from "./people";
import { loadPresets, type Preset } from "./presets";
import { connect } from "./relations";

/**
 * Re-lay out every person on the board so related people sit close and
 * arrows cross as little as possible. Each person moves with their name and
 * avatar, anchored where the people already are. The host only re-routes
 * bound arrows during a manual drag, so the extension's own arrows and labels
 * are redrawn from the new positions.
 */
export const arrangeBoard = async () => {
    const { driverId, requestId } = getCtx();
    const { drawdyElements } = await call({
        type: "command:scene:get-drawdy-elements",
        driverId,
        requestId: requestId(),
        req: {
            properties: [
                "type", "componentType", "x", "y", "width", "height",
                "groupId", "meta", "startBinding", "endBinding", "strokeColor",
            ],
        },
    });

    const bubbles = drawdyElements.filter(isBubble);
    if (bubbles.length < 2) return 0;
    const ids = new Set(bubbles.map((b) => b.id));

    // Any arrow bound at both ends to a person is a relation, whoever drew it.
    const edges = drawdyElements.flatMap((e) => {
        const from = e.startBinding?.drawdyElementId;
        const to = e.endBinding?.drawdyElementId;
        return from && to && ids.has(from) && ids.has(to) ? [{ from, to }] : [];
    });

    const size = Math.max(...bubbles.map((b) => b.width ?? 0));
    const layout = arrange([...ids], edges, { size });
    const originX = Math.min(...bubbles.map((b) => b.x ?? 0));
    const originY = Math.min(...bubbles.map((b) => b.y ?? 0));

    const moves: { drawdyElementId: string; properties: UpdateableProperties }[] = [];
    for (const b of bubbles) {
        const target = layout.get(b.id)!;
        const dx = originX + target.x - (b.x ?? 0);
        const dy = originY + target.y - (b.y ?? 0);
        // The person's own parts: the bubble, its name and avatar, anything else in its group.
        const parts = drawdyElements.filter(
            (e) => e.id === b.id || e.meta?.of === b.id || (b.groupId && e.groupId === b.groupId && !e.startBinding)
        );
        for (const m of parts) {
            moves.push({
                drawdyElementId: m.id,
                properties: { transform: { x: (m.x ?? 0) + dx, y: (m.y ?? 0) + dy } },
            });
        }
    }
    await call({ type: "command:scene:update-drawdy-elements", driverId, requestId: requestId(), req: { updates: moves } });

    // Redraw the extension's arrows and their labels.
    const presets = await loadPresets();
    const relations = drawdyElements.filter(
        (e) => e.meta?.relationships === "relation" && e.startBinding && e.endBinding
    );
    const stale = relations.flatMap((r) => [r.id, r.meta!.labelId as string].filter(Boolean));
    if (stale.length) {
        await call({
            type: "command:scene:remove-drawdy-elements",
            driverId,
            requestId: requestId(),
            req: { drawdyElementIds: stale },
        });
    }
    for (const r of relations) {
        const preset: Preset =
            presets.find((p) => p.id === r.meta!.preset) ??
            { id: String(r.meta!.preset ?? "custom"), name: "Custom", color: r.strokeColor ?? "#888888" };
        await connect(r.startBinding!.drawdyElementId, r.endBinding!.drawdyElementId, String(r.meta!.label ?? ""), preset);
    }
    return bubbles.length;
};
