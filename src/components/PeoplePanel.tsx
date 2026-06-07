import React, { useEffect, useState } from "react";
import { Users, Plus, Trash2, CheckCircle2, Calendar } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  relationship: string;
  cadence_days: number;
  last_interaction_at: string | null;
  notes: string | null;
  created_at: string;
}

interface Commitment {
  id: string;
  contact_id: string;
  description: string;
  due_date: string | null;
  status: string;
  created_at: string;
}

const isTauri = () => typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;

export const PeoplePanel: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRelationship, setNewRelationship] = useState("friend");
  const [newCadence, setNewCadence] = useState(14);
  const [newNotes, setNewNotes] = useState("");
  const [commitmentDraft, setCommitmentDraft] = useState<Record<string, string>>({});

  const refresh = async () => {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        setContacts(await invoke<Contact[]>("get_contacts"));
        setCommitments(await invoke<Commitment[]>("get_commitments"));
      } catch (err) {
        console.error("PeoplePanel load:", err);
      }
    } else {
      // Browser demo seed
      if (contacts.length === 0) {
        setContacts([
          { id: "demo_1", name: "Sarah Chen", relationship: "colleague", cadence_days: 7, last_interaction_at: null, notes: "Design system lead", created_at: new Date().toISOString() },
          { id: "demo_2", name: "Marco", relationship: "friend", cadence_days: 14, last_interaction_at: null, notes: null, created_at: new Date().toISOString() },
        ]);
      }
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const id = `contact_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("create_contact", {
          id,
          name: newName,
          relationship: newRelationship,
          cadenceDays: newCadence,
          notes: newNotes || null,
        });
        await refresh();
      } catch (err) {
        console.error("create_contact:", err);
      }
    } else {
      setContacts(prev => [...prev, {
        id, name: newName, relationship: newRelationship, cadence_days: newCadence,
        last_interaction_at: null, notes: newNotes || null, created_at: new Date().toISOString(),
      }]);
    }
    setNewName(""); setNewRelationship("friend"); setNewCadence(14); setNewNotes(""); setAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("delete_contact", { id });
        await refresh();
      } catch (err) { console.error(err); }
    } else {
      setContacts(prev => prev.filter(c => c.id !== id));
      setCommitments(prev => prev.filter(co => co.contact_id !== id));
    }
  };

  const handleTouch = async (id: string) => {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("touch_contact", { id });
        await refresh();
      } catch (err) { console.error(err); }
    } else {
      setContacts(prev => prev.map(c => c.id === id ? { ...c, last_interaction_at: new Date().toISOString() } : c));
    }
  };

  const handleAddCommitment = async (contactId: string) => {
    const draft = commitmentDraft[contactId]?.trim();
    if (!draft) return;
    const id = `commit_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("create_commitment", {
          id, contactId, description: draft, dueDate: null,
        });
        await refresh();
      } catch (err) { console.error(err); }
    } else {
      setCommitments(prev => [...prev, {
        id, contact_id: contactId, description: draft, due_date: null, status: "open", created_at: new Date().toISOString(),
      }]);
    }
    setCommitmentDraft(prev => ({ ...prev, [contactId]: "" }));
  };

  const handleResolve = async (id: string) => {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("resolve_commitment", { id });
        await refresh();
      } catch (err) { console.error(err); }
    } else {
      setCommitments(prev => prev.map(c => c.id === id ? { ...c, status: "resolved" } : c));
    }
  };

  const cadenceStatus = (c: Contact): { label: string; tone: string } => {
    if (!c.last_interaction_at) return { label: "Never logged", tone: "text-slate-500" };
    const last = new Date(c.last_interaction_at).getTime();
    const days = (Date.now() - last) / 86400000;
    if (days > c.cadence_days) return { label: `Overdue (${Math.floor(days)}d)`, tone: "text-amber-300" };
    return { label: `${Math.floor(days)}d / ${c.cadence_days}d`, tone: "text-emerald-300" };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Users size={13} /> People & Commitments
        </label>
        <button
          onClick={() => setAdding(s => !s)}
          className="text-[10px] text-violet-400 hover:underline cursor-pointer bg-transparent border-none"
        >
          {adding ? "Cancel" : "+ Add contact"}
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="glass-card rounded-xl p-3 border border-white/10 space-y-2">
          <input type="text" required placeholder="Contact name..." value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-slate-950/50 border border-white/5 rounded-lg py-1.5 px-2.5 text-xs focus:outline-none focus:border-violet-500/50 text-white" />
          <div className="grid grid-cols-2 gap-2">
            <select value={newRelationship} onChange={e => setNewRelationship(e.target.value)} className="bg-slate-950/50 border border-white/5 rounded-lg py-1.5 px-2 text-xs focus:outline-none focus:border-violet-500/50 text-white">
              <option value="friend">Friend</option>
              <option value="colleague">Colleague</option>
              <option value="family">Family</option>
              <option value="mentor">Mentor</option>
              <option value="acquaintance">Acquaintance</option>
            </select>
            <input type="number" min={1} value={newCadence} onChange={e => setNewCadence(parseInt(e.target.value) || 14)} placeholder="Cadence (days)" className="bg-slate-950/50 border border-white/5 rounded-lg py-1.5 px-2 text-xs focus:outline-none focus:border-violet-500/50 text-white" />
          </div>
          <input type="text" placeholder="Notes (optional)..." value={newNotes} onChange={e => setNewNotes(e.target.value)} className="w-full bg-slate-950/50 border border-white/5 rounded-lg py-1.5 px-2.5 text-xs focus:outline-none focus:border-violet-500/50 text-white" />
          <button type="submit" className="w-full bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-medium text-xs py-1.5 rounded-lg transition-all cursor-pointer border-none">Save contact</button>
        </form>
      )}

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {contacts.length === 0 && (
          <p className="text-[11px] text-slate-500 italic text-center py-4">No contacts yet. Add one above.</p>
        )}
        {contacts.map(c => {
          const status = cadenceStatus(c);
          const own = commitments.filter(co => co.contact_id === c.id);
          return (
            <div key={c.id} className="glass-card rounded-xl border border-white/5 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm text-slate-100 font-medium truncate">{c.name}</div>
                  <div className="text-[10px] text-slate-400 capitalize">{c.relationship}</div>
                </div>
                <span className={`text-[10px] flex items-center gap-1 ${status.tone}`}>
                  <Calendar size={10} />{status.label}
                </span>
              </div>
              {c.notes && <div className="text-[10px] text-slate-400 italic truncate">{c.notes}</div>}
              <div className="space-y-1">
                {own.map(co => (
                  <div key={co.id} className={`flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-950/40 border border-white/5 ${co.status === "resolved" ? "opacity-50" : ""}`}>
                    <span className={`text-[11px] ${co.status === "resolved" ? "line-through text-slate-500" : "text-slate-300"} truncate`}>{co.description}</span>
                    {co.status !== "resolved" && (
                      <button onClick={() => handleResolve(co.id)} className="text-emerald-300 hover:text-emerald-200 cursor-pointer bg-transparent border-none p-0" title="Mark resolved">
                        <CheckCircle2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="Add commitment..."
                    value={commitmentDraft[c.id] ?? ""}
                    onChange={e => setCommitmentDraft(prev => ({ ...prev, [c.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddCommitment(c.id); } }}
                    className="flex-1 bg-slate-950/50 border border-white/5 rounded-md py-1 px-2 text-[10px] focus:outline-none focus:border-violet-500/50 text-white placeholder-slate-500"
                  />
                  <button onClick={() => handleAddCommitment(c.id)} className="bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 text-[10px] px-2 rounded-md cursor-pointer border-none transition-all" title="Add commitment">
                    <Plus size={11} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                <button onClick={() => handleTouch(c.id)} className="text-[10px] text-violet-300 hover:text-violet-200 cursor-pointer bg-transparent border-none">
                  Log interaction
                </button>
                <button onClick={() => handleDelete(c.id)} className="text-[10px] text-rose-300 hover:text-rose-200 cursor-pointer bg-transparent border-none flex items-center gap-1">
                  <Trash2 size={10} /> Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
