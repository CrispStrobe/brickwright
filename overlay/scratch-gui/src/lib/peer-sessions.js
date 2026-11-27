// Peer sessions: the editor half (task E11). Reached ONLY from a build made with
// BW_ENABLE_PEERS=1 (render-gui.jsx imports it behind that build-time literal), and useful only
// in an app built with the `peers` Cargo feature. Review: docs/PEERS-SECURITY-REVIEW.md.
//
// CONSENT IS NOT ASKED HERE. The native side asks the receiving person in a native dialog
// before a request reaches this file (apps/tauri/src-tauri/src/peer/mod.rs), because a
// `window.confirm` in the app is an always-truthy Promise (E6) — the parked WIP's four
// guards of the form `if (!window.confirm ...)` never refused anything (review finding F1).
import loadProjectFile from './bw-project-load';
import {setProjectTitle} from '../reducers/project-title';
import {setProjectChanged} from '../reducers/project-changed';

const MAX_PROJECT_BYTES = 12 * 1024 * 1024;
const MAX_PHOTO_CHARS = 14 * 1024 * 1024;
const CODE_LANGUAGES = new Set(['pseudocode', 'python', 'javascript', 'c', 'basic',
    'asm', 'micropython', 'nqc']);
const peers = new Map();
const photos = new Map();
let selected = '';
let panel = null;
let statusLine = null;
let indicator = null;

const native = () => window.__TAURI__ && window.__TAURI__.core;
const invoke = (name, args) => native().invoke(name, args);
const vm = () => window.__brickwrightStore?.getState()?.scratchGui?.vm;
const title = () => window.__brickwrightStore?.getState()?.scratchGui?.projectTitle || 'Brickwright project';
const alertError = error => {
    const message = String(error?.message || error);
    if (statusLine) statusLine.textContent = message;
    // eslint-disable-next-line no-console
    console.error('[brickwright peers]', message);
};
const setStatus = value => {
    if (statusLine) statusLine.textContent = value;
};
const showIndicator = text => {
    if (!text) {
        indicator?.remove();
        indicator = null;
        return;
    }
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.setAttribute('role', 'status');
        indicator.style.cssText = 'position:fixed;z-index:99999;top:8px;right:8px;' +
            'padding:7px 11px;border-radius:6px;background:#0b7258;color:white;font-weight:bold';
        document.body.appendChild(indicator);
    }
    indicator.textContent = text;
};
const copyLink = async (link, input) => {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(link);
            setStatus('Peer link copied');
            return;
        } catch (error) { /* use the webview-compatible selection path */ }
    }
    input.focus();
    input.select();
    if (!document.execCommand('copy')) throw new Error('Select and copy the peer link manually');
    setStatus('Peer link copied');
};

const bytesToBase64 = bytes => {
    let text = '';
    for (let i = 0; i < bytes.length; i += 8192) {
        text += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return btoa(text);
};
const base64ToBytes = text => {
    const raw = atob(text);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
};

const send = (action, payload = {}, name = selected) => {
    const link = peers.get(name);
    if (!link) throw new Error('Peer is not paired');
    return invoke('peer_send', {link, action, payload});
};

const decodePhotoPixels = photo => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
        try {
            if (!image.naturalWidth || !image.naturalHeight ||
                image.naturalWidth * image.naturalHeight > 4_000_000) {
                throw new Error('Peer photo dimensions are invalid or too large');
            }
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext('2d', {willReadFrequently: true});
            context.drawImage(image, 0, 0);
            resolve({
                width: canvas.width,
                height: canvas.height,
                pixels: context.getImageData(0, 0, canvas.width, canvas.height).data});
        } catch (error) {
            reject(error);
        }
    };
    image.onerror = () => reject(new Error('Could not decode the peer photo'));
    image.src = photo;
});

