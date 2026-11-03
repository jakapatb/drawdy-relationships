import type { DriverModule } from "@drawdy/driver-protocol";
import { call, getCtx, initCtx } from "./ctx";
import { addPerson, adoptImages } from "./people";
import { PANEL_ID, panelHtml, type FromPanel, type ToPanel } from "./panel";
import { loadPresets, savePreset } from "./presets";
import { seed } from "./seed";
import { arrangeBoard } from "./arrange";
import { applyPreset, connect, relayoutLabels, selectedBubbles } from "./relations";

const MENU_ADD_PERSON = "relationships:add-person";
const MENU_PANEL = "relationships:panel";
const MENU_ARRANGE = "relationships:arrange";
const MENU_SEED = "relationships:seed";

let pointer: { x: number; y: number } | null = null;
let panelOpen = false;

const post = async (message: ToPanel) => {
    const { driverId, requestId } = getCtx();
    await call({
        type: "command:webview:post-message",
        driverId,
        requestId: requestId(),
        req: { webviewDomId: PANEL_ID, message },
    });
};

/** Display names of selected bubbles, read from the name text that belongs to each. */
const selectionNames = async () => {
    const bubbles = await selectedBubbles();
    if (!bubbles.length) return { bubbles, names: [] as string[] };
    const { driverId, requestId } = getCtx();
    const { drawdyElements } = await call({
        type: "command:scene:get-drawdy-elements",
        driverId,
        requestId: requestId(),
        req: { properties: ["type", "text", "meta", "groupId"] },
    });
    const names = bubbles.map((b) => {
        const t = drawdyElements.find(
            (e) => e.type === "text" && (e.meta?.of === b!.id || (b!.groupId && e.groupId === b!.groupId))
        );
        return t?.text || "Someone";
    });
    return { bubbles, names };
};

const openPanel = async () => {
    const { driverId, requestId } = getCtx();
    await call({
        type: "command:webview:create",
        driverId,
        requestId: requestId(),
        req: { webviewDomId: PANEL_ID, htmlContent: panelHtml, keepStateWhenClosed: true },
    });
    panelOpen = true;
};

const step = async <T>(name: string, fn: () => Promise<T>) => {
    try {
        return await fn();
    } catch (err) {
        console.error(`[relationships] ${name} failed:`, err);
    }
};

export const activate: DriverModule["activate"] = async (args) => {
    console.log("[relationships] activate");
    initCtx(args.issueCommand, args.generateId, args.manifest.driverId);
    const { driverId, requestId } = getCtx();

    for (const [menuId, menuTitle] of [
        [MENU_ADD_PERSON, "Add person"],
        [MENU_PANEL, "Relationships panel"],
        [MENU_ARRANGE, "Arrange everyone"],
        [MENU_SEED, "TEMP seed Godfather"],
    ]) {
        await step(`menu ${menuId}`, async () => {
            await call({ type: "command:context-menu:add", driverId, requestId: requestId(), req: { menuId, menuTitle } });
            await call({ type: "subscription:context-menu:clicked", driverId, requestId: requestId(), req: { menuId } });
        });
    }
    await step("pointer-position", () =>
        call({ type: "subscription:scene:pointer-position", driverId, requestId: requestId(), req: undefined })
    );
    await step("elements-added", () =>
        call({
            type: "subscription:scene:elements-added",
            driverId,
            requestId: requestId(),
            req: { properties: ["type", "x", "y", "width", "height", "meta"] },
        })
    );
    await step("dragged", () =>
        call({ type: "subscription:scene:drawdy-elements-dragged", driverId, requestId: requestId(), req: undefined })
    );
    await step("selection", () =>
        call({ type: "subscription:scene:drawdy-element-selection", driverId, requestId: requestId(), req: undefined })
    );
    await step("webview-message", () =>
        call({
            type: "subscription:webview:message",
            driverId,
            requestId: requestId(),
            req: { webviewDomId: PANEL_ID },
        })
    );
    console.log("[relationships] activated");
};

const onPanelMessage = async (m: FromPanel) => {
    switch (m.type) {
        case "ready": {
            const { names } = await selectionNames();
            await post({ type: "state", presets: await loadPresets(), selected: names });
            return;
        }
        case "connect": {
            const { bubbles } = await selectionNames();
            if (bubbles.length !== 2) return;
            const preset = (await loadPresets()).find((p) => p.id === m.presetId);
            if (!preset) return;
            await connect(bubbles[0]!.id, bubbles[1]!.id, m.label, preset);
            return;
        }
        case "arrange":
            await arrangeBoard();
            return;
        case "save-preset": {
            const presets = await savePreset(m.preset);
            await applyPreset(m.preset);
            await post({ type: "state", presets, selected: (await selectionNames()).names });
            return;
        }
    }
};

export const onEvent: DriverModule["onEvent"] = async (event) => {
    switch (event.type) {
        case "subscription:scene:pointer-position":
            pointer = event.body.position.canvasSpace;
            return;
        case "subscription:context-menu:clicked": {
            if (event.body.menuId === MENU_PANEL) return openPanel();
            if (event.body.menuId === MENU_SEED) return seed();
            if (event.body.menuId === MENU_ARRANGE) {
                await arrangeBoard();
                return;
            }
            if (event.body.menuId !== MENU_ADD_PERSON) return;
            const { driverId, requestId } = getCtx();
            let at = pointer;
            if (!at) {
                const { rect } = await call({
                    type: "command:camera:get-viewport-rect",
                    driverId,
                    requestId: requestId(),
                    req: undefined,
                });
                at = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
            }
            await addPerson(at.x - 60, at.y - 60, "Name");
            return;
        }
        case "subscription:scene:elements-added":
            if (event.body.drawdyElements.some((e) => e.type === "image")) {
                await new Promise((r) => setTimeout(r, 250));
                await adoptImages();
            }
            return;
        case "subscription:scene:drawdy-elements-dragged":
            if (event.body.type === "dragEnd") {
                // Let the host finish re-routing bound arrows first.
                await new Promise((r) => setTimeout(r, 250));
                await adoptImages();
                await relayoutLabels();
            }
            return;
        case "subscription:scene:drawdy-element-selection":
            if (panelOpen) await post({ type: "selection", selected: (await selectionNames()).names });
            return;
        case "subscription:webview:message":
            await onPanelMessage(event.body.message as FromPanel);
            return;
    }
};
