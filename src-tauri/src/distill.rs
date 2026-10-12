use crate::note::{DiagramSpec, Note, NoteMeta, QaPair};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// What the frontend sends when the user kicks off an import.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DistillRequest {
    pub subject: String,
    pub num: String,
    pub title: String,
    /// Absolute path to the chapter PDF.
    pub pdf_path: String,
    /// Optional important questions, one per entry.
    pub questions: Vec<String>,
    /// Set once the user has confirmed replacing an existing note of the same name.
    #[serde(default)]
    pub allow_overwrite: Option<bool>,
}

/// The LLM's distilled note draft — topic-flow: each topic carries its
/// explanation, diagrams and Q&A inline.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DistillDraft {
    pub summary: String,
    /// 3-6 topics, in reading order.
    #[serde(default)]
    pub topics: Vec<TopicDraft>,
    /// Legacy flat fields — kept for older drafts; empty in topic-flow output.
    #[serde(default)]
    pub key_points: Vec<String>,
    #[serde(default)]
    pub qa: Vec<QaPair>,
    #[serde(default)]
    pub diagrams: Vec<DiagramSpec>,
    pub recap: String,
}

/// One topic as produced by the distiller.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicDraft {
    pub title: String,
    /// 1-3 explanation paragraphs.
    pub body: Vec<String>,
    #[serde(default)]
    pub diagrams: Vec<DiagramSpec>,
    #[serde(default)]
    pub qa: Vec<QaPair>,
}

/// One LLM endpoint. Anthropic Messages-shaped by default; "openai" kind goes
/// through /v1/chat/completions (nvidia, inception, any OpenAI-compatible).
#[derive(Debug, Clone)]
pub struct Endpoint {
    pub name: &'static str,
    pub url: String,
    pub key: String,
    pub model: String,
    /// true if this endpoint accepts image content blocks (vision).
    pub vision: bool,
    /// Cloudflare-fronted endpoints reject non-browser user agents.
    pub browser_ua: bool,
    /// "anthropic" (Messages API) or "openai" (chat/completions).
    pub api_kind: &'static str,
    /// Anthropic's own API: first-party-only request fields are safe to send.
    pub first_party: bool,
}

/// Load the endpoints in priority order:
/// 1. explicit user settings (if key set), then
/// 2. .env: ANTHROPIC_API_KEY @ seekai, SECONDARY_TOKEN @ gorouter (vision),
///    GEMINI_API_KEY @ google (text), NVIDIA_API_KEY @ nvidia (text),
///    INCEPTION_API_KEY @ inception (mercury-2, text).
pub fn load_endpoints(settings: &crate::library::Settings) -> Vec<Endpoint> {
    let mut out = Vec::new();

    // user-configured endpoint first, if it has a key
    if !settings.llm_api_key.trim().is_empty() {
        let base = &settings.llm_base_url;
        let first_party = crate::ai_config::is_first_party(base);
        out.push(Endpoint {
            name: "custom",
            url: crate::ai_config::messages_url(base),
            key: settings.llm_api_key.trim().to_string(),
            model: crate::ai_config::effective_model(&settings.llm_model),
            vision: true,
            browser_ua: !first_party,
            api_kind: "anthropic",
            first_party,
        });
    }

    // .env-based defaults: primary (text distill) + fallback (vision + text)
    let env = load_env();
    if let Some(key) = env.get("ANTHROPIC_API_KEY") {
        if !key.is_empty() {
            out.push(Endpoint {
                name: "seekai",
                url: "https://seekai.cc/v1/messages".into(),
                key: key.clone(),
                model: "claude-opus-5".into(),
                vision: false,
                browser_ua: false,
                api_kind: "anthropic",
                first_party: false,
            });
        }
    }
    if let Some(key) = env.get("SECONDARY_TOKEN") {
        if !key.is_empty() {
            out.push(Endpoint {
                name: "gorouter",
                url: "https://gorouter.app/v1/messages".into(),
                key: key.clone(),
                model: "claude-opus-4-8-thinking".into(),
                vision: true,
                browser_ua: true,
                api_kind: "anthropic",
                first_party: false,
            });
        }
    }
    if let Some(key) = env.get("INCEPTION_API_KEY") {
        if !key.is_empty() {
            out.push(Endpoint {
                name: "inception",
                url: "https://api.inceptionlabs.ai/v1/chat/completions".into(),
                key: key.clone(),
                model: "mercury-2".into(),
                vision: false,
                browser_ua: false,
                api_kind: "openai",
                first_party: false,
            });
        }
    }
    out
}

/// A rendered page image (base64 JPEG) ready for a vision call.
#[derive(Debug, Clone)]
pub struct PageImage {
    pub b64_jpeg: String,
}

/// Parse a .env file (KEY=VALUE lines, # comments, optional quotes) — first match wins.
fn load_env_file(path: &Path) -> Vec<(String, String)> {
    let mut out = Vec::new();
    if let Ok(text) = std::fs::read_to_string(path) {
        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((k, v)) = line.split_once('=') {
                let k = k.trim().to_string();
                let mut v = v.trim().to_string();
                if v.len() >= 2
                    && ((v.starts_with('"') && v.ends_with('"'))
                        || (v.starts_with('\'') && v.ends_with('\'')))
                {
                    v = v[1..v.len() - 1].to_string();
                }
                out.push((k, v));
            }
        }
    }
    out
}

