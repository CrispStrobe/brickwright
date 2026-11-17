fn main() {
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();

    // macOS Bluetooth-Classic (RFCOMM/SPP) backend: compile the IOBluetooth
    // Objective-C shim and link the frameworks it needs. iOS BTC goes through
    // ExternalAccessory instead (not this shim).
    if target_os == "macos" {
        cc::Build::new()
            .file("src/scratchlink/bt_macos.m")
            .file("src/macos_share.m")
            .flag("-fobjc-arc")
            .compile("bt_macos");
        println!("cargo:rerun-if-changed=src/scratchlink/bt_macos.m");
        println!("cargo:rerun-if-changed=src/macos_share.m");
        println!("cargo:rustc-link-lib=framework=IOBluetooth");
        println!("cargo:rustc-link-lib=framework=AppKit");
        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rustc-link-lib=framework=CoreBluetooth");
    } else if target_os == "ios" {
        // iOS BTC via MFi ExternalAccessory (EV3/NXT).
        cc::Build::new()
            .file("src/scratchlink/bt_ios.m")
            .flag("-fobjc-arc")
            .compile("bt_ios");
        println!("cargo:rerun-if-changed=src/scratchlink/bt_ios.m");
        // btleplug (via tauri-plugin-blec) uses CoreBluetooth for BLE on iOS but
        // doesn't emit the framework link directive there, so link it explicitly.
        println!("cargo:rustc-link-lib=framework=CoreBluetooth");
        println!("cargo:rustc-link-lib=framework=ExternalAccessory");
        println!("cargo:rustc-link-lib=framework=Foundation");
    }

    // CoreBluetooth *state* probe (permission + power), on both Apple targets.
    // btleplug reports neither, and on iOS a scan against a central that is not
    // powered on fails silently — so without this the diagnostics panel cannot
    // tell "no hub in range" from "Bluetooth is off". See ble_apple.m.
    if target_os == "macos" || target_os == "ios" {
        cc::Build::new()
            .file("src/scratchlink/ble_apple.m")
            .flag("-fobjc-arc")
            .compile("ble_apple");
        println!("cargo:rerun-if-changed=src/scratchlink/ble_apple.m");
    }

    // Defining an application manifest turns Tauri's ACL checks on for local
    // application commands. Keep this list in exact lockstep with
    // `generate_handler!` in src/lib.rs; the structural test enforces that.
    const APP_COMMANDS: &[&str] = &[
        "update_editor_menu",
        "save_project",
        "open_project_document",
        "open_recent_project",
        "recent_projects",
        "pending_project",
        "clear_project_document",
        "activate_project_document",
        "discard_open_project",
        "save_project_document",
        "write_temp_project",
        "is_mobile",
        "share_file_native",
        "autosave_folder",
        "choose_autosave_folder",
        "clear_autosave_folder",
        "write_autosave",
        "start_share_server",
        "stop_share_server",
        "share_server_status",
        "spike_usb_bridge_run",
        "download_pack",
        "download_pack_zip",
        "pack_present",
        "remove_pack",
        "pico_serial_list",
        "pico_serial_open",
        "pico_serial_write",
        "pico_serial_read",
        "pico_serial_close",
        "pico_bootsel_volume",
        "pico_flash_uf2",
        "scratchlink_bridge_open",
        "scratchlink_bridge_send",
        "scratchlink_bridge_close",
        // Desktop-only broker transport. These are registered behind `#[cfg(desktop)]` in
        // `generate_handler!`, and NONE of them is granted by `capabilities/default.json`:
        // `native_broker_ready` is scoped to the broker webview, and the other five are granted
        // only at runtime, after that acknowledgement, by the two disjoint reviewed capabilities
        // in `runtime-capabilities/`.
        "native_broker_ready",
        "native_broker_open",
        "native_broker_request",
        "native_broker_reply",
        "native_broker_main_teardown",
        "native_broker_teardown",
        "native_broker_lease",
        "native_broker_invoke",
        "native_broker_audit",
    ];
    // Peer sessions (task E11, docs/PEERS-SECURITY-REVIEW.md) exist only in a build with the
    // `peers` Cargo feature, which is off by default. Without it these commands are neither
    // registered (`#[cfg(feature = "peers")]` in src/lib.rs) nor given a permission here, so no
    // capability could grant them even by mistake. With it, src/lib.rs adds the one reviewed
    // capability, runtime-capabilities/peers.json, to the main window at startup.
    const PEER_COMMANDS: &[&str] = &[
        "peer_status",
        "peer_enable",
        "peer_disable",
        "peer_send",
        "peer_reply",
    ];
    let commands: &'static [&'static str] = if std::env::var_os("CARGO_FEATURE_PEERS").is_some() {
        Box::leak([APP_COMMANDS, PEER_COMMANDS].concat().into_boxed_slice())
    } else {
        APP_COMMANDS
    };
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(commands)),
    )
    .expect("failed to build Tauri application manifest");
}
