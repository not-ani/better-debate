use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int};
use std::path::PathBuf;
use std::sync::{OnceLock, RwLock};

pub(crate) type CommandResult<T> = Result<T, String>;

pub(crate) const DEFAULT_CAPTURE_TARGET: &str = "BlockFile-Captures.docx";

mod runtime {
    use serde::Serialize;
    use std::ffi::CString;
    use std::io;
    use std::os::raw::c_char;
    use std::path::PathBuf;
    use std::sync::{Arc, OnceLock, RwLock};

    pub type EventCallback = extern "C" fn(*const c_char, *const c_char);

    static EVENT_CALLBACK: OnceLock<RwLock<Option<EventCallback>>> = OnceLock::new();

    fn callback_cell() -> &'static RwLock<Option<EventCallback>> {
        EVENT_CALLBACK.get_or_init(|| RwLock::new(None))
    }

    pub fn set_event_callback(callback: Option<EventCallback>) {
        if let Ok(mut writer) = callback_cell().write() {
            *writer = callback;
        }
    }

    #[derive(Clone)]
    pub struct AppHandle {
        state: Arc<AppState>,
    }

    #[derive(Debug)]
    struct AppState {
        app_data_dir: PathBuf,
        resource_dir: Option<PathBuf>,
    }

    impl AppHandle {
        pub fn new(app_data_dir: PathBuf, resource_dir: Option<PathBuf>) -> Self {
            Self {
                state: Arc::new(AppState {
                    app_data_dir,
                    resource_dir,
                }),
            }
        }

        pub fn path(&self) -> PathResolver {
            PathResolver {
                state: Arc::clone(&self.state),
            }
        }

        pub fn emit<S: Serialize>(&self, event: &str, payload: S) -> Result<(), String> {
            let callback = callback_cell().read().ok().and_then(|reader| *reader);
            let Some(callback) = callback else {
                return Ok(());
            };

            let payload_json = serde_json::to_string(&payload)
                .map_err(|error| format!("Could not serialize event payload: {error}"))?;
            let event_c = CString::new(event)
                .map_err(|_| "Event name contains null byte".to_string())?;
            let payload_c = CString::new(payload_json)
                .map_err(|_| "Event payload contains null byte".to_string())?;

            callback(event_c.as_ptr(), payload_c.as_ptr());
            Ok(())
        }
    }

    #[derive(Clone)]
    pub struct PathResolver {
        state: Arc<AppState>,
    }

    impl PathResolver {
        pub fn app_data_dir(&self) -> io::Result<PathBuf> {
            Ok(self.state.app_data_dir.clone())
        }

        pub fn resource_dir(&self) -> io::Result<PathBuf> {
            self.state.resource_dir.clone().ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::NotFound,
                    "Resource directory was not configured",
                )
            })
        }
    }

    pub trait Manager {
        fn path(&self) -> PathResolver;
    }

    impl Manager for AppHandle {
        fn path(&self) -> PathResolver {
            AppHandle::path(self)
        }
    }

    pub trait Emitter {
        fn emit<S: Serialize>(&self, event: &str, payload: S) -> Result<(), String>;
    }

    impl Emitter for AppHandle {
        fn emit<S: Serialize>(&self, event: &str, payload: S) -> Result<(), String> {
            AppHandle::emit(self, event, payload)
        }
    }

    pub mod async_runtime {
        use std::future::Future;
        use std::sync::OnceLock;
        use tokio::runtime::{Builder, Runtime};
        use tokio::task::JoinHandle;

        static RUNTIME: OnceLock<Runtime> = OnceLock::new();

        fn runtime() -> &'static Runtime {
            RUNTIME.get_or_init(|| {
                Builder::new_multi_thread()
                    .enable_all()
                    .build()
                    .expect("failed to build async runtime")
            })
        }

        pub fn spawn<F>(future: F) -> JoinHandle<F::Output>
        where
            F: Future + Send + 'static,
            F::Output: Send + 'static,
        {
            runtime().spawn(future)
        }

        pub fn spawn_blocking<F, R>(function: F) -> JoinHandle<R>
        where
            F: FnOnce() -> R + Send + 'static,
            R: Send + 'static,
        {
            runtime().spawn_blocking(function)
        }

        pub fn block_on<F>(future: F) -> F::Output
        where
            F: Future,
        {
            runtime().block_on(future)
        }
    }
}

mod chunking;
mod commands;
mod db;
mod docx_capture;
mod docx_parse;
mod indexer;
mod lexical;
mod preview;
mod query_engine;
mod search;
mod semantic;
mod types;
mod util;
mod vector;
pub use runtime::{set_event_callback, AppHandle, Emitter, Manager};

