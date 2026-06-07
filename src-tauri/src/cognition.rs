// Phase 8 - cognitive state engine.
// Tracks a short rolling window of (timestamp, category) samples and derives a
// high-level state (focused / fatigued / chatty / idle) plus optional pulse
// suggestions. Thresholds favour testability over realism so the verification
// scenario in the plan (rapid app switching -> fatigued) reproduces in seconds.

use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const HISTORY_RETENTION: Duration = Duration::from_secs(15 * 60);
const SWITCH_WINDOW: Duration = Duration::from_secs(120);
const SUSTAINED_FOCUSED: Duration = Duration::from_secs(180);
const SUSTAINED_CHATTY: Duration = Duration::from_secs(120);
const CODING_FATIGUE: Duration = Duration::from_secs(20 * 60);
const CHAOTIC_SWITCH_COUNT: usize = 5;
const ALERT_COOLDOWN: Duration = Duration::from_secs(10 * 60);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CognitiveState {
    Idle,
    Focused,
    Fatigued,
    Chatty,
}

impl CognitiveState {
    pub fn as_str(&self) -> &'static str {
        match self {
            CognitiveState::Idle => "idle",
            CognitiveState::Focused => "focused",
            CognitiveState::Fatigued => "fatigued",
            CognitiveState::Chatty => "chatty",
        }
    }
}

#[derive(Clone)]
struct Sample {
    at: Instant,
    category: String,
}

pub struct CognitionEngine {
    inner: Mutex<Inner>,
}

struct Inner {
    history: VecDeque<Sample>,
    last_state: CognitiveState,
    last_alert: Option<(String, Instant)>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CognitiveSnapshot {
    pub state: &'static str,
    pub message: String,
    pub sustained_seconds: u64,
    pub recent_switches: usize,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct PulseAlert {
    pub kind: String,
    pub title: String,
    pub body: String,
    pub severity: &'static str,
}

impl CognitionEngine {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(Inner {
                history: VecDeque::new(),
                last_state: CognitiveState::Idle,
                last_alert: None,
            }),
        }
    }

    pub fn observe(&self, category: &str) -> (CognitiveSnapshot, Option<PulseAlert>) {
        let now = Instant::now();
        let mut inner = self.inner.lock().expect("cognition mutex poisoned");

        inner.history.push_back(Sample {
            at: now,
            category: category.to_string(),
        });
        while let Some(front) = inner.history.front() {
            if now.duration_since(front.at) > HISTORY_RETENTION {
                inner.history.pop_front();
            } else {
                break;
            }
        }

        // Count distinct-category switches in the recent window.
        let mut last_cat: Option<&str> = None;
        let mut switches = 0usize;
        for sample in inner
            .history
            .iter()
            .filter(|s| now.duration_since(s.at) <= SWITCH_WINDOW)
        {
            if let Some(prev) = last_cat {
                if prev != sample.category {
                    switches += 1;
                }
            }
            last_cat = Some(&sample.category);
        }

        // How long has the current category been sustained?
        let mut sustained = Duration::from_secs(0);
        for sample in inner.history.iter().rev() {
            if sample.category == category {
                sustained = now.duration_since(sample.at);
            } else {
                break;
            }
        }

        let state = if switches >= CHAOTIC_SWITCH_COUNT {
            CognitiveState::Fatigued
        } else if category == "coding" && sustained >= CODING_FATIGUE {
            CognitiveState::Fatigued
        } else if category == "chatting" && sustained >= SUSTAINED_CHATTY {
            CognitiveState::Chatty
        } else if sustained >= SUSTAINED_FOCUSED
            && category != "general"
            && category != "media"
        {
            CognitiveState::Focused
        } else {
            CognitiveState::Idle
        };

        let message = match state {
            CognitiveState::Focused => format!(
                "Deep focus on {} for {} minutes.",
                category,
                sustained.as_secs() / 60
            ),
            CognitiveState::Fatigued if switches >= CHAOTIC_SWITCH_COUNT => format!(
                "Lots of context switching detected ({} flips in the last 2 minutes).",
                switches
            ),
            CognitiveState::Fatigued => format!(
                "Sustained coding for {} minutes - consider a short break.",
                sustained.as_secs() / 60
            ),
            CognitiveState::Chatty => "Active in a conversation app.".to_string(),
            CognitiveState::Idle => "Light activity.".to_string(),
        };

        let snapshot = CognitiveSnapshot {
            state: state.as_str(),
            message,
            sustained_seconds: sustained.as_secs(),
            recent_switches: switches,
        };

        // Only fire a pulse alert on state transitions into Fatigued/Chatty
        // and respect the per-kind cooldown to avoid spam.
        let alert_kind = match state {
            CognitiveState::Fatigued if switches >= CHAOTIC_SWITCH_COUNT => Some("chaotic"),
            CognitiveState::Fatigued => Some("coding-fatigue"),
            CognitiveState::Chatty => Some("chat-break"),
            _ => None,
        };

        let alert = match alert_kind {
            Some(kind) if state != inner.last_state => {
                let allowed = match &inner.last_alert {
                    Some((prev_kind, at))
                        if prev_kind == kind && now.duration_since(*at) < ALERT_COOLDOWN =>
                    {
                        false
                    }
                    _ => true,
                };
                if allowed {
                    let (title, body, severity) = match kind {
                        "coding-fatigue" => (
                            "Take a breath?".to_string(),
                            "You've been writing code for a while. A two-minute stretch will reset your focus.".to_string(),
                            "warning",
                        ),
                        "chaotic" => (
                            "Lots of context switching".to_string(),
                            "Five quick app flips in the last two minutes. Want to land on one task?".to_string(),
                            "warning",
                        ),
                        "chat-break" => (
                            "Stay anchored".to_string(),
                            "You've been chatting for a while - flag any commitments before you switch back.".to_string(),
                            "info",
                        ),
                        _ => (String::new(), String::new(), "info"),
                    };
                    inner.last_alert = Some((kind.to_string(), now));
                    Some(PulseAlert {
                        kind: kind.to_string(),
                        title,
                        body,
                        severity,
                    })
                } else {
                    None
                }
            }
            _ => None,
        };

        inner.last_state = state;
        (snapshot, alert)
    }
}
