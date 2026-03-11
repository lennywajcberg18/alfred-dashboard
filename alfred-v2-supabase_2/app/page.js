"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import Alfred from "./alfred";

var C = {
  bg: "#F8F7F4", surface: "#FFFFFF", border: "#E8E5DF", borderLight: "#F0EDE8",
  text: "#1C1917", textSec: "#78716C", textMuted: "#A8A29E",
  accent: "#E85D3A", accentLight: "#FEF1ED",
};

export default function Home() {
  var [user, setUser] = useState(null);
  var [loading, setLoading] = useState(true);
  var [data, setData] = useState(null);
  var [nameInput, setNameInput] = useState("");
  var [error, setError] = useState("");
  var [members, setMembers] = useState([]);

  // Check if user already logged in
  useEffect(function () {
    try {
      var saved = localStorage.getItem("alfred-user");
      if (saved) setUser(JSON.parse(saved));
    } catch (e) {}
    setLoading(false);
  }, []);

  // Load members
  useEffect(function () {
    async function loadMembers() {
      try {
        var res = await supabase.from("members").select("*").order("created_at");
        if (res.data) setMembers(res.data);
      } catch (e) {}
    }
    loadMembers();
  }, []);

  // Load board data when user is set
  useEffect(function () {
    if (!user) return;

    async function loadBoard() {
      try {
        var res = await supabase.from("boards").select("data").eq("id", "main").single();
        if (res.data && res.data.data) {
          setData(res.data.data);
        }
      } catch (e) {
        console.log("Error loading board:", e);
      }
    }

    loadBoard();

    // Subscribe to realtime changes
    var channel = supabase
      .channel("board-changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "boards", filter: "id=eq.main" }, function (payload) {
        if (payload.new && payload.new.data) {
          setData(payload.new.data);
        }
      })
      .subscribe();

    return function () { supabase.removeChannel(channel); };
  }, [user]);

  // Save data to Supabase
  function saveData(newData) {
    setData(newData);
    supabase.from("boards").update({ data: newData, updated_at: new Date().toISOString() }).eq("id", "main").then(function () {});
  }

  // Login
  async function handleLogin() {
    if (!nameInput.trim()) return;
    var name = nameInput.trim();

    try {
      // Check if member exists
      var existing = await supabase.from("members").select("*").eq("name", name).single();
      var member = null;

      if (existing.data) {
        member = existing.data;
      } else {
        // Create new member
        var created = await supabase.from("members").insert({ name: name, email: name.toLowerCase().replace(/\s+/g, ".") + "@alfred.app" }).select().single();
        if (created.data) {
          member = created.data;
        } else {
          setError("Erro ao criar membro. Verifique se o Supabase está configurado.");
          return;
        }
      }

      var userData = { id: member.id, name: member.name };
      localStorage.setItem("alfred-user", JSON.stringify(userData));
      setUser(userData);
    } catch (e) {
      // Fallback: work without Supabase members table
      var userData = { id: "local_" + Date.now(), name: name };
      localStorage.setItem("alfred-user", JSON.stringify(userData));
      setUser(userData);
    }
  }

  function handleLogout() {
    localStorage.removeItem("alfred-user");
    setUser(null);
    setData(null);
  }

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16, fontFamily: "'JetBrains Mono', monospace" }}>A</div>
          <span style={{ fontSize: 18, fontWeight: 600 }}>Carregando...</span>
        </div>
      </div>
    );
  }

  // Login screen
  if (!user) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <div style={{ background: C.surface, borderRadius: 20, padding: "48px 44px", width: 400, border: "1px solid " + C.borderLight, boxShadow: "0 20px 60px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18, fontFamily: "'JetBrains Mono', monospace" }}>A</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: "-0.4px" }}>Alfred</div>
              <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>AI Router Platform</div>
            </div>
          </div>

          <p style={{ color: C.textSec, fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
            Entre com seu nome para acessar o dashboard compartilhado do time.
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, display: "block" }}>Seu nome</label>
            <input
              autoFocus
              value={nameInput}
              onChange={function (e) { setNameInput(e.target.value); setError(""); }}
              onKeyDown={function (e) { if (e.key === "Enter") handleLogin(); }}
              placeholder="Ex: João, Maria..."
              style={{ width: "100%", background: C.bg, border: "1px solid " + C.border, borderRadius: 10, padding: "12px 16px", color: C.text, fontSize: 15, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>

          {error && <p style={{ color: "#EF4444", fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <button onClick={handleLogin} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: C.accent, color: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 600, fontFamily: "inherit", marginBottom: 20 }}>
            Entrar
          </button>

          {members.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Membros do time</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {members.map(function (m) {
                  return (
                    <button key={m.id} onClick={function () { setNameInput(m.name); }} style={{
                      padding: "6px 14px", borderRadius: 8, border: "1px solid " + C.borderLight,
                      background: nameInput === m.name ? C.accentLight : "transparent",
                      color: nameInput === m.name ? C.accent : C.textSec,
                      cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 500,
                    }}>{m.name}</button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading data
  if (!data) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18, fontFamily: "'JetBrains Mono', monospace", margin: "0 auto 12px" }}>A</div>
          <p style={{ color: C.textSec, fontSize: 14 }}>Carregando board...</p>
        </div>
      </div>
    );
  }

  return <Alfred data={data} onSave={saveData} userName={user.name} onLogout={handleLogout} />;
}
