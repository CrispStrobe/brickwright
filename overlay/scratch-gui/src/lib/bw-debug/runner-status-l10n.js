/**
 * Everything the debug runner says in words, in one place.
 *
 * THE STATUS LINE IS THE SURFACE A LEARNER WATCHES WHILE NOTHING ELSE MOVES —
 * "compiling…", "starting the Pico emulator…", "booting CP/M 2.2…", and then
 * the ready sentence that says where the output will appear. debug-runner.js
 * writes all of it, and for a long time it wrote all of it in English, in every
 * language, because a pure lib has no props and therefore no locale.
 *
 * `test/i18n-no-hardcoded-strings.test.mjs` could not see this: that rule looks
 * for a sentence written as an OBJECT FIELD whose value starts with a capital
 * (`label: 'Memory bank…'`). Status text is neither — a POSITIONAL ARGUMENT in
 * lowercase prose. `scripts/measure-status-strings.mjs` counted the population
 * that blind spot hid: 68 status strings, 52 of them English.
 *
 * WHY ONE TABLE AND NOT SEVERAL. This file began as `cpm-system-l10n.js`,
 * holding the two CP/M strings that were fixed first. The name described those
 * two strings rather than the surface, and a second table for the same status
 * line would mean two places to remember when a locale is added. One status
 * bar, one table.
 *
 * NAMES ARE NOT TRANSLATED. `CP/M 2.2`, `BBC BASIC`, `Tali Forth 2`, `RISC-V`,
 * `free-386`, `CGA`, `VGA`, the `A>`/`ok`/`>` prompts and the `DIR` command all
 * survive into German unchanged: they are what the thing is called, or what the
 * learner must type, and translating either would be worse than useless.
 *
 * THE `||` FALLBACKS ARE STRINGS TOO. `${bootMedia.name || 'image'}` puts the
 * word "image" on screen as surely as any sentence does, so the fallbacks have
 * their own keys (`noun.*`) rather than sitting as literals at the call site
 * where the next reader would not count them.
 *
 * @module
 */

import {pickLocale as basePickLocale, makeT} from '../bw-i18n.js';

/** Locales this module carries, English first — it is the fallback. */
export const LOCALES = Object.freeze(['en', 'de']);