/// Look for .env in cwd and exe-dir ancestors (up to 5 levels) — covers both
/// `tauri dev` (exe in src-tauri/target/debug, .env at project root) and
/// installed builds. First hit of a key wins.
fn load_env() -> std::collections::HashMap<String, String> {
    use std::collections::HashMap;
    let mut map = HashMap::new();
    let mut roots: Vec<std::path::PathBuf> = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        roots.push(cwd);
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            roots.push(dir.to_path_buf());
        }
    }
    for root in roots {
        let mut dir: Option<&std::path::Path> = Some(&root);
        for _ in 0..5 {
            let Some(d) = dir else { break };
            for (k, v) in load_env_file(&d.join(".env")) {
                map.entry(k).or_insert(v);
            }
            dir = d.parent();
        }
    }
    map
}

/// True when a developer .env supplies at least one endpoint key.
pub fn has_env_endpoint() -> bool {
    env_has_endpoint(&load_env())
}

fn env_has_endpoint(env: &std::collections::HashMap<String, String>) -> bool {
    ["ANTHROPIC_API_KEY", "SECONDARY_TOKEN", "INCEPTION_API_KEY"]
        .iter()
        .any(|k| env.get(*k).is_some_and(|v| !v.is_empty()))
}

/// Result of a successful import: the saved note plus its on-disk filename.
#[derive(Debug, Clone, Serialize)]
pub struct ImportOutcome {
    pub note: Note,
    pub file: String,
}

/// One note excerpt supplied as revision-agent context.
#[derive(Debug, Clone, Deserialize)]
pub struct NoteContext {
    pub subject: String,
    pub chapter: String,
    pub excerpt: String,
}

/// Result of the revision agent: the answer plus where it came from.
#[derive(Debug, Clone, Serialize)]
pub struct AskOutcome {
    pub answer: String,
    /// "notes" (grounded, cited) or "general" (beyond the notes, labeled).
    pub source: String,
}

/// One MCQ for the quiz mode.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizItem {
    pub question: String,
    pub options: Vec<String>,
    /// 0-based index into options.
    pub correct: usize,
    /// One-line why, shown after answering.
    pub explanation: String,
}

/// Generate a short quiz (5-8 MCQs) from a note's topic content via the
/// provider chain. Falls through endpoints like every other call.
pub async fn generate_quiz(
    settings: &crate::library::Settings,
    note_title: &str,
    topics_text: &str,
) -> Result<Vec<QuizItem>, String> {
    let endpoints = load_endpoints(settings);
    if endpoints.is_empty() {
        return Err(crate::ai_config::no_key_message().into());
    }
    let prompt = format!(
        r#"You are making a quick self-quiz for a student from their own study note: "{title}".

<note-topics>
{topics}
</note-topics>

Create 5 to 8 multiple-choice questions that test whether the student can REPRODUCE this material in an exam: definitions, key steps, formulas, traps. Answerable from the note alone, no trick options, exactly one correct answer per question.

Output ONLY a JSON array (no fences) of objects:
[{{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "one line why"}}]

Rules: "correct" is the 0-based index of the right option. 4 options each. JSON-safe characters only (no unicode arrows). Explanation max 1 line."#,
        title = note_title,
        topics = topics_text,
    );

    let system = "You produce quizzes as strict JSON arrays. You never add prose around the JSON.";
    let mut errors: Vec<String> = Vec::new();
    for ep in &endpoints {
        match call_anthropic_blocks(
            ep,
            system,
            serde_json::json!([{ "type": "text", "text": prompt }]),
        )
        .await
        {
            Ok(raw) => {
                let t = strip_fences(&raw);
                // model may wrap the array in an object or prepend prose
                match json_span(t, '[', ']').and_then(|s| serde_json::from_str::<Vec<QuizItem>>(s).ok()) {
                    Some(items) if !items.is_empty() => {
                        // validate: 4 options, correct in range
                        let clean: Vec<QuizItem> = items
                            .into_iter()
                            .filter(|q| q.options.len() == 4 && q.correct < 4 && !q.question.is_empty())
                            .collect();
                        if !clean.is_empty() {
                            return Ok(clean);
                        }
                    }
                    _ => errors.push(format!("{}: quiz parse failed", ep.name)),
                }
            }
            Err(e) => errors.push(e),
        }
    }
    Err(format!("quiz generation failed:\n{}", errors.join("\n")))
}

/// Strip optional markdown fences some models add around JSON.
fn strip_fences(s: &str) -> &str {
    let t = s.trim();
    let t = t.strip_prefix("```json").or_else(|| t.strip_prefix("```")).unwrap_or(t);
    let t = t.strip_suffix("```").unwrap_or(t);
    t.trim()
}

/// Safe substring for "first `open` to last `close`" JSON extraction: models
/// wrap JSON in prose or emit empty bodies, and a naive slice panics on
/// start>end, len-1 underflow, or empty input. Returns None when no span can
/// be made — the caller treats it as a parse failure and tries the next
/// endpoint instead of hanging the invoke with a panic.
fn json_span(t: &str, open: char, close: char) -> Option<&str> {
    let start = t.find(open)?;
    let end = t.rfind(close)?;
    if end < start {
        return None;
    }
    Some(&t[start..=end])
}

