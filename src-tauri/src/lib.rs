use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{Emitter, Manager, State};

pub mod version;

fn log_debug(message: &str, data: serde_json::Value, hypothesis_id: &str) {
    let log_path = r"d:\Commercial\pixelThreader\pixelThreader OpenSource\DB Visualizer\db-visualizer\.cursor\debug.log";
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
        let entry = serde_json::json!({
            "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis(),
            "location": "src-tauri/src/lib.rs",
            "message": message,
            "data": data,
            "sessionId": "debug-session",
            "runId": "run1",
            "hypothesisId": hypothesis_id
        });
        if let Ok(line) = serde_json::to_string(&entry) {
            let _ = writeln!(file, "{}", line);
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DatabaseMetadata {
    id: i32,
    name: String,
    path: String,
    created_at: String,
    last_accessed: String,
    analysis_results: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct AnalysisResults {
    pub total_chars: u64,
    pub type_distribution: TypeDistribution,
    pub char_frequency: HashMap<u32, u64>, // Unicode to count
    pub column_formats: HashMap<String, Vec<String>>, // Table.Column to possible formats
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct TypeDistribution {
    pub numeric: u64,
    pub alphabets: u64,
    pub special: u64,
    pub unknown: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalysisProgress {
    pub db_path: String,
    pub progress: f64,
    pub records_processed: u64,
    pub total_records: u64,
    pub time_remaining_secs: u64,
    pub speed_records_per_sec: f64,
    pub is_finished: bool,
}

pub struct AppState {
    pub metadata_db_path: PathBuf,
    pub analysis_tasks: Mutex<HashMap<String, Arc<AtomicBool>>>, // db_path to cancellation token
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableInfo {
    pub name: String,
    pub row_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DbStats {
    pub total_tables: usize,
    pub total_records: i64,
    pub file_size_kb: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableData {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub total_pages: i64,
}

fn get_metadata_conn(state: &State<AppState>) -> Result<Connection, String> {
    Connection::open(&state.metadata_db_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn import_database(
    state: State<'_, AppState>,
    name: String,
    path: String,
) -> Result<DatabaseMetadata, String> {
    let conn = get_metadata_conn(&state)?;

    // Check if it's a valid sqlite database
    let _test_conn =
        Connection::open(&path).map_err(|e| format!("Invalid SQLite database: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO metadata (name, path, last_accessed) VALUES (?1, ?2, CURRENT_TIMESTAMP)",
        params![name, path],
    ).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT id, name, path, created_at, last_accessed, analysis_results FROM metadata WHERE path = ?1")
        .map_err(|e| e.to_string())?;

    let meta = stmt
        .query_row(params![path], |row| {
            Ok(DatabaseMetadata {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                created_at: row.get(3)?,
                last_accessed: row.get(4)?,
                analysis_results: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(meta)
}

#[tauri::command]
async fn list_databases(state: State<'_, AppState>) -> Result<Vec<DatabaseMetadata>, String> {
    let conn = get_metadata_conn(&state)?;
    let mut stmt = conn.prepare("SELECT id, name, path, created_at, last_accessed, analysis_results FROM metadata ORDER BY last_accessed DESC")
        .map_err(|e| e.to_string())?;

    let db_iter = stmt
        .query_map([], |row| {
            Ok(DatabaseMetadata {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                created_at: row.get(3)?,
                last_accessed: row.get(4)?,
                analysis_results: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut dbs = Vec::new();
    for db in db_iter {
        dbs.push(db.map_err(|e| e.to_string())?);
    }
    Ok(dbs)
}

#[tauri::command]
async fn stop_db_analysis(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let mut tasks = state.analysis_tasks.lock().unwrap();
    if let Some(token) = tasks.remove(&path) {
        token.store(true, Ordering::SeqCst);
    }
    Ok(())
}

#[tauri::command]
async fn start_db_analysis(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<(), String> {
    let path_clone = path.clone();
    let cancellation_token = Arc::new(AtomicBool::new(false));

    {
        let mut tasks = state.analysis_tasks.lock().unwrap();
        // If a task is already running for this path, stop it first
        if let Some(old_token) = tasks.get(&path) {
            old_token.store(true, Ordering::SeqCst);
        }
        tasks.insert(path.clone(), cancellation_token.clone());
    }

    let metadata_db_path = state.metadata_db_path.clone();

    tauri::async_runtime::spawn(async move {
        log_debug(
            "Starting background analysis",
            serde_json::json!({"path": path_clone}),
            "B",
        );
        let result = analyze_database_internal(&app, &path_clone, cancellation_token).await;

        // Remove task from active tasks
        if let Some(state) = app.try_state::<AppState>() {
            let mut tasks = state.analysis_tasks.lock().unwrap();
            tasks.remove(&path_clone);
        }

        match result {
            Ok(analysis) => {
                log_debug(
                    "Analysis finished successfully",
                    serde_json::json!({"path": path_clone}),
                    "B",
                );
                // Save results to metadata DB
                if let Ok(conn) = Connection::open(&metadata_db_path) {
                    let json_results = serde_json::to_string(&analysis).unwrap_or_default();
                    let _ = conn.execute(
                        "UPDATE metadata SET analysis_results = ?1 WHERE path = ?2",
                        params![json_results, path_clone],
                    );
                }
            }
            Err(e) => {
                log_debug(
                    "Analysis failed or cancelled",
                    serde_json::json!({"path": path_clone, "error": e}),
                    "B",
                );
            }
        }
    });

    Ok(())
}

async fn analyze_database_internal(
    app: &tauri::AppHandle,
    db_path: &str,
    cancel: Arc<AtomicBool>,
) -> Result<AnalysisResults, String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    // Get all tables and their row counts
    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .map_err(|e| e.to_string())?;
    let tables: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut total_records = 0;
    for table in &tables {
        let count: u64 = conn
            .query_row(&format!("SELECT COUNT(*) FROM \"{}\"", table), [], |row| {
                row.get(0)
            })
            .unwrap_or(0);
        total_records += count;
    }

    let mut results = AnalysisResults::default();
    let mut records_processed = 0;
    let start_time = Instant::now();

    for table in &tables {
        if cancel.load(Ordering::SeqCst) {
            return Err("Analysis cancelled".into());
        }

        let mut stmt = conn
            .prepare(&format!("SELECT * FROM \"{}\"", table))
            .map_err(|e| e.to_string())?;
        let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
        let mut rows = stmt.query([]).map_err(|e| e.to_string())?;

        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            if cancel.load(Ordering::SeqCst) {
                return Err("Analysis cancelled".into());
            }

            for (i, col_name) in columns.iter().enumerate() {
                let value: rusqlite::types::Value =
                    row.get(i).unwrap_or(rusqlite::types::Value::Null);
                match value {
                    rusqlite::types::Value::Text(s) => {
                        results.total_chars += s.chars().count() as u64;
                        for c in s.chars() {
                            *results.char_frequency.entry(c as u32).or_insert(0) += 1;
                            if c.is_numeric() {
                                results.type_distribution.numeric += 1;
                            } else if c.is_alphabetic() {
                                results.type_distribution.alphabets += 1;
                            } else {
                                results.type_distribution.special += 1;
                            }
                        }

                        // Simple format detection
                        let format_key = format!("{}.{}", table, col_name);
                        let formats = results
                            .column_formats
                            .entry(format_key)
                            .or_insert_with(Vec::new);
                        if s.contains('@')
                            && s.contains('.')
                            && !formats.contains(&"Email".to_string())
                        {
                            formats.push("Email".into());
                        }
                        if (s.starts_with("http") || s.starts_with("www"))
                            && !formats.contains(&"URL".to_string())
                        {
                            formats.push("URL".into());
                        }
                    }
                    rusqlite::types::Value::Integer(_) | rusqlite::types::Value::Real(_) => {
                        results.type_distribution.numeric += 1;
                    }
                    rusqlite::types::Value::Blob(b) => {
                        results.total_chars += b.len() as u64;
                        results.type_distribution.unknown += 1;
                    }
                    rusqlite::types::Value::Null => {}
                }
            }

            records_processed += 1;

            // Emit progress every 100 records or so to not flood the frontend
            if records_processed % 100 == 0 || records_processed == total_records {
                let elapsed = start_time.elapsed().as_secs_f64();
                let speed = if elapsed > 0.0 {
                    records_processed as f64 / elapsed
                } else {
                    0.0
                };
                let remaining = if speed > 0.0 {
                    (total_records - records_processed) as f64 / speed
                } else {
                    0.0
                };

                let _ = app.emit(
                    "analysis-progress",
                    AnalysisProgress {
                        db_path: db_path.to_string(),
                        progress: (records_processed as f64 / total_records as f64) * 100.0,
                        records_processed,
                        total_records,
                        time_remaining_secs: remaining as u64,
                        speed_records_per_sec: speed,
                        is_finished: records_processed == total_records,
                    },
                );

                if records_processed % 1000 == 0 || records_processed == total_records {
                    log_debug(
                        "Analysis progress update",
                        serde_json::json!({
                            "db_path": db_path,
                            "progress": (records_processed as f64 / total_records as f64) * 100.0,
                            "records": records_processed,
                            "total": total_records
                        }),
                        "C",
                    );
                }
            }
        }
    }

    Ok(results)
}

#[tauri::command]
async fn get_tables(path: String) -> Result<Vec<TableInfo>, String> {
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .map_err(|e| e.to_string())?;

    let table_names = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    let mut tables = Vec::new();
    for name_result in table_names {
        let name = name_result.map_err(|e| e.to_string())?;
        let row_count: i64 = conn
            .query_row(&format!("SELECT COUNT(*) FROM \"{}\"", name), [], |row| {
                row.get(0)
            })
            .unwrap_or(0);

        tables.push(TableInfo { name, row_count });
    }
    Ok(tables)
}

#[tauri::command]
async fn get_table_data(
    path: String,
    table: String,
    page: i64,
    page_size: i64,
    search: Option<String>,
) -> Result<TableData, String> {
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;

    // Get columns
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info(\"{}\")", table))
        .map_err(|e| e.to_string())?;
    let columns: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Prepare search condition
    let where_clause = if let Some(ref s) = search {
        if s.is_empty() {
            String::new()
        } else {
            let search_parts: Vec<String> = columns
                .iter()
                .map(|col| format!("\"{}\" LIKE '%{}%'", col, s.replace("'", "''")))
                .collect();
            format!(" WHERE {}", search_parts.join(" OR "))
        }
    } else {
        String::new()
    };

    // Get total count for pagination
    let total_records: i64 = conn
        .query_row(
            &format!("SELECT COUNT(*) FROM \"{}\" {}", table, where_clause),
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_pages = if page_size > 0 {
        (total_records + page_size - 1) / page_size
    } else {
        0
    };
    let offset = (page - 1) * page_size;

    // Fetch rows
    let query = format!(
        "SELECT * FROM \"{}\" {} LIMIT {} OFFSET {}",
        table, where_clause, page_size, offset
    );
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let col_count = stmt.column_count();

    let rows_iter = stmt
        .query_map([], |row| {
            let mut row_values = Vec::new();
            for i in 0..col_count {
                let val: rusqlite::types::Value = row.get(i)?;
                let json_val = match val {
                    rusqlite::types::Value::Null => serde_json::Value::Null,
                    rusqlite::types::Value::Integer(i) => serde_json::Value::Number(i.into()),
                    rusqlite::types::Value::Real(f) => serde_json::Number::from_f64(f)
                        .map(serde_json::Value::Number)
                        .unwrap_or(serde_json::Value::Null),
                    rusqlite::types::Value::Text(t) => serde_json::Value::String(t),
                    rusqlite::types::Value::Blob(b) => {
                        serde_json::Value::String(format!("<{} bytes>", b.len()))
                    }
                };
                row_values.push(json_val);
            }
            Ok(row_values)
        })
        .map_err(|e| e.to_string())?;

    let mut rows = Vec::new();
    for row in rows_iter {
        rows.push(row.map_err(|e| e.to_string())?);
    }

    Ok(TableData {
        columns,
        rows,
        total_pages,
    })
}

#[tauri::command]
async fn get_db_stats(path: String) -> Result<DbStats, String> {
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .map_err(|e| e.to_string())?;
    let table_names: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut total_records = 0;
    for table in &table_names {
        let count: i64 = conn
            .query_row(&format!("SELECT COUNT(*) FROM \"{}\"", table), [], |row| {
                row.get(0)
            })
            .unwrap_or(0);
        total_records += count;
    }

    let file_metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let file_size_kb = file_metadata.len() / 1024;

    Ok(DbStats {
        total_tables: table_names.len(),
        total_records,
        file_size_kb,
    })
}

#[tauri::command]
async fn delete_database(state: State<'_, AppState>, id: i32) -> Result<(), String> {
    let conn = get_metadata_conn(&state)?;
    conn.execute("DELETE FROM metadata WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");
            let metadata_db_path = app_data_dir.join("metadata.db");

            let conn =
                Connection::open(&metadata_db_path).expect("Failed to open metadata database");

            // Create table if not exists
            conn.execute(
                "CREATE TABLE IF NOT EXISTS metadata (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    path TEXT NOT NULL UNIQUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
                    analysis_results TEXT
                )",
                [],
            )
            .expect("Failed to create metadata table");

            // Migration: Add analysis_results column if it doesn't exist
            let mut stmt = conn
                .prepare("PRAGMA table_info(metadata)")
                .expect("Failed to get table info");
            let columns: Vec<String> = stmt
                .query_map([], |row| row.get(1))
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap();

            if !columns.contains(&"analysis_results".to_string()) {
                let _ = conn.execute("ALTER TABLE metadata ADD COLUMN analysis_results TEXT", []);
            }

            app.manage(AppState {
                metadata_db_path,
                analysis_tasks: Mutex::new(HashMap::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            import_database,
            list_databases,
            get_tables,
            get_table_data,
            get_db_stats,
            delete_database,
            start_db_analysis,
            stop_db_analysis,
            version::versionno
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
