import React, { useState } from "react";
import { Avatar } from "./Avatar";
import { Tabs } from "./Tabs";
import { X, Settings } from "lucide-react";

interface FloatingWidgetProps {
  username?: string;
  onOpenSettings?: () => void;
}

export const FloatingWidget: React.FC<FloatingWidgetProps> = ({ username = "Alex", onOpenSettings }) => {
  const [mode, setMode] = useState<"minimal" | "expanded">("minimal");
  const [activeTab, setActiveTab] = useState<"chat" | "context" | "goals" | "habits">("chat");
  const [avatarState, setAvatarState] = useState<"idle" | "thinking" | "speaking" | "attention">("idle");

  const toggleMode = () => {
    if (mode === "minimal") {
      setMode("expanded");
      // Cycle avatar states for demonstration when opening
      setAvatarState("thinking");
      setTimeout(() => setAvatarState("idle"), 1500);
    } else {
      setMode("minimal");
    }
  };

  return (
    <div className="relative font-sans select-none animate-float">
      {/* 1. Minimal Mode: Circular Avatar Float */}
      {mode === "minimal" && (
        <Avatar 
          state={avatarState} 
          onClick={toggleMode} 
          className="hover:scale-115 transition-all duration-300 shadow-2xl" 
        />
      )}

      {/* 2. Expanded Mode: Tab Drawer */}
      {mode === "expanded" && (
        <div className="w-[380px] rounded-2xl border border-white/[0.08] glass-panel shadow-2xl overflow-hidden flex flex-col transition-all duration-500 animate-glow-pulse">
          {/* Header Panel */}
          <div className="flex justify-between items-center px-4 py-3 bg-slate-950/40 border-b border-white/[0.06]">
            <div className="flex items-center space-x-2">
              <Avatar 
                state={avatarState} 
                onClick={toggleMode} 
                className="scale-75 hover:scale-80 transition-all cursor-pointer" 
              />
              <div>
                <div className="font-semibold text-xs text-white">Second Mind</div>
                <div className="text-[10px] text-slate-400">PCOS Companion</div>
              </div>
            </div>
            
            {/* Header Actions */}
            <div className="flex items-center space-x-2 text-slate-400">
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

          {/* Body and Tab routing */}
          <Tabs username={username} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      )}
    </div>
  );
};
