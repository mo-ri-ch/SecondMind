# Second Mind

A local-first **Personal Cognitive Operating System (PCOS)**: a glassmorphic floating widget that observes your active window, OCRs what you're reading, and helps you focus, learn, reflect, and follow through on commitments — all on-device.

Built with **Tauri 2** (Rust) + **React 19** + **TypeScript** + **Tailwind**, backed by **SQLite** with **FTS5** for memory search.

> Status: all 14 phases of [`phased_execution_plan.md`](phased_execution_plan.md) are implemented and the frontend bundles clean. The Rust side is written against `windows` 0.58 and `xcap` 0.0.14 but needs a local `cargo check` to validate the OCR API surface.

---

## What it does

| Surface | Lives in | Capability |
|---|---|---|
| Floating widget (minimal) | Always-on-top, transparent | Avatar with cognitive-state colour (focused / fatigued / chatty) |
| Floating widget (expanded) | `Ctrl+Shift+M` toggle | 5 tabs: Chat, Context, Goals, Habits, Learn |
| Chat tab | Inside widget | Streaming responses, history search (FTS5), push-to-talk mic, TTS replies |
| Context tab | Inside widget | Live active-window readout + last 5 transitions |
| Goals / Habits tabs | Inside widget | CRUD with progress bars and habit-check celebration particles |
| Learn tab | Inside widget | "Explain what I'm looking at" → flashcards seeded from latest screen capture |
| Pulse alerts | Top-center toast stack | Proactive nudges when fatigue / chaotic switching detected |
| Settings dashboard | Gear icon | Profile, proactivity, People directory, Screen Log, Privacy & export |
| Reflection panel | Book-open icon | Today's focus-minutes chart + Wins / Drag / Tomorrow journal |
| Knowledge map | Network icon | Force-directed SVG graph of goals / habits / people / commitments |

---

## Architecture map

```
src/                     React UI (Vite + Tailwind)
  App.tsx                Settings modal, pulse-alert toast stack, privacy panel
  components/
    FloatingWidget.tsx   Glass card host + Reflection / Knowledge / Settings buttons
    Avatar.tsx           7 visual states inc. focused/fatigued/chatty (Phase 8)
    Tabs.tsx             Chat (incl. mic + search), Context, Goals, Habits, Learn
    PeoplePanel.tsx      Contacts + per-card commitments + cadence status
    ReflectionPanel.tsx  Daily summary chart + journal
    KnowledgeGraphPanel.tsx
                         Pure-SVG force-directed layout (240 iters on load)

src-tauri/src/           Rust backend (Tauri 2)
  lib.rs                 All Tauri commands + DB schema + capture loop +
                         active-window monitor + cognition driver
  ocr.rs                 Windows.Media.Ocr pipeline (xcap → PNG →
                         BitmapDecoder → SoftwareBitmap → OcrEngine)
  cognition.rs           Rolling activity buffer → focused/fatigued/chatty +
                         rate-limited pulse alerts
```

### SQLite tables

`users`, `user_preferences`, `goals`, `habits`, `habit_completions`,
`screen_captures` (+ `screen_captures_fts` FTS5 mirror with sync triggers),
`learn_topics`, `contacts`, `commitments`, `daily_reflections`.

### Tauri events emitted from Rust

| Event | Payload | Fired by |
|---|---|---|
| `active-window` | `{ app_name, title }` | 5s active-window loop |
| `cognitive-state` | `{ state, message, sustained_seconds, recent_switches }` | Same loop, via `CognitionEngine::observe` |
| `pulse-alert` | `{ kind, title, body, severity }` | Cognition engine on state transition, rate-limited |
| `chat-status` | `{ status: "thinking" \| "streaming" \| "done" }` | `start_chat_stream` |
| `chat-token` | `{ token }` | `start_chat_stream` per word |
| `screen-capture` | capture id | Capture+OCR thread on insert |

---

## Running it

### Frontend only (browser sandbox)

Every panel has a browser-mode demo path — useful for UI tweaks without the Tauri runtime.

```bash
pnpm install
pnpm dev
```

Pulse-alert toast, cognitive-state avatar cycle, mocked teacher response, mocked knowledge graph, and mocked daily summary all render in the browser. Real OCR + screen capture + persistence require Tauri.

### Full Tauri app

```bash
pnpm install
pnpm tauri dev
```

Requirements: Rust toolchain, MSVC build tools on Windows (for `link.exe`). On first run the app:
1. Creates `<AppData>/com.tauri.dev/second_mind.db` and seeds a default user, three goals, four habits, two preferences.
2. Registers `Ctrl+Shift+M` to toggle widget visibility.
3. Starts the 5s active-window loop. **Screen capture is OFF by default** — enable it in Settings → Screen Log.

---

## Design choices and swap-points

A few things ship with simpler implementations than the original plan called for, with explicit swap-points so the upgrades drop in without changing call sites.

| Plan called for | Ships as | Where to swap |
|---|---|---|
| Qdrant + fastembed-rs (nomic-embed-text) | SQLite FTS5 (bundled, zero new native deps) | `search_history` in [lib.rs](src-tauri/src/lib.rs); response shape stable |
| Whisper STT + Kokoro-82M TTS | Browser MediaRecorder + SpeechSynthesis | `startVoice` / `stopVoice` and the speak-effect in [Tabs.tsx](src/components/Tabs.tsx) |
| SurrealDB embedded + react-force-graph | Inline SVG force layout (240 iter spring + repulsion) | `KnowledgeGraphPanel.tsx`; backend command shape unchanged |
| SQLCipher encryption | Plain SQLite + Privacy panel (purge, clear-all, JSON export) | `setup` block in [lib.rs](src-tauri/src/lib.rs); UI copy in `App.tsx` already notes "future build" |
| LLM-backed teacher | Deterministic longest-sentence picker | `teacher_explain` in [lib.rs](src-tauri/src/lib.rs); returns the same `DbLearnTopic` shape |

---

## Verification scenarios (per plan)

Each phase has a one-line "open it and try this" check baked into the plan:

- **Phase 5** — Add a goal, check off a habit, close + reopen. State persists.
- **Phase 6** — Enable Screen Log in Settings, open a dense document, wait 20s. OCR text appears in the log.
- **Phase 7** — Open a unique page, wait, then in the Chat tab tap the search icon and search for a keyword from the page. Snippets appear.
- **Phase 8** — Rapidly alt-tab between apps for ~2 minutes. Avatar turns amber and a pulse-alert toast appears at the top of the screen.
- **Phase 9** — Open a code file, tap Learn → Explain what I'm looking at. Flashcards render with the OCR'd content as context.
- **Phase 11** — Tap the Book icon. Today's focus-minutes-by-category chart renders.
- **Phase 13** — Add a contact, give them a commitment that mentions a goal title word. Open the Knowledge map. Person, goal, and a `supports` edge appear.
- **Phase 14** — Settings → Privacy. Export downloads a JSON dump; Clear all data wipes per-user tables and keeps the user row.

---

## What's not done yet

- True semantic embeddings (currently FTS5).
- Real LLM hookup for chat replies and the Teacher (currently mocked stream / deterministic synthesis).
- Whisper / Kokoro voice (currently MediaRecorder + SpeechSynthesis).
- SQLCipher database encryption (controls UI is in; binding swap is the work).
- macOS / Linux OCR (Windows-only — the `ocr` module returns an error on non-Windows builds).

Each of these is a contained replacement at the call site, not a re-architecture.
