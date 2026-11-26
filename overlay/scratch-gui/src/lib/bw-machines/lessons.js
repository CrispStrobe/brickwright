// Machine lessons — machines the app OFFERS, rather than ones a user imported.
//
// "Linux on RISC-V" is the first: a real Linux 6.1 kernel and a BusyBox shell
// on bw-board's RV32 machine. It is listed in the Machine Manager above the
// user's own machines and boots through the same path an imported media-lab
// manifest does (runMachineConfig → activateConfig → debug-runner).
//
// NOTHING GPL IS IN THIS APP. The kernel (GPL-2.0), BusyBox (GPL-2.0) and glibc
// (LGPL-2.1) live in CrispStrobe/brickwright-media-lab, a GPL repository, beside
// their complete corresponding source (release `riscv32-linux-v1`). So does the
// post-boot SNAPSHOT (the machine at the shell prompt — it holds kernel and
// BusyBox memory, so it is GPL like them). This file holds three URLs and three
// SHA-256s.
//
// RUN OPENS AT THE PROMPT. The default Run fetches the snapshot too and bw-board
// restores the machine from it (bw-board src/riscv32-snapshot.js; proven
// byte-for-byte equivalent to a cold boot by its test/linux-riscv/snapshot.mjs),
// so the shell is up in well under a second instead of after a 68-million-
// instruction boot. "Boot from scratch" is the same lesson without the snapshot
// slot: the whole kernel boot, log and all — the lesson is about the internals. The learner's Run fetches the bytes from
// that repository — the fetch is the distribution, made by the GPL repo — and
// activateConfig's fetcher refuses a byte that does not hash to the pin, BY
// SLOT NAME, before anything boots. The licence line and the source link are
// shown next to the Run button, so the offer travels with the binary.

import {MSBASIC_ROM_SHA256} from '../bw-debug/basic-startup.js';
import {remoteMachineImagesAllowed} from '../distribution-policy.js';
//
// WHY raw.githubusercontent.com AT A COMMIT, not the release download: a
// GitHub release asset redirects to a host that sends no CORS header, so a
// browser cannot read it. The raw CDN does send `Access-Control-Allow-Origin:
// *`, and a URL that names a commit cannot change under us. The sha256 is
// checked anyway (test/fetch-pinning.test.mjs classes the URL).
//
// Strings go through bw-i18n (EN + DE); the media-lab project's own words are
// in its README.

import {makeT} from '../bw-i18n.js';
import {newMachineConfig} from './machine-config.js';

const MEDIA_LAB = 'https://github.com/CrispStrobe/brickwright-media-lab';
// Media branch `media/riscv32-linux-v1` at the commit that added the snapshot;
// Image and initramfs.cpio are byte-identical to the ones at 5b257a33 (same pins).
const LINUX_MEDIA_COMMIT = '07132874ee064fa782f80ccae64af8d75cae65c8';
const LINUX_RAW = `https://raw.githubusercontent.com/CrispStrobe/brickwright-media-lab/${LINUX_MEDIA_COMMIT}/riscv32-linux`;

/** The pinned Linux media. Mirrors brickwright-media-lab
 *  projects/riscv32-linux/brickwright-media.json — same URLs, same hashes. */
export const LINUX_RISCV_MEDIA = Object.freeze({
    commit: LINUX_MEDIA_COMMIT,
    kernel: Object.freeze({
        url: `${LINUX_RAW}/Image`,
        sha256: '9130ceb4be18d10560cf49ac495d7f2d5dde23c33972d7a522c077cc523de1a9',
        bytes: 4876836
    }),
    initrd: Object.freeze({
        url: `${LINUX_RAW}/initramfs.cpio`,
        sha256: 'd71915baaae4f35e32679a338885697194e4ecd7f31cbc9c69b82cd86b8edcd5',
        bytes: 2663424
    }),
    /** The machine at the `bwb# ` prompt (bw-board format BWRV32S1, gzip), RAM
     *  stored as a delta against the boot image of the two files above — so it
     *  restores only on top of exactly them (bw-board refuses it otherwise).
     *  Built by bw-board's Linux workflow (run 36576659198), reproducible. */
    snapshot: Object.freeze({
        url: `${LINUX_RAW}/linux-shell.snap.gz`,
        sha256: '7b82fc38525d36e8a98fb9aa112e804813e7d3a456fcca2ace220129357a272c',
        bytes: 2006204
    }),
    /** Where the corresponding source is offered (GPL-2.0 §3 "same place"). */
    source: `${MEDIA_LAB}/releases/tag/riscv32-linux-v1`,
    project: `${MEDIA_LAB}/tree/main/projects/riscv32-linux`,
    licences: Object.freeze(['GPL-2.0-only', 'LGPL-2.1-or-later'])
});

