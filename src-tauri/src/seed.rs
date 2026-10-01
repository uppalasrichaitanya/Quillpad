use crate::note::Note;
use std::fs;
use std::path::Path;

/// Seed the notes folder with the five prototype chapters, in real note format,
/// on first run (only when the notes root has no subjects yet).
pub fn seed_if_empty(root: &Path) -> Result<(), String> {
    let has_notes = fs::read_dir(root)
        .map(|mut it| it.any(|e| e.map(|e| e.path().is_dir()).unwrap_or(false)))
        .map_err(|e| e.to_string())?;
    if has_notes {
        return Ok(());
    }

    const SEEDS: &str = include_str!("../../notebook-seed/seed.json");
    let notes: Vec<Note> = serde_json::from_str(SEEDS).map_err(|e| e.to_string())?;
    for note in &notes {
        let dir = root.join(&note.meta.subject);
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let path = dir.join(format!("{}.md", note.file_stem()));
        fs::write(&path, note.render_markdown()).map_err(|e| e.to_string())?;
    }
    Ok(())
}
