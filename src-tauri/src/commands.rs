use crate::library::{list_notes, notes_root, safe_join, write_atomic, LibraryEntry, Settings};
use crate::note::Note;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

fn app_data(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().expect("no app_data_dir")
}

fn error(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Resolve `subject`/`file` under the notes root and require a markdown file.
fn note_path(root: &Path, subject: &str, file: &str) -> Result<PathBuf, String> {
    if !file.to_ascii_lowercase().ends_with(".md") {
        return Err(format!("not a note file: {file}"));
    }
    safe_join(root, &[subject, file])
}

/// Where a freshly imported chapter will land on disk.
fn target_note_path(root: &Path, subject: &str, num: &str, title: &str) -> Result<PathBuf, String> {
    let subject_dir = safe_join(root, &[subject])?;
    let filename = format!("{}-{}.md", num, crate::note::slug(title));
    safe_join(&subject_dir, &[&filename])
}

/// The study state is a map of card id -> counters. Reject anything else so a
/// damaged or foreign file surfaces as an error instead of corrupting saves.
fn validate_study_state(v: &serde_json::Value) -> Result<(), String> {
    let map = v.as_object().ok_or("study state must be a JSON object")?;
    for (id, entry) in map {
        let fields = entry
            .as_object()
            .ok_or_else(|| format!("study state entry {id} must be an object"))?;
        for field in ["seen", "missed", "lastSeen"] {
            if let Some(value) = fields.get(field) {
                if !value.is_number() {
                    return Err(format!("study state field {id}.{field} must be a number"));
                }
            }
        }
    }
    Ok(())
}

/// Load settings (migrating 0.1 leftovers) and fill the runtime-only key
/// from the credential store. Every AI command goes through this.
pub fn settings_with_key(app: &AppHandle) -> Result<Settings, String> {
    let mut settings = Settings::load_migrated(&app_data(app), crate::keystore::set)?;
    settings.llm_api_key = crate::keystore::get()?.unwrap_or_default();
    Ok(settings)
}

#[derive(serde::Serialize)]
pub struct AiStatus {
    pub key_set: bool,
    pub base_url: String,
    pub model: String,
    pub onboarded: bool,
    pub key_error: Option<String>,
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<Settings, String> {
    // llm_api_key is skip_serializing: the key never crosses into the webview
    Settings::load(&app_data(&app))
}

#[tauri::command]
pub fn ai_status(app: AppHandle) -> Result<AiStatus, String> {
    let plain = Settings::load(&app_data(&app))?;
    let env = crate::distill::has_env_endpoint();
    let (key_set, key_error) = match settings_with_key(&app) {
        Ok(s) => (!s.llm_api_key.is_empty() || env, None),
        Err(e) => (env, Some(e)),
    };
    Ok(AiStatus {
        key_set,
        base_url: crate::ai_config::normalize_base_url(&plain.llm_base_url),
        model: crate::ai_config::effective_model(&plain.llm_model),
        onboarded: plain.onboarded,
        key_error,
    })
}

#[tauri::command]
pub fn complete_onboarding(app: AppHandle) -> Result<(), String> {
    let data = app_data(&app);
    let mut settings = Settings::load(&data)?;
    settings.onboarded = true;
    settings.save(&data)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    settings.save(&app_data(&app))
}

#[tauri::command]
pub fn resolve_notes_dir(app: AppHandle) -> Result<String, String> {
    let data = app_data(&app);
    let settings = Settings::load(&data)?;
    let root = notes_root(&data, &settings)?;
    fs::create_dir_all(&root).map_err(error)?;
    Ok(root.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_library(app: AppHandle) -> Result<Vec<LibraryEntry>, String> {
    let data = app_data(&app);
    let settings = Settings::load(&data)?;
    let root = notes_root(&data, &settings)?;
    list_notes(&root)
}

#[tauri::command]
pub fn read_note(app: AppHandle, subject: String, file: String) -> Result<Note, String> {
    let data = app_data(&app);
    let settings = Settings::load(&data)?;
    let root = notes_root(&data, &settings)?;
    let path = note_path(&root, &subject, &file)?;
    let text = fs::read_to_string(&path).map_err(error)?;
    Note::parse(&text)
}

#[tauri::command]
pub fn save_note(app: AppHandle, note: Note) -> Result<(), String> {
    let data = app_data(&app);
    let settings = Settings::load(&data)?;
    let root = notes_root(&data, &settings)?;
    let filename = format!("{}.md", note.file_stem());
    let subject_dir = safe_join(&root, &[&note.meta.subject])?;
    fs::create_dir_all(&subject_dir).map_err(error)?;
    let path = safe_join(&subject_dir, &[&filename])?;
    write_atomic(&path, note.render_markdown().as_bytes())
}

#[tauri::command]
pub fn delete_note(app: AppHandle, subject: String, file: String) -> Result<(), String> {
    let data = app_data(&app);
    let settings = Settings::load(&data)?;
    let root = notes_root(&data, &settings)?;
    let path = note_path(&root, &subject, &file)?;
    fs::remove_file(&path).map_err(error)?;
    Ok(())
}

#[tauri::command]
pub fn set_notes_dir(app: AppHandle, dir: String) -> Result<(), String> {
    let data = app_data(&app);
    let mut settings = Settings::load(&data)?;
    let previous = notes_root(&data, &settings)?;
    settings.notes_dir = Some(dir);
    let next = notes_root(&data, &settings)?;
    settings.save(&data)?;
    // Grades are keyed by chapter identity, so they mean nothing in another
    // library. Set the previous ones aside instead of deleting them.
    if previous != next {
        for name in ["study-state.json", "exam-history.json"] {
            let live = data.join(name);
            if live.exists() {
                let parked = data.join(format!("{name}.bak"));
                let _ = fs::remove_file(&parked);
                fs::rename(&live, &parked).map_err(error)?;
            }
        }
    }
    Ok(())
}

/// Generic export writer: the frontend builds styled HTML / markdown content
/// (it owns the diagram renderer) and Rust writes it wherever the user picked.
#[tauri::command]
pub fn write_export(dest: String, contents: String) -> Result<String, String> {
    let path = PathBuf::from(&dest);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&path, contents).map_err(error)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn export_note_markdown(note: Note, dest: String) -> Result<String, String> {
    let md = note.render_markdown();
    let path = PathBuf::from(&dest);
    fs::write(&path, md).map_err(error)?;
    Ok(path.to_string_lossy().to_string())
}

/// `api_key: None` keeps the saved key; `clear_key` removes it.
#[tauri::command]
pub fn set_llm_settings(
    app: AppHandle,
    base_url: String,
    model: String,
    api_key: Option<String>,
    clear_key: bool,
) -> Result<(), String> {
    let data = app_data(&app);
    let mut settings = Settings::load_migrated(&data, crate::keystore::set)?;
    settings.llm_base_url = crate::ai_config::normalize_base_url(&base_url);
    settings.llm_model = crate::ai_config::effective_model(&model);
    if clear_key {
        crate::keystore::clear()?;
    } else if let Some(k) = api_key.filter(|k| !k.trim().is_empty()) {
        crate::keystore::set(&k)?;
    }
    settings.save(&data)
}

/// Full pipeline: extract PDF text (or transcribe scanned pages) → distill via
/// LLM → save note to disk. Returns the saved note and its on-disk filename.
#[tauri::command]
pub async fn import_chapter(
    app: AppHandle,
    req: crate::distill::DistillRequest,
    page_images: Option<Vec<String>>,
) -> Result<crate::distill::ImportOutcome, String> {
    let data = app_data(&app);
    let settings = settings_with_key(&app)?;
    let root = notes_root(&data, &settings)?;

    // The target filename is fully determined by the request, so an existing
    // note is detected before any extraction or provider call is spent on it.
    let target = target_note_path(&root, &req.subject, &req.num, &req.title)?;
    if target.exists() && !req.allow_overwrite.unwrap_or(false) {
        let name = target.file_name().unwrap_or_default().to_string_lossy().to_string();
        return Err(format!("note_exists:{name}"));
    }

    // Chapter text: vision transcription (scanned PDF), office extraction
    // (docx/pptx), or direct PDF text — depending on what was supplied.
    let text = match &page_images {
        Some(pages) if !pages.is_empty() => {
            let imgs: Vec<crate::distill::PageImage> = pages
                .iter()
                .map(|b64| crate::distill::PageImage { b64_jpeg: b64.clone() })
                .collect();
            crate::distill::transcribe_pages(&settings, &imgs).await?
        }
        _ => {
            let path = std::path::Path::new(&req.pdf_path);
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            let t = match ext.as_str() {
                "docx" | "pptx" => crate::office::extract_office_text(path)?,
                _ => crate::distill::extract_pdf_text(path)?,
            };
            if t.trim().is_empty() {
                return Err("no text found in this file — scanned PDFs need an API key (add one in settings)".into());
            }
            t
        }
    };

    let draft = crate::distill::distill_chapter(&settings, &req, &text).await?;
    let note = crate::distill::assemble_note(&req, draft);

    let filename = format!("{}.md", note.file_stem());
    let path = target_note_path(&root, &note.meta.subject, &note.meta.num, &note.meta.title)?;
    if path.exists() && !req.allow_overwrite.unwrap_or(false) {
        return Err(format!("note_exists:{filename}"));
    }
    write_atomic(&path, note.render_markdown().as_bytes())?;
    Ok(crate::distill::ImportOutcome { note, file: filename })
}

/// Revision agent: answer a question from the given note excerpts first;
/// falls back to general knowledge (labeled) when the notes don't cover it.
/// The frontend picks the excerpts via its scored search index.
#[tauri::command]
pub async fn ask_notes(
    app: AppHandle,
    question: String,
    contexts: Vec<crate::distill::NoteContext>,
) -> Result<crate::distill::AskOutcome, String> {
    let settings = settings_with_key(&app)?;
    crate::distill::answer_from_notes(&settings, &question, &contexts).await
}

// ---------- study state (flashcard grades) ----------

fn study_state_path(app: &AppHandle) -> PathBuf {
    app_data(app).join("study-state.json")
}

/// Load the flashcard grading state: { cardId: {seen, missed, lastSeen} }.
#[tauri::command]
pub fn load_study_state(app: AppHandle) -> Result<serde_json::Value, String> {
    let p = study_state_path(&app);
    if !p.exists() {
        return Ok(serde_json::json!({}));
    }
    let text = fs::read_to_string(&p).map_err(error)?;
    let value: serde_json::Value = serde_json::from_str(&text).map_err(error)?;
    validate_study_state(&value)?;
    Ok(value)
}

/// Persist the whole grading state map (small file, whole-file write).
#[tauri::command]
pub fn save_study_state(app: AppHandle, state: serde_json::Value) -> Result<(), String> {
    validate_study_state(&state)?;
    let p = study_state_path(&app);
    let text = serde_json::to_string_pretty(&state).map_err(error)?;
    write_atomic(&p, text.as_bytes())
}

// ---------- theme ----------

/// Persist the UI theme ("midnight" or "light") in settings.
#[tauri::command]
pub fn set_theme(app: AppHandle, theme: String) -> Result<(), String> {
    let data = app_data(&app);
    let mut settings = Settings::load(&data)?;
    settings.theme = if theme == "midnight" { Some("midnight".into()) } else { None };
    settings.save(&data)
}

// ---------- quiz mode ----------

/// Generate a 5-8 MCQ quiz from a note's topics via the provider chain.
#[tauri::command]
pub async fn gen_quiz(
    app: AppHandle,
    note_title: String,
    topics_text: String,
) -> Result<Vec<crate::distill::QuizItem>, String> {
    let settings = settings_with_key(&app)?;
    crate::distill::generate_quiz(&settings, &note_title, &topics_text).await
}

// ---------- practice writing (exam trainer) ----------

/// Grade one hand-written practice answer against the note's model answer.
#[tauri::command]
pub async fn grade_written(
    app: AppHandle,
    topic_title: String,
    model_answer: String,
    student_answer: String,
) -> Result<crate::distill::WrittenGrade, String> {
    let settings = settings_with_key(&app)?;
    crate::distill::grade_written_answer(&settings, &topic_title, &model_answer, &student_answer).await
}

// ---------- mock exam (exam simulator) ----------

/// Generate LLM-written exam questions from topic content.
#[tauri::command]
pub async fn gen_written_questions(
    app: AppHandle,
    subjects: String,
    topics_text: String,
    count: usize,
) -> Result<Vec<crate::distill::WrittenQuestion>, String> {
    let settings = settings_with_key(&app)?;
    crate::distill::generate_written_questions(&settings, &subjects, &topics_text, count).await
}

/// Grade a submitted mock exam in one batched call.
#[tauri::command]
pub async fn grade_exam(
    app: AppHandle,
    paper_json: String,
    answers: Vec<String>,
) -> Result<Vec<crate::distill::ExamQResult>, String> {
    let settings = settings_with_key(&app)?;
    crate::distill::grade_exam(&settings, paper_json, answers).await
}

fn exam_history_path(app: &AppHandle) -> PathBuf {
    app_data(app).join("exam-history.json")
}

/// Load the mock-exam attempt history: newest first on the dashboard.
#[tauri::command]
pub fn load_exam_history(app: AppHandle) -> Result<serde_json::Value, String> {
    let p = exam_history_path(&app);
    if !p.exists() {
        return Ok(serde_json::json!([]));
    }
    let text = fs::read_to_string(&p).map_err(error)?;
    let value: serde_json::Value = serde_json::from_str(&text).map_err(error)?;
    if !value.is_array() {
        return Err("exam history must be a JSON array".to_string());
    }
    Ok(value)
}

/// Persist the whole attempt history (small file, whole-file write).
#[tauri::command]
pub fn save_exam_history(app: AppHandle, history: serde_json::Value) -> Result<(), String> {
    if !history.is_array() {
        return Err("exam history must be a JSON array".to_string());
    }
    let p = exam_history_path(&app);
    let text = serde_json::to_string_pretty(&history).map_err(error)?;
    write_atomic(&p, text.as_bytes())
}