// ELKS 0.9.2 (Embeddable Linux Kernel Subset) — a real 16-bit Unix-like OS on the
// i8086 machine. The official release floppy is GPL-2.0 and lives in brickwright-
// media-lab on the `media/elks-v0.9.2` branch (byte-identical to the upstream
// release asset; mirrored there because raw.githubusercontent sends CORS and the
// GitHub release download does not). Its corresponding source is ghaerr/elks @
// v0.9.2. Same pattern as the Linux lesson above.
const ELKS_MEDIA_COMMIT = '1ebf1392e2c31f58c90d0c849c20c57e16c02614';
const ELKS_RAW = `https://raw.githubusercontent.com/CrispStrobe/brickwright-media-lab/${ELKS_MEDIA_COMMIT}/projects/elks`;

/** The pinned ELKS media. Mirrors brickwright-media-lab projects/elks/
 *  brickwright-media.json — same floppy, same geometry/quirks. */
export const ELKS_MEDIA = Object.freeze({
    commit: ELKS_MEDIA_COMMIT,
    floppy: Object.freeze({
        url: `${ELKS_RAW}/fd1440-fat.img`,
        sha256: '637a1d07ac1b18c7e8fafbf64911ceaa5864a37c60e23878d498534ccaae366b',
        bytes: 1474560,
        geometry: Object.freeze({cylinders: 80, heads: 2, sectors: 18, bytesPerSector: 512})
    }),
    quirks: Object.freeze(['at-floppy-drive-type']),
    /** Corresponding source (GPL-2.0 §3): the upstream ELKS tag the floppy is built from. */
    source: 'https://github.com/ghaerr/elks/tree/v0.9.2',
    project: `${MEDIA_LAB}/tree/main/projects/elks`,
    licences: Object.freeze(['GPL-2.0-only'])
});
// CP/M 2.2 lesson is self-contained: DRI's CCP+BDOS (static/roms/cpm22-64k.bin +
// cpm-bios.bin) and BBC BASIC (static/roms/bbcbasic.com) all ship in this app.
// The cpmsys boot slot points at BBC BASIC; this pins its bytes (same-origin, but
// verified like any slot). Keep in step with the shipped file.
const CPM_BBCBASIC_SHA256 = '833839801fe3edbb73b91613eb43ea6052822d2d09dafd08639d120ad3a6e1bd';

// Microsoft BASIC for 6502 (V1.1, MIT) lesson is also self-contained: the 32 KB
// ROM ships at static/roms/msbasic-6502.rom. It boots on the eater6502 machine,
// whose config (RAM $0000-$3FFF, ROM $8000-$FFFF, 65C51 ACIA console at $5000) is
// given inline here — the same config bw-board's EATER6502 preset uses, which the
// media-lab project's proof relies on. Keep the SHA in step with the shipped ROM.
const EATER6502_CONFIG = Object.freeze({
    clockHz: 1_000_000,
    regions: [
        {kind: 'ram', start: 0x0000, end: 0x3fff},
        {kind: 'rom', start: 0x8000, end: 0xffff}
    ],
    chips: [
        {kind: 'via', name: 'via1', at: 0x6000},
        {kind: 'acia', name: 'acia1', at: 0x5000}
    ]
});

/** The ELKS display screen + keyboard (mirrors the media-lab manifest's widgets). */
const ELKS_WIDGETS = Object.freeze([
    {name: 'screen', type: 'simplevga', config: {width: 640, height: 200},
        layout: {x: 0, y: 0, w: 24, h: 14}, source: 'video'},
    {name: 'keyboard', type: 'keyboard', config: {},
        layout: {x: 0, y: 15, w: 24, h: 3}, source: 'keyIn'}
]);

