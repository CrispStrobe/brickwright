// SPDX-License-Identifier: BSD-3-Clause
// Original platform adapters for the clean-room C99 compiler. No interpreter
// implementation or proprietary compiler code is used here.
const common = String.raw`
/* CrispBASIC compiled platform ABI. cb_fail is supplied by the C runtime. */
static void cb_platform_check_mode(int32_t mode) {
    if (mode < 0 || mode > 2) cb_fail("pin mode must be input, output or input-pullup");
}
static void cb_platform_check_level(int32_t level) {
    if (level != 0 && level != 1) cb_fail("digital level must be 0 or 1");
}
`;

const native = String.raw`
#include <sys/time.h>
static unsigned char cb_pin_modes[256], cb_pin_latches[256];
static uint32_t cb_virtual_ms;
static struct timeval cb_started_at;
static FILE *cb_trace_file;
static unsigned long cb_trace_sequence;
static void cb_platform_pin(int32_t pin) {
    if (pin < 0 || pin >= 256) cb_fail("unknown logical pin (expected 0..255)");
}
static void cb_platform_init(void) {
    const char *trace = getenv("CRISPBASIC_TRACE");
    memset(cb_pin_modes, 0, sizeof cb_pin_modes);
    memset(cb_pin_latches, 0, sizeof cb_pin_latches);
    cb_virtual_ms = 0;
    cb_trace_sequence = 0;
    if (gettimeofday(&cb_started_at, NULL)) cb_fail("cannot read host clock");
    if (trace && *trace) {
        cb_trace_file = fopen(trace, "wb");
        if (!cb_trace_file) cb_fail("cannot open CRISPBASIC_TRACE output");
    }
}
static void cb_platform_putchar(unsigned char byte) {
    if (fputc(byte, stdout) == EOF) cb_fail("cannot write standard output");
}
static int cb_platform_getchar(void) {
    fflush(stdout);
    return fgetc(stdin);
}
static uint32_t cb_platform_millis(void) { return cb_virtual_ms; }
static uint32_t cb_platform_time_cs(void) {
    struct timeval now;
    int64_t us;
    if (gettimeofday(&now, NULL)) cb_fail("cannot read host clock");
    us = (int64_t)(now.tv_sec - cb_started_at.tv_sec) * 1000000 + now.tv_usec - cb_started_at.tv_usec;
    return (uint32_t)(us > 0 ? us / 10000 : 0);
}
static void cb_platform_trace_pin(const char *type, int32_t pin, int32_t value) {
    if (!cb_trace_file) return;
    fprintf(cb_trace_file, "{\"sequence\":%lu,\"atMs\":%lu,\"type\":\"%s\",\"pin\":%ld,\"value\":%ld}\n",
        ++cb_trace_sequence, (unsigned long)cb_virtual_ms, type, (long)pin, (long)value);
    if (fflush(cb_trace_file)) cb_fail("cannot write pin trace");
}
static void cb_platform_pin_mode(int32_t pin, int32_t mode) {
    static const char *const names[] = {"input", "output", "input-pullup"};
    cb_platform_pin(pin); cb_platform_check_mode(mode);
    cb_pin_modes[pin] = (unsigned char)mode;
    if (cb_trace_file) {
        fprintf(cb_trace_file, "{\"sequence\":%lu,\"atMs\":%lu,\"type\":\"pin-mode\",\"pin\":%ld,\"mode\":\"%s\"}\n",
            ++cb_trace_sequence, (unsigned long)cb_virtual_ms, (long)pin, names[mode]);
        if (fflush(cb_trace_file)) cb_fail("cannot write pin trace");
    }
}
static void cb_platform_write(int32_t pin, int32_t value) {
    cb_platform_pin(pin); cb_platform_check_level(value);
    if (cb_pin_modes[pin] != 1) cb_fail("pin is not configured as an output");
    cb_pin_latches[pin] = (unsigned char)value;
    cb_platform_trace_pin("digital-write", pin, value);
}
static void cb_platform_toggle(int32_t pin) {
    cb_platform_pin(pin);
    if (cb_pin_modes[pin] != 1) cb_fail("pin is not configured as an output");
    cb_pin_latches[pin] ^= 1;
    cb_platform_trace_pin("digital-toggle", pin, cb_pin_latches[pin]);
}
static int32_t cb_platform_read(int32_t pin) {
    int32_t value;
    cb_platform_pin(pin);
    if (cb_pin_modes[pin] == 0) cb_fail("floating input has no stimulus or pull-up");
    value = cb_pin_modes[pin] == 1 ? cb_pin_latches[pin] : 1;
    cb_platform_trace_pin("digital-read", pin, value);
    return value;
}
static void cb_platform_delay(int32_t milliseconds) {
    uint32_t from = cb_virtual_ms;
    if (milliseconds < 0 || (uint32_t)milliseconds > INT32_MAX - cb_virtual_ms)
        cb_fail("portable delay exceeds integer-millisecond range");
    cb_virtual_ms += (uint32_t)milliseconds;
    if (cb_trace_file) {
        fprintf(cb_trace_file, "{\"sequence\":%lu,\"atMs\":%lu,\"type\":\"delay\",\"fromMs\":%lu,\"milliseconds\":%ld}\n",
            ++cb_trace_sequence, (unsigned long)cb_virtual_ms, (unsigned long)from, (long)milliseconds);
        if (fflush(cb_trace_file)) cb_fail("cannot write pin trace");
    }
}
`;

