//! Brickwright native app (Tauri 2) — shared entry point for desktop and mobile.

// Pure JSON validators are also used by the shared policy core on mobile.
mod arena_inputs;
mod assetserver;
mod downloads;
// Passive unless explicitly requested in a release iOS simulator process.
#[allow(dead_code)]
mod embedded_asset_audit;
mod autosave;
mod fileio;
#[cfg(desktop)]
mod editor_menu;
#[cfg(desktop)]
mod native_broker;
#[cfg(desktop)]
#[allow(dead_code)]
mod native_broker_adapter;
// The semantic seam. Desktop-only for the same reason the adapter is: a phone must not carry
// the command at all, rather than carry it and be refused by an ACL.
#[cfg(desktop)]
mod native_capability;
#[cfg(desktop)]
mod renode_brick_state;
mod spike_program_uart_contract;
#[cfg(desktop)]
mod renode_debugger;
#[cfg(desktop)]
mod renode_rsp;
#[cfg(desktop)]
mod renode_supervisor;
#[cfg(desktop)]
mod spike_flash_store;
// Staged UART byte transport: type-check now, register after image admission
// and modeled UART pacing are qualified. No command or listener is started here.
#[cfg(desktop)]
#[allow(dead_code)]
mod spike_micropython_uart;
// Compiled on every target so the staged relay stays warning-clean. It has no
// command registration or runtime consumer until the authenticated adapter lands.
#[allow(dead_code)]
mod native_broker_transport;
// Compiled now so every target type-checks the staged policy core. Its first
// production consumer is deliberately withheld until the isolated broker
// webview exists; the topology gate forbids registering a partial boundary.
#[allow(dead_code)]
mod native_policy;
// Peer sessions (task E11): only with the `peers` Cargo feature, OFF by default.
// docs/PEERS-SECURITY-REVIEW.md; test/peers-gate.test.mjs holds the default build to none of it.
#[cfg(feature = "peers")]
mod peer;
mod pico;
mod scratchlink;
mod share_server;
mod spike_usb;
// Local application admission is type-checked before native chooser/startup wiring.
#[cfg(desktop)]
#[allow(dead_code)]
mod spike_local_image;
#[cfg(desktop)]
mod spike_image_chooser;
// Native-owned canonical image capsule. Chooser/startup wiring is still pending.
#[cfg(desktop)]
#[allow(dead_code)]
mod spike_staged_image;
#[cfg(desktop)]
#[allow(dead_code)]
mod spike_micropython_launch;

// Desktop context packaging changes: BSD-3-Clause, Copyright (c) 2026 Brickwright contributors.
// Keep the mobile entry point; desktop assets belong in the executable so the
// Rust library metadata does not carry another copy of the entire GUI.
#[cfg(mobile)]
#[tauri::mobile_entry_point]
pub fn run() {
    run_with_context(tauri::generate_context!());
}