pub mod async_runtime {
    pub use crate::runtime::async_runtime::{block_on, spawn, spawn_blocking};
}

static APP_HANDLE: OnceLock<RwLock<Option<AppHandle>>> = OnceLock::new();

fn app_handle_cell() -> &'static RwLock<Option<AppHandle>> {
    APP_HANDLE.get_or_init(|| RwLock::new(None))
}

fn current_app_handle() -> CommandResult<AppHandle> {
    let reader = app_handle_cell()
        .read()
        .map_err(|_| "Could not read app configuration".to_string())?;
    reader
        .as_ref()
        .cloned()
        .ok_or_else(|| "Core backend is not configured".to_string())
}

fn set_app_handle(app_handle: AppHandle) -> CommandResult<()> {
    let mut writer = app_handle_cell()
        .write()
        .map_err(|_| "Could not update app configuration".to_string())?;
    *writer = Some(app_handle);
    Ok(())
}

#[derive(Deserialize)]
struct InvokeRequest {
    command: String,
    #[serde(default)]
    args: Value,
}

#[derive(Serialize)]
struct InvokeResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    value: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Default, Deserialize)]
#[serde(default)]
struct EmptyArgs {}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddRootArgs {
    path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GetIndexSnapshotArgs {
    path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListCaptureTargetsArgs {
    root_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CaptureTargetPreviewArgs {
    root_path: String,
    target_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeleteCaptureHeadingArgs {
    root_path: String,
    target_path: String,
    heading_order: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MoveCaptureHeadingArgs {
    root_path: String,
    target_path: String,
    source_heading_order: i64,
    target_heading_order: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddCaptureHeadingArgs {
    root_path: String,
    target_path: String,
    heading_level: i64,
    heading_text: String,
    selected_target_heading_order: Option<i64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct IndexRootArgs {
    path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GetFilePreviewArgs {
    file_id: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GetHeadingPreviewHtmlArgs {
    file_id: i64,
    heading_order: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InsertCaptureArgs {
    root_path: String,
    source_path: String,
    section_title: String,
    content: String,
    paragraph_xml: Option<Vec<String>>,
    target_path: Option<String>,
    heading_level: Option<i64>,
    heading_order: Option<i64>,
    selected_target_heading_order: Option<i64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchIndexHybridArgs {
    query: String,
    root_path: Option<String>,
    limit: Option<usize>,
    file_name_only: Option<bool>,
    semantic_enabled: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BenchmarkRootPerformanceArgs {
    path: String,
    queries: Option<Vec<String>>,
    iterations: Option<usize>,
    limit: Option<usize>,
    include_semantic: Option<bool>,
    preview_samples: Option<usize>,
}

fn parse_args<T: DeserializeOwned>(value: Value) -> CommandResult<T> {
    serde_json::from_value(value).map_err(|error| format!("Could not parse command args: {error}"))
}

fn to_json_value<T: Serialize>(value: T) -> CommandResult<Value> {
    serde_json::to_value(value).map_err(|error| format!("Could not serialize command result: {error}"))
}

fn invoke_command(request: InvokeRequest) -> CommandResult<Value> {
    let app = current_app_handle()?;
    let InvokeRequest { command, args } = request;

    match command.as_str() {
        "add_root" => {
            let args: AddRootArgs = parse_args(args)?;
            to_json_value(commands::add_root(app, args.path)?)
        }
        "list_roots" => {
            let _: EmptyArgs = parse_args(args)?;
            to_json_value(commands::list_roots(app)?)
        }
        "get_index_snapshot" => {
            let args: GetIndexSnapshotArgs = parse_args(args)?;
            to_json_value(commands::get_index_snapshot(app, args.path)?)
        }
        "list_capture_targets" => {
            let args: ListCaptureTargetsArgs = parse_args(args)?;
            to_json_value(commands::list_capture_targets(app, args.root_path)?)
        }
        "get_capture_target_preview" => {
            let args: CaptureTargetPreviewArgs = parse_args(args)?;
            to_json_value(commands::get_capture_target_preview(
                app,
                args.root_path,
                args.target_path,
            )?)
        }
        "delete_capture_heading" => {
            let args: DeleteCaptureHeadingArgs = parse_args(args)?;
            to_json_value(commands::delete_capture_heading(
                app,
                args.root_path,
                args.target_path,
                args.heading_order,
            )?)
        }
        "move_capture_heading" => {
            let args: MoveCaptureHeadingArgs = parse_args(args)?;
            to_json_value(commands::move_capture_heading(
                app,
                args.root_path,
                args.target_path,
                args.source_heading_order,
                args.target_heading_order,
            )?)
        }
        "add_capture_heading" => {
            let args: AddCaptureHeadingArgs = parse_args(args)?;
            to_json_value(commands::add_capture_heading(
                app,
                args.root_path,
                args.target_path,
                args.heading_level,
                args.heading_text,
                args.selected_target_heading_order,
            )?)
        }
        "index_root" => {
            let args: IndexRootArgs = parse_args(args)?;
            to_json_value(commands::index_root(app, args.path)?)
        }
        "get_file_preview" => {
            let args: GetFilePreviewArgs = parse_args(args)?;
            to_json_value(commands::get_file_preview(app, args.file_id)?)
        }
        "get_heading_preview_html" => {
            let args: GetHeadingPreviewHtmlArgs = parse_args(args)?;
            to_json_value(commands::get_heading_preview_html(
                app,
                args.file_id,
                args.heading_order,
            )?)
        }
        "insert_capture" => {
            let args: InsertCaptureArgs = parse_args(args)?;
            to_json_value(commands::insert_capture(
                app,
                args.root_path,
                args.source_path,
                args.section_title,
                args.content,
                args.paragraph_xml,
                args.target_path,
                args.heading_level,
                args.heading_order,
                args.selected_target_heading_order,
            )?)
        }
        "search_index_hybrid" => {
            let args: SearchIndexHybridArgs = parse_args(args)?;
            to_json_value(async_runtime::block_on(commands::search_index_hybrid(
                app,
                args.query,
                args.root_path,
                args.limit,
                args.file_name_only,
                args.semantic_enabled,
            ))?)
        }
        "benchmark_root_performance" => {
            let args: BenchmarkRootPerformanceArgs = parse_args(args)?;
            to_json_value(async_runtime::block_on(commands::benchmark_root_performance(
                app,
                args.path,
                args.queries,
                args.iterations,
                args.limit,
                args.include_semantic,
                args.preview_samples,
            ))?)
        }
        _ => Err(format!("Unknown command: {command}")),
    }
}

fn response_json_pointer(response: InvokeResponse) -> *mut c_char {
    let raw = serde_json::to_string(&response).unwrap_or_else(|error| {
        format!(
            "{{\"ok\":false,\"error\":\"Could not serialize response: {error}\"}}"
        )
    });

    CString::new(raw)
        .unwrap_or_else(|_| {
            CString::new("{\"ok\":false,\"error\":\"Response contains null byte\"}")
                .expect("fallback JSON string is valid")
        })
        .into_raw()
}

unsafe fn pointer_to_string(ptr: *const c_char) -> CommandResult<String> {
    if ptr.is_null() {
        return Err("Received null pointer".to_string());
    }

    CStr::from_ptr(ptr)
        .to_str()
        .map(|value| value.to_string())
        .map_err(|error| format!("Could not decode UTF-8 string: {error}"))
}

pub type CoreEventCallback = extern "C" fn(*const c_char, *const c_char);

#[no_mangle]
pub extern "C" fn core_set_event_callback(callback: Option<CoreEventCallback>) {
    set_event_callback(callback);
}

#[no_mangle]
pub extern "C" fn core_configure(
    app_data_dir_ptr: *const c_char,
    resource_dir_ptr: *const c_char,
) -> c_int {
    let app_data_dir = unsafe { pointer_to_string(app_data_dir_ptr) };
    let resource_dir = unsafe { pointer_to_string(resource_dir_ptr) };

    let Ok(app_data_dir) = app_data_dir else {
        return 0;
    };

    let resource_dir = resource_dir.ok().and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(PathBuf::from(trimmed))
        }
    });

    let app_handle = AppHandle::new(PathBuf::from(app_data_dir), resource_dir);
    if set_app_handle(app_handle).is_err() {
        return 0;
    }

    1
}

#[no_mangle]
pub extern "C" fn core_invoke_json(request_ptr: *const c_char) -> *mut c_char {
    let response = match unsafe { pointer_to_string(request_ptr) }
        .and_then(|raw| serde_json::from_str::<InvokeRequest>(&raw).map_err(|error| error.to_string()))
        .and_then(invoke_command)
    {
        Ok(value) => InvokeResponse {
            ok: true,
            value: Some(value),
            error: None,
        },
        Err(error) => InvokeResponse {
            ok: false,
            value: None,
            error: Some(error),
        },
    };

    response_json_pointer(response)
}

#[no_mangle]
pub extern "C" fn core_free_str(s: *mut c_char) {
    if s.is_null() {
        return;
    }
    unsafe {
        drop(CString::from_raw(s));
    }
}
