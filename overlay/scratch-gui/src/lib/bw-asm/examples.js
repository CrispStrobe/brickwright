/**
 * Starter programs for the ASM tab.
 *
 * The tab has a reference panel and a working assemble path, and an empty
 * editor — which is a wall for anyone who has not written 8051 or 6502
 * assembly before. These are the three shapes every beginner needs first:
 * drive a pin, read one, and waste a measured amount of time.
 *
 * EVERY ONE OF THESE ASSEMBLES. They are not illustrative snippets: each
 * was posted to the same hosted assembler the ▶ button uses, and
 * `test/asm-examples.test.mjs` posts them again. An example that does not
 * build is worse than no example, because the reader cannot tell whether
 * they mistyped it or it was always wrong.
 *
 * Syntax is per-assembler and they do not agree:
 *   8051   sdas8051  — `.area`, `.org`, `#` immediates, `mov P1, #0x00`
 *   6502   ca65      — `.segment`, `$` hex, `lda #$00`
 *   Z80    sdasz80   — sdas syntax again, but Z80 mnemonics
 *   8086   i8086-asm — MASM: `.MODEL`, `.DATA`, `PROC`, `INT 21h`
 *
 * THE 8086's ARE NOT LIKE THE OTHER THREE, in two ways worth stating here
 * rather than leaving to be discovered. They are assembled IN THE BROWSER
 * (`lib/bw-asm/assemble-route.js` says why one tab has two routes), so the
 * gate does not skip them when the network is absent — it assembles AND RUNS
 * every one of them. And they are not written here: they are MIT-licensed
 * files carried verbatim from a teaching corpus, attribution included, which
 * is the condition they ship under. `examples-i8086.js` holds them and the
 * terms.
 *
 * @module
 */

// THE DEFAULT EXPORT, NOT THE NAMED ONE. `I8086_EXAMPLES` is the upstream
// set that ships under Amey Thakur's attribution; the default adds the ones
// written here (the 8255 pin panel, the keyboard, mode 13h). Importing the
// named export meant those shipped in the file and were offered NOWHERE --
// the ASM tab, the gate and the local-assembly list all read this.
import {sketchBoardFor} from '../bw-debug/arduino-sketch.js';
import I8086_ALL, {I8086_EXAMPLES} from './examples-i8086.js';
import STC8051_TEACHING_EXAMPLES from './examples-stc8051.js';

/**
 * @typedef {{id: string, label: string, labelDe: string, source: string,
 *            attribution?: {author: string, repo: string, licence: string}}} AsmExample
 */

/** ATmel-style 8051 parts: every STC device here. */
const STC = [
    ...STC8051_TEACHING_EXAMPLES,
    {
        id: 'blink',
        label: 'Blink P1.0',
        labelDe: 'P1.0 blinken',
        source: `; Blink the LED on P1.0.
; 8051 pins are active LOW with the usual LED-to-VCC wiring, so clearing
; the bit lights it.
    .area CODE (ABS)
    .org 0x0000

main:
    cpl  P1.0           ; toggle just that pin
    acall delay
    sjmp main

; ~100 ms at 12 MHz: two nested loops, because one 8-bit counter cannot
; hold enough. The exact figure does not matter; being visible does.
delay:
    mov  r7, #200
outer:
    mov  r6, #250
inner:
    djnz r6, inner
    djnz r7, outer
    ret
`
    },
    {
        id: 'button',
        label: 'Button on P3.2 lights P1.0',
        labelDe: 'Taster an P3.2 schaltet P1.0',
        source: `; Read a button on P3.2 and mirror it to the LED on P1.0.
;
; An 8051 pin is read by writing 1 to it first: the port is quasi
; bidirectional, and a pin left low can never read high no matter what is
; wired to it. That one line is the whole trick.
    .area CODE (ABS)
    .org 0x0000

main:
    setb P3.2           ; release the pin so the button can pull it down
    jb   P3.2, released ; jump if the pin is HIGH, i.e. not pressed
    clr  P1.0           ; pressed: light the LED
    sjmp main
released:
    setb P1.0           ; not pressed: dark
    sjmp main
`
    },
    {
        id: 'count',
        label: 'Count on P1',
        labelDe: 'Auf P1 hochzählen',
        source: `; Put a rising count on the whole of port 1 — eight LEDs, binary.
; The clearest way to see that a delay loop is doing what you think.
    .area CODE (ABS)
    .org 0x0000

main:
    mov  a, #0x00
loop:
    mov  P1, a
    inc  a
    acall delay
    sjmp loop

delay:
    mov  r7, #100
outer:
    mov  r6, #250
inner:
    djnz r6, inner
    djnz r7, outer
    ret
`
    }
];

