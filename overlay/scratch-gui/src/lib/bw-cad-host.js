// SPDX-License-Identifier: BSD-3-Clause
// The CAD host bridges in one lazily fetched chunk ("bw-cad-host"): the program API
// (runtime.cadSimulation), the CAD shapes bridge (runtime.cadShapes) and the circuit–CAD
// coupling (runtime.cadCircuitSimulation, with its session, Sim Lab clock and arena clock).
// gui.jsx imports this after the first paint instead of statically: together they were
// ~50 KiB of the first load for a surface that is off by default (P17 budget,
// scripts/lib/webpack-ownership.mjs). The extensions that call these bridges already
// treat a missing one as "not available yet" (cadlab/cadshapes api() return null).
import {installCadProgramAPI} from './bw-cad-program.js';
import {installCadShapesAPI} from './bw-cad-blocks.js';
import {installCircuitCadBridge} from './bw-cad-circuit/bridge.js';

/** Installs all three bridges on vm.runtime; returns their joint disposer. */
export function installCadHost (vm) {
    const removeCad = installCadProgramAPI(vm.runtime);
    const removeShapes = installCadShapesAPI(vm.runtime);
    const removeCoupling = installCircuitCadBridge(vm);
    return () => {removeCoupling();removeShapes();removeCad();};
}
