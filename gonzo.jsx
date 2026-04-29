"use client";
import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Search, Plus, ChevronDown, ChevronRight, ChevronLeft, Home, Users,
  Film, ClipboardList, FileText, BarChart3, Filter, Lightbulb,
  Settings, Sparkles, MoreHorizontal, Clock, Link2, Heart, Eye,
  ArrowUpRight, Check, Circle, Star, Bookmark, Inbox,
  CheckCircle2, AlertCircle, Zap, Image as ImageIcon, Mail, Phone,
  Instagram, Music2, ArrowRight, Send, FolderOpen, RefreshCw, X,
  Loader2, Wand2, Unplug, Trash2, Menu, Shield, LogOut, Crown,
  TrendingUp, Download, Upload, HardDrive, Type, Palette, Camera,
  Lock, UserPlus, Calendar, Play, Pause, Square, Euro, Target,
  MessageCircle, MessageSquare, Reply, Layers, Copy, GripVertical,
  AlignLeft, List as ListIcon, CheckSquare, Quote, Presentation,
  Briefcase, Award, ListChecks, Heading1, Heading2
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif`;
const SERIF = `"Cormorant Garamond", "Playfair Display", Georgia, serif`;

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("app render error:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", background: "#0a1729", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONT }}>
        <div style={{ maxWidth: 760, width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 18, padding: 28 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>Error de aplicacion</div>
          <div style={{ color: "rgba(255,255,255,.68)", marginBottom: 18 }}>La app ha capturado el fallo. Copia este mensaje para depurarlo:</div>
          <pre style={{ whiteSpace: "pre-wrap", overflow: "auto", background: "rgba(0,0,0,.28)", borderRadius: 12, padding: 16, color: "#ffb4ab", fontSize: 13 }}>{this.state.error?.stack || this.state.error?.message || String(this.state.error)}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 18, border: "none", borderRadius: 999, padding: "10px 18px", cursor: "pointer", background: "#fff", color: "#0a1729", fontFamily: "inherit" }}>Recargar</button>
        </div>
      </div>
    );
  }
}

/* ══════════════════════════════════════════════════════════════════
   CONFIGURACIÓN DE BASE DE DATOS — SUPABASE
   ──────────────────────────────────────────────────────────────────
   Para conectar:
   1. Crea un proyecto en https://supabase.com
   2. Ve a Settings → API y copia tu URL y anon key
   3. Pégalas aquí. El RLS (Row Level Security) hará el resto.
   4. Ejecuta el schema SQL que está en /supabase/schema.sql
══════════════════════════════════════════════════════════════════ */
// Inicialización dinámica de Supabase — se evalúa en runtime
const getSupabaseConfig = () => {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  return { url, key, ready: Boolean(url && key) };
};

let _supabaseClient = null;
let _dbReady = false;

const initSupabaseOnce = () => {
  if (_supabaseClient !== null) return; // Ya inicializado
  const { url, key, ready } = getSupabaseConfig();
  _dbReady = ready;
  if (ready) {
    _supabaseClient = createClient(url, key);
    console.log("✓ Supabase conectado");
  } else {
    console.error("Supabase no está configurado. Revisa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  }
};

// Inicializa al cargar el módulo
initSupabaseOnce();

const supabase = _supabaseClient;
const DB_READY = _dbReady;

/* ── Auth ────────────────────────────────────────────────────────── */
const dbAuth = {
  // Intenta sign in; si falla, intenta sign up (auto-register)
  signIn: async (email, password) => {
    if (!DB_READY) {
      return { error: "Supabase no está configurado. Revisa las variables de entorno." };
    }
    // Intenta sign in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (!signInError) {
      let profile = await dbUsers.ensureProfile();
      if (!profile) profile = await dbUsers.getProfile(signInData.user.id);
      if (!profile) profile = await dbUsers.getProfileByEmail(signInData.user.email);
      // Si perfil no existe, retorna usuario temporal
      if (!profile) {
        profile = await dbUsers.upsert({
          id: signInData.user.id,
          email: signInData.user.email,
          name: signInData.user.email.split("@")[0],
          role: "client",
          workspaces: ["frame"],
        });
      }
      if (!profile) {
        return { error: "Sesión creada, pero no se pudo leer o crear el perfil. Revisa las políticas RLS de profiles." };
      }
      return { user: profile };
    }

    // Si falla, intenta sign up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: email.split("@")[0] } },
    });
    if (signUpError) return { error: signUpError.message };
    if (!signUpData?.user) return { error: "Supabase no devolvió el usuario creado." };
    if (!signUpData.session) {
      return { error: "Registro creado. Revisa tu email para confirmar la cuenta antes de entrar." };
    }

    const created = await waitForProfile(signUpData.user.id) || await dbUsers.upsert({
      id: signUpData.user.id,
      email,
      name: email.split("@")[0],
      role: "client",
      workspaces: ["frame"],
    });
    if (!created) {
      const byEmail = await dbUsers.getProfileByEmail(email);
      if (byEmail) return { user: byEmail };
      return { error: "Usuario creado, pero no se pudo crear el perfil. Revisa el trigger handle_new_user y las políticas RLS de profiles." };
    }
    return { user: created };
  },
  signOut: async () => {
    if (!DB_READY) return;
    await supabase.auth.signOut();
  },
  getSession: async () => {
    if (!DB_READY) return null;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    let profile = await dbUsers.getProfile(data.session.user.id);
    if (!profile) {
      profile = await dbUsers.upsert({
        id: data.session.user.id,
        email: data.session.user.email,
        name: data.session.user.email.split("@")[0],
        role: "client",
        workspaces: ["frame"],
      });
    }
    return profile;
  },
};

/* ── Usuarios / Perfiles ─────────────────────────────────────────── */
const dbUsers = {
  getAll: async () => {
    if (!DB_READY) return [];
    const { data } = await supabase.from("profiles").select("*").order("name");
    return data || [];
  },
  getProfile: async (id) => {
    if (!DB_READY) return null;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
    if (error) return null; // Perfil no existe aún
    return data;
  },
  getProfileByEmail: async (email) => {
    if (!DB_READY || !email) return null;
    const { data, error } = await supabase.from("profiles").select("*").ilike("email", email).single();
    if (error) {
      console.error("profile by email:", error);
      return null;
    }
    return data;
  },
  ensureProfile: async () => {
    if (!DB_READY) return null;
    const { data, error } = await supabase.rpc("ensure_my_profile");
    if (error) {
      console.error("ensure_my_profile rpc:", error);
      return null;
    }
    return data;
  },
  upsert: async (profile) => {
    if (!DB_READY) return profile;
    const rpcData = await dbUsers.ensureProfile();
    if (rpcData) return rpcData;

    const { data, error } = await supabase.from("profiles").upsert(profile).select().single();
    if (error) {
      console.error("profile upsert:", error);
      return null;
    }
    return data;
  },
  updateRole: async (id, role) => {
    if (!DB_READY) return;
    await supabase.from("profiles").update({ role }).eq("id", id);
  },
  update: async (id, patch) => {
    if (!DB_READY) return null;
    const { data, error } = await supabase.from("profiles").update(patch).eq("id", id).select().single();
    if (error) {
      console.error("profile update:", error);
      return null;
    }
    return data;
  },
};

const dbInvitations = {
  getAll: async () => {
    if (!DB_READY) return [];
    const { data, error } = await supabase.from("invitations").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("invitations get:", error);
      return [];
    }
    return data || [];
  },
  upsert: async (invite) => {
    if (!DB_READY) return invite;
    const { data: rpcData, error: rpcError } = await supabase.rpc("upsert_invitation", {
      invite_email: invite.email,
      invite_role: invite.role,
      invite_workspace: invite.workspace,
      invite_workspaces: invite.workspaces,
    });
    if (!rpcError && rpcData) return rpcData;
    if (rpcError) console.error("upsert_invitation rpc:", rpcError);

    const { data, error } = await supabase.from("invitations").upsert(invite).select().single();
    if (error) {
      console.error("invitation upsert:", error);
      return null;
    }
    return data;
  },
  delete: async (email) => {
    if (!DB_READY) return;
    const { error } = await supabase.from("invitations").delete().ilike("email", email);
    if (error) console.error("invitation delete:", error);
  },
};

const waitForProfile = async (id) => {
  for (let i = 0; i < 5; i += 1) {
    const profile = await dbUsers.getProfile(id);
    if (profile) return profile;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return null;
};

/* ── Clientes (workspaces) ───────────────────────────────────────── */

// Mapeo snake_case (DB) ↔ camelCase (app)
const fromDb = (c) => {
  if (!c) return c;
  const base = EMPTY_CLIENT(c.slug || "");
  const arrayFields = ["photos", "fonts", "palette", "goals", "growth", "deliverables", "chat", "posts", "comments", "contact"];
  const normalized = {
    ...base,
    ...c,
    slug: c.slug || base.slug,
    name: c.name || base.name,
    cover: c.cover || base.cover,
    emoji: c.emoji || base.emoji,
    goalText: c.goal_text ?? c.goalText ?? base.goalText,
    rawFiles: c.raw_files ?? c.rawFiles ?? base.rawFiles,
    replyTemplates: c.reply_templates ?? c.replyTemplates ?? base.replyTemplates,
    rate: Number(c.rate ?? base.rate) || 0,
  };
  arrayFields.forEach((field) => {
    if (!Array.isArray(normalized[field])) normalized[field] = base[field];
  });
  if (!Array.isArray(normalized.rawFiles)) normalized.rawFiles = base.rawFiles;
  if (!Array.isArray(normalized.replyTemplates)) normalized.replyTemplates = base.replyTemplates;
  normalized.palette = normalized.palette.filter(Boolean).map((color, index) => ({
    id: color.id || `c${index}`,
    hex: typeof color.hex === "string" && color.hex ? color.hex : "#888888",
    name: color.name || "Color",
  }));
  normalized.growth = normalized.growth.filter(Boolean).map((item) => ({
    ...item,
    m: item.m || "",
    v: Number(item.v) || 0,
  }));
  normalized.goals = normalized.goals.filter(Boolean).map((item, index) => ({
    id: item.id || `g${index}`,
    label: item.label || "Objetivo",
    current: Number(item.current) || 0,
    target: Number(item.target) || 1,
    unit: item.unit || "",
  }));
  normalized.posts = normalized.posts.filter(Boolean);
  normalized.comments = normalized.comments.filter(Boolean);
  return normalized;
};
const toDb = ({ goalText, rawFiles, replyTemplates, ...rest }) => ({ ...rest, goal_text: goalText, raw_files: rawFiles, reply_templates: replyTemplates });

const dbClients = {
  getAll: async () => {
    if (!DB_READY) return {};
    const { data } = await supabase.from("clients").select("*");
    return Object.fromEntries((data || []).map(c => [c.slug, fromDb(c)]));
  },
  get: async (slug) => {
    if (!DB_READY) return EMPTY_CLIENT(slug);
    const { data } = await supabase.from("clients").select("*").eq("slug", slug).single();
    return fromDb(data);
  },
  upsert: async (slug, patch) => {
    if (!DB_READY) return;
    const { data: rpcData, error: rpcError } = await supabase.rpc("create_client_workspace", {
      client_slug: slug,
      client_name: patch.name || slug,
      client_sector: patch.sector || "",
      client_plan: patch.plan || "",
      client_mrr: patch.mrr || "",
      client_rate: Number(patch.rate) || 0,
    });
    if (!rpcError && rpcData) return fromDb(rpcData);
    if (rpcError) console.error("create_client_workspace rpc:", rpcError);

    const { data, error } = await supabase.from("clients").upsert({ slug, ...toDb(patch) }).select().single();
    if (error) {
      console.error("client upsert:", error);
      return null;
    }
    return fromDb(data);
  },
  updateField: async (slug, field, value) => {
    if (!DB_READY) return;
    const dbField = { goalText: "goal_text", rawFiles: "raw_files", replyTemplates: "reply_templates" }[field] || field;
    await supabase.from("clients").update({ [dbField]: value }).eq("slug", slug);
  },
};

/* ── Time entries ────────────────────────────────────────────────── */
const dbTime = {
  getAll: async () => {
    if (!DB_READY) return [];
    const { data } = await supabase.from("time_entries").select("*").order("created_at", { ascending: false });
    return data || [];
  },
  insert: async (entry) => {
    if (!DB_READY) return entry;
    const { data } = await supabase.from("time_entries").insert(entry).select().single();
    return data;
  },
  delete: async (id) => {
    if (!DB_READY) return;
    await supabase.from("time_entries").delete().eq("id", id);
  },
};

/* ── CRM Deals ───────────────────────────────────────────────────── */
const dbDeals = {
  getAll: async () => {
    if (!DB_READY) return [];
    const { data } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
    return data || [];
  },
  upsert: async (deal) => {
    if (!DB_READY) return deal;
    const { data } = await supabase.from("deals").upsert(deal).select().single();
    return data;
  },
  delete: async (id) => {
    if (!DB_READY) return;
    await supabase.from("deals").delete().eq("id", id);
  },
  updateStage: async (id, stage) => {
    if (!DB_READY) return;
    await supabase.from("deals").update({ stage }).eq("id", id);
  },
};

/* ══════════════════════════════════════════════════════════════════
   PERMISOS
══════════════════════════════════════════════════════════════════ */
const can = (user, action) => {
  if (!user) return false;
  const r = user.role;
  if (r === "admin") return true;
  if (r === "socio") return !["manage_users", "manage_workspaces"].includes(action);
  if (r === "editor") return ["view_clients_list", "view_raw", "download_raw"].includes(action);
  if (r === "client") return ["view_own_brief", "view_own_deliverables", "download_deliverables", "view_chat", "send_chat"].includes(action);
  return false;
};

/* ══════════════════════════════════════════════════════════════════
   FRASES DEL DÍA (hardcodeadas — no necesitan DB)
══════════════════════════════════════════════════════════════════ */
const QUOTES = [
  "El talento sin disciplina es entretenimiento.",
  "Nadie va a venir a salvarte. Coge la cámara.",
  "Lo cómodo no construye nada que valga la pena recordar.",
  "Mientras dudas, alguien menos talentoso ya está publicando.",
  "Las excusas no rinden cuentas a final de mes.",
  "Cobra lo que vales. Después demuéstralo cada día.",
  "Nadie recuerda los reels seguros.",
  "Si tu portfolio podría firmarlo otro, todavía no es tu portfolio.",
  "El cliente que regatea hoy va a renegociar mañana.",
  "Si no incomoda, probablemente no sea honesto.",
  "Primero te entiendo. Luego grabo. Y solo entonces cobro.",
  "Un mal cliente roba lo que un buen cliente nunca te paga: tiempo.",
  "Vender es ayudar. Quien no vende, no ayuda.",
  "Crea como si nadie estuviera mirando. Después publica como si todos lo hicieran.",
  "El branding es lo que dicen de ti cuando no estás en la sala.",
  "Lo único que escala una agencia pequeña es decidir bien.",
];
const getQuote = () => {
  const d = new Date(); const start = new Date(d.getFullYear(), 0, 0);
  return QUOTES[Math.floor((d - start) / 86400000) % QUOTES.length];
};

/* ══════════════════════════════════════════════════════════════════
   USUARIOS DE PRUEBA RETIRADOS
   En producción estos datos viven en Supabase → tabla "profiles"
══════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   WORKSPACES (cargados desde DB en producción)
══════════════════════════════════════════════════════════════════ */
const DEFAULT_WORKSPACES = {
  frame: { name: "gonzo · agencia", subtitle: "Workspace principal" },
};
const WORKSPACES = DEFAULT_WORKSPACES;

/* ══════════════════════════════════════════════════════════════════
   CLIENTE VACÍO — plantilla base para nuevos clientes
══════════════════════════════════════════════════════════════════ */
function EMPTY_CLIENT(slug = "") {
  return {
  slug,
  name: "",
  tagline: "",
  sector: "",
  cover: "linear-gradient(135deg,#1a1a2e 0%,#0a1729 100%)",
  since: "",
  plan: "",
  mrr: "",
  rate: 0,
  emoji: "📁",
  voice: "",
  about: "",
  photos: [],
  fonts: [],
  palette: [],
  goalText: "",
  goals: [],
  growth: [],
  deliverables: [],
  rawFiles: [],
  chat: [],
  posts: [],
  comments: [],
  replyTemplates: [],
    contact: [],
  };
}

/* ══════════════════════════════════════════════════════════════════
   DATOS INICIALES VACÍOS — sin simulaciones
══════════════════════════════════════════════════════════════════ */
const CLIENTS0 = {};   // se pobla desde Supabase → dbClients.getAll()
const TIME0 = [];   // se pobla desde Supabase → dbTime.getAll()
const DEALS0 = [];   // se pobla desde Supabase → dbDeals.getAll()
const WORKSPACES0 = DEFAULT_WORKSPACES;

/* ══════════════════════════════════════════════════════════════════
   GONZO APP — ROOT
══════════════════════════════════════════════════════════════════ */
function GonzoAppInner() {
  const [user, setUser] = useState(null);
  const [activeWs, setActiveWs] = useState(null);
  const [booting, setBooting] = useState(true);
  const [clients, setClients] = useState(CLIENTS0);
  const [timeEntries, setTimeEntries] = useState(TIME0);
  const [deals, setDeals] = useState(DEALS0);
  const [showSearch, setShowSearch] = useState(false);

  // ── ⌘K global ────────────────────────────────────────────────
  useEffect(() => {
    const fn = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setShowSearch(true); } };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  // ── Arranque ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        if (DB_READY) {
          const u = await dbAuth.getSession();
          if (u) { await loadUserData(u); return; }
        }
      } catch (e) { console.error("session:", e); }
      setBooting(false);
    })();
  }, []);

  const loadUserData = async (u) => {
    setUser(u);
    setActiveWs(u.workspaces?.[0] || u.workspace || "frame");
    try {
      const [cd, td, dd] = await Promise.all([
        dbClients.getAll(),
        dbTime.getAll(),
        dbDeals.getAll(),
      ]);
      if (cd && Object.keys(cd).length > 0) setClients(cd);
      if (td?.length) setTimeEntries(td);
      if (dd?.length) setDeals(dd);
    } catch (e) { console.error("data load:", e); }
    setBooting(false);
  };

  const onLogin = async (u) => {
    await loadUserData(u);
  };

  const onLogout = async () => {
    await dbAuth.signOut();
    setUser(null); setActiveWs(null);
    setClients(CLIENTS0); setTimeEntries(TIME0); setDeals(DEALS0);
  };

  const onSwitchWs = (ws) => setActiveWs(ws);

  // Clientes
  const updateClient = async (id, patch) => {
    setClients(c => ({ ...c, [id]: { ...(c[id] || EMPTY_CLIENT(id)), ...patch } }));
    const field = Object.keys(patch)[0];
    if (field) await dbClients.updateField(id, field, patch[field]);
  };

  const addClient = async (slug, data) => {
    const nc = { ...EMPTY_CLIENT(slug), ...data };
    const saved = await dbClients.upsert(slug, nc);
    if (saved) setClients(c => ({ ...c, [slug]: saved }));
    return saved;
  };

  // Time entries
  const addTimeEntry = async (entry) => {
    const saved = await dbTime.insert(entry);
    setTimeEntries(t => [saved || entry, ...t]);
  };
  const removeTimeEntry = async (id) => {
    await dbTime.delete(id);
    setTimeEntries(t => t.filter(e => e.id !== id));
  };

  // Deals
  const upsertDeal = async (deal) => {
    const saved = await dbDeals.upsert(deal);
    const d = saved || deal;
    setDeals(ds => ds.some(x => x.id === d.id) ? ds.map(x => x.id === d.id ? d : x) : [...ds, d]);
  };
  const removeDeal = async (id) => {
    await dbDeals.delete(id);
    setDeals(ds => ds.filter(d => d.id !== id));
  };
  const moveDeal = async (id, stage) => {
    await dbDeals.updateStage(id, stage);
    setDeals(ds => ds.map(d => d.id === id ? { ...d, stage } : d));
  };

  return (
    <>
      <GS />
      {booting ? (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a1729", gap: 20 }}>
          <div className="serif" style={{ fontSize: 48, color: "#fff", letterSpacing: "0.02em" }}>gonzo</div>
          <Loader2 size={22} className="spin" style={{ color: "#88b0e0" }} />
        </div>
      ) : !user ? (
        <Login onLogin={onLogin} />
      ) : (
        <>
          <Workspace
            user={user} activeWs={activeWs} onSwitchWs={onSwitchWs} onLogout={onLogout}
            clients={clients} updateClient={updateClient} addClient={addClient}
            timeEntries={timeEntries} addTimeEntry={addTimeEntry} removeTimeEntry={removeTimeEntry}
            deals={deals} upsertDeal={upsertDeal} removeDeal={removeDeal} moveDeal={moveDeal}
            onSearch={() => setShowSearch(true)}
          />
          {showSearch && <GS_earch onClose={() => setShowSearch(false)} clients={clients} deals={deals} />}
        </>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   BANNER: configuración de base de datos
══════════════════════════════════════════════════════════════════ */
export default function GonzoApp() {
  return (
    <AppErrorBoundary>
      <GonzoAppInner />
    </AppErrorBoundary>
  );
}

function DBSetupBanner() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "rgba(255,149,0,0.12)", border: "1px solid rgba(255,149,0,0.3)", borderRadius: 12, padding: "12px 20px", maxWidth: 480, textAlign: "center" }}>
      <div className="t-cap-b" style={{ color: "#FF9500", marginBottom: 4 }}>
        Base de datos no configurada
      </div>
      <div className="t-mic" style={{ color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
        Los datos no se guardan entre sesiones. Conecta Supabase para activar la persistencia real.
      </div>
      <button
        onClick={() => setOpen(!open)}
        style={{ background: "transparent", border: "1px solid rgba(255,149,0,0.4)", color: "#FF9500", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}
      >
        {open ? "Cerrar" : "Cómo conectar →"}
      </button>
      {open && (
        <div style={{ marginTop: 16, textAlign: "left", background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 16 }}>
          <div className="t-mic-b" style={{ color: "#FF9500", marginBottom: 8 }}>3 pasos para activar Supabase:</div>
          <ol style={{ margin: 0, paddingLeft: 16, color: "rgba(255,255,255,0.8)", fontSize: 11, lineHeight: 1.8 }}>
            <li>Crea proyecto en <b>supabase.com</b></li>
            <li>Copia la URL y anon key en las constantes <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 5px", borderRadius: 3 }}>SUPABASE_URL</code> y <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 5px", borderRadius: 3 }}>SUPABASE_ANON</code> al inicio del archivo</li>
            <li>Ejecuta el schema SQL en el editor SQL de Supabase</li>
          </ol>
          <div style={{ marginTop: 12, padding: 10, background: "rgba(0,0,0,0.4)", borderRadius: 6, fontFamily: "monospace", fontSize: 10, color: "#88b0e0", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {`-- Ejecuta esto en Supabase SQL Editor:

create table profiles (
  id uuid references auth.users primary key,
  email text unique not null,
  name text, role text default 'client',
  workspaces text[] default array['frame'],
  workspace text, created_at timestamptz default now()
);

create table clients (
  slug text primary key, name text, tagline text,
  sector text, cover text, since text, plan text,
  mrr text, rate int, emoji text, voice text,
  about text, photos jsonb default '[]',
  fonts jsonb default '[]', palette jsonb default '[]',
  goal_text text, goals jsonb default '[]',
  growth jsonb default '[]', deliverables jsonb default '[]',
  raw_files jsonb default '[]', chat jsonb default '[]',
  posts jsonb default '[]', comments jsonb default '[]',
  reply_templates jsonb default '[]', contact jsonb default '[]',
  updated_at timestamptz default now()
);

create table time_entries (
  id text primary key, client text references clients(slug),
  task text, minutes int, date text,
  created_at timestamptz default now()
);

create table deals (
  id text primary key, company text, contact text,
  email text, value int default 0,
  stage text default 'lead', source text,
  note text, next_action text,
  created_at timestamptz default now()
);

-- RLS: solo admins ven todo, clientes solo su workspace
alter table clients enable row level security;
alter table time_entries enable row level security;
alter table deals enable row level security;
alter table profiles enable row level security;

create policy "admin_all" on profiles for all using (
  (select role from profiles where id = auth.uid()) = 'admin'
);
create policy "self_read" on profiles for select using (id = auth.uid());`}
          </div>
        </div>
      )}
    </div>
  );
}

function GS() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&display=swap');
      *{box-sizing:border-box;} body{margin:0;}
      .gonzo{font-family:${FONT};color:#1d1d1f;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
      .serif{font-family:${SERIF};}
      .t-hero{font-size:56px;line-height:1.07;letter-spacing:-0.28px;font-weight:600;}
      .t-display{font-size:48px;line-height:1.08;letter-spacing:-0.96px;font-weight:600;}
      .t-section{font-size:40px;line-height:1.10;letter-spacing:-0.4px;font-weight:600;}
      .t-tile{font-size:28px;line-height:1.14;letter-spacing:0.196px;font-weight:400;}
      .t-card-b{font-size:21px;line-height:1.19;letter-spacing:0.231px;font-weight:700;}
      .t-card{font-size:21px;line-height:1.19;letter-spacing:0.231px;font-weight:400;}
      .t-subnav{font-size:24px;line-height:1.5;font-weight:300;letter-spacing:-0.2px;}
      .t-body{font-size:17px;line-height:1.47;letter-spacing:-0.374px;font-weight:400;}
      .t-body-em{font-size:17px;line-height:1.24;letter-spacing:-0.374px;font-weight:600;}
      .t-cap{font-size:14px;line-height:1.29;letter-spacing:-0.224px;font-weight:400;}
      .t-cap-b{font-size:14px;line-height:1.29;letter-spacing:-0.224px;font-weight:600;}
      .t-mic{font-size:12px;line-height:1.33;letter-spacing:-0.12px;font-weight:400;}
      .t-mic-b{font-size:12px;line-height:1.33;letter-spacing:-0.12px;font-weight:600;}
      .t-nano{font-size:10px;line-height:1.47;letter-spacing:.1em;font-weight:600;text-transform:uppercase;}
      @media(max-width:768px){.t-hero{font-size:38px;}.t-display{font-size:32px;letter-spacing:-0.4px;}.t-section{font-size:26px;}.t-tile{font-size:22px;}.t-subnav{font-size:18px;}}
      .spaced-lg{letter-spacing:.32em;text-transform:uppercase;}.spaced-md{letter-spacing:.2em;text-transform:uppercase;}
      .sb::-webkit-scrollbar{width:10px;height:10px;}.sb::-webkit-scrollbar-track{background:transparent;}
      .sb::-webkit-scrollbar-thumb{background:rgba(0,0,0,.18);border-radius:10px;border:2px solid transparent;background-clip:padding-box;}
      .glass-light{background:rgba(255,255,255,.72);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid rgba(0,0,0,.06);}
      .halo-bg{position:relative;background:#0a1729;overflow:hidden;}
      .halo-bg::before{content:"";position:absolute;inset:-200px;background:radial-gradient(ellipse 60% 50% at 20% 30%,rgba(110,160,230,.55),transparent 50%),radial-gradient(ellipse 50% 40% at 80% 70%,rgba(80,130,210,.45),transparent 50%);filter:blur(40px);pointer-events:none;}
      .halo-bg>*{position:relative;z-index:1;}
      .pill{border-radius:980px;padding:11px 22px;font-size:17px;font-weight:400;line-height:1;letter-spacing:-0.374px;display:inline-flex;align-items:center;gap:6px;transition:all 160ms ease;border:1px solid transparent;cursor:pointer;font-family:inherit;}
      .pill:active{transform:scale(.98);}.pill:disabled{opacity:.4;cursor:not-allowed;}
      .pill-fill{background:#0071e3;color:#fff;border-color:#0071e3;}.pill-fill:hover{background:#0077ED;}
      .pill-out-light{background:transparent;color:#fff;border-color:rgba(255,255,255,.4);}.pill-out-light:hover{background:#fff;color:#0a1729;}
      .btn{padding:8px 15px;border-radius:8px;font-size:14px;font-weight:400;letter-spacing:-0.224px;border:1px solid transparent;cursor:pointer;font-family:inherit;transition:all 160ms ease;display:inline-flex;align-items:center;gap:6px;}
      .btn:active{transform:scale(.98);}.btn:disabled{opacity:.4;cursor:not-allowed;}
      .btn-blue{background:#0071e3;color:#fff;}.btn-blue:hover{background:#0077ED;}
      .btn-dark{background:#1d1d1f;color:#fff;}.btn-dark:hover{background:#2a2a2c;}
      .btn-ghost{background:transparent;color:#1d1d1f;}.btn-ghost:hover{background:rgba(0,0,0,.04);}
      .btn-ghost-light{background:transparent;color:rgba(255,255,255,.8);}.btn-ghost-light:hover{background:rgba(255,255,255,.08);color:#fff;}
      .btn-sm{padding:6px 12px;font-size:13px;border-radius:6px;}
      .side-item{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;font-size:13px;color:rgba(0,0,0,.8);cursor:pointer;transition:background 120ms ease;width:100%;text-align:left;border:none;background:transparent;font-family:inherit;}
      .side-item:hover{background:rgba(0,0,0,.04);}.side-item.active{background:rgba(0,113,227,.08);color:#0071e3;font-weight:500;}
      .card{background:#fff;border-radius:18px;overflow:hidden;transition:transform 300ms ease,box-shadow 300ms ease;}
      .card-hov{cursor:pointer;}.card-hov:hover{transform:translateY(-2px);box-shadow:rgba(0,0,0,.1) 0 12px 40px -8px;}
      @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
      .fade-up{animation:fadeUp 400ms ease both;}
      @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
      .fade-in{animation:fadeIn 200ms ease both;}
      @keyframes spin{to{transform:rotate(360deg);}}
      .spin{animation:spin 1s linear infinite;}
      @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.5;}}
      .pulse{animation:pulse 2s ease infinite;}
      @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
      .float{animation:float 6s ease-in-out infinite;}
      .editable{outline:none;border-radius:4px;padding:1px 4px;margin:-1px -4px;transition:all 120ms ease;cursor:text;}
      .editable:hover{background:rgba(0,113,227,.06);}.editable:focus{background:rgba(0,113,227,.08);box-shadow:inset 0 0 0 1.5px rgba(0,113,227,.35);}
      .readonly .editable,.readonly .editable:hover{cursor:default;background:transparent;box-shadow:none;}
      .input{width:100%;padding:12px 14px;border-radius:12px;background:#f5f5f7;border:2px solid transparent;font-size:17px;font-family:inherit;color:#1d1d1f;letter-spacing:-0.374px;outline:none;transition:all 160ms ease;}
      .input:focus{border-color:#0071e3;background:#fff;}.input::placeholder{color:rgba(0,0,0,.36);}
      .input-sm{padding:8px 12px;font-size:14px;border-radius:8px;}
      .input-dark{width:100%;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);font-size:17px;font-family:inherit;color:#fff;outline:none;transition:all 160ms ease;}
      .input-dark:focus{border-color:#88b0e0;background:rgba(255,255,255,.1);}.input-dark::placeholder{color:rgba(255,255,255,.36);}
      button:focus-visible,a:focus-visible{outline:2px solid #0071e3;outline-offset:2px;}
      @media(max-width:900px){
        .sidebar{position:fixed;inset:0 auto 0 0;z-index:50;transform:translateX(-100%);transition:transform 280ms ease;box-shadow:0 0 60px rgba(0,0,0,.2);}
        .sidebar.open{transform:translateX(0);}
        .sidebar-bd{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:49;opacity:0;pointer-events:none;transition:opacity 280ms ease;}
        .sidebar-bd.open{opacity:1;pointer-events:auto;}
      }
      .page-pad{padding:64px 40px;}
      @media(max-width:768px){.page-pad{padding:32px 20px;}}
      .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;}
      .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
      .grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;}
      @media(max-width:900px){.grid-4,.grid-3{grid-template-columns:repeat(2,1fr);}}
      @media(max-width:600px){.grid-4,.grid-3,.grid-2{grid-template-columns:1fr;}}
      .hide-mobile{display:initial;}.show-mobile{display:none;}
      @media(max-width:900px){.hide-mobile{display:none!important;}.show-mobile{display:initial;}}
      .admin-bar{position:sticky;top:0;z-index:40;background:linear-gradient(90deg,#0a1729,#1a3a6a);color:#fff;padding:8px 20px;display:flex;align-items:center;gap:12px;font-size:13px;flex-wrap:wrap;}
      .role-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;}
      .drag-over{background:rgba(0,113,227,.08)!important;box-shadow:inset 0 0 0 2px #0071e3;}
      .slash-menu{position:absolute;background:#fff;border-radius:12px;box-shadow:0 12px 40px -8px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.06);padding:6px;z-index:200;min-width:260px;max-height:300px;overflow-y:auto;}
      .slash-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:14px;color:#1d1d1f;transition:background 100ms;}
      .slash-item:hover,.slash-item.sel{background:rgba(0,113,227,.08);color:#0071e3;}
      .spotlight-bd{position:fixed;inset:0;background:rgba(10,23,41,.6);backdrop-filter:blur(10px);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding-top:12vh;padding-left:20px;padding-right:20px;}
      .spotlight-box{width:100%;max-width:640px;background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.4);overflow:hidden;}
      kbd{padding:2px 6px;border-radius:4px;background:#f5f5f7;border:1px solid rgba(0,0,0,.08);font-family:monospace;font-size:11px;color:rgba(0,0,0,.6);}
    `}</style>
  );
}