/** Ben Eater's 6502 breadboard, assembled with ca65. */
const EATER6502 = [
    {
        id: 'blink',
        label: 'Blink PB0 (65C22 port B)',
        labelDe: 'PB0 blinken (65C22 Port B)',
        source: `; Blink a LED on port B bit 0 of the 65C22 VIA.
; The VIA sits at $6000: DDRB decides direction, ORB drives the pins.
PORTB = $6000
DDRB  = $6002

    .segment "CODE"

reset:
    lda #%11111111      ; every port B pin an output
    sta DDRB

loop:
    lda #%00000001
    sta PORTB
    jsr delay
    lda #%00000000
    sta PORTB
    jsr delay
    jmp loop

; Two nested 8-bit loops. A 6502 has no 16-bit counter, so this is how
; you wait for anything a human can see.
delay:
    ldx #$ff
outer:
    ldy #$ff
inner:
    dey
    bne inner
    dex
    bne outer
    rts

; Point the reset vector at this program so the CPU starts at reset.
    .segment "VECTORS"
    .word reset, reset, reset
`
    }
];

/** Z80 bench, assembled with sdasz80. */
const Z80 = [
    {
        id: 'blink',
        label: 'Toggle an output port',
        labelDe: 'Ausgabeport umschalten',
        source: `; Toggle bit 0 of output port 0x01 with a delay between.
; The Z80 talks to ports with IN/OUT rather than memory addresses, which
; is the first thing that surprises anyone arriving from the 6502.
    .area CODE (ABS)
    .org 0x0000

main:
    ld   a, #0x01
    out  (0x01), a
    call delay
    ld   a, #0x00
    out  (0x01), a
    call delay
    jr   main

; BC counts down to zero: the Z80 does have a 16-bit register pair, so
; one loop is enough where the 8051 and 6502 both need two.
delay:
    ld   bc, #0x4000
wait:
    dec  bc
    ld   a, b
    or   c
    jr   nz, wait
    ret
`
    }
];

/**
 * RV32IM examples for the RISC-V console, assembled by the LOCAL rv32 assembler
 * (bw-board/riscv-asm.js). They speak to the console through the machine's
 * Linux-style ECALL ABI — a7=64 write(fd, buf, len), a7=93 exit(code) — and each
 * has been run on the emulated core. Original to Brickwright (no upstream).
 */
const RISCV = [
    {
        id: 'rv-hello',
        label: 'Hello, RISC-V',
        labelDe: 'Hallo, RISC-V',
        source: `# Print a line over the ECALL console, then exit.
# The ABI is Linux-style: a7 selects the call (64 = write, 93 = exit).
    .globl _start
_start:
    li   a7, 64          # SYS_write
    li   a0, 1           # fd = stdout
    la   a1, msg         # buffer
    li   a2, 28          # length
    ecall
    li   a7, 93          # SYS_exit
    li   a0, 0
    ecall
    .data
msg:
    .string "Hello from RISC-V assembly!\\n"
`
    },
    {
        id: 'rv-count',
        label: 'Count 0–9',
        labelDe: 'Zähle 0–9',
        source: `# Print the digits 0..9 then a newline, one write() per character.
    .globl _start
_start:
    li   s0, 0           # i = 0
    li   s1, 10          # limit
    la   s2, ch          # a one-byte output buffer
loop:
    li   a0, 48          # '0'
    add  a0, a0, s0      # '0' + i
    sb   a0, 0(s2)
    li   a7, 64
    li   a0, 1
    mv   a1, s2
    li   a2, 1
    ecall
    addi s0, s0, 1
    blt  s0, s1, loop
    li   a0, 10          # newline
    sb   a0, 0(s2)
    li   a7, 64
    li   a0, 1
    mv   a1, s2
    li   a2, 1
    ecall
    li   a7, 93
    li   a0, 0
    ecall
    .data
ch:
    .zero 1
`
    },
    {
        id: 'rv-fib',
        label: 'Fibonacci (functions + recursion)',
        labelDe: 'Fibonacci (Funktionen + Rekursion)',
        source: `# Print the first 10 Fibonacci numbers, space-separated.
# Shows function calls (call/ret), a stack frame, and the M extension (divu/remu).
    .globl _start
_start:
    li   s0, 0           # a
    li   s1, 1           # b
    li   s2, 0           # i
    li   s3, 10          # how many
floop:
    mv   a0, s0
    call putint
    li   a0, 32          # a space
    call putchar
    add  t0, s0, s1      # next = a + b
    mv   s0, s1
    mv   s1, t0
    addi s2, s2, 1
    blt  s2, s3, floop
    li   a0, 10          # newline
    call putchar
    li   a7, 93
    li   a0, 0
    ecall

# putchar(a0): write the low byte of a0 to stdout.
putchar:
    la   t1, cbuf
    sb   a0, 0(t1)
    li   a7, 64
    li   a0, 1
    mv   a1, t1
    li   a2, 1
    ecall
    ret

# putint(a0): print a non-negative integer in decimal (recurse on a0 / 10).
putint:
    addi sp, sp, -8
    sw   ra, 4(sp)
    sw   s4, 0(sp)       # save the caller's s4; we hold this digit in it
    li   t2, 10
    remu s4, a0, t2      # this digit  = a0 % 10
    divu a0, a0, t2      # the rest    = a0 / 10
    beqz a0, digit       # nothing higher to print
    call putint          # print the higher digits first (preserves our s4)
digit:
    addi a0, s4, 48      # '0' + digit
    call putchar
    lw   s4, 0(sp)
    lw   ra, 4(sp)
    addi sp, sp, 8
    ret
    .data
cbuf:
    .zero 1
`
    }
];

