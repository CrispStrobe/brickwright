import React from 'react';
import {FormattedMessage} from 'react-intl';

import musicIconURL from './music/music.png';
import musicInsetIconURL from './music/music-small.svg';

import penIconURL from './pen/pen.png';
import penInsetIconURL from './pen/pen-small.svg';

import videoSensingIconURL from './videoSensing/video-sensing.png';
import videoSensingInsetIconURL from './videoSensing/video-sensing-small.svg';

import text2speechIconURL from './text2speech/text2speech.png';
import text2speechInsetIconURL from './text2speech/text2speech-small.svg';

import translateIconURL from './translate/translate.png';
import translateInsetIconURL from './translate/translate-small.png';

import makeymakeyIconURL from './makeymakey/makeymakey.png';
import makeymakeyInsetIconURL from './makeymakey/makeymakey-small.svg';

import microbitIconURL from './microbit/microbit.png';
import microbitInsetIconURL from './microbit/microbit-small.svg';
import microbitConnectionIconURL from './microbit/microbit-illustration.svg';
import microbitConnectionSmallIconURL from './microbit/microbit-small.svg';

import ev3IconURL from './ev3/ev3.png';
import ev3InsetIconURL from './ev3/ev3-small.svg';
import ev3ConnectionIconURL from './ev3/ev3-hub-illustration.svg';
import ev3ConnectionSmallIconURL from './ev3/ev3-small.svg';

import wedo2IconURL from './wedo2/wedo.png'; // TODO: Rename file names to match variable/prop names?
import wedo2InsetIconURL from './wedo2/wedo-small.svg';
import wedo2ConnectionIconURL from './wedo2/wedo-illustration.svg';
import wedo2ConnectionSmallIconURL from './wedo2/wedo-small.svg';
import wedo2ConnectionTipIconURL from './wedo2/wedo-button-illustration.svg';

import boostIconURL from './boost/boost.png';
import boostInsetIconURL from './boost/boost-small.svg';
import boostConnectionIconURL from './boost/boost-illustration.svg';
import boostConnectionSmallIconURL from './boost/boost-small.svg';
import boostConnectionTipIconURL from './boost/boost-button-illustration.svg';

import gdxforIconURL from './gdxfor/gdxfor.png';
import gdxforInsetIconURL from './gdxfor/gdxfor-small.svg';
import gdxforConnectionIconURL from './gdxfor/gdxfor-illustration.svg';
import gdxforConnectionSmallIconURL from './gdxfor/gdxfor-small.svg';
import {pickLocale, browserLocale} from '../../bw-i18n.js';

// The Robot Lab blocks (scratch-vm crispstrobe/robotlab): what the library card says, in the
// learner's language, and the category icon (a brick on two wheels).
const ROBOT_LAB_TEXT = {
    en: {description: 'Drive the Robot Lab from blocks: load a model, turn its motors, read its sensors and parts.'},
    de: {description: 'Steuere das Robot Lab mit Blöcken: Modell laden, Motoren drehen, Sensoren und Teile lesen.'}
};
const ROBOT_LAB_ICON = 'static/extension-posters/robotlab-badge.svg';

