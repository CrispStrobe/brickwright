const browserDownload = (filename, blob) => {
    const downloadLink = document.createElement('a');
    document.body.appendChild(downloadLink);

    // Use special ms version if available to get it working on Edge.
    if (navigator.msSaveOrOpenBlob) {
        navigator.msSaveOrOpenBlob(blob, filename);
        return;
    }

    if ('download' in HTMLAnchorElement.prototype) {
        const url = window.URL.createObjectURL(blob);
        downloadLink.href = url;
        downloadLink.download = filename;
        downloadLink.type = blob.type;
        downloadLink.click();
        // remove the link after a timeout to prevent a crash on iOS 13 Safari
        window.setTimeout(() => {
            document.body.removeChild(downloadLink);
            window.URL.revokeObjectURL(url);
        }, 1000);
    } else {
        // iOS 12 Safari, open a new page and set href to data-uri
        let popup = window.open('', '_blank');
        const reader = new FileReader();
        reader.onloadend = function () {
            popup.location.href = reader.result;
            popup = null;
        };
        reader.readAsDataURL(blob);
    }
};

// Brickwright: under Tauri, route "downloads" (project .sb3 export, sprite/costume/
// sound exports) through a native Save dialog instead of a browser download. Falls
// back to the normal browser download everywhere else.
export default (filename, blob, {allowBrowserShare = true} = {}) => {
    const tauri = typeof window !== 'undefined' && window.__TAURI__;
    if (tauri && tauri.core && typeof tauri.core.invoke === 'function') {
        const invoke = tauri.core.invoke;
        // RETURN the promise. It used to be fire-and-forget with a console.error,
        // so a failed native export was invisible to the caller and to the user;
        // sb3-downloader now catches and shows it in the GUI.
        return blob.arrayBuffer()
            .then(async buf => {
                const bytes = Array.from(new Uint8Array(buf));
                const mobile = await invoke('is_mobile').catch(() => false);
                if (mobile) {
                    // Mobile: write a temp file and hand it to the OS share sheet.
                    const path = await invoke('write_temp_project', {filename, bytes});
                    await invoke('plugin:share|share_file', {path, mime: 'application/octet-stream'});
                } else {
                    // macOS: the system share picker includes AirDrop, Messages,
                    // Mail and LocalSend when installed. Other desktops return
                    // false and retain the native Save-As path.
                    const path = await invoke('write_temp_project', {filename, bytes});
                    const shared = await invoke('share_file_native', {path}).catch(() => false);
                    if (!shared) await invoke('save_project', {filename, bytes});
                }
            })
            .catch(e => {
                // eslint-disable-next-line no-console
                console.error('[brickwright] native export failed', e);
                throw e;
            });
    }

    // Installed PWAs and supporting browsers can expose the same system share
    // targets as native apps. If the browser rejects it (commonly because user
    // activation expired while an archive was built), retain the download path.
    if (allowBrowserShare && typeof navigator.share === 'function' && typeof File === 'function') {
        const file = new File([blob], filename, {type: blob.type || 'application/octet-stream'});
        const shareData = {files: [file], title: filename};
        if (!navigator.canShare || navigator.canShare(shareData)) {
            return navigator.share(shareData).catch(() => browserDownload(filename, blob));
        }
    }
    return browserDownload(filename, blob);
};
