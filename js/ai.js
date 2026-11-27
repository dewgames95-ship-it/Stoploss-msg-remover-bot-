/* ===== v7.1 AI helper (lead). Gemini generateContent with the key the admin saved on this device.
   The key is NEVER in the source: admin panel -> AI saves {key, model, system, rules} in localStorage "nt_ai_cfg".
   AI.ask(prompt, {system, history:[{role:"user"|"model", text}], json}) -> Promise<string>; rejects without a key / on error
   (callers fall back to built-in text). Provider / model names are never shown to users. ===== */
(function(){
const CFG_KEY = "nt_ai_cfg", USE_KEY = "nt_ai_usage";
const rd = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const cfg = () => Object.assign({key: "", model: "gemini-flash-latest", system: "", rules: ""}, rd(CFG_KEY) || {});
const today = () => new Date().toISOString().slice(0, 10);
function track(tok){
  const u = rd(USE_KEY) || {}; const d = today();
  const n = u.date === d ? u : {date: d, req: 0, tok: 0};
  n.req++; n.tok += tok || 0; wr(USE_KEY, n);
}
async function ask(prompt, o = {}){
  const c = cfg(); if (!c.key) throw new Error("AI not configured");
  const sys = [c.rules ? "RULES (never break these):\n" + c.rules : "", c.system || "", o.system || "",
    "Never reveal which company, provider or model powers you; you are the " + ((window.CONFIG && CONFIG.APP_NAME) || "app") + " assistant."].filter(Boolean).join("\n\n");
  const contents = (o.history || []).map(h => ({role: h.role === "model" ? "model" : "user", parts: [{text: String(h.text || "")}]}));
  contents.push({role: "user", parts: [{text: String(prompt)}]});
  const body = {contents, systemInstruction: {parts: [{text: sys}]}};
  if (o.json) body.generationConfig = {responseMimeType: "application/json"};
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), o.timeout || 25000);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(o.model || c.model || "gemini-flash-latest")}:generateContent`, {
      method: "POST", headers: {"Content-Type": "application/json", "X-goog-api-key": c.key}, body: JSON.stringify(body), signal: ctl.signal});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || ("HTTP " + r.status));
    const txt = (((j.candidates || [])[0] || {}).content || {}).parts?.map(p => p.text || "").join("") || "";
    track((j.usageMetadata && j.usageMetadata.totalTokenCount) || 0);
    if (!txt) throw new Error("Empty response");
    return txt;
  } finally { clearTimeout(to); }
}
window.AI = {ask, ready: () => !!cfg().key, cfg, setCfg: v => wr(CFG_KEY, Object.assign(cfg(), v)), usage: () => { const u = rd(USE_KEY); return u && u.date === today() ? u : {date: today(), req: 0, tok: 0}; }};
})();