const photoFor = name => photos.get(name) || null;
const pixelAt = (x, y, name = selected) => {
    const photo = photoFor(name);
    const column = Math.trunc(Number(x));
    const row = Math.trunc(Number(y));
    if (!photo || !Number.isFinite(column) || !Number.isFinite(row) ||
        column < 0 || row < 0 || column >= photo.width || row >= photo.height) return null;
    const offset = ((row * photo.width) + column) * 4;
    return photo.pixels.subarray(offset, offset + 3);
};
const pixelColor = (x, y, name = selected) => {
    const pixel = pixelAt(x, y, name);
    return pixel ? `#${Array.from(pixel, value => value.toString(16).padStart(2, '0')).join('')}` : '';
};
const pixelBrightness = (x, y, name = selected) => {
    const pixel = pixelAt(x, y, name);
    if (!pixel) return 0;
    const luma = (0.2126 * pixel[0]) + (0.7152 * pixel[1]) + (0.0722 * pixel[2]);
    return Math.round((luma / 255) * 100);
};

const captureRemote = async (name = selected) => {
    const result = await send('camera.capture',
        {facing: 'environment', format: 'image/jpeg', quality: 85}, name);
    if (typeof result?.photo !== 'string' || result.photo.length > MAX_PHOTO_CHARS ||
        !result.photo.startsWith('data:image/jpeg;base64,')) {
        throw new Error('Peer returned an invalid photo');
    }
    const decoded = await decodePhotoPixels(result.photo);
    photos.set(name, {data: result.photo, ...decoded});
    setStatus(`Photo received from ${name}: ${decoded.width} × ${decoded.height}`);
    const preview = panel?.querySelector('[data-peer-preview]');
    if (preview && selected === name) {
        preview.src = result.photo;
        preview.hidden = false;
    }
    return result.photo;
};

const serializeProject = async () => {
    const current = vm();
    if (!current) throw new Error('Project is not ready');
    const project = current.runtime?.getTargetForStage?.();
    const blob = await attachBrickwrightState(await current.saveProjectSb3(), {project});
    if (blob.size > MAX_PROJECT_BYTES) throw new Error('Project exceeds the 12 MB peer transfer limit');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return {name: title().slice(0, 100), sb3: bytesToBase64(bytes)};
};

const offerProject = async (name = selected) => send('project.offer', await serializeProject(), name);

const serializeCode = () => {
    window.dispatchEvent(new CustomEvent('bw-project-bundle-collect'));
    const raw = localStorage.getItem('bw-code-autosave');
    if (!raw) throw new Error('There is no code in the Code tab to share');
    const code = JSON.parse(raw);
    if (!CODE_LANGUAGES.has(code.lang) || typeof code.code !== 'string' ||
        new TextEncoder().encode(code.code).length > 512 * 1024 || !code.code.trim()) {
        throw new Error('Code is empty or too large to share');
    }
    return {lang: code.lang, code: code.code};
};

const offerCode = (name = selected) => send('code.offer', serializeCode(), name);

const receiveCode = payload => {
    if (!CODE_LANGUAGES.has(payload?.lang) || typeof payload?.code !== 'string' ||
        new TextEncoder().encode(payload.code).length > 512 * 1024) {
        throw new Error('Invalid shared code');
    }
    localStorage.setItem('bw-code-autosave', JSON.stringify({
        lang: payload.lang, code: payload.code
    }));
    window.dispatchEvent(new CustomEvent('bw-project-bundle-loaded',
        {detail: {outcome: 'loaded'}}));
    return {accepted: true};
};