export default [
    {
        name: 'Planète Maths',
        extensionId: 'planetemaths',
        iconURL: 'static/extension-posters/planetemaths.png',
        insetIconURL: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iOCIgZmlsbD0iIzZiOGUyMyIvPjx0ZXh0IHg9IjI0IiB5PSIzMiIgZm9udC1zaXplPSIyNiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2ZmZiIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiPs+APC90ZXh0Pjwvc3ZnPg==',
        description: 'Extra math blocks (Planète Maths) — bundled built-in.',
        featured: true
    },
    {
        name: 'Arrays & Vectors',
        extensionId: 'arrays',
        iconURL: 'static/extension-posters/arrays.png',
        insetIconURL: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iOCIgZmlsbD0iIzJiN2RlOSIvPjx0ZXh0IHg9IjI0IiB5PSIzMyIgZm9udC1zaXplPSIyMiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2ZmZiIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSI+WyBdPC90ZXh0Pjwvc3ZnPg==',
        description: 'Named arrays, vectors & tensors (Arrays & Vectors) — bundled built-in.',
        featured: true
    },
    {
        name: 'micro:bit+',
        extensionId: 'microbitplus',
        iconURL: 'static/extension-posters/microbit.svg',
        insetIconURL: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iOCIgZmlsbD0iIzAwQTNBMyIvPjx0ZXh0IHg9IjI0IiB5PSIxNiIgZm9udC1zaXplPSIxMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2ZmZiIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiPm1pY3JvOmJpdDwvdGV4dD48dGV4dCB4PSIyNCIgeT0iMzgiIGZvbnQtc2l6ZT0iMjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmYiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIj4rPC90ZXh0Pjwvc3ZnPg==',
        description: 'Display, sensors, pins, radio — for the MicroPython simulator.',
        featured: true
    },
    {
        name: 'Circuit Playground',
        extensionId: 'circuitplayground',
        iconURL: 'static/extension-posters/circuitplayground.svg',
        insetIconURL: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjIiIGZpbGw9IiNjMDE2OGMiLz48Y2lyY2xlIGN4PSIyNC4wIiBjeT0iOS4wIiByPSIzLjUiIGZpbGw9IiNmZjAwMDAiIHN0cm9rZT0iIzIyMiIgc3Ryb2tlLXdpZHRoPSIwLjciLz48Y2lyY2xlIGN4PSIzMi44IiBjeT0iMTEuOSIgcj0iMy41IiBmaWxsPSIjZmY3ZjAwIiBzdHJva2U9IiMyMjIiIHN0cm9rZS13aWR0aD0iMC43Ii8+PGNpcmNsZSBjeD0iMzguMyIgY3k9IjE5LjQiIHI9IjMuNSIgZmlsbD0iI2ZmZmYwMCIgc3Ryb2tlPSIjMjIyIiBzdHJva2Utd2lkdGg9IjAuNyIvPjxjaXJjbGUgY3g9IjM4LjMiIGN5PSIyOC42IiByPSIzLjUiIGZpbGw9IiMwMGZmMDAiIHN0cm9rZT0iIzIyMiIgc3Ryb2tlLXdpZHRoPSIwLjciLz48Y2lyY2xlIGN4PSIzMi44IiBjeT0iMzYuMSIgcj0iMy41IiBmaWxsPSIjMDBmZmZmIiBzdHJva2U9IiMyMjIiIHN0cm9rZS13aWR0aD0iMC43Ii8+PGNpcmNsZSBjeD0iMjQuMCIgY3k9IjM5LjAiIHI9IjMuNSIgZmlsbD0iIzAwMDBmZiIgc3Ryb2tlPSIjMjIyIiBzdHJva2Utd2lkdGg9IjAuNyIvPjxjaXJjbGUgY3g9IjE1LjIiIGN5PSIzNi4xIiByPSIzLjUiIGZpbGw9IiM0YjAwODIiIHN0cm9rZT0iIzIyMiIgc3Ryb2tlLXdpZHRoPSIwLjciLz48Y2lyY2xlIGN4PSI5LjciIGN5PSIyOC42IiByPSIzLjUiIGZpbGw9IiM4YTJiZTIiIHN0cm9rZT0iIzIyMiIgc3Ryb2tlLXdpZHRoPSIwLjciLz48Y2lyY2xlIGN4PSI5LjciIGN5PSIxOS40IiByPSIzLjUiIGZpbGw9IiNmZjAwN2YiIHN0cm9rZT0iIzIyMiIgc3Ryb2tlLXdpZHRoPSIwLjciLz48Y2lyY2xlIGN4PSIxNS4yIiBjeT0iMTEuOSIgcj0iMy41IiBmaWxsPSIjZmZmZmZmIiBzdHJva2U9IiMyMjIiIHN0cm9rZS13aWR0aD0iMC43Ii8+PC9zdmc+',
        description: 'Circuit Playground Express: NeoPixel ring, buttons, switch, sensors and speaker — bundled built-in.',
        featured: true
    },
    {
        name: 'GPIO Pins',
        extensionId: 'bwgpio',
        iconURL: 'static/extension-posters/csp.png',
        insetIconURL: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iOCIgZmlsbD0iIzJFOEVCOCIvPjx0ZXh0IHg9IjI0IiB5PSIyMCIgZm9udC1zaXplPSIxMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2ZmZiIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiPkdQSU88L3RleHQ+PGcgZmlsbD0iI2ZmZiI+PHJlY3QgeD0iOSIgeT0iMzAiIHdpZHRoPSI0IiBoZWlnaHQ9IjkiLz48cmVjdCB4PSIxNiIgeT0iMzAiIHdpZHRoPSI0IiBoZWlnaHQ9IjkiLz48cmVjdCB4PSIyMyIgeT0iMzAiIHdpZHRoPSI0IiBoZWlnaHQ9IjkiLz48cmVjdCB4PSIzMCIgeT0iMzAiIHdpZHRoPSI0IiBoZWlnaHQ9IjkiLz48cmVjdCB4PSIzNyIgeT0iMzAiIHdpZHRoPSIyIiBoZWlnaHQ9IjkiLz48L2c+PC9zdmc+',
        description: 'Set and read generic GPIO pins (0–7) — lights the Widgets pane strip; round-trips with the DOS Forth bench.',
        featured: true
    },
    ...(process.env.BW_ENABLE_CAD ? [{
        name: browserLocale().toLowerCase().startsWith('de') ? 'CAD-Modelle' : 'CAD models', extensionId: 'cadlab', iconURL: 'static/extension-posters/cad-models.webp',
        insetIconURL: 'static/extension-posters/cad-cube.svg',
        description: browserLocale().toLowerCase().startsWith('de')
            ? 'CAD-Motoren antreiben, um Grad drehen und Drehgeber lesen. Das CAD-Modell erscheint neben den Blöcken.'
            : 'Drive CAD hinge motors, turn by degrees and read encoders. The CAD model shows beside your blocks.',
        featured: true
    }, {
        name: browserLocale().toLowerCase().startsWith('de') ? 'CAD-Formen' : 'CAD shapes', extensionId: 'cadshapes', iconURL: 'static/extension-posters/cad-shapes.webp',
        insetIconURL: 'static/extension-posters/cad-cube.svg',
        description: browserLocale().toLowerCase().startsWith('de')
            ? 'Baue 3D-Modelle mit Blöcken. Das Modell erscheint neben den Blöcken und aktualisiert sich bei jeder Änderung; Export nach OpenSCAD und JSCAD.'
            : 'Build 3D models from blocks. The model shows beside your blocks and updates as you edit; exports to OpenSCAD and JSCAD.',
        featured: true
    }] : []),
    {
        name: 'Robot Lab',
        extensionId: 'robotlab',
        iconURL: 'static/extension-posters/robotlab.svg',
        insetIconURL: ROBOT_LAB_ICON,
        description: ROBOT_LAB_TEXT[pickLocale(browserLocale(), ROBOT_LAB_TEXT)].description,
        featured: true
    },
    {
        name: 'Arcade',
        extensionId: 'arcade',
        iconURL: 'static/extension-posters/gamepad.png',
        insetIconURL: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iOCIgZmlsbD0iI0U2NDk4MCIvPjx0ZXh0IHg9IjI0IiB5PSIzNCIgZm9udC1zaXplPSIyNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2ZmZiIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiPvCfjq48L3RleHQ+PC9zdmc+',
        description: 'Arcade sprites, images, animations and game controls; adapts to the selected device.',
        featured: true
    },
    {
        name: 'STC12 / 8051 Pins',
        extensionId: 'stc12',
        iconURL: 'static/extension-posters/csp.png',
        insetIconURL: 'static/extension-posters/csp-badge.png',
        description: 'Pin blocks for 8051 cores (P1.0, P3.7) — ports, tone, PWM. One extension, adapts to the project device.',
        featured: true
    },
    {
        name: 'Arduino Pins',
        extensionId: 'stc12',
        iconURL: 'static/extension-posters/csp.png',
        insetIconURL: 'static/extension-posters/csp-badge.png',
        description: 'Pin blocks for Arduino Uno/Nano/ATmega168P (D0–D13, A0–A5) — digital, analog, PWM. Adapts to the project device.',
        featured: true
    },
    {
        name: 'Arduino Mega Pins',
        extensionId: 'stc12',
        iconURL: 'static/extension-posters/csp.png',
        insetIconURL: 'static/extension-posters/csp-badge.png',
        description: 'Pin blocks for Arduino Mega (D0–D53, A0–A15) — PWM on D9–D12, servo on D11/D12. Adapts to the project device.',
        featured: true
    },
    {
        name: 'Pico Pins',
        extensionId: 'stc12',
        iconURL: 'static/extension-posters/csp.png',
        insetIconURL: 'static/extension-posters/csp-badge.png',
        description: 'Pin blocks for Raspberry Pi Pico (GP0, GP25) — digital, analog, PWM. Same extension, adapts to the project device.',
        featured: true
    },
    {
        name: '6502 Pins',
        extensionId: 'stc12',
        iconURL: 'static/extension-posters/csp.png',
        insetIconURL: 'static/extension-posters/csp-badge.png',
        description: 'Pin blocks for the Eater 6502 breadboard machine (PA0–PA7, PB0–PB6 via W65C22 VIA). Digital I/O only — no analog, no PWM.',
        featured: true
    },
    {
        name: 'STC12 Live (Web Serial)',
        extensionId: 'stc12live',
        iconURL: 'static/extension-posters/csp.png',
        insetIconURL: 'static/extension-posters/csp-badge.png',
        description: 'Connect to a real STC12 chip over USB — bundled, works offline.',
        featured: true
    },
    {
        name: 'Circuit',
        extensionId: 'circuit',
        iconURL: 'static/extension-posters/csp.png',
        insetIconURL: 'static/extension-posters/csp-badge.png',
        description: 'Meter blocks: voltage, current, resistance, brightness, tone — bundled built-in.',
        featured: true
    },
    {
        name: 'Devices',
        extensionId: 'devices',
        iconURL: 'static/extension-posters/csp.png',
        insetIconURL: 'static/extension-posters/csp-badge.png',
        description: 'Servo, motor, relay, sensor, display and NeoPixel blocks for circuit projects — bundled built-in.',
        featured: true
    },
    {
        name: 'Controller',
        extensionId: 'controller',
        iconURL: 'static/extension-posters/controller.svg',
        insetIconURL: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iOCIgZmlsbD0iIzdDM0FFRCIvPjxjaXJjbGUgY3g9IjI0IiBjeT0iMjYiIHI9IjE0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMi41IiBvcGFjaXR5PSIwLjYiLz48bGluZSB4MT0iMjQiIHkxPSIyNiIgeDI9IjMxIiB5Mj0iMTUiIHN0cm9rZT0iI2VkZTlmZSIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48Y2lyY2xlIGN4PSIzMSIgY3k9IjE1IiByPSI3IiBmaWxsPSIjZWRlOWZlIi8+PC9zdmc+',
        description: 'Read and drive the Controller panel widgets — joysticks, buttons, sliders, gauges — from your blocks.',
        featured: true
    },
    {
        name: 'Text to Speech',
        extensionId: 'brickwrightTTS',
        iconURL: 'static/extension-posters/tts.png',
        insetIconURL: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iOCIgZmlsbD0iIzBmYmQ4YyIvPjxwYXRoIGQ9Ik0xNCAyMGg1bDctNXYxOGwtNy01aC01eiIgZmlsbD0iI2ZmZiIvPjxwYXRoIGQ9Ik0zMSAxOGE3IDcgMCAwIDEgMCAxMk0zNCAxNGExMiAxMiAwIDAgMSAwIDIwIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMi41IiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=',
        description: 'On-device speech (Web Speech now; CrispASR WASM when hosted) — no cloud.',
        featured: true
    },
    {
        name: 'LEGO Powered Up',
        extensionId: 'legopoweredup',
        iconURL: 'static/extension-posters/lego.png',
        insetIconURL: 'https://crispstrobe.github.io/extensions/images/CrispStrobe/lego_poweredup.svg',
        description: 'LEGO Powered Up — bundled built-in.',
        featured: true
    },
    {
        name: 'LEGO BOOST',
        extensionId: 'legoboostunified',
        iconURL: 'static/extension-posters/lego.png',
        insetIconURL: 'https://crispstrobe.github.io/extensions/images/CrispStrobe/legoboost_universal.svg',
        description: 'LEGO BOOST — bundled built-in.',
        featured: true
    },
    {
        name: 'LEGO WeDo 2.0',
        extensionId: 'wedo2unified',
        iconURL: 'static/extension-posters/lego.png',
        insetIconURL: 'https://crispstrobe.github.io/extensions/images/CrispStrobe/legospike_turbowarp_transpile.svg',
        description: 'LEGO WeDo 2.0 — bundled built-in.',
        featured: true
    },
    {
        // One entry for the whole SPIKE family. It used to be five — Transpiler,
        // (BLE), (BTC), Bridge and (BLE Alt) — which asked a learner to know
        // which firmware their hub ran and which Bluetooth plumbing their
        // machine had before they could pick a block. The extension now detects
        // both. SPIKE Prime and Robot Inventor are the same hub, so there is
        // nothing to choose between them either.
        name: 'LEGO SPIKE Prime / Robot Inventor',
        extensionId: 'spikeprime',
        iconURL: 'static/extension-posters/lego.png',
        insetIconURL: 'https://crispstrobe.github.io/extensions/images/CrispStrobe/legospike_turbowarp_transpile.svg',
        description: 'LEGO SPIKE Prime and Robot Inventor — connects over Scratch Link, ' +
            'Web Bluetooth or a local bridge, on either firmware generation. Bundled built-in.',
        featured: true
    },
    {
        name: 'SPIKE Legacy · Scratch Link BLE',
        extensionId: 'legospikeprimeBLE',
        iconURL: 'static/extension-posters/lego.png',
        insetIconURL: 'https://crispstrobe.github.io/extensions/images/CrispStrobe/legospike_turbowarp_transpile.svg',
        description: 'Archived SPIKE 3 driver via Scratch Link BLE. Best first comparison on iPad; use one hub driver at a time.',
        legacySpikeDebug: true,
        featured: true
    },
    {
        name: 'SPIKE Legacy · Web Bluetooth',
        extensionId: 'spikeprimeble',
        iconURL: 'static/extension-posters/lego.png',
        insetIconURL: 'https://crispstrobe.github.io/extensions/images/CrispStrobe/legospike_turbowarp_transpile.svg',
        description: 'Archived SPIKE 3 driver via Web Bluetooth, for browsers that support it.',
        legacySpikeDebug: true,
        featured: true
    },
    {
        name: 'SPIKE Legacy · Bluetooth Classic',
        extensionId: 'spikeprimeBTC',
        iconURL: 'static/extension-posters/lego.png',
        insetIconURL: 'https://crispstrobe.github.io/extensions/images/CrispStrobe/legospike_turbowarp_transpile.svg',
        description: 'Archived SPIKE 2 driver via Scratch Link Bluetooth Classic; requires matching firmware.',
        legacySpikeDebug: true,
        featured: true
    },
    {
        name: 'SPIKE Legacy · Local Bridge',
        extensionId: 'spikeprimeBridge',
        iconURL: 'static/extension-posters/lego.png',
        insetIconURL: 'https://crispstrobe.github.io/extensions/images/CrispStrobe/legospike_turbowarp_transpile.svg',
        description: 'Archived SPIKE 2 driver via a local WebSocket bridge; requires matching firmware.',
        legacySpikeDebug: true,
        featured: true
    },
    {
        // Was one of THREE entries for the stock EV3 firmware — this one,
        // "LEGO EV3 (Direct)" and "LEGO EV3 LMS" — and the picker gave no way
        // to tell which you wanted, while this one, the flagship, was the one
        // whose live mode did not work. They are now one extension; the other
        // two ids resolve here.
        name: 'LEGO MINDSTORMS EV3',
        extensionId: 'ev3comprehensive',
        iconURL: 'static/extension-posters/lego.png',
        insetIconURL: 'https://crispstrobe.github.io/extensions/images/CrispStrobe/ev3_universal.svg',
        description: 'LEGO MINDSTORMS EV3 — connects over Web Serial, Scratch Link, ' +
            'a local bridge or HTTP, detected automatically; live control and LMS ' +
            'transpiling. Bundled built-in.',
        featured: true
    },
    {
        // The oldest brick in the family, and the only one whose toolchain is
        // a C compiler rather than a protocol: these blocks transpile to NQC
        // and NQC compiles to an .rcx image. That compile happens locally —
        // lib/nqc-runtime-hook.js installs runtime.nqcCompile from the
        // vendored MPL-2.0 build — so the path needs no service and works
        // offline. The BRICK still needs LEGO's own firmware, which nobody may
        // ship; see docs/RCX-FIRMWARE.md.
        name: 'LEGO RCX',
        extensionId: 'legorcx',
        iconURL: 'static/extension-posters/lego.png',
        // No insetIconURL: the gallery serves no images/CrispStrobe/lego_rcx.svg
        // (checked 2026-09-21, 404). Pointing at one anyway would render a
        // broken image in the picker rather than no image.
        description: 'LEGO MINDSTORMS RCX — blocks that transpile to NQC and compile to ' +
            'an .rcx image in the browser. Bring your own firmware. Bundled built-in.',
        featured: true
    },
    {
        name: 'LEGO NXT',
        extensionId: 'legonxt',
        iconURL: 'static/extension-posters/lego.png',
        insetIconURL: 'https://crispstrobe.github.io/extensions/images/CrispStrobe/legonxt_transpile_universal.svg',
        description: 'LEGO NXT — bundled built-in.',
        featured: true
    },
    {
        name: 'LEGO EV3 (ev3dev)',
        extensionId: 'ev3dev',
        iconURL: 'static/extension-posters/lego.png',
        insetIconURL: 'https://crispstrobe.github.io/extensions/images/CrispStrobe/ev3dev_py_transpile.svg',
        description: 'LEGO EV3 (ev3dev) — bundled built-in.',
        featured: true
    },
    {
        name: 'Gamepad',
        extensionId: 'universalgamepad',
        iconURL: 'static/extension-posters/gamepad.png',
        insetIconURL: 'static/extension-posters/gamepad-badge.png',
        description: 'Gamepad — bundled built-in.',
        featured: true
    },
    {
        name: 'CSP Solver',
        extensionId: 'csp',
        iconURL: 'static/extension-posters/csp.png',
        insetIconURL: 'static/extension-posters/csp-badge.png',
        description: 'CSP Solver — bundled built-in.',
        featured: true
    },
    {
        name: (
            <FormattedMessage
                defaultMessage="Music"
                description="Name for the 'Music' extension"
                id="gui.extension.music.name"
            />
        ),
        extensionId: 'music',
        iconURL: musicIconURL,
        insetIconURL: musicInsetIconURL,
        description: (
            <FormattedMessage
                defaultMessage="Play instruments and drums."
                description="Description for the 'Music' extension"
                id="gui.extension.music.description"
            />
        ),
        featured: true
    },
    {
        name: (
            <FormattedMessage
                defaultMessage="Pen"
                description="Name for the 'Pen' extension"
                id="gui.extension.pen.name"
            />
        ),
        extensionId: 'pen',
        iconURL: penIconURL,
        insetIconURL: penInsetIconURL,
        description: (
            <FormattedMessage
                defaultMessage="Draw with your sprites."
                description="Description for the 'Pen' extension"
                id="gui.extension.pen.description"
            />
        ),
        featured: true
    },
    {
        name: (
            <FormattedMessage
                defaultMessage="Video Sensing"
                description="Name for the 'Video Sensing' extension"
                id="gui.extension.videosensing.name"
            />
        ),
        extensionId: 'videoSensing',
        iconURL: videoSensingIconURL,
        insetIconURL: videoSensingInsetIconURL,
        description: (
            <FormattedMessage
                defaultMessage="Sense motion with the camera."
                description="Description for the 'Video Sensing' extension"
                id="gui.extension.videosensing.description"
            />
        ),
        featured: true
    },
    {
        name: (
            <FormattedMessage
                defaultMessage="Camera Capture"
                description="Name for the Camera Capture extension"
                id="gui.extension.cameracapture.name"
            />
        ),
        extensionId: 'cameracapture',
        iconURL: videoSensingIconURL,
        insetIconURL: videoSensingInsetIconURL,
        description: (
            <FormattedMessage
                defaultMessage="Take photos for scanners and camera projects."
                description="Description for the Camera Capture extension"
                id="gui.extension.cameracapture.description"
            />
        ),
        featured: true
    },
    // Peer sessions (task E11): only in a BW_ENABLE_PEERS=1 build, and usable only in the app.
    ...(process.env.BW_ENABLE_PEERS === true ? [{
        name: 'Peer Sessions',
        extensionId: 'peersessions',
        iconURL: videoSensingIconURL,
        insetIconURL: videoSensingInsetIconURL,
        description: 'Take photos and share projects with paired Brickwright sessions.',
        featured: true,
        disabled: typeof window === 'undefined' || !window.__TAURI__
    }] : []),
    {
        name: (
            <FormattedMessage
                defaultMessage="Text to Speech"
                description="Name for the Text to Speech extension"
                id="gui.extension.text2speech.name"
            />
        ),
        extensionId: 'text2speech',
        collaborator: 'Amazon Web Services',
        iconURL: text2speechIconURL,
        insetIconURL: text2speechInsetIconURL,
        description: (
            <FormattedMessage
                defaultMessage="Make your projects talk."
                description="Description for the Text to speech extension"
                id="gui.extension.text2speech.description"
            />
        ),
        featured: true,
        internetConnectionRequired: true
    },
    {
        name: (
            <FormattedMessage
                defaultMessage="Translate"
                description="Name for the Translate extension"
                id="gui.extension.translate.name"
            />
        ),
        extensionId: 'translate',
        collaborator: 'Google',
        iconURL: translateIconURL,
        insetIconURL: translateInsetIconURL,
        description: (
            <FormattedMessage
                defaultMessage="Translate text into many languages."
                description="Description for the Translate extension"
                id="gui.extension.translate.description"
            />
        ),
        featured: true,
        internetConnectionRequired: true
    },
    {
        name: 'Makey Makey',
        extensionId: 'makeymakey',
        collaborator: 'JoyLabz',
        iconURL: makeymakeyIconURL,
        insetIconURL: makeymakeyInsetIconURL,
        description: (
            <FormattedMessage
                defaultMessage="Make anything into a key."
                description="Description for the 'Makey Makey' extension"
                id="gui.extension.makeymakey.description"
            />
        ),
        featured: true
    },
    {
        name: 'micro:bit',
        extensionId: 'microbit',
        collaborator: 'micro:bit',
        iconURL: microbitIconURL,
        insetIconURL: microbitInsetIconURL,
        description: (
            <FormattedMessage
                defaultMessage="Connect your projects with the world."
                description="Description for the 'micro:bit' extension"
                id="gui.extension.microbit.description"
            />
        ),
        featured: true,
        disabled: false,
        bluetoothRequired: true,
        internetConnectionRequired: true,
        launchPeripheralConnectionFlow: true,
        useAutoScan: false,
        connectionIconURL: microbitConnectionIconURL,
        connectionSmallIconURL: microbitConnectionSmallIconURL,
        connectingMessage: (
            <FormattedMessage
                defaultMessage="Connecting"
                description="Message to help people connect to their micro:bit."
                id="gui.extension.microbit.connectingMessage"
            />
        ),
        helpLink: 'https://scratch.mit.edu/microbit'
    },
    {
        // NOT the same extension as 'ev3comprehensive' above, and it used to
        // carry that one's exact name — two identical rows in one picker, with
        // nothing to choose between them but their position. This is Scratch's
        // own stock EV3 extension.
        name: 'LEGO MINDSTORMS EV3 (Scratch)',
        extensionId: 'ev3',
        collaborator: 'LEGO',
        iconURL: ev3IconURL,
        insetIconURL: ev3InsetIconURL,
        description: (
            <FormattedMessage
                defaultMessage="Build interactive robots and more."
                description="Description for the 'LEGO MINDSTORMS EV3' extension"
                id="gui.extension.ev3.description"
            />
        ),
        featured: true,
        disabled: false,
        bluetoothRequired: true,
        internetConnectionRequired: true,
        launchPeripheralConnectionFlow: true,
        useAutoScan: false,
        connectionIconURL: ev3ConnectionIconURL,
        connectionSmallIconURL: ev3ConnectionSmallIconURL,
        connectingMessage: (
            <FormattedMessage
                defaultMessage="Connecting. Make sure the pin on your EV3 is set to 1234."
                description="Message to help people connect to their EV3. Must note the PIN should be 1234."
                id="gui.extension.ev3.connectingMessage"
            />
        ),
        helpLink: 'https://scratch.mit.edu/ev3'
    },
    {
        name: 'LEGO BOOST',
        extensionId: 'boost',
        collaborator: 'LEGO',
        iconURL: boostIconURL,
        insetIconURL: boostInsetIconURL,
        description: (
            <FormattedMessage
                defaultMessage="Bring robotic creations to life."
                description="Description for the 'LEGO BOOST' extension"
                id="gui.extension.boost.description"
            />
        ),
        featured: true,
        disabled: false,
        bluetoothRequired: true,
        internetConnectionRequired: true,
        launchPeripheralConnectionFlow: true,
        useAutoScan: true,
        connectionIconURL: boostConnectionIconURL,
        connectionSmallIconURL: boostConnectionSmallIconURL,
        connectionTipIconURL: boostConnectionTipIconURL,
        connectingMessage: (
            <FormattedMessage
                defaultMessage="Connecting"
                description="Message to help people connect to their BOOST."
                id="gui.extension.boost.connectingMessage"
            />
        ),
        helpLink: 'https://scratch.mit.edu/boost'
    },
    {
        name: 'LEGO Education WeDo 2.0',
        extensionId: 'wedo2',
        collaborator: 'LEGO',
        iconURL: wedo2IconURL,
        insetIconURL: wedo2InsetIconURL,
        description: (
            <FormattedMessage
                defaultMessage="Build with motors and sensors."
                description="Description for the 'LEGO WeDo 2.0' extension"
                id="gui.extension.wedo2.description"
            />
        ),
        featured: true,
        disabled: false,
        bluetoothRequired: true,
        internetConnectionRequired: true,
        launchPeripheralConnectionFlow: true,
        useAutoScan: true,
        connectionIconURL: wedo2ConnectionIconURL,
        connectionSmallIconURL: wedo2ConnectionSmallIconURL,
        connectionTipIconURL: wedo2ConnectionTipIconURL,
        connectingMessage: (
            <FormattedMessage
                defaultMessage="Connecting"
                description="Message to help people connect to their WeDo."
                id="gui.extension.wedo2.connectingMessage"
            />
        ),
        helpLink: 'https://scratch.mit.edu/wedo'
    },
    {
        name: 'Go Direct Force & Acceleration',
        extensionId: 'gdxfor',
        collaborator: 'Vernier',
        iconURL: gdxforIconURL,
        insetIconURL: gdxforInsetIconURL,
        description: (
            <FormattedMessage
                defaultMessage="Sense push, pull, motion, and spin."
                description="Description for the Vernier Go Direct Force and Acceleration sensor extension"
                id="gui.extension.gdxfor.description"
            />
        ),
        featured: true,
        disabled: false,
        bluetoothRequired: true,
        internetConnectionRequired: true,
        launchPeripheralConnectionFlow: true,
        useAutoScan: false,
        connectionIconURL: gdxforConnectionIconURL,
        connectionSmallIconURL: gdxforConnectionSmallIconURL,
        connectingMessage: (
            <FormattedMessage
                defaultMessage="Connecting"
                description="Message to help people connect to their force and acceleration sensor."
                id="gui.extension.gdxfor.connectingMessage"
            />
        ),
        helpLink: 'https://scratch.mit.edu/vernier'
    }
];
