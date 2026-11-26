// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors

/**
 * Which Code-tab toolbar actions belong to which device.
 *
 * One table instead of a condition per button: an action names the devices (the `DEVICE x` header,
 * or the MakeCode project target) it applies to. The toolbar asks `toolbarActionApplies` and
 * renders nothing for an action that does not.
 *
 * Rules, in order:
 *  1. A device is selected: the action shows only if the device is in `devices`.
 *     (A SPIKE extension being loaded in the project does not make an Arcade project a SPIKE one.)
 *  2. No device selected (a plain Scratch project): the action shows when `unscoped` is true, or
 *     when it is `evidence`-gated and the project shows signs of the hardware (extension loaded
 *     or the code mentions it).
 */
export const TOOLBAR_ACTIONS = Object.freeze({
    // The virtual SPIKE sandbox and everything that runs a program on a SPIKE hub.
    'spike-arena': {devices: ['spike'], evidence: true},
    'spike-nuttx': {devices: ['spike'], unscoped: true},
    'spike-firmware': {devices: ['spike'], unscoped: true},
    // A physical hub over USB: only when the project shows a hub.
    'spike-usb': {devices: ['spike'], evidence: true}
});

/**
 * @param {string} id key of TOOLBAR_ACTIONS (an unknown id always applies, so a typo is visible)
 * @param {{device?: string|null, evidence?: boolean}} context
 *   device: effective target (MakeCode target, else the DEVICE header), lower case, or null
 *   evidence: the project shows signs of the hardware (extension loaded, code mentions it)
 * @returns {boolean}
 */
export const toolbarActionApplies = (id, {device = null, evidence = false} = {}) => {
    const action = TOOLBAR_ACTIONS[id];
    if (!action) return true;
    if (device) return action.devices.includes(device);
    return Boolean(action.unscoped || (action.evidence && evidence));
};
