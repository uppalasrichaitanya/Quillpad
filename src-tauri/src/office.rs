//! Office-file text extraction (DOCX/PPTX) — both are zips of XML.
//! Same approach as the Python probe (scripts/gen_ids_notes.py docx_text):
//! unzip, read the document/slides XML, strip tags, normalise whitespace.

use std::io::Read;

/// Extract readable text from a .docx or .pptx file.
pub fn extract_office_text(path: &std::path::Path) -> Result<String, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("open office file: {e}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("unzip: {e}"))?;

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let targets: Vec<String> = match ext.as_str() {
        "docx" => vec!["word/document.xml".to_string()],
        "pptx" => {
            // slides in order: slide1.xml, slide2.xml, ... (zero-padded varies)
            let mut names: Vec<String> = (0..archive.len())
                .filter_map(|i| archive.by_index(i).ok().map(|f| f.name().to_string()))
                .filter(|n| n.starts_with("ppt/slides/slide") && n.ends_with(".xml"))
                .collect();
            names.sort_by(|a, b| natural_slide_cmp(a, b));
            names
        }
        _ => return Err("not a docx/pptx".into()),
    };

    let mut out = String::new();
    for name in &targets {
        if let Ok(mut entry) = archive.by_name(name) {
            let mut xml = String::new();
            if entry.read_to_string(&mut xml).is_ok() {
                out.push_str(&xml_to_text(&xml));
                out.push_str("\n\n");
            }
        }
    }
    if out.trim().is_empty() {
        return Err("no text found in office file".into());
    }
    Ok(out)
}

/// slide2 < slide10 (natural order), not lexicographic.
fn natural_slide_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    let na = a.trim_start_matches("ppt/slides/slide").trim_end_matches(".xml");
    let nb = b.trim_start_matches("ppt/slides/slide").trim_end_matches(".xml");
    na.parse::<u64>()
        .and_then(|x| Ok((x, nb.parse::<u64>()?)))
        .map(|(x, y)| x.cmp(&y))
        .unwrap_or_else(|_| a.cmp(b))
}

/// Convert OOXML to plain text: paragraph breaks -> newlines, tags stripped.
fn xml_to_text(xml: &str) -> String {
    let mut text = String::with_capacity(xml.len() / 2);
    let mut rest = xml;
    // <w:p ...> closes a paragraph; <a:p> in pptx; treat both as line breaks
    while let Some(pos) = rest.find('<') {
        text.push_str(&rest[..pos]);
        let end = match rest[pos..].find('>') {
            Some(e) => pos + e,
            None => break,
        };
        let tag = &rest[pos + 1..end];
        if tag.starts_with("/w:p") || tag.starts_with("/a:p") || tag == "w:br" {
            text.push('\n');
        }
        rest = &rest[end + 1..];
    }
    text.push_str(rest);
    // normalise: collapse runs of spaces, trim each line, drop empties
    let mut clean = String::new();
    for line in text.lines() {
        let l = line.split_whitespace().collect::<Vec<_>>().join(" ");
        if !l.is_empty() {
            clean.push_str(&l);
            clean.push('\n');
        }
    }
    clean
}
