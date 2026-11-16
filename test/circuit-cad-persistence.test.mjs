// SPDX-License-Identifier: BSD-3-Clause
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeProjectState,decodeProjectState,parseBundleDocument,BUNDLE_FORMAT,BUNDLE_VERSION} from '../overlay/scratch-gui/src/lib/bw-project-bundle.js';
import {CONNECTIONS_KEY} from '../overlay/scratch-gui/src/lib/bw-cad-circuit/connections.js';
import {validateConnections} from '../overlay/scratch-gui/src/lib/bw-cad-circuit/session.js';
const config={version:1,cadDocumentId:'my-rover',enabled:true,drives:[{partId:'left',jointId:'drive-a',ratio:48,efficiency:.8,direction:-1}],servos:[{partId:'steering',jointId:'steer-c',torqueNm:.02}],sensors:[{partId:'distance',bodyId:'chassis',originMm:[80,0,20],direction:[1,0,0],rangeMm:4000}]};
test('shaft, servo and sensor connections round-trip as typed project content with CAD disabled',()=>{
 const state=encodeProjectState({[CONNECTIONS_KEY]:JSON.stringify(config)});assert.deepEqual(state.cadCircuit,validateConnections(config));
 const encoded=decodeProjectState(state);assert.deepEqual(JSON.parse(encoded[CONNECTIONS_KEY]),validateConnections(config));
 const inspection=parseBundleDocument(JSON.stringify({format:BUNDLE_FORMAT,version:BUNDLE_VERSION,state}));assert.equal(inspection.outcome,'loaded');assert.deepEqual(JSON.parse(inspection.state[CONNECTIONS_KEY]),validateConnections(config));
});
test('invalid and future bindings refuse atomically, including overlapping servo ownership and invalid rays',()=>{
 for(const invalid of [{...config,version:99},{...config,servos:[{partId:'left',jointId:'steer-c'}]},{...config,sensors:[{partId:'distance',bodyId:'chassis',direction:[0,0,0]}]}])assert.throws(()=>encodeProjectState({[CONNECTIONS_KEY]:JSON.stringify(invalid)}));
 assert.equal(decodeProjectState({})[CONNECTIONS_KEY],undefined,'legacy projects clear connections');
});
