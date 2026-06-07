import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Layout, Target, Activity, Send, CheckCircle2, Circle, X, Search, Clock } from "lucide-react";

interface TabsProps {
  username?: string;
  activeTab: "chat" | "context" | "goals" | "habits";
  onTabChange: (tab: "chat" | "context" | "goals" | "habits") => void;
}

interface Goal {
  id: string;
  title: string;
  progress: number;
  why: string;
  type?: string;
  target_date?: string;
}

interface Habit {
  id: string;
  title: string;
  completed: boolean;
}

interface CelebrationParticle {
  id: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  color: string;
}

interface HistorySearchResult {
  id: string;
  captured_at: string;
  app_name: string;
  window_title: string;
  category: string;
  text: string;
  snippet: string;
}

export const Tabs: React.FC<TabsProps> = ({ username = "Alex", activeTab, onTabChange }) => {
  const tabsList = [
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "context", label: "Context", icon: Layout },
    { id: "goals", label: "Goals", icon: Target },
    { id: "habits", label: "Habits", icon: Activity },
  ] as const;

  // State arrays
  const [messages, setMessages] = useState([
    { id: "msg_1", sender: "ai", text: `Hello, ${username}! I am Second Mind. I am observing your screen to provide cognitive assistance. How can I help you build?` },
    { id: "msg_2", sender: "user", text: "Explain how to structure this authentication middleware" },
    { id: "msg_3", sender: "ai", text: "I noticed you are working on JWT validation. In TypeScript, ensure you define a custom `Request` interface extension in `express` to bind the payload: \n\n```typescript\ninterface AuthenticatedRequest extends Request {\n  user: JWTPayload;\n}\n```\nWould you like me to create the complete implementation?" },
  ]);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);

  // Active Window & Logs States
  const [activeWindow, setActiveWindow] = useState({
    appName: "VS Code",
    title: "src/App.tsx",
  });

  const [contextLogs, setContextLogs] = useState([
    { time: "12:05 PM", description: "Browsing GitHub CLI Docs" },
    { time: "11:58 AM", description: "Terminal: pnpm install" },
    { time: "11:42 AM", description: "Editing phased_execution_plan.md" },
  ]);

  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputVal, setInputVal] = useState("");

  // Quick-Add Goals Forms States
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalWhy, setNewGoalWhy] = useState("");
  const [newGoalType, setNewGoalType] = useState("quarterly");
  const [newGoalDate, setNewGoalDate] = useState("");

  // Quick-Add Habits Forms States
  const [newHabitName, setNewHabitName] = useState("");

  // Particle celebration state
  const [particles, setParticles] = useState<CelebrationParticle[]>([]);

  // Phase 7: history search state
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HistorySearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);

  const activeAiMessageIdRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync initial message with username updates
  useEffect(() => {
    setMessages(prev => {
      const updated = [...prev];
      updated[0] = { 
        id: "msg_1",
        sender: "ai", 
        text: `Hello, ${username}! I am Second Mind. I am observing your screen to provide cognitive assistance. How can I help you build?` 
      };
      return updated;
    });
  }, [username]);

  // Fetch SQLite / LocalStorage data
  const refreshData = async () => {
    const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        
        const dbGoals = await invoke<any[]>("get_goals");
        setGoals(dbGoals.map(g => ({
          id: g.id,
          title: g.title,
          progress: g.progress_percent,
          why: g.why_it_matters,
          type: g.goal_type,
          target_date: g.target_date,
        })));

        const dbHabits = await invoke<any[]>("get_habits");
        setHabits(dbHabits.map(h => ({
          id: h.id,
          title: h.name,
          completed: h.completed,
        })));
      } catch (err) {
        console.error("Tauri failed to load goals/habits:", err);
      }
    } else {
      // LocalStorage Fallback
      const storedGoals = localStorage.getItem("sm_goals");
      if (storedGoals) {
        setGoals(JSON.parse(storedGoals));
      } else {
        const initialGoals = [
          { id: "goal_1", title: "Build Authentication System", progress: 67, why: "Secures user cognitive graph and settings", type: "quarterly", target_date: "2026-06-30" },
          { id: "goal_2", title: "Complete NLP Model Integration", progress: 43, why: "Local Phi-3.5 cognitive modeling", type: "quarterly", target_date: "2026-06-30" },
          { id: "goal_3", title: "Master Spaced Repetition Engine", progress: 12, why: "Adaptive learning system core", type: "quarterly", target_date: "2026-06-30" },
        ];
        setGoals(initialGoals);
        localStorage.setItem("sm_goals", JSON.stringify(initialGoals));
      }

      const storedHabits = localStorage.getItem("sm_habits");
      if (storedHabits) {
        setHabits(JSON.parse(storedHabits));
      } else {
        const initialHabits = [
          { id: "habit_1", title: "Deep Work (2hr)", completed: true },
          { id: "habit_2", title: "Log active learnings", completed: false },
          { id: "habit_3", title: "Stretch & Hydrate", completed: true },
          { id: "habit_4", title: "Evening Reflection", completed: false },
        ];
        setHabits(initialHabits);
        localStorage.setItem("sm_habits", JSON.stringify(initialHabits));
      }
    }
  };

  // Setup Tauri event listeners
  useEffect(() => {
    let active = true;
    let unlisteners: (() => void)[] = [];

    const setupListeners = async () => {
      const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
      if (!isTauri) return;

      try {
        const { listen } = await import("@tauri-apps/api/event");

        const ulStatus = await listen<any>("chat-status", (event) => {
          const status = event.payload.status;
          if (status === "thinking") {
            setIsThinking(true);
            setIsStreaming(false);
          } else if (status === "streaming") {
            setIsThinking(false);
            setIsStreaming(true);
          } else if (status === "done") {
            setIsThinking(false);
            setIsStreaming(false);
            activeAiMessageIdRef.current = null;
          }
        });
        if (!active) {
          ulStatus();
        } else {
          unlisteners.push(ulStatus);
        }

        const ulToken = await listen<any>("chat-token", (event) => {
          const token = event.payload.token;
          const targetId = activeAiMessageIdRef.current;
          if (targetId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === targetId ? { ...m, text: m.text + token } : m
              )
            );
          }
        });
        if (!active) {
          ulToken();
        } else {
          unlisteners.push(ulToken);
        }

        const ulActiveWindow = await listen<any>("active-window", (event) => {
          const payload = event.payload;
          setActiveWindow((current) => {
            if (current.appName !== payload.app_name || current.title !== payload.title) {
              const now = new Date();
              const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              setContextLogs(prev => [
                { time: timeStr, description: `${current.appName}: ${current.title}` },
                ...prev.slice(0, 4)
              ]);
            }
            return { appName: payload.app_name, title: payload.title };
          });
        });
        if (!active) {
          ulActiveWindow();
        } else {
          unlisteners.push(ulActiveWindow);
        }
      } catch (err) {
        console.error("Failed to register Tauri event listeners:", err);
      }
    };

    setupListeners();
    refreshData();

    return () => {
      active = false;
      unlisteners.forEach((ul) => ul());
    };
  }, []);

  // Browser Sandbox fallback focus cycle simulation
  useEffect(() => {
    const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
    if (isTauri) return;

    const mockWindows = [
      { appName: "Google Chrome", title: "GitHub — mo-ri-ch/SecondMind" },
      { appName: "VS Code", title: "src/components/Tabs.tsx" },
      { appName: "Slack", title: "#general-announcements" },
      { appName: "Spotify", title: "Chill Lofi Beats for Coding" },
      { appName: "Terminal", title: "npm run dev" },
    ];
    let index = 0;

    const interval = setInterval(() => {
      const newWin = mockWindows[index];
      setActiveWindow((current) => {
        if (current.appName !== newWin.appName || current.title !== newWin.title) {
          const now = new Date();
          const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setContextLogs(prev => [
            { time: timeStr, description: `${current.appName}: ${current.title}` },
            ...prev.slice(0, 4)
          ]);
        }
        return { appName: newWin.appName, title: newWin.title };
      });
      index = (index + 1) % mockWindows.length;
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll when messages update or status changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isThinking, isStreaming]);

  // Stream simulation fallback
  const simulateBrowserStream = (prompt: string, aiMessageId: string) => {
    setIsThinking(true);
    setIsStreaming(false);

    setTimeout(() => {
      setIsThinking(false);
      setIsStreaming(true);

      const response = `I've received your request: "${prompt}". This response is simulated inside the browser sandbox using client-side timers! In a native environment, this streams from the Rust backend via Tauri event channels.`;
      const words = response.split(" ");
      let index = 0;

      const interval = setInterval(() => {
        if (index < words.length) {
          const nextWord = words[index] + " ";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMessageId ? { ...m, text: m.text + nextWord } : m
            )
          );
          index++;
        } else {
          clearInterval(interval);
          setIsStreaming(false);
          activeAiMessageIdRef.current = null;
        }
      }, 70);
    }, 600);
  };

  const handleSearchHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchAttempted(true);
    setSearchLoading(true);
    const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const rows = await invoke<HistorySearchResult[]>("search_history", { query: q, limit: 20 });
        setSearchResults(rows ?? []);
      } catch (err) {
        console.error("Failed to search history:", err);
        setSearchResults([]);
      }
    } else {
      // Browser sandbox: mock a small set so the UI is testable.
      const mock: HistorySearchResult[] = [
        {
          id: "mock_1",
          captured_at: new Date().toISOString(),
          app_name: "Google Chrome",
          window_title: "Searched mock result",
          category: "browsing",
          text: `Sample OCR content matching "${q}". In the Tauri build this returns real captures.`,
          snippet: `Sample OCR content matching [${q}]...`,
        },
      ];
      setSearchResults(mock);
    }
    setSearchLoading(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isThinking || isStreaming) return;

    const userMessage = { id: `user_${Date.now()}`, sender: "user", text: inputVal };
    const aiMessageId = `ai_${Date.now()}`;
    const aiMessage = { id: aiMessageId, sender: "ai", text: "" };

    setMessages((prev) => [...prev, userMessage, aiMessage]);
    activeAiMessageIdRef.current = aiMessageId;

    const currentVal = inputVal;
    setInputVal("");

    const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;

    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("start_chat_stream", { prompt: currentVal });
      } catch (err) {
        console.error("Failed to invoke start_chat_stream:", err);
        simulateBrowserStream(currentVal, aiMessageId);
      }
    } else {
      simulateBrowserStream(currentVal, aiMessageId);
    }
  };

  // Add / Delete Goals
  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;

    const goalId = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;

    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("create_goal", {
          id: goalId,
          title: newGoalTitle,
          why: newGoalWhy,
          goalType: newGoalType,
          targetDate: newGoalDate,
        });
        await refreshData();
      } catch (err) {
        console.error("Tauri failed to add goal:", err);
      }
    } else {
      const newGoal = {
        id: goalId,
        title: newGoalTitle,
        progress: 0,
        why: newGoalWhy,
        type: newGoalType,
        target_date: newGoalDate,
      };
      const updatedGoals = [...goals, newGoal];
      setGoals(updatedGoals);
      localStorage.setItem("sm_goals", JSON.stringify(updatedGoals));
    }

    setNewGoalTitle("");
    setNewGoalWhy("");
    setNewGoalType("quarterly");
    setNewGoalDate("");
    setShowAddGoal(false);
  };

  const handleDeleteGoal = async (id: string) => {
    const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("delete_goal", { id });
        await refreshData();
      } catch (err) {
        console.error("Tauri failed to delete goal:", err);
      }
    } else {
      const updatedGoals = goals.filter(g => g.id !== id);
      setGoals(updatedGoals);
      localStorage.setItem("sm_goals", JSON.stringify(updatedGoals));
    }
  };

  // Add / Delete Habits
  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    const habitId = `habit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;

    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("create_habit", {
          id: habitId,
          name: newHabitName,
        });
        await refreshData();
      } catch (err) {
        console.error("Tauri failed to add habit:", err);
      }
    } else {
      const newHabit = {
        id: habitId,
        title: newHabitName,
        completed: false,
      };
      const updatedHabits = [...habits, newHabit];
      setHabits(updatedHabits);
      localStorage.setItem("sm_habits", JSON.stringify(updatedHabits));
    }

    setNewHabitName("");
  };

  const handleDeleteHabit = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;

    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("delete_habit", { id });
        await refreshData();
      } catch (err) {
        console.error("Tauri failed to delete habit:", err);
      }
    } else {
      const updatedHabits = habits.filter(h => h.id !== id);
      setHabits(updatedHabits);
      localStorage.setItem("sm_habits", JSON.stringify(updatedHabits));
    }
  };

  const triggerCelebration = (e: React.MouseEvent) => {
    const habitsContainer = document.getElementById("habits-tab-container");
    const containerRect = habitsContainer?.getBoundingClientRect();
    
    const originX = e.clientX - (containerRect?.left || 0);
    const originY = e.clientY - (containerRect?.top || 0);

    const colors = ["#8b5cf6", "#a78bfa", "#06b6d4", "#22d3ee", "#10b981", "#34d399", "#f59e0b", "#fbbf24"];
    const newParticles: CelebrationParticle[] = [];

    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 25 + Math.random() * 45;
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance - 8;
      const color = colors[Math.floor(Math.random() * colors.length)];

      newParticles.push({
        id: Date.now() + i + Math.random(),
        startX: originX,
        startY: originY,
        offsetX,
        offsetY,
        color,
      });
    }

    setParticles(prev => [...prev, ...newParticles]);

    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 800);
  };

  const toggleHabit = async (id: string, e: React.MouseEvent) => {
    const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
    
    const habit = habits.find(h => h.id === id);
    const checkingCompleted = habit && !habit.completed;
    if (checkingCompleted) {
      triggerCelebration(e);
    }

    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("toggle_habit_completion", { habitId: id });
        await refreshData();
      } catch (err) {
        console.error("Tauri failed to toggle habit:", err);
      }
    } else {
      const updatedHabits = habits.map(h => h.id === id ? { ...h, completed: !h.completed } : h);
      setHabits(updatedHabits);
      localStorage.setItem("sm_habits", JSON.stringify(updatedHabits));
    }
  };

  return (
    <div className="flex flex-col h-[480px]">
      {/* Scrollable Content Pane */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === "chat" && (
          <div className="space-y-4 flex flex-col justify-end min-h-full">
            {/* Phase 7 search results panel */}
            {searchMode && searchAttempted && (
              <div className="glass-card rounded-xl border border-violet-500/15 p-3 space-y-2 max-h-56 overflow-y-auto">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
                  <span>History Matches</span>
                  <span>{searchResults.length} result{searchResults.length === 1 ? "" : "s"}</span>
                </div>
                {searchLoading && (
                  <div className="text-[11px] text-slate-400 italic">Searching captures...</div>
                )}
                {!searchLoading && searchResults.length === 0 && (
                  <div className="text-[11px] text-slate-500 italic">
                    No captures matched. Enable Screen Log in Settings to start indexing what you read.
                  </div>
                )}
                {!searchLoading && searchResults.map(r => (
                  <div key={r.id} className="rounded-lg bg-slate-950/40 border border-white/5 px-3 py-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-violet-300 font-medium truncate">{r.app_name || "Unknown"}</span>
                      <span className="text-slate-500 flex items-center gap-1"><Clock size={9} />{r.captured_at}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate" title={r.window_title}>{r.window_title}</div>
                    <p
                      className="text-[11px] text-slate-300 leading-snug whitespace-pre-wrap break-words line-clamp-3"
                      dangerouslySetInnerHTML={{
                        __html: r.snippet
                          .replace(/&/g, "&amp;")
                          .replace(/</g, "&lt;")
                          .replace(/>/g, "&gt;")
                          .replace(/\[/g, "<mark class=\"bg-violet-500/30 text-violet-100 rounded px-0.5\">")
                          .replace(/\]/g, "</mark>"),
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {messages.map((m) => {
                const isStreamingThis = isStreaming && activeAiMessageIdRef.current === m.id;
                const showCursor = isStreamingThis && !m.text;

                if (m.sender === "ai" && !m.text && !isStreamingThis) return null;

                return (
                  <div 
                    key={m.id} 
                    className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed glass-card ${
                      m.sender === "user" 
                        ? "bg-violet-600/20 border-violet-500/20 text-violet-100" 
                        : "bg-slate-800/40 border-slate-700/30 text-slate-100"
                    }`}>
                      {showCursor ? (
                        <span className="w-1.5 h-3.5 bg-violet-400 inline-block animate-pulse rounded-sm"></span>
                      ) : (
                        m.text.split("\n").map((line, lIdx) => (
                          <p key={lIdx} className={line.startsWith("```") ? "font-mono bg-slate-950/40 p-2 rounded-lg text-xs overflow-x-auto my-1" : ""}>
                            {line}
                          </p>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}

              {isThinking && (
                <div className="flex justify-start">
                  <div className="bg-slate-800/40 border border-slate-700/30 text-slate-400 rounded-2xl px-4 py-2.5 text-xs flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    <span className="text-[10px] pl-1 font-sans text-slate-400">Second Mind is reflecting...</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Input bar (chat or search) */}
            {searchMode ? (
              <form onSubmit={handleSearchHistory} className="relative mt-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-300/70 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search my history..."
                  autoFocus
                  className="w-full bg-slate-950/40 border border-violet-500/30 rounded-xl py-3 pl-9 pr-20 text-sm focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 text-white placeholder-violet-300/40 transition-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchMode(false);
                    setSearchQuery("");
                    setSearchResults([]);
                    setSearchAttempted(false);
                  }}
                  className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-[10px] cursor-pointer bg-transparent border-none px-1"
                  title="Back to chat"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-violet-400 hover:text-violet-300 active:scale-95 transition-all cursor-pointer bg-transparent border-none"
                  title="Search"
                >
                  <Search size={18} />
                </button>
              </form>
            ) : (
              <form onSubmit={handleSend} className="relative mt-2">
                <input
                  type="text"
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  placeholder="Ask Second Mind..."
                  className="w-full bg-slate-950/40 border border-white/5 rounded-xl py-3 pl-4 pr-20 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 text-white placeholder-slate-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setSearchMode(true)}
                  className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-300 active:scale-95 transition-all cursor-pointer bg-transparent border-none"
                  title="Search my history"
                >
                  <Search size={16} />
                </button>
                <button
                  type="submit"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-violet-400 hover:text-violet-300 active:scale-95 transition-all cursor-pointer bg-transparent border-none"
                >
                  <Send size={18} />
                </button>
              </form>
            )}
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
              <div className="font-mono text-sm text-violet-300">{activeWindow.appName}: {activeWindow.title}</div>
              <div className="text-xs text-slate-300 leading-relaxed">
                You are currently editing React UI components. Focus index is high. Cognitive load estimated at <span className="text-cyan-400">Low</span>.
              </div>
            </div>

            <div className="glass-card rounded-xl p-4 border border-white/5 space-y-3">
              <div className="text-xs text-slate-400">Recent Context Log</div>
              <div className="space-y-2.5 font-mono text-xs">
                {contextLogs.map((log, lIdx) => (
                  <div key={lIdx} className="flex justify-between text-slate-400">
                    <span>{log.time}</span>
                    <span className="text-slate-300 truncate max-w-[75%]" title={log.description}>{log.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "goals" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Quarterly Goals</h3>
              <button 
                onClick={() => setShowAddGoal(!showAddGoal)}
                className="text-[10px] text-violet-400 hover:underline cursor-pointer focus:outline-none bg-transparent border-none"
              >
                {showAddGoal ? "Cancel" : "+ Quick Add"}
              </button>
            </div>

            {/* Quick Add Goal Form */}
            {showAddGoal && (
              <form onSubmit={handleAddGoal} className="glass-card rounded-xl p-4 border border-white/10 space-y-3 animate-glow-pulse">
                <div className="text-xs font-semibold text-slate-200">New Goal Details</div>
                <div className="space-y-2 text-xs">
                  <input 
                    type="text" 
                    placeholder="Goal Title..."
                    value={newGoalTitle}
                    onChange={e => setNewGoalTitle(e.target.value)}
                    className="w-full bg-slate-950/50 border border-white/5 rounded-lg py-1.5 px-2.5 focus:outline-none focus:border-violet-500/50 text-white"
                    required
                  />
                  <input 
                    type="text" 
                    placeholder="Why this matters..."
                    value={newGoalWhy}
                    onChange={e => setNewGoalWhy(e.target.value)}
                    className="w-full bg-slate-950/50 border border-white/5 rounded-lg py-1.5 px-2.5 focus:outline-none focus:border-violet-500/50 text-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select 
                      value={newGoalType}
                      onChange={e => setNewGoalType(e.target.value)}
                      className="w-full bg-slate-950/50 border border-white/5 rounded-lg py-1.5 px-2 focus:outline-none focus:border-violet-500/50 text-white"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annual">Annual</option>
                    </select>
                    <input 
                      type="date"
                      value={newGoalDate}
                      onChange={e => setNewGoalDate(e.target.value)}
                      className="w-full bg-slate-950/50 border border-white/5 rounded-lg py-1 px-2 focus:outline-none focus:border-violet-500/50 text-white text-[10px]"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-medium text-xs py-1.5 rounded-lg transition-all cursor-pointer border-none"
                >
                  Add Goal
                </button>
              </form>
            )}
            
            <div className="space-y-3">
              {goals.map(g => (
                <div key={g.id} className="relative group glass-card rounded-xl p-4 border border-white/5 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="font-medium text-sm text-slate-200 pr-6">{g.title}</div>
                    <span className="text-xs text-violet-400 font-bold shrink-0">{g.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-800/40 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${g.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span className="italic">“{g.why}”</span>
                    {g.target_date && <span>Due: {g.target_date}</span>}
                  </div>
                  
                  {/* Delete Button */}
                  <button 
                    onClick={() => handleDeleteGoal(g.id)}
                    className="absolute top-2 right-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 cursor-pointer bg-transparent border-none"
                    title="Delete Goal"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "habits" && (
          <div id="habits-tab-container" className="relative space-y-4 min-h-full">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Daily Routines</h3>
            
            {/* Quick Add Habit Form */}
            <form onSubmit={handleAddHabit} className="flex space-x-2">
              <input 
                type="text" 
                placeholder="Add routine habit..."
                value={newHabitName}
                onChange={e => setNewHabitName(e.target.value)}
                className="flex-1 bg-slate-950/40 border border-white/5 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-violet-500/50 text-white placeholder-slate-500"
              />
              <button 
                type="submit"
                className="bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-bold text-xs px-4 rounded-xl shadow-md transition-all cursor-pointer border-none"
              >
                +
              </button>
            </form>

            <div className="space-y-2">
              {habits.map(h => (
                <div 
                  key={h.id} 
                  onClick={(e) => toggleHabit(h.id, e)}
                  className="group flex items-center justify-between p-3.5 glass-card rounded-xl border border-white/5 cursor-pointer hover:bg-white/[0.02] active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center space-x-3">
                    {h.completed ? (
                      <CheckCircle2 size={18} className="text-violet-400 shrink-0" />
                    ) : (
                      <Circle size={18} className="text-slate-500 hover:text-violet-400/70 shrink-0" />
                    )}
                    <span className={`text-sm select-none ${h.completed ? "line-through text-slate-500" : "text-slate-200"}`}>
                      {h.title}
                    </span>
                  </div>

                  {/* Delete Habit Button */}
                  <button 
                    onClick={(e) => handleDeleteHabit(h.id, e)}
                    className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 cursor-pointer bg-transparent border-none"
                    title="Delete Habit"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Celebration Particles Emitter */}
            {particles.map(p => (
              <span
                key={p.id}
                className="absolute animate-particle rounded-full pointer-events-none z-50"
                style={{
                  "--tw-particle-x": `${p.offsetX}px`,
                  "--tw-particle-y": `${p.offsetY}px`,
                  backgroundColor: p.color,
                  width: `${3 + Math.random() * 3}px`,
                  height: `${3 + Math.random() * 3}px`,
                  left: `${p.startX}px`,
                  top: `${p.startY}px`,
                  transform: "translate(-50%, -50%)",
                } as React.CSSProperties}
              />
            ))}
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
              className={`flex-1 flex flex-col items-center py-1.5 rounded-lg transition-all cursor-pointer border-none bg-transparent ${
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
