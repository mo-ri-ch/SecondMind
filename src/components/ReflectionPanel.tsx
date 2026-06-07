import React, { useEffect, useState } from "react";
import { X, BookOpen, Sparkles as SparkleIcon } from "lucide-react";

interface DailySummary {
  date: string;
  focus_minutes_per_category: Array<[string, number]>;
  total_captures: number;
  habits_completed: number;
  habits_total: number;
  narrative: string;
  reflection: {
    date: string;
    journal_wins: string | null;
    journal_drag: string | null;
    journal_tomorrow: string | null;
    narrative: string | null;
  } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const isTauri = () => typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;

export const ReflectionPanel: React.FC<Props> = ({ open, onClose }) => {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [wins, setWins] = useState("");
  const [drag, setDrag] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      if (isTauri()) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const s = await invoke<DailySummary>("get_daily_summary", { date: null });
          setSummary(s);
          if (s.reflection) {
            setWins(s.reflection.journal_wins ?? "");
            setDrag(s.reflection.journal_drag ?? "");
            setTomorrow(s.reflection.journal_tomorrow ?? "");
          }
        } catch (err) {
          console.error("get_daily_summary:", err);
        }
      } else {
        setSummary({
          date: new Date().toISOString().slice(0, 10),
          focus_minutes_per_category: [["coding", 42], ["browsing", 18], ["chatting", 9]],
          total_captures: 405,
          habits_completed: 2,
          habits_total: 4,
          narrative: "Sandbox demo: today's chart is mocked. Enable Screen Log in Tauri for real data.",
          reflection: null,
        });
      }
    })();
  }, [open]);

  const handleSave = async () => {
    if (!summary) return;
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("save_daily_reflection", {
          date: summary.date,
          journalWins: wins || null,
          journalDrag: drag || null,
          journalTomorrow: tomorrow || null,
          narrative: summary.narrative,
        });
      } catch (err) {
        console.error("save_daily_reflection:", err);
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!open) return null;
  const maxMinutes = summary ? Math.max(1, ...summary.focus_minutes_per_category.map(([_, m]) => m)) : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md transition-all">
      <div className="w-full max-w-lg overflow-hidden border border-white/[0.08] rounded-2xl glass-panel shadow-2xl">
        <div className="flex justify-between items-center px-6 py-4 bg-slate-950/40 border-b border-white/[0.06]">
          <div className="flex items-center space-x-2">
            <BookOpen className="text-violet-400" size={16} />
            <h2 className="font-semibold text-sm text-white">Daily Reflection</h2>
            {summary && <span className="text-[10px] text-slate-400">{summary.date}</span>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded cursor-pointer bg-transparent border-none">
            <X size={15} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {summary && (
            <>
              <div className="glass-card rounded-xl p-4 border border-white/5 space-y-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Focus minutes by category</div>
                {summary.focus_minutes_per_category.length === 0 && (
                  <div className="text-[11px] text-slate-500 italic">No captures recorded today. Enable Screen Log to start tracking focus.</div>
                )}
                <div className="space-y-1.5">
                  {summary.focus_minutes_per_category.map(([cat, mins]) => (
                    <div key={cat}>
                      <div className="flex justify-between text-[10px] text-slate-300">
                        <span className="capitalize">{cat}</span>
                        <span>{mins}m</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800/40 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                          style={{ width: `${Math.min(100, (mins / maxMinutes) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                  <div className="text-center">
                    <div className="text-xs text-violet-300 font-bold">{summary.habits_completed}/{summary.habits_total}</div>
                    <div className="text-[10px] text-slate-400">habits done</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-violet-300 font-bold">{summary.total_captures}</div>
                    <div className="text-[10px] text-slate-400">screen samples</div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-300 italic flex items-start gap-2 pt-2 border-t border-white/5">
                  <SparkleIcon size={12} className="text-violet-300 shrink-0 mt-0.5" />
                  <span>{summary.narrative}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-wider text-slate-400">Wins</label>
                <textarea
                  rows={2}
                  value={wins}
                  onChange={e => setWins(e.target.value)}
                  placeholder="What landed today?"
                  className="w-full bg-slate-950/40 border border-white/5 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-violet-500/50 text-white placeholder-slate-500 resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-wider text-slate-400">Drag</label>
                <textarea
                  rows={2}
                  value={drag}
                  onChange={e => setDrag(e.target.value)}
                  placeholder="What slowed you down?"
                  className="w-full bg-slate-950/40 border border-white/5 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-violet-500/50 text-white placeholder-slate-500 resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-wider text-slate-400">One thing for tomorrow</label>
                <textarea
                  rows={2}
                  value={tomorrow}
                  onChange={e => setTomorrow(e.target.value)}
                  placeholder="Tomorrow's one move..."
                  className="w-full bg-slate-950/40 border border-white/5 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-violet-500/50 text-white placeholder-slate-500 resize-none"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-between items-center px-6 py-4 bg-slate-950/20 border-t border-white/[0.06]">
          <span className="text-[10px] text-slate-400">{saved ? "Saved." : ""}</span>
          <button
            onClick={handleSave}
            className="bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-medium text-xs px-5 py-2 rounded-xl shadow-[0_4px_12px_rgba(139,92,246,0.3)] transition-all cursor-pointer border-none"
          >
            Save reflection
          </button>
        </div>
      </div>
    </div>
  );
};
