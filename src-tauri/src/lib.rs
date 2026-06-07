mod ocr;
mod cognition;

use tauri::Manager;
use tauri::Emitter;
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState, GlobalShortcutExt};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::str::FromStr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct DbState {
    pub pool: sqlx::SqlitePool,
}

pub struct CaptureState {
    pub enabled: Arc<AtomicBool>,
}

#[derive(serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: String,
    pub name: String,
    pub timezone: String,
    pub language: String,
}

#[derive(serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Preference {
    pub category: String,
    pub key: String,
    pub value: String,
}

#[derive(serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct DbGoal {
    pub id: String,
    pub title: String,
    pub why_it_matters: String,
    pub goal_type: String,
    pub progress_percent: i32,
    pub target_date: String,
    pub status: String,
}

#[derive(serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct DbHabit {
    pub id: String,
    pub name: String,
    pub completed: bool,
}

#[derive(serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct DbScreenCapture {
    pub id: String,
    pub captured_at: String,
    pub app_name: String,
    pub window_title: String,
    pub category: String,
    pub text: String,
    pub confidence: f64,
}

#[derive(serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct SearchResult {
    pub id: String,
    pub captured_at: String,
    pub app_name: String,
    pub window_title: String,
    pub category: String,
    pub text: String,
    pub snippet: String,
}

#[derive(Clone, serde::Serialize)]
struct ChatStatusPayload {
    status: String,
}

#[derive(Clone, serde::Serialize)]
struct ChatTokenPayload {
    token: String,
}

