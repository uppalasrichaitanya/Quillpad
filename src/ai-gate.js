// One cached view of "can AI features run?" so every AI action can check it
// before calling Rust, and show a friendly prompt instead of a raw error.
import { invoke } from '@tauri-apps/api/core';

let status = { key_set: false, onboarded: true, key_error: null };
let openSettings = () => {};

export function onOpenSettings(fn) {
  openSettings = fn;
}

export async function refreshAiStatus() {
  try {
    status = await invoke('ai_status');
  } catch (e) {
    status = { key_set: false, onboarded: true, key_error: String(e) };
  }
  return status;
}

export function aiStatus() {
  return status;
}

// Returns true when the action may proceed; otherwise shows the key prompt.
export function requireKey(what) {
  if (status.key_set) return true;
  showKeyPrompt(what);
  return false;
}

function showKeyPrompt(what) {
  const el = document.getElementById('keyPrompt');
  el.querySelector('.key-prompt-what').textContent = what;
  el.hidden = false;
  el.querySelector('.key-prompt-open').onclick = () => {
    el.hidden = true;
    openSettings();
  };
  el.querySelector('.key-prompt-close').onclick = () => {
    el.hidden = true;
  };
}
