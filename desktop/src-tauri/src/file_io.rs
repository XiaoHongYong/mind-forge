//! Plaintext user-file IO for the desktop shell.
//!
//! Paths always come from the native open/save dialog (or a recent-file entry
//! the user previously chose). The webview fs ACL stays scoped to app dirs;
//! these commands intentionally bypass that ACL so the user can read/write
//! documents under ~/Documents and similar locations.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use thiserror::Error;

#[derive(Debug, Error)]
pub enum FileIoError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Invalid input: {0}")]
    Invalid(String),
}

impl serde::Serialize for FileIoError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

fn write_bytes_atomic(path: &Path, data: &[u8]) -> Result<(), FileIoError> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }

    let tmp = path.with_extension(format!(
        "{}.tmp",
        path.extension().and_then(|e| e.to_str()).unwrap_or("part")
    ));
    {
        let mut file = fs::File::create(&tmp)?;
        file.write_all(data)?;
        file.sync_all()?;
    }
    fs::rename(&tmp, path)?;
    Ok(())
}

/// Reads raw bytes from a user-chosen absolute path.
#[tauri::command]
pub fn read_user_file(path: String) -> Result<Vec<u8>, FileIoError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(FileIoError::Invalid("path cannot be empty".into()));
    }
    let bytes = fs::read(PathBuf::from(trimmed))?;
    Ok(bytes)
}

/// Writes raw bytes to a user-chosen absolute path (atomic replace).
#[tauri::command]
pub fn write_user_file(path: String, data_base64: String) -> Result<(), FileIoError> {
    use base64::Engine;
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(FileIoError::Invalid("path cannot be empty".into()));
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|e| FileIoError::Invalid(format!("invalid base64 payload: {e}")))?;
    write_bytes_atomic(&PathBuf::from(trimmed), &bytes)
}

/// Back-compat alias used by the existing export download helper.
#[tauri::command]
pub fn save_export_file(dest_path: String, data_base64: String) -> Result<(), FileIoError> {
    write_user_file(dest_path, data_base64)
}
