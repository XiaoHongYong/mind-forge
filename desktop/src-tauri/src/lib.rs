mod file_io;
mod unsaved_backup;

use file_io::{read_user_file, save_export_file, write_user_file};
use unsaved_backup::{delete_unsaved_backup, read_unsaved_backup, write_unsaved_backup};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, Submenu, SubmenuBuilder},
    Emitter,
};
#[cfg(debug_assertions)]
use tauri::Manager;

#[cfg(debug_assertions)]
const OPEN_WEBVIEW_DEVTOOLS_MENU_ID: &str = "open-webview-devtools";

/// The `mac` keyboard layout is the macOS default (see
/// frontend_app/src/shortcuts/registry.ts); every other platform defaults to
/// `freemind`. When a binding differs between layouts, the accelerator (or
/// display hint) follows this build's platform default.
fn platform_accelerator(mac: &'static str, freemind: &'static str) -> &'static str {
    if cfg!(target_os = "macos") {
        mac
    } else {
        freemind
    }
}

/// Label with a display-only shortcut. Used for bare letters / Tab / Enter
/// that must not be registered as OS accelerators — those would steal the
/// key from rename fields and the notes editor. `\t` puts the hint in the
/// accelerator column on Windows; on macOS it still reads as a binding.
fn with_shortcut_hint(label: &str, hint: &str) -> String {
    format!("{label}\t{hint}")
}

fn menu_item<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    id: &str,
    label: &str,
    accelerator: Option<&str>,
) -> tauri::Result<tauri::menu::MenuItem<R>> {
    let mut builder = MenuItemBuilder::with_id(id, label);
    if let Some(accel) = accelerator {
        builder = builder.accelerator(accel);
    }
    builder.build(app)
}

fn build_app_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Submenu<R>> {
    SubmenuBuilder::new(app, "MindForge")
        .about(None)
        .separator()
        .item(&menu_item(app, "app.settings", "Settings…", Some("CmdOrCtrl+,"))?)
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()
}

fn build_export_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Submenu<R>> {
    SubmenuBuilder::new(app, "Export")
        .item(&menu_item(app, "file.export.mmforge", "MindForge (.mmforge)", None)?)
        .item(&menu_item(app, "file.export.md", "Markdown (.md)", None)?)
        .item(&menu_item(app, "file.export.freemind", "FreeMind (.mm)", None)?)
        .item(&menu_item(app, "file.export.freeplane", "FreePlane (.mm)", None)?)
        .item(&menu_item(app, "file.export.wisemapping", "WiseMapping (.wxml)", None)?)
        .item(&menu_item(app, "file.export.xmind", "XMind (.xmind)", None)?)
        .separator()
        .item(&menu_item(app, "file.export.png", "PNG Image", None)?)
        .item(&menu_item(app, "file.export.pdf", "PDF Document", None)?)
        .build()
}

fn build_file_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Submenu<R>> {
    SubmenuBuilder::new(app, "File")
        .item(&menu_item(app, "file.new", "New", Some("CmdOrCtrl+N"))?)
        .item(&menu_item(app, "file.open", "Open…", Some("CmdOrCtrl+O"))?)
        .separator()
        .item(&menu_item(app, "file.save", "Save", Some("CmdOrCtrl+S"))?)
        .item(&menu_item(app, "file.saveAs", "Save As…", Some("CmdOrCtrl+Shift+S"))?)
        .separator()
        .item(&build_export_menu(app)?)
        .separator()
        .close_window()
        .build()
}

fn build_edit_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Submenu<R>> {
    let rename_accel = platform_accelerator("CmdOrCtrl+Enter", "F2");
    SubmenuBuilder::new(app, "Edit")
        .item(&menu_item(app, "edit.undo", "Undo", Some("CmdOrCtrl+Z"))?)
        .item(&menu_item(app, "edit.redo", "Redo", Some("CmdOrCtrl+Shift+Z"))?)
        .separator()
        // Custom cut/copy/paste (not the predefined WebKit selectors) so the
        // menu bridge can copy canvas nodes. Accelerators are fine: the
        // bridge routes to execCommand when a text field owns focus.
        .item(&menu_item(app, "edit.cut", "Cut", Some("CmdOrCtrl+X"))?)
        .item(&menu_item(app, "edit.copy", "Copy", Some("CmdOrCtrl+C"))?)
        .item(&menu_item(app, "edit.paste", "Paste", Some("CmdOrCtrl+V"))?)
        .item(&menu_item(app, "edit.delete", "Delete", Some("Delete"))?)
        .separator()
        .item(&menu_item(app, "node.rename", "Rename", Some(rename_accel))?)
        .separator()
        .item(&menu_item(app, "find.search", "Find", Some("CmdOrCtrl+F"))?)
        .build()
}