// ---------- practice-writing mode (exam trainer) ----------

/// Verdict + feedback for one hand-written practice answer.
#[derive(Debug, Clone, Serialize)]
pub struct WrittenGrade {
    /// "solid" | "partial" | "missed"
    pub verdict: String,
    /// 0-10, exam-style.
    pub score: u32,
    /// Missing pieces the student should add, one per line.
    pub gaps: Vec<String>,
    /// Smaller polish notes (wording, structure).
    pub polish: Vec<String>,
}

/// Grade a student's hand-written answer against the note's model answer.
/// Used by the practice-writing trainer; the frontend falls back to
/// self-grading when this fails (offline).
pub async fn grade_written_answer(
    settings: &crate::library::Settings,
    topic_title: &str,
    model_answer: &str,
    student_answer: &str,
) -> Result<WrittenGrade, String> {
    let endpoints = load_endpoints(settings);
    if endpoints.is_empty() {
        return Err(crate::ai_config::no_key_message().into());
    }
    let prompt = format!(
        r#"You are an exam invigilator grading a practice answer for a university exam (JNTUH style, marks for structure and completeness).

Topic: "{title}"

<model-answer from the student's notes>
{model}
</model-answer>

<student-written-answer>
{student}
</student-written-answer>

Grade the student's answer honestly against the model: does it carry the hook/skeleton, definition, key points, steps, example, and trap? An answer that reproduces the frame with correct content deserves 8-10 even if wording differs. A half-remembered answer gets 3-6. Blank or wrong gets 0-2.

Output ONLY a JSON object (no fences):
{{"verdict": "solid|partial|missed", "score": 0, "gaps": ["missing point — one line each"], "polish": ["optional wording note"]}}

Rules: "score" is 0-10 integer. "gaps" max 4 short lines naming what was missing or wrong. "polish" max 2 lines or empty. JSON-safe characters only."#,
        title = topic_title,
        model = truncate(model_answer, 4000),
        student = if student_answer.trim().is_empty() { "(the student wrote nothing)" } else { student_answer },
    );

    let system = "You grade practice answers as strict JSON. You never add prose around the JSON.";
    let mut errors: Vec<String> = Vec::new();
    for ep in &endpoints {
        match call_anthropic_blocks(
            ep,
            system,
            serde_json::json!([{ "type": "text", "text": prompt }]),
        )
        .await
        {
            Ok(raw) => {
                let t = strip_fences(&raw);
                if let Some(span) = json_span(t, '{', '}') {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(span) {
                        // models sometimes capitalize or drift the verdict word
                        let verdict = v
                            .get("verdict")
                            .and_then(|x| x.as_str())
                            .unwrap_or("partial")
                            .trim()
                            .to_lowercase();
                        if ["solid", "partial", "missed"].contains(&verdict.as_ref()) {
                            // models emit 8.5 as well as 8 — accept both, clamp 0-10
                            let score = v
                                .get("score")
                                .and_then(|x| x.as_f64())
                                .unwrap_or(0.0)
                                .round()
                                .clamp(0.0, 10.0) as u32;
                            let arr = |key: &str| {
                                v.get(key)
                                    .and_then(|x| x.as_array())
                                    .map(|a| {
                                        a.iter()
                                            .filter_map(|i| i.as_str().map(|s| s.to_string()))
                                            .filter(|s| !s.trim().is_empty())
                                            .collect::<Vec<_>>()
                                    })
                                    .unwrap_or_default()
                            };
                            return Ok(WrittenGrade { verdict, score, gaps: arr("gaps"), polish: arr("polish") });
                        }
                    }
                }
                errors.push(format!("{}: grade parse failed", ep.name));
            }
            Err(e) => errors.push(e),
        }
    }
    Err(format!("grading failed:\n{}", errors.join("\n")))
}

/// Keep a text block within a budget from the tail (the exam frame's later
/// lines — Trap, Example — matter most for grading).
fn truncate(s: &str, max_chars: usize) -> String {
    if s.len() <= max_chars {
        return s.to_string();
    }
    let mut start = s.len() - max_chars;
    // don't split inside a char boundary
    while start < s.len() && !s.is_char_boundary(start) {
        start += 1;
    }
    format!("…{}", &s[start..])
}

// ---------- mock exam (exam simulator) ----------

/// One LLM-written written-answer question for a mock exam paper.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WrittenQuestion {
    pub question: String,
    /// Model answer in the JNTUH learnable frame, shown after grading.
    pub model_answer: String,
}