/** Device id → examples. Families share a set; unknown devices get none. */
export function asmExamplesFor (device) {
    const d = String(device || '').toLowerCase();
    if (/^stc/.test(d)) return STC;
    if (/^(eater6502|6502|w65c02)$/.test(d)) return EATER6502;
    if (/^(z80|zx48|zx128)$/.test(d)) return Z80;
    // The 8088 answers here too: same instruction set, same encodings, so
    // the same assembler and the same programs. Only the bus width differs,
    // and no source file can tell.
    if (/^(i8086|8086|i8088|8088)$/.test(d)) return I8086_ALL;
    if (/^riscv(32)?$/.test(d) || /rv32/.test(d)) return RISCV;
    return [];
}

/** Every example, with the device family it belongs to — for the gate. */
export const ALL_ASM_EXAMPLES = [
    ...STC.map(e => ({...e, target: 'stc12c5a60s2'})),
    ...EATER6502.map(e => ({...e, target: 'eater6502'})),
    ...Z80.map(e => ({...e, target: 'z80'})),
    ...I8086_ALL.map(e => ({...e, target: 'i8086'})),
    ...RISCV.map(e => ({...e, target: 'riscv32'}))
];

/**
 * The examples assembled LOCALLY, so a gate can tell the two populations
 * apart without re-deriving the routing rule. The hosted ones skip when
 * there is no network; these never have an excuse.
 */
export const LOCAL_ASM_EXAMPLES = [
    ...I8086_ALL.map(e => ({...e, target: 'i8086'})),
    ...RISCV.map(e => ({...e, target: 'riscv32'}))
];

/**
 * RISC-V *C* starter programs for the Code tab. These are NOT assembly and are
 * deliberately kept out of ALL_ASM_EXAMPLES so the asm-examples gate never tries
 * to assemble them. Each names the route it needs: a `browser` example stays
 * inside shecc's C subset and compiles in the page with no server; a `server`
 * example uses full C (floats, qsort, the standard library) and needs the
 * hosted gcc route. Output goes through the machine's ECALL console.
 */
const RISCV_C = [
    {
        id: 'rvc-hello', label: 'Hello + loop (subset)', labelDe: 'Hallo + Schleife (Teilmenge)',
        route: 'browser',
        source: `/* Runs in the browser: shecc compiles a C subset, no server. */
int main(void) {
    printf("%s\\n", "Hello from C on RISC-V!");
    int sum = 0;
    for (int i = 1; i <= 10; i++) sum += i;
    printf("sum(1..10) = %d\\n", sum);
    return 0;
}
`
    },
    {
        id: 'rvc-fib', label: 'Fibonacci — recursion (subset)', labelDe: 'Fibonacci — Rekursion (Teilmenge)',
        route: 'browser',
        source: `/* Recursion + arrays, still inside shecc's subset (browser route). */
int fib(int n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }
int main(void) {
    for (int i = 0; i < 12; i++) printf("fib(%d) = %d\\n", i, fib(i));
    return 0;
}
`
    },
    {
        id: 'rvc-floats', label: 'Floats & qsort (full C — server)', labelDe: 'Gleitkomma & qsort (volles C — Server)',
        route: 'server',
        source: `/* Needs the SERVER route: floats (%f), <math.h>, qsort, malloc —
   the full standard library, beyond shecc's subset. */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
static int cmp(const void *a, const void *b) { return *(const int*)a - *(const int*)b; }
int main(void) {
    int *v = malloc(5 * sizeof(int));
    int src[5] = {5, 3, 9, 1, 7};
    for (int i = 0; i < 5; i++) v[i] = src[i];
    qsort(v, 5, sizeof(int), cmp);
    for (int i = 0; i < 5; i++) printf("%d ", v[i]);
    printf("\\nsqrt(2) = %.5f, pi = %.5f\\n", sqrt(2.0), 4.0 * atan(1.0));
    free(v);
    return 0;
}
`
    }
];

