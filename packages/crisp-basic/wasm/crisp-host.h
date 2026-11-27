/* CrispBASIC restricted host contract. Original code, BSD-3-Clause.
 *
 * The interpreter calls only these embedding hooks. They receive bytes,
 * bounded error messages and scalar values, never native function addresses.
 * read_byte and sleep_ms may suspend the complete interpreter stack. A host
 * must not re-enter crisp_run while it is suspended. One instance runs once.
 * Files, OS commands, native calls, graphics queries and sound are denied by
 * this profile; adding a capability requires an explicit new host contract.
 */
#ifndef CRISP_HOST_H
#define CRISP_HOST_H

#include <stdint.h>

void crisp_host_output(uint8_t byte);
void crisp_host_input_event(int method); /* 0 = line, 1 = key */
int crisp_host_read_byte(int wait_ms);   /* -1 = block, >=0 = timeout; -1 result = EOF/no key */
void crisp_host_sleep_ms(int milliseconds);
uint32_t crisp_host_now_ms(void);        /* monotonic milliseconds, modulo 2^32 */
void crisp_host_error(int code, const char *message, unsigned short basic_line);
void crisp_host_exit(int code);

/* Dedicated simulation ABI. No names, pointers, strings or host addresses
 * cross this boundary. Operations: 1 pinMode, 2 digitalWrite, 3 digitalRead,
 * 4 delay, 5 millis. pinMode uses 0=input, 1=output, 2=input-pullup.
 * Success is 0 for void operations, 0/1 for read, integer milliseconds for
 * millis. Negative replies identify ordinary, catchable domain errors below.
 * Resource/protocol failures belong to the parent and never become replies.
 * This hook may suspend the complete C stack, just like read_byte. */
enum crisp_simulation_error {
    CRISP_SIM_INVALID_PIN = 1,
    CRISP_SIM_INVALID_MODE = 2,
    CRISP_SIM_INVALID_LEVEL = 3,
    CRISP_SIM_INVALID_TIME = 4,
    CRISP_SIM_PIN_NOT_OUTPUT = 5,
    CRISP_SIM_FLOATING_INPUT = 6,
    CRISP_SIM_DISPOSED = 7,
    CRISP_SIM_UNAVAILABLE = 8,
    CRISP_SIM_INVALID_OPERATION = 9
};
int crisp_host_simulation_request(int operation, int argument1, int argument2);
/* The JavaScript owner checks this before enabling simulation. Old generated
 * modules cannot silently claim a bridge whose library they do not contain. */
int crisp_simulation_abi(void);

/* Prepared Latin-1, increasing numbered lines; no file or NUL termination
 * required. Returns BASIC's QUIT code modulo 256, or 1 for a reported error.
 * simulation_enabled must be 0 or 1. Only 1 installs the trusted ordinary
 * BASIC library and enables its private, allowlisted FN bridge intrinsic.
 * A fresh module instance is required for each invocation. */
int crisp_run(const unsigned char *source, unsigned int length, int simulation_enabled);

#endif