/// Generate written-answer exam questions from topic content. The frontend
/// mixes these under the real questions from the notes.
pub async fn generate_written_questions(
    settings: &crate::library::Settings,
    subjects: &str,
    topics_text: &str,
    count: usize,
) -> Result<Vec<WrittenQuestion>, String> {
    let endpoints = load_endpoints(settings);
    if endpoints.is_empty() {
        return Err(crate::ai_config::no_key_message().into());
    }
    let prompt = format!(
        r#"You are setting a university exam paper ({subjects}) from the student's own notes below.

<note-topics>
{topics}
</note-topics>

Write {count} written-answer exam questions (5 marks each) in the style of important exam questions: "Explain X", "Compare X and Y", "Describe the working of X", "State and prove/derive". Each must be answerable purely from the note topics given, and must ask for reproducible structure (definitions, steps, comparisons, small examples) — not vague opinion.

For each question also write the model answer in the student's learnable frame, 6-12 lines: Hook (one-line mnemonic skeleton), Definition, Key points (i)(ii)(iii), Steps if any, small Example, and the classic Trap to avoid.

Output ONLY a JSON array (no fences) of objects:
[{{"question": "...", "model_answer": "the frame answer, \\n separated lines"}}]

Rules: JSON-safe characters only (no unicode arrows, use ->). No numbering inside "question" — the paper numbers them. Vary which topics the questions come from."#,
        subjects = subjects,
        topics = truncate_head(topics_text, 30000),
        count = count,
    );

    let system = "You write exam questions as strict JSON arrays. You never add prose around the JSON.";
    let mut errors: Vec<String> = Vec::new();
    for ep in &endpoints {
        match call_anthropic_blocks(
            ep,
            system,
            serde_json::json!([{ "type": "text", "text": prompt }]),
        )
        .await
        {
            Ok(raw) => {
                let t = strip_fences(&raw);
                match json_span(t, '[', ']').and_then(|s| serde_json::from_str::<Vec<WrittenQuestion>>(s).ok()) {
                    Some(items) => {
                        let clean: Vec<WrittenQuestion> = items
                            .into_iter()
                            .filter(|q| !q.question.is_empty() && !q.model_answer.is_empty())
                            .collect();
                        if !clean.is_empty() {
                            return Ok(clean);
                        }
                    }
                    _ => errors.push(format!("{}: questions parse failed", ep.name)),
                }
            }
            Err(e) => errors.push(e),
        }
    }
    Err(format!("question generation failed:\n{}", errors.join("\n")))
}

/// Head-truncate for topic context (earliest topics first).
fn truncate_head(s: &str, max_chars: usize) -> String {
    if s.len() <= max_chars {
        return s.to_string();
    }
    let mut end = max_chars;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}…", &s[..end])
}

/// Per-question result of grading a submitted mock exam.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExamQResult {
    /// 1-based question number on the paper.
    pub number: usize,
    /// Marks earned, 0-5.
    pub earned: u32,
    /// One-two line why.
    pub feedback: String,
}

/// Grade a whole mock exam in one batched call: questions with their model
/// answers against the student's submitted answers.
pub async fn grade_exam(
    settings: &crate::library::Settings,
    paper_json: String,
    answers: Vec<String>,
) -> Result<Vec<ExamQResult>, String> {
    let endpoints = load_endpoints(settings);
    if endpoints.is_empty() {
        return Err(crate::ai_config::no_key_message().into());
    }
    // paper_json: [{number, question, model_answer}] — re-embed for the prompt
    let mut paper = String::new();
    if let Ok(items) = serde_json::from_str::<Vec<serde_json::Value>>(&paper_json) {
        for (i, item) in items.iter().enumerate() {
            let ans = answers.get(i).cloned().unwrap_or_default();
            let blank = if ans.trim().is_empty() { "(blank)" } else { "" };
            paper.push_str(&format!(
                "Q{}: {}\nMODEL: {}\nSTUDENT: {}{}\n\n",
                item.get("number").and_then(|n| n.as_u64()).unwrap_or((i + 1) as u64),
                item.get("question").and_then(|q| q.as_str()).unwrap_or(""),
                truncate(item.get("model_answer").and_then(|m| m.as_str()).unwrap_or(""), 1500),
                blank,
                ans,
            ));
        }
    }

    let prompt = format!(
        r#"You are an exam evaluator grading a university mock exam (5 marks per question). For each question below you have the model answer and the student's written answer.

{paper}

Grade each question 0-5 the way a fair university evaluator would: 5 = the frame is complete and correct (definition + key points + steps/example); 3-4 = mostly right, one piece missing; 1-2 = fragments or partially wrong; 0 = blank or wrong. Blank answers get 0 with feedback "not attempted".

Output ONLY a JSON array (no fences), one object per question in order:
[{{"number": 1, "earned": 4, "feedback": "one line: what was there, what was missing"}}]

Rules: "number" matches the Q number above. "earned" is an integer 0-5. Feedback max 2 short lines, JSON-safe characters only."#,
        paper = paper,
    );

    let system = "You grade exams as strict JSON arrays. You never add prose around the JSON.";
    let mut errors: Vec<String> = Vec::new();
    for ep in &endpoints {
        match call_anthropic_blocks(
            ep,
            system,
            serde_json::json!([{ "type": "text", "text": prompt }]),
        )
        .await
        {
            Ok(raw) => {
                let t = strip_fences(&raw);
                // parse loosely, then validate + clamp in code — models drift
                // on types (3.5 instead of 3) and may number from 0
                match json_span(t, '[', ']').and_then(|s| serde_json::from_str::<Vec<serde_json::Value>>(s).ok()) {
                    Some(items) => {
                        let clean: Vec<ExamQResult> = items
                            .iter()
                            .filter_map(|r| {
                                let number = r.get("number").and_then(|n| n.as_u64()).unwrap_or(0);
                                let earned = r
                                    .get("earned")
                                    .and_then(|e| e.as_f64())
                                    .unwrap_or(0.0)
                                    .round()
                                    .clamp(0.0, 5.0) as u32;
                                let feedback = r
                                    .get("feedback")
                                    .and_then(|f| f.as_str())
                                    .unwrap_or("")
                                    .trim()
                                    .to_string();
                                (number >= 1).then_some(ExamQResult { number: number as usize, earned, feedback })
                            })
                            .collect();
                        if !clean.is_empty() {
                            return Ok(clean);
                        }
                    }
                    _ => errors.push(format!("{}: exam grade parse failed", ep.name)),
                }
            }
            Err(e) => errors.push(e),
        }
    }
    Err(format!("exam grading failed:\n{}", errors.join("\n")))
}


