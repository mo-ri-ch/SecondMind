import { useState, useEffect } from "react";
import { FloatingWidget } from "./components/FloatingWidget";
import { Settings, ShieldAlert, Monitor, Terminal, Layout } from "lucide-react";

function App() {
  const [isTauri, setIsTauri] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [username, setUsername] = useState("Alex");
  const [theme, setTheme] = useState("dark");
  const [proactivity, setProactivity] = useState(80);

  useEffect(() => {
    // Detect if running inside Tauri runtime
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      setIsTauri(true);
    }
  }, []);

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
        <FloatingWidget onOpenSettings={() => setShowSettings(true)} />
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
                onClick={() => setShowSettings(false)}
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