const TABLE = {
    en: {
        'lessons.heading': 'Lessons',
        'lessons.run': 'Run',
        'linux.title': 'Linux on RISC-V',
        'linux.summary': 'A real Linux 6.1 kernel on the emulated RV32 machine with a BusyBox shell. ' +
            'Run opens at the shell prompt, restored from a snapshot taken after boot; ' +
            'Boot from scratch shows the whole kernel boot. ' +
            'Type commands such as uname -a or ls / into the serial console.',
        'linux.licence': 'Linux and BusyBox are GPL-2.0, glibc is LGPL-2.1. They are not part of this app: ' +
            'Run fetches them ({size}) from brickwright-media-lab and checks their SHA-256 first.',
        'lessons.cold': 'Boot from scratch',
        'linux.source': 'Source code',
        'elks.title': 'ELKS on 8086',
        'elks.summary': 'ELKS 0.9.2 — a real 16-bit Unix-like OS — boots on the emulated 8086 ' +
            'from its 1.44 MB floppy. Run opens the kernel boot on the machine screen: it sizes ' +
            'the disk, mounts the root filesystem and reaches a login. A free BIOS is built in.',
        'elks.licence': 'ELKS is GPL-2.0. It is not part of this app: ' +
            'Run fetches the floppy ({size}) from brickwright-media-lab and checks its SHA-256 first.',
        'elks.source': 'Source code',
        'cpm.title': 'BBC BASIC on CP/M 2.2',
        'cpm.vdpTitle': 'BBC BASIC on CP/M 2.2 + TMS9918A',
        'cpm.vdpSummary': 'Click the 40×24 Controller screen to type. At A>, run BBCBASIC, then try PRINT 2+2. ' +
            'The Z80 drives the VDP at ports $98 and $99. CP/M and BBC BASIC are bundled.',
        'cpm.summary': 'DRI’s real CP/M 2.2 (CCP+BDOS, not a shim) boots on the emulated Z80 to the A> prompt. ' +
            'BBC BASIC is on drive A: — type DIR to list it, BBCBASIC to run it. ' +
            'The console is the Debug panel’s serial terminal. Everything ships in the app — no download.',
        'cpm.licence': 'CP/M 2.2 is DRI’s redistributable release (2022 grant); BBC BASIC (Z80) is zlib (R.T. Russell). ' +
            'Both ship in this app.',
        'cpm.source': 'Project',
        'msbasic.title': 'Microsoft BASIC on 6502',
        'msbasic.summary': 'Microsoft’s original 1978 6502 BASIC (V1.1, the MIT release) boots on the emulated ' +
            'Ben Eater 6502 to the OK prompt with the default memory size and terminal width. ' +
            'Try PRINT 2+2 in the debugger’s serial console. ' +
            'The console is the Debug panel’s serial terminal (the 65C51 ACIA). Ships in the app — no download.',
        'msbasic.licence': 'Microsoft BASIC for 6502 is MIT (Microsoft’s 1978 source, MIT release; built with ca65). ' +
            'It ships in this app.',
        'msbasic.source': 'Project',
        'lessons.fetching': 'Fetching {title} ({size}) and checking SHA-256…',
        'lessons.failed': 'Could not start {title}: {reason}'
    },
    de: {
        'lessons.heading': 'Lektionen',
        'lessons.run': 'Ausführen',
        'linux.title': 'Linux auf RISC-V',
        'linux.summary': 'Ein echter Linux-6.1-Kernel auf der emulierten RV32-Maschine mit einer BusyBox-Shell. ' +
            'Ausführen öffnet direkt am Shell-Prompt, wiederhergestellt aus einem Abbild nach dem Start; ' +
            'Von Grund auf booten zeigt den ganzen Kernel-Start. ' +
            'Tippe Befehle wie uname -a oder ls / in die serielle Konsole.',
        'linux.licence': 'Linux und BusyBox stehen unter GPL-2.0, glibc unter LGPL-2.1. Sie sind nicht Teil dieser App: ' +
            'Ausführen lädt sie ({size}) von brickwright-media-lab und prüft vorher ihre SHA-256.',
        'lessons.cold': 'Von Grund auf booten',
        'linux.source': 'Quellcode',
        'elks.title': 'ELKS auf 8086',
        'elks.summary': 'ELKS 0.9.2 — ein echtes 16-Bit-unixoides Betriebssystem — startet auf dem ' +
            'emulierten 8086 von seiner 1,44-MB-Diskette. Ausführen zeigt den Kernel-Start auf dem ' +
            'Maschinenbildschirm: Er erkennt die Diskettengeometrie, bindet das Wurzeldateisystem ein ' +
            'und erreicht einen Login. Ein freies BIOS ist eingebaut.',
        'elks.licence': 'ELKS steht unter GPL-2.0. Es ist nicht Teil dieser App: ' +
            'Ausführen lädt die Diskette ({size}) von brickwright-media-lab und prüft vorher ihre SHA-256.',
        'elks.source': 'Quellcode',
        'cpm.title': 'BBC BASIC auf CP/M 2.2',
        'cpm.vdpTitle': 'BBC BASIC auf CP/M 2.2 + TMS9918A',
        'cpm.vdpSummary': 'Klicke auf den 40×24-Controller-Bildschirm. Gib bei A> BBCBASIC und dann PRINT 2+2 ein. ' +
            'Der Z80 steuert den VDP über die Ports $98 und $99. CP/M und BBC BASIC sind enthalten.',
        'cpm.summary': 'DRIs echtes CP/M 2.2 (CCP+BDOS, kein Shim) startet auf dem emulierten Z80 am A>-Prompt. ' +
            'BBC BASIC liegt auf Laufwerk A: — DIR listet es, BBCBASIC startet es. ' +
            'Die Konsole ist das serielle Terminal im Debug-Panel. Alles ist in der App enthalten — kein Download.',
        'cpm.licence': 'CP/M 2.2 ist DRIs weitergabefähige Ausgabe (Freigabe 2022); BBC BASIC (Z80) steht unter zlib (R.T. Russell). ' +
            'Beides ist in dieser App enthalten.',
        'cpm.source': 'Projekt',
        'msbasic.title': 'Microsoft BASIC auf 6502',
        'msbasic.summary': 'Microsofts ursprüngliches 6502-BASIC von 1978 (V1.1, die MIT-Ausgabe) startet auf dem ' +
            'emulierten Ben-Eater-6502 mit Standardwerten für Speichergröße und Terminalbreite bis zum OK-Prompt. ' +
            'Probiere PRINT 2+2 im seriellen Terminal des Debuggers. ' +
            'Die Konsole ist das serielle Terminal im Debug-Panel (der 65C51-ACIA). In der App enthalten — kein Download.',
        'msbasic.licence': 'Microsoft BASIC für 6502 steht unter MIT (Microsofts Quellcode von 1978, MIT-Ausgabe; mit ca65 gebaut). ' +
            'Es ist in dieser App enthalten.',
        'msbasic.source': 'Projekt',
        'lessons.fetching': '{title} wird geladen ({size}) und per SHA-256 geprüft…',
        'lessons.failed': '{title} konnte nicht starten: {reason}'
    }
};

