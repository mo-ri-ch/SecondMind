import React, { useState, useEffect } from "react";
import { Avatar, AvatarState } from "./Avatar";
import { Tabs } from "./Tabs";
import { ReflectionPanel } from "./ReflectionPanel";
import { X, Settings, BookOpen } from "lucide-react";

interface FloatingWidgetProps {
  username?: string;
  onOpenSettings?: () => void;
}

export const FloatingWidget: React.FC<FloatingWidgetProps> = ({ username = "Alex", onOpenSettings }) => {
  const [mode, setMode] = useState<"minimal" | "expanded">("minimal");
  const [activeTab, setActiveTab] = useState<"chat" | "context" | "goals" | "habits" | "learn">("chat");
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [cognitiveMessage, setCognitiveMessage] = useState<string>("");
  const [showReflection, setShowReflection] = useState(false);

  useEffect(() => {
    let active = true;
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
      if (!isTauri) return;
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const ul = await listen<any>("cognitive-state", (event) => {
          const payload = event.payload;
          if (payload?.state) {
            // Map cognition states onto avatar states. Anything we don't know
            // stays in idle so unrelated states (thinking, speaking, attention)
            // can still be driven by chat events later.
            const mapped: AvatarState =
              payload.state === "focused" ? "focused" :
              payload.state === "fatigued" ? "fatigued" :
              payload.state === "chatty" ? "chatty" : "idle";
            setAvatarState(mapped);
            setCognitiveMessage(payload.message ?? "");
          }
        });
        if (!active) ul(); else unlisteners.push(ul);
      } catch (err) {
        console.error("Failed to attach cognitive-state listener:", err);
      }
    };
    setup();
    return () => {
      active = false;
      unlisteners.forEach(u => u());
    };
  }, []);

  // Browser-sandbox demo cycle so the cognition states are visible without Tauri.
  useEffect(() => {
    const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
    if (isTauri) return;
    const cycle: Array<{ s: AvatarState; m: string }> = [
      { s: "focused", m: "Deep focus on coding (3 min)." },
      { s: "fatigued", m: "Lots of context switching detected." },
      { s: "chatty", m: "Active in a conversation app." },
      { s: "idle", m: "Light activity." },
    ];
    let i = 0;
    const t = setInterval(() => {
      const next = cycle[i % cycle.length];
      setAvatarState(next.s);
      setCognitiveMessage(next.m);
      i++;
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const toggleMode = () => {
    if (mode === "minimal") {
      setMode("expanded");
    } else {
      setMode("minimal");
    }
  };

  return (
    <div className="relative font-sans select-none animate-float">
      {mode === "minimal" && (
        <Avatar
          state={avatarState}
          onClick={toggleMode}
          className="hover:scale-115 transition-all duration-300 shadow-2xl"
        />
      )}

      {mode === "expanded" && (
        <div className="w-[380px] rounded-2xl border border-white/[0.08] glass-panel shadow-2xl overflow-hidden flex flex-col transition-all duration-500 animate-glow-pulse">
          <div className="flex justify-between items-center px-4 py-3 bg-slate-950/40 border-b border-white/[0.06]">
            <div className="flex items-center space-x-2">
              <Avatar
                state={avatarState}
                onClick={toggleMode}
                className="scale-75 hover:scale-80 transition-all cursor-pointer"
              />
              <div>
                <div className="font-semibold text-xs text-white">Second Mind</div>
                <div className="text-[10px] text-slate-400">
                  {cognitiveMessage || "PCOS Companion"}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-slate-400">
              <button
                onClick={() => setShowReflection(true)}
                title="Daily Reflection"
                className="p-1 hover:text-white rounded hover:bg-white/[0.04] active:scale-95 transition-all cursor-pointer"
              >
                <BookOpen size={15} />
              </button>
              <button
                onClick={onOpenSettings}
                title="Settings Dashboard"
                className="p-1 hover:text-white rounded hover:bg-white/[0.04] active:scale-95 transition-all cursor-pointer"
              >
                <Settings size={15} />
              </button>
              <button
                onClick={toggleMode}
                title="Minimize"
                className="p-1 hover:text-white rounded hover:bg-white/[0.04] active:scale-95 transition-all cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <Tabs username={username} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      )}

      <ReflectionPanel open={showReflection} onClose={() => setShowReflection(false)} />
    </div>
  );
};