/// Answer a study question from the supplied note excerpts first; when the
/// notes don't cover it, answer from general knowledge with an explicit label.
pub async fn answer_from_notes(
    settings: &crate::library::Settings,
    question: &str,
    contexts: &[NoteContext],
) -> Result<AskOutcome, String> {
    let endpoints = load_endpoints(settings);
    if endpoints.is_empty() {
        return Err(crate::ai_config::no_key_message().into());
    }
    let ctx_block = contexts
        .iter()
        .map(|c| {
            format!(
                "<note subject=\"{}\" chapter=\"{}\">\n{}\n</note>",
                c.subject, c.chapter, c.excerpt
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    // stage 1: grounded attempt — the model must declare whether the notes
    // actually contain the answer
    let grounded_prompt = format!(
        r#"A student is asking their own study notes a question. The relevant note excerpts are below.

<notes>
{ctx}
</notes>

<question>{q}</question>

Decide honestly: do the notes contain enough to answer this question?
- If yes: respond with a JSON object {{"covered": true, "answer": "..."}} where the answer explains it clearly, explanation-first, 3-6 sentences, and cites the note(s) like (DAA › Chapter 02).
- If the notes only partially cover it: {{"covered": true, "answer": "..."}} — answer the covered part and say plainly what the notes don't cover.
- If the notes don't cover it at all: respond exactly {{"covered": false, "answer": ""}}.
Output raw JSON only — no fences, no commentary."#,
        ctx = ctx_block,
        q = question,
    );

    let system = "You are a careful study-notes assistant. You never claim the notes cover something they don't. You cite the note you used for every claim.";

    // try grounded stage on every endpoint; remember the best error/answer
    for ep in &endpoints {
        match call_anthropic_blocks(
            ep,
            system,
            serde_json::json!([{ "type": "text", "text": grounded_prompt }]),
        )
        .await
        {
            Ok(raw) => {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(strip_fences(&raw)) {
                    let covered = v.get("covered").and_then(|c| c.as_bool()).unwrap_or(false);
                    let answer = v
                        .get("answer")
                        .and_then(|a| a.as_str())
                        .unwrap_or("")
                        .trim()
                        .to_string();
                    if covered && !answer.is_empty() {
                        return Ok(AskOutcome { answer, source: "notes".into() });
                    }
                }
                // covered=false, unparseable, or empty answer: fall through
                break;
            }
            Err(e) => {
                // endpoint failed entirely — try the next one
                let _ = e;
                continue;
            }
        }
    }

    // stage 2: beyond the notes — general knowledge, clearly labeled
    let general_prompt = format!(
        r#"A student asked their study notes a question that the notes don't cover. Answer from your general knowledge instead — clearly and concisely, 3-6 sentences, explanation-first. Start the answer with a phrase like "Your notes don't cover this, but —". Plain text only, no preamble.

<question>{q}</question>"#,
        q = question,
    );

    let mut errors: Vec<String> = Vec::new();
    for ep in &endpoints {
        match call_anthropic_blocks(
            ep,
            "You are a knowledgeable study assistant. You give clear, correct, well-structured explanations.",
            serde_json::json!([{ "type": "text", "text": general_prompt }]),
        )
        .await
        {
            Ok(ans) => {
                return Ok(AskOutcome {
                    answer: ans.trim().to_string(),
                    source: "general".into(),
                })
            }
            Err(e) => errors.push(e),
        }
    }
    Err(format!("revision agent failed:\n{}", errors.join("\n")))
}

/// Extract the text of a PDF for the distiller prompt.
pub fn extract_pdf_text(path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("read pdf: {e}"))?;
    let text = pdf_extract::extract_text_from_mem(&bytes)
        .map_err(|e| format!("extract pdf: {e}"))?;
    Ok(text)
}

/// Build the distillation prompt for the LLM.
pub fn build_prompt(req: &DistillRequest, chapter_text: &str) -> String {
    let questions_block = if req.questions.is_empty() {
        "No questions were provided — omit the questions answered section.".to_string()
    } else {
        format!(
            "Answer each of these questions specifically from the chapter's own content, with a clear explanation (not just copied text):\n{}",
            req.questions.iter().map(|q| format!("- {q}")).collect::<Vec<_>>().join("\n")
        )
    };

    format!(
        r#"You are distilling a study chapter into a brief, clear note for a student's field notebook.

<subject>{}</subject>
<chapter num="{}">{}</chapter>

<chapter-text>
{}
</chapter-text>

{}

Produce ONLY a JSON object (no markdown fences, no commentary) with exactly these keys:
- "summary": 2-4 sentences, plain text, at most one pair of <em></em> tags around the single most important phrase.
- "topics": array of 3-6 topic objects, in the order a student should read them. Each topic:
    {{"title": "short topic name (2-5 words)",
      "body": ["paragraph 1", "paragraph 2 — 1 to 3 paragraphs total, plain text; a key term may be wrapped in <strong></strong>; at most one <em></em> per paragraph"],
      "diagrams": [diagram specs that belong to THIS topic — place each figure where it is explained, never piled at the end],
      "qa": [{{"q": "...", "a": "..."}} — the provided questions that belong to this topic; answers grounded in the chapter, 2-4 sentences, explanation-first]}}
- "recap": one short memorable line, plain text.
Distribute the provided questions across the topics they belong to (if any). If a question spans topics, put it in the topic that best covers it. Empty "diagrams"/"qa" arrays when a topic has none. Do NOT invent diagrams the chapter doesn't have.

Diagram specs — six types; ALWAYS prefer the most specific type for the figure (a tree is a tree, not a blob of dots; a frame format is a strip, not a grid):
1. {{"type": "labelled-blob", "data": {{"caption": "fig. N.M — <what it shows>", "outline": "short description", "parts": [{{"label": "name", "kind": "oval|dot|squiggle|edge", "accent": false, "size": "small|large", "count": 1}}]}}}}
   — for a labelled structure with parts inside an organic outer boundary (e.g. a cell, an atom). 3-6 parts. Use "edge" kind for the outer boundary itself. Mark exactly one part "accent": true if the chapter highlights one.
2. {{"type": "trend-grid", "data": {{"caption": "...", "rows": N, "cols": N, "trends": [{{"direction": "right|up", "label": "what increases"}}]}}}}
   — for table-like figures with directional trends. 1-2 trends.
3. {{"type": "process-flow", "data": {{"caption": "...", "steps": [{{"label": "step name", "note": "optional short annotation"}}]}}}}
   — for a sequence or cycle; 3-5 steps, left to right.
4. {{"type": "tree", "data": {{"caption": "...", "trees": [{{"label": "root", "accent": false, "children": [{{"label": "child", "children": []}}]}}]}}}}
   — for rooted trees, forests, state-space/recursion trees, disjoint-set structures, decision trees. Multiple roots = forest. Keep labels 1-3 words; depth ≤ 3, breadth ≤ 4.
5. {{"type": "layer-stack", "data": {{"caption": "...", "layers": [{{"label": "layer name", "note": "optional short annotation", "accent": false}}]}}}}
   — for layered stacks: OSI/TCP-IP models, memory hierarchies, cross-sections ordered top-to-bottom. 3-7 layers; accent exactly one if highlighted.
6. {{"type": "format-strip", "data": {{"caption": "...", "fields": [{{"label": "field name", "flex": 1, "accent": false}}], "arrow": {{"direction": "right", "label": "optional trend"}}}}}}
   — for horizontal segmented formats and ordered ranges: frame/packet layouts, headers, electromagnetic spectra. "flex" scales a segment's width (payload = 3, flags = 1). Include "arrow" only for spectra/trends.

Captions follow the lab-notebook style: "fig. <chapter num>.<n> — <lowercase description>".
Keep every label short (1-3 words). Output raw JSON only."#,
        req.subject, req.num, req.title, chapter_text, questions_block
    )
}

const BROWSER_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/// Extract text blocks from an Anthropic Messages response.
fn extract_anthropic_text(json: &serde_json::Value) -> Vec<&str> {
    json.get("content")
        .and_then(|c| c.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|b| b.get("text").and_then(|t| t.as_str()))
                .collect()
        })
        .unwrap_or_default()
}

