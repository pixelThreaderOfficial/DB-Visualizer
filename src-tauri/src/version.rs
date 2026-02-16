#[tauri::command]
pub fn versionno(prefix: Option<bool>) -> String {
    let prefix = prefix.unwrap_or(false);
    let version = "1.0.1";
    if prefix {
        return format!("v{}", version);
    } else {
        return version.to_string();
    }
}
