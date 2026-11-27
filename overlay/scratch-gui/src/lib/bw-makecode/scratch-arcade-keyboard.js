// SPDX-License-Identifier: BSD-3-Clause

// Arcade normally aliases WASD and the arrow keys onto player one. A Scratch
// project that reads both sets separately needs two independent controllers.
const directions = ['up', 'down', 'left', 'right'];
const letters = ['w', 's', 'a', 'd'];
const aliases = ['a', 'b', 'x', 'z'];
const arrowKeys = directions.map(direction => `${direction} arrow`);
const controlNames = [...directions, 'A', 'B'];
const physicalNames = ['W', 'S', 'A', 'D', 'Space', 'Enter'];
const arrowNames = ['UpArrow', 'DownArrow', 'LeftArrow', 'RightArrow'];
const actionSlot = key => key === 'a' || key === 'space' ? 4 : 5;

export function planScratchArcadeKeyboard (targets) {
    const keys = new Set();
    for (const {blocks = {}} of targets) {
        for (const block of Object.values(blocks)) {
            if (block?.opcode === 'event_whenkeypressed') keys.add(block.fields?.KEY_OPTION?.[0]);
            if (block?.opcode === 'sensing_keypressed') {
                const id = block.inputs?.KEY_OPTION?.[1];
                if (typeof id === 'string' && blocks[id]?.opcode === 'sensing_keyoptions') {
                    keys.add(blocks[id].fields?.KEY_OPTION?.[0]);
                }
            }
        }
    }

    const useWasd = ['w', 's', 'd'].some(key => keys.has(key));
    const split = useWasd && arrowKeys.some(key => keys.has(key));
    const controls = new Map();
    const keymaps = Array.from({length: 4}, () => Array(6).fill(null));
    const reserve = (key, player, slot, physicalKey) => {
        keymaps[player][slot] = physicalKey;
        controls.set(key, `${player ? `controller.player${player + 1}` : 'controller'}.${controlNames[slot]}`);
    };

    // Keep arrow-only examples and their conventional Arcade aliases on
    // the normal SDK keymap. Remap keyboard keys when they need distinct edges.
    const knownDefault = key => arrowKeys.includes(key) || key === 'space' || key === 'any';
    const needsRemap = split || [...keys].some(key => typeof key === 'string' &&
        /^[a-z0-9]$/i.test(key) && (!useWasd || !letters.includes(key)));
    if (!needsRemap) {
        for (const [index, key] of (useWasd ? letters : arrowKeys).entries()) {
            controls.set(key, `controller.${directions[index]}`);
        }
        controls.set('space', 'controller.A');
        return {controls, setup: []};
    }

    if (useWasd) {
        for (const [index, key] of letters.entries()) reserve(key, 0, index, physicalNames[index]);
    }
    if (!useWasd || split) {
        for (const [index, key] of arrowKeys.entries()) {
            if (keys.has(key) || split) reserve(key, split ? 1 : 0, index, arrowNames[index]);
        }
    }
    if (keys.has('space')) reserve('space', 0, 4, 'Space');
    for (const key of keys) {
        if (typeof key !== 'string' || controls.has(key) || knownDefault(key) || !/^[a-z0-9]$/.test(key)) continue;
        const preferred = aliases.includes(key) ? actionSlot(key) : 4;
        const index = keymaps.findIndex(player => player.includes(null));
        if (index === -1) break;
        const player = keymaps[index];
        const slot = player[preferred] === null ? preferred : player[5] === null ? 5 : player.indexOf(null);
        const physicalKey = /^[0-9]$/.test(key) ?
            ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'][Number(key)] : key.toUpperCase();
        reserve(key, index, slot, physicalKey);
    }

    // The SDK native targets ignore keyboard remapping and use these same
    // controller channels with physical gamepads.
    const setup = keymaps.flatMap((player, index) => player.some(Boolean) ?
        [`keymap.setPlayerKeys(${index + 1}, ${player.map(key => `keymap.KeyCode.${key || 'None'}`).join(', ')})`] : []);
    return {controls, setup};
}
