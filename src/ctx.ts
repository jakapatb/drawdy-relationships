import type {
    DriverCommandIssuer,
    DriverCommandRequest,
    DriverCommandResponseFor,
} from "@drawdy/driver-protocol";

export type Ctx = {
    issue: DriverCommandIssuer;
    generateId: () => string;
    driverId: string;
    requestId: () => string;
};

let ctx: Ctx;
let seq = 0;

export const initCtx = (
    issue: DriverCommandIssuer,
    generateId: () => string,
    driverId: string
) => {
    ctx = { issue, generateId, driverId, requestId: () => String(seq++) };
};

export const getCtx = () => ctx;

type Value<R extends DriverCommandRequest> = NonNullable<
    Extract<DriverCommandResponseFor<R>["res"], { value: unknown }>["value"]
>;

/** Issue a command and return its value, throwing if the host reports an error. */
export const call = async <R extends DriverCommandRequest>(
    r: R
): Promise<Value<R>> => {
    const res = (await ctx.issue(r)) as { res: { error?: unknown; value?: unknown } };
    if (res.res.error) throw new Error(JSON.stringify(res.res.error));
    return res.res.value as Value<R>;
};