/// Messages API request body. No sampling params, no thinking config and no
/// prefill: current Claude models reject them. Effort and server-side refusal
/// fallbacks are first-party only.
pub fn anthropic_body(ep: &Endpoint, system: &str, blocks: serde_json::Value) -> serde_json::Value {
    let mut body = serde_json::json!({
        "model": ep.model,
        "max_tokens": 16000,
        "system": system,
        "messages": [{"role": "user", "content": blocks}],
    });
    if ep.first_party {
        body["output_config"] = serde_json::json!({"effort": "medium"});
        body["fallbacks"] = serde_json::json!("default");
    }
    body
}

/// A cut-off or declined reply is not "bad json" — say what happened.
pub fn read_stop_reason(json: &serde_json::Value) -> Result<(), String> {
    match json.get("stop_reason").and_then(|s| s.as_str()) {
        Some("max_tokens") => Err("the chapter is too long for one pass — split the file into smaller parts and import each".into()),
        Some("refusal") => Err("the AI declined this request — try rephrasing, or a different file".into()),
        _ => Ok(()),
    }
}

/// One LLM call with content blocks, routed by endpoint kind.
/// Anthropic: Messages API with x-api-key. OpenAI: chat/completions with
/// Bearer auth — the prompt text is flattened into a single user message.
/// Retries transient gateway errors (5xx/429) with growing backoff.
async fn call_anthropic_blocks(
    ep: &Endpoint,
    system: &str,
    blocks: serde_json::Value,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(290))
        .build()
        .map_err(|e| e.to_string())?;

    // flatten the content blocks to plain text for OpenAI-kind endpoints
    let prompt_text = if ep.api_kind == "openai" {
        blocks
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|b| b.get("text").and_then(|t| t.as_str()))
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .unwrap_or_default()
    } else {
        String::new()
    };

    let req = if ep.api_kind == "openai" {
        let body = serde_json::json!({
            "model": ep.model,
            "max_tokens": 16000,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt_text},
            ]
        });
        client
            .post(&ep.url)
            .header("Authorization", format!("Bearer {}", ep.key))
            .header("content-type", "application/json")
            .json(&body)
    } else {
        let body = anthropic_body(ep, system, blocks);
        let mut r = client
            .post(&ep.url)
            .header("x-api-key", &ep.key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&body);
        if ep.first_party {
            r = r.header("anthropic-beta", "server-side-fallback-2026-07-01");
        }
        if ep.browser_ua {
            r = r.header("User-Agent", BROWSER_UA);
        }
        r
    };

    const ATTEMPTS: u32 = 5;
    let mut last_err = String::new();
    for attempt in 1..=ATTEMPTS {
        let resp = match req
            .try_clone()
            .ok_or_else(|| "request not cloneable".to_string())?
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                last_err = format!("{}: request failed: {e}", ep.name);
                sleep_backoff(attempt).await;
                continue;
            }
        };
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            last_err = crate::ai_config::describe_status(status.as_u16(), &text);
            // 5xx / 429: transient, retry; others: fail fast
            if status.as_u16() >= 500 || status.as_u16() == 429 {
                sleep_backoff(attempt).await;
                continue;
            }
            return Err(last_err);
        }
        let json: serde_json::Value = serde_json::from_str(&text)
            .map_err(|e| format!("{}: bad json: {e}", ep.name))?;
        // OpenAI shape: choices[0].message.content
        if ep.api_kind == "openai" {
            let content = json
                .pointer("/choices/0/message/content")
                .and_then(|c| c.as_str())
                .unwrap_or("");
            if content.is_empty() {
                return Err(format!("{}: no text in response", ep.name));
            }
            return Ok(content.to_string());
        }
        read_stop_reason(&json)?;
        // Anthropic shape: content: [ {type:"text", text:"..."} ] — thinking models
        // also emit {type:"thinking"} blocks; only the text ones carry the answer.
        let pieces = extract_anthropic_text(&json);
        if pieces.is_empty() {
            return Err(format!("{}: no text in response", ep.name));
        }
        return Ok(pieces.join("\n"));
    }
    Err(last_err)
}