const pico = String.raw`
#include "pico/stdlib.h"
#include "hardware/gpio.h"
static unsigned char cb_pin_modes[29], cb_pin_latches[29];
static uint32_t cb_pico_started;
static void cb_platform_pin(int32_t pin) {
    if (pin < 0 || pin > 28 || pin == 23 || pin == 24)
        cb_fail("pin is not exposed by the Raspberry Pi Pico profile");
}
static void cb_platform_init(void) {
    stdio_init_all();
    cb_pico_started = to_ms_since_boot(get_absolute_time());
}
static void cb_platform_putchar(unsigned char byte) { putchar_raw(byte); }
static int cb_platform_getchar(void) { return getchar(); }
static uint32_t cb_platform_millis(void) {
    return to_ms_since_boot(get_absolute_time()) - cb_pico_started;
}
static uint32_t cb_platform_time_cs(void) { return cb_platform_millis() / 10; }
static void cb_platform_pin_mode(int32_t pin, int32_t mode) {
    cb_platform_pin(pin); cb_platform_check_mode(mode);
    gpio_init((uint)pin);
    gpio_put((uint)pin, cb_pin_latches[pin]);
    gpio_set_dir((uint)pin, mode == 1 ? GPIO_OUT : GPIO_IN);
    if (mode == 2) gpio_pull_up((uint)pin); else gpio_disable_pulls((uint)pin);
    cb_pin_modes[pin] = (unsigned char)mode;
}
static void cb_platform_write(int32_t pin, int32_t value) {
    cb_platform_pin(pin); cb_platform_check_level(value);
    if (cb_pin_modes[pin] != 1) cb_fail("pin is not configured as an output");
    cb_pin_latches[pin] = (unsigned char)value;
    gpio_put((uint)pin, value);
}
static void cb_platform_toggle(int32_t pin) {
    cb_platform_pin(pin);
    if (cb_pin_modes[pin] != 1) cb_fail("pin is not configured as an output");
    cb_pin_latches[pin] ^= 1;
    gpio_put((uint)pin, cb_pin_latches[pin]);
}
static int32_t cb_platform_read(int32_t pin) { cb_platform_pin(pin); return gpio_get((uint)pin) ? 1 : 0; }
static void cb_platform_delay(int32_t milliseconds) {
    if (milliseconds < 0) cb_fail("portable delay must be nonnegative");
    sleep_ms((uint32_t)milliseconds);
}
`;

