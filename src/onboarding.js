// First-run welcome: choose the notes folder, optionally add an AI key.
import { invoke } from '@tauri-apps/api/core';
import { open as dialogOpen } from '@tauri-apps/plugin-dialog';
import { refreshAiStatus } from './ai-gate.js';

const $ = (id) => document.getElementById(id);

// Shared by the welcome and settings: checks the typed key (or the saved one
// when the field is empty) and writes the verdict into `note`.
export async function testKey(input, note, { baseUrl = '', model = '' } = {}) {
  const apiKey = input.value.trim() || null;
  note.textContent = 'checking…';
  note.classList.remove('ok', 'err');
  try {
    await invoke('test_connection', { baseUrl, model, apiKey });
    note.textContent = 'connected — this key works';
    note.classList.add('ok');
    return true;
  } catch (e) {
    note.textContent = String(e);
    note.classList.add('err');
    return false;
  }
}

export async function maybeShowWelcome({ onFolderChanged }) {
  const status = await refreshAiStatus();
  if (status.onboarded) return;
  $('welcomeDir').textContent = await invoke('resolve_notes_dir');
  $('welcomeModal').removeAttribute('hidden');

  await new Promise((resolve) => {
    $('welcomeDirBtn').onclick = async () => {
      const dir = await dialogOpen({ directory: true, title: 'Choose notes folder' });
      if (!dir) return;
      await invoke('set_notes_dir', { dir });
      $('welcomeDir').textContent = await invoke('resolve_notes_dir');
      await onFolderChanged();
    };
    $('welcomeTest').onclick = () => testKey($('welcomeKey'), $('welcomeKeyNote'));
    const finish = async (withKey) => {
      const key = $('welcomeKey').value.trim();
      if (withKey && key) {
        try {
          await invoke('set_llm_settings', { baseUrl: '', model: '', apiKey: key, clearKey: false });
        } catch (e) {
          $('welcomeKeyNote').textContent = String(e);
          $('welcomeKeyNote').classList.add('err');
          return;
        }
      }
      await invoke('complete_onboarding');
      await refreshAiStatus();
      $('welcomeModal').setAttribute('hidden', '');
      resolve();
    };
    $('welcomeSkip').onclick = () => finish(false);
    $('welcomeDone').onclick = () => finish(true);
  });
}