/* ─── EDITABLE TEXT ─────────────────────────────────────────────── */
function ET({ value, onChange, as: Tag = "div", className = "", style, placeholder = "", multiline = false, ro = false }) {
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState(value);
  const ref = useRef();
  useEffect(() => setTmp(value), [value]);
  useEffect(() => { if (editing && ref.current) { ref.current.focus(); try { const l = (ref.current.value || "").length; ref.current.setSelectionRange(l, l); } catch { } } }, [editing]);
  const commit = () => { onChange(tmp); setEditing(false); };
  const cancel = () => { setTmp(value); setEditing(false); };
  if (ro) return <Tag className={className} style={style}>{value || <span style={{ color: "rgba(0,0,0,.36)" }}>{placeholder}</span>}</Tag>;
  if (editing) {
    const Comp = multiline ? "textarea" : "input";
    return <Comp ref={ref} value={tmp} onChange={(e) => setTmp(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Escape") cancel(); if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) commit(); }}
      className={`editable ${className}`} rows={multiline ? Math.max(2, (tmp || "").split("\n").length) : undefined}
      style={{ ...style, width: "100%", fontFamily: "inherit", border: "none", background: "transparent", outline: "none", resize: multiline ? "none" : undefined }} />;
  }
  return <Tag className={`editable ${className}`} style={style} onClick={() => setEditing(true)} tabIndex={0}>
    {value || <span style={{ color: "rgba(0,0,0,.36)" }}>{placeholder}</span>}
  </Tag>;
}

/* ─── GLOBAL SEARCH ─────────────────────────────────────────────── */
function GS_earch({ onClose, clients, deals }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  const results = useMemo(() => {
    const out = [];
    const term = q.toLowerCase();
    if (!term) {
      out.push({ icon: <Home size={14} />, title: "Inicio", sub: "Página principal" });
      out.push({ icon: <Calendar size={14} />, title: "Content Calendar", sub: "Planificación de posts" });
      out.push({ icon: <Briefcase size={14} />, title: "CRM · Leads", sub: "Pipeline de oportunidades" });
      out.push({ icon: <Clock size={14} />, title: "Time Tracking", sub: "Rentabilidad por cliente" });
      out.push({ icon: <Inbox size={14} />, title: "Inbox unificado", sub: "Comentarios IG/TikTok" });
      return out;
    }
    Object.entries(clients).forEach(([id, c]) => {
      if (c.name.toLowerCase().includes(term) || c.sector.toLowerCase().includes(term))
        out.push({ icon: <Users size={14} />, title: c.name, sub: c.sector });
      (c.posts || []).forEach((p) => { if (p.title.toLowerCase().includes(term)) out.push({ icon: <Calendar size={14} />, title: p.title, sub: `Post · ${c.name}` }); });
      (c.deliverables || []).forEach((d) => { if (d.name.toLowerCase().includes(term)) out.push({ icon: <FileText size={14} />, title: d.name, sub: `Entregable · ${c.name}` }); });
      (c.comments || []).forEach((cm) => { if (cm.text.toLowerCase().includes(term) || cm.author.toLowerCase().includes(term)) out.push({ icon: <MessageCircle size={14} />, title: cm.text, sub: `Comentario · ${cm.author} · ${c.name}` }); });
    });
    deals.forEach((d) => { if (d.company.toLowerCase().includes(term) || d.contact.toLowerCase().includes(term)) out.push({ icon: <Briefcase size={14} />, title: d.company, sub: `Lead · ${d.contact} · €${d.value}` }); });
    return out.slice(0, 12);
  }, [q, clients, deals]);

  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
      if (e.key === "Enter") onClose();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [results.length]);

  return (
    <div className="spotlight-bd fade-in" onClick={onClose}>
      <div className="spotlight-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,.06)" }}>
          <Search size={18} style={{ color: "rgba(0,0,0,.4)" }} />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }}
            placeholder="Buscar clientes, posts, comentarios, leads…"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 18, fontFamily: "inherit", color: "#1d1d1f", background: "transparent" }} />
          <kbd>esc</kbd>
        </div>
        <div style={{ maxHeight: 380, overflowY: "auto" }} className="sb">
          {!q && <div className="t-nano" style={{ color: "rgba(0,0,0,.4)", padding: "10px 16px 4px" }}>SUGERENCIAS</div>}
          {results.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "rgba(0,0,0,.4)" }} className="t-cap">Nada encontrado para "{q}"</div>}
          <div style={{ padding: 8 }}>
            {results.map((r, i) => (
              <div key={i} onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: i === sel ? "rgba(0,113,227,.08)" : "transparent", cursor: "pointer" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f5f5f7", display: "flex", alignItems: "center", justifyContent: "center", color: i === sel ? "#0071e3" : "rgba(0,0,0,.6)" }}>{r.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-cap-b" style={{ color: i === sel ? "#0071e3" : "#1d1d1f", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                  <div className="t-mic" style={{ color: "rgba(0,0,0,.5)" }}>{r.sub}</div>
                </div>
                {i === sel && <ArrowRight size={14} style={{ color: "#0071e3" }} />}
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(0,0,0,.06)", display: "flex", gap: 16, fontSize: 11, color: "rgba(0,0,0,.5)" }}>
          <span><kbd>↑↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span><kbd>esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
}

/* ─── LOGIN ─────────────────────────────────────────────────────── */
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!email.trim() || !pw.trim()) return;
    setErr(null); setBusy(true);
    const { user, error } = await dbAuth.signIn(email.trim(), pw);
    if (error) { setErr(error); setBusy(false); return; }
    onLogin(user);
  };

  return (
    <div className="gonzo halo-bg" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "28px 40px", display: "flex", justifyContent: "space-between" }}>
        <div className="serif" style={{ fontSize: 32, color: "#fff" }}>gonzo</div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ width: "100%", maxWidth: 440 }} className="fade-up">
          <div className="t-nano spaced-lg float" style={{ color: "#88b0e0", marginBottom: 32, textAlign: "center" }}>B · A · R · C · E · L · O · N · A</div>
          <h1 className="serif" style={{ fontSize: 64, lineHeight: 0.95, fontWeight: 400, color: "#fff", textAlign: "center", marginBottom: 8 }}>gonzo</h1>
          <div className="t-cap spaced-md" style={{ color: "rgba(255,255,255,.56)", textAlign: "center", marginBottom: 48 }}>workspace · v.03</div>
          <form onSubmit={submit} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", padding: 28, borderRadius: 24 }}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" className="input-dark" autoFocus style={{ marginBottom: 12 }} />
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="contraseña" className="input-dark" style={{ marginBottom: 16 }} />
            {err && <div className="t-cap" style={{ color: "#FF6961", marginBottom: 12, padding: 10, borderRadius: 8, background: "rgba(255,59,48,.1)" }}>{err}</div>}
            <button type="submit" disabled={!email || !pw || busy} className="pill" style={{ width: "100%", justifyContent: "center", background: "#fff", color: "#0a1729", borderColor: "#fff" }}>
              {busy ? <><Loader2 size={14} className="spin" />Entrando…</> : <>Continuar<ArrowRight size={16} /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ─── WORKSPACE ─────────────────────────────────────────────────── */
function Workspace({ user, activeWs, onSwitchWs, onLogout, clients, updateClient, addClient, timeEntries, addTimeEntry, removeTimeEntry, deals, upsertDeal, removeDeal, moveDeal, onSearch }) {
  const init = user.role === "client" ? "client-panel" : user.role === "editor" ? "clientes" : "home";
  const [page, setPage] = useState(init);
  const [cid, setCid] = useState(user.role === "client" ? user.workspace : null);
  const [exp, setExp] = useState({ clientes: true });
  const [mobNav, setMobNav] = useState(false);

  const nav = (p, client = null) => { if (user.role === "client") return; setPage(p); setCid(client); setMobNav(false); };
  const toggleSec = (k) => setExp((s) => ({ ...s, [k]: !s[k] }));

  if (page === "proposal-builder") return <ProposalBuilder onBack={() => nav("crm")} />;

  if (user.role === "client") {
    const cd = clients[user.workspace];
    if (!cd) return (
      <div className="gonzo" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0a1729", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#fff", textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
          <div style={{ fontSize: 20, marginBottom: 8 }}>Sin workspace asignado</div>
          <div style={{ color: "rgba(255,255,255,.5)", marginBottom: 24 }}>Contacta con el administrador para acceder.</div>
          <button onClick={onLogout} style={{ padding: "10px 24px", borderRadius: 8, background: "#fff", color: "#0a1729", border: "none", cursor: "pointer" }}>Cerrar sesión</button>
        </div>
      </div>
    );
    return (
      <div className="gonzo" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#fff" }}>
        <ClientTopbar user={user} onLogout={onLogout} clientName={cd.name} />
        <main style={{ flex: 1, overflow: "auto" }} className="sb">
          <ClientPortal user={user} client={cd} clientId={user.workspace} updateClient={updateClient} />
        </main>
      </div>
    );
  }

  return (
    <div className="gonzo" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#fff" }}>
      {user.role === "admin" && (
        <div className="admin-bar">
          <Crown size={14} style={{ color: "#FFD700" }} /><span className="t-cap-b">Administrador</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span className="hide-mobile t-cap" style={{ color: "rgba(255,255,255,.6)" }}>Workspace:</span>
            <select value={activeWs} onChange={(e) => onSwitchWs(e.target.value)} style={{ background: "rgba(255,255,255,.1)", color: "#fff", border: "1px solid rgba(255,255,255,.2)", borderRadius: 6, padding: "4px 10px", fontSize: 13, fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
              {Object.entries(WORKSPACES).map(([k, v]) => <option key={k} value={k} style={{ color: "#1d1d1f" }}>{v.name}</option>)}
            </select>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        <div className={`sidebar-bd ${mobNav ? "open" : ""}`} onClick={() => setMobNav(false)} />
        <Sidebar user={user} page={page} cid={cid} nav={nav} exp={exp} toggleSec={toggleSec} open={mobNav} onLogout={onLogout} ws={activeWs} onSearch={onSearch} clients={clients} />
        <main style={{ flex: 1, overflow: "auto" }} className="sb">
          <Topbar page={page} cid={cid} nav={nav} onMenu={() => setMobNav(true)} onSearch={onSearch} clients={clients} />
          <div className="fade-up" key={page + (cid || "") + activeWs}>
            {page === "home" && <HomePage user={user} nav={nav} clients={clients} timeEntries={timeEntries} deals={deals} />}
            {page === "clientes" && !cid && <ClientesPage nav={nav} clients={clients} user={user} addClient={addClient} />}
            {page === "clientes" && cid && <ClientDetail clientId={cid} clients={clients} updateClient={updateClient} user={user} timeEntries={timeEntries} addTimeEntry={addTimeEntry} removeTimeEntry={removeTimeEntry} />}
            {page === "calendar" && <ContentCalendar clients={clients} updateClient={updateClient} />}
            {page === "inbox" && <InboxPage clients={clients} updateClient={updateClient} />}
            {page === "crm" && <CRMPage deals={deals} upsertDeal={upsertDeal} removeDeal={removeDeal} moveDeal={moveDeal} nav={nav} />}
            {page === "time" && <TimePage clients={clients} timeEntries={timeEntries} addTimeEntry={addTimeEntry} removeTimeEntry={removeTimeEntry} />}
            {page === "goals" && <GoalsPage clients={clients} timeEntries={timeEntries} />}
            {page === "templates" && <TemplatesPage />}
            {page === "ideas" && <IdeasPage />}
            {page === "users" && user.role === "admin" && <UsersPage clients={clients} currentUser={user} />}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─── SIDEBAR ───────────────────────────────────────────────────── */
function Sidebar({ user, page, cid, nav, exp, toggleSec, open, onLogout, ws, onSearch, clients }) {
  // Lista de clientes dinámica desde la DB
  const clientList = Object.keys(clients)
    .filter(k => k !== "frame")
    .map(k => ({ id: k, name: clients[k]?.name || k, color: "#0a1729" }));
  const inboxCount = Object.values(clients).flatMap((c) => c.comments || []).filter((c) => c.status === "pending").length;
  const wsData = { ...DEFAULT_WORKSPACES, ...Object.fromEntries(Object.keys(clients).filter(k => k !== 'frame').map(k => [k, { name: clients[k]?.name || k, subtitle: 'Cliente' }])) }[ws] || DEFAULT_WORKSPACES.frame;
  const isEd = user.role === "editor";
  const rc = { admin: "#FFD700", socio: "#88b0e0", editor: "#a78bfa", client: "#34c759" };
  const Item = ({ icon, label, active, onClick, indent = 0, right, caret }) => (
    <button onClick={onClick} className={`side-item ${active ? "active" : ""}`} style={{ paddingLeft: 10 + indent * 14 }}>
      {caret !== undefined && <span style={{ color: "rgba(0,0,0,.4)", width: 10, display: "inline-flex" }}>{caret ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>}
      {icon && <span style={{ color: "rgba(0,0,0,.56)", display: "inline-flex" }}>{icon}</span>}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {right}
    </button>
  );

  return (
    <aside className={`sidebar sb ${open ? "open" : ""}`} style={{ width: 260, background: "#fbfbfd", borderRight: "1px solid rgba(0,0,0,.06)", flexShrink: 0, overflowY: "auto", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "16px 12px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#0a1729", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontSize: 18 }}>g</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-cap-b" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wsData.name}</div>
            <div className="t-mic" style={{ color: "rgba(0,0,0,.56)" }}>{wsData.subtitle}</div>
          </div>
        </div>
      </div>
      <div style={{ padding: "0 12px 8px" }}>
        <button className="side-item" onClick={onSearch}><Search size={14} /><span>Buscar</span><span className="t-mic" style={{ marginLeft: "auto", color: "rgba(0,0,0,.32)" }}>⌘ K</span></button>
        {!isEd && <button className="side-item"><Inbox size={14} /><span>Inbox</span></button>}
      </div>
      <div style={{ height: 1, margin: "4px 16px", background: "rgba(0,0,0,.06)" }} />
      <div style={{ padding: "0 12px" }}>
        <Item icon={<Home size={14} />} label={isEd ? "Mis descargas" : "Inicio"} active={page === "home"} onClick={() => nav(isEd ? "clientes" : "home")} />
      </div>
      <div style={{ padding: "0 12px", marginTop: 16 }}>
        <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.36)", padding: "0 10px 6px" }}>{isEd ? "Material" : "Operaciones"}</div>
        <Item caret={exp.clientes} icon={<Users size={14} />} label="Clientes" active={page === "clientes" && !cid} onClick={() => { toggleSec("clientes"); nav("clientes"); }} right={<span className="t-mic" style={{ color: "rgba(0,0,0,.36)" }}>4</span>} />
        {exp.clientes && (
          <div>
            {clientList.map((c) => (
              <button key={c.id} onClick={() => nav("clientes", c.id)} className={`side-item ${cid === c.id ? "active" : ""}`} style={{ paddingLeft: 34 }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: c.color, flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
              </button>
            ))}
            <button className="side-item" style={{ paddingLeft: 34, color: "rgba(0,0,0,.4)" }}><Plus size={12} /><span>Añadir cliente</span></button>
          </div>
        )}
        {!isEd && (
          <>
            <Item icon={<Calendar size={14} />} label="Content Calendar" active={page === "calendar"} onClick={() => nav("calendar")} />
            <Item icon={<Inbox size={14} />} label="Inbox unificado" active={page === "inbox"} onClick={() => nav("inbox")} right={<span className="t-mic-b" style={{ background: inboxCount > 0 ? "#0071e3" : "rgba(0,0,0,.08)", color: inboxCount > 0 ? "#fff" : "rgba(0,0,0,.4)", padding: "0 6px", borderRadius: 999 }}>{inboxCount}</span>} />
            <Item icon={<Briefcase size={14} />} label="CRM · Leads" active={page === "crm"} onClick={() => nav("crm")} />
            <Item icon={<Clock size={14} />} label="Time tracking" active={page === "time"} onClick={() => nav("time")} />
            <Item icon={<Award size={14} />} label="Goals & Reportes" active={page === "goals"} onClick={() => nav("goals")} />
            <Item icon={<Layers size={14} />} label="Plantillas" active={page === "templates"} onClick={() => nav("templates")} />
            <Item icon={<Lightbulb size={14} />} label="Ideas & Referencias" active={page === "ideas"} onClick={() => nav("ideas")} />
            {user.role === "admin" && <Item icon={<Shield size={14} />} label="Usuarios y roles" active={page === "users"} onClick={() => nav("users")} />}
          </>
        )}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ padding: "12px", borderTop: "1px solid rgba(0,0,0,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px" }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: rc[user.role], color: "#1d1d1f", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{user.name[0]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-cap-b" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
            <div className="t-mic" style={{ color: "rgba(0,0,0,.56)" }}>{user.role}</div>
          </div>
          <button onClick={onLogout} style={{ padding: 6, borderRadius: 6, background: "transparent", border: "none", cursor: "pointer", color: "rgba(0,0,0,.4)" }}><LogOut size={14} /></button>
        </div>
      </div>
    </aside>
  );
}

/* ─── TOPBAR ────────────────────────────────────────────────────── */
function Topbar({ page, cid, nav, onMenu, onSearch, clients }) {
  const map = { home: "Inicio", calendar: "Content Calendar", inbox: "Inbox unificado", crm: "CRM · Leads", time: "Time tracking", goals: "Goals & Reportes", templates: "Plantillas", ideas: "Ideas", users: "Usuarios y roles" };
  const trail = () => {
    if (map[page]) return [map[page]];
    if (page === "clientes") {
      const base = [{ label: "Clientes", onClick: () => nav("clientes") }];
      if (cid) { base.push(clients[cid]?.name || cid); }
      return base;
    }
    return [];
  };
  return (
    <div className="glass-light" style={{ position: "sticky", top: 0, zIndex: 30, height: 48, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onMenu} className="show-mobile" style={{ background: "transparent", border: "none", padding: 6, cursor: "pointer", color: "rgba(0,0,0,.6)" }}><Menu size={18} /></button>
        <div className="t-cap" style={{ color: "rgba(0,0,0,.56)", display: "flex", alignItems: "center", gap: 6 }}>
          {trail().map((b, i, arr) => (
            <React.Fragment key={i}>
              {typeof b === "string"
                ? <span style={{ color: i === arr.length - 1 ? "#1d1d1f" : "rgba(0,0,0,.56)", fontWeight: i === arr.length - 1 ? 500 : 400 }}>{b}</span>
                : <button onClick={b.onClick} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>{b.label}</button>
              }
              {i < arr.length - 1 && <ChevronRight size={12} style={{ color: "rgba(0,0,0,.3)" }} />}
            </React.Fragment>
          ))}
        </div>
      </div>
      <button onClick={onSearch} className="btn btn-ghost t-cap" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Search size={13} /><span className="hide-mobile">Buscar</span><kbd>⌘K</kbd>
      </button>
    </div>
  );
}

function Shell({ children }) {
  return <div className="page-pad" style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div>;
}

/* ════════════════════════════════════════════════════════════════════
   HOME
════════════════════════════════════════════════════════════════════ */
function HomePage({ user, nav, clients, timeEntries, deals }) {
  const [name, setName] = useState(user.name.split(" ")[0]);
  const [quote, setQuote] = useState(getQuote());
  const hour = new Date().getHours();
  const greet = hour < 6 ? "Madrugada" : hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const totalMin = timeEntries.reduce((a, t) => a + t.minutes, 0);
  const pipeline = deals.filter((d) => !["won", "lost"].includes(d.stage)).reduce((a, d) => a + d.value, 0);
  const pending = Object.values(clients).flatMap((c) => c.comments || []).filter((c) => c.status === "pending").length;
  const sched = Object.values(clients).flatMap((c) => c.posts || []).filter((p) => p.status === "scheduled").length;
  return (
    <div>
      <section className="halo-bg" style={{ padding: "80px 0" }}>
        <div className="page-pad" style={{ paddingTop: 0, paddingBottom: 0, maxWidth: 1200, margin: "0 auto" }}>
          <div className="t-nano spaced-lg" style={{ color: "#88b0e0", marginBottom: 24 }}>{greet} · {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}</div>
          <h1 className="t-hero" style={{ color: "#fff" }}>Hola, <ET value={name} onChange={setName} as="span" style={{ color: "#88b0e0", display: "inline-block" }} />.</h1>
          <div style={{ marginTop: 40, maxWidth: 760 }}>
            <div className="t-nano spaced-lg" style={{ color: "#88b0e0", marginBottom: 16 }}>Frase del día</div>
            <p className="serif" style={{ fontSize: 30, lineHeight: 1.25, color: "#fff", fontStyle: "italic" }}>"{quote}"</p>
            <button onClick={() => setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)])} className="btn btn-ghost-light" style={{ marginTop: 16 }}><RefreshCw size={12} />Otra</button>
          </div>
          <div style={{ marginTop: 40, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={() => nav("clientes")} className="pill pill-fill" style={{ background: "#fff", color: "#0a1729", borderColor: "#fff" }}>Ver clientes<ChevronRight size={16} /></button>
            <button onClick={() => nav("analytics")} className="pill pill-out-light">Analytics</button>
          </div>
        </div>
      </section>

      <section style={{ background: "#f5f5f7" }}>
        <div className="page-pad" style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 12 }}>Hoy</div>
          <h2 className="t-section" style={{ marginBottom: 32 }}>Cómo va.</h2>
          <div className="grid-4">
            {[
              { l: "Pipeline abierto", v: `€${(pipeline / 1000).toFixed(1)}K`, d: `${deals.filter(d => !["won", "lost"].includes(d.stage)).length} leads activos`, warn: false, onClick: () => nav("crm") },
              { l: "Comentarios", v: pending, d: "por responder", warn: pending > 0, onClick: () => nav("inbox") },
              { l: "Posts programados", v: sched, d: "esta semana", warn: false, onClick: () => nav("calendar") },
              { l: "Horas trabajadas", v: `${(totalMin / 60).toFixed(0)}h`, d: "este mes", warn: false, onClick: () => nav("time") },
            ].map((m, i) => (
              <div key={i} onClick={m.onClick} className="card card-hov" style={{ padding: 24 }}>
                <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 12 }}>{m.l}</div>
                <div style={{ fontSize: 44, lineHeight: 1.05, fontWeight: 600, letterSpacing: "-0.8px", color: m.warn ? "#0071e3" : "#1d1d1f" }}>{m.v}</div>
                <div className="t-cap" style={{ color: "rgba(0,0,0,.56)", marginTop: 8 }}>{m.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: "#fff" }}>
        <div className="page-pad" style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 className="t-section" style={{ marginBottom: 32 }}>Atajos.</h2>
          <div className="grid-3">
            {[
              { icon: <Calendar size={20} />, title: "Programar posts", desc: "Calendario visual con preview de feed.", onClick: () => nav("calendar") },
              { icon: <Inbox size={20} />, title: "Responder comentarios", desc: "Inbox unificado con plantillas de marca.", onClick: () => nav("inbox") },
              { icon: <Briefcase size={20} />, title: "Cerrar leads", desc: "Pipeline kanban con propuestas.", onClick: () => nav("crm") },
              { icon: <Euro size={20} />, title: "Ver rentabilidad", desc: "¿Qué cliente te deja dinero de verdad?", onClick: () => nav("time") },
              { icon: <Award size={20} />, title: "Reporte mensual", desc: "Generado por IA del progreso del cliente.", onClick: () => nav("goals") },
              { icon: <Layers size={20} />, title: "Plantillas", desc: "Duplica un workflow listo para usar.", onClick: () => nav("templates") },
            ].map((t, i) => (
              <div key={i} onClick={t.onClick} className="card card-hov" style={{ padding: 24, background: "#f5f5f7" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#0071e3", marginBottom: 16 }}>{t.icon}</div>
                <div className="t-body-em" style={{ marginBottom: 4 }}>{t.title}</div>
                <div className="t-cap" style={{ color: "rgba(0,0,0,.56)" }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CLIENTES LIST
════════════════════════════════════════════════════════════════════ */
function ClientesPage({ nav, clients, user, addClient }) {
  const ids = Object.keys(clients).filter(k => k !== "frame");
  const isEd = user.role === "editor";
  const canCreate = user.role === "admin" || user.role === "socio";
  const [showNew, setShowNew] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ name: "", slug: "", sector: "", plan: "Retainer", mrr: "", rate: 50, email: "" });
  const slugify = (value) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  const setName = (name) => setForm(f => ({ ...f, name, slug: f.slug || slugify(name) }));
  const create = async (e) => {
    e?.preventDefault?.();
    setErr("");
    setMsg("");
    const slug = slugify(form.slug || form.name);
    if (!slug || !form.name.trim()) { setErr("Nombre y slug son obligatorios."); return; }
    if (clients[slug]) { setErr("Ya existe un cliente con ese slug."); return; }
    try {
      const saved = await addClient(slug, {
      name: form.name.trim(),
      sector: form.sector.trim(),
      plan: form.plan.trim(),
      mrr: form.mrr.trim(),
      rate: Number(form.rate) || 0,
      emoji: "○",
      tagline: "",
      });
      if (!saved) { setErr("No se pudo crear. Revisa permisos RLS de clients."); return; }

      const email = form.email.trim().toLowerCase();
      if (email) {
        const invite = {
          email,
          role: "client",
          workspace: saved.slug || slug,
          workspaces: null,
          invited_by: user.id,
        };
        const invited = await dbInvitations.upsert(invite);
        if (invited) {
          const existing = await dbUsers.getProfileByEmail(email);
          if (existing && user.role === "admin") {
            await dbUsers.update(existing.id, { role: "client", workspace: saved.slug || slug, workspaces: null });
          }
          setMsg(`Cliente creado e invitación preparada para ${email}.`);
        } else {
          setMsg("Cliente creado. No se pudo crear la invitación; revisa el SQL de invitations.");
        }
      }

      setShowNew(false);
      setForm({ name: "", slug: "", sector: "", plan: "Retainer", mrr: "", rate: 50, email: "" });
      nav("clientes", saved.slug || slug);
    } catch (error) {
      console.error("client create:", error);
      setErr("No se pudo crear el cliente. Revisa la consola y permisos RLS de clients.");
    }
  };
  return (
    <Shell>
      <div style={{ marginBottom: 48 }}>
        <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 12 }}>{isEd ? "ARCHIVOS CRUDOS POR CLIENTE" : "04 ACTIVOS · 1 LEAD"}</div>
        <h1 className="t-display" style={{ marginBottom: 16 }}>{isEd ? "Tus descargas." : "Clientes."}</h1>
        <p className="t-subnav" style={{ color: "rgba(0,0,0,.72)", maxWidth: 640 }}>
          {isEd ? "Selecciona un cliente para descargar su material bruto." : "Cada marca, un acento distinto. Primero escucho; después grabo."}
        </p>
      </div>
      {canCreate && (
        <div style={{ marginTop: -28, marginBottom: 32 }}>
          <button onClick={() => setShowNew(v => !v)} className="btn btn-blue"><Plus size={14} />Nuevo cliente</button>
        </div>
      )}
      {msg && <div className="card" style={{ padding: 16, marginBottom: 24, background: "#eef7ff", borderColor: "rgba(0,113,227,.18)", color: "#0a4ea1" }}>{msg}</div>}
      {showNew && (
        <form onSubmit={create} className="card" style={{ padding: 24, marginBottom: 32, background: "#f5f5f7" }}>
          <div className="t-body-em" style={{ marginBottom: 16 }}>Crear cliente / workspace</div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) minmax(160px,220px) minmax(220px,1fr)", gap: 12, marginBottom: 12 }}>
            <input className="input" value={form.name} onChange={e => setName(e.target.value)} placeholder="Nombre del cliente" autoFocus />
            <input className="input" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))} placeholder="slug-workspace" />
            <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@cliente.com" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 140px 120px", gap: 12 }}>
            <input className="input" value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))} placeholder="Sector" />
            <select className="input" value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
              <option value="Retainer">Retainer</option>
              <option value="Puntual">Puntual</option>
              <option value="Recurrente">Recurrente</option>
            </select>
            <input className="input" value={form.mrr} onChange={e => setForm(f => ({ ...f, mrr: e.target.value }))} placeholder="MRR" />
            <input className="input" type="number" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} placeholder="Precio acción" />
          </div>
          {err && <div className="t-cap" style={{ color: "#FF3B30", marginTop: 12 }}>{err}</div>}
          <div className="t-mic" style={{ marginTop: 10, color: "rgba(0,0,0,.48)" }}>Si escribes un email, se crea también la invitación de cliente para ese workspace.</div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" onClick={() => setShowNew(false)} className="btn btn-ghost">Cancelar</button>
            <button type="submit" className="btn btn-blue"><Plus size={12} />Crear</button>
          </div>
        </form>
      )}
      {ids.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", background: "#f5f5f7" }}>
          <Users size={28} style={{ marginBottom: 12, color: "rgba(0,0,0,.36)" }} />
          <div className="t-body-em" style={{ marginBottom: 6 }}>Sin clientes todavia.</div>
          <div className="t-cap" style={{ color: "rgba(0,0,0,.56)" }}>Crea clientes en Supabase o desde el flujo de alta para empezar a operar.</div>
        </div>
      )}
      <div className="grid-2">
        {ids.map((id) => {
          const c = clients[id];
          if (!c) return null;
          return (
            <button key={id} onClick={() => nav("clientes", id)} className="card card-hov" style={{ background: "#f5f5f7", border: "none", padding: 0, fontFamily: "inherit", textAlign: "left", cursor: "pointer" }}>
              <div style={{ height: 176, background: c.cover, position: "relative" }}>
                <div style={{ position: "absolute", top: 16, right: 16, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.92)", display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 999, background: "#34C759" }} />
                  <span className="t-mic-b">activo</span>
                </div>
              </div>
              <div style={{ padding: 28 }}>
                <div className="t-tile" style={{ fontWeight: 600, letterSpacing: "-0.28px", marginBottom: 4 }}>{c.name}</div>
                <div className="t-body" style={{ color: "rgba(0,0,0,.56)" }}>{c.sector}</div>
                <div style={{ marginTop: 24, paddingTop: 20, display: "flex", alignItems: "center", gap: 24, borderTop: "1px solid rgba(0,0,0,.08)", flexWrap: "wrap" }}>
                  {isEd ? <>
                    <div><div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.36)" }}>ARCHIVOS</div><div className="t-body-em" style={{ marginTop: 2 }}>{(c.rawFiles || []).length} disponibles</div></div>
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 14, color: "#0066cc" }}><Download size={14} />Descargar</div>
                  </> : <>
                    <div><div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.36)" }}>MRR</div><div className="t-body-em" style={{ marginTop: 2 }}>{c.mrr}</div></div>
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 14, color: "#0066cc" }}>Abrir<ArrowRight size={14} /></div>
                  </>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CLIENT DETAIL
════════════════════════════════════════════════════════════════════ */
function ClientDetail({ clientId, clients, updateClient, user, timeEntries, addTimeEntry, removeTimeEntry }) {
  const data = fromDb(clients[clientId]);
  const isEditor = user.role === "editor";
  const isClient = user.role === "client";
  const canEdit = !isEditor && !isClient;
  const [tab, setTab] = useState(isEditor ? "raw" : "brief");
  const upd = (k) => (v) => updateClient(clientId, { [k]: v });
  if (!data) return null;

  const tabs = isEditor
    ? [["raw", "Archivos crudos"]]
    : [["brief", "Brief"], ["entregables", "Entregables"], ["raw", "Archivos crudos"], ["contratos", "Contratos"], ["comunicacion", "Comunicación"]];

  return (
    <div>
      <div style={{ height: 240, background: data.cover }} />
      <Shell>
        {/* Avatar */}
        <div style={{ marginTop: -64, position: "relative", marginBottom: 32 }}>
          <div style={{ width: 80, height: 80, borderRadius: 16, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 24px rgba(0,0,0,.12),inset 0 0 0 6px #fff", fontSize: 36 }}>{data.emoji}</div>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.36)" }}>CLIENTE</span>
            <span className="t-nano spaced-md" style={{ color: "#0071e3" }}>ACTIVO</span>
            {!canEdit && <span className="role-pill" style={{ background: "#f5f5f7", color: "rgba(0,0,0,.56)" }}><Lock size={9} />{isClient ? "Lectura + chat" : "Solo descarga"}</span>}
          </div>
          <ET as="h1" className="t-display" value={data.name} onChange={upd("name")} ro={!canEdit} />
          <ET className="t-subnav" style={{ color: "rgba(0,0,0,.56)", marginTop: 8 }} value={data.tagline} onChange={upd("tagline")} ro={!canEdit} />
        </div>

        {/* Meta */}
        {!isEditor && (
          <div className="grid-4" style={{ marginBottom: 32, background: "#f5f5f7", borderRadius: 16, gap: 0, overflow: "hidden" }}>
            {[["Sector", data.sector, "sector"], ["Desde", data.since, "since"], ["Plan", data.plan, "plan"], ["MRR", data.mrr, "mrr"]].map(([k, v, f], i) => (
              <div key={i} style={{ padding: 20, borderRight: i < 3 ? "1px solid rgba(0,0,0,.06)" : "none" }}>
                <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.36)", marginBottom: 8 }}>{k}</div>
                <ET className="t-body-em" value={v} onChange={upd(f)} ro={!canEdit} />
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 32, marginBottom: 32, borderBottom: "1px solid rgba(0,0,0,.08)", overflowX: "auto" }} className="sb">
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ background: "transparent", border: "none", padding: "12px 0", marginBottom: -1, fontFamily: "inherit", cursor: "pointer", fontSize: 17, letterSpacing: "-0.374px", color: tab === k ? "#1d1d1f" : "rgba(0,0,0,.56)", fontWeight: tab === k ? 500 : 400, borderBottom: tab === k ? "2px solid #1d1d1f" : "2px solid transparent", whiteSpace: "nowrap" }}>{l}</button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "brief" && <BriefTab data={data} upd={upd} canEdit={canEdit} />}
        {tab === "entregables" && <DeliverablesTab data={data} upd={upd} canEdit={canEdit} />}
        {tab === "raw" && <RawTab data={data} upd={upd} canEdit={canEdit} />}
        {tab === "contratos" && <ContratosTab data={data} />}
        {tab === "comunicacion" && <ChatTab data={data} upd={upd} user={user} />}
      </Shell>
    </div>
  );
}

/* ─── BRIEF TAB ─────────────────────────────────────────────────── */
function BriefTab({ data, upd, canEdit }) {
  return (
    <div className={canEdit ? "" : "readonly"}>
      {/* About */}
      <div style={{ marginBottom: 48 }}>
        <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.36)", marginBottom: 16 }}>SOBRE LA MARCA</div>
        <ET as="p" multiline className="t-card" style={{ color: "#1d1d1f", lineHeight: 1.45 }} value={data.about} onChange={upd("about")} placeholder="Describe la marca…" ro={!canEdit} />
      </div>

      {/* Voz */}
      <div style={{ marginBottom: 48, padding: 24, background: "#f5f5f7", borderRadius: 16 }}>
        <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.36)", marginBottom: 8 }}>VOZ DE MARCA · plantillas de respuesta usarán este tono</div>
        <ET as="p" multiline className="t-body" style={{ color: "rgba(0,0,0,.8)" }} value={data.voice} onChange={upd("voice")} placeholder="Describe el tono…" ro={!canEdit} />
      </div>

      {/* Photos */}
      <PhotoGallery photos={data.photos || []} onChange={upd("photos")} canEdit={canEdit} />
      {/* Fonts */}
      <FontPreview fonts={data.fonts || []} onChange={upd("fonts")} canEdit={canEdit} />
      {/* Palette */}
      <ColorPalette palette={data.palette || []} onChange={upd("palette")} canEdit={canEdit} />
      {/* Growth */}
      <GrowthChart growth={data.growth || []} goal={data.goalText || ""} onChg={upd("growth")} onChgGoal={upd("goalText")} canEdit={canEdit} />
    </div>
  );
}

