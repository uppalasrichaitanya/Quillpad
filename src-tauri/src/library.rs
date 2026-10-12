use crate::note::Note;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryEntry {
    pub subject: String,
    pub num: String,
    pub title: String,
    pub file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    #[serde(default)]
    pub notes_dir: Option<String>,
    #[serde(default = "default_base_url")]
    pub llm_base_url: String,
    #[serde(default = "default_model")]
    pub llm_model: String,
    /// Runtime only: filled from the OS credential store. Read from disk solely
    /// to migrate keys saved by 0.1 (which stored them in plain text); never
    /// written back.
    #[serde(default, skip_serializing)]
    pub llm_api_key: String,
    /// "midnight" for the dark theme; absent = default cream paper.
    #[serde(default)]
    pub theme: Option<String>,
    /// Set once the first-run welcome has been completed or skipped.
    #[serde(default)]
    pub onboarded: bool,
}

fn default_base_url() -> String {
    crate::ai_config::DEFAULT_BASE_URL.to_string()
}

fn default_model() -> String {
    crate::ai_config::DEFAULT_MODEL.to_string()
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            notes_dir: None,
            llm_base_url: default_base_url(),
            llm_model: default_model(),
            llm_api_key: String::new(),
            theme: None,
            onboarded: false,
        }
    }
}

impl Settings {
    pub fn load(app_data: &Path) -> Result<Settings, String> {
        let p = app_data.join("settings.json");
        if !p.exists() {
            return Ok(Settings::default());
        }
        let text = fs::read_to_string(&p).map_err(|e| e.to_string())?;
        serde_json::from_str(&text).map_err(|e| e.to_string())
    }

    pub fn save(&self, app_data: &Path) -> Result<(), String> {
        let p = app_data.join("settings.json");
        let text = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        write_atomic(&p, text.as_bytes())
    }
}

/// Replace a file in one step: content lands in a sibling temp file first, so a
/// crash mid-write can never leave a truncated document behind.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let tmp = path.with_file_name(format!(".{name}.tmp"));
    fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    // Windows rename will not overwrite an existing file, so clear the old copy
    // first: a crash may lose the file outright but never corrupts it.
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    if let Err(e) = fs::rename(&tmp, path) {
        let _ = fs::remove_file(&tmp);
        return Err(e.to_string());
    }
    Ok(())
}

/// Join frontend-supplied segments under `root`, refusing anything that could
/// reach outside it: separators, `.`/`..`, drive-relative and absolute forms.
pub fn safe_join(root: &Path, segments: &[&str]) -> Result<PathBuf, String> {
    let mut path = root.to_path_buf();
    for seg in segments {
        let s = seg.trim();
        if s.is_empty() {
            return Err("empty path segment".to_string());
        }
        if s == "." || s == ".." {
            return Err(format!("invalid path segment: {s}"));
        }
        if s.contains('/') || s.contains('\\') {
            return Err(format!("invalid path segment: {s}"));
        }
        let chars: Vec<char> = s.chars().collect();
        if chars.len() >= 2 && chars[1] == ':' && chars[0].is_ascii_alphabetic() {
            return Err(format!("invalid path segment: {s}"));
        }
        if Path::new(s).is_absolute() {
            return Err(format!("invalid path segment: {s}"));
        }
        path.push(s);
    }
    Ok(path)
}

/// Where notes live on disk: user-chosen folder, or `<app_data>/Quillpad`.
pub fn notes_root(app_data: &Path, settings: &Settings) -> Result<PathBuf, String> {
    match &settings.notes_dir {
        Some(dir) if !dir.trim().is_empty() => Ok(PathBuf::from(dir)),
        _ => Ok(app_data.join("Quillpad")),
    }
}

/// Scan the notes root: one folder per subject, one `.md` per chapter.
pub fn list_notes(root: &Path) -> Result<Vec<LibraryEntry>, String> {
    let mut out: Vec<LibraryEntry> = Vec::new();
    if !root.exists() {
        return Ok(out);
    }
    let subjects = fs::read_dir(root).map_err(|e| e.to_string())?;
    for subject in subjects {
        let subject = subject.map_err(|e| e.to_string())?;
        if !subject.path().is_dir() {
            continue;
        }
        let sname = subject.file_name().to_string_lossy().to_string();
        let files = fs::read_dir(subject.path()).map_err(|e| e.to_string())?;
        for file in files {
            let file = file.map_err(|e| e.to_string())?;
            let fname = file.file_name().to_string_lossy().to_string();
            if !fname.ends_with(".md") {
                continue;
            }
            let text = match fs::read_to_string(file.path()) {
                Ok(t) => t,
                Err(_) => continue,
            };
            if let Ok(note) = Note::parse(&text) {
                out.push(LibraryEntry {
                    subject: sname.clone(),
                    num: note.meta.num,
                    title: note.meta.title,
                    file: fname.clone(),
                });
            }
        }
    }
    out.sort_by(|a, b| {
        a.subject.cmp(&b.subject).then_with(|| {
            // chapter numbers read as numbers, so 2 sorts before 10
            let an = a.num.parse::<u64>().unwrap_or(u64::MAX);
            let bn = b.num.parse::<u64>().unwrap_or(u64::MAX);
            an.cmp(&bn).then_with(|| a.num.cmp(&b.num))
        })
        .then_with(|| a.file.cmp(&b.file))
    });
    Ok(out)
}
