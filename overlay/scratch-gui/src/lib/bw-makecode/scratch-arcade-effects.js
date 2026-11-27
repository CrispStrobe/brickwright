// SPDX-License-Identifier: BSD-3-Clause
import {nearestIndex} from './pixel-image.js';

const hueOfMaximum = [
    (r, g, b, range) => ((g - b) / range + 6) % 6,
    (r, g, b, range) => (b - r) / range + 2,
    (r, g, b, range) => (r - g) / range + 4
];

function rotatedColour (colour, shift) {
    const rgb = colour.match(/[0-9a-f]{2}/gi).map(hex => parseInt(hex, 16) / 255);
    const maximum = Math.max(...rgb), range = maximum - Math.min(...rgb);
    const hue = (range ? hueOfMaximum[rgb.indexOf(maximum)](...rgb, range) : 0) / 6;
    const saturation = maximum < 0.055 ? 1 : Math.max(maximum ? range / maximum : 0, 0.09);
    const value = Math.max(0.055, maximum);
    const H = ((hue + shift) % 1) * 6;
    const C = value * saturation;
    const X = C * (1 - Math.abs(H % 2 - 1));
    const rgb2 = [[C, X, 0], [X, C, 0], [0, C, X], [0, X, C], [X, 0, C], [C, 0, X]][Math.floor(H)];
    return rgb2.map(channel => Math.round((channel + value - C) * 255));
}

// The original actor still uses a 16-colour Arcade palette. Quantize a
// Scratch hue rotation once per step and use the table while drawing.
export function scratchArcadeHueTable (palette, steps) {
    return Array.from({length: steps}, (_, row) => palette.map((colour, index) =>
        index === 0 || row === 0 ? index : nearestIndex(rotatedColour(colour, row / steps), palette)));
}