function PhotoGallery({ photos, onChange, canEdit }) {
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const add = () => {
    onChange([...photos, { id: `p${Date.now()}`, url: url.trim(), color: "linear-gradient(135deg,#88b0e0,#0a1729)" }]);
    setUrl(""); setAdding(false);
  };
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", gap: 8 }}><Camera size={12} />GALERÍA · {photos.length}</div>
        {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => setAdding(!adding)}><Plus size={12} />Añadir foto</button>}
      </div>
      {adding && canEdit && (
        <div className="fade-in" style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL de imagen (o deja vacío para placeholder)" className="input" style={{ flex: 1, minWidth: 240 }} />
          <button onClick={add} className="btn btn-blue">Añadir</button>
          <button onClick={() => setAdding(false)} className="btn btn-ghost">×</button>
        </div>
      )}
      <div className="grid-3">
        {photos.length === 0 && <div style={{ gridColumn: "1/-1", padding: 40, borderRadius: 16, background: "#f5f5f7", textAlign: "center", color: "rgba(0,0,0,.4)" }}><ImageIcon size={24} style={{ marginBottom: 8 }} /><div className="t-cap">{canEdit ? "Añade fotos arriba." : "Sin fotos."}</div></div>}
        {photos.map((p) => (
          <div key={p.id} style={{ position: "relative", aspectRatio: "1", borderRadius: 16, overflow: "hidden", background: p.color }}>
            {p.url && <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />}
            {canEdit && <button onClick={() => onChange(photos.filter(x => x.id !== p.id))} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 999, background: "rgba(0,0,0,.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={12} /></button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function FontPreview({ fonts, onChange, canEdit }) {
  const [adding, setAdding] = useState(false);
  const [fn, setFn] = useState("");
  const [role, setRole] = useState("Display");
  useEffect(() => {
    fonts.forEach((f) => {
      const id = `gf-${f.name.replace(/\s/g, "")}`;
      if (!document.getElementById(id)) {
        const link = document.createElement("link"); link.id = id; link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${f.name.replace(/ /g, "+")}:wght@400;600&display=swap`;
        document.head.appendChild(link);
      }
    });
  }, [fonts]);
  const add = () => {
    if (!fn.trim()) return;
    onChange([...fonts, { id: `f${Date.now()}`, name: fn.trim(), role }]);
    setFn(""); setAdding(false);
  };
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", gap: 8 }}><Type size={12} />TIPOGRAFÍAS</div>
        {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => setAdding(!adding)}><Plus size={12} />Añadir fuente</button>}
      </div>
      {adding && canEdit && (
        <div className="fade-in" style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={fn} onChange={(e) => setFn(e.target.value)} placeholder="Nombre exacto en Google Fonts (ej: Playfair Display)" className="input" style={{ flex: 1, minWidth: 240 }} />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="input" style={{ width: 130, padding: "12px 14px" }}>
            <option>Display</option><option>Body</option><option>Acento</option>
          </select>
          <button onClick={add} className="btn btn-blue">Añadir</button>
        </div>
      )}
      <div className="grid-2">
        {fonts.map((f) => (
          <div key={f.id} className="card" style={{ background: "#f5f5f7", padding: 24, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div><div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.36)" }}>{f.role}</div><div className="t-body-em" style={{ marginTop: 4 }}>{f.name}</div></div>
              {canEdit && <button onClick={() => onChange(fonts.filter(x => x.id !== f.id))} style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(0,0,0,.4)", padding: 4 }}><Trash2 size={12} /></button>}
            </div>
            <div style={{ fontFamily: `"${f.name}", serif`, fontSize: 36, lineHeight: 1.1, marginBottom: 8 }}>Aa Bb Cc 123</div>
            <div style={{ fontFamily: `"${f.name}", sans-serif`, fontSize: 14, color: "rgba(0,0,0,.56)" }}>The quick brown fox jumps over the lazy dog</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColorPalette({ palette, onChange, canEdit }) {
  const add = () => onChange([...palette, { id: `c${Date.now()}`, hex: "#888888", name: "Nuevo color" }]);
  const upd = (id, p) => onChange(palette.map((c) => c.id === id ? { ...c, ...p } : c));
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", gap: 8 }}><Palette size={12} />PALETA · {palette.length} COLORES</div>
        {canEdit && <button className="btn btn-ghost btn-sm" onClick={add}><Plus size={12} />Añadir</button>}
      </div>
      <div className="grid-4">
        {palette.map((c) => (
          <div key={c.id} className="card" style={{ background: "#f5f5f7", overflow: "hidden", position: "relative" }}>
            <label style={{ display: "block", aspectRatio: "1.6", background: c.hex, cursor: canEdit ? "pointer" : "default" }}>
              {canEdit && <input type="color" value={c.hex} onChange={(e) => upd(c.id, { hex: e.target.value })} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />}
            </label>
            <div style={{ padding: 14 }}>
              <ET className="t-cap-b" value={c.name} onChange={(v) => upd(c.id, { name: v })} ro={!canEdit} />
              <div className="t-mic" style={{ color: "rgba(0,0,0,.56)", fontFamily: "monospace", marginTop: 4 }}>{c.hex.toUpperCase()}</div>
            </div>
            {canEdit && <button onClick={() => onChange(palette.filter(x => x.id !== c.id))} style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 999, background: "rgba(0,0,0,.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={11} /></button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function GrowthChart({ growth, goal, onChg, onChgGoal, canEdit }) {
  const [edit, setEdit] = useState(false);
  if (!growth || growth.length === 0) growth = [{ m: "—", v: 0 }];
  const max = Math.max(...growth.map(g => g.v), 1);
  const W = 700, H = 200, pad = 30;
  const x = (i) => pad + (i / Math.max(1, growth.length - 1)) * (W - pad * 2);
  const y = (v) => pad + ((max - v) / max) * (H - pad * 2);
  const path = growth.map((g, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(g.v)}`).join(" ");
  const area = `${path} L ${x(growth.length - 1)} ${H - pad} L ${x(0)} ${H - pad} Z`;
  const last = growth[growth.length - 1].v, first = growth[0].v;
  const pct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", gap: 8 }}><TrendingUp size={12} />PROGRESIÓN</div>
        {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => setEdit(!edit)}>{edit ? "Listo" : "Editar datos"}</button>}
      </div>
      <div className="card halo-bg" style={{ padding: 32, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
            <div>
              <div className="t-nano spaced-md" style={{ color: "#88b0e0", marginBottom: 8 }}>OBJETIVO</div>
              <ET className="t-card" style={{ color: "#fff" }} value={goal} onChange={onChgGoal} placeholder="Define el objetivo…" ro={!canEdit} />
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="t-nano spaced-md" style={{ color: "#88b0e0", marginBottom: 8 }}>ACTUAL</div>
              <div style={{ fontSize: 40, lineHeight: 1, fontWeight: 600, letterSpacing: "-0.6px", color: "#fff" }}>{last >= 1000 ? `${(last / 1000).toFixed(1)}K` : last}</div>
              <div className="t-cap" style={{ color: pct >= 0 ? "#34c759" : "#ff6961", marginTop: 4 }}>{pct >= 0 ? "+" : ""}{pct}% periodo</div>
            </div>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 180 }}>
            <defs>
              <linearGradient id="grad2" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#88b0e0" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#88b0e0" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#grad2)" />
            <path d={path} stroke="#88b0e0" strokeWidth="2" fill="none" />
            {growth.map((g, i) => (
              <React.Fragment key={i}>
                <circle cx={x(i)} cy={y(g.v)} r={i === growth.length - 1 ? 5 : 3} fill="#fff" stroke="#88b0e0" strokeWidth="2" />
                <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,.6)" fontFamily="monospace">{g.m}</text>
              </React.Fragment>
            ))}
          </svg>
          {edit && canEdit && (
            <div className="fade-in" style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {growth.map((g, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div className="t-nano spaced-md" style={{ color: "rgba(255,255,255,.5)" }}>{g.m}</div>
                  <input type="number" value={g.v} onChange={(e) => onChg(growth.map((x, j) => j === i ? { ...x, v: parseInt(e.target.value) || 0 } : x))} className="input-dark input-sm" style={{ width: 90 }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── DELIVERABLES TAB ──────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════════
   SWISSTRANSFER UTILS
══════════════════════════════════════════════════════════════════ */
const isSwiss = (url) => /swisstransfer\.com/i.test(url || "");

function STBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999,
      background: "#E8F4EC", border: "1px solid #C3DFC9",
      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#1A6E34",
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1A6E34" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      SwissTransfer
    </span>
  );
}

function STDownloadBtn({ href, label = "Descargar", size = "normal" }) {
  const sm = size === "sm";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex", alignItems: "center", gap: sm ? 6 : 8,
        padding: sm ? "7px 12px" : "10px 18px",
        borderRadius: sm ? 8 : 12,
        background: "#fff",
        border: "1.5px solid #C3DFC9",
        color: "#1A6E34",
        textDecoration: "none",
        fontSize: sm ? 12 : 14,
        fontWeight: 600,
        fontFamily: "inherit",
        transition: "all 160ms",
        boxShadow: "0 1px 4px rgba(26,110,52,0.08)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#E8F4EC"; e.currentTarget.style.borderColor = "#1A6E34"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#C3DFC9"; }}
    >
      <svg width={sm ? 12 : 14} height={sm ? 12 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {label}
      <STBadge />
    </a>
  );
}

function STLinkInput({ value, onChange, placeholder = "Pega el link de SwissTransfer aquí…" }) {
  const valid = isSwiss(value);
  return (
    <div style={{ position: "relative" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", borderRadius: 10,
        background: valid ? "#E8F4EC" : "#f5f5f7",
        border: `1.5px solid ${valid ? "#C3DFC9" : "rgba(0,0,0,0.1)"}`,
        transition: "all 200ms",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={valid ? "#1A6E34" : "rgba(0,0,0,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        <input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, fontFamily: "inherit", color: "#1d1d1f" }}
        />
        {valid && <STBadge />}
      </div>
      {value && !valid && (
        <div className="t-mic" style={{ color: "#FF9500", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          Usamos SwissTransfer — el link debería ser de swisstransfer.com
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   DELIVERABLES TAB
══════════════════════════════════════════════════════════════════ */
function DeliverablesTab({ data, upd, canEdit }) {
  const list = data.deliverables || [];
  const [editId, setEditId] = useState(null);
  const updItem = (id, p) => upd("deliverables")(list.map((d) => d.id === id ? { ...d, ...p } : d));
  const add = () => upd("deliverables")([...list, { id: `d${Date.now()}`, name: "Nuevo entregable", status: "draft", due: "—", link: "" }]);
  const rm = (id) => { upd("deliverables")(list.filter((d) => d.id !== id)); if (editId === id) setEditId(null); };
  const statusMeta = {
    draft: { label: "Borrador", color: "rgba(0,0,0,.5)", bg: "#f0f0f0" },
    "en edición": { label: "En edición", color: "#FF9500", bg: "#FFF4E0" },
    "revisión cliente": { label: "Revisión cliente", color: "#a78bfa", bg: "#F0EEFF" },
    aprobado: { label: "Aprobado", color: "#1A6E34", bg: "#E8F4EC" },
    programado: { label: "Programado", color: "#0071e3", bg: "#E5F1FF" },
    live: { label: "Live ✓", color: "#1A6E34", bg: "#E8F4EC" },
    guión: { label: "Guión", color: "rgba(0,0,0,.5)", bg: "#f0f0f0" },
  };

  return (
    <div>
      {/* Cabecera info */}
      {canEdit && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, background: "#E8F4EC", border: "1px solid #C3DFC9", marginBottom: 20 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A6E34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <div className="t-cap" style={{ flex: 1, color: "#1A6E34" }}>
            Los archivos se entregan vía <b>SwissTransfer</b>. Sube el archivo allí y pega el link en cada entregable.
          </div>
          <a href="https://www.swisstransfer.com" target="_blank" rel="noopener noreferrer" className="t-mic-b" style={{ color: "#1A6E34", textDecoration: "none", padding: "4px 10px", borderRadius: 6, border: "1px solid #C3DFC9", background: "#fff", whiteSpace: "nowrap" }}>
            Ir a SwissTransfer ↗
          </a>
        </div>
      )}

      {list.map((d) => {
        const sm = statusMeta[d.status] || statusMeta.draft;
        const hasSwiss = isSwiss(d.link);
        const isOpen = editId === d.id;
        return (
          <div key={d.id} style={{ marginBottom: 12, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)", background: "#fff" }}>
            {/* Fila principal */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", flexWrap: "wrap" }}>
              {/* Status dot */}
              <div style={{ width: 10, height: 10, borderRadius: 999, background: sm.color, flexShrink: 0 }} />

              {/* Nombre */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <ET className="t-body-em" value={d.name} onChange={(v) => updItem(d.id, { name: v })} ro={!canEdit} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span className="t-mic-b" style={{ padding: "2px 8px", borderRadius: 999, background: sm.bg, color: sm.color }}>{sm.label}</span>
                  <span className="t-mic" style={{ color: "rgba(0,0,0,.4)" }}>· {d.due}</span>
                </div>
              </div>

              {/* Botón descarga o estado sin link */}
              {d.link && hasSwiss
                ? <STDownloadBtn href={d.link} size="sm" />
                : d.link
                  ? <a href={d.link} target="_blank" rel="noopener noreferrer" className="btn btn-blue" style={{ textDecoration: "none", fontSize: 13 }}>
                    <Download size={12} />Descargar
                  </a>
                  : canEdit
                    ? <button className="btn btn-ghost" style={{ border: "1px dashed rgba(0,0,0,.2)", fontSize: 13 }} onClick={() => setEditId(isOpen ? null : d.id)}>
                      <Plus size={12} />Añadir link
                    </button>
                    : <span className="t-mic" style={{ color: "rgba(0,0,0,.36)", padding: "6px 10px", borderRadius: 8, background: "#f5f5f7" }}>
                      Próximamente
                    </span>
              }

              {/* Editar / borrar */}
              {canEdit && (
                <div style={{
                  display: "flex", gap: 4 }}>
                    <button onClick = { ()=> setEditId(isOpen?null: d.id)} style={{ padding: 6, borderRadius: 6, background: "transparent", border: "none", cursor: "pointer", color: "rgba(0,0,0,.4)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            </button>
            <button onClick={() => rm(d.id)} style={{ padding: 6, borderRadius: 6, background: "transparent", border: "none", cursor: "pointer", color: "rgba(0,0,0,.3)" }}>
              <Trash2 size={13} />
            </button>
          </div>
        )
      }
            </div>

            {/* Panel expandible de edición */ }
  {
    isOpen && canEdit && (
      <div className="fade-in" style={{ padding: "16px 20px", background: "#fafafa", borderTop: "1px solid rgba(0,0,0,.06)" }}>
        <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 8 }}>LINK DE DESCARGA · SWISSTRANSFER</div>
        <STLinkInput value={d.link || ""} onChange={(v) => updItem(d.id, { link: v })} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
          <div>
            <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 5 }}>FECHA ENTREGA</div>
            <input value={d.due} onChange={(e) => updItem(d.id, { due: e.target.value })} placeholder="25 ABR" className="input input-sm" />
          </div>
          <div>
            <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 5 }}>ESTADO</div>
            <select value={d.status} onChange={(e) => updItem(d.id, { status: e.target.value })} className="input input-sm">
              <option value="draft">Borrador</option>
              <option value="en edición">En edición</option>
              <option value="revisión cliente">Revisión cliente</option>
              <option value="aprobado">Aprobado</option>
              <option value="programado">Programado</option>
              <option value="live">Live</option>
            </select>
          </div>
        </div>
      </div>
    )
  }
          </div >
        );
})}

{
  canEdit && (
    <button onClick={add} className="btn btn-ghost" style={{ marginTop: 8, border: "1px dashed rgba(0,0,0,.15)" }}>
      <Plus size={13} />Añadir entregable
    </button>
  )
}
{
  list.length === 0 && !canEdit && (
    <div style={{ padding: 60, borderRadius: 20, background: "#f5f5f7", textAlign: "center", color: "rgba(0,0,0,.4)" }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, opacity: 0.5 }}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <div className="t-cap-b" style={{ marginBottom: 4, color: "rgba(0,0,0,.6)" }}>Aún no hay entregables disponibles</div>
      <div className="t-cap">Tu agencia los compartirá pronto vía SwissTransfer.</div>
    </div>
  )
}
    </div >
  );
}

/* ══════════════════════════════════════════════════════════════════
   RAW FILES TAB
══════════════════════════════════════════════════════════════════ */
function RawTab({ data, upd, canEdit }) {
  const list = data.rawFiles || [];
  const [editId, setEditId] = useState(null);
  const updItem = (id, p) => upd("rawFiles")(list.map((r) => r.id === id ? { ...r, ...p } : r));
  const add = () => upd("rawFiles")([...list, { id: `r${Date.now()}`, name: "Nueva carpeta de material", date: "—", size: "—", link: "" }]);
  const rm = (id) => { upd("rawFiles")(list.filter((r) => r.id !== id)); if (editId === id) setEditId(null); };
  const totalSize = list.filter(r => r.size && r.size !== "—").reduce((acc, r) => {
    const n = parseFloat(r.size); return isNaN(n) ? acc : acc + n;
  }, 0);

  return (
    <div>
      {/* Header banner */}
      <div className="halo-bg" style={{ padding: "20px 24px", borderRadius: 16, marginBottom: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <HardDrive size={22} style={{ color: "#88b0e0" }} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="t-nano spaced-md" style={{ color: "#88b0e0", marginBottom: 4 }}>MATERIAL BRUTO · SOLO EQUIPO GONZO</div>
          <div className="t-body" style={{ color: "rgba(255,255,255,.9)" }}>
            {list.length} {list.length === 1 ? "carpeta" : "carpetas"}
            {totalSize > 0 && <> · <b>{totalSize.toFixed(0)} GB</b> en total</>}
            {" · "}archivos sin editar de cada rodaje
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)" }}>
          <STBadge />
          <span className="t-mic" style={{ color: "rgba(255,255,255,.7)" }}>vía SwissTransfer</span>
        </div>
      </div>

      {list.map((r) => {
        const hasSwiss = isSwiss(r.link);
        const isOpen = editId === r.id;
        return (
          <div key={r.id} style={{ marginBottom: 10, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)", background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", flexWrap: "wrap" }}>
              {/* Folder icon */}
              <div style={{ width: 46, height: 46, borderRadius: 12, background: "#f5f5f7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FolderOpen size={20} style={{ color: "rgba(0,0,0,.55)" }} />
              </div>

              {/* Nombre + meta */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <ET className="t-body-em" value={r.name} onChange={(v) => updItem(r.id, { name: v })} ro={!canEdit} />
                <div className="t-mic" style={{ color: "rgba(0,0,0,.5)", marginTop: 3 }}>{r.date} · {r.size}</div>
              </div>

              {/* Descarga */}
              {r.link && hasSwiss
                ? <STDownloadBtn href={r.link} label="Descargar material" size="sm" />
                : r.link
                  ? <a href={r.link} target="_blank" rel="noopener noreferrer" className="btn btn-dark" style={{ textDecoration: "none", fontSize: 13 }}>
                    <Download size={12} />Descargar
                  </a>
                  : canEdit
                    ? <button className="btn btn-ghost" style={{ border: "1px dashed rgba(0,0,0,.2)", fontSize: 13 }} onClick={() => setEditId(isOpen ? null : r.id)}>
                      <Plus size={12} />Añadir link
                    </button>
                    : <span className="t-mic" style={{ color: "rgba(0,0,0,.36)" }}>Sin link aún</span>
              }

              {canEdit && (
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setEditId(isOpen ? null : r.id)} style={{ padding: 6, borderRadius: 6, background: "transparent", border: "none", cursor: "pointer", color: "rgba(0,0,0,.4)" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                  <button onClick={() => rm(r.id)} style={{ padding: 6, borderRadius: 6, background: "transparent", border: "none", cursor: "pointer", color: "rgba(0,0,0,.3)" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Panel edición */}
            {isOpen && canEdit && (
              <div className="fade-in" style={{ padding: "16px 20px", background: "#fafafa", borderTop: "1px solid rgba(0,0,0,.06)" }}>
                <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 8 }}>LINK DE DESCARGA · SWISSTRANSFER</div>
                <STLinkInput value={r.link || ""} onChange={(v) => updItem(r.id, { link: v })} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                  <div>
                    <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 5 }}>FECHA</div>
                    <input value={r.date} onChange={(e) => updItem(r.id, { date: e.target.value })} placeholder="18 ABR" className="input input-sm" />
                  </div>
                  <div>
                    <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 5 }}>PESO</div>
                    <input value={r.size} onChange={(e) => updItem(r.id, { size: e.target.value })} placeholder="84 GB" className="input input-sm" />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {canEdit && (
        <button onClick={add} className="btn btn-ghost" style={{ marginTop: 8, border: "1px dashed rgba(0,0,0,.15)" }}>
          <Plus size={13} />Añadir carpeta de material
        </button>
      )}
      {list.length === 0 && (
        <div style={{ padding: 40, borderRadius: 16, background: "#f5f5f7", textAlign: "center", color: "rgba(0,0,0,.4)" }}>
          <HardDrive size={24} style={{ marginBottom: 8, opacity: .5 }} />
          <div className="t-cap">Aún no hay material bruto. {canEdit && "Añade la primera carpeta arriba."}</div>
        </div>
      )}
    </div>
  );
}

function ContratosTab({ data }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {["Retainer mensual · v2", "Cesión de derechos de imagen", "NDA de material bruto"].map((t, i) => (
        <div key={i} className="card card-hov" style={{ background: "#f5f5f7", padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
          <FileText size={20} style={{ color: "rgba(0,0,0,.56)" }} />
          <div style={{ flex: 1 }}><div className="t-body-em">{t}</div><div className="t-cap" style={{ color: "rgba(0,0,0,.56)" }}>Firmado · {data.since}</div></div>
          <CheckCircle2 size={18} style={{ color: "#34C759" }} />
        </div>
      ))}
    </div>
  );
}

/* ─── CHAT TAB ──────────────────────────────────────────────────── */
function ChatTab({ data, upd, user }) {
  const [text, setText] = useState("");
  const list = data.chat || [];
  const send = () => {
    if (!text.trim()) return;
    upd("chat")([...list, { id: `m${Date.now()}`, from: user.role === "client" ? "client" : "agency", name: user.name, text: text.trim(), at: "ahora" }]);
    setText("");
  };
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {list.length === 0 && <div style={{ padding: 40, borderRadius: 16, background: "#f5f5f7", textAlign: "center", color: "rgba(0,0,0,.4)" }}><Send size={24} style={{ marginBottom: 8 }} /><div className="t-cap">Empieza la conversación.</div></div>}
        {list.map((m) => {
          const mine = (m.from === "client" && user.role === "client") || (m.from === "agency" && user.role !== "client");
          return (
            <div key={m.id} className="card" style={{ background: mine ? "#0071e3" : "#f5f5f7", color: mine ? "#fff" : "#1d1d1f", padding: 20, alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%", marginLeft: mine ? "auto" : 0 }}>
              <div className="t-cap-b" style={{ marginBottom: 8, color: mine ? "rgba(255,255,255,.9)" : "#1d1d1f" }}>{m.name} · {m.at}</div>
              <p className="t-body" style={{ color: mine ? "rgba(255,255,255,.95)" : "rgba(0,0,0,.8)" }}>{m.text}</p>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} className="input" placeholder="Escribe un mensaje…" />
        <button onClick={send} disabled={!text.trim()} className="btn btn-blue"><Send size={14} /></button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CONTENT CALENDAR
════════════════════════════════════════════════════════════════════ */
function ContentCalendar({ clients, updateClient }) {
  const ids = Object.keys(clients).filter(k => k !== "frame");
  const [active, setActive] = useState(() => ids[0] || "");
  const [view, setView] = useState("calendar");
  const [dragging, setDragging] = useState(null);
  const [editing, setEditing] = useState(null);
  const client = clients[active];

  useEffect(() => {
    if ((!active || !clients[active]) && ids[0]) setActive(ids[0]);
  }, [active, ids.join("|"), clients]);

  if (ids.length === 0 || !client) {
    return (
      <Shell>
        <div style={{ marginBottom: 32 }}>
          <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 12 }}>PLANIFICACION</div>
          <h1 className="t-display" style={{ marginBottom: 16 }}>Content Calendar.</h1>
        </div>
        <div className="card" style={{ padding: 40, textAlign: "center", background: "#f5f5f7" }}>
          <Calendar size={28} style={{ marginBottom: 12, color: "rgba(0,0,0,.36)" }} />
          <div className="t-body-em" style={{ marginBottom: 6 }}>No hay clientes disponibles.</div>
          <div className="t-cap" style={{ color: "rgba(0,0,0,.56)" }}>Cuando haya al menos un cliente en Supabase, su calendario aparecera aqui.</div>
        </div>
      </Shell>
    );
  }

  const today = new Date(); const year = today.getFullYear(); const month = today.getMonth();
  const startWd = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = today.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const days = []; for (let i = 0; i < startWd; i++) days.push(null); for (let d = 1; d <= daysInMonth; d++) days.push(d);
  const postsByDay = (client.posts || []).reduce((acc, p) => { if (!acc[p.date]) acc[p.date] = []; acc[p.date].push(p); return acc; }, {});
  const movePost = (id, date) => updateClient(active, { posts: (client.posts || []).map((p) => p.id === id ? { ...p, date } : p) });
  const updPost = (id, patch) => updateClient(active, { posts: (client.posts || []).map((p) => p.id === id ? { ...p, ...patch } : p) });
  const addPost = (date) => {
    const np = { id: `p${Date.now()}`, date, type: "post", title: "Nuevo post", caption: "", hashtags: "", thumb: "linear-gradient(135deg,#88b0e0,#0a1729)", platform: "ig", status: "draft" };
    updateClient(active, { posts: [...(client.posts || []), np] }); setEditing(np);
  };
  const rmPost = (id) => { updateClient(active, { posts: (client.posts || []).filter((p) => p.id !== id) }); setEditing(null); };
  const feedPosts = [...(client.posts || [])].sort((a, b) => b.date - a.date);

  return (
    <Shell>
      <div style={{ marginBottom: 32 }}>
        <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 12 }}>PLANIFICACIÓN · POR CLIENTE</div>
        <h1 className="t-display" style={{ marginBottom: 16 }}>Content Calendar.</h1>
        <p className="t-subnav" style={{ color: "rgba(0,0,0,.72)", maxWidth: 720 }}>Arrastra posts entre días. Previsualiza el feed. Un calendario por cliente.</p>
      </div>

      {/* Client tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {ids.map((id) => (
          <button key={id} onClick={() => setActive(id)}
            style={{ padding: "10px 18px", borderRadius: 999, border: "1px solid", background: active === id ? "#1d1d1f" : "#fff", borderColor: active === id ? "#1d1d1f" : "rgba(0,0,0,.12)", color: active === id ? "#fff" : "#1d1d1f", fontFamily: "inherit", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span>{clients[id].emoji}</span>{clients[id].name}
            <span className="t-mic" style={{ opacity: .6 }}>{(clients[id].posts || []).length}</span>
          </button>
        ))}
      </div>

      {/* View switcher + month */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div className="t-tile" style={{ fontWeight: 600, letterSpacing: "-0.28px", textTransform: "capitalize" }}>{monthName}</div>
        <div style={{ display: "flex", gap: 4, padding: 4, background: "#f5f5f7", borderRadius: 10 }}>
          <button onClick={() => setView("calendar")} className="btn" style={{ background: view === "calendar" ? "#fff" : "transparent", boxShadow: view === "calendar" ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}><Calendar size={12} />Calendario</button>
          <button onClick={() => setView("feed")} className="btn" style={{ background: view === "feed" ? "#fff" : "transparent", boxShadow: view === "feed" ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}><Instagram size={12} />Preview feed</button>
        </div>
      </div>

      {view === "calendar" && (
        <div style={{ background: "#f5f5f7", borderRadius: 16, padding: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <div key={d} className="t-nano spaced-md" style={{ padding: "8px 0", textAlign: "center", color: "rgba(0,0,0,.4)" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
            {days.map((d, i) => {
              const isToday = d === today.getDate();
              const dayPosts = d ? (postsByDay[d] || []) : [];
              return (
                <div key={i}
                  onDragOver={(e) => { if (d) { e.preventDefault(); e.currentTarget.classList.add("drag-over"); } }}
                  onDragLeave={(e) => e.currentTarget.classList.remove("drag-over")}
                  onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("drag-over"); if (d && dragging) { movePost(dragging, d); setDragging(null); } }}
                  style={{ background: d ? "#fff" : "transparent", borderRadius: 10, padding: 8, minHeight: 110, border: isToday ? "1.5px solid #0071e3" : "1px solid transparent", display: "flex", flexDirection: "column", gap: 4 }}>
                  {d && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <span className="t-mic-b" style={{ color: isToday ? "#0071e3" : "rgba(0,0,0,.6)" }}>{d}</span>
                        <button onClick={() => addPost(d)} style={{ width: 18, height: 18, borderRadius: 999, background: "rgba(0,0,0,.04)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(0,0,0,.4)" }}><Plus size={11} /></button>
                      </div>
                      {dayPosts.map((p) => (
                        <div key={p.id} draggable onDragStart={() => setDragging(p.id)} onDragEnd={() => setDragging(null)} onClick={() => setEditing(p)}
                          style={{ background: p.thumb, borderRadius: 6, padding: "6px 8px", color: "#fff", opacity: dragging === p.id ? .4 : 1, cursor: "grab", boxShadow: "0 1px 3px rgba(0,0,0,.1)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                            <span className="t-nano" style={{ background: "rgba(0,0,0,.4)", padding: "1px 5px", borderRadius: 3 }}>{p.type}</span>
                            {p.platform === "ig" ? <Instagram size={9} /> : <Music2 size={9} />}
                            {p.status === "scheduled" && <CheckCircle2 size={9} style={{ marginLeft: "auto" }} />}
                          </div>
                          <div className="t-mic-b" style={{ color: "#fff", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.title}</div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "feed" && (
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="t-cap" style={{ color: "rgba(0,0,0,.56)", marginBottom: 16 }}>Vista 3×3 estilo Instagram. Así se verá el feed.</div>
          <div style={{ background: "#fff", borderRadius: 16, padding: 4 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2 }}>
              {feedPosts.length === 0 && <div style={{ gridColumn: "1/-1", padding: 60, textAlign: "center", color: "rgba(0,0,0,.4)" }}><Instagram size={28} style={{ marginBottom: 12 }} /><div className="t-cap">Sin posts aún.</div></div>}
              {feedPosts.map((p) => (
                <div key={p.id} onClick={() => setEditing(p)} style={{ aspectRatio: "1", background: p.thumb, position: "relative", cursor: "pointer", overflow: "hidden" }}>
                  {p.type === "reel" && <Play size={14} style={{ position: "absolute", top: 8, right: 8, color: "#fff", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.4))" }} />}
                  {p.type === "carousel" && <Layers size={14} style={{ position: "absolute", top: 8, right: 8, color: "#fff", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.4))" }} />}
                  <div style={{ position: "absolute", inset: 0, padding: 10, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "linear-gradient(180deg,transparent 50%,rgba(0,0,0,.5))" }}>
                    <div className="t-mic-b" style={{ color: "#fff", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="spotlight-bd fade-in" onClick={() => setEditing(null)}>
          <div className="spotlight-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div style={{ background: editing.thumb, height: 140, position: "relative" }}>
              <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
                <button onClick={() => rmPost(editing.id)} className="btn btn-ghost-light"><Trash2 size={12} /></button>
                <button onClick={() => setEditing(null)} className="btn btn-ghost-light"><X size={14} /></button>
              </div>
            </div>
            <div style={{ padding: 24 }}>
              <input value={editing.title} onChange={(e) => { const p = { ...editing, title: e.target.value }; setEditing(p); updPost(p.id, p); }} className="input" style={{ marginBottom: 16 }} placeholder="Título" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <select value={editing.type} onChange={(e) => { const p = { ...editing, type: e.target.value }; setEditing(p); updPost(p.id, p); }} className="input input-sm"><option value="post">Post</option><option value="reel">Reel</option><option value="carousel">Carrusel</option><option value="story">Story</option></select>
                <select value={editing.platform} onChange={(e) => { const p = { ...editing, platform: e.target.value }; setEditing(p); updPost(p.id, p); }} className="input input-sm"><option value="ig">Instagram</option><option value="tt">TikTok</option></select>
                <select value={editing.status} onChange={(e) => { const p = { ...editing, status: e.target.value }; setEditing(p); updPost(p.id, p); }} className="input input-sm"><option value="draft">Borrador</option><option value="scheduled">Programado</option><option value="published">Publicado</option></select>
              </div>
              <textarea value={editing.caption} onChange={(e) => { const p = { ...editing, caption: e.target.value }; setEditing(p); updPost(p.id, p); }} rows={3} className="input" style={{ marginBottom: 12, resize: "none" }} placeholder="Copy del post…" />
              <input value={editing.hashtags} onChange={(e) => { const p = { ...editing, hashtags: e.target.value }; setEditing(p); updPost(p.id, p); }} className="input" placeholder="#hashtag1 #hashtag2…" />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}><button onClick={() => setEditing(null)} className="btn btn-blue">Listo</button></div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ════════════════════════════════════════════════════════════════════
   INBOX
════════════════════════════════════════════════════════════════════ */
function InboxPage({ clients, updateClient }) {
  const all = useMemo(() => {
    const out = [];
    Object.entries(clients).forEach(([id, c]) => (c.comments || []).forEach((cm) => out.push({ ...cm, clientId: id, clientName: c.name, clientCover: c.cover, voice: c.voice })));
    return out;
  }, [clients]);
  const [filter, setFilter] = useState("pending");
  const [sel, setSel] = useState(all.find((c) => c.status === "pending") || all[0]);
  const [reply, setReply] = useState("");
  const [showTpl, setShowTpl] = useState(false);
  useEffect(() => {
    if (!sel || !all.some(c => c.id === sel.id)) {
      setSel(all.find((c) => c.status === "pending") || all[0] || null);
    }
  }, [all, sel]);
  const filtered = all.filter((c) => filter === "all" ? true : c.status === filter);
  const counts = { pending: all.filter(c => c.status === "pending").length, answered: all.filter(c => c.status === "answered").length, spam: all.filter(c => c.status === "spam").length, all: all.length };
  const updStatus = (cid, clientId, status) => { const c = clients[clientId]; if (!c) return; updateClient(clientId, { comments: (c.comments || []).map((cm) => cm.id === cid ? { ...cm, status } : cm) }); if (sel?.id === cid) setSel({ ...sel, status }); };
  const send = () => { if (!reply.trim() || !sel) return; updStatus(sel.id, sel.clientId, "answered"); setReply(""); };
  const pc = { high: "#FF3B30", medium: "#FF9500", low: "rgba(0,0,0,.3)" };
  const tpls = sel ? (clients[sel.clientId]?.replyTemplates || []) : [];
  return (
    <Shell>
      <div style={{ marginBottom: 32 }}>
        <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 12 }}>COMENTARIOS · TODOS LOS CLIENTES</div>
        <h1 className="t-display" style={{ marginBottom: 16 }}>Inbox unificado.</h1>
        <p className="t-subnav" style={{ color: "rgba(0,0,0,.72)", maxWidth: 720 }}>IG y TikTok de todos tus clientes en un solo lugar. Plantillas con la voz de cada marca.</p>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {[["pending", "Pendientes", counts.pending, "#0071e3"], ["answered", "Respondidos", counts.answered, "#34C759"], ["spam", "Spam", counts.spam, "rgba(0,0,0,.4)"], ["all", "Todos", counts.all, "rgba(0,0,0,.6)"]].map(([k, l, n, col]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: "8px 14px", borderRadius: 999, border: "1px solid", background: filter === k ? "#1d1d1f" : "#fff", borderColor: filter === k ? "#1d1d1f" : "rgba(0,0,0,.12)", color: filter === k ? "#fff" : "#1d1d1f", fontFamily: "inherit", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            {l} <span style={{ background: filter === k ? "rgba(255,255,255,.2)" : col, color: "#fff", padding: "1px 7px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{n}</span>
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,360px) 1fr", gap: 16, minHeight: 500 }}>
        {/* List */}
        <div className="card" style={{ border: "1px solid rgba(0,0,0,.06)" }}>
          <div style={{ overflowY: "auto", maxHeight: 560 }} className="sb">
            {filtered.length === 0
              ? <div style={{ padding: 40, textAlign: "center", color: "rgba(0,0,0,.4)" }} className="t-cap"><CheckCircle2 size={20} style={{ marginBottom: 8 }} /><div>Sin pendientes.</div></div>
              : filtered.map((c) => (
                <div key={c.id} onClick={() => setSel(c)} style={{ padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,.06)", cursor: "pointer", background: sel?.id === c.id ? "rgba(0,113,227,.05)" : "transparent" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, background: c.clientCover }} />
                    <span className="t-mic-b">{c.clientName}</span>
                    <span className="t-mic" style={{ color: "rgba(0,0,0,.4)" }}>·</span>
                    <span className="t-mic" style={{ color: "rgba(0,0,0,.5)" }}>{c.platform === "ig" ? "Instagram" : "TikTok"}</span>
                    <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: 999, background: pc[c.priority] }} />
                  </div>
                  <div className="t-cap-b" style={{ marginBottom: 4 }}>{c.author}</div>
                  <div className="t-cap" style={{ color: "rgba(0,0,0,.7)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{c.text}</div>
                  <div className="t-mic" style={{ color: "rgba(0,0,0,.4)", marginTop: 6 }}>{c.at} · "{c.post}"</div>
                </div>
              ))
            }
          </div>
        </div>
        {/* Detail */}
        <div className="card" style={{ border: "1px solid rgba(0,0,0,.06)", padding: 24, display: "flex", flexDirection: "column" }}>
          {!sel ? <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,.4)" }} className="t-cap">Selecciona un comentario</div> : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: sel.clientCover }} />
                <span className="t-cap-b">{sel.clientName}</span>
                {sel.status === "pending" && (
                  <>
                    <button onClick={() => updStatus(sel.id, sel.clientId, "spam")} className="btn btn-ghost btn-sm">Spam</button>
                    <button onClick={() => updStatus(sel.id, sel.clientId, "answered")} className="btn btn-ghost btn-sm"><Check size={11} />Resuelto</button>
                  </>
                )}
              </div>
              <div className="card" style={{ background: "#f5f5f7", padding: 20, marginBottom: 20 }}>
                <div className="t-cap-b" style={{ marginBottom: 8 }}>{sel.author} · {sel.at}</div>
                <p className="t-body" style={{ color: "#1d1d1f" }}>{sel.text}</p>
              </div>
              <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>TU RESPUESTA</span>
                <button onClick={() => setShowTpl(!showTpl)} className="btn btn-ghost btn-sm"><Sparkles size={11} />Plantillas de {sel.clientName}</button>
              </div>
              {showTpl && (
                <div className="fade-in" style={{ marginBottom: 12 }}>
                  <div className="t-mic" style={{ color: "rgba(0,0,0,.5)", marginBottom: 8, fontStyle: "italic" }}>Voz: {sel.voice}</div>
                  {tpls.length === 0
                    ? <div className="t-cap" style={{ padding: 12, background: "#f5f5f7", borderRadius: 8, color: "rgba(0,0,0,.5)" }}>Sin plantillas para este cliente aún.</div>
                    : tpls.map((t) => (
                      <div key={t.id} onClick={() => { setReply(t.body.replace("{nombre}", sel.author.replace("@", ""))); setShowTpl(false); }}
                        style={{ padding: 14, borderRadius: 10, background: "#f5f5f7", cursor: "pointer", marginBottom: 8 }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,113,227,.08)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "#f5f5f7"}>
                        <div className="t-cap-b" style={{ marginBottom: 4 }}>{t.title}</div>
                        <div className="t-cap" style={{ color: "rgba(0,0,0,.7)" }}>{t.body}</div>
                      </div>
                    ))
                  }
                </div>
              )}
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escribe tu respuesta…" rows={4} className="input" style={{ resize: "none", marginBottom: 12, flex: 1 }} />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={send} disabled={!reply.trim()} className="btn btn-blue"><Reply size={12} />Responder y resolver</button>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@media(max-width:900px){.inbox-grid{grid-template-columns:1fr!important;}}`}</style>
    </Shell>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CRM
════════════════════════════════════════════════════════════════════ */
function CRMPage({ deals, upsertDeal, removeDeal, moveDeal, nav }) {
  const stages = [
    { id: "lead", label: "Lead", color: "#88b0e0" },
    { id: "contacted", label: "Contactado", color: "#a78bfa" },
    { id: "brief", label: "Brief enviado", color: "#FF9500" },
    { id: "proposal", label: "Propuesta", color: "#0071e3" },
    { id: "won", label: "Ganado", color: "#34C759" },
  ];
  const [drag, setDrag] = useState(null);
  const [edit, setEdit] = useState(null);
  const move = (id, stage) => moveDeal(id, stage);
  const upd = (id, p) => upsertDeal({ ...deals.find(d => d.id === id) || {}, ...p });
  const rm = (id) => { removeDeal(id); setEdit(null); };
  const add = (stageId) => { const nd = { id: `dl${Date.now()}`, company: "Nuevo lead", contact: "", email: "", value: 0, stage: stageId, source: "", note: "", nextAction: "" }; setDeals([...deals, nd]); setEdit(nd); };
  const pipe = deals.filter((d) => !["won", "lost"].includes(d.stage)).reduce((a, d) => a + d.value, 0);
  const won = deals.filter((d) => d.stage === "won").reduce((a, d) => a + d.value, 0);
  return (
    <Shell>
      <div style={{ marginBottom: 32 }}>
        <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 12 }}>PIPELINE COMERCIAL</div>
        <h1 className="t-display" style={{ marginBottom: 16 }}>CRM · Leads.</h1>
        <p className="t-subnav" style={{ color: "rgba(0,0,0,.72)", maxWidth: 720 }}>Arrastra leads entre etapas. Genera propuestas en un click.</p>
      </div>
      <div className="grid-3" style={{ marginBottom: 32 }}>
        <div className="card" style={{ background: "#f5f5f7", padding: 24 }}>
          <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 8 }}>PIPELINE ABIERTO</div>
          <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.4px" }}>€{(pipe / 1000).toFixed(1)}K</div>
          <div className="t-cap" style={{ color: "rgba(0,0,0,.56)", marginTop: 4 }}>{deals.filter(d => !["won", "lost"].includes(d.stage)).length} activos</div>
        </div>
        <div className="card" style={{ background: "#f5f5f7", padding: 24 }}>
          <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 8 }}>GANADO ESTE MES</div>
          <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.4px", color: "#34C759" }}>€{(won / 1000).toFixed(1)}K</div>
          <div className="t-cap" style={{ color: "rgba(0,0,0,.56)", marginTop: 4 }}>{deals.filter(d => d.stage === "won").length} cerrados</div>
        </div>
        <div className="card halo-bg" style={{ padding: 24, color: "#fff" }}>
          <div className="t-nano spaced-md" style={{ color: "#88b0e0", marginBottom: 8 }}>PROPUESTAS</div>
          <div className="t-body" style={{ color: "#fff", marginBottom: 12 }}>Crea propuestas con bloques visuales pre-armados.</div>
          <button onClick={() => nav("proposal-builder")} className="btn btn-blue"><Presentation size={12} />Abrir builder</button>
        </div>
      </div>
      {/* Kanban */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stages.length},minmax(220px,1fr))`, gap: 12, overflowX: "auto", paddingBottom: 8 }} className="sb">
        {stages.map((s) => {
          const sd = deals.filter((d) => d.stage === s.id);
          const st = sd.reduce((a, d) => a + d.value, 0);
          return (
            <div key={s.id}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }}
              onDragLeave={(e) => e.currentTarget.classList.remove("drag-over")}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("drag-over"); if (drag) { move(drag, s.id); setDrag(null); } }}
              style={{ background: "#f5f5f7", borderRadius: 14, padding: 12, minHeight: 400 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 999, background: s.color }} />
                  <span className="t-cap-b">{s.label}</span>
                  <span className="t-mic" style={{ color: "rgba(0,0,0,.4)" }}>{sd.length}</span>
                </div>
                <div className="t-mic-b" style={{ color: "rgba(0,0,0,.5)" }}>€{st}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sd.map((d) => (
                  <div key={d.id} draggable onDragStart={() => setDrag(d.id)} onDragEnd={() => setDrag(null)} onClick={() => setEdit(d)}
                    className="card" style={{ background: "#fff", padding: 14, opacity: drag === d.id ? .4 : 1, cursor: "grab", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
                    <div className="t-cap-b" style={{ marginBottom: 4 }}>{d.company}</div>
                    <div className="t-mic" style={{ color: "rgba(0,0,0,.6)", marginBottom: 8 }}>{d.contact}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="t-cap-b" style={{ color: "#0071e3" }}>€{d.value}</span>
                      {d.nextAction && <span className="t-mic" style={{ color: "rgba(0,0,0,.5)" }}>📅</span>}
                    </div>
                  </div>
                ))}
                <button onClick={() => add(s.id)} className="t-cap" style={{ padding: "10px", borderRadius: 8, background: "transparent", border: "1px dashed rgba(0,0,0,.15)", color: "rgba(0,0,0,.4)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <Plus size={12} />Añadir
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {edit && (
        <div className="spotlight-bd fade-in" onClick={() => setEdit(null)}>
          <div className="spotlight-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div style={{ padding: 24 }}>
              <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 8 }}>LEAD</div>
              <input value={edit.company} onChange={(e) => upd(edit.id, { company: e.target.value })} className="input" style={{ marginBottom: 12, fontSize: 22, fontWeight: 600 }} placeholder="Empresa" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <input value={edit.contact} onChange={(e) => upd(edit.id, { contact: e.target.value })} className="input input-sm" placeholder="Contacto" />
                <input value={edit.email} onChange={(e) => upd(edit.id, { email: e.target.value })} className="input input-sm" placeholder="Email" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <input value={edit.value} onChange={(e) => upd(edit.id, { value: parseInt(e.target.value) || 0 })} type="number" className="input input-sm" placeholder="Valor (€)" />
                <input value={edit.source} onChange={(e) => upd(edit.id, { source: e.target.value })} className="input input-sm" placeholder="Origen" />
              </div>
              <textarea value={edit.note} onChange={(e) => upd(edit.id, { note: e.target.value })} className="input" rows={3} style={{ resize: "none", marginBottom: 12 }} placeholder="Notas…" />
              <input value={edit.nextAction} onChange={(e) => upd(edit.id, { nextAction: e.target.value })} className="input input-sm" placeholder="Siguiente acción" style={{ marginBottom: 16 }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                <button onClick={() => rm(edit.id)} className="btn btn-ghost" style={{ color: "#FF3B30" }}><Trash2 size={12} />Eliminar</button>
                <button onClick={() => setEdit(null)} className="btn btn-blue">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ════════════════════════════════════════════════════════════════════
   PROPOSAL BUILDER
════════════════════════════════════════════════════════════════════ */
const BLOCK_LIB = [
  { id: "problem", icon: "⚠", name: "El problema", desc: "Identifica el dolor antes que la solución", tpl: { type: "problem", title: "Tu problema hoy", body: "Tu marca tiene contenido, pero no tiene voz. Publicas, pero no construyes audiencia." } },
  { id: "value", icon: "✦", name: "Nuestro valor", desc: "Por qué invertir aquí", tpl: { type: "value", title: "Lo que cambia", body: "Una identidad de marca que se reconoce desde el primer segundo. Contenido que conecta, no solo informa." } },
  { id: "process", icon: "⚙", name: "Proceso", desc: "Cómo trabajamos paso a paso", tpl: { type: "process", title: "Nuestro proceso", steps: [{ n: "01", t: "Inmersión", d: "Brief profundo + auditoría de marca." }, { n: "02", t: "Estrategia", d: "Pilares, voz y plan editorial." }, { n: "03", t: "Producción", d: "Rodajes mensuales, edición integral." }, { n: "04", t: "Distribución", d: "Publicación, comunidad y reportes." }] } },
  { id: "deliverables", icon: "✓", name: "Qué incluye", desc: "Listado de entregables concretos", tpl: { type: "deliverables", title: "Qué incluye tu plan", items: ["8 reels mensuales", "16 posts y carruseles", "Stories diarias", "Reporte mensual de KPIs", "Gestión de comunidad"] } },
  { id: "results", icon: "📈", name: "Resultados", desc: "Qué esperar a 3-6 meses", tpl: { type: "results", title: "Qué esperar", body: "En 90 días: alcance ×3, engagement ×2, primeros leads. En 6 meses: comunidad propia, posicionamiento sólido." } },
  { id: "pricing", icon: "€", name: "Inversión", desc: "Precio y condiciones", tpl: { type: "pricing", title: "Inversión", price: "€1.800/mes", commitment: "Mínimo 3 meses", note: "Pago el día 1. Sin permanencia después." } },
  { id: "case", icon: "★", name: "Caso de éxito", desc: "Cliente similar con resultados reales", tpl: { type: "case", client: "Dani.KTB", before: "18K", after: "142K", time: "5 meses", quote: "Cristian no produce contenido. Construye una marca que se sostiene sola." } },
  { id: "cta", icon: "→", name: "Siguiente paso", desc: "Cierre claro", tpl: { type: "cta", title: "Si todo encaja", body: "Bloqueamos espacio esta semana, firmamos contrato y empezamos el lunes. Hay 1 cupo disponible en mayo." } },
];

function ProposalBuilder({ onBack }) {
  const [blocks, setBlocks] = useState([]);
  const [title, setTitle] = useState("Propuesta para [Cliente]");
  const [pMode, setPMode] = useState(false);
  const add = (lib) => setBlocks([...blocks, { id: `b${Date.now()}`, ...lib.tpl }]);
  const remove = (id) => setBlocks(blocks.filter((b) => b.id !== id));
  const move = (id, dir) => { const i = blocks.findIndex(b => b.id === id); const n = i + dir; if (n < 0 || n >= blocks.length) return; const a = [...blocks];[a[i], a[n]] = [a[n], a[i]]; setBlocks(a); };
  const upd = (id, p) => setBlocks(blocks.map((b) => b.id === id ? { ...b, ...p } : b));
  if (pMode) return <ProposalPresentation blocks={blocks} title={title} onClose={() => setPMode(false)} />;
  return (
    <div className="gonzo" style={{ minHeight: "100vh", background: "#fff" }}>
      <GS />
      <div className="glass-light" style={{ position: "sticky", top: 0, zIndex: 30, height: 56, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} className="btn btn-ghost"><ChevronLeft size={14} />CRM</button>
          <div className="serif" style={{ fontSize: 22 }}>Propuesta builder</div>
        </div>
        <button onClick={() => setPMode(true)} disabled={blocks.length === 0} className="btn btn-blue"><Presentation size={12} />Presentar</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", minHeight: "calc(100vh - 56px)" }}>
        {/* Library */}
        <div style={{ background: "#fbfbfd", borderRight: "1px solid rgba(0,0,0,.06)", padding: 20, overflowY: "auto" }} className="sb">
          <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 12 }}>BLOQUES</div>
          <p className="t-cap" style={{ color: "rgba(0,0,0,.56)", marginBottom: 16 }}>Click para añadir. Combina y edita en el canvas.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {BLOCK_LIB.map((b) => (
              <button key={b.id} onClick={() => add(b)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 10, background: "#fff", border: "1px solid rgba(0,0,0,.06)", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,113,227,.05)"; e.currentTarget.style.borderColor = "rgba(0,113,227,.2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "rgba(0,0,0,.06)"; }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f5f5f7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{b.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-cap-b" style={{ marginBottom: 2 }}>{b.name}</div>
                  <div className="t-mic" style={{ color: "rgba(0,0,0,.5)", lineHeight: 1.4 }}>{b.desc}</div>
                </div>
                <Plus size={14} style={{ color: "rgba(0,0,0,.3)", marginTop: 8 }} />
              </button>
            ))}
          </div>
        </div>
        {/* Canvas */}
        <div style={{ padding: "40px 60px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
          <ET as="h1" className="t-display" value={title} onChange={setTitle} />
          <div className="t-cap" style={{ color: "rgba(0,0,0,.4)", marginTop: 8, marginBottom: 32 }}>{blocks.length} bloques · Edita cualquier texto directamente</div>
          {blocks.length === 0 && (
            <div style={{ padding: 60, borderRadius: 16, background: "#f5f5f7", textAlign: "center", color: "rgba(0,0,0,.4)" }}>
              <Layers size={28} style={{ marginBottom: 12 }} />
              <div className="t-cap-b" style={{ marginBottom: 4, color: "rgba(0,0,0,.6)" }}>Añade bloques desde la izquierda</div>
              <div className="t-cap">Estructura recomendada: problema → valor → proceso → entregables → precio → cierre</div>
            </div>
          )}
          {blocks.map((b, i) => (
            <PBlock key={b.id} block={b} onUpd={(p) => upd(b.id, p)} onRemove={() => remove(b.id)} onUp={() => move(b.id, -1)} onDown={() => move(b.id, 1)} canUp={i > 0} canDown={i < blocks.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PBlock({ block, onUpd, onRemove, onUp, onDown, canUp, canDown }) {
  return (
    <div style={{ marginBottom: 24, position: "relative", paddingLeft: 48 }}>
      <div style={{ position: "absolute", left: 0, top: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <button onClick={onUp} disabled={!canUp} className="btn btn-ghost" style={{ padding: 4 }}><ChevronDown size={12} style={{ transform: "rotate(180deg)" }} /></button>
        <button onClick={onDown} disabled={!canDown} className="btn btn-ghost" style={{ padding: 4 }}><ChevronDown size={12} /></button>
        <button onClick={onRemove} className="btn btn-ghost" style={{ padding: 4, color: "#FF3B30" }}><Trash2 size={12} /></button>
      </div>

      {block.type === "problem" && (
        <div className="card" style={{ background: "#fff5f0", padding: 32, border: "1px solid #ffe0d0" }}>
          <div className="t-nano spaced-md" style={{ color: "#FF6B35", marginBottom: 8 }}>EL PROBLEMA</div>
          <ET as="h2" className="t-section" style={{ marginBottom: 16 }} value={block.title} onChange={(v) => onUpd({ title: v })} />
          <ET as="p" multiline className="t-card" style={{ lineHeight: 1.4, color: "rgba(0,0,0,.8)" }} value={block.body} onChange={(v) => onUpd({ body: v })} />
        </div>
      )}
      {block.type === "value" && (
        <div className="card halo-bg" style={{ padding: 32, color: "#fff" }}>
          <div className="t-nano spaced-md" style={{ color: "#88b0e0", marginBottom: 8 }}>NUESTRO VALOR</div>
          <ET as="h2" className="t-section" style={{ color: "#fff", marginBottom: 16 }} value={block.title} onChange={(v) => onUpd({ title: v })} />
          <ET as="p" multiline className="t-card" style={{ lineHeight: 1.4, color: "rgba(255,255,255,.88)" }} value={block.body} onChange={(v) => onUpd({ body: v })} />
        </div>
      )}
      {block.type === "process" && (
        <div className="card" style={{ background: "#f5f5f7", padding: 32 }}>
          <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 8 }}>PROCESO</div>
          <ET as="h2" className="t-section" style={{ marginBottom: 24 }} value={block.title} onChange={(v) => onUpd({ title: v })} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {block.steps.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 20 }}>
                <div className="serif" style={{ fontSize: 36, color: "#0071e3", flexShrink: 0, lineHeight: 1 }}>{s.n}</div>
                <div style={{ flex: 1 }}>
                  <ET className="t-card-b" style={{ marginBottom: 4 }} value={s.t} onChange={(v) => onUpd({ steps: block.steps.map((x, j) => j === i ? { ...x, t: v } : x) })} />
                  <ET className="t-body" style={{ color: "rgba(0,0,0,.7)" }} value={s.d} onChange={(v) => onUpd({ steps: block.steps.map((x, j) => j === i ? { ...x, d: v } : x) })} multiline />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {block.type === "deliverables" && (
        <div className="card" style={{ background: "#fff", padding: 32, border: "1px solid rgba(0,0,0,.08)" }}>
          <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 8 }}>QUÉ INCLUYE</div>
          <ET as="h2" className="t-section" style={{ marginBottom: 24 }} value={block.title} onChange={(v) => onUpd({ title: v })} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {block.items.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <CheckCircle2 size={20} style={{ color: "#34C759", flexShrink: 0, marginTop: 2 }} />
                <ET className="t-body" style={{ flex: 1 }} value={item} onChange={(v) => onUpd({ items: block.items.map((x, j) => j === i ? v : x) })} />
              </div>
            ))}
          </div>
        </div>
      )}
      {block.type === "results" && (
        <div className="card" style={{ background: "linear-gradient(135deg,#34C759,#1d8c3f)", padding: 32, color: "#fff" }}>
          <div className="t-nano spaced-md" style={{ color: "rgba(255,255,255,.7)", marginBottom: 8 }}>RESULTADOS</div>
          <ET as="h2" className="t-section" style={{ color: "#fff", marginBottom: 16 }} value={block.title} onChange={(v) => onUpd({ title: v })} />
          <ET as="p" multiline className="t-card" style={{ color: "#fff", lineHeight: 1.4 }} value={block.body} onChange={(v) => onUpd({ body: v })} />
        </div>
      )}
      {block.type === "pricing" && (
        <div className="card" style={{ background: "#1d1d1f", padding: 40, color: "#fff", textAlign: "center" }}>
          <div className="t-nano spaced-md" style={{ color: "#88b0e0", marginBottom: 16 }}>INVERSIÓN</div>
          <ET as="h2" className="t-section" style={{ color: "#fff", marginBottom: 8 }} value={block.title} onChange={(v) => onUpd({ title: v })} />
          <ET style={{ fontSize: 60, fontWeight: 600, letterSpacing: "-1px", color: "#88b0e0", marginBottom: 16 }} value={block.price} onChange={(v) => onUpd({ price: v })} />
          <ET className="t-body-em" style={{ color: "#fff", marginBottom: 8 }} value={block.commitment} onChange={(v) => onUpd({ commitment: v })} />
          <ET className="t-cap" style={{ color: "rgba(255,255,255,.6)" }} value={block.note} onChange={(v) => onUpd({ note: v })} />
        </div>
      )}
      {block.type === "case" && (
        <div className="card" style={{ background: "#fff", padding: 32, border: "1px solid rgba(0,0,0,.08)" }}>
          <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 8 }}>CASO DE ÉXITO</div>
          <ET className="t-card-b" style={{ marginBottom: 20 }} value={block.client} onChange={(v) => onUpd({ client: v })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 24, alignItems: "center", marginBottom: 24 }}>
            <div style={{ textAlign: "center", padding: 20, background: "#f5f5f7", borderRadius: 12 }}>
              <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 8 }}>ANTES</div>
              <ET style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.4px" }} value={block.before} onChange={(v) => onUpd({ before: v })} />
            </div>
            <ArrowRight size={20} style={{ color: "rgba(0,0,0,.4)" }} />
            <div style={{ textAlign: "center", padding: 20, background: "#0a1729", color: "#fff", borderRadius: 12 }}>
              <div className="t-nano spaced-md" style={{ color: "#88b0e0", marginBottom: 8 }}><ET as="span" style={{ display: "inline-block", color: "#88b0e0" }} value={block.time} onChange={(v) => onUpd({ time: v })} /></div>
              <ET style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.4px", color: "#fff" }} value={block.after} onChange={(v) => onUpd({ after: v })} />
            </div>
          </div>
          <ET as="p" multiline className="serif" style={{ fontSize: 22, fontStyle: "italic", color: "rgba(0,0,0,.7)", lineHeight: 1.4 }} value={block.quote} onChange={(v) => onUpd({ quote: v })} />
        </div>
      )}
      {block.type === "cta" && (
        <div className="card" style={{ background: "#0071e3", padding: 40, color: "#fff" }}>
          <div className="t-nano spaced-md" style={{ color: "rgba(255,255,255,.7)", marginBottom: 8 }}>SIGUIENTE PASO</div>
          <ET as="h2" className="t-section" style={{ color: "#fff", marginBottom: 16 }} value={block.title} onChange={(v) => onUpd({ title: v })} />
          <ET as="p" multiline className="t-card" style={{ color: "rgba(255,255,255,.95)", lineHeight: 1.4 }} value={block.body} onChange={(v) => onUpd({ body: v })} />
        </div>
      )}
    </div>
  );
}

function ProposalPresentation({ blocks, title, onClose }) {
  const [step, setStep] = useState(0);
  const total = blocks.length;
  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); setStep(s => Math.min(s + 1, total)); }
      if (e.key === "ArrowLeft") setStep(s => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", fn); return () => window.removeEventListener("keydown", fn);
  }, [total]);
  const block = step > 0 ? blocks[step - 1] : null;
  const pStyle = (extra = {}) => ({ maxWidth: 900, width: "100%", ...extra });
  return (
    <div className="gonzo" style={{ position: "fixed", inset: 0, background: "#000", color: "#fff", zIndex: 1000, display: "flex", flexDirection: "column" }}>
      <GS />
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8, zIndex: 10 }}>
        <span className="t-mic" style={{ color: "rgba(255,255,255,.4)", padding: "8px 12px" }}>{step}/{total} · ←→</span>
        <button onClick={onClose} className="btn btn-ghost-light"><X size={14} /></button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 40px" }}>
        <div className="fade-up" key={step} style={pStyle()}>
          {step === 0 && (
            <div style={{ textAlign: "center" }}>
              <div className="t-nano spaced-lg" style={{ color: "#88b0e0", marginBottom: 24 }}>PROPUESTA gonzo</div>
              <h1 className="serif" style={{ fontSize: 88, lineHeight: 1, fontWeight: 400, color: "#fff", marginBottom: 32 }}>{title}</h1>
              <button onClick={() => setStep(1)} className="pill pill-fill" style={{ background: "#fff", color: "#000", borderColor: "#fff", fontSize: 20 }}>Empezar<ArrowRight size={20} /></button>
            </div>
          )}
          {block && <PresBlock block={block} />}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4 }}>
        {Array.from({ length: total + 1 }).map((_, i) => (
          <div key={i} style={{ width: i === step ? 24 : 6, height: 6, borderRadius: 999, background: i === step ? "#88b0e0" : "rgba(255,255,255,.2)", transition: "all 200ms" }} />
        ))}
      </div>
    </div>
  );
}

function PresBlock({ block }) {
  const halo = { color: "rgba(255,255,255,.4)", marginBottom: 24 };
  if (block.type === "problem") return (<div><div className="t-nano spaced-lg" style={{ color: "#FF6B35", ...halo }}>EL PROBLEMA</div><h2 className="serif" style={{ fontSize: 80, lineHeight: 1.05, fontWeight: 400, color: "#fff", marginBottom: 32 }}>{block.title}</h2><p className="t-subnav" style={{ color: "rgba(255,255,255,.8)", maxWidth: 720, lineHeight: 1.4 }}>{block.body}</p></div>);
  if (block.type === "value") return (<div><div className="t-nano spaced-lg" style={{ color: "#88b0e0", ...halo }}>NUESTRO VALOR</div><h2 className="serif" style={{ fontSize: 80, lineHeight: 1.05, fontWeight: 400, color: "#fff", marginBottom: 32 }}>{block.title}</h2><p className="t-subnav" style={{ color: "rgba(255,255,255,.8)", maxWidth: 720, lineHeight: 1.4 }}>{block.body}</p></div>);
  if (block.type === "process") return (<div><div className="t-nano spaced-lg" style={{ color: "#88b0e0", ...halo }}>PROCESO</div><h2 className="serif" style={{ fontSize: 64, fontWeight: 400, color: "#fff", marginBottom: 40 }}>{block.title}</h2><div style={{ display: "grid", gridTemplateColumns: `repeat(${block.steps.length},1fr)`, gap: 24 }}>{block.steps.map((s, i) => <div key={i}><div className="serif" style={{ fontSize: 56, color: "#88b0e0", marginBottom: 16 }}>{s.n}</div><div className="t-card-b" style={{ color: "#fff", marginBottom: 8 }}>{s.t}</div><div className="t-cap" style={{ color: "rgba(255,255,255,.6)" }}>{s.d}</div></div>)}</div></div>);
  if (block.type === "deliverables") return (<div><div className="t-nano spaced-lg" style={{ color: "#88b0e0", ...halo }}>QUÉ INCLUYE</div><h2 className="serif" style={{ fontSize: 64, fontWeight: 400, color: "#fff", marginBottom: 32 }}>{block.title}</h2><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>{block.items.map((item, i) => <div key={i} style={{ display: "flex", gap: 12 }}><CheckCircle2 size={24} style={{ color: "#34C759", flexShrink: 0, marginTop: 2 }} /><div className="t-body" style={{ color: "rgba(255,255,255,.9)" }}>{item}</div></div>)}</div></div>);
  if (block.type === "results") return (<div style={{ textAlign: "center" }}><div className="t-nano spaced-lg" style={{ color: "#34C759", ...halo }}>RESULTADOS</div><h2 className="serif" style={{ fontSize: 80, fontWeight: 400, color: "#fff", marginBottom: 32 }}>{block.title}</h2><p className="t-subnav" style={{ color: "rgba(255,255,255,.8)", maxWidth: 720, margin: "0 auto", lineHeight: 1.4 }}>{block.body}</p></div>);
  if (block.type === "pricing") return (<div style={{ textAlign: "center" }}><div className="t-nano spaced-lg" style={{ color: "#88b0e0", ...halo }}>INVERSIÓN</div><h2 className="serif" style={{ fontSize: 56, fontWeight: 400, color: "#fff", marginBottom: 24 }}>{block.title}</h2><div style={{ fontSize: 140, fontWeight: 600, letterSpacing: "-3px", color: "#88b0e0", lineHeight: 1, marginBottom: 24 }}>{block.price}</div><div className="t-card-b" style={{ color: "#fff", marginBottom: 8 }}>{block.commitment}</div><div className="t-cap" style={{ color: "rgba(255,255,255,.6)" }}>{block.note}</div></div>);
  if (block.type === "case") return (<div><div className="t-nano spaced-lg" style={{ color: "#88b0e0", ...halo }}>CASO DE ÉXITO</div><div className="t-tile" style={{ color: "#fff", marginBottom: 32 }}>{block.client}</div><div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 32, alignItems: "center", marginBottom: 40 }}><div style={{ textAlign: "center" }}><div className="t-nano spaced-md" style={{ color: "rgba(255,255,255,.5)", marginBottom: 12 }}>ANTES</div><div style={{ fontSize: 56, fontWeight: 600, letterSpacing: "-0.6px", color: "#fff" }}>{block.before}</div></div><ArrowRight size={32} style={{ color: "#88b0e0" }} /><div style={{ textAlign: "center" }}><div className="t-nano spaced-md" style={{ color: "#88b0e0", marginBottom: 12 }}>{block.time}</div><div style={{ fontSize: 56, fontWeight: 600, letterSpacing: "-0.6px", color: "#88b0e0" }}>{block.after}</div></div></div><p className="serif" style={{ fontSize: 32, fontStyle: "italic", color: "rgba(255,255,255,.8)", lineHeight: 1.3, maxWidth: 720, margin: "0 auto", textAlign: "center" }}>"{block.quote}"</p></div>);
  if (block.type === "cta") return (<div style={{ textAlign: "center" }}><div className="t-nano spaced-lg" style={{ color: "#88b0e0", ...halo }}>SIGUIENTE PASO</div><h2 className="serif" style={{ fontSize: 88, lineHeight: 1, fontWeight: 400, color: "#fff", marginBottom: 32 }}>{block.title}</h2><p className="t-subnav" style={{ color: "rgba(255,255,255,.8)", maxWidth: 720, margin: "0 auto 40px", lineHeight: 1.4 }}>{block.body}</p><button className="pill pill-fill" style={{ background: "#88b0e0", color: "#000", borderColor: "#88b0e0", fontSize: 22, padding: "16px 32px" }}>Cerrar trato<ArrowRight size={20} /></button></div>);
  return null;
}

/* ════════════════════════════════════════════════════════════════════
   TIME TRACKING
════════════════════════════════════════════════════════════════════ */
function TimePage({ clients, timeEntries, addTimeEntry, removeTimeEntry }) {
  const [tracking, setTracking] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { if (!tracking) return; const iv = setInterval(() => setElapsed(Date.now() - tracking.startTime), 1000); return () => clearInterval(iv); }, [tracking]);
  const start = (cid, task) => setTracking({ cid, task, startTime: Date.now() });
  const stop = () => { if (!tracking) return; const m = Math.max(1, Math.round(elapsed / 60000)); addTimeEntry({ id: `t${Date.now()}`, client: tracking.cid, task: tracking.task, minutes: m, date: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).toUpperCase() }); setTracking(null); setElapsed(0); };
  const rm = (id) => removeTimeEntry(id);
  const fmt = (ms) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
  const profitability = useMemo(() => {
    return Object.keys(clients).filter(k => k !== "frame").map((id) => {
      const c = clients[id]; const entries = timeEntries.filter((t) => t.client === id);
      const h = entries.reduce((a, t) => a + t.minutes, 0) / 60;
      const mrr = parseInt((c.mrr || "€0").replace(/[€.]/g, ""));
      const real = entries.length > 0 ? mrr / entries.length : 0;
      const tgt = c.rate || 0;
      return { id, ...c, hours: h, mrr, real, tgt, ok: real >= tgt, n: entries.length };
    });
  }, [clients, timeEntries]);
  return (
    <Shell>
      <div style={{ marginBottom: 32 }}>
        <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 12 }}>ACCIONES REALES VS COBRADAS</div>
        <h1 className="t-display" style={{ marginBottom: 16 }}>Time tracking.</h1>
        <p className="t-subnav" style={{ color: "rgba(0,0,0,.72)", maxWidth: 720 }}>¿Cuánto te paga realmente cada cliente por acción registrada?</p>
      </div>
      {tracking ? (
        <div className="card halo-bg" style={{ padding: 32, color: "#fff", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: "#FF3B30" }} className="pulse" />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="t-nano spaced-md" style={{ color: "#88b0e0", marginBottom: 4 }}>EN MARCHA</div>
              <div className="t-card-b" style={{ color: "#fff" }}>{clients[tracking.cid]?.name} · {tracking.task}</div>
            </div>
            <div style={{ fontSize: 56, fontWeight: 600, letterSpacing: "-1px", fontFamily: "monospace", color: "#88b0e0" }}>{fmt(elapsed)}</div>
            <button onClick={stop} className="pill pill-fill"><Square size={14} />Parar</button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ background: "#f5f5f7", padding: 24, marginBottom: 32 }}>
          <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 12 }}>EMPEZAR A TRABAJAR EN…</div>
          <QuickStart clients={clients} onStart={start} />
        </div>
      )}
      {/* Profitability */}
      <h2 className="t-tile" style={{ fontWeight: 600, marginBottom: 20 }}>Rentabilidad por cliente</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 40 }}>
        {profitability.map((p) => {
          const ratio = p.tgt > 0 ? Math.min(p.real / p.tgt, 1.5) : 0;
          return (
            <div key={p.id} className="card" style={{ background: "#fff", border: "1px solid rgba(0,0,0,.08)", padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: p.cover, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{p.emoji}</div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div className="t-body-em">{p.name}</div>
                  <div className="t-mic" style={{ color: "rgba(0,0,0,.5)" }}>{p.n} sesiones · {p.hours.toFixed(1)}h · cobras €{p.mrr}/mes</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 2 }}>€/ACC REAL</div>
                  <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.4px", color: p.ok ? "#34C759" : "#FF3B30" }}>€{p.real.toFixed(1)}</div>
                  <div className="t-mic" style={{ color: "rgba(0,0,0,.5)" }}>precio acción: €{p.tgt}</div>
                </div>
              </div>
              <div style={{ height: 6, background: "#f5f5f7", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(ratio / 1.5) * 100}%`, background: p.ok ? "linear-gradient(90deg,#34C759,#1d8c3f)" : "linear-gradient(90deg,#FF9500,#FF3B30)", transition: "width 600ms" }} />
              </div>
              {!p.ok && p.n > 0 && <div className="t-cap" style={{ marginTop: 10, color: "#FF3B30", display: "flex", alignItems: "center", gap: 6 }}><AlertCircle size={12} />Estás €{(p.tgt - p.real).toFixed(0)}/acc por debajo del objetivo. Subir precio o ajustar alcance.</div>}
            </div>
          );
        })}
      </div>
      {/* Entries */}
      <h2 className="t-tile" style={{ fontWeight: 600, marginBottom: 20 }}>Sesiones recientes</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {timeEntries.slice(0, 15).map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", background: "#f5f5f7", borderRadius: 12, flexWrap: "wrap" }}>
            <div style={{ width: 10, height: 10, borderRadius: 4, background: clients[t.client]?.cover || "#888" }} />
            <div className="t-cap-b" style={{ minWidth: 100 }}>{clients[t.client]?.name}</div>
            <div className="t-body" style={{ flex: 1, minWidth: 200 }}>{t.task}</div>
            <div className="t-cap" style={{ color: "rgba(0,0,0,.5)", fontFamily: "monospace" }}>{Math.floor(t.minutes / 60)}h {t.minutes % 60}m</div>
            <div className="t-mic" style={{ color: "rgba(0,0,0,.4)", minWidth: 60, textAlign: "right" }}>{t.date}</div>
            <button onClick={() => rm(t.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(0,0,0,.3)", padding: 4 }}><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function QuickStart({ clients, onStart }) {
  const cids = Object.keys(clients).filter(k => k !== "frame");
  const [cid, setCid] = useState(() => cids[0] || "");
  const [task, setTask] = useState("");
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <select value={cid} onChange={(e) => setCid(e.target.value)} className="input" style={{ width: 200, padding: "12px 14px" }}>
        {cids.map((id) => <option key={id} value={id}>{clients[id]?.emoji} {clients[id]?.name}</option>)}
      </select>
      <input value={task} onChange={(e) => setTask(e.target.value)} placeholder="¿En qué estás trabajando?" className="input" style={{ flex: 1, minWidth: 240 }} onKeyDown={(e) => { if (e.key === "Enter" && task.trim()) onStart(cid, task); }} />
      <button onClick={() => task.trim() && onStart(cid, task)} disabled={!task.trim()} className="btn btn-blue"><Play size={12} />Empezar</button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   GOALS & REPORTES
════════════════════════════════════════════════════════════════════ */
function GoalsPage({ clients, timeEntries }) {
  const ids = Object.keys(clients).filter(k => k !== "frame");
  const [active, setActive] = useState(() => ids[0] || "");
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const c = clients[active];

  useEffect(() => {
    if ((!active || !clients[active]) && ids[0]) setActive(ids[0]);
  }, [active, ids.join("|"), clients]);

  if (ids.length === 0 || !c) {
    return (
      <Shell>
        <div style={{ marginBottom: 32 }}>
          <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 12 }}>OBJETIVOS Y PROGRESO</div>
          <h1 className="t-display" style={{ marginBottom: 16 }}>Goals & Reportes.</h1>
        </div>
        <div className="card" style={{ padding: 40, textAlign: "center", background: "#f5f5f7" }}>
          <Award size={28} style={{ marginBottom: 12, color: "rgba(0,0,0,.36)" }} />
          <div className="t-body-em" style={{ marginBottom: 6 }}>No hay clientes con objetivos.</div>
          <div className="t-cap" style={{ color: "rgba(0,0,0,.56)" }}>Crea o sincroniza clientes para generar reportes.</div>
        </div>
      </Shell>
    );
  }

  const generate = async () => {
    setBusy(true); setErr(null); setReport(null);
    const hours = timeEntries.filter(t => t.client === active).reduce((a, t) => a + t.minutes, 0) / 60;
    const goalsText = (c.goals || []).map(g => `${g.label}: ${g.current}/${g.target}${g.unit}`).join("; ");
    const growth = c.growth?.slice(-3).map(g => `${g.m}: ${g.v}`).join(", ");
    const prompt = `Eres un consultor de marketing senior. Genera un reporte mensual ejecutivo en español para el cliente ${c.name} (${c.sector}) de la agencia gonzo.\n\nVoz de marca: ${c.voice}\nObjetivos: ${goalsText}\nCrecimiento últimos meses: ${growth}\nHoras dedicadas: ${hours.toFixed(1)}h\nPosts programados: ${(c.posts || []).length}\n\nDevuelve SOLO JSON válido (sin backticks):\n{"executive_summary":"2-3 frases","wins":["3-4 logros"],"concerns":["1-3 a vigilar"],"next_focus":"1-2 frases","recommended_actions":["3-4 acciones"]}`;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }) });
      if (!r.ok) throw new Error("API");
      const data = await r.json();
      const text = data.content.filter(x => x.type === "text").map(x => x.text).join("\n").replace(/```json|```/g, "").trim();
      setReport(JSON.parse(text));
    } catch { setErr("No se pudo generar el reporte. Verifica tu conexión."); } finally { setBusy(false); }
  };

  return (
    <Shell>
      <div style={{ marginBottom: 32 }}>
        <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 12 }}>OBJETIVOS Y PROGRESO</div>
        <h1 className="t-display" style={{ marginBottom: 16 }}>Goals & Reportes.</h1>
        <p className="t-subnav" style={{ color: "rgba(0,0,0,.72)", maxWidth: 720 }}>KPIs por cliente. Reportes mensuales generados con IA listos para enviar.</p>
      </div>
      {/* Client tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {ids.map((id) => (
          <button key={id} onClick={() => { setActive(id); setReport(null); }}
            style={{ padding: "10px 18px", borderRadius: 999, border: "1px solid", background: active === id ? "#1d1d1f" : "#fff", borderColor: active === id ? "#1d1d1f" : "rgba(0,0,0,.12)", color: active === id ? "#fff" : "#1d1d1f", fontFamily: "inherit", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span>{clients[id].emoji}</span>{clients[id].name}
          </button>
        ))}
      </div>
      {/* KPIs */}
      <div className="card" style={{ background: "#f5f5f7", padding: 32, marginBottom: 24 }}>
        <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 8 }}>OBJETIVO GENERAL</div>
        <div className="t-card serif" style={{ fontStyle: "italic", color: "rgba(0,0,0,.8)", marginBottom: 24 }}>"{c.goalText}"</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {(c.goals || []).map((g) => {
            const pct = Math.min((g.current / g.target) * 100, 100);
            const exc = g.current >= g.target;
            return (
              <div key={g.id}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                  <span className="t-body-em">{g.label}</span>
                  <span className="t-cap" style={{ color: exc ? "#34C759" : "rgba(0,0,0,.7)" }}>
                    <b style={{ fontSize: 17 }}>{g.current.toLocaleString("es-ES")}{g.unit}</b>
                    <span style={{ color: "rgba(0,0,0,.4)" }}> / {g.target.toLocaleString("es-ES")}{g.unit}</span>
                  </span>
                </div>
                <div style={{ height: 10, background: "#fff", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: exc ? "linear-gradient(90deg,#34C759,#1d8c3f)" : "linear-gradient(90deg,#88b0e0,#0071e3)", transition: "width 800ms" }} />
                </div>
                <div className="t-mic" style={{ color: "rgba(0,0,0,.5)", marginTop: 4 }}>{exc ? "✓ Objetivo superado" : `${pct.toFixed(0)}% completado`}</div>
              </div>
            );
          })}
        </div>
      </div>
      {/* AI Report */}
      <div className="card halo-bg" style={{ padding: 32, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div className="t-nano spaced-lg" style={{ color: "#88b0e0", marginBottom: 12 }}>REPORTE MENSUAL · IA</div>
            <h2 className="t-tile" style={{ fontWeight: 600, color: "#fff", marginBottom: 8 }}>Listo para enviar a {c.name}</h2>
            <p className="t-cap" style={{ color: "rgba(255,255,255,.7)", maxWidth: 460 }}>Claude analiza objetivos, crecimiento, horas y voz de marca para generar un reporte ejecutivo.</p>
          </div>
          <button onClick={generate} disabled={busy} className="pill pill-fill" style={{ background: "#88b0e0", color: "#0a1729", borderColor: "#88b0e0" }}>
            {busy ? <><Loader2 size={14} className="spin" />Generando…</> : <><Wand2 size={14} />Generar reporte</>}
          </button>
        </div>
        {err && <div className="t-cap" style={{ marginTop: 16, padding: 12, background: "rgba(255,59,48,.12)", borderRadius: 8, color: "#FF6961" }}>{err}</div>}
        {report && (
          <div className="fade-up" style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,.15)" }}>
            <div className="t-nano spaced-md" style={{ color: "#88b0e0", marginBottom: 8 }}>RESUMEN EJECUTIVO</div>
            <p className="t-body" style={{ color: "rgba(255,255,255,.92)", marginBottom: 24 }}>{report.executive_summary}</p>
            <div className="grid-2" style={{ marginBottom: 24 }}>
              <div style={{ padding: 20, background: "rgba(52,199,89,.1)", borderRadius: 12, border: "1px solid rgba(52,199,89,.2)" }}>
                <div className="t-nano spaced-md" style={{ color: "#34C759", marginBottom: 12 }}>WINS</div>
                {(report.wins || []).map((w, i) => <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }} className="t-cap"><Check size={14} style={{ color: "#34C759", flexShrink: 0, marginTop: 3 }} /><span style={{ color: "rgba(255,255,255,.9)" }}>{w}</span></div>)}
              </div>
              <div style={{ padding: 20, background: "rgba(255,149,0,.1)", borderRadius: 12, border: "1px solid rgba(255,149,0,.2)" }}>
                <div className="t-nano spaced-md" style={{ color: "#FF9500", marginBottom: 12 }}>A VIGILAR</div>
                {(report.concerns || []).map((w, i) => <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }} className="t-cap"><AlertCircle size={14} style={{ color: "#FF9500", flexShrink: 0, marginTop: 3 }} /><span style={{ color: "rgba(255,255,255,.9)" }}>{w}</span></div>)}
              </div>
            </div>
            <div style={{ padding: 20, background: "rgba(0,113,227,.15)", borderRadius: 12, marginBottom: 16 }}>
              <div className="t-nano spaced-md" style={{ color: "#88b0e0", marginBottom: 8 }}>FOCO PRÓXIMO MES</div>
              <p className="t-card" style={{ color: "#fff" }}>{report.next_focus}</p>
            </div>
            <div className="t-nano spaced-md" style={{ color: "#88b0e0", marginBottom: 12 }}>ACCIONES RECOMENDADAS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {(report.recommended_actions || []).map((a, i) => (
                <div key={i} style={{ padding: "10px 14px", background: "rgba(255,255,255,.05)", borderRadius: 8, color: "rgba(255,255,255,.9)" }} className="t-cap">{i + 1}. {a}</div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-blue"><Mail size={12} />Enviar al cliente</button>
              <button className="btn btn-ghost-light"><Copy size={12} />Copiar texto</button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

/* ════════════════════════════════════════════════════════════════════
   TEMPLATES
════════════════════════════════════════════════════════════════════ */
function UsersPage({ clients, currentUser }) {
  const [profiles, setProfiles] = useState([]);
  const [invites, setInvites] = useState([]);
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ email: "", role: "client", workspace: "frame", workspacesText: "frame" });
  const clientOptions = ["frame", ...Object.keys(clients).filter(k => k !== "frame")];
  const roles = ["admin", "socio", "editor", "client"];
  const parseWorkspaces = (value) => [...new Set((value || "").split(",").map(s => s.trim()).filter(Boolean))];
  const normalizeAccess = (role, workspace, workspacesText) => {
    if (role === "client") {
      return { workspace: workspace || "frame", workspaces: null };
    }
    const list = parseWorkspaces(workspacesText);
    return { workspace: null, workspaces: list.length ? list : ["frame"] };
  };

  const load = async () => {
    setBusy(true);
    const [u, i] = await Promise.all([dbUsers.getAll(), dbInvitations.getAll()]);
    setProfiles(u);
    setInvites(i);
    setBusy(false);
  };

  useEffect(() => { load(); }, []);

  const saveProfile = async (p, patch) => {
    const next = { ...p, ...patch };
    const access = normalizeAccess(next.role, next.workspace || p.workspace, (next.workspaces || p.workspaces || ["frame"]).join(", "));
    next.workspace = access.workspace;
    next.workspaces = access.workspaces;
    setProfiles(list => list.map(x => x.id === p.id ? next : x));
    const saved = await dbUsers.update(p.id, { role: next.role, workspace: next.workspace, workspaces: next.workspaces });
    if (!saved) setMsg("No se pudo guardar el perfil. Revisa RLS de profiles.");
  };

  const createInvite = async (e) => {
    e?.preventDefault?.();
    setMsg("");
    const email = form.email.trim().toLowerCase();
    if (!email) { setMsg("El email es obligatorio."); return; }
    const access = normalizeAccess(form.role, form.workspace, form.workspacesText);
    const invite = {
      email,
      role: form.role,
      workspace: access.workspace,
      workspaces: access.workspaces,
      invited_by: currentUser.id,
    };
    const saved = await dbInvitations.upsert(invite);
    if (!saved) {
      setMsg("No se pudo crear la invitación. Aplica el SQL de invitations en Supabase.");
      return;
    }
    setForm({ email: "", role: "client", workspace: "frame", workspacesText: "frame" });
    setMsg("Invitación guardada. Cuando ese email se registre, recibirá su rol automáticamente.");
    await load();
  };

  const removeInvite = async (email) => {
    await dbInvitations.delete(email);
    setInvites(list => list.filter(i => i.email !== email));
  };

  return (
    <Shell>
      <div style={{ marginBottom: 32 }}>
        <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 12 }}>ADMIN</div>
        <h1 className="t-display" style={{ marginBottom: 16 }}>Usuarios y roles.</h1>
        <p className="t-subnav" style={{ color: "rgba(0,0,0,.72)", maxWidth: 760 }}>Los usuarios se registran con Supabase Auth. Desde aquí asignas rol y workspace; para usuarios nuevos, crea una invitación por email.</p>
      </div>
      {msg && <div className="card" style={{ padding: 16, marginBottom: 24, background: "#fff7e6", borderColor: "rgba(255,149,0,.24)", color: "#8a5a00" }}>{msg}</div>}
      <form onSubmit={createInvite} className="card" style={{ padding: 24, marginBottom: 32 }}>
        <div className="t-body-em" style={{ marginBottom: 16 }}>Invitar o preasignar acceso</div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1fr) 150px 180px minmax(220px,1fr) auto", gap: 12, alignItems: "center" }}>
          <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@dominio.com" />
          <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>{roles.map(r => <option key={r} value={r}>{r}</option>)}</select>
          <select className="input" value={form.workspace} onChange={e => setForm(f => ({ ...f, workspace: e.target.value }))}>{clientOptions.map(id => <option key={id} value={id}>{clients[id]?.name || id}</option>)}</select>
          <input className="input" value={form.workspacesText} onChange={e => setForm(f => ({ ...f, workspacesText: e.target.value }))} placeholder="frame, cliente-a, cliente-b" />
          <button className="btn btn-primary" type="submit"><UserPlus size={14} />Guardar</button>
        </div>
        <div className="t-mic" style={{ marginTop: 10, color: "rgba(0,0,0,.48)" }}>Para `client` se usa un solo workspace. Para `admin`, `socio` o `editor`, escribe varios separados por coma.</div>
      </form>
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 32 }}>
        <div style={{ padding: 20, borderBottom: "1px solid rgba(0,0,0,.06)", display: "flex", justifyContent: "space-between" }}>
          <div className="t-body-em">Perfiles registrados</div>
          <button className="btn btn-ghost" onClick={load}><RefreshCw size={14} />Actualizar</button>
        </div>
        {busy ? <div style={{ padding: 24 }}><Loader2 size={16} className="spin" /></div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ textAlign: "left", color: "rgba(0,0,0,.44)" }}><th style={{ padding: 16 }}>Email</th><th>Nombre</th><th>Rol</th><th>Workspace</th><th>Creado</th></tr></thead>
              <tbody>{profiles.map(p => (
                <tr key={p.id} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                  <td style={{ padding: 16 }}>{p.email}</td>
                  <td>{p.name}</td>
                  <td><select className="input" value={p.role || "client"} onChange={e => saveProfile(p, { role: e.target.value })}>{roles.map(r => <option key={r} value={r}>{r}</option>)}</select></td>
                  <td>
                    {p.role === "client" ? (
                      <select className="input" value={p.workspace || "frame"} onChange={e => saveProfile(p, { workspace: e.target.value })}>{clientOptions.map(id => <option key={id} value={id}>{clients[id]?.name || id}</option>)}</select>
                    ) : (
                      <input className="input" value={(p.workspaces || ["frame"]).join(", ")} onChange={e => saveProfile(p, { workspaces: parseWorkspaces(e.target.value) })} placeholder="frame, cliente-a" />
                    )}
                  </td>
                  <td className="t-cap" style={{ color: "rgba(0,0,0,.44)" }}>{p.created_at ? new Date(p.created_at).toLocaleDateString("es-ES") : "-"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: 20, borderBottom: "1px solid rgba(0,0,0,.06)" }} className="t-body-em">Invitaciones pendientes</div>
        {invites.length === 0 ? <div style={{ padding: 24, color: "rgba(0,0,0,.56)" }}>No hay invitaciones pendientes.</div> : invites.map(i => (
          <div key={i.email} style={{ padding: 16, borderTop: "1px solid rgba(0,0,0,.06)", display: "grid", gridTemplateColumns: "1fr 120px 1fr auto", gap: 12, alignItems: "center" }}>
            <div>{i.email}</div>
            <div className="role-pill" style={{ background: "#f5f5f7" }}>{i.role}</div>
            <div className="t-cap" style={{ color: "rgba(0,0,0,.56)" }}>{i.workspace || i.workspaces?.join(", ") || "frame"}</div>
            <button className="btn btn-ghost" onClick={() => removeInvite(i.email)}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function TemplatesPage() {
  const templates = [
    { icon: <Users size={20} />, name: "Onboarding cliente nuevo", desc: "7 días: descubrimiento, contratos, primer rodaje.", cat: "Cliente", uses: 4 },
    { icon: <Camera size={20} />, name: "Producción de Reel", desc: "Shot list + call sheet + edición + entrega.", cat: "Rodaje", uses: 12 },
    { icon: <Calendar size={20} />, name: "Mes de contenido tipo", desc: "30 posts según pilares de marca + calendario.", cat: "Contenido", uses: 7 },
    { icon: <Briefcase size={20} />, name: "Propuesta SMMA", desc: "Bloques pre-armados para cerrar leads.", cat: "Comercial", uses: 9 },
    { icon: <FileText size={20} />, name: "Brief profundo cliente", desc: "16 preguntas en 5 bloques antes del primer rodaje.", cat: "Cliente", uses: 6 },
    { icon: <BarChart3 size={20} />, name: "Reporte mensual cliente", desc: "Wins, métricas y próximos pasos.", cat: "Cliente", uses: 4 },
    { icon: <Mail size={20} />, name: "Cold outreach + follow-ups", desc: "Secuencia de 5 mensajes para abrir conversación.", cat: "Comercial", uses: 18 },
    { icon: <MessageCircle size={20} />, name: "Guion de Reel", desc: "Hook + desarrollo + CTA en 3 actos.", cat: "Contenido", uses: 8 },
  ];
  const cats = ["Todos", "Cliente", "Rodaje", "Contenido", "Comercial"];
  const [cat, setCat] = useState("Todos");
  const filtered = cat === "Todos" ? templates : templates.filter(t => t.category === cat || t.cat === cat);
  return (
    <Shell>
      <div style={{ marginBottom: 32 }}>
        <div className="t-nano spaced-md" style={{ color: "rgba(0,0,0,.4)", marginBottom: 12 }}>WORKFLOWS LISTOS</div>
        <h1 className="t-display" style={{ marginBottom: 16 }}>Plantillas.</h1>
        <p className="t-subnav" style={{ color: "rgba(0,0,0,.72)", maxWidth: 640 }}>Procesos completos en un click. Duplica, ajusta al cliente, en marcha.</p>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} style={{ padding: "8px 14px", borderRadius: 999, border: "1px solid", background: cat === c ? "#1d1d1f" : "#fff", borderColor: cat === c ? "#1d1d1f" : "rgba(0,0,0,.12)", color: cat === c ? "#fff" : "#1d1d1f", fontFamily: "inherit", cursor: "pointer", fontSize: 13 }}>{c}</button>
        ))}
      </div>
      <div className="grid-3">
        {filtered.map((t, i) => (
          <div key={i} className="card card-hov" style={{ padding: 24, background: "#f5f5f7" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#0071e3", marginBottom: 16 }}>{t.icon}</div>
            <div className="t-card-b" style={{ marginBottom: 6 }}>{t.name}</div>
            <div className="t-cap" style={{ color: "rgba(0,0,0,.56)", marginBottom: 16, lineHeight: 1.5 }}>{t.desc}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px solid rgba(0,0,0,.08)" }}>
              <span className="t-mic" style={{ color: "rgba(0,0,0,.5)" }}>Usado {t.uses}×</span>
              <button className="btn btn-blue"><Copy size={12} />Duplicar</button>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ════════════════════════════════════════════════════════════════════
   IDEAS — slash commands + drag & drop
════════════════════════════════════════════════════════════════════ */
function IdeasPage() {
  const [blocks, setBlocks] = useState([
    { id: "b1", type: "h1", text: "Ideas & Referencias", done: false },
    { id: "b2", type: "quote", text: "Las ideas no se buscan: se coleccionan.", done: false },
    { id: "b3", type: "h2", text: "Reels a grabar este mes", done: false },
    { id: "b4", type: "todo", text: "Día en la vida de un rodaje · de 6am hasta entrega", done: false },
    { id: "b5", type: "todo", text: "Serie «Primero te entiendo» · 3 episodios", done: true },
    { id: "b6", type: "todo", text: "Cold outreach visual: grabar 30s antes de pitchar", done: false },
    { id: "b7", type: "h2", text: "Referencias", done: false },
    { id: "b8", type: "bullet", text: "Tienda Nube founder interview · el por qué antes del qué", done: false },
    { id: "b9", type: "bullet", text: "Milfshakes reveal style · sorteo cinematográfico", done: false },
    { id: "b10", type: "p", text: "Las marcas que me inspiran nunca hablan del producto primero. Hablan del mundo donde ese producto tiene sentido.", done: false },
  ]);
  const [slash, setSlash] = useState(null); // { bid, top, left, sel }
  const [drag, setDrag] = useState(null);

  const upd = (id, p) => setBlocks((bs) => bs.map((b) => b.id === id ? { ...b, ...p } : b));
  const addAfter = (id, type = "p") => { const nb = { id: `b${Date.now()}`, type, text: "", done: false }; setBlocks((bs) => { const i = bs.findIndex(b => b.id === id); return [...bs.slice(0, i + 1), nb, ...bs.slice(i + 1)]; }); setTimeout(() => document.getElementById(`blk-${nb.id}`)?.focus(), 60); };
  const remove = (id) => setBlocks((bs) => bs.length > 1 ? bs.filter(b => b.id !== id) : bs);
  const moveDrag = (from, to) => setBlocks((bs) => { const fi = bs.findIndex(b => b.id === from); const ti = bs.findIndex(b => b.id === to); if (fi < 0 || ti < 0) return bs; const a = [...bs]; const [m] = a.splice(fi, 1); a.splice(ti, 0, m); return a; });

  const slashOpts = [
    { type: "p", icon: <AlignLeft size={13} />, name: "Texto", desc: "Párrafo" },
    { type: "h1", icon: <Heading1 size={13} />, name: "Título", desc: "Encabezado grande" },
    { type: "h2", icon: <Heading2 size={13} />, name: "Subtítulo", desc: "Encabezado sección" },
    { type: "bullet", icon: <ListIcon size={13} />, name: "Lista", desc: "Viñetas" },
    { type: "todo", icon: <CheckSquare size={13} />, name: "To-do", desc: "Checkbox" },
    { type: "quote", icon: <Quote size={13} />, name: "Cita", desc: "Texto destacado" },
  ];

  return (
    <Shell>
      <div className="t-cap" style={{ marginBottom: 18, color: "rgba(0,0,0,.4)" }}>
        Pulsa <kbd>/</kbd> en línea vacía · arrastra el handle para reordenar · <kbd>Enter</kbd> nueva línea · <kbd>⌫</kbd> en vacío para borrar
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {blocks.map((b) => (
          <div key={b.id} style={{ display: "flex", alignItems: "flex-start", gap: 6, position: "relative" }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (drag && drag !== b.id) moveDrag(drag, b.id); setDrag(null); }}>
            {/* Drag handle */}
            <div draggable onDragStart={() => setDrag(b.id)} onDragEnd={() => setDrag(null)}
              style={{ width: 20, opacity: 0.3, cursor: "grab", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 6, transition: "opacity 160ms" }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = 0.7}
              onMouseLeave={(e) => e.currentTarget.style.opacity = 0.3}>
              <GripVertical size={14} />
            </div>
            {/* Prefix */}
            {b.type === "bullet" && <span style={{ marginTop: 8, fontWeight: 600 }}>•</span>}
            {b.type === "todo" && (
              <button onClick={() => upd(b.id, { done: !b.done })} style={{ marginTop: 6, width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${b.done ? "#0071e3" : "rgba(0,0,0,.24)"}`, background: b.done ? "#0071e3" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {b.done && <Check size={9} color="white" strokeWidth={3} />}
              </button>
            )}
            {b.type === "quote" && <div style={{ width: 3, background: "#0a1729", alignSelf: "stretch", marginTop: 4, marginBottom: 4 }} />}
            {/* Block textarea */}
            <BlockTextarea id={b.id} block={b} blocks={blocks} upd={upd} addAfter={addAfter} remove={remove} setSlash={setSlash} />
          </div>
        ))}
        <button onClick={() => addAfter(blocks[blocks.length - 1].id)} className="btn btn-ghost" style={{ marginTop: 12, color: "rgba(0,0,0,.4)", alignSelf: "flex-start" }}>
          <Plus size={12} />Añadir bloque
        </button>
      </div>
      {/* Slash menu */}
      {slash && (
        <>
          <div onClick={() => setSlash(null)} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
          <div className="slash-menu" style={{ top: slash.top, left: slash.left }}>
            <div className="t-nano" style={{ color: "rgba(0,0,0,.4)", padding: "6px 8px" }}>BLOQUE</div>
            {slashOpts.map((o, i) => (
              <div key={o.type} onClick={() => { upd(slash.bid, { type: o.type }); setSlash(null); }} className={`slash-item ${i === slash.sel ? "sel" : ""}`}>
                <div style={{ width: 26, height: 26, borderRadius: 5, background: "#f5f5f7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{o.icon}</div>
                <div><div className="t-cap-b">{o.name}</div><div className="t-mic" style={{ color: "rgba(0,0,0,.5)" }}>{o.desc}</div></div>
              </div>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}

function BlockTextarea({ id, block, blocks, upd, addAfter, remove, setSlash }) {
  const ref = useRef();
  const [tmp, setTmp] = useState(block.text);
  useEffect(() => setTmp(block.text), [block.text, block.id]);
  const commit = () => upd(block.id, { text: tmp });
  const styles = {
    p: { fontSize: 16, lineHeight: 1.5, color: "#1d1d1f" },
    h1: { fontSize: 36, lineHeight: 1.1, fontWeight: 600, letterSpacing: "-0.6px", marginTop: 12 },
    h2: { fontSize: 24, lineHeight: 1.2, fontWeight: 600, letterSpacing: "-0.3px", marginTop: 8 },
    bullet: { fontSize: 16, lineHeight: 1.5, color: "#1d1d1f" },
    todo: { fontSize: 16, lineHeight: 1.5, color: block.done ? "rgba(0,0,0,.4)" : "#1d1d1f", textDecoration: block.done ? "line-through" : "none" },
    quote: { fontSize: 18, lineHeight: 1.4, fontStyle: "italic", color: "rgba(0,0,0,.7)", fontFamily: SERIF },
  };
  const phs = { p: "Escribe algo, o '/' para comandos…", h1: "Título", h2: "Subtítulo", bullet: "Lista", todo: "Tarea", quote: "Cita" };
  return (
    <textarea id={`blk-${id}`} ref={ref} value={tmp}
      onChange={(e) => setTmp(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); addAfter(block.id, ["bullet", "todo"].includes(block.type) ? block.type : "p"); }
        if (e.key === "Backspace" && !tmp) { e.preventDefault(); if (blocks.length > 1) remove(block.id); else upd(block.id, { type: "p" }); }
        if (e.key === "/" && !tmp) { e.preventDefault(); const r = ref.current.getBoundingClientRect(); setSlash({ bid: block.id, top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, sel: 0 }); }
      }}
      placeholder={phs[block.type]} rows={1}
      style={{ outline: "none", background: "transparent", border: "none", flex: 1, fontFamily: "inherit", padding: "2px 0", resize: "none", overflow: "hidden", width: "100%", ...styles[block.type] }}
      onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
    />
  );
}

/* ════════════════════════════════════════════════════════════════════
   CLIENT PORTAL (role = client)
════════════════════════════════════════════════════════════════════ */
function ClientTopbar({ user, onLogout, clientName }) {
  return (
    <div className="halo-bg" style={{ padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div className="serif" style={{ fontSize: 28, color: "#fff" }}>gonzo</div>
        <div style={{ height: 24, width: 1, background: "rgba(255,255,255,.2)" }} />
        <div><div className="t-nano spaced-md" style={{ color: "#88b0e0" }}>PORTAL DE CLIENTE</div><div className="t-cap-b" style={{ color: "#fff" }}>{clientName}</div></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="t-cap" style={{ color: "rgba(255,255,255,.7)" }}>Hola, {user.name.split(" ")[0]}</div>
        <button onClick={onLogout} className="btn btn-ghost-light"><LogOut size={14} />Salir</button>
      </div>
    </div>
  );
}

function ClientPortal({ user, client, clientId, updateClient }) {
  const [tab, setTab] = useState("entregables");
  const upd = (k) => (v) => updateClient(clientId, { [k]: v });
  return (
    <div>
      <section style={{ background: "#0a1729", color: "#fff", padding: "60px 0" }}>
        <div className="page-pad" style={{ paddingTop: 0, paddingBottom: 0, maxWidth: 1040, margin: "0 auto" }}>
          <div className="t-nano spaced-lg" style={{ color: "#88b0e0", marginBottom: 20 }}>BIENVENIDA · {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long" }).toUpperCase()}</div>
          <h1 className="t-display" style={{ color: "#fff" }}>Hola, <span className="serif" style={{ fontStyle: "italic", color: "#88b0e0" }}>{user.name.split(" ")[0]}</span>.</h1>
          <p className="t-subnav" style={{ color: "rgba(255,255,255,.72)", marginTop: 16, maxWidth: 640 }}>Aquí encontrarás tus entregables, el brief de marca y comunicación directa.</p>
        </div>
      </section>
      <Shell>
        <div style={{ display: "flex", gap: 32, marginBottom: 32, borderBottom: "1px solid rgba(0,0,0,.08)", overflowX: "auto" }} className="sb">
          {[["entregables", "Entregables"], ["brief", "Brief de marca"], ["comunicacion", "Comunicación"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ background: "transparent", border: "none", padding: "12px 0", marginBottom: -1, fontFamily: "inherit", cursor: "pointer", fontSize: 17, letterSpacing: "-0.374px", color: tab === k ? "#1d1d1f" : "rgba(0,0,0,.56)", fontWeight: tab === k ? 500 : 400, borderBottom: tab === k ? "2px solid #1d1d1f" : "2px solid transparent", whiteSpace: "nowrap" }}>{l}</button>
          ))}
        </div>
        {tab === "entregables" && <DeliverablesTab data={client} upd={upd} canEdit={false} />}
        {tab === "brief" && <BriefTab data={client} upd={upd} canEdit={false} />}
        {tab === "comunicacion" && <ChatTab data={client} upd={upd} user={user} />}
      </Shell>
    </div>
  );
}
