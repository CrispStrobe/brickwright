async function P(l, e) {
  if (!e.length || e.length > 16777216)
    throw new Error("STEP input exceeds the file limit or is empty");
  const { instance: a } = await WebAssembly.instantiate(l), t = a.exports, w = t.step_alloc(e.length);
  if (!w)
    throw new Error("STEP reader could not allocate input");
  new Uint8Array(t.memory.buffer, w, e.length).set(e);
  const i = t.step_read(w, e.length);
  if (!i)
    throw new Error("STEP reader returned no result");
  const u = new DataView(t.memory.buffer, i, 4).getUint32(0, !0), c = new DataView(t.memory.buffer, i, u);
  let r = 4;
  const s = () => {
    const n = c.getUint32(r, !0);
    return r += 4, n;
  }, g = (n) => {
    const h = new TextDecoder().decode(new Uint8Array(c.buffer, i + r, n));
    return r += n, h;
  };
  if (s() !== 0)
    throw new Error(g(u - r).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 280));
  const d = s();
  if (!d || d > 256)
    throw new Error("STEP reader returned an invalid part count");
  const p = [];
  let E = 0, y = 0;
  for (let n = 0; n < d; n++) {
    const h = g(s()), S = "#" + Array.from({ length: 3 }, (o, T) => c.getUint8(r + T).toString(16).padStart(2, "0")).join("");
    r += 4;
    const f = s(), m = s();
    if (E += f, y += m, f < 3 || m < 1 || E > 25e4 || y > 15e4)
      throw new Error("STEP part exceeds the mesh limit or has no faces");
    const b = Float64Array.from({ length: f * 3 }, () => {
      const o = c.getFloat64(r, !0);
      if (r += 8, !Number.isFinite(o) || Math.abs(o) > 1e6)
        throw new Error("STEP coordinate is out of range");
      return o;
    }), x = Uint32Array.from({ length: m * 3 }, () => {
      const o = s();
      if (o >= f)
        throw new Error("STEP triangle index is out of range");
      return o;
    });
    p.push({ name: h, color: S, positions: b, indices: x });
  }
  if (r !== u)
    throw new Error("STEP reader returned extra mesh data");
  return p;
}
self.onmessage = async ({ data: l }) => {
  try {
    const e = await fetch(new URL("" + new URL("step-tessellator-BrwzROQM.wasm", import.meta.url).href, import.meta.url));
    if (!e.ok)
      throw new Error("STEP reader could not be loaded");
    const a = await P(await e.arrayBuffer(), new Uint8Array(l));
    self.postMessage({ meshes: a }, {
      transfer: a.flatMap((t) => [t.positions.buffer, t.indices.buffer])
    });
  } catch (e) {
    self.postMessage({ error: e instanceof Error ? e.message : String(e) });
  }
};
