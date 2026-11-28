/* CrispBASIC JavaScript bridge. Original code, BSD-3-Clause. */
#include <emscripten.h>
#include "crisp-host.h"

EM_JS(void, crisp_host_output, (uint8_t byte), {
    Module.crispHost.output(byte);
});

EM_JS(void, crisp_host_input_event, (int method), {
    Module.crispHost.inputEvent(method);
});

/* Asyncify preserves the C stack, including nested PROC/FN execution and
 * setjmp/longjmp error state, across asynchronous input. The enclosing worker
 * is independently terminable even when BASIC never reaches a host hook. */
EM_ASYNC_JS(int, crisp_host_read_byte, (int wait_ms), {
    return await Module.crispHost.readByte(wait_ms);
});

EM_ASYNC_JS(void, crisp_host_sleep_ms, (int milliseconds), {
    await new Promise(resolve => setTimeout(resolve, milliseconds));
});

EM_ASYNC_JS(int, crisp_host_simulation_request, (int operation, int argument1, int argument2), {
    const result = await Module.crispHost.simulationRequest(operation, argument1, argument2);
    /* Check before Emscripten coerces a JavaScript value to int32. A malformed
     * reply is a worker failure, never an error BASIC can catch and ignore. */
    if (!Number.isInteger(result) || result < -9 || result > 2147483647 ||
        (result >= 0 && ((operation === 3 && result > 1) ||
            (operation !== 3 && operation !== 5 && result !== 0)))) {
        throw new Error('Invalid CrispBASIC simulation reply');
    }
    return result;
});

EM_JS(uint32_t, crisp_host_now_ms, (void), {
    return Module.crispHost.now() >>> 0;
});

EM_JS(void, crisp_host_error, (int code, const char *message, unsigned short basic_line), {
    /* BASIC error messages are Latin-1 bytes, just like program strings. */
    let text = "";
    for (let i = 0; i < 1024 && HEAPU8[message + i]; ++i) {
        text += String.fromCharCode(HEAPU8[message + i]);
    }
    Module.crispHost.runtimeError(code, text, basic_line);
});

EM_JS(void, crisp_host_exit, (int code), {
    Module.crispHost.setExit(code);
});
