// Owned synchronous storage failures use the existing primitive-fault lineage.
// No message/tag supplied by project metadata can issue a failure receipt.
const base=require('../../../util/bw-null-sprite-getter');
const failures=new WeakMap();
const kinds=Object.freeze(['highScore','gameOver','legacyGameOver'].map(method=>{
    const failure=args=>{
        const saved=failures.get(args);
        if(!saved||saved.method!==method)throw Error('High score fault requires its actual storage failure');
        return saved.error;
    };
    return Object.freeze({method,kind:base.makeKind({method,label:'High score storage',
        read:args=>({property:'high-score',message:failure(args).message}),errorFor:failure})});
}));
module.exports=Object.freeze({kinds,
    declareAll:(info,owner)=>{for(const row of kinds)row.kind.declaration(info,owner(row.method));return info;},
    bindAll:(info,adapter,instance)=>{for(const row of kinds)row.kind.bindAdapterInfo(info,adapter,instance);},
    fault(method,service,args,util,error,consume){
        const message=error&&typeof error==='object'&&Object.getOwnPropertyDescriptor(error,'message');
        const owned=message&&Object.hasOwn(message,'value')&&typeof message.value==='string'?error:new Error(typeof error==='string'?error:'Arcade high-score settings failed');
        failures.set(args,{method,error:owned});
        try{return consume(service.fault(args,util));}finally{failures.delete(args);}
    }
});
