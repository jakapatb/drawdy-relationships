// TEMPORARY: seeds the Godfather board for manual testing. Delete before release.
import { addPerson } from "./people";
import { DEFAULT_PRESETS } from "./presets";
import { connect } from "./relations";

const PEOPLE: Record<string, [string, number, number]> = {
    vito: ["Vito", 400, 150], sonny: ["Sonny", 150, 350], michael: ["Michael", 400, 350], fredo: ["Fredo", 650, 350],
    connie: ["Connie", 850, 350], kay: ["Kay", 400, 570], apol: ["Apollonia", 200, 570], carlo: ["Carlo", 850, 570],
    tom: ["Tom Hagen", 1130, 150], clem: ["Clemenza", 1130, 350], tessio: ["Tessio", 1330, 350], luca: ["Luca Brasi", 1230, 570],
    sol: ["Sollozzo", 200, 900], barz: ["Barzini", 700, 900], mccl: ["McCluskey", 1230, 900],
};
const R: [string, string, string, string][] = [
    ["vito", "sonny", "father of", "family"], ["vito", "michael", "father of", "family"], ["vito", "fredo", "father of", "family"],
    ["vito", "connie", "father of", "family"], ["michael", "fredo", "brother of", "family"], ["fredo", "michael", "betrays", "enemy"],
    ["michael", "fredo", "orders his death", "enemy"], ["michael", "kay", "marries", "romance"], ["michael", "apol", "marries", "romance"],
    ["connie", "carlo", "married to", "romance"], ["carlo", "sonny", "sets him up", "enemy"], ["michael", "carlo", "has him killed", "enemy"],
    ["vito", "tom", "adopted", "family"], ["tom", "michael", "consigliere to", "ally"], ["vito", "clem", "trusts", "ally"],
    ["vito", "tessio", "trusts", "ally"], ["tessio", "michael", "betrays", "enemy"], ["michael", "tessio", "has him executed", "enemy"],
    ["luca", "vito", "loyal to", "ally"], ["sol", "luca", "kills", "enemy"], ["sol", "vito", "has him shot", "enemy"],
    ["michael", "sol", "kills", "enemy"], ["barz", "michael", "plots against", "enemy"], ["michael", "barz", "kills", "enemy"],
    ["barz", "tessio", "bribes", "enemy"], ["mccl", "sol", "protects", "ally"], ["michael", "mccl", "kills", "enemy"],
];

export const seed = async () => {
    const ids: Record<string, string> = {};
    for (const [k, [name, x, y]] of Object.entries(PEOPLE)) ids[k] = await addPerson(x, y, name);
    for (const [a, b, label, preset] of R) {
        await connect(ids[a]!, ids[b]!, label, DEFAULT_PRESETS.find((p) => p.id === preset)!);
    }
};
