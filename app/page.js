"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import Alfred from "./alfred";

var C = {
  bg: "#F8F7F4", surface: "#FFFFFF", border: "#E8E5DF", borderLight: "#F0EDE8",
  text: "#1C1917", textSec: "#78716C", textMuted: "#A8A29E",
  accent: "#E85D3A", accentLight: "#FEF1ED", red: "#EF4444",
};

export default function Home() {
  var [session, setSession] = useState(null);
  var [loading, setLoading] = useState(true);
  var [data, setData] = useState(null);
  var [email, setEmail] = useState("");
  var [password, setPassword] = useState("");
  var [name, setName] = useState("");
  var [error, setError] = useState("");
  var [mode, setMode] = useState("login");
  var [authLoading, setAuthLoading] = useState(false);

  useEffect(function () {
    supabase.auth.getSession().then(function (result) {
      if (result.data && result.data.session) {
        setSession(result.data.session);
      }
      setLoading(false);
    });

    var listener = supabase.auth.onAuthStateChange(function (event, newSession) {
      setSession(newSession);
      if (!newSession) setData(null);
    });

    return function () {
      if (listener && listener.data && listener.data.subscription) {
        listener.data.subscription.unsubscribe();
      }
    };
  }, []);

  useEffect(function () {
    if (!session) return;

    async function loadBoard() {
      try {
        var res = await supabase.from("boards").select("data").eq("id", "main").single();
        if (res.data && res.data.data) setData(res.data.data);
      } catch (e) { console.log(e); }
    }

    loadBoard();

    var channel = supabase
      .channel("board-changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "boards", filter: "id=eq.main" }, function (payload) {
        if (payload.new && payload.new.data) setData(payload.new.data);
      })
      .subscribe();

    return function () { supabase.removeChannel(channel); };
  }, [session]);

  function saveData(newData) {
    setData(newData);
    supabase.from("boards").update({ data: newData, updated_at: new Date().toISOString() }).eq("id", "main").then(function () {});
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) { setError("Preencha email e senha."); return; }
    setAuthLoading(true); setError("");
    var result = await supabase.auth.signInWithPassword({ email: email.trim(), password: password.trim() });
    if (result.error) { setError(result.error.message === "Invalid login credentials" ? "Email ou senha incorretos." : result.error.message); }
    setAuthLoading(false);
  }

  async function handleSignup() {
    if (!email.trim() || !password.trim() || !name.trim()) { setError("Preencha todos os campos."); return; }
    if (password.length < 6) { setError("Senha deve ter no mínimo 6 caracteres."); return; }
    setAuthLoading(true); setError("");
    var result = await supabase.auth.signUp({ email: email.trim(), password: password.trim(), options: { data: { name: name.trim() } } });
    if (result.error) { setError(result.error.message); }
    else if (result.data && result.data.user && !result.data.session) { setMode("confirm"); }
    setAuthLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null); setData(null);
  }

  function getUserName() {
    if (session && session.user) {
      if (session.user.user_metadata && session.user.user_metadata.name) return session.user.user_metadata.name;
      return session.user.email.split("@")[0];
    }
    return "Usuário";
  }

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16, fontFamily: "'JetBrains Mono', monospace" }}>A</div>
          <span style={{ fontSize: 18, fontWeight: 600 }}>Carregando...</span>
        </div>
      </div>
    );
  }

  if (!session) {
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

          {mode === "confirm" && (
            <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "14px 18px", marginTop: 20 }}>
              <p style={{ color: "#065F46", fontSize: 14, margin: 0, fontWeight: 500 }}>Conta criada!</p>
              <p style={{ color: "#065F46", fontSize: 13, margin: "6px 0 0", lineHeight: 1.5 }}>Verifique seu email para confirmar. Depois volte e faça login.</p>
              <button onClick={function () { setMode("login"); setError(""); }} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: "none", background: "#10B981", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>Ir para login</button>
            </div>
          )}

          {mode !== "confirm" && (
            <div>
              <p style={{ color: C.textSec, fontSize: 14, marginTop: 16, marginBottom: 24, lineHeight: 1.6 }}>
                {mode === "login" ? "Entre para acessar o dashboard." : "Crie sua conta para acessar."}
              </p>

              {mode === "signup" && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, display: "block" }}>Nome</label>
                  <input value={name} onChange={function (e) { setName(e.target.value); setError(""); }} placeholder="Seu nome" style={{ width: "100%", background: C.bg, border: "1px solid " + C.border, borderRadius: 10, padding: "12px 16px", color: C.text, fontSize: 15, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, display: "block" }}>Email</label>
                <input type="email" autoFocus value={email} onChange={function (e) { setEmail(e.target.value); setError(""); }} onKeyDown={function (e) { if (e.key === "Enter") { mode === "login" ? handleLogin() : handleSignup(); } }} placeholder="seu@email.com" style={{ width: "100%", background: C.bg, border: "1px solid " + C.border, borderRadius: 10, padding: "12px 16px", color: C.text, fontSize: 15, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, display: "block" }}>Senha</label>
                <input type="password" value={password} onChange={function (e) { setPassword(e.target.value); setError(""); }} onKeyDown={function (e) { if (e.key === "Enter") { mode === "login" ? handleLogin() : handleSignup(); } }} placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "Sua senha"} style={{ width: "100%", background: C.bg, border: "1px solid " + C.border, borderRadius: 10, padding: "12px 16px", color: C.text, fontSize: 15, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>

              {error && <p style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}

              <button onClick={mode === "login" ? handleLogin : handleSignup} disabled={authLoading} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: C.accent, color: "#fff", cursor: authLoading ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 600, fontFamily: "inherit", opacity: authLoading ? 0.6 : 1, marginBottom: 16 }}>
                {authLoading ? "Carregando..." : mode === "login" ? "Entrar" : "Criar conta"}
              </button>

              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 13, color: C.textMuted }}>{mode === "login" ? "Não tem conta? " : "Já tem conta? "}</span>
                <button onClick={function () { setMode(mode === "login" ? "signup" : "login"); setError(""); }} style={{ background: "transparent", border: "none", color: C.accent, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>
                  {mode === "login" ? "Criar conta" : "Fazer login"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18, fontFamily: "'JetBrains Mono', monospace", margin: "0 auto 12px" }}>A</div>
          <p style={{ color: C.textSec, fontSize: 14 }}>Carregando board...</p>
        </div>
      </div>
    );
  }

  return <Alfred data={data} onSave={saveData} userName={getUserName()} onLogout={handleLogout} />;
}