/** RISC-V C starter programs for a device, or [] for non-riscv devices. */
export function riscvCExamplesFor (device) {
    const d = String(device || '').toLowerCase();
    return (/^riscv(32)?$/.test(d) || /rv32/.test(d)) ? RISCV_C : [];
}

/**
 * Arduino C++ starter sketches for the C tab's ▶ Run sketch on the AVR boards.
 * Each one uses something the blocks reader cannot represent -- that is why
 * the sketch route exists -- and prints what it did over Serial, so the
 * debugger's serial console shows it working. `serial: true` sketches need a
 * hardware USART, which the ATtiny85/88 do not have; those boards get only
 * the sketches that show their work on a pin.
 */
const ARDUINO_SKETCHES = [
    {
        id: 'ino-hello', label: 'Hello, Serial', labelDe: 'Hallo, Serial',
        serial: true,
        source: `// Serial, F() and a counter: the Arduino "hello world".
// Open the debugger's serial console to see the output.
unsigned long count = 0;

void setup() {
  Serial.begin(9600);
  Serial.println(F("Hello from an Arduino sketch!"));
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  count++;
  Serial.print("loop ");
  Serial.println(count);
  digitalWrite(LED_BUILTIN, count % 2);   // blink along
  delay(500);
}
`
    },
    {
        id: 'ino-echo', label: 'Serial echo: type to the board', labelDe: 'Serielles Echo: dem Board schreiben',
        serial: true,
        source: `// Serial INPUT: type a line in the debugger's serial console and
// press Enter; the board answers with it in capitals and its length.
String line = "";

void setup() {
  Serial.begin(9600);
  Serial.println(F("Type something and press Enter."));
}

void loop() {
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\\r' || c == '\\n') {
      if (line.length() > 0) {
        String shout = line;
        shout.toUpperCase();
        Serial.print(F("You said: "));
        Serial.print(shout);
        Serial.print(F(" ("));
        Serial.print(line.length());
        Serial.println(F(" characters)"));
        line = "";
      }
    } else {
      line += c;
    }
  }
}
`
    },
    {
        id: 'ino-string', label: 'String functions', labelDe: 'String-Funktionen',
        serial: true,
        source: `// The String class: everything the block version of the
// string lessons could not do -- case, search, substring, toInt.
void setup() {
  Serial.begin(9600);
  String text = "Hello, Arduino";
  Serial.println(text.length());               // 14
  Serial.println(text.indexOf("Arduino"));     // 7
  Serial.println(text.substring(7));           // Arduino
  String shout = text;
  shout.toUpperCase();
  Serial.println(shout);                       // HELLO, ARDUINO
  Serial.println(text.startsWith("Hell") ? "starts with Hell" : "no");
  String number = "123";
  Serial.println(number.toInt() + 1);          // 124
  Serial.println(String(3.14159, 3));          // 3.142
  text.replace("Arduino", "world");
  Serial.println(text);                        // Hello, world
}

void loop() {}
`
    },
    {
        id: 'ino-class', label: 'A class: two blinkers, no delay()', labelDe: 'Eine Klasse: zwei Blinker ohne delay()',
        serial: false,
        source: `// A class with its own state, and millis() instead of delay(),
// so two LEDs blink at different rates at the same time.
class Blinker {
 public:
  Blinker(uint8_t pin, unsigned long period) : pin_(pin), period_(period) {}
  void begin() { pinMode(pin_, OUTPUT); }
  void update(unsigned long now) {
    if (now - last_ >= period_) {
      last_ = now;
      state_ = !state_;
      digitalWrite(pin_, state_);
    }
  }
 private:
  uint8_t pin_;
  unsigned long period_;
  unsigned long last_ = 0;
  bool state_ = false;
};

Blinker fast(LED_BUILTIN, 200);
Blinker slow(3, 700);

void setup() {
  fast.begin();
  slow.begin();
}

void loop() {
  unsigned long now = millis();
  fast.update(now);
  slow.update(now);
}
`
    },
    {
        id: 'ino-template', label: 'Templates and a helper defined later', labelDe: 'Templates und eine später definierte Hilfsfunktion',
        serial: true,
        source: `// A template, and report() called before it is defined: the
// Arduino build writes its prototype for you, as the IDE does.
template <typename T>
T largest(T a, T b) { return a > b ? a : b; }

void setup() {
  Serial.begin(9600);
  report("int", largest(3, 9));
  report("long", largest(100000L, 7L));
}

void loop() {}

void report(const char *what, long value) {
  Serial.print(what);
  Serial.print(": ");
  Serial.println(value);
}
`
    },
    {
        id: 'ino-eeprom', label: 'EEPROM: count the resets', labelDe: 'EEPROM: Neustarts zählen',
        serial: true,
        source: `// The EEPROM library keeps a byte across resets.
#include <EEPROM.h>

void setup() {
  Serial.begin(9600);
  byte boots = EEPROM.read(0);
  if (boots == 255) boots = 0;      // a fresh chip reads 0xFF
  boots++;
  EEPROM.write(0, boots);
  Serial.print("This sketch has started ");
  Serial.print(boots);
  Serial.println(" time(s).");
}

void loop() {}
`
    },
    {
        id: 'ino-i2c-scan', label: 'Wire: find the I2C parts', labelDe: 'Wire: I2C-Bauteile finden',
        serial: true,
        source: `// Which I2C parts answer on A4 (SDA) and A5 (SCL)?
// Put one on the board and wire it up -- an SSD1306 OLED answers at 0x3C.
#include <Wire.h>

void setup() {
  Serial.begin(9600);
  Wire.begin();
  byte found = 0;
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {   // 0 = the part acknowledged
      Serial.print("I2C part at 0x");
      if (addr < 16) Serial.print('0');
      Serial.println(addr, HEX);
      found++;
    }
  }
  Serial.print(found);
  Serial.println(" part(s) found.");
}

void loop() {}
`
    }
];