#[derive(Clone, serde::Serialize)]
struct ActiveWindowPayload {
    app_name: String,
    title: String,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_user_profile(state: tauri::State<'_, DbState>) -> Result<User, String> {
    let user = sqlx::query_as::<_, User>("SELECT id, name, timezone, language FROM users LIMIT 1")
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    match user {
        Some(u) => Ok(u),
        None => Err("No user profile found".to_string()),
    }
}

#[tauri::command]
async fn update_user_profile(
    name: String,
    timezone: String,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    sqlx::query("UPDATE users SET name = ?, timezone = ?, updated_at = CURRENT_TIMESTAMP")
        .bind(name)
        .bind(timezone)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_user_preferences(state: tauri::State<'_, DbState>) -> Result<Vec<Preference>, String> {
    let prefs = sqlx::query_as::<_, Preference>(
        "SELECT category, key, value FROM user_preferences"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(prefs)
}

#[tauri::command]
async fn update_user_preference(
    category: String,
    key: String,
    value: String,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let user = sqlx::query_as::<_, User>("SELECT id, name, timezone, language FROM users LIMIT 1")
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let user_id = match user {
        Some(u) => u.id,
        None => return Err("No user profile found to associate preference".to_string()),
    };

    sqlx::query(
        "INSERT INTO user_preferences (user_id, category, key, value, updated_at) 
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id, category, key) DO UPDATE SET 
            value = excluded.value, 
            updated_at = CURRENT_TIMESTAMP"
    )
    .bind(user_id)
    .bind(category)
    .bind(key)
    .bind(value)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn start_chat_stream(
    app: tauri::AppHandle,
    prompt: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn(async move {
        let _ = app.emit("chat-status", ChatStatusPayload { status: "thinking".to_string() });
        tokio::time::sleep(std::time::Duration::from_millis(600)).await;

        let _ = app.emit("chat-status", ChatStatusPayload { status: "streaming".to_string() });

        let response = format!(
            "I've received your request: \"{}\". This response is streamed directly from the Rust backend via Tauri IPC events! In Phase 7, I will match this query with historical context from vector search, and in Phase 12 I will speak it out loud.",
            prompt
        );

        for word in response.split_whitespace() {
            tokio::time::sleep(std::time::Duration::from_millis(70)).await;
            let _ = app.emit("chat-token", ChatTokenPayload { token: format!("{} ", word) });
        }

        let _ = app.emit("chat-status", ChatStatusPayload { status: "done".to_string() });
    });
    Ok(())
}

#[tauri::command]
async fn get_goals(state: tauri::State<'_, DbState>) -> Result<Vec<DbGoal>, String> {
    let goals = sqlx::query_as::<_, DbGoal>(
        "SELECT id, title, why_it_matters, type as goal_type, progress_percent, target_date, status FROM goals"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(goals)
}

#[tauri::command]
async fn create_goal(
    id: String,
    title: String,
    why: String,
    goal_type: String,
    target_date: String,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let user = sqlx::query_as::<_, User>("SELECT id, name, timezone, language FROM users LIMIT 1")
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let user_id = match user {
        Some(u) => u.id,
        None => return Err("No user profile found to associate goal".to_string()),
    };

    sqlx::query(
        "INSERT INTO goals (id, user_id, title, why_it_matters, type, progress_percent, target_date, status) 
         VALUES (?, ?, ?, ?, ?, 0, ?, 'active')"
    )
    .bind(id)
    .bind(user_id)
    .bind(title)
    .bind(why)
    .bind(goal_type)
    .bind(target_date)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_goal(id: String, state: tauri::State<'_, DbState>) -> Result<(), String> {
    sqlx::query("DELETE FROM goals WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_habits(state: tauri::State<'_, DbState>) -> Result<Vec<DbHabit>, String> {
    let habits = sqlx::query_as::<_, DbHabit>(
        "SELECT h.id, h.name, 
         EXISTS(SELECT 1 FROM habit_completions WHERE habit_id = h.id AND date(completed_at) = date('now', 'localtime')) as completed 
         FROM habits h"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(habits)
}

#[tauri::command]
async fn create_habit(id: String, name: String, state: tauri::State<'_, DbState>) -> Result<(), String> {
    let user = sqlx::query_as::<_, User>("SELECT id, name, timezone, language FROM users LIMIT 1")
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let user_id = match user {
        Some(u) => u.id,
        None => return Err("No user profile found to associate habit".to_string()),
    };

    sqlx::query("INSERT INTO habits (id, user_id, name) VALUES (?, ?, ?)")
        .bind(id)
        .bind(user_id)
        .bind(name)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_habit(id: String, state: tauri::State<'_, DbState>) -> Result<(), String> {
    sqlx::query("DELETE FROM habits WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn toggle_habit_completion(habit_id: String, state: tauri::State<'_, DbState>) -> Result<bool, String> {
    let user = sqlx::query_as::<_, User>("SELECT id, name, timezone, language FROM users LIMIT 1")
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let user_id = match user {
        Some(u) => u.id,
        None => return Err("No user profile found to associate habit completion".to_string()),
    };

    let completion_id: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM habit_completions WHERE habit_id = ? AND date(completed_at) = date('now', 'localtime') LIMIT 1"
    )
    .bind(&habit_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    match completion_id {
        Some((id,)) => {
            sqlx::query("DELETE FROM habit_completions WHERE id = ?")
                .bind(id)
                .execute(&state.pool)
                .await
                .map_err(|e| e.to_string())?;
            Ok(false)
        }
        None => {
            let new_comp_id = format!("comp_{}_{}", habit_id, date_timestamp_string());
            sqlx::query("INSERT INTO habit_completions (id, habit_id, user_id, completed_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)")
                .bind(new_comp_id)
                .bind(habit_id)
                .bind(user_id)
                .execute(&state.pool)
                .await
                .map_err(|e| e.to_string())?;
            Ok(true)
        }
    }
}

fn date_timestamp_string() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let start = SystemTime::now();
    let since_the_epoch = start.duration_since(UNIX_EPOCH).expect("Time went backwards");
    since_the_epoch.as_millis().to_string()
}

#[tauri::command]
async fn get_screen_captures(
    limit: Option<i64>,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<DbScreenCapture>, String> {
    let limit = limit.unwrap_or(50).clamp(1, 500);
    let rows = sqlx::query_as::<_, DbScreenCapture>(
        "SELECT id, captured_at, app_name, window_title, category, text, confidence
         FROM screen_captures
         ORDER BY captured_at DESC
         LIMIT ?",
    )
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn clear_screen_captures(state: tauri::State<'_, DbState>) -> Result<(), String> {
    sqlx::query("DELETE FROM screen_captures")
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn set_screen_capture_enabled(
    enabled: bool,
    capture_state: tauri::State<'_, CaptureState>,
) -> Result<(), String> {
    capture_state.enabled.store(enabled, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
fn get_screen_capture_enabled(capture_state: tauri::State<'_, CaptureState>) -> bool {
    capture_state.enabled.load(Ordering::SeqCst)
}

// Build a safe FTS5 query from arbitrary user input: keep only alphanumerics
// (per whitespace-separated token) and append `*` for prefix matching.
fn normalize_fts_query(raw: &str) -> String {
    raw.split_whitespace()
        .map(|w| w.chars().filter(|c| c.is_alphanumeric()).collect::<String>())
        .filter(|w| !w.is_empty())
        .map(|w| format!("{}*", w))
        .collect::<Vec<_>>()
        .join(" ")
}

#[derive(serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct DbReflection {
    pub date: String,
    pub journal_wins: Option<String>,
    pub journal_drag: Option<String>,
    pub journal_tomorrow: Option<String>,
    pub narrative: Option<String>,
}

#[derive(serde::Serialize)]
pub struct DailySummary {
    pub date: String,
    pub focus_minutes_per_category: Vec<(String, i64)>,
    pub total_captures: i64,
    pub habits_completed: i64,
    pub habits_total: i64,
    pub narrative: String,
    pub reflection: Option<DbReflection>,
}

#[derive(serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct DbContact {
    pub id: String,
    pub name: String,
    pub relationship: String,
    pub cadence_days: i64,
    pub last_interaction_at: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct DbCommitment {
    pub id: String,
    pub contact_id: String,
    pub description: String,
    pub due_date: Option<String>,
    pub status: String,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct DbLearnTopic {
    pub id: String,
    pub created_at: String,
    pub source_context: String,
    pub title: String,
    pub level: String,
    pub flashcards_json: String,
    pub comprehension_score: f64,
}

#[derive(serde::Serialize)]
pub struct Flashcard {
    pub q: String,
    pub a: String,
}

#[tauri::command]
async fn teacher_explain(
    level: String,
    state: tauri::State<'_, DbState>,
) -> Result<DbLearnTopic, String> {
    // Pull the most recent screen capture as the context for the lesson.
    let latest = sqlx::query_as::<_, DbScreenCapture>(
        "SELECT id, captured_at, app_name, window_title, category, text, confidence
         FROM screen_captures ORDER BY captured_at DESC LIMIT 1",
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let (source, title) = match &latest {
        Some(cap) => (
            cap.text.clone(),
            if cap.window_title.is_empty() {
                cap.app_name.clone()
            } else {
                cap.window_title.clone()
            },
        ),
        None => (
            "(No screen capture available - enable the Screen Log in Settings to feed the Teacher.)".to_string(),
            "Sample Lesson".to_string(),
        ),
    };

    // Cheap deterministic flashcard synthesis: pull the top-N longest sentences
    // from the source text and pair each with a generated prompt sized to the
    // learner level. The LLM-backed teacher swaps in here later.
    let normalized = source.replace('\n', " ");
    let mut sentences: Vec<&str> = normalized
        .split(|c: char| c == '.' || c == '!' || c == '?')
        .map(|s| s.trim())
        .filter(|s| s.len() > 24)
        .collect();
    sentences.sort_by_key(|s| std::cmp::Reverse(s.len()));
    let take = if level == "advanced" { 5 } else { 3 };
    let picked: Vec<&&str> = sentences.iter().take(take).collect();

    let flashcards: Vec<Flashcard> = if picked.is_empty() {
        vec![Flashcard {
            q: format!("What was on screen in {}?", title),
            a: "Not enough text detected. Try opening a denser document.".to_string(),
        }]
    } else {
        picked
            .iter()
            .enumerate()
            .map(|(i, s)| Flashcard {
                q: if level == "advanced" {
                    format!("Synthesize the key idea in passage #{}.", i + 1)
                } else {
                    format!("In your own words, what does this passage say? ({}.)", i + 1)
                },
                a: s.to_string(),
            })
            .collect()
    };

    let flashcards_json = serde_json::to_string(&flashcards).map_err(|e| e.to_string())?;
    let id = format!("learn_{}", date_timestamp_string());

    sqlx::query(
        "INSERT INTO learn_topics (id, source_context, title, level, flashcards_json)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&source)
    .bind(&title)
    .bind(&level)
    .bind(&flashcards_json)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let topic = sqlx::query_as::<_, DbLearnTopic>(
        "SELECT id, created_at, source_context, title, level, flashcards_json, comprehension_score
         FROM learn_topics WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(topic)
}

#[tauri::command]
async fn get_daily_summary(
    date: Option<String>,
    state: tauri::State<'_, DbState>,
) -> Result<DailySummary, String> {
    // SQLite 'localtime' so the day boundary tracks the user's clock.
    let target = date.unwrap_or_else(|| "now".to_string());
    let date_filter = if target == "now" {
        "date('now', 'localtime')".to_string()
    } else {
        format!("'{}'", target.replace('\'', ""))
    };

    let date_str: (String,) = sqlx::query_as(&format!("SELECT {} as d", date_filter))
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    // Each capture stands for one 10-second slice. We bucket by category and
    // convert slice counts back to minutes.
    let buckets: Vec<(String, i64)> = sqlx::query_as(&format!(
        "SELECT category, COUNT(*) as slices
         FROM screen_captures
         WHERE date(captured_at, 'localtime') = {}
         GROUP BY category
         ORDER BY slices DESC",
        date_filter
    ))
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let focus_minutes_per_category: Vec<(String, i64)> = buckets
        .iter()
        .map(|(cat, slices)| (cat.clone(), (*slices * 10) / 60))
        .collect();
    let total_captures: i64 = buckets.iter().map(|(_, n)| *n).sum();

    let habit_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM habits")
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    let habits_done: (i64,) = sqlx::query_as(&format!(
        "SELECT COUNT(*) FROM habit_completions WHERE date(completed_at, 'localtime') = {}",
        date_filter
    ))
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let top = focus_minutes_per_category
        .first()
        .map(|(c, m)| format!("{} for {} minutes", c, m))
        .unwrap_or_else(|| "nothing captured".to_string());
    let narrative = format!(
        "Today you spent the most time {}. {}/{} habits checked off.",
        top, habits_done.0, habit_count.0
    );

    let reflection = sqlx::query_as::<_, DbReflection>(
        "SELECT date, journal_wins, journal_drag, journal_tomorrow, narrative FROM daily_reflections WHERE date = ?",
    )
    .bind(&date_str.0)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(DailySummary {
        date: date_str.0,
        focus_minutes_per_category,
        total_captures,
        habits_completed: habits_done.0,
        habits_total: habit_count.0,
        narrative,
        reflection,
    })
}

#[tauri::command]
async fn save_daily_reflection(
    date: String,
    journal_wins: Option<String>,
    journal_drag: Option<String>,
    journal_tomorrow: Option<String>,
    narrative: Option<String>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO daily_reflections (date, journal_wins, journal_drag, journal_tomorrow, narrative)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
            journal_wins = excluded.journal_wins,
            journal_drag = excluded.journal_drag,
            journal_tomorrow = excluded.journal_tomorrow,
            narrative = excluded.narrative,
            updated_at = CURRENT_TIMESTAMP",
    )
    .bind(date)
    .bind(journal_wins)
    .bind(journal_drag)
    .bind(journal_tomorrow)
    .bind(narrative)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_contacts(state: tauri::State<'_, DbState>) -> Result<Vec<DbContact>, String> {
    sqlx::query_as::<_, DbContact>(
        "SELECT id, name, relationship, cadence_days, last_interaction_at, notes, created_at FROM contacts ORDER BY name",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_contact(
    id: String,
    name: String,
    relationship: String,
    cadence_days: i64,
    notes: Option<String>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let user = sqlx::query_as::<_, User>("SELECT id, name, timezone, language FROM users LIMIT 1")
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query(
        "INSERT INTO contacts (id, user_id, name, relationship, cadence_days, notes) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id)
    .bind(user.id)
    .bind(name)
    .bind(relationship)
    .bind(cadence_days)
    .bind(notes)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_contact(id: String, state: tauri::State<'_, DbState>) -> Result<(), String> {
    sqlx::query("DELETE FROM contacts WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn touch_contact(id: String, state: tauri::State<'_, DbState>) -> Result<(), String> {
    sqlx::query("UPDATE contacts SET last_interaction_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_commitments(state: tauri::State<'_, DbState>) -> Result<Vec<DbCommitment>, String> {
    sqlx::query_as::<_, DbCommitment>(
        "SELECT id, contact_id, description, due_date, status, created_at FROM commitments ORDER BY created_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_commitment(
    id: String,
    contact_id: String,
    description: String,
    due_date: Option<String>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    sqlx::query("INSERT INTO commitments (id, contact_id, description, due_date) VALUES (?, ?, ?, ?)")
        .bind(id)
        .bind(contact_id)
        .bind(description)
        .bind(due_date)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn resolve_commitment(id: String, state: tauri::State<'_, DbState>) -> Result<(), String> {
    sqlx::query("UPDATE commitments SET status = 'resolved' WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_learn_topics(state: tauri::State<'_, DbState>) -> Result<Vec<DbLearnTopic>, String> {
    sqlx::query_as::<_, DbLearnTopic>(
        "SELECT id, created_at, source_context, title, level, flashcards_json, comprehension_score
         FROM learn_topics ORDER BY created_at DESC LIMIT 30",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn rate_learn_topic(
    id: String,
    score: f64,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    sqlx::query("UPDATE learn_topics SET comprehension_score = ? WHERE id = ?")
        .bind(score.clamp(0.0, 1.0))
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn search_history(
    query: String,
    limit: Option<i64>,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<SearchResult>, String> {
    let limit = limit.unwrap_or(20).clamp(1, 100);
    let fts_query = normalize_fts_query(&query);
    if fts_query.is_empty() {
        return Ok(Vec::new());
    }

    let rows = sqlx::query_as::<_, SearchResult>(
        "SELECT sc.id, sc.captured_at, sc.app_name, sc.window_title, sc.category, sc.text,
                snippet(screen_captures_fts, 1, '[', ']', '...', 12) as snippet
         FROM screen_captures_fts
         JOIN screen_captures sc ON sc.id = screen_captures_fts.capture_id
         WHERE screen_captures_fts MATCH ?
         ORDER BY rank
         LIMIT ?",
    )
    .bind(fts_query)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

fn capture_and_ocr_once() -> Result<(String, String, String, f64), String> {
    let monitors = xcap::Monitor::all().map_err(|e| e.to_string())?;
    let primary = monitors
        .into_iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .or_else(|| xcap::Monitor::all().ok().and_then(|m| m.into_iter().next()))
        .ok_or_else(|| "No monitor available".to_string())?;

    let image = primary.capture_image().map_err(|e| e.to_string())?;
    let (width, height) = (image.width(), image.height());
    let rgba = image.into_raw();

    let text = ocr::ocr_rgba(width, height, &rgba)?;

    let (app_name, window_title) = match active_win_pos_rs::get_active_window() {
        Ok(w) => (w.app_name, w.title),
        Err(_) => (String::new(), String::new()),
    };

    let category = ocr::categorize_activity(&app_name, &text).to_string();
    // Cheap confidence proxy: longer extractions tend to be richer matches.
    let confidence = ((text.len() as f64) / 500.0).min(1.0);

    Ok((format!("{}|{}", app_name, window_title), category, text, confidence))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if shortcut.key == Code::KeyM 
                            && shortcut.modifiers.unwrap_or(Modifiers::empty()).contains(Modifiers::CONTROL | Modifiers::SHIFT) 
                        {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Setup SQLite Database
            let app_data_dir = app.path().app_data_dir().map_err(|e| tauri::Error::Setup(Box::new(e)))?;
            std::fs::create_dir_all(&app_data_dir).map_err(|e| tauri::Error::Setup(Box::new(e)))?;
            let db_path = app_data_dir.join("second_mind.db");
            let db_url = format!("sqlite://{}", db_path.to_string_lossy());

            let options = SqliteConnectOptions::from_str(&db_url)
                .map_err(|e| tauri::Error::Setup(Box::new(e)))?
                .create_if_missing(true);

            let pool = tauri::async_runtime::block_on(async {
                SqlitePoolOptions::new()
                    .connect_with(options)
                    .await
            }).map_err(|e| tauri::Error::Setup(Box::new(e)))?;

            // Initialize DB Schema and Default Data
            tauri::async_runtime::block_on(async {
                sqlx::query(
                    "CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        timezone TEXT NOT NULL DEFAULT 'UTC',
                        language TEXT NOT NULL DEFAULT 'en',
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        onboarding_completed_at DATETIME,
                        last_active_at DATETIME
                    );"
                )
                .execute(&pool)
                .await?;

                sqlx::query(
                    "CREATE TABLE IF NOT EXISTS user_preferences (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        category TEXT NOT NULL,
                        key TEXT NOT NULL,
                        value TEXT NOT NULL,
                        source TEXT NOT NULL DEFAULT 'explicit',
                        confidence REAL NOT NULL DEFAULT 1.0,
                        evidence TEXT,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, category, key)
                    );"
                )
                .execute(&pool)
                .await?;

                sqlx::query(
                    "CREATE TABLE IF NOT EXISTS goals (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        title TEXT NOT NULL,
                        why_it_matters TEXT,
                        type TEXT NOT NULL,
                        progress_percent INTEGER NOT NULL DEFAULT 0,
                        target_date TEXT,
                        status TEXT NOT NULL DEFAULT 'active',
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );"
                )
                .execute(&pool)
                .await?;

                sqlx::query(
                    "CREATE TABLE IF NOT EXISTS habits (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        name TEXT NOT NULL,
                        category TEXT NOT NULL DEFAULT 'routine',
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );"
                )
                .execute(&pool)
                .await?;

                sqlx::query(
                    "CREATE TABLE IF NOT EXISTS habit_completions (
                        id TEXT PRIMARY KEY,
                        habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
                        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );"
                )
                .execute(&pool)
                .await?;

                sqlx::query(
                    "CREATE TABLE IF NOT EXISTS screen_captures (
                        id TEXT PRIMARY KEY,
                        captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        app_name TEXT NOT NULL DEFAULT '',
                        window_title TEXT NOT NULL DEFAULT '',
                        category TEXT NOT NULL DEFAULT 'general',
                        text TEXT NOT NULL DEFAULT '',
                        confidence REAL NOT NULL DEFAULT 0.0
                    );"
                )
                .execute(&pool)
                .await?;

                sqlx::query("CREATE INDEX IF NOT EXISTS idx_screen_captures_time ON screen_captures(captured_at DESC);")
                    .execute(&pool)
                    .await?;

                // Phase 7 - FTS5 virtual table over OCR text, kept in sync via triggers.
                sqlx::query(
                    "CREATE VIRTUAL TABLE IF NOT EXISTS screen_captures_fts USING fts5(
                        capture_id UNINDEXED,
                        text,
                        tokenize='porter unicode61'
                    );"
                )
                .execute(&pool)
                .await?;

                sqlx::query(
                    "CREATE TRIGGER IF NOT EXISTS screen_captures_ai AFTER INSERT ON screen_captures BEGIN
                        INSERT INTO screen_captures_fts(capture_id, text) VALUES (new.id, new.text);
                    END;"
                )
                .execute(&pool)
                .await?;

                sqlx::query(
                    "CREATE TRIGGER IF NOT EXISTS screen_captures_ad AFTER DELETE ON screen_captures BEGIN
                        DELETE FROM screen_captures_fts WHERE capture_id = old.id;
                    END;"
                )
                .execute(&pool)
                .await?;

                sqlx::query(
                    "CREATE TRIGGER IF NOT EXISTS screen_captures_au AFTER UPDATE ON screen_captures BEGIN
                        DELETE FROM screen_captures_fts WHERE capture_id = old.id;
                        INSERT INTO screen_captures_fts(capture_id, text) VALUES (new.id, new.text);
                    END;"
                )
                .execute(&pool)
                .await?;

                // Phase 9 - learn topics + comprehension scores
                sqlx::query(
                    "CREATE TABLE IF NOT EXISTS learn_topics (
                        id TEXT PRIMARY KEY,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        source_context TEXT NOT NULL,
                        title TEXT NOT NULL,
                        level TEXT NOT NULL DEFAULT 'beginner',
                        flashcards_json TEXT NOT NULL,
                        comprehension_score REAL NOT NULL DEFAULT 0.0
                    );"
                )
                .execute(&pool)
                .await?;

                // Phase 10 - people directory + commitments
                sqlx::query(
                    "CREATE TABLE IF NOT EXISTS contacts (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        name TEXT NOT NULL,
                        relationship TEXT NOT NULL DEFAULT 'friend',
                        cadence_days INTEGER NOT NULL DEFAULT 14,
                        last_interaction_at DATETIME,
                        notes TEXT,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );"
                )
                .execute(&pool)
                .await?;

                sqlx::query(
                    "CREATE TABLE IF NOT EXISTS commitments (
                        id TEXT PRIMARY KEY,
                        contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
                        description TEXT NOT NULL,
                        due_date TEXT,
                        status TEXT NOT NULL DEFAULT 'open',
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );"
                )
                .execute(&pool)
                .await?;

                sqlx::query("CREATE INDEX IF NOT EXISTS idx_commitments_contact ON commitments(contact_id);")
                    .execute(&pool)
                    .await?;

                // Phase 11 - daily reflections
                sqlx::query(
                    "CREATE TABLE IF NOT EXISTS daily_reflections (
                        date TEXT PRIMARY KEY,
                        journal_wins TEXT,
                        journal_drag TEXT,
                        journal_tomorrow TEXT,
                        narrative TEXT,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );"
                )
                .execute(&pool)
                .await?;

                sqlx::query("CREATE INDEX IF NOT EXISTS idx_preferences_user ON user_preferences(user_id);")
                    .execute(&pool)
                    .await?;
                
                sqlx::query("CREATE INDEX IF NOT EXISTS idx_preferences_category ON user_preferences(user_id, category);")
                    .execute(&pool)
                    .await?;

                sqlx::query("CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);")
                    .execute(&pool)
                    .await?;

                sqlx::query("CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);")
                    .execute(&pool)
                    .await?;

                sqlx::query("CREATE INDEX IF NOT EXISTS idx_habit_completions_habit ON habit_completions(habit_id);")
                    .execute(&pool)
                    .await?;

                // Seed Default User
                let user_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
                    .fetch_one(&pool)
                    .await?;

                let default_user_id = "default_user";
                if user_count.0 == 0 {
                    sqlx::query(
                        "INSERT INTO users (id, name, timezone, language) VALUES (?, ?, ?, ?)"
                    )
                    .bind(default_user_id)
                    .bind("Alex")
                    .bind("UTC")
                    .bind("en")
                    .execute(&pool)
                    .await?;

                    // Seed Default Preferences
                    sqlx::query(
                        "INSERT INTO user_preferences (id, user_id, category, key, value) VALUES (?, ?, ?, ?, ?)"
                    )
                    .bind("pref_theme")
                    .bind(default_user_id)
                    .bind("ui")
                    .bind("theme")
                    .bind("\"dark\"")
                    .execute(&pool)
                    .await?;

                    sqlx::query(
                        "INSERT INTO user_preferences (id, user_id, category, key, value) VALUES (?, ?, ?, ?, ?)"
                    )
                    .bind("pref_proactivity")
                    .bind(default_user_id)
                    .bind("intervention")
                    .bind("proactivity")
                    .bind("80")
                    .execute(&pool)
                    .await?;
                }

                // Seed Default Goals
                let goal_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM goals")
                    .fetch_one(&pool)
                    .await?;
                if goal_count.0 == 0 {
                    sqlx::query(
                        "INSERT INTO goals (id, user_id, title, why_it_matters, type, progress_percent, target_date) VALUES (?, ?, ?, ?, ?, ?, ?)"
                    )
                    .bind("goal_1")
                    .bind(default_user_id)
                    .bind("Build Authentication System")
                    .bind("Secures user cognitive graph and settings")
                    .bind("quarterly")
                    .bind(67)
                    .bind("2026-06-30")
                    .execute(&pool)
                    .await?;

                    sqlx::query(
                        "INSERT INTO goals (id, user_id, title, why_it_matters, type, progress_percent, target_date) VALUES (?, ?, ?, ?, ?, ?, ?)"
                    )
                    .bind("goal_2")
                    .bind(default_user_id)
                    .bind("Complete NLP Model Integration")
                    .bind("Local Phi-3.5 cognitive modeling")
                    .bind("quarterly")
                    .bind(43)
                    .bind("2026-06-30")
                    .execute(&pool)
                    .await?;

                    sqlx::query(
                        "INSERT INTO goals (id, user_id, title, why_it_matters, type, progress_percent, target_date) VALUES (?, ?, ?, ?, ?, ?, ?)"
                    )
                    .bind("goal_3")
                    .bind(default_user_id)
                    .bind("Master Spaced Repetition Engine")
                    .bind("Adaptive learning system core")
                    .bind("quarterly")
                    .bind(12)
                    .bind("2026-06-30")
                    .execute(&pool)
                    .await?;
                }

                // Seed Default Habits
                let habit_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM habits")
                    .fetch_one(&pool)
                    .await?;
                if habit_count.0 == 0 {
                    sqlx::query("INSERT INTO habits (id, user_id, name, category) VALUES (?, ?, ?, ?)")
                        .bind("habit_1")
                        .bind(default_user_id)
                        .bind("Deep Work (2hr)")
                        .bind("routine")
                        .execute(&pool)
                        .await?;

                    sqlx::query("INSERT INTO habits (id, user_id, name, category) VALUES (?, ?, ?, ?)")
                        .bind("habit_2")
                        .bind(default_user_id)
                        .bind("Log active learnings")
                        .bind("routine")
                        .execute(&pool)
                        .await?;

                    sqlx::query("INSERT INTO habits (id, user_id, name, category) VALUES (?, ?, ?, ?)")
                        .bind("habit_3")
                        .bind(default_user_id)
                        .bind("Stretch & Hydrate")
                        .bind("routine")
                        .execute(&pool)
                        .await?;

                    sqlx::query("INSERT INTO habits (id, user_id, name, category) VALUES (?, ?, ?, ?)")
                        .bind("habit_4")
                        .bind(default_user_id)
                        .bind("Evening Reflection")
                        .bind("routine")
                        .execute(&pool)
                        .await?;

                    // Seed Default Habit Completions for today (to match checked UI states)
                    sqlx::query("INSERT INTO habit_completions (id, habit_id, user_id, completed_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)")
                        .bind("comp_1")
                        .bind("habit_1")
                        .bind(default_user_id)
                        .execute(&pool)
                        .await?;

                    sqlx::query("INSERT INTO habit_completions (id, habit_id, user_id, completed_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)")
                        .bind("comp_3")
                        .bind("habit_3")
                        .bind(default_user_id)
                        .execute(&pool)
                        .await?;
                }

                Ok::<(), sqlx::Error>(())
            }).map_err(|e| tauri::Error::Setup(Box::new(e)))?;

            // Store pool in State
            app.manage(DbState { pool: pool.clone() });

            // Screen capture toggle (defaults off — privacy-first)
            let capture_enabled = Arc::new(AtomicBool::new(false));
            app.manage(CaptureState { enabled: capture_enabled.clone() });

            // Spawn active window focus monitor loop + cognitive state engine
            let app_handle = app.handle().clone();
            let cognition = std::sync::Arc::new(cognition::CognitionEngine::new());
            let cognition_loop = cognition.clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    if let Ok(active_window) = active_win_pos_rs::get_active_window() {
                        let category = ocr::categorize_activity(&active_window.app_name, "");
                        let _ = app_handle.emit("active-window", ActiveWindowPayload {
                            app_name: active_window.app_name,
                            title: active_window.title,
                        });
                        let (snapshot, alert) = cognition_loop.observe(category);
                        let _ = app_handle.emit("cognitive-state", &snapshot);
                        if let Some(pulse) = alert {
                            let _ = app_handle.emit("pulse-alert", &pulse);
                        }
                    }
                }
            });

            // Spawn screen capture + OCR loop on a dedicated OS thread.
            // Both xcap and Windows.Media.Ocr are synchronous and may block, so
            // we keep them off the tokio runtime to avoid stalling other tasks.
            let capture_app_handle = app.handle().clone();
            let capture_pool = pool;
            let capture_flag = capture_enabled;
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(10));
                    if !capture_flag.load(Ordering::SeqCst) {
                        continue;
                    }
                    match capture_and_ocr_once() {
                        Ok((app_title, category, text, confidence)) => {
                            if text.trim().is_empty() {
                                continue;
                            }
                            let mut parts = app_title.splitn(2, '|');
                            let app_name = parts.next().unwrap_or("").to_string();
                            let window_title = parts.next().unwrap_or("").to_string();
                            let id = format!("cap_{}", date_timestamp_string());
                            let pool = capture_pool.clone();
                            let app_handle = capture_app_handle.clone();
                            let category_clone = category.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = sqlx::query(
                                    "INSERT INTO screen_captures (id, app_name, window_title, category, text, confidence) VALUES (?, ?, ?, ?, ?, ?)"
                                )
                                .bind(&id)
                                .bind(&app_name)
                                .bind(&window_title)
                                .bind(&category_clone)
                                .bind(&text)
                                .bind(confidence)
                                .execute(&pool)
                                .await;
                                let _ = app_handle.emit("screen-capture", &id);
                            });
                            let _ = category;
                        }
                        Err(e) => {
                            eprintln!("[screen capture] {}", e);
                        }
                    }
                }
            });

            #[cfg(desktop)]
            {
                let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyM);
                app.global_shortcut().register(shortcut)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet, 
            get_user_profile, 
            update_user_profile, 
            get_user_preferences, 
            update_user_preference,
            start_chat_stream,
            get_goals,
            create_goal,
            delete_goal,
            get_habits,
            create_habit,
            delete_habit,
            toggle_habit_completion,
            get_screen_captures,
            clear_screen_captures,
            set_screen_capture_enabled,
            get_screen_capture_enabled,
            search_history,
            teacher_explain,
            get_learn_topics,
            rate_learn_topic,
            get_contacts,
            create_contact,
            delete_contact,
            touch_contact,
            get_commitments,
            create_commitment,
            resolve_commitment,
            get_daily_summary,
            save_daily_reflection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


