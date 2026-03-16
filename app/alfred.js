"use client";

import { useState, useEffect, useRef } from "react";

function safeDate(d) {
  try { return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); }
  catch (e) { return d || ""; }
}

var C = {
  bg: "#F8F7F4", surface: "#FFFFFF", border: "#E8E5DF", borderLight: "#F0EDE8",
  text: "#1C1917", textSec: "#78716C", textMuted: "#A8A29E",
  accent: "#E85D3A", accentLight: "#FEF1ED",
  green: "#10B981", greenBg: "#ECFDF5", blue: "#3B82F6", blueBg: "#EFF6FF",
  yellow: "#F59E0B", yellowBg: "#FFFBEB", red: "#EF4444",
  purple: "#8B5CF6", purpleBg: "#F5F3FF",
};

var PRIORITIES = {
  alta: { label: "Alta", color: "#EF4444", bg: "#FEF2F2" },
  media: { label: "Média", color: "#F59E0B", bg: "#FFFBEB" },
  baixa: { label: "Baixa", color: "#10B981", bg: "#F0FDF4" },
};

var IDEA_STATUSES = {
  exploring: { label: "Explorando", color: "#F59E0B" },
  validated: { label: "Validada", color: "#10B981" },
  planned: { label: "Planejada", color: "#3B82F6" },
  archived: { label: "Arquivada", color: "#9CA3AF" },
};

var TAG_COLORS = ["#E85D3A", "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EC4899", "#06B6D4"];
function getTagColor(tag) { var h = 0; for (var i = 0; i < tag.length; i++) h = tag.charCodeAt(i) + ((h << 5) - h); return TAG_COLORS[Math.abs(h) % TAG_COLORS.length]; }

var TEMPLATES = [
  { name: "Feature", icon: "✦", priority: "media", tasks: ["Definir escopo", "Design", "Implementar", "Testar", "Deploy"], tags: ["feature"] },
  { name: "Bug", icon: "🐛", priority: "alta", tasks: ["Reproduzir", "Identificar causa", "Corrigir", "Testar fix"], tags: ["bug"] },
  { name: "Research", icon: "🔍", priority: "baixa", tasks: ["Hipótese", "Coletar dados", "Analisar", "Documentar"], tags: ["research"] },
  { name: "Experiment", icon: "🧪", priority: "media", tasks: ["Definir teste", "Setup", "Rodar", "Avaliar", "Go/no-go"], tags: ["experiment"] },
];

