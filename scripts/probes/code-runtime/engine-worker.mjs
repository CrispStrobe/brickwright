// Local evaluation adapter, not production code or a security boundary.
// Used by the bounded Node and browser probes; no Brickwright integration.
const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);
let port;
let initOptions;
if (isNode) {
  const threads = await import('node:worker_threads');
  port = threads.parentPort;
  initOptions = threads.workerData;
} else {
  port = {
    postMessage: message => self.postMessage(message),
    on: (_event, handler) => { self.onmessage = event => handler(event.data); }
  };
}
const send = message => port.postMessage(message);
const MAX_OUTPUT_BYTES = 1024 * 1024;
let engine;
let runtime;
let current = null;
let hostCalls = 0;
let inputBuffer;
let interruptBuffer;
const pendingInputs = new Map();
let inputSequence = 0;

function flush() {
  if (!current) return;
  for (const stream of ['stdout', 'stderr']) {
    const chunk = current.pending[stream];
    if (chunk) {
      send({type:'output', id:current.id, stream, text:chunk});
      current.pending[stream] = '';
    }
  }
}
function write(stream, value) {
  if (!current) return;
  const text = typeof value === 'string' ? value : current.decoders[stream].decode(value, {stream:true});
  current.outputBytes += new TextEncoder().encode(text).length;
  if (current.outputBytes > MAX_OUTPUT_BYTES) throw new Error('probe output budget exceeded');
  current[stream] += text;
  current.pending[stream] += text;
  if (text.includes('\n') || current.pending[stream].length >= 4096) flush();
}
function sharedInput(prompt = '') {
  if (!inputBuffer) throw new Error('shared-input diagnostic requires SharedArrayBuffer');
  const control = new Int32Array(inputBuffer, 0, 2);
  Atomics.store(control, 0, 0);
  Atomics.store(control, 1, 0);
  flush();
  send({type:'input', id:current.id, mode:'shared', prompt});
  const outcome = Atomics.wait(control, 0, 0, 5000);
  if (outcome === 'timed-out') throw new Error('probe input reply timed out');
  const length = Atomics.load(control, 1);
  // Browser TextDecoder rejects shared views; copy the completed reply first.
  return new TextDecoder().decode(new Uint8Array(inputBuffer, 8, length).slice());
}
function nextLine(prompt = '') {
  if (current.inputMode === 'shared') return sharedInput(prompt);
  if (current.inputs.length) return current.inputs.shift();
  return null;
}
function skulptInput(prompt) {
  if (current.inputMode !== 'message') return nextLine(prompt) ?? '';
  return requestInput(prompt);
}
function requestInput(prompt) {
  const key = ++inputSequence;
  flush();
  send({type:'input', id:current.id, mode:'message', key, prompt});
  return new Promise(resolve => pendingInputs.set(key, resolve));
}
function microInput() {
  if (!current.inputBytes.length) {
    const line = nextLine();
    if (line === null) return null;
    current.inputBytes.push(...new TextEncoder().encode(line + '\n'));
  }
  return current.inputBytes.shift();
}
const bridge = {
  add(a, b) { hostCalls++; return Number(a) + Number(b); },
  sensor(portName) { hostCalls++; if (portName !== 'A') throw new Error('unknown mock port'); return 17; },
  delay(ms) { hostCalls++; return new Promise(resolve => setTimeout(() => resolve(42), Math.min(1000, Number(ms)))); },
  ask(prompt) { hostCalls++; return requestInput(String(prompt)); }
};