/** Lesson strings: `lessonT(locale, key, vars)`. */
export const lessonT = makeT(TABLE);
export const LESSON_STRINGS = TABLE;

/** "7.5 MB" — decimal megabytes, one place. */
export const mediaSize = bytes => `${(bytes / 1e6).toFixed(1)} MB`;

/** Total download of the Linux lesson's Run (kernel, initramfs, snapshot). */
export const LINUX_DOWNLOAD_BYTES = LINUX_RISCV_MEDIA.kernel.bytes + LINUX_RISCV_MEDIA.initrd.bytes +
    LINUX_RISCV_MEDIA.snapshot.bytes;
/** Download of "Boot from scratch" (no snapshot). */
export const LINUX_COLD_DOWNLOAD_BYTES = LINUX_RISCV_MEDIA.kernel.bytes + LINUX_RISCV_MEDIA.initrd.bytes;
/** Total download of the ELKS lesson's Run (one floppy). */
export const ELKS_DOWNLOAD_BYTES = ELKS_MEDIA.floppy.bytes;

/**
 * The lessons, as machine configs plus what the manager shows beside them.
 * A fixed id, so the row is stable across renders and never collides with a
 * stored machine's minted UUID. `coldConfig` is the same machine without the
 * snapshot slot — the "Boot from scratch" button.
 * @returns {{config: object, coldConfig: object, summary: string, licence: string, source: string,
 *            sourceLabel: string, size: string, coldSize: string, coldLabel: string}[]}
 */