/** Arduboy2 starters: the console shows the screen and takes the pad. */
const ARDUBOY_SKETCHES = [
    {
        id: 'ino-arduboy-hello', label: 'Arduboy: move a square', labelDe: 'Arduboy: ein Quadrat bewegen',
        serial: false,
        source: `// An Arduboy2 sketch: text, a square, and the D-pad moving it.
// Arrow keys move; A (Z) makes the square bigger, B (X) smaller.
#include <Arduboy2.h>

Arduboy2 arduboy;
int x = 60, y = 28, size = 8;

void setup() {
  arduboy.begin();
  arduboy.setFrameRate(30);
}

void loop() {
  if (!arduboy.nextFrame()) return;
  arduboy.pollButtons();
  if (arduboy.pressed(RIGHT_BUTTON) && x < WIDTH - size) x++;
  if (arduboy.pressed(LEFT_BUTTON) && x > 0) x--;
  if (arduboy.pressed(DOWN_BUTTON) && y < HEIGHT - size) y++;
  if (arduboy.pressed(UP_BUTTON) && y > 10) y--;
  if (arduboy.justPressed(A_BUTTON) && size < 24) size += 2;
  if (arduboy.justPressed(B_BUTTON) && size > 2) size -= 2;

  arduboy.clear();
  arduboy.setCursor(0, 0);
  arduboy.print(F("Hello, Arduboy!"));
  arduboy.fillRect(x, y, size, size, WHITE);
  arduboy.display();
}
`
    }
];

/** Devices whose sketches have a hardware USART for Serial. */
const NO_USART = new Set(['attiny85', 'attiny88']);

/**
 * Arduino C++ starters for an AVR device, or [] for any other device. Which
 * devices is the sketch route's own table (sketchBoardFor), not a second list
 * here; this only drops the Serial sketches on parts without a USART.
 */
export function arduinoSketchExamplesFor (device) {
    if (!sketchBoardFor(device)) return [];
    if (String(device).toLowerCase() === 'arduboy') return ARDUBOY_SKETCHES;
    return NO_USART.has(String(device).toLowerCase())
        ? ARDUINO_SKETCHES.filter(ex => !ex.serial) : ARDUINO_SKETCHES;
}

export default asmExamplesFor;
