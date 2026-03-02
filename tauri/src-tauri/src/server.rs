use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

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

    // Check if server is already running externally (e.g., dev server)
    let url = format!("http://{}:{}/api/v1/health", BACKEND_HOST, BACKEND_PORT);
    if let Ok(resp) = reqwest::get(&url).await {
        if resp.status().is_success() {
            return Ok(format!("http://{}:{}", BACKEND_HOST, BACKEND_PORT));
        }
    }

    // In debug mode, just tell the developer to start the server manually
    #[cfg(debug_assertions)]
    {
        Err("Backend not running. Start it with: cd backend && python -m backend.main".to_string())
    }

    // In production, spawn the sidecar binary
    #[cfg(not(debug_assertions))]
    {
        spawn_sidecar(app).await
    }
}

#[cfg(not(debug_assertions))]
async fn spawn_sidecar(app: &tauri::AppHandle) -> Result<String, String> {
    let state = app.state::<AppState>();

    // Resolve the app data directory for --data-dir
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;

    let data_dir_str = data_dir
        .to_str()
        .ok_or_else(|| "App data dir path contains invalid UTF-8".to_string())?
        .to_string();

    // Build sidecar command with arguments
    let sidecar_cmd = app
        .shell()
        .sidecar("binaries/forge-server")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .args([
            "--port",
            &BACKEND_PORT.to_string(),
            "--data-dir",
            &data_dir_str,
        ]);

    // Spawn the sidecar process
    let (mut rx, child) =
        sidecar_cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    let pid = child.pid();
    println!("Forge server sidecar spawned with PID: {}", pid);

    // Store the server process info
    {
        let mut process = state.server_process.lock().unwrap();
        *process = Some(ServerProcess {
            pid,
            port: BACKEND_PORT,
        });
    }

    // Wait for the server to report it's ready (up to 120 seconds)
    let (ready_tx, ready_rx) = tokio::sync::oneshot::channel::<Result<(), String>>();
    let mut ready_tx = Some(ready_tx);

    // Spawn a background task to consume stdout/stderr events
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    if let Ok(line) = String::from_utf8(line_bytes) {
                        print!("[forge-server] {}", line);
                        // Check for uvicorn startup messages
                        if line.contains("Uvicorn running")
                            || line.contains("Application startup complete")
                        {
                            if let Some(tx) = ready_tx.take() {
                                let _ = tx.send(Ok(()));
                            }
                        }
                    }
                }
                CommandEvent::Stderr(line_bytes) => {
                    if let Ok(line) = String::from_utf8(line_bytes) {
                        eprint!("[forge-server] {}", line);
                        // Uvicorn sometimes logs to stderr
                        if line.contains("Uvicorn running")
                            || line.contains("Application startup complete")
                        {
                            if let Some(tx) = ready_tx.take() {
                                let _ = tx.send(Ok(()));
                            }
                        }
                    }
                }
                CommandEvent::Error(err) => {
                    eprintln!("[forge-server] Error: {}", err);
                    if let Some(tx) = ready_tx.take() {
                        let _ = tx.send(Err(format!("Sidecar error: {}", err)));
                    }
                }
                CommandEvent::Terminated(payload) => {
                    eprintln!(
                        "[forge-server] Process terminated with code: {:?}, signal: {:?}",
                        payload.code, payload.signal
                    );
                    if let Some(tx) = ready_tx.take() {
                        let _ = tx.send(Err(format!(
                            "Sidecar terminated unexpectedly (code: {:?})",
                            payload.code
                        )));
                    }
                    break;
                }
            }
        }
    });

    // Wait for the server to be ready with a 120-second timeout
    match tokio::time::timeout(std::time::Duration::from_secs(120), ready_rx).await {
        Ok(Ok(Ok(()))) => {
            println!("Forge server is ready on port {}", BACKEND_PORT);
            Ok(format!("http://{}:{}", BACKEND_HOST, BACKEND_PORT))
        }
        Ok(Ok(Err(e))) => {
            // Clean up on error
            let mut process = state.server_process.lock().unwrap();
            *process = None;
            Err(e)
        }
        Ok(Err(_)) => {
            // Sender dropped without sending (process event loop ended)
            let mut process = state.server_process.lock().unwrap();
            *process = None;
            Err("Sidecar process ended before becoming ready".to_string())
        }
        Err(_) => {
            // Timeout
            eprintln!("Timed out waiting for forge-server to start (120s)");
            // Don't kill - it might still be loading ML models
            Ok(format!("http://{}:{}", BACKEND_HOST, BACKEND_PORT))
        }
    }
}

pub async fn stop_server(app: &tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut process = state.server_process.lock().unwrap();

    if let Some(server) = process.take() {
        println!("Stopping forge-server (PID: {})...", server.pid);

        // Send SIGTERM via kill(2) for graceful shutdown
        #[cfg(unix)]
        {
            unsafe {
                libc::kill(server.pid as i32, libc::SIGTERM);
            }
        }

        // On Windows, use taskkill
        #[cfg(windows)]
        {
            let _ = std::process::Command::new("taskkill")
                .args(["/PID", &server.pid.to_string(), "/F"])
                .spawn();
        }

        // Give the process time to shut down, then force-kill if needed
        let pid = server.pid;
        drop(process); // Release the lock before sleeping

        tokio::time::sleep(std::time::Duration::from_secs(5)).await;

        // Check if process is still alive and force-kill
        #[cfg(unix)]
        {
            let still_alive = unsafe { libc::kill(pid as i32, 0) } == 0;
            if still_alive {
                eprintln!(
                    "forge-server (PID: {}) did not stop gracefully, sending SIGKILL",
                    pid
                );
                unsafe {
                    libc::kill(pid as i32, libc::SIGKILL);
                }
            }
        }

        println!("forge-server stopped");
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
