// SPDX-License-Identifier: BSD-3-Clause
// Existing model IDs retain their connectivity/device identity. Render the
// complete standard assembly; never rewrite the original LDraw part files.
export const visualAssembly = name => name.toLowerCase() === '45601.dat' ? '45601c01.dat' : name;
