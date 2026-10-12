//! Distiller endpoint configuration: defaults, URL hygiene, legacy-settings
//! migration and human-readable connection errors. Pure functions only so
//! every rule is unit-tested.

use crate::library::Settings;

pub const DEFAULT_BASE_URL: &str = "https://api.anthropic.com";
pub const DEFAULT_MODEL: &str = "claude-opus-5-5";

/// Accept whatever a user pastes (`…/v1`, `…/v1/messages/`, stray whitespace)
/// and reduce it to the bare origin the request URLs are built from.
pub fn normalize_base_url(raw: &str) -> String {
    let mut s = raw.trim().trim_end_matches('/').to_string();
    for suffix in ["/messages", "/v1"] {
        if s.ends_with(suffix) {
            s.truncate(s.len() - suffix.len());
            s = s.trim_end_matches('/').to_string();
        }
    }
    if s.is_empty() {
        DEFAULT_BASE_URL.to_string()
    } else {
        s
    }
}

pub fn effective_model(raw: &str) -> String {
    let m = raw.trim();
    if m.is_empty() {
        DEFAULT_MODEL.to_string()
    } else {
        m.to_string()
    }
}

pub fn messages_url(base: &str) -> String {
    format!("{}/v1/messages", normalize_base_url(base))
}

pub fn models_url(base: &str) -> String {
    format!("{}/v1/models", normalize_base_url(base))
}

/// Anthropic's own API — the only place first-party-only request fields
/// (effort, server-side fallbacks) are safe to send.
pub fn is_first_party(base: &str) -> bool {
    let b = normalize_base_url(base);
    let host = b.split("://").nth(1).unwrap_or(&b).split('/').next().unwrap_or("");
    host == "api.anthropic.com"
}

/// 0.1 shipped OpenAI-shaped defaults that never worked with the Messages API.
pub fn migrate_legacy(s: &mut Settings) -> bool {
    let legacy_url = s.llm_base_url.trim().trim_end_matches('/') == "https://api.openai.com/v1";
    let legacy_model = s.llm_model.trim() == "gpt-4o-mini";
    if legacy_url && legacy_model {
        s.llm_base_url = DEFAULT_BASE_URL.to_string();
        s.llm_model = DEFAULT_MODEL.to_string();
        return true;
    }
    false
}

pub fn describe_status(status: u16, body: &str) -> String {
    match status {
        401 | 403 => "that key was rejected — check it was copied in full".to_string(),
        404 => "nothing answered at that address — check the base URL in settings".to_string(),
        429 => "the AI service is rate limiting you — wait a minute and try again".to_string(),
        500..=599 => "the AI service is busy right now — try again shortly".to_string(),
        _ => {
            let detail = serde_json::from_str::<serde_json::Value>(body)
                .ok()
                .and_then(|v| {
                    v.pointer("/error/message")
                        .and_then(|m| m.as_str())
                        .map(str::to_string)
                })
                .unwrap_or_else(|| body.lines().next().unwrap_or("").chars().take(160).collect());
            format!("the AI service returned {status}: {detail}")
        }
    }
}

pub fn no_key_message() -> &'static str {
    "add an API key in settings to use AI features — reading, search, flashcards and exams work without one"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_base_url_uses_default() {
        assert_eq!(normalize_base_url(""), DEFAULT_BASE_URL);
        assert_eq!(normalize_base_url("   "), DEFAULT_BASE_URL);
    }

    #[test]
    fn base_url_strips_trailing_slash_v1_and_messages() {
        for raw in [
            "https://api.anthropic.com",
            "https://api.anthropic.com/",
            "https://api.anthropic.com/v1",
            "https://api.anthropic.com/v1/",
            "https://api.anthropic.com/v1/messages",
            "  https://api.anthropic.com/v1/messages/ \n",
        ] {
            assert_eq!(normalize_base_url(raw), "https://api.anthropic.com", "input {raw:?}");
        }
    }

    #[test]
    fn urls_are_built_from_normalized_base() {
        assert_eq!(messages_url("https://x.dev/v1/"), "https://x.dev/v1/messages");
        assert_eq!(models_url(""), "https://api.anthropic.com/v1/models");
    }

    #[test]
    fn empty_model_uses_default() {
        assert_eq!(effective_model(""), DEFAULT_MODEL);
        assert_eq!(effective_model(" claude-sonnet-5-5 "), "claude-sonnet-5-5");
    }

    #[test]
    fn first_party_detection() {
        assert!(is_first_party(""));
        assert!(is_first_party("https://api.anthropic.com/v1"));
        assert!(!is_first_party("https://gateway.example.com"));
        assert!(!is_first_party("https://api.anthropic.com.evil.dev"));
    }

    #[test]
    fn legacy_openai_defaults_migrate() {
        let mut s = Settings::default();
        s.llm_base_url = "https://api.openai.com/v1".into();
        s.llm_model = "gpt-4o-mini".into();
        assert!(migrate_legacy(&mut s));
        assert_eq!(s.llm_base_url, DEFAULT_BASE_URL);
        assert_eq!(s.llm_model, DEFAULT_MODEL);
    }

    #[test]
    fn custom_settings_are_left_alone() {
        let mut s = Settings::default();
        s.llm_base_url = "https://gateway.example.com".into();
        s.llm_model = "my-model".into();
        assert!(!migrate_legacy(&mut s));
        assert_eq!(s.llm_model, "my-model");
    }

    #[test]
    fn status_messages_are_plain_english() {
        assert!(describe_status(401, "").contains("key was rejected"));
        assert!(describe_status(403, "").contains("key was rejected"));
        assert!(describe_status(404, "").contains("address"));
        assert!(describe_status(429, "").contains("rate"));
        assert!(describe_status(529, "").contains("busy"));
        let other = describe_status(400, "{\"error\":{\"message\":\"bad thing\"}}\nmore");
        assert!(other.contains("400") && other.contains("bad thing"));
    }

    #[test]
    fn no_key_message_points_to_settings() {
        assert!(no_key_message().contains("settings"));
        assert!(!no_key_message().contains(".env"));
    }
}
