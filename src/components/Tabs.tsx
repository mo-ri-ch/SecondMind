import React, { useState } from "react";
import { MessageSquare, Layout, Target, Activity, Send, CheckCircle2, Circle } from "lucide-react";

interface TabsProps {
  activeTab: "chat" | "context" | "goals" | "habits";
  onTabChange: (tab: "chat" | "context" | "goals" | "habits") => void;
}

export const Tabs: React.FC<TabsProps> = ({ activeTab, onTabChange }) => {
  const tabsList = [
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "context", label: "Context", icon: Layout },
    { id: "goals", label: "Goals", icon: Target },
    { id: "habits", label: "Habits", icon: Activity },
  ] as const;

  // Mock contents
  const [messages, setMessages] = useState([
    { sender: "ai", text: "Hello! I am Second Mind. I am observing your screen to provide cognitive assistance. How can I help you build?" },
    { sender: "user", text: "Explain how to structure this authentication middleware" },
    { sender: "ai", text: "I noticed you are working on JWT validation. In TypeScript, ensure you define a custom `Request` interface extension in `express` to bind the payload: \n\n```typescript\ninterface AuthenticatedRequest extends Request {\n  user: JWTPayload;\n}\n```\nWould you like me to create the complete implementation?" },
  ]);

  const [inputVal, setInputVal] = useState("");
  const [habits, setHabits] = useState([
    { id: 1, title: "Deep Work (2hr)", completed: true },
    { id: 2, title: "Log active learnings", completed: false },
    { id: 3, title: "Stretch & Hydrate", completed: true },
    { id: 4, title: "Evening Reflection", completed: false },
  ]);

  const [goals, setGoals] = useState([
    { id: 1, title: "Build Authentication System", progress: 67, why: "Secures user cognitive graph and settings" },
    { id: 2, title: "Complete NLP Model Integration", progress: 43, why: "Local Phi-3.5 cognitive modeling" },
    { id: 3, title: "Master Spaced Repetition Engine", progress: 12, why: "Adaptive learning system core" },
  ]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    setMessages(prev => [...prev, { sender: "user", text: inputVal }]);
    const currentVal = inputVal;
    setInputVal("");
    
    // Simulating thinking & response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        sender: "ai", 
        text: `I've analyzed your request: "${currentVal}". Since we are in Phase 1, the full local LLM pipeline is mocked. In Phase 3, this will query Phi-3.5 locally!` 
      }]);
    }, 1000);
  };

  const toggleHabit = (id: number) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, completed: !h.completed } : h));
  };

  return (
    <div className="flex flex-col h-[480px]">
      {/* Scrollable Content Pane */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === "chat" && (
          <div className="space-y-4 flex flex-col justify-end min-h-full">
            <div className="space-y-3">
              {messages.map((m, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed glass-card ${
                    m.sender === "user" 
                      ? "bg-violet-600/20 border-violet-500/20 text-violet-100" 
                      : "bg-slate-800/40 border-slate-700/30 text-slate-100"
                  }`}>
                    {m.text.split("\n").map((line, lIdx) => (
                      <p key={lIdx} className={line.startsWith("```") ? "font-mono bg-slate-950/40 p-2 rounded-lg text-xs overflow-x-auto my-1" : ""}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Input bar */}
            <form onSubmit={handleSend} className="relative mt-2">
              <input 
                type="text"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder="Ask Second Mind..."
                className="w-full bg-slate-950/40 border border-white/5 rounded-xl py-3 pl-4 pr-10 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 text-white placeholder-slate-400 transition-all"
              />
              <button 
                type="submit"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-violet-400 hover:text-violet-300 active:scale-95 transition-all cursor-pointer"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        )}

        {activeTab === "context" && (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Observational Context</h3>
            
            <div className="glass-card rounded-xl p-4 border border-white/5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Active Window</span>
                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">Observing</span>
              </div>
              <div className="font-mono text-sm text-violet-300">VS Code: src/App.tsx</div>
              <div className="text-xs text-slate-300 leading-relaxed">
                You are currently editing React UI components. Focus index is high. Cognitive load estimated at <span className="text-cyan-400">Low</span>.
              </div>
            </div>

            <div className="glass-card rounded-xl p-4 border border-white/5 space-y-3">
              <div className="text-xs text-slate-400">Recent Context Log</div>
              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>12:05 PM</span>
                  <span className="text-slate-300">Browsing GitHub CLI Docs</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>11:58 AM</span>
                  <span className="text-slate-300">Terminal: pnpm install</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>11:42 AM</span>
                  <span className="text-slate-300">Editing phased_execution_plan.md</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "goals" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Quarterly Goals</h3>
              <span className="text-[10px] text-violet-400 hover:underline cursor-pointer">View All</span>
            </div>
            
            <div className="space-y-3">
              {goals.map(g => (
                <div key={g.id} className="glass-card rounded-xl p-4 border border-white/5 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="font-medium text-sm text-slate-200">{g.title}</div>
                    <span className="text-xs text-violet-400 font-bold">{g.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-800/40 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${g.progress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 italic">“{g.why}”</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "habits" && (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Daily Routines</h3>
            <div className="space-y-2">
              {habits.map(h => (
                <div 
                  key={h.id} 
                  onClick={() => toggleHabit(h.id)}
                  className="flex items-center space-x-3 p-3.5 glass-card rounded-xl border border-white/5 cursor-pointer hover:bg-white/[0.02] active:scale-[0.99] transition-all"
                >
                  {h.completed ? (
                    <CheckCircle2 size={18} className="text-violet-400" />
                  ) : (
                    <Circle size={18} className="text-slate-500 hover:text-violet-400/70" />
                  )}
                  <span className={`text-sm select-none ${h.completed ? "line-through text-slate-500" : "text-slate-200"}`}>
                    {h.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Persistent Tab Selection Bar */}
      <div className="flex border-t border-white/[0.06] bg-slate-950/20 p-2">
        {tabsList.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`flex-1 flex flex-col items-center py-1.5 rounded-lg transition-all cursor-pointer ${
                active 
                  ? "text-violet-400 bg-white/[0.03] font-semibold" 
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Icon size={18} />
              <span className="text-[10px] mt-1 select-none">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
