// SPDX-License-Identifier: BSD-3-Clause
// Independently authored FUTURE compiler/guest controls. All are UNRUN. The
// current importer must continue to refuse try/catch/finally. These sources do
// not grant runtime authority and are not private research-project excerpts.
export const STRUCTURED_COMPLETION_CONTROLS = Object.freeze([
    {name:'nested-catch-finally', expectedTrace:'TCIF', source:`let trace=""
try {try {trace+="T";throw "failure"} catch(error) {trace+="C"} finally {trace+="I"}}
finally {trace+="F"}`},
    {name:'return-preserved', expectedTrace:'F1', source:`let trace=""
function read(){try{return 1}finally{trace+="F"}}
trace+=read()`},
    {name:'finally-return-overrides-throw', expectedTrace:'7', source:`let trace=""
function read(){try{throw "old"}finally{return 7}}
trace+=read()`},
    {name:'finally-throw-overrides-return', expectedTrace:'new', source:`let trace=""
function read(){try{return 1}finally{throw "new"}}
try{read()}catch(error){trace+=error}`},
    {name:'loop-completions', expectedTrace:'0F1F2F', source:`let trace=""
for(let i=0;i<4;i++){try{trace+=i;if(i<2)continue;break}finally{trace+="F"}}`},
    {name:'yielding-catch-finally', expectedTrace:'TCF', source:`let trace=""
try{trace+="T";pause(5);throw "failure"}catch(error){trace+="C";pause(5)}finally{trace+="F"}`},
    // The eventual guest driver must observe T, Stop before 500ms, restart,
    // then settle the OLD wait. No old C/F/after may enter the new invocation.
    // Host iterator cleanup is distinct and must still release resources.
    {name:'stop-ownership', expectedBeforeStop:'T', expectedOldContinuationAfterStop:'', source:`let trace=""
try{trace+="T";pause(500);throw "old"}catch(error){trace+="C"}finally{trace+="F"}
trace+="after"`}
]);