const receiveProject = async payload => {
    if (typeof payload?.name !== 'string' || typeof payload?.sb3 !== 'string' ||
        payload.sb3.length > Math.ceil(MAX_PROJECT_BYTES / 3) * 4) throw new Error('Invalid shared project');
    const bytes = base64ToBytes(payload.sb3);
    if (bytes.length > MAX_PROJECT_BYTES) throw new Error('Shared project is too large');
    // The one loader every project file goes through (preflight, rollback, every tab).
    await loadProjectFile(vm(), bytes.buffer, 'peer.sb3');
    window.__brickwrightStore?.dispatch(setProjectTitle(payload.name.slice(0, 100)));
    window.__brickwrightStore?.dispatch(setProjectChanged());
    // A received project is a new unsaved document. Saving it must never
    // overwrite the file that was previously open on this device.
    await invoke('clear_project_document');
    return {accepted: true};
};

const requestProject = async (name = selected) => receiveProject(await send('project.request', {}, name));
const requestCode = async (name = selected) => receiveCode(await send('code.request', {}, name));

const shortName = (value, label) => {
    if (typeof value !== 'string' || !value.trim() || value.length > 100) {
        throw new Error(`${label} must be 1–100 characters`);
    }
    return value.trim();
};
const currentRuntime = () => {
    const runtime = vm()?.runtime;
    if (!runtime) throw new Error('Project is not ready');
    return runtime;
};
const spriteTarget = name => {
    const target = currentRuntime().targets.find(item => !item.isStage && item.isOriginal &&
        item.getName() === shortName(name, 'Sprite name'));
    if (!target) throw new Error(`Sprite “${name}” is not in the peer project`);
    return target;
};
const finiteNumber = (value, label, minimum, maximum) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number < minimum || number > maximum) {
        throw new Error(`${label} must be between ${minimum} and ${maximum}`);
    }
    return number;
};
const localSprite = payload => {
    const target = spriteTarget(payload?.sprite);
    return {
        x: target.x,
        y: target.y,
        direction: target.direction,
        size: target.size,
        visible: target.visible
    };
};
const localSpriteMove = payload => {
    const target = spriteTarget(payload?.sprite);
    target.setXY(finiteNumber(payload?.x, 'X', -10000, 10000),
        finiteNumber(payload?.y, 'Y', -10000, 10000));
    return localSprite(payload);
};
const localSpritePoint = payload => {
    const target = spriteTarget(payload?.sprite);
    target.setDirection(finiteNumber(payload?.direction, 'Direction', -10000, 10000));
    return localSprite(payload);
};
const localSpriteSize = payload => {
    const target = spriteTarget(payload?.sprite);
    target.setSize(finiteNumber(payload?.size, 'Size', 1, 1000));
    return localSprite(payload);
};
const localSpriteVisible = payload => {
    const target = spriteTarget(payload?.sprite);
    if (typeof payload?.visible !== 'boolean') throw new Error('Visibility must be true or false');
    target.setVisible(payload.visible);
    return localSprite(payload);
};
const stageVariable = name => {
    const variable = currentRuntime().getTargetForStage()
        .lookupVariableByNameAndType(shortName(name, 'Variable name'), '');
    if (!variable) throw new Error(`Stage variable “${name}” is not in the peer project`);
    return variable;
};
const localVariableGet = payload => ({value: stageVariable(payload?.name).value});
const localVariableSet = payload => {
    if (typeof payload?.value !== 'string' && typeof payload?.value !== 'number') {
        throw new Error('Variable value must be text or a number');
    }
    if (String(payload.value).length > 4096 ||
        (typeof payload.value === 'number' && !Number.isFinite(payload.value))) {
        throw new Error('Variable value is too large or invalid');
    }
    const variable = stageVariable(payload?.name);
    variable.value = payload.value;
    const runtime = currentRuntime();
    runtime.requestTargetsUpdate(runtime.getTargetForStage());
    return {value: variable.value};
};
const localBroadcast = payload => {
    const message = shortName(payload?.message, 'Broadcast message');
    const runtime = currentRuntime();
    const broadcast = runtime.getTargetForStage().lookupBroadcastMsg(null, message);
    if (!broadcast) {
        throw new Error(`Broadcast “${message}” is not in the peer project`);
    }
    const threads = runtime.startHats('event_whenbroadcastreceived',
        {BROADCAST_OPTION: broadcast.name}) || [];
    return {started: threads.length};
};

