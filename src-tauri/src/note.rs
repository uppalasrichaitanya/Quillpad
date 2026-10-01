use serde::{Deserialize, Serialize};

/// Front-matter written at the top of every note on disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteMeta {
    pub subject: String,
    pub num: String,
    pub title: String,
    #[serde(default)]
    pub questions: Vec<String>,
    #[serde(default)]
    pub created: Option<String>,
    #[serde(default)]
    pub pdf_path: Option<String>,
}

/// A diagram as structured data — rendered to hand-drawn-style SVG by the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data", rename_all = "kebab-case")]
pub enum DiagramSpec {
    /// A rounded organic blob with parts inside, each part labelled with leader lines.
    LabelledBlob(LabelledBlobData),
    /// A grid of boxes with trend arrows, for table-like or trend diagrams.
    TrendGrid(TrendGridData),
    /// A left-to-right flow: boxes connected by arrows.
    ProcessFlow(ProcessFlowData),
    /// A rooted tree (or forest) — disjoint sets, state-space/recursion trees.
    Tree(TreeData),
    /// Stacked horizontal bands — OSI/TCP-IP layer stacks, cross-sections.
    LayerStack(LayerStackData),
    /// A segmented horizontal strip — frame formats, packet headers, spectra.
    FormatStrip(FormatStripData),
    /// A distribution curve — bell curves, skewed/poisson shapes.
    DistributionCurve(DistributionCurveData),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabelledBlobData {
    pub caption: String,
    /// What the outline represents (used as alt text).
    pub outline: String,
    pub parts: Vec<LabelledBlobPart>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabelledBlobPart {
    pub label: String,
    pub kind: PartKind,
    #[serde(default)]
    pub accent: bool,
    #[serde(default = "default_count")]
    pub count: u32,
    #[serde(default)]
    pub size: Option<String>,
}

fn default_count() -> u32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PartKind {
    /// Drawn as an oval outline (e.g. nucleus, mitochondria).
    Oval,
    /// Drawn as small filled dots (e.g. ribosomes).
    Dot,
    /// Drawn as short squiggly strokes (e.g. ER).
    Squiggle,
    /// A label whose leader points at the blob's own outline (e.g. membrane).
    Edge,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendGridData {
    pub caption: String,
    pub rows: u32,
    pub cols: u32,
    pub trends: Vec<TrendArrow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendArrow {
    /// "right", "left", "up" or "down"
    pub direction: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessFlowData {
    pub caption: String,
    pub steps: Vec<ProcessStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessStep {
    pub label: String,
    #[serde(default)]
    pub note: Option<String>,
}

/// A node in a tree diagram.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeNode {
    pub label: String,
    #[serde(default)]
    pub accent: bool,
    #[serde(default)]
    pub children: Vec<TreeNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeData {
    pub caption: String,
    /// One or more roots — a single root renders one tree, several render a forest.
    pub trees: Vec<TreeNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayerStackData {
    pub caption: String,
    /// Bands from top to bottom (e.g. OSI: application first, physical last).
    pub layers: Vec<Layer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Layer {
    pub label: String,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub accent: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatStripData {
    pub caption: String,
    /// Segments left to right (header, payload, trailer… or spectrum bands).
    pub fields: Vec<StripField>,
    /// Optional trend arrow over the strip (e.g. "frequency increases").
    #[serde(default)]
    pub arrow: Option<TrendArrow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StripField {
    pub label: String,
    /// Relative width — 1 is the unit; 2 takes twice the space. Defaults to 1.
    #[serde(default = "strip_default_flex")]
    pub flex: u32,
    #[serde(default)]
    pub accent: bool,
}

fn strip_default_flex() -> u32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DistributionCurveData {
    pub caption: String,
    /// Curve shape: normal (default), skewed-right, skewed-left, bimodal, flat, poisson.
    #[serde(default)]
    pub shape: Option<String>,
    /// Label for the centre/mean line (defaults to "mean").
    #[serde(default)]
    pub mean_label: Option<String>,
    /// X-axis tick labels.
    #[serde(default)]
    pub ticks: Vec<String>,
    /// Side annotations with dashed leader lines.
    #[serde(default)]
    pub notes: Vec<String>,
}

/// A note parsed from a `.md` file on disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub meta: NoteMeta,
    pub summary: String,
    pub key_points: Vec<String>,
    #[serde(default)]
    pub diagrams: Vec<DiagramSpec>,
    #[serde(default)]
    pub qa: Vec<QaPair>,
    pub recap: String,
    /// Topic-flow format: each topic carries its own explanation, diagrams and
    /// Q&A inline. Older notes have none and render via the flat sections.
    #[serde(default)]
    pub topics: Vec<Topic>,
}

/// One topic section of a note.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Topic {
    pub title: String,
    /// Explanation paragraphs (HTML-ish text, like the rest of the note).
    pub body: Vec<String>,
    #[serde(default)]
    pub diagrams: Vec<DiagramSpec>,
    #[serde(default)]
    pub qa: Vec<QaPair>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QaPair {
    pub q: String,
    pub a: String,
}

impl Note {
    /// Parse a note from markdown text: `---` front-matter, then `##` sections.
    pub fn parse(text: &str) -> Result<Self, String> {
        let (fm, body) = split_front_matter(text)?;
        let meta: NoteMeta =
            serde_yaml::from_str(&fm).map_err(|e| format!("front-matter: {e}"))?;
        let summary = extract_section(&body, "summary");
        let key_points = extract_list_section(&body, "key points");
        let recap = extract_section(&body, "quick recap");
        let qa = extract_qa(&body);
        let diagrams = extract_diagrams(&body);
        let topics = extract_topics(&body);
        Ok(Note { meta, summary, key_points, diagrams, qa, recap, topics })
    }

    /// Render this note back to markdown for writing to disk or exporting.
    /// Topic-flow notes (topics non-empty) render summary → topics → recap;
    /// legacy notes keep the old flat section layout.
    pub fn render_markdown(&self) -> String {
        let mut out = String::new();
        out.push_str("---\n");
        out.push_str(&serde_yaml::to_string(&self.meta).unwrap_or_default());
        out.push_str("---\n\n");
        out.push_str("## summary\n\n");
        out.push_str(self.summary.trim());
        out.push('\n');

        if !self.topics.is_empty() {
            for topic in &self.topics {
                out.push_str("\n## ");
                out.push_str(topic.title.trim());
                out.push_str("\n\n");
                for para in &topic.body {
                    out.push_str(para.trim());
                    out.push_str("\n\n");
                }
                for d in &topic.diagrams {
                    out.push_str("```quill-diagram\n");
                    out.push_str(&serde_json::to_string_pretty(d).unwrap_or_default());
                    out.push_str("\n```\n\n");
                }
                if !topic.qa.is_empty() {
                    out.push_str("### questions\n\n");
                    for item in &topic.qa {
                        out.push_str("**");
                        out.push_str(&item.q);
                        out.push_str("**\n\n");
                        out.push_str(item.a.trim());
                        out.push_str("\n\n");
                    }
                }
            }
        } else {
            // legacy flat layout
            out.push_str("\n## key points\n\n");
            for p in &self.key_points {
                out.push_str("- ");
                out.push_str(p);
                out.push('\n');
            }
            if !self.qa.is_empty() {
                out.push_str("\n## questions answered\n\n");
                for item in &self.qa {
                    out.push_str("**");
                    out.push_str(&item.q);
                    out.push_str("**\n\n");
                    out.push_str(item.a.trim());
                    out.push_str("\n\n");
                }
            }
            if !self.diagrams.is_empty() {
                out.push_str("\n## diagrams\n\n");
                for d in &self.diagrams {
                    out.push_str("```quill-diagram\n");
                    out.push_str(&serde_json::to_string_pretty(d).unwrap_or_default());
                    out.push_str("\n```\n\n");
                }
            }
        }

        out.push_str("\n## quick recap\n\n");
        out.push_str(self.recap.trim());
        out.push('\n');
        out
    }

    pub fn file_stem(&self) -> String {
        format!("{}-{}", self.meta.num, slug(&self.meta.title))
    }
}

/// Reserved `##` headings that mark note-level sections, not topics.
const RESERVED_HEADINGS: &[&str] = &["summary", "key points", "questions answered", "diagrams", "quick recap"];

/// Parse topic-flow sections: each `## <title>` that isn't a reserved heading
/// starts a topic. Inside: paragraphs, ```quill-diagram fences, and an
/// optional `### questions` subsection with **q** blocks.
fn extract_topics(body: &str) -> Vec<Topic> {
    let mut topics: Vec<Topic> = Vec::new();
    // state machine over lines; diagram fences are collected wherever they appear
    let mut in_diagram = false;
    let mut diagram_block = String::new();
    let mut in_questions = false;
    let mut current_q: Option<QaPair> = None;

    let flush_q = |topics: &mut Vec<Topic>, current_q: &mut Option<QaPair>| {
        if let Some(q) = current_q.take() {
            if let Some(t) = topics.last_mut() {
                t.qa.push(q);
            }
        }
    };

    for line in body.lines() {
        let t = line.trim();
        if in_diagram {
            if t == "```" {
                in_diagram = false;
                if let Ok(d) = serde_json::from_str::<DiagramSpec>(&diagram_block) {
                    if let Some(topic) = topics.last_mut() {
                        topic.diagrams.push(d);
                    }
                }
                diagram_block.clear();
            } else {
                diagram_block.push_str(line);
                diagram_block.push('\n');
            }
            continue;
        }
        if t == "```quill-diagram" {
            in_diagram = true;
            in_questions = false;
            continue;
        }
        if let Some(title) = line.strip_prefix("## ") {
            let title = title.trim().to_string();
            let lower = title.to_lowercase();
            if RESERVED_HEADINGS.contains(&lower.as_str()) {
                in_questions = false;
                continue; // note-level section, not a topic
            }
            flush_q(&mut topics, &mut current_q);
            in_questions = false;
            topics.push(Topic { title, body: Vec::new(), diagrams: Vec::new(), qa: Vec::new() });
            continue;
        }
        if line.strip_prefix("### ").is_some() {
            // `### questions` toggles the Q&A collector inside a topic
            in_questions = t.to_lowercase() == "### questions";
            continue;
        }
        let Some(topic) = topics.last_mut() else { continue };
        if in_questions {
            if t.is_empty() {
                continue;
            }
            if t.starts_with("**") && t.ends_with("**") && t.len() > 4 {
                flush_q(&mut topics, &mut current_q);
                current_q = Some(QaPair { q: t[2..t.len() - 2].to_string(), a: String::new() });
            } else if let Some(pair) = current_q.as_mut() {
                if !pair.a.is_empty() {
                    pair.a.push(' ');
                }
                pair.a.push_str(t);
            }
        } else if !t.is_empty() {
            topic.body.push(t.to_string());
        }
    }
    flush_q(&mut topics, &mut current_q);
    topics
}

fn split_front_matter(text: &str) -> Result<(String, String), String> {
    let t = text.trim_start();
    let rest = t.strip_prefix("---").ok_or("missing front-matter")?;
    let end = rest.find("\n---").ok_or("unterminated front-matter")?;
    let fm = rest[..end].to_string();
    let body = rest[end + 4..].trim_start_matches('\n').to_string();
    Ok((fm, body))
}

/// All `## heading` sections of the body, lowercase headings, trimmed content.
fn extract_sections(body: &str) -> Vec<(String, String)> {
    let mut sections: Vec<(String, String)> = Vec::new();
    for line in body.lines() {
        if let Some(rest) = line.strip_prefix("## ") {
            sections.push((rest.trim().to_lowercase(), String::new()));
        } else if let Some(last) = sections.last_mut() {
            last.1.push_str(line);
            last.1.push('\n');
        }
    }
    sections
        .iter_mut()
        .for_each(|(_, c)| *c = c.trim().to_string());
    sections
}

fn extract_section(body: &str, name: &str) -> String {
    extract_sections(body)
        .into_iter()
        .find(|(h, _)| h == name)
        .map(|(_, c)| c)
        .unwrap_or_default()
}

fn extract_list_section(body: &str, name: &str) -> Vec<String> {
    extract_section(body, name)
        .lines()
        .map(|l| l.trim().trim_start_matches('-').trim().to_string())
        .filter(|l| !l.is_empty())
        .collect()
}

fn extract_qa(body: &str) -> Vec<QaPair> {
    let section = extract_section(body, "questions answered");
    let mut out: Vec<QaPair> = Vec::new();
    let mut current: Option<QaPair> = None;
    for line in section.lines() {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }
        if t.starts_with("**") && t.ends_with("**") && t.len() > 4 {
            if let Some(done) = current.take() {
                out.push(done);
            }
            current = Some(QaPair { q: t[2..t.len() - 2].to_string(), a: String::new() });
        } else if let Some(pair) = current.as_mut() {
            if !pair.a.is_empty() {
                pair.a.push(' ');
            }
            pair.a.push_str(t);
        }
    }
    if let Some(done) = current.take() {
        out.push(done);
    }
    out
}

/// Fenced ```quill-diagram blocks may appear anywhere in the body.
fn extract_diagrams(body: &str) -> Vec<DiagramSpec> {
    let mut out = Vec::new();
    let mut in_block = false;
    let mut block = String::new();
    for line in body.lines() {
        let t = line.trim();
        if !in_block && t == "```quill-diagram" {
            in_block = true;
            block.clear();
        } else if in_block && t == "```" {
            in_block = false;
            if let Ok(d) = serde_json::from_str::<DiagramSpec>(&block) {
                out.push(d);
            }
        } else if in_block {
            block.push_str(line);
            block.push('\n');
        }
    }
    out
}

pub fn slug(s: &str) -> String {
    let mut out = String::new();
    let mut prev_dash = false;
    for ch in s.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            prev_dash = false;
        } else if (ch == ' ' || ch == '-' || ch == '_') && !out.is_empty() && !prev_dash {
            out.push('-');
            prev_dash = true;
        }
    }
    while out.starts_with('-') {
        out.remove(0);
    }
    while out.ends_with('-') {
        out.pop();
    }
    out
}
