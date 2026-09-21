//! Unsaved-edit backups under the app data directory.
//!
//! On exit with dirty edits, the frontend writes a JSON payload here keyed by
//! the document path (or a fixed `__mindforge_untitled__` key for never-saved
//! buffers). Path-backed backups restore on the next open when the on-disk
//! file hash still matches; untitled backups restore on the next New / empty
//! session.

use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Write;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::file_io::FileIoError;

fn backups_dir(app: &AppHandle) -> Result<PathBuf, FileIoError> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| FileIoError::Invalid(format!("app data dir: {e}")))?;
    Ok(base.join("unsaved-backups"))
}

fn backup_file_for(app: &AppHandle, doc_path: &str) -> Result<PathBuf, FileIoError> {
    let trimmed = doc_path.trim();
    if trimmed.is_empty() {
        return Err(FileIoError::Invalid("path cannot be empty".into()));
    }
    let mut hasher = DefaultHasher::new();
    trimmed.hash(&mut hasher);
    let name = format!("{:016x}.json", hasher.finish());
    Ok(backups_dir(app)?.join(name))
}

fn write_bytes_atomic(path: &Path, data: &[u8]) -> Result<(), FileIoError> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }
    let tmp = path.with_extension("json.tmp");
    {
        let mut file = fs::File::create(&tmp)?;
        file.write_all(data)?;
        file.sync_all()?;
    }
    fs::rename(&tmp, path)?;
    Ok(())
}

/// Writes (or replaces) the unsaved backup for `path`.
#[tauri::command]
pub fn write_unsaved_backup(
    app: AppHandle,
    path: String,
    payload_json: String,
) -> Result<(), FileIoError> {
    let dest = backup_file_for(&app, &path)?;
    write_bytes_atomic(&dest, payload_json.as_bytes())
}

/// Reads the unsaved backup for `path`, if any.
#[tauri::command]
pub fn read_unsaved_backup(app: AppHandle, path: String) -> Result<Option<String>, FileIoError> {
    let dest = backup_file_for(&app, &path)?;
    if !dest.exists() {
        return Ok(None);
    }
    let bytes = fs::read(&dest)?;
    let text = String::from_utf8(bytes)
        .map_err(|e| FileIoError::Invalid(format!("backup is not utf-8: {e}")))?;
    Ok(Some(text))
}

/// Deletes the unsaved backup for `path` if it exists.
#[tauri::command]
pub fn delete_unsaved_backup(app: AppHandle, path: String) -> Result<(), FileIoError> {
    let dest = backup_file_for(&app, &path)?;
    if dest.exists() {
        fs::remove_file(&dest)?;
    }
    Ok(())
}
