const cachedOwner=require('../../../util/bw-cached-primitive-owner');
// A numeric editor shadow is serialized as text by Scratch. A connected String
// is never a numeric length, and no object coercion is performed.
module.exports=function promptLengthInput(runtime,args,util){
    let value=args.LENGTH;
    if(typeof value==='string'&&util){
        const node=cachedOwner(runtime,util,args,'arcade_askForStringLength',[],'Arcade limited text prompt: '),edge=node?.inputs?.LENGTH;
        const child=util.thread.target.blocks.getBlock(edge?.block);
        const field=child?.fields&&Object.getOwnPropertyDescriptor(child.fields,'NUM')?.value;
        const literal=field&&Object.getOwnPropertyDescriptor(field,'value')?.value;
        if(child?.opcode==='math_number'&&child.shadow===true&&edge.block===edge.shadow&&child.parent===node.id&&
            !Object.keys(child.inputs||{}).length&&(typeof literal==='string'||typeof literal==='number')&&String(literal)===value&&/^[1-3]$/.test(value))value=Number(value);
    }
    if(typeof value!=='number'||!Number.isInteger(value)||value<1||value>3)throw new TypeError('Arcade limited text prompt requires an actual integer length one to three');
    return value;
};