async fn sleep_backoff(attempt: u32) {
    tokio::time::sleep(std::time::Duration::from_secs(8 * attempt as u64)).await;
}

/// Plain text prompt call.
async fn call_anthropic(ep: &Endpoint, system: &str, prompt: &str) -> Result<String, String> {
    call_anthropic_blocks(
        ep,
        system,
        serde_json::json!([{ "type": "text", "text": prompt }]),
    )
    .await
}

/// Transcribe scanned pages via a vision-capable endpoint.
/// Pages are sent in batches (5 at a time keeps payloads sane).
pub async fn transcribe_pages(
    settings: &crate::library::Settings,
    pages: &[PageImage],
) -> Result<String, String> {
    let vision_eps: Vec<Endpoint> = load_endpoints(settings)
        .into_iter()
        .filter(|e| e.vision)
        .collect();
    if vision_eps.is_empty() {
        return Err("scanned PDFs need an API key with image support — add one in settings".into());
    }
    let mut transcript = String::new();
    let mut errors: Vec<String> = Vec::new();

    for (bi, chunk) in pages.chunks(5).enumerate() {
        let mut blocks: Vec<serde_json::Value> = Vec::new();
        for p in chunk.iter() {
            blocks.push(serde_json::json!({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": p.b64_jpeg},
            }));
        }
        blocks.push(serde_json::json!({
            "type": "text",
            "text": format!("These are pages {}-{} of a study chapter. Transcribe ALL content exactly: headings, bullet points, definitions, and describe each figure/diagram in [FIGURE: ...] brackets with its caption. Preserve structure with markdown. Text only, no commentary.", bi * 5 + 1, bi * 5 + chunk.len()),
        }));

        let mut done = false;
        for ep in &vision_eps {
            match call_anthropic_blocks(
                ep,
                "You transcribe scanned study notes faithfully and completely.",
                serde_json::Value::Array(blocks.clone()),
            )
            .await
            {
                Ok(t) => {
                    transcript.push_str(&t);
                    transcript.push_str("\n\n");
                    done = true;
                    break;
                }
                Err(e) => errors.push(e),
            }
        }
        if !done {
            return Err(format!("vision transcription failed:\n{}", errors.join("\n")));
        }
    }
    Ok(transcript)
}

