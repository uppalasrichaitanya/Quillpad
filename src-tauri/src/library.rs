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
    /// Runtime only: filled from the OS credential store. On disk it exists
    /// only as a 0.1-era plaintext key awaiting migration: migration empties
    /// it, and it is written back only while non-empty — so a key whose move
    /// to the credential store failed survives later saves instead of being
    /// silently dropped. Never save a Settings filled by settings_with_key.
    #[serde(default, skip_serializing_if = "String::is_empty")]
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

    /// Load settings and repair what 0.1 left behind: a plaintext API key
    /// (handed to `store_key`, then dropped from disk) and the OpenAI-shaped
    /// defaults. Saves only when something changed.
    pub fn load_migrated(
        app_data: &Path,
        store_key: impl FnOnce(&str) -> Result<(), String>,
    ) -> Result<Settings, String> {
        let mut settings = Settings::load(app_data)?;
        let mut dirty = crate::ai_config::migrate_legacy(&mut settings);
        if let Some(plain) = crate::keystore::take_plaintext(&mut settings) {
            // store first: if that fails the key stays on disk, not lost
            store_key(&plain)?;
            dirty = true;
        }
        if dirty {
            settings.save(app_data)?;
        }
        Ok(settings)
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

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("quillpad-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn plaintext_key_moves_to_store_and_leaves_disk() {
        let d = temp_dir("migrate");
        fs::write(
            d.join("settings.json"),
            r#"{"llm_base_url":"https://api.openai.com/v1","llm_model":"gpt-4o-mini","llm_api_key":"sk-ant-1","theme":"midnight"}"#,
        )
        .unwrap();
        let mut stored = None;
        let s = Settings::load_migrated(&d, |k| {
            stored = Some(k.to_string());
            Ok(())
        })
        .unwrap();
        assert_eq!(stored.as_deref(), Some("sk-ant-1"));
        assert_eq!(s.llm_model, crate::ai_config::DEFAULT_MODEL);
        assert_eq!(s.theme.as_deref(), Some("midnight"));
        let on_disk = fs::read_to_string(d.join("settings.json")).unwrap();
        assert!(!on_disk.contains("sk-ant-1"), "{on_disk}");
        assert!(on_disk.contains("claude-opus-5-5"), "{on_disk}");
    }

    #[test]
    fn store_failure_keeps_key_on_disk() {
        let d = temp_dir("storefail");
        fs::write(d.join("settings.json"), r#"{"llm_api_key":"sk-ant-2"}"#).unwrap();
        let r = Settings::load_migrated(&d, |_| Err("no store".into()));
        assert!(r.is_err());
        let on_disk = fs::read_to_string(d.join("settings.json")).unwrap();
        assert!(on_disk.contains("sk-ant-2"), "key must not be lost: {on_disk}");
    }

    #[test]
    fn unmigrated_key_survives_a_later_unrelated_save() {
        // credential store down at startup → key stays on disk; then the user
        // changes theme (load → save). The key must still be there.
        let d = temp_dir("resave");
        fs::write(d.join("settings.json"), r#"{"llm_api_key":"sk-ant-3"}"#).unwrap();
        assert!(Settings::load_migrated(&d, |_| Err("no store".into())).is_err());
        let mut s = Settings::load(&d).unwrap();
        s.theme = Some("midnight".into());
        s.save(&d).unwrap();
        let on_disk = fs::read_to_string(d.join("settings.json")).unwrap();
        assert!(on_disk.contains("sk-ant-3"), "key lost on re-save: {on_disk}");
    }

    #[test]
    fn clean_settings_are_not_rewritten() {
        let d = temp_dir("clean");
        let s = Settings::load_migrated(&d, |_| panic!("no key to store")).unwrap();
        assert!(!s.onboarded);
        assert!(!d.join("settings.json").exists());
    }
}