async function initialize(options) {
  const started = performance.now();
  engine = options.engine;
  inputBuffer = options.inputBuffer;
  interruptBuffer = options.interruptBuffer;
  if (engine === 'skulpt') {
    if (isNode) {
      const fs = await import('node:fs/promises');
      const vm = await import('node:vm');
      for (const file of ['skulpt.min.js','skulpt-stdlib.js']) {
        vm.runInThisContext(await fs.readFile(new URL(`./node_modules/skulpt/dist/${file}`, import.meta.url), 'utf8'), {filename:file});
      }
    } else {
      for (const file of ['skulpt.min.js','skulpt-stdlib.js']) {
        const response = await fetch(new URL(`./node_modules/skulpt/dist/${file}`,import.meta.url));
        if (!response.ok) throw new Error(`Skulpt asset ${response.status}`);
        (0,eval)(await response.text());
      }
    }
    runtime = globalThis.Sk;
    globalThis.__probeHost = bridge;
    runtime.builtinFiles.files['src/lib/probehost.js'] = `var $builtinmodule = function () {
      var mod = {};
      mod.add = new Sk.builtin.func(function(a,b) { return Sk.ffi.remapToPy(globalThis.__probeHost.add(Sk.ffi.remapToJs(a),Sk.ffi.remapToJs(b))); });
      mod.sensor = new Sk.builtin.func(function(a) { return Sk.ffi.remapToPy(globalThis.__probeHost.sensor(Sk.ffi.remapToJs(a))); });
      return mod;
    };`;
    runtime.configure({
      output:text => write('stdout',text),
      read:path => { if (Object.hasOwn(runtime.builtinFiles.files,path)) return runtime.builtinFiles.files[path]; throw new Error(`module ${path} not found`); },
      inputfun:skulptInput, inputfunTakesPrompt:true, __future__:runtime.python3
    });
  } else if (engine === 'micropython') {
    const module = await import('./node_modules/@micropython/micropython-webassembly-pyscript/micropython.mjs');
    const wasm = new URL('./node_modules/@micropython/micropython-webassembly-pyscript/micropython.wasm', import.meta.url);
    const url = isNode ? (await import('node:url')).fileURLToPath(wasm) : wasm.href;
    runtime = await module.loadMicroPython({url, heapsize:1024*1024, linebuffer:false,
      stdout:bytes => write('stdout',bytes), stderr:bytes => write('stderr',bytes), stdin:microInput});
    runtime.registerJsModule('probehost',bridge);
  } else if (engine === 'pyodide') {
    const module = await import('./node_modules/pyodide/pyodide.mjs');
    const base = new URL('./node_modules/pyodide/',import.meta.url);
    const indexURL = isNode ? (await import('node:url')).fileURLToPath(base) : base.href;
    runtime = await module.loadPyodide({indexURL, stdout:text => write('stdout',text+'\n'), stderr:text => write('stderr',text+'\n')});
    runtime.setStdout({write:bytes => { write('stdout',bytes); return bytes.length; }});
    runtime.setStderr({write:bytes => { write('stderr',bytes); return bytes.length; }});
    runtime.setStdin({stdin:() => nextLine(), isatty:false});
    runtime.registerJsModule('probehost',bridge);
    if (interruptBuffer) runtime.setInterruptBuffer(new Uint8Array(interruptBuffer));
  } else throw new Error(`unknown engine ${engine}`);
  send({type:'ready', engine, engineLoadMs:performance.now()-started,
    runtimeVersion:engine === 'pyodide' ? runtime.version : null,
    capabilities:{sharedArrayBuffer:typeof SharedArrayBuffer==='function',crossOriginIsolated:globalThis.crossOriginIsolated??null,jspi:typeof WebAssembly.Suspending==='function'},
    memory:isNode ? process.memoryUsage() : null});
}

async function execute(message) {
  current = {id:message.id, inputs:[...(message.inputs||[])], inputMode:message.inputMode||'buffered', inputBytes:[],
    stdout:'', stderr:'', outputBytes:0, pending:{stdout:'',stderr:''},
    decoders:{stdout:new TextDecoder(),stderr:new TextDecoder()}};
  hostCalls = 0;
  if (interruptBuffer) Atomics.store(new Uint8Array(interruptBuffer),0,0);
  send({type:'started',id:message.id});
  const started = performance.now();
  let error = null;
  try {
    if (engine === 'skulpt') await runtime.misceval.asyncToPromise(() => runtime.importMainWithBody('<probe>',false,message.code,true));
    else await runtime.runPythonAsync(message.code);
  } catch (caught) {
    error = {name:caught?.name||caught?.constructor?.name||'Error',message:String(caught?.toString?.()||caught).slice(0,12000),
      traceback:caught?.traceback?.map?.(frame=>({lineno:frame.lineno,filename:frame.filename}))||null};
  }
  flush();
  send({type:'complete',id:message.id,engineMs:performance.now()-started,stdout:current.stdout,stderr:current.stderr,
    outputBytes:current.outputBytes,error,hostCalls,memory:isNode?process.memoryUsage():null});
  current = null;
}
port.on('message', message => {
  if (message.type === 'input-reply') { const resolve=pendingInputs.get(message.key); pendingInputs.delete(message.key); resolve?.(message.value); return; }
  if (message.type === 'init') { initialize(message).catch(error=>send({type:'init-error',message:String(error?.stack||error).slice(0,12000)})); return; }
  if (message.type === 'run') execute(message).catch(error=>send({type:'adapter-error',id:message.id,message:String(error?.stack||error).slice(0,12000)}));
});
if (initOptions) initialize(initOptions).catch(error=>send({type:'init-error',message:String(error?.stack||error).slice(0,12000)}));