pub fn run_with_context(context: tauri::Context<tauri::Wry>) {
    let builder = tauri::Builder::default()
        // Logging → stdout on desktop, logcat/oslog on mobile.
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        // Native Save/Open dialogs, and deep links / .sb3 "open with".
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        // Open external links (help/docs/credits) in the system browser.
        .plugin(tauri_plugin_opener::init());

    // The renderer is a separate WebKit process. Tauri's default silent
    // reload can make repeated native failures look like app navigation.
    #[cfg(target_os = "macos")]
    let builder = builder.on_web_content_process_terminate(|webview| {
        use tauri::Manager;
        use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

        log::error!("WebKit content process terminated (webview: {})", webview.label());
        if webview.label() != "main" {
            if let Err(error) = webview.reload() {
                log::error!("Could not reload {}: {error}", webview.label());
            }
            return;
        }

        let editor = webview.clone();
        webview
            .app_handle()
            .dialog()
            .message(concat!(
                "The editor's WebKit process stopped. Reload the editor to continue. ",
                "If an autosave is available, Brickwright will offer to restore it."
            ))
            .title("Brickwright editor stopped")
            .kind(MessageDialogKind::Warning)
            .buttons(MessageDialogButtons::OkCancelCustom("Reload editor".into(), "Dismiss".into()))
            .show(move |reload| {
                if reload {
                    if let Err(error) = editor.reload() {
                        log::error!("Could not reload the editor after a WebKit stop: {error}");
                    }
                }
            });
    });

    // BLE transport (btleplug on desktop/iOS; Tauri Android plugin on Android). Bluetooth is an
    // optional peripheral path, so its platform discovery must not hold the first window hostage:
    // Linux D-Bus waits 25 seconds for a missing BlueZ service. Our exact MIT/Apache fork keeps
    // plugin registration synchronous but initializes the handler in the background. Until it is
    // ready (or forever on a host without BLE), commands return HandlerNotInitialized and the
    // existing ScratchLink status path reports `handler:false`.
    let builder = builder.plugin(tauri_plugin_blec::init_nonblocking());

    // OS share sheet (sender side of the project share round-trip) — mobile only.
    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_share::init());

    // The reference Scratch Link, as a selectable connection path. iOS only:
    // it is Swift/CoreBluetooth. Registering it does not change any existing
    // route — nothing reaches it until the user picks that transport.
    #[cfg(target_os = "ios")]
    let builder = builder.plugin(tauri_plugin_scratchlink_original::init());
    #[cfg(target_os = "ios")]
    let builder = builder.plugin(tauri_plugin_depth_capture::init());

    // Pico USB serial state — desktop only (the mobile pico commands are stubs).
    #[cfg(desktop)]
    let builder = builder.manage(pico::PicoSerial(std::sync::Mutex::new(None)));
    let builder = builder.manage(share_server::ShareServerState::default());
    #[cfg(feature = "peers")]
    let builder = builder.manage(peer::PeerState::default());

    #[cfg(desktop)]
    let native_policy = native_policy::NativePolicyState::new();
    #[cfg(desktop)]
    let builder = builder.manage(native_policy.clone());
    #[cfg(desktop)]
    let builder = builder.manage(native_broker_adapter::NativeBrokerAdapter::new());
    #[cfg(desktop)]
    let builder = builder.manage(renode_supervisor::RenodeSupervisor::new());
    #[cfg(desktop)]
    let builder = builder.manage(renode_debugger::RenodeDebugger::new());

    builder
        .invoke_handler(tauri::generate_handler![
            #[cfg(desktop)]
            editor_menu::update_editor_menu,
            fileio::save_project,
            fileio::stage_fat_image_chunk,
            fileio::finish_fat_image_export,
            fileio::discard_fat_image_export,
            fileio::open_project_document,
            fileio::open_recent_project,
            fileio::recent_projects,
            fileio::pending_project,
            fileio::clear_project_document,
            fileio::activate_project_document,
            fileio::discard_open_project,
            fileio::save_project_document,
            fileio::write_temp_project,
            fileio::is_mobile,
            fileio::share_file_native,
            autosave::autosave_folder,
            autosave::choose_autosave_folder,
            autosave::clear_autosave_folder,
            autosave::write_autosave,
            share_server::start_share_server,
            share_server::stop_share_server,
            share_server::share_server_status,
            downloads::download_pack,
            downloads::download_pack_zip,
            downloads::pack_present,
            downloads::remove_pack,
            pico::pico_serial_list,
            pico::pico_serial_open,
            pico::pico_serial_write,
            pico::pico_serial_read,
            pico::pico_serial_close,
            pico::pico_bootsel_volume,
            pico::pico_flash_uf2,
            spike_usb::spike_usb_bridge_run,
            scratchlink::bridge::scratchlink_bridge_open,
            scratchlink::bridge::scratchlink_bridge_send,
            scratchlink::bridge::scratchlink_bridge_close,
            #[cfg(feature = "peers")]
            peer::peer_status,
            #[cfg(feature = "peers")]
            peer::peer_enable,
            #[cfg(feature = "peers")]
            peer::peer_disable,
            #[cfg(feature = "peers")]
            peer::peer_send,
            #[cfg(feature = "peers")]
            peer::peer_reply,
            // Transport only, desktop only. Registration is not authority: every one of these
            // is unreachable until `native_broker_ready` grants the runtime capabilities, and
            // mobile never compiles them in at all.
            #[cfg(desktop)]
            native_broker_adapter::native_broker_ready,
            #[cfg(desktop)]
            native_broker_adapter::native_broker_open,
            #[cfg(desktop)]
            native_broker_adapter::native_broker_request,
            #[cfg(desktop)]
            native_broker_adapter::native_broker_reply,
            #[cfg(desktop)]
            native_broker_adapter::native_broker_main_teardown,
            #[cfg(desktop)]
            native_broker_adapter::native_broker_teardown,
            // The only semantic pair. `native_broker_invoke` refuses every operation name the
            // policy core does not know, so registering it does not widen the surface beyond
            // platform.kind.read.
            #[cfg(desktop)]
            native_capability::native_broker_lease,
            #[cfg(desktop)]
            native_capability::native_broker_invoke,
            // Diagnostics: a READ, granted to the editor because that is where it is rendered.
            #[cfg(desktop)]
            native_capability::native_broker_audit
        ])
        .manage(scratchlink::bridge::BridgeState::default())
        .manage(fileio::Documents::default())
        .setup(move |app| {
            // The reviewed peer capability exists only in a `peers` build; see build.rs.
            #[cfg(feature = "peers")]
            {
                use tauri::Manager;
                app.add_capability(include_str!("../runtime-capabilities/peers.json"))?;
            }
            #[cfg(desktop)]
            native_broker::create(app, native_policy.clone())?;
            #[cfg(desktop)]
            editor_menu::install(app.handle());
            #[cfg(desktop)]
            {
                use tauri::Manager;
                app.state::<renode_supervisor::RenodeSupervisor>()
                    .set_flash_store_root(app.path().app_data_dir()?.join("spike-flash-v1"))
                    .map_err(std::io::Error::other)?;
                if option_env!("BW_RENODE_MICROPYTHON_RESOURCE_ROOT").is_some()
                    || option_env!("BW_RENODE_RESOURCE_EXECUTABLE").is_some() {
                    app.state::<renode_supervisor::RenodeSupervisor>()
                        .set_resource_root(app.path().resource_dir()?)
                        .map_err(std::io::Error::other)?;
                }
                let main = app
                    .get_webview_window("main")
                    .ok_or(tauri::Error::WindowNotFound)?;
                #[cfg(target_os = "macos")]
                main.with_webview(|webview| unsafe {
                    extern "C" {
                        fn bw_install_editor_input(view: *mut std::ffi::c_void);
                    }
                    bw_install_editor_input(webview.inner());
                })?;
                let handle = app.handle().clone();
                let lifecycle_policy = native_policy.clone();
                main.on_window_event(move |event| {
                    if matches!(event, tauri::WindowEvent::Destroyed) {
                        let _ = lifecycle_policy.revoke_all("capability-broker");
                        handle
                            .state::<native_broker_adapter::NativeBrokerAdapter>()
                            .revoke_main();
                        handle
                            .state::<renode_supervisor::RenodeSupervisor>()
                            .teardown(renode_supervisor::TeardownReason::AppExit);
                        if let Some(broker) = handle.get_webview_window("capability-broker") {
                            if broker
                                .eval(native_broker_adapter::dispose_all_javascript())
                                .is_err()
                            {
                                let _ = broker.destroy();
                            }
                        }
                    }
                });
            }

            // Bring up the local ScratchLink WS server the web VM dials.
            scratchlink::start();

            // Offline asset cache: create the packs dir and serve it locally so
            // the web VM can load cached library media / model weights by URL.
            if let Ok(root) = downloads::packs_root(app.handle()) {
                let _ = std::fs::create_dir_all(&root);
                assetserver::start(root);
            }

            // turbowarp:// deep links → load the referenced project (if any).
            #[cfg(any(target_os = "macos", target_os = "linux", windows))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        if let Ok(path) = url.to_file_path() {
                            fileio::emit_load_project(&handle, &path);
                        }
                    }
                });
            }
            // Windows and Linux hand an associated project to a fresh launch as an argument.
            #[cfg(any(target_os = "linux", windows))]
            if let Some(path) = std::env::args_os()
                .skip(1)
                .map(std::path::PathBuf::from)
                .find(|path| path.is_file())
            {
                fileio::emit_load_project(app.handle(), &path);
            }
            Ok(())
        })
        .build(context)
        .expect("error while building the Brickwright application")
        // Handle files opened via association / share "open with" (macOS/iOS
        // deliver these as an Opened run event with file:// URLs; the variant
        // doesn't exist on Linux/Windows, where deep links cover it instead).
        .run(move |_app, _event| {
            #[cfg(all(target_os = "ios", target_abi = "sim", not(dev)))]
            if matches!(&_event, tauri::RunEvent::Ready) {
                embedded_asset_audit::observe(_app);
            }
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let tauri::RunEvent::Opened { urls } = _event {
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        fileio::emit_load_project(_app, &path);
                    }
                }
            }
        });
}