function makeId() { return "id_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7); }
function getToday() { return new Date().toISOString().split("T")[0]; }

function getAllCards(columns) {
  var result = [];
  if (!columns) return result;
  for (var i = 0; i < columns.length; i++) {
    var col = columns[i];
    for (var j = 0; j < col.cards.length; j++) {
      result.push(Object.assign({}, col.cards[j], { colId: col.id, colTitle: col.title }));
    }
  }
  return result;
}

var actIcons = { card_created: "+", card_done: "✓", idea_created: "✦", card_moved: "→", note_created: "✎", doc_created: "▧", idea_voted: "▲", task_done: "☑" };
var actLabels = { card_created: "Card criado", card_done: "Concluído", idea_created: "Nova ideia", card_moved: "Moveu card", note_created: "Nova nota", doc_created: "Novo doc", idea_voted: "Votou", task_done: "Tarefa feita" };

export default function Alfred(props) {
  var boardData = props.data;
  var onSave = props.onSave;
  var userName = props.userName;
  var onLogout = props.onLogout;

  var [page, setPage] = useState("dashboard");
  var [modal, setModal] = useState(null);
  var [search, setSearch] = useState("");
  var [dragInfo, setDragInfo] = useState(null);
  var [dragOver, setDragOver] = useState(null);
  var [aiMessages, setAiMessages] = useState([]);
  var [aiInput, setAiInput] = useState("");
  var [aiLoading, setAiLoading] = useState(false);
  var [focusMode, setFocusMode] = useState(false);
  var [addingToCol, setAddingToCol] = useState(null);
  var [tplCol, setTplCol] = useState(null);
  var [collapsed, setCollapsed] = useState(false);
  var [newColName, setNewColName] = useState("");
  var [addingCol, setAddingCol] = useState(false);
  var aiEndRef = useRef(null);

  useEffect(function () {
    if (aiEndRef.current) aiEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  function update(fn) {
    var next = JSON.parse(JSON.stringify(boardData));
    fn(next);
    onSave(next);
  }

  function addLog(type, label) {
    update(function (d) {
      d.activity.unshift({ id: makeId(), type: type, label: label, by: userName, ts: getToday() });
      if (d.activity.length > 50) d.activity = d.activity.slice(0, 50);
    });
  }

  var allCards = getAllCards(boardData.columns);
  var doneCol = boardData.columns.find(function (c) { return c.id === "done"; });
  var doneCards = doneCol ? doneCol.cards : [];
  var doingCol = boardData.columns.find(function (c) { return c.id === "doing"; });
  var doingCards = doingCol ? doingCol.cards : [];

  var totalChecks = 0, doneChecks = 0;
  allCards.forEach(function (c) {
    if (c.checklist) { totalChecks += c.checklist.length; c.checklist.forEach(function (ck) { if (ck.done) doneChecks++; }); }
  });

  function moveCard(cardId, fromCol, toCol) {
    if (fromCol === toCol) return;
    update(function (d) {
      var from = d.columns.find(function (c) { return c.id === fromCol; });
      var to = d.columns.find(function (c) { return c.id === toCol; });
      var idx = from.cards.findIndex(function (c) { return c.id === cardId; });
      var card = from.cards.splice(idx, 1)[0];
      if (toCol === "done") card.completed = getToday();
      to.cards.push(card);
      d.activity.unshift({ id: makeId(), type: "card_moved", label: card.title, by: userName, ts: getToday() });
    });
  }

  function addFromTemplate(colId, tpl) {
    var card = {
      id: makeId(), title: tpl.icon + " " + tpl.name + ": ", priority: tpl.priority,
      checklist: tpl.tasks.map(function (t, i) { return { id: makeId() + i, text: t, done: false }; }),
      tags: tpl.tags.slice(), ideaId: null, created: getToday(), due: null,
    };
    update(function (d) { d.columns.find(function (c) { return c.id === colId; }).cards.push(card); d.activity.unshift({ id: makeId(), type: "card_created", label: card.title, by: userName, ts: getToday() }); });
    setTplCol(null);
    setModal({ type: "card", card: Object.assign({}, card, { colId: colId }) });
  }

  var velocity = [];
  for (var w = 0; w < 4; w++) {
    var end = new Date(); end.setDate(end.getDate() - w * 7);
    var start = new Date(end); start.setDate(start.getDate() - 7);
    var cnt = 0;
    doneCards.forEach(function (c) { var d = new Date(c.completed || c.created); if (d >= start && d <= end) cnt++; });
    velocity.unshift({ label: "S" + (4 - w), count: cnt });
  }
  var totalVel = 0;
  velocity.forEach(function (v) { totalVel += v.count; });
  var avgVel = velocity.length ? (totalVel / velocity.length).toFixed(1) : "0";

  async function sendAI() {
    if (!aiInput.trim()) return;
    var msg = aiInput.trim();
    setAiMessages(function (m) { return m.concat([{ role: "user", text: msg }]); });
    setAiInput(""); setAiLoading(true);
    var ctx = JSON.stringify({ ideas: boardData.ideas.map(function (i) { return { t: i.title, s: i.status, v: i.votes }; }), cols: boardData.columns.map(function (c) { return { n: c.title, cards: c.cards.map(function (cd) { return { t: cd.title, p: cd.priority }; }) }; }) });
    try {
      var res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: "Voce e o Alfred, assistente do projeto Alfred - plataforma de roteamento inteligente de IAs. Contexto:\n" + ctx + "\nResponda em PT-BR, direto.", messages: [{ role: "user", content: msg }] }) });
      var d = await res.json();
      var text = "";
      if (d.content) { for (var i = 0; i < d.content.length; i++) { if (d.content[i].text) text += d.content[i].text; } }
      if (d.error) text = "Configure ANTHROPIC_API_KEY no Vercel > Settings > Environment Variables.";
      if (!text) text = "Erro ao processar.";
      setAiMessages(function (m) { return m.concat([{ role: "assistant", text: text }]); });
    } catch (e) { setAiMessages(function (m) { return m.concat([{ role: "assistant", text: "Erro de conexão." }]); }); }
    setAiLoading(false);
  }

  var navItems = [
    { id: "dashboard", label: "Dashboard", icon: "◻" }, { id: "ideas", label: "Ideas", icon: "✦" },
    { id: "kanban", label: "Kanban", icon: "▤" }, { id: "checklists", label: "Checklists", icon: "☑" },
    { id: "timeline", label: "Timeline", icon: "━" }, { id: "notes", label: "Reuniões", icon: "✎" },
    { id: "docs", label: "Docs", icon: "▧" }, { id: "mindmap", label: "Mind Map", icon: "◎" },
    { id: "metrics", label: "Métricas", icon: "▥" }, { id: "activity", label: "Atividade", icon: "↻" },
    { id: "ai", label: "Alfred AI", icon: "A" },
  ];

  if (focusMode) {
    var fl = doingCards.slice(0, 5).map(function (c) { return { id: c.id, title: c.title }; });
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 11, color: C.accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Modo Foco</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>O que importa agora</h1>
        </div>
        <div style={{ width: "100%", maxWidth: 480 }}>
          {fl.map(function (t) { return <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: C.surface, borderRadius: 12, marginBottom: 8, border: "1px solid " + C.borderLight }}><span style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>{t.title}</span></div>; })}
          {fl.length === 0 && <p style={{ textAlign: "center", color: C.textMuted }}>Nenhuma tarefa em progresso.</p>}
          <div style={{ textAlign: "center", marginTop: 24 }}><button onClick={function () { setFocusMode(false); }} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, color: C.textSec, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Voltar</button></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* SIDEBAR */}
      <aside style={{ width: collapsed ? 54 : 210, background: C.surface, borderRight: "1px solid " + C.border, display: "flex", flexDirection: "column", flexShrink: 0, transition: "width 0.2s", overflow: "hidden" }}>
        <div style={{ padding: collapsed ? "16px 11px" : "20px 16px 16px", borderBottom: "1px solid " + C.borderLight, cursor: "pointer" }} onClick={function () { setCollapsed(!collapsed); }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>A</div>
            {!collapsed && <div><div style={{ fontWeight: 700, fontSize: 15 }}>Alfred</div><div style={{ fontSize: 10, color: C.textMuted }}>AI Router</div></div>}
          </div>
        </div>
        <nav style={{ padding: collapsed ? "8px 5px" : "8px 7px", flex: 1, overflowY: "auto" }}>
          {navItems.map(function (item) {
            var isAI = item.id === "ai";
            return <button key={item.id} onClick={function () { setPage(item.id); }} title={item.label} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: collapsed ? "8px" : "7px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "inherit", textAlign: "left", marginBottom: 1, justifyContent: collapsed ? "center" : "flex-start", background: page === item.id ? C.accentLight : "transparent", color: page === item.id ? C.accent : C.textSec }}><span style={{ fontSize: isAI ? 12 : 13, fontWeight: isAI ? 800 : 400, fontFamily: isAI ? "'JetBrains Mono', monospace" : "inherit", width: 18, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>{!collapsed && item.label}</button>;
          })}
        </nav>
        {!collapsed && (
          <div style={{ padding: "10px 14px", borderTop: "1px solid " + C.borderLight }}>
            <button onClick={function () { setFocusMode(true); }} style={{ width: "100%", padding: "8px", borderRadius: 7, border: "1px solid " + C.accent + "40", background: C.accentLight, color: C.accent, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", marginBottom: 8 }}>Modo Foco</button>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: C.textSec, fontWeight: 500 }}>{userName}</span>
              <button onClick={onLogout} style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>Sair</button>
            </div>
          </div>
        )}
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, overflow: "auto" }}>

        {/* DASHBOARD */}
        {page === "dashboard" && (
          <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 40px" }}>
            <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700 }}>{"Olá, " + userName + " 👋"}</h1>
            <p style={{ margin: "0 0 24px", color: C.textSec, fontSize: 13.5 }}>Visão geral do Alfred.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 22 }}>
              {[
                { l: "Tarefas", v: allCards.length, bg: C.surface, c: C.text },
                { l: "Em progresso", v: doingCards.length, bg: C.yellowBg, c: C.yellow },
                { l: "Concluídas", v: doneCards.length, bg: C.greenBg, c: C.green },
                { l: "Ideias", v: boardData.ideas.length, bg: C.blueBg, c: C.blue },
                { l: "Velocidade", v: avgVel + "/s", bg: C.purpleBg, c: C.purple },
              ].map(function (s, i) {
                return <div key={i} style={{ background: s.bg, borderRadius: 12, padding: "15px 17px", border: "1px solid " + C.borderLight }}><div style={{ fontSize: 26, fontWeight: 700, color: s.c, fontFamily: "'JetBrains Mono', monospace" }}>{s.v}</div><div style={{ fontSize: 11, color: C.textSec, marginTop: 2, fontWeight: 500 }}>{s.l}</div></div>;
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: C.surface, borderRadius: 12, padding: "18px 20px", border: "1px solid " + C.borderLight }}>
                <div style={{ fontSize: 11, color: C.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Concluídos</div>
                {doneCards.slice(0, 4).map(function (c) { return <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid " + C.borderLight }}><span style={{ color: C.green }}>✓</span><span style={{ fontSize: 13, fontWeight: 500 }}>{c.title}</span></div>; })}
                {doneCards.length === 0 && <p style={{ color: C.textMuted, fontSize: 13 }}>Nenhuma ainda.</p>}
              </div>
              <div style={{ background: C.surface, borderRadius: 12, padding: "18px 20px", border: "1px solid " + C.borderLight }}>
                <div style={{ fontSize: 11, color: C.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Atividade</div>
                {(boardData.activity || []).slice(0, 5).map(function (a) { return <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 0", borderBottom: "1px solid " + C.borderLight, fontSize: 12 }}><span style={{ color: C.accent, fontWeight: 600, width: 14 }}>{actIcons[a.type] || "·"}</span><span style={{ color: C.textSec }}>{actLabels[a.type]}</span><span style={{ fontWeight: 500 }}>{(a.label || "").substring(0, 20)}</span>{a.by && <span style={{ color: C.textMuted, marginLeft: "auto", fontSize: 10 }}>{a.by}</span>}</div>; })}
              </div>
            </div>
          </div>
        )}

        {/* IDEAS */}
        {page === "ideas" && (
          <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 40px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Ideas</h1>
              <button onClick={function () { setModal({ type: "new_idea" }); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>+ Nova ideia</button>
            </div>
            {boardData.ideas.map(function (idea) {
              var st = IDEA_STATUSES[idea.status] || { color: C.border };
              return (
                <div key={idea.id} onClick={function () { setModal({ type: "idea", idea: idea }); }} style={{ background: C.surface, borderRadius: 12, padding: "17px 20px", marginBottom: 8, border: "1px solid " + C.borderLight, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color }} /><h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{idea.title}</h3></div>
                      <p style={{ margin: 0, fontSize: 12.5, color: C.textSec, paddingLeft: 13 }}>{idea.desc}</p>
                    </div>
                    <button onClick={function (e) { e.stopPropagation(); update(function (d) { var f = d.ideas.find(function (x) { return x.id === idea.id; }); if (f) f.votes++; }); }} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 6, border: "1px solid " + C.borderLight, background: C.surface, cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.accent, fontFamily: "'JetBrains Mono', monospace", height: "fit-content" }}>{"▲ " + idea.votes}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* KANBAN */}
        {page === "kanban" && (
          <div style={{ padding: "24px 20px", height: "100%", boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Kanban</h1>
              <input value={search} onChange={function (e) { setSearch(e.target.value); }} placeholder="Buscar..." style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 8, padding: "7px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", width: 160 }} />
            </div>
            <div style={{ display: "flex", gap: 12, height: "calc(100vh - 110px)", overflowX: "auto" }}>
              {boardData.columns.map(function (col) {
                return (
                  <div key={col.id} onDragOver={function (e) { e.preventDefault(); setDragOver(col.id); }} onDragLeave={function () { setDragOver(null); }} onDrop={function (e) { e.preventDefault(); if (dragInfo) moveCard(dragInfo.id, dragInfo.colId, col.id); setDragInfo(null); setDragOver(null); }}
                    style={{ minWidth: 260, flex: "0 0 260px", background: dragOver === col.id ? C.accentLight : C.surface, borderRadius: 12, border: "1px solid " + (dragOver === col.id ? C.accent + "60" : C.borderLight), display: "flex", flexDirection: "column", maxHeight: "100%" }}>
                    <div style={{ padding: "12px 14px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{col.title}</span><span style={{ fontSize: 10.5, color: C.textMuted, fontFamily: "'JetBrains Mono', monospace", background: C.bg, padding: "1px 5px", borderRadius: 4 }}>{col.cards.length}</span></div>
                      <div style={{ display: "flex", gap: 2 }}>
                        <button onClick={function () { setTplCol(tplCol === col.id ? null : col.id); }} style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 12, padding: "0 3px" }}>T</button>
                        <button onClick={function () { setAddingToCol(col.id); }} style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 15, padding: "0 3px" }}>+</button>
                        {boardData.columns.length > 2 && (
                          <button onClick={function () { if (col.cards.length === 0 || confirm("Deletar coluna '" + col.title + "' e seus " + col.cards.length + " cards?")) { update(function (d) { d.columns = d.columns.filter(function (c) { return c.id !== col.id; }); }); } }} style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 13, padding: "0 3px" }}>x</button>
                        )}
                      </div>
                    </div>
                    {tplCol === col.id && (
                      <div style={{ margin: "0 8px 6px", background: C.bg, borderRadius: 8, padding: 8, border: "1px solid " + C.borderLight }}>
                        <div style={{ fontSize: 10, color: C.textSec, fontWeight: 600, marginBottom: 5, textTransform: "uppercase" }}>Templates</div>
                        {TEMPLATES.map(function (tpl) { return <button key={tpl.name} onClick={function () { addFromTemplate(col.id, tpl); }} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "5px 7px", borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", fontSize: 11.5, fontFamily: "inherit", color: C.text, textAlign: "left" }}><span>{tpl.icon}</span>{tpl.name}</button>; })}
                      </div>
                    )}
                    <div style={{ padding: "2px 8px 8px", overflowY: "auto", flex: 1 }}>
                      {col.cards.filter(function (c) { if (!search) return true; return c.title.toLowerCase().indexOf(search.toLowerCase()) >= 0; }).sort(function (a, b) { var order = { alta: 0, media: 1, baixa: 2 }; var pa = order[a.priority] !== undefined ? order[a.priority] : 1; var pb = order[b.priority] !== undefined ? order[b.priority] : 1; return pa - pb; }).map(function (card) {
                        var ckD = 0, ckT = 0;
                        if (card.checklist) { ckT = card.checklist.length; card.checklist.forEach(function (ck) { if (ck.done) ckD++; }); }
                        var prio = PRIORITIES[card.priority];
                        return (
                          <div key={card.id} draggable onDragStart={function () { setDragInfo({ id: card.id, colId: col.id }); }} onClick={function () { setModal({ type: "card", card: Object.assign({}, card, { colId: col.id }) }); }}
                            style={{ background: C.bg, borderRadius: 9, padding: "11px 13px", marginBottom: 6, cursor: "grab", border: "1px solid " + C.borderLight }}>
                            {(card.tags || []).length > 0 && <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>{card.tags.map(function (t) { return <span key={t} style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 4, background: getTagColor(t) + "18", color: getTagColor(t), fontWeight: 600 }}>{t}</span>; })}</div>}
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>{card.title}</div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                {prio && <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9.5, fontWeight: 600, background: prio.bg, color: prio.color }}>{prio.label}</span>}
                                {ckT > 0 && <span style={{ fontSize: 10, color: ckD === ckT ? C.green : C.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{"✓" + ckD + "/" + ckT}</span>}
                              </div>
                              {card.due && <span style={{ fontSize: 10, color: C.textMuted }}>{safeDate(card.due)}</span>}
                            </div>
                          </div>
                        );
                      })}
                      {addingToCol === col.id && <QuickAdd onAdd={function (card) { update(function (d) { d.columns.find(function (x) { return x.id === col.id; }).cards.push(Object.assign({}, card, { id: makeId(), created: getToday() })); d.activity.unshift({ id: makeId(), type: "card_created", label: card.title, by: userName, ts: getToday() }); }); setAddingToCol(null); }} onClose={function () { setAddingToCol(null); }} />}
                    </div>
                  </div>
                );
              })}

              {/* Add new column */}
              {addingCol ? (
                <div style={{ minWidth: 260, flex: "0 0 260px", background: C.surface, borderRadius: 12, border: "1px solid " + C.accent + "60", padding: 14 }}>
                  <input autoFocus value={newColName} onChange={function (e) { setNewColName(e.target.value); }} onKeyDown={function (e) {
                    if (e.key === "Enter" && newColName.trim()) {
                      update(function (d) { d.columns.push({ id: makeId(), title: newColName.trim(), cards: [] }); });
                      setNewColName(""); setAddingCol(false);
                    }
                  }} placeholder="Nome da coluna..." style={{ width: "100%", background: C.bg, border: "1px solid " + C.borderLight, borderRadius: 8, padding: "10px 12px", color: C.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={function () { if (newColName.trim()) { update(function (d) { d.columns.push({ id: makeId(), title: newColName.trim(), cards: [] }); }); setNewColName(""); setAddingCol(false); } }} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>Criar</button>
                    <button onClick={function () { setAddingCol(false); setNewColName(""); }} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid " + C.borderLight, background: "transparent", color: C.textMuted, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>x</button>
                  </div>
                </div>
              ) : (
                <button onClick={function () { setAddingCol(true); }} style={{ minWidth: 260, flex: "0 0 260px", padding: 16, borderRadius: 12, border: "2px dashed " + C.borderLight, background: "transparent", color: C.textMuted, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 500, height: "fit-content" }}>+ Nova Coluna</button>
              )}
            </div>
          </div>
        )}

        {/* CHECKLISTS */}
        {page === "checklists" && (
          <div style={{ maxWidth: 660, margin: "0 auto", padding: "32px 40px" }}>
            <h1 style={{ margin: "0 0 3px", fontSize: 24, fontWeight: 700 }}>Checklists</h1>
            <p style={{ margin: "0 0 10px", color: C.textSec, fontSize: 13 }}>{doneChecks + " de " + totalChecks}</p>
            <div style={{ height: 4, background: C.borderLight, borderRadius: 2, marginBottom: 22, overflow: "hidden" }}><div style={{ height: "100%", background: C.accent, borderRadius: 2, width: totalChecks ? (doneChecks / totalChecks * 100) + "%" : 0 }} /></div>
            {allCards.filter(function (c) { return c.checklist && c.checklist.length > 0; }).map(function (card) {
              return (
                <div key={card.id} style={{ background: C.surface, borderRadius: 12, padding: "18px 22px", marginBottom: 8, border: "1px solid " + C.borderLight }}>
                  <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600 }}>{card.title} <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 400 }}>{"· " + card.colTitle}</span></h3>
                  {card.checklist.map(function (item) {
                    return <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: "pointer", borderTop: "1px solid " + C.borderLight }}><input type="checkbox" checked={item.done} onChange={function () { update(function (d) { d.columns.forEach(function (col) { col.cards.forEach(function (c) { if (c.checklist) { var ck = c.checklist.find(function (x) { return x.id === item.id; }); if (ck) ck.done = !ck.done; } }); }); }); }} style={{ accentColor: C.accent, width: 15, height: 15 }} /><span style={{ fontSize: 13, color: item.done ? C.textMuted : C.text, textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span></label>;
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* TIMELINE */}
        {page === "timeline" && (
          <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 40px" }}>
            <h1 style={{ margin: "0 0 22px", fontSize: 24, fontWeight: 700 }}>Timeline</h1>
            <div style={{ position: "relative", paddingLeft: 24 }}>
              <div style={{ position: "absolute", left: 7, top: 0, bottom: 0, width: 2, background: C.borderLight }} />
              {allCards.sort(function (a, b) { return (a.due || a.created || "").localeCompare(b.due || b.created || ""); }).map(function (card) {
                var dc = card.colId === "done" ? C.green : card.colId === "doing" ? C.yellow : C.border;
                return (
                  <div key={card.id} style={{ position: "relative", marginBottom: 14, paddingLeft: 26 }}>
                    <div style={{ position: "absolute", left: -2, top: 8, width: 10, height: 10, borderRadius: "50%", background: dc, border: "2px solid " + C.bg, zIndex: 1 }} />
                    <div style={{ background: C.surface, borderRadius: 10, padding: "13px 17px", border: "1px solid " + C.borderLight }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{card.title}</div>
                      <div style={{ display: "flex", gap: 12, fontSize: 11, color: C.textMuted }}><span>{"Criado: " + safeDate(card.created)}</span>{card.due && <span>{"Prazo: " + safeDate(card.due)}</span>}{card.completed && <span style={{ color: C.green }}>{"Feito: " + safeDate(card.completed)}</span>}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* NOTES */}
        {page === "notes" && (
          <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 40px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}><h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Notas de Reunião</h1><button onClick={function () { setModal({ type: "new_note" }); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>+ Nova nota</button></div>
            {(boardData.notes || []).map(function (note) {
              return <div key={note.id} onClick={function () { setModal({ type: "note", note: note }); }} style={{ background: C.surface, borderRadius: 12, padding: "17px 20px", marginBottom: 8, border: "1px solid " + C.borderLight, cursor: "pointer" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{note.title}</h3><span style={{ fontSize: 11, color: C.textMuted }}>{safeDate(note.date)}</span></div><p style={{ margin: 0, fontSize: 12.5, color: C.textSec, whiteSpace: "pre-wrap" }}>{note.content.substring(0, 120)}</p></div>;
            })}
          </div>
        )}

        {/* DOCS */}
        {page === "docs" && (
          <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 40px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}><h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Docs</h1><button onClick={function () { setModal({ type: "new_doc" }); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>+ Novo doc</button></div>
            {(boardData.docs || []).map(function (doc) {
              return <div key={doc.id} onClick={function () { setModal({ type: "doc", doc: doc }); }} style={{ background: C.surface, borderRadius: 12, padding: "17px 20px", marginBottom: 8, border: "1px solid " + C.borderLight, cursor: "pointer" }}><h3 style={{ margin: "0 0 5px", fontSize: 14, fontWeight: 600 }}>{doc.title}</h3><p style={{ margin: 0, fontSize: 12.5, color: C.textSec }}>{doc.content.substring(0, 100).replace(/[#*]/g, "")}</p></div>;
            })}
          </div>
        )}

        {/* MIND MAP */}
        {page === "mindmap" && (
          <div style={{ padding: "32px 40px", height: "100%", boxSizing: "border-box" }}>
            <h1 style={{ margin: "0 0 18px", fontSize: 24, fontWeight: 700 }}>Mind Map</h1>
            <div style={{ background: C.surface, borderRadius: 14, border: "1px solid " + C.borderLight, overflow: "hidden", height: "calc(100vh - 140px)" }}>
              <svg viewBox="0 0 800 600" style={{ width: "100%", height: "100%" }}>
                <circle cx={400} cy={300} r={40} fill={C.accent} opacity={0.9} />
                <text x={400} y={296} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700" fontFamily="Outfit">Alfred</text>
                <text x={400} y={310} textAnchor="middle" fill="#fff" fontSize="9" opacity={0.8}>AI Router</text>
                {boardData.ideas.map(function (idea, i) {
                  var angle = (2 * Math.PI * i) / boardData.ideas.length - Math.PI / 2;
                  var ix = 400 + 190 * Math.cos(angle), iy = 300 + 190 * Math.sin(angle);
                  var st = IDEA_STATUSES[idea.status] || { color: C.border };
                  var t = idea.title.length > 15 ? idea.title.substring(0, 15) + "…" : idea.title;
                  return (
                    <g key={idea.id}>
                      <line x1={400} y1={300} x2={ix} y2={iy} stroke={C.border} strokeWidth={1.5} strokeDasharray={idea.status === "exploring" ? "4,4" : "none"} />
                      <rect x={ix - 68} y={iy - 20} width={136} height={40} rx={9} fill={C.surface} stroke={st.color} strokeWidth={1.5} />
                      <text x={ix - 42} y={iy + 1} fontSize="10.5" fontWeight="600" fill={C.text} fontFamily="Outfit">{t}</text>
                      <text x={ix + 53} y={iy + 1} textAnchor="end" fontSize="9" fill={C.accent} fontFamily="JetBrains Mono" fontWeight="600">{"▲" + idea.votes}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* METRICS */}
        {page === "metrics" && (
          <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 40px" }}>
            <h1 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 700 }}>Métricas</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                { l: "Velocidade", v: avgVel, u: "cards/semana", c: C.accent },
                { l: "Conclusão", v: allCards.length ? Math.round((doneCards.length / allCards.length) * 100) + "%" : "0%", u: "do total", c: C.green },
                { l: "Checklists", v: totalChecks ? Math.round((doneChecks / totalChecks) * 100) + "%" : "0%", u: doneChecks + "/" + totalChecks, c: C.blue },
              ].map(function (m, i) { return <div key={i} style={{ background: C.surface, borderRadius: 12, padding: "20px 22px", border: "1px solid " + C.borderLight }}><div style={{ fontSize: 32, fontWeight: 700, color: m.c, fontFamily: "'JetBrains Mono', monospace" }}>{m.v}</div><div style={{ fontSize: 12, color: C.textSec }}>{m.l}</div><div style={{ fontSize: 11, color: C.textMuted }}>{m.u}</div></div>; })}
            </div>
          </div>
        )}

        {/* ACTIVITY */}
        {page === "activity" && (
          <div style={{ maxWidth: 620, margin: "0 auto", padding: "32px 40px" }}>
            <h1 style={{ margin: "0 0 22px", fontSize: 24, fontWeight: 700 }}>Atividade</h1>
            {(boardData.activity || []).map(function (a) {
              var dc = (a.type || "").indexOf("done") >= 0 ? C.green : (a.type || "").indexOf("created") >= 0 ? C.accent : C.blue;
              return <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.surface, borderRadius: 9, marginBottom: 6, border: "1px solid " + C.borderLight }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: dc, flexShrink: 0 }} /><div style={{ flex: 1, fontSize: 13 }}><span style={{ color: C.textSec }}>{actLabels[a.type] || a.type}</span> <span style={{ fontWeight: 600 }}>{a.label}</span></div>{a.by && <span style={{ fontSize: 11, color: C.textMuted }}>{a.by}</span>}<span style={{ fontSize: 10, color: C.textMuted }}>{safeDate(a.ts)}</span></div>;
            })}
          </div>
        )}

        {/* AI */}
        {page === "ai" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 720, margin: "0 auto", padding: "0 40px" }}>
            <div style={{ padding: "32px 0 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}><div style={{ width: 26, height: 26, borderRadius: 6, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>A</div><h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Alfred AI</h1></div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", paddingBottom: 16 }}>
              {aiMessages.length === 0 && (
                <div style={{ textAlign: "center", padding: "48px 20px" }}>
                  <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 20 }}>Pergunte sobre prioridades, progresso ou brainstorme.</p>
                  <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                    {["O que priorizar?", "Próximos passos", "Analise progresso"].map(function (s) { return <button key={s} onClick={function () { setAiInput(s); }} style={{ padding: "7px 13px", borderRadius: 7, border: "1px solid " + C.border, background: C.surface, color: C.textSec, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{s}</button>; })}
                  </div>
                </div>
              )}
              {aiMessages.map(function (m, i) { var isU = m.role === "user"; return <div key={i} style={{ display: "flex", justifyContent: isU ? "flex-end" : "flex-start", marginBottom: 12 }}><div style={{ maxWidth: "75%", padding: "11px 16px", borderRadius: 13, fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", background: isU ? C.accent : C.surface, color: isU ? "#fff" : C.text, border: isU ? "none" : "1px solid " + C.borderLight, borderBottomRightRadius: isU ? 4 : 13, borderBottomLeftRadius: isU ? 13 : 4 }}>{m.text}</div></div>; })}
              {aiLoading && <div style={{ color: C.textMuted, fontSize: 13 }}>Alfred está pensando...</div>}
              <div ref={aiEndRef} />
            </div>
            <div style={{ padding: "12px 0 32px", borderTop: "1px solid " + C.borderLight }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={aiInput} onChange={function (e) { setAiInput(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter") sendAI(); }} placeholder="Pergunte ao Alfred..." style={{ flex: 1, background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: "11px 16px", color: C.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                <button onClick={sendAI} disabled={aiLoading} style={{ padding: "11px 18px", borderRadius: 10, border: "none", background: C.accent, color: "#fff", cursor: aiLoading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", opacity: aiLoading ? 0.5 : 1 }}>Enviar</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      {modal && (
        <div onClick={function () { setModal(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={function (e) { e.stopPropagation(); }} style={{ background: C.surface, borderRadius: 16, padding: 26, width: 510, maxHeight: "82vh", overflowY: "auto", border: "1px solid " + C.border, boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }}>
            {modal.type === "card" && <CardModal card={modal.card} data={boardData} update={update} setModal={setModal} moveCard={moveCard} userName={userName} />}
            {modal.type === "idea" && <IdeaModal idea={modal.idea} update={update} setModal={setModal} />}
            {modal.type === "new_idea" && <NewForm type="idea" update={update} setModal={setModal} userName={userName} />}
            {modal.type === "note" && <TextModal item={modal.note} table="notes" update={update} setModal={setModal} />}
            {modal.type === "new_note" && <NewForm type="note" update={update} setModal={setModal} userName={userName} />}
            {modal.type === "doc" && <TextModal item={modal.doc} table="docs" update={update} setModal={setModal} />}
            {modal.type === "new_doc" && <NewForm type="doc" update={update} setModal={setModal} userName={userName} />}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickAdd(props) {
  var [title, setTitle] = useState("");
  var [prio, setPrio] = useState("media");
  return (
    <div style={{ background: C.surface, borderRadius: 9, padding: 11, border: "1px solid " + C.accent + "40" }}>
      <input autoFocus value={title} onChange={function (e) { setTitle(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter" && title.trim()) props.onAdd({ title: title, priority: prio, checklist: [], tags: [], ideaId: null, due: null }); }} placeholder="Titulo..." style={{ width: "100%", background: C.bg, border: "1px solid " + C.borderLight, borderRadius: 6, padding: "7px 10px", color: C.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 6 }} />
      <div style={{ display: "flex", gap: 3, marginBottom: 7 }}>{Object.keys(PRIORITIES).map(function (k) { var p = PRIORITIES[k]; return <button key={k} onClick={function () { setPrio(k); }} style={{ padding: "3px 8px", borderRadius: 4, border: prio === k ? "2px solid " + p.color : "1px solid " + C.borderLight, background: prio === k ? p.bg : "transparent", color: p.color, cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "inherit" }}>{p.label}</button>; })}</div>
      <div style={{ display: "flex", gap: 5 }}><button onClick={function () { if (title.trim()) props.onAdd({ title: title, priority: prio, checklist: [], tags: [], ideaId: null, due: null }); }} style={{ flex: 1, padding: 6, borderRadius: 6, border: "none", background: C.accent, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>Criar</button><button onClick={props.onClose} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid " + C.borderLight, background: "transparent", color: C.textMuted, cursor: "pointer", fontSize: 11 }}>x</button></div>
    </div>
  );
}

function CardModal(props) {
  var card = props.card;
  var [title, setTitle] = useState(card.title);
  var [newTask, setNewTask] = useState("");
  function onUpdate(u) { props.update(function (d) { var col = d.columns.find(function (c) { return c.id === card.colId; }); var f = col ? col.cards.find(function (c) { return c.id === card.id; }) : null; if (f) Object.assign(f, u); }); props.setModal(function (m) { return { type: "card", card: Object.assign({}, m.card, u) }; }); }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}><input value={title} onChange={function (e) { setTitle(e.target.value); }} onBlur={function () { onUpdate({ title: title }); }} style={{ background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 17, fontWeight: 700, fontFamily: "inherit", flex: 1 }} /><button onClick={function () { props.setModal(null); }} style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 18 }}>x</button></div>
      <div style={{ fontSize: 11, color: C.textSec, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Prioridade</div>
      <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>{Object.keys(PRIORITIES).map(function (k) { var p = PRIORITIES[k]; return <button key={k} onClick={function () { onUpdate({ priority: k }); }} style={{ padding: "5px 12px", borderRadius: 6, border: card.priority === k ? "2px solid " + p.color : "1px solid " + C.borderLight, background: card.priority === k ? p.bg : "transparent", color: p.color, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>{p.label}</button>; })}</div>
      <div style={{ fontSize: 11, color: C.textSec, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Mover para</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>{props.data.columns.map(function (col) { return <button key={col.id} onClick={function () { if (col.id !== card.colId) { props.moveCard(card.id, card.colId, col.id); props.setModal(null); } }} style={{ padding: "5px 10px", borderRadius: 6, fontSize: 12, fontFamily: "inherit", border: col.id === card.colId ? "2px solid " + C.accent : "1px solid " + C.borderLight, background: col.id === card.colId ? C.accentLight : "transparent", color: col.id === card.colId ? C.accent : C.textSec, cursor: col.id === card.colId ? "default" : "pointer" }}>{col.title}</button>; })}</div>
      <div style={{ fontSize: 11, color: C.textSec, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Checklist</div>
      {(card.checklist || []).map(function (item) { return <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0", borderBottom: "1px solid " + C.borderLight }}><input type="checkbox" checked={item.done} onChange={function () { onUpdate({ checklist: card.checklist.map(function (x) { return x.id === item.id ? Object.assign({}, x, { done: !x.done }) : x; }) }); }} style={{ accentColor: C.accent, width: 14, height: 14 }} /><span style={{ flex: 1, fontSize: 13, textDecoration: item.done ? "line-through" : "none", color: item.done ? C.textMuted : C.text }}>{item.text}</span><button onClick={function () { onUpdate({ checklist: card.checklist.filter(function (x) { return x.id !== item.id; }) }); }} style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer" }}>x</button></div>; })}
      <div style={{ display: "flex", gap: 7, marginTop: 8, marginBottom: 14 }}><input value={newTask} onChange={function (e) { setNewTask(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter" && newTask.trim()) { onUpdate({ checklist: (card.checklist || []).concat([{ id: makeId(), text: newTask, done: false }]) }); setNewTask(""); } }} placeholder="Nova tarefa..." style={{ flex: 1, background: C.bg, border: "1px solid " + C.borderLight, borderRadius: 6, padding: "7px 10px", color: C.text, fontSize: 12, outline: "none", fontFamily: "inherit" }} /><button onClick={function () { if (newTask.trim()) { onUpdate({ checklist: (card.checklist || []).concat([{ id: makeId(), text: newTask, done: false }]) }); setNewTask(""); } }} style={{ padding: "7px 11px", borderRadius: 6, border: "none", background: C.accent, color: "#fff", cursor: "pointer", fontSize: 12 }}>+</button></div>
      <button onClick={function () { props.update(function (d) { var col = d.columns.find(function (c) { return c.id === card.colId; }); col.cards = col.cards.filter(function (c) { return c.id !== card.id; }); }); props.setModal(null); }} style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid #FEE2E2", background: "transparent", color: C.red, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Deletar card</button>
    </div>
  );
}

function IdeaModal(props) {
  var idea = props.idea;
  var [title, setTitle] = useState(idea.title);
  var [desc, setDesc] = useState(idea.desc || "");
  function onUpdate(u) { props.update(function (d) { var f = d.ideas.find(function (x) { return x.id === idea.id; }); if (f) Object.assign(f, u); }); props.setModal(function (m) { return { type: "idea", idea: Object.assign({}, m.idea, u) }; }); }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}><input value={title} onChange={function (e) { setTitle(e.target.value); }} onBlur={function () { onUpdate({ title: title }); }} style={{ background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 17, fontWeight: 700, fontFamily: "inherit", flex: 1 }} /><button onClick={function () { props.setModal(null); }} style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 18 }}>x</button></div>
      <textarea value={desc} onChange={function (e) { setDesc(e.target.value); }} onBlur={function () { onUpdate({ desc: desc }); }} rows={3} style={{ width: "100%", background: C.bg, border: "1px solid " + C.borderLight, borderRadius: 8, padding: 12, color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 14 }} />
      <div style={{ fontSize: 11, color: C.textSec, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Status</div>
      <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>{Object.keys(IDEA_STATUSES).map(function (k) { var st = IDEA_STATUSES[k]; return <button key={k} onClick={function () { onUpdate({ status: k }); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: idea.status === k ? "2px solid " + st.color : "1px solid " + C.borderLight, background: idea.status === k ? st.color + "11" : "transparent", color: idea.status === k ? st.color : C.textSec, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color }} />{st.label}</button>; })}</div>
      <button onClick={function () { props.update(function (d) { d.ideas = d.ideas.filter(function (x) { return x.id !== idea.id; }); }); props.setModal(null); }} style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid #FEE2E2", background: "transparent", color: C.red, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Deletar ideia</button>
    </div>
  );
}

function TextModal(props) {
  var item = props.item;
  var table = props.table;
  var [title, setTitle] = useState(item.title);
  var [content, setContent] = useState(item.content);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}><input value={title} onChange={function (e) { setTitle(e.target.value); }} onBlur={function () { props.update(function (d) { var f = d[table].find(function (x) { return x.id === item.id; }); if (f) f.title = title; }); }} style={{ background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 17, fontWeight: 700, fontFamily: "inherit", flex: 1 }} /><button onClick={function () { props.setModal(null); }} style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 18 }}>x</button></div>
      <textarea value={content} onChange={function (e) { setContent(e.target.value); }} onBlur={function () { props.update(function (d) { var f = d[table].find(function (x) { return x.id === item.id; }); if (f) { f.content = content; if (f.updated !== undefined) f.updated = getToday(); } }); }} rows={12} style={{ width: "100%", background: C.bg, border: "1px solid " + C.borderLight, borderRadius: 8, padding: 14, color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "'JetBrains Mono', monospace", boxSizing: "border-box", lineHeight: 1.7, marginBottom: 14 }} />
      <button onClick={function () { props.update(function (d) { d[table] = d[table].filter(function (x) { return x.id !== item.id; }); }); props.setModal(null); }} style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid #FEE2E2", background: "transparent", color: C.red, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Deletar</button>
    </div>
  );
}

function NewForm(props) {
  var [title, setTitle] = useState("");
  var [content, setContent] = useState("");
  var type = props.type;
  var label = type === "idea" ? "Ideia" : type === "note" ? "Nota" : "Doc";
  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700 }}>{"Novo " + label}</h2>
      <input autoFocus value={title} onChange={function (e) { setTitle(e.target.value); }} placeholder="Titulo..." style={{ width: "100%", background: C.bg, border: "1px solid " + C.borderLight, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }} />
      <textarea value={content} onChange={function (e) { setContent(e.target.value); }} placeholder={type === "idea" ? "Descricao..." : "Conteudo..."} rows={type === "idea" ? 2 : 6} style={{ width: "100%", background: C.bg, border: "1px solid " + C.borderLight, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: type === "idea" ? "inherit" : "'JetBrains Mono', monospace", boxSizing: "border-box", marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={function () {
          if (!title.trim()) return;
          props.update(function (d) {
            if (type === "idea") {
              d.ideas.push({ id: makeId(), title: title, desc: content, status: "exploring", votes: 0, tags: [], date: getToday() });
              d.activity.unshift({ id: makeId(), type: "idea_created", label: title, by: props.userName, ts: getToday() });
            } else if (type === "note") {
              d.notes.unshift({ id: makeId(), title: title, date: getToday(), content: content });
              d.activity.unshift({ id: makeId(), type: "note_created", label: title, by: props.userName, ts: getToday() });
            } else {
              d.docs.unshift({ id: makeId(), title: title, content: content, tags: [], updated: getToday() });
              d.activity.unshift({ id: makeId(), type: "doc_created", label: title, by: props.userName, ts: getToday() });
            }
          });
          props.setModal(null);
        }} style={{ flex: 1, padding: 9, borderRadius: 8, border: "none", background: C.accent, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>Criar</button>
        <button onClick={function () { props.setModal(null); }} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid " + C.border, background: "transparent", color: C.textSec, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Cancelar</button>
      </div>
    </div>
  );
}