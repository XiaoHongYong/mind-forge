mod file_io;
mod unsaved_backup;

#[cfg(desktop)]
mod native_menu;

use file_io::{read_user_file, save_export_file, write_user_file};
use unsaved_backup::{delete_unsaved_backup, read_unsaved_backup, write_unsaved_backup};

#[cfg(desktop)]
use native_menu::rebuild_app_menu;

/// No native menu bar on mobile — keep the IPC so the frontend sync stays a no-op.
#[cfg(not(desktop))]
#[tauri::command]
fn rebuild_app_menu(
    _app: tauri::AppHandle,
    _labels: std::collections::HashMap<String, String>,
) -> Result<(), String> {
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            read_user_file,
            write_user_file,
            save_export_file,
            write_unsaved_backup,
            read_unsaved_backup,
            delete_unsaved_backup,
            rebuild_app_menu,
        ]);

    #[cfg(desktop)]
    let builder = native_menu::configure(builder);

    builder
        .run(tauri::generate_context!())
        .expect("error while running MindForge");
}