const localPhoto = async payload => {
    const current = vm();
    if (!current) throw new Error('Project is not ready');
    const manager = current.extensionManager;
    if (!manager.isExtensionLoaded('cameracapture')) {
        await manager.loadExtensionURL('cameracapture');
    }
    const camera = current.runtime.__brickwrightCameraCapture;
    if (!camera) throw new Error('Camera Capture is unavailable');
    setStatus('Paired peer is requesting a camera photo…');
    showIndicator('Peer using camera');
    const alreadyRunning = camera.cameraReady();
    try {
        if (!alreadyRunning) await camera.startCamera({FACING: payload?.facing === 'user' ? 'user' : 'environment'});
        const deadline = Date.now() + 8000;
        while (!camera.cameraReady() && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!camera.cameraReady()) throw new Error(camera.cameraStatus());
        if (!(await invoke('peer_status')).enabled) throw new Error('Peer sharing stopped');
        camera.takePhoto({FORMAT: 'image/jpeg', QUALITY: Number(payload?.quality) || 85});
        const photo = camera.lastPhoto();
        if (!photo || photo.length > MAX_PHOTO_CHARS) throw new Error('Captured photo is too large');
        return {photo, width: camera.photoWidth(), height: camera.photoHeight()};
    } finally {
        if (!alreadyRunning) camera.stopCamera();
        const enabled = await invoke('peer_status').then(value => value.enabled, () => false);
        showIndicator(enabled ? 'Peer sharing on' : '');
    }
};

const handleRequest = request => {
    switch (request.action) {
    case 'ping':
        return {name: title(), camera: Boolean(navigator.mediaDevices?.getUserMedia)};
    case 'camera.capture':
        return localPhoto(request.payload);
    case 'project.offer':
        return receiveProject(request.payload);
    case 'project.request':
        return serializeProject();
    case 'code.offer':
        return receiveCode(request.payload);
    case 'code.request':
        return serializeCode();
    case 'project.run':
        vm()?.greenFlag();
        return {running: true};
    case 'project.stop':
        vm()?.stopAll();
        return {running: false};
    case 'stage.broadcast':
        return localBroadcast(request.payload);
    case 'variable.get':
        return localVariableGet(request.payload);
    case 'variable.set':
        return localVariableSet(request.payload);
    case 'sprite.get':
        return localSprite(request.payload);
    case 'sprite.move':
        return localSpriteMove(request.payload);
    case 'sprite.point':
        return localSpritePoint(request.payload);
    case 'sprite.size':
        return localSpriteSize(request.payload);
    case 'sprite.visible':
        return localSpriteVisible(request.payload);
    default:
        throw new Error('Unknown peer action');
    }
};

const button = (label, action) => {
    const item = document.createElement('button');
    item.textContent = label;
    item.type = 'button';
    item.style.cssText = 'padding:6px 9px;margin:3px;cursor:pointer';
    item.addEventListener('click', () => Promise.resolve()
        .then(action)
        .catch(alertError));
    return item;
};

