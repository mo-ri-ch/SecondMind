import React from "react";

export type AvatarState =
  | "idle"
  | "thinking"
  | "speaking"
  | "attention"
  | "focused"
  | "fatigued"
  | "chatty";

interface AvatarProps {
  state: AvatarState;
  onClick?: () => void;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ state, onClick, className = "" }) => {
  const themeClasses = {
    idle: {
      ring: "border-violet-500/40 bg-violet-950/20 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.3)]",
      pulse: "bg-violet-500/20 animate-pulse-ring",
      core: "bg-gradient-to-tr from-violet-600 to-indigo-500",
    },
    thinking: {
      ring: "border-cyan-500/40 bg-cyan-950/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-spin-slow",
      pulse: "bg-cyan-500/20 animate-pulse-ring",
      core: "bg-gradient-to-tr from-cyan-500 to-violet-500 animate-pulse",
    },
    speaking: {
      ring: "border-emerald-500/40 bg-emerald-950/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]",
      pulse: "bg-emerald-500/30 scale-110 animate-ping",
      core: "bg-gradient-to-tr from-emerald-500 to-teal-400",
    },
    attention: {
      ring: "border-amber-500/50 bg-amber-950/20 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)] animate-bounce",
      pulse: "bg-amber-500/30 animate-pulse-ring",
      core: "bg-gradient-to-tr from-amber-500 to-orange-500",
    },
    focused: {
      ring: "border-emerald-400/60 bg-emerald-950/20 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.45)]",
      pulse: "bg-emerald-500/25 animate-pulse-ring",
      core: "bg-gradient-to-tr from-emerald-500 to-green-400",
    },
    fatigued: {
      ring: "border-amber-400/60 bg-amber-950/20 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.45)] animate-pulse",
      pulse: "bg-amber-500/25 animate-pulse-ring",
      core: "bg-gradient-to-tr from-amber-500 to-yellow-500",
    },
    chatty: {
      ring: "border-sky-400/60 bg-sky-950/20 text-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.45)]",
      pulse: "bg-sky-500/25 animate-pulse-ring",
      core: "bg-gradient-to-tr from-sky-500 to-blue-500",
    },
  }[state];

  const renderCore = () => {
    if (state === "thinking") return <span className="text-[10px] tracking-wider animate-pulse">🧠</span>;
    if (state === "attention") return <span className="text-white animate-ping">!</span>;
    if (state === "fatigued") return <span className="text-white font-mono text-xs">~</span>;
    if (state === "focused") return <span className="text-white font-mono text-xs">●</span>;
    if (state === "chatty") return <span className="text-white font-mono text-xs">…</span>;
    return <span className="text-white font-mono text-lg select-none">M</span>;
  };

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center cursor-pointer transition-all duration-300 active:scale-95 ${className}`}
      style={{ width: "56px", height: "56px" }}
    >
      <div className={`absolute inset-0 rounded-full transition-all duration-500 ${themeClasses.pulse}`} />
      <div className={`absolute inset-1 rounded-full border-2 transition-all duration-500 flex items-center justify-center backdrop-blur-md ${themeClasses.ring}`}>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-inner overflow-hidden font-bold text-xs select-none ${themeClasses.core}`}>
          {renderCore()}
        </div>
      </div>
    </div>
  );
};