/// Try each endpoint in priority order until one produces a draft.
pub async fn distill_chapter(
    settings: &crate::library::Settings,
    req: &DistillRequest,
    chapter_text: &str,
) -> Result<DistillDraft, String> {
    let endpoints = load_endpoints(settings);
    if endpoints.is_empty() {
        return Err(crate::ai_config::no_key_message().into());
    }
    let prompt = build_prompt(req, chapter_text);
    let system = "You produce study notes as strict JSON. You never add prose around the JSON.";

    let mut errors: Vec<String> = Vec::new();
    for ep in &endpoints {
        match call_anthropic(ep, system, &prompt).await {
            Ok(content) => {
                let content = content
                    .trim()
                    .trim_start_matches("```json")
                    .trim_start_matches("```")
                    .trim_end_matches("```")
                    .trim();
                // thinking models may emit <thinking>…</thinking> before the JSON; strip it
                let content = if let Some(start) = content.find('{') {
                    &content[start..]
                } else {
                    content
                };
                match serde_json::from_str::<DistillDraft>(content) {
                    Ok(draft) => return Ok(draft),
                    Err(e) => errors.push(format!(
                        "{}: draft parse failed: {e}",
                        ep.name
                    )),
                }
            }
            Err(e) => errors.push(e),
        }
    }
    Err(format!("all distillers failed:\n{}", errors.join("\n")))
}

/// Assemble the final note from meta + draft and stamp it with today's date.
pub fn assemble_note(req: &DistillRequest, draft: DistillDraft) -> Note {
    let topics: Vec<crate::note::Topic> = draft
        .topics
        .into_iter()
        .map(|t| crate::note::Topic {
            title: t.title,
            body: t.body,
            diagrams: t.diagrams,
            qa: t.qa,
        })
        .collect();
    Note {
        meta: NoteMeta {
            subject: req.subject.clone(),
            num: req.num.clone(),
            title: req.title.clone(),
            pdf_path: Some(req.pdf_path.clone()),
            questions: req.questions.clone(),
            created: Some(chrono::Local::now().format("%Y-%m-%d").to_string()),
        },
        summary: draft.summary,
        key_points: draft.key_points,
        diagrams: draft.diagrams,
        qa: draft.qa,
        recap: draft.recap,
        topics,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn custom_settings(url: &str, model: &str, key: &str) -> crate::library::Settings {
        crate::library::Settings {
            llm_base_url: url.into(),
            llm_model: model.into(),
            llm_api_key: key.into(),
            ..Default::default()
        }
    }

    #[test]
    fn custom_endpoint_uses_normalized_url_and_default_model() {
        let eps = load_endpoints(&custom_settings("", "", "sk-ant-x"));
        assert_eq!(eps[0].url, "https://api.anthropic.com/v1/messages");
        assert_eq!(eps[0].model, "claude-opus-5-5");
        assert!(eps[0].first_party);
        assert!(!eps[0].browser_ua, "no UA spoofing against Anthropic");
    }

    #[test]
    fn no_key_means_no_custom_endpoint() {
        let eps = load_endpoints(&custom_settings("", "", ""));
        assert!(eps.iter().all(|e| e.name != "custom"));
    }

    #[test]
    fn first_party_body_has_effort_and_fallbacks_but_no_sampling() {
        let ep = &load_endpoints(&custom_settings("", "", "k"))[0];
        let b = anthropic_body(ep, "sys", serde_json::json!([{"type":"text","text":"hi"}]));
        assert_eq!(b["max_tokens"], 16000);
        assert_eq!(b["output_config"]["effort"], "medium");
        assert_eq!(b["fallbacks"], "default");
        assert!(b.get("temperature").is_none() && b.get("thinking").is_none());
    }

    #[test]
    fn third_party_body_is_plain() {
        let ep = &load_endpoints(&custom_settings("https://gw.example.com", "m", "k"))[0];
        let b = anthropic_body(ep, "sys", serde_json::json!([]));
        assert!(b.get("output_config").is_none() && b.get("fallbacks").is_none());
        assert_eq!(b["max_tokens"], 16000);
    }

    #[test]
    fn stop_reasons_map_to_messages() {
        assert!(read_stop_reason(&serde_json::json!({"stop_reason":"end_turn"})).is_ok());
        let cut = read_stop_reason(&serde_json::json!({"stop_reason":"max_tokens"})).unwrap_err();
        assert!(cut.contains("too long"));
        let no = read_stop_reason(&serde_json::json!({"stop_reason":"refusal"})).unwrap_err();
        assert!(no.contains("declined"));
    }

    #[test]
    fn env_endpoint_needs_a_non_empty_known_key() {
        let mut env = std::collections::HashMap::new();
        assert!(!env_has_endpoint(&env));
        env.insert("ANTHROPIC_API_KEY".to_string(), String::new());
        env.insert("UNRELATED".to_string(), "x".to_string());
        assert!(!env_has_endpoint(&env));
        env.insert("SECONDARY_TOKEN".to_string(), "tok".to_string());
        assert!(env_has_endpoint(&env));
    }
}