const TABLE = {
    en: {
        // ---- the CP/M 2.2 system boot (the first two keys this table held)
        'cpm-system.booting': 'booting CP/M 2.2…',
        'cpm-system.ready': 'CP/M 2.2 — DIR at the A> prompt',
        'cpm-system.ready.bbcbasic': ', or run BBCBASIC',

        // ---- compiling
        'compile.no8051': 'local 8051 compiler unavailable',
        'compile.reading': 'reading the project…',
        'compile.compiling': 'compiling…',
        'compile.inpageOff': 'in-page 8051 compiler off by request — using the compiler service',
        'compile.inpageMissing': 'in-page 8051 compiler not installed — using the compiler service. '
            + 'To compile offline, open Menu → Settings → C Compiler, choose '
            + 'Build in this page, then Download compiler.',
        'compile.cached': 'compiled (cached)',

        // ---- attaching a target
        'attach.emulator': 'starting the emulator…',
        'attach.avr': 'starting the AVR emulator…',
        'attach.pico': 'starting the Pico emulator…',
        'attach.labwired': 'starting the labwired engine…',
        'attach.stm32': 'starting the STM32F030 emulator…',
        'attach.esp8266': 'starting the ESP8266 emulator…',

        // ---- what was built
        'built.plain': '{bytes} bytes, {points} yield points',
        'built.device': '{bytes} bytes ({device}), {points} yield points',
        'built.labwired': '{bytes} bytes on labwired — instruction stepping only (no symbols)',
        'run.pc': 'PC=${pc}',
        'run.runningTo': 'Running to 0x{address}',
        'run.reached': 'Reached 0x{address}',
        'run.exited': 'program exited with code {code}',

        // ---- booting media, shared across targets
        'boot.media': 'booting {name}…',
        'boot.extracted6502': 'booting extracted 6502 machine…',
        'boot.extractedZ80': 'booting extracted Z80 machine…',
        'boot.extracted8086': 'booting extracted 8086 machine…',
        'boot.tali': 'loading Tali Forth 2…',
        'boot.bbcbasic': 'loading BBC BASIC…',
        'boot.xtBios': 'loading the XT BIOS…',
        'boot.cpmShim': 'booting {name} over the CP/M shim…',
        'boot.riscv': 'booting {label} on RISC-V…',
        'boot.dosBench': 'loading {name} into the DOS bench…',
        'boot.free386': 'booting the free-386…',
        'boot.free386Named': 'booting the free-386 — {name}…',

        // ---- the ready sentence: where the output will appear
        'ready.cp1': 'CP1 firmware loaded: {name}',
        'ready.emptyRom': 'extracted machine booted with an empty ROM — load a program '
            + '(presets, file, or ASM tab)',
        'ready.py65mon': '{name} on the py65mon console map',
        'ready.extracted': '{name} on the extracted machine ({chips})',
        'ready.eater': '{name} on the Eater map (VIA $6000, ACIA $5000)',
        'ready.tali': 'Tali Forth 2 — type at the ok prompt',
        'ready.cpmShim': '{name} — type at the prompt',
        'ready.romOnMap': '{name} on {map}',
        'ready.bbcbasic': 'BBC BASIC (Z80) — type at the > prompt',
        'ready.riscv': 'RISC-V (RV32IMA) — {label} running',

        // ---- Linux on RISC-V (the Machine Manager lesson)
        'linux.starting': 'starting Linux on RISC-V…',
        'linux.restoring': 'opening Linux on RISC-V at the shell prompt (post-boot snapshot)…',
        'linux.snapshotRefused': 'the Linux snapshot was refused ({reason}); booting from scratch instead',
        'linux.booting': 'booting Linux on RISC-V — {phase} ({percent}%)',
        'linux.phase.starting': 'the kernel is starting up',
        'linux.phase.kernel': 'the kernel is running',
        'linux.phase.console': 'the serial console is up',
        'linux.phase.init': 'starting /init',
        'linux.phase.userspace': 'BusyBox is starting',
        'linux.ready': 'Linux on RISC-V',
        'linux.noKernel': 'the Linux lesson has no kernel image to boot',
        'ready.dosBench': '{name} loaded as a .{format} on the DOS bench '
            + '— output is the CGA screen and the console',
        'ready.floppyBoot': '{name} booting — the video is the CGA screen, '
            + 'the keyboard steers it (it takes ~40M instructions to reach a login prompt)',
        'ready.xtBios': 'XT BIOS — output is the CGA screen, not the serial console',
        'ready.free386NoMedia': 'free-386 (LGPL Bochs BIOS + VGABios) — no boot media, load a disk',
        'ready.free386Floppy': '{name} on the free-386 (A:) — the video is the VGA screen, '
            + 'the keyboard steers it (a full FreeDOS boot takes tens of millions of instructions)',
        'ready.free386Disk': '{name} on the free-386 (C:) — the video is the VGA screen, '
            + 'the keyboard steers it (a full FreeDOS boot takes tens of millions of instructions)',

        // ---- the maps a ROM can land on, named in ready.romOnMap
        'map.extracted': 'the extracted machine',
        'map.searle': 'the Searle map',
        'map.default8086': 'the default 8086 map',

        // ---- the words that stand in for a missing media name
        'noun.image': 'image',
        'noun.rom': 'ROM',
        'noun.floppy': 'floppy',
        'noun.hardDisk': 'hard disk',
        'noun.com': '.com',
        'noun.cpmProgram': 'CP/M program',
        'noun.program': 'program',
        'noun.theProgram': 'the program',
        'noun.userRom': 'user ROM',
        'noun.ramRom': 'ram/rom',

        // ---- the app itself
        'app.updated': 'app updated — reloading the new build…'
    },
    de: {
        'cpm-system.booting': 'CP/M 2.2 wird gestartet…',
        'cpm-system.ready': 'CP/M 2.2 — DIR am A>-Prompt',
        'cpm-system.ready.bbcbasic': ', oder BBCBASIC ausführen',

        'compile.no8051': 'lokaler 8051-Compiler nicht verfügbar',
        'compile.reading': 'Projekt wird gelesen…',
        'compile.compiling': 'wird kompiliert…',
        'compile.inpageOff': '8051-Compiler in der Seite auf Wunsch aus — der Compiler-Dienst übernimmt',
        'compile.inpageMissing': '8051-Compiler in der Seite nicht installiert — der Compiler-Dienst '
            + 'übernimmt. Zum Kompilieren ohne Netz: Menü → Einstellungen → C-Compiler, '
            + 'In dieser Seite bauen wählen, dann Compiler herunterladen.',
        'compile.cached': 'kompiliert (aus dem Cache)',

        'attach.emulator': 'Emulator wird gestartet…',
        'attach.avr': 'AVR-Emulator wird gestartet…',
        'attach.pico': 'Pico-Emulator wird gestartet…',
        'attach.labwired': 'labwired-Engine wird gestartet…',
        'attach.stm32': 'STM32F030-Emulator wird gestartet…',
        'attach.esp8266': 'ESP8266-Emulator wird gestartet…',

        'built.plain': '{bytes} Bytes, {points} Haltepunkte',
        'built.device': '{bytes} Bytes ({device}), {points} Haltepunkte',
        'built.labwired': '{bytes} Bytes auf labwired — nur Einzelschritt über Instruktionen '
            + '(keine Symbole)',
        'run.pc': 'PC=${pc}',
        'run.runningTo': 'Läuft bis 0x{address}',
        'run.reached': '0x{address} erreicht',
        'run.exited': 'Programm mit Code {code} beendet',

        'boot.media': '{name} wird gestartet…',
        'boot.extracted6502': 'extrahierte 6502-Maschine wird gestartet…',
        'boot.extractedZ80': 'extrahierte Z80-Maschine wird gestartet…',
        'boot.extracted8086': 'extrahierte 8086-Maschine wird gestartet…',
        'boot.tali': 'Tali Forth 2 wird geladen…',
        'boot.bbcbasic': 'BBC BASIC wird geladen…',
        'boot.xtBios': 'XT-BIOS wird geladen…',
        'boot.cpmShim': '{name} wird über die CP/M-Zwischenschicht gestartet…',
        'boot.riscv': '{label} wird auf RISC-V gestartet…',
        'boot.dosBench': '{name} wird in die DOS-Werkbank geladen…',
        'boot.free386': 'free-386 wird gestartet…',
        'boot.free386Named': 'free-386 wird gestartet — {name}…',

        'ready.cp1': 'CP1-Firmware geladen: {name}',
        'ready.emptyRom': 'extrahierte Maschine mit leerem ROM gestartet — lade ein Programm '
            + '(Vorlagen, Datei oder ASM-Reiter)',
        'ready.py65mon': '{name} auf der py65mon-Konsolenbelegung',
        'ready.extracted': '{name} auf der extrahierten Maschine ({chips})',
        'ready.eater': '{name} auf der Eater-Belegung (VIA $6000, ACIA $5000)',
        'ready.tali': 'Tali Forth 2 — tippe am ok-Prompt',
        'ready.cpmShim': '{name} — tippe am Prompt',
        'ready.romOnMap': '{name} auf {map}',
        'ready.bbcbasic': 'BBC BASIC (Z80) — tippe am >-Prompt',
        'ready.riscv': 'RISC-V (RV32IMA) — {label} läuft',

        'linux.starting': 'Linux auf RISC-V wird gestartet…',
        'linux.restoring': 'Linux auf RISC-V wird am Shell-Prompt geöffnet (Abbild nach dem Start)…',
        'linux.snapshotRefused': 'das Linux-Abbild wurde abgelehnt ({reason}); es wird von Grund auf gebootet',
        'linux.booting': 'Linux auf RISC-V startet — {phase} ({percent} %)',
        'linux.phase.starting': 'der Kernel fährt hoch',
        'linux.phase.kernel': 'der Kernel läuft',
        'linux.phase.console': 'die serielle Konsole ist bereit',
        'linux.phase.init': '/init wird gestartet',
        'linux.phase.userspace': 'BusyBox startet',
        'linux.ready': 'Linux auf RISC-V',
        'linux.noKernel': 'die Linux-Lektion hat kein Kernel-Image zum Starten',
        'ready.dosBench': '{name} als .{format} auf der DOS-Werkbank geladen '
            + '— die Ausgabe sind der CGA-Bildschirm und die Konsole',
        'ready.floppyBoot': '{name} startet — das Bild ist der CGA-Bildschirm, '
            + 'die Tastatur steuert ihn (bis zum Login-Prompt dauert es ~40 Mio. Instruktionen)',
        'ready.xtBios': 'XT-BIOS — die Ausgabe ist der CGA-Bildschirm, nicht die serielle Konsole',
        'ready.free386NoMedia': 'free-386 (LGPL-Bochs-BIOS + VGABios) — kein Startmedium, '
            + 'lade einen Datenträger',
        'ready.free386Floppy': '{name} auf dem free-386 (A:) — das Bild ist der VGA-Bildschirm, '
            + 'die Tastatur steuert ihn (ein vollständiger FreeDOS-Start dauert zig Millionen '
            + 'Instruktionen)',
        'ready.free386Disk': '{name} auf dem free-386 (C:) — das Bild ist der VGA-Bildschirm, '
            + 'die Tastatur steuert ihn (ein vollständiger FreeDOS-Start dauert zig Millionen '
            + 'Instruktionen)',

        'map.extracted': 'der extrahierten Maschine',
        'map.searle': 'der Searle-Belegung',
        'map.default8086': 'der Standard-8086-Belegung',

        'noun.image': 'Abbild',
        'noun.rom': 'ROM',
        'noun.floppy': 'Diskette',
        'noun.hardDisk': 'Festplatte',
        'noun.com': '.com',
        'noun.cpmProgram': 'CP/M-Programm',
        'noun.program': 'Programm',
        'noun.theProgram': 'das Programm',
        'noun.userRom': 'Benutzer-ROM',
        'noun.ramRom': 'ram/rom',

        'app.updated': 'App aktualisiert — der neue Build wird geladen…'
    }
};

export const STRINGS = Object.freeze(TABLE);

/** The locale to use for `loc`, falling back to English. */
export const pickLocale = loc => basePickLocale(loc, TABLE);

/**
 * Look up `key` and fill in `{placeholders}` from `vars`. See lib/bw-i18n.js
 * for the fallback rules; this is that machinery bound to the table above.
 */
export const t = makeT(TABLE);
