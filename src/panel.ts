import type { Preset } from "./presets";

export const PANEL_ID = "relationships-panel";

export type ToPanel =
    | { type: "state"; presets: Preset[]; selected: string[] }
    | { type: "selection"; selected: string[] };

export type FromPanel =
    | { type: "ready" }
    | { type: "connect"; label: string; presetId: string }
    | { type: "arrange" }
    | { type: "save-preset"; preset: Preset };

export const panelHtml = `<!doctype html>
<html><head><meta charset="utf-8"><style>
:root{color-scheme:light dark;font:14px system-ui,sans-serif}
body{margin:0;padding:14px;display:flex;flex-direction:column;gap:12px}
h3{margin:0;font-size:15px} label{display:flex;flex-direction:column;gap:4px;font-size:12px;opacity:.8}
input,select,button{font:inherit;padding:6px 8px;border-radius:6px;border:1px solid #8885;background:transparent;color:inherit}
button{cursor:pointer;background:#6366f1;color:#fff;border:0} button:disabled{opacity:.4;cursor:default}
.row{display:flex;gap:8px;align-items:center} .sw{width:14px;height:14px;border-radius:50%;flex:none}
.hint{font-size:12px;opacity:.7} hr{border:0;border-top:1px solid #8883;width:100%}
input[type=color]{padding:0;width:36px;height:30px}
</style></head><body>
<h3>Connect people</h3>
<div class="hint" id="sel">Select two people.</div>
<label>Label<input id="label" placeholder="e.g. sister of"></label>
<label>Type<select id="preset"></select></label>
<button id="go" disabled>Connect</button>
<hr>
<h3>Layout</h3>
<button id="arrange">Arrange everyone</button>
<div class="hint">Moves people so related ones sit close and arrows cross less.</div>
<hr>
<h3>Presets</h3>
<div id="list"></div>
<label>Name<input id="pname" placeholder="Mentor"></label>
<div class="row"><input id="pcolor" type="color" value="#8b5cf6"><button id="save">Save preset</button></div>
<script>
const api=acquireDrawdyApi();let presets=[],selected=[];
const $=id=>document.getElementById(id);
const render=()=>{
  $("sel").textContent=selected.length===2?selected[0]+" \\u2192 "+selected[1]:selected.length?"Select one more person.":"Select two people (first = from, second = to).";
  $("go").disabled=selected.length!==2||!$("label").value.trim();
  const cur=$("preset").value;
  $("preset").innerHTML=presets.map(p=>'<option value="'+p.id+'">'+p.name+'</option>').join("");
  if(cur)$("preset").value=cur;
  $("list").innerHTML=presets.map(p=>'<div class="row"><span class="sw" style="background:'+p.color+'"></span>'+p.name+'</div>').join("");
};
api.onMessage(m=>{if(m.type==="state"){presets=m.presets;selected=m.selected}else if(m.type==="selection")selected=m.selected;render()});
$("label").oninput=render;
$("go").onclick=()=>{api.postMessage({type:"connect",label:$("label").value.trim(),presetId:$("preset").value});$("label").value="";render()};
$("arrange").onclick=()=>api.postMessage({type:"arrange"});
$("save").onclick=()=>{const name=$("pname").value.trim();if(!name)return;
  api.postMessage({type:"save-preset",preset:{id:name.toLowerCase().replace(/[^a-z0-9]+/g,"-"),name,color:$("pcolor").value}});$("pname").value=""};
api.postMessage({type:"ready"});
</script></body></html>`;
