var Wa = Object.defineProperty;
var Ma = (d, c, _) => c in d ? Wa(d, c, { enumerable: !0, configurable: !0, writable: !0, value: _ }) : d[c] = _;
var W = (d, c, _) => Ma(d, typeof c != "symbol" ? c + "" : c, _);
import { K as ae, _ as ne, M as Ba, a as Oa } from "./_defeature_worker-Bl09qDC6.js";
var Ua = Object.defineProperty, hr = (d, c) => Ua(d, "name", { value: c, configurable: !0 }), De = null, ln = !1;
function ja(d) {
  if (ln)
    throw new Error("init(): the kernel was loaded already, so its options come too late; call init before anything imports @classcad/smlibwasm, and take the package from its promise");
  const c = d, _ = Object.keys(c);
  if (De !== null && !(_.length === Object.keys(De).length && _.every((m) => c[m] === De[m])))
    throw new Error("init(): called again with other options; the kernel loads once");
  De = { ...d };
}
hr(ja, "_give");
function cn(d) {
  ln = !0;
  const c = De ?? {}, _ = {};
  let m = null;
  c.locateFile && (_.locateFile = c.locateFile), c.instantiateWasm && (_.instantiateWasm = c.instantiateWasm);
  const p = c.wasmModule ?? c.wasmBinary;
  if (p != null) {
    let y = /* @__PURE__ */ hr(() => {
    }, "fail");
    m = new Promise((P, C) => {
      y = C;
    }), _.instantiateWasm = (P, C) => ((p instanceof WebAssembly.Module ? WebAssembly.instantiate(p, P) : WebAssembly.instantiate(p, P).then((F) => F.instance)).then(C, (F) => y(new Error(`the kernel could not be instantiated (${F instanceof Error ? F.message : F})`, { cause: F }))), {});
  }
  const w = d(_);
  return m === null ? w : Promise.race([w, m]);
}
hr(cn, "_createModule");
var Na = Object.defineProperty, s = (d, c) => Na(d, "name", { value: c, configurable: !0 });
async function un(d = {}) {
  var me, he, ge;
  var c = d, _ = !!globalThis.window, m = !!globalThis.WorkerGlobalScope, p = globalThis.process?.versions?.node && globalThis.process?.type != "renderer";
  if (p) {
    const { createRequire: e } = await import(
      /* webpackIgnore: true */
      /* @vite-ignore */
      ["node", "module"].join(":")
    );
    var w = e(import.meta.url);
  }
  var y = "./this.program", P = /* @__PURE__ */ s((e, r) => {
    throw r;
  }, "quit_"), C = import.meta.url, R = "";
  function F(e) {
    return c.locateFile ? c.locateFile(e, R) : R + e;
  }
  s(F, "locateFile");
  var T, Y;
  if (p) {
    var Q = w("node:fs");
    C.startsWith("file:") && (R = w("node:path").dirname(w("node:url").fileURLToPath(C)) + "/"), Y = /* @__PURE__ */ s((e) => {
      e = kr(e) ? new URL(e) : e;
      var r = Q.readFileSync(e);
      return r;
    }, "readBinary"), T = /* @__PURE__ */ s(async (e, r = !0) => {
      e = kr(e) ? new URL(e) : e;
      var t = Q.readFileSync(e, r ? void 0 : "utf8");
      return t;
    }, "readAsync"), process.argv.length > 1 && (y = process.argv[1].replace(/\\/g, "/")), process.argv.slice(2), P = /* @__PURE__ */ s((e, r) => {
      throw process.exitCode = e, r;
    }, "quit_");
  } else if (_ || m) {
    try {
      R = new URL(".", C).href;
    } catch {
    }
    m && (Y = /* @__PURE__ */ s((e) => {
      var r = new XMLHttpRequest();
      return r.open("GET", e, !1), r.responseType = "arraybuffer", r.send(null), new Uint8Array(r.response);
    }, "readBinary")), T = /* @__PURE__ */ s(async (e) => {
      var r = await fetch(e, { credentials: "same-origin" });
      if (r.ok)
        return r.arrayBuffer();
      throw new Error(r.status + " : " + r.url);
    }, "readAsync");
  }
  var Me = console.log.bind(console), ee = console.error.bind(console), Sn, Xe = !1, kr = /* @__PURE__ */ s((e) => e.startsWith("file://"), "isFileURI"), Er = !1;
  function xr() {
    return Ne.buffer;
  }
  s(xr, "getMemoryBuffer");
  function Ge() {
    if (!L?.buffer?.resizable) {
      var e = xr();
      L = new Int8Array(e), se = new Int16Array(e), K = new Uint8Array(e), Pe = new Uint16Array(e), M = new Int32Array(e), x = new Uint32Array(e), lt = new Float32Array(e), ct = new Float64Array(e), j = new BigInt64Array(e), et = new BigUint64Array(e);
    }
  }
  s(Ge, "updateMemoryViews");
  function Sr() {
    var e = c.preRun;
    e && (typeof e == "function" && (e = [e]), Or.push(...e)), Mr(Or);
  }
  s(Sr, "preRun");
  function Fr() {
    Er = !0, !c.noFSInit && !a.initialized && a.init(), ce.T(), a.ignorePermissions = !1;
  }
  s(Fr, "initRuntime");
  function Tr() {
    var e = c.postRun;
    e && (typeof e == "function" && (e = [e]), Br.push(...e)), Mr(Br);
  }
  s(Tr, "postRun");
  function V(e) {
    c.onAbort?.(e), e = `Aborted(${e})`, ee(e), Xe = !0, e += ". Build with -sASSERTIONS for more info.", Er && Kt();
    var r = new WebAssembly.RuntimeError(e);
    throw r;
  }
  s(V, "abort");
  var Ye;
  function Pr() {
    return c.locateFile ? F("smlibwasm.wasm") : new URL("" + new URL("smlibwasm-Bw7fxXQ_.wasm", import.meta.url).href, import.meta.url).href;
  }
  s(Pr, "findWasmBinary");
  function Ar(e) {
    if (Y)
      return Y(e);
    throw "both async and sync fetching of the wasm failed";
  }
  s(Ar, "getBinarySync");
  async function Rr(e) {
    try {
      var r = await T(e);
      return new Uint8Array(r);
    } catch {
    }
    return Ar(e);
  }
  s(Rr, "getWasmBinary");
  async function Dr(e, r) {
    try {
      var t = await Rr(e), n = await WebAssembly.instantiate(t, r);
      return n;
    } catch (o) {
      ee(`failed to asynchronously prepare wasm: ${o}`), V(o);
    }
  }
  s(Dr, "instantiateArrayBuffer");
  async function Cr(e, r, t) {
    if (!e && !p)
      try {
        var n = fetch(r, { credentials: "same-origin" }), o = await WebAssembly.instantiateStreaming(n, t);
        return o;
      } catch (i) {
        ee(`wasm streaming compile failed: ${i}`), ee("falling back to ArrayBuffer instantiation");
      }
    return Dr(r, t);
  }
  s(Cr, "instantiateAsync");
  function $r() {
    var e = { a: $a };
    return e;
  }
  s($r, "getWasmImports");
  async function Wr() {
    function e(l) {
      return ce = l.exports, ce = on(ce), an(ce), Ge(), ce;
    }
    s(e, "receiveInstance");
    function r(l) {
      return e(l.instance);
    }
    s(r, "receiveInstantiationResult");
    var t = $r(), n = c.instantiateWasm;
    if (n)
      return new Promise((l) => {
        n(t, (u) => l(e(u)));
      });
    Ye ?? (Ye = Pr());
    var o = await Cr(Sn, Ye, t), i = r(o);
    return i;
  }
  s(Wr, "createWasm");
  const fr = class fr {
    constructor(r) {
      W(this, "name", "ExitStatus");
      this.message = `Program terminated with exit(${r})`, this.status = r;
    }
  };
  s(fr, "ExitStatus");
  let Ke = fr;
  var L, Mr = /* @__PURE__ */ s((e) => {
    for (; e.length > 0; )
      e.shift()(c);
  }, "callRuntimeCallbacks"), Br = [], Or = [], Ur = !0, A = { isAbs: /* @__PURE__ */ s((e) => e.charAt(0) === "/", "isAbs"), splitPath: /* @__PURE__ */ s((e) => {
    var r = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    return r.exec(e).slice(1);
  }, "splitPath"), normalizeArray: /* @__PURE__ */ s((e, r) => {
    for (var t = 0, n = e.length - 1; n >= 0; n--) {
      var o = e[n];
      o === "." ? e.splice(n, 1) : o === ".." ? (e.splice(n, 1), t++) : t && (e.splice(n, 1), t--);
    }
    if (r)
      for (; t; t--)
        e.unshift("..");
    return e;
  }, "normalizeArray"), normalize: /* @__PURE__ */ s((e) => {
    var r = A.isAbs(e), t = e.slice(-1) === "/";
    return e = A.normalizeArray(e.split("/").filter((n) => !!n), !r).join("/"), !e && !r && (e = "."), e && t && (e += "/"), (r ? "/" : "") + e;
  }, "normalize"), dirname: /* @__PURE__ */ s((e) => {
    var r = A.splitPath(e), t = r[0], n = r[1];
    return !t && !n ? "." : (n && (n = n.slice(0, -1)), t + n);
  }, "dirname"), basename: /* @__PURE__ */ s((e) => e && e.match(/([^\/]+|\/)\/*$/)[1], "basename"), join: /* @__PURE__ */ s((...e) => A.normalize(e.join("/")), "join"), join2: /* @__PURE__ */ s((e, r) => A.normalize(e + "/" + r), "join2") }, Fn = /* @__PURE__ */ s(() => {
    if (p) {
      var e = w("node:crypto");
      return (r) => (e.randomFillSync(r), 0);
    }
    return (r) => (crypto.getRandomValues(r), 0);
  }, "initRandomFill"), jr = /* @__PURE__ */ s((e) => (jr = Fn())(e), "randomFill"), ue = { resolve: /* @__PURE__ */ s((...e) => {
    for (var r = "", t = !1, n = e.length - 1; n >= -1 && !t; n--) {
      var o = n >= 0 ? e[n] : a.cwd();
      if (typeof o != "string")
        throw new TypeError("Arguments to path.resolve must be strings");
      if (!o)
        return "";
      r = o + "/" + r, t = A.isAbs(o);
    }
    return r = A.normalizeArray(r.split("/").filter((i) => !!i), !t).join("/"), (t ? "/" : "") + r || ".";
  }, "resolve"), relative: /* @__PURE__ */ s((e, r) => {
    e = ue.resolve(e).slice(1), r = ue.resolve(r).slice(1);
    function t(v) {
      for (var g = 0; g < v.length && v[g] === ""; g++)
        ;
      for (var k = v.length - 1; k >= 0 && v[k] === ""; k--)
        ;
      return g > k ? [] : v.slice(g, k - g + 1);
    }
    s(t, "trim");
    for (var n = t(e.split("/")), o = t(r.split("/")), i = Math.min(n.length, o.length), l = i, u = 0; u < i; u++)
      if (n[u] !== o[u]) {
        l = u;
        break;
      }
    for (var f = [], u = l; u < n.length; u++)
      f.push("..");
    return f = f.concat(o.slice(l)), f.join("/");
  }, "relative") }, Nr = globalThis.TextDecoder && new TextDecoder(), zr = /* @__PURE__ */ s((e, r, t, n) => {
    var o = r + t;
    if (n) return o;
    for (; e[r] && !(r >= o); ) ++r;
    return r;
  }, "findStringEnd"), fe = /* @__PURE__ */ s((e, r = 0, t, n) => {
    r >>>= 0;
    var o = zr(e, r, t, n);
    if (o - r > 16 && e.buffer && Nr)
      return Nr.decode(e.subarray(r, o));
    for (var i = ""; r < o; ) {
      var l = e[r++];
      if (!(l & 128)) {
        i += String.fromCharCode(l);
        continue;
      }
      var u = e[r++] & 63;
      if ((l & 224) == 192) {
        i += String.fromCharCode((l & 31) << 6 | u);
        continue;
      }
      var f = e[r++] & 63;
      if ((l & 240) == 224 ? l = (l & 15) << 12 | u << 6 | f : l = (l & 7) << 18 | u << 12 | f << 6 | e[r++] & 63, l < 65536)
        i += String.fromCharCode(l);
      else {
        var v = l - 65536;
        i += String.fromCharCode(55296 | v >> 10, 56320 | v & 1023);
      }
    }
    return i;
  }, "UTF8ArrayToString"), Ze = [], Je = /* @__PURE__ */ s((e) => {
    for (var r = 0, t = 0; t < e.length; ++t) {
      var n = e.charCodeAt(t);
      n <= 127 ? r++ : n <= 2047 ? r += 2 : n >= 55296 && n <= 57343 ? (r += 4, ++t) : r += 3;
    }
    return r;
  }, "lengthBytesUTF8"), Hr = /* @__PURE__ */ s((e, r, t, n) => {
    if (t >>>= 0, !(n > 0)) return 0;
    for (var o = t, i = t + n - 1, l = 0; l < e.length; ++l) {
      var u = e.codePointAt(l);
      if (u <= 127) {
        if (t >= i) break;
        r[t++ >>> 0] = u;
      } else if (u <= 2047) {
        if (t + 1 >= i) break;
        r[t++ >>> 0] = 192 | u >> 6, r[t++ >>> 0] = 128 | u & 63;
      } else if (u <= 65535) {
        if (t + 2 >= i) break;
        r[t++ >>> 0] = 224 | u >> 12, r[t++ >>> 0] = 128 | u >> 6 & 63, r[t++ >>> 0] = 128 | u & 63;
      } else {
        if (t + 3 >= i) break;
        r[t++ >>> 0] = 240 | u >> 18, r[t++ >>> 0] = 128 | u >> 12 & 63, r[t++ >>> 0] = 128 | u >> 6 & 63, r[t++ >>> 0] = 128 | u & 63, l++;
      }
    }
    return r[t >>> 0] = 0, t - o;
  }, "stringToUTF8Array"), Qe = /* @__PURE__ */ s((e, r, t) => {
    var n = t > 0 ? t : Je(e) + 1, o = new Array(n), i = Hr(e, o, 0, o.length);
    return r && (o.length = i), o;
  }, "intArrayFromString"), Tn = /* @__PURE__ */ s(() => {
    if (!Ze.length) {
      var e = null;
      if (p) {
        var r = 256, t = Buffer.alloc(r), n = 0;
        try {
          n = Q.readSync(process.stdin.fd, t, 0, r);
        } catch (o) {
          if (o.toString().includes("EOF")) n = 0;
          else throw o;
        }
        n > 0 && (e = t.toString("utf-8", 0, n));
      } else globalThis.window?.prompt && (e = window.prompt("Input: "), e !== null && (e += `
`));
      if (!e)
        return null;
      Ze = Qe(e, !0);
    }
    return Ze.shift();
  }, "FS_stdin_getChar"), oe = { ttys: [], init() {
  }, shutdown() {
  }, register(e, r) {
    oe.ttys[e] = { input: [], output: [], ops: r }, a.registerDevice(e, oe.stream_ops);
  }, stream_ops: { open(e) {
    var r = oe.ttys[e.node.rdev];
    if (!r)
      throw new a.ErrnoError(43);
    e.tty = r, e.seekable = !1;
  }, close(e) {
    e.tty.ops.fsync(e.tty);
  }, fsync(e) {
    e.tty.ops.fsync(e.tty);
  }, read(e, r, t, n, o) {
    if (!e.tty || !e.tty.ops.get_char)
      throw new a.ErrnoError(60);
    for (var i = 0, l = 0; l < n; l++) {
      var u;
      try {
        u = e.tty.ops.get_char(e.tty);
      } catch {
        throw new a.ErrnoError(29);
      }
      if (u === void 0 && !i)
        throw new a.ErrnoError(6);
      if (u == null || (i++, r[t + l] = u, u === 10)) break;
    }
    return i && (e.node.atime = Date.now()), i;
  }, write(e, r, t, n, o) {
    if (!e.tty || !e.tty.ops.put_char)
      throw new a.ErrnoError(60);
    try {
      for (var i = 0; i < n; i++)
        e.tty.ops.put_char(e.tty, r[t + i]);
    } catch {
      throw new a.ErrnoError(29);
    }
    return n && (e.node.mtime = e.node.ctime = Date.now()), i;
  } }, default_tty_ops: { get_char(e) {
    return Tn();
  }, put_char(e, r) {
    r === null || r === 10 ? (Me(fe(e.output)), e.output = []) : r != 0 && e.output.push(r);
  }, fsync(e) {
    e.output?.length > 0 && (Me(fe(e.output)), e.output = []);
  }, ioctl_tcgets(e) {
    return { c_iflag: 25856, c_oflag: 5, c_cflag: 191, c_lflag: 35387, c_cc: [3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
  }, ioctl_tcsets(e, r, t) {
    return 0;
  }, ioctl_tiocgwinsz(e) {
    return [24, 80];
  } }, default_tty1_ops: { put_char(e, r) {
    r === null || r === 10 ? (ee(fe(e.output)), e.output = []) : r != 0 && e.output.push(r);
  }, fsync(e) {
    e.output?.length > 0 && (ee(fe(e.output)), e.output = []);
  } } }, Vr = /* @__PURE__ */ s((e) => {
    V();
  }, "mmapAlloc"), b = { ops_table: null, mount(e) {
    return b.createNode(null, "/", 16895, 0);
  }, createNode(e, r, t, n) {
    if (a.isBlkdev(t) || a.isFIFO(t))
      throw new a.ErrnoError(63);
    b.ops_table || (b.ops_table = { dir: { node: { getattr: b.node_ops.getattr, setattr: b.node_ops.setattr, lookup: b.node_ops.lookup, mknod: b.node_ops.mknod, rename: b.node_ops.rename, unlink: b.node_ops.unlink, rmdir: b.node_ops.rmdir, readdir: b.node_ops.readdir, symlink: b.node_ops.symlink }, stream: { llseek: b.stream_ops.llseek } }, file: { node: { getattr: b.node_ops.getattr, setattr: b.node_ops.setattr }, stream: { llseek: b.stream_ops.llseek, read: b.stream_ops.read, write: b.stream_ops.write, mmap: b.stream_ops.mmap, msync: b.stream_ops.msync } }, link: { node: { getattr: b.node_ops.getattr, setattr: b.node_ops.setattr, readlink: b.node_ops.readlink }, stream: {} }, chrdev: { node: { getattr: b.node_ops.getattr, setattr: b.node_ops.setattr }, stream: a.chrdev_stream_ops } });
    var o = a.createNode(e, r, t, n);
    return a.isDir(o.mode) ? (o.node_ops = b.ops_table.dir.node, o.stream_ops = b.ops_table.dir.stream, o.contents = {}) : a.isFile(o.mode) ? (o.node_ops = b.ops_table.file.node, o.stream_ops = b.ops_table.file.stream, o.usedBytes = 0, o.contents = b.emptyFileContents ?? (b.emptyFileContents = new Uint8Array(0))) : a.isLink(o.mode) ? (o.node_ops = b.ops_table.link.node, o.stream_ops = b.ops_table.link.stream) : a.isChrdev(o.mode) && (o.node_ops = b.ops_table.chrdev.node, o.stream_ops = b.ops_table.chrdev.stream), o.atime = o.mtime = o.ctime = Date.now(), e && (e.contents[r] = o, e.atime = e.mtime = e.ctime = o.atime), o;
  }, getFileDataAsTypedArray(e) {
    return e.contents.subarray(0, e.usedBytes);
  }, expandFileStorage(e, r) {
    var t = e.contents.length;
    if (!(t >= r)) {
      var n = 1024 * 1024;
      r = Math.max(r, t * (t < n ? 2 : 1.125) >>> 0), t && (r = Math.max(r, 256));
      var o = b.getFileDataAsTypedArray(e);
      e.contents = new Uint8Array(r), e.contents.set(o);
    }
  }, resizeFileStorage(e, r) {
    if (e.usedBytes != r) {
      var t = e.contents;
      e.contents = new Uint8Array(r), e.contents.set(t.subarray(0, Math.min(r, e.usedBytes))), e.usedBytes = r;
    }
  }, node_ops: { getattr(e) {
    var r = {};
    return r.dev = a.isChrdev(e.mode) ? e.id : 1, r.ino = e.id, r.mode = e.mode, r.nlink = 1, r.uid = 0, r.gid = 0, r.rdev = e.rdev, a.isDir(e.mode) ? r.size = 4096 : a.isFile(e.mode) ? r.size = e.usedBytes : a.isLink(e.mode) ? r.size = e.link.length : r.size = 0, r.atime = new Date(e.atime), r.mtime = new Date(e.mtime), r.ctime = new Date(e.ctime), r.atimeMs = e.atime, r.mtimeMs = e.mtime, r.ctimeMs = e.ctime, r.blksize = 4096, r.blocks = Math.ceil(r.size / r.blksize), r;
  }, setattr(e, r) {
    for (const t of ["mode", "atime", "mtime", "ctime"])
      r[t] != null && (e[t] = r[t]);
    r.size !== void 0 && b.resizeFileStorage(e, r.size);
  }, lookup(e, r) {
    throw b.doesNotExistError || (b.doesNotExistError = new a.ErrnoError(44), b.doesNotExistError.stack = "<generic error, no stack>"), b.doesNotExistError;
  }, mknod(e, r, t, n) {
    return b.createNode(e, r, t, n);
  }, rename(e, r, t) {
    var n;
    try {
      n = a.lookupNode(r, t);
    } catch {
    }
    if (n && a.isDir(e.mode))
      for (var o in n.contents)
        throw new a.ErrnoError(55);
    delete e.parent.contents[e.name], r.contents[t] = e, e.name = t, r.ctime = r.mtime = e.parent.ctime = e.parent.mtime = Date.now();
  }, unlink(e, r) {
    delete e.contents[r], e.ctime = e.mtime = Date.now();
  }, rmdir(e, r) {
    var t = a.lookupNode(e, r);
    for (var n in t.contents)
      throw new a.ErrnoError(55);
    delete e.contents[r], e.ctime = e.mtime = Date.now();
  }, readdir(e) {
    return [".", "..", ...Object.keys(e.contents)];
  }, symlink(e, r, t) {
    var n = b.createNode(e, r, 41471, 0);
    return n.link = t, n;
  }, readlink(e) {
    if (!a.isLink(e.mode))
      throw new a.ErrnoError(28);
    return e.link;
  } }, stream_ops: { read(e, r, t, n, o) {
    var i = e.node.contents;
    if (o >= e.node.usedBytes) return 0;
    var l = Math.min(e.node.usedBytes - o, n);
    return r.set(i.subarray(o, o + l), t), l;
  }, write(e, r, t, n, o, i) {
    if (r.buffer === L.buffer && (i = !1), !n) return 0;
    var l = e.node;
    return l.mtime = l.ctime = Date.now(), i ? (l.contents = r.subarray(t, t + n), l.usedBytes = n) : !l.usedBytes && !o ? (l.contents = r.slice(t, t + n), l.usedBytes = n) : (b.expandFileStorage(l, o + n), l.contents.set(r.subarray(t, t + n), o), l.usedBytes = Math.max(l.usedBytes, o + n)), n;
  }, llseek(e, r, t) {
    var n = r;
    if (t === 1 ? n += e.position : t === 2 && a.isFile(e.node.mode) && (n += e.node.usedBytes), n < 0)
      throw new a.ErrnoError(28);
    return n;
  }, mmap(e, r, t, n, o) {
    if (!a.isFile(e.node.mode))
      throw new a.ErrnoError(43);
    var i, l, u = e.node.contents;
    if (!(o & 2) && u.buffer === L.buffer)
      l = !1, i = u.byteOffset;
    else {
      if (l = !0, i = Vr(r), !i)
        throw new a.ErrnoError(48);
      u && ((t > 0 || t + r < u.length) && (u.subarray ? u = u.subarray(t, t + r) : u = Array.prototype.slice.call(u, t, t + r)), L.set(u, i >>> 0));
    }
    return { ptr: i, allocated: l };
  }, msync(e, r, t, n, o) {
    return b.stream_ops.write(e, r, 0, n, t, !1), 0;
  } } }, Pn = /* @__PURE__ */ s((e) => {
    if (typeof e != "string") return e;
    var r = { r: 0, "r+": 2, w: 577, "w+": 578, a: 1089, "a+": 1090 }, t = r[e];
    if (typeof t > "u")
      throw new Error(`Unknown file open mode: ${e}`);
    return t;
  }, "FS_modeStringToFlags"), Lr = /* @__PURE__ */ s((e) => (typeof e == "string" && (e = Qe(e, !0)), e.subarray || (e = new Uint8Array(e)), e), "FS_fileDataToTypedArray"), er = /* @__PURE__ */ s((e, r) => {
    var t = 0;
    return e && (t |= 365), r && (t |= 146), t;
  }, "FS_getMode"), An = /* @__PURE__ */ s(async (e) => {
    var r = await T(e);
    return new Uint8Array(r);
  }, "asyncLoad"), Rn = /* @__PURE__ */ s((...e) => a.createDataFile(...e), "FS_createDataFile"), Dn = /* @__PURE__ */ s((e) => e, "getUniqueRunDependency"), Ir = null, Cn = /* @__PURE__ */ s(async () => Ir, "resolveRunDependencies"), ie = 0, qr = null, $n = /* @__PURE__ */ s((e) => {
    ie--, c.monitorRunDependencies?.(ie), ie || qr();
  }, "removeRunDependency"), Wn = /* @__PURE__ */ s((e) => {
    ie || (Ir = new Promise((r) => qr = r)), ie++, c.monitorRunDependencies?.(ie);
  }, "addRunDependency"), Mn = [], Bn = /* @__PURE__ */ s(async (e, r) => {
    typeof Browser < "u" && Browser.init();
    for (var t of Mn)
      if (t.canHandle(r))
        return t.handle(e, r);
    return e;
  }, "FS_handledByPreloadPlugin"), Xr = /* @__PURE__ */ s(async (e, r, t, n, o, i, l, u) => {
    var f = r ? ue.resolve(A.join2(e, r)) : e, v = Dn(`cp ${f}`);
    Wn(v);
    try {
      var g = t;
      typeof t == "string" && (g = await An(t)), g = await Bn(g, f), u?.(), i || Rn(e, r, g, n, o, l);
    } finally {
      $n(v);
    }
  }, "FS_preloadFile"), On = /* @__PURE__ */ s((e, r, t, n, o, i, l, u, f, v) => {
    Xr(e, r, t, n, o, u, f, v).then(i).catch(l);
  }, "FS_createPreloadedFile"), a = { root: null, mounts: [], devices: {}, streams: [], nextInode: 1, nameTable: [], currentPath: "/", initialized: !1, ignorePermissions: !0, filesystems: null, syncFSRequests: 0, ErrnoError: (me = class {
    constructor(r) {
      W(this, "name", "ErrnoError");
      this.errno = r;
    }
  }, s(me, "ErrnoError"), me), FSStream: (he = class {
    constructor() {
      W(this, "shared", {});
    }
    get object() {
      return this.node;
    }
    set object(r) {
      this.node = r;
    }
    get isRead() {
      return (this.flags & 2097155) !== 1;
    }
    get isWrite() {
      return (this.flags & 2097155) !== 0;
    }
    get isAppend() {
      return this.flags & 1024;
    }
    get flags() {
      return this.shared.flags;
    }
    set flags(r) {
      this.shared.flags = r;
    }
    get position() {
      return this.shared.position;
    }
    set position(r) {
      this.shared.position = r;
    }
  }, s(he, "FSStream"), he), FSNode: (ge = class {
    constructor(r, t, n, o) {
      W(this, "node_ops", {});
      W(this, "stream_ops", {});
      W(this, "readMode", 365);
      W(this, "writeMode", 146);
      W(this, "mounted", null);
      r || (r = this), this.parent = r, this.mount = r.mount, this.id = a.nextInode++, this.name = t, this.mode = n, this.rdev = o, this.atime = this.mtime = this.ctime = Date.now();
    }
    get read() {
      return (this.mode & this.readMode) === this.readMode;
    }
    set read(r) {
      r ? this.mode |= this.readMode : this.mode &= ~this.readMode;
    }
    get write() {
      return (this.mode & this.writeMode) === this.writeMode;
    }
    set write(r) {
      r ? this.mode |= this.writeMode : this.mode &= ~this.writeMode;
    }
    get isFolder() {
      return a.isDir(this.mode);
    }
    get isDevice() {
      return a.isChrdev(this.mode);
    }
    addListener(r, t = !1) {
      var n = { cb: r, exclusive: t }, o = this.listeners ?? (this.listeners = /* @__PURE__ */ new Set());
      return o.add(n), { listeners: o, entry: n };
    }
    notifyListeners(r) {
      if (this.listeners) {
        var t;
        for (var n of this.listeners)
          n.exclusive ? (t || (t = [])).push(n) : n.cb(r);
        if (t) {
          var o = (this.exclTurn || 0) % t.length;
          this.exclTurn = o + 1, t[o].cb(r);
        }
      }
    }
  }, s(ge, "FSNode"), ge), lookupPath(e, r = {}) {
    if (!e)
      throw new a.ErrnoError(44);
    r.follow_mount ?? (r.follow_mount = !0), A.isAbs(e) || (e = a.cwd() + "/" + e);
    e: for (var t = 0; t < 40; t++) {
      for (var n = e.split("/").filter((v) => !!v), o = a.root, i = "/", l = 0; l < n.length; l++) {
        var u = l === n.length - 1;
        if (u && r.parent)
          break;
        if (n[l] !== ".") {
          if (n[l] === "..") {
            if (i = A.dirname(i), a.isRoot(o)) {
              e = i + "/" + n.slice(l + 1).join("/"), t--;
              continue e;
            } else
              o = o.parent;
            continue;
          }
          i = A.join2(i, n[l]);
          try {
            o = a.lookupNode(o, n[l]);
          } catch (v) {
            if (v?.errno === 44 && u && r.noent_okay)
              return { path: i };
            throw v;
          }
          if (a.isMountpoint(o) && (!u || r.follow_mount) && (o = o.mounted.root), a.isLink(o.mode) && (!u || r.follow)) {
            if (!o.node_ops.readlink)
              throw new a.ErrnoError(52);
            var f = o.node_ops.readlink(o);
            A.isAbs(f) || (f = A.dirname(i) + "/" + f), e = f + "/" + n.slice(l + 1).join("/");
            continue e;
          }
        }
      }
      return { path: i, node: o };
    }
    throw new a.ErrnoError(32);
  }, getPath(e) {
    for (var r; ; ) {
      if (a.isRoot(e)) {
        var t = e.mount.mountpoint;
        return r ? t[t.length - 1] !== "/" ? `${t}/${r}` : t + r : t;
      }
      r = r ? `${e.name}/${r}` : e.name, e = e.parent;
    }
  }, hashName(e, r) {
    for (var t = 0, n = 0; n < r.length; n++)
      t = (t << 5) - t + r.charCodeAt(n) | 0;
    return (e + t >>> 0) % a.nameTable.length;
  }, hashAddNode(e) {
    var r = a.hashName(e.parent.id, e.name);
    e.name_next = a.nameTable[r], a.nameTable[r] = e;
  }, hashRemoveNode(e) {
    var r = a.hashName(e.parent.id, e.name);
    if (a.nameTable[r] === e)
      a.nameTable[r] = e.name_next;
    else
      for (var t = a.nameTable[r]; t; ) {
        if (t.name_next === e) {
          t.name_next = e.name_next;
          break;
        }
        t = t.name_next;
      }
  }, lookupNode(e, r) {
    var t = a.mayLookup(e);
    if (t)
      throw new a.ErrnoError(t);
    for (var n = a.hashName(e.id, r), o = a.nameTable[n]; o; o = o.name_next) {
      var i = o.name;
      if (o.parent.id === e.id && i === r)
        return o;
    }
    return a.lookup(e, r);
  }, createNode(e, r, t, n) {
    var o = new a.FSNode(e, r, t, n);
    return a.hashAddNode(o), o;
  }, destroyNode(e) {
    a.hashRemoveNode(e);
  }, isRoot(e) {
    return e === e.parent;
  }, isMountpoint(e) {
    return !!e.mounted;
  }, isFile(e) {
    return (e & 61440) === 32768;
  }, isDir(e) {
    return (e & 61440) === 16384;
  }, isLink(e) {
    return (e & 61440) === 40960;
  }, isChrdev(e) {
    return (e & 61440) === 8192;
  }, isBlkdev(e) {
    return (e & 61440) === 24576;
  }, isFIFO(e) {
    return (e & 61440) === 4096;
  }, isSocket(e) {
    return (e & 49152) === 49152;
  }, flagsToPermissionString(e) {
    var r = ["r", "w", "rw"][e & 3];
    return e & 512 && (r += "w"), r;
  }, nodePermissions(e, r) {
    return a.ignorePermissions ? 0 : r.includes("r") && !(e.mode & 292) || r.includes("w") && !(e.mode & 146) || r.includes("x") && !(e.mode & 73) ? 2 : 0;
  }, mayLookup(e) {
    if (!a.isDir(e.mode)) return 54;
    var r = a.nodePermissions(e, "x");
    return r || (e.node_ops.lookup ? 0 : 2);
  }, mayCreate(e, r) {
    if (!a.isDir(e.mode))
      return 54;
    try {
      var t = a.lookupNode(e, r);
      return 20;
    } catch {
    }
    return a.nodePermissions(e, "wx");
  }, mayDelete(e, r, t) {
    var n;
    try {
      n = a.lookupNode(e, r);
    } catch (i) {
      return i.errno;
    }
    var o = a.nodePermissions(e, "wx");
    if (o)
      return o;
    if (t) {
      if (!a.isDir(n.mode))
        return 54;
      if (a.isRoot(n) || a.getPath(n) === a.cwd())
        return 10;
    } else if (a.isDir(n.mode))
      return 31;
    return 0;
  }, mayOpen(e, r) {
    if (!e)
      return 44;
    if (a.isLink(e.mode))
      return 32;
    var t = a.flagsToPermissionString(r);
    return a.isDir(e.mode) && (t !== "r" || r & 576) ? 31 : a.nodePermissions(e, t);
  }, checkOpExists(e, r) {
    if (!e)
      throw new a.ErrnoError(r);
    return e;
  }, MAX_OPEN_FDS: 4096, nextfd() {
    for (var e = 0; e <= a.MAX_OPEN_FDS; e++)
      if (!a.streams[e])
        return e;
    throw new a.ErrnoError(33);
  }, getStreamChecked(e) {
    var r = a.getStream(e);
    if (!r)
      throw new a.ErrnoError(8);
    return r;
  }, getStream: /* @__PURE__ */ s((e) => a.streams[e], "getStream"), createStream(e, r = -1) {
    return e = Object.assign(new a.FSStream(), e), r == -1 && (r = a.nextfd()), e.fd = r, a.streams[r] = e, e;
  }, closeStream(e) {
    a.streams[e] = null;
  }, dupStream(e, r = -1) {
    var t = a.createStream(e, r);
    return t.stream_ops?.dup?.(t), t;
  }, doSetAttr(e, r, t) {
    var n = e?.stream_ops.setattr, o = n ? e : r;
    n ?? (n = r.node_ops.setattr), a.checkOpExists(n, 63);
    try {
      n(o, t);
    } catch (i) {
      throw i instanceof RangeError ? new a.ErrnoError(22) : i;
    }
  }, chrdev_stream_ops: { open(e) {
    var r = a.getDevice(e.node.rdev);
    e.stream_ops = r.stream_ops, e.stream_ops.open?.(e);
  }, llseek() {
    throw new a.ErrnoError(70);
  } }, major: /* @__PURE__ */ s((e) => e >> 8, "major"), minor: /* @__PURE__ */ s((e) => e & 255, "minor"), makedev: /* @__PURE__ */ s((e, r) => e << 8 | r, "makedev"), registerDevice(e, r) {
    a.devices[e] = { stream_ops: r };
  }, getDevice: /* @__PURE__ */ s((e) => a.devices[e], "getDevice"), getMounts(e) {
    for (var r = [], t = [e]; t.length; ) {
      var n = t.pop();
      r.push(n), t.push(...n.mounts);
    }
    return r;
  }, syncfs(e, r) {
    typeof e == "function" && (r = e, e = !1), a.syncFSRequests++, a.syncFSRequests > 1 && ee(`warning: ${a.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
    var t = a.getMounts(a.root.mount), n = 0;
    function o(u) {
      return a.syncFSRequests--, r(u);
    }
    s(o, "doCallback");
    function i(u) {
      if (u)
        return i.errored ? void 0 : (i.errored = !0, o(u));
      ++n >= t.length && o(null);
    }
    s(i, "done");
    for (var l of t)
      l.type.syncfs ? l.type.syncfs(l, e, i) : i(null);
  }, mount(e, r, t) {
    var n = t === "/", o = !t, i;
    if (n && a.root)
      throw new a.ErrnoError(10);
    if (!n && !o) {
      var l = a.lookupPath(t, { follow_mount: !1 });
      if (t = l.path, i = l.node, a.isMountpoint(i))
        throw new a.ErrnoError(10);
      if (!a.isDir(i.mode))
        throw new a.ErrnoError(54);
    }
    var u = { type: e, opts: r, mountpoint: t, mounts: [] }, f = e.mount(u);
    return f.mount = u, u.root = f, n ? a.root = f : i && (i.mounted = u, i.mount && i.mount.mounts.push(u)), f;
  }, unmount(e) {
    var r = a.lookupPath(e, { follow_mount: !1 });
    if (!a.isMountpoint(r.node))
      throw new a.ErrnoError(28);
    var t = r.node, n = t.mounted, o = a.getMounts(n);
    for (var [i, l] of Object.entries(a.nameTable))
      for (; l; ) {
        var u = l.name_next;
        o.includes(l.mount) && a.destroyNode(l), l = u;
      }
    t.mounted = null;
    var f = t.mount.mounts.indexOf(n);
    t.mount.mounts.splice(f, 1);
  }, lookup(e, r) {
    return e.node_ops.lookup(e, r);
  }, mknod(e, r, t) {
    var n = a.lookupPath(e, { parent: !0 }), o = n.node, i = A.basename(e);
    if (!i)
      throw new a.ErrnoError(28);
    if (i === "." || i === "..")
      throw new a.ErrnoError(20);
    var l = a.mayCreate(o, i);
    if (l)
      throw new a.ErrnoError(l);
    if (!o.node_ops.mknod)
      throw new a.ErrnoError(63);
    return o.node_ops.mknod(o, i, r, t);
  }, statfs(e) {
    return a.statfsNode(a.lookupPath(e, { follow: !0 }).node);
  }, statfsStream(e) {
    return a.statfsNode(e.node);
  }, statfsNode(e) {
    var r = { bsize: 4096, frsize: 4096, blocks: 1e6, bfree: 5e5, bavail: 5e5, files: a.nextInode, ffree: a.nextInode - 1, fsid: 42, flags: 2, namelen: 255 };
    return e.node_ops.statfs && Object.assign(r, e.node_ops.statfs(e.mount.opts.root)), r;
  }, create(e, r = 438) {
    return r &= 4095, r |= 32768, a.mknod(e, r, 0);
  }, mkdir(e, r = 511) {
    return r &= 1023, r |= 16384, a.mknod(e, r, 0);
  }, mkdirTree(e, r = 511) {
    var t = e.split("/"), n = "";
    for (var o of t)
      if (o) {
        (n || A.isAbs(e)) && (n += "/"), n += o;
        try {
          a.mkdir(n, r);
        } catch (i) {
          if (i.errno != 20) throw i;
        }
      }
  }, mkdev(e, r, t) {
    return typeof t > "u" && (t = r, r = 438), r |= 8192, a.mknod(e, r, t);
  }, symlink(e, r) {
    if (!ue.resolve(e))
      throw new a.ErrnoError(44);
    var t = a.lookupPath(r, { parent: !0 }), n = t.node;
    if (!n)
      throw new a.ErrnoError(44);
    var o = A.basename(r), i = a.mayCreate(n, o);
    if (i)
      throw new a.ErrnoError(i);
    if (!n.node_ops.symlink)
      throw new a.ErrnoError(63);
    return n.node_ops.symlink(n, o, e);
  }, link(e, r, t) {
    var n = a.lookupPath(r, { parent: !0 }), o = n.node;
    if (!o)
      throw new a.ErrnoError(44);
    var i = A.basename(r), l = a.mayCreate(o, i);
    if (l)
      throw new a.ErrnoError(l);
    if (!o.node_ops.link)
      throw new a.ErrnoError(34);
    return o.node_ops.link(o, i, e, t);
  }, rename(e, r) {
    var t = A.dirname(e), n = A.dirname(r), o = A.basename(e), i = A.basename(r), l, u, f;
    if (l = a.lookupPath(e, { parent: !0 }), u = l.node, l = a.lookupPath(r, { parent: !0 }), f = l.node, !u || !f) throw new a.ErrnoError(44);
    if (u.mount !== f.mount)
      throw new a.ErrnoError(75);
    var v = a.lookupNode(u, o), g = ue.relative(e, n);
    if (g.charAt(0) !== ".")
      throw new a.ErrnoError(28);
    if (g = ue.relative(r, t), g.charAt(0) !== ".")
      throw new a.ErrnoError(55);
    var k;
    try {
      k = a.lookupNode(f, i);
    } catch {
    }
    if (v !== k) {
      var D = a.isDir(v.mode), h = a.mayDelete(u, o, D);
      if (h)
        throw new a.ErrnoError(h);
      if (h = k ? a.mayDelete(f, i, D) : a.mayCreate(f, i), h)
        throw new a.ErrnoError(h);
      if (!u.node_ops.rename)
        throw new a.ErrnoError(63);
      if (a.isMountpoint(v) || k && a.isMountpoint(k))
        throw new a.ErrnoError(10);
      if (f !== u && (h = a.nodePermissions(u, "w"), h))
        throw new a.ErrnoError(h);
      a.hashRemoveNode(v);
      try {
        u.node_ops.rename(v, f, i), k && a.hashRemoveNode(k), v.parent = f;
      } catch (E) {
        throw E;
      } finally {
        a.hashAddNode(v);
      }
    }
  }, rmdir(e) {
    var r = a.lookupPath(e, { parent: !0 }), t = r.node, n = A.basename(e), o = a.lookupNode(t, n), i = a.mayDelete(t, n, !0);
    if (i)
      throw new a.ErrnoError(i);
    if (!t.node_ops.rmdir)
      throw new a.ErrnoError(63);
    if (a.isMountpoint(o))
      throw new a.ErrnoError(10);
    t.node_ops.rmdir(t, n), a.destroyNode(o);
  }, readdir(e) {
    var r = a.lookupPath(e, { follow: !0 }), t = r.node, n = a.checkOpExists(t.node_ops.readdir, 54);
    return n(t);
  }, unlink(e) {
    var r = a.lookupPath(e, { parent: !0 }), t = r.node;
    if (!t)
      throw new a.ErrnoError(44);
    var n = A.basename(e), o = a.lookupNode(t, n), i = a.mayDelete(t, n, !1);
    if (i)
      throw new a.ErrnoError(i);
    if (!t.node_ops.unlink)
      throw new a.ErrnoError(63);
    if (a.isMountpoint(o))
      throw new a.ErrnoError(10);
    t.node_ops.unlink(t, n), a.destroyNode(o);
  }, readlink(e) {
    var r = a.lookupPath(e), t = r.node;
    if (!t)
      throw new a.ErrnoError(44);
    if (!t.node_ops.readlink)
      throw new a.ErrnoError(28);
    return t.node_ops.readlink(t);
  }, stat(e, r = !1) {
    var t = a.lookupPath(e, { follow: !r }), n = t.node, o = a.checkOpExists(n.node_ops.getattr, 63);
    return o(n);
  }, fstat(e) {
    var r = a.getStreamChecked(e), t = r.node, n = r.stream_ops.getattr, o = n ? r : t;
    return n ?? (n = t.node_ops.getattr), a.checkOpExists(n, 63), n(o);
  }, lstat(e) {
    return a.stat(e, !0);
  }, doChmod(e, r, t, n = !1) {
    a.doSetAttr(e, r, { mode: t & 4095 | r.mode & -4096, ctime: Date.now(), dontFollow: n });
  }, chmod(e, r, t = !1) {
    var n;
    if (typeof e == "string") {
      var o = a.lookupPath(e, { follow: !t });
      n = o.node;
    } else
      n = e;
    a.doChmod(null, n, r, t);
  }, lchmod(e, r) {
    a.chmod(e, r, !0);
  }, fchmod(e, r) {
    var t = a.getStreamChecked(e);
    a.doChmod(t, t.node, r, !1);
  }, doChown(e, r, t = !1) {
    a.doSetAttr(e, r, { timestamp: Date.now(), dontFollow: t });
  }, chown(e, r, t, n = !1) {
    var o;
    if (typeof e == "string") {
      var i = a.lookupPath(e, { follow: !n });
      o = i.node;
    } else
      o = e;
    a.doChown(null, o, n);
  }, lchown(e, r, t) {
    a.chown(e, r, t, !0);
  }, fchown(e, r, t) {
    var n = a.getStreamChecked(e);
    a.doChown(n, n.node, !1);
  }, doTruncate(e, r, t) {
    if (a.isDir(r.mode))
      throw new a.ErrnoError(31);
    if (!a.isFile(r.mode))
      throw new a.ErrnoError(28);
    var n = a.nodePermissions(r, "w");
    if (n)
      throw new a.ErrnoError(n);
    a.doSetAttr(e, r, { size: t, timestamp: Date.now() });
  }, truncate(e, r) {
    if (r < 0)
      throw new a.ErrnoError(28);
    var t;
    if (typeof e == "string") {
      var n = a.lookupPath(e, { follow: !0 });
      t = n.node;
    } else
      t = e;
    a.doTruncate(null, t, r);
  }, ftruncate(e, r) {
    var t = a.getStreamChecked(e);
    if (r < 0 || (t.flags & 2097155) === 0)
      throw new a.ErrnoError(28);
    a.doTruncate(t, t.node, r);
  }, utime(e, r, t, n = !1) {
    var o = a.lookupPath(e, { follow: !n });
    a.doSetAttr(null, o.node, { atime: r, mtime: t, dontFollow: n });
  }, open(e, r, t = 438) {
    if (e === "")
      throw new a.ErrnoError(44);
    r = Pn(r), r & 64 ? t = t & 4095 | 32768 : t = 0;
    var n, o;
    if (typeof e == "object")
      n = e;
    else {
      o = e.endsWith("/");
      var i = a.lookupPath(e, { follow: !(r & 131072), noent_okay: !0 });
      n = i.node, e = i.path;
    }
    var l = !1;
    if (r & 64)
      if (n) {
        if (r & 128)
          throw new a.ErrnoError(20);
      } else {
        if (o)
          throw new a.ErrnoError(31);
        n = a.mknod(e, t | 511, 0), l = !0;
      }
    if (!n)
      throw new a.ErrnoError(44);
    if (a.isChrdev(n.mode) && (r &= -513), r & 65536 && !a.isDir(n.mode))
      throw new a.ErrnoError(54);
    if (!l) {
      var u = a.mayOpen(n, r);
      if (u)
        throw new a.ErrnoError(u);
    }
    r & 512 && !l && a.truncate(n, 0), r &= -131713;
    var f = a.createStream({ node: n, path: a.getPath(n), flags: r, seekable: !0, position: 0, stream_ops: n.stream_ops, ungotten: [], error: !1 });
    return f.stream_ops.open && f.stream_ops.open(f), l && a.chmod(n, t & 511), f;
  }, close(e) {
    if (a.isClosed(e))
      throw new a.ErrnoError(8);
    e.getdents && (e.getdents = null), e.node?.notifyListeners(32);
    try {
      e.stream_ops.close && e.stream_ops.close(e);
    } catch (r) {
      throw r;
    } finally {
      a.closeStream(e.fd);
    }
    e.fd = null;
  }, isClosed(e) {
    return e.fd === null;
  }, llseek(e, r, t) {
    if (a.isClosed(e))
      throw new a.ErrnoError(8);
    if (!e.seekable || !e.stream_ops.llseek)
      throw new a.ErrnoError(70);
    if (t != 0 && t != 1 && t != 2)
      throw new a.ErrnoError(28);
    return e.position = e.stream_ops.llseek(e, r, t), e.ungotten = [], e.position;
  }, read(e, r, t, n, o) {
    if (n < 0 || o < 0)
      throw new a.ErrnoError(28);
    if (a.isClosed(e))
      throw new a.ErrnoError(8);
    if ((e.flags & 2097155) === 1)
      throw new a.ErrnoError(8);
    if (a.isDir(e.node.mode))
      throw new a.ErrnoError(31);
    if (!e.stream_ops.read)
      throw new a.ErrnoError(28);
    var i = typeof o < "u";
    if (!i)
      o = e.position;
    else if (!e.seekable)
      throw new a.ErrnoError(70);
    var l = e.stream_ops.read(e, r, t, n, o);
    return i || (e.position += l), l;
  }, write(e, r, t, n, o, i) {
    if (n < 0 || o < 0)
      throw new a.ErrnoError(28);
    if (a.isClosed(e))
      throw new a.ErrnoError(8);
    if ((e.flags & 2097155) === 0)
      throw new a.ErrnoError(8);
    if (a.isDir(e.node.mode))
      throw new a.ErrnoError(31);
    if (!e.stream_ops.write)
      throw new a.ErrnoError(28);
    e.seekable && e.flags & 1024 && a.llseek(e, 0, 2);
    var l = typeof o < "u";
    if (!l)
      o = e.position;
    else if (!e.seekable)
      throw new a.ErrnoError(70);
    var u = e.stream_ops.write(e, r, t, n, o, i);
    return l || (e.position += u), u;
  }, mmap(e, r, t, n, o) {
    if (n & 2 && !(o & 2) && (e.flags & 2097155) !== 2)
      throw new a.ErrnoError(2);
    if ((e.flags & 2097155) === 1)
      throw new a.ErrnoError(2);
    if (!e.stream_ops.mmap)
      throw new a.ErrnoError(43);
    if (!r)
      throw new a.ErrnoError(28);
    return e.stream_ops.mmap(e, r, t, n, o);
  }, msync(e, r, t, n, o) {
    return e.stream_ops.msync ? e.stream_ops.msync(e, r, t, n, o) : 0;
  }, ioctl(e, r, t) {
    if (!e.stream_ops.ioctl)
      throw new a.ErrnoError(59);
    return e.stream_ops.ioctl(e, r, t);
  }, readFile(e, r = {}) {
    r.flags ?? (r.flags = 0), r.encoding ?? (r.encoding = "binary"), r.encoding !== "utf8" && r.encoding !== "binary" && V(`Invalid encoding type "${r.encoding}"`);
    var t = a.open(e, r.flags), n = a.stat(e), o = n.size, i = new Uint8Array(o);
    return a.read(t, i, 0, o, 0), r.encoding === "utf8" && (i = fe(i)), a.close(t), i;
  }, writeFile(e, r, t = {}) {
    t.flags ?? (t.flags = 577);
    var n = a.open(e, t.flags, t.mode);
    r = Lr(r), a.write(n, r, 0, r.byteLength, void 0, t.canOwn), a.close(n);
  }, cwd: /* @__PURE__ */ s(() => a.currentPath, "cwd"), chdir(e) {
    var r = a.lookupPath(e, { follow: !0 });
    if (r.node === null)
      throw new a.ErrnoError(44);
    if (!a.isDir(r.node.mode))
      throw new a.ErrnoError(54);
    var t = a.nodePermissions(r.node, "x");
    if (t)
      throw new a.ErrnoError(t);
    a.currentPath = r.path;
  }, createDefaultDirectories() {
    a.mkdir("/tmp"), a.mkdir("/home"), a.mkdir("/home/web_user");
  }, createDefaultDevices() {
    a.mkdir("/dev"), a.registerDevice(a.makedev(1, 3), { read: /* @__PURE__ */ s(() => 0, "read"), write: /* @__PURE__ */ s((n, o, i, l, u) => l, "write"), llseek: /* @__PURE__ */ s(() => 0, "llseek") }), a.mkdev("/dev/null", a.makedev(1, 3)), oe.register(a.makedev(5, 0), oe.default_tty_ops), oe.register(a.makedev(6, 0), oe.default_tty1_ops), a.mkdev("/dev/tty", a.makedev(5, 0)), a.mkdev("/dev/tty1", a.makedev(6, 0));
    var e = new Uint8Array(1024), r = 0, t = /* @__PURE__ */ s(() => (r || (jr(e), r = e.byteLength), e[--r]), "randomByte");
    a.createDevice("/dev", "random", t), a.createDevice("/dev", "urandom", t), a.mkdir("/dev/shm"), a.mkdir("/dev/shm/tmp");
  }, createSpecialDirectories() {
    a.mkdir("/proc");
    var e = a.mkdir("/proc/self");
    a.mkdir("/proc/self/fd"), a.mount({ mount() {
      var r = a.createNode(e, "fd", 16895, 73);
      return r.stream_ops = { llseek: b.stream_ops.llseek }, r.node_ops = { lookup(t, n) {
        var o = +n, i = a.getStreamChecked(o), l = { parent: null, mount: { mountpoint: "fake" }, node_ops: { readlink: /* @__PURE__ */ s(() => i.path, "readlink") }, id: o + 1 };
        return l.parent = l, l;
      }, readdir() {
        return Array.from(a.streams.entries()).filter(([t, n]) => n).map(([t, n]) => t.toString());
      } }, r;
    } }, {}, "/proc/self/fd");
  }, createStandardStreams(e, r, t) {
    e ? a.createDevice("/dev", "stdin", e) : a.symlink("/dev/tty", "/dev/stdin"), r ? a.createDevice("/dev", "stdout", null, r) : a.symlink("/dev/tty", "/dev/stdout"), t ? a.createDevice("/dev", "stderr", null, t) : a.symlink("/dev/tty1", "/dev/stderr"), a.open("/dev/stdin", 0), a.open("/dev/stdout", 1), a.open("/dev/stderr", 1);
  }, staticInit() {
    a.nameTable.length = 4096, a.mount(b, {}, "/"), a.createDefaultDirectories(), a.createDefaultDevices(), a.createSpecialDirectories(), a.filesystems = { MEMFS: b };
  }, init(e, r, t) {
    a.initialized = !0, e ?? (e = c.stdin), r ?? (r = c.stdout), t ?? (t = c.stderr), a.createStandardStreams(e, r, t);
  }, quit() {
    a.initialized = !1;
    for (var e of a.streams)
      e && a.close(e);
  }, analyzePath(e, r = !1) {
    try {
      var t = a.lookupPath(e, { follow: !r });
      e = t.path;
    } catch {
    }
    var n = { isRoot: !1, exists: !1, error: 0, name: null, path: null, object: null, parentExists: !1, parentPath: null, parentObject: null };
    try {
      var t = a.lookupPath(e, { parent: !0 });
      n.parentExists = !0, n.parentPath = t.path, n.parentObject = t.node, n.name = A.basename(e), t = a.lookupPath(e, { follow: !r }), n.exists = !0, n.path = t.path, n.object = t.node, n.name = t.node.name, n.isRoot = t.path === "/";
    } catch (o) {
      n.error = o.errno;
    }
    return n;
  }, createPath(e, r, t, n) {
    e = typeof e == "string" ? e : a.getPath(e);
    for (var o = r.split("/").reverse(); o.length; ) {
      var i = o.pop();
      if (i) {
        var l = A.join2(e, i);
        try {
          a.mkdir(l);
        } catch (u) {
          if (u.errno != 20) throw u;
        }
        e = l;
      }
    }
    return l;
  }, createFile(e, r, t, n, o) {
    var i = A.join2(typeof e == "string" ? e : a.getPath(e), r), l = er(n, o);
    return a.create(i, l);
  }, createDataFile(e, r, t, n, o, i) {
    var l = r;
    e && (e = typeof e == "string" ? e : a.getPath(e), l = r ? A.join2(e, r) : e);
    var u = er(n, o), f = a.create(l, u);
    if (t) {
      t = Lr(t), a.chmod(f, u | 146);
      var v = a.open(f, 577);
      a.write(v, t, 0, t.length, 0, i), a.close(v), a.chmod(f, u);
    }
  }, createDevice(e, r, t, n) {
    var u;
    var o = A.join2(typeof e == "string" ? e : a.getPath(e), r), i = er(!!t, !!n);
    (u = a.createDevice).major ?? (u.major = 64);
    var l = a.makedev(a.createDevice.major++, 0);
    return a.registerDevice(l, { open(f) {
      f.seekable = !1;
    }, close(f) {
      n?.buffer?.length && n(10);
    }, read(f, v, g, k, D) {
      for (var h = 0, E = 0; E < k; E++) {
        var S;
        try {
          S = t();
        } catch {
          throw new a.ErrnoError(29);
        }
        if (S === void 0 && !h)
          throw new a.ErrnoError(6);
        if (S == null) break;
        h++, v[g + E] = S;
      }
      return h && (f.node.atime = Date.now()), h;
    }, write(f, v, g, k, D) {
      for (var h = 0; h < k; h++)
        try {
          n(v[g + h]);
        } catch {
          throw new a.ErrnoError(29);
        }
      return k && (f.node.mtime = f.node.ctime = Date.now()), h;
    } }), a.mkdev(o, i, l);
  }, forceLoadFile(e) {
    if (e.isDevice || e.isFolder || e.link || e.contents) return !0;
    if (globalThis.XMLHttpRequest)
      V("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
    else
      try {
        e.contents = Y(e.url);
      } catch {
        throw new a.ErrnoError(29);
      }
  }, createLazyFile(e, r, t, n, o) {
    const k = class k {
      constructor() {
        W(this, "lengthKnown", !1);
        W(this, "chunks", []);
      }
      get(h) {
        if (!(h > this.length - 1 || h < 0)) {
          var E = h % this.chunkSize, S = h / this.chunkSize | 0;
          return this.getter(S)[E];
        }
      }
      setDataGetter(h) {
        this.getter = h;
      }
      cacheLength() {
        var h = new XMLHttpRequest();
        h.open("HEAD", t, !1), h.send(null), h.status >= 200 && h.status < 300 || h.status === 304 || V(`Couldn't load ${t}. Status: ${h.status}`);
        var E = Number(h.getResponseHeader("Content-length")), S, U = (S = h.getResponseHeader("Accept-Ranges")) && S === "bytes", N = (S = h.getResponseHeader("Content-Encoding")) && S === "gzip", H = 1024 * 1024;
        U || (H = E);
        var G = /* @__PURE__ */ s((Z, ye) => {
          Z > ye && V(`invalid range (${Z}, ${ye}) or no bytes requested!`), ye > E - 1 && V(`only ${E} bytes available! programmer error!`);
          var B = new XMLHttpRequest();
          return B.open("GET", t, !1), E !== H && B.setRequestHeader("Range", `bytes=${Z}-${ye}`), B.responseType = "arraybuffer", B.overrideMimeType && B.overrideMimeType("text/plain; charset=x-user-defined"), B.send(null), B.status >= 200 && B.status < 300 || B.status === 304 || V(`Couldn't load ${t}. Status: ${B.status}`), B.response !== void 0 ? new Uint8Array(B.response || []) : Qe(B.responseText ?? "", !0);
        }, "doXHR"), Re = this;
        Re.setDataGetter((Z) => {
          var ye = Z * H, B = (Z + 1) * H - 1;
          return B = Math.min(B, E - 1), typeof Re.chunks[Z] > "u" && (Re.chunks[Z] = G(ye, B)), typeof Re.chunks[Z] > "u" && V("doXHR failed!"), Re.chunks[Z];
        }), (N || !E) && (H = E = 1, E = this.getter(0).length, H = E, Me("LazyFiles on gzip forces download of the whole file when length is accessed")), this._length = E, this._chunkSize = H, this.lengthKnown = !0;
      }
      get length() {
        return this.lengthKnown || this.cacheLength(), this._length;
      }
      get chunkSize() {
        return this.lengthKnown || this.cacheLength(), this._chunkSize;
      }
    };
    s(k, "LazyUint8Array");
    let i = k;
    if (globalThis.XMLHttpRequest) {
      m || V("Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc");
      var l = new i(), u = { isDevice: !1, contents: l };
    } else
      var u = { isDevice: !1, url: t };
    var f = a.createFile(e, r, u, n, o);
    u.contents ? f.contents = u.contents : u.url && (f.contents = null, f.url = u.url), Object.defineProperties(f, { usedBytes: { get: /* @__PURE__ */ s(function() {
      return this.contents.length;
    }, "get") } });
    var v = {};
    for (const [D, h] of Object.entries(f.stream_ops))
      v[D] = (...E) => (a.forceLoadFile(f), h(...E));
    function g(D, h, E, S, U) {
      var N = D.node.contents;
      if (U >= N.length) return 0;
      var H = Math.min(N.length - U, S);
      if (N.slice)
        for (var G = 0; G < H; G++)
          h[E + G] = N[U + G];
      else
        for (var G = 0; G < H; G++)
          h[E + G] = N.get(U + G);
      return H;
    }
    return s(g, "writeChunks"), v.read = (D, h, E, S, U) => (a.forceLoadFile(f), g(D, h, E, S, U)), v.mmap = (D, h, E, S, U) => {
      a.forceLoadFile(f);
      var N = Vr(h);
      if (!N)
        throw new a.ErrnoError(48);
      return g(D, L, N, h, E), { ptr: N, allocated: !0 };
    }, f.stream_ops = v, f;
  } }, K, rr = /* @__PURE__ */ s((e, r, t) => (e >>>= 0, e ? fe(K, e, r, t) : ""), "UTF8ToString"), M, x, j, O = { currentUmask: 18, calculateAt(e, r, t = !1) {
    if (A.isAbs(r))
      return r;
    var n;
    if (e === -100)
      n = a.cwd();
    else {
      var o = O.getStreamFromFD(e);
      n = o.path;
    }
    if (r.length == 0) {
      if (!t)
        throw new a.ErrnoError(44);
      return n;
    }
    return n + "/" + r;
  }, writeStat(e, r) {
    x[e >>> 2 >>> 0] = r.dev, x[e + 4 >>> 2 >>> 0] = r.mode, x[e + 8 >>> 2 >>> 0] = r.nlink, x[e + 12 >>> 2 >>> 0] = r.uid, x[e + 16 >>> 2 >>> 0] = r.gid, x[e + 20 >>> 2 >>> 0] = r.rdev, j[e + 24 >>> 3 >>> 0] = BigInt(r.size), M[e + 32 >>> 2 >>> 0] = 4096, M[e + 36 >>> 2 >>> 0] = r.blocks;
    var t = r.atimeMs ?? r.atime.getTime(), n = r.mtimeMs ?? r.mtime.getTime(), o = r.ctimeMs ?? r.ctime.getTime();
    return j[e + 40 >>> 3 >>> 0] = BigInt(Math.floor(t / 1e3)), x[e + 48 >>> 2 >>> 0] = Math.floor(t % 1e3 * 1e6), j[e + 56 >>> 3 >>> 0] = BigInt(Math.floor(n / 1e3)), x[e + 64 >>> 2 >>> 0] = Math.floor(n % 1e3 * 1e6), j[e + 72 >>> 3 >>> 0] = BigInt(Math.floor(o / 1e3)), x[e + 80 >>> 2 >>> 0] = Math.floor(o % 1e3 * 1e6), j[e + 88 >>> 3 >>> 0] = BigInt(r.ino), 0;
  }, writeStatFs(e, r) {
    x[e + 4 >>> 2 >>> 0] = r.bsize, x[e + 60 >>> 2 >>> 0] = r.bsize, j[e + 8 >>> 3 >>> 0] = BigInt(r.blocks), j[e + 16 >>> 3 >>> 0] = BigInt(r.bfree), j[e + 24 >>> 3 >>> 0] = BigInt(r.bavail), j[e + 32 >>> 3 >>> 0] = BigInt(r.files), j[e + 40 >>> 3 >>> 0] = BigInt(r.ffree), x[e + 48 >>> 2 >>> 0] = r.fsid, x[e + 64 >>> 2 >>> 0] = r.flags, x[e + 56 >>> 2 >>> 0] = r.namelen;
  }, doMsync(e, r, t, n, o) {
    if (!a.isFile(r.node.mode))
      throw new a.ErrnoError(43);
    if (n & 2)
      return 0;
    var i = K.subarray(e >>> 0, e + t >>> 0);
    a.msync(r, i, o, t, n);
  }, getStreamFromFD(e) {
    var r = a.getStreamChecked(e);
    return r;
  }, varargs: void 0, getStr(e) {
    var r = rr(e);
    return r;
  } };
  function Gr(e, r, t) {
    try {
      if (e === r || t & -524289) return -28;
      var n = O.getStreamFromFD(e);
      if (r < 0 || r >= a.MAX_OPEN_FDS) return -8;
      var o = a.getStream(r);
      o && a.close(o);
      var i = a.dupStream(n, r);
      return t & 524288 && (i.flags |= 524288), i.fd;
    } catch (l) {
      if (typeof a > "u" || l.name !== "ErrnoError") throw l;
      return -l.errno;
    }
  }
  s(Gr, "___syscall_dup3");
  var Be = /* @__PURE__ */ s(() => {
    var e = M[+O.varargs >>> 2 >>> 0];
    return O.varargs += 4, e;
  }, "syscallGetVarargI"), de = Be, Un = 9007199254740992, jn = -9007199254740992, Yr = /* @__PURE__ */ s((e) => e < jn || e > Un ? NaN : Number(e), "bigintToI53Checked"), se;
  function Kr(e, r, t) {
    t >>>= 0, O.varargs = t;
    try {
      var n = O.getStreamFromFD(e);
      switch (r) {
        case 0: {
          var o = Be();
          if (o < 0)
            return -28;
          for (; a.streams[o]; )
            o++;
          var i;
          return i = a.dupStream(n, o), i.fd;
        }
        case 1:
        case 2:
          return 0;
        case 3:
          return n.flags;
        case 4: {
          var o = Be(), l = 289792;
          return n.flags = n.flags & ~l | o & l, 0;
        }
        case 12: {
          var o = de(), u = 0;
          return se[o + u >>> 1 >>> 0] = 2, 0;
        }
        case 13:
        case 14:
          return 0;
      }
      return -28;
    } catch (f) {
      if (typeof a > "u" || f.name !== "ErrnoError") throw f;
      return -f.errno;
    }
  }
  s(Kr, "___syscall_fcntl64");
  function Zr(e, r, t) {
    t >>>= 0, O.varargs = t;
    try {
      var n = O.getStreamFromFD(e);
      switch (r) {
        case 21509:
          return n.tty ? 0 : -59;
        case 21505: {
          if (!n.tty) return -59;
          if (n.tty.ops.ioctl_tcgets) {
            var o = n.tty.ops.ioctl_tcgets(n), i = de();
            M[i >>> 2 >>> 0] = o.c_iflag || 0, M[i + 4 >>> 2 >>> 0] = o.c_oflag || 0, M[i + 8 >>> 2 >>> 0] = o.c_cflag || 0, M[i + 12 >>> 2 >>> 0] = o.c_lflag || 0;
            for (var l = 0; l < 32; l++)
              L[i + l + 17 >>> 0] = o.c_cc[l] || 0;
            return 0;
          }
          return 0;
        }
        case 21510:
        case 21511:
        case 21512:
          return n.tty ? 0 : -59;
        case 21506:
        case 21507:
        case 21508: {
          if (!n.tty) return -59;
          if (n.tty.ops.ioctl_tcsets) {
            for (var i = de(), u = M[i >>> 2 >>> 0], f = M[i + 4 >>> 2 >>> 0], v = M[i + 8 >>> 2 >>> 0], g = M[i + 12 >>> 2 >>> 0], k = [], l = 0; l < 32; l++)
              k.push(L[i + l + 17 >>> 0]);
            return n.tty.ops.ioctl_tcsets(n.tty, r, { c_iflag: u, c_oflag: f, c_cflag: v, c_lflag: g, c_cc: k });
          }
          return 0;
        }
        case 21519: {
          if (!n.tty) return -59;
          var i = de();
          return M[i >>> 2 >>> 0] = 0, 0;
        }
        case 21520:
          return n.tty ? -28 : -59;
        case 21537:
        case 21531: {
          var i = de();
          return a.ioctl(n, r, i);
        }
        case 21523: {
          if (!n.tty) return -59;
          if (n.tty.ops.ioctl_tiocgwinsz) {
            var D = n.tty.ops.ioctl_tiocgwinsz(n.tty), i = de();
            se[i >>> 1 >>> 0] = D[0], se[i + 2 >>> 1 >>> 0] = D[1];
          }
          return 0;
        }
        case 21524:
          return n.tty ? 0 : -59;
        case 21515:
          return n.tty ? 0 : -59;
        default:
          return -28;
      }
    } catch (h) {
      if (typeof a > "u" || h.name !== "ErrnoError") throw h;
      return -h.errno;
    }
  }
  s(Zr, "___syscall_ioctl");
  function Jr(e, r, t, n) {
    r >>>= 0, n >>>= 0, O.varargs = n;
    try {
      r = O.getStr(r), r = O.calculateAt(e, r);
      var o = n ? Be() : 0;
      return t & 64 && (o &= ~O.currentUmask), a.open(r, t, o).fd;
    } catch (i) {
      if (typeof a > "u" || i.name !== "ErrnoError") throw i;
      return -i.errno;
    }
  }
  s(Jr, "___syscall_openat");
  var Nn = /* @__PURE__ */ s(() => V(""), "__abort_js"), z = /* @__PURE__ */ s((e) => {
    e >>>= 0;
    for (var r = ""; ; ) {
      var t = K[e++ >>> 0];
      if (!t) return r;
      r += String.fromCharCode(t);
    }
  }, "AsciiToString"), _e = {}, le = {}, Oe = {};
  const dr = class dr extends Error {
    constructor(r) {
      super(r), this.name = "BindingError";
    }
  };
  s(dr, "BindingError");
  let tr = dr;
  var I = /* @__PURE__ */ s((e) => {
    throw new tr(e);
  }, "throwBindingError");
  function Qr(e, r, t = {}) {
    var n = r.name;
    if (e || I(`type "${n}" must have a positive integer typeid pointer`), le.hasOwnProperty(e)) {
      if (t.ignoreDuplicateRegistrations)
        return;
      I(`Cannot register type '${n}' twice`);
    }
    if (le[e] = r, delete Oe[e], _e.hasOwnProperty(e)) {
      var o = _e[e];
      delete _e[e], o.forEach((i) => i());
    }
  }
  s(Qr, "sharedRegisterType");
  function X(e, r, t = {}) {
    return Qr(e, r, t);
  }
  s(X, "registerType");
  var Pe, et, rt = /* @__PURE__ */ s((e, r, t) => {
    switch (r) {
      case 1:
        return t ? (n) => L[n >>> 0] : (n) => K[n >>> 0];
      case 2:
        return t ? (n) => se[n >>> 1 >>> 0] : (n) => Pe[n >>> 1 >>> 0];
      case 4:
        return t ? (n) => M[n >>> 2 >>> 0] : (n) => x[n >>> 2 >>> 0];
      case 8:
        return t ? (n) => j[n >>> 3 >>> 0] : (n) => et[n >>> 3 >>> 0];
      default:
        throw new TypeError(`invalid integer width (${r}): ${e}`);
    }
  }, "integerReadValueFromPointer"), zn = /* @__PURE__ */ s(function(e, r, t, n, o) {
    e >>>= 0, r >>>= 0, t >>>= 0, r = z(r);
    const i = n === 0n;
    let l = /* @__PURE__ */ s((u) => u, "fromWireType");
    if (i) {
      const u = t * 8;
      l = /* @__PURE__ */ s((f) => BigInt.asUintN(u, f), "fromWireType"), o = l(o);
    }
    X(e, { name: r, fromWireType: l, toWireType: /* @__PURE__ */ s((u, f) => (typeof f == "number" && (f = BigInt(f)), f), "toWireType"), readValueFromPointer: rt(r, t, !i), destructorFunction: null });
  }, "__embind_register_bigint");
  function tt(e, r, t, n) {
    e >>>= 0, r >>>= 0, r = z(r), X(e, { name: r, fromWireType: /* @__PURE__ */ s(function(o) {
      return !!o;
    }, "fromWireType"), toWireType: /* @__PURE__ */ s(function(o, i) {
      return i ? t : n;
    }, "toWireType"), readValueFromPointer: /* @__PURE__ */ s(function(o) {
      return this.fromWireType(K[o >>> 0]);
    }, "readValueFromPointer"), destructorFunction: null });
  }
  s(tt, "__embind_register_bool");
  const _r = class _r extends Error {
    constructor(r) {
      super(r), this.name = "InternalError";
    }
  };
  s(_r, "InternalError");
  let nr = _r;
  var nt = /* @__PURE__ */ s((e) => {
    throw new nr(e);
  }, "throwInternalError"), at = /* @__PURE__ */ s((e, r, t) => {
    e.forEach((u) => Oe[u] = r);
    function n(u) {
      var f = t(u);
      f.length !== e.length && nt("Mismatched type converter count");
      for (var v = 0; v < e.length; ++v)
        X(e[v], f[v]);
    }
    s(n, "onComplete");
    var o = new Array(r.length), i = [], l = 0;
    for (let [u, f] of r.entries())
      le.hasOwnProperty(f) ? o[u] = le[f] : (i.push(f), _e.hasOwnProperty(f) || (_e[f] = []), _e[f].push(() => {
        o[u] = le[f], ++l, l === i.length && n(o);
      }));
    i.length === 0 && n(o);
  }, "whenDependentTypesAreResolved"), Hn = /* @__PURE__ */ s(function(e, r, t) {
    e >>>= 0, r >>>= 0, e = z(e), at([], [r], (n) => (n = n[0], c[e] = n.fromWireType(t), []));
  }, "__embind_register_constant"), ot = [], re = [0, 1, , 1, null, 1, !0, 1, !1, 1], it = [];
  function Ue(e) {
    if (e >>>= 0, e > 9 && --re[e + 1] === 0) {
      var r = re[e];
      re[e] = void 0;
      var t = it[e];
      t && (it[e] = void 0, t(r)), ot.push(e);
    }
  }
  s(Ue, "__emval_decref");
  var $ = { toValue: /* @__PURE__ */ s((e) => (e || I(`Cannot use deleted val. handle = ${e}`), re[e]), "toValue"), toHandle: /* @__PURE__ */ s((e) => {
    switch (e) {
      case void 0:
        return 2;
      case null:
        return 4;
      case !0:
        return 6;
      case !1:
        return 8;
      default: {
        const r = ot.pop() || re.length;
        return re[r] = e, re[r + 1] = 1, r;
      }
    }
  }, "toHandle") };
  function je(e) {
    return this.fromWireType(x[e >>> 2 >>> 0]);
  }
  s(je, "readPointer");
  var Vn = { name: "emscripten::val", fromWireType: /* @__PURE__ */ s((e) => {
    var r = $.toValue(e);
    return Ue(e), r;
  }, "fromWireType"), toWireType: /* @__PURE__ */ s((e, r) => $.toHandle(r), "toWireType"), readValueFromPointer: je, destructorFunction: null };
  function st(e) {
    return e >>>= 0, X(e, Vn);
  }
  s(st, "__embind_register_emval");
  var lt, ct, Ln = /* @__PURE__ */ s((e, r) => {
    switch (r) {
      case 4:
        return function(t) {
          return this.fromWireType(lt[t >>> 2 >>> 0]);
        };
      case 8:
        return function(t) {
          return this.fromWireType(ct[t >>> 3 >>> 0]);
        };
      default:
        throw new TypeError(`invalid float width (${r}): ${e}`);
    }
  }, "floatReadValueFromPointer"), In = /* @__PURE__ */ s(function(e, r, t) {
    e >>>= 0, r >>>= 0, t >>>= 0, r = z(r), X(e, { name: r, fromWireType: /* @__PURE__ */ s((n) => n, "fromWireType"), toWireType: /* @__PURE__ */ s((n, o) => o, "toWireType"), readValueFromPointer: Ln(r, t), destructorFunction: null });
  }, "__embind_register_float"), ut = /* @__PURE__ */ s((e, r) => Object.defineProperty(r, "name", { value: e }), "createNamedFunction"), ft = /* @__PURE__ */ s((e) => {
    for (; e.length; ) {
      var r = e.pop(), t = e.pop();
      t(r);
    }
  }, "runDestructors");
  function ar(e) {
    for (var r = 1; r < e.length; ++r)
      if (e[r] !== null && e[r].destructorFunction === void 0)
        return !0;
    return !1;
  }
  s(ar, "usesDestructorStack");
  function or(e) {
    for (var r = 1; r < e.length; ++r)
      if (e[r] !== null && e[r].argStackAlloc)
        return !0;
    return !1;
  }
  s(or, "argsUseStackAlloc");
  var dt = /* @__PURE__ */ s(() => Jt(), "stackSave"), _t = /* @__PURE__ */ s((e) => Zt(e), "stackRestore");
  function vt(e, r, t, n) {
    var o = ar(e), i = or(e), l = i && !n && !o;
    i && !l && (o = !0);
    var u = e.length - 2, f = [], v = ["fn"];
    r && v.push("thisWired");
    for (var g = 0; g < u; ++g)
      f.push(`arg${g}`), v.push(`arg${g}Wired`);
    f = f.join(), v = v.join();
    var k = `return function (${f}) {
`;
    o && (k += `var destructors = [];
`), l && (k += `var sp = stackSave();
try {
`);
    var D = o ? "destructors" : "null", h = ["humanName", "throwBindingError", "invoker", "fn", "runDestructors", "fromRetWire", "toClassParamWire"];
    l && h.push("stackSave", "stackRestore"), r && (k += `var thisWired = toClassParamWire(${D}, this);
`);
    for (var g = 0; g < u; ++g) {
      var E = `toArg${g}Wire`;
      k += `var arg${g}Wired = ${E}(${D}, arg${g});
`, h.push(E);
    }
    if (k += (t || n ? "var rv = " : "") + `invoker(${v});
`, l && (k += `} finally {
stackRestore(sp);
}
`), o)
      k += `runDestructors(destructors);
`;
    else
      for (var g = r ? 1 : 2; g < e.length; ++g) {
        var S = g === 1 ? "thisWired" : `arg${g - 2}Wired`;
        e[g].destructorFunction !== null && (k += `${S}_dtor(${S});
`, h.push(`${S}_dtor`));
      }
    return t && (k += `var ret = fromRetWire(rv);
return ret;
`), k += `}
`, new Function(h, k);
  }
  s(vt, "createJsInvoker");
  function pt(e, r, t, n, o, i) {
    var l = r.length;
    l < 2 && I("argTypes array size mismatch! Must at least get return value and receiver (this) types!");
    var u = r[1] !== null && t !== null, f = ar(r), v = or(r), g = v && !i && !f;
    v && !g && (f = !0);
    var k = !r[0].isVoid, D = r[0], h = r[1], E = [e, I, n, o, ft, D.fromWireType.bind(D), h?.toWireType.bind(h)];
    g && E.push(dt, _t);
    for (var S = 2; S < l; ++S) {
      var U = r[S];
      E.push(U.toWireType.bind(U));
    }
    if (!f)
      for (var S = u ? 1 : 2; S < r.length; ++S)
        r[S].destructorFunction !== null && E.push(r[S].destructorFunction);
    var H = vt(r, u, k, i)(...E);
    return ut(e, H);
  }
  s(pt, "craftInvokerFunction");
  var qn = /* @__PURE__ */ s((e, r, t) => {
    if (e[r].overloadTable === void 0) {
      var n = e[r];
      e[r] = function(...o) {
        return e[r].overloadTable.hasOwnProperty(o.length) || I(`Function '${t}' called with an invalid number of arguments (${o.length}) - expects one of (${e[r].overloadTable})!`), e[r].overloadTable[o.length].apply(this, o);
      }, e[r].overloadTable = [], e[r].overloadTable[n.argCount] = n;
    }
  }, "ensureOverloadTable"), Xn = /* @__PURE__ */ s((e, r, t) => {
    c.hasOwnProperty(e) ? ((t === void 0 || c[e].overloadTable !== void 0 && c[e].overloadTable[t] !== void 0) && I(`Cannot register public name '${e}' twice`), qn(c, e, e), c[e].overloadTable.hasOwnProperty(t) && I(`Cannot register multiple overloads of a function with the same number of arguments (${t})!`), c[e].overloadTable[t] = r) : (c[e] = r, c[e].argCount = t);
  }, "exposePublicSymbol"), Gn = /* @__PURE__ */ s((e, r) => {
    for (var t = [], n = 0; n < e; n++)
      t.push(x[r + n * 4 >>> 2 >>> 0]);
    return t;
  }, "heap32VectorToArray"), Yn = /* @__PURE__ */ s((e, r, t) => {
    c.hasOwnProperty(e) || nt("Replacing nonexistent public symbol"), c[e].overloadTable !== void 0 && t !== void 0 ? c[e].overloadTable[t] = r : (c[e] = r, c[e].argCount = t);
  }, "replacePublicSymbol"), mt = [], ht = /* @__PURE__ */ s((e) => {
    var r = mt[e];
    return r || (mt[e] = r = tn.get(e)), r;
  }, "getWasmTableEntry"), Kn = /* @__PURE__ */ s((e, r, t = [], n = !1) => {
    var o = ht(r), i = o(...t);
    function l(u) {
      return e[0] == "p" ? u >>> 0 : u;
    }
    return s(l, "convert"), l(i);
  }, "dynCall"), Zn = /* @__PURE__ */ s((e, r, t = !1) => (...n) => Kn(e, r, n, t), "getDynCaller"), Jn = /* @__PURE__ */ s((e, r, t = !1) => {
    e = z(e);
    function n() {
      if (e.includes("p"))
        return Zn(e, r, t);
      var i = ht(r);
      return i;
    }
    s(n, "makeDynCaller");
    var o = n();
    return typeof o != "function" && I(`unknown function pointer with signature ${e}: ${r}`), o;
  }, "embind__requireFunction");
  const vr = class vr extends Error {
  };
  s(vr, "UnboundTypeError");
  let ir = vr;
  var gt = /* @__PURE__ */ s((e) => {
    var r = Yt(e), t = z(r);
    return te(r), t;
  }, "getTypeName"), Qn = /* @__PURE__ */ s((e, r) => {
    var t = [], n = {};
    function o(i) {
      if (!n[i] && !le[i]) {
        if (Oe[i]) {
          Oe[i].forEach(o);
          return;
        }
        t.push(i), n[i] = !0;
      }
    }
    throw s(o, "visit"), r.forEach(o), new ir(`${e}: ` + t.map(gt).join([", "]));
  }, "throwUnboundTypeError"), ea = /* @__PURE__ */ s((e) => {
    e = e.trim();
    const r = e.indexOf("(");
    return r === -1 ? e : e.slice(0, r);
  }, "getFunctionName");
  function yt(e, r, t, n, o, i, l, u) {
    e >>>= 0, t >>>= 0, n >>>= 0, o >>>= 0, i >>>= 0;
    var f = Gn(r, t);
    e = z(e), e = ea(e), o = Jn(n, o, l), Xn(e, function() {
      Qn(`Cannot call ${e} due to unbound types`, f);
    }, r - 1), at([], f, (v) => {
      var g = [v[0], null].concat(v.slice(1));
      return Yn(e, pt(e, g, null, o, i, l), r - 1), [];
    });
  }
  s(yt, "__embind_register_function");
  var ra = /* @__PURE__ */ s(function(e, r, t, n, o) {
    e >>>= 0, r >>>= 0, t >>>= 0, r = z(r);
    const i = n === 0;
    let l = /* @__PURE__ */ s((f) => f, "fromWireType");
    if (i) {
      var u = 32 - 8 * t;
      l = /* @__PURE__ */ s((f) => f << u >>> u, "fromWireType"), o = l(o);
    }
    X(e, { name: r, fromWireType: l, toWireType: /* @__PURE__ */ s((f, v) => v, "toWireType"), readValueFromPointer: rt(r, t, n !== 0), destructorFunction: null });
  }, "__embind_register_integer");
  function wt(e, r, t) {
    e >>>= 0, t >>>= 0;
    var n = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array], o = n[r];
    function i(l) {
      var u = x[l >>> 2 >>> 0], f = x[l + 4 >>> 2 >>> 0];
      return new o(L.buffer, f, u);
    }
    s(i, "decodeMemoryView"), t = z(t), X(e, { name: t, fromWireType: i, readValueFromPointer: i }, { ignoreDuplicateRegistrations: !0 });
  }
  s(wt, "__embind_register_memory_view");
  var ve = /* @__PURE__ */ s((e, r, t) => Hr(e, K, r, t), "stringToUTF8");
  function bt(e, r) {
    e >>>= 0, r >>>= 0, r = z(r), X(e, { name: r, fromWireType(t) {
      var n = x[t >>> 2 >>> 0], o = t + 4, i;
      return i = rr(o, n, !0), te(t), i;
    }, toWireType(t, n) {
      n instanceof ArrayBuffer && (n = new Uint8Array(n));
      var o, i = typeof n == "string";
      i || ArrayBuffer.isView(n) && n.BYTES_PER_ELEMENT == 1 || I("Cannot pass non-string to std::string"), i ? o = Je(n) : o = n.length;
      var l = ur(4 + o + 1), u = l + 4;
      return x[l >>> 2 >>> 0] = o, i ? ve(n, u, o + 1) : K.set(n, u >>> 0), t !== null && t.push(te, l), l;
    }, readValueFromPointer: je, destructorFunction(t) {
      te(t);
    } });
  }
  s(bt, "__embind_register_std_string");
  var kt = globalThis.TextDecoder ? new TextDecoder("utf-16le") : void 0, ta = /* @__PURE__ */ s((e, r, t) => {
    var n = e >>> 1, o = zr(Pe, n, r / 2, t);
    if (o - n > 16 && kt) return kt.decode(Pe.subarray(n >>> 0, o >>> 0));
    for (var i = "", l = n; l < o; ++l) {
      var u = Pe[l >>> 0];
      i += String.fromCharCode(u);
    }
    return i;
  }, "UTF16ToString"), na = /* @__PURE__ */ s((e, r, t = 2147483647) => {
    if (t < 2) return 0;
    t -= 2;
    for (var n = r, o = t < e.length * 2 ? t / 2 : e.length, i = 0; i < o; ++i) {
      var l = e.charCodeAt(i);
      se[r >>> 1 >>> 0] = l, r += 2;
    }
    return se[r >>> 1 >>> 0] = 0, r - n;
  }, "stringToUTF16"), aa = /* @__PURE__ */ s((e) => e.length * 2, "lengthBytesUTF16"), oa = /* @__PURE__ */ s((e, r, t) => {
    for (var n = "", o = e >>> 2, i = 0; !(i >= r / 4); i++) {
      var l = x[o + i >>> 0];
      if (!l && !t) break;
      n += String.fromCodePoint(l);
    }
    return n;
  }, "UTF32ToString"), ia = /* @__PURE__ */ s((e, r, t = 2147483647) => {
    if (r >>>= 0, t < 4) return 0;
    for (var n = r, o = n + t - 4, i = 0; i < e.length; ++i) {
      var l = e.codePointAt(i);
      if (l > 65535 && i++, M[r >>> 2 >>> 0] = l, r += 4, r + 4 > o) break;
    }
    return M[r >>> 2 >>> 0] = 0, r - n;
  }, "stringToUTF32"), sa = /* @__PURE__ */ s((e) => {
    for (var r = 0, t = 0; t < e.length; ++t) {
      var n = e.codePointAt(t);
      n > 65535 && t++, r += 4;
    }
    return r;
  }, "lengthBytesUTF32");
  function Et(e, r, t) {
    e >>>= 0, r >>>= 0, t >>>= 0, t = z(t);
    var n, o, i;
    r === 2 ? (n = ta, o = na, i = aa) : (n = oa, o = ia, i = sa), X(e, { name: t, fromWireType: /* @__PURE__ */ s((l) => {
      var u = x[l >>> 2 >>> 0], f = n(l + 4, u * r, !0);
      return te(l), f;
    }, "fromWireType"), toWireType: /* @__PURE__ */ s((l, u) => {
      typeof u != "string" && I(`Cannot pass non-string to C++ string type ${t}`);
      var f = i(u), v = ur(4 + f + r);
      return x[v >>> 2 >>> 0] = f / r, o(u, v + 4, f + r), l !== null && l.push(te, v), v;
    }, "toWireType"), readValueFromPointer: je, destructorFunction(l) {
      te(l);
    } });
  }
  s(Et, "__embind_register_std_wstring");
  var la = /* @__PURE__ */ s(function(e, r) {
    e >>>= 0, r >>>= 0, r = z(r), X(e, { isVoid: !0, name: r, fromWireType: /* @__PURE__ */ s(() => {
    }, "fromWireType"), toWireType: /* @__PURE__ */ s((t, n) => {
    }, "toWireType") });
  }, "__embind_register_void");
  function xt(e, r) {
    e >>>= 0, r >>>= 0, e = $.toValue(e), r = $.toValue(r), e.set(r);
  }
  s(xt, "__emval_array_to_memory_view");
  var sr = [], ca = /* @__PURE__ */ s((e) => {
    var r = sr.length;
    return sr.push(e), r;
  }, "emval_addMethodCaller"), ua = /* @__PURE__ */ s((e, r) => {
    var t = le[e];
    return t === void 0 && I(`${r} has unknown type ${gt(e)}`), t;
  }, "requireRegisteredType"), fa = /* @__PURE__ */ s((e, r) => {
    for (var t = new Array(e), n = 0; n < e; ++n)
      t[n] = ua(x[r + n * 4 >>> 2 >>> 0], `parameter ${n}`);
    return t;
  }, "emval_lookupTypes"), da = /* @__PURE__ */ s((e, r, t) => {
    var n = [], o = e(n, t);
    return n.length && (x[r >>> 2 >>> 0] = $.toHandle(n)), o;
  }, "emval_returnValue"), _a = {}, lr = /* @__PURE__ */ s((e) => {
    var r = _a[e];
    return r === void 0 ? z(e) : r;
  }, "getStringOrSymbol"), va = /* @__PURE__ */ s(function(e, r, t) {
    r >>>= 0;
    var n = 8, [o, ...i] = fa(e, r), l = o.toWireType.bind(o), u = i.map((h) => h.readValueFromPointer.bind(h));
    e--;
    var f = { toValue: $.toValue }, v = u.map((h, E) => {
      var S = `argFromPtr${E}`;
      return f[S] = h, `${S}(args${E ? "+" + E * n : ""})`;
    }), g;
    switch (t) {
      case 0:
        g = "toValue(handle)";
        break;
      case 2:
        g = "new (toValue(handle))";
        break;
      case 3:
        g = "";
        break;
      case 1:
        f.getStringOrSymbol = lr, g = "toValue(handle)[getStringOrSymbol(methodName)]";
        break;
    }
    g += `(${v})`, o.isVoid || (f.toReturnWire = l, f.emval_returnValue = da, g = `return emval_returnValue(toReturnWire, destructorsRef, ${g})`), g = `return function (handle, methodName, destructorsRef, args) {
${g}
}`;
    var k = new Function(Object.keys(f), g)(...Object.values(f)), D = `methodCaller<(${i.map((h) => h.name)}) => ${o.name}>`;
    return ca(ut(D, k));
  }, "__emval_create_invoker");
  function St(e) {
    return e >>>= 0, e ? (e = lr(e), $.toHandle(globalThis[e])) : $.toHandle(globalThis);
  }
  s(St, "__emval_get_global");
  function Ft(e, r) {
    return e >>>= 0, r >>>= 0, e = $.toValue(e), r = $.toValue(r), $.toHandle(e[r]);
  }
  s(Ft, "__emval_get_property");
  function Tt(e) {
    e >>>= 0, e > 9 && (re[e + 1] += 1);
  }
  s(Tt, "__emval_incref");
  function Pt(e, r, t, n, o) {
    return e >>>= 0, r >>>= 0, t >>>= 0, n >>>= 0, o >>>= 0, sr[e](r, t, n, o);
  }
  s(Pt, "__emval_invoke");
  function At(e) {
    return e >>>= 0, e = $.toValue(e), typeof e == "number";
  }
  s(At, "__emval_is_number");
  function Rt(e) {
    return e >>>= 0, e = $.toValue(e), typeof e == "string";
  }
  s(Rt, "__emval_is_string");
  function Dt() {
    return $.toHandle([]);
  }
  s(Dt, "__emval_new_array");
  function Ct(e) {
    return e >>>= 0, $.toHandle(lr(e));
  }
  s(Ct, "__emval_new_cstring");
  function $t() {
    return $.toHandle({});
  }
  s($t, "__emval_new_object");
  function Wt(e) {
    return e >>>= 0, $.toHandle(rr(e));
  }
  s(Wt, "__emval_new_u8string");
  function Mt(e) {
    e >>>= 0;
    var r = $.toValue(e);
    ft(r), Ue(e);
  }
  s(Mt, "__emval_run_destructors");
  function Bt(e, r, t) {
    e >>>= 0, r >>>= 0, t >>>= 0, e = $.toValue(e), r = $.toValue(r), t = $.toValue(t), e[r] = t;
  }
  s(Bt, "__emval_set_property");
  var pa = /* @__PURE__ */ s(() => rn, "getCppExceptionTag"), ma = /* @__PURE__ */ s((e) => {
    var r = e.getArg(pa(), 0);
    return en(r);
  }, "getCppExceptionThrownObjectFromWebAssemblyException"), ha = /* @__PURE__ */ s((e) => {
    var r = ma(e);
    Qt(r);
  }, "incrementExceptionRefcount"), ga = /* @__PURE__ */ s((e) => e instanceof WebAssembly.Exception, "isCppExceptionObject");
  function Ot(e) {
    throw e >>>= 0, e = $.toValue(e), ga(e) && (nn(), ha(e)), e;
  }
  s(Ot, "__emval_throw");
  function Ut(e) {
    return e >>>= 0, e = $.toValue(e), $.toHandle(typeof e);
  }
  s(Ut, "__emval_typeof");
  var ya = /* @__PURE__ */ s(function(e, r, t, n) {
    e >>>= 0, r >>>= 0, t >>>= 0, n >>>= 0;
    var o = (/* @__PURE__ */ new Date()).getFullYear(), i = new Date(o, 0, 1), l = new Date(o, 6, 1), u = i.getTimezoneOffset(), f = l.getTimezoneOffset(), v = Math.max(u, f);
    x[e >>> 2 >>> 0] = v * 60, M[r >>> 2 >>> 0] = +(u != f);
    var g = /* @__PURE__ */ s((h) => {
      var E = h >= 0 ? "-" : "+", S = Math.abs(h), U = String(Math.floor(S / 60)).padStart(2, "0"), N = String(S % 60).padStart(2, "0");
      return `UTC${E}${U}${N}`;
    }, "extractZone"), k = g(u), D = g(f);
    f < u ? (ve(k, t, 17), ve(D, n, 17)) : (ve(k, n, 17), ve(D, t, 17));
  }, "__tzset_js"), wa = /* @__PURE__ */ s(() => performance.now(), "_emscripten_get_now"), ba = /* @__PURE__ */ s(() => Date.now(), "_emscripten_date_now"), ka = /* @__PURE__ */ s((e) => e >= 0 && e <= 3, "checkWasiClock");
  function jt(e, r, t) {
    if (r = Yr(r), t >>>= 0, !ka(e))
      return 28;
    var n;
    e === 0 ? n = ba() : n = wa();
    var o = Math.round(n * 1e6);
    return j[t >>> 3 >>> 0] = BigInt(o), 0;
  }
  s(jt, "_clock_time_get");
  var Nt = /* @__PURE__ */ s(() => 4294901760, "getHeapMax");
  function zt() {
    return Nt();
  }
  s(zt, "_emscripten_get_heap_max");
  var Ea = /* @__PURE__ */ s((e, r) => Math.ceil(e / r) * r, "alignMemory"), xa = /* @__PURE__ */ s((e) => {
    var r = Ne.buffer.byteLength, t = (e - r + 65535) / 65536 | 0;
    try {
      return Ne.grow(t), Ge(), 1;
    } catch {
    }
  }, "growMemory");
  function Ht(e) {
    e >>>= 0;
    var r = K.length, t = Nt();
    if (e > t)
      return !1;
    for (var n = 1; n <= 4; n *= 2) {
      var o = r * (1 + 0.2 / n);
      o = Math.min(o, e + 100663296);
      var i = Math.min(t, Ea(Math.max(e, o), 65536)), l = xa(i);
      if (l)
        return !0;
    }
    return !1;
  }
  s(Ht, "_emscripten_resize_heap");
  var cr = {}, Sa = /* @__PURE__ */ s(() => y, "getExecutableName"), Ae = /* @__PURE__ */ s(() => {
    if (!Ae.strings) {
      var e = (globalThis.navigator?.language ?? "C").replace("-", "_") + ".UTF-8", r = { USER: "web_user", LOGNAME: "web_user", PATH: "/", PWD: "/", HOME: "/home/web_user", LANG: e, _: Sa() };
      for (var t in cr)
        cr[t] === void 0 ? delete r[t] : r[t] = cr[t];
      var n = [];
      for (var t in r)
        n.push(`${t}=${r[t]}`);
      Ae.strings = n;
    }
    return Ae.strings;
  }, "getEnvStrings");
  function Vt(e, r) {
    e >>>= 0, r >>>= 0;
    var t = 0, n = 0;
    for (var o of Ae()) {
      var i = r + t;
      x[e + n >>> 2 >>> 0] = i, t += ve(o, i, 1 / 0) + 1, n += 4;
    }
    return 0;
  }
  s(Vt, "_environ_get");
  function Lt(e, r) {
    e >>>= 0, r >>>= 0;
    var t = Ae();
    x[e >>> 2 >>> 0] = t.length;
    var n = 0;
    for (var o of t)
      n += Je(o) + 1;
    return x[r >>> 2 >>> 0] = n, 0;
  }
  s(Lt, "_environ_sizes_get");
  var Fa = 0, Ta = /* @__PURE__ */ s(() => Ur || Fa > 0, "keepRuntimeAlive"), Pa = /* @__PURE__ */ s((e) => {
    Ta() || (c.onExit?.(e), Xe = !0), P(e, new Ke(e));
  }, "_proc_exit"), Aa = /* @__PURE__ */ s((e, r) => {
    Pa(e);
  }, "exitJS"), Ra = Aa;
  function It(e) {
    try {
      var r = O.getStreamFromFD(e);
      return a.close(r), 0;
    } catch (t) {
      if (typeof a > "u" || t.name !== "ErrnoError") throw t;
      return t.errno;
    }
  }
  s(It, "_fd_close");
  var Da = /* @__PURE__ */ s((e, r, t, n) => {
    for (var o = 0, i = 0; i < t; i++) {
      var l = x[r >>> 2 >>> 0], u = x[r + 4 >>> 2 >>> 0];
      r += 8;
      try {
        var f = a.read(e, L, l, u, n);
      } catch (v) {
        if (o > 0 && v instanceof a.ErrnoError && (v.errno == 6 || v.errno == 6))
          break;
        throw v;
      }
      if (f < 0) return -1;
      if (o += f, f < u) break;
      typeof n < "u" && (n += f);
    }
    return o;
  }, "doReadv");
  function qt(e, r, t, n) {
    r >>>= 0, t >>>= 0, n >>>= 0;
    try {
      var o = O.getStreamFromFD(e), i = Da(o, r, t);
      return x[n >>> 2 >>> 0] = i, 0;
    } catch (l) {
      if (typeof a > "u" || l.name !== "ErrnoError") throw l;
      return l.errno;
    }
  }
  s(qt, "_fd_read");
  function Xt(e, r, t, n) {
    r = Yr(r), n >>>= 0;
    try {
      if (isNaN(r)) return 22;
      var o = O.getStreamFromFD(e);
      return a.llseek(o, r, t), j[n >>> 3 >>> 0] = BigInt(o.position), o.getdents && !r && t === 0 && (o.getdents = null), 0;
    } catch (i) {
      if (typeof a > "u" || i.name !== "ErrnoError") throw i;
      return i.errno;
    }
  }
  s(Xt, "_fd_seek");
  var Ca = /* @__PURE__ */ s((e, r, t, n) => {
    if (t == 1)
      return a.write(e, L, x[r >>> 2 >>> 0], x[r + 4 >>> 2 >>> 0], n);
    for (var o = 0, i = 0, l = r; i < t; i++, l += 8)
      o += x[l + 4 >>> 2 >>> 0];
    for (var u = new Uint8Array(o), f = 0, i = 0; i < t; i++, r += 8) {
      var v = x[r >>> 2 >>> 0], g = x[r + 4 >>> 2 >>> 0];
      u.set(K.subarray(v >>> 0, v + g >>> 0), f), f += g;
    }
    return a.write(e, u, 0, o, n);
  }, "doWritev");
  function Gt(e, r, t, n) {
    r >>>= 0, t >>>= 0, n >>>= 0;
    try {
      var o = O.getStreamFromFD(e), i = Ca(o, r, t);
      return x[n >>> 2 >>> 0] = i, 0;
    } catch (l) {
      if (typeof a > "u" || l.name !== "ErrnoError") throw l;
      return l.errno;
    }
  }
  s(Gt, "_fd_write"), a.createPreloadedFile = On, a.preloadFile = Xr, a.staticInit();
  {
    c.noExitRuntime && (Ur = c.noExitRuntime), c.print && (Me = c.print), c.printErr && (ee = c.printErr), c.arguments && c.arguments, c.thisProgram && (y = c.thisProgram);
    var pe = c.preInit;
    if (pe)
      for (typeof pe == "function" && (c.preInit = pe = [pe]); pe.length > 0; )
        pe.shift()();
  }
  c.stackSave = dt, c.stackRestore = _t, c.FS = a;
  var Yt, ur, te, Kt, Zt, Jt, Qt, en, rn, Ne, tn, nn;
  function an(e) {
    Yt = e.U, ur = e.X, te = e.Y, Kt = e.Z, Zt = e._, Jt = e.$, Qt = e.aa, en = e.ba, nn = e.ca, Ne = e.S, rn = e.V, tn = e.W;
  }
  s(an, "assignWasmExports");
  var $a = { G: Gr, r: Kr, I: Zr, J: Jr, E: Nn, y: zn, P: tt, l: Hn, N: st, x: In, b: yt, p: ra, n: wt, O: bt, s: Et, Q: la, M: xt, e: va, a: Ue, m: St, j: Ft, k: Tt, d: Pt, o: At, w: Rt, g: Dt, f: Ct, i: $t, L: Wt, c: Mt, h: Bt, R: Ot, q: Ut, B: ya, C: jt, K: zt, D: Ht, z: Vt, A: Lt, v: Ra, t: It, H: qt, F: Xt, u: Gt };
  function on(e) {
    e = Object.assign({}, e);
    var r = /* @__PURE__ */ s((n) => (o) => n(o) >>> 0, "makeWrapper_pp"), t = /* @__PURE__ */ s((n) => () => n() >>> 0, "makeWrapper_p");
    return e.U = r(e.U), e.X = r(e.X), e._emscripten_stack_alloc = r(e._emscripten_stack_alloc), e.$ = t(e.$), e.ba = r(e.ba), e;
  }
  s(on, "applySignatureConversions");
  async function sn() {
    Sr(), ie && await Cn();
    var e = c.setStatus;
    e && (e("Running..."), await new Promise((r) => setTimeout(r, 1)), setTimeout(e, 1, "")), !Xe && (Fr(), c.onRuntimeInitialized?.(), Tr());
  }
  s(sn, "run");
  var ce;
  return ce = await Wr(), await sn(), c;
}
s(un, "createSmlib");
var za = un, Ha = {
  // primitives (SmPyPrimitives.cpp)
  create_box: ["origin", "length", "width", "height"],
  create_sphere: ["origin", "radius"],
  create_cone: ["origin", "radius_base", "radius_top", "height"],
  create_cylinder: ["origin", "radius", "height"],
  create_torus: ["origin", "radius_major", "radius_minor"],
  create_partial_cylinder: ["origin", "radius", "height", "start_angle_deg", "end_angle_deg"],
  create_partial_cone: ["origin", "radius_base", "radius_top", "height", "start_angle_deg", "end_angle_deg"],
  create_partial_sphere: ["origin", "radius", "start_angle_deg", "end_angle_deg"],
  create_skin_primitive: ["curves_per_profile", "curves", ["degree", 1], ["cap_ends", !0]],
  // curves (SmPyCurves.cpp)
  create_line_segment: ["start", "end"],
  create_circle: ["center", "radius"],
  create_ellipse: ["origin", "radius1", "radius2"],
  create_helix: ["origin", "height", "radius_start", "radius_end", "turns", ["right_handed", !0], ["tolerance", 1e-4]],
  create_rectangle: ["center", "length", "width"],
  remove_curve_knots: ["curve"],
  make_curves_compatible: ["curves"],
  create_canonical_curve: [
    "points",
    "knots",
    "knot_multiplicities",
    ["weights", null],
    ["degree", 3],
    [
      "form",
      6
      /* BSplineCurveForm_UNSPECIFIED */
    ]
  ],
  // surfaces (SmPySurfaces.cpp)
  create_surface_from_points: ["control_points", "rows", "cols"],
  create_surface_from_ordered_points: ["points", "rows", "cols"],
  create_ruled_surface: ["curve1", "curve2"],
  create_skin_surface: ["profiles"],
  create_planar_faces: ["curves"],
  // booleans (SmPyBooleans.cpp)
  boolean: ["brep1", "brep2", "operation"],
  boolean_with_options: [
    "brep1",
    "brep2",
    "operation",
    ["cookie_cutter", !1],
    ["imprinting", !1],
    ["post_process", !0],
    ["imprint_and_classify", !1],
    ["keep_other_brep", !1]
  ],
  boolean_2d: ["brep1", "brep2", "operation"],
  non_manifold_boolean: ["brep1", "brep2", "operation"],
  // sweeps (SmPySweeps.cpp)
  linear_sweep: ["curves", "direction", "distance", ["cap_ends", !0]],
  rotational_sweep: ["curves", "base_point", "axis", "angle_deg", ["cap_ends", !0]],
  draft_sweep: ["curves", "height", "angle_deg", ["fillet_corners", !1], [
    "cap_ends",
    3
    /* CapEnds_BOTH */
  ]],
  sweep_along_planar_path: ["profile_curves", "path_curves", ["move_profile", !0], [
    "cap_ends",
    3
    /* CapEnds_BOTH */
  ]],
  non_manifold_linear_sweep: [
    "brep_to_sweep",
    "direction",
    "distance",
    ["region_brep", null],
    ["do_stitching", !0],
    ["do_merge", !1],
    ["faces", null],
    ["edges", null],
    ["vertices", null]
  ],
  // fillets (SmPyFillets.cpp); xsect_type 0 linear, 1 circular, 2 blend (not FilletXSect values)
  fillet_edges: ["brep", "edges", "radius", ["xsect_type", 1], ["continuity", 1], ["thumbweight", 1]],
  variable_radius_fillet: ["brep", "edges", "start_radius", "end_radius", ["xsect_type", 1], ["continuity", 1]],
  fillet_edges_per_edge: ["brep", "edges", "radii", "xsect_types", ["continuity", 1], ["thumbweight", 1]],
  fillet_preview: ["brep", "edges", "radius"],
  remove_fillet: ["brep"],
  surface_surface_fillet: [
    "surface1",
    "surface2",
    "radius1",
    "radius2",
    "tolerance",
    ["xsect_type", 1],
    ["mirror", !1],
    ["complement", !1]
  ],
  // offset (SmPyOffset.cpp)
  shell_brep: [
    "brep",
    "distance",
    ["extended_offset", !0],
    ["self_intersection", !0],
    ["create_solid", !0],
    ["faces_to_shell", []]
  ],
  offset_brep: ["brep", "distance", ["extended_offset", !0], ["self_intersection", !0]],
  create_offset_profile: [
    "curves",
    "distance",
    [
      "offset_type",
      3
      /* OffsetType_BOTH */
    ],
    ["round_corners", !0],
    ["shell_result", !1]
  ],
  // io (SmPyFileIo.cpp); ascii null: detect the format
  read_brep_from_file: ["filename", ["ascii", null], ["rebuild_uv_trim_curves", !1]],
  // brep_ops, stitching, heal (SmPyBrepOps.cpp, SmPyStitching.cpp, SmPyHeal.cpp)
  turn_to_nurbs: ["brep"],
  stitch_into_solid: ["brep"],
  stitch_into_shell: ["brep", ["max_stitching_ratio", 1], ["shell_is_well_formed", !1]],
  stitch_advanced: [
    "brep",
    "tolerance_3d",
    ["squeeze_small_edges", !0],
    ["split_edges_with_vertices", !0],
    ["making_manifold_solid", !0],
    ["remove_laminar_slivers", !1]
  ],
  heal_brep: ["brep"],
  // transforms (SmPyTransforms.cpp; Axis2Placement's constructor in SmPyTypes.cpp)
  Axis2Placement: ["origin", "x_axis", "y_axis"],
  rotate: ["target", "ref_point", "axis", "angle_deg"],
  transform: ["target", "placement"],
  // queries (SmPyQueries.cpp)
  brep_closest_point: ["brep", "point"],
  curve_closest_point: ["curve", "point"],
  surface_closest_point: ["surface", "point"],
  brep_relationship: ["a", "b"],
  // intersect (SmPyIntersectors.cpp)
  intersect_breps: ["brep1", "brep2"],
  intersect_brep_with_plane: ["brep", "plane_point", "plane_normal"],
  intersect_curves: ["curve1", "curve2"],
  intersect_curve_face: ["curve", "face"],
  // cutting (SmPyCutProjectTrim.cpp)
  project_brep_onto_plane: ["brep", "plane_point", "plane_normal"],
  create_silhouette_curves: ["brep", "plane_point", "plane_normal"],
  project_curve: ["brep", "curve", "projection_vector"],
  // poly, tessellation (SmPyPolyOps.cpp, SmPyTessellation.cpp)
  poly_boolean: ["poly_brep1", "poly_brep2", "operation"],
  tessellate: [
    "brep",
    ["chord_height_tolerance", 0],
    ["curve_angle_tolerance_deg", 25],
    ["surface_angle_tolerance_deg", 25],
    ["max_edge_length", 0],
    ["max_aspect_ratio", 0],
    ["allow_partial", !1],
    ["return_failures", !1],
    ["return_report", !1]
  ],
  tessellate_boundaries: ["brep", ["angle_tolerance_deg", 5], ["allow_partial", !1]]
}, Va = {
  AnnularSector: [4, ["align"]],
  ArcSlot: [3, ["rotation", "align"]],
  Bezier: [-1, ["weights"]],
  Box: [3, ["align"]],
  Circle: [1, ["align"]],
  Cone: [3, ["arcSize", "align"]],
  Cylinder: [2, ["arcSize", "align"]],
  "Edge.continuity": [1, ["angleTolerance", "curvatureTolerance"]],
  "Edge.extend": [1, ["end", "continuity"]],
  "Edge.intersectionParams": [1, ["tolerance"]],
  "Edge.intersections": [1, ["tolerance"]],
  "Edge.match": [0, ["start", "end", "startTangent", "endTangent"]],
  "Edge.offset": [1, ["plane"]],
  "Edge.selfIntersections": [0, ["tolerance"]],
  "Edge.through": [1, ["tangent", "at"]],
  Ellipse: [2, ["rotation", "align"]],
  "Face.edges": [0, ["seams"]],
  "Face.extend": [1, ["sides", "continuity"]],
  "Face.extrude": [1, ["both", "taper", "direction", "corners"]],
  "Face.iso": [0, ["u", "v"]],
  "Face.wrap": [2, ["direction"]],
  FilletPolyline: [-1, ["radius", "close"]],
  GridLocations: [4, ["centered"]],
  Helix: [3, ["center", "direction", "endRadius", "leftHanded"]],
  HexLocations: [3, ["centered"]],
  Lattice: [2, ["margin"]],
  "Lattice.apply": [1, ["tolerance"]],
  "Mesh.decimate": [1, ["triangles", "tolerance", "featureAngle"]],
  "Part.bend": [1, ["radius", "plane", "start", "end", "tolerance"]],
  "Part.bends": [0, ["kFactor"]],
  "Part.chamfer": [2, ["length2", "angle", "reference", "propagate", "corners"]],
  "Part.deform": [1, ["tolerance"]],
  "Part.draftAnalysis": [1, ["minAngle"]],
  "Part.fillet": [2, ["continuity", "fullness", "propagate", "corners", "setback"]],
  "Part.filletPreview": [2, ["propagate"]],
  "Part.flange": [2, ["angle", "radius", "kFactor"]],
  "Part.flatPattern": [0, ["kFactor", "fixed"]],
  "Part.flatten": [3, ["continuity"]],
  "Part.fold": [2, ["radius", "kFactor", "fixed", "partial"]],
  "Part.imprint": [2, ["nearest"]],
  "Part.isValid": [0, ["strict"]],
  "Part.offset": [1, ["corners"]],
  "Part.push": [2, ["by", "to", "normal", "radius", "continuity"]],
  "Part.removeFaces": [1, ["partial"]],
  "Part.removeFillets": [1, ["maxRadius", "partial"]],
  "Part.shell": [2, ["outward", "corners", "walls"]],
  "Part.taper": [1, ["axis", "start", "end", "tolerance"]],
  "Part.twist": [1, ["axis", "start", "end", "tolerance"]],
  "Part.unfold": [0, ["kFactor", "fixed"]],
  "Part.unroll": [0, ["radius", "axis", "start", "tolerance"]],
  "Part.warp": [3, ["continuity"]],
  PolarLocations: [2, ["startAngle", "angularRange", "rotate"]],
  Polygon: [-1, ["fillet", "chamfer", "align"]],
  Polyline: [-1, ["close"]],
  Profile: [1, ["heading"]],
  "Profile.arcTo": [-1, ["through"]],
  "Profile.close": [0, ["align"]],
  "Profile.forward": [1, ["x", "y"]],
  "Profile.lineTo": [-1, ["x", "y"]],
  Pyramid: [3, ["align"]],
  Rectangle: [2, ["fillet", "chamfer", "rotation", "align"]],
  RegularPolygon: [2, ["inscribed", "fillet", "chamfer", "rotation", "align"]],
  RoundedRectangle: [3, ["align"]],
  "Shape.mesh": [2, ["maxEdge"]],
  "Shape.show": [0, ["title", "path", "openBrowser", "tolerance", "angle", "edges"]],
  "Shell.extend": [1, ["sides", "continuity"]],
  "Shell.flatten": [3, ["continuity"]],
  "Shell.matchEdge": [2, ["extent"]],
  "Shell.push": [2, ["by", "to", "normal", "radius", "continuity"]],
  "Shell.thicken": [1, ["both"]],
  "Shell.warp": [3, ["continuity"]],
  "Sketch.extrude": [1, ["both", "taper", "direction", "corners"]],
  "Sketch.offset": [1, ["corners"]],
  "Sketch.sweep": [1, ["orient", "translational", "sharpCorners", "up", "twist", "scale", "anchor"]],
  Slot: [2, ["rotation", "align"]],
  Sphere: [1, ["arcSize1", "arcSize2", "arcSize3", "align"]],
  Spiral: [4, ["clockwise"]],
  Spline: [-1, ["tangents", "closed"]],
  Stroke: [2, ["ends", "corners"]],
  Text: [2, ["font", "align", "spacing", "lineSpacing", "kerning", "path"]],
  Torus: [2, ["minorStartAngle", "minorEndAngle", "majorAngle", "align"]],
  Trapezoid: [4, ["fillet", "chamfer", "rotation", "align"]],
  Triangle: [2, ["apex", "fillet", "chamfer", "rotation", "align"]],
  Wedge: [4, ["align"]],
  Wire: [1, ["sort"]],
  "Wire.continuity": [0, ["angleTolerance", "curvatureTolerance"]],
  "Wire.intersections": [1, ["tolerance"]],
  "Wire.offset": [1, ["corners", "plane"]],
  "_Body.colored": [1, ["faces"]],
  "_Body.edges": [0, ["seams"]],
  "_Body.named": [1, ["faces"]],
  "_Body.outline": [1, ["hidden", "tangentEdges"]],
  "_Body.project": [2, ["nearest"]],
  bend: [2, ["radius", "plane", "start", "end", "tolerance"]],
  bendAllowance: [1, ["radius", "thickness", "kFactor"]],
  bendDeduction: [1, ["radius", "thickness", "kFactor"]],
  blend: [2, ["continuity", "tension", "join"]],
  deform: [2, ["tolerance"]],
  developedLength: [-1, ["angle", "radius", "thickness", "kFactor"]],
  drawingViews: [2, ["projection", "hidden", "tangentEdges", "gap"]],
  exportDxf: [2, ["unit", "plane", "curves", "tolerance"]],
  exportGlb: [2, ["tolerance", "angle", "edges", "edgeColor", "maxEdge"]],
  exportGltf: [2, ["tolerance", "angle", "edges", "edgeColor", "maxEdge"]],
  exportObj: [2, ["tolerance", "angle", "maxEdge"]],
  exportStep: [2, ["unit", "name", "assembly"]],
  exportStl: [2, ["tolerance", "angle", "ascii", "maxEdge"]],
  exportSvg: [2, ["margin", "stroke"]],
  exportUsd: [2, ["mesh", "tolerance", "angle", "materials", "maxEdge"]],
  extrude: [2, ["both", "taper", "direction", "corners"]],
  fill: [1, ["tangent"]],
  filletPreview: [2, ["propagate"]],
  fitCurve: [1, ["tolerance", "degree", "tangents", "closed"]],
  flange: [3, ["angle", "radius", "kFactor"]],
  flatPattern: [1, ["kFactor", "fixed"]],
  flatten: [4, ["continuity"]],
  fold: [3, ["radius", "kFactor", "fixed", "partial"]],
  fromBrep: [1, ["heal", "check", "strict"]],
  fromDxf: [1, ["layers", "unit", "tolerance"]],
  fromDxfWires: [1, ["layers", "unit", "tolerance"]],
  fromIges: [1, ["heal", "strict"]],
  fromStep: [1, ["heal", "strict"]],
  fromStepModel: [1, ["heal", "strict"]],
  fromUsd: [1, ["heal", "units", "placement", "check", "strict", "resolve"]],
  htmlPage: [-1, ["title", "tolerance", "angle", "edges", "view", "margin"]],
  importBrep: [1, ["heal", "check", "strict"]],
  importDxf: [1, ["layers", "unit", "tolerance"]],
  importDxfWires: [1, ["layers", "unit", "tolerance"]],
  importIges: [1, ["heal", "strict"]],
  importStep: [1, ["heal", "strict"]],
  importUsd: [1, ["heal", "units", "placement", "check", "strict"]],
  imprint: [3, ["nearest"]],
  loft: [1, ["ruled", "smooth", "startTangent", "endTangent", "closed", "rails"]],
  matchEdge: [3, ["extent"]],
  outline: [2, ["hidden", "tangentEdges"]],
  push: [3, ["by", "to", "normal", "radius", "continuity"]],
  readStep: [1, ["heal", "strict"]],
  removeFaces: [2, ["partial"]],
  removeFillets: [2, ["maxRadius", "partial"]],
  render: [-1, ["path", "view", "size", "edges", "background", "tolerance", "zoom", "lookAt", "frame", "supersample", "colors", "lines", "drawing", "sheet", "section", "cap", "highlight", "highlightAt", "markers", "annotate", "xray", "xrayAlpha", "zebra", "curvature"]],
  save: [2, ["ascii"]],
  shell: [3, ["outward", "corners", "walls"]],
  show: [-1, ["title", "path", "openBrowser", "tolerance", "angle", "edges"]],
  stitch: [-1, ["tolerance", "report"]],
  surface: [1, ["interpolate", "controls", "smoothing", "report"]],
  surfaceFillet: [3, ["radius2", "shape", "sides", "trim"]],
  sweep: [2, ["orient", "translational", "sharpCorners", "up", "twist", "scale", "anchor", "rails"]],
  taper: [2, ["axis", "start", "end", "tolerance"]],
  tessellate: [3, ["maxEdge"]],
  thicken: [2, ["both"]],
  toDxf: [1, ["unit", "plane", "curves", "tolerance"]],
  toGlb: [1, ["tolerance", "angle", "edges", "edgeColor", "maxEdge"]],
  toGltf: [1, ["tolerance", "angle", "edges", "edgeColor", "maxEdge"]],
  toObj: [1, ["tolerance", "angle", "maxEdge"]],
  toSmb: [1, ["ascii"]],
  toSmp: [1, ["ascii"]],
  toStep: [1, ["unit", "name", "assembly"]],
  toStl: [1, ["tolerance", "angle", "ascii", "maxEdge"]],
  toSvg: [1, ["margin", "stroke"]],
  toUsd: [1, ["mesh", "tolerance", "angle", "materials", "maxEdge"]],
  twist: [2, ["axis", "start", "end", "tolerance"]],
  unfold: [1, ["kFactor", "fixed"]],
  unroll: [1, ["radius", "axis", "start", "tolerance"]],
  warp: [4, ["continuity"]]
}, Fe = await cn(za);
Fe.init();
var fn = {
  "ext.curve_data": ["curve", ["nurbs", !0]],
  "ext.surface_data": ["surface", ["nurbs", !0]],
  "ext.brep_dump": ["brep", ["geometry", !0]],
  "ext.seam_edges": ["brep"],
  "ext.face_indices": ["brep", "faces"],
  "ext.edge_indices": ["brep", "edges"],
  "ext.vertex_indices": ["brep", "vertices"],
  "ext.copy_with_map": ["brep", ["faces", []], ["edges", []], ["vertices", []]],
  "ext.transform_brep": ["brep", "matrix"],
  "ext.boolean": ["brep1", "brep2", "operation", ["non_manifold", !1], ["imprinting", !1]],
  "ext.classify_points": ["brep", "points", ["tolerance", 0]],
  "ext.edge_angles": ["brep", "edges"],
  "ext.nearest_points": ["a", "b", "near_a"],
  "ext.nearest_curve_points": ["body", "curve", "t0", "t1", "near_t"],
  "ext.face_curvature": ["face", "u", "v"],
  "ext.face_min_radius": ["face", ["grid", 24]],
  "ext.face_iso_curves": ["face", "constant_u", "value"],
  "ext.edge_continuity": ["edge", ["samples", 16]],
  "ext.edge_outer_angles": ["brep", "edges", ["samples", 5]],
  "ext.copy_faces": ["brep", "faces"],
  "ext.remove_slivers": ["brep", "faces", "tolerance"],
  "ext.analytic_revolutions": ["brep"],
  "ext.exact_circles": ["brep"],
  "ext.oriented_sweep": ["profile", "path", "params", "x_axes", ["cap_ends", !0], ["scales", null]],
  "ext.skin": [
    "curves",
    "counts",
    ["degree", 3],
    ["start_tangent", []],
    ["end_tangent", []],
    ["closed", !1],
    ["cap_ends", !0],
    ["start_face", null],
    ["end_face", null]
  ],
  "ext.gordon": ["u_curves", "v_params", "v_curves", "u_params"],
  "ext.helix_axis": ["curves", ["tolerance", 1e-5]],
  "ext.swung": ["profile", "outline", "scale"],
  "ext.face_from_surface": ["surface"],
  "ext.combine": ["breps"],
  "ext.separate_bodies": ["brep"],
  "ext.delete_brep": ["brep"],
  "ext.delete_curve": ["curve"],
  "ext.delete_surface": ["surface"],
  "ext.delete_polybrep": ["poly"],
  "ext.copy_curve": ["curve"],
  "ext.trimmed_curve": ["curve", "t0", "t1"],
  "ext.join_curves": ["curves"],
  "ext.intersect_curves": ["a", "a0", "a1", "b", "b0", "b1", "tolerance"],
  "ext.self_intersections": ["curve", "t0", "t1", "tolerance"],
  "ext.intersect_curve_faces": ["curve", "t0", "t1", "faces", "tolerance"],
  "ext.extend_curve": ["curve", "distance", "at_start", ["continuity", 1]],
  "ext.offset_curve": ["curve", "normal", "distance", "tolerance"],
  "ext.approximate_points": [
    "points",
    ["degree", 3],
    ["tolerance", 0],
    ["start_tangent", null],
    ["end_tangent", null],
    ["closed", !1]
  ],
  "ext.interpolate_tangents": ["points", "tangents", ["degree", 3]],
  "ext.approximate_tangents": ["points", "tangents", "tolerance"],
  "ext.curve_geometry": ["curve", "t"],
  "ext.curve_properties": ["curve", "t0", "t1", "kind", ["value", 0], ["tolerance", 1e-9]],
  "ext.curve_box": ["curve", "t0", "t1"],
  "ext.lines_and_arcs": ["curve", "tolerance"],
  "ext.refine_curve": ["curve", "degree", ["knots", []]],
  "ext.deform_ends": ["curve", ["start", null], ["end", null], ["start_tangent", null], ["end_tangent", null]],
  "ext.project_curve": ["faces", "curve", "direction", "tolerance", ["distance", 0]],
  "ext.normal_project": ["faces", "curve", "tolerance"],
  "ext.trim_to_face": ["face", "curves", "tolerance"],
  "ext.iso_curves": ["face", "along_v", "value", "tolerance"],
  "ext.ellipse_arc": ["ellipse", "start", "end"],
  "ext.edge_curve": ["edge"],
  "ext.reverse_curve": ["curve"],
  "ext.approximate_curve": ["curve", ["tolerance", 1e-7]],
  "ext.offset_curve_3d": ["curve", "distance", "normal", ["tolerance", 1e-7]],
  "ext.face_properties": ["face", ["accuracy", 1e-8]],
  "ext.brep_properties": ["brep", ["accuracy", 1e-8], ["density", 1]],
  "ext.curve_eval": ["curve", "t", ["derivatives", 1]],
  "ext.curve_sweep": [
    "profile",
    "path",
    ["cap_ends", !0],
    ["center", !0],
    ["orient", !1],
    ["translational", !1],
    ["scale_reference", null],
    ["scale_curve", null],
    ["reference", []]
  ],
  "ext.planar_path_sweep": ["profile", "path", ["reference", []]],
  "ext.curve_kind": ["curve"],
  "ext.surface_kind": ["surface"],
  "ext.object_class": ["object"],
  "ext.build_brep": ["faces", "edges", "solid", ["reversed", !1], ["mirrored", !1], ["voids", []]],
  "ext.surface_face": ["surface", ["domain", null]],
  "ext.curve_on_surface": ["surface", "uv", "tolerance"],
  "ext.inverted_faces": ["brep"],
  "ext.loop_areas": ["brep"],
  "ext.drop_caches": ["brep"],
  "ext.set_deadline": ["seconds"],
  "ext.seam_problems": ["brep", ["fix", !1], ["only", null]],
  "ext.poly_face_indices": ["poly", "brep"],
  "ext.surface_derivatives": ["surface", "uv"],
  "ext.face_curvatures": ["face", "uv"],
  "ext.poly_curvatures": ["poly"],
  "ext.brep_measure": ["brep", ["tolerance", 1e-9]],
  "ext.fit_surface": ["points", ["nu", 0], ["nv", 0], ["smoothing", 1e-3]],
  "ext.poly_from_triangles": ["vertices", "triangles"],
  "ext.triangulate_poly": ["poly"],
  "ext.region_shells": ["brep"],
  "ext.seam_contacts": ["a", "b", ["tolerance", 0]],
  "ext.seam_touches": ["a", "b", ["tolerance", 0]],
  "ext.tag_topology": ["brep", ["fresh", !1]],
  "ext.topology_tags": ["brep"],
  "ext.set_topology_tags": ["brep", "faces", "edges"],
  "ext.add_face_tags": ["brep", "faces", "tags"],
  "ext.untag_topology": ["brep"],
  "ext.check_brep": ["brep", ["level", 2]],
  "ext.tolerance_gaps": ["brep"],
  "ext.update_tolerances": ["brep"],
  "ext.edge_tolerance": ["edge"],
  "ext.vertex_tolerance": ["vertex"],
  "ext.slice": ["brep", "sheet", ["below", !1]],
  "ext.extended_sheet": ["face", "distance"],
  "ext.set_face_colors": ["brep", "faces", "colors"],
  "ext.set_face_names": ["brep", "faces", "names"],
  "ext.face_attr": ["face"],
  "ext.face_attrs": ["brep"],
  "ext.recognize_analytics": ["brep", "tolerance"],
  "ext.planar_faces": ["brep", "tolerance"],
  "ext.brep_shells": ["brep"],
  "ext.void_shells": ["brep"],
  "ext.edge_blend": ["face1", "edge1", "face2", "edge2", ["continuity", 2], ["tension1", 1], ["tension2", 1]],
  "ext.trim_with_curves": ["brep", "curves", "point", "trim_type", "tolerance"],
  "ext.stitch_faces": ["brep", "tolerance"],
  "ext.flip_faces": ["brep"],
  "ext.extend_face": ["face", "distance", "edges", ["continuity", 0]],
  "ext.untrim_face": ["face"],
  "ext.fill_loop": ["curves", "faces", "edges", "tolerance"],
  "ext.network_surface": ["u", "v", "tolerance"],
  "ext.push_face": ["brep", "face", "at", "by", "normal", "radius", ["continuity", 1], ["shrink", !1]],
  "ext.warp_face": ["brep", "face", "region", "by", ["continuity", 2]],
  "ext.flatten_face": ["brep", "face", "region", "origin", "normal", ["continuity", 2]],
  "ext.match_edge": ["brep", "edge", "curve", ["extent", 0.25]],
  "ext.merge_faces": ["face_a", "face_b"],
  "ext.nurbs_surface": ["u_degree", "v_degree", "nu", "nv", "poles", "u_knots", "v_knots", "weights"],
  "ext.surface_distances": ["surface", "points"],
  "ext.nearest_point": ["brep", "point", ["face", null]],
  "ext.plane_section": ["brep", "point", "normal", "tolerance"],
  "ext.usd_text": ["items", ["up_axis", "Z"], ["meters_per_unit", 1e-3], ["materials", !1]],
  "ext.usd_read": ["text", ["heal", !1]],
  "ext.usd_assets": ["text"],
  "ext.usd_stage": ["layers", ["heal", !1], ["check", !0], ["placement", !0], ["units", 0], ["partial", !1]],
  "ext.part_bytes": ["items", ["ascii", !0]],
  "ext.part_items": ["data"],
  "ext.occt_read": ["data", ["heal", !1], ["check", !0]],
  "ext.occt_text": ["breps"],
  "ext.face_measure": ["face", ["tolerance", 1e-9]],
  "ext.curve_length": ["curve", "t0", "t1", ["tolerance", 1e-12]],
  "ext.curve_parameter_at_length": ["curve", "t_start", "length", ["tolerance", 1e-12]],
  // (SmTessellationDefaults: no chord height, 25 degrees, no edge length, no aspect ratio)
  "ext.tessellate": [
    "brep",
    ["chord_height_tolerance", 0],
    ["curve_angle_tolerance_deg", 25],
    ["surface_angle_tolerance_deg", 25],
    ["max_edge_length", 0],
    ["max_aspect_ratio", 0],
    ["algorithm", "auto"],
    ["allow_partial", !1],
    ["return_failures", !1],
    ["return_report", !1]
  ],
  "ext.tessellation_algorithm": [
    "brep",
    "chord_height_tolerance",
    ["surface_angle_tolerance_deg", 25],
    ["max_edge_length", 0],
    ["max_aspect_ratio", 0]
  ],
  "ext.grid_deviation": ["face", "chord_height_tolerance", ["surface_angle_tolerance_deg", 25], ["max_edge_length", 0]],
  "ext.round_edges": [
    "brep",
    "edges",
    "radii",
    "sections",
    ["radii2", []],
    ["faces", []],
    ["law", []],
    ["continuity", 1],
    ["thumbweight", 1],
    ["tolerance_factor", 4],
    ["mitre", !1],
    ["chains", []],
    ["law_at", []],
    ["law_radii", []],
    ["setback", 0]
  ],
  "ext.poly_arrays": ["poly", ["face_varying_normals", !1], ["brep", null]],
  "ext.mesh_first_hits": ["vertices", "triangles", "origins", "directions"],
  "ext.body_first_hits": ["brep", "vertices", "triangles", "owners", "origins", "directions", "tolerance", "mesh_tolerance"],
  "ext.hidden_lines": ["brep", "plane_point", "plane_normal", ["seams", !1], ["smooth_edges", !1]],
  "ext.mesh_nearest_points": ["vertices", "triangles", "points"],
  "ext.crease_normals": ["vertices", "triangles", "crease_angle"],
  "ext.decimate_triangles": ["vertices", "triangles", "fraction", ["feature_angle", 30], ["keep_boundary", !0]],
  "ext.repair_triangles": ["vertices", "triangles", ["clean", !0], ["fill", !0]],
  "ext.brep_from_triangles": ["vertices", "triangles", ["merge_coplanar", !0], ["max_faces", 0]],
  "sheetmetal.bend": ["brep", "angle", "radius", "k_factor", "thickness", "axis_point", "axis", "direction", "length"],
  "sheetmetal.unbend": [
    "brep",
    "angle",
    "radius",
    "k_factor",
    "thickness",
    "axis_point",
    "axis",
    "direction",
    "length",
    ["anchor", null]
  ],
  "deform.deform_brep": ["brep", "spec"],
  "deform.deform_curve": ["curve", "spec"],
  "deform.composite_brep": ["brep", "spec"],
  "deform.deviation": ["source", "result", "spec", ["samples", 9]],
  "deform.map_points": ["spec", "points"],
  "defeature.blend_info": ["face", ["tangency_deg", 2]],
  "defeature.remove_fillet_faces": ["brep", "faces", ["tolerance", -1]],
  "defeature.defeature": ["brep", "groups", ["rebuild", "extend"]],
  "draft.face_draft_range": ["face", "direction", ["grid", 12]],
  "draft.split_at_silhouettes": ["brep", "direction", "tolerance", "faces"],
  "face_draft.draft_faces": ["brep", "faces", "origin", "normal", "angle", ["tangency_deg", 1]],
  "face_edit.edit_faces": ["brep", "faces", ["matrices", []], ["distances", []], ["grow", !1], ["tangency_deg", 1]],
  // Breps, faces, edges, curves, surfaces, meshes (SmPyLib's methods; the defaults are its own)
  brep_bounding_box: ["brep", ["tight", !1]],
  brep_write_to_file: ["brep", "filename", ["ascii", !0]],
  face_bounding_box: ["face", ["tight", !1]],
  edge_bounding_box: ["edge", ["tight", !1]],
  curve_length: ["curve", ["desired_accuracy", 1e-6]],
  curve_is_closed: ["curve", ["tolerance", 0]],
  curve_is_planar: ["curve", ["tolerance", 1e-12]],
  surface_is_planar: ["surface", ["tolerance", 1e-12]],
  poly_mesh: ["poly", ["face_varying_normals", !1]]
}, J = dn(Fe, { ...Ha, ...fn }), io = fn, we = J.ext, La = JSON.parse(Fe.smpylib__table()), Ia = JSON.parse(Fe.smpylib__enums()), qa = {
  Object: "object",
  Brep: "brep",
  Face: "face",
  Edge: "edge",
  Vertex: "vertex",
  Curve: "curve",
  BSplineCurve: "bspline_curve",
  Line: "line",
  Circle: "circle",
  Surface: "surface",
  PolyBrep: "poly",
  PolyVertex: "poly_vertex",
  PolyEdge: "poly_edge",
  PolyFace: "poly_face"
}, ze = {};
{
  const d = J.smpylib = {}, c = La.map((_, m) => [_, m]);
  for (const [[_, m], p] of [...c.filter(([[w]]) => !w.includes(".")), ...c.filter(([[w]]) => w.includes("."))]) {
    const w = _.indexOf("."), y = w > 0 ? _.slice(0, w) : null, P = y === null ? "" : `${qa[y] ?? y.replace(/(?<=[a-z])(?=[A-Z])/g, "_").toLowerCase()}_`, C = m.map((T) => T === "self" ? P.slice(0, -1) : T), R = y === null ? _ : `${P}${_.slice(w + 1)}`;
    ze[R] ?? (ze[R] = C);
    const F = Ie(R, Le(Fe, (...T) => Fe.smpylib__call(p, T), R), C);
    y === null ? d[_] = F : (d[y] ?? (d[y] = {}))[_.slice(w + 1)] = F, R in J || (J[R] = F);
  }
  for (const [_, m] of Object.entries(Ia))
    J[_] ?? (J[_] = { ...m });
}
function Xa() {
  return ze;
}
s(Xa, "_smpylibSignatures");
function dn(d, c) {
  var m;
  const _ = {};
  for (const p of Object.keys(d)) {
    if (p.startsWith("smpylib__"))
      continue;
    const w = d[p], y = p.indexOf("__");
    if (y > 0 && typeof w == "function") {
      const [F, T] = [p.slice(0, y), p.slice(y + 2)], Y = c[`${F}.${T}`], Q = Le(d, w, `${F}.${T}`);
      (_[F] ?? (_[F] = {}))[T] = Y ? Ie(`${F}.${T}`, Q, Y) : Q;
      continue;
    }
    const P = /^([A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*)_([A-Z][A-Z0-9_]*)$/.exec(p);
    if (P && typeof w == "number") {
      (_[m = P[1]] ?? (_[m] = {}))[P[2]] = w;
      continue;
    }
    if (typeof w != "function") {
      _[p] = w;
      continue;
    }
    const C = c[p], R = Le(d, w, p);
    _[p] = C ? Ie(p, R, C) : R;
  }
  return _;
}
s(dn, "namespaced");
function Le(d, c, _) {
  return (...m) => {
    const p = d.stackSave();
    try {
      return c(...m);
    } catch (w) {
      throw d.stackRestore(p), Te(w) && _n(_, w), pn(d, w);
    }
  };
}
s(Le, "restoring");
function _n(d, c) {
  ne.count++, ne.last = c.message, vn = d, He || (He = !0, queueMicrotask(() => {
    He = !1;
  })), ne.count === 1 && ne.next !== null && En(`the kernel crashed in ${d} (${c.message}), and its memory may be damaged: ${ne.next}`);
}
s(_n, "_crashed");
var He = !1, vn = "kernel";
function Ga(d) {
  if (He)
    return !0;
  let c = d;
  for (let _ = 0; c !== null && typeof c == "object" && _ < 16; _++) {
    if (Te(c))
      return !0;
    c = c.cause;
  }
  return !1;
}
s(Ga, "_isCrash");
function Ya(d) {
  if (!Te(d))
    return d;
  try {
    return yn(vn, () => {
      throw d;
    });
  } catch (c) {
    return c;
  }
}
s(Ya, "_crashOf");
function pn(d, c) {
  const _ = typeof WebAssembly > "u" ? void 0 : WebAssembly.Exception;
  if (typeof _ != "function" || !(c instanceof _))
    return c;
  const m = d.stackSave();
  let p = null;
  try {
    p = d.runtime__exception_info(() => {
      throw c;
    });
  } catch {
    return c;
  } finally {
    d.stackRestore(m);
  }
  if (p === null)
    return c;
  const [w, y] = p;
  return w === "memory" ? new Error(`SM_ERR_OUT_OF_MEMORY: the kernel ran out of memory (${y})`) : w === "value" ? new RangeError(y) : new Error(y);
}
s(pn, "_cppError");
function gr(d) {
  if (d === null || typeof d != "object")
    return !1;
  const c = Object.getPrototypeOf(d);
  return c === null || Object.getPrototypeOf(c) === null && Object.prototype.toString.call(d) === "[object Object]";
}
s(gr, "isPlainObject");
function Ie(d, c, _) {
  const m = _.map((y) => typeof y == "string" ? y : y[0]), p = /* @__PURE__ */ s((y) => typeof _[y] == "string", "required"), w = /* @__PURE__ */ s((y) => _[y][1], "fallback");
  return (...y) => {
    let P = y, C = null;
    const R = y[y.length - 1];
    if (y.length > 0 && gr(R)) {
      const T = Object.keys(R), Y = y.length - 1;
      T.length > 0 && T.every((Q) => m.indexOf(Q) >= Y) && (C = R, P = y.slice(0, -1));
    }
    if (P.length >= m.length && !C)
      return c(...P);
    if (P.length > m.length)
      throw new TypeError(`${d}: takes ${m.length} arguments, got ${P.length}`);
    const F = P.slice();
    for (let T = P.length; T < m.length; T++)
      if (C && m[T] in C)
        F.push(C[m[T]]);
      else if (!p(T))
        F.push(w(T));
      else
        throw new TypeError(`${d}: missing argument ${m[T]}`);
    return c(...F);
  };
}
s(Ie, "keywords");
var Ka = /(SM_[A-Z0-9_]+)/;
function mn(d) {
  return d instanceof Ba || Te(d) ? !0 : !(d instanceof Error) || Object.getPrototypeOf(d) !== Error.prototype ? !1 : d.name === "Error" || d.name.endsWith("Error") && !["TypeError", "RangeError", "ReferenceError", "SyntaxError", "BindingError", "InternalError"].includes(d.name);
}
s(mn, "_isRuntimeError");
function Te(d) {
  return typeof WebAssembly < "u" && d instanceof WebAssembly.RuntimeError;
}
s(Te, "_isTrap");
var Ve = "SM_ERR_OUT_OF_MEMORY", hn = 2 ** 20;
function gn(d, c) {
  return c !== null && (c.failed || c.limit - c.heap < 64 * hn) ? `${Ve}: the kernel crashed when it ran out of memory (${d})` : `the kernel crashed (${d})`;
}
s(gn, "_crashText");
function yr() {
  try {
    return J.runtime.memory_usage();
  } catch {
    return null;
  }
}
s(yr, "_usage");
function pr() {
  const d = yr(), c = /* @__PURE__ */ s((m) => Math.round(m / hn), "mb");
  return `the kernel ran out of memory${d === null ? "" : ` (${c(d.used)} MB in use, the module's memory at ${c(d.heap)} MB of at most ${c(d.limit)} MB)`}: dispose() parts you no longer need, or let the event loop run so that the garbage collector frees them`;
}
s(pr, "_outOfMemoryHint");
function wr(d, c) {
  const _ = `the kernel crashed (${d}), and its memory may be damaged: load the module again before relying on its results (a KernelWorker does so by itself)`;
  return c ? `${_}; ${c}` : _;
}
s(wr, "_crashHint");
function Za() {
  return ne.count;
}
s(Za, "_crashCount");
function Ja(d, c = null) {
  const _ = ne.last ?? "a trap";
  return new ae(d, `the kernel crashed (${_})`, null, wr(_, c));
}
s(Ja, "_crashError");
function yn(d, c, _ = null) {
  if (we.clear_kernel_trace(), !J.runtime.reserve())
    throw new ae(d, `${Ve}: the memory is used up`, Ve, pr());
  try {
    return c();
  } catch (m) {
    if (m instanceof ae || !mn(m) || m.timedOut === !0)
      throw m;
    const p = Te(m), w = p ? gn(m.message, yr()) : m.message, y = Ka.exec(w), P = y ? y[1] : null;
    _ === null && typeof m.reason == "string" && (_ = w.slice(w.indexOf(": ") + 2));
    const C = P === Ve ? pr() : p ? wr(m.message, _) : _, R = Oa(new ae(d, w, P, C), p ? [] : wn(m));
    throw R.cause = m, R;
  }
}
s(yn, "kernelCall");
function wn(d) {
  const c = d?._kernelTrace;
  return Array.isArray(c) ? c.map(String) : we.kernel_trace()[0];
}
s(wn, "_traceOf");
function Qa() {
  const { used: d, heap: c, limit: _ } = J.runtime.memory_usage();
  return { used: d, heap: c, limit: _, handles: $e, crashes: ne.count };
}
s(Qa, "memoryUsage");
var Ce = new FinalizationRegistry(([d, c]) => {
  $e--;
  try {
    br(d, c);
  } catch {
  }
}), $e = 0;
function br(d, c) {
  d === "brep" ? we.delete_brep(c) : d === "curve" ? we.delete_curve(c) : d === "surface" ? we.delete_surface(c) : d === "poly" && we.delete_polybrep(c);
}
s(br, "free");
var eo = 0, be, We = (be = class {
  constructor(c, _) {
    W(this, "_p");
    W(this, "_kind");
    /** A number that tells handles apart for as long as they live (their kernel objects' numbers
     * can be reused once freed). */
    W(this, "id", ++eo);
    this._kind = c, this._p = _, _ && (Ce.register(this, [c, _], this), $e++, q.length && q[q.length - 1].push(this));
  }
  /** Gives the kernel object to a new owner: this handle no longer frees it. */
  release() {
    const c = this._p;
    if (!c)
      throw new Error("the kernel object was disposed");
    return this._p = 0, Ce.unregister(this), $e--, c;
  }
  /** False once the kernel object was disposed (or given to a new owner). */
  get alive() {
    return this._p !== 0;
  }
  /** Frees the kernel object now (it is freed on garbage collection otherwise). */
  dispose() {
    const c = this._p;
    c && (this._p = 0, Ce.unregister(this), $e--, br(this._kind, c));
  }
  [Symbol.dispose]() {
    this.dispose();
  }
}, s(be, "Handle"), be), q = [];
function ro(d) {
  if (typeof d != "function")
    throw new TypeError(`scope takes a function, not ${d === null ? "null" : typeof d}`);
  const c = [];
  q.push(c);
  let _;
  try {
    _ = d();
  } catch (m) {
    throw q.pop(), mr(c, m), m;
  }
  if (q.pop(), _ !== null && (typeof _ == "object" || typeof _ == "function") && typeof _.then == "function")
    throw q.length && q[q.length - 1].push(...c), new TypeError("scope takes a function that returns its result, not a promise: an async function goes on after its first await, where the scope cannot follow it");
  return mr(c, _), _;
}
s(ro, "scope");
function mr(d, c) {
  const _ = bn(c), m = q.length ? q[q.length - 1] : null;
  for (const p of d)
    p.alive && (_.has(p) ? m?.push(p) : p.dispose());
}
s(mr, "_freeExcept");
function bn(d) {
  const c = /* @__PURE__ */ new Set(), _ = /* @__PURE__ */ new Set(), m = [d];
  for (; m.length; ) {
    const p = m.pop();
    if (!(p === null || typeof p != "object" || _.has(p))) {
      if (_.add(p), p instanceof We) {
        c.add(p);
        continue;
      }
      if (!(ArrayBuffer.isView(p) || p instanceof ArrayBuffer || p instanceof Promise || p instanceof WeakMap || p instanceof WeakSet) && !(typeof SharedArrayBuffer < "u" && p instanceof SharedArrayBuffer)) {
        if (p instanceof Map) {
          for (const [w, y] of p)
            m.push(w, y);
          continue;
        }
        if (p instanceof Set) {
          for (const w of p)
            m.push(w);
          continue;
        }
        for (const w of Reflect.ownKeys(p)) {
          const y = Object.getOwnPropertyDescriptor(p, w);
          y !== void 0 && "value" in y && y.value !== null && typeof y.value == "object" && m.push(y.value);
        }
      }
    }
  }
  return c;
}
s(bn, "_reachable");
function qe(d) {
  return new TypeError(`the ${d} was disposed: dispose() freed it in the kernel, so it cannot be used any more`);
}
s(qe, "_disposed");
var ke, so = (ke = class extends We {
  constructor(_) {
    if (!_)
      throw new ae("kernel", "operation returned no body");
    super("brep", _);
    W(this, "sound", 0);
    W(this, "props", null);
    /** The tags of its faces and edges (`ext.topology_tags`, read once). */
    W(this, "tags", null);
    /** Its shells and the cells each face bounds (`ext.brep_shells`, read once; kernel plan T7). */
    W(this, "shells", null);
    /** For a body made by `Part.merge` (or a copy of one): the parts it was merged from, the placement
     * it was moved by since, and its cells' sources once found (kernel plan B15). */
    W(this, "merged", null);
    /** For a cell of a merged part: the parts it lies in. */
    W(this, "sources", null);
    /** The meshes rays are cast against, by purpose (a body's Brep does not change once wrapped). */
    W(this, "meshes", /* @__PURE__ */ new Map());
    W(this, "imported", !1);
  }
  get brep() {
    if (!this._p)
      throw qe("body");
    return this._p;
  }
  /** Holds another Brep in place of its own, which the kernel deleted (as Python's `h.brep = ...`):
   * `ext.boolean` can give its result as a new Brep. */
  set brep(_) {
    if (_ !== this._p) {
      if (!_)
        throw new ae("kernel", "operation returned no body");
      Ce.unregister(this), this._p = _, Ce.register(this, ["brep", _], this);
    }
  }
}, s(ke, "BrepHandle"), ke), Ee, lo = (Ee = class extends We {
  constructor(c) {
    if (!c)
      throw new ae("kernel", "operation returned no curve");
    super("curve", c);
  }
  get curve() {
    if (!this._p)
      throw qe("curve");
    return this._p;
  }
}, s(Ee, "CurveHandle"), Ee), xe, co = (xe = class extends We {
  constructor(c) {
    if (!c)
      throw new ae("kernel", "operation returned no surface");
    super("surface", c);
  }
  get surface() {
    if (!this._p)
      throw qe("surface");
    return this._p;
  }
}, s(xe, "SurfaceHandle"), xe), Se, uo = (Se = class extends We {
  constructor(c) {
    super("poly", c);
  }
  /** The mesh, or 0 once disposed. */
  get poly() {
    return this._p;
  }
}, s(Se, "PolyHandle"), Se), kn = /* @__PURE__ */ s((d) => console.warn(d), "warningHandler");
function to(d) {
  kn = d;
}
s(to, "setWarningHandler");
function En(d) {
  kn(d);
}
s(En, "_warn");
function no(d, c, _ = -1) {
  const [m, p] = Va[d] ?? [-1, []], w = /* @__PURE__ */ s((y) => `${d}() takes ${m} positional argument${m === 1 ? "" : "s"} but ${y} ${y === 1 ? "was" : "were"} given`, "takes");
  if (c != null && !gr(c))
    throw m >= 0 ? new TypeError(w(Math.max(_, m + 1))) : new TypeError(`${d}(): the options must be an object, not ${typeof c}`);
  if (m >= 0 && _ > m + 1)
    throw new TypeError(w(c == null ? _ : _ - 1));
  if (c != null)
    for (const y of Object.keys(c)) {
      if (y.startsWith("_") || p.includes(y))
        continue;
      let P;
      const C = y.replace(/_([a-z0-9])/g, (F, T) => T.toUpperCase()), R = p.map((F) => [xn(F.toLowerCase(), y.toLowerCase()), F]).filter(([F, T]) => F <= Math.floor((T.length + 3) / 4)).sort((F, T) => F[0] - T[0]);
      throw p.includes(C) ? P = `; did you mean '${C}'? (the options are camelCase)` : R.length ? P = `; did you mean '${R[0][1]}'?` : p.length ? P = ` (its options: ${p.join(", ")})` : P = " (it takes no options)", new TypeError(`${d}() got an unexpected option '${y}'${P}`);
    }
}
s(no, "_opts");
function xn(d, c) {
  let _ = Array.from({ length: c.length + 1 }, (m, p) => p);
  for (let m = 1; m <= d.length; m++) {
    const p = [m];
    for (let w = 1; w <= c.length; w++)
      p.push(Math.min(_[w] + 1, p[w - 1] + 1, _[w - 1] + (d[m - 1] === c[w - 1] ? 0 : 1)));
    _ = p;
  }
  return _[c.length];
}
s(xn, "_distance");
export {
  so as BrepHandle,
  lo as CurveHandle,
  We as Handle,
  ae as KernelError,
  Ba as ModelingError,
  uo as PolyHandle,
  co as SurfaceHandle,
  io as _OWN,
  Za as _crashCount,
  Ja as _crashError,
  Ya as _crashOf,
  gn as _crashText,
  qe as _disposed,
  Ga as _isCrash,
  mn as _isRuntimeError,
  no as _opts,
  bn as _reachable,
  Xa as _smpylibSignatures,
  wn as _traceOf,
  En as _warn,
  we as ext,
  J as k,
  yn as kernelCall,
  Qa as memoryUsage,
  Fe as module,
  ro as scope,
  to as setWarningHandler
};
