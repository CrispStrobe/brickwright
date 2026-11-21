// SPDX-License-Identifier: BSD-3-Clause
/**
 * The CAD shapes blocks' right-click menu (docs/CAD-BLOCKS-LITE.md).
 *
 * On a "build CAD model" block, or any block inside one:
 *   - Build CAD model     — what running the block does, without running the script;
 *   - Show CAD code…      — the model as parametric CAD Script, OpenSCAD or JSCAD,
 *                           to copy or download (needs only the CAD SDK, not the editor);
 *   - Live preview        — rebuild the model after every edit while it is on.
 *
 * The items appear only when runtime.cadShapes exists (a CAD Editor build with the
 * extension's bridge installed, lib/bw-cad-blocks.js). Hooked the way
 * lib/bw-debug/block-menu.js is, and for its reasons: this scratch-blocks fork
 * builds block menus inline in showContextMenu_, and a prototype-level
 * customContextMenu breaks Block.mixin().
 */

const TEXT = {
    en: {
        build: 'Build CAD model', show: 'Show CAD code…', liveOn: '✓ Live preview', liveOff: 'Live preview',
        title: 'CAD code of', copy: 'Copy', copied: 'Copied', download: 'Download', close: 'Close',
        loading: 'Compiling…', cadcode: 'CAD Script', openscad: 'OpenSCAD', jscad: 'JSCAD',
        hint: {
            cadcode: 'Brickwright CAD Script — what the model\'s code node holds. Paste it into a code node in the CAD Editor.',
            openscad: 'OpenSCAD with Customizer parameters. Open the .scad file in OpenSCAD.',
            jscad: 'JSCAD v2 with getParameterDefinitions(). Open the .js file at openjscad.xyz.'
        }
    },
    de: {
        build: 'CAD-Modell bauen', show: 'CAD-Code zeigen…', liveOn: '✓ Live-Vorschau', liveOff: 'Live-Vorschau',
        title: 'CAD-Code von', copy: 'Kopieren', copied: 'Kopiert', download: 'Herunterladen', close: 'Schließen',
        loading: 'Wird übersetzt…', cadcode: 'CAD Script', openscad: 'OpenSCAD', jscad: 'JSCAD',
        hint: {
            cadcode: 'Brickwright CAD Script — das steht im Code-Knoten des Modells. In einen Code-Knoten im CAD-Editor einfügen.',
            openscad: 'OpenSCAD mit Customizer-Parametern. Die .scad-Datei in OpenSCAD öffnen.',
            jscad: 'JSCAD v2 mit getParameterDefinitions(). Die .js-Datei auf openjscad.xyz öffnen.'
        }
    }
};
const FORMATS = ['cadcode', 'openscad', 'jscad'];
const EXTENSION = {cadcode: '.bwcad.txt', openscad: '.scad', jscad: '.jscad.js'};
const MIME = {cadcode: 'text/plain', openscad: 'application/x-openscad', jscad: 'text/javascript'};

const CSS = `
.bw-cadcode-backdrop { position: fixed; inset: 0; z-index: 1100; background: rgba(0,0,0,.35);
  display: flex; align-items: center; justify-content: center; }
.bw-cadcode { width: min(820px, 92vw); max-height: 86vh; display: flex; flex-direction: column;
  background: #fff; color: #1f2937; border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,.35);
  font: 13px/1.4 system-ui, sans-serif; }
.bw-cadcode header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #e5e7eb; }
.bw-cadcode header h2 { flex: 1; margin: 0; font-size: 15px; font-weight: 600; }
.bw-cadcode [role=tab] { border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 6px; padding: 4px 10px; cursor: pointer; }
.bw-cadcode [role=tab][aria-selected=true] { background: #4C6CD9; border-color: #4C6CD9; color: #fff; }
.bw-cadcode p { margin: 8px 14px 0; color: #64748b; }
.bw-cadcode pre { flex: 1; overflow: auto; margin: 8px 14px; padding: 10px; background: #0f172a; color: #e2e8f0;
  border-radius: 6px; font: 12px/1.45 ui-monospace, Menlo, monospace; white-space: pre; min-height: 160px; }
.bw-cadcode pre.bw-error { background: #fef2f2; color: #991b1b; white-space: pre-wrap; }
.bw-cadcode footer { display: flex; gap: 8px; justify-content: flex-end; padding: 0 14px 12px; }
.bw-cadcode footer button { border: 1px solid #cbd5e1; background: #fff; border-radius: 6px; padding: 5px 12px; cursor: pointer; }
.bw-cadcode footer button:disabled { opacity: .5; cursor: default; }
`;

let styleEl = null;
let openDialog = null;

/** The "build CAD model" block a block belongs to (itself, or the nearest one around it). */
export const enclosingModel = block => {
    for (let b = block; b; b = typeof b.getSurroundParent === 'function' ? b.getSurroundParent() : null) {
        if (b.type === 'cadshapes_model') return b;
    }
    return null;
};

const safeFileName = name => (String(name).replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, '-') || 'model');

/**
 * The code dialog. `exportModel(format)` resolves to the text; exported for tests.
 * @returns {{element: HTMLElement, close: () => void, select: (format: string) => Promise<void>}}
 */
