use tauri::Manager;

use crate::AppState;

pub struct ServerProcess {
    pub pid: u32,
    pub port: u16,
}

const BACKEND_PORT: u16 = 8188;
const BACKEND_HOST: &str = "127.0.0.1";

pub async fn start_server(app: &tauri::AppHandle) -> Result<String, String> {
    let state = app.state::<AppState>();

    // Check if already running
    if state.server_process.lock().unwrap().is_some() {
        return Ok(format!("http://{}:{}", BACKEND_HOST, BACKEND_PORT));
    }

    // For development, check if server is already running externally
    let url = format!("http://{}:{}/api/v1/health", BACKEND_HOST, BACKEND_PORT);
    if let Ok(resp) = reqwest::get(&url).await {
        if resp.status().is_success() {
            return Ok(format!("http://{}:{}", BACKEND_HOST, BACKEND_PORT));
        }
    }

    // TODO: Spawn sidecar in production
    // For now, return an error suggesting to start the dev server
    #[cfg(debug_assertions)]
    {
        Err("Backend not running. Start it with: cd backend && python -m backend.main".to_string())
    }

    #[cfg(not(debug_assertions))]
    {
        // Production: spawn sidecar
        // let sidecar = app.shell().sidecar("forge-server").unwrap();
        // ...
        Err("Sidecar spawning not yet implemented".to_string())
    }
}

pub async fn stop_server(app: &tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut process = state.server_process.lock().unwrap();

    if let Some(_server) = process.take() {
        // TODO: Send shutdown signal to server process
    }

    Ok(())
}

pub async fn get_status(app: &tauri::AppHandle) -> Result<String, String> {
    let url = format!("http://{}:{}/api/v1/health", BACKEND_HOST, BACKEND_PORT);
    match reqwest::get(&url).await {
        Ok(resp) if resp.status().is_success() => Ok("healthy".to_string()),
        _ => Ok("disconnected".to_string()),
    }
}
