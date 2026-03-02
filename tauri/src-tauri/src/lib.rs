use std::sync::Mutex;
use tauri::Manager;

mod server;

pub struct AppState {
    pub server_process: Mutex<Option<server::ServerProcess>>,
}

#[tauri::command]
async fn start_backend(app: tauri::AppHandle) -> Result<String, String> {
    server::start_server(&app).await
}

#[tauri::command]
async fn stop_backend(app: tauri::AppHandle) -> Result<(), String> {
    server::stop_server(&app).await
}

#[tauri::command]
async fn get_backend_status(app: tauri::AppHandle) -> Result<String, String> {
    server::get_status(&app).await
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .manage(AppState {
            server_process: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            start_backend,
            stop_backend,
            get_backend_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
