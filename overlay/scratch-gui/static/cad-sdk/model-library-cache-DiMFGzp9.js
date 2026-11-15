async function c(o, r) {
  if (!Number.isSafeInteger(r) || r <= 0) throw new Error("Invalid cache read limit.");
  if (!o.body) throw new Error("Cached model library file has no body.");
  const a = o.body.getReader(), e = new Uint8Array(r);
  let t = 0;
  try {
    for (; ; ) {
      const { done: i, value: n } = await a.read();
      if (i) return e.slice(0, t);
      if (t + n.length > r) throw new Error("Cached model library file exceeds its declared byte size.");
      e.set(n, t), t += n.length;
    }
  } catch (i) {
    throw a.cancel().catch(() => {
    }), i;
  } finally {
    a.releaseLock();
  }
}
function l(o = globalThis.caches) {
  const r = (e) => {
    if (!/^[a-f0-9]{64}$/.test(e)) throw new Error("Invalid model library cache hash.");
    return `https://brickwright.invalid/model-library/sha256/${e}`;
  }, a = () => {
    if (!o) throw new Error("Browser model library storage is unavailable.");
    return o.open("brickwright-model-library-files-v1");
  };
  return {
    async read(e, t) {
      const i = await (await a()).match(r(e));
      if (i)
        try {
          return await c(i, t);
        } catch (n) {
          throw await (await a()).delete(r(e)), n;
        }
    },
    async write(e, t) {
      await (await a()).put(r(e), new Response(t.slice()));
    },
    async remove(e) {
      await (await a()).delete(r(e));
    }
  };
}
export {
  l as createModelLibraryBrowserCache
};