const avr = String.raw`
#if !defined(__WITH_LIBF7_LIBGCC__) || !defined(__WITH_LIBF7_MATH_SYMBOLS__)
#error "CrispBASIC AVR binary64 target requires GCC libf7 arithmetic and math symbols"
#endif
#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/atomic.h>
#ifndef F_CPU
#define F_CPU 16000000UL
#endif
/* Uno resources: UART0 at 9600 baud, Timer0 CTC at 1 kHz, digital GPIO only. */
static volatile uint32_t cb_avr_ms;
static unsigned char cb_pin_modes[20], cb_pin_latches[20];
ISR(TIMER0_COMPA_vect) { ++cb_avr_ms; }
static void cb_platform_pin(int32_t pin) {
    if (pin < 0 || pin >= 20) cb_fail("Arduino Uno pin must be D0..D13 or A0..A5 (14..19)");
}
static volatile uint8_t *cb_avr_port(int32_t pin) { return pin < 8 ? &PORTD : pin < 14 ? &PORTB : &PORTC; }
static volatile uint8_t *cb_avr_ddr(int32_t pin) { return pin < 8 ? &DDRD : pin < 14 ? &DDRB : &DDRC; }
static volatile uint8_t *cb_avr_input(int32_t pin) { return pin < 8 ? &PIND : pin < 14 ? &PINB : &PINC; }
static uint8_t cb_avr_mask(int32_t pin) { return (uint8_t)(1u << (pin < 8 ? pin : pin < 14 ? pin - 8 : pin - 14)); }
static void cb_platform_putchar(unsigned char byte) {
    while (!(UCSR0A & _BV(UDRE0))) { }
    UDR0 = byte;
}
static int cb_platform_getchar(void) {
    while (!(UCSR0A & _BV(RXC0))) { }
    return UDR0;
}
static int cb_avr_stdio_put(char c, FILE *stream) { (void)stream; cb_platform_putchar((unsigned char)c); return 0; }
static int cb_avr_stdio_get(FILE *stream) { (void)stream; return cb_platform_getchar(); }
static FILE cb_avr_stdio = FDEV_SETUP_STREAM(cb_avr_stdio_put, cb_avr_stdio_get, _FDEV_SETUP_RW);
static void cb_platform_init(void) {
    uint16_t baud = (uint16_t)(F_CPU / 16UL / 9600UL - 1);
    UBRR0H = (uint8_t)(baud >> 8); UBRR0L = (uint8_t)baud;
    UCSR0A = 0; UCSR0B = _BV(RXEN0) | _BV(TXEN0); UCSR0C = _BV(UCSZ01) | _BV(UCSZ00);
    stdin = stdout = stderr = &cb_avr_stdio;
    cb_avr_ms = 0;
    TCCR0A = _BV(WGM01); TCCR0B = _BV(CS01) | _BV(CS00);
    TCNT0 = 0; OCR0A = (uint8_t)(F_CPU / 64UL / 1000UL - 1); TIMSK0 = _BV(OCIE0A);
    sei();
}
static uint32_t cb_platform_millis(void) {
    uint32_t now;
    ATOMIC_BLOCK(ATOMIC_RESTORESTATE) { now = cb_avr_ms; }
    return now;
}
static uint32_t cb_platform_time_cs(void) { return cb_platform_millis() / 10; }
static void cb_platform_pin_mode(int32_t pin, int32_t mode) {
    uint8_t mask; volatile uint8_t *port, *ddr;
    cb_platform_pin(pin); cb_platform_check_mode(mode);
    mask = cb_avr_mask(pin); port = cb_avr_port(pin); ddr = cb_avr_ddr(pin);
    ATOMIC_BLOCK(ATOMIC_RESTORESTATE) {
        *ddr &= (uint8_t)~mask;
        if ((mode == 1 && cb_pin_latches[pin]) || mode == 2) *port |= mask;
        else *port &= (uint8_t)~mask;
        if (mode == 1) *ddr |= mask;
    }
    cb_pin_modes[pin] = (unsigned char)mode;
}
static void cb_platform_write(int32_t pin, int32_t value) {
    uint8_t mask; volatile uint8_t *port;
    cb_platform_pin(pin); cb_platform_check_level(value);
    if (cb_pin_modes[pin] != 1) cb_fail("pin is not configured as an output");
    mask = cb_avr_mask(pin); port = cb_avr_port(pin);
    ATOMIC_BLOCK(ATOMIC_RESTORESTATE) {
        if (value) *port |= mask; else *port &= (uint8_t)~mask;
    }
    cb_pin_latches[pin] = (unsigned char)value;
}
static void cb_platform_toggle(int32_t pin) {
    cb_platform_pin(pin);
    if (cb_pin_modes[pin] != 1) cb_fail("pin is not configured as an output");
    cb_platform_write(pin, 1 - cb_pin_latches[pin]);
}
static int32_t cb_platform_read(int32_t pin) {
    cb_platform_pin(pin); return (*cb_avr_input(pin) & cb_avr_mask(pin)) ? 1 : 0;
}
static void cb_platform_delay(int32_t milliseconds) {
    uint32_t start;
    if (milliseconds < 0) cb_fail("portable delay must be nonnegative");
    start = cb_platform_millis();
    while ((uint32_t)(cb_platform_millis() - start) < (uint32_t)milliseconds) { }
}
`;

/** Return an original C99 platform adapter for embedding in the generated C.
 * Native pins are a deterministic logical reference, never physical GPIO.
 * Firmware adapters require their real SDK/toolchain; there is no host fallback.
 */
export function compilerPlatform(target = 'native') {
    if (target === 'native') return common + native;
    if (target === 'pico') return common + pico;
    if (target === 'arduino-uno') return common + avr;
    throw new TypeError(`Unknown compiler platform ${JSON.stringify(target)}`);
}