const render = async () => {
    if (!panel) return;
    panel.replaceChildren();
    panel.appendChild(button('Close', () =>
        window.dispatchEvent(new CustomEvent('bw-open-peer-sessions'))));
    const heading = document.createElement('h2');
    heading.textContent = 'Peer sessions';
    heading.style.margin = '0 0 12px';
    panel.appendChild(heading);
    const explanation = document.createElement('p');
    explanation.textContent = 'Share a link with a device on the same local network. Anyone with the ' +
        'link can ASK for photos, projects and control of this session until you stop sharing; ' +
        'this device asks you before each photo or project, and once before remote control.';
    panel.appendChild(explanation);
    const state = await invoke('peer_status');
    panel.appendChild(button(state.enabled ? 'Stop sharing and revoke link' : 'Start sharing', async () => {
        await invoke(state.enabled ? 'peer_disable' : 'peer_enable');
        showIndicator(state.enabled ? '' : 'Peer sharing on');
        await render();
    }));
    if (state.enabled) {
        const label = document.createElement('p');
        label.textContent = 'Copy one of these links into Peer sessions on the other device:';
        panel.appendChild(label);
        if (!state.links.length) {
            const none = document.createElement('p');
            none.textContent = 'No private network address is available. ' +
                'Connect both devices to a WLAN or Bluetooth network first.';
            panel.appendChild(none);
        }
        state.links.forEach(link => {
            const row = document.createElement('div');
            const value = document.createElement('input');
            value.readOnly = true;
            value.value = link;
            value.style.cssText = 'width:75%;padding:5px';
            row.appendChild(value);
            row.appendChild(button('Copy', () => copyLink(link, value)));
            if (navigator.share) {
                row.appendChild(button('Share…', () => navigator.share({text: link})));
            }
            panel.appendChild(row);
        });
    }
    const peerHeading = document.createElement('h3');
    peerHeading.textContent = 'Paired peers';
    panel.appendChild(peerHeading);
    const programHint = document.createElement('p');
    programHint.textContent = 'Add as many peers as needed. Programs can select one peer, ' +
        'or name each destination directly, such as broadcast "drive" on peer "Robot A".';
    panel.appendChild(programHint);
    const peerName = document.createElement('input');
    peerName.placeholder = 'Peer name';
    peerName.style.cssText = 'padding:5px;margin:3px';
    const peerLink = document.createElement('input');
    peerLink.placeholder = 'bwpeer://… link';
    peerLink.style.cssText = 'width:55%;padding:5px;margin:3px';
    panel.appendChild(peerName);
    panel.appendChild(peerLink);
    panel.appendChild(button('Add peer', async () => {
        const name = peerName.value.trim().slice(0, 60);
        const link = peerLink.value.trim();
        if (!name || !/^bwpeer:\/\/[^/]+\/[A-Za-z0-9_-]{43}$/.test(link)) {
            throw new Error('Enter a peer name and complete share link');
        }
        const result = await invoke('peer_send', {link, action: 'ping', payload: {}});
        photos.delete(name);
        peers.set(name, link);
        selected = name;
        setStatus(`Paired with ${result.name || name}`);
        await render();
    }));
    const select = document.createElement('select');
    select.style.cssText = 'padding:6px;margin:8px 4px';
    for (const name of peers.keys()) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    }
    select.value = selected;
    select.addEventListener('change', () => {
        selected = select.value;
        render().catch(alertError);
    });
    panel.appendChild(select);
    panel.appendChild(button('Forget', async () => {
        photos.delete(selected);
        peers.delete(selected);
        selected = peers.keys().next().value || '';
        await render();
    }));
    panel.appendChild(document.createElement('br'));
    panel.appendChild(button('Take photo', () => captureRemote()));
    panel.appendChild(button('Send project/code', async () => {
        const result = await offerProject(selected);
        setStatus(result.accepted ? 'Project opened on peer' : 'Peer declined the project');
    }));
    panel.appendChild(button('Send Code tab only', async () => {
        const result = await offerCode(selected);
        setStatus(result.accepted ? 'Code opened on peer' : 'Peer declined the code');
    }));
    panel.appendChild(button('Get peer project/code', () => requestProject()));
    panel.appendChild(button('Get peer Code tab', () => requestCode()));
    panel.appendChild(button('Run peer project', () => send('project.run')));
    panel.appendChild(button('Stop peer project', () => send('project.stop')));
    const message = document.createElement('input');
    message.placeholder = 'Peer broadcast, e.g. drive';
    message.style.cssText = 'padding:5px;margin:3px';
    panel.appendChild(document.createElement('br'));
    panel.appendChild(message);
    panel.appendChild(button('Broadcast on peer', async () => {
        const result = await send('stage.broadcast', {message: message.value.trim()});
        setStatus(`Started ${result.started} peer script(s)`);
    }));
    statusLine = document.createElement('p');
    statusLine.setAttribute('role', 'status');
    panel.appendChild(statusLine);
    const image = document.createElement('img');
    image.dataset.peerPreview = '1';
    image.alt = 'Last photo from peer';
    image.style.cssText = 'max-width:100%;max-height:240px';
    image.hidden = !photoFor(selected);
    image.src = photoFor(selected)?.data || '';
    panel.appendChild(image);
};

