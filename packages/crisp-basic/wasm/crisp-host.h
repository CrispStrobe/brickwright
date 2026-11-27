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

/* Prepared Latin-1, increasing numbered lines; no file or NUL termination
 * required. Returns BASIC's QUIT code modulo 256, or 1 for a reported error.
 * A fresh module instance is required for each invocation. */
int crisp_run(const unsigned char *source, unsigned int length);

#endif
