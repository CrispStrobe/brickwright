const l = 64;
function m(t, i) {
  const r = i.filter((e) => !e.reference && !e.hole && e.indices.length), n = r.map((e) => ({ id: e.id, volumeMm3: e.volume, geometry: "mesh" }));
  return r.length > 64 ? { volumes: n } : { volumes: n, overlaps: t.interference(r).interfering.map(({ a: e, b: o, volumeMm3: s }) => ({ a: e, b: o, volumeMm3: s })) };
}
export {
  l as MAX_OVERLAP_BODIES,
  m as materialMeasures
};
