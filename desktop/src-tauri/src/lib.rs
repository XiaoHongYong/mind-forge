mod file_io;
mod unsaved_backup;

use file_io::{read_user_file, save_export_file, write_user_file};
use unsaved_backup::{delete_unsaved_backup, read_unsaved_backup, write_unsaved_backup};
use std::collections::HashMap;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, Submenu, SubmenuBuilder},
    AppHandle, Emitter, Runtime,
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

fn label_or<'a>(labels: &'a HashMap<String, String>, key: &str, fallback: &'static str) -> &'a str {
    labels.get(key).map(String::as_str).unwrap_or(fallback)
}

fn menu_item<R: Runtime>(
    app: &AppHandle<R>,
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

fn build_app_menu<R: Runtime>(
    app: &AppHandle<R>,
    labels: &HashMap<String, String>,
) -> tauri::Result<Submenu<R>> {
    SubmenuBuilder::new(app, label_or(labels, "submenu.app", "MindForge"))
        .about(None)
        .separator()
        .item(&menu_item(
            app,
            "app.settings",
            label_or(labels, "app.settings", "Settings…"),
            Some("CmdOrCtrl+,"),
        )?)
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()
}

fn build_export_menu<R: Runtime>(
    app: &AppHandle<R>,
    labels: &HashMap<String, String>,
) -> tauri::Result<Submenu<R>> {
    SubmenuBuilder::new(app, label_or(labels, "submenu.export", "Export"))
        .item(&menu_item(
            app,
            "file.export.mmforge",
            label_or(labels, "file.export.mmforge", "MindForge (.mmforge)"),
            None,
        )?)
        .item(&menu_item(
            app,
            "file.export.md",
            label_or(labels, "file.export.md", "Markdown (.md)"),
            None,
        )?)
        .item(&menu_item(
            app,
            "file.export.freemind",
            label_or(labels, "file.export.freemind", "FreeMind (.mm)"),
            None,
        )?)
        .item(&menu_item(
            app,
            "file.export.freeplane",
            label_or(labels, "file.export.freeplane", "FreePlane (.mm)"),
            None,
        )?)
        .item(&menu_item(
            app,
            "file.export.wisemapping",
            label_or(labels, "file.export.wisemapping", "WiseMapping (.wxml)"),
            None,
        )?)
        .item(&menu_item(
            app,
            "file.export.xmind",
            label_or(labels, "file.export.xmind", "XMind (.xmind)"),
            None,
        )?)
        .separator()
        .item(&menu_item(
            app,
            "file.export.png",
            label_or(labels, "file.export.png", "PNG Image"),
            None,
        )?)
        .item(&menu_item(
            app,
            "file.export.pdf",
            label_or(labels, "file.export.pdf", "PDF Document"),
            None,
        )?)
        .build()
}

fn build_file_menu<R: Runtime>(
    app: &AppHandle<R>,
    labels: &HashMap<String, String>,
) -> tauri::Result<Submenu<R>> {
    SubmenuBuilder::new(app, label_or(labels, "submenu.file", "File"))
        .item(&menu_item(
            app,
            "file.new",
            label_or(labels, "file.new", "New"),
            Some("CmdOrCtrl+N"),
        )?)
        .item(&menu_item(
            app,
            "file.open",
            label_or(labels, "file.open", "Open…"),
            Some("CmdOrCtrl+O"),
        )?)
        .separator()
        .item(&menu_item(
            app,
            "file.save",
            label_or(labels, "file.save", "Save"),
            Some("CmdOrCtrl+S"),
        )?)
        .item(&menu_item(
            app,
            "file.saveAs",
            label_or(labels, "file.saveAs", "Save As…"),
            Some("CmdOrCtrl+Shift+S"),
        )?)
        .separator()
        .item(&build_export_menu(app, labels)?)
        .separator()
        .close_window()
        .build()
}

fn build_edit_menu<R: Runtime>(
    app: &AppHandle<R>,
    labels: &HashMap<String, String>,
) -> tauri::Result<Submenu<R>> {
    let rename_accel = platform_accelerator("CmdOrCtrl+Enter", "F2");
    SubmenuBuilder::new(app, label_or(labels, "submenu.edit", "Edit"))
        .item(&menu_item(
            app,
            "edit.undo",
            label_or(labels, "edit.undo", "Undo"),
            Some("CmdOrCtrl+Z"),
        )?)
        .item(&menu_item(
            app,
            "edit.redo",
            label_or(labels, "edit.redo", "Redo"),
            Some("CmdOrCtrl+Shift+Z"),
        )?)
        .separator()
        // Custom cut/copy/paste (not the predefined WebKit selectors) so the
        // menu bridge can copy canvas nodes. Accelerators are fine: the
        // bridge routes to execCommand when a text field owns focus.
        .item(&menu_item(
            app,
            "edit.cut",
            label_or(labels, "edit.cut", "Cut"),
            Some("CmdOrCtrl+X"),
        )?)
        .item(&menu_item(
            app,
            "edit.copy",
            label_or(labels, "edit.copy", "Copy"),
            Some("CmdOrCtrl+C"),
        )?)
        .item(&menu_item(
            app,
            "edit.paste",
            label_or(labels, "edit.paste", "Paste"),
            Some("CmdOrCtrl+V"),
        )?)
        .item(&menu_item(
            app,
            "edit.delete",
            label_or(labels, "edit.delete", "Delete"),
            Some("Delete"),
        )?)
        .separator()
        .item(&menu_item(
            app,
            "node.rename",
            label_or(labels, "node.rename", "Rename"),
            Some(rename_accel),
        )?)
        .separator()
        .item(&menu_item(
            app,
            "find.search",
            label_or(labels, "find.search", "Find"),
            Some("CmdOrCtrl+F"),
        )?)
        .build()
}

fn build_view_menu<R: Runtime>(
    app: &AppHandle<R>,
    labels: &HashMap<String, String>,
) -> tauri::Result<Submenu<R>> {
    let shortcuts_accel = platform_accelerator("CmdOrCtrl+/", "F1");
    let zoom_in_accel = platform_accelerator("CmdOrCtrl+=", "=");
    let zoom_out_accel = platform_accelerator("CmdOrCtrl+-", "-");
    let zoom_fit_accel = platform_accelerator("CmdOrCtrl+Shift+8", "F8");
    let focus_accel = platform_accelerator("CmdOrCtrl+Shift+F", "F5");
    SubmenuBuilder::new(app, label_or(labels, "submenu.view", "View"))
        .item(&menu_item(
            app,
            "view.recent",
            label_or(labels, "view.recent", "Recent Files"),
            None,
        )?)
        .item(&menu_item(
            app,
            "view.outline",
            label_or(labels, "view.outline", "Outline"),
            None,
        )?)
        .separator()
        .item(&menu_item(
            app,
            "view.style",
            label_or(labels, "view.style", "Style"),
            None,
        )?)
        .item(&menu_item(
            app,
            "view.canvas",
            label_or(labels, "view.canvas", "Canvas"),
            None,
        )?)
        .separator()
        .item(&menu_item(
            app,
            "view.toggleTheme",
            label_or(labels, "view.toggleTheme", "Toggle Light/Dark"),
            None,
        )?)
        .item(&menu_item(
            app,
            "view.shortcuts",
            label_or(labels, "view.shortcuts", "Keyboard Shortcuts"),
            Some(shortcuts_accel),
        )?)
        .separator()
        .item(&menu_item(
            app,
            "view.leanMode",
            label_or(labels, "view.leanMode", "Lean Mode"),
            None,
        )?)
        .item(&menu_item(
            app,
            "view.colourTray",
            label_or(labels, "view.colourTray", "Colour Tray"),
            Some("CmdOrCtrl+Shift+1"),
        )?)
        .item(&menu_item(
            app,
            "view.iconTray",
            label_or(labels, "view.iconTray", "Icon Tray"),
            Some("CmdOrCtrl+Shift+2"),
        )?)
        .item(&menu_item(
            app,
            "view.statusBar",
            label_or(labels, "view.statusBar", "Status Bar"),
            None,
        )?)
        .separator()
        .item(&menu_item(
            app,
            "view.zoomIn",
            label_or(labels, "view.zoomIn", "Zoom In"),
            Some(zoom_in_accel),
        )?)
        .item(&menu_item(
            app,
            "view.zoomOut",
            label_or(labels, "view.zoomOut", "Zoom Out"),
            Some(zoom_out_accel),
        )?)
        .item(&menu_item(
            app,
            "view.zoomFit",
            label_or(labels, "view.zoomFit", "Fit to Window"),
            Some(zoom_fit_accel),
        )?)
        .separator()
        .item(&menu_item(
            app,
            "view.focusMode",
            label_or(labels, "view.focusMode", "Focus Mode"),
            Some(focus_accel),
        )?)
        .build()
}

fn build_insert_menu<R: Runtime>(
    app: &AppHandle<R>,
    labels: &HashMap<String, String>,
) -> tauri::Result<Submenu<R>> {
    let notes_accel = platform_accelerator("CmdOrCtrl+Shift+K", "F3");
    let attach_accel = platform_accelerator("CmdOrCtrl+Shift+O", "F6");
    let colour_label = label_or(labels, "node.colour", "Colour");
    // Colour is F4 on freemind (safe OS accel) and bare B on mac (display hint).
    let colour_item = if cfg!(target_os = "macos") {
        menu_item(
            app,
            "node.colour",
            &with_shortcut_hint(colour_label, "B"),
            None,
        )?
    } else {
        menu_item(app, "node.colour", colour_label, Some("F4"))?
    };
    SubmenuBuilder::new(app, label_or(labels, "submenu.insert", "Insert"))
        // Tab / Enter / bare letters: display only — see with_shortcut_hint.
        .item(&menu_item(
            app,
            "node.addChild",
            &with_shortcut_hint(label_or(labels, "node.addChild", "Add Child"), "Tab"),
            None,
        )?)
        .item(&menu_item(
            app,
            "node.addSibling",
            &with_shortcut_hint(label_or(labels, "node.addSibling", "Add Sibling"), "Enter"),
            None,
        )?)
        .separator()
        .item(&menu_item(
            app,
            "node.checkbox",
            &with_shortcut_hint(label_or(labels, "node.checkbox", "Checkbox"), "C"),
            None,
        )?)
        .item(&menu_item(
            app,
            "node.progress",
            &with_shortcut_hint(label_or(labels, "node.progress", "Progress"), "P"),
            None,
        )?)
        .item(&colour_item)
        .item(&menu_item(
            app,
            "node.icons",
            &with_shortcut_hint(label_or(labels, "node.icons", "Icons"), "I"),
            None,
        )?)
        .separator()
        .item(&menu_item(
            app,
            "node.notesToggle",
            label_or(labels, "node.notesToggle", "Notes"),
            Some(notes_accel),
        )?)
        .item(&menu_item(
            app,
            "node.dates",
            &with_shortcut_hint(label_or(labels, "node.dates", "Dates"), "D"),
            None,
        )?)
        .item(&menu_item(
            app,
            "node.labels",
            &with_shortcut_hint(label_or(labels, "node.labels", "Tags"), "T"),
            None,
        )?)
        .item(&menu_item(
            app,
            "node.linkFile",
            label_or(labels, "node.linkFile", "Link"),
            Some("CmdOrCtrl+K"),
        )?)
        .item(&menu_item(
            app,
            "node.url",
            &with_shortcut_hint(label_or(labels, "node.url", "URL"), "U"),
            None,
        )?)
        .item(&menu_item(
            app,
            "node.addImage",
            label_or(labels, "node.addImage", "Image"),
            Some("Alt+K"),
        )?)
        .item(&menu_item(
            app,
            "node.attachFile",
            label_or(labels, "node.attachFile", "Attach"),
            Some(attach_accel),
        )?)
        .build()
}

fn build_help_menu<R: Runtime>(
    app: &AppHandle<R>,
    labels: &HashMap<String, String>,
) -> tauri::Result<Submenu<R>> {
    let shortcuts_accel = platform_accelerator("CmdOrCtrl+/", "F1");
    let builder = SubmenuBuilder::new(app, label_or(labels, "submenu.help", "Help")).item(
        &menu_item(
            app,
            "find.shortcuts",
            label_or(labels, "find.shortcuts", "Keyboard Shortcuts"),
            Some(shortcuts_accel),
        )?,
    );

    #[cfg(debug_assertions)]
    let builder = builder.separator().item(&menu_item(
        app,
        OPEN_WEBVIEW_DEVTOOLS_MENU_ID,
        label_or(labels, "open-webview-devtools", "Open WebView Devtools"),
        Some("CmdOrCtrl+Shift+I"),
    )?);

    builder.build()
}

fn build_app_menu_bar<R: Runtime>(
    app: &AppHandle<R>,
    labels: &HashMap<String, String>,
) -> tauri::Result<tauri::menu::Menu<R>> {
    MenuBuilder::new(app)
        .items(&[
            &build_app_menu(app, labels)?,
            &build_file_menu(app, labels)?,
            &build_edit_menu(app, labels)?,
            &build_insert_menu(app, labels)?,
            &build_view_menu(app, labels)?,
            &build_help_menu(app, labels)?,
        ])
        .build()
}

/// Rebuild the native menu with labels from the frontend i18n bundle.
/// English fallbacks apply for any missing key so a partial map is safe.
#[tauri::command]
fn rebuild_app_menu(app: AppHandle, labels: HashMap<String, String>) -> Result<(), String> {
    let menu = build_app_menu_bar(&app, &labels).map_err(|e| e.to_string())?;
    app.set_menu(menu).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();
            let empty = HashMap::new();
            let menu = build_app_menu_bar(handle, &empty)?;
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
            rebuild_app_menu,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MindForge desktop");
}