export function showCadCodeDialog ({name, exportModel, locale = 'en', doc = document}) {
    if (openDialog) openDialog.close();
    const words = TEXT[locale] || TEXT.en;
    if (!styleEl || styleEl.ownerDocument !== doc || !doc.head.contains(styleEl)) {
        styleEl = doc.createElement('style');
        styleEl.textContent = CSS;
        doc.head.appendChild(styleEl);
    }
    const el = (tag, props = {}, ...children) => {
        const node = doc.createElement(tag);
        Object.assign(node, props);
        for (const child of children) node.appendChild(child);
        return node;
    };
    const backdrop = el('div', {className: 'bw-cadcode-backdrop'});
    const dialog = el('div', {className: 'bw-cadcode'});
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-label', `${words.title} ${name}`);
    const tabs = FORMATS.map(format => {
        const tab = el('button', {type: 'button', textContent: words[format]});
        tab.setAttribute('role', 'tab');
        tab.setAttribute('data-format', format);
        return tab;
    });
    const hint = el('p');
    const pre = el('pre');
    const copy = el('button', {type: 'button', textContent: words.copy});
    const download = el('button', {type: 'button', textContent: words.download});
    const close = el('button', {type: 'button', textContent: words.close});
    for (const part of [el('header', {}, el('h2', {textContent: `${words.title} „${name}“`}), ...tabs), hint, pre,
        el('footer', {}, copy, download, close)]) dialog.appendChild(part);
    backdrop.appendChild(dialog);
    doc.body.appendChild(backdrop);

    let current = {format: null, text: '', ok: false};
    let request = 0;
    const select = async format => {
        const mine = ++request;
        for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.getAttribute('data-format') === format));
        hint.textContent = words.hint[format];
        pre.className = '';
        pre.textContent = words.loading;
        copy.disabled = download.disabled = true;
        let text, ok;
        try { text = await exportModel(format); ok = true; } catch (error) { text = error && error.message || String(error); ok = false; }
        if (mine !== request) return;
        current = {format, text, ok};
        pre.textContent = text;
        pre.className = ok ? '' : 'bw-error';
        copy.disabled = download.disabled = !ok;
    };
    const onKey = event => { if (event.key === 'Escape') api.close(); };
    const api = {
        element: backdrop,
        select,
        close () {
            doc.removeEventListener('keydown', onKey, true);
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
            if (openDialog === api) openDialog = null;
        }
    };
    for (const tab of tabs) tab.addEventListener('click', () => select(tab.getAttribute('data-format')));
    copy.addEventListener('click', () => {
        const clip = doc.defaultView && doc.defaultView.navigator && doc.defaultView.navigator.clipboard;
        if (!clip) return;
        clip.writeText(current.text).then(() => { copy.textContent = words.copied; setTimeout(() => { copy.textContent = words.copy; }, 1200); }, () => {});
    });
    download.addEventListener('click', () => {
        const view = doc.defaultView;
        const url = view.URL.createObjectURL(new view.Blob([current.text], {type: MIME[current.format]}));
        const a = el('a', {href: url, download: safeFileName(name) + EXTENSION[current.format]});
        doc.body.appendChild(a);
        a.click();
        doc.body.removeChild(a);
        setTimeout(() => view.URL.revokeObjectURL(url), 1000);
    });
    close.addEventListener('click', () => api.close());
    backdrop.addEventListener('click', event => { if (event.target === backdrop) api.close(); });
    doc.addEventListener('keydown', onKey, true);
    openDialog = api;
    select('cadcode');
    return api;
}

/**
 * Installs the menu items.
 * @param {object} ScratchBlocks the injected scratch-blocks namespace
 * @param {object} vm the scratch-vm instance (its runtime.cadShapes is the bridge)
 * @param {() => string} getLocale
 * @returns {{uninstall: () => void}}
 */
export function installCadShapesMenu (ScratchBlocks, vm, getLocale = () => 'en') {
    if (!ScratchBlocks || !ScratchBlocks.BlockSvg || !ScratchBlocks.ContextMenu) return {uninstall () {}};
    const CM = ScratchBlocks.ContextMenu;
    const previousShow = ScratchBlocks.BlockSvg.prototype.showContextMenu_;
    const locale = () => (String(getLocale() || 'en').startsWith('de') ? 'de' : 'en');
    const addItems = (block, options) => {
        const api = vm && vm.runtime && vm.runtime.cadShapes;
        if (!api || options.__bwCadShapesAdded) return;
        const model = enclosingModel(block);
        const target = vm.editingTarget;
        if (!model || !target || !target.blocks.getBlock(model.id)) return;
        options.__bwCadShapesAdded = true;
        const words = TEXT[locale()];
        const name = () => api.modelName(model.id, target);
        options.push({enabled: true, text: words.build,
            callback: () => { api.build(model.id, target).catch(() => { /* reported on the block */ }); }});
        options.push({enabled: true, text: words.show,
            callback: () => showCadCodeDialog({name: name(), locale: locale(),
                exportModel: format => api.exportModel(model.id, target, undefined, format)})});
        const live = api.isLive(model.id);
        options.push({enabled: true, text: live ? words.liveOn : words.liveOff,
            callback: () => api.setLive(model.id, target, !live)});
    };
    let active = true;
    const wrapped = function (e) {
        const block = this;
        const origCMShow = CM.show;
        CM.show = function (ev, options, rtl) {
            try { if (active) addItems(block, options); } catch (error) { /* never block the menu */ }
            return origCMShow.call(this, ev, options, rtl);
        };
        try { return previousShow.call(this, e); } finally { CM.show = origCMShow; }
    };
    ScratchBlocks.BlockSvg.prototype.showContextMenu_ = wrapped;
    return {
        uninstall () {
            // Another menu (bw-debug) may have wrapped this one since; unwrap only if on top.
            active = false;
            if (ScratchBlocks.BlockSvg.prototype.showContextMenu_ === wrapped) ScratchBlocks.BlockSvg.prototype.showContextMenu_ = previousShow;
            if (openDialog) openDialog.close();
        }
    };
}
