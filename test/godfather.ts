export const PEOPLE = {
    vito: [400, 150], sonny: [150, 350], michael: [400, 350], fredo: [650, 350], connie: [850, 350],
    kay: [400, 570], apol: [200, 570], carlo: [850, 570], tom: [1130, 150], clem: [1130, 350],
    tessio: [1330, 350], luca: [1230, 570], sol: [200, 900], barz: [700, 900], mccl: [1230, 900],
} as const;

export const RELATIONS: [string, string, string][] = [
    ["vito", "sonny", "father of"], ["vito", "michael", "father of"], ["vito", "fredo", "father of"],
    ["vito", "connie", "father of"], ["michael", "fredo", "brother of"], ["fredo", "michael", "betrays"],
    ["michael", "fredo", "orders his death"], ["michael", "kay", "marries"], ["michael", "apol", "marries"],
    ["connie", "carlo", "married to"], ["carlo", "sonny", "sets him up"], ["michael", "carlo", "has him killed"],
    ["vito", "tom", "adopted"], ["tom", "michael", "consigliere to"], ["vito", "clem", "trusts"],
    ["vito", "tessio", "trusts"], ["tessio", "michael", "betrays"], ["michael", "tessio", "has him executed"],
    ["luca", "vito", "loyal to"], ["sol", "luca", "kills"], ["sol", "vito", "has him shot"],
    ["michael", "sol", "kills"], ["barz", "michael", "plots against"], ["michael", "barz", "kills"],
    ["barz", "tessio", "bribes"], ["mccl", "sol", "protects"], ["michael", "mccl", "kills"],
];
