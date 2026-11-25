/*
 * MIT License
 * 
 * Copyright (c) 2022 Mahmoud Karam
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Brickwright SDCC teaching adaptation of makaram99/cute-os:
 * c489ebfb1a9186903b6c60db66bd1154ec703d71, code/src/cuteOS.c.
 *
 * Select STC89C52RC, 12 MHz. This guest owns Timer0 and executes callbacks
 * inside its ISR. It does not replace Brickwright's generated scheduler.
 *
 * Changes from upstream: SDCC syntax; fixed 5 ms Timer0 mode-1 tick instead
 * of Timer2/GCD tick selection; per-task countdowns; checked arguments;
 * stable task slots during removal; consistent void callbacks and success
 * status. The original Timer2 guest is not claimed to run unchanged.
 *
 * Run until IRAM 36h = A5h. Then inspect:
 * 30h fast_runs=25, 31h medium_runs=12, 32h slow_runs=6, 33h errors=0,
 * 34h:35h tick_count=240 (little endian), P1=F6h.
 * Fast toggles P1.0 every 8 ticks, medium P1.1 every 20, slow P1.2 every 40.
 * At tick 200 fast is removed and P1.3 goes low. At tick 240 the timer stops.
 * A tick requests 5 ms; ISR/reload latency is additional, so this is a
 * scheduler-ratio lesson, not a calibrated wall-clock reference.
 */
#include <8051.h>
#include <stdint.h>

#define MAX_TASKS 8
#define TICK_MS 5
#define CUTE_OK 0
#define CUTE_INVALID 1
#define CUTE_FULL 2
#define CUTE_MISSING 3

typedef void (*task_callback)(void);
typedef struct {
    task_callback callback;
    uint16_t period;
    uint16_t remaining;
} cute_task;
static __xdata cute_task tasks[MAX_TASKS];

/* The build reserves normal direct data at 40h and above. */
volatile __data __at(0x30) uint8_t fast_runs;
volatile __data __at(0x31) uint8_t medium_runs;
volatile __data __at(0x32) uint8_t slow_runs;
volatile __data __at(0x33) uint8_t errors;
volatile __data __at(0x34) uint16_t tick_count;
volatile __data __at(0x36) uint8_t done;

static uint8_t cuteOS_TaskCreate(task_callback callback, uint16_t period_ms) {
    uint8_t i;
    uint8_t enabled;
    if (!callback || !period_ms || period_ms % TICK_MS) return CUTE_INVALID;
    enabled = EA;
    EA = 0;
    for (i = 0; i < MAX_TASKS; ++i) {
        if (!tasks[i].callback) {
            tasks[i].period = period_ms / TICK_MS;
            tasks[i].remaining = tasks[i].period;
            tasks[i].callback = callback;
            EA = enabled;
            return CUTE_OK;
        }
    }
    EA = enabled;
    return CUTE_FULL;
}

static uint8_t cuteOS_TaskRemove(task_callback callback) {
    uint8_t i;
    uint8_t enabled;
    if (!callback) return CUTE_INVALID;
    enabled = EA;
    EA = 0;
    for (i = 0; i < MAX_TASKS; ++i) {
        if (tasks[i].callback == callback) {
            tasks[i].callback = 0; /* Do not shift a task past the ISR iterator. */
            EA = enabled;
            return CUTE_OK;
        }
    }
    EA = enabled;
    return CUTE_MISSING;
}

static void fast_task(void) { ++fast_runs; P1 ^= 0x01; }
static void medium_task(void) { ++medium_runs; P1 ^= 0x02; }
static void slow_task(void) { ++slow_runs; P1 ^= 0x04; }

void cuteOS_ISR(void) __interrupt(1) {
    uint8_t i;
    /* 65536 - 5000 at 12 MHz / 12: explicit mode-1 reload. */
    TR0 = 0;
    TH0 = 0xec;
    TL0 = 0x78;
    TF0 = 0;
    TR0 = 1;
    ++tick_count;
    for (i = 0; i < MAX_TASKS; ++i) {
        if (tasks[i].callback && --tasks[i].remaining == 0) {
            tasks[i].remaining = tasks[i].period;
            tasks[i].callback();
        }
    }
    if (tick_count == 200) {
        if (cuteOS_TaskRemove(fast_task) != CUTE_OK) errors |= 0x04;
        P1 &= (uint8_t)~0x08;
    }
    if (tick_count == 240) {
        TR0 = 0;
        ET0 = 0;
        done = 0xa5;
    }
}

void main(void) {
    uint8_t i;
    EA = 0;
    TR0 = 0;
    P1 = 0xff;
    fast_runs = medium_runs = slow_runs = errors = done = 0;
    tick_count = 0;
    for (i = 0; i < MAX_TASKS; ++i) tasks[i].callback = 0;

    if (cuteOS_TaskCreate(0, 40) != CUTE_INVALID) errors |= 0x01;
    if (cuteOS_TaskCreate(fast_task, 0) != CUTE_INVALID) errors |= 0x02;
    if (cuteOS_TaskCreate(fast_task, 40) != CUTE_OK) errors |= 0x08;
    if (cuteOS_TaskCreate(medium_task, 100) != CUTE_OK) errors |= 0x10;
    if (cuteOS_TaskCreate(slow_task, 200) != CUTE_OK) errors |= 0x20;
    if (cuteOS_TaskRemove(0) != CUTE_INVALID) errors |= 0x40;

    TMOD = (TMOD & 0xf0) | 0x01;
    TH0 = 0xec;
    TL0 = 0x78;
    TF0 = 0;
    ET0 = 1;
    TR0 = 1;
    EA = 1;
    for (;;) {
        if (!done) PCON |= 0x01; /* Timer0 wakes the CPU from idle. */
    }
}
