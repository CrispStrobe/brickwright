import test from 'node:test';
import assert from 'node:assert/strict';
import {menuItems, focusMenuEdge, focusSubmenuIfStillOnOpener, handleMenuKeyDown, openMenuFromKeyboard} from '../overlay/scratch-gui/src/lib/menu-keyboard.js';
const setup=()=>{
    let focus=null;
    const opener={focus:()=>{focus='opener';}};
    const menu={querySelectorAll:()=>items,parentElement:{closest:()=>null},closest:()=>({querySelector:()=>opener})};
    const items=[0,1,2].map(i=>({getAttribute:()=>i===1?'true':null,closest:()=>menu,
        focus:()=>{focus=i;},scrollIntoView:()=>{}}));
    const event=(key,target=items[0])=>({key,target:{...target,matches:()=>false,closest:()=>target},currentTarget:menu,
        preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}});
    return{menu,items,event,focus:()=>focus};
};
test('menu navigation skips disabled items, wraps and supports Home/End',()=>{
    const s=setup();assert.equal(menuItems(s.menu).length,2);
    focusMenuEdge(s.menu);assert.equal(s.focus(),0);
    handleMenuKeyDown(s.event('ArrowDown'),()=>{});assert.equal(s.focus(),2);
    handleMenuKeyDown(s.event('ArrowDown',s.items[2]),()=>{});assert.equal(s.focus(),0);
    handleMenuKeyDown(s.event('ArrowUp'),()=>{});assert.equal(s.focus(),2);
    handleMenuKeyDown(s.event('Home'),()=>{});assert.equal(s.focus(),0);
    handleMenuKeyDown(s.event('End'),()=>{});assert.equal(s.focus(),2);
});
test('Escape closes and returns to opener; Tab closes without trapping focus',()=>{
    const s=setup();let closed=0;
    const escape=s.event('Escape');handleMenuKeyDown(escape,()=>closed++);
    assert.equal(closed,1);assert.equal(s.focus(),'opener');assert.equal(escape.prevented,true);
    const tab=s.event('Tab');handleMenuKeyDown(tab,()=>closed++);
    assert.equal(closed,2);assert.equal(tab.prevented,undefined);
});
test('nested ArrowLeft closes only the submenu and focuses its parent',()=>{
    const s=setup();let focus=false,closed=0;
    s.menu.parentElement.closest=()=>({focus:()=>{focus=true;}});
    handleMenuKeyDown(s.event('ArrowLeft'),()=>closed++);
    assert.equal(closed,1);assert.equal(focus,true);
});
test('native form controls keep arrow keys and an empty menu is safe',()=>{
    const s=setup();const input=s.event('ArrowDown');input.target.matches=()=>true;
    handleMenuKeyDown(input,()=>assert.fail('unexpected close'));assert.equal(input.prevented,undefined);
    s.menu.querySelectorAll=()=>[];handleMenuKeyDown(s.event('ArrowDown'),()=>{});
    assert.equal(s.focus(),null);
});
test('keyboard trigger opens and focuses the first or last enabled item after rendering',()=>{
    const s=setup();let opened=0;
    const old=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=fn=>fn();
    try{
        for(const [key,expected]of[['Enter',0],[' ',0],['ArrowDown',0],['ArrowUp',2]]){
            const e=s.event(key);e.currentTarget={closest:()=>({querySelector:()=>s.menu})};
            openMenuFromKeyboard(e,()=>opened++);assert.equal(s.focus(),expected);assert.equal(e.prevented,true);
        }
        assert.equal(opened,4);
    }finally{globalThis.requestAnimationFrame=old;}
});

test('a mouse-opened menu closes from its focused trigger without trapping Tab',()=>{
    let opened=0,closed=0;
    const event=(key,expanded=true)=>({key,currentTarget:{getAttribute:()=>String(expanded)},
        preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}});
    const escape=event('Escape');
    openMenuFromKeyboard(escape,()=>opened++,()=>closed++);
    assert.equal(closed,1);assert.equal(opened,0);assert.equal(escape.prevented,true);assert.equal(escape.stopped,true);
    const tab=event('Tab');
    openMenuFromKeyboard(tab,()=>opened++,()=>closed++);
    assert.equal(closed,2);assert.equal(opened,0);assert.equal(tab.prevented,undefined);assert.equal(tab.stopped,true);
    openMenuFromKeyboard(event('Escape',false),()=>opened++,()=>closed++);
    assert.equal(closed,2,'a closed trigger leaves Escape available to the surrounding application');
});


test('root horizontal arrows open the next menu through its actual button',()=>{
    const s=setup();let focused=-1,clicked=-1,closed=0;
    const triggers=[0,1,2].map(index=>({disabled:false,getClientRects:()=>[{}],focus:()=>{focused=index;},
        click:()=>{clicked=index;},closest:()=>({querySelector:()=>s.menu})}));
    s.menu.closest=()=>({querySelector:()=>triggers[1]});
    s.menu.ownerDocument={querySelectorAll:()=>triggers};
    const old=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=fn=>fn();
    try{
        handleMenuKeyDown(s.event('ArrowRight'),()=>closed++);
        assert.equal(focused,2);assert.equal(clicked,2);assert.equal(closed,1);
        handleMenuKeyDown(s.event('ArrowLeft'),()=>closed++);
        assert.equal(focused,0);assert.equal(clicked,0);assert.equal(closed,2);
    }finally{globalThis.requestAnimationFrame=old;}
});

test('an empty menu receives keyboard focus and can dismiss itself with Escape',()=>{
    const s=setup();let menuFocused=false,closed=0;
    s.menu.querySelectorAll=()=>[];
    s.menu.focus=()=>{menuFocused=true;};
    focusMenuEdge(s.menu);
    assert.equal(menuFocused,true);
    handleMenuKeyDown(s.event('Escape'),()=>closed++);
    assert.equal(closed,1);
    assert.equal(s.focus(),'opener');
});


test('deferred submenu focus preserves a newer selection and still opens normally',()=>{
    let selected='opener';
    const menu={querySelectorAll:()=>items};
    const opener={ownerDocument:{activeElement:null},querySelector:()=>menu};
    const items=[{closest:()=>menu,getAttribute:()=>null,focus:()=>{selected='first';},scrollIntoView:()=>{}}];
    opener.ownerDocument.activeElement=opener;
    focusSubmenuIfStillOnOpener(opener);
    assert.equal(selected,'first','unchanged focus receives the first submenu item');
    selected='walls';opener.ownerDocument.activeElement={};
    focusSubmenuIfStillOnOpener(opener);
    assert.equal(selected,'walls','later selection is not overwritten by a deferred callback');
    focusSubmenuIfStillOnOpener(null);
});