fn build_view_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Submenu<R>> {
    let shortcuts_accel = platform_accelerator("CmdOrCtrl+/", "F1");
    let zoom_in_accel = platform_accelerator("CmdOrCtrl+=", "=");
    let zoom_out_accel = platform_accelerator("CmdOrCtrl+-", "-");
    let zoom_fit_accel = platform_accelerator("CmdOrCtrl+Shift+8", "F8");
    let focus_accel = platform_accelerator("CmdOrCtrl+Shift+F", "F5");
    SubmenuBuilder::new(app, "View")
        .item(&menu_item(app, "view.recent", "Recent Files", None)?)
        .item(&menu_item(app, "view.outline", "Outline", None)?)
        .separator()
        .item(&menu_item(app, "view.style", "Style", None)?)
        .item(&menu_item(app, "view.canvas", "Canvas", None)?)
        .separator()
        .item(&menu_item(app, "view.toggleTheme", "Toggle Light/Dark", None)?)
        .item(&menu_item(app, "view.shortcuts", "Keyboard Shortcuts", Some(shortcuts_accel))?)
        .separator()
        .item(&menu_item(app, "view.leanMode", "Lean Mode", None)?)
        .item(&menu_item(app, "view.colourTray", "Colour Tray", Some("CmdOrCtrl+Shift+1"))?)
        .item(&menu_item(app, "view.iconTray", "Icon Tray", Some("CmdOrCtrl+Shift+2"))?)
        .item(&menu_item(app, "view.statusBar", "Status Bar", None)?)
        .separator()
        .item(&menu_item(app, "view.zoomIn", "Zoom In", Some(zoom_in_accel))?)
        .item(&menu_item(app, "view.zoomOut", "Zoom Out", Some(zoom_out_accel))?)
        .item(&menu_item(app, "view.zoomFit", "Fit to Window", Some(zoom_fit_accel))?)
        .separator()
        .item(&menu_item(app, "view.focusMode", "Focus Mode", Some(focus_accel))?)
        .build()
}

fn build_insert_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Submenu<R>> {
    let notes_accel = platform_accelerator("CmdOrCtrl+Shift+K", "F3");
    let attach_accel = platform_accelerator("CmdOrCtrl+Shift+O", "F6");
    // Colour is F4 on freemind (safe OS accel) and bare B on mac (display hint).
    let colour_item = if cfg!(target_os = "macos") {
        menu_item(app, "node.colour", &with_shortcut_hint("Colour", "B"), None)?
    } else {
        menu_item(app, "node.colour", "Colour", Some("F4"))?
    };
    SubmenuBuilder::new(app, "Insert")
        // Tab / Enter / bare letters: display only — see with_shortcut_hint.
        .item(&menu_item(app, "node.addChild", &with_shortcut_hint("Add Child", "Tab"), None)?)
        .item(&menu_item(app, "node.addSibling", &with_shortcut_hint("Add Sibling", "Enter"), None)?)
        .separator()
        .item(&menu_item(app, "node.checkbox", &with_shortcut_hint("Checkbox", "C"), None)?)
        .item(&menu_item(app, "node.progress", &with_shortcut_hint("Progress", "P"), None)?)
        .item(&colour_item)
        .item(&menu_item(app, "node.icons", &with_shortcut_hint("Icons", "I"), None)?)
        .separator()
        .item(&menu_item(app, "node.notesToggle", "Notes", Some(notes_accel))?)
        .item(&menu_item(app, "node.dates", &with_shortcut_hint("Dates", "D"), None)?)
        .item(&menu_item(app, "node.labels", &with_shortcut_hint("Tags", "T"), None)?)
        .item(&menu_item(app, "node.linkFile", "Link", Some("CmdOrCtrl+K"))?)
        .item(&menu_item(app, "node.url", &with_shortcut_hint("URL", "U"), None)?)
        .item(&menu_item(app, "node.addImage", "Image", Some("Alt+K"))?)
        .item(&menu_item(app, "node.attachFile", "Attach", Some(attach_accel))?)
        .build()
}

fn build_help_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Submenu<R>> {
    let shortcuts_accel = platform_accelerator("CmdOrCtrl+/", "F1");
    let builder = SubmenuBuilder::new(app, "Help").item(
        &menu_item(app, "find.shortcuts", "Keyboard Shortcuts", Some(shortcuts_accel))?,
    );

    #[cfg(debug_assertions)]
    let builder = builder.separator().item(
        &menu_item(app, OPEN_WEBVIEW_DEVTOOLS_MENU_ID, "Open WebView Devtools", Some("CmdOrCtrl+Shift+I"))?,
    );

    builder.build()
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();
            let menu = MenuBuilder::new(app)
                .items(&[
                    &build_app_menu(handle)?,
                    &build_file_menu(handle)?,
                    &build_edit_menu(handle)?,
                    &build_insert_menu(handle)?,
                    &build_view_menu(handle)?,
                    &build_help_menu(handle)?,
                ])
                .build()?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().0.as_str();
            #[cfg(debug_assertions)]
            if id == OPEN_WEBVIEW_DEVTOOLS_MENU_ID {
                if let Some(main_window) = app.get_webview_window("main") {
                    main_window.open_devtools();
                }
                return;
            }
            let _ = app.emit("menu:command", id);
        })
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running MindForge desktop");
}
