import {
    inspectBrickwrightState,
    applyBrickwrightInspection,
    rollbackBrickwrightInspection
} from './bw-project-bundle';
import {restorePicoFlashProject} from './bw-machines/pico-basic-flash.js';
import {inspectArtwork, applyArtwork} from './bw-artwork-bundle';
import {unpackLms, setActiveLms, clearActiveLms} from './mindstorms-lms';

const announce = detail => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bw-project-bundle-loaded', {detail}));
    }
};

/**
 * Load a project file's bytes into the editor: the Scratch project into the VM, and the
 * Brickwright state that rides in the same archive (Circuit / Code / Widgets tabs, editable
 * artwork, a LEGO MINDSTORMS .lms wrapper) into the rest of the GUI.
 *
 * One sequence for every way a file arrives (the web file input, the native Open dialog,
 * Recent Projects, a file association), so none of them can load the Scratch half while
 * skipping the compatibility preflight or the rollback.
 * @param {object} vm the scratch-vm instance
 * @param {ArrayBuffer} input the file's bytes
 * @param {string} [filename] the file's name; `.lms` selects the MINDSTORMS unwrapping
 * @returns {Promise<void>} resolves once every tab has been told its storage changed
 */
const loadProjectFile = async (vm, input, filename) => {
    let rawFile = input;
    let lms = null;
    if (filename && /\.lms$/i.test(filename)) {
        lms = await unpackLms(rawFile);
        rawFile = lms.scratch;
    }
    const artwork = await inspectArtwork(rawFile);
    const inspection = await inspectBrickwrightState(rawFile);
    if (inspection.outcome === 'invalid' || inspection.outcome === 'future') {
        announce(inspection);
        const reason = inspection.reason || inspection.report?.action;
        throw new Error(`Brickwright project state ${inspection.outcome}: ${reason}`);
    }
    const bundle = applyBrickwrightInspection(inspection);
    if (bundle.outcome === 'storage-failed') {
        throw new Error(`Brickwright project state storage failed: ${bundle.reason}`);
    }
    await vm.loadProject(rawFile).catch(error => {
        const rollback = rollbackBrickwrightInspection(bundle);
        if (!rollback.rolledBack) {
            error.message += `; auxiliary rollback failed: ${rollback.reason}`;
        }
        throw error;
    });
    restorePicoFlashProject(vm.runtime?.getTargetForStage?.(), inspection.picoFlash);
    applyArtwork(artwork, vm);
    if (lms) setActiveLms(lms);
    else clearActiveLms();
    // A project that spans four tabs is only really loaded when all four are. Tell the tabs
    // their storage changed; they seed from localStorage on mount and this is what makes an
    // already-mounted tab notice.
    if (bundle && typeof window !== 'undefined') announce(bundle);
};

export default loadProjectFile;
