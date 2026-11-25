var oo = Object.defineProperty;
var ao = (f, c, d) => c in f ? oo(f, c, { enumerable: !0, configurable: !0, writable: !0, value: d }) : f[c] = d;
var $ = (f, c, d) => ao(f, typeof c != "symbol" ? c + "" : c, d);
import { K as te, _ as re, M as io, a as so } from "./_defeature_worker-BHRZZV2a.js";
function lo(f) {
  const c = {}, d = {};
  let p = null;
  c.locateFile && (d.locateFile = c.locateFile), c.instantiateWasm && (d.instantiateWasm = c.instantiateWasm);
  const _ = c.wasmModule ?? c.wasmBinary;
  if (_ != null) {
    let g = () => {
    };
    p = new Promise((T, C) => {
      g = C;
    }), d.instantiateWasm = (T, C) => ((_ instanceof WebAssembly.Module ? WebAssembly.instantiate(_, T) : WebAssembly.instantiate(_, T).then((F) => F.instance)).then(C, (F) => g(new Error(`the kernel could not be instantiated (${F instanceof Error ? F.message : F})`, { cause: F }))), {});
  }
  const y = f(d);
  return p === null ? y : Promise.race([y, p]);
}
async function co(f = {}) {
  var c = f, d = !!globalThis.window, p = !!globalThis.WorkerGlobalScope, _ = globalThis.process?.versions?.node && globalThis.process?.type != "renderer";
  if (_) {
    const { createRequire: e } = await import(
      /* webpackIgnore: true */
      /* @vite-ignore */
      ["node", "module"].join(":")
    );
    var y = e(import.meta.url);
  }
  var g = "./this.program", T = (e, r) => {
    throw r;
  }, C = import.meta.url, D = "";
  function F(e) {
    return c.locateFile ? c.locateFile(e, D) : D + e;
  }
  var P, X;
  if (_) {
    var Z = y("node:fs");
    C.startsWith("file:") && (D = y("node:path").dirname(y("node:url").fileURLToPath(C)) + "/"), X = (e) => {
      e = Ge(e) ? new URL(e) : e;
      var r = Z.readFileSync(e);
      return r;
    }, P = async (e, r = !0) => {
      e = Ge(e) ? new URL(e) : e;
      var t = Z.readFileSync(e, r ? void 0 : "utf8");
      return t;
    }, process.argv.length > 1 && (g = process.argv[1].replace(/\\/g, "/")), process.argv.slice(2), T = (e, r) => {
      throw process.exitCode = e, r;
    };
  } else if (d || p) {
    try {
      D = new URL(".", C).href;
    } catch {
    }
    p && (X = (e) => {
      var r = new XMLHttpRequest();
      return r.open("GET", e, !1), r.responseType = "arraybuffer", r.send(null), new Uint8Array(r.response);
    }), P = async (e) => {
      var r = await fetch(e, { credentials: "same-origin" });
      if (r.ok)
        return r.arrayBuffer();
      throw new Error(r.status + " : " + r.url);
    };
  }
  var xe = console.log.bind(console), J = console.error.bind(console), Gr, Ce = !1, Ge = (e) => e.startsWith("file://"), qe = !1;
  function qr() {
    return Pe.buffer;
  }
  function Ye() {
    if (!L?.buffer?.resizable) {
      var e = qr();
      L = new Int8Array(e), ae = new Int16Array(e), G = new Uint8Array(e), ge = new Uint16Array(e), M = new Int32Array(e), k = new Uint32Array(e), pr = new Float32Array(e), hr = new Float64Array(e), N = new BigInt64Array(e), cr = new BigUint64Array(e);
    }
  }
  function Yr() {
    var e = c.preRun;
    e && (typeof e == "function" && (e = [e]), Je.push(...e)), Ke(Je);
  }
  function Kr() {
    qe = !0, !c.noFSInit && !o.initialized && o.init(), se.T(), o.ignorePermissions = !1;
  }
  function Zr() {
    var e = c.postRun;
    e && (typeof e == "function" && (e = [e]), Ze.push(...e)), Ke(Ze);
  }
  function I(e) {
    c.onAbort?.(e), e = `Aborted(${e})`, J(e), Ce = !0, e += ". Build with -sASSERTIONS for more info.", qe && Ar();
    var r = new WebAssembly.RuntimeError(e);
    throw r;
  }
  var Re;
  function Jr() {
    return c.locateFile ? F("smlibwasm.wasm") : new URL("" + new URL("smlibwasm-Bw7fxXQ_.wasm", import.meta.url).href, import.meta.url).href;
  }
  function Qr(e) {
    if (X)
      return X(e);
    throw "both async and sync fetching of the wasm failed";
  }
  async function et(e) {
    try {
      var r = await P(e);
      return new Uint8Array(r);
    } catch {
    }
    return Qr(e);
  }
  async function rt(e, r) {
    try {
      var t = await et(e), n = await WebAssembly.instantiate(t, r);
      return n;
    } catch (a) {
      J(`failed to asynchronously prepare wasm: ${a}`), I(a);
    }
  }
  async function tt(e, r, t) {
    if (!_)
      try {
        var n = fetch(r, { credentials: "same-origin" }), a = await WebAssembly.instantiateStreaming(n, t);
        return a;
      } catch (i) {
        J(`wasm streaming compile failed: ${i}`), J("falling back to ArrayBuffer instantiation");
      }
    return rt(r, t);
  }
  function nt() {
    var e = { a: ro };
    return e;
  }
  async function ot() {
    function e(s) {
      return se = s.exports, se = to(se), eo(se), Ye(), se;
    }
    function r(s) {
      return e(s.instance);
    }
    var t = nt(), n = c.instantiateWasm;
    if (n)
      return new Promise((s) => {
        n(t, (l) => s(e(l)));
      });
    Re ?? (Re = Jr());
    var a = await tt(Gr, Re, t), i = r(a);
    return i;
  }
  class at {
    constructor(r) {
      $(this, "name", "ExitStatus");
      this.message = `Program terminated with exit(${r})`, this.status = r;
    }
  }
  var L, Ke = (e) => {
    for (; e.length > 0; )
      e.shift()(c);
  }, Ze = [], Je = [], Qe = !0, A = { isAbs: (e) => e.charAt(0) === "/", splitPath: (e) => {
    var r = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    return r.exec(e).slice(1);
  }, normalizeArray: (e, r) => {
    for (var t = 0, n = e.length - 1; n >= 0; n--) {
      var a = e[n];
      a === "." ? e.splice(n, 1) : a === ".." ? (e.splice(n, 1), t++) : t && (e.splice(n, 1), t--);
    }
    if (r)
      for (; t; t--)
        e.unshift("..");
    return e;
  }, normalize: (e) => {
    var r = A.isAbs(e), t = e.slice(-1) === "/";
    return e = A.normalizeArray(e.split("/").filter((n) => !!n), !r).join("/"), !e && !r && (e = "."), e && t && (e += "/"), (r ? "/" : "") + e;
  }, dirname: (e) => {
    var r = A.splitPath(e), t = r[0], n = r[1];
    return !t && !n ? "." : (n && (n = n.slice(0, -1)), t + n);
  }, basename: (e) => e && e.match(/([^\/]+|\/)\/*$/)[1], join: (...e) => A.normalize(e.join("/")), join2: (e, r) => A.normalize(e + "/" + r) }, it = () => {
    if (_) {
      var e = y("node:crypto");
      return (r) => (e.randomFillSync(r), 0);
    }
    return (r) => (crypto.getRandomValues(r), 0);
  }, er = (e) => (er = it())(e), le = { resolve: (...e) => {
    for (var r = "", t = !1, n = e.length - 1; n >= -1 && !t; n--) {
      var a = n >= 0 ? e[n] : o.cwd();
      if (typeof a != "string")
        throw new TypeError("Arguments to path.resolve must be strings");
      if (!a)
        return "";
      r = a + "/" + r, t = A.isAbs(a);
    }
    return r = A.normalizeArray(r.split("/").filter((i) => !!i), !t).join("/"), (t ? "/" : "") + r || ".";
  }, relative: (e, r) => {
    e = le.resolve(e).slice(1), r = le.resolve(r).slice(1);
    function t(v) {
      for (var m = 0; m < v.length && v[m] === ""; m++)
        ;
      for (var b = v.length - 1; b >= 0 && v[b] === ""; b--)
        ;
      return m > b ? [] : v.slice(m, b - m + 1);
    }
    for (var n = t(e.split("/")), a = t(r.split("/")), i = Math.min(n.length, a.length), s = i, l = 0; l < i; l++)
      if (n[l] !== a[l]) {
        s = l;
        break;
      }
    for (var u = [], l = s; l < n.length; l++)
      u.push("..");
    return u = u.concat(a.slice(s)), u.join("/");
  } }, rr = globalThis.TextDecoder && new TextDecoder(), tr = (e, r, t, n) => {
    var a = r + t;
    if (n) return a;
    for (; e[r] && !(r >= a); ) ++r;
    return r;
  }, ce = (e, r = 0, t, n) => {
    r >>>= 0;
    var a = tr(e, r, t, n);
    if (a - r > 16 && e.buffer && rr)
      return rr.decode(e.subarray(r, a));
    for (var i = ""; r < a; ) {
      var s = e[r++];
      if (!(s & 128)) {
        i += String.fromCharCode(s);
        continue;
      }
      var l = e[r++] & 63;
      if ((s & 224) == 192) {
        i += String.fromCharCode((s & 31) << 6 | l);
        continue;
      }
      var u = e[r++] & 63;
      if ((s & 240) == 224 ? s = (s & 15) << 12 | l << 6 | u : s = (s & 7) << 18 | l << 12 | u << 6 | e[r++] & 63, s < 65536)
        i += String.fromCharCode(s);
      else {
        var v = s - 65536;
        i += String.fromCharCode(55296 | v >> 10, 56320 | v & 1023);
      }
    }
    return i;
  }, $e = [], Me = (e) => {
    for (var r = 0, t = 0; t < e.length; ++t) {
      var n = e.charCodeAt(t);
      n <= 127 ? r++ : n <= 2047 ? r += 2 : n >= 55296 && n <= 57343 ? (r += 4, ++t) : r += 3;
    }
    return r;
  }, nr = (e, r, t, n) => {
    if (t >>>= 0, !(n > 0)) return 0;
    for (var a = t, i = t + n - 1, s = 0; s < e.length; ++s) {
      var l = e.codePointAt(s);
      if (l <= 127) {
        if (t >= i) break;
        r[t++ >>> 0] = l;
      } else if (l <= 2047) {
        if (t + 1 >= i) break;
        r[t++ >>> 0] = 192 | l >> 6, r[t++ >>> 0] = 128 | l & 63;
      } else if (l <= 65535) {
        if (t + 2 >= i) break;
        r[t++ >>> 0] = 224 | l >> 12, r[t++ >>> 0] = 128 | l >> 6 & 63, r[t++ >>> 0] = 128 | l & 63;
      } else {
        if (t + 3 >= i) break;
        r[t++ >>> 0] = 240 | l >> 18, r[t++ >>> 0] = 128 | l >> 12 & 63, r[t++ >>> 0] = 128 | l >> 6 & 63, r[t++ >>> 0] = 128 | l & 63, s++;
      }
    }
    return r[t >>> 0] = 0, t - a;
  }, Be = (e, r, t) => {
    var n = Me(e) + 1, a = new Array(n), i = nr(e, a, 0, a.length);
    return a.length = i, a;
  }, st = () => {
    if (!$e.length) {
      var e = null;
      if (_) {
        var r = 256, t = Buffer.alloc(r), n = 0;
        try {
          n = Z.readSync(process.stdin.fd, t, 0, r);
        } catch (a) {
          if (a.toString().includes("EOF")) n = 0;
          else throw a;
        }
        n > 0 && (e = t.toString("utf-8", 0, n));
      } else globalThis.window?.prompt && (e = window.prompt("Input: "), e !== null && (e += `
`));
      if (!e)
        return null;
      $e = Be(e);
    }
    return $e.shift();
  }, ne = { ttys: [], init() {
  }, shutdown() {
  }, register(e, r) {
    ne.ttys[e] = { input: [], output: [], ops: r }, o.registerDevice(e, ne.stream_ops);
  }, stream_ops: { open(e) {
    var r = ne.ttys[e.node.rdev];
    if (!r)
      throw new o.ErrnoError(43);
    e.tty = r, e.seekable = !1;
  }, close(e) {
    e.tty.ops.fsync(e.tty);
  }, fsync(e) {
    e.tty.ops.fsync(e.tty);
  }, read(e, r, t, n, a) {
    if (!e.tty || !e.tty.ops.get_char)
      throw new o.ErrnoError(60);
    for (var i = 0, s = 0; s < n; s++) {
      var l;
      try {
        l = e.tty.ops.get_char(e.tty);
      } catch {
        throw new o.ErrnoError(29);
      }
      if (l === void 0 && !i)
        throw new o.ErrnoError(6);
      if (l == null || (i++, r[t + s] = l, l === 10)) break;
    }
    return i && (e.node.atime = Date.now()), i;
  }, write(e, r, t, n, a) {
    if (!e.tty || !e.tty.ops.put_char)
      throw new o.ErrnoError(60);
    try {
      for (var i = 0; i < n; i++)
        e.tty.ops.put_char(e.tty, r[t + i]);
    } catch {
      throw new o.ErrnoError(29);
    }
    return n && (e.node.mtime = e.node.ctime = Date.now()), i;
  } }, default_tty_ops: { get_char(e) {
    return st();
  }, put_char(e, r) {
    r === null || r === 10 ? (xe(ce(e.output)), e.output = []) : r != 0 && e.output.push(r);
  }, fsync(e) {
    e.output?.length > 0 && (xe(ce(e.output)), e.output = []);
  }, ioctl_tcgets(e) {
    return { c_iflag: 25856, c_oflag: 5, c_cflag: 191, c_lflag: 35387, c_cc: [3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
  }, ioctl_tcsets(e, r, t) {
    return 0;
  }, ioctl_tiocgwinsz(e) {
    return [24, 80];
  } }, default_tty1_ops: { put_char(e, r) {
    r === null || r === 10 ? (J(ce(e.output)), e.output = []) : r != 0 && e.output.push(r);
  }, fsync(e) {
    e.output?.length > 0 && (J(ce(e.output)), e.output = []);
  } } }, or = (e) => {
    I();
  }, w = { ops_table: null, mount(e) {
    return w.createNode(null, "/", 16895, 0);
  }, createNode(e, r, t, n) {
    if (o.isBlkdev(t) || o.isFIFO(t))
      throw new o.ErrnoError(63);
    w.ops_table || (w.ops_table = { dir: { node: { getattr: w.node_ops.getattr, setattr: w.node_ops.setattr, lookup: w.node_ops.lookup, mknod: w.node_ops.mknod, rename: w.node_ops.rename, unlink: w.node_ops.unlink, rmdir: w.node_ops.rmdir, readdir: w.node_ops.readdir, symlink: w.node_ops.symlink }, stream: { llseek: w.stream_ops.llseek } }, file: { node: { getattr: w.node_ops.getattr, setattr: w.node_ops.setattr }, stream: { llseek: w.stream_ops.llseek, read: w.stream_ops.read, write: w.stream_ops.write, mmap: w.stream_ops.mmap, msync: w.stream_ops.msync } }, link: { node: { getattr: w.node_ops.getattr, setattr: w.node_ops.setattr, readlink: w.node_ops.readlink }, stream: {} }, chrdev: { node: { getattr: w.node_ops.getattr, setattr: w.node_ops.setattr }, stream: o.chrdev_stream_ops } });
    var a = o.createNode(e, r, t, n);
    return o.isDir(a.mode) ? (a.node_ops = w.ops_table.dir.node, a.stream_ops = w.ops_table.dir.stream, a.contents = {}) : o.isFile(a.mode) ? (a.node_ops = w.ops_table.file.node, a.stream_ops = w.ops_table.file.stream, a.usedBytes = 0, a.contents = w.emptyFileContents ?? (w.emptyFileContents = new Uint8Array(0))) : o.isLink(a.mode) ? (a.node_ops = w.ops_table.link.node, a.stream_ops = w.ops_table.link.stream) : o.isChrdev(a.mode) && (a.node_ops = w.ops_table.chrdev.node, a.stream_ops = w.ops_table.chrdev.stream), a.atime = a.mtime = a.ctime = Date.now(), e && (e.contents[r] = a, e.atime = e.mtime = e.ctime = a.atime), a;
  }, getFileDataAsTypedArray(e) {
    return e.contents.subarray(0, e.usedBytes);
  }, expandFileStorage(e, r) {
    var t = e.contents.length;
    if (!(t >= r)) {
      var n = 1024 * 1024;
      r = Math.max(r, t * (t < n ? 2 : 1.125) >>> 0), t && (r = Math.max(r, 256));
      var a = w.getFileDataAsTypedArray(e);
      e.contents = new Uint8Array(r), e.contents.set(a);
    }
  }, resizeFileStorage(e, r) {
    if (e.usedBytes != r) {
      var t = e.contents;
      e.contents = new Uint8Array(r), e.contents.set(t.subarray(0, Math.min(r, e.usedBytes))), e.usedBytes = r;
    }
  }, node_ops: { getattr(e) {
    var r = {};
    return r.dev = o.isChrdev(e.mode) ? e.id : 1, r.ino = e.id, r.mode = e.mode, r.nlink = 1, r.uid = 0, r.gid = 0, r.rdev = e.rdev, o.isDir(e.mode) ? r.size = 4096 : o.isFile(e.mode) ? r.size = e.usedBytes : o.isLink(e.mode) ? r.size = e.link.length : r.size = 0, r.atime = new Date(e.atime), r.mtime = new Date(e.mtime), r.ctime = new Date(e.ctime), r.atimeMs = e.atime, r.mtimeMs = e.mtime, r.ctimeMs = e.ctime, r.blksize = 4096, r.blocks = Math.ceil(r.size / r.blksize), r;
  }, setattr(e, r) {
    for (const t of ["mode", "atime", "mtime", "ctime"])
      r[t] != null && (e[t] = r[t]);
    r.size !== void 0 && w.resizeFileStorage(e, r.size);
  }, lookup(e, r) {
    throw w.doesNotExistError || (w.doesNotExistError = new o.ErrnoError(44), w.doesNotExistError.stack = "<generic error, no stack>"), w.doesNotExistError;
  }, mknod(e, r, t, n) {
    return w.createNode(e, r, t, n);
  }, rename(e, r, t) {
    var n;
    try {
      n = o.lookupNode(r, t);
    } catch {
    }
    if (n && o.isDir(e.mode))
      for (var a in n.contents)
        throw new o.ErrnoError(55);
    delete e.parent.contents[e.name], r.contents[t] = e, e.name = t, r.ctime = r.mtime = e.parent.ctime = e.parent.mtime = Date.now();
  }, unlink(e, r) {
    delete e.contents[r], e.ctime = e.mtime = Date.now();
  }, rmdir(e, r) {
    var t = o.lookupNode(e, r);
    for (var n in t.contents)
      throw new o.ErrnoError(55);
    delete e.contents[r], e.ctime = e.mtime = Date.now();
  }, readdir(e) {
    return [".", "..", ...Object.keys(e.contents)];
  }, symlink(e, r, t) {
    var n = w.createNode(e, r, 41471, 0);
    return n.link = t, n;
  }, readlink(e) {
    if (!o.isLink(e.mode))
      throw new o.ErrnoError(28);
    return e.link;
  } }, stream_ops: { read(e, r, t, n, a) {
    var i = e.node.contents;
    if (a >= e.node.usedBytes) return 0;
    var s = Math.min(e.node.usedBytes - a, n);
    return r.set(i.subarray(a, a + s), t), s;
  }, write(e, r, t, n, a, i) {
    if (r.buffer === L.buffer && (i = !1), !n) return 0;
    var s = e.node;
    return s.mtime = s.ctime = Date.now(), i ? (s.contents = r.subarray(t, t + n), s.usedBytes = n) : !s.usedBytes && !a ? (s.contents = r.slice(t, t + n), s.usedBytes = n) : (w.expandFileStorage(s, a + n), s.contents.set(r.subarray(t, t + n), a), s.usedBytes = Math.max(s.usedBytes, a + n)), n;
  }, llseek(e, r, t) {
    var n = r;
    if (t === 1 ? n += e.position : t === 2 && o.isFile(e.node.mode) && (n += e.node.usedBytes), n < 0)
      throw new o.ErrnoError(28);
    return n;
  }, mmap(e, r, t, n, a) {
    if (!o.isFile(e.node.mode))
      throw new o.ErrnoError(43);
    var i, s, l = e.node.contents;
    if (!(a & 2) && l.buffer === L.buffer)
      s = !1, i = l.byteOffset;
    else {
      if (s = !0, i = or(), !i)
        throw new o.ErrnoError(48);
      l && ((t > 0 || t + r < l.length) && (l.subarray ? l = l.subarray(t, t + r) : l = Array.prototype.slice.call(l, t, t + r)), L.set(l, i >>> 0));
    }
    return { ptr: i, allocated: s };
  }, msync(e, r, t, n, a) {
    return w.stream_ops.write(e, r, 0, n, t, !1), 0;
  } } }, lt = (e) => {
    if (typeof e != "string") return e;
    var r = { r: 0, "r+": 2, w: 577, "w+": 578, a: 1089, "a+": 1090 }, t = r[e];
    if (typeof t > "u")
      throw new Error(`Unknown file open mode: ${e}`);
    return t;
  }, ar = (e) => (typeof e == "string" && (e = Be(e)), e.subarray || (e = new Uint8Array(e)), e), Oe = (e, r) => {
    var t = 0;
    return e && (t |= 365), r && (t |= 146), t;
  }, ct = async (e) => {
    var r = await P(e);
    return new Uint8Array(r);
  }, ut = (...e) => o.createDataFile(...e), ir = null, ft = async () => ir, oe = 0, sr = null, dt = (e) => {
    oe--, c.monitorRunDependencies?.(oe), oe || sr();
  }, vt = (e) => {
    oe || (ir = new Promise((r) => sr = r)), oe++, c.monitorRunDependencies?.(oe);
  }, _t = [], pt = async (e, r) => {
    typeof Browser < "u" && Browser.init();
    for (var t of _t)
      if (t.canHandle(r))
        return t.handle(e, r);
    return e;
  }, lr = async (e, r, t, n, a, i, s, l) => {
    var u = r ? le.resolve(A.join2(e, r)) : e;
    vt();
    try {
      var v = t;
      typeof t == "string" && (v = await ct(t)), v = await pt(v, u), l?.(), i || ut(e, r, v, n, a, s);
    } finally {
      dt();
    }
  }, ht = (e, r, t, n, a, i, s, l, u, v) => {
    lr(e, r, t, n, a, l, u, v).then(i).catch(s);
  }, o = { root: null, mounts: [], devices: {}, streams: [], nextInode: 1, nameTable: [], currentPath: "/", initialized: !1, ignorePermissions: !0, filesystems: null, syncFSRequests: 0, ErrnoError: class {
    constructor(e) {
      $(this, "name", "ErrnoError");
      this.errno = e;
    }
  }, FSStream: class {
    constructor() {
      $(this, "shared", {});
    }
    get object() {
      return this.node;
    }
    set object(e) {
      this.node = e;
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
    set flags(e) {
      this.shared.flags = e;
    }
    get position() {
      return this.shared.position;
    }
    set position(e) {
      this.shared.position = e;
    }
  }, FSNode: class {
    constructor(e, r, t, n) {
      $(this, "node_ops", {});
      $(this, "stream_ops", {});
      $(this, "readMode", 365);
      $(this, "writeMode", 146);
      $(this, "mounted", null);
      e || (e = this), this.parent = e, this.mount = e.mount, this.id = o.nextInode++, this.name = r, this.mode = t, this.rdev = n, this.atime = this.mtime = this.ctime = Date.now();
    }
    get read() {
      return (this.mode & this.readMode) === this.readMode;
    }
    set read(e) {
      e ? this.mode |= this.readMode : this.mode &= ~this.readMode;
    }
    get write() {
      return (this.mode & this.writeMode) === this.writeMode;
    }
    set write(e) {
      e ? this.mode |= this.writeMode : this.mode &= ~this.writeMode;
    }
    get isFolder() {
      return o.isDir(this.mode);
    }
    get isDevice() {
      return o.isChrdev(this.mode);
    }
    addListener(e, r = !1) {
      var t = { cb: e, exclusive: r }, n = this.listeners ?? (this.listeners = /* @__PURE__ */ new Set());
      return n.add(t), { listeners: n, entry: t };
    }
    notifyListeners(e) {
      if (this.listeners) {
        var r;
        for (var t of this.listeners)
          t.exclusive ? (r || (r = [])).push(t) : t.cb(e);
        if (r) {
          var n = (this.exclTurn || 0) % r.length;
          this.exclTurn = n + 1, r[n].cb(e);
        }
      }
    }
  }, lookupPath(e, r = {}) {
    if (!e)
      throw new o.ErrnoError(44);
    r.follow_mount ?? (r.follow_mount = !0), A.isAbs(e) || (e = o.cwd() + "/" + e);
    e: for (var t = 0; t < 40; t++) {
      for (var n = e.split("/").filter((v) => !!v), a = o.root, i = "/", s = 0; s < n.length; s++) {
        var l = s === n.length - 1;
        if (l && r.parent)
          break;
        if (n[s] !== ".") {
          if (n[s] === "..") {
            if (i = A.dirname(i), o.isRoot(a)) {
              e = i + "/" + n.slice(s + 1).join("/"), t--;
              continue e;
            } else
              a = a.parent;
            continue;
          }
          i = A.join2(i, n[s]);
          try {
            a = o.lookupNode(a, n[s]);
          } catch (v) {
            if (v?.errno === 44 && l && r.noent_okay)
              return { path: i };
            throw v;
          }
          if (o.isMountpoint(a) && (!l || r.follow_mount) && (a = a.mounted.root), o.isLink(a.mode) && (!l || r.follow)) {
            if (!a.node_ops.readlink)
              throw new o.ErrnoError(52);
            var u = a.node_ops.readlink(a);
            A.isAbs(u) || (u = A.dirname(i) + "/" + u), e = u + "/" + n.slice(s + 1).join("/");
            continue e;
          }
        }
      }
      return { path: i, node: a };
    }
    throw new o.ErrnoError(32);
  }, getPath(e) {
    for (var r; ; ) {
      if (o.isRoot(e)) {
        var t = e.mount.mountpoint;
        return r ? t[t.length - 1] !== "/" ? `${t}/${r}` : t + r : t;
      }
      r = r ? `${e.name}/${r}` : e.name, e = e.parent;
    }
  }, hashName(e, r) {
    for (var t = 0, n = 0; n < r.length; n++)
      t = (t << 5) - t + r.charCodeAt(n) | 0;
    return (e + t >>> 0) % o.nameTable.length;
  }, hashAddNode(e) {
    var r = o.hashName(e.parent.id, e.name);
    e.name_next = o.nameTable[r], o.nameTable[r] = e;
  }, hashRemoveNode(e) {
    var r = o.hashName(e.parent.id, e.name);
    if (o.nameTable[r] === e)
      o.nameTable[r] = e.name_next;
    else
      for (var t = o.nameTable[r]; t; ) {
        if (t.name_next === e) {
          t.name_next = e.name_next;
          break;
        }
        t = t.name_next;
      }
  }, lookupNode(e, r) {
    var t = o.mayLookup(e);
    if (t)
      throw new o.ErrnoError(t);
    for (var n = o.hashName(e.id, r), a = o.nameTable[n]; a; a = a.name_next) {
      var i = a.name;
      if (a.parent.id === e.id && i === r)
        return a;
    }
    return o.lookup(e, r);
  }, createNode(e, r, t, n) {
    var a = new o.FSNode(e, r, t, n);
    return o.hashAddNode(a), a;
  }, destroyNode(e) {
    o.hashRemoveNode(e);
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
    return o.ignorePermissions ? 0 : r.includes("r") && !(e.mode & 292) || r.includes("w") && !(e.mode & 146) || r.includes("x") && !(e.mode & 73) ? 2 : 0;
  }, mayLookup(e) {
    if (!o.isDir(e.mode)) return 54;
    var r = o.nodePermissions(e, "x");
    return r || (e.node_ops.lookup ? 0 : 2);
  }, mayCreate(e, r) {
    if (!o.isDir(e.mode))
      return 54;
    try {
      var t = o.lookupNode(e, r);
      return 20;
    } catch {
    }
    return o.nodePermissions(e, "wx");
  }, mayDelete(e, r, t) {
    var n;
    try {
      n = o.lookupNode(e, r);
    } catch (i) {
      return i.errno;
    }
    var a = o.nodePermissions(e, "wx");
    if (a)
      return a;
    if (t) {
      if (!o.isDir(n.mode))
        return 54;
      if (o.isRoot(n) || o.getPath(n) === o.cwd())
        return 10;
    } else if (o.isDir(n.mode))
      return 31;
    return 0;
  }, mayOpen(e, r) {
    if (!e)
      return 44;
    if (o.isLink(e.mode))
      return 32;
    var t = o.flagsToPermissionString(r);
    return o.isDir(e.mode) && (t !== "r" || r & 576) ? 31 : o.nodePermissions(e, t);
  }, checkOpExists(e, r) {
    if (!e)
      throw new o.ErrnoError(r);
    return e;
  }, MAX_OPEN_FDS: 4096, nextfd() {
    for (var e = 0; e <= o.MAX_OPEN_FDS; e++)
      if (!o.streams[e])
        return e;
    throw new o.ErrnoError(33);
  }, getStreamChecked(e) {
    var r = o.getStream(e);
    if (!r)
      throw new o.ErrnoError(8);
    return r;
  }, getStream: (e) => o.streams[e], createStream(e, r = -1) {
    return e = Object.assign(new o.FSStream(), e), r == -1 && (r = o.nextfd()), e.fd = r, o.streams[r] = e, e;
  }, closeStream(e) {
    o.streams[e] = null;
  }, dupStream(e, r = -1) {
    var t = o.createStream(e, r);
    return t.stream_ops?.dup?.(t), t;
  }, doSetAttr(e, r, t) {
    var n = e?.stream_ops.setattr, a = n ? e : r;
    n ?? (n = r.node_ops.setattr), o.checkOpExists(n, 63);
    try {
      n(a, t);
    } catch (i) {
      throw i instanceof RangeError ? new o.ErrnoError(22) : i;
    }
  }, chrdev_stream_ops: { open(e) {
    var r = o.getDevice(e.node.rdev);
    e.stream_ops = r.stream_ops, e.stream_ops.open?.(e);
  }, llseek() {
    throw new o.ErrnoError(70);
  } }, major: (e) => e >> 8, minor: (e) => e & 255, makedev: (e, r) => e << 8 | r, registerDevice(e, r) {
    o.devices[e] = { stream_ops: r };
  }, getDevice: (e) => o.devices[e], getMounts(e) {
    for (var r = [], t = [e]; t.length; ) {
      var n = t.pop();
      r.push(n), t.push(...n.mounts);
    }
    return r;
  }, syncfs(e, r) {
    typeof e == "function" && (r = e, e = !1), o.syncFSRequests++, o.syncFSRequests > 1 && J(`warning: ${o.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
    var t = o.getMounts(o.root.mount), n = 0;
    function a(l) {
      return o.syncFSRequests--, r(l);
    }
    function i(l) {
      if (l)
        return i.errored ? void 0 : (i.errored = !0, a(l));
      ++n >= t.length && a(null);
    }
    for (var s of t)
      s.type.syncfs ? s.type.syncfs(s, e, i) : i(null);
  }, mount(e, r, t) {
    var n = t === "/", a = !t, i;
    if (n && o.root)
      throw new o.ErrnoError(10);
    if (!n && !a) {
      var s = o.lookupPath(t, { follow_mount: !1 });
      if (t = s.path, i = s.node, o.isMountpoint(i))
        throw new o.ErrnoError(10);
      if (!o.isDir(i.mode))
        throw new o.ErrnoError(54);
    }
    var l = { type: e, opts: r, mountpoint: t, mounts: [] }, u = e.mount(l);
    return u.mount = l, l.root = u, n ? o.root = u : i && (i.mounted = l, i.mount && i.mount.mounts.push(l)), u;
  }, unmount(e) {
    var r = o.lookupPath(e, { follow_mount: !1 });
    if (!o.isMountpoint(r.node))
      throw new o.ErrnoError(28);
    var t = r.node, n = t.mounted, a = o.getMounts(n);
    for (var [i, s] of Object.entries(o.nameTable))
      for (; s; ) {
        var l = s.name_next;
        a.includes(s.mount) && o.destroyNode(s), s = l;
      }
    t.mounted = null;
    var u = t.mount.mounts.indexOf(n);
    t.mount.mounts.splice(u, 1);
  }, lookup(e, r) {
    return e.node_ops.lookup(e, r);
  }, mknod(e, r, t) {
    var n = o.lookupPath(e, { parent: !0 }), a = n.node, i = A.basename(e);
    if (!i)
      throw new o.ErrnoError(28);
    if (i === "." || i === "..")
      throw new o.ErrnoError(20);
    var s = o.mayCreate(a, i);
    if (s)
      throw new o.ErrnoError(s);
    if (!a.node_ops.mknod)
      throw new o.ErrnoError(63);
    return a.node_ops.mknod(a, i, r, t);
  }, statfs(e) {
    return o.statfsNode(o.lookupPath(e, { follow: !0 }).node);
  }, statfsStream(e) {
    return o.statfsNode(e.node);
  }, statfsNode(e) {
    var r = { bsize: 4096, frsize: 4096, blocks: 1e6, bfree: 5e5, bavail: 5e5, files: o.nextInode, ffree: o.nextInode - 1, fsid: 42, flags: 2, namelen: 255 };
    return e.node_ops.statfs && Object.assign(r, e.node_ops.statfs(e.mount.opts.root)), r;
  }, create(e, r = 438) {
    return r &= 4095, r |= 32768, o.mknod(e, r, 0);
  }, mkdir(e, r = 511) {
    return r &= 1023, r |= 16384, o.mknod(e, r, 0);
  }, mkdirTree(e, r = 511) {
    var t = e.split("/"), n = "";
    for (var a of t)
      if (a) {
        (n || A.isAbs(e)) && (n += "/"), n += a;
        try {
          o.mkdir(n, r);
        } catch (i) {
          if (i.errno != 20) throw i;
        }
      }
  }, mkdev(e, r, t) {
    return typeof t > "u" && (t = r, r = 438), r |= 8192, o.mknod(e, r, t);
  }, symlink(e, r) {
    if (!le.resolve(e))
      throw new o.ErrnoError(44);
    var t = o.lookupPath(r, { parent: !0 }), n = t.node;
    if (!n)
      throw new o.ErrnoError(44);
    var a = A.basename(r), i = o.mayCreate(n, a);
    if (i)
      throw new o.ErrnoError(i);
    if (!n.node_ops.symlink)
      throw new o.ErrnoError(63);
    return n.node_ops.symlink(n, a, e);
  }, link(e, r, t) {
    var n = o.lookupPath(r, { parent: !0 }), a = n.node;
    if (!a)
      throw new o.ErrnoError(44);
    var i = A.basename(r), s = o.mayCreate(a, i);
    if (s)
      throw new o.ErrnoError(s);
    if (!a.node_ops.link)
      throw new o.ErrnoError(34);
    return a.node_ops.link(a, i, e, t);
  }, rename(e, r) {
    var t = A.dirname(e), n = A.dirname(r), a = A.basename(e), i = A.basename(r), s, l, u;
    if (s = o.lookupPath(e, { parent: !0 }), l = s.node, s = o.lookupPath(r, { parent: !0 }), u = s.node, !l || !u) throw new o.ErrnoError(44);
    if (l.mount !== u.mount)
      throw new o.ErrnoError(75);
    var v = o.lookupNode(l, a), m = le.relative(e, n);
    if (m.charAt(0) !== ".")
      throw new o.ErrnoError(28);
    if (m = le.relative(r, t), m.charAt(0) !== ".")
      throw new o.ErrnoError(55);
    var b;
    try {
      b = o.lookupNode(u, i);
    } catch {
    }
    if (v !== b) {
      var E = o.isDir(v.mode), h = o.mayDelete(l, a, E);
      if (h)
        throw new o.ErrnoError(h);
      if (h = b ? o.mayDelete(u, i, E) : o.mayCreate(u, i), h)
        throw new o.ErrnoError(h);
      if (!l.node_ops.rename)
        throw new o.ErrnoError(63);
      if (o.isMountpoint(v) || b && o.isMountpoint(b))
        throw new o.ErrnoError(10);
      if (u !== l && (h = o.nodePermissions(l, "w"), h))
        throw new o.ErrnoError(h);
      o.hashRemoveNode(v);
      try {
        l.node_ops.rename(v, u, i), b && o.hashRemoveNode(b), v.parent = u;
      } catch (S) {
        throw S;
      } finally {
        o.hashAddNode(v);
      }
    }
  }, rmdir(e) {
    var r = o.lookupPath(e, { parent: !0 }), t = r.node, n = A.basename(e), a = o.lookupNode(t, n), i = o.mayDelete(t, n, !0);
    if (i)
      throw new o.ErrnoError(i);
    if (!t.node_ops.rmdir)
      throw new o.ErrnoError(63);
    if (o.isMountpoint(a))
      throw new o.ErrnoError(10);
    t.node_ops.rmdir(t, n), o.destroyNode(a);
  }, readdir(e) {
    var r = o.lookupPath(e, { follow: !0 }), t = r.node, n = o.checkOpExists(t.node_ops.readdir, 54);
    return n(t);
  }, unlink(e) {
    var r = o.lookupPath(e, { parent: !0 }), t = r.node;
    if (!t)
      throw new o.ErrnoError(44);
    var n = A.basename(e), a = o.lookupNode(t, n), i = o.mayDelete(t, n, !1);
    if (i)
      throw new o.ErrnoError(i);
    if (!t.node_ops.unlink)
      throw new o.ErrnoError(63);
    if (o.isMountpoint(a))
      throw new o.ErrnoError(10);
    t.node_ops.unlink(t, n), o.destroyNode(a);
  }, readlink(e) {
    var r = o.lookupPath(e), t = r.node;
    if (!t)
      throw new o.ErrnoError(44);
    if (!t.node_ops.readlink)
      throw new o.ErrnoError(28);
    return t.node_ops.readlink(t);
  }, stat(e, r = !1) {
    var t = o.lookupPath(e, { follow: !r }), n = t.node, a = o.checkOpExists(n.node_ops.getattr, 63);
    return a(n);
  }, fstat(e) {
    var r = o.getStreamChecked(e), t = r.node, n = r.stream_ops.getattr, a = n ? r : t;
    return n ?? (n = t.node_ops.getattr), o.checkOpExists(n, 63), n(a);
  }, lstat(e) {
    return o.stat(e, !0);
  }, doChmod(e, r, t, n = !1) {
    o.doSetAttr(e, r, { mode: t & 4095 | r.mode & -4096, ctime: Date.now(), dontFollow: n });
  }, chmod(e, r, t = !1) {
    var n;
    if (typeof e == "string") {
      var a = o.lookupPath(e, { follow: !t });
      n = a.node;
    } else
      n = e;
    o.doChmod(null, n, r, t);
  }, lchmod(e, r) {
    o.chmod(e, r, !0);
  }, fchmod(e, r) {
    var t = o.getStreamChecked(e);
    o.doChmod(t, t.node, r, !1);
  }, doChown(e, r, t = !1) {
    o.doSetAttr(e, r, { timestamp: Date.now(), dontFollow: t });
  }, chown(e, r, t, n = !1) {
    var a;
    if (typeof e == "string") {
      var i = o.lookupPath(e, { follow: !n });
      a = i.node;
    } else
      a = e;
    o.doChown(null, a, n);
  }, lchown(e, r, t) {
    o.chown(e, r, t, !0);
  }, fchown(e, r, t) {
    var n = o.getStreamChecked(e);
    o.doChown(n, n.node, !1);
  }, doTruncate(e, r, t) {
    if (o.isDir(r.mode))
      throw new o.ErrnoError(31);
    if (!o.isFile(r.mode))
      throw new o.ErrnoError(28);
    var n = o.nodePermissions(r, "w");
    if (n)
      throw new o.ErrnoError(n);
    o.doSetAttr(e, r, { size: t, timestamp: Date.now() });
  }, truncate(e, r) {
    if (r < 0)
      throw new o.ErrnoError(28);
    var t;
    if (typeof e == "string") {
      var n = o.lookupPath(e, { follow: !0 });
      t = n.node;
    } else
      t = e;
    o.doTruncate(null, t, r);
  }, ftruncate(e, r) {
    var t = o.getStreamChecked(e);
    if (r < 0 || (t.flags & 2097155) === 0)
      throw new o.ErrnoError(28);
    o.doTruncate(t, t.node, r);
  }, utime(e, r, t, n = !1) {
    var a = o.lookupPath(e, { follow: !n });
    o.doSetAttr(null, a.node, { atime: r, mtime: t, dontFollow: n });
  }, open(e, r, t = 438) {
    if (e === "")
      throw new o.ErrnoError(44);
    r = lt(r), r & 64 ? t = t & 4095 | 32768 : t = 0;
    var n, a;
    if (typeof e == "object")
      n = e;
    else {
      a = e.endsWith("/");
      var i = o.lookupPath(e, { follow: !(r & 131072), noent_okay: !0 });
      n = i.node, e = i.path;
    }
    var s = !1;
    if (r & 64)
      if (n) {
        if (r & 128)
          throw new o.ErrnoError(20);
      } else {
        if (a)
          throw new o.ErrnoError(31);
        n = o.mknod(e, t | 511, 0), s = !0;
      }
    if (!n)
      throw new o.ErrnoError(44);
    if (o.isChrdev(n.mode) && (r &= -513), r & 65536 && !o.isDir(n.mode))
      throw new o.ErrnoError(54);
    if (!s) {
      var l = o.mayOpen(n, r);
      if (l)
        throw new o.ErrnoError(l);
    }
    r & 512 && !s && o.truncate(n, 0), r &= -131713;
    var u = o.createStream({ node: n, path: o.getPath(n), flags: r, seekable: !0, position: 0, stream_ops: n.stream_ops, ungotten: [], error: !1 });
    return u.stream_ops.open && u.stream_ops.open(u), s && o.chmod(n, t & 511), u;
  }, close(e) {
    if (o.isClosed(e))
      throw new o.ErrnoError(8);
    e.getdents && (e.getdents = null), e.node?.notifyListeners(32);
    try {
      e.stream_ops.close && e.stream_ops.close(e);
    } catch (r) {
      throw r;
    } finally {
      o.closeStream(e.fd);
    }
    e.fd = null;
  }, isClosed(e) {
    return e.fd === null;
  }, llseek(e, r, t) {
    if (o.isClosed(e))
      throw new o.ErrnoError(8);
    if (!e.seekable || !e.stream_ops.llseek)
      throw new o.ErrnoError(70);
    if (t != 0 && t != 1 && t != 2)
      throw new o.ErrnoError(28);
    return e.position = e.stream_ops.llseek(e, r, t), e.ungotten = [], e.position;
  }, read(e, r, t, n, a) {
    if (n < 0 || a < 0)
      throw new o.ErrnoError(28);
    if (o.isClosed(e))
      throw new o.ErrnoError(8);
    if ((e.flags & 2097155) === 1)
      throw new o.ErrnoError(8);
    if (o.isDir(e.node.mode))
      throw new o.ErrnoError(31);
    if (!e.stream_ops.read)
      throw new o.ErrnoError(28);
    var i = typeof a < "u";
    if (!i)
      a = e.position;
    else if (!e.seekable)
      throw new o.ErrnoError(70);
    var s = e.stream_ops.read(e, r, t, n, a);
    return i || (e.position += s), s;
  }, write(e, r, t, n, a, i) {
    if (n < 0 || a < 0)
      throw new o.ErrnoError(28);
    if (o.isClosed(e))
      throw new o.ErrnoError(8);
    if ((e.flags & 2097155) === 0)
      throw new o.ErrnoError(8);
    if (o.isDir(e.node.mode))
      throw new o.ErrnoError(31);
    if (!e.stream_ops.write)
      throw new o.ErrnoError(28);
    e.seekable && e.flags & 1024 && o.llseek(e, 0, 2);
    var s = typeof a < "u";
    if (!s)
      a = e.position;
    else if (!e.seekable)
      throw new o.ErrnoError(70);
    var l = e.stream_ops.write(e, r, t, n, a, i);
    return s || (e.position += l), l;
  }, mmap(e, r, t, n, a) {
    if (n & 2 && !(a & 2) && (e.flags & 2097155) !== 2)
      throw new o.ErrnoError(2);
    if ((e.flags & 2097155) === 1)
      throw new o.ErrnoError(2);
    if (!e.stream_ops.mmap)
      throw new o.ErrnoError(43);
    if (!r)
      throw new o.ErrnoError(28);
    return e.stream_ops.mmap(e, r, t, n, a);
  }, msync(e, r, t, n, a) {
    return e.stream_ops.msync ? e.stream_ops.msync(e, r, t, n, a) : 0;
  }, ioctl(e, r, t) {
    if (!e.stream_ops.ioctl)
      throw new o.ErrnoError(59);
    return e.stream_ops.ioctl(e, r, t);
  }, readFile(e, r = {}) {
    r.flags ?? (r.flags = 0), r.encoding ?? (r.encoding = "binary"), r.encoding !== "utf8" && r.encoding !== "binary" && I(`Invalid encoding type "${r.encoding}"`);
    var t = o.open(e, r.flags), n = o.stat(e), a = n.size, i = new Uint8Array(a);
    return o.read(t, i, 0, a, 0), r.encoding === "utf8" && (i = ce(i)), o.close(t), i;
  }, writeFile(e, r, t = {}) {
    t.flags ?? (t.flags = 577);
    var n = o.open(e, t.flags, t.mode);
    r = ar(r), o.write(n, r, 0, r.byteLength, void 0, t.canOwn), o.close(n);
  }, cwd: () => o.currentPath, chdir(e) {
    var r = o.lookupPath(e, { follow: !0 });
    if (r.node === null)
      throw new o.ErrnoError(44);
    if (!o.isDir(r.node.mode))
      throw new o.ErrnoError(54);
    var t = o.nodePermissions(r.node, "x");
    if (t)
      throw new o.ErrnoError(t);
    o.currentPath = r.path;
  }, createDefaultDirectories() {
    o.mkdir("/tmp"), o.mkdir("/home"), o.mkdir("/home/web_user");
  }, createDefaultDevices() {
    o.mkdir("/dev"), o.registerDevice(o.makedev(1, 3), { read: () => 0, write: (n, a, i, s, l) => s, llseek: () => 0 }), o.mkdev("/dev/null", o.makedev(1, 3)), ne.register(o.makedev(5, 0), ne.default_tty_ops), ne.register(o.makedev(6, 0), ne.default_tty1_ops), o.mkdev("/dev/tty", o.makedev(5, 0)), o.mkdev("/dev/tty1", o.makedev(6, 0));
    var e = new Uint8Array(1024), r = 0, t = () => (r || (er(e), r = e.byteLength), e[--r]);
    o.createDevice("/dev", "random", t), o.createDevice("/dev", "urandom", t), o.mkdir("/dev/shm"), o.mkdir("/dev/shm/tmp");
  }, createSpecialDirectories() {
    o.mkdir("/proc");
    var e = o.mkdir("/proc/self");
    o.mkdir("/proc/self/fd"), o.mount({ mount() {
      var r = o.createNode(e, "fd", 16895, 73);
      return r.stream_ops = { llseek: w.stream_ops.llseek }, r.node_ops = { lookup(t, n) {
        var a = +n, i = o.getStreamChecked(a), s = { parent: null, mount: { mountpoint: "fake" }, node_ops: { readlink: () => i.path }, id: a + 1 };
        return s.parent = s, s;
      }, readdir() {
        return Array.from(o.streams.entries()).filter(([t, n]) => n).map(([t, n]) => t.toString());
      } }, r;
    } }, {}, "/proc/self/fd");
  }, createStandardStreams(e, r, t) {
    e ? o.createDevice("/dev", "stdin", e) : o.symlink("/dev/tty", "/dev/stdin"), r ? o.createDevice("/dev", "stdout", null, r) : o.symlink("/dev/tty", "/dev/stdout"), t ? o.createDevice("/dev", "stderr", null, t) : o.symlink("/dev/tty1", "/dev/stderr"), o.open("/dev/stdin", 0), o.open("/dev/stdout", 1), o.open("/dev/stderr", 1);
  }, staticInit() {
    o.nameTable.length = 4096, o.mount(w, {}, "/"), o.createDefaultDirectories(), o.createDefaultDevices(), o.createSpecialDirectories(), o.filesystems = { MEMFS: w };
  }, init(e, r, t) {
    o.initialized = !0, e ?? (e = c.stdin), r ?? (r = c.stdout), t ?? (t = c.stderr), o.createStandardStreams(e, r, t);
  }, quit() {
    o.initialized = !1;
    for (var e of o.streams)
      e && o.close(e);
  }, analyzePath(e, r = !1) {
    try {
      var t = o.lookupPath(e, { follow: !r });
      e = t.path;
    } catch {
    }
    var n = { isRoot: !1, exists: !1, error: 0, name: null, path: null, object: null, parentExists: !1, parentPath: null, parentObject: null };
    try {
      var t = o.lookupPath(e, { parent: !0 });
      n.parentExists = !0, n.parentPath = t.path, n.parentObject = t.node, n.name = A.basename(e), t = o.lookupPath(e, { follow: !r }), n.exists = !0, n.path = t.path, n.object = t.node, n.name = t.node.name, n.isRoot = t.path === "/";
    } catch (a) {
      n.error = a.errno;
    }
    return n;
  }, createPath(e, r, t, n) {
    e = typeof e == "string" ? e : o.getPath(e);
    for (var a = r.split("/").reverse(); a.length; ) {
      var i = a.pop();
      if (i) {
        var s = A.join2(e, i);
        try {
          o.mkdir(s);
        } catch (l) {
          if (l.errno != 20) throw l;
        }
        e = s;
      }
    }
    return s;
  }, createFile(e, r, t, n, a) {
    var i = A.join2(typeof e == "string" ? e : o.getPath(e), r), s = Oe(n, a);
    return o.create(i, s);
  }, createDataFile(e, r, t, n, a, i) {
    var s = r;
    e && (e = typeof e == "string" ? e : o.getPath(e), s = r ? A.join2(e, r) : e);
    var l = Oe(n, a), u = o.create(s, l);
    if (t) {
      t = ar(t), o.chmod(u, l | 146);
      var v = o.open(u, 577);
      o.write(v, t, 0, t.length, 0, i), o.close(v), o.chmod(u, l);
    }
  }, createDevice(e, r, t, n) {
    var l;
    var a = A.join2(typeof e == "string" ? e : o.getPath(e), r), i = Oe(!!t, !!n);
    (l = o.createDevice).major ?? (l.major = 64);
    var s = o.makedev(o.createDevice.major++, 0);
    return o.registerDevice(s, { open(u) {
      u.seekable = !1;
    }, close(u) {
      n?.buffer?.length && n(10);
    }, read(u, v, m, b, E) {
      for (var h = 0, S = 0; S < b; S++) {
        var x;
        try {
          x = t();
        } catch {
          throw new o.ErrnoError(29);
        }
        if (x === void 0 && !h)
          throw new o.ErrnoError(6);
        if (x == null) break;
        h++, v[m + S] = x;
      }
      return h && (u.node.atime = Date.now()), h;
    }, write(u, v, m, b, E) {
      for (var h = 0; h < b; h++)
        try {
          n(v[m + h]);
        } catch {
          throw new o.ErrnoError(29);
        }
      return b && (u.node.mtime = u.node.ctime = Date.now()), h;
    } }), o.mkdev(a, i, s);
  }, forceLoadFile(e) {
    if (e.isDevice || e.isFolder || e.link || e.contents) return !0;
    if (globalThis.XMLHttpRequest)
      I("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
    else
      try {
        e.contents = X(e.url);
      } catch {
        throw new o.ErrnoError(29);
      }
  }, createLazyFile(e, r, t, n, a) {
    class i {
      constructor() {
        $(this, "lengthKnown", !1);
        $(this, "chunks", []);
      }
      get(E) {
        if (!(E > this.length - 1 || E < 0)) {
          var h = E % this.chunkSize, S = E / this.chunkSize | 0;
          return this.getter(S)[h];
        }
      }
      setDataGetter(E) {
        this.getter = E;
      }
      cacheLength() {
        var E = new XMLHttpRequest();
        E.open("HEAD", t, !1), E.send(null), E.status >= 200 && E.status < 300 || E.status === 304 || I(`Couldn't load ${t}. Status: ${E.status}`);
        var h = Number(E.getResponseHeader("Content-length")), S, x = (S = E.getResponseHeader("Accept-Ranges")) && S === "bytes", B = (S = E.getResponseHeader("Content-Encoding")) && S === "gzip", U = 1024 * 1024;
        x || (U = h);
        var z = (Y, _e) => {
          Y > _e && I(`invalid range (${Y}, ${_e}) or no bytes requested!`), _e > h - 1 && I(`only ${h} bytes available! programmer error!`);
          var O = new XMLHttpRequest();
          return O.open("GET", t, !1), h !== U && O.setRequestHeader("Range", `bytes=${Y}-${_e}`), O.responseType = "arraybuffer", O.overrideMimeType && O.overrideMimeType("text/plain; charset=x-user-defined"), O.send(null), O.status >= 200 && O.status < 300 || O.status === 304 || I(`Couldn't load ${t}. Status: ${O.status}`), O.response !== void 0 ? new Uint8Array(O.response || []) : Be(O.responseText ?? "");
        }, ye = this;
        ye.setDataGetter((Y) => {
          var _e = Y * U, O = (Y + 1) * U - 1;
          return O = Math.min(O, h - 1), typeof ye.chunks[Y] > "u" && (ye.chunks[Y] = z(_e, O)), typeof ye.chunks[Y] > "u" && I("doXHR failed!"), ye.chunks[Y];
        }), (B || !h) && (U = h = 1, h = this.getter(0).length, U = h, xe("LazyFiles on gzip forces download of the whole file when length is accessed")), this._length = h, this._chunkSize = U, this.lengthKnown = !0;
      }
      get length() {
        return this.lengthKnown || this.cacheLength(), this._length;
      }
      get chunkSize() {
        return this.lengthKnown || this.cacheLength(), this._chunkSize;
      }
    }
    if (globalThis.XMLHttpRequest) {
      p || I("Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc");
      var s = new i(), l = { isDevice: !1, contents: s };
    } else
      var l = { isDevice: !1, url: t };
    var u = o.createFile(e, r, l, n, a);
    l.contents ? u.contents = l.contents : l.url && (u.contents = null, u.url = l.url), Object.defineProperties(u, { usedBytes: { get: function() {
      return this.contents.length;
    } } });
    var v = {};
    for (const [b, E] of Object.entries(u.stream_ops))
      v[b] = (...h) => (o.forceLoadFile(u), E(...h));
    function m(b, E, h, S, x) {
      var B = b.node.contents;
      if (x >= B.length) return 0;
      var U = Math.min(B.length - x, S);
      if (B.slice)
        for (var z = 0; z < U; z++)
          E[h + z] = B[x + z];
      else
        for (var z = 0; z < U; z++)
          E[h + z] = B.get(x + z);
      return U;
    }
    return v.read = (b, E, h, S, x) => (o.forceLoadFile(u), m(b, E, h, S, x)), v.mmap = (b, E, h, S, x) => {
      o.forceLoadFile(u);
      var B = or();
      if (!B)
        throw new o.ErrnoError(48);
      return m(b, L, B, E, h), { ptr: B, allocated: !0 };
    }, u.stream_ops = v, u;
  } }, G, We = (e, r, t) => (e >>>= 0, e ? ce(G, e, r, t) : ""), M, k, N, W = { currentUmask: 18, calculateAt(e, r, t = !1) {
    if (A.isAbs(r))
      return r;
    var n;
    if (e === -100)
      n = o.cwd();
    else {
      var a = W.getStreamFromFD(e);
      n = a.path;
    }
    if (r.length == 0) {
      if (!t)
        throw new o.ErrnoError(44);
      return n;
    }
    return n + "/" + r;
  }, writeStat(e, r) {
    k[e >>> 2 >>> 0] = r.dev, k[e + 4 >>> 2 >>> 0] = r.mode, k[e + 8 >>> 2 >>> 0] = r.nlink, k[e + 12 >>> 2 >>> 0] = r.uid, k[e + 16 >>> 2 >>> 0] = r.gid, k[e + 20 >>> 2 >>> 0] = r.rdev, N[e + 24 >>> 3 >>> 0] = BigInt(r.size), M[e + 32 >>> 2 >>> 0] = 4096, M[e + 36 >>> 2 >>> 0] = r.blocks;
    var t = r.atimeMs ?? r.atime.getTime(), n = r.mtimeMs ?? r.mtime.getTime(), a = r.ctimeMs ?? r.ctime.getTime();
    return N[e + 40 >>> 3 >>> 0] = BigInt(Math.floor(t / 1e3)), k[e + 48 >>> 2 >>> 0] = Math.floor(t % 1e3 * 1e6), N[e + 56 >>> 3 >>> 0] = BigInt(Math.floor(n / 1e3)), k[e + 64 >>> 2 >>> 0] = Math.floor(n % 1e3 * 1e6), N[e + 72 >>> 3 >>> 0] = BigInt(Math.floor(a / 1e3)), k[e + 80 >>> 2 >>> 0] = Math.floor(a % 1e3 * 1e6), N[e + 88 >>> 3 >>> 0] = BigInt(r.ino), 0;
  }, writeStatFs(e, r) {
    k[e + 4 >>> 2 >>> 0] = r.bsize, k[e + 60 >>> 2 >>> 0] = r.bsize, N[e + 8 >>> 3 >>> 0] = BigInt(r.blocks), N[e + 16 >>> 3 >>> 0] = BigInt(r.bfree), N[e + 24 >>> 3 >>> 0] = BigInt(r.bavail), N[e + 32 >>> 3 >>> 0] = BigInt(r.files), N[e + 40 >>> 3 >>> 0] = BigInt(r.ffree), k[e + 48 >>> 2 >>> 0] = r.fsid, k[e + 64 >>> 2 >>> 0] = r.flags, k[e + 56 >>> 2 >>> 0] = r.namelen;
  }, doMsync(e, r, t, n, a) {
    if (!o.isFile(r.node.mode))
      throw new o.ErrnoError(43);
    if (n & 2)
      return 0;
    var i = G.subarray(e >>> 0, e + t >>> 0);
    o.msync(r, i, a, t, n);
  }, getStreamFromFD(e) {
    var r = o.getStreamChecked(e);
    return r;
  }, varargs: void 0, getStr(e) {
    var r = We(e);
    return r;
  } };
  function gt(e, r, t) {
    try {
      if (e === r || t & -524289) return -28;
      var n = W.getStreamFromFD(e);
      if (r < 0 || r >= o.MAX_OPEN_FDS) return -8;
      var a = o.getStream(r);
      a && o.close(a);
      var i = o.dupStream(n, r);
      return t & 524288 && (i.flags |= 524288), i.fd;
    } catch (s) {
      if (typeof o > "u" || s.name !== "ErrnoError") throw s;
      return -s.errno;
    }
  }
  var Se = () => {
    var e = M[+W.varargs >>> 2 >>> 0];
    return W.varargs += 4, e;
  }, ue = Se, mt = 9007199254740992, yt = -9007199254740992, wt = (e) => e < yt || e > mt ? NaN : Number(e), ae;
  function bt(e, r, t) {
    t >>>= 0, W.varargs = t;
    try {
      var n = W.getStreamFromFD(e);
      switch (r) {
        case 0: {
          var a = Se();
          if (a < 0)
            return -28;
          for (; o.streams[a]; )
            a++;
          var i;
          return i = o.dupStream(n, a), i.fd;
        }
        case 1:
        case 2:
          return 0;
        case 3:
          return n.flags;
        case 4: {
          var a = Se(), s = 289792;
          return n.flags = n.flags & ~s | a & s, 0;
        }
        case 12: {
          var a = ue(), l = 0;
          return ae[a + l >>> 1 >>> 0] = 2, 0;
        }
        case 13:
        case 14:
          return 0;
      }
      return -28;
    } catch (u) {
      if (typeof o > "u" || u.name !== "ErrnoError") throw u;
      return -u.errno;
    }
  }
  function Et(e, r, t) {
    t >>>= 0, W.varargs = t;
    try {
      var n = W.getStreamFromFD(e);
      switch (r) {
        case 21509:
          return n.tty ? 0 : -59;
        case 21505: {
          if (!n.tty) return -59;
          if (n.tty.ops.ioctl_tcgets) {
            var a = n.tty.ops.ioctl_tcgets(n), i = ue();
            M[i >>> 2 >>> 0] = a.c_iflag || 0, M[i + 4 >>> 2 >>> 0] = a.c_oflag || 0, M[i + 8 >>> 2 >>> 0] = a.c_cflag || 0, M[i + 12 >>> 2 >>> 0] = a.c_lflag || 0;
            for (var s = 0; s < 32; s++)
              L[i + s + 17 >>> 0] = a.c_cc[s] || 0;
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
            for (var i = ue(), l = M[i >>> 2 >>> 0], u = M[i + 4 >>> 2 >>> 0], v = M[i + 8 >>> 2 >>> 0], m = M[i + 12 >>> 2 >>> 0], b = [], s = 0; s < 32; s++)
              b.push(L[i + s + 17 >>> 0]);
            return n.tty.ops.ioctl_tcsets(n.tty, r, { c_iflag: l, c_oflag: u, c_cflag: v, c_lflag: m, c_cc: b });
          }
          return 0;
        }
        case 21519: {
          if (!n.tty) return -59;
          var i = ue();
          return M[i >>> 2 >>> 0] = 0, 0;
        }
        case 21520:
          return n.tty ? -28 : -59;
        case 21537:
        case 21531: {
          var i = ue();
          return o.ioctl(n, r, i);
        }
        case 21523: {
          if (!n.tty) return -59;
          if (n.tty.ops.ioctl_tiocgwinsz) {
            var E = n.tty.ops.ioctl_tiocgwinsz(n.tty), i = ue();
            ae[i >>> 1 >>> 0] = E[0], ae[i + 2 >>> 1 >>> 0] = E[1];
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
      if (typeof o > "u" || h.name !== "ErrnoError") throw h;
      return -h.errno;
    }
  }
  function kt(e, r, t, n) {
    r >>>= 0, n >>>= 0, W.varargs = n;
    try {
      r = W.getStr(r), r = W.calculateAt(e, r);
      var a = n ? Se() : 0;
      return t & 64 && (a &= ~W.currentUmask), o.open(r, t, a).fd;
    } catch (i) {
      if (typeof o > "u" || i.name !== "ErrnoError") throw i;
      return -i.errno;
    }
  }
  var xt = () => I(""), j = (e) => {
    e >>>= 0;
    for (var r = ""; ; ) {
      var t = G[e++ >>> 0];
      if (!t) return r;
      r += String.fromCharCode(t);
    }
  }, fe = {}, ie = {}, Fe = {};
  class St extends Error {
    constructor(r) {
      super(r), this.name = "BindingError";
    }
  }
  var V = (e) => {
    throw new St(e);
  };
  function Ft(e, r, t = {}) {
    var n = r.name;
    if (e || V(`type "${n}" must have a positive integer typeid pointer`), ie.hasOwnProperty(e)) {
      if (t.ignoreDuplicateRegistrations)
        return;
      V(`Cannot register type '${n}' twice`);
    }
    if (ie[e] = r, delete Fe[e], fe.hasOwnProperty(e)) {
      var a = fe[e];
      delete fe[e], a.forEach((i) => i());
    }
  }
  function q(e, r, t = {}) {
    return Ft(e, r, t);
  }
  var ge, cr, ur = (e, r, t) => {
    switch (r) {
      case 1:
        return t ? (n) => L[n >>> 0] : (n) => G[n >>> 0];
      case 2:
        return t ? (n) => ae[n >>> 1 >>> 0] : (n) => ge[n >>> 1 >>> 0];
      case 4:
        return t ? (n) => M[n >>> 2 >>> 0] : (n) => k[n >>> 2 >>> 0];
      case 8:
        return t ? (n) => N[n >>> 3 >>> 0] : (n) => cr[n >>> 3 >>> 0];
      default:
        throw new TypeError(`invalid integer width (${r}): ${e}`);
    }
  }, Pt = function(e, r, t, n, a) {
    e >>>= 0, r >>>= 0, t >>>= 0, r = j(r);
    const i = n === 0n;
    let s = (l) => l;
    if (i) {
      const l = t * 8;
      s = (u) => BigInt.asUintN(l, u), a = s(a);
    }
    q(e, { name: r, fromWireType: s, toWireType: (l, u) => (typeof u == "number" && (u = BigInt(u)), u), readValueFromPointer: ur(r, t, !i), destructorFunction: null });
  };
  function Tt(e, r, t, n) {
    e >>>= 0, r >>>= 0, r = j(r), q(e, { name: r, fromWireType: function(a) {
      return !!a;
    }, toWireType: function(a, i) {
      return i ? t : n;
    }, readValueFromPointer: function(a) {
      return this.fromWireType(G[a >>> 0]);
    }, destructorFunction: null });
  }
  class At extends Error {
    constructor(r) {
      super(r), this.name = "InternalError";
    }
  }
  var fr = (e) => {
    throw new At(e);
  }, dr = (e, r, t) => {
    e.forEach((l) => Fe[l] = r);
    function n(l) {
      var u = t(l);
      u.length !== e.length && fr("Mismatched type converter count");
      for (var v = 0; v < e.length; ++v)
        q(e[v], u[v]);
    }
    var a = new Array(r.length), i = [], s = 0;
    for (let [l, u] of r.entries())
      ie.hasOwnProperty(u) ? a[l] = ie[u] : (i.push(u), fe.hasOwnProperty(u) || (fe[u] = []), fe[u].push(() => {
        a[l] = ie[u], ++s, s === i.length && n(a);
      }));
    i.length === 0 && n(a);
  }, Dt = function(e, r, t) {
    e >>>= 0, r >>>= 0, e = j(e), dr([], [r], (n) => (n = n[0], c[e] = n.fromWireType(t), []));
  }, vr = [], Q = [0, 1, , 1, null, 1, !0, 1, !1, 1], _r = [];
  function Ne(e) {
    if (e >>>= 0, e > 9 && --Q[e + 1] === 0) {
      var r = Q[e];
      Q[e] = void 0;
      var t = _r[e];
      t && (_r[e] = void 0, t(r)), vr.push(e);
    }
  }
  var R = { toValue: (e) => (e || V(`Cannot use deleted val. handle = ${e}`), Q[e]), toHandle: (e) => {
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
        const r = vr.pop() || Q.length;
        return Q[r] = e, Q[r + 1] = 1, r;
      }
    }
  } };
  function Ue(e) {
    return this.fromWireType(k[e >>> 2 >>> 0]);
  }
  var Ct = { name: "emscripten::val", fromWireType: (e) => {
    var r = R.toValue(e);
    return Ne(e), r;
  }, toWireType: (e, r) => R.toHandle(r), readValueFromPointer: Ue, destructorFunction: null };
  function Rt(e) {
    return e >>>= 0, q(e, Ct);
  }
  var pr, hr, $t = (e, r) => {
    switch (r) {
      case 4:
        return function(t) {
          return this.fromWireType(pr[t >>> 2 >>> 0]);
        };
      case 8:
        return function(t) {
          return this.fromWireType(hr[t >>> 3 >>> 0]);
        };
      default:
        throw new TypeError(`invalid float width (${r}): ${e}`);
    }
  }, Mt = function(e, r, t) {
    e >>>= 0, r >>>= 0, t >>>= 0, r = j(r), q(e, { name: r, fromWireType: (n) => n, toWireType: (n, a) => a, readValueFromPointer: $t(r, t), destructorFunction: null });
  }, gr = (e, r) => Object.defineProperty(r, "name", { value: e }), mr = (e) => {
    for (; e.length; ) {
      var r = e.pop(), t = e.pop();
      t(r);
    }
  };
  function yr(e) {
    for (var r = 1; r < e.length; ++r)
      if (e[r] !== null && e[r].destructorFunction === void 0)
        return !0;
    return !1;
  }
  function wr(e) {
    for (var r = 1; r < e.length; ++r)
      if (e[r] !== null && e[r].argStackAlloc)
        return !0;
    return !1;
  }
  var br = () => Cr(), Er = (e) => Dr(e);
  function Bt(e, r, t, n) {
    var a = yr(e), i = wr(e), s = i && !n && !a;
    i && !s && (a = !0);
    for (var l = e.length - 2, u = [], v = ["fn"], m = 0; m < l; ++m)
      u.push(`arg${m}`), v.push(`arg${m}Wired`);
    u = u.join(), v = v.join();
    var b = `return function (${u}) {
`;
    a && (b += `var destructors = [];
`), s && (b += `var sp = stackSave();
try {
`);
    var E = a ? "destructors" : "null", h = ["humanName", "throwBindingError", "invoker", "fn", "runDestructors", "fromRetWire", "toClassParamWire"];
    s && h.push("stackSave", "stackRestore");
    for (var m = 0; m < l; ++m) {
      var S = `toArg${m}Wire`;
      b += `var arg${m}Wired = ${S}(${E}, arg${m});
`, h.push(S);
    }
    if (b += (t || n ? "var rv = " : "") + `invoker(${v});
`, s && (b += `} finally {
stackRestore(sp);
}
`), a)
      b += `runDestructors(destructors);
`;
    else
      for (var m = 2; m < e.length; ++m) {
        var x = m === 1 ? "thisWired" : `arg${m - 2}Wired`;
        e[m].destructorFunction !== null && (b += `${x}_dtor(${x});
`, h.push(`${x}_dtor`));
      }
    return t && (b += `var ret = fromRetWire(rv);
return ret;
`), b += `}
`, new Function(h, b);
  }
  function Ot(e, r, t, n, a, i) {
    var s = r.length;
    s < 2 && V("argTypes array size mismatch! Must at least get return value and receiver (this) types!");
    var l = r[1] !== null && t !== null, u = yr(r), v = wr(r), m = v && !i && !u;
    v && !m && (u = !0);
    var b = !r[0].isVoid, E = r[0], h = r[1], S = [e, V, n, a, mr, E.fromWireType.bind(E), h?.toWireType.bind(h)];
    m && S.push(br, Er);
    for (var x = 2; x < s; ++x) {
      var B = r[x];
      S.push(B.toWireType.bind(B));
    }
    if (!u)
      for (var x = 2; x < r.length; ++x)
        r[x].destructorFunction !== null && S.push(r[x].destructorFunction);
    var z = Bt(r, l, b, i)(...S);
    return gr(e, z);
  }
  var Wt = (e, r, t) => {
    if (e[r].overloadTable === void 0) {
      var n = e[r];
      e[r] = function(...a) {
        return e[r].overloadTable.hasOwnProperty(a.length) || V(`Function '${t}' called with an invalid number of arguments (${a.length}) - expects one of (${e[r].overloadTable})!`), e[r].overloadTable[a.length].apply(this, a);
      }, e[r].overloadTable = [], e[r].overloadTable[n.argCount] = n;
    }
  }, Nt = (e, r, t) => {
    c.hasOwnProperty(e) ? ((t === void 0 || c[e].overloadTable !== void 0 && c[e].overloadTable[t] !== void 0) && V(`Cannot register public name '${e}' twice`), Wt(c, e, e), c[e].overloadTable.hasOwnProperty(t) && V(`Cannot register multiple overloads of a function with the same number of arguments (${t})!`), c[e].overloadTable[t] = r) : (c[e] = r, c[e].argCount = t);
  }, Ut = (e, r) => {
    for (var t = [], n = 0; n < e; n++)
      t.push(k[r + n * 4 >>> 2 >>> 0]);
    return t;
  }, jt = (e, r, t) => {
    c.hasOwnProperty(e) || fr("Replacing nonexistent public symbol"), c[e].overloadTable !== void 0 && t !== void 0 ? c[e].overloadTable[t] = r : (c[e] = r, c[e].argCount = t);
  }, kr = [], xr = (e) => {
    var r = kr[e];
    return r || (kr[e] = r = Br.get(e)), r;
  }, zt = (e, r, t = [], n = !1) => {
    var a = xr(r), i = a(...t);
    function s(l) {
      return e[0] == "p" ? l >>> 0 : l;
    }
    return s(i);
  }, Lt = (e, r, t = !1) => (...n) => zt(e, r, n, t), Vt = (e, r, t = !1) => {
    e = j(e);
    function n() {
      if (e.includes("p"))
        return Lt(e, r, t);
      var i = xr(r);
      return i;
    }
    var a = n();
    return typeof a != "function" && V(`unknown function pointer with signature ${e}: ${r}`), a;
  };
  class Ht extends Error {
  }
  var Sr = (e) => {
    var r = Tr(e), t = j(r);
    return ee(r), t;
  }, It = (e, r) => {
    var t = [], n = {};
    function a(i) {
      if (!n[i] && !ie[i]) {
        if (Fe[i]) {
          Fe[i].forEach(a);
          return;
        }
        t.push(i), n[i] = !0;
      }
    }
    throw r.forEach(a), new Ht(`${e}: ` + t.map(Sr).join([", "]));
  }, Xt = (e) => {
    e = e.trim();
    const r = e.indexOf("(");
    return r === -1 ? e : e.slice(0, r);
  };
  function Gt(e, r, t, n, a, i, s, l) {
    e >>>= 0, t >>>= 0, n >>>= 0, a >>>= 0, i >>>= 0;
    var u = Ut(r, t);
    e = j(e), e = Xt(e), a = Vt(n, a, s), Nt(e, function() {
      It(`Cannot call ${e} due to unbound types`, u);
    }, r - 1), dr([], u, (v) => {
      var m = [v[0], null].concat(v.slice(1));
      return jt(e, Ot(e, m, null, a, i, s), r - 1), [];
    });
  }
  var qt = function(e, r, t, n, a) {
    e >>>= 0, r >>>= 0, t >>>= 0, r = j(r);
    const i = n === 0;
    let s = (u) => u;
    if (i) {
      var l = 32 - 8 * t;
      s = (u) => u << l >>> l, a = s(a);
    }
    q(e, { name: r, fromWireType: s, toWireType: (u, v) => v, readValueFromPointer: ur(r, t, n !== 0), destructorFunction: null });
  };
  function Yt(e, r, t) {
    e >>>= 0, t >>>= 0;
    var n = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array], a = n[r];
    function i(s) {
      var l = k[s >>> 2 >>> 0], u = k[s + 4 >>> 2 >>> 0];
      return new a(L.buffer, u, l);
    }
    t = j(t), q(e, { name: t, fromWireType: i, readValueFromPointer: i }, { ignoreDuplicateRegistrations: !0 });
  }
  var de = (e, r, t) => nr(e, G, r, t);
  function Kt(e, r) {
    e >>>= 0, r >>>= 0, r = j(r), q(e, { name: r, fromWireType(t) {
      var n = k[t >>> 2 >>> 0], a = t + 4, i;
      return i = We(a, n, !0), ee(t), i;
    }, toWireType(t, n) {
      n instanceof ArrayBuffer && (n = new Uint8Array(n));
      var a, i = typeof n == "string";
      i || ArrayBuffer.isView(n) && n.BYTES_PER_ELEMENT == 1 || V("Cannot pass non-string to std::string"), i ? a = Me(n) : a = n.length;
      var s = Ve(4 + a + 1), l = s + 4;
      return k[s >>> 2 >>> 0] = a, i ? de(n, l, a + 1) : G.set(n, l >>> 0), t !== null && t.push(ee, s), s;
    }, readValueFromPointer: Ue, destructorFunction(t) {
      ee(t);
    } });
  }
  var Fr = globalThis.TextDecoder ? new TextDecoder("utf-16le") : void 0, Zt = (e, r, t) => {
    var n = e >>> 1, a = tr(ge, n, r / 2, t);
    if (a - n > 16 && Fr) return Fr.decode(ge.subarray(n >>> 0, a >>> 0));
    for (var i = "", s = n; s < a; ++s) {
      var l = ge[s >>> 0];
      i += String.fromCharCode(l);
    }
    return i;
  }, Jt = (e, r, t = 2147483647) => {
    if (t < 2) return 0;
    t -= 2;
    for (var n = r, a = t < e.length * 2 ? t / 2 : e.length, i = 0; i < a; ++i) {
      var s = e.charCodeAt(i);
      ae[r >>> 1 >>> 0] = s, r += 2;
    }
    return ae[r >>> 1 >>> 0] = 0, r - n;
  }, Qt = (e) => e.length * 2, en = (e, r, t) => {
    for (var n = "", a = e >>> 2, i = 0; !(i >= r / 4); i++) {
      var s = k[a + i >>> 0];
      if (!s && !t) break;
      n += String.fromCodePoint(s);
    }
    return n;
  }, rn = (e, r, t = 2147483647) => {
    if (r >>>= 0, t < 4) return 0;
    for (var n = r, a = n + t - 4, i = 0; i < e.length; ++i) {
      var s = e.codePointAt(i);
      if (s > 65535 && i++, M[r >>> 2 >>> 0] = s, r += 4, r + 4 > a) break;
    }
    return M[r >>> 2 >>> 0] = 0, r - n;
  }, tn = (e) => {
    for (var r = 0, t = 0; t < e.length; ++t) {
      var n = e.codePointAt(t);
      n > 65535 && t++, r += 4;
    }
    return r;
  };
  function nn(e, r, t) {
    e >>>= 0, r >>>= 0, t >>>= 0, t = j(t);
    var n, a, i;
    r === 2 ? (n = Zt, a = Jt, i = Qt) : (n = en, a = rn, i = tn), q(e, { name: t, fromWireType: (s) => {
      var l = k[s >>> 2 >>> 0], u = n(s + 4, l * r, !0);
      return ee(s), u;
    }, toWireType: (s, l) => {
      typeof l != "string" && V(`Cannot pass non-string to C++ string type ${t}`);
      var u = i(l), v = Ve(4 + u + r);
      return k[v >>> 2 >>> 0] = u / r, a(l, v + 4, u + r), s !== null && s.push(ee, v), v;
    }, readValueFromPointer: Ue, destructorFunction(s) {
      ee(s);
    } });
  }
  var on = function(e, r) {
    e >>>= 0, r >>>= 0, r = j(r), q(e, { isVoid: !0, name: r, fromWireType: () => {
    }, toWireType: (t, n) => {
    } });
  };
  function an(e, r) {
    e >>>= 0, r >>>= 0, e = R.toValue(e), r = R.toValue(r), e.set(r);
  }
  var je = [], sn = (e) => {
    var r = je.length;
    return je.push(e), r;
  }, ln = (e, r) => {
    var t = ie[e];
    return t === void 0 && V(`${r} has unknown type ${Sr(e)}`), t;
  }, cn = (e, r) => {
    for (var t = new Array(e), n = 0; n < e; ++n)
      t[n] = ln(k[r + n * 4 >>> 2 >>> 0], `parameter ${n}`);
    return t;
  }, un = (e, r, t) => {
    var n = [], a = e(n, t);
    return n.length && (k[r >>> 2 >>> 0] = R.toHandle(n)), a;
  }, fn = {}, ze = (e) => {
    var r = fn[e];
    return r === void 0 ? j(e) : r;
  }, dn = function(e, r, t) {
    r >>>= 0;
    var n = 8, [a, ...i] = cn(e, r), s = a.toWireType.bind(a), l = i.map((h) => h.readValueFromPointer.bind(h));
    e--;
    var u = { toValue: R.toValue }, v = l.map((h, S) => {
      var x = `argFromPtr${S}`;
      return u[x] = h, `${x}(args${S ? "+" + S * n : ""})`;
    }), m;
    switch (t) {
      case 0:
        m = "toValue(handle)";
        break;
      case 2:
        m = "new (toValue(handle))";
        break;
      case 3:
        m = "";
        break;
      case 1:
        u.getStringOrSymbol = ze, m = "toValue(handle)[getStringOrSymbol(methodName)]";
        break;
    }
    m += `(${v})`, a.isVoid || (u.toReturnWire = s, u.emval_returnValue = un, m = `return emval_returnValue(toReturnWire, destructorsRef, ${m})`), m = `return function (handle, methodName, destructorsRef, args) {
${m}
}`;
    var b = new Function(Object.keys(u), m)(...Object.values(u)), E = `methodCaller<(${i.map((h) => h.name)}) => ${a.name}>`;
    return sn(gr(E, b));
  };
  function vn(e) {
    return e >>>= 0, e ? (e = ze(e), R.toHandle(globalThis[e])) : R.toHandle(globalThis);
  }
  function _n(e, r) {
    return e >>>= 0, r >>>= 0, e = R.toValue(e), r = R.toValue(r), R.toHandle(e[r]);
  }
  function pn(e) {
    e >>>= 0, e > 9 && (Q[e + 1] += 1);
  }
  function hn(e, r, t, n, a) {
    return e >>>= 0, r >>>= 0, t >>>= 0, n >>>= 0, a >>>= 0, je[e](r, t, n, a);
  }
  function gn(e) {
    return e >>>= 0, e = R.toValue(e), typeof e == "number";
  }
  function mn(e) {
    return e >>>= 0, e = R.toValue(e), typeof e == "string";
  }
  function yn() {
    return R.toHandle([]);
  }
  function wn(e) {
    return e >>>= 0, R.toHandle(ze(e));
  }
  function bn() {
    return R.toHandle({});
  }
  function En(e) {
    return e >>>= 0, R.toHandle(We(e));
  }
  function kn(e) {
    e >>>= 0;
    var r = R.toValue(e);
    mr(r), Ne(e);
  }
  function xn(e, r, t) {
    e >>>= 0, r >>>= 0, t >>>= 0, e = R.toValue(e), r = R.toValue(r), t = R.toValue(t), e[r] = t;
  }
  var Sn = () => Mr, Fn = (e) => {
    var r = e.getArg(Sn(), 0);
    return $r(r);
  }, Pn = (e) => {
    var r = Fn(e);
    Rr(r);
  }, Tn = (e) => e instanceof WebAssembly.Exception;
  function An(e) {
    throw e >>>= 0, e = R.toValue(e), Tn(e) && (Or(), Pn(e)), e;
  }
  function Dn(e) {
    return e >>>= 0, e = R.toValue(e), R.toHandle(typeof e);
  }
  var Cn = function(e, r, t, n) {
    e >>>= 0, r >>>= 0, t >>>= 0, n >>>= 0;
    var a = (/* @__PURE__ */ new Date()).getFullYear(), i = new Date(a, 0, 1), s = new Date(a, 6, 1), l = i.getTimezoneOffset(), u = s.getTimezoneOffset(), v = Math.max(l, u);
    k[e >>> 2 >>> 0] = v * 60, M[r >>> 2 >>> 0] = +(l != u);
    var m = (h) => {
      var S = h >= 0 ? "-" : "+", x = Math.abs(h), B = String(Math.floor(x / 60)).padStart(2, "0"), U = String(x % 60).padStart(2, "0");
      return `UTC${S}${B}${U}`;
    }, b = m(l), E = m(u);
    u < l ? (de(b, t, 17), de(E, n, 17)) : (de(b, n, 17), de(E, t, 17));
  }, Rn = () => performance.now(), $n = () => Date.now(), Mn = (e) => e >= 0 && e <= 3;
  function Bn(e, r, t) {
    if (t >>>= 0, !Mn(e))
      return 28;
    var n;
    e === 0 ? n = $n() : n = Rn();
    var a = Math.round(n * 1e6);
    return N[t >>> 3 >>> 0] = BigInt(a), 0;
  }
  var Pr = () => 4294901760;
  function On() {
    return Pr();
  }
  var Wn = (e, r) => Math.ceil(e / r) * r, Nn = (e) => {
    var r = Pe.buffer.byteLength, t = (e - r + 65535) / 65536 | 0;
    try {
      return Pe.grow(t), Ye(), 1;
    } catch {
    }
  };
  function Un(e) {
    e >>>= 0;
    var r = G.length, t = Pr();
    if (e > t)
      return !1;
    for (var n = 1; n <= 4; n *= 2) {
      var a = r * (1 + 0.2 / n);
      a = Math.min(a, e + 100663296);
      var i = Math.min(t, Wn(Math.max(e, a), 65536)), s = Nn(i);
      if (s)
        return !0;
    }
    return !1;
  }
  var Le = {}, jn = () => g, me = () => {
    if (!me.strings) {
      var e = (globalThis.navigator?.language ?? "C").replace("-", "_") + ".UTF-8", r = { USER: "web_user", LOGNAME: "web_user", PATH: "/", PWD: "/", HOME: "/home/web_user", LANG: e, _: jn() };
      for (var t in Le)
        Le[t] === void 0 ? delete r[t] : r[t] = Le[t];
      var n = [];
      for (var t in r)
        n.push(`${t}=${r[t]}`);
      me.strings = n;
    }
    return me.strings;
  };
  function zn(e, r) {
    e >>>= 0, r >>>= 0;
    var t = 0, n = 0;
    for (var a of me()) {
      var i = r + t;
      k[e + n >>> 2 >>> 0] = i, t += de(a, i, 1 / 0) + 1, n += 4;
    }
    return 0;
  }
  function Ln(e, r) {
    e >>>= 0, r >>>= 0;
    var t = me();
    k[e >>> 2 >>> 0] = t.length;
    var n = 0;
    for (var a of t)
      n += Me(a) + 1;
    return k[r >>> 2 >>> 0] = n, 0;
  }
  var Vn = 0, Hn = () => Qe || Vn > 0, In = (e) => {
    Hn() || (c.onExit?.(e), Ce = !0), T(e, new at(e));
  }, Xn = (e, r) => {
    In(e);
  }, Gn = Xn;
  function qn(e) {
    try {
      var r = W.getStreamFromFD(e);
      return o.close(r), 0;
    } catch (t) {
      if (typeof o > "u" || t.name !== "ErrnoError") throw t;
      return t.errno;
    }
  }
  var Yn = (e, r, t, n) => {
    for (var a = 0, i = 0; i < t; i++) {
      var s = k[r >>> 2 >>> 0], l = k[r + 4 >>> 2 >>> 0];
      r += 8;
      try {
        var u = o.read(e, L, s, l, n);
      } catch (v) {
        if (a > 0 && v instanceof o.ErrnoError && (v.errno == 6 || v.errno == 6))
          break;
        throw v;
      }
      if (u < 0) return -1;
      if (a += u, u < l) break;
    }
    return a;
  };
  function Kn(e, r, t, n) {
    r >>>= 0, t >>>= 0, n >>>= 0;
    try {
      var a = W.getStreamFromFD(e), i = Yn(a, r, t);
      return k[n >>> 2 >>> 0] = i, 0;
    } catch (s) {
      if (typeof o > "u" || s.name !== "ErrnoError") throw s;
      return s.errno;
    }
  }
  function Zn(e, r, t, n) {
    r = wt(r), n >>>= 0;
    try {
      if (isNaN(r)) return 22;
      var a = W.getStreamFromFD(e);
      return o.llseek(a, r, t), N[n >>> 3 >>> 0] = BigInt(a.position), a.getdents && !r && t === 0 && (a.getdents = null), 0;
    } catch (i) {
      if (typeof o > "u" || i.name !== "ErrnoError") throw i;
      return i.errno;
    }
  }
  var Jn = (e, r, t, n) => {
    if (t == 1)
      return o.write(e, L, k[r >>> 2 >>> 0], k[r + 4 >>> 2 >>> 0], n);
    for (var a = 0, i = 0, s = r; i < t; i++, s += 8)
      a += k[s + 4 >>> 2 >>> 0];
    for (var l = new Uint8Array(a), u = 0, i = 0; i < t; i++, r += 8) {
      var v = k[r >>> 2 >>> 0], m = k[r + 4 >>> 2 >>> 0];
      l.set(G.subarray(v >>> 0, v + m >>> 0), u), u += m;
    }
    return o.write(e, l, 0, a, n);
  };
  function Qn(e, r, t, n) {
    r >>>= 0, t >>>= 0, n >>>= 0;
    try {
      var a = W.getStreamFromFD(e), i = Jn(a, r, t);
      return k[n >>> 2 >>> 0] = i, 0;
    } catch (s) {
      if (typeof o > "u" || s.name !== "ErrnoError") throw s;
      return s.errno;
    }
  }
  o.createPreloadedFile = ht, o.preloadFile = lr, o.staticInit();
  {
    c.noExitRuntime && (Qe = c.noExitRuntime), c.print && (xe = c.print), c.printErr && (J = c.printErr), c.arguments && c.arguments, c.thisProgram && (g = c.thisProgram);
    var ve = c.preInit;
    if (ve)
      for (typeof ve == "function" && (c.preInit = ve = [ve]); ve.length > 0; )
        ve.shift()();
  }
  c.stackSave = br, c.stackRestore = Er, c.FS = o;
  var Tr, Ve, ee, Ar, Dr, Cr, Rr, $r, Mr, Pe, Br, Or;
  function eo(e) {
    Tr = e.U, Ve = e.X, ee = e.Y, Ar = e.Z, Dr = e._, Cr = e.$, Rr = e.aa, $r = e.ba, Or = e.ca, Pe = e.S, Mr = e.V, Br = e.W;
  }
  var ro = { G: gt, r: bt, I: Et, J: kt, E: xt, y: Pt, P: Tt, l: Dt, N: Rt, x: Mt, b: Gt, p: qt, n: Yt, O: Kt, s: nn, Q: on, M: an, e: dn, a: Ne, m: vn, j: _n, k: pn, d: hn, o: gn, w: mn, g: yn, f: wn, i: bn, L: En, c: kn, h: xn, R: An, q: Dn, B: Cn, C: Bn, K: On, D: Un, z: zn, A: Ln, v: Gn, t: qn, H: Kn, F: Zn, u: Qn };
  function to(e) {
    e = Object.assign({}, e);
    var r = (n) => (a) => n(a) >>> 0, t = (n) => () => n() >>> 0;
    return e.U = r(e.U), e.X = r(e.X), e._emscripten_stack_alloc = r(e._emscripten_stack_alloc), e.$ = t(e.$), e.ba = r(e.ba), e;
  }
  async function no() {
    Yr(), oe && await ft();
    var e = c.setStatus;
    e && (e("Running..."), await new Promise((r) => setTimeout(r, 1)), setTimeout(e, 1, "")), !Ce && (Kr(), c.onRuntimeInitialized?.(), Zr());
  }
  var se;
  return se = await ot(), await no(), c;
}
var uo = co, fo = {
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
}, vo = {
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
}, he = await lo(uo);
he.init();
var Ur = {
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
}, K = go(he, { ...fo, ...Ur }), Co = Ur, pe = K.ext, _o = JSON.parse(he.smpylib__table()), po = JSON.parse(he.smpylib__enums()), ho = {
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
}, Te = {};
{
  const f = K.smpylib = {}, c = _o.map((d, p) => [d, p]);
  for (const [[d, p], _] of [...c.filter(([[y]]) => !y.includes(".")), ...c.filter(([[y]]) => y.includes("."))]) {
    const y = d.indexOf("."), g = y > 0 ? d.slice(0, y) : null, T = g === null ? "" : `${ho[g] ?? g.replace(/(?<=[a-z])(?=[A-Z])/g, "_").toLowerCase()}_`, C = p.map((P) => P === "self" ? T.slice(0, -1) : P), D = g === null ? d : `${T}${d.slice(y + 1)}`;
    Te[D] ?? (Te[D] = C);
    const F = Ie(D, He(he, (...P) => he.smpylib__call(_, P), D), C);
    g === null ? f[d] = F : (f[g] ?? (f[g] = {}))[d.slice(y + 1)] = F, D in K || (K[D] = F);
  }
  for (const [d, p] of Object.entries(po))
    K[d] ?? (K[d] = { ...p });
}
function Ro() {
  return Te;
}
function go(f, c) {
  var p;
  const d = {};
  for (const _ of Object.keys(f)) {
    if (_.startsWith("smpylib__"))
      continue;
    const y = f[_], g = _.indexOf("__");
    if (g > 0 && typeof y == "function") {
      const [F, P] = [_.slice(0, g), _.slice(g + 2)], X = c[`${F}.${P}`], Z = He(f, y, `${F}.${P}`);
      (d[F] ?? (d[F] = {}))[P] = X ? Ie(`${F}.${P}`, Z, X) : Z;
      continue;
    }
    const T = /^([A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*)_([A-Z][A-Z0-9_]*)$/.exec(_);
    if (T && typeof y == "number") {
      (d[p = T[1]] ?? (d[p] = {}))[T[2]] = y;
      continue;
    }
    if (typeof y != "function") {
      d[_] = y;
      continue;
    }
    const C = c[_], D = He(f, y, _);
    d[_] = C ? Ie(_, D, C) : D;
  }
  return d;
}
function He(f, c, d) {
  return (...p) => {
    const _ = f.stackSave();
    try {
      return c(...p);
    } catch (y) {
      throw f.stackRestore(_), Ee(y) && mo(d, y), yo(f, y);
    }
  };
}
function mo(f, c) {
  re.count++, re.last = c.message, jr = f, Ae || (Ae = !0, queueMicrotask(() => {
    Ae = !1;
  })), re.count === 1 && re.next !== null && Po(`the kernel crashed in ${f} (${c.message}), and its memory may be damaged: ${re.next}`);
}
var Ae = !1, jr = "kernel";
function $o(f) {
  if (Ae)
    return !0;
  let c = f;
  for (let d = 0; c !== null && typeof c == "object" && d < 16; d++) {
    if (Ee(c))
      return !0;
    c = c.cause;
  }
  return !1;
}
function Mo(f) {
  if (!Ee(f))
    return f;
  try {
    return ko(jr, () => {
      throw f;
    });
  } catch (c) {
    return c;
  }
}
function yo(f, c) {
  const d = typeof WebAssembly > "u" ? void 0 : WebAssembly.Exception;
  if (typeof d != "function" || !(c instanceof d))
    return c;
  const p = f.stackSave();
  let _ = null;
  try {
    _ = f.runtime__exception_info(() => {
      throw c;
    });
  } catch {
    return c;
  } finally {
    f.stackRestore(p);
  }
  if (_ === null)
    return c;
  const [y, g] = _;
  return y === "memory" ? new Error(`SM_ERR_OUT_OF_MEMORY: the kernel ran out of memory (${g})`) : y === "value" ? new RangeError(g) : new Error(g);
}
function zr(f) {
  if (f === null || typeof f != "object")
    return !1;
  const c = Object.getPrototypeOf(f);
  return c === null || Object.getPrototypeOf(c) === null && Object.prototype.toString.call(f) === "[object Object]";
}
function Ie(f, c, d) {
  const p = d.map((g) => typeof g == "string" ? g : g[0]), _ = (g) => typeof d[g] == "string", y = (g) => d[g][1];
  return (...g) => {
    let T = g, C = null;
    const D = g[g.length - 1];
    if (g.length > 0 && zr(D)) {
      const P = Object.keys(D), X = g.length - 1;
      P.length > 0 && P.every((Z) => p.indexOf(Z) >= X) && (C = D, T = g.slice(0, -1));
    }
    if (T.length >= p.length && !C)
      return c(...T);
    if (T.length > p.length)
      throw new TypeError(`${f}: takes ${p.length} arguments, got ${T.length}`);
    const F = T.slice();
    for (let P = T.length; P < p.length; P++)
      if (C && p[P] in C)
        F.push(C[p[P]]);
      else if (!_(P))
        F.push(y(P));
      else
        throw new TypeError(`${f}: missing argument ${p[P]}`);
    return c(...F);
  };
}
var wo = /(SM_[A-Z0-9_]+)/;
function bo(f) {
  return f instanceof io || Ee(f) ? !0 : !(f instanceof Error) || Object.getPrototypeOf(f) !== Error.prototype ? !1 : f.name === "Error" || f.name.endsWith("Error") && !["TypeError", "RangeError", "ReferenceError", "SyntaxError", "BindingError", "InternalError"].includes(f.name);
}
function Ee(f) {
  return typeof WebAssembly < "u" && f instanceof WebAssembly.RuntimeError;
}
var De = "SM_ERR_OUT_OF_MEMORY", Lr = 2 ** 20;
function Eo(f, c) {
  return c !== null && (c.failed || c.limit - c.heap < 64 * Lr) ? `${De}: the kernel crashed when it ran out of memory (${f})` : `the kernel crashed (${f})`;
}
function Vr() {
  try {
    return K.runtime.memory_usage();
  } catch {
    return null;
  }
}
function Wr() {
  const f = Vr(), c = (p) => Math.round(p / Lr);
  return `the kernel ran out of memory${f === null ? "" : ` (${c(f.used)} MB in use, the module's memory at ${c(f.heap)} MB of at most ${c(f.limit)} MB)`}: dispose() parts you no longer need, or let the event loop run so that the garbage collector frees them`;
}
function Hr(f, c) {
  const d = `the kernel crashed (${f}), and its memory may be damaged: load the module again before relying on its results (a KernelWorker does so by itself)`;
  return c ? `${d}; ${c}` : d;
}
function Bo() {
  return re.count;
}
function Oo(f, c = null) {
  const d = re.last ?? "a trap";
  return new te(f, `the kernel crashed (${d})`, null, Hr(d, c));
}
function ko(f, c, d = null) {
  if (pe.clear_kernel_trace(), !K.runtime.reserve())
    throw new te(f, `${De}: the memory is used up`, De, Wr());
  try {
    return c();
  } catch (p) {
    if (p instanceof te || !bo(p) || p.timedOut === !0)
      throw p;
    const _ = Ee(p), y = _ ? Eo(p.message, Vr()) : p.message, g = wo.exec(y), T = g ? g[1] : null;
    d === null && typeof p.reason == "string" && (d = y.slice(y.indexOf(": ") + 2));
    const C = T === De ? Wr() : _ ? Hr(p.message, d) : d, D = so(new te(f, y, T, C), _ ? [] : xo(p));
    throw D.cause = p, D;
  }
}
function xo(f) {
  const c = f?._kernelTrace;
  return Array.isArray(c) ? c.map(String) : pe.kernel_trace()[0];
}
function Wo() {
  const { used: f, heap: c, limit: d } = K.runtime.memory_usage();
  return { used: f, heap: c, limit: d, handles: be, crashes: re.count };
}
var we = new FinalizationRegistry(([f, c]) => {
  be--;
  try {
    Ir(f, c);
  } catch {
  }
}), be = 0;
function Ir(f, c) {
  f === "brep" ? pe.delete_brep(c) : f === "curve" ? pe.delete_curve(c) : f === "surface" ? pe.delete_surface(c) : f === "poly" && pe.delete_polybrep(c);
}
var So = 0, ke = class {
  constructor(f, c) {
    $(this, "_p");
    $(this, "_kind");
    /** A number that tells handles apart for as long as they live (their kernel objects' numbers
     * can be reused once freed). */
    $(this, "id", ++So);
    this._kind = f, this._p = c, c && (we.register(this, [f, c], this), be++, H.length && H[H.length - 1].push(this));
  }
  /** Gives the kernel object to a new owner: this handle no longer frees it. */
  release() {
    const f = this._p;
    if (!f)
      throw new Error("the kernel object was disposed");
    return this._p = 0, we.unregister(this), be--, f;
  }
  /** False once the kernel object was disposed (or given to a new owner). */
  get alive() {
    return this._p !== 0;
  }
  /** Frees the kernel object now (it is freed on garbage collection otherwise). */
  dispose() {
    const f = this._p;
    f && (this._p = 0, we.unregister(this), be--, Ir(this._kind, f));
  }
  [Symbol.dispose]() {
    this.dispose();
  }
}, H = [];
function No(f) {
  if (typeof f != "function")
    throw new TypeError(`scope takes a function, not ${f === null ? "null" : typeof f}`);
  const c = [];
  H.push(c);
  let d;
  try {
    d = f();
  } catch (p) {
    throw H.pop(), Nr(c, p), p;
  }
  if (H.pop(), d !== null && (typeof d == "object" || typeof d == "function") && typeof d.then == "function")
    throw H.length && H[H.length - 1].push(...c), new TypeError("scope takes a function that returns its result, not a promise: an async function goes on after its first await, where the scope cannot follow it");
  return Nr(c, d), d;
}
function Nr(f, c) {
  const d = Fo(c), p = H.length ? H[H.length - 1] : null;
  for (const _ of f)
    _.alive && (d.has(_) ? p?.push(_) : _.dispose());
}
function Fo(f) {
  const c = /* @__PURE__ */ new Set(), d = /* @__PURE__ */ new Set(), p = [f];
  for (; p.length; ) {
    const _ = p.pop();
    if (!(_ === null || typeof _ != "object" || d.has(_))) {
      if (d.add(_), _ instanceof ke) {
        c.add(_);
        continue;
      }
      if (!(ArrayBuffer.isView(_) || _ instanceof ArrayBuffer || _ instanceof Promise || _ instanceof WeakMap || _ instanceof WeakSet) && !(typeof SharedArrayBuffer < "u" && _ instanceof SharedArrayBuffer)) {
        if (_ instanceof Map) {
          for (const [y, g] of _)
            p.push(y, g);
          continue;
        }
        if (_ instanceof Set) {
          for (const y of _)
            p.push(y);
          continue;
        }
        for (const y of Reflect.ownKeys(_)) {
          const g = Object.getOwnPropertyDescriptor(_, y);
          g !== void 0 && "value" in g && g.value !== null && typeof g.value == "object" && p.push(g.value);
        }
      }
    }
  }
  return c;
}
function Xe(f) {
  return new TypeError(`the ${f} was disposed: dispose() freed it in the kernel, so it cannot be used any more`);
}
var Uo = class extends ke {
  constructor(c) {
    if (!c)
      throw new te("kernel", "operation returned no body");
    super("brep", c);
    $(this, "sound", 0);
    $(this, "props", null);
    /** The tags of its faces and edges (`ext.topology_tags`, read once). */
    $(this, "tags", null);
    /** Its shells and the cells each face bounds (`ext.brep_shells`, read once; kernel plan T7). */
    $(this, "shells", null);
    /** For a body made by `Part.merge` (or a copy of one): the parts it was merged from, the placement
     * it was moved by since, and its cells' sources once found (kernel plan B15). */
    $(this, "merged", null);
    /** For a cell of a merged part: the parts it lies in. */
    $(this, "sources", null);
    /** The meshes rays are cast against, by purpose (a body's Brep does not change once wrapped). */
    $(this, "meshes", /* @__PURE__ */ new Map());
    $(this, "imported", !1);
  }
  get brep() {
    if (!this._p)
      throw Xe("body");
    return this._p;
  }
  /** Holds another Brep in place of its own, which the kernel deleted (as Python's `h.brep = ...`):
   * `ext.boolean` can give its result as a new Brep. */
  set brep(c) {
    if (c !== this._p) {
      if (!c)
        throw new te("kernel", "operation returned no body");
      we.unregister(this), this._p = c, we.register(this, ["brep", c], this);
    }
  }
}, jo = class extends ke {
  constructor(f) {
    if (!f)
      throw new te("kernel", "operation returned no curve");
    super("curve", f);
  }
  get curve() {
    if (!this._p)
      throw Xe("curve");
    return this._p;
  }
}, zo = class extends ke {
  constructor(f) {
    if (!f)
      throw new te("kernel", "operation returned no surface");
    super("surface", f);
  }
  get surface() {
    if (!this._p)
      throw Xe("surface");
    return this._p;
  }
}, Lo = class extends ke {
  constructor(f) {
    super("poly", f);
  }
  /** The mesh, or 0 once disposed. */
  get poly() {
    return this._p;
  }
}, Xr = (f) => console.warn(f);
function Vo(f) {
  Xr = f;
}
function Po(f) {
  Xr(f);
}
function Ho(f, c, d = -1) {
  const [p, _] = vo[f] ?? [-1, []], y = (g) => `${f}() takes ${p} positional argument${p === 1 ? "" : "s"} but ${g} ${g === 1 ? "was" : "were"} given`;
  if (c != null && !zr(c))
    throw p >= 0 ? new TypeError(y(Math.max(d, p + 1))) : new TypeError(`${f}(): the options must be an object, not ${typeof c}`);
  if (p >= 0 && d > p + 1)
    throw new TypeError(y(c == null ? d : d - 1));
  if (c != null)
    for (const g of Object.keys(c)) {
      if (g.startsWith("_") || _.includes(g))
        continue;
      let T;
      const C = g.replace(/_([a-z0-9])/g, (F, P) => P.toUpperCase()), D = _.map((F) => [To(F.toLowerCase(), g.toLowerCase()), F]).filter(([F, P]) => F <= Math.floor((P.length + 3) / 4)).sort((F, P) => F[0] - P[0]);
      throw _.includes(C) ? T = `; did you mean '${C}'? (the options are camelCase)` : D.length ? T = `; did you mean '${D[0][1]}'?` : _.length ? T = ` (its options: ${_.join(", ")})` : T = " (it takes no options)", new TypeError(`${f}() got an unexpected option '${g}'${T}`);
    }
}
function To(f, c) {
  let d = Array.from({ length: c.length + 1 }, (p, _) => _);
  for (let p = 1; p <= f.length; p++) {
    const _ = [p];
    for (let y = 1; y <= c.length; y++)
      _.push(Math.min(d[y] + 1, _[y - 1] + 1, d[y - 1] + (f[p - 1] === c[y - 1] ? 0 : 1)));
    d = _;
  }
  return d[c.length];
}
export {
  Uo as BrepHandle,
  jo as CurveHandle,
  ke as Handle,
  te as KernelError,
  io as ModelingError,
  Lo as PolyHandle,
  zo as SurfaceHandle,
  Co as _OWN,
  Bo as _crashCount,
  Oo as _crashError,
  Mo as _crashOf,
  Eo as _crashText,
  Xe as _disposed,
  $o as _isCrash,
  bo as _isRuntimeError,
  Ho as _opts,
  Fo as _reachable,
  Ro as _smpylibSignatures,
  xo as _traceOf,
  Po as _warn,
  pe as ext,
  K as k,
  ko as kernelCall,
  Wo as memoryUsage,
  he as module,
  No as scope,
  Vo as setWarningHandler
};
