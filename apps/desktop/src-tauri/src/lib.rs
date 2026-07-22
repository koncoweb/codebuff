// KoncoVibe Desktop — Tauri 2.0 Application Library
//
// Berisi semua logic Rust untuk desktop app.
// Dipisah dari main.rs agar bisa di-test dan untuk mobile support di masa depan.

use tauri::Manager;

/// Command: Dapatkan info versi aplikasi
#[tauri::command]
fn get_app_info() -> serde_json::Value {
    serde_json::json!({
        "name": "KoncoVibe",
        "version": env!("CARGO_PKG_VERSION"),
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    })
}

/// Command: Cek apakah Codebuff sidecar tersedia di sistem
/// TODO: Implement deteksi sidecar binary saat packaging siap.
/// Saat packaging, sidecar binary akan di-bundle via externalBin di tauri.conf.json.
#[tauri::command]
async fn check_codebuff_sidecar() -> bool {
    // Saat ini return false — app akan fallback ke SumoPod mode
    // Saat sidecar siap, check file existence di path yang di-bundle
    false
}

/// Command: Buka file dialog untuk save HTML ke disk
/// TODO: Implement dengan tauri-plugin-dialog saat fitur export siap
#[tauri::command]
async fn save_html_to_disk(content: String, filename: String) -> Result<String, String> {
    // Placeholder — akan diimplementasi dengan tauri-plugin-dialog
    let path = format!("./{}", filename);
    std::fs::write(&path, &content).map_err(|e| e.to_string())?;
    Ok(path)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            check_codebuff_sidecar,
            save_html_to_disk,
        ])
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                // Buka DevTools otomatis di development mode
                if let Some(window) = _app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running KoncoVibe application");
}
