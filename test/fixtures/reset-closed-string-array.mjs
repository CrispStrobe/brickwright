export const source=`function locate(wanted:string,values:any[]):number {
 for(let slot=0;slot<values.length;slot++){
  if(values[slot]===wanted){return slot}
 }
 return -1
}
let labels=["violet","gold","silver"]
let chosen="gold"
let found=locate(chosen,labels)
if(found<0){game.reset()}`;
