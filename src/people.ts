import type { SubscribedDrawdyElement } from "@drawdy/driver-protocol";
import { call, getCtx } from "./ctx";

export const BUBBLE_SIZE = 120;
const AVATAR_PX = 256;
const RING_COLOR = "#6366f1";

/** A bubble is any circle shape that is as wide as it is tall. */
export const isBubble = (el: SubscribedDrawdyElement) =>
    el.type === "path" &&
    el.componentType === "circle" &&
    Math.abs((el.width ?? 0) - (el.height ?? 0)) < 1;

export const addPerson = async (x: number, y: number, name: string) => {
    const { generateId, driverId, requestId } = getCtx();
    const id = generateId();
    const groupId = generateId();
    await call({
        type: "command:scene:add-drawdy-elements",
        driverId,
        requestId: requestId(),
        req: {
            elements: [
                {
                    type: "shape",
                    componentType: "circle",
                    drawdyElementId: id,
                    groupId,
                    x,
                    y,
                    width: BUBBLE_SIZE,
                    height: BUBBLE_SIZE,
                    strokeColor: RING_COLOR,
                    fillColor: "#e0e7ff",
                    strokeWidth: 3,
                    roughness: 0,
                    meta: { relationships: "person" },
                },
                {
                    type: "text",
                    drawdyElementId: generateId(),
                    groupId,
                    x,
                    y: y + BUBBLE_SIZE + 8,
                    width: BUBBLE_SIZE,
                    text: name,
                    fontSize: 16,
                    color: RING_COLOR,
                    textAlign: "center",
                    meta: { relationships: "name", of: id },
                },
            ],
        },
    });
    return id;
};

/** Center-crop to a square and mask to a circle. */
const cropCircle = async (blob: Blob): Promise<Blob> => {
    const bmp = await createImageBitmap(blob);
    const side = Math.min(bmp.width, bmp.height);
    const canvas = new OffscreenCanvas(AVATAR_PX, AVATAR_PX);
    const g = canvas.getContext("2d")!;
    g.beginPath();
    g.arc(AVATAR_PX / 2, AVATAR_PX / 2, AVATAR_PX / 2, 0, Math.PI * 2);
    g.clip();
    g.drawImage(
        bmp,
        (bmp.width - side) / 2,
        (bmp.height - side) / 2,
        side,
        side,
        0,
        0,
        AVATAR_PX,
        AVATAR_PX
    );
    bmp.close();
    return canvas.convertToBlob({ type: "image/png" });
};

const handled = new Set<string>();

/**
 * Any plain image whose center sits inside a bubble becomes that bubble's
 * circle-cropped avatar. Runs when images are added and when a drag ends, so
 * both dropping a file and dragging an image over a bubble work.
 */
export const adoptImages = async () => {
    const { generateId, driverId, requestId } = getCtx();

    const all = await call({
        type: "command:scene:get-drawdy-elements",
        driverId,
        requestId: requestId(),
        req: {
            properties: ["type", "componentType", "x", "y", "width", "height", "groupId", "meta"],
        },
    });
    const bubbles = all.drawdyElements.filter(isBubble);
    const images = all.drawdyElements.filter(
        (e) => e.type === "image" && !handled.has(e.id) && !e.meta?.relationships
    );
    if (!bubbles.length || !images.length) return;

    for (const img of images) {
        const cx = (img.x ?? 0) + (img.width ?? 0) / 2;
        const cy = (img.y ?? 0) + (img.height ?? 0) / 2;
        const bubble = bubbles.find((b) => {
            const r = (b.width ?? 0) / 2;
            return Math.hypot(cx - (b.x ?? 0) - r, cy - (b.y ?? 0) - r) <= r;
        });
        if (!bubble) continue;
        handled.add(img.id);

        const { blob } = await call({
            type: "command:scene:get-image-source",
            driverId,
            requestId: requestId(),
            req: { drawdyElementId: img.id },
        });
        const cropped = await cropCircle(blob);

        // Replace any previous avatar of this bubble.
        const old = all.drawdyElements
            .filter((e) => e.meta?.relationships === "avatar" && e.meta?.of === bubble.id)
            .map((e) => e.id);
        const inset = 6;
        const avatarId = generateId();
        handled.add(avatarId);
        await call({
            type: "command:scene:remove-drawdy-elements",
            driverId,
            requestId: requestId(),
            req: { drawdyElementIds: [img.id, ...old] },
        });
        await call({
            type: "command:scene:add-drawdy-elements",
            driverId,
            requestId: requestId(),
            req: {
                elements: [
                    {
                        type: "image",
                        drawdyElementId: avatarId,
                        groupId: bubble.groupId,
                        x: (bubble.x ?? 0) + inset,
                        y: (bubble.y ?? 0) + inset,
                        width: (bubble.width ?? 0) - inset * 2,
                        height: (bubble.height ?? 0) - inset * 2,
                        blob: cropped,
                        meta: { relationships: "avatar", of: bubble.id },
                    },
                ],
            },
        });
    }
};