const openPanel = () => {
    if (panel) {
        panel.remove();
        panel = null;
        statusLine = null;
        return;
    }
    panel = document.createElement('section');
    panel.setAttribute('aria-label', 'Peer sessions');
    panel.style.cssText = 'position:fixed;z-index:100000;top:8%;left:50%;transform:translateX(-50%);' +
        'width:min(90vw,650px);max-height:82vh;overflow:auto;background:white;color:#222;' +
        'border:2px solid #0a7c60;border-radius:10px;padding:18px;box-shadow:0 8px 35px #0007';
    panel.appendChild(button('Close', openPanel));
    document.body.appendChild(panel);
    render().catch(alertError);
};

/** Install the native peer UI and request handler in the main webview. */
export default function initPeerSessions () {
    if (!native() || !window.__TAURI__.event?.listen) return;
    window.__brickwrightPeers = {
        names: () => Array.from(peers.keys()),
        has: name => peers.has(String(name)),
        selected: () => selected,
        select: name => {
            if (!peers.has(name)) throw new Error(`Peer “${name}” is not paired`);
            selected = name;
            if (panel) render().catch(alertError);
        },
        capture: captureRemote,
        lastPhoto: (name = selected) => photoFor(name)?.data || '',
        width: (name = selected) => photoFor(name)?.width || 0,
        height: (name = selected) => photoFor(name)?.height || 0,
        pixelColor,
        pixelBrightness,
        sendProject: offerProject,
        sendCode: offerCode,
        requestProject,
        requestCode,
        run: (name = selected) => send('project.run', {}, name),
        stop: (name = selected) => send('project.stop', {}, name),
        broadcast: (message, peer = selected) => send('stage.broadcast', {message: String(message)}, peer),
        getVariable: async (name, peer = selected) =>
            (await send('variable.get', {name: String(name)}, peer)).value,
        setVariable: (name, value, peer = selected) =>
            send('variable.set', {name: String(name), value}, peer),
        getSprite: (sprite, peer = selected) => send('sprite.get', {sprite: String(sprite)}, peer),
        moveSprite: (sprite, x, y, peer = selected) =>
            send('sprite.move', {sprite: String(sprite), x, y}, peer),
        pointSprite: (sprite, direction, peer = selected) =>
            send('sprite.point', {sprite: String(sprite), direction}, peer),
        sizeSprite: (sprite, size, peer = selected) =>
            send('sprite.size', {sprite: String(sprite), size}, peer),
        showSprite: (sprite, visible, peer = selected) =>
            send('sprite.visible', {sprite: String(sprite), visible}, peer)
    };
    window.addEventListener('bw-open-peer-sessions', openPanel);
    invoke('peer_status').then(state => {
        if (state.enabled) showIndicator('Peer sharing on');
    })
        .catch(alertError);
    window.__TAURI__.event.listen('bw-peer-request', async event => {
        const {id} = event.payload || {};
        if (!Number.isSafeInteger(id)) return;
        try {
            const payload = await handleRequest(event.payload);
            await invoke('peer_reply', {id, payload, error: null});
        } catch (error) {
            await invoke('peer_reply', {id, payload: null, error: String(error?.message || error)});
            alertError(error);
        }
    }).catch(alertError);
}
