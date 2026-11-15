// MIT. Admission for the pinned LOOP=1, PRINTOUT software-FP validation build.
// Counts and stable module values are checked separately from elapsed time.
export function whetstoneResult(stdout) {
 const rows=stdout.split(/\r?\n/).filter(line=>/^\s*\d+\s+\d+\s+\d+\s+/.test(line));
 // Unmodified Netlib source, GCC host control, LOOP=1; compared at the
 // source's four-place exponential print precision, not internal FP bits.
 const reference=[[0.0,0.0,0.0,1.0,-1.0,-1.0,-1.0],[12.0,14.0,12.0,-0.066821,-0.46627,-0.73298,-1.1324],[14.0,12.0,12.0,-0.065513,-0.46469,-0.73107,-1.1303],[345.0,0.0,0.0,1.0,-1.0,-1.0,-1.0],[210.0,1.0,2.0,6.0,6.0,-0.73107,-1.1303],[32.0,1.0,2.0,0.49904,0.49904,0.49902,0.49902],[899.0,1.0,2.0,1.0,1.0,0.99994,0.99994],[616.0,1.0,2.0,3.0,2.0,3.0,-1.1303],[0.0,2.0,3.0,1.0,-1.0,-1.0,-1.0],[93.0,2.0,3.0,0.75987,0.75987,0.75987,0.75987]];
 const parsed=rows.map(line=>line.trim().split(/\s+/).map(Number));
 const modulesValid=parsed.length===10&&parsed.every((row,i)=>row.length===7&&
   row.every((value,j)=>Number.isFinite(value)&&value===reference[i][j]));
 const duration=stdout.match(/^Loops: 1, Iterations: 1, Duration: ([1-9][0-9]*) sec\.$/m);
 const score=stdout.match(/^C Converted Double Precision Whetstones: ([0-9]+(?:\.[0-9]+)?) (KIPS|MIPS)$/m);
 return {valid:Boolean(modulesValid&&duration&&score&&Number(score[1])>0),modulesValid,
   durationSeconds:duration?Number(duration[1]):null,
   reportedScore:score?{value:Number(score[1]),unit:score[2],scope:'guest functional clock; PRINTOUT validation, not physical CPU timing'}:null};
}
