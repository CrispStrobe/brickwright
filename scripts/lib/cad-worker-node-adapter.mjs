// SPDX-License-Identifier: BSD-3-Clause
// Environment adapter only: load the vendored browser worker without rewriting it.
import {parentPort, workerData} from 'node:worker_threads';

globalThis.self = globalThis;
globalThis.WorkerGlobalScope = class WorkerGlobalScope {};
// The Vite browser build externalizes Node's createRequire. Select its existing
// Emscripten browser entry; this adapter's Node builtins remain module imports.
// No geometry, physics, validation or message-handling implementation is mocked.
globalThis.process = undefined;
globalThis.postMessage = message => parentPort.postMessage(message);

await import(workerData.workerURL);
parentPort.on('message', data => globalThis.onmessage({data}));
parentPort.postMessage({ready: true});
