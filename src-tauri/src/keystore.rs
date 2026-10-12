//! The API key lives in the OS credential store (Windows Credential Manager),
//! never in settings.json.

const SERVICE: &str = "com.quillpad.app";
const USER: &str = "llm_api_key";

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, USER).map_err(|e| format!("credential store unavailable: {e}"))
}

pub fn get() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(k) if !k.trim().is_empty() => Ok(Some(k)),
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("could not read the saved key: {e}")),
    }
}

pub fn set(key: &str) -> Result<(), String> {
    entry()?
        .set_password(key.trim())
        .map_err(|e| format!("could not save the key: {e}"))
}

pub fn clear() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("could not remove the key: {e}")),
    }
}

/// Pull a 0.1-era plaintext key out of loaded settings (caller stores it).
pub fn take_plaintext(s: &mut crate::library::Settings) -> Option<String> {
    let k = std::mem::take(&mut s.llm_api_key);
    let k = k.trim();
    if k.is_empty() {
        None
    } else {
        Some(k.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plaintext_key_is_taken_and_cleared() {
        let mut s: crate::library::Settings =
            serde_json::from_str(r#"{"llm_api_key":"  sk-ant-123\n"}"#).unwrap();
        assert_eq!(take_plaintext(&mut s).as_deref(), Some("sk-ant-123"));
        assert!(s.llm_api_key.is_empty());
        let json = serde_json::to_string(&s).unwrap();
        assert!(!json.contains("llm_api_key"), "key must never serialize: {json}");
    }

    #[test]
    fn blank_plaintext_key_is_ignored() {
        let mut s: crate::library::Settings =
            serde_json::from_str(r#"{"llm_api_key":"   "}"#).unwrap();
        assert_eq!(take_plaintext(&mut s), None);
    }

    #[test]
    fn missing_entry_reads_as_no_key() {
        keyring::set_default_credential_builder(keyring::mock::default_credential_builder());
        assert_eq!(get(), Ok(None));
    }
}
