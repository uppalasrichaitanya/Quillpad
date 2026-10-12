mod ai_config;
mod commands;
mod keystore;
mod distill;
mod library;
mod note;
mod office;
mod seed;

pub fn run() {
    tauri::Builder::default()
        // single-instance MUST be the first plugin: a second shortcut click
        // (or launching while an instance hides in the background) would
        // otherwise open a new window against the same WebView2 profile and
        // die with an error page. Instead, surface the running notebook.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use tauri::Manager;
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::set_llm_settings,
            commands::ai_status,
            commands::complete_onboarding,
            commands::set_notes_dir,
            commands::resolve_notes_dir,
            commands::list_library,
            commands::read_note,
            commands::save_note,
            commands::delete_note,
            commands::write_export,
            commands::export_note_markdown,
            commands::import_chapter,
            commands::ask_notes,
            commands::load_study_state,
            commands::save_study_state,
            commands::set_theme,
            commands::gen_quiz,
            commands::grade_written,
            commands::gen_written_questions,
            commands::grade_exam,
            commands::load_exam_history,
            commands::save_exam_history,
        ])
        .setup(|app| {
            use tauri::Manager;
            let data_dir = app.path().app_data_dir()?;
            let _ = std::fs::create_dir_all(&data_dir);
            // move a 0.1 plaintext key into the credential store before any
            // other command re-saves settings.json (which never writes keys)
            let settings = match library::Settings::load_migrated(&data_dir, keystore::set) {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("settings migration deferred: {e}");
                    library::Settings::load(&data_dir)?
                }
            };
            let root = library::notes_root(&data_dir, &settings)?;
            let _ = std::fs::create_dir_all(&root);
            seed::seed_if_empty(&root)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Quillpad");
}