export function lessonMachines (locale) {
    // Lesson visibility follows ONLY the machine-image policy axis
    // (test/native-store-code-policy.test.mjs): a build that denies remote
    // machine images shows NO lessons at all — the whole feature is off. That
    // includes the self-contained CP/M and MS BASIC lessons below, whose media
    // ships in-app: they are gated the same way by product decision.
    if (!remoteMachineImagesAllowed()) return [];
    const t = (k, v) => lessonT(locale, k, v);
    const rows = [];

    // Remote GPL-media lessons: the kernel/floppy are fetched at run time from
    // brickwright-media-lab and are never part of this build.
    {
        const config = newMachineConfig({
            id: 'lesson-linux-riscv32',
            title: t('linux.title'),
            executionMode: 'functional',
            machine: 'riscv32',
            slots: {
                kernel: {url: LINUX_RISCV_MEDIA.kernel.url, sha256: LINUX_RISCV_MEDIA.kernel.sha256},
                initrd: {url: LINUX_RISCV_MEDIA.initrd.url, sha256: LINUX_RISCV_MEDIA.initrd.sha256},
                snapshot: {url: LINUX_RISCV_MEDIA.snapshot.url, sha256: LINUX_RISCV_MEDIA.snapshot.sha256}
            },
            bootOrder: ['kernel'],
            tags: ['lesson', 'linux', 'gpl-media'],
            provenance: {
                source: 'brickwright-media-lab/projects/riscv32-linux',
                license: LINUX_RISCV_MEDIA.licences.join(' + '),
                sourceCode: LINUX_RISCV_MEDIA.source
            }
        });
        const coldSlots = {...config.slots};
        delete coldSlots.snapshot;
        const coldConfig = newMachineConfig({...config, slots: coldSlots, bootOrder: ['kernel']});

        // ELKS 0.9.2 on the i8086 machine — the floppy is the boot medium (no cold
        // variant: it IS the whole boot). The floppy slot selects the floppy-OS
        // boot path; its geometry + the at-floppy-drive-type quirk are what ELKS
        // needs to find /bin/init. A `video` widget mirrors the screen to Widgets.
        const elksConfig = newMachineConfig({
            id: 'lesson-elks-i8086',
            title: t('elks.title'),
            executionMode: 'functional',
            machine: 'i8086',
            machineConfig: 'PCXT8086',
            slots: {
                floppy: {
                    url: ELKS_MEDIA.floppy.url,
                    sha256: ELKS_MEDIA.floppy.sha256,
                    geometry: {...ELKS_MEDIA.floppy.geometry}
                }
            },
            quirks: [...ELKS_MEDIA.quirks],
            bootOrder: ['floppy'],
            widgets: ELKS_WIDGETS.map(w => ({...w})),
            tags: ['lesson', 'elks', 'gpl-media'],
            provenance: {
                source: 'brickwright-media-lab/projects/elks',
                license: ELKS_MEDIA.licences.join(' + '),
                sourceCode: ELKS_MEDIA.source
            }
        });

        rows.push({
            config,
            coldConfig,
            coldLabel: t('lessons.cold'),
            coldSize: mediaSize(LINUX_COLD_DOWNLOAD_BYTES),
            summary: t('linux.summary'),
            licence: t('linux.licence', {size: mediaSize(LINUX_DOWNLOAD_BYTES)}),
            source: LINUX_RISCV_MEDIA.source,
            sourceLabel: t('linux.source'),
            size: mediaSize(LINUX_DOWNLOAD_BYTES)
        }, {
            config: elksConfig,
            summary: t('elks.summary'),
            licence: t('elks.licence', {size: mediaSize(ELKS_DOWNLOAD_BYTES)}),
            source: ELKS_MEDIA.source,
            sourceLabel: t('elks.source'),
            size: mediaSize(ELKS_DOWNLOAD_BYTES)
        });
    }

    // CP/M 2.2 (self-contained): DRI's real CCP+BDOS + BBC BASIC (Z80) both ship
    // in this app's static/roms, so this lesson is offered even in a
    // self-contained build. A `cpmsys` boot slot selects the real-CP/M boot
    // (debug-runner attachZ80 cpm-system branch, which also loads the system ROMs
    // from static/roms); the slot points at BBC BASIC, placed on drive A:. The
    // program name is BBCBASIC.COM, so it coincides with the copy
    // the boot already loads — one A: entry, not a duplicate. The console is the
    // Debug serial terminal (no video widget). CP/M 2.2 is DRI-redistributable
    // and BBC BASIC is zlib, so neither is GPL media — hence not behind the gate.
    const cpmConfig = newMachineConfig({
        id: 'lesson-cpm-z80',
        title: t('cpm.title'),
        executionMode: 'functional',
        machine: 'z80',
        slots: {cpmsys: {url: 'static/roms/bbcbasic.com', sha256: CPM_BBCBASIC_SHA256}},
        bootOrder: ['cpmsys'],
        tags: ['lesson', 'cpm'],
        provenance: {
            source: 'brickwright-media-lab/projects/bbc-basic-z80',
            program: {name: 'BBCBASIC.COM'},
            license: 'CP/M 2.2 (DRI redistributable, 2022 grant) + zlib (BBC BASIC Z80)',
            sourceCode: `${MEDIA_LAB}/tree/main/projects/bbc-basic-z80`
        }
    });
    rows.push({
        config: cpmConfig,
        summary: t('cpm.summary'),
        licence: t('cpm.licence'),
        source: `${MEDIA_LAB}/tree/main/projects/bbc-basic-z80`,
        sourceLabel: t('cpm.source'),
        size: '25 KB'
    });

    rows.push({
        config: newMachineConfig({
            ...cpmConfig,
            id: 'lesson-cpm-z80-vdp',
            title: t('cpm.vdpTitle'),
            machineConfig: 'CPM64K_TMS9918',
            widgets: [{name: 'TMS9918A', type: 'simplevga', source: 'video',
                config: {width: 256, height: 192}}]
        }),
        summary: t('cpm.vdpSummary'),
        licence: t('cpm.licence'),
        source: cpmConfig.provenance.sourceCode,
        sourceLabel: t('cpm.source'),
        size: '25 KB'
    });

    // Microsoft BASIC for 6502 (self-contained): the MIT 32 KB ROM ships in
    // static/roms. The `rom` slot has no profile — it loads as a ROM image into
    // the eater6502 machine's ROM region ($8000-$FFFF). The inline machineConfig
    // supplies the 65C51 ACIA the BASIC console talks to; output is the Debug
    // serial terminal. MIT, not GPL media, so not behind the remote gate.
    const msbasicConfig = newMachineConfig({
        id: 'lesson-msbasic-6502',
        title: t('msbasic.title'),
        executionMode: 'functional',
        machine: 'eater6502',
        machineConfig: {regions: EATER6502_CONFIG.regions.map(r => ({...r})),
            chips: EATER6502_CONFIG.chips.map(c => ({...c})), clockHz: EATER6502_CONFIG.clockHz},
        slots: {rom: {url: 'static/roms/msbasic-6502.rom', sha256: MSBASIC_ROM_SHA256}},
        bootOrder: ['rom'],
        tags: ['lesson', 'msbasic'],
        provenance: {
            source: 'brickwright-media-lab/projects/ms-basic-6502',
            license: 'MIT (Microsoft BASIC for 6502)',
            sourceCode: `${MEDIA_LAB}/tree/main/projects/ms-basic-6502`
        }
    });
    rows.push({
        config: msbasicConfig,
        summary: t('msbasic.summary'),
        licence: t('msbasic.licence'),
        source: `${MEDIA_LAB}/tree/main/projects/ms-basic-6502`,
        sourceLabel: t('msbasic.source'),
        size: '32 KB'
    });

    return rows;
}
