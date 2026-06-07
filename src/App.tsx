import { useState, useEffect } from "react";
import { FloatingWidget } from "./components/FloatingWidget";
import { PeoplePanel } from "./components/PeoplePanel";
import { Settings, ShieldAlert, Eye, EyeOff, Trash2, RefreshCw, Sparkles, AlertTriangle, X as XIcon, Download, Lock } from "lucide-react";

interface ScreenCapture {
  id: string;
  captured_at: string;
  app_name: string;
  window_title: string;
  category: string;
  text: string;
  confidence: number;
}

interface PulseAlert {
  id: string;
  kind: string;
  title: string;
  body: string;
  severity: "info" | "warning";
}

function App() {
  const [isTauri, setIsTauri] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [username, setUsername] = useState("Alex");
  const [theme, setTheme] = useState("dark");
  const [proactivity, setProactivity] = useState(80);
  const [captureEnabled, setCaptureEnabled] = useState(false);
  const [captures, setCaptures] = useState<ScreenCapture[]>([]);
  const [capturesLoading, setCapturesLoading] = useState(false);
  const [pulseAlerts, setPulseAlerts] = useState<PulseAlert[]>([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [confirmClear, setConfirmClear] = useState(false);
  const [privacyStatus, setPrivacyStatus] = useState("");

  const handlePurge = async () => {
    if (!isTauri) { setPrivacyStatus("Browser sandbox: nothing to purge."); return; }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const removed = await invoke<number>("purge_old_data", { keepDays: retentionDays });
      setPrivacyStatus(`Removed ${removed} captures older than ${retentionDays} days.`);
      await refreshCaptures();
    } catch (err) {
      console.error(err);
      setPrivacyStatus("Purge failed - see console.");
    }
  };

  const handleClearAll = async () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    if (!isTauri) { setPrivacyStatus("Browser sandbox: nothing to clear."); setConfirmClear(false); return; }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("clear_all_user_data");
      setPrivacyStatus("All user data cleared.");
      await refreshCaptures();
    } catch (err) {
      console.error(err);
      setPrivacyStatus("Clear failed - see console.");
    }
    setConfirmClear(false);
  };

  const handleExport = async () => {
    if (!isTauri) { setPrivacyStatus("Browser sandbox: open in Tauri to export."); return; }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const json = await invoke<string>("export_all_data");
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `second_mind_export_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setPrivacyStatus("Export downloaded.");
    } catch (err) {
      console.error(err);
      setPrivacyStatus("Export failed - see console.");
    }
  };

  const pushPulseAlert = (alert: Omit<PulseAlert, "id">) => {
    const id = `pulse_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setPulseAlerts(prev => [...prev, { ...alert, id }]);
    setTimeout(() => {
      setPulseAlerts(prev => prev.filter(a => a.id !== id));
    }, 9000);
  };

  const dismissPulseAlert = (id: string) => {
    setPulseAlerts(prev => prev.filter(a => a.id !== id));
  };

  const refreshCaptures = async () => {
    if (!isTauri) return;
    setCapturesLoading(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const enabled = await invoke<boolean>("get_screen_capture_enabled");
      setCaptureEnabled(enabled);
      const rows = await invoke<ScreenCapture[]>("get_screen_captures", { limit: 50 });
      setCaptures(rows ?? []);
    } catch (err) {
      console.error("Failed to load screen captures:", err);
    } finally {
      setCapturesLoading(false);
    }
  };

  const toggleCapture = async (next: boolean) => {
    setCaptureEnabled(next);
    if (!isTauri) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_screen_capture_enabled", { enabled: next });
    } catch (err) {
      console.error("Failed to toggle screen capture:", err);
    }
  };

  const handleClearCaptures = async () => {
    if (!isTauri) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("clear_screen_captures");
      setCaptures([]);
    } catch (err) {
      console.error("Failed to clear screen captures:", err);
    }
  };

  useEffect(() => {
    const isTauriRuntime = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
    setIsTauri(isTauriRuntime);

    async function loadData() {
      if (isTauriRuntime) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          
          const profile = await invoke<any>("get_user_profile");
          if (profile && profile.name) {
            setUsername(profile.name);
          }

          const prefs = await invoke<any[]>("get_user_preferences");
          if (prefs) {
            const themePref = prefs.find(p => p.key === "theme");
            if (themePref) {
              try {
                setTheme(JSON.parse(themePref.value));
              } catch {
                setTheme(themePref.value);
              }
            }
            const proactivityPref = prefs.find(p => p.key === "proactivity");
            if (proactivityPref) {
              setProactivity(parseInt(proactivityPref.value, 10));
            }
          }
        } catch (err) {
          console.error("Failed to load data from Tauri SQLite:", err);
        }
      } else {
        // Browser Mode Fallback: Load from localStorage
        const storedName = localStorage.getItem("sm_username");
        if (storedName) setUsername(storedName);

        const storedTheme = localStorage.getItem("sm_theme");
        if (storedTheme) setTheme(storedTheme);

        const storedProactivity = localStorage.getItem("sm_proactivity");
        if (storedProactivity) setProactivity(parseInt(storedProactivity, 10));
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (showSettings) {
      refreshCaptures();
    }
  }, [showSettings]);

  useEffect(() => {
    let active = true;
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      const isTauriRuntime = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
      if (!isTauriRuntime) {
        // Browser-mode demo: drop one alert ~6s after load so the toast UI is visible.
        const t = setTimeout(() => {
          pushPulseAlert({
            kind: "coding-fatigue",
            title: "Take a breath?",
            body: "Sandbox demo: you've been writing code for a while. A two-minute stretch will reset your focus.",
            severity: "warning",
          });
        }, 6000);
        return () => clearTimeout(t);
      }
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const ul = await listen<any>("pulse-alert", (event) => {
          const p = event.payload;
          if (p?.title && p?.body) {
            pushPulseAlert({
              kind: p.kind ?? "general",
              title: p.title,
              body: p.body,
              severity: p.severity === "warning" ? "warning" : "info",
            });
          }
        });
        if (!active) ul(); else unlisteners.push(ul);
      } catch (err) {
        console.error("Failed to attach pulse-alert listener:", err);
      }
    };

    const cleanupPromise = setup();
    return () => {
      active = false;
      unlisteners.forEach(u => u());
      Promise.resolve(cleanupPromise).then(fn => { if (typeof fn === "function") fn(); });
    };
  }, []);

  const handleSaveSettings = async () => {
    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        
        // Save Profile
        await invoke("update_user_profile", { name: username, timezone: "UTC" });
        
        // Save Preferences
        await invoke("update_user_preference", { category: "ui", key: "theme", value: JSON.stringify(theme) });
        await invoke("update_user_preference", { category: "intervention", key: "proactivity", value: proactivity.toString() });
      } catch (err) {
        console.error("Failed to save settings to SQLite:", err);
      }
    } else {
      // Browser Mode Fallback: Save to localStorage
      localStorage.setItem("sm_username", username);
      localStorage.setItem("sm_theme", theme);
      localStorage.setItem("sm_proactivity", proactivity.toString());
    }
    setShowSettings(false);
  };

  return (
    <div className={`relative min-h-screen w-full flex items-center justify-center transition-all duration-500 overflow-hidden ${
      isTauri ? "bg-transparent" : "bg-slate-900"
    }`}>
      {/* 1. Browser Simulation Background Mode */}
      {!isTauri && (
        <div className="absolute inset-0 z-0 select-none overflow-hidden">
          {/* Simulated operating system background */}
          <img 
            src="/desktop_mockup.png" 
            alt="Simulated Desktop Background" 
            className="w-full h-full object-cover opacity-30 blur-[2px] scale-[1.01]"
          />
          
          {/* Simulated System Tray/Notification Bar */}
          <div className="absolute bottom-4 left-4 z-10 glass-card px-4 py-2 border border-white/5 rounded-xl text-xs text-slate-400 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Second Mind local server is online (Browser Mode)</span>
          </div>

          <div className="absolute top-4 right-4 z-10 glass-card px-4 py-2 border border-white/5 rounded-xl text-xs text-slate-400">
            <span>Press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-[10px] text-white">Ctrl + Shift + M</kbd> to toggle in Tauri app</span>
          </div>
        </div>
      )}

      {/* 2. Floating Widget Component Container */}
      <div className="absolute bottom-8 right-8 z-40">
        <FloatingWidget username={username} onOpenSettings={() => setShowSettings(true)} />
      </div>

      {/* Phase 8 pulse alert toasts */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {pulseAlerts.map(a => (
          <div
            key={a.id}
            className={`pointer-events-auto glass-panel border rounded-2xl px-4 py-3 shadow-2xl flex items-start gap-3 animate-glow-pulse ${
              a.severity === "warning"
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-violet-500/30 bg-violet-500/5"
            }`}
          >
            <div className={`shrink-0 mt-0.5 ${a.severity === "warning" ? "text-amber-300" : "text-violet-300"}`}>
              {a.severity === "warning" ? <AlertTriangle size={16} /> : <Sparkles size={16} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white">{a.title}</div>
              <p className="text-[11px] text-slate-300 leading-snug mt-0.5">{a.body}</p>
            </div>
            <button
              onClick={() => dismissPulseAlert(a.id)}
              className="shrink-0 text-slate-400 hover:text-white transition-colors p-0.5 cursor-pointer bg-transparent border-none"
              title="Dismiss"
            >
              <XIcon size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* 3. Settings/Dashboard Panel Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md transition-all duration-300">
          <div className="w-full max-w-lg overflow-hidden border border-white/[0.08] rounded-2xl glass-panel shadow-2xl animate-glow-pulse">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 bg-slate-950/40 border-b border-white/[0.06]">
              <div className="flex items-center space-x-2.5">
                <Settings className="text-violet-400" size={18} />
                <h2 className="font-semibold text-sm text-white">System Settings Dashboard</h2>
              </div>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white transition-all text-xs font-semibold px-2.5 py-1 rounded bg-white/[0.04] cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Profile Config */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">User Profile</label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="text-xs text-slate-300">Profile Name</span>
                    <input 
                      type="text" 
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="w-full text-sm bg-slate-950/40 border border-white/5 rounded-xl py-2 px-3 focus:outline-none focus:border-violet-500/50 text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs text-slate-300">UI Theme</span>
                    <select 
                      value={theme}
                      onChange={e => setTheme(e.target.value)}
                      className="w-full text-sm bg-slate-950/40 border border-white/5 rounded-xl py-2 px-3 focus:outline-none focus:border-violet-500/50 text-white"
                    >
                      <option value="dark">Sleek Dark Mode</option>
                      <option value="light">Light (Placeholder)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Proactive Settings */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Proactive Assistance</label>
                <div className="glass-card rounded-xl p-4 border border-white/5 space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Intervention Proactivity</span>
                    <span className="text-violet-400 font-bold">{proactivity}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={proactivity} 
                    onChange={e => setProactivity(parseInt(e.target.value))}
                    className="w-full accent-violet-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Higher values allow Second Mind to alert you more frequently about focus lapses, healthy habit intervals, and learning checkpoints.
                  </p>
                </div>
              </div>

              <PeoplePanel />

              {/* Screen Log */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Screen Log (Developer)</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={refreshCaptures}
                      disabled={!isTauri || capturesLoading}
                      className="text-slate-400 hover:text-white transition-all text-[10px] font-medium px-2 py-1 rounded bg-white/[0.04] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <RefreshCw size={11} className={capturesLoading ? "animate-spin" : ""} />
                      Refresh
                    </button>
                    <button
                      onClick={handleClearCaptures}
                      disabled={!isTauri || captures.length === 0}
                      className="text-rose-300 hover:text-rose-200 transition-all text-[10px] font-medium px-2 py-1 rounded bg-rose-500/10 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Trash2 size={11} />
                      Clear
                    </button>
                  </div>
                </div>

                <div className="glass-card rounded-xl p-4 border border-white/5 space-y-3">
                  <button
                    onClick={() => toggleCapture(!captureEnabled)}
                    disabled={!isTauri}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      captureEnabled
                        ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/25"
                        : "bg-slate-800/40 text-slate-300 border border-white/5 hover:bg-slate-800/60"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {captureEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
                      Screen capture {captureEnabled ? "active" : "paused"}
                    </span>
                    <span className="text-[10px] opacity-70">{captureEnabled ? "Capturing every 10s" : "Click to enable"}</span>
                  </button>

                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {captures.length === 0 && (
                      <p className="text-[11px] text-slate-500 leading-normal text-center py-4">
                        {captureEnabled
                          ? "Waiting for first capture..."
                          : "Enable screen capture to start logging OCR text from your active window."}
                      </p>
                    )}
                    {captures.map(cap => (
                      <div key={cap.id} className="rounded-lg bg-slate-950/40 border border-white/5 px-3 py-2 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-violet-300 font-medium">{cap.app_name || "Unknown"}</span>
                          <span className="text-slate-500">{cap.captured_at}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-200 uppercase tracking-wider">{cap.category}</span>
                          <span className="text-slate-500 truncate">{cap.window_title}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug whitespace-pre-wrap break-words line-clamp-3">
                          {cap.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Privacy & Security */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Lock size={13} /> Privacy & Security
                </label>
                <div className="glass-card rounded-xl p-4 border border-white/5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Memory retention</span>
                      <span className="text-violet-400 font-bold">{retentionDays}d</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={365}
                      value={retentionDays}
                      onChange={e => setRetentionDays(parseInt(e.target.value))}
                      className="w-full accent-violet-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <button
                      onClick={handlePurge}
                      className="w-full bg-slate-800/60 hover:bg-slate-800/80 text-slate-200 text-xs py-2 rounded-lg cursor-pointer border border-white/5 transition-all"
                    >
                      Purge captures older than {retentionDays} days
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleExport}
                      className="bg-violet-600/20 hover:bg-violet-600/30 text-violet-200 text-xs py-2 rounded-lg cursor-pointer border border-violet-500/20 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Download size={12} /> Export JSON
                    </button>
                    <button
                      onClick={handleClearAll}
                      className={`text-xs py-2 rounded-lg cursor-pointer border transition-all flex items-center justify-center gap-1.5 ${
                        confirmClear
                          ? "bg-rose-500/30 hover:bg-rose-500/40 text-rose-100 border-rose-500/40"
                          : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-200 border-rose-500/20"
                      }`}
                    >
                      <Trash2 size={12} /> {confirmClear ? "Confirm clear?" : "Clear all data"}
                    </button>
                  </div>

                  {privacyStatus && (
                    <div className="text-[10px] text-slate-300 italic bg-slate-950/40 rounded px-3 py-2 border border-white/5">
                      {privacyStatus}
                    </div>
                  )}

                  <p className="text-[10px] text-slate-500 leading-snug">
                    Database encryption (SQLCipher) is gated for a future build. All data already lives only on this device in AppData.
                  </p>
                </div>
              </div>

              {/* Edge Case Warning */}
              <div className="flex items-start space-x-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <ShieldAlert className="text-amber-400 shrink-0" size={18} />
                <div className="space-y-1">
                  <div className="text-xs font-medium text-amber-300">Local-First Sandbox Warning</div>
                  <p className="text-[10px] text-amber-200/80 leading-normal">
                    Second Mind is running inside your web browser. Local OS integration (screen capture, active window tracking, and global hotkeys) will be activated when run within the Tauri compiled container.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end px-6 py-4 bg-slate-950/20 border-t border-white/[0.06]">
              <button 
                onClick={handleSaveSettings}
                className="bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-medium text-xs px-5 py-2 rounded-xl shadow-[0_4px_12px_rgba(139,92,246,0.3)] transition-all cursor-pointer"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
