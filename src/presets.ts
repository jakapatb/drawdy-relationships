import { call, getCtx } from "./ctx";

export type Preset = {
    id: string;
    name: string;
    color: string;
    dash?: "solid" | "dashed" | "dotted";
};

export const DEFAULT_PRESETS: Preset[] = [
    { id: "family", name: "Family", color: "#3b82f6" },
    { id: "romance", name: "Romance", color: "#ec4899" },
    { id: "ally", name: "Ally / friend", color: "#16a34a" },
    { id: "enemy", name: "Enemy", color: "#dc2626" },
    { id: "work", name: "Work", color: "#f59e0b", dash: "dashed" },
];

const KEY = "presets";

/** Defaults first, then the user's presets; a saved preset overrides a default with the same id. */
export const loadPresets = async (): Promise<Preset[]> => {
    const { driverId, requestId } = getCtx();
    // Storage waits on a permission prompt; never let that block the board.
    const stored = await Promise.race([
        call({ type: "command:kv-storage:get", driverId, requestId: requestId(), req: { key: KEY } }).catch(() => undefined),
        new Promise<undefined>((resolve) => setTimeout(resolve, 1500)),
    ]);
    const saved = (stored?.got?.presets as Preset[] | undefined) ?? [];
    const byId = new Map(DEFAULT_PRESETS.map((p) => [p.id, p]));
    for (const p of saved) byId.set(p.id, p);
    return [...byId.values()];
};

export const savePreset = async (preset: Preset) => {
    const { driverId, requestId } = getCtx();
    const all = await loadPresets();
    const next = [...all.filter((p) => p.id !== preset.id), preset];
    await call({
        type: "command:kv-storage:set",
        driverId,
        requestId: requestId(),
        req: { key: KEY, payload: { presets: next } },
    });
    return next;
};
