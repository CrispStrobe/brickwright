const boundedTextPromptInputs=node=>{
    const question=node?.inputs?.QUESTION?.[1],length=node?.inputs?.LENGTH?.[1];
    return Object.keys(node?.fields||{}).length===0&&Object.keys(node?.inputs||{}).sort().join(',')==='LENGTH,QUESTION'&&
        Array.isArray(question)&&question[0]===10&&typeof question[1]==='string'&&Array.isArray(length)&&[4,5,6,7,8].includes(length[0])&&['string','number'].includes(typeof length[1])&&/^[1-3]$/.test(String(length[1]));
};
import {createProjectFrameDeltaNumber,currentFrameDeltaReporter} from './project-frame-delta-number.js';
import {EXTERNAL_NAME} from './external-references.js';
import {createProjectMathNormalResults} from './project-math-normal-results.js';
import {arrayMenuLiteral,isArrayMenuSelector,isKnownArrayMenuOperation} from './array-menu-literal.js';
import {createProjectJsonSnapshot,isProjectJsonSnapshot} from './project-json-snapshot.js';
import {sourceValueOperation} from './source-value-operator-helpers.js';
import {nativeArrayAddHelperSource,runtimeDispatchAddHelperSource} from './native-array-binary-helper-source.js';
// Refusals that only say an operand domain or an Array effect is unproved.
// Each is decided at run time by the dispatch helper; every other native
// addition refusal (supplied tags, ambiguous/changed source identity, a
// refused named-helper source proof) still refuses the export.
const RUNTIME_DISPATCH_ADDITION_REASONS=new Set([
    'native addition requires initialized primitive or proved flat Array operands',
    'native addition cannot prove the named getter index has primitive coercion',
    'native addition cannot prove the canonical parser result is primitive',
    'native addition has no private shape model for this named mutator',
    'native helper does not join this actual Array operand position',
    'native addition cannot prove unary conversion has no opaque coercion effects',
    'native addition source graph contains unresolved producer constraints',
    'native addition requires flat primitive allocation contents and no foreign escapes',
    'native addition Array escapes through an unproved callback return',
    'native addition Array-returning function escapes its actual callers',
    'native addition Array escapes through an object literal',
    'native addition Array escapes through a containing Array',
    'native addition cannot prove host Number conversion has no opaque coercion effects',
    'native addition cannot prove constructor, generic or spread call effects',
    'native addition cannot prove a foreign member call effect',
    'native addition SDK or builtin callee binding differs',
    'native addition cannot prove an Array method writer or escape',
    'native addition Array escapes through a member call',
    'native addition cannot prove an actual callee effect',
    'native addition Array escapes through an unproved callee',
    'native addition builtin binding has an actual writer',
    'native addition cannot prove a global or nonnumeric indexed writer',
    'native addition cannot prove an indexed Array writer',
    'native addition Array has an unproved property writer',
    'native addition Array escapes through an object or indexed writer',
    'native addition cannot prove an updated Array slot',
    'native addition cannot prove a deleted Array property'
]);
const runtimeDispatchAdditionReason=reason=>typeof reason==='string'&&RUNTIME_DISPATCH_ADDITION_REASONS.has(reason);
import {inspectNativeAdditionExportDomains} from './native-array-binary-domain.js';
import {GENERATED_HELPER_PROFILES,mapGeneratedSourceArray} from './generated-helper-recognition.js';
import {animationAssetArray} from './animation-asset-array.js';
import {ownedAnimationLiteral,unusedAnimationLookups} from './static-animation-resource-emission.js';
import {createOrdinaryExportSymbols} from './ordinary-export-symbols.js';
import {createArrayReferenceExportAuthority} from './array-reference-export-authority.js';
import {throwExportOwners} from './throw-export-owners.js';
import {prepareProcedureConstraintExport} from './procedure-constraint-export.js';
import {createClosedOrdinaryProjectEntry} from './closed-ordinary-project-entry.js';
import {validateProcedureConstraintSource} from './procedure-constraint-source.js';
import {createSdkImageLiteralResources} from './sdk-image-literal-resources.js';
import {proveNamedFunctionSource} from './named-function-source.js';
import {analyseConsoleCaptures} from './console-capture-provenance.js';
import {proveClassCallableSource} from './class-callable-source-flow.js';
import {classCallableSourceGate} from './class-callable-source-gate.js';
import {classCallableDefaultProjectGate} from './class-callable-default-project-gate.js';
import {sdkFontInputAuthority} from './sdk-font-input-authority.js';
import {parseMakeCodeTs} from './ts-import.js';
import {analyseSourceValueProducers} from './source-value-producers.js';
import {dormantSpriteDeclarations} from './dormant-sprite-declarations.js';
import {callableSourceGate} from './callable-source-gate.js';
import {inspectCallableExportGraph,createCallableLexicalEmitter,renderCallableSignature,validateCallableCurrentBodyTypes,callableReflectionOperand,callableReflectionVariable,callableCurrentInputType} from './callable-export-graph.js';
import {namedArrayItemExportAuthority} from './named-array-item-export-authority.js';
import {NAMED_ARRAY_GET_SOURCE} from './named-array-item-helpers.js';
import {sourceReferenceProject} from './source-reference-project.js';
import {scalarExportFlow,closedRemovalScalarAddition} from './scalar-export-flow.js';
import {sourceScalarProject} from './source-scalar-project.js';
import {createImageConsumerAbiExport} from './image-consumer-abi-export.js';
import {prepareObjectClassExport} from './object-class-export.js';
import {createCreatedFieldExportReceivers} from './created-field-export-receivers.js';
import {STRING_ARRAY_SETTINGS_PATH,STRING_ARRAY_SETTINGS_SOURCE} from './string-array-settings.generated.js';
import {LEGACY_CHARACTER_NATIVE_IDENTITY} from './legacy-character-source-admission.generated.js';
const LEGACY_CHARACTER_REVISION=LEGACY_CHARACTER_NATIVE_IDENTITY.revision;
const provenanceDescriptor=Object.getOwnPropertyDescriptor,provenanceOwn=Object.hasOwn,provenanceKeys=Reflect.ownKeys,provenanceArray=Array.isArray;
// Serialized current-graph eligibility only, never a runtime completion receipt.
// Expression emission and formal/caller inference must use the same exact proof.
function currentSceneClockNumber(blocks,block) {
    if(!block||block.opcode!=='arcade_sceneMillis')return false;
    const ids=Object.keys(blocks||{}).filter(id=>blocks[id]===block),id=ids[0],parent=id&&blocks[block.parent],uses=[];
    for(const node of Object.values(blocks||{}))for(const slot of Object.values(node.inputs||{}))
        if(Array.isArray(slot))for(let index=1;index<slot.length;index++)if(slot[index]===id)uses.push({node,index,slot});
    if(ids.length!==1||block.shadow!==false||block.topLevel!==false||block.next!=null||block.mutation!=null||
        Object.keys(block.fields||{}).length||Object.keys(block.inputs||{}).length||!parent||uses.length!==1||uses[0].node!==parent||uses[0].index!==1)return false;
    if(Object.keys(blocks).filter(key=>blocks[key]===parent).length!==1)return false;
    const slot=uses[0].slot;
    // A non-shadow reporter cannot occupy the SAME_BLOCK_SHADOW (1) role.
    if(slot[0]===2)return slot.length===2;
    if(slot[0]!==3||slot.length!==3)return false;
    const fallback=slot[2];
    const primitive=value=>Array.isArray(value)&&value.length===2&&Number.isInteger(value[0])&&value[0]>=4&&value[0]<=10&&
        (typeof value[1]==='string'||value[0]<=8&&typeof value[1]==='number'&&Number.isFinite(value[1]));
    if(primitive(fallback))return true;
    if(typeof fallback!=='string'||fallback===id)return false;
    const shadow=blocks[fallback],names=Object.keys(blocks).filter(key=>blocks[key]===shadow);
    if(!shadow||names.length!==1||names[0]!==fallback||shadow.shadow!==true||shadow.topLevel!==false||shadow.parent!==block.parent||
        shadow.next!=null||shadow.mutation!=null||Object.keys(shadow.inputs||{}).length)return false;
    const primitiveFields={math_number:'NUM',math_positive_number:'NUM',math_whole_number:'NUM',math_integer:'NUM',math_angle:'NUM',colour_picker:'COLOUR',text:'TEXT'};
    const field=Object.hasOwn(primitiveFields,shadow.opcode)&&primitiveFields[shadow.opcode],value=shadow.fields?.[field];
    if(!field||Object.keys(shadow.fields||{}).length!==1||!Array.isArray(value)||![1,2].includes(value.length)||value.length===2&&value[1]!==null||
        !(typeof value[0]==='string'||field==='NUM'&&typeof value[0]==='number'&&Number.isFinite(value[0])))return false;
    const fallbackUses=[];for(const node of Object.values(blocks))for(const input of Object.values(node.inputs||{}))
        if(Array.isArray(input))for(let index=1;index<input.length;index++)if(input[index]===fallback)fallbackUses.push({node,index,input});
    return fallbackUses.length===1&&fallbackUses[0].node===parent&&fallbackUses[0].index===2&&fallbackUses[0].input===slot;
}

/**
 * A Scratch project -> MakeCode Arcade TypeScript: the way back from
 * arcade-translate.js, and the way OUT for a game made here.
 *
 * TWO MODELS. Scratch runs scripts that belong to one sprite each, on a 480x360
 * stage centred on 0,0 with y up. Arcade runs one program that holds its
 * sprites in variables, on a 160x120 screen with the origin top-left and y
 * down. So:
 *   - every sprite is a global `Sprite`, created from its CURRENT COSTUME
 *     turned into palette pixels (pixel-image.js: exact for pixel-art costumes,
 *     palette-matched for anything else — and said so);
 *   - every script becomes code acting on its own sprite's variable;
 *   - coordinates convert where they are USED: x_arcade = x / 3 + 80,
 *     y_arcade = 60 - y / 3, and back — the inverse of arcade-translate, so a
 *     round trip lands on the same numbers;
 *   - `when flag clicked` scripts run side by side (control.runInParallel),
 *     after every sprite exists; key hats become controller events;
 *     `touching` becomes overlapsWith; a variable named `score` is Arcade's.
 *   - broadcasts are a dispatch function that starts every receiver and
 *     returns what it started, so `broadcast and wait` waits for exactly those;
 *     a receiver started again while it runs restarts (Scratch's rule);
 *   - costumes are an Image[] per sprite (sprite.setImage), backdrops an
 *     Image[] for the scene (scene.setBackgroundImage) that also fires
 *     `when backdrop switches to`;
 *   - a sprite that is ever cloned gets its own SpriteKind; every script of it
 *     runs on a `self` sprite, so its clones (sprites.create of that kind) run
 *     the same code, and `delete this clone` is sprite.destroy();
 *   - lists are arrays with Scratch's 1-based, out-of-range-reads-"" rules;
 *   - pen lines go on a transparent layer sprite under the others;
 *   - a sound that is one steady tone is music.playTone; notes, rests and
 *     tempo are music calls.
 *   - `stop` keeps Scratch's three meanings (see `stop`): this script returns;
 *     other scripts in sprite ends that sprite's (or clone's) other runs;
 *     all ends every run, deletes clones and silences — and the game goes on.
 * What has no Arcade counterpart is NAMED in `unsupported` and becomes a
 * comment where it stood — nothing vanishes in silence (the census rule).
 * docs/ARCADE-COMPAT-PLAN.md is the construct-by-construct matrix.
 *
 * @module
 */
import {LEGACY_PARSE_SOURCE, LEGACY_JSON_SOURCE, ARRAY_ACCESS_SOURCE} from './legacy-array-values.js';
import {createAnimationFrameArrayProducers, constantStringVariable} from './animation-frame-array-producers.js';
import {encodeAnimationJres, decodeAnimationJres, nativeAnimationNameBase, isNativeAnimationName} from './animation-jres.js';

const ADDITION_VIEW_METADATA=new Set(['originalBody','parameterDefaults','paramTypes','typeParameters','returnType',
    'assertedType','ordinaryParameterDefaultNames','bwProcedureConstraintSource']);
// Whether anything in the program binds or reads the name `assets` other than as the root of an asset tag.
function programShadowsAssets(program) {
    let shadowed=false;
    const scan=node=>{
        if(!node||typeof node!=='object')return;
        if(Array.isArray(node)){for(const child of node)scan(child);return;}
        if(node.type==='Identifier'&&node.name==='assets'||
            ['FunctionDeclaration','FunctionExpression','Class','Enum','Namespace','ForOf','ForIn'].includes(node.type)&&node.name==='assets'||
            node.params?.includes('assets')||node.type==='Declaration'&&node.decls.some(decl=>decl.name==='assets'))shadowed=true;
        for(const [key,value]of Object.entries(node))if(!ADDITION_VIEW_METADATA.has(key))scan(value);
    };
    scan(program);
    return shadowed;
}
// The export proof's view of the asset references THIS emitter wrote by name because the project does not carry the
// asset. Only a Template whose exact text the emitter recorded as such, in a program where `assets` is not otherwise
// bound or read, is read as an inert literal (like an img tag); every other assets.* spelling stays unproved.
function nativeAdditionNamedAssetView(program, emitted) {
    if(!emitted.size||programShadowsAssets(program))return program;
    const rewrite=node=>{
        if(!node||typeof node!=='object')return node;
        if(Array.isArray(node))return mapGeneratedSourceArray(node,rewrite);
        if(node.type==='Template'&&typeof node.value==='string'&&!node.value.includes('${')&&
            ['assets.image','assets.tile','assets.animation','assets.song'].includes(node.tag)&&emitted.has(`${node.tag}\`${node.value}\``))
            return Object.fromEntries(Object.entries(node).map(([key,value])=>[key,key==='tag'?'img':value]));
        return Object.fromEntries(Object.entries(node).map(([key,value])=>[key,ADDITION_VIEW_METADATA.has(key)?value:rewrite(value)]));
    };
    return rewrite(program);
}
// This view is used only for the fresh parse of this emitter's complete,
// immutable assembled source. It never accepts a caller's AST/proof flag and
// never replaces emitted text. Only this emitter's actual encoded resources
// supply literal image Arrays; arbitrary tag spellings remain unproved.
function nativeAdditionAnimationView(program, resources) {
    const metadata=new Set(['originalBody','parameterDefaults','paramTypes','typeParameters','returnType',
        'assertedType','ordinaryParameterDefaultNames','bwProcedureConstraintSource']);
    let shadowed=false;
    const scan=node=>{
        if(!node||typeof node!=='object')return;
        if(Array.isArray(node)){for(const child of node)scan(child);return;}
        if(node.type==='Identifier'&&node.name==='assets'||
            ['FunctionDeclaration','FunctionExpression','Class','Enum','Namespace','ForOf','ForIn'].includes(node.type)&&node.name==='assets'||
            node.params?.includes('assets')||node.type==='Declaration'&&node.decls.some(decl=>decl.name==='assets'))shadowed=true;
        for(const [key,value]of Object.entries(node))if(!metadata.has(key))scan(value);
    };
    scan(program);
    if(shadowed)return program;
    const animations=new Map();
    for(const resource of resources){
        const id=resource.nativeId;
        if(typeof id!=='string'||animations.has(id)){animations.set(id,null);continue;}
        const animation=decodeAnimationJres(resource.nativeEntry,{key:`myAnimations.${id}`});
        animations.set(id,animation.id===`myAnimations.${id}`?animation:null);
    }
    const rewrite=node=>{
        if(!node||typeof node!=='object')return node;
        if(Array.isArray(node))return mapGeneratedSourceArray(node,rewrite);
        if(node.type==='Template'&&node.tag==='assets.animation'){
            const animation=typeof node.value==='string'&&animations.get(node.value);
            return animation?animationAssetArray(animation):node;
        }
        return Object.fromEntries(Object.entries(node).map(([key,value])=>[key,metadata.has(key)?value:rewrite(value)]));
    };
    return rewrite(program);
}
import {ANIMATION_COMPANION_PATH, encodeAnimationCompanion} from './animation-companion.js';
import {validateDocument} from '../bw-artwork-bundle.js';
import {TileAssetExporter} from './tile-assets.js';
import {SONG_MIME} from './song-jres.js';
import {tilemapSource} from './tilemap-values.js';
import {ValueTypeGraph} from './value-type-graph.js';
import {legacyDirectMenuValue} from '../arcadeDialect.js';

// Fixed native fields take precedence; only genuine old literal menu shadows
// can supply a missing type. Never evaluate a type reporter.
const directMenuValue = (block, slot, blocks) => block.fields?.[slot]?.[0] ?? legacyDirectMenuValue(block, slot, blocks);
const settingType = (block, blocks) => directMenuValue(block, 'TYPE', blocks);
import {svgToPixels, quantizeRgba, toImgLiteral, remapPalette, nearestIndex} from './pixel-image.js';
import {planScratchArcadeKeyboard} from './scratch-arcade-keyboard.js';
// arcade-character-animations Predicate members.
const CHARACTER_PREDICATE_NAMES = ['NotMoving', 'Moving', 'FacingUp', 'FacingRight', 'FacingDown', 'FacingLeft', 'MovingUp', 'MovingRight',
    'MovingDown', 'MovingLeft', 'HittingWallUp', 'HittingWallRight', 'HittingWallDown', 'HittingWallLeft'];
const BUFFER_FORMAT_NAMES = ['Int8LE','UInt8LE','Int16LE','UInt16LE','Int32LE','Int8BE','UInt8BE','Int16BE','UInt16BE','Int32BE','UInt32LE','UInt32BE','Float32LE','Float64LE','Float32BE','Float64BE'];
// Background effects game over takes: particle screen effects and image effects.
const BACKGROUND_EFFECTS = ['confetti', 'hearts', 'smiles', 'blizzard', 'bubbles', 'starField', 'clouds', 'none', 'dissolve', 'melt', 'slash', 'splatter'];
import {ARCADE_PALETTE, imageToSvg} from './arcade-assets.js';
import {helperSource, analyseTone} from './arcade-runtime.js';
import {startupFirstWriteVariables} from './startup-first-write-globals.js';

/**
 * Why the mouse stays a refusal: Arcade hardware has a d-pad and A/B, no
 * pointer. pxt-arcade's browser-events package reads a mouse, but only in the
 * browser simulator — a game using it would do nothing on a device, so the
 * export names the loss instead of shipping a program that only half works.
 */
export const MOUSE_WHY = 'Arcade has no pointer (a d-pad and A/B; browser-events works only in the simulator)';

const isPalette = palette => Array.isArray(palette) && palette.length === 16 && palette[0] === null &&
    palette.slice(1).every(colour => /^#[0-9a-f]{6}$/i.test(colour));
const samePalette = (left, right) => left.every((colour, index) =>
    String(colour).toLowerCase() === String(right[index]).toLowerCase());

const REGISTERED_HAT_KINDS = {
    arcade_whenRegisteredMultiplayerConnection:'multiplayerConnection',
    arcade_whenRegisteredControlEvent:'controlEvent',
    arcade_whenParallelHandler:'parallel',
    arcade_whenRegisteredInstanceDestroyed:'instanceDestroyed',
    arcade_whenRegisteredLegacyWall:'legacyWall',
    arcade_whenRegisteredMultiplayerButton:'multiplayerButton',
    arcade_whenRegisteredCreated:'created', arcade_whenRegisteredWall:'wall', arcade_whenRegisteredTile:'tile', arcade_whenRegisteredTilemapEvent:'tilemapEvent',
    arcade_whenRegisteredUpdate:'update', arcade_whenRegisteredInterval:'interval', arcade_whenRegisteredButton:'button',
    arcade_whenRegisteredPaint:'paint', arcade_whenRegisteredShade:'shade',
    arcade_whenRegisteredKindDestroyed:'destroyed', arcade_whenRegisteredOverlap:'overlap',
    arcade_whenRegisteredScenePush:'scenePush', arcade_whenRegisteredScenePop:'scenePop',
    arcade_whenRegisteredForever:'forever', arcade_whenRegisteredLifeZero:'lifeZero', arcade_whenRegisteredScore:'score', arcade_whenRegisteredCountdown:'countdown',
    arcade_whenRegisteredExternal:'external'
};
const REGISTERED_COMMANDS = new Set(['arcade_registerMultiplayerConnection','arcade_registerControlEvent','arcade_startParallelHandler','arcade_registerLegacyWallHandler','arcade_registerMultiplayerButtonHandler','arcade_registerSpriteCreated','arcade_registerWallHandler','arcade_registerTilemapEvent','arcade_registerTileHandler',
    'arcade_registerUpdateHandler','arcade_registerIntervalHandler','arcade_registerPlayerButtonHandler','arcade_registerButtonHandler','arcade_registerPaintHandler','arcade_registerShadeHandler',
    'arcade_registerInstanceDestroyedHandler','arcade_registerDestroyedHandler','arcade_registerOverlapHandler','arcade_registerScenePushHandler','arcade_registerScenePopHandler',
    'arcade_registerForeverHandler','arcade_registerLifeZeroHandler','arcade_registerScoreHandler','arcade_registerCountdownHandler','arcade_registerExternalHandler']);

const KEY_BUTTON = {
    'left arrow': 'controller.left', 'right arrow': 'controller.right',
    'up arrow': 'controller.up', 'down arrow': 'controller.down',
    space: 'controller.A', a: 'controller.A', z: 'controller.B', b: 'controller.B', x: 'controller.B'
};

const ident = name => {
    const s = String(name || 'v').replace(/[^A-Za-z0-9_]/g, '_');
    return /^[0-9]/.test(s) ? `_${s}` : s;
};

const LEGACY_SCROLLER_REVISION='43651f88b917a98ad886fdd4c1c2ad8001ce9b9c';
const RESERVED = new Set(['score', 'life', 'info', 'game', 'scene', 'sprites', 'controller', 'Math', 'function', 'let', 'var',
    'if', 'else', 'while', 'for', 'return', 'true', 'false', 'null', 'new', 'this', 'pause', 'forever',
    '__bwSdkCharCode','__bwSdkConcat','__bwScratchTimerStart','__bwScratchTimer','__bwResetScratchTimer', 'SpriteKind', 'SpriteFlag', 'ControllerButtonEvent', 'DialogLayout', 'Image', 'Buffer', 'NumberFormat', 'console', 'control', 'assets', 'images', 'image', 'hex', 'img', 'undefined', 'bwStringArraySettings', '_bwStageSpeech']);

const arraySourceDescriptor=Object.getOwnPropertyDescriptor,arraySourceKeys=Reflect.ownKeys,
    arraySourcePrototype=Object.getPrototypeOf,arraySourceOwn=Object.hasOwn,arraySourceIsArray=Array.isArray,
    arraySourceQuote=JSON.stringify,arraySourceFinite=Number.isFinite,arraySourceSame=Object.is,
    arraySourceCreate=Object.create,arraySourceApply=Reflect.apply,
    arraySourceWeakGet=WeakMap.prototype.get,arraySourceWeakSet=WeakMap.prototype.set;

// Optional owned-JSON evidence for a direct AST caller. Read data descriptors
// only: getters, toJSON, functions, shared objects, sparse/extended Arrays and non-JSON values
// cannot manufacture a different project for the reset proof. Keep the actual
// physical input identities so artwork callbacks cannot renew this evidence.
function arrayExportSource(project) {
    try{
        const records=[],recorded=new WeakSet(),parts=[];
        const realm=[Object.prototype,Array.prototype].map(value=>({value,prototype:arraySourcePrototype(value),
            entries:arraySourceKeys(value).map(key=>[key,arraySourceDescriptor(value,key)])}));
        let size=0,nodes=0,live=true;
        const append=text=>{size+=text.length;if(size>8*1024*1024)throw Error('bounded source');parts.push(text);};
        const encode=(value,depth=0)=>{
            if(value===null){append('null');return;}
            if(typeof value==='string'||typeof value==='boolean'){
                if(typeof value==='string'&&value.length>8*1024*1024)throw Error('bounded source');
                append(arraySourceQuote(value));return;
            }
            if(typeof value==='number'){
                if(!arraySourceFinite(value)||arraySourceSame(value,-0))throw Error('non-JSON source');
                append(arraySourceQuote(value));return;
            }
            if(!value||typeof value!=='object'||depth>128||recorded.has(value))throw Error('non-JSON source');
            const array=arraySourceIsArray(value),prototype=arraySourcePrototype(value);
            if(prototype!==null&&prototype!==(array?Array.prototype:Object.prototype))throw Error('non-JSON source');
            const keys=arraySourceKeys(value),entries=keys.map(key=>[key,arraySourceDescriptor(value,key)]);
            if(++nodes>100000)throw Error('bounded source');
            recorded.add(value);records.push({value,prototype,entries});
            if(entries.some(([key,row])=>typeof key!=='string'||key==='toJSON'||!row||!arraySourceOwn(row,'value')))throw Error('non-JSON source');
            if(array){
                const length=arraySourceDescriptor(value,'length')?.value;
                if(!Number.isSafeInteger(length)||length<0||keys.length!==length+1)throw Error('non-JSON source');
                append('[');
                for(let i=0;i<length;i++){
                    const row=arraySourceDescriptor(value,String(i));
                    if(!row||!arraySourceOwn(row,'value')||!row.enumerable)throw Error('non-JSON source');
                    if(i)append(',');encode(row.value,depth+1);
                }
                append(']');
            }else{
                append('{');
                for(let i=0;i<entries.length;i++){
                    const [key,row]=entries[i];if(!row.enumerable)throw Error('non-JSON source');
                    if(i)append(',');append(arraySourceQuote(key));append(':');encode(row.value,depth+1);
                }
                append('}');
            }
        };
        const current=()=>{
            if(live)try{
                for(let batch=0;batch<2&&live;batch++){
                    const rows=batch===0?realm:records;
                    for(let at=0;at<rows.length&&live;at++){
                        const record=rows[at],keys=arraySourceKeys(record.value);
                        if(arraySourcePrototype(record.value)!==record.prototype||keys.length!==record.entries.length){live=false;break;}
                        for(let i=0;i<keys.length;i++){
                            const entry=record.entries[i],key=entry[0],before=entry[1],now=arraySourceDescriptor(record.value,keys[i]);
                            if(key!==keys[i]||!now||now.enumerable!==before.enumerable||now.configurable!==before.configurable||
                                arraySourceOwn(now,'value')!==arraySourceOwn(before,'value')||
                                (arraySourceOwn(before,'value')?now.writable!==before.writable||!arraySourceSame(now.value,before.value):
                                    now.get!==before.get||now.set!==before.set)){live=false;break;}
                        }
                    }
                }
            }catch{live=false;}
            return live;
        };
        encode(project);
        return current()?{json:parts.join(''),current}:null;
    }catch{return null;}
}

class ArcadeEmitter {
    mathNumberResult(target,node) {
        if(isProjectJsonSnapshot(this.project))return this.mathNormalResults.isNumberResult(target,node);
        // The direct API keeps the original live objects for artwork callbacks.
        // Its numeric proof uses only the constructor's descriptor-checked data
        // copy; caller objects cannot enroll in the private JSON issuer.
        if(!this.arrayOwnedSource?.current())return false;
        try{
            if(this.mathOwnedSnapshot===undefined){
                const snapshot=createProjectJsonSnapshot(this.arrayOwnedSource.json);
                this.mathOwnedSnapshot={snapshot,authority:createProjectMathNormalResults(snapshot)};
            }
            const targets=arraySourceDescriptor(this.project,'targets')?.value;
            const count=arraySourceDescriptor(targets,'length')?.value;
            let index=-1,id=null;
            for(let i=0;i<count;i++)if(arraySourceDescriptor(targets,i)?.value===target){if(index!==-1)return false;index=i;}
            if(index<0)return false;
            const blocks=arraySourceDescriptor(target,'blocks')?.value;
            const names=arraySourceKeys(blocks),size=arraySourceDescriptor(names,'length').value;
            for(let i=0;i<size;i++){
                const key=arraySourceDescriptor(names,i).value;
                if(typeof key==='string'&&arraySourceDescriptor(blocks,key)?.value===node){if(id!==null)return false;id=key;}
            }
            const actual=this.mathOwnedSnapshot.snapshot.targets[index],value=id!==null&&actual?.blocks?.[id];
            if(!value||!this.mathOwnedSnapshot.authority.isNumberResult(actual,value)||!this.arrayOwnedSource.current())return false;
            this.mathOwnedSourceUsed=true;return true;
        }catch{
            // Keep the ordinary refusal when optional owned evidence is absent.
            return false;
        }
    }
    // The same owned-copy bridge for the saved frame delta reporter, so the
    // direct API and JSON export select the same declaration types.
    frameDeltaNumberResult(target,node) {
        if(isProjectJsonSnapshot(this.project))return this.frameDeltaNumber.isNumberResult(target,node);
        if(!this.arrayOwnedSource?.current())return false;
        try{
            if(this.frameDeltaOwnedSnapshot===undefined){
                const snapshot=createProjectJsonSnapshot(this.arrayOwnedSource.json);
                this.frameDeltaOwnedSnapshot={snapshot,authority:createProjectFrameDeltaNumber(snapshot)};
            }
            const targets=arraySourceDescriptor(this.project,'targets')?.value;
            const count=arraySourceDescriptor(targets,'length')?.value;
            let index=-1,id=null;
            for(let i=0;i<count;i++)if(arraySourceDescriptor(targets,i)?.value===target){if(index!==-1)return false;index=i;}
            if(index<0)return false;
            const blocks=arraySourceDescriptor(target,'blocks')?.value;
            const names=arraySourceKeys(blocks),size=arraySourceDescriptor(names,'length').value;
            for(let i=0;i<size;i++){
                const key=arraySourceDescriptor(names,i).value;
                if(typeof key==='string'&&arraySourceDescriptor(blocks,key)?.value===node){if(id!==null)return false;id=key;}
            }
            const actual=this.frameDeltaOwnedSnapshot.snapshot.targets[index],value=id!==null&&actual?.blocks?.[id];
            if(!value||!this.frameDeltaOwnedSnapshot.authority.isNumberResult(actual,value)||!this.arrayOwnedSource.current())return false;
            this.frameDeltaOwnedSourceUsed=true;return true;
        }catch{
            return false;
        }
    }
    // The same owned-copy bridge for closed execution-root reachability, so
    // an uncalled procedure is unreachable through both export routes.
    isUnreachable(target,node) {
        if(isProjectJsonSnapshot(this.project))return this.closedOrdinaryEntry.isUnreachable(target,node);
        if(!this.arrayOwnedSource?.current())return false;
        try{
            if(this.entryOwnedSnapshot===undefined){
                const snapshot=createProjectJsonSnapshot(this.arrayOwnedSource.json);
                this.entryOwnedSnapshot={snapshot,authority:createClosedOrdinaryProjectEntry(snapshot)};
            }
            const targets=arraySourceDescriptor(this.project,'targets')?.value;
            const count=arraySourceDescriptor(targets,'length')?.value;
            let index=-1,id=null;
            for(let i=0;i<count;i++)if(arraySourceDescriptor(targets,i)?.value===target){if(index!==-1)return false;index=i;}
            if(index<0)return false;
            const blocks=arraySourceDescriptor(target,'blocks')?.value;
            const names=arraySourceKeys(blocks),size=arraySourceDescriptor(names,'length').value;
            for(let i=0;i<size;i++){
                const key=arraySourceDescriptor(names,i).value;
                if(typeof key==='string'&&arraySourceDescriptor(blocks,key)?.value===node){if(id!==null)return false;id=key;}
            }
            const actual=this.entryOwnedSnapshot.snapshot.targets[index],value=id!==null&&actual?.blocks?.[id];
            if(!value||!this.entryOwnedSnapshot.authority.isUnreachable(actual,value)||!this.arrayOwnedSource.current())return false;
            this.entryOwnedSourceUsed=true;return true;
        }catch{
            return false;
        }
    }
    closedOrdinaryEntryCurrent() {
        return this.closedOrdinaryEntry.current()&&(!this.entryOwnedSourceUsed||
            this.arrayOwnedSource.current()&&this.entryOwnedSnapshot.authority.current());
    }
    frameDeltaNumbersCurrent() {
        return this.frameDeltaNumber.current()&&(!this.frameDeltaOwnedSourceUsed||
            this.arrayOwnedSource.current()&&this.frameDeltaOwnedSnapshot.authority.current());
    }
    mathNumbersCurrent() {
        return this.mathNormalResults.current()&&(!this.mathOwnedSourceUsed||
            this.arrayOwnedSource.current()&&this.mathOwnedSnapshot.authority.current());
    }
    sdkFontOperand(block,input='FONT') {
        const types=this.sdkFontInputs.inputTypes(this.target,block,input);
        if(!this.sdkFontInputs.accepts(this.target,block,input,'Font')){this.note('SDK Font operand requires an actual typed Font factory or binding: '+block.opcode+' '+[...(types||[])].join('|'));return false;}
        return true;
    }
    sdkFontPrimitiveOperand(block,input,kind) {
        const types=this.sdkFontInputs.inputTypes(this.target,block,input);
        if(!this.sdkFontInputs.accepts(this.target,block,input,kind==='string'?'String':'Number')){this.note('SDK Font '+input+' requires a proven '+kind+' operand');return false;}return true;
    }
    controllerRepeatReceiver(b) {
        const player=String(b.fields.PLAYER?.[0]),button=b.fields.BUTTON?.[0],property=b.fields.PROPERTY?.[0];
        if(!['1','2','3','4'].includes(player)||!['A','B','up','down','left','right'].includes(button)||!['repeatDelay','repeatInterval'].includes(property)){
            this.note('Controller repeat requires fixed player/button/property fields');return null;
        }
        return `controller.player${player}.${button}`;
    }
    constructor (project, opts, snapshotCallbacks = false) {
        this.snapshotCallbacks = snapshotCallbacks;
        this.project = project;this.sdkFontInputs=sdkFontInputAuthority(project);
        this.closedOrdinaryEntry=createClosedOrdinaryProjectEntry(project);
        this.mathNormalResults=createProjectMathNormalResults(project);
        this.frameDeltaNumber=createProjectFrameDeltaNumber(project);
        this.opts = opts;
        // Capture once before any artwork callback. Resource emission and Array
        // proof consume the same privately branded normalized resource objects.
        this.animationFrameProducers = createAnimationFrameArrayProducers(opts);
        this.arrayReceiverAuthority = createArrayReferenceExportAuthority(project, opts, this.animationFrameProducers);
        this.arrayOwnedSource=isProjectJsonSnapshot(project)?null:arrayExportSource(project);
        this.arrayOwnedSnapshot=null;this.arrayOwnedSourceUsed=false;
        this.createdFieldWriteSites=[];
        this.arrayProofChecks=arraySourceCreate(null);this.arrayProofCheckCount=0;this.arrayProofInputs=new WeakMap();
        this.unsupported = [];
        // Diagnose each physical current clock reporter without rendering its
        // consumer. A malformed ordinary caller can be rejected before its
        // arguments are emitted; that must not hide this independent refusal.
        // This is validation only: it creates no Number fact or emission state.
        for (const target of project.targets) for (const block of Object.values(target.blocks || {})) {
            if(block?.opcode==='arcade_frameDeltaTime'&&!currentFrameDeltaReporter(target.blocks,block))this.note('Frame delta Number: current zero-input reporter or physical socket differs');
            if (block?.opcode === 'arcade_sceneMillis' && !currentSceneClockNumber(target.blocks, block)) {
                this.note('Scene clock Number: current zero-input reporter or unique parent differs');
            }
        }
        // Freeze actual owners before any host artwork callback can edit the project.
        this.functionSymbols=createOrdinaryExportSymbols(project,message=>this.note(message));
        this.sourceScalarCells=new Map();this.sourceReferenceCells=new Map();this.validScalarPrelude=true;
        try {this.sourceScalarCells=sourceScalarProject(this.project);this.sourceReferenceCells=sourceReferenceProject(this.project);for(const id of this.sourceReferenceCells.keys())if(this.sourceScalarCells.has(id))throw Error('Duplicate source scalar/reference declaration');} catch(error) {this.validScalarPrelude=false;this.note(error.message);}
        this.requiresAnimationPackage = false;
        this.requiresSevensegPackage = false;
        this.requiresTextSpritePackage = false;
        this.requiresDartsPackage = false;
        this.requiresCorgioPackage = false;
        this.requiresScrollerPackage = false;
        this.scrollerVersion='v0.1.2';
        const selectors=project.targets.flatMap(target=>Object.values(target.blocks || {}).filter(block=>block.opcode==='arcade_setBackgroundScrollVersion').map(block=>({target,block})));
        if(selectors.length>1)this.note('Arcade export requires one background scroll version selection');
        for(const {target,block} of selectors) {
            const version=directMenuValue(block,'VERSION',target.blocks);
            let parent=target.blocks[block.parent];
            while(parent && (['looks_hide','arcade_setPalette','arcade_setCharacterAnimationVersion'].includes(parent.opcode) || this.validScalarPrelude && ['arcade_declareSourceScalar','arcade_declareSourceReference'].includes(parent.opcode)))parent=target.blocks[parent.parent];
            if(!['v0.1.2',LEGACY_SCROLLER_REVISION].includes(version) || !['event_whenflagclicked', 'arcade_whenSourceStarts'].includes(parent?.opcode))this.note('Arcade background scroll version must be a fixed selection at the start of a green-flag script');
            else this.scrollerVersion=version;
        }
        this.characterVersion='v0.1.0';
        const characterSelectors=project.targets.flatMap(target=>Object.values(target.blocks || {}).filter(block=>block.opcode==='arcade_setCharacterAnimationVersion').map(block=>({target,block})));
        if(characterSelectors.length>1)this.note('Arcade export requires one character animation version selection');
        for(const {target,block} of characterSelectors) {
            const version=directMenuValue(block,'VERSION',target.blocks);
            let parent=target.blocks[block.parent];
            while(parent && (['looks_hide','arcade_setPalette','arcade_setBackgroundScrollVersion'].includes(parent.opcode) || this.validScalarPrelude && ['arcade_declareSourceScalar','arcade_declareSourceReference'].includes(parent.opcode)))parent=target.blocks[parent.parent];
            if(!['v0.1.0',LEGACY_CHARACTER_REVISION].includes(version) || !['event_whenflagclicked', 'arcade_whenSourceStarts'].includes(parent?.opcode))this.note('Arcade character animation version must be a fixed selection at the start of a green-flag script');
            else this.characterVersion=version;
        }
        this.requiresCharacterAnimationsPackage = false;
        this.warnings = [];
        this.tileAssets = new TileAssetExporter(this.warnings);
        // Reserve actual named resources across all fixed maps before anonymous
        // fallback IDs (or a conflicting edit's suffix) can take their names.
        for (const target of project.targets) for (const block of Object.values(target.blocks || {})) {
            if (block.opcode !== 'arcade_setTilemap') continue;
            let data;
            try { data = JSON.parse(this.literalInput(block, 'DATA')); } catch (_) { continue; }
            if (tilemapSource(data)) this.tileAssets.reserve(data.images);
        }
        this.sprites = project.targets.filter(t => !t.isStage);
        // Each sprite is a global `<name>Sprite`, kept clear of the program's variable names.
        this.spriteVar = new Map();
        const stage = project.targets.find(t => t.isStage);
        const globalNames = new Set(Object.values(stage?.variables || {}).map(variable => variable[0]));
        const used = new Set(RESERVED);
        for (const target of project.targets) for (const variable of Object.values(target.variables || {})) {
            const name = variable[0];
            let ts = ident(target.isStage || globalNames.has(name) ? name : `${target.name}_${name}`);
            if (RESERVED.has(ts)) ts += '_';
            used.add(ts);
        }
        for (const target of this.sprites) {
            let ts = `${ident(target.name)}Sprite`;
            while (used.has(ts)) ts += '_';
            this.spriteVar.set(target.name, ts);
            used.add(ts);
        }
        // An Arcade program (E1's import, or blocks from the Arcade/Arrays
        // extensions) keeps JavaScript's values: text stays text, a Boolean
        // stays a Boolean. A Scratch-only project keeps Scratch's numbers.
        this.arcadeValues = project.targets.some(t => Object.values(t.blocks || {})
            .some(b => b && /^(arcade|arrays)_/.test(b.opcode || '')));
        this.scratchKeyboard = project.targets.some(target => Object.values(target.blocks || {})
            .some(block => block?.opcode?.startsWith('arcade_'))) ? null : planScratchArcadeKeyboard(project.targets);
        this.variableMonitors = new Map();
        this.auxiliarySymbols = used;
        this.initialGlobals = new Map();
        this.editedSavedReferenceIds = new Map();
        this.globals = new Map();       // Scratch variable id|name -> TS name
        this.target = null;
        this.blocks = null;
        this.kinds = new Map();         // TS variable -> Set('number'|'string')
        this.usedNa = false;
        this.helpers = new Set();       // arcade-runtime.js helpers the program uses
        this.lists = new Map();         // TS list name -> initial items
        this.listKeys = new Map();      // `${target}:${name}` -> TS list name
        this.receivers = new Map();     // lower-case message -> [{fn, sprite}]
        this.backdropHats = new Map();  // lower-case backdrop name -> [{fn, sprite}]
        this.cloneScripts = new Map();  // sprite name -> [fn]
        this.cloneVars = new Map();     // sprite name -> Map(data key -> initial value), per-clone variables
        this.generated = [];            // generated functions (receivers, clone scripts, ...)
        this.guards = [];               // conditions that end the current script at a yield
        this.scriptSeq = 0;
        this.soundCache = new Map();
        this.songAssets = new Map();
        this.valueOperationHelpers = new Map();
        this.nativeAdditionSites = [];
        this.unsupportedDetails = [];
        this.refusalEvidence = null;
        this.namedArrays = new Map();
        this.legacyValueHelpers = new Map();
        this.templateNames = new Set();
        this.templateKinds = new Map();
        this.artVar = new Map();
        this.artPixels = new Map();
        this.handleTemplateVars = new Map();
        this.frameArrays = new Map();
        this.authoredAnimationArrays = new Map();
        // Qualified asset spellings written by name because the project does not carry the asset.
        this.namedMissingAssets = new Set();
        this.usesAnimationResources = false;
        this.sharedImageArrays = new Map();
        this.imageVars = new Set();
        this.handleVars = new Set();
        this.customSpriteKinds = new Set();
        this.boundSpriteKinds = new Set();
        this.sdkKindNames = new Set(['Player', 'Projectile', 'Food', 'Enemy', 'Text']);
        this.hasTextKindLibrary = false;
        this.eventLocationName = null;
        this.eventTilemapName = null;
        this.eventHandles = null;
        this.eventKind = null;
        this.destroyedCallbacks = new Map();
        this.registeredCallbackBlocks = new Map();
        this.registeredCallbackKinds = new Map();
        this.registeredCallbacks = new Map();
        this.compilingRegisteredCallbacks = new Set();
        this.usedRegisteredCallbacks = new Set();
        this.usedDestroyedCallbacks = new Set();
        this.currentLocalNames = null;
        this.implicitLoopYield=true;
        this.managedValueProcedures=new Set();
        this.emittedSprites = new Set();    // the targets that became an Arcade sprite
        this.hasProjectPalette = this.project.targets.some(target =>
            Object.values(target.blocks || {}).some(block => block.opcode === 'arcade_setPalette'));
        this.analyse();
        const palettes = this.project.targets.map(target => {
            const costume = target.costumes[target.currentCostume || 0];
            const palette = costume && (snapshotCallbacks ?
                opts.costumePalette?.(target,costume,snapshotAssetContext(project,target,costume)) : opts.costumePalette?.(target,costume));
            const svg = costume && opts.costumeSvg?.(target, costume);
            const indexed = svg && svgToPixels(svg, isPalette(palette) ? palette : ARCADE_PALETTE);
            return indexed?.palette || (isPalette(palette) ? palette : ARCADE_PALETTE);
        });
        palettes.push(...this.animationFrameProducers.entries.filter(entry => entry.resource)
            .map(entry => entry.resource.palette).filter(isPalette));
        this.palette = palettes.find(palette => !samePalette(palette, ARCADE_PALETTE)) || ARCADE_PALETTE;
    }

    /** Scratch clears the Stage to white underneath transparent backdrop pixels. */
    stageMatte () {
        const index = nearestIndex([255, 255, 255], this.palette);
        if (!/^#?ffffff$/i.test(String(this.palette[index]).trim())) {
            this.warn('Stage white matte quantized to the nearest opaque project palette colour');
        }
        return `scene.setBackgroundColor(${index})`;
    }

    prepareAuthoredAnimations () {
        if (this.authoredAnimationsPrepared) return;
        this.authoredAnimationsPrepared = true;
        if (!this.animationFunctionNames) {
            const declaredVariables = this.project.targets.flatMap(target => Object.values(target.variables || {}).map(variable => {
                let name = ident(target.isStage || this.isGlobalVar(variable[0]) ? variable[0] : `${target.name}_${variable[0]}`);
                if (RESERVED.has(name)) name += '_';
                return name;
            }));
            const occupied = new Set([...declaredVariables, ...this.globals.values(), ...this.functionNames(), ...this.spriteVar.values(),
                ...[...this.sharedImageArrays.values(), ...this.frameArrays.values()].map(array => array.name)]);
            this.animationSymbol = base => {
                let name = base;
                while (occupied.has(name)) name += '_';
                occupied.add(name);
                return name;
            };
            this.animationFactoryNamespace = this.animationSymbol('__bwAnimationAssets');
            this.animationFunctionNames = {frames: this.animationSymbol('__bwAnimationFrames'),
                fresh: this.animationSymbol('__bwAnimationFreshFrames'),
                interval: this.animationSymbol('__bwAnimationInterval')};
        }
        // Reserve projections before suffix allocation, so a duplicate cannot
        // take another resource's existing display name or generated ID alias.
        const entries = this.animationFrameProducers.entries;
        const assetNames = new Set(entries.filter(entry => entry.resource)
            .map(entry => nativeAnimationNameBase(entry.resource.name)));
        const usedNames = new Set();
        if (!this.authoredAnimationArrays.size) {
            for (const entry of entries) {
                if (entry.error) { this.note(entry.error); continue; }
                const {snapshotDocument: document, resource} = entry;
                try {
                    if (this.authoredAnimationArrays.has(resource.id)) {
                        this.note(`Duplicate animation resource ID: ${resource.id}`);
                        continue;
                    }
                    for (const warning of resource.warnings) this.warn(warning);
                    const baseName = nativeAnimationNameBase(resource.name);
                    let nativeName = baseName, suffix = 2;
                    while (usedNames.has(nativeName) || (nativeName !== baseName && assetNames.has(nativeName))) {
                        const ending = ` ${suffix++}`;
                        nativeName = baseName.slice(0, 80 - ending.length) + ending;
                    }
                    const images = resource.frames.map(frame => {
                        const image = {width: resource.width, height: resource.height, pixels: frame.pixels};
                        if (samePalette(resource.palette, this.palette)) return image;
                        if (resource.palette.some((colour, index) => index && !this.palette.some(target =>
                            String(target).toLowerCase() === String(colour).toLowerCase()))) {
                            this.warn(`Animation "${resource.name}" colours quantized to the exported project palette`);
                        }
                        return remapPalette(image, resource.palette, this.palette);
                    });
                    let nativeId = `animation${this.authoredAnimationArrays.size}`;
                    while (assetNames.has(nativeId) || usedNames.has(nativeId) || nativeId === nativeName) nativeId += '_';
                    const nativeEntry = encodeAnimationJres({id: nativeId, namespace: 'myAnimations',
                        name: nativeName, width: resource.width, height: resource.height,
                        intervalMs: resource.frames[0].durationMs, frames: images});
                    usedNames.add(nativeName);
                    if (nativeName !== resource.name) this.warn(`Animation name ${JSON.stringify(resource.name)} mapped to ${JSON.stringify(nativeName)} for native export`);
                    this.authoredAnimationArrays.set(resource.id, {...resource, sourceResource:resource, nativeId, nativeEntry, document,
                        variable: this.animationSymbol(`__bwAnimationFrames${this.authoredAnimationArrays.size}`),
                        literals: images.map(image => toImgLiteral(image))});
                } catch (error) { this.note(error.message); }
            }
        }
    }

    authoredAnimation (b) {
        this.usesAnimationResources = true;
        this.prepareAuthoredAnimations();
        // Only the actual JSON entry can skip input evaluation. The descriptor
        // gate also excludes inherited slots/getters on otherwise frozen data.
        if(this.snapshotCallbacks&&isProjectJsonSnapshot(this.project)&&!this.currentCallableContext&&!this.currentClassConstructor&&
            this.functionSymbols?.current()&&!this.functionNames().includes('assets')&&ownedAnimationLiteral(this.project,this.target,b)){
            const allocation=this.animationFrameProducers.resolve(this.target,b,{targets:this.project.targets,monitors:this.project.monitors});
            const resource=allocation&&!allocation.shared&&ownedAnimationLiteral(this.project,this.target,b)?
                this.animationFrameProducers.freshResource(this.target,b,{targets:this.project.targets,monitors:this.project.monitors}):null;
            const emitted=resource&&this.authoredAnimationArrays.get(resource.id);
            if(emitted?.sourceResource===resource&&this.animationFrameProducers.isCurrent()&&
                ownedAnimationLiteral(this.project,this.target,b))
                return `assets.animation\`${emitted.nativeId}\``;
        }
        let id = this.literalInput(b, 'RESOURCE');
        const menu = this.block(b.inputs?.RESOURCE?.[1]);
        if (menu?.opcode === 'arcade_menu_animationAssets') id = menu.fields?.animationAssets?.[0];
        if (id !== null && !this.authoredAnimationArrays.has(id)) this.note(`Animation resource unavailable: ${id}`);
        const method = b.opcode === 'arcade_animationAssetFrames' ? this.animationFunctionNames.frames :
            b.opcode === 'arcade_animationAssetFreshFrames' ? this.animationFunctionNames.fresh : this.animationFunctionNames.interval;
        // A string literal resource is already a String: pass it as is, so the
        // lookup's `id: string` formal keeps a String producer on reimport
        // (`"" + "<id>"` reimports as a generic addition typed any).
        const resource = this.arrayValue(b, 'RESOURCE');
        if (/^"(?:[^"\\\n]|\\.)*"$/.test(resource)) return `${method}(${resource})`;
        // Likewise a global whose actual writers are all String, or a never-
        // written global holding a saved string (the producers' own rule): its final
        // declaration is checked after declarations, and a global not
        // declared string goes back to the `"" + key` form.
        const raw = b.inputs?.RESOURCE?.[1], variableId = Array.isArray(raw) && raw[0] === 12 ? raw[2] || raw[1] : null;
        if (variableId && (this.primitiveVariableTypes.get(variableId) === 'string' ||
            constantStringVariable(this.target, raw, {targets: this.project.targets, monitors: this.project.monitors}) !== null) &&
            /^[A-Za-z_$][\w$]*$/.test(resource)) {
            this.directStringArguments.add(`${method}(${resource})`);
            return `${method}(${resource})`;
        }
        return `${method}("" + ${resource})`;
    }

    /** Record what kind of value a variable is given, for its declaration. */
    assign (tsName, expr, explicitKind) {
        if (explicitKind) {
            if (!this.kinds.has(tsName)) this.kinds.set(tsName, new Set());
            this.kinds.get(tsName).add(explicitKind);
            return;
        }
        if (!this.kinds.has(tsName)) this.kinds.set(tsName, new Set());
        // A list item can be text or a number: the variable holding it is `any`.
        if (/^_item\(/.test(expr)) {
            this.kinds.get(tsName).add('number').add('string');
            return;
        }
        const kind = /^"|^\("" \+|^_listText\(|Names\[|^game\.askForString\(/.test(expr) ? 'string' : 'number';
        this.kinds.get(tsName).add(kind);
    }

    /**
     * The value standing in for something with no Arcade counterpart: a
     * variable, not the literal 0, because Static TypeScript narrows a literal
     * and then refuses `0 == 2` (census: two games).
     */
    na () {
        this.usedNa = true;
        return '_na';
    }

    nativeAdditionSite (block, helper) {
        const own=(object,key)=>{
            if(!object||typeof object!=='object')return undefined;
            const descriptor=provenanceDescriptor(object,key);
            return descriptor&&provenanceOwn(descriptor,'value')?descriptor.value:undefined;
        };
        const targets=own(this.project,'targets');
        if(!provenanceArray(targets))return null;
        let target;
        for(let i=0;i<own(targets,'length');i++)if(own(targets,String(i))===this.target){target=this.target;break;}
        if(!target)return null;
        const blocks=own(target,'blocks');if(!blocks||blocks!==this.blocks)return null;
        const blockId=provenanceKeys(blocks).find(id=>typeof id==='string'&&own(blocks,id)===block);
        if(blockId===undefined)return null;
        const inputs=own(block,'inputs'),link=name=>{
            const slot=own(inputs,name),id=provenanceArray(slot)?own(slot,'1'):null;
            return typeof id==='string'?id:'UNAVAILABLE';
        };
        const targetName=own(target,'name'),opcode=own(block,'opcode');
        return {helper,target:typeof targetName==='string'?targetName:'UNAVAILABLE',blockId,
            opcode:typeof opcode==='string'?opcode:'UNAVAILABLE',operands:['LEFT','RIGHT'],
            operandBlocks:{LEFT:link('LEFT'),RIGHT:link('RIGHT')}};
    }

    note (what) {
        if (!this.unsupported.includes(what)) this.unsupported.push(what);
        return what;
    }

    warn (what) {
        if (!this.warnings.includes(what)) this.warnings.push(what);
    }

    /** A switch to a name the project does not have: Scratch does nothing, and so does this. */
    missing (push, what) {
        this.warn(`${what} — it does nothing, as in Scratch`);
        push(`// ${what} — it does nothing, as in Scratch`);
    }

    volumeWarning () {
        this.warn('volume is one setting for the whole game in Arcade (Scratch keeps one per sprite)');
    }

    /** A helper from arcade-runtime.js, recorded as used; returns its name for chaining. */
    use (name, what = '') {
        this.helpers.add(name);
        return what;
    }

    /**
     * Which sprites are ever cloned, which use costumes, backdrops or the pen:
     * all decided before the first line is written, because each changes how
     * EVERY script of that sprite is emitted (a cloned sprite's scripts act on
     * `self`, a pen sprite's moves draw).
     */
    analyse () {
        this.clonable = new Set();
        this.costumeUsers = new Set();
        this.scratchPose = new Set();
        this.scratchScale = new Set();
        this.penUsers = new Set();
        this.usesBackdrops = false;
        this.usesPen = false;
        this.usesStopAll = false;
        this.usesSay = false;
        this.usesStageSpeech = false;
        this.stopOthers = new Set();        // targets whose scripts can be stopped by one of their own
        this.soundWaiters = new Set();      // targets that wait on a tone
        const names = new Set(this.sprites.map(t => t.name));
        for (const t of this.project.targets) {
            const blocks = t.blocks || {};
            for (const b of Object.values(blocks)) {
                if (!b || !b.opcode) continue;
                if (b.opcode === 'control_stop') {
                    const option = b.fields && b.fields.STOP_OPTION ? b.fields.STOP_OPTION[0] : '';
                    if (option === 'all') this.usesStopAll = true;
                    if (/^other scripts in (sprite|stage)$/.test(option)) this.stopOthers.add(t);
                }
                if (/^looks_say/.test(b.opcode)) this.usesSay = true;
                if (/^(sound_playuntildone|music_playNoteForBeats)$/.test(b.opcode)) this.soundWaiters.add(t);
                if (b.opcode === 'control_create_clone_of') {
                    const input = b.inputs && b.inputs.CLONE_OPTION;
                    const menu = input && input[0] === 1 && typeof input[1] === 'string' ? blocks[input[1]] : null;
                    const what = menu && menu.fields && menu.fields.CLONE_OPTION ? menu.fields.CLONE_OPTION[0] : '';
                    if (what === '_myself_' && !t.isStage) this.clonable.add(t.name);
                    else if (names.has(what)) this.clonable.add(what);
                }
                if (/^looks_(switchcostumeto|nextcostume|costumenumbername)$/.test(b.opcode) && !t.isStage) this.costumeUsers.add(t.name);
                if (!t.isStage && /^motion_(direction|pointindirection|pointtowards|setrotationstyle|turnleft|turnright|movesteps)$/.test(b.opcode)) {
                    this.scratchPose.add(t.name);
                }
                if (!t.isStage && /^looks_(size|setsizeto|changesizeby)$/.test(b.opcode)) this.scratchScale.add(t.name);
                if (/^looks_(switchbackdropto|switchbackdroptoandwait|nextbackdrop|backdropnumbername)$|^event_whenbackdropswitchesto$/.test(b.opcode)) {
                    this.usesBackdrops = true;
                }
                if (/^pen_/.test(b.opcode) && !/_menu_|Menu$/.test(b.opcode)) {
                    this.usesPen = true;
                    if (!t.isStage) this.penUsers.add(t.name);
                }
            }
        }
    }

    isClonable (target = this.target) {
        return !!target && !target.isStage && this.clonable.has(target.name);
    }

    /**
     * Does a script of `target` carry a run token (`_t`)? Only when something
     * can stop it from outside: a `stop all` anywhere, or a `stop other
     * scripts` in its own sprite. `stop this script` needs none (a return).
     */
    tokened (target = this.target) {
        return this.usesStopAll || this.stopOthers.has(target);
    }

    /** The globals holding a non-cloned target's `stop other scripts` mark and the run it kept. */
    stopMarks (target = this.target) {
        const id = ident(target.isStage ? 'stage' : target.name);
        return [`_som_${id}`, `_sok_${id}`];
    }

    /**
     * What every script of the current target starts with and checks at each
     * yield, beyond its restart/clone guards: its run token, and whether a
     * `stop all` or a `stop other scripts` has ended it since it started.
     */
    stopGuards () {
        const guards = [];
        if (!this.tokened()) return guards;
        this.use('tok');
        if (this.usesStopAll) guards.push('_dead(_t)');
        if (this.stopOthers.has(this.target)) {
            if (this.isClonable()) {
                this.use('others');
                guards.push('_othersStopped(self, _t)');
            } else {
                const [mark, kept] = this.stopMarks();
                guards.push(`(_t <= ${mark} && _t != ${kept})`);
            }
        }
        return guards;
    }

    tokenLine (target = this.target) {
        return this.tokened(target) ? ['    const _t = _tok()'] : [];
    }

    kindOf (name) { return `_kind_${ident(name)}`; }

    allOf (name) { return `_all_${ident(name)}()`; }

    costumeSet (target) { return `${ident(target.name)}Costumes`; }

    costumeNames (target) { return `${ident(target.name)}CostumeNames`; }

    /** The reporter obscuring a menu input, as an expression — null when the menu itself is set. */
    dynamicInput (b, name) {
        const input = b.inputs && b.inputs[name];
        if (!input || (input[0] !== 2 && input[0] !== 3)) return null;
        if (Array.isArray(input[1])) return input[1][0] === 12 || input[1][0] === 13 ? this.value(b, name) : null;
        if (typeof input[1] !== 'string') return null;
        const r = this.block(input[1]);
        return r && !r.shadow ? this.value(b, name) : null;
    }

    /** The raw literal of an input, when it is one (list indices "last", "all", ...). */
    literal (b, name) {
        const input = b.inputs && b.inputs[name];
        const slot = input && input[1];
        if (Array.isArray(slot) && slot[0] !== 12 && slot[0] !== 13) return String(slot[1]);
        if (typeof slot === 'string') {
            const r = this.block(slot);
            if (r && r.shadow && r.fields) {
                const f = Object.values(r.fields)[0];
                if (f) return String(f[0]);
            }
        }
        return null;
    }

    /** A yield point: end this script here if it was restarted, or its clone deleted. */
    guardLine () {
        return this.guards.length ? [`if (${this.guards.join(' || ')}) return`] : [];
    }

    // ── lists ────────────────────────────────────────────────────────────
    listName (b) {
        const f = b.fields && b.fields.LIST;
        const name = f ? f[0] : 'list';
        const stage = this.project.targets.find(t => t.isStage) || this.target;
        const local = Object.values(this.target.lists || {}).some(l => l[0] === name) && !this.target.isStage;
        const owner = local ? this.target : stage;
        const key = `${owner.isStage ? '' : owner.name}:${name}`;
        if (this.listKeys.has(key)) return this.listKeys.get(key);
        let ts = `${ident(owner.isStage ? name : `${owner.name}_${name}`)}List`;
        if (RESERVED.has(ts)) ts = `${ts}_`;
        const decl = Object.values(owner.lists || {}).find(l => l[0] === name);
        this.listKeys.set(key, ts);
        this.lists.set(ts, decl && Array.isArray(decl[1]) ? decl[1] : []);
        if (local && this.isClonable(owner)) {
            this.note(`list "${name}" of cloned sprite ${owner.name}: one list shared by the sprite and its clones (Scratch gives each clone a copy)`);
        }
        this.use('list');
        return ts;
    }

    /** A 1-based list index input, with Scratch's words for the ends. */
    listIndex (b, list, name = 'INDEX') {
        const lit = this.literal(b, name);
        if (lit === 'last') return `${list}.length`;
        if (lit === 'random' || lit === 'any') return `randint(1, ${list}.length)`;
        return this.value(b, name);
    }

    listStmt (b, push) {
        const v = n => this.value(b, n, '""');
        const list = this.listName(b);
        switch (b.opcode) {
        case 'data_addtolist': push(`${list}.push(${v('ITEM')})`); return true;
        case 'data_deletealloflist': push(`_clearList(${list})`); return true;
        case 'data_deleteoflist':
            if (this.literal(b, 'INDEX') === 'all') push(`_clearList(${list})`);
            else push(`_delItem(${list}, ${this.listIndex(b, list)})`);
            return true;
        case 'data_insertatlist': {
            const lit = this.literal(b, 'INDEX');
            if (lit === 'last') push(`${list}.push(${v('ITEM')})`);
            else push(`_insItem(${list}, ${lit === 'random' || lit === 'any' ? `randint(1, ${list}.length + 1)` : this.value(b, 'INDEX')}, ${v('ITEM')})`);
            return true;
        }
        case 'data_replaceitemoflist': push(`_setItem(${list}, ${this.listIndex(b, list)}, ${v('ITEM')})`); return true;
        default: return false;
        }
    }

    // ── sounds ───────────────────────────────────────────────────────────
    /** The steady tone a sound is, or why it is not one. */
    soundTone (name) {
        const target = this.target;
        const key = `${target.name}:${name}`;
        if (this.soundCache.has(key)) return this.soundCache.get(key);
        const sound = (target.sounds || []).find(x => x.name === name);
        let r;
        if (!sound) r = {reason: 'no such sound'};
        else {
            const bytes = this.opts.soundData ? this.opts.soundData(target, sound) : null;
            r = bytes ? analyseTone(bytes) : {reason: 'its audio was not available to the export'};
        }
        this.soundCache.set(key, r);
        return r;
    }

    // ── names ────────────────────────────────────────────────────────────
    functionNames () { return this.functionSymbols?.values() || []; }
    functionName (target,code) { return this.functionSymbols?.name(target,code) || null; }
    varName (target, name) {
        const key = `${target.isStage ? '' : target.name}:${name}`;
        if (this.globals.has(key)) return this.globals.get(key);
        // A variable named `score` is Arcade's own score (info); others are
        // globals, prefixed with their sprite when sprite-local.
        let ts = ident(target.isStage || this.isGlobalVar(name) ? name : `${target.name}_${name}`);
        if (RESERVED.has(ts)) ts = `${ts}_`;
        this.globals.set(key, ts);
        const owner = this.isGlobalVar(name) ? this.project.targets.find(candidate => candidate.isStage) : target;
        const entry = Object.entries(owner.variables || {}).find(([, variable]) => variable[0] === name);
        const initial = entry?.[1]?.[1];
        const tag = owner.bwValues?.version === 1 && entry ? owner.bwValues.variables?.[entry[0]] : null;
        const reference = tag && Object.keys(tag).length === 1 && tag.bwReference;
        // SB3's readable placeholder is not an image or byte-buffer value.
        // These resources are per-run and do not resolve after loading;
        // source assignments recreate them. Honor the sidecar only while its
        // standard field still matches, just as the VM's SB3 loader does.
        if (['image','buffer'].includes(reference?.kind) && typeof reference.id === 'string' &&
            initial === `[${reference.kind} reference ${reference.id}]`) {
            this.initialGlobals.set(ts, null);
            return ts;
        }
        if (['image','buffer'].includes(reference?.kind) && typeof reference.id === 'string' &&
            initial !== `[${reference.kind} reference ${reference.id}]` && this.sourceReferenceCells.has(entry[0])) {
            // An explicit edit to the standard SB3 field invalidates its saved
            // resource tag. Keep the edited value; the source declaration must
            // not silently restore authority from that stale tag.
            this.editedSavedReferenceIds.set(entry[0], initial);
            this.note(`Source reference ${name}: saved resource tag differs from its standard variable value`);
        }
        if (entry) this.globalVariableIds.set(ts, entry[0]);
        if (['string', 'number', 'boolean'].includes(typeof initial) &&
            (typeof initial !== 'number' || Number.isFinite(initial))) {
            this.initialGlobals.set(ts, initial);
            if (typeof initial !== 'number' || initial !== 0) this.assign(ts, '', typeof initial);
        }
        return ts;
    }

    isGlobalVar (name) {
        const stage = this.project.targets.find(t => t.isStage);
        return !!(stage && Object.values(stage.variables || {}).some(v => v[0] === name));
    }

    /** In an Arcade program, the global `score` and `lives` are Arcade's own (info). */
    infoVariable (name) {
        return this.arcadeValues && this.isGlobalVar(name) && ['score', 'lives'].includes(name) ? name : null;
    }

    lookupVar (name) {
        // A read resolves sprite-local first, then global (Scratch's rule).
        const local = Object.values(this.target.variables || {}).some(v => v[0] === name);
        // A cloned sprite's own variable lives in each instance's data, so
        // every clone has its copy (made from its parent's when it is cloned).
        if (local && this.isClonable() && !this.isGlobalVar(name)) {
            const key = `v:${name}`;
            if (!this.cloneVars.has(this.target.name)) this.cloneVars.set(this.target.name, new Map());
            const init = Object.values(this.target.variables).find(v => v[0] === name)[1];
            this.cloneVars.get(this.target.name).set(key, init);
            return `self.data[${JSON.stringify(key)}]`;
        }
        return local ? this.varName(this.target, name) : this.varName(this.project.targets.find(t => t.isStage) || this.target, name);
    }

    scratchButton (key) {
        return this.scratchKeyboard ? this.scratchKeyboard.controls.get(key) : KEY_BUTTON[key];
    }

    browserPointer () {
        if (!this.opts.browserPointer) return null;
        if (!this.pointer) {
            this.warn('Mouse and touch controls use the MakeCode Arcade browser simulator.');
            this.pointer = {
                x: this.reserveAuxiliarySymbol('__bwPointerX'),
                y: this.reserveAuxiliarySymbol('__bwPointerY'),
                down: this.reserveAuxiliarySymbol('__bwPointerDown'),
                hits: this.reserveAuxiliarySymbol('__bwPointerHits'),
                scripts: new Map()
            };
        }
        return this.pointer;
    }

    pointerSource (pre, handlers) {
        const {x, y, down, hits, scripts} = this.pointer;
        pre.push(
            `let ${x} = 80`,
            `let ${y} = 60`,
            `let ${down} = false`,
            [
                `function ${hits} (sprite: Sprite): boolean {`,
                '    if (!sprite || (sprite.flags & (SpriteFlag.Invisible | sprites.Flag.Destroyed)) !== 0) return false',
                `    const dx = ${x} - sprite.x; const dy = ${y} - sprite.y`,
                '    if (sprite.sx <= 0 || sprite.sy <= 0) return false',
                '    const sine = Math.sin(sprite.rotation); const cosine = Math.cos(sprite.rotation)',
                '    const ix = Math.floor((dx * cosine + dy * sine) / sprite.sx + sprite.image.width / 2)',
                '    const iy = Math.floor((-dx * sine + dy * cosine) / sprite.sy + sprite.image.height / 2)',
                '    return ix >= 0 && ix < sprite.image.width && iy >= 0 && iy < sprite.image.height && sprite.image.getPixel(ix, iy) !== 0',
                '}'
            ].join('\n')
        );
        const move = [`    ${x} = Math.clamp(0, 159, Math.floor(px))`, `    ${y} = Math.clamp(0, 119, Math.floor(py))`];
        handlers.push(
            ['browserEvents.onMouseMove(function (px, py) {', ...move, '})'].join('\n'),
            `browserEvents.MouseLeft.onEvent(browserEvents.MouseButtonEvent.Released, function () { ${down} = false })`,
            `browserEvents.onEvent(browserEvents.Event.PointerCancel, function () { ${down} = false })`,
            `browserEvents.onEvent(browserEvents.Event.PointerLeave, function () { ${down} = false })`
        );
        const click = ['browserEvents.MouseLeft.onEvent(browserEvents.MouseButtonEvent.Pressed, function (px, py) {',
            ...move, `    ${down} = true`];
        if (scripts.size) {
            click.push('    let picked: Sprite = null', '    let target = -1');
            const shown = this.sprites.filter(sprite => this.emittedSprites.has(sprite));
            for (const [index, sprite] of shown.entries()) {
                const clones = this.isClonable(sprite);
                const group = clones ? this.allOf(sprite.name) : `[${this.spriteVar.get(sprite.name)}]`;
                click.push(`    for (const sprite of ${group}) {`,
                    `        if (${hits}(sprite) && (!picked || sprite.z >= picked.z)) {`,
                    `            picked = sprite; target = ${index}`, '        }', '    }');
                const action = scripts.get(sprite);
                if (action) action.index = index;
            }
            for (const [sprite, action] of scripts) {
                const selected = sprite.isStage ? -1 : action.index;
                if (selected === undefined) continue;
                click.push(`    if (target === ${selected}) {`, ...action.functions.map(fn =>
                    `        control.runInParallel(function () { ${fn}(${this.isClonable(sprite) ? 'picked' : ''}) })`), '    }');
            }
        }
        click.push('})');
        handlers.push(click.join('\n'));
    }

    reserveAuxiliarySymbol (base) {
        let name = base;
        const functions = new Set(this.functionNames());
        while (this.auxiliarySymbols.has(name) || functions.has(name)) name += '_';
        this.auxiliarySymbols.add(name);
        return name;
    }

    scratchTextAnswer () {
        if (!this.textAnswer) {
            this.textAnswer = this.reserveAuxiliarySymbol('__bwScratchAnswer');
            this.warn('Scratch questions use Arcade’s text entry dialog.');
        }
        return this.textAnswer;
    }

    variableMonitor (id, name) {
        if (!id || !name) return null;
        if (this.variableMonitors.has(id)) return this.variableMonitors.get(id);
        const owner = this.project.targets.find(target => target.variables?.[id]?.[0] === name);
        if (!owner || !owner.isStage && this.isGlobalVar(name)) return null;
        const info = this.infoVariable(name);
        let value;
        if (info) value = info === 'score' ? 'info.score()' : 'info.life()';
        else if (this.isClonable(owner)) {
            const key = `v:${name}`;
            if (!this.cloneVars.has(owner.name)) this.cloneVars.set(owner.name, new Map());
            this.cloneVars.get(owner.name).set(key, owner.variables[id][1]);
            value = `${this.spriteVar.get(owner.name)}.data[${JSON.stringify(key)}]`;
        } else value = this.varName(owner, name);
        const flag = this.reserveAuxiliarySymbol('__bwMonitorVisible');
        const entry = {value, name: owner.isStage ? name : `${owner.name}: ${name}`,
            flag, visible: false};
        this.variableMonitors.set(id, entry);
        return entry;
    }

    variableMonitorDrawing () {
        const dark = nearestIndex([0, 0, 0], this.palette);
        const light = nearestIndex([255, 255, 255], this.palette);
        const rows = [...this.variableMonitors.values()].map(({flag, value, name}) => [
            `    if (${flag}) {`,
            `        const label = (${JSON.stringify(name + ': ')} + (${value})).substr(0, 38)`,
            '        const width = label.length * image.font5.charWidth + 4',
            '        if (x + width > screen.width) { x = 2; y += 8 }',
            '        if (y + 7 <= screen.height) {',
            `            screen.fillRect(x, y, width, 7, ${dark})`,
            `            screen.print(label, x + 2, y + 1, ${light}, image.font5)`,
            '            x += width + 2',
            '        }',
            '    }'
        ].join('\n'));
        return ['game.onShade(function () {', '    let x = 2; let y = 2', ...rows, '})'].join('\n');
    }

    /**
     * E1's import keeps an Arcade program's own code on a sprite named Game.
     * Dormant artwork on a hidden program host does not create an Arcade
     * actor. Current self behavior and references still need sprite identity.
     */
    isScriptHost (target) {
        if (!this.arcadeValues || target.name !== 'Game') return false;
        if (this.hasHandles) return true;
        const usesSelf = Object.values(target.blocks || {}).some(b => b && b.opcode !== 'looks_hide' &&
            /^(motion_|looks_|pen_|sensing_touchingobject|sensing_distanceto|sensing_touchingcolor|sensing_coloristouchingcolor|control_create_clone_of|control_start_as_clone|control_delete_this_clone)/.test(b.opcode));
        if (usesSelf) return false;
        // A hidden program host can retain the editor's dormant costume. Merely
        // making that costume readable through the GUI rasterizer must not
        // allocate an extra gameplay actor. Current references still need one.
        if (this.referencedSpriteIdentity(target)) return false;
        if (target.visible === false || this.startsHidden(target)) return true;
        if (target.costumes?.some(c =>
            (this.opts.costumeSvg && svgToPixels(this.opts.costumeSvg(target, c) || '')) ||
            (this.opts.costumeRgba && this.opts.costumeRgba(target, c)))) return false;
        return true;
    }

    startsHidden (target) {
        const starts = Object.entries(target.blocks || {}).filter(([, block]) => block?.topLevel &&
            ['event_whenflagclicked', 'arcade_whenSourceStarts'].includes(block.opcode));
        return starts.length > 0 && starts.every(([id, start]) => {
            let parent = id, next = start.next;
            const seen = new Set([id]);
            while (['arcade_declareSourceScalar', 'arcade_declareSourceReference'].includes(target.blocks[next]?.opcode)) {
                const declaration = target.blocks[next];
                if (seen.has(next) || start.opcode !== 'arcade_whenSourceStarts' || !this.validScalarPrelude ||
                    declaration.parent !== parent || declaration.shadow !== false || declaration.topLevel !== false ||
                    declaration.mutation != null || Object.keys(declaration.inputs || {}).join(',') !== 'VARIABLE' ||
                    Object.keys(declaration.fields || {}).join(',') !== 'TYPE') return false;
                const slot = declaration.inputs.VARIABLE;
                if (!Array.isArray(slot) || ![1, 2, 3].includes(slot[0])) return false;
                let variable;
                if (Array.isArray(slot[1]) && slot[1][0] === 12) variable = slot[1];
                else {
                    const reporter = typeof slot[1] === 'string' && target.blocks[slot[1]];
                    if (reporter?.opcode !== 'data_variable' || reporter.parent !== next || reporter.next != null ||
                        reporter.shadow !== false || reporter.topLevel !== false ||
                        reporter.mutation != null || Object.keys(reporter.inputs || {}).length ||
                        Object.keys(reporter.fields || {}).join(',') !== 'VARIABLE') return false;
                    variable = [12, ...reporter.fields.VARIABLE];
                }
                if (variable.length !== 3 || typeof variable[1] !== 'string' || typeof variable[2] !== 'string') return false;
                const inventory = declaration.opcode === 'arcade_declareSourceScalar' ? this.sourceScalarCells : this.sourceReferenceCells;
                const entry = inventory.get(variable[2]);
                if (!entry || entry.name !== variable[1] || entry.type !== declaration.fields.TYPE[0]) return false;
                seen.add(next); parent = next; next = declaration.next;
            }
            const hide = target.blocks[next];
            return start.shadow === false && start.parent == null &&
                !seen.has(next) && hide?.opcode === 'looks_hide' && hide.parent === parent && hide.shadow === false &&
                hide.topLevel === false && Object.keys(hide.inputs || {}).length === 0 &&
                Object.keys(hide.fields || {}).length === 0 && hide.mutation == null;
        });
    }

    referencedSpriteIdentity (target) {
        if (this.clonable.has(target.name) || this.sprites.filter(t => t.name === target.name).length !== 1) return true;
        const selectors = {motion_goto: 'TO', motion_glideto: 'TO', motion_pointtowards: 'TOWARDS',
            sensing_touchingobject: 'TOUCHINGOBJECTMENU', sensing_distanceto: 'DISTANCETOMENU',
            sensing_of: 'OBJECT', control_create_clone_of: 'CLONE_OPTION'};
        for (const owner of this.project.targets) for (const block of Object.values(owner.blocks || {})) {
            const field = selectors[block?.opcode];
            if (!field) continue;
            const slot = block.inputs?.[field];
            // Unknown and dynamic selectors can name this target. Read only the
            // actual input in its own target; a fallback shadow proves nothing.
            if (!Array.isArray(slot) || slot[0] !== 1) return true;
            let name;
            if (Array.isArray(slot[1]) && slot[1][0] === 10 && typeof slot[1][1] === 'string') name = slot[1][1];
            else {
                const menu = typeof slot[1] === 'string' && owner.blocks[slot[1]];
                if (!menu?.shadow || Object.keys(menu.inputs || {}).length ||
                    Object.keys(menu.fields || {}).length !== 1 || typeof menu.fields?.[field]?.[0] !== 'string') return true;
                name = menu.fields[field][0];
            }
            if (name === target.name || (name === '_myself_' && owner === target)) return true;
        }
        return false;
    }

    self () {
        if (this.templateNames.has(this.target.name) ||
            this.isScriptHost(this.target)) return null;
        if (this.isClonable()) return 'self';
        return this.spriteVar.get(this.target.name) || null;
    }

    /** The fixed qualified name of a block that keeps a name whose source is not in the project, else null. */
    externalName (b) {
        const name=this.literalInput(b,'NAME');
        return typeof name==='string' && EXTERNAL_NAME.test(name)?name:null;
    }

    /** The exported argument expressions of an external call's `arcade function argument` chain, or null. */
    externalArgumentValues (b) {
        const values=[],seen=new Set();let tail=b.inputs?.ARGS,block=this.block(tail?.[1]);
        while(block?.opcode==='arcade_functionArgument'){
            if(seen.has(block))return null;seen.add(block);
            values.push(this.arrayValue(block,'VALUE'));tail=block.inputs?.REST;block=this.block(tail?.[1]);
        }
        const empty=Array.isArray(tail?.[1])?String(tail[1][1])==='[]':block?.fields?.TEXT?.[0]==='[]';
        return empty?values:null;
    }

    externalCallText (b) {
        const name=this.externalName(b),values=name&&this.externalArgumentValues(b);
        return name&&values?`${name}(${values.join(', ')})`:null;
    }

    literalInput (b, name) {
        if(isArrayMenuSelector(b,name))return arrayMenuLiteral(this.target,b,name);
        const slot = b.inputs?.[name]?.[1];
        return Array.isArray(slot) && [10, 11].includes(slot[0]) ? String(slot[1]) : null;
    }

    scrollerLayerSuffix(b) {
        if(this.scrollerVersion===LEGACY_SCROLLER_REVISION) {
            if(this.literalNumber(b,'LAYER')!==0)this.note('Legacy Arcade background scroll requires layer zero');
            return '';
        }
        return `, ${this.value(b,'LAYER')}`;
    }

    literalNumber (b, name) {
        const slot = b.inputs?.[name]?.[1];
        return Array.isArray(slot) && [4, 5, 6, 7, 8, 10].includes(slot[0]) &&
            Number.isFinite(Number(slot[1])) ? Number(slot[1]) : null;
    }

    namedArray (b) {
        const name=this.literalInput(b,'NAME');
        if (name===null) {this.note('Named array export requires a fixed name');return 'null';}
        if(!this.namedArrays.has(name)) {
            let variable='__bwNamedArray_'+ident(name);
            const occupied=new Set([...this.globals.values(),...this.functionNames(),...this.namedArrays.values(),...this.spriteVar.values()]);
            while(occupied.has(variable))variable+='_';
            this.namedArrays.set(name,variable);
        }
        return this.namedArrays.get(name);
    }
    legacyValueHelper (kind) {
        if(!this.legacyValueHelpers.has(kind)) {
            const base=kind==='parse'?'__bwNamedParseValue':'__bwNamedJsonValue';
            let name=base;
            const occupied=new Set([...this.globals.values(),...this.functionNames(),...this.legacyValueHelpers.values()].map(x=>typeof x==='string'?x:x.name));
            while(occupied.has(name))name+='_';
            const source=(kind==='parse'?LEGACY_PARSE_SOURCE:LEGACY_JSON_SOURCE).replaceAll(base,name);
            this.legacyValueHelpers.set(kind,{name,source});
        }
        return this.legacyValueHelpers.get(kind).name;
    }
    namedOperationHelper (op) {
        const key='named:'+op;
        if(!this.legacyValueHelpers.has(key)) {
            let name='__bwNamedArray'+op[0].toUpperCase()+op.slice(1);
            const occupied=new Set([...this.globals.values(),...this.functionNames(),...this.legacyValueHelpers.values()].map(x=>typeof x==='string'?x:x.name));
            while(occupied.has(name))name+='_';
            const parse=()=>this.legacyValueHelper('parse'),json=()=>this.legacyValueHelper('json');
            let params='array: any[]',body='';
            if(op==='get') {
                const source=NAMED_ARRAY_GET_SOURCE.replaceAll('__bwNamedArrayGet',name).replaceAll('__bwNamedJsonValue',json());
                this.legacyValueHelpers.set(key,{name,source});
                return name;
            }
            if(op==='pop')body='if (array) {\n        if (array.length) return array.pop()\n    }\n    return ""';
            if(op==='indexOf'){params+=', value: any';body=`return array ? array.indexOf(${parse()}(value)) : -1`;}
            if(op==='contains') {
                params+=', value: any';body=`if (array) {
        let parsed = ${parse()}(value)
        for (let i = 0; i < array.length; i++) {
            let item = array[i]
            if (item === parsed || (item !== item && parsed !== parsed)) return true
        }
    }
    return false`;
            }
            if(op==='push'){params+=', value: any';body=`if (array) array.push(${parse()}(value))`;}
            if(op==='set'){params+=', index: any, value: any';body=`if (array) array[+index] = ${parse()}(value)`;}
            if(op==='insert' || op==='remove') {
                params+=', index: any'+(op==='insert'?', value: any':'');
                body=`if (array) {
        let position = +index
        if (position !== position) position = 0
        position = position < 0 ? Math.max(0, array.length + Math.ceil(position)) : Math.min(array.length, Math.floor(position))
        ${op==='insert'?`array.insertAt(position, ${parse()}(value))`:'if (position < array.length) array.removeAt(position)'}
    }`;
            }
            const type=op==='contains'?'boolean':op==='indexOf'?'number':['get','pop'].includes(op)?'any':'void';
            this.legacyValueHelpers.set(key,{name,source:`function ${name}(${params}): ${type} {
    ${body}
}`});
        }
        return this.legacyValueHelpers.get(key).name;
    }

    scratchMinMax (b, operation) {
        const key='scratch:'+operation;
        if(!this.legacyValueHelpers.has(key)) {
            let name=operation==='min'?'__bwScratchMin':'__bwScratchMax';
            const occupied=new Set([...this.globals.values(),...this.functionNames(),...this.legacyValueHelpers.values()].map(x=>typeof x==='string'?x:x.name));
            while(occupied.has(name))name+='_';
            this.legacyValueHelpers.set(key,{name,source:`function ${name}(left: any, right: any): number {
    let a = +left
    let b = +right
    if (a !== a) a = 0
    if (b !== b) b = 0
    return Math.${operation}(a, b)
}`});
        }
        return `${this.legacyValueHelpers.get(key).name}(${this.arrayValue(b,'NUM1')}, ${this.arrayValue(b,'NUM2')})`;
    }

    referenceArrayValue (b, name='ARRAY') {
        // The constructor owns this snapshot; callbacks cannot renew its authority.
        let authority=this.arrayReceiverAuthority.validateInput(this.target,b,name);
        let selectedProof=this.arrayReceiverAuthority,selectedTarget=this.target,selectedNode=b;
        if(!authority.ok&&authority.reason==='requires an actual initialized Array producer and compatible all writers'&&this.arrayOwnedSource?.current()){
            try{
                if(!this.arrayOwnedSnapshot){
                    const snapshot=createProjectJsonSnapshot(this.arrayOwnedSource.json);
                    this.arrayOwnedSnapshot={snapshot,authority:createArrayReferenceExportAuthority(snapshot,this.opts,this.animationFrameProducers)};
                }
                const index=this.project.targets.indexOf(this.target),id=Object.keys(this.target.blocks).find(key=>this.target.blocks[key]===b);
                const {snapshot,authority:owned}=this.arrayOwnedSnapshot,target=snapshot.targets[index],node=target?.blocks?.[id];
                const result=node&&owned.validateInput(target,node,name);
                if(result?.ok&&this.arrayOwnedSource.current()){
                    authority=result;this.arrayOwnedSourceUsed=true;selectedProof=owned;selectedTarget=target;selectedNode=node;
                }
            }catch{ /* Preserve the actual primary refusal if optional evidence is unavailable. */ }
        }
        if(authority.ok){
            let names=arraySourceApply(arraySourceWeakGet,this.arrayProofInputs,[selectedNode]);
            if(!names){names=arraySourceCreate(null);arraySourceApply(arraySourceWeakSet,this.arrayProofInputs,[selectedNode,names]);}
            if(!arraySourceOwn(names,name)){
                names[name]=true;
                this.arrayProofChecks[this.arrayProofCheckCount++]={authority:selectedProof,target:selectedTarget,node:selectedNode,name};
            }
        }
        if(!authority.ok)this.note(`Array reference ${b.opcode} ${name}: ${authority.reason}`);
        const value=this.value(b,name);
        const needsArrayAccess = (block, input, seen = new Set()) => {
            if (seen.has(block)) return false;
            seen.add(block);
            const slot=block.inputs?.[input]?.[1];
            let id=Array.isArray(slot) && [12,13].includes(slot[0]) ? slot[2] : null;
            const reporter=typeof slot==='string' && this.block(slot);
            if(reporter?.opcode==='data_variable')id=reporter.fields?.VARIABLE?.[1];
            if(id)return this.mixedValueVariableIds.has(id) || this.arrayVariableTypes.get(id)==='any';
            if(reporter?.opcode==='arcade_getLocal')return this.mixedValueArrayLocalBlocks.has(reporter);
            // A cast receiver is any[]. Its indexed/pop/random element is any,
            // so an outer array operation needs its own explicit array access.
            // Typed array receivers retain their element types (Sprite/Image/
            // nested arrays); casting those indiscriminately changes PXT dispatch.
            if(['arrays_referenceItem','arrays_referenceTake','arrays_referenceRandom'].includes(reporter?.opcode) ||
                reporter?.opcode==='arrays_mutateReference' && ['pop','shift','removeAt'].includes(this.literalInput(reporter,'OP')))
                return needsArrayAccess(reporter,'ARRAY',seen);
            return false;
        };
        if(!needsArrayAccess(b,name))return value;
        const key='arrayAccess';
        if(!this.legacyValueHelpers.has(key)) {
            let fn='__bwArrayAccess';
            const occupied=new Set([...this.globals.values(),...this.functionNames(),...this.legacyValueHelpers.values()].map(x=>typeof x==='string'?x:x.name));
            while(occupied.has(fn))fn+='_';
            this.legacyValueHelpers.set(key,{name:fn,source:ARRAY_ACCESS_SOURCE.replaceAll('__bwArrayAccess',fn)});
        }
        return `${this.legacyValueHelpers.get(key).name}(${value})`;
    }

    legacyArrayInput (b, name='VALUE') {
        return this.legacyValueHelper('parse')+'('+this.arrayValue(b,name)+')';
    }

    handleInputVariable (b, name) {
        const slot = b.inputs?.[name]?.[1];
        if (Array.isArray(slot) && [12, 13].includes(slot[0])) return this.lookupVar(slot[1]);
        const reporter = typeof slot === 'string' ? this.block(slot) : null;
        return reporter?.opcode === 'data_variable' ? this.lookupVar(this.field(reporter, 'VARIABLE')) : null;
    }

    /** An input as a JavaScript value (Arcade programs); a Scratch-only project reads it as `value` does. */
    arrayValue (b, name) {
        if (!this.arcadeValues) return this.value(b, name);
        if(this.procedureConstraints?.obligations(b).some(obligation=>obligation.input===name)||b.opcode==='arcade_throwValue'&&name==='VALUE') {
            const reporter=this.block(b.inputs?.[name]?.[1]);
            if(reporter?.opcode==='text'&&reporter.shadow&&!Object.keys(reporter.inputs||{}).length&&typeof reporter.fields?.TEXT?.[0]==='string')return JSON.stringify(reporter.fields.TEXT[0]);
        }
        const slot=b.inputs?.[name]?.[1];
        if(Array.isArray(slot) && slot[0]===10)return JSON.stringify(String(slot[1]));
        if(Array.isArray(slot) && [12,13].includes(slot[0]))return this.lookupVar(slot[1]);
        const reporter=typeof slot==='string' && this.block(slot);
        return reporter && (this.isBoolean(reporter) || reporter.opcode==='data_variable') ? this.expr(reporter) : this.value(b,name);
    }

    mathValue(b,name) {
        const slot=b.inputs?.[name]?.[1];
        let text=null;
        if(Array.isArray(slot) && slot[0]>=4 && slot[0]<=8)text=String(slot[1]);
        const shadow=typeof slot==='string' && this.block(slot);
        if(shadow?.shadow && ['math_number','math_integer','math_whole_number','math_positive_number','math_angle'].includes(shadow.opcode))text=String(Object.values(shadow.fields || {})[0]?.[0]);
        if(text!==null && Object.is(Number(text),-0)){
            const key='LiteralNegativeZero';
            if(!this.valueOperationHelpers.has(key)){
                const occupied=new Set([...this.globals.values(),...this.functionNames(),...this.valueOperationHelpers.values()].map(x=>typeof x==='string'?x:x.name));
                let helper='__bwLiteralNegativeZero';while(occupied.has(helper))helper+='_';
                this.valueOperationHelpers.set(key,{name:helper,source:`function ${helper}(divisor: number): number { return -1 / divisor }`});
            }
            return `${this.valueOperationHelpers.get(key).name}(Infinity)`;
        }
        return this.arrayValue(b,name);
    }

    namedKind (name) {
        if (['Player','Projectile','Food','Enemy'].includes(name)) return `SpriteKind.${name}`;
        if (name==='Text' && this.hasTextKindLibrary) {this.requiresTextSpritePackage=true;return 'SpriteKind.Text';}
        if (this.boundSpriteKinds.has(name)) return `SpriteKind.${name}`;
        // A kind the source names but never defines (a package's kind, or a snippet's context) keeps
        // its name: it is declared like an unassigned bound kind, so SpriteKind.<name> still reads
        // undefined, as in the source, and a re-import still sees the same named kind.
        if (/^[A-Za-z_]\w*$/.test(name) && !this.sdkKindNames.has(name)) {
            this.boundSpriteKinds.add(name);
            this.note(`Arcade sprite kind name ${JSON.stringify(name)} has no binding in the project; exported as an undefined SpriteKind member`);
            return `SpriteKind.${name}`;
        }
        this.note(`Arcade sprite kind name ${JSON.stringify(name)} needs an explicit numeric binding`);
        return this.na();
    }

    kindExpr (b, name) {
        const kind = this.literalInput(b, name);
        if (kind!==null) {
            const text=kind.trim();
            if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return String(Number(text));
            return this.namedKind(kind);
        }
        // Connected numeric/nullable reporters are evaluated once by the SDK.
        // They must never allocate a new kind or become a string label.
        return this.arrayValue(b,name);
    }

    collectKindBindings () {
        const previous=this.blocks;
        this.hasTextKindLibrary=this.project.targets.some(target=>Object.values(target.blocks || {}).some(block=>/^arcade_textSprite/.test(block.opcode) || block.opcode==='arcade_initializeSpriteKindLibrary' && Array.isArray(block.inputs?.LIBRARY?.[1]) && block.inputs.LIBRARY[1][1]==='textsprite'));
        for(const target of this.project.targets) {
            this.blocks=target.blocks || {};
            for(const block of Object.values(this.blocks)) {
                if(/^arcade_textSprite/.test(block.opcode))this.hasTextKindLibrary=true;
                if(block.opcode==='arcade_initializeSpriteKindLibrary') {
                    const library=this.literalInput(block,'LIBRARY'),version=this.literalInput(block,'VERSION');
                    if(library==='textsprite' && version==='v1.3.0')this.hasTextKindLibrary=true;
                    else this.note('Arcade kind library export requires exact Text Sprite v1.3.0');
                }
                if(block.opcode==='arcade_bindSpriteKind') {
                    const name=this.literalInput(block,'NAME');
                    if(name===null || !/^[A-Za-z_]\w*$/.test(name))this.note('Arcade kind binding export requires a fixed MakeCode identifier');
                    else if(['Player','Projectile','Food','Enemy'].includes(name) || name==='Text' && this.hasTextKindLibrary)this.note('Arcade builtin/library kind bindings are readonly on MakeCode export');
                    else this.boundSpriteKinds.add(name);
                }
            }
        }
        this.validateKindLibraryPlacement();
        this.blocks=previous;
    }

    validateKindLibraryPlacement () {
        for(const target of this.project.targets) {
            const blocks=target.blocks || {};
            for(const [id,initializer] of Object.entries(blocks)) {
                if(initializer.opcode!=='arcade_initializeSpriteKindLibrary')continue;
                let ancestor=initializer,seen=new Set([id]);
                while(ancestor.parent && blocks[ancestor.parent] && !seen.has(ancestor.parent)){seen.add(ancestor.parent);ancestor=blocks[ancestor.parent];}
                if(!['event_whenflagclicked', 'arcade_whenSourceStarts'].includes(ancestor.opcode)){this.note('Arcade sprite kind library initialization must be on startup before kind allocation');continue;}
                const hasAllocation=(block,visited=new Set())=>{
                    if(!block || visited.has(block))return false;visited.add(block);
                    if(block.opcode==='arcade_createSpriteKind' || /^arcade_textSprite/.test(block.opcode) || ['procedures_call','arcade_callFunction','arcade_sourceWhile','control_if','control_if_else','control_repeat','control_repeat_until','control_forever'].includes(block.opcode))return true;
                    return Object.values(block.inputs || {}).some(input=>typeof input?.[1]==='string' && hasAllocation(blocks[input[1]],visited));
                };
                let current=ancestor.next,walk=new Set();
                while(current && current!==id && !walk.has(current)){walk.add(current);const block=blocks[current];if(hasAllocation(block)){this.note('Arcade sprite kind library export cannot move initialization across kind allocation or conditional/procedure execution');break;}current=block?.next;}
                if(current!==id && !walk.has(current))this.note('Arcade sprite kind library initializer is not a direct startup command');
            }
        }
    }

    // ── inputs ───────────────────────────────────────────────────────────
    block (id) { return id ? this.blocks[id] : null; }

    field (b, name) { return b.fields && b.fields[name] ? b.fields[name][0] : ''; }

    value (b, name, fallback = '0') {
        const input = b.inputs && b.inputs[name];
        if (!input) return fallback;
        const slot = input[1];
        const numeric = ['operator_equals','operator_gt','operator_lt','operator_add','operator_subtract','operator_multiply','operator_divide','operator_mod','operator_round','arcade_truncateNumber','arcade_signNumber','arcade_mathUnary','arcade_randomNumber','arcade_mathBinary','operator_mathop','operator_random','planetemaths_min','planetemaths_max'].includes(b.opcode);
        if (Array.isArray(slot)) {
            const [type, text] = slot;
            if (type === 12 || type === 13) {
                const value = this.lookupVar(text);
                return numeric && this.booleanVariable(slot[2] || text) ? `(${value} ? 1 : 0)` : value;
            }
            const s = String(text);
            if (type >= 4 && type <= 8) return s.trim() === '' ? '0' : String(Number(s));
            if (/^(true|false)$/.test(s)) return s === 'true' ? '1' : '0';
            if (s.trim() !== '' && Number.isFinite(Number(s))) return String(Number(s));
            return JSON.stringify(s);
        }
        if (typeof slot === 'string') {
            const r = this.block(slot);
            // A shadow holding one field (a note, a menu) is a literal.
            if (r && r.shadow && r.fields && !Object.keys(r.inputs || {}).length && Object.keys(r.fields).length === 1) {
                const s = String(Object.values(r.fields)[0][0]);
                return s.trim() !== '' && Number.isFinite(Number(s)) ? String(Number(s)) : JSON.stringify(s);
            }
            if (r && (this.isBoolean(r) || (numeric && this.booleanVariable(r)))) return `(${this.expr(r)} ? 1 : 0)`;
            return this.expr(r);
        }
        return fallback;
    }

    condition (b, name) {
        const input = b.inputs && b.inputs[name];
        const slot = input && input[1];
        if (typeof slot !== 'string') return 'false';
        const r = this.block(slot);
        return this.isBoolean(r) || this.booleanVariable(r) ? this.expr(r) : `(${this.expr(r)} != 0)`;
    }

    /**
     * Does this variable (a data_variable block, or its id) hold a Boolean? Only
     * in an Arcade program, where `set x to (a < b)` keeps the Boolean; a
     * Scratch-only project stores 1/0 (`value`).
     */
    booleanVariable (variable) {
        if (!this.arcadeValues || !variable) return false;
        if (typeof variable === 'string') return this.booleanVariableIds.has(variable);
        return variable.opcode === 'data_variable' &&
            this.booleanVariableIds.has(variable.fields?.VARIABLE?.[1] || variable.fields?.VARIABLE?.[0]);
    }

    // A boolean slot: a constant comparison or literal folds to true/false.
    boolValue(b, field) {
        const literal = this.literalNumber(b, field), condition = this.condition(b, field);
        if (literal !== null) return literal ? 'true' : 'false';
        return condition;
    }
    // A fixed PXT music enum member (or named melody) from a menu field, or null.
    musicField(b, field, enumeration) {
        const members = {
            'music.PlaybackMode': ['UntilDone', 'InBackground', 'LoopingInBackground'],
            SoundExpressionPlayMode: ['UntilDone', 'InBackground'],
            WaveShape: ['Sine', 'Sawtooth', 'Triangle', 'Square', 'Noise'],
            SoundExpressionEffect: ['None', 'Vibrato', 'Tremolo', 'Warble'],
            InterpolationCurve: ['Linear', 'Curve', 'Logarithmic'],
            Sounds: ['PowerUp', 'PowerDown', 'JumpUp', 'JumpDown', 'BaDing', 'Wawawawaa', 'MagicWand', 'Siren'],
            BeatFraction: ['Whole', 'Half', 'Quarter', 'Eighth', 'Sixteenth', 'Double', 'Breve', 'Triplet'],
            // The seven segment extension's enums.
            SegmentStyle: ['Blank', 'Thin', 'Narrow', 'Medium', 'Thick'],
            SegmentScale: ['Full', 'Half'],
            DigitRadix: ['Decimal', 'Hex', 'Octal', 'Alpha'],
            SegmentCharacter: ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
                'A', 'B', 'C', 'D', 'E', 'F', 'H', 'J', 'L', 'o', 'P', 'r', 'U', 'Y', 'Hyphen', 'Degree'],
            music: ['baDing', 'wawawawaa', 'jumpUp', 'jumpDown', 'powerUp', 'powerDown', 'magicWand', 'siren', 'pewPew', 'knock',
                'footstep', 'thump', 'smallCrash', 'bigCrash', 'zapped', 'buzzer', 'sonar', 'spooky', 'beamUp']
        }[enumeration];
        const value = this.field(b, field);
        return members.includes(value) ? `${enumeration}.${value}` : null;
    }
    particleEffect(b, screenOnly) {
        const screen = ['confetti', 'hearts', 'smiles', 'blizzard', 'bubbles', 'starField', 'clouds', 'none'];
        const all = ['spray', 'trail', 'fountain', 'rings', 'fire', 'warmRadial', 'coolRadial', 'halo', 'ashes', 'disintegrate', ...screen];
        const effect = this.field(b, 'EFFECT');
        return (screenOnly ? screen : all).includes(effect) ? effect : null;
    }

    spriteFlagCondition (b, name = 'ON') {
        const slot = b.inputs?.[name]?.[1];
        if (Array.isArray(slot) && [12, 13].includes(slot[0])) {
            // A variable holding a Boolean (an Arcade program's `hidden = !hidden`) is the condition itself.
            const value = this.lookupVar(slot[1]);
            return this.booleanVariable(slot[2] || slot[1]) ? value : `(${value} != 0)`;
        }
        if (Array.isArray(slot)) {
            const value = slot[1];
            const on = [10, 11].includes(slot[0]) ? Boolean(value) && value !== '0' &&
                String(value).toLowerCase() !== 'false' : Boolean(Number(value));
            return on ? 'true' : 'false';
        }
        return this.condition(b, name);
    }

    objectArgumentValues(b) {
        const args=[];let current=this.block(b.inputs?.ARGS?.[1]),tail=b.inputs?.ARGS;
        const seen=new Set();
        while(current?.opcode==='arcade_functionArgument' && !seen.has(current)){seen.add(current);args.push(this.arrayValue(current,'VALUE'));tail=current.inputs?.REST;current=this.block(tail?.[1]);}
        const shadow=tail?.[1],empty=Array.isArray(shadow)?String(shadow[1])==='[]':current?.shadow && current?.fields?.TEXT?.[0]==='[]';
        if(!empty)this.note('Class arguments require a fixed ordered argument chain');
        return args;
    }
    objectFieldName(b,slot='FIELD') {
        const name=this.literalInput(b,slot);
        if(!name || !/^[A-Za-z_]\w*$/.test(name)){this.note('Class export requires a fixed declared field or method name');return '_unsupportedField';}
        return name;
    }
    isBoolean (b) {
        return !!b && ['arrays_valueTruthy','arrays_valueCompare','arrays_referenceRemove','arrays_referenceTruthy', 'arrays_contains', 'operator_and', 'operator_or', 'operator_not', 'operator_gt', 'operator_lt', 'operator_equals',
            'sensing_touchingobject', 'sensing_keypressed', 'sensing_mousedown', 'data_listcontainsitem',
            'arcade_percentChance','arcade_settingsExists', 'arcade_spriteDataReadBoolean', 'arcade_bufferIsReadOnly', 'arcade_bufferEquals', 'arcade_spriteOverlaps', 'arcade_imagesOverlap', 'arcade_tileIs', 'arcade_tilemapIsWall', 'arcade_spriteTileKindAt', 'arcade_imageEquals', 'arcade_tileIsWall', 'arcade_isHittingTile', 'arcade_hasLife', 'arcade_hasPlayerScore', 'arcade_characterMatchesRule'].includes(b.opcode);
    }

    menuField (b, input, field) {
        const i = b.inputs && b.inputs[input];
        const m = i && typeof i[1] === 'string' ? this.block(i[1]) : null;
        return m ? this.field(m, field) : '';
    }

    // A leading empty text operand already performs the coercion. Source
    // reimport represents that addition as a value operation, rather
    // than a Scratch join; wrapping it again grows the source every export.
    textOperand (b, name) {
        const slot = b.inputs?.[name]?.[1];
        const operand = typeof slot === 'string' ? this.block(slot) : null;
        const textAddition = ['arrays_valueBinary', 'arcade_sourceValueBinary'].includes(operand?.opcode) &&
            this.field(operand, 'OP') === '+' && this.literalInput(operand, 'LEFT') === '';
        const raw = this.value(b, name);
        // Each addition helper keeps its own Array conversion and operand
        // evaluation. Its result is text here, but its signature returns any;
        // give PXT the receiver type required for its string member lowering.
        if (textAddition) return `(<string>${raw})`;
        return /^"/.test(raw) || operand?.opcode === 'operator_join' ? raw : `("" + ${raw})`;
    }

    // ── expressions ──────────────────────────────────────────────────────
    expr (b) {
        if (!b) return '0';
        const v = n => this.value(b, n);
        const c = n => this.condition(b, n);
        const me = this.self();
        switch (b.opcode) {
        case 'data_variable': {
            const name = this.field(b, 'VARIABLE');
            const info = this.infoVariable(name);
            return info === 'score' ? 'info.score()' : info === 'lives' ? 'info.life()' :
                this.lookupVar(name);
        }
        case 'argument_reporter_string_number':
        case 'argument_reporter_boolean':
            if(this.currentCallableContext){try{return this.currentCallableContext.local(this.field(b,'VALUE'));}catch(error){this.note(error.message);return this.na();}}
            return ident(this.field(b, 'VALUE'));
        case 'operator_add': return `(${v('NUM1')} + ${v('NUM2')})`;
        case 'operator_subtract': return `(${v('NUM1')} - ${v('NUM2')})`;
        case 'operator_multiply': return `(${v('NUM1')} * ${v('NUM2')})`;
        case 'operator_divide': return `(${v('NUM1')} / ${v('NUM2')})`;
        case 'operator_mod': return `(${v('NUM1')} % ${v('NUM2')})`;
        case 'operator_round': return `Math.round(${v('NUM')})`;
        case 'operator_random': return `randint(${v('FROM')}, ${v('TO')})`;
        case 'arcade_randomNumber': return 'Math.random()';
        case 'arcade_mathBinary': {const operation=String(directMenuValue(b,'OP',this.blocks));if(!['min','max','randomRange','atan2'].includes(operation)){this.note('Arcade math requires a fixed supported operation');return 'undefined';}return `Math.${operation}(<any>${this.mathValue(b,'A')}, <any>${this.mathValue(b,'B')})`;}
        case 'arcade_percentChance': return `Math.percentChance(<any>${this.mathValue(b,'PERCENTAGE')})`;
        case 'arcade_clampNumber': return `Math.clamp(<any>${this.mathValue(b,'MIN')}, <any>${this.mathValue(b,'MAX')}, <any>${this.mathValue(b,'VALUE')})`;
        // Planète Maths: the importer's spelling of Math.min/max/pow (they
        // kept only their first argument before, on the way in).
        // In an Arcade program the blocks run with Scratch's casts (text -> 0),
        // so the export keeps them (a helper); a Scratch-only project's
        // numbers are numbers already.
        case 'planetemaths_min': return this.arcadeValues ? this.scratchMinMax(b, 'min') : `Math.min(${v('NUM1')}, ${v('NUM2')})`;
        case 'planetemaths_max': return this.arcadeValues ? this.scratchMinMax(b, 'max') : `Math.max(${v('NUM1')}, ${v('NUM2')})`;
        case 'planetemaths_pow': return `Math.pow(${v('NUM1')}, ${v('NUM2')})`;
        case 'operator_join':
            return v('STRING1') === '""' ? `("" + ${v('STRING2')})` : `("" + ${v('STRING1')} + ${v('STRING2')})`;
        case 'arcade_createSprite':
        case 'arcade_spawnSprite':
        case 'arcade_spawnProjectile': {
            if (!this.spawnAssignment && b.opcode === 'arcade_spawnSprite') this.note('Arcade positioned spawn expression needs an assigned handle');
            const template = this.literalInput(b, 'TEMPLATE');
            const art = template && this.artVar.get(template);
            if (!art) {
                this.note(`Arcade sprite template ${template || '(dynamic)'} has no exported artwork`);
                return this.na();
            }
            const size = this.artPixels.get(template);
            const width = this.literalNumber(b, 'WIDTH'), height = this.literalNumber(b, 'HEIGHT');
            if (size && ((width !== null && width !== size.width) ||
                (height !== null && height !== size.height))) {
                this.note(`${template}: Arcade handle size differs from its image; export needs image resizing`);
            }
            if (b.opcode === 'arcade_spawnProjectile') {
                const mode = this.literalInput(b, 'MODE');
                if (mode === 'side') {
                    return `sprites.createProjectileFromSide(${toImgLiteral(size)}, ${v('VX')}, ${v('VY')})`;
                }
                if (mode === 'sprite') {
                    const source = this.literalInput(b, 'SOURCE') === '' ? 'null' : v('SOURCE');
                    return `sprites.createProjectileFromSprite(${toImgLiteral(size)}, ${source}, ${v('VX')}, ${v('VY')})`;
                }
                if (mode === 'kind-source') {
                    const source = this.literalInput(b, 'SOURCE') === '' ? 'null' : v('SOURCE');
                    return `sprites.createProjectile(${toImgLiteral(size)}, ${v('VX')}, ${v('VY')}, ` +
                        `${this.kindExpr(b, 'KIND')}, ${source})`;
                }
                if (mode !== 'kind') this.note('Arcade projectile mode must be side, kind, sprite, or kind-source');
                return `sprites.createProjectile(${toImgLiteral(size)}, ${v('VX')}, ${v('VY')}, ${this.kindExpr(b, 'KIND')})`;
            }
            return `sprites.create(${toImgLiteral(size)}, ${this.kindExpr(b, 'KIND')})`;
        }
        case 'arcade_spawnImageProjectile': {
            const image = v('IMAGE'), vx = v('VX'), vy = v('VY');
            const source = this.literalInput(b, 'SOURCE') === '' ? 'null' : v('SOURCE');
            const mode = this.literalInput(b, 'MODE');
            if (mode === 'side') return `sprites.createProjectileFromSide(${image}, ${vx}, ${vy})`;
            if (mode === 'sprite') return `sprites.createProjectileFromSprite(${image}, ${source}, ${vx}, ${vy})`;
            if (mode === 'kind-source') return `sprites.createProjectile(${image}, ${vx}, ${vy}, ${this.kindExpr(b, 'KIND')}, ${source})`;
            if (mode !== 'kind') this.note('Arcade projectile mode must be side, kind, sprite, or kind-source');
            return `sprites.createProjectile(${image}, ${vx}, ${vy}, ${this.kindExpr(b, 'KIND')})`;
        }
        case 'arcade_imagesOverlap': return `${v('IMAGE')}.overlapsWith(${v('SOURCE')}, ${v('X')}, ${v('Y')})`;
        case 'arcade_createObject': {
            const name=this.literalInput(b,'CLASS');
            if(name==='__bwSDK_Font'){this.note('SDK Font is an interface record without constructor or inheritance');return 'undefined';}
            if(!this.objectClassExport?.classes.has(name)){this.note('Object export requires a fixed declared class');return this.na();}
            return `new ${this.objectClassExport.publicName(name)}(${this.objectArgumentValues(b).join(', ')})`;
        }
        case 'arcade_objectField':return `${this.objectClassExport.receiver(b)}.${this.objectFieldName(b)}`;
        case 'arcade_callObjectMethod': {
            const entry=this.callableExports?.get(this.target);
            if(entry?.graph.plan.version===2)try {
                if(!this.objectClassExport.classCallableProvider(this.target).expressionType(b))throw Error('Class callback method call lacks actual current typed arguments');
            }catch(error){this.note(error.message);return this.na();}
            return `${this.objectClassExport.receiver(b,false,true)}.${this.objectFieldName(b,'METHOD')}(${this.objectArgumentValues(b).join(', ')})`;
        }
        case 'arcade_createCallable': {
            const entry=this.callableExports?.get(this.target);
            if(!entry){this.note('Callable creation needs qualified lexical declaration/current body export');return this.na();}
            const id=Object.entries(this.blocks).find(([,block])=>block===b)?.[0];
            try{return this.currentCallableContext?this.currentCallableContext.create(id):entry.emitter.moduleCreate(id);}catch(error){this.note(error.message);return this.na();}
        }
        case 'arcade_callCallable': {
            if(!this.callableExports?.has(this.target)){this.note('Callable invocation needs qualified lexical current-body export');return this.na();}
            try{
                if(this.callableExports.get(this.target).graph.plan.version===2&&!this.objectClassExport.classCallableProvider(this.target).expressionType(b))throw Error('Class callback invocation lacks actual current typed receiver and arguments');
                return `(${this.arrayValue(b,'CALLABLE')})(${this.callableArgumentValues(b).join(', ')})`;
            }catch(error){this.note(error.message);return this.na();}
        }
        case 'arcade_callFunction': {
            const code = this.literalInput(b, 'NAME');
            const fn = code && this.functionSymbols.call(this.target,b);

            const args=[],seenArguments=new Set();let block=this.block(b.inputs?.ARGS?.[1]);
            while (block?.opcode==='arcade_functionArgument') {
                if(seenArguments.has(block)){this.note('Arcade function argument chain is cyclic');return this.na();}seenArguments.add(block);
                args.push(this.arrayValue(block,'VALUE'));block=this.block(block.inputs?.REST?.[1]);
            }
            // Arguments are authored as a linked chain, ending in the literal [].
            let tail=b.inputs?.ARGS;let current=this.block(tail?.[1]);
            while(current?.opcode==='arcade_functionArgument'){tail=current.inputs?.REST;current=this.block(tail?.[1]);}
            const shadow=tail?.[1];
            const empty=Array.isArray(shadow)?String(shadow[1])==='[]':current?.fields?.TEXT?.[0]==='[]';
            if(!empty)this.note('Arcade function arguments need a fixed argument chain');
            // A value-returning procedure runs in its caller's thread too (see procedures_call).
            const superCall=this.objectClassExport?.superCall?.(code,args);if(superCall!==null&&superCall!==undefined)return superCall;
            if (!fn) {this.note('Arcade function reporter needs a known procedure name');return this.na();}
            if (this.tokened()) args.unshift('_t');
            if (this.isClonable()) args.unshift('self');
            return `${fn}(${args.join(', ')})`;
        }
        case 'arcade_externalValue':
        case 'arcade_externalImage': {
            const name=this.externalName(b);
            if(name)this.namedMissingAssets.add(name);
            return name || this.na();
        }
        case 'arcade_externalImageCall':
        case 'arcade_externalCall': {
            const call=this.externalCallText(b);
            return call===null?this.na():call;
        }
        case 'arcade_createSpriteKind':return 'SpriteKind.create()';
        case 'arcade_spriteKindValue': {
            const name=this.literalInput(b,'NAME');
            if(name===null){this.note('Arcade kind lookup export requires a fixed registered name');return this.na();}
            return this.namedKind(name);
        }
        case 'arrays_stringFromCharCode':return `${this.use('sdkStrings','__bwSdkCharCode')}(${this.arrayValue(b,'CODE')})`;
        case 'arrays_stringConcat':{
            // `__bwSdkConcat(left, right)` is exactly `left.concat(right)`. A
            // receiver that is a string literal, or a global whose actual
            // writers are all String and whose final declaration is string
            // (otherwise restored to the helper after declarations), is called directly: the helper's
            // `<any>` cast would hide its String producer from a reimport. The
            // argument keeps the helper's `any` parameter type.
            const input=b.inputs?.TEXT?.[1],reporter=typeof input==='string'?this.blocks[input]:null;
            const id=Array.isArray(input)&&input[0]===12?input[2]||input[1]:reporter?.opcode==='data_variable'?reporter.fields?.VARIABLE?.[1]||reporter.fields?.VARIABLE?.[0]:null;
            const text=this.arrayValue(b,'TEXT');
            if(/^"(?:[^"\\\n]|\\.)*"$/.test(text))return `${text}.concat(<any>${this.arrayValue(b,'OTHER')})`;
            if(id&&this.primitiveVariableTypes.get(id)==='string'&&/^[A-Za-z_$][\w$]*$/.test(text)){this.directConcatGlobals.add(text);return `${text}.concat(<any>${this.arrayValue(b,'OTHER')})`;}
            return `${this.use('sdkConcat','__bwSdkConcat')}(<any>${text}, ${this.arrayValue(b,'OTHER')})`;
        }
        case 'arrays_stringCharCodeAt':return `(<string>${this.arrayValue(b,'TEXT')}).charCodeAt(<any>${this.arrayValue(b,'INDEX')})`;
        case 'arrays_namedReference': return this.namedArray(b);
        case 'arrays_parseLegacyValue': return this.legacyArrayInput(b);
        case 'arrays_jsonValue': return `${this.legacyValueHelper('json')}(${this.arrayValue(b,'VALUE')})`;
        case 'arrays_length': {const array=this.namedArray(b);return `(${array} ? ${array}.length : 0)`;}
        case 'arrays_get': {
            const name=this.literalInput(b,'NAME');
            if(name!==null){
                const authority=namedArrayItemExportAuthority(this.project,name,block=>this.isBoolean(block),this.sourceReferenceCells);
                if(!authority.ok){this.note(authority.reason);return this.na();}
            }
            return `${this.namedOperationHelper('get')}(${this.namedArray(b)}, ${this.arrayValue(b,'INDEX')})`;
        }
        case 'arrays_pop': return `${this.namedOperationHelper('pop')}(${this.namedArray(b)})`;
        case 'arrays_indexOf': return `${this.namedOperationHelper('indexOf')}(${this.namedArray(b)}, ${this.arrayValue(b,'VALUE')})`;
        case 'arrays_contains': return `${this.namedOperationHelper('contains')}(${this.namedArray(b)}, ${this.arrayValue(b,'VALUE')})`;
        case 'arrays_toJSON': {const array=this.namedArray(b);return `${this.legacyValueHelper('json')}(${array} || [])`;}
        case 'arrays_createReference': {
            const text=this.literalInput(b,'VALUES');
            if(typeof text==='string'){
                try {
                    const values=JSON.parse(text);
                    if(Array.isArray(values) && values.every(value=>typeof value==='number' && Number.isFinite(value)))
                        return `[${values.map(value=>Object.is(value,-0)?'-0':String(value)).join(', ')}]`;
                } catch(_) { /* The existing fixed-chain diagnostic remains authoritative. */ }
            }
            const args=[];let tail=b.inputs?.VALUES,current=this.block(tail?.[1]);
            while(current?.opcode==='arrays_referenceValues'){args.push(this.arrayValue(current,'VALUE'));tail=current.inputs?.REST;current=this.block(tail?.[1]);}
            const empty=Array.isArray(tail?.[1])?String(tail[1][1])==='[]':current?.fields?.TEXT?.[0]==='[]';
            if(!empty)this.note('Array reference constructor requires a fixed value chain');
            return `[${args.join(', ')}]`;
        }
        case 'arcade_getscore':return 'info.score()';
        case 'arrays_specialValue':return (this.field(b,'KIND') || this.literalInput(b,'KIND'))==='null'?'null':'undefined';
        case 'arcade_sourceValueBinary':
        case 'arcade_sourceValueUnary':
        case 'arrays_valueCompare':
        case 'arrays_valueBinary':
        case 'arrays_valueUnary': {
            const op=this.field(b,'OP') || this.literalInput(b,'OP'),unary=['arrays_valueUnary','arcade_sourceValueUnary'].includes(b.opcode),compare=b.opcode==='arrays_valueCompare',source=['arcade_sourceValueBinary','arcade_sourceValueUnary'].includes(b.opcode);
            const names={'+':'Add','-':'Subtract','*':'Multiply','/':'Divide','%':'Remainder','**':'Power','&':'BitAnd','|':'BitOr','^':'BitXor','<<':'ShiftLeft','>>':'ShiftRight','>>>':'UnsignedShiftRight','~':'BitNot','==':'Equal','!=':'NotEqual','===':'StrictEqual','!==':'StrictNotEqual','<':'Less','>':'Greater','<=':'LessEqual','>=':'GreaterEqual'};
            if(source&&!sourceValueOperation(b)){this.note(`unsupported Arcade source value operation ${op}`);return this.na();}
            if(!names[op] || unary && !['+','-','~'].includes(op)){this.note(`unsupported value operation ${op}`);return this.na();}
            if(source&&(unary||['&','|','^','<<','>>','>>>'].includes(op))&&!this.sourceBitwiseExportOperands?.has(b)){this.note('Arcade source bitwise operation requires actual Array or primitive operand producers');return this.na();}
            if(!source&&!compare&&(unary?op==='~':['&','|','^','<<','>>','>>>'].includes(op))&&!this.nativeBitwiseExportOperands?.has(b)&&!this.isUnreachable(this.target,b)&&!this.callablePrimitiveOperands(b,unary?['VALUE']:['LEFT','RIGHT'])){this.note('Native bitwise operation requires actual primitive operand producers');return this.na();}
            // A qualified class-callable graph can retain primitive Number
            // addition directly. Generic Any helpers lose the Arrow's actual
            // result signature on source reparse; declarations alone cannot
            // select this path, and unproved operands keep the old helper.
            if(!source&&!unary&&!compare&&op==='+'&&this.callableExports?.get(this.target)?.graph.plan.version===2){
                try {
                    const provider=this.objectClassExport.classCallableProvider(this.target),
                        left=provider.currentInputType(b,'LEFT'),right=provider.currentInputType(b,'RIGHT');
                    if(left?.kind==='named'&&left.name==='number'&&right?.kind==='named'&&right.name==='number')
                        return `(${this.arrayValue(b,'LEFT')} + ${this.arrayValue(b,'RIGHT')})`;
                }catch(error){this.note(error.message);}
            }
            // A genuine removal reporter returns a scalar even when its
            // receiver contains nested/cyclic Arrays. No join is needed for
            // this closed scalar calculation. Variables/captures are refused
            // by this separate proof; inferred writer flow is not authority.
            if(!source&&!unary&&!compare&&op==='+'&&closedRemovalScalarAddition(this.blocks,b))
                return `(<any>(${this.arrayValue(b,'LEFT')}) + <any>(${this.arrayValue(b,'RIGHT')}))`;
            const key=(source?(unary?'SourceUnary':'SourceBinary'):unary?'Unary':compare?'Compare':'Binary')+names[op];
            if(!this.valueOperationHelpers.has(key)){
                let name='__bw'+key;
                const occupied=new Set([...this.globals.values(),...this.functionNames(),...this.spriteVar.values(),...this.artVar.values(),...this.valueOperationHelpers.values()].map(x=>typeof x==='string'?x:x.name));
                while(occupied.has(name))name+='_';
                this.valueOperationHelpers.set(key,{name,source:unary?`function ${name}(value: any): number { return ${op==='-'?'-1 * value':op==='~'?'~value':'+value'} }`:`function ${name}(left: any, right: any): ${compare?'boolean':op==='+'?'any':'number'} { return left ${op} right }`});
            }
            const helper=this.valueOperationHelpers.get(key).name;
            if(key==='BinaryAdd'&&this.snapshotCallbacks&&isProjectJsonSnapshot(this.project)){
                // Raw caller objects receive no additional provenance reads.
                // Only own descendant edges of the actual parsed/frozen JSON
                // root can supply these diagnostic emission candidates.
                try {
                    const site=this.nativeAdditionSite(b,helper);
                    if(site)this.nativeAdditionSites.push(site);
                }catch { /* Collection cannot replace the original export outcome. */ }
            }
            return unary?`${helper}(${this.arrayValue(b,'VALUE')})`:`${helper}(${this.arrayValue(b,'LEFT')}, ${this.arrayValue(b,'RIGHT')})`;
        }
        case 'arrays_valueTruthy':return `!!(${this.arrayValue(b,'VALUE')})`;

        case 'arrays_referenceTruthy':return `!!${this.referenceArrayValue(b)}[${v('INDEX')}]`;
        case 'arrays_referenceItem': {
            // MakeCode refuses a non-number indexer: a variable that is typed `any`
            // (mixed writers, or items of an array it cannot type) is read as a number.
            let index = v('INDEX');
            const kinds = this.kinds.get(index);
            if (kinds && (kinds.has('any') || kinds.size > 1)) index = `<number>${index}`;
            return `${this.referenceArrayValue(b)}[${index}]`;
        }
        // A BW query can search for a value outside the array's element type.
        // Erase only the needle's static view; keep the array, its aliases and
        // the SDK's strict lookup/removal semantics unchanged.
        case 'arrays_referenceRemove':return `${this.referenceArrayValue(b)}.removeElement(<any>(${this.arrayValue(b,'VALUE')}))`;
        case 'arrays_referenceRandom':return `Math.pickRandom(${this.referenceArrayValue(b)})`;
        case 'arrays_referenceLength':return `${this.referenceArrayValue(b)}.length`;
        case 'arrays_referenceSlice':return `${this.referenceArrayValue(b)}.slice(<any>${this.arrayValue(b,'START')}, <any>${this.arrayValue(b,'END')})`;
        case 'arrays_referenceConcat':return `${this.referenceArrayValue(b)}.concat(${this.referenceArrayValue(b,'OTHER')})`;
        case 'arrays_referenceIndexOf':return `${this.referenceArrayValue(b)}.indexOf(<any>(${this.arrayValue(b,'VALUE')}), ${v('INDEX')})`;
        case 'arrays_referenceTake': {
            const op=this.literalInput(b,'OP');
            if(op==='pop'||op==='shift')return `${this.referenceArrayValue(b)}.${op}()`;
            if(op==='removeAt')return `${this.referenceArrayValue(b)}.removeAt(${v('INDEX')})`;
            this.note('Array reference take operation must be pop, shift or removeAt');return this.na();
        }
        case 'arcade_animationAssetFreshFrames':
        case 'arcade_animationAssetFrames':
        case 'arcade_animationAssetInterval': return this.authoredAnimation(b);
        case 'arcade_createImage': return `image.create(${v('WIDTH')}, ${v('HEIGHT')})`;
        case 'arcade_createBuffer': return `control.createBuffer(${v('SIZE')})`;
        case 'arcade_bufferFromHex': {
            const hex=this.literalInput(b,'HEX');
            return `Buffer.fromHex(${hex===null?v('HEX'):JSON.stringify(hex)})`;
        }
        case 'arcade_bufferFromUTF8': {
            const text=this.literalInput(b,'TEXT');
            return `Buffer.fromUTF8(${text===null?v('TEXT'):JSON.stringify(text)})`;
        }
        case 'arcade_bufferLiteral': {
            const hex=this.literalInput(b,'HEX');
            if(typeof hex!=='string' || !/^(?:[0-9a-f]{2})*$/i.test(hex.replace(/\s/g,''))) {
                this.note('Byte buffer literal requires complete literal hexadecimal bytes');return 'undefined';
            }
            return 'hex`'+hex.replace(/\s/g,'').toLowerCase()+'`';
        }
        case 'arcade_bufferLength': return `${v('BUFFER')}.length`;
        case 'arcade_bufferIsReadOnly': return `${v('BUFFER')}.isReadOnly()`;
        case 'arcade_bufferConcat': return `${v('BUFFER')}.concat(${v('OTHER')})`;
        case 'arcade_bufferEquals': return `${v('BUFFER')}.equals(${v('OTHER')})`;
        case 'arcade_bufferHash': return `${v('BUFFER')}.hash(${v('BITS')})`;
        case 'arcade_bufferIndexOf': return `${v('BUFFER')}.indexOf(${v('OTHER')})`;
        case 'arcade_bufferGetByte': return `${v('BUFFER')}[${v('OFFSET')}]`;
        case 'arcade_bufferFromBase64': {
            const text=this.literalInput(b,'TEXT');
            return `Buffer.fromBase64(${text===null?v('TEXT'):JSON.stringify(text)})`;
        }
        case 'arcade_bufferChunked': return `${v('BUFFER')}.chunked(${v('SIZE')})`;
        case 'arcade_bufferChunkedFromUTF8': {
            const text=this.literalInput(b,'TEXT');
            return `Buffer.chunkedFromUTF8(${text===null?v('TEXT'):JSON.stringify(text)}, ${v('SIZE')})`;
        }
        case 'arcade_bufferPackedSize':
        case 'arcade_bufferPack':
        case 'arcade_bufferUnpack': {
            const format=this.literalInput(b,'FORMAT');
            const expression=format===null?v('FORMAT'):JSON.stringify(format);
            return b.opcode==='arcade_bufferPackedSize'?`Buffer.packedSize(${expression})`:
                b.opcode==='arcade_bufferPack'?`Buffer.pack(${expression}, ${v('ARRAY')})`:
                `${v('BUFFER')}.unpack(${expression}, ${v('OFFSET')})`;
        }
        case 'arcade_bufferFromArray': return `Buffer.fromArray(${v('ARRAY')})`;
        case 'arcade_bufferConcatArray': return `Buffer.concat(${v('ARRAY')})`;
        case 'arcade_bufferToArray':
        case 'arcade_bufferFormatSize':
        case 'arcade_bufferGetNumber': {
            const menu=this.menuField(b,'FORMAT','bufferFormats'), text=this.literalInput(b,'FORMAT');
            const fmt=menu || (text===null?this.literalNumber(b,'FORMAT'):BUFFER_FORMAT_NAMES.includes(text)?text:Number(text));
            const expression=BUFFER_FORMAT_NAMES.includes(fmt)?`NumberFormat.${fmt}`:
                typeof fmt==='number' && BUFFER_FORMAT_NAMES[fmt-1]?`NumberFormat.${BUFFER_FORMAT_NAMES[fmt-1]}`:
                b.opcode==='arcade_bufferFormatSize' && typeof fmt==='number' && Number.isFinite(fmt)?String(fmt):
                fmt===null?v('FORMAT'):null;
            if(expression===null){this.note('Byte buffer numeric format is not supported');return 'undefined';}
            return b.opcode==='arcade_bufferToArray'?`${v('BUFFER')}.toArray(${expression})`:
                b.opcode==='arcade_bufferFormatSize'?`Buffer.sizeOfNumberFormat(${expression})`:
                `${v('BUFFER')}.getNumber(${expression}, ${v('OFFSET')})`;
        }
        case 'arcade_bufferSlice': return `${v('BUFFER')}.slice(${v('OFFSET')}, ${v('LENGTH')})`;
        case 'arcade_bufferToBase64': return `${v('BUFFER')}.toBase64()`;
        case 'arcade_bufferToHex': return `${v('BUFFER')}.toHex()`;
        case 'arcade_bufferToText': return `${v('BUFFER')}.toString()`;
        case 'arcade_songFromBuffer': return `music.createSong(${v('BUFFER')})`;
        case 'arcade_cloneImage': {
            if(this.callableExports?.get(this.target)?.sdkImageEnabled){const image=this.sdkImageLiteralResources?.allocation(this.target,b);if(image)return toImgLiteral(image);}
            return `${v('IMAGE')}.clone()`;
        }
        case 'arcade_highScore': return 'info.highScore()';
        case 'arcade_settingsRead': {
            const type=settingType(b, this.blocks);
            if(type==='List')return `settings.list(${v('KEY')})`;
            if(!['Number','String','NumberArray','StringArray','Buffer'].includes(type)){this.note('Settings requires a fixed supported read type');return 'undefined';}
            if(type==='StringArray'){this.requiresStringArraySettings=true;return `bwStringArraySettings.read(${v('KEY')})`;}
            return `settings.read${type}(${v('KEY')})`;
        }
        case 'arcade_settingsExists': return `settings.exists(${v('KEY')})`;
        case 'arcade_spriteDataRead': {
            this.requiresSpriteDataPackage=true;
            const type=directMenuValue(b,'TYPE',this.blocks);
            if(!['Number','String','Sprite'].includes(type)){this.note('Sprite Data requires a fixed supported read type');return 'undefined';}
            return `sprites.readData${type}(${v('ID')}, ${v('KEY')})`;
        }
        case 'arcade_spriteDataReadBoolean': this.requiresSpriteDataPackage=true;return `sprites.readDataBoolean(${v('ID')}, ${v('KEY')})`;
        case 'arcade_imageEquals': return `${v('IMAGE')}.equals(${v('OTHER')})`;
        case 'arcade_screenImage': return 'screen';
        case 'arcade_inspectValue': {
            if(!this.inspectionExportOperands?.has(b)){this.note('Arcade inspection export requires actual primitive VALUE and Number or Undefined LIMIT producers');return 'undefined';}
            return `console.inspect(${this.arrayValue(b,'VALUE')}, ${this.arrayValue(b,'LIMIT')})`;
        }
        case 'arcade_sourceTypeOf': {
            const graph=this.callableExports?.get(this.target)?.graph,callable=callableReflectionOperand(graph,b,this.project);
            if(callableReflectionVariable(graph,b)?!callable:!this.sourceTypeOfExportOperands?.has(b)&&!callable)this.note('Arcade source typeof export requires a proven primitive or current owned resource; Sprite and opaque ownership is not qualified');
            return `(typeof (${this.arrayValue(b,'VALUE')}))`;
        }
        case 'arcade_fontValue': {
            const font=this.field(b,'FONT');if(!['font5','font8','font12'].includes(font)||b.inputs?.FONT){this.note('SDK Font value requires a fixed builtin selection');return 'undefined';}
            return `image.${font}`;
        }
        case 'arcade_fontForText':
            this.sdkFontPrimitiveOperand(b,'TEXT','string');return `image.getFontForText(${this.arrayValue(b,'TEXT')})`;
        case 'arcade_scaleFont':
            this.sdkFontOperand(b);this.sdkFontPrimitiveOperand(b,'SIZE','number');return `image.scaledFont(${this.arrayValue(b,'FONT')}, ${this.arrayValue(b,'SIZE')})`;
        case 'arcade_fontMetric': {
            const font=this.field(b,'FONT'),property=this.field(b,'PROPERTY');
            if (!['font5','font8','font12'].includes(font) || !['charWidth','charHeight'].includes(property) ||
                b.inputs?.FONT || b.inputs?.PROPERTY) {
                this.note('Arcade font metric requires fixed builtin FONT and PROPERTY fields');
                return 'undefined';
            }
            return `image.${font}.${property}`;
        }
        case 'arcade_melodyPlayable': return `music.melodyPlayable(${v('MELODY')})`;
        case 'arcade_stringPlayable': return `music.stringPlayable(${v('MELODY')}, ${v('TEMPO')})`;
        case 'arcade_tonePlayable': return `music.tonePlayable(${v('FREQUENCY')}, ${v('DURATION')})`;
        case 'arcade_namedSongPlayable':
        case 'arcade_songPlayable': {
            const literal = this.literalInput(b, 'HEX');
            if (literal !== null) {
                const text = String(literal).replace(/\s/g, '');
                if (!/^(?:[0-9a-f]{2}){7,}$/i.test(text) || !/^00/i.test(text)) {
                    this.note('Arcade song requires complete version-zero hexadecimal bytes');
                    return 'undefined';
                }
                if (b.opcode === 'arcade_namedSongPlayable') {
                    const name = this.literalInput(b, 'NAME');
                    if (!isNativeAnimationName(name)) {
                        this.note('Named song export requires a literal native asset name');
                        return 'undefined';
                    }
                    const prior = this.songAssets.get(name);
                    if (prior && prior.hex !== text.toLowerCase()) {
                        this.note(`Conflicting song bytes for asset ${JSON.stringify(name)}`);
                        return 'undefined';
                    }
                    const resource = prior || {id: `song${this.songAssets.size + 1}`, name, hex: text.toLowerCase()};
                    this.songAssets.set(name, resource);
                    return `music.createSong(assets.song\`${name}\`)`;
                }
                return 'music.createSong(hex`' + text.toLowerCase() + '`)';
            }
            if (b.opcode === 'arcade_namedSongPlayable') this.note('Named song export requires literal hexadecimal bytes');
            return `music.createSong(Buffer.fromHex(${v('HEX')}))`;
        }
        case 'arcade_soundEffect': {
            const wave = this.musicField(b, 'WAVE', 'WaveShape'), effect = this.musicField(b, 'EFFECT', 'SoundExpressionEffect');
            const curve = this.musicField(b, 'CURVE', 'InterpolationCurve');
            if (!wave || !effect || !curve) { this.note('Unsupported Arcade sound effect option'); return 'undefined'; }
            return `music.createSoundEffect(${wave}, ${['START_FREQUENCY', 'END_FREQUENCY', 'START_VOLUME', 'END_VOLUME', 'DURATION'].map(v).join(', ')}, ${effect}, ${curve})`;
        }
        case 'arcade_namedMelody': {
            const name = this.musicField(b, 'NAME', 'music');
            if (!name) { this.note(`Unsupported Arcade melody ${this.field(b, 'NAME')}`); return 'undefined'; }
            return name;
        }
        case 'arcade_soundMelody': {
            const sound = this.musicField(b, 'SOUND', 'Sounds');
            if (!sound) { this.note(`Unsupported Arcade sound ${this.field(b, 'SOUND')}`); return 'undefined'; }
            return `music.sounds(${sound})`;
        }
        case 'arcade_beat': {
            const fraction = this.musicField(b, 'FRACTION', 'BeatFraction');
            if (!fraction) { this.note(`Unsupported Arcade beat ${this.field(b, 'FRACTION')}`); return 'undefined'; }
            return `music.beat(${fraction})`;
        }
        case 'arcade_musicVolume': return 'music.volume()';
        case 'arcade_parseInteger': case 'arcade_parseIntegerRadix': {
            // PXT's parseInt takes a string; a literal field like 7 is written "7".
            const literal = this.literalInput(b, 'TEXT');
            const text = literal !== null ? JSON.stringify(String(literal)) : v('TEXT');
            return b.opcode === 'arcade_parseInteger' ? `parseInt(${text})` : `parseInt(${text}, ${v('RADIX')})`;
        }
        case 'arcade_frameDeltaTime': {
            if(!currentFrameDeltaReporter(this.blocks,b)){this.note('Frame delta Number: current zero-input reporter or physical socket differs');return this.na();}
            return 'game.eventContext().deltaTime';
        }
        case 'arcade_musicTempo': return 'music.tempo()';
        case 'arcade_characterRule': {
            // The rule word holds the original's Predicate names.
            const names = String(this.literal(b, 'PREDICATES') ?? '').trim().split(/\s+/).filter(Boolean);
            if (!names.length || names.length > 5 || names.some(name => !CHARACTER_PREDICATE_NAMES.includes(name))) { this.note('character rule with predicates other than literal Predicate names'); return this.na(); }
            this.requiresCharacterAnimationsPackage = true;
            return `characterAnimations.rule(${names.map(name => `Predicate.${name}`).join(', ')})`;
        }
        case 'arcade_characterRuleToString': this.requiresCharacterAnimationsPackage = true; return `characterAnimations.ruleToString(${v('RULE')})`;
        case 'arcade_characterMatchesRule': this.requiresCharacterAnimationsPackage = true; return `characterAnimations.matchesRule(${v('SPRITE')}, ${v('RULE')})`;
        case 'arcade_backgroundScrollOffset':
            this.requiresScrollerPackage = true;
            const suffix=this.scrollerLayerSuffix(b);
            return `scroller.getBackground${this.field(b, 'AXIS') === 'y' ? 'Y' : 'X'}Offset(${suffix ? suffix.slice(2) : ''})`;
        case 'arcade_textSpriteCreate':
            this.requiresTextSpritePackage=true;
            return `textsprite.create(${v('TEXT')}, ${v('BACKGROUND')}, ${v('FOREGROUND')})`;
        case 'arcade_textSpriteProperty': {
            this.requiresTextSpritePackage=true;
            const property=directMenuValue(b,'PROPERTY',this.blocks);
            if(!['text','bg','fg','maxFontHeight','borderWidth','borderColor','padding','outlineWidth','outlineColor','icon'].includes(property)){this.note(`Unsupported TextSprite property ${property}`);return this.na();}
            return `${v('ID')}.${property}`;
        }
        case 'arcade_createDart':
            this.requiresDartsPackage = true;
            return `darts.create(${v('IMAGE')}, ${this.kindExpr(b, 'KIND')}, ${v('X')}, ${v('Y')})`;
        case 'arcade_createCorgi':
            this.requiresCorgioPackage = true;
            return `corgio.create(${this.kindExpr(b, 'KIND')}, ${v('X')}, ${v('Y')})`;
        case 'arcade_dartProperty': case 'arcade_corgiProperty': {
            const property = this.field(b, 'PROPERTY');
            const fields = b.opcode === 'arcade_dartProperty' ? ['angle', 'pow', 'iter', 'traceColor', 'gravity', 'wind', 'angleRate', 'powerRate'] :
                ['maxMoveVelocity', 'gravity', 'jumpVelocity', 'maxJump', 'decelerationRate'];
            if (!fields.includes(property)) { this.note(`Unsupported extension property ${property}`); return this.na(); }
            return `${v('SPRITE')}.${property}`;
        }
        case 'arcade_sevensegDigit': {
            const style = this.musicField(b, 'STYLE', 'SegmentStyle');
            if (!style) { this.note(`Unsupported seven segment style in ${b.opcode}`); return this.na(); }
            this.requiresSevensegPackage = true;
            return `sevenseg.createDigit(${style}, ${v('VALUE')})`;
        }
        case 'arcade_sevensegCounter': {
            const style = this.musicField(b, 'STYLE', 'SegmentStyle'), scale = this.musicField(b, 'SCALE', 'SegmentScale');
            if (!style || !scale) { this.note(`Unsupported seven segment style or scale in ${b.opcode}`); return this.na(); }
            this.requiresSevensegPackage = true;
            return `sevenseg.createCounter(${style}, ${scale}, ${v('DIGITS')})`;
        }
        case 'arcade_sevensegProperty': {
            const property = this.field(b, 'PROPERTY');
            if (!['x', 'y', 'width', 'height', 'value', 'count'].includes(property)) { this.note(`Unsupported seven segment property in ${b.opcode}`); return this.na(); }
            return `${v('DISPLAY')}.${property}`;
        }
        case 'arcade_imageProperty': {const image=v('IMAGE'),typed=this.imageConsumerAbi?.accepts(this.target,b);return `${typed?`(<Image>(${image}))`:image}.${this.field(b,'PROPERTY')}`;}
        case 'arcade_imagePixel': {const image=v('IMAGE'),typed=this.imageConsumerAbi?.accepts(this.target,b);return `${typed?`(<Image>(${image}))`:image}.getPixel(${v('X')}, ${v('Y')})`;}
        case 'arcade_createImageSprite':
        case 'arcade_spawnImageSprite':
            if (!this.spawnAssignment && b.opcode === 'arcade_spawnImageSprite') this.note('Arcade positioned image spawn expression needs an assigned handle');
            return `sprites.create(${v('IMAGE')}, ${this.kindExpr(b,'KIND')})`;
        case 'arcade_spriteImage': return `${v('ID')}.image`;
        case 'arcade_frameImage': {
            const key = this.literalInput(b, 'KEY');
            const template = this.literalInput(b, 'TEMPLATE');
            const start = this.literalNumber(b, 'START'), count = this.literalNumber(b, 'COUNT');
            const target = this.sprites.find(t => t.name === template);
            if (!key || !target || start === null || count === null || !Number.isInteger(count) || !Number.isInteger(start) || count < 1 || start < 0 || start + count > target.costumes.length) {
                this.note('Arcade shared frame image requires a literal array key and valid template range');
                return this.na();
            }
            if (!this.sharedImageArrays.has(key)) {
                const frames = Array.from({length: count}, (_,i) => this.frame(target, start + i));
                // Named after the template so a re-import labels the artwork carrier as it was.
                let name = `__bwFrames_${ident(template)}`;
                const used = new Set([...this.globals.values(), ...[...this.frameArrays.values(), ...this.sharedImageArrays.values()].map(a=>a.name)]);
                while (used.has(name)) name += '_';
                this.sharedImageArrays.set(key, {name,frames});
            }
            const array = this.sharedImageArrays.get(key);
            return `${array.name}[(((Math.round(${v('INDEX')}) % ${array.frames.length}) + ${array.frames.length}) % ${array.frames.length})]`;
        }
        case 'arcade_spritePixel': return `${v('ID')}.image.getPixel(${v('X')}, ${v('Y')})`;
        case 'arcade_spriteToString': return `${v('ID')}.toString()`;
        case 'arcade_spriteProperty': {
            const property = this.field(b, 'PROPERTY');
            if(property==='kind')return `${v('ID')}.kind()`;
            if(!['x','y','left','right','top','bottom','vx','vy','ax','ay','fx','fy','sx','sy','scale','width','height','z','lifespan','rotation','rotationDegrees','data','flags'].includes(property)){this.note(`Arcade sprite property ${property} is unsupported`);return this.na();}
            return `${v('ID')}.${property}`;
        }
        case 'arcade_menu_bufferFormats': {
            const format=this.field(b,'bufferFormats');
            if(!BUFFER_FORMAT_NAMES.includes(format)){this.note('Byte buffer numeric format is not supported');return 'undefined';}
            return `NumberFormat.${format}`;
        }
        case 'arcade_menu_scaleAnchors': return String(Number(this.field(b,'scaleAnchors')));
        case 'arcade_menu_cameraProperties': return String(Number(this.field(b,'cameraProperties')));
        case 'arcade_getPlayerScore': {const api=this.infoPlayerApi(b);return api?`${api}.score()`:this.na();}
        case 'arcade_hasLife': {const api=this.infoPlayerApi(b);return api?`${api}.hasLife()`:this.na();}
        case 'arcade_hasPlayerScore': {const api=this.infoPlayerApi(b);return api?`${api}.hasScore()`:this.na();}
        case 'arcade_getLife': {const api=this.infoPlayerApi(b);return api?`${api}.life()`:this.na();}
        case 'arcade_playerLookup': {
            this.requiresMultiplayerPackage=true;const mode=this.field(b,'MODE');
            if(!['index','number'].includes(mode)){this.note('Arcade player lookup mode must be index or number');return this.na();}
            return `mp.${mode==='index'?'getPlayerByIndex':'getPlayerByNumber'}(${v('VALUE')})`;
        }
        case 'arcade_createPlayerState':this.requiresMultiplayerPackage=true;return 'MultiplayerState.create()';
        case 'arcade_getPlayerState':this.requiresMultiplayerPackage=true;return `mp.getPlayerState(${v('PLAYER')}, ${v('KEY')})`;
        case 'arcade_allPlayers': this.requiresMultiplayerPackage=true;return 'mp.allPlayers()';
        case 'arcade_playerSprite': this.requiresMultiplayerPackage=true;return `mp.getPlayerSprite(${v('PLAYER')})`;
        case 'arcade_playerBySprite': this.requiresMultiplayerPackage=true;return `mp.getPlayerBySprite(${v('ID')})`;
        case 'arcade_playerProperty': {
            this.requiresMultiplayerPackage=true;const read=this.field(b,'READ'),property=this.literalNumber(b,'PROPERTY');
            if(read==='safe')return `mp.getPlayerProperty(${v('PLAYER')}, ${property===2?'mp.PlayerProperty.Number':v('PROPERTY')})`;
            if(read==='member' && [1,2].includes(property))return `(${v('PLAYER')}).${property===1?'index':'number'}`;
            this.note('Arcade player member reads require fixed index/number properties; safe reads permit dynamic selectors');return this.na();
        }
        case 'arcade_currentScene': return 'game.currentScene()';
        case 'arcade_sceneFlags': return `${v('SCENE')}.flags`;
        case 'arcade_scenePhysicsEngine': return `(${v('SCENE')}.physicsEngine as ArcadePhysicsEngine)`;
        case 'arcade_createPhysicsEngine': return `new ArcadePhysicsEngine(${this.arrayValue(b,'MAX_SPEED')}, ${this.arrayValue(b,'MIN_STEP')}, ${this.arrayValue(b,'MAX_STEP')})`;
        case 'arcade_physicsEngineProperty': {
            const property=b.fields?.PROPERTY?.[0];
            if(!['maxSpeed','minStep','maxStep'].includes(property)){this.note(`Arcade PhysicsEngine property ${property} is unsupported`);return 'undefined';}
            return `(${v('ENGINE')}).${property}`;
        }
        case 'arcade_cameraDrawOffset': {
            const axis=this.field(b,'AXIS');
            if(!['x','y'].includes(axis)){this.note('Arcade camera draw offset requires x or y');return this.na();}
            return axis==='x'?'scene.cameraLeft()':'scene.cameraTop()';
        }
        case 'arcade_cameraProperty': return `scene.cameraProperty(${this.arrayValue(b,'PROPERTY')})`;
        case 'arcade_backgroundImage': return 'scene.backgroundImage()';
        case 'arcade_backgroundColor': return 'scene.backgroundColor()';
        case 'arcade_truncateNumber': return `Math.trunc(${v('NUM')})`;
        case 'arcade_signNumber': return `Math.sign(${v('NUM')})`;
        case 'arcade_mathUnary': {
            const operation = String(directMenuValue(b, 'OP', this.blocks));
            if (operation !== 'truncate' && operation !== 'sign') { this.note('Arcade math requires a fixed supported operation'); return 'undefined'; }
            return `Math.${operation === 'truncate' ? 'trunc' : 'sign'}(${v('NUM')})`;
        }
        case 'arcade_createAnimation': this.requiresAnimationPackage=true;return `animation.createAnimation(${this.arrayValue(b,'ACTION')}, ${this.arrayValue(b,'INTERVAL')})`;
        case 'arcade_animationProperty': {
            this.requiresAnimationPackage=true;
            const method={image:'getImage',action:'getAction',interval:'getInterval'}[this.field(b,'PROPERTY')];
            if(!method){this.note('Unsupported animation property');return this.na();}
            return `${v('ANIMATION')}.${method}()`;
        }
        case 'arcade_eventLocation':
            if(this.eventLocationName)return this.eventLocationName;
            this.note('Arcade event location outside a wall or tile callback');return this.na();
        case 'arcade_legacyTileLocation':this.requiresLegacyTilemapPackage=true;return `scene.getTile(${v('COLUMN')}, ${v('ROW')})`;
        case 'arcade_legacyTilesOfType':this.requiresLegacyTilemapPackage=true;return `scene.getTilesByType(${v('INDEX')})`;
        case 'arcade_legacyTileProperty':this.requiresLegacyTilemapPackage=true;return `${v('TILE')}.${this.field(b,'PROPERTY')}`;
        case 'arcade_tileHitFrom':this.requiresLegacyTilemapPackage=true;return `scene.tileHitFrom(${v('ID')}, ${v('DIRECTION')})`;
        case 'arcade_tileLocation': return `tiles.getTileLocation(${v('COLUMN')}, ${v('ROW')})`;
        case 'arcade_tilesOfType': return `tiles.getTilesByType(${v('IMAGE')})`;
        case 'arcade_tileLocationProperty': return `${v('LOCATION')}.${this.field(b,'PROPERTY')}`;
        case 'arcade_tileIs': return `tiles.tileAtLocationEquals(${v('LOCATION')}, ${v('IMAGE')})`;
        case 'arcade_spriteTileKindAt': return `${v('ID')}.tileKindAt(${this.arrayValue(b,'DIRECTION')}, ${v('IMAGE')})`;
        case 'arcade_isHittingTile': return `${v('ID')}.isHittingTile(${this.arrayValue(b,'DIRECTION')})`;
        case 'arcade_tileIsWall': return `tiles.tileAtLocationIsWall(${v('LOCATION')})`;
        case 'arcade_tileAtLocation': return `tiles.tileImageAtLocation(${v('LOCATION')})`;
        case 'arcade_tileNeighbor': return `${v('LOCATION')}.getNeighboringLocation(${this.arrayValue(b,'DIRECTION')})`;
        case 'arcade_spriteTileLocation': return `${v('ID')}.tilemapLocation()`;
        case 'arcade_tilemapValue': {
            const raw=this.literalInput(b,'DATA');let data=null;
            try{data=JSON.parse(raw);}catch(e){/* named below */}
            const source=tilemapSource(data, (image, index) => this.tileAssets.register(image, index));
            if(!source){this.note('Arcade tilemap value export requires valid fixed tile data, wall layer and scale');return 'null';}
            return source;
        }
        case 'arcade_tilemapProperty': return `${v('DATA')}.${this.field(b,'PROPERTY')}`;
        case 'arcade_tilemapTile': return `${v('DATA')}.getTile(${v('COLUMN')}, ${v('ROW')})`;
        case 'arcade_tilemapIsWall': return `${v('DATA')}.isWall(${v('COLUMN')}, ${v('ROW')})`;
        case 'arcade_tilemapTileImage': return `${v('DATA')}.getTileImage(${v('INDEX')})`;
        case 'arcade_tilemapTileset': return `${v('DATA')}.getTileset()`;
        case 'arcade_tileLocationTilemap': return `${v('LOCATION')}.tileMap`;
        case 'arcade_sceneTilemapProperty': {
            const property=this.field(b,'PROPERTY');
            if(!['data','scale','enabled','areaWidth','areaHeight'].includes(property)){this.note(`Arcade scene tilemap property ${property} is unsupported`);return 'null';}
            return `${v('MAP')}.${property}${['areaWidth','areaHeight'].includes(property)?'()':''}`;
        }
        case 'arcade_eventTilemapData':
            if(this.eventTilemapName)return this.eventTilemapName;
            this.note('Arcade event tilemap data outside a tilemap event callback');return this.na();
        case 'arcade_randomTileOfType': return `tiles.getRandomTileByType(${v('IMAGE')})`;
        case 'arcade_spritesOfKind': return `sprites.allOfKind(${this.kindExpr(b, 'KIND')})`;
        case 'arcade_spriteCount': return `sprites.allOfKind(${this.kindExpr(b, 'KIND')}).length`;
        case 'arcade_ask': return `game.ask(${this.arrayValue(b,'TITLE')}, ${this.arrayValue(b,'SUBTITLE')})`;
        case 'arcade_askForStringLength':
            if(!boundedTextPromptInputs(b)){this.note('Arcade limited text prompt requires literal String question and length one to three');return this.na();}
            return `game.askForString(${v('QUESTION')}, ${v('LENGTH')})`;
        case 'arcade_askForNumberLength': return `game.askForNumber(${v('QUESTION')}, ${v('LENGTH')})`;
        case 'arcade_askForNumber': return `game.askForNumber(${v('QUESTION')})`;
        case 'arcade_controllerStep': {
            const literal=this.literal(b,'AXIS') ?? (this.field(b,'AXIS') || null);
            if(literal!==null)return `controller.d${literal.toLowerCase()==='y'?'y':'x'}(${v('STEP')})`;
            const key='controllerAxisStep';
            if(!this.legacyValueHelpers.has(key)) {
                let name='__bwControllerAxisStep';
                const occupied=new Set([...this.globals.values(),...this.functionNames(),...this.legacyValueHelpers.values()].map(value=>typeof value==='string'?value:value.name));
                while(occupied.has(name))name+='_';
                this.legacyValueHelpers.set(key,{name,source:`function ${name}(axis: any, step: number): number {
    const direction = "" + axis
    return direction === "y" || direction === "Y" ? controller.dy(step) : controller.dx(step)
}`});
            }
            return `${this.legacyValueHelpers.get(key).name}(${this.arrayValue(b,'AXIS')}, ${v('STEP')})`;
        }
        case 'arcade_getCaptured': {
            const name = this.literalInput(b,'NAME');
            if(this.currentCallableContext){try{return this.currentCallableContext.capture(name);}catch(error){this.note(error.message);return this.na();}}
            if (!name || !this.compilingRegisteredCallbacks.size) { this.note('Arcade captured value needs a registered callback and fixed name');return this.na(); }
            return ident(name);
        }
        case 'arcade_getLocal': {
            const name = this.literalInput(b, 'NAME');
            if(this.currentCallableContext){try{return this.currentCallableContext.local(name);}catch(error){this.note(error.message);return this.na();}}
            if (!name || !/^[A-Za-z_]\w*$/.test(name) || !this.currentLocalNames) {
                this.note('Arcade local reporter needs a fixed name inside a procedure');
                return this.na();
            }
            this.currentLocalNames.add(name);
            return name;
        }
        case 'arcade_askForString': return `game.askForString(${v('QUESTION')})`;
        case 'arcade_allocateControlEventSource': return 'control.allocateNotifyEvent()';
        case 'arcade_buttonRepeatProperty': {
            const receiver=this.controllerRepeatReceiver(b);return receiver?receiver+'.'+b.fields.PROPERTY[0]:'undefined';
        }
        case 'arcade_controllerEventSource': {const player=b.fields.PLAYER?.[0];if(!['1','2','3','4'].includes(String(player))){this.note('Controller event source requires a fixed player 1 through 4');return 'undefined';}return `controller.player${player}.id`;}
        case 'arcade_eventPlayer':
            if(this.eventPlayerName)return this.eventPlayerName;
            this.note('Arcade event player outside a multiplayer callback');return this.na();
        case 'arcade_playerConnected':this.requiresMultiplayerPackage=true;return `mp.isConnected(${v('PLAYER')})`;
        case 'arcade_playerButtonPressed':this.requiresMultiplayerPackage=true;return `mp.isButtonPressed(${v('PLAYER')}, ${v('BUTTON')})`;
        case 'arcade_eventSprite': {
            const which = this.field(b, 'WHICH') === 'second' ? 1 : 0;
            if (this.eventHandles?.[which]) return this.eventHandles[which];
            this.note('Arcade event sprite outside a creation or overlap callback');
            return this.na();
        }
        case 'arcade_spriteOverlaps': return `${v('A')}.overlapsWith(${v('B')})`;
        case 'operator_length': return `${this.textOperand(b, 'STRING')}.length`;
        // A character of a text (task E17). `letter` counts from 1, PXT's
        // index from 0. String_::charAt gives "" out of range (index < 0 or
        // >= length), as Scratch's letter does for a whole index. It is
        // `s.charAt(i)`, not `s[i]` (the same shim): PXT refuses an indexer
        // of type `any` ("non-numeric indexer"), and an exported variable
        // often is one. A literal index is folded and `letter (i + 1)` — how
        // the importer reads `s.charAt(i)` — goes back as `charAt(i)`, so a
        // round trip stays put. (A fractional index between 0 and 1, or NaN,
        // is where they part: charAt truncates it to 0, Scratch gives "".)
        case 'operator_letter_of': {
            // Text whatever it holds, as `length of` reads it: a literal or
            // a join is text already, anything else is made text.
            const block = name => {
                const slot = b.inputs?.[name]?.[1];
                return typeof slot === 'string' ? this.block(slot) : null;
            };
            const text = this.textOperand(b, 'STRING');
            const n = this.literalNumber(b, 'LETTER');
            if (n !== null && Number.isInteger(n)) return `${text}.charAt(${n - 1})`;
            const at = block('LETTER');
            if (at && at.opcode === 'operator_add' && this.literalNumber(at, 'NUM2') === 1) {
                return `${text}.charAt(${this.value(at, 'NUM1')})`;
            }
            return `${text}.charAt(${v('LETTER')} - 1)`;
        }
        case 'operator_gt': return `(${v('OPERAND1')} > ${v('OPERAND2')})`;
        case 'operator_lt': return `(${v('OPERAND1')} < ${v('OPERAND2')})`;
        case 'operator_equals': {
            // A bare variable is compared as `any`: TypeScript narrows a `let`
            // to the literal it was last given (x = 1; ... x == 0 is then a
            // compile error), and a costume name may meet a number. `as` is
            // compile-time only; the comparison itself is unchanged.
            const loose = x => (/^[A-Za-z_]\w*$/.test(x) && x !== '_na' ? `(${x} as any)` : x);
            // Two number literals are a constant (the dialect writes a Boolean
            // literal as `0 = 1`); Static TypeScript refuses `0 == 1` outright.
            const number = x => /^-?\d+(\.\d+)?$/.test(x);
            const [left, right] = [v('OPERAND1'), v('OPERAND2')];
            if (number(left) && number(right)) return String(Number(left) === Number(right));
            return `(${loose(left)} == ${loose(right)})`;
        }
        case 'operator_and': return `(${c('OPERAND1')} && ${c('OPERAND2')})`;
        case 'operator_or': return `(${c('OPERAND1')} || ${c('OPERAND2')})`;
        case 'operator_not': return `(!${c('OPERAND')})`;
        case 'operator_mathop': {
            const op = this.field(b, 'OPERATOR');
            const n = v('NUM');
            const map = {abs: `Math.abs(${n})`, floor: `Math.floor(${n})`, ceiling: `Math.ceil(${n})`,
                sqrt: `Math.sqrt(${n})`, sin: `Math.sin(${n} * Math.PI / 180)`, cos: `Math.cos(${n} * Math.PI / 180)`,
                tan: `Math.tan(${n} * Math.PI / 180)`, asin: `(Math.asin(${n}) * 180 / Math.PI)`,
                acos: `(Math.acos(${n}) * 180 / Math.PI)`, atan: `(Math.atan(${n}) * 180 / Math.PI)`,
                ln: `Math.log(${n})`, exp: `Math.exp(${n})`, log: `(Math.log(${n}) / Math.LN10)`, '10 ^': `Math.pow(10, ${n})`,
                'e ^': `Math.exp(${n})`};
            if (map[op]) return map[op];
            this.note(`${op} of …`);
            return this.na();
        }
        case 'motion_xposition': return me ? `((${me}.x - 80) * 3)` : '0';
        case 'motion_yposition': return me ? `((60 - ${me}.y) * 3)` : '0';
        case 'motion_direction': return me ? this.use('scratchPose', '_scratchDirection(' + me + ')') : '90';
        case 'looks_size': return me ? 'Math.round(' + me + '.scale * 100)' : '100';
        case 'sensing_of': {
            const prop = this.field(b, 'PROPERTY');
            const other = this.spriteVar.get(this.menuField(b, 'OBJECT', 'OBJECT'));
            if (other && prop === 'x position') return `((${other}.x - 80) * 3)`;
            if (other && prop === 'y position') return `((60 - ${other}.y) * 3)`;
            this.note(`${prop} of another sprite`);
            return this.na();
        }
        case 'sensing_touchingobject': {
            const what = this.menuField(b, 'TOUCHINGOBJECTMENU', 'TOUCHINGOBJECTMENU');
            if (!me) return 'false';
            if (what === '_edge_') return `(${me}.left < 0 || ${me}.right > 160 || ${me}.top < 0 || ${me}.bottom > 120)`;
            // A cloned sprite is touched through the sprite OR any of its clones.
            if (this.clonable.has(what)) return this.use('touching', `_touching(${me}, ${this.allOf(what)})`);
            const other = this.spriteVar.get(what);
            if (other) return `${me}.overlapsWith(${other})`;
            if (what === '_mouse_') {
                const pointer = this.browserPointer();
                if (pointer) return pointer.hits + '(' + me + ')';
                this.note(`touching mouse-pointer: ${MOUSE_WHY}`);
            }
            else this.note(`touching ${what || 'the mouse pointer'}`);
            return 'false';
        }
        case 'sensing_mousex': {
            const pointer = this.browserPointer();
            if (pointer) return '(' + pointer.x + ' - 80) * 3';
            this.note('mouse x: ' + MOUSE_WHY);
            return this.na();
        }
        case 'sensing_mousey': {
            const pointer = this.browserPointer();
            if (pointer) return '(60 - ' + pointer.y + ') * 3';
            this.note('mouse y: ' + MOUSE_WHY);
            return this.na();
        }
        case 'sensing_mousedown': {
            const pointer = this.browserPointer();
            if (pointer) return pointer.down;
            this.note('mouse down?: ' + MOUSE_WHY);
            return 'false';
        }
        case 'sensing_distanceto': {
            const destination = this.menuField(b, 'DISTANCETOMENU', 'DISTANCETOMENU');
            const pointer = destination === '_mouse_' ? this.browserPointer() : null;
            const other = this.spriteVar.get(destination);
            if (me && (other || pointer)) {
                const dx = me + '.x - ' + (other ? other + '.x' : pointer.x);
                const dy = me + '.y - ' + (other ? other + '.y' : pointer.y);
                return 'Math.sqrt((' + dx + ') * (' + dx + ') + (' + dy + ') * (' + dy + ')) * 3';
            }
            this.note(destination === '_mouse_' ? 'distance to mouse-pointer: ' + MOUSE_WHY : 'sensing_distanceto as a value');
            return this.na();
        }
        // ── costumes and backdrops ──
        case 'looks_costumenumbername': {
            if (!me) return this.na();
            this.use('costume');
            return this.field(b, 'NUMBER_NAME') === 'name' ?
                `${this.costumeNames(this.target)}[_costume(${me})]` : `(_costume(${me}) + 1)`;
        }
        case 'looks_backdropnumbername':
            return this.field(b, 'NUMBER_NAME') === 'name' ? '_backdropNames[_bd]' : '(_bd + 1)';
        // ── lists ──
        case 'data_itemoflist': {
            const list = this.listName(b);
            return `_item(${list}, ${this.listIndex(b, list)})`;
        }
        case 'data_itemnumoflist': return `_findItem(${this.listName(b)}, ${this.value(b, 'ITEM', '""')})`;
        case 'data_lengthoflist': return `${this.listName(b)}.length`;
        case 'data_listcontainsitem': return `(_findItem(${this.listName(b)}, ${this.value(b, 'ITEM', '""')}) > 0)`;
        case 'data_listcontents': return `_listText(${this.listName(b)})`;
        // ── sound ──
        case 'sound_volume': this.volumeWarning(); return 'Math.round(music.volume() / 2.55)';
        case 'music_getTempo': return this.use('music', '_tempo');
        case 'sensing_keypressed': {
            const key = this.menuField(b, 'KEY_OPTION', 'KEY_OPTION');
            const btn = this.scratchButton(key);
            if (btn) return `${btn}.isPressed()`;
            this.note(`key "${key}" pressed (Arcade has arrows, A and B)`);
            return 'false';
        }
        case 'arcade_sceneMillis': {
            if(!currentSceneClockNumber(this.blocks,b)) {
                this.note('Scene clock Number: current zero-input reporter or unique parent differs');return 'undefined';
            }
            return 'game.runtime()';
        }
        case 'arcade_programMillis': return 'control.millis()';
        case 'sensing_answer': return this.scratchTextAnswer();
        case 'sensing_timer': return `${this.use('scratchTimer','__bwScratchTimer')}()`;
        default:
            this.note(`${b.opcode} as a value`);
            return this.na();
        }
    }

    // ── statements ───────────────────────────────────────────────────────
    stmts (id, depth, out) {
        let b = this.block(id);
        const seen = new Set();
        while (b) {
            if (seen.has(b)) { this.note('Cyclic statement chain cannot be exported'); return; }
            seen.add(b);
            this.stmt(b, depth, out);
            // `stop all` and `stop this script` are caps: nothing after them runs.
            if (b.opcode === 'control_stop' && /^(all|this script)$/.test(this.field(b, 'STOP_OPTION'))) return;
            b = this.block(b.next);
        }
    }

    substack (b, name, depth, out) {
        const input = b.inputs && b.inputs[name];
        if (input && typeof input[1] === 'string') this.stmts(input[1], depth, out);
    }

    stmt (b, depth, out) {
        const pad = '    '.repeat(depth);
        const push = line => out.push(pad + line);
        if(['arcade_bufferSetByte','arcade_bufferSetNumber','arcade_bufferWrite','arcade_bufferFill','arcade_bufferShift','arcade_bufferRotate','arcade_bufferPackAt'].includes(b.opcode) && this.sdkFontInputs.glyphInput(this.target,b,'BUFFER'))
            this.note('SDK Font glyph Buffer mutation is not qualified by the read slice');
        const v = n => this.value(b, n);
        const me = this.self();
        const pen = !!me && this.penUsers.has(this.target.name);
        if (/^data_(addtolist|deletealloflist|deleteoflist|insertatlist|replaceitemoflist)$/.test(b.opcode) && this.listStmt(b, push)) return;
        if (this.newStmt(b, push, me, depth, out)) return;
        switch (b.opcode) {
        case 'arcade_throwValue': {
            if(!this.throwExportOperands?.has(b)){this.note('Arcade Throw export requires a proved primitive operand and qualified main/button/ordinary procedure owner');return;}
            push(`throw ${this.arrayValue(b,'VALUE')}`);return;
        }
        case 'arcade_bindSpriteKind': {
            const name=this.literalInput(b,'NAME');
            if(!this.boundSpriteKinds.has(name)){push(`// ${this.note('Arcade kind binding needs an exported mutable named kind')}`);return;}
            push(`SpriteKind.${name} = ${this.arrayValue(b,'KIND')}`);return;
        }
        case 'arcade_initializeSpriteKindLibrary': {
            if(this.literalInput(b,'LIBRARY')!=='textsprite' || this.literalInput(b,'VERSION')!=='v1.3.0') {push(`// ${this.note('Unsupported Arcade sprite kind library version')}`);return;}
            this.requiresTextSpritePackage=true;
            // The dependency initializer executes before main. Its placement is
            // checked separately; emitting another create() would double-allocate.
            return;
        }
        case 'arcade_addAnimationFrame':this.requiresAnimationPackage=true;push(`${v('ANIMATION')}.addAnimationFrame(${v('IMAGE')})`);return;
        case 'arcade_attachAnimation':this.requiresAnimationPackage=true;push(`animation.attachAnimation(${v('ID')}, ${v('ANIMATION')})`);return;
        case 'arcade_setAnimationAction':this.requiresAnimationPackage=true;push(`animation.setAction(${v('ID')}, ${this.arrayValue(b,'ACTION')})`);return;
        case 'arcade_setPlayerState':this.requiresMultiplayerPackage=true;push(`mp.setPlayerState(${v('PLAYER')}, ${v('KEY')}, ${v('VALUE')})`);return;
        case 'arcade_changePlayerState':this.requiresMultiplayerPackage=true;push(`mp.changePlayerStateBy(${v('PLAYER')}, ${v('KEY')}, ${v('VALUE')})`);return;
        case 'arcade_movePlayerWithButtons': this.requiresMultiplayerPackage=true;push(`mp.moveWithButtons(${v('PLAYER')}, ${v('VX')}, ${v('VY')})`);return;
        case 'arcade_setPlayerSprite': this.requiresMultiplayerPackage=true;push(`mp.setPlayerSprite(${v('PLAYER')}, ${v('ID')})`);return;
        case 'arcade_setScenePhysicsEngine': push(`${v('SCENE')}.physicsEngine = ${v('ENGINE')}`);return;
        case 'arcade_setSceneFlags': push(`${v('SCENE')}.flags = ${v('VALUE')}`);return;
        case 'arcade_setUserEventsEnabled': push(`controller._setUserEventsEnabled(${this.boolValue(b,'ENABLED')})`);return;
        case 'arcade_setPhysicsEngineProperty': {
            const property=b.fields?.PROPERTY?.[0];
            if(!['maxSpeed','minStep','maxStep'].includes(property)){this.note(`Arcade PhysicsEngine property ${property} is unsupported`);return;}
            push(`;(${v('ENGINE')}).${property} = ${this.arrayValue(b,'VALUE')}`);return;
        }
        case 'arcade_setAnimationInterval':this.requiresAnimationPackage=true;push(`${v('ANIMATION')}.setInterval(${this.arrayValue(b,'INTERVAL')})`);return;
        case 'arcade_runImageAnimation':push(`animation.runImageAnimation(${v('ID')}, ${this.arrayValue(b,'FRAMES')}, ${this.arrayValue(b,'INTERVAL')}, ${this.arrayValue(b,'LOOP')})`);return;
        case 'arcade_stopAnimation':push(`animation.stopAnimation(${this.arrayValue(b,'TYPE')}, ${v('ID')})`);return;
        case 'arcade_setLegacyTilemap':this.requiresLegacyTilemapPackage=true;push(`scene.setTileMap(${v('IMAGE')}, ${v('SCALE')})`);return;
        case 'arcade_setLegacyTile':this.requiresLegacyTilemapPackage=true;push(`scene.setTile(${v('INDEX')}, ${v('IMAGE')}, ${this.condition(b,'WALL')})`);return;
        case 'arcade_setLegacyTileAt':this.requiresLegacyTilemapPackage=true;push(`scene.setTileAt(${v('TILE')}, ${v('INDEX')})`);return;
        case 'arcade_placeOnLegacyTile':this.requiresLegacyTilemapPackage=true;push(`scene.place(${v('TILE')}, ${v('ID')})`);return;
        case 'arcade_placeOnRandomLegacyTile':this.requiresLegacyTilemapPackage=true;push(`scene.placeOnRandomTile(${v('ID')}, ${v('INDEX')})`);return;
        case 'arcade_setTilemap': {
            // A variable (or list) primitive is a TileMapData value, not literal map text.
            if(!Array.isArray(b.inputs?.DATA?.[1]) || [12,13].includes(b.inputs.DATA[1][0])){push(`tiles.setTilemap(${v('DATA')})`);return;}
            const raw=this.literalInput(b,'DATA');let data=null;
            if(raw==='null' || raw===''){push('tiles.setTilemap(null)');return;}
            try{data=JSON.parse(raw);}catch(e){/* named below */}
            const source=tilemapSource(data, (image, index) => this.tileAssets.register(image, index));
            if(!source){this.note('Arcade tile map export requires valid fixed tile data, wall layer and scale');return;}
            push(`tiles.setTilemap(${source})`);return;
        }
        case 'arcade_setTilemapTile': push(`${v('DATA')}.setTile(${v('COLUMN')}, ${v('ROW')}, ${v('INDEX')})`);return;
        case 'arcade_setTilemapWall': push(`${v('DATA')}.setWall(${v('COLUMN')}, ${v('ROW')}, ${this.condition(b,'WALL')})`);return;
        case 'arcade_setTilemapScale': push(`${v('DATA')}.scale = ${v('VALUE')}`);return;
        case 'arcade_registerTilemapEvent': {
            const token=this.literalInput(b,'TOKEN'),event=this.field(b,'EVENT');
            const callback=token && this.registeredCallback(token);
            if(!callback || callback.kind!=='tilemapEvent' || !['Loaded','Unloaded'].includes(event))push(`// ${this.note('Arcade tilemap event registration has no matching callback')}`);
            else if(this.tilemapListenerUse(token).named) {
                const name=this.tilemapListenerFunction(token,callback);
                if(name){this.usedRegisteredCallbacks.add(token);push(`tiles.addEventListener(tiles.TileMapEvent.${event}, ${name})`);}
                else push(`// ${this.note('A removable tilemap listener must not capture locals; it exports as a named function')}`);
            } else {
                this.usedRegisteredCallbacks.add(token);
                push(`tiles.addEventListener(tiles.TileMapEvent.${event}, function (${callback.parameter}: tiles.TileMapData) {\n${callback.script.join('\n')}\n})`);
            }return;
        }
        case 'arcade_unregisterTilemapEvent': {
            const token=this.literalInput(b,'TOKEN'),event=this.field(b,'EVENT');
            if(!token || !['Loaded','Unloaded'].includes(event)){push(`// ${this.note('tiles.removeEventListener requires a fixed event and handler')}`);return;}
            const callback=this.registeredCallback(token);
            // No handler script: nothing can have registered this token, so PXT removes nothing.
            if(!callback || callback.kind!=='tilemapEvent'){push('// tiles.removeEventListener: no listener is registered under this handler');return;}
            const name=this.tilemapListenerFunction(token,callback);
            if(name){this.usedRegisteredCallbacks.add(token);push(`tiles.removeEventListener(tiles.TileMapEvent.${event}, ${name})`);}
            else push(`// ${this.note('A removable tilemap listener must not capture locals; it exports as a named function')}`);
            return;
        }
        case 'arcade_setTileAt': push(`tiles.setTileAt(${v('LOCATION')}, ${v('IMAGE')})`);return;
        case 'arcade_setWallAt': push(`tiles.setWallAt(${v('LOCATION')}, ${this.condition(b,'WALL')})`);return;
        case 'arcade_placeOnTile': push(`tiles.placeOnTile(${v('ID')}, ${v('LOCATION')})`);return;
        case 'arcade_placeOnRandomTile': push(`tiles.placeOnRandomTile(${v('ID')}, ${v('IMAGE')})`);return;
        case 'arcade_setscore':push(`info.setScore(${v('N')})`);return;
        case 'arcade_changescore':push(`info.changeScoreBy(${v('N')})`);return;
        case 'arcade_declareCallable':
        case 'arcade_declareSourceCallable':
            if(!this.callableExports?.has(this.target))this.note('Callable declaration requires qualified current lexical graph export');
            return;
        case 'arcade_declareClass':case 'arcade_declareSubclass':return;
        case 'arcade_declareSourceScalar':case 'arcade_declareSourceReference':return;
        case 'arcade_setObjectField':{
            if(this.objectClassExport.inputTypes(this.target,b,'OBJECT').has('__bwSDK_Font'))this.note('SDK Font field mutation is not qualified by the read slice');
        }if(this.currentClassConstructor&&this.objectClassExport?.parameterPropertyBlocks.has(b))return;{
            const statement=`;${this.objectClassExport.receiver(b,true)}.${this.objectFieldName(b)} = ${this.arrayValue(b,'VALUE')}`;
            // Class bodies subsequently rewrite their lexical receiver to this.
            // They keep their existing validator; do not join pre-rewrite text.
            if(!this.currentClassName)this.createdFieldWriteSites.push({target:this.target,block:b,statement});
            push(statement);return;
        }
        case 'data_showvariable':
        case 'data_hidevariable': {
            const [name, id] = b.fields?.VARIABLE || [];
            const monitor = this.variableMonitor(id, name);
            if (monitor) push(`${monitor.flag} = ${b.opcode === 'data_showvariable'}`);
            else push('// ' + this.note(b.opcode + ': variable monitor has no unambiguous saved owner'));
            return;
        }
        case 'data_setvariableto': {
            const scratchName = this.field(b, 'VARIABLE');
            const info = this.infoVariable(scratchName);
            if (info) {
                push(`info.set${info === 'score' ? 'Score' : 'Life'}(${v('VALUE')})`);
                return;
            }
            const name = this.lookupVar(this.field(b, 'VARIABLE'));
            const valueBlock = this.block(typeof b.inputs?.VALUE?.[1] === 'string' ? b.inputs.VALUE[1] : null);
            const scratchAnswer = valueBlock?.opcode === 'sensing_answer';
            if (!this.arcadeValues) {
                const val = v('VALUE');
                this.assign(name, val, scratchAnswer ? 'string' : null);
                push(`${name} = ${val}`);
                return;
            }
            // An Arcade program's variable is declared with the type of what
            // flows into it (sprite handle, image, array, Boolean, ...).
            this.spawnAssignment = ['arcade_spawnSprite', 'arcade_spawnProjectile', 'arcade_spawnImageProjectile', 'arcade_spawnImageSprite', 'arcade_createSprite', 'arcade_createImageSprite'].includes(valueBlock?.opcode);
            const boolean = this.isBoolean(valueBlock) || this.booleanVariable(b.fields?.VARIABLE?.[1] || b.fields?.VARIABLE?.[0]);
            const val = this.arrayValue(b,'VALUE');
            this.spawnAssignment = false;
            if(this.mixedValueVariableIds.has(b.fields?.VARIABLE?.[1] || b.fields?.VARIABLE?.[0]))this.assign(name,val,'any');
            else if ((valueBlock && ['arcade_spawnSprite', 'arcade_spawnProjectile', 'arcade_spawnImageProjectile', 'arcade_spawnImageSprite', 'arcade_eventSprite', 'arcade_createSprite', 'arcade_createImageSprite'].includes(valueBlock.opcode)) ||
                this.handleVars.has(val) || this.spriteVariableIds.has(b.fields?.VARIABLE?.[1] || b.fields?.VARIABLE?.[0])) {
                this.handleVars.add(name);
            } else {
                const arrayType=this.arrayVariableTypes.get(b.fields?.VARIABLE?.[1] || b.fields?.VARIABLE?.[0]);
                const image = ['arcade_spriteImage', 'arcade_frameImage', 'arcade_backgroundImage', 'arcade_createImage', 'arcade_cloneImage', 'arcade_tileAtLocation', 'arcade_tilemapTileImage'].includes(valueBlock?.opcode) || this.imageVars.has(val) ||
                    this.imageVariableIds.has(b.fields?.VARIABLE?.[1] || b.fields?.VARIABLE?.[0]) ||
                    (valueBlock?.opcode === 'arcade_callFunction' && this.imageReturnFunctions.has(`${this.target.isStage?'':this.target.name}:${this.literalInput(valueBlock,'NAME')}`));
                if (image) this.imageVars.add(name);
                this.assign(name, val, arrayType || (image ? 'image' : scratchAnswer ? 'string' : boolean ? 'boolean' : this.primitiveVariableTypes.get(b.fields?.VARIABLE?.[1] || b.fields?.VARIABLE?.[0]) || null));
            }
            push(`${name} = ${val}`);
            if (['arcade_spawnSprite', 'arcade_spawnImageSprite'].includes(valueBlock?.opcode)) {
                push(`${name}.setPosition(${this.value(valueBlock, 'X')}, ${this.value(valueBlock, 'Y')})`);
            }
            return;
        }
        case 'data_changevariableby': {
            const scratchName = this.field(b, 'VARIABLE');
            const info = this.infoVariable(scratchName);
            if (info) push(`info.change${info === 'score' ? 'Score' : 'Life'}By(${v('VALUE')})`);
            else push(`${this.lookupVar(scratchName)} += ${v('VALUE')}`);
            return;
        }
        case 'sensing_askandwait':
            push(this.scratchTextAnswer() + ' = game.askForString("" + (' + v('QUESTION') + '))');
            this.guardLine().forEach(push);
            return;
        case 'sensing_resettimer':push(`${this.use('scratchTimer','__bwResetScratchTimer')}()`);return;
        case 'control_wait':
            push(`pause(${v('DURATION')} * 1000)`);
            this.guardLine().forEach(push);
            return;
        case 'control_if':
            push(`if (${this.condition(b, 'CONDITION')}) {`);
            this.substack(b, 'SUBSTACK', depth + 1, out);
            push('}');
            return;
        case 'control_if_else':
            push(`if (${this.condition(b, 'CONDITION')}) {`);
            this.substack(b, 'SUBSTACK', depth + 1, out);
            push('} else {');
            this.substack(b, 'SUBSTACK2', depth + 1, out);
            push('}');
            return;
        case 'control_repeat':
            push(`for (let i${depth} = 0; i${depth} < ${v('TIMES')}; i${depth}++) {`);
            this.substack(b, 'SUBSTACK', depth + 1, out);
            this.guardLine().forEach(line => push(`    ${line}`));
            push('}');
            return;
        case 'arcade_sourceWhile':
            push(`while (${this.condition(b, 'CONDITION')}) {`);
            this.substack(b, 'SUBSTACK', depth + 1, out);
            this.guardLine().forEach(line => push(`    ${line}`));
            push('}');
            return;
        case 'control_repeat_until':
            push(`while (!${this.condition(b, 'CONDITION')}) {`);
            this.substack(b, 'SUBSTACK', depth + 1, out);
            if(this.implicitLoopYield)push('    pause(20)');
            this.guardLine().forEach(line => push(`    ${line}`));
            push('}');
            return;
        case 'control_wait_until':
            push(`pauseUntil(() => ${this.condition(b, 'CONDITION')})`);
            this.guardLine().forEach(push);
            return;
        case 'control_forever':
            // One frame per pass (Scratch redraws once per loop iteration too).
            push('while (true) {');
            this.substack(b, 'SUBSTACK', depth + 1, out);
            if(this.implicitLoopYield)push('    pause(20)');
            this.guardLine().forEach(line => push(`    ${line}`));
            push('}');
            return;
        case 'control_stop': this.stop(b, push); return;
        // A sprite that draws moves through _penTo, which draws the line it moved along.
        case 'motion_movesteps': {
            if (!me) return;
            const step = v('STEPS');
            const amount = this.reserveAuxiliarySymbol('__bwMove');
            const angle = this.use('scratchPose', '_scratchDirection(' + me + ') * Math.PI / 180');
            const x = me + '.x + Math.sin(' + angle + ') * ' + amount + ' / 3';
            const y = me + '.y - Math.cos(' + angle + ') * ' + amount + ' / 3';
            push('{');
            push('    const ' + amount + ' = ' + step);
            push('    ' + (pen ? this.use('pen', '_penTo(' + me + ', ' + x + ', ' + y + ')') :
                me + '.setPosition(' + x + ', ' + y + ')'));
            push('}');
            return;
        }
        case 'motion_turnleft':
        case 'motion_turnright':
        case 'motion_pointindirection':
        case 'motion_pointtowards': {
            if (!me) return;
            const destination = b.opcode === 'motion_pointtowards' ? this.menuField(b, 'TOWARDS', 'TOWARDS') : '';
            const other = this.spriteVar.get(destination);
            const pointer = destination === '_mouse_' ? this.browserPointer() : null;
            let direction;
            if (b.opcode === 'motion_pointindirection') direction = v('DIRECTION');
            else if (b.opcode === 'motion_turnright' || b.opcode === 'motion_turnleft') {
                direction = '_scratchDirection(' + me + ')' + (b.opcode === 'motion_turnright' ? ' + ' : ' - ') +
                    '(' + v('DEGREES') + ')';
            } else if (other || pointer) {
                const x = other ? other + '.x' : pointer.x;
                const y = other ? other + '.y' : pointer.y;
                direction = 'Math.atan2(' + x + ' - ' + me + '.x, ' + me + '.y - ' + y + ') * 180 / Math.PI';
            } else if (destination === '_random_') direction = 'randint(-179, 180)';
            else {
                const reason = destination === '_mouse_' ? 'point towards mouse-pointer: ' + MOUSE_WHY :
                    'point towards ' + (destination || 'an unsupported target');
                push('// ' + this.note(reason));
                return;
            }
            push(this.use('scratchPose', '_scratchPoint(' + me + ', ' + direction + ')'));
            return;
        }
        case 'motion_setrotationstyle': {
            const style = this.field(b, 'STYLE');
            if (me) push(this.use('scratchPose', '_scratchRotationStyle(' + me + ', ' + JSON.stringify(style) + ')'));
            return;
        }
        case 'looks_setsizeto':
        case 'looks_changesizeby': {
            if (!me) return;
            const scale = b.opcode === 'looks_setsizeto' ? v('SIZE') + ' / 100' :
                me + '.scale + (' + v('CHANGE') + ' / 100)';
            push(me + '.setScale(Math.max(0.01, ' + scale + '))');
            return;
        }
        case 'motion_changexby':
            if (me && pen) push(this.use('pen', `_penTo(${me}, ${me}.x + ${v('DX')} / 3, ${me}.y)`));
            else if (me) push(`${me}.x += ${v('DX')} / 3`);
            return;
        case 'motion_changeyby':
            if (me && pen) push(this.use('pen', `_penTo(${me}, ${me}.x, ${me}.y - ${v('DY')} / 3)`));
            else if (me) push(`${me}.y -= ${v('DY')} / 3`);
            return;
        case 'motion_setx':
            if (me && pen) push(this.use('pen', `_penTo(${me}, ${v('X')} / 3 + 80, ${me}.y)`));
            else if (me) push(`${me}.x = ${v('X')} / 3 + 80`);
            return;
        case 'motion_sety':
            if (me && pen) push(this.use('pen', `_penTo(${me}, ${me}.x, 60 - ${v('Y')} / 3)`));
            else if (me) push(`${me}.y = 60 - ${v('Y')} / 3`);
            return;
        case 'motion_gotoxy':
            if (me) push(`${pen ? this.use('pen', `_penTo(${me}, `) : `${me}.setPosition(`}${v('X')} / 3 + 80, 60 - ${v('Y')} / 3)`);
            return;
        case 'motion_goto': {
            const to = this.menuField(b, 'TO', 'TO');
            const other = this.spriteVar.get(to);
            const place = pen ? this.use('pen', `_penTo(${me}, `) : `${me}.setPosition(`;
            if (me && other) push(`${place}${other}.x, ${other}.y)`);
            else if (me && to === '_random_') push(`${place}randint(0, 160), randint(0, 120))`);
            else if (to === '_mouse_') {
                const pointer = this.browserPointer();
                if (me && pointer) push(place + pointer.x + ', ' + pointer.y + ')');
                else push('// ' + this.note('go to mouse-pointer: ' + MOUSE_WHY));
            }
            else push(`// ${this.note(`go to ${to || '…'}`)}`);
            return;
        }
        case 'motion_glidesecstoxy':
        case 'motion_glideto': {
            if (!me) return;
            const destination = b.opcode === 'motion_glideto' ? this.menuField(b, 'TO', 'TO') : '';
            const other = this.spriteVar.get(destination);
            const pointer = destination === '_mouse_' ? this.browserPointer() : null;
            let endX, endY;
            if (b.opcode === 'motion_glidesecstoxy') {
                endX = v('X') + ' / 3 + 80';
                endY = '60 - ' + v('Y') + ' / 3';
            } else if (other || pointer) {
                endX = other ? other + '.x' : pointer.x;
                endY = other ? other + '.y' : pointer.y;
            } else if (destination === '_random_') {
                endX = 'randint(0, 160)';
                endY = 'randint(0, 120)';
            } else {
                const reason = destination === '_mouse_' ? 'glide to mouse-pointer: ' + MOUSE_WHY :
                    'glide to ' + (destination || 'an unsupported target');
                push('// ' + this.note(reason));
                return;
            }
            const local = this.reserveAuxiliarySymbol('__bwGlide');
            const place = (x, y) => pen ? this.use('pen', '_penTo(' + me + ', ' + x + ', ' + y + ')') :
                me + '.setPosition(' + x + ', ' + y + ')';
            push('{');
            push(`    const ${local}Duration = Math.max(0, (${v('SECS')}) * 1000)`);
            push(`    const ${local}Time = control.millis()`);
            push(`    const ${local}StartX = ${me}.x; const ${local}StartY = ${me}.y`);
            push(`    const ${local}EndX = ${endX}; const ${local}EndY = ${endY}`);
            push(`    while (${local}Duration > 0) {`);
            push(`        const ${local}Progress = (control.millis() - ${local}Time) / ${local}Duration`);
            push(`        if (${local}Progress >= 1) break`);
            push('        ' + place(
                `${local}StartX + (${local}EndX - ${local}StartX) * ${local}Progress`,
                `${local}StartY + (${local}EndY - ${local}StartY) * ${local}Progress`
            ));
            push('        pause(20)');
            this.guardLine().forEach(guard => push('        ' + guard));
            push('    }');
            push('    ' + place(`${local}EndX`, `${local}EndY`));
            push('}');
            return;
        }
        case 'motion_ifonedgebounce': if (me) push(`${me}.setBounceOnWall(true)`); return;
        case 'looks_show': if (me) push(`${me}.setFlag(SpriteFlag.Invisible, false)`); return;
        case 'looks_hide': if (me) push(`${me}.setFlag(SpriteFlag.Invisible, true)`); return;
        case 'looks_thinkforsecs':
        case 'looks_think':
        case 'looks_sayforsecs':
        case 'looks_say': {
            const timed = b.opcode.endsWith('forsecs');
            if (b.opcode.startsWith('looks_think')) this.warn('Scratch thoughts use Arcade text bubbles');
            if (this.target.isStage) this.usesStageSpeech = true;
            const speaker = this.target.isStage ? '_bwStageSpeech' : me;
            if (speaker) {
                const duration = timed ? `, ${v('SECS')} * 1000, true` : '';
                push(`${speaker}.sayText(${v('MESSAGE', '""')}${duration})`);
                if (timed && this.target.isStage) push(`pause(${v('SECS')} * 1000)`);
            }
            return;
        }
        case 'arcade_setBackgroundImage': push(`scene.setBackgroundImage(${this.literalInput(b,'IMAGE') === '' ? 'null' : v('IMAGE')})`); return;
        case 'arcade_setGameStats': {
            const mode=this.field(b,'MODE');
            if(Object.hasOwn(b.inputs||{},'MODE')||!['enabled','disabled'].includes(mode)){push(`// ${this.note('Game stats export requires a fixed enabled or disabled mode')}`);return;}
            push(`game.stats = ${mode==='enabled'?'true':'false'}`);return;
        }
        case 'arcade_setPalette': push(`image.setPalette(Buffer.fromHex(${v('DATA', '""')}))`); return;
        case 'arcade_setBackgroundColor': push(`scene.setBackgroundColor(${v('COLOR')})`); return;
        case 'arcade_controlSprite': push(`controller.moveSprite(${v('ID')}, ${v('VX')}, ${v('VY')})`); return;
        case 'arcade_controlSpriteByController':
        case 'arcade_stopControllingSprite': {
            const number=b.fields?.CONTROLLER?.[0];
            if (!['1','2','3','4'].includes(String(number))) {push(`// ${this.note('Arcade controller must be 1, 2, 3 or 4')}`);return;}
            const receiver=`controller.player${number}`;
            push(b.opcode==='arcade_stopControllingSprite'?`${receiver}.stopControllingSprite(${v('ID')})`:`${receiver}.moveSprite(${v('ID')}, ${v('VX')}, ${v('VY')})`);return;
        }
        case 'arcade_destroySprite': push(`${v('ID')}.destroy()`); return;
        case 'arcade_destroySpriteWithEffect': case 'arcade_startSpriteEffect': {
            // A zero or omitted duration selects the effect's own default in PXT.
            const effect = this.particleEffect(b, false), duration = this.arrayValue(b, 'DURATION');
            if (!effect) { push(`// ${this.note(`Unsupported Arcade particle effect ${this.field(b, 'EFFECT')}`)}`); return; }
            const method = b.opcode === 'arcade_destroySpriteWithEffect' ? 'destroy' : 'startEffect';
            push(`${v('ID')}.${method}(effects.${effect}${duration === '0' ? '' : `, ${duration}`})`);
            return;
        }
        case 'arcade_startScreenEffect': case 'arcade_endScreenEffect': {
            const effect = this.particleEffect(b, true);
            if (!effect) { push(`// ${this.note(`Unsupported Arcade screen effect ${this.field(b, 'EFFECT')}`)}`); return; }
            if (b.opcode === 'arcade_endScreenEffect') { push(`effects.${effect}.endScreenEffect()`); return; }
            const duration = this.arrayValue(b, 'DURATION');
            push(`effects.${effect}.startScreenEffect(${duration === '0' ? '' : duration})`);
            return;
        }
        case 'arcade_clearSpriteEffects': push(`effects.clearParticles(${v('ID')})`); return;
        case 'arcade_resetGame': push('game.reset()'); return;
        case 'arcade_gameOver': push(`game.gameOver(${this.boolValue(b, 'WIN')})`); return;
        case 'arcade_carnivalCustomGameOver': {
            const effect=this.field(b,'EFFECT'),scoring=this.field(b,'SCORING');
            if(!['unset','confetti','hearts','smiles','blizzard','bubbles','starField','clouds','none','dissolve','melt','slash','splatter'].includes(effect) ||
                !['unset','None','HScore','LScore','HTime','LTime'].includes(scoring)) {
                push(`// ${this.note('Carnival custom game-over needs a supported effect and scoring type')}`);return;
            }
            this.requiresCarnivalPackage=true;
            // Flags describe presence, not score truthiness. Export branches
            // for editable flag expressions so ordinary MakeCode conditionals
            // preserve absence and import back through existing control blocks.
            const option = (field, emit) => {
                const flag=this.boolValue(b,field);
                if(flag==='true' || flag==='false')emit(flag==='true');
                else {push(`if (${flag}) {`);emit(true);push('} else {');emit(false);push('}');}
            };
            option('HAS_SOUND', hasSound => option('HAS_SCORE', hasScore => {
                push(`carnival.customGameOverExpanded(${v('MESSAGE')}, ${effect==='unset'?'undefined':`effects.${effect}`}, ${hasSound?v('SOUND'):'undefined'}, ${scoring==='unset'?'undefined':`carnival.ScoreTypes.${scoring}`}, ${hasScore?v('SCORE'):'undefined'})`);
            }));return;
        }
        case 'arcade_carnivalAddLabel': {
            const area=this.field(b,'AREA');
            if(!['Top','Mid','Bottom'].includes(area)){push(`// ${this.note('Carnival label needs a Top, Mid or Bottom location')}`);return;}
            this.requiresCarnivalPackage=true;
            // The colour is optional in MakeCode: the flag says whether it was written.
            const flag=this.boolValue(b,'HAS_COLOR'),call=color=>`carnival.addLabelTo(${v('LABEL')}, carnival.Areas.${area}${color?`, ${v('COLOR')}`:''})`;
            if(flag==='true'||flag==='false')push(call(flag==='true'));
            else {push(`if (${flag}) {`);push(call(true));push('} else {');push(call(false));push('}');}
            return;
        }
        case 'arcade_carnivalCountdown':
        case 'arcade_carnivalGameOver': {
            this.requiresCarnivalPackage=true;
            const style=this.field(b,'STYLE'),effect=this.field(b,'EFFECT');
            if(!['Win','Lose','Score','Timed','Multi','Custom'].includes(style) ||
                !['unset','confetti','hearts','smiles','blizzard','bubbles','starField','clouds','none','dissolve','melt','slash','splatter'].includes(effect)) {
                push(this.note('Carnival command has an unsupported style or effect'));return;
            }
            const args=[`carnival.WinTypes.${style}`];
            if(effect!=='unset')args.push(`effects.${effect}`);
            if(b.opcode==='arcade_carnivalCountdown')args.unshift(v('SECONDS'));
            push(`carnival.${b.opcode==='arcade_carnivalCountdown'?'startCountdownGame':'onGameOverExpanded'}(${args.join(', ')})`);return;
        }
        case 'arcade_legacyGameOver': {
            const effect = this.field(b, 'EFFECT');
            if (effect !== 'unset' && !BACKGROUND_EFFECTS.includes(effect)) { push(`// ${this.note(`Unsupported Arcade effect ${effect}`)}`); return; }
            push(`game.over(${this.boolValue(b, 'WIN')}${effect === 'unset' ? '' : `, effects.${effect}`})`);
            return;
        }
        case 'arcade_setGameOverEffect': {
            const effect = this.field(b, 'EFFECT');
            if (!BACKGROUND_EFFECTS.includes(effect)) { push(`// ${this.note(`Unsupported Arcade effect ${effect}`)}`); return; }
            push(`game.setGameOverEffect(${this.boolValue(b, 'WIN')}, effects.${effect})`);
            return;
        }
        case 'arcade_setGameOverMessage': push(`game.setGameOverMessage(${this.boolValue(b, 'WIN')}, ${v('MESSAGE')})`); return;
        case 'arcade_setGameOverPlayable':
            push(`game.setGameOverPlayable(${this.boolValue(b, 'WIN')}, ${v('PLAYABLE')}, ${this.boolValue(b, 'LOOPING')})`);
            return;
        case 'arcade_setGameOverScoringType': {
            const type = this.field(b, 'TYPE');
            if (!['HighScore', 'LowScore', 'None'].includes(type)) { push(`// ${this.note(`Unsupported Arcade scoring ${type}`)}`); return; }
            push(`game.setGameOverScoringType(game.ScoringType.${type})`);
            return;
        }
        case 'arcade_startImageEffect': {
            const effect = this.field(b, 'EFFECT');
            if (!['dissolve', 'melt', 'slash', 'splatter'].includes(effect)) { push(`// ${this.note(`Unsupported Arcade image effect ${effect}`)}`); return; }
            const times = this.arrayValue(b, 'TIMES'), delay = this.arrayValue(b, 'DELAY');
            const args = delay !== '0' ? [times, delay] : times !== '0' ? [times] : [];
            push(`effects.${effect}.startScreenEffect(${args.join(', ')})`);
            return;
        }
        case 'arcade_play': case 'arcade_playMusic': case 'arcade_playSoundEffect': {
            const music = b.opcode !== 'arcade_playSoundEffect';
            const mode = this.musicField(b, 'MODE', music ? 'music.PlaybackMode' : 'SoundExpressionPlayMode');
            if (!mode) { push(`// ${this.note(`Unsupported Arcade play mode ${this.field(b, 'MODE')}`)}`); return; }
            push(music ? `music.play(${v('PLAYABLE')}, ${mode})` : `music.playSoundEffect(${v('EFFECT')}, ${mode})`);
            return;
        }
        case 'arcade_playMelody': {
            const mode = this.field(b, 'MODE');
            if (!['play', 'playUntilDone', 'loop'].includes(mode)) { push(`// ${this.note(`Unsupported Arcade melody mode ${mode}`)}`); return; }
            push(`${v('MELODY')}.${mode}()`);
            return;
        }
        case 'arcade_playNoteMelody': push(`music.playMelody(${v('NOTES')}, ${v('TEMPO')})`); return;
        case 'arcade_playSound': {
            // The bool slot holds a constant comparison when the source had a literal.
            const untilDone = this.literalNumber(b, 'UNTIL_DONE'), condition = this.condition(b, 'UNTIL_DONE');
            const call = untilDone !== null ? (untilDone ? 'playSoundUntilDone' : 'playSound') :
                condition === 'true' ? 'playSoundUntilDone' : condition === 'false' ? 'playSound' : null;
            if (call) push(`music.${call}(${v('SOUND')})`);
            else push(`if (${condition}) music.playSoundUntilDone(${v('SOUND')}); else music.playSound(${v('SOUND')})`);
            return;
        }
        case 'arcade_playTone': push(`music.playTone(${v('FREQUENCY')}, ${v('DURATION')})`); return;
        case 'arcade_ringTone': push(`music.ringTone(${v('FREQUENCY')})`); return;
        case 'arcade_rest': push(`music.rest(${v('DURATION')})`); return;
        case 'arcade_setMusicVolume': push(`music.setVolume(${v('VOLUME')})`); return;
        case 'arcade_setTempo': push(`music.setTempo(${v('TEMPO')})`); return;
        case 'arcade_changeTempo': push(`music.changeTempoBy(${v('TEMPO')})`); return;
        case 'arcade_stopAllSounds': push('music.stopAllSounds()'); return;
        case 'arcade_setBackgroundScrollVersion':this.requiresScrollerPackage=true;return;
        case 'arcade_scrollBackgroundWithCamera': {
            const mode = this.field(b, 'MODE');
            if (!['OnlyHorizontal', 'OnlyVertical', 'BothDirections'].includes(mode)) { push(`// ${this.note(`Unsupported camera scroll mode ${mode}`)}`); return; }
            this.requiresScrollerPackage = true;
            push(`scroller.scrollBackgroundWithCamera(scroller.CameraScrollMode.${mode}${this.scrollerLayerSuffix(b)})`); return;
        }
        case 'arcade_scrollBackgroundWithSpeed': this.requiresScrollerPackage = true; push(`scroller.scrollBackgroundWithSpeed(${v('VX')}, ${v('VY')}${this.scrollerLayerSuffix(b)})`); return;
        case 'arcade_setBackgroundScrollMultipliers': this.requiresScrollerPackage = true; push(`scroller.setCameraScrollingMultipliers(${v('X')}, ${v('Y')}${this.scrollerLayerSuffix(b)})`); return;
        case 'arcade_setBackgroundScrollOffset': this.requiresScrollerPackage = true; push(`scroller.setBackgroundScrollOffset(${v('X')}, ${v('Y')}${this.scrollerLayerSuffix(b)})`); return;
        case 'arcade_setBackgroundLayerImage': if(this.scrollerVersion===LEGACY_SCROLLER_REVISION){push(`// ${this.note('Legacy Arcade background scroll does not support layer images')}`);return;} this.requiresScrollerPackage = true; push(`scroller.setLayerImage(${v('LAYER')}, ${v('IMAGE')})`); return;
        case 'arcade_characterFrames': {
            const mode = this.field(b, 'MODE');
            if (!['loop', 'run'].includes(mode)) { push(`// ${this.note(`Unsupported character frames mode ${mode}`)}`); return; }
            this.requiresCharacterAnimationsPackage = true;
            push(`characterAnimations.${mode}Frames(${v('SPRITE')}, ${v('FRAMES')}, ${v('INTERVAL')}, ${v('RULE')})`); return;
        }
        case 'arcade_setCharacterAnimationsEnabled': this.requiresCharacterAnimationsPackage = true; push(`characterAnimations.setCharacterAnimationsEnabled(${v('SPRITE')}, ${this.boolValue(b, 'ENABLED')})`); return;
        case 'arcade_setCharacterState': this.requiresCharacterAnimationsPackage = true; push(`characterAnimations.setCharacterState(${v('SPRITE')}, ${v('RULE')})`); return;
        case 'arcade_clearCharacterState': this.requiresCharacterAnimationsPackage = true; push(`characterAnimations.clearCharacterState(${v('SPRITE')})`); return;
        case 'arcade_setCharacterAnimationVersion':this.requiresCharacterAnimationsPackage=true;return;
        case 'arcade_setCharacterController': if(this.characterVersion===LEGACY_CHARACTER_REVISION){push(`// ${this.note('Legacy character animations do not implement arcade_setCharacterController')}`);return;} this.requiresCharacterAnimationsPackage = true; push(`characterAnimations.setController(${v('SPRITE')}, ${this.boolValue(b, 'ENABLED')})`); return;
        case 'arcade_lockCharacterFacing': { if(this.characterVersion===LEGACY_CHARACTER_REVISION){push(`// ${this.note('Legacy character animations do not implement arcade_lockCharacterFacing')}`);return;}
            const direction = this.field(b, 'DIRECTION');
            if (!['Up', 'Right', 'Down', 'Left'].includes(direction)) { push(`// ${this.note(`Unsupported character facing ${direction}`)}`); return; }
            this.requiresCharacterAnimationsPackage = true;
            push(`characterAnimations.lockFacingDirection(${v('SPRITE')}, characterAnimations.FacingDirection.${direction})`); return;
        }
        case 'arcade_unlockCharacterFacing': if(this.characterVersion===LEGACY_CHARACTER_REVISION){push(`// ${this.note('Legacy character animations do not implement arcade_unlockCharacterFacing')}`);return;} this.requiresCharacterAnimationsPackage = true; push(`characterAnimations.unlockFacingDirection(${v('SPRITE')})`); return;
        case 'arcade_setBackgroundLayerZ': if(this.scrollerVersion===LEGACY_SCROLLER_REVISION){push(`// ${this.note('Legacy Arcade background scroll does not support layer z-index')}`);return;} this.requiresScrollerPackage = true; push(`scroller.setLayerZIndex(${v('LAYER')}, ${v('Z')})`); return;
        case 'arcade_textSpriteSetText': case 'arcade_textSpriteSetMaxFontHeight': case 'arcade_textSpriteSetIcon':
        case 'arcade_textSpriteSetBorder': case 'arcade_textSpriteSetOutline': case 'arcade_textSpriteUpdate': {
            this.requiresTextSpritePackage=true;
            const [method,args]={arcade_textSpriteSetText:['setText',['TEXT']],arcade_textSpriteSetMaxFontHeight:['setMaxFontHeight',['HEIGHT']],
                arcade_textSpriteSetIcon:['setIcon',['IMAGE']],arcade_textSpriteSetBorder:['setBorder',['WIDTH','COLOR','PADDING']],
                arcade_textSpriteSetOutline:['setOutline',['WIDTH','COLOR']],arcade_textSpriteUpdate:['update',[]]}[b.opcode];
            push(`${v('ID')}.${method}(${args.map(name=>v(name)).join(', ')})`);return;
        }
        case 'arcade_textSpriteSetProperty': {
            this.requiresTextSpritePackage=true;
            const property=directMenuValue(b,'PROPERTY',this.blocks);
            if(!['text','bg','fg','maxFontHeight','borderWidth','borderColor','padding','outlineWidth','outlineColor','icon'].includes(property)){push(`// ${this.note(`Unsupported TextSprite property ${property}`)}`);return;}
            push(`${v('ID')}.${property} = ${v('VALUE')}`);return;
        }
        case 'arcade_dartAction': {
            const action = this.field(b, 'ACTION');
            if (!['throwDart', 'stopDart'].includes(action)) { push(`// ${this.note(`Unsupported dart action ${action}`)}`); return; }
            push(`${v('SPRITE')}.${action}()`); return;
        }
        case 'arcade_dartSwitch': case 'arcade_corgiControl': {
            const method = this.field(b, b.opcode === 'arcade_dartSwitch' ? 'SETTING' : 'MODE');
            const methods = b.opcode === 'arcade_dartSwitch' ? ['setTrace', 'controlWithArrowKeys'] : ['horizontalMovement', 'verticalMovement', 'updateSprite', 'cameraFollow'];
            if (!methods.includes(method)) { push(`// ${this.note(`Unsupported extension call ${method}`)}`); return; }
            push(`${v('SPRITE')}.${method}(${this.boolValue(b, 'ON')})`); return;
        }
        case 'arcade_corgiBark': push(`${v('SPRITE')}.bark()`); return;
        case 'arcade_corgiAddPhrase': push(`${v('SPRITE')}.addToScript(${v('TEXT')})`); return;
        case 'arcade_setDartProperty': case 'arcade_setCorgiProperty': {
            const property = this.field(b, 'PROPERTY');
            const fields = b.opcode === 'arcade_setDartProperty' ? ['angle', 'pow', 'iter', 'traceColor', 'gravity', 'wind', 'angleRate', 'powerRate'] :
                ['maxMoveVelocity', 'gravity', 'jumpVelocity', 'maxJump', 'decelerationRate'];
            if (!fields.includes(property)) { push(`// ${this.note(`Unsupported extension property ${property}`)}`); return; }
            push(`${v('SPRITE')}.${property} = ${v('VALUE')}`); return;
        }
        case 'arcade_sevensegSetCharacter': case 'arcade_sevensegSetRadix': case 'arcade_sevensegSetScale': {
            const [field, enumeration, method] = {arcade_sevensegSetCharacter: ['CHARACTER', 'SegmentCharacter', 'setDigitAlpha'],
                arcade_sevensegSetRadix: ['RADIX', 'DigitRadix', 'setRadix'], arcade_sevensegSetScale: ['SCALE', 'SegmentScale', 'setScale']}[b.opcode];
            const member = this.musicField(b, field, enumeration);
            if (!member) { push(`// ${this.note(`Unsupported seven segment ${field.toLowerCase()} ${this.field(b, field)}`)}`); return; }
            push(`${v('DISPLAY')}.${method}(${member})`); return;
        }
        case 'arcade_sevensegSetColor': push(`${v('DISPLAY')}.setDigitColor(${v('COLOR')})`); return;
        case 'arcade_sevensegAddDigit': push(`${v('DISPLAY')}.addDigit()`); return;
        case 'arcade_sevensegSetProperty': {
            const property = this.field(b, 'PROPERTY');
            if (!['x', 'y', 'value', 'count'].includes(property)) { push(`// ${this.note(`Unsupported seven segment property ${property}`)}`); return; }
            push(`${v('DISPLAY')}.${property} = ${v('VALUE')}`); return;
        }
        case 'arcade_printImageFont':
        case 'arcade_printImageFontCenter': {
            this.sdkFontOperand(b);this.sdkFontPrimitiveOperand(b,'TEXT','string');
            if(!this.sdkFontInputs.accepts(this.target,b,'IMAGE','Image'))this.note('SDK Font printing requires a proven Image operand');
            for(const input of b.opcode==='arcade_printImageFont'?['X','Y','COLOR']:['Y','COLOR'])this.sdkFontPrimitiveOperand(b,input,'number');
            const args=[this.arrayValue(b,'TEXT')];if(b.opcode==='arcade_printImageFont')args.push(this.arrayValue(b,'X'));
            args.push(this.arrayValue(b,'Y'),this.arrayValue(b,'COLOR'),this.arrayValue(b,'FONT'));
            push(`${this.arrayValue(b,'IMAGE')}.${b.opcode==='arcade_printImageFont'?'print':'printCenter'}(${args.join(', ')})`);return;
        }
        case 'arcade_printImageText': {
            const font = {small: 'image.font5', normal: 'image.font8', large: 'image.font12', auto: null}[this.field(b, 'FONT')];
            if (font === undefined) { push(`// ${this.note(`Unsupported Arcade font ${this.field(b, 'FONT')}`)}`); return; }
            const color = this.arrayValue(b, 'COLOR');
            const args = [this.arrayValue(b, 'TEXT'), this.arrayValue(b, 'X'), this.arrayValue(b, 'Y')];
            if (font || color !== '0') args.push(color);
            if (font) args.push(font);
            push(`${this.arrayValue(b, 'IMAGE')}.print(${args.join(', ')})`);
            return;
        }
        case 'arcade_spriteSay': {
            const self = this.literalInput(b, 'ID') === 'self';
            const owner = self ? me : v('ID');
            if (!owner) { push(`// ${this.note('Arcade speech needs a sprite')}`); return; }
            const mode = this.literalInput(b, 'MODE') || b.fields?.MODE?.[0];
            if (!['text', 'legacy'].includes(mode)) {
                push(`// ${this.note('Arcade speech mode must be text or legacy')}`);
                return;
            }
            const literal = this.literalInput(b, 'TEXT');
            const textSlot = b.inputs?.TEXT?.[1];
            const reporter = typeof textSlot === 'string' ? this.block(textSlot) : null;
            const message = literal !== null ? JSON.stringify(literal) : this.isBoolean(reporter) ?
                this.expr(reporter) : v('TEXT', '""');
            const args = [message, v('DURATION', '-1')];
            if (mode === 'text') {
                const animated = this.literalNumber(b, 'ANIMATED');
                args.push(animated === null ? this.condition(b, 'ANIMATED') : animated ? 'true' : 'false');
            }
            args.push(v('FOREGROUND', '15'), v('BACKGROUND', '1'));
            push(`${owner}.${mode === 'legacy' ? 'say' : 'sayText'}(${args.join(', ')})`);
            return;
        }
        case 'arrays_createEmpty': push(`${this.namedArray(b)} = []`);return;
        case 'arrays_create1D':
        case 'arrays_create2D': {
            const text=this.literalInput(b,'JSON');let value;
            if(text===null){push(`// ${this.note('Named array JSON creation requires a fixed JSON value')}`);return;}
            try{value=JSON.parse(text);}catch(_){value=b.opcode==='arrays_create2D'?[[]]:[];}
            const representable=value=>value===null || ['string','number','boolean'].includes(typeof value) || Array.isArray(value) && value.every(representable);
            if(!Array.isArray(value) || !representable(value)){push(`// ${this.note('Named array JSON object entries require object-value support')}`);return;}
            push(`${this.namedArray(b)} = ${JSON.stringify(value)}`);return;
        }
        case 'arrays_push': push(`${this.namedOperationHelper('push')}(${this.namedArray(b)}, ${this.arrayValue(b,'VALUE')})`);return;
        case 'arrays_set': push(`${this.namedOperationHelper('set')}(${this.namedArray(b)}, ${this.arrayValue(b,'INDEX')}, ${this.arrayValue(b,'VALUE')})`);return;
        case 'arrays_insert': push(`${this.namedOperationHelper('insert')}(${this.namedArray(b)}, ${this.arrayValue(b,'INDEX')}, ${this.arrayValue(b,'VALUE')})`);return;
        case 'arrays_remove': push(`${this.namedOperationHelper('remove')}(${this.namedArray(b)}, ${this.arrayValue(b,'INDEX')})`);return;
        case 'arrays_delete': push(`${this.namedArray(b)} = null`);return;
        case 'arrays_mutateReference': {
            const op=this.literalInput(b,'OP'),array=this.referenceArrayValue(b);
            if(op==='set')push(`${array}[${v('INDEX')}] = ${this.arrayValue(b,'VALUE')}`);
            else if(op==='length')push(`${array}.length = ${this.arrayValue(b,'VALUE')}`);
            else if(op==='removeElement')push(`${array}.removeElement(<any>(${this.arrayValue(b,'VALUE')}))`);
            else if(['push','unshift'].includes(op))push(`${array}.${op}(${this.arrayValue(b,'VALUE')})`);
            else if(op==='insertAt')push(`${array}.insertAt(${v('INDEX')}, ${this.arrayValue(b,'VALUE')})`);
            else if(op==='removeAt')push(`${array}.removeAt(${v('INDEX')})`);
            else if(['pop','shift','reverse'].includes(op))push(`${array}.${op}()`);
            else push(`// ${this.note('Unsupported array reference mutation '+op)}`);
            return;
        }
        case 'arcade_setLocal': {
            if(this.currentCallableContext){
                try {
                    const id=Object.entries(this.blocks).find(([,block])=>block===b)?.[0];
                    const generated=this.currentCallableContext.generatedLocal?.(id);
                    if(generated)push(`${generated.first?'let ':''}${generated.name}${generated.first?': '+renderCallableSignature(generated.type):''} = ${this.arrayValue(b,'VALUE')}`);
                    else if(this.currentCallableContext.discardLocal?.(id))push((this.currentCallableContext.statementTerminator?';':'')+this.arrayValue(b,'VALUE')+(this.currentCallableContext.statementTerminator?';':''));
                    else push(`${this.currentCallableContext.local(this.literalInput(b,'NAME'),true)} = ${this.arrayValue(b,'VALUE')}`);
                }catch(error){this.note(error.message);}return;
            }
            if(this.currentClassConstructor){const computed=this.arrayValue(b,'VALUE');if(/^super\(/.test(computed)){push(computed);return;}}
            const name = this.literalInput(b, 'NAME');
            if (!name || !/^[A-Za-z_]\w*$/.test(name) || !this.currentLocalNames) {
                push(`// ${this.note('Arcade local assignment needs a fixed name inside a procedure')}`);
            } else {
                this.currentLocalNames.add(name);
                const valueBlock = this.block(typeof b.inputs?.VALUE?.[1] === 'string' ? b.inputs.VALUE[1] : null);
                this.spawnAssignment = this.spawnProducerOpcodes.includes(valueBlock?.opcode);
                let value = this.arrayValue(b,'VALUE');
                this.spawnAssignment = false;
                // The importer's placeholder for a sprite producer it could not build.
                const spriteProducer = this.spawnProducerOpcodes.includes(valueBlock?.opcode);
                const writes = this.currentLocalNames.localWrites || (this.currentLocalNames.localWrites = new Map());
                // The importer stores a literal 0 where it could not build a sprite producer.
                const placeholder = !spriteProducer && value === '0';
                if (placeholder && this.localUsedAsSprite(name)) value = 'null';
                // Remember what kind of value this procedure writes, so the declaration can tell a
                // sprite-only local from one that also holds a primitive.
                const kind = spriteProducer || placeholder ? 'sprite' : 'other';
                writes.set(name, writes.has(name) && writes.get(name) !== kind ? 'mixed' : kind);
                push(`${name} = ${value}`);
                if (['arcade_spawnSprite', 'arcade_spawnImageSprite'].includes(valueBlock?.opcode)) {
                    push(`${name}.setPosition(${this.value(valueBlock, 'X')}, ${this.value(valueBlock, 'Y')})`);
                }
            }
            return;
        }
        case 'arcade_setPlayerScore':
        case 'arcade_changePlayerScore': {const api=this.infoPlayerApi(b);if(api)push(`${api}.${b.opcode==='arcade_setPlayerScore'?'setScore':'changeScoreBy'}(${this.arrayValue(b,'VALUE')})`);return;}
        case 'arcade_setLife':
        case 'arcade_changeLife': {const api=this.infoPlayerApi(b);if(api)push(`${api}.${b.opcode==='arcade_setLife'?'setLife':'changeLifeBy'}(${this.arrayValue(b,'VALUE')})`);return;}
        case 'arcade_externalCommand': {
            const call=this.externalCallText(b);
            if(call===null)push(`// ${this.note('Arcade external command needs a qualified name and a fixed argument chain')}`);
            else push(call);
            return;
        }
        case 'arcade_pushScene': push('game.pushScene()');return;
        case 'arcade_popScene': push('game.popScene()');return;
        case 'arcade_setButtonRepeatProperty': {const receiver=this.controllerRepeatReceiver(b);if(receiver)push(`${receiver}.${b.fields.PROPERTY[0]} = (${this.arrayValue(b,'VALUE')} as any)`);return;}
        case 'arcade_setButtonRepeatDefaults':push(`controller.setRepeatDefault((${this.arrayValue(b,'DELAY')} as any), (${this.arrayValue(b,'INTERVAL')} as any))`);return;
        case 'arcade_setControllerConnected': {const player=b.fields.PLAYER?.[0];if(!['1','2','3','4'].includes(String(player))){push(`// ${this.note('Controller connection requires a fixed player 1 through 4')}`);return;}push(`controller.player${player}.connected = (${this.arrayValue(b,'CONNECTED')} as any)`);return;}
        case 'arcade_raiseControlEvent':push(`control.raiseEvent(${this.arrayValue(b,'SOURCE')}, ${this.arrayValue(b,'VALUE')})`);return;
        case 'arcade_waitControlEvent':push(`control.waitForEvent(${this.arrayValue(b,'SOURCE')}, ${this.arrayValue(b,'VALUE')})`);return;
        case 'arcade_registerMultiplayerConnection':
        case 'arcade_registerControlEvent':
        case 'arcade_registerMultiplayerButtonHandler':
        case 'arcade_registerUpdateHandler':
        case 'arcade_registerPaintHandler':
        case 'arcade_registerShadeHandler':
        case 'arcade_registerIntervalHandler':
        case 'arcade_registerPlayerButtonHandler':
        case 'arcade_registerButtonHandler':
        case 'arcade_registerInstanceDestroyedHandler':
        case 'arcade_registerDestroyedHandler':
        case 'arcade_registerOverlapHandler':
        case 'arcade_registerScenePushHandler':
        case 'arcade_registerScenePopHandler':
        case 'arcade_startParallelHandler':
        case 'arcade_registerForeverHandler':
        case 'arcade_registerLifeZeroHandler':
        case 'arcade_registerScoreHandler':
        case 'arcade_registerCountdownHandler':
        case 'arcade_registerExternalHandler': {
            const kinds={arcade_registerExternalHandler:'external',arcade_registerMultiplayerConnection:'multiplayerConnection',arcade_registerControlEvent:'controlEvent',arcade_startParallelHandler:'parallel',arcade_registerMultiplayerButtonHandler:'multiplayerButton',arcade_registerUpdateHandler:'update',arcade_registerPaintHandler:'paint',arcade_registerShadeHandler:'shade',arcade_registerIntervalHandler:'interval',
                arcade_registerInstanceDestroyedHandler:'instanceDestroyed',arcade_registerPlayerButtonHandler:'button',arcade_registerButtonHandler:'button',arcade_registerDestroyedHandler:'destroyed',arcade_registerOverlapHandler:'overlap',
                arcade_registerScenePushHandler:'scenePush',arcade_registerScenePopHandler:'scenePop',
                arcade_registerForeverHandler:'forever',arcade_registerLifeZeroHandler:'lifeZero',arcade_registerScoreHandler:'score',arcade_registerCountdownHandler:'countdown'};
            const kind=kinds[b.opcode],token=this.literalInput(b,'TOKEN'),callback=token && this.registeredCallback(token);
            if(!callback || callback.kind!==kind){push(`// ${this.note('Arcade registration has no matching callback')}`);return;}
            const signatures={multiplayerConnection:`${callback.parameter}: mp.Player`,multiplayerButton:`${callback.parameter}: mp.Player`,destroyed:`${callback.parameter}: Sprite`,overlap:`${callback.parameter}: Sprite, ${callback.second}: Sprite`};
            // A parallel handler is a separate run, as each flag script is in the
            // first export: it takes its own run token, so `stop other scripts`
            // keeps only the run that issued it and `stop all` ends each one.
            const runToken=kind==='parallel'?this.tokenLine(this.registeredCallbackBlocks.get(token).target):[];
            const body=`function (${signatures[kind]||''}) {\n${[...runToken,...callback.script].join('\n')}\n}`;
            if(runToken.length)this.use('tok');
            const apis={parallel:'control.runInParallel',update:'game.onUpdate',paint:'game.onPaint',shade:'game.onShade',interval:'game.onUpdateInterval',destroyed:'sprites.onDestroyed',overlap:'sprites.onOverlap',
                scenePush:'game.addScenePushHandler',scenePop:'game.addScenePopHandler',forever:'game.forever',
                lifeZero:'info.onLifeZero',countdown:'info.onCountdownEnd'};
            const args=[];let api=apis[kind];
            if(kind==='external'){
                const name=this.externalName(b),values=this.externalArgumentValues(b);
                if(!name || values===null){push(`// ${this.note('Arcade external callback registration needs a qualified name and a fixed argument chain')}`);return;}
                this.usedRegisteredCallbacks.add(token);push(`${name}(${[...values,body].join(', ')})`);return;
            }
            if(kind==='instanceDestroyed')api=`${this.arrayValue(b,'ID')}.onDestroyed`;
            if(kind==='lifeZero'){const playerApi=this.infoPlayerApi(b);if(!playerApi)return;api=playerApi+'.onLifeZero';}
            if(kind==='score'){
                if(!this.scoreThresholdExportOperands?.has(b)){this.note('Arcade score registration export requires an actual Number threshold producer');return;}
                const playerApi=this.infoPlayerApi(b);if(!playerApi)return;api=playerApi+'.onScore';args.push(this.arrayValue(b,'SCORE'));
            }
            if(kind==='interval')args.push(this.arrayValue(b,'INTERVAL'));
            if(kind==='destroyed' || kind==='overlap')args.push(this.kindExpr(b,'KIND'));
            if(kind==='overlap')args.push(this.kindExpr(b,'OTHER_KIND'));
            if(kind==='multiplayerConnection'){this.requiresMultiplayerPackage=true;api='mp.onControllerEvent';const event=this.literalNumber(b,'EVENT');args.push(event===1?'ControllerEvent.Connected':event===2?'ControllerEvent.Disconnected':this.arrayValue(b,'EVENT'));}
            if(kind==='multiplayerButton'){this.requiresMultiplayerPackage=true;api='mp.onButtonEvent';args.push(this.arrayValue(b,'BUTTON'),this.arrayValue(b,'EVENT'));}
            if(kind==='button'){
                const button=this.literalInput(b,'BUTTON');
                if(!['A','B','up','down','left','right'].includes(button)){push(`// ${this.note('Arcade button registration requires a fixed supported button')}`);return;}
                if(b.opcode==='arcade_registerPlayerButtonHandler'){
                    const player=this.literalNumber(b,'PLAYER'),enumButton={A:'A',B:'B',up:'Up',down:'Down',left:'Left',right:'Right'}[button];
                    if(!Number.isInteger(player)||player<1||player>4){push(`// ${this.note('Arcade player button registration requires fixed player 1 through 4')}`);return;}
                    const event={2049:'Pressed',2048:'Released',2054:'Repeated'}[this.literalNumber(b,'EVENT')];
                    if(!event){push(`// ${this.note('Arcade player button registration requires a fixed supported event')}`);return;}
                    api=`controller.player${player}.onButtonEvent`;args.push(`ControllerButton.${enumButton}`,`ControllerButtonEvent.${event}`);
                }else{api=`controller.${button}.onEvent`;args.push(this.arrayValue(b,'EVENT'));}
            }
            if(kind==='controlEvent'){api='control.onEvent';args.push(this.arrayValue(b,'SOURCE'),this.arrayValue(b,'VALUE'),body,this.arrayValue(b,'FLAGS'));}
            else args.push(body);
            this.usedRegisteredCallbacks.add(token);push(`${api}(${args.join(', ')})`);return;
        }
        case 'arcade_cameraShake': push(`scene.cameraShake(${this.arrayValue(b,'AMPLITUDE')}, ${this.arrayValue(b,'DURATION')})`);return;
        case 'arcade_centerCameraAt': push(`scene.centerCameraAt(${this.arrayValue(b,'X')}, ${this.arrayValue(b,'Y')})`);return;
        case 'arcade_cameraFollowSprite': push(`scene.cameraFollowSprite(${this.arrayValue(b,'ID')})`);return;
        case 'arcade_registerLegacyWallHandler': {
            this.requiresLegacyTilemapPackage=true;
            const token=this.literalInput(b,'TOKEN'),callback=token && this.registeredCallback(token);
            if(!callback || callback.kind!=='legacyWall'){push(`// ${this.note('Color wall registration has no matching callback')}`);return;}
            this.usedRegisteredCallbacks.add(token);
            push(`scene.onHitTile(${this.kindExpr(b,'KIND')}, ${v('INDEX')}, function (${callback.parameter}: Sprite) {\n${callback.script.join('\n')}\n})`);return;
        }
        case 'arcade_registerWallHandler':
        case 'arcade_registerTileHandler': {
            const token=this.literalInput(b,'TOKEN'),kind=b.opcode==='arcade_registerWallHandler'?'wall':'tile';
            const callback=token && this.registeredCallback(token);
            if(!callback || callback.kind!==kind)push(`// ${this.note('Arcade terrain registration has no matching callback')}`);
            else {
                this.usedRegisteredCallbacks.add(token);
                const args=[this.kindExpr(b,'KIND')];if(kind==='tile')args.push(v('IMAGE'));
                push(`scene.${kind==='wall'?'onHitWall':'onOverlapTile'}(${args.join(', ')}, function (${callback.parameter}: Sprite, ${callback.location}: tiles.Location) {\n${callback.script.join('\n')}\n})`);
            }return;
        }
        case 'arcade_registerSpriteCreated': {
            const token = this.literalInput(b,'TOKEN');
            const callback = token && this.registeredCallback(token);
            if (!callback) push(`// ${this.note('Arcade creation registration has no matching callback')}`);
            else {
                this.usedRegisteredCallbacks.add(token);
                push(`sprites.onCreated(${this.kindExpr(b,'KIND')}, function (${callback.parameter}: Sprite) {\n${callback.script.join('\n')}\n})`);
            }
            return;
        }
        case 'arcade_setCaptured': {
            const name = this.literalInput(b,'NAME');
            if(this.currentCallableContext){try{push(`${this.currentCallableContext.capture(name,true)} = ${this.arrayValue(b,'VALUE')}`);}catch(error){this.note(error.message);}return;}
            if (!name || !this.compilingRegisteredCallbacks.size) push(`// ${this.note('Arcade captured assignment needs a registered callback and fixed name')}`);
            // Captured cells retain their Arcade value type, including boolean.
            else push(`${ident(name)} = ${this.arrayValue(b,'VALUE')}`);
            return;
        }
        case 'arcade_registerSpriteDestroyed': {
            const token = this.literalInput(b, 'TOKEN');
            const callback = token && this.destroyedCallbacks.get(token);
            if (!callback) push(`// ${this.note('Arcade sprite destruction registration has no matching callback')}`);
            else {
                this.usedDestroyedCallbacks.add(token);
                push(`${v('ID')}.onDestroyed(function () {\n${callback.join('\n')}\n})`);
            }
            return;
        }
        case 'arcade_copyImageFrom': push(`${v('IMAGE')}.copyFrom(${v('SOURCE')})`);return;
        case 'arcade_bufferSetByte': push(`${v('BUFFER')}[${v('OFFSET')}] = ${v('VALUE')}`);return;
        case 'arcade_bufferSetNumber': {
            const menu=this.menuField(b,'FORMAT','bufferFormats'), text=this.literalInput(b,'FORMAT');
            const fmt=menu || (text===null?this.literalNumber(b,'FORMAT'):BUFFER_FORMAT_NAMES.includes(text)?text:Number(text));
            const expression=BUFFER_FORMAT_NAMES.includes(fmt)?`NumberFormat.${fmt}`:
                typeof fmt==='number' && BUFFER_FORMAT_NAMES[fmt-1]?`NumberFormat.${BUFFER_FORMAT_NAMES[fmt-1]}`:
                fmt===null?v('FORMAT'):null;
            if(expression===null){this.note('Byte buffer numeric format is not supported');return;}
            push(`${v('BUFFER')}.setNumber(${expression}, ${v('OFFSET')}, ${v('VALUE')})`);return;
        }
        case 'arcade_bufferPackAt': {
            const format=this.literalInput(b,'FORMAT');
            push(`${v('BUFFER')}.packAt(${v('OFFSET')}, ${format===null?v('FORMAT'):JSON.stringify(format)}, ${v('ARRAY')})`);return;
        }
        case 'arcade_bufferWrite': push(`${v('BUFFER')}.write(${v('OFFSET')}, ${v('SOURCE')})`);return;
        case 'arcade_bufferFill': push(`${v('BUFFER')}.fill(${v('VALUE')}, ${v('OFFSET')}, ${v('LENGTH')})`);return;
        case 'arcade_bufferShift': push(`${v('BUFFER')}.shift(${v('AMOUNT')}, ${v('OFFSET')}, ${v('LENGTH')})`);return;
        case 'arcade_bufferRotate': push(`${v('BUFFER')}.rotate(${v('AMOUNT')}, ${v('OFFSET')}, ${v('LENGTH')})`);return;
        case 'arcade_scrollImage': push(`${v('IMAGE')}.scroll(${v('X')}, ${v('Y')})`);return;
        case 'arcade_mutateImage': {
            const op=this.field(b,'OP'); if(!['fill','replace','flipX','flipY'].includes(op)){this.note(`Unsupported Arcade image operation ${op}`);return;}
            const args=op==='fill'?v('COLOR'):op==='replace'?`${v('COLOR')}, ${v('TO')}`:'';
            push(`${v('IMAGE')}.${op}(${args})`);return;
        }
        case 'arcade_blitImage': {
            const op = this.field(b, 'OP');
            if (!['drawImage', 'drawTransparentImage'].includes(op)) {this.note(`Unsupported Arcade image copy operation ${op}`);return;}
            push(`${v('IMAGE')}.${op}(${v('SOURCE')}, ${v('X')}, ${v('Y')})`);return;
        }
        case 'arcade_returnValue': push(`return ${this.arrayValue(b,'VALUE')}`);return;
        case 'arcade_setImagePixel': push(`${v('IMAGE')}.setPixel(${v('X')}, ${v('Y')}, ${v('COLOR')})`);return;
        case 'arcade_drawImageCircle':
        case 'arcade_drawSpriteCircle': {
            const operation=this.field(b,'OP');
            if(!['drawCircle','fillCircle'].includes(operation)){this.note(`Unsupported Arcade circle operation ${operation}`);return;}
            const image=b.opcode==='arcade_drawImageCircle'?v('IMAGE'):`${v('ID')}.image`;
            push(`${image}.${operation}(${v('X')}, ${v('Y')}, ${v('RADIUS')}, ${v('COLOR')})`);return;
        }
        case 'arcade_drawImage': {
            const op=this.field(b,'OP');if(!['fillRect','drawLine'].includes(op)){this.note(`Unsupported Arcade drawing operation ${op}`);return;}
            push(`${v('IMAGE')}.${op}(${v('X')}, ${v('Y')}, ${v('W')}, ${v('H')}, ${v('COLOR')})`);return;
        }
        case 'arcade_setSpriteImage': push(`${v('ID')}.setImage(${v('IMAGE')})`); return;
        case 'arcade_setSpritePixel': push(`${v('ID')}.image.setPixel(${v('X')}, ${v('Y')}, ${v('COLOR')})`); return;
        case 'arcade_drawSpriteImage': {
            const operation = this.field(b, 'OP');
            if (!['fillRect', 'drawLine'].includes(operation)) { this.note(`Unsupported Arcade image drawing operation ${operation}`); return; }
            push(`${v('ID')}.image.${operation}(${v('X')}, ${v('Y')}, ${v('W')}, ${v('H')}, ${v('COLOR')})`); return;
        }
        case 'arcade_mutateSpriteImage': {
            const operation = this.field(b, 'OP');
            if (!['fill', 'replace', 'flipX', 'flipY'].includes(operation)) {
                this.note(`Unsupported Arcade image operation ${operation}`); return;
            }
            const args = operation === 'fill' ? v('COLOR') : operation === 'replace' ? `${v('COLOR')}, ${v('TO')}` : '';
            push(`${v('ID')}.image.${operation}(${args})`); return;
        }
        case 'arcade_setSpriteCostume': {
            const handle = this.handleInputVariable(b, 'ID');
            const template = handle && this.handleTemplateVars.get(handle);
            const target = template && this.sprites.find(t => t.name === template);
            const costume = this.literalNumber(b, 'COSTUME');
            if (!target) {
                const slot = b.inputs?.ID?.[1];
                const reporter = typeof slot === 'string' ? this.block(slot) : null;
                if (reporter?.opcode === 'arcade_eventSprite' &&
                    this.field(reporter, 'WHICH') === 'first' && this.eventKind && costume !== null) {
                    const matches = [...this.templateKinds].filter(([name, kind]) =>
                        kind === this.eventKind && this.templateNames.has(name))
                        .map(([name]) => this.sprites.find(sprite => sprite.name === name)).filter(Boolean);
                    if (matches.length && matches.every(sprite => (sprite.costumes?.length || 0) > 0)) {
                        const images = matches.map(sprite => {
                            const count = sprite.costumes.length;
                            const index = ((Math.round(costume) % count) + count) % count;
                            return this.frame(sprite, index);
                        });
                        const literal = toImgLiteral(images[0]);
                        if (images.every(image => toImgLiteral(image) === literal)) {
                            push(`${v('ID')}.setImage(${literal})`);
                            return;
                        }
                    }
                }
                push(`// ${this.note('Arcade image change needs a sprite handle with a known template')}`);
                return;
            }
            const count = target.costumes?.length || 0;
            if (!count) {
                push(`// ${this.note(`${template}: no costumes available for Arcade image change`)}`);
                return;
            }
            if (costume === null) {
                if (!this.frameArrays.has(template)) {
                    const frames = target.costumes.map((unused, index) => this.frame(target, index));
                    const initial = frames[0];
                    if (frames.some(frame => (frame.width !== initial.width || frame.height !== initial.height) &&
                        (frame.scale !== 4 || initial.scale !== 4))) {
                        this.note(`${template}: resized Arcade frames need four-unit pixel SVG artwork`);
                    }
                    const used = new Set([...this.spriteVar.values(), ...this.globals.values(),
                        ...[...this.frameArrays.values()].map(array => array.name)]);
                    for (const sprite of this.project.targets) for (const variable of Object.values(sprite.variables || {})) {
                        used.add(ident(variable[0]));
                        used.add(ident(`${sprite.name}_${variable[0]}`));
                    }
                    let name = `__bwFrames_${ident(template)}`;
                    while (used.has(name)) name += '_';
                    this.frameArrays.set(template, {name, frames});
                }
                const array = this.frameArrays.get(template);
                const selection = `(((Math.round(${v('COSTUME')}) % ${count}) + ${count}) % ${count})`;
                push(`${v('ID')}.setImage(${array.name}[${selection}])`);
                return;
            }
            const index = ((Math.round(costume) % count) + count) % count;
            const currentImage = this.frame(target, index);
            const initialImage = this.artPixels.get(template);
            if (initialImage && (initialImage.width !== currentImage.width ||
                initialImage.height !== currentImage.height) &&
                (initialImage.scale !== 4 || currentImage.scale !== 4)) {
                this.note(`${template}: resized Arcade frames need four-unit pixel SVG artwork`);
            }
            push(`${v('ID')}.setImage(${toImgLiteral(currentImage)})`);
            return;
        }
        case 'arcade_setSpriteScaleCore': push(`${v('ID')}.setScaleCore(${this.arrayValue(b,'SX')}, ${this.arrayValue(b,'SY')}, ${v('ANCHOR')}, ${this.spriteFlagCondition(b,'PROPORTIONAL')})`);return;
        case 'arcade_setSpriteScale': push(`${v('ID')}.setScale(${v('VALUE')}, ${v('ANCHOR')})`);return;
        case 'arcade_changeSpriteScale': push(`${v('ID')}.changeScale(${v('VALUE')}, ${v('ANCHOR')})`);return;
        case 'arcade_followSprite': push(`${v('ID')}.follow(${v('TARGET')}, ${v('SPEED')}, ${v('TURN')})`);return;
        case 'arcade_unfollowSprite': push(`${v('ID')}.unfollow()`);return;
        case 'arcade_setSpritePosition': push(`${v('ID')}.setPosition(${v('X')}, ${v('Y')})`); return;
        case 'arcade_setSpriteProperty': {
            const property = this.field(b, 'PROPERTY');
            if(!['x','y','left','right','top','bottom','vx','vy','ax','ay','fx','fy','sx','sy','scale','width','height','z','lifespan','rotation','rotationDegrees','data','flags'].includes(property)){push(`// ${this.note(`Arcade sprite property ${property} is unsupported`)}`);return;}
            if (['width', 'height'].includes(property)) push(`// ${this.note(`Arcade sprite ${property} needs image resizing`)}`);
            else push(`${v('ID')}.${property} = ${property==='flags'?this.mathValue(b,'VALUE'):v('VALUE')}${property==='flags'?' as any':''}`);
            return;
        }
        case 'arcade_setSpriteKind': push(`${v('ID')}.setKind(${this.kindExpr(b, 'KIND')})`); return;
        case 'arcade_setSpriteFlag': {
            const flag = this.field(b, 'FLAG');
            if (!['AutoDestroy', 'StayInScreen', 'BounceOnWall', 'DestroyOnWall', 'Invisible', 'Ghost',
                'GhostThroughSprites', 'GhostThroughWalls', 'GhostThroughTiles', 'RelativeToCamera', 'ShowPhysics'].includes(flag)) {
                push(`// ${this.note(`Unsupported Arcade sprite flag ${flag}`)}`);
                return;
            }
            push(`${v('ID')}.setFlag(SpriteFlag.${flag}, ${this.spriteFlagCondition(b)})`);
            return;
        }
        case 'arcade_setSpriteStayInScreen': push(`${v('ID')}.setStayInScreen(${this.spriteFlagCondition(b)})`); return;
        case 'arcade_setSpriteAutoDestroy': push(`${v('ID')}.setFlag(SpriteFlag.AutoDestroy, ${this.spriteFlagCondition(b)})`); return;
        case 'arcade_setSpriteBounceOnWall': push(`${v('ID')}.setBounceOnWall(${this.spriteFlagCondition(b)})`); return;
        case 'arcade_setSpriteGhostThroughSprites': push(`${v('ID')}.setFlag(SpriteFlag.GhostThroughSprites, ${this.spriteFlagCondition(b)})`); return;
        case 'arcade_setHudVisibility': {
            const element=this.field(b,'ELEMENT');
            const method={score:'showScore',life:'showLife',countdown:'showCountdown'}[element];
            if(!method){push(`// ${this.note(`Unsupported HUD visibility element ${element}`)}`);return;}
            push(`info.${method}(${this.boolValue(b,'VISIBLE')})`);return;
        }
        case 'arcade_startCountdown': push(`info.startCountdown(${v('N')})`); return;
        case 'arcade_stopCountdown': push('info.stopCountdown()'); return;
        case 'arcade_splash': {
            const title = this.arrayValue(b,'TITLE');
            const subtitle = this.arrayValue(b,'SUBTITLE');
            push(subtitle === '""' ? `game.splash(${title})` : `game.splash(${title}, ${subtitle})`);
            return;
        }
        case 'arcade_showLongText': {
            const layout = this.field(b, 'LAYOUT');
            if (!['Left', 'Right', 'Top', 'Bottom', 'Center', 'Full'].includes(layout)) {
                push(`// ${this.note('Arcade long text layout must be fixed')}`);
                return;
            }
            push(`game.showLongText(${this.arrayValue(b,'TEXT')}, DialogLayout.${layout})`);
            return;
        }
        case 'arcade_log': push(`console.log(${this.arrayValue(b, 'TEXT')})`); return;
        case 'arcade_settingsWrite': {
            const type=settingType(b, this.blocks);
            if(!['Number','String','NumberArray','StringArray','Buffer'].includes(type)){push(this.note('Settings requires a fixed supported write type'));return;}
            if(type==='StringArray'){this.requiresStringArraySettings=true;push(`bwStringArraySettings.write(${v('KEY')}, ${v('VALUE')})`);return;}
            push(`settings.write${type}(${v('KEY')}, ${v('VALUE')})`);return;
        }
        case 'arcade_settingsRemove': push(`settings.remove(${v('KEY')})`);return;
        case 'arcade_settingsClear': push('settings.clear()');return;
        case 'arcade_spriteDataSet': {
            this.requiresSpriteDataPackage=true;
            const type=directMenuValue(b,'TYPE',this.blocks);
            if(!['Number','String','Boolean','Sprite'].includes(type)){push(this.note('Sprite Data requires a fixed supported set type'));return;}
            push(`sprites.setData${type}(${v('ID')}, ${v('KEY')}, ${type==='Boolean'?this.arrayValue(b,'VALUE'):v('VALUE')})`);return;
        }
        case 'arcade_spriteDataChange': this.requiresSpriteDataPackage=true;push(`sprites.changeDataNumberBy(${v('ID')}, ${v('KEY')}, ${v('VALUE')})`);return;
        case 'arcade_waitAnyButton': push('controller.pauseUntilAnyButtonIsPressed()'); return;
        case 'arcade_gameover': push('game.over(false)'); return;
        case 'arcade_declareParameterConstraint': {
            if(!this.procedureConstraints?.declaration(b)||!this.procedureConstraints.current())this.note('Procedure parameter constraint: declaration has no current owner');
            return;
        }
        case 'procedures_call': {
            const code = b.mutation && b.mutation.proccode;
            const fn = this.functionSymbols.call(this.target,b);
            if(!fn){push(`// ${this.note(`call ${code}: needs its unique current target procedure and formal binding`)}`);return;}
            const ids = b.mutation ? JSON.parse(b.mutation.argumentids || '[]') : [];
            const args = ids.map(a => this.arrayValue(b, a));
            // A custom block runs in its caller's thread: it gets the caller's run token.
            if (this.tokened()) args.unshift('_t');
            if (this.isClonable()) args.unshift('self');
            if (fn) {
                push(`${fn}(${args.join(', ')})`);
                // It may have yielded: if this script was ended meanwhile, end here too.
                this.guardLine().forEach(push);
            } else push(`// ${this.note(`call ${code}`)}`);
            return;
        }
        default:
            push(`// ${this.note(b.opcode)}`);
        }
    }

    /**
     * Scratch's `stop` block, option by option (scratch-vm control.stop):
     *   - `this script` returns — from the script, or, inside a custom block,
     *     from that block only (Thread.stopThisScript pops to the call);
     *   - `other scripts in sprite/stage` ends every other running script of
     *     THIS sprite or clone and carries on: the target's mark moves past
     *     every run token issued so far, keeping this run's own;
     *   - `all` ends every script everywhere (all run tokens so far are dead),
     *     deletes the clones, stops the sounds and clears speech bubbles, as
     *     Runtime.stopAll does — and the game keeps running, so a key or a
     *     broadcast starts its scripts again, as in Scratch. Not `game.over`,
     *     which shows a lose screen and restarts the program on a button.
     * A script ended from outside stops at its next yield; Arcade switches
     * threads only there, so it runs no further block, as in Scratch.
     */
    stop (b, push) {
        const option = this.field(b, 'STOP_OPTION');
        if (option === 'this script') {
            push('return  // stop this script');
        } else if (option === 'all') {
            this.use('tok');
            push('_stopAll()');
            push('return');
        } else if (/^other scripts in (sprite|stage)$/.test(option)) {
            this.use('tok');
            if (this.isClonable()) {
                this.use('others');
                push('_stopOthers(self, _t)');
            } else {
                const [mark, kept] = this.stopMarks();
                push(`${mark} = _tokens  // stop ${option}`);
                push(`${kept} = _t`);
            }
            if (this.soundWaiters && this.soundWaiters.has(this.target)) {
                this.warn(`stop other scripts in ${this.target.name}: a tone a stopped script was waiting on plays to its end (Arcade has one sound voice; Scratch stops that sprite's sound)`);
            }
        } else {
            push(`// ${this.note(`stop ${option || '…'}`)}`);
        }
    }

    /**
     * The constructs this exporter maps beyond motion and control: broadcasts,
     * costumes, backdrops, clones, pen, sound and music, list monitors. Returns
     * whether it wrote the block (a refusal written as a comment counts).
     */
    newStmt (b, push, me, depth, out) {
        const v = n => this.value(b, n);
        const refuse = what => push(`// ${this.note(what)}`);
        switch (b.opcode) {
        // ── broadcasts ──
        case 'event_broadcast':
        case 'event_broadcastandwait': {
            const input = b.inputs && b.inputs.BROADCAST_INPUT;
            const slot = input && input[1];
            this.use('wait');
            this.usesBroadcast = true;
            const msg = Array.isArray(slot) && slot[0] === 11 ? JSON.stringify(String(slot[1]).toLowerCase()) :
                `("" + ${this.value(b, 'BROADCAST_INPUT', '""')}).toLowerCase()`;
            if (b.opcode === 'event_broadcast') push(`_broadcast(${msg})`);
            else {
                push(`_await(_broadcast(${msg}))`);
                this.guardLine().forEach(push);
            }
            return true;
        }
        // ── costumes ──
        case 'looks_switchcostumeto':
        case 'looks_nextcostume': {
            if (!me) return false;
            this.use('costume');
            const set = this.costumeSet(this.target);
            const setCostume = index => {
                push(`_setCostume(${me}, ${set}, ${index})`);
                if (this.scratchPose.has(this.target.name)) push(this.use('scratchPose', '_scratchPoseCostume(' + me + ')'));
            };
            if (b.opcode === 'looks_nextcostume') {
                setCostume(`_costume(${me}) + 1`);
                return true;
            }
            const dyn = this.dynamicInput(b, 'COSTUME');
            if (dyn) {
                this.use('pick');
                setCostume(`_pick(${this.costumeNames(this.target)}, ${dyn}, _costume(${me}))`);
                return true;
            }
            const name = this.menuField(b, 'COSTUME', 'COSTUME');
            const index = this.target.costumes.findIndex(c => c.name === name);
            if (index >= 0) setCostume(index);
            else if (name === 'next costume') setCostume(`_costume(${me}) + 1`);
            else if (name === 'previous costume') setCostume(`_costume(${me}) - 1`);
            else if (name === 'random costume') setCostume(`randint(0, ${set}.length - 1)`);
            else if (name.trim() !== '' && Number.isFinite(Number(name))) setCostume(Math.round(Number(name)) - 1);
            else this.missing(push, `switch costume to "${name}": ${this.target.name} has no such costume`);
            return true;
        }
        // ── backdrops ──
        case 'looks_switchbackdropto':
        case 'looks_switchbackdroptoandwait':
        case 'looks_nextbackdrop': {
            this.use('wait');
            const wait = b.opcode === 'looks_switchbackdroptoandwait';
            const call = index => {
                push(wait ? `_await(_setBackdrop(${index}))` : `_setBackdrop(${index})`);
                if (wait) this.guardLine().forEach(push);
            };
            if (b.opcode === 'looks_nextbackdrop') {
                call('_bd + 1');
                return true;
            }
            const dyn = this.dynamicInput(b, 'BACKDROP');
            if (dyn) {
                this.use('pick');
                call(`_pick(_backdropNames, ${dyn}, _bd)`);
                return true;
            }
            const stage = this.project.targets.find(t => t.isStage);
            const name = this.menuField(b, 'BACKDROP', 'BACKDROP');
            const index = stage ? stage.costumes.findIndex(c => c.name === name) : -1;
            if (index >= 0) call(String(index));
            else if (name === 'next backdrop') call('_bd + 1');
            else if (name === 'previous backdrop') call('_bd - 1');
            else if (name === 'random backdrop') call('randint(0, _backdrops.length - 1)');
            else this.missing(push, `switch backdrop to "${name}": the stage has no such backdrop`);
            return true;
        }
        // ── clones ──
        case 'control_create_clone_of': {
            const dyn = this.dynamicInput(b, 'CLONE_OPTION');
            const what = this.menuField(b, 'CLONE_OPTION', 'CLONE_OPTION');
            if (dyn) refuse('create clone of a computed sprite name (Arcade needs to know which sprite at export)');
            else if (what === '_myself_' && me) push(`_clone_${ident(this.target.name)}(${me})`);
            else if (this.clonable.has(what)) push(`_clone_${ident(what)}(${this.spriteVar.get(what)})`);
            else refuse(`create clone of ${what || '…'}: no such sprite`);
            return true;
        }
        case 'control_delete_this_clone':
            if (this.isClonable()) {
                push(`if (self.kind() == ${this.kindOf(this.target.name)}) {`);
                push('    self.destroy()');
                push('    return');
                push('}');
            } else {
                push(`// delete this clone: ${this.target.name} is never cloned, so there is nothing to delete (as in Scratch)`);
            }
            return true;
        // ── pen ──
        case 'pen_clear': this.use('pen'); push('_penLayer.image.fill(0)'); return true;
        case 'pen_penDown':
            if (!me) return false;
            this.use('pen');
            push(`${me}.data["_pd"] = 1`);
            push(`_penDot(${me}, ${me}.x, ${me}.y)`);
            return true;
        case 'pen_penUp': if (!me) return false; this.use('pen'); push(`${me}.data["_pd"] = 0`); return true;
        case 'pen_stamp':
            if (!me) return false;
            this.use('pen');
            push(`_penLayer.image.drawTransparentImage(${me}.image, ${me}.left, ${me}.top)`);
            return true;
        case 'pen_setPenColorToColor': {
            if (!me) return false;
            const input = b.inputs && b.inputs.COLOR;
            const slot = input && input[1];
            const hex = Array.isArray(slot) ? String(slot[1]) : this.literal(b, 'COLOR');
            const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
            if (!m || (input[0] !== 1 && typeof slot === 'string' && !this.block(slot)?.shadow)) {
                refuse('set pen color to a computed colour (Arcade pens use the 16-colour palette, chosen at export)');
                return true;
            }
            this.use('pen');
            push(`${me}.data["_pc"] = ${nearestIndex([parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)], this.palette)}`);
            return true;
        }
        case 'pen_setPenSizeTo':
            if (!me) return false;
            this.use('pen');
            push(`${me}.data["_ps"] = Math.clamp(1, 1200, ${v('SIZE')})`);
            return true;
        case 'pen_changePenSizeBy':
            if (!me) return false;
            this.use('pen');
            push(`${me}.data["_ps"] = Math.clamp(1, 1200, (${me}.data["_ps"] ? ${me}.data["_ps"] : 1) + ${v('SIZE')})`);
            return true;
        case 'pen_setPenColorParamTo':
        case 'pen_changePenColorParamBy':
        case 'pen_setPenHueToNumber':
        case 'pen_changePenHueBy':
        case 'pen_setPenShadeToNumber':
        case 'pen_changePenShadeBy':
            refuse(`${b.opcode.replace(/^pen_/, 'pen ')}: pen hue, saturation, brightness and transparency (Arcade pens are one of 16 palette colours)`);
            return true;
        // ── sound ──
        case 'sound_play':
        case 'sound_playuntildone': {
            const dyn = this.dynamicInput(b, 'SOUND_MENU');
            const name = dyn ? null : (this.menuField(b, 'SOUND_MENU', 'SOUND_MENU') || this.literal(b, 'SOUND_MENU') || '');
            if (dyn) {
                refuse('play sound chosen by a reporter (Arcade tones are chosen at export)');
                return true;
            }
            const tone = this.soundTone(name);
            if (tone.reason) {
                refuse(`play sound "${name}": sampled audio — ${tone.reason} (Arcade plays tones only)`);
                return true;
            }
            const call = `music.playTone(${tone.freq}, ${tone.ms})`;
            if (b.opcode === 'sound_playuntildone') {
                push(call);
                this.guardLine().forEach(push);
            } else {
                push(`control.runInParallel(function () { ${call} })`);
            }
            return true;
        }
        case 'sound_stopallsounds': push('music.stopAllSounds()'); return true;
        case 'sound_setvolumeto': this.volumeWarning(); push(`music.setVolume(Math.round(${v('VOLUME')} * 2.55))`); return true;
        case 'sound_changevolumeby':
            this.volumeWarning();
            push(`music.setVolume(music.volume() + Math.round(${v('VOLUME')} * 2.55))`);
            return true;
        case 'sound_seteffectto':
        case 'sound_changeeffectby':
        case 'sound_cleareffects':
            refuse(`${b.opcode}: pitch and pan effects (Arcade tones have neither)`);
            return true;
        case 'music_playNoteForBeats':
            this.use('music');
            push(`music.playTone(_hz(${v('NOTE')}), _beats(${v('BEATS')}))`);
            this.guardLine().forEach(push);
            return true;
        case 'music_restForBeats':
            this.use('music');
            push(`pause(_beats(${v('BEATS')}))`);
            this.guardLine().forEach(push);
            return true;
        case 'music_playDrumForBeats':
            // The drum is lost (named); its time is kept, so what follows stays in step.
            this.use('music');
            push(`pause(_beats(${v('BEATS')}))  // ${this.note('play drum: sampled percussion (Arcade plays tones) — kept as a rest of the same length')}`);
            return true;
        case 'music_setTempo': this.use('music'); push(`_tempo = Math.clamp(20, 500, ${v('TEMPO')})`); return true;
        case 'music_changeTempo': this.use('music'); push(`_tempo = Math.clamp(20, 500, _tempo + ${v('TEMPO')})`); return true;
        case 'music_setInstrument':
            refuse('set instrument: Arcade plays one tone voice');
            return true;
        // ── lists and the mouse ──
        case 'data_showlist':
        case 'data_hidelist':
            refuse(`${b.opcode === 'data_showlist' ? 'show' : 'hide'} list: Arcade has no list monitors`);
            return true;
        default:
            return false;
        }
    }

    // A qualified lexical callable graph proves the current type of each
    // input of its own current-body blocks (captured cells included). Only a
    // complete primitive proof of every operand is accepted; Arrays, class
    // values, callables and unproved inputs keep the existing refusal.
    callablePrimitiveOperands (block, names) {
        const graph=this.callableExports?.get(this.target)?.graph;
        if(!graph)return false;
        return names.every(name=>{
            let type=callableCurrentInputType(graph,block,name);
            if(!type&&graph.plan?.version===2){try{type=this.objectClassExport.classCallableProvider(this.target).currentInputType(block,name);}catch(_){type=null;}}
            return type?.kind==='named'&&['number','boolean','string'].includes(type.name);
        });
    }

    // Sprite flags writers of an actual project. A direct (mutable) project
    // graph has no owned frozen origin for its watchers, so its own query
    // refuses them; the same query then runs once over an owned frozen JSON
    // snapshot of this project taken now, mapped by target index and block id.
    spriteFlagWriters (target, node) {
        const direct=this.arrayReceiverAuthority.spriteFlagWriters(target,node);
        if(direct||isProjectJsonSnapshot(this.project))return direct;
        if(this.flagsSnapshot===undefined){
            try {
                const snapshot=createProjectJsonSnapshot(JSON.stringify(this.project));
                this.flagsSnapshot={snapshot,authority:createArrayReferenceExportAuthority(snapshot,this.opts)};
            } catch(_) {this.flagsSnapshot=null;}
        }
        if(!this.flagsSnapshot)return null;
        const {snapshot,authority}=this.flagsSnapshot,targets=this.project.targets;
        const index=targets.indexOf(target),id=index<0?null:Object.keys(target.blocks||{}).find(key=>target.blocks[key]===node);
        const snapTarget=index<0?null:snapshot.targets[index],snapNode=id&&snapTarget?.blocks?.[id];
        if(!snapNode)return null;
        let rows;try{rows=authority.spriteFlagWriters(snapTarget,snapNode);}catch(_){return null;}
        if(!rows)return null;
        const mapped=[];
        for(const row of rows){
            const at=snapshot.targets.indexOf(row.target),key=at<0?null:Object.keys(row.target.blocks||{}).find(k=>row.target.blocks[k]===row.node);
            const actual=at<0?null:targets[at],actualNode=key&&actual?.blocks?.[key];
            if(!actualNode)return null;
            mapped.push(Object.freeze({target:actual,node:actualNode,input:row.input}));
        }
        return Object.freeze(mapped);
    }

    /** A local that is the receiver (ID) of a sprite operation is a Sprite, even when
     * the only value ever stored in it is an unsupported-producer placeholder. */
    localUsedAsSprite (name) {
        return Object.values(this.blocks || {}).some(block => {
            if (!block || !/^arcade_/.test(block.opcode) || typeof block.inputs?.ID?.[1] !== 'string') return false;
            const receiver = this.blocks[block.inputs.ID[1]];
            return receiver?.opcode === 'arcade_getLocal' && this.literalInput(receiver, 'NAME') === name;
        });
    }

    get spawnProducerOpcodes () {
        return ['arcade_spawnSprite', 'arcade_spawnProjectile', 'arcade_spawnImageProjectile', 'arcade_spawnImageSprite', 'arcade_createSprite', 'arcade_createImageSprite'];
    }

    localDeclaration (name, key, procedureLocals = null) {
        const classType=this.objectClassExport?.localDeclarationType?.(key,name);
        let type=classType??this.localValueTypes.get(key)?.get(name)??'any';
        // Only a local written solely from a sprite producer in this procedure and used as a sprite receiver.
        if (classType === undefined && type === 'number' && procedureLocals?.localWrites?.get(name) === 'sprite' && this.localUsedAsSprite(name)) type = 'Sprite';
        const initial=this.objectClassExport?.hasType?.(type)||type==='mp.Player' || type==='Image' || type==='Sprite' || type==='tiles.Location' || type==='tiles.TileMapData' || type==='tiles.Tile' || type==='animation.Animation' || type==='SevenSegDigit' || type==='DigitCounter' || type==='Dart' || type==='Corgio' || type==='TextSprite' || type==='scene.Scene' || type==='ArcadePhysicsEngine' || type.endsWith('[]') ? 'null' : type==='string' ? '""' : type==='boolean' ? 'false' : '0';
        return `    let ${name}: ${type} = ${initial}`;
    }

    infoPlayerApi(b) {
        const player=b.inputs?.PLAYER?this.literalNumber(b,'PLAYER'):1;
        if(![1,2,3,4].includes(player)){this.note('Arcade life export requires a fixed player from 1 to 4');return null;}
        return player===1?'info':`info.player${player}`;
    }

    /** How a tilemap handler token is registered and removed across the project. PXT
     * compares listeners by function identity, so a token that is removed, registered
     * twice, or imported from a named procedure exports as one named function. */
    tilemapListenerUse(token) {
        if(!this.tilemapListenerUses){
            this.tilemapListenerUses=new Map();
            for(const target of this.project.targets || [])for(const block of Object.values(target.blocks || {})){
                if(!['arcade_registerTilemapEvent','arcade_unregisterTilemapEvent'].includes(block?.opcode))continue;
                const blocks=this.blocks,saved=this.target;this.blocks=target.blocks;this.target=target;
                let key,captures;try{key=this.literalInput(block,'TOKEN');captures=block.opcode==='arcade_registerTilemapEvent'?this.literalInput(block,'CAPTURES'):'';}finally{this.blocks=blocks;this.target=saved;}
                if(key===null)continue;
                const use=this.tilemapListenerUses.get(key)||{registers:0,removes:0,captures:false};
                if(block.opcode==='arcade_registerTilemapEvent')use.registers++;else use.removes++;
                if(captures===null || String(captures||'').trim())use.captures=true;
                this.tilemapListenerUses.set(key,use);
            }
            for(const [key,use] of this.tilemapListenerUses)use.named=key.startsWith('__bwTilemapFn_') || use.removes>0 || use.registers>1;
        }
        return this.tilemapListenerUses.get(token)||{registers:0,removes:0,captures:false,named:false};
    }

    tilemapListenerFunction(token,callback) {
        this.tilemapListenerFunctions??=new Map();
        if(this.tilemapListenerFunctions.has(token))return this.tilemapListenerFunctions.get(token);
        let name=null;
        if(!this.tilemapListenerUse(token).captures){
            name=token.startsWith('__bwTilemapFn_')?ident(token):'__bwTilemapFn_'+ident(token);
            const occupied=new Set([...this.globals.values(),...this.functionNames(),...this.spriteVar.values(),...[...this.tilemapListenerFunctions.values()].filter(Boolean)]);
            while(occupied.has(name))name+='_';
            this.generated.push(`function ${name}(${callback.parameter}: tiles.TileMapData) {\n${callback.script.join('\n')}\n}`);
        }
        this.tilemapListenerFunctions.set(token,name);
        return name;
    }

    registeredCallback(token) {
        if (this.registeredCallbacks.has(token)) return this.registeredCallbacks.get(token);
        const entry = this.registeredCallbackBlocks.get(token);
        if (!entry || this.compilingRegisteredCallbacks.has(token)) return null;
        const saved = {target:this.target,blocks:this.blocks,eventHandles:this.eventHandles,eventLocationName:this.eventLocationName,eventKind:this.eventKind,eventTilemapName:this.eventTilemapName,eventPlayerName:this.eventPlayerName,currentLocalNames:this.currentLocalNames,implicitLoopYield:this.implicitLoopYield};
        this.compilingRegisteredCallbacks.add(token);
        this.target = entry.target;this.blocks = entry.target.blocks;
        let parameter = `${entry.kind==='tilemapEvent'?'__bwEventTilemap':entry.kind==='created'?'__bwCreatedSprite':['wall','tile'].includes(entry.kind)?'__bwTerrainSprite':'__bwEventSprite'}_${ident(token)}`;
        const text = JSON.stringify(entry.target.blocks);
        while (text.includes(parameter)) parameter += '_';
        let location=`__bwEventLocation_${ident(token)}`;while(text.includes(location))location+='_';
        let second=`__bwOtherSprite_${ident(token)}`;while(text.includes(second))second+='_';
        this.eventPlayerName=['multiplayerButton','multiplayerConnection'].includes(entry.kind)?parameter:null;
        this.eventLocationName=['wall','tile'].includes(entry.kind)?location:null;
        this.eventTilemapName=entry.kind==='tilemapEvent'?parameter:null;
        this.eventHandles = entry.kind==='overlap'?[parameter,second]:['created','wall','tile','legacyWall','destroyed'].includes(entry.kind)?[parameter]:[];this.eventKind = this.registeredCallbackKinds.get(token);
        this.currentLocalNames = new Set();
        this.implicitLoopYield=true;
        const script = [];this.stmts(entry.block.next,1,script);
        const scope=`${entry.target.name}:script:${Object.keys(this.blocks).find(id=>this.blocks[id]===entry.block)}`;
        script.unshift(...[...this.currentLocalNames].filter(name=>name!==parameter && name!==location && name!==second).map(name=>this.localDeclaration(name,scope,this.currentLocalNames)));
        this.compilingRegisteredCallbacks.delete(token);
        Object.assign(this,saved);
        const result = {parameter,second,location,kind:entry.kind,script};this.registeredCallbacks.set(token,result);return result;
    }

    /** Infer Image argument annotations from native image operations and
     * resource aliases. Constraint edges carry types through forwarded calls. */
    imageProcedureParameters () {
        const graphTextSpriteValues=new Set(),graphBufferValues=new Set(),graphPlayerValues=new Set(),graphAnimationValues=new Set(),graphSevensegDigitValues=new Set(),graphSevensegCounterValues=new Set(),graphDartValues=new Set(),graphCorgiValues=new Set(),graphSceneValues=new Set(),graphPhysicsEngineValues=new Set();
        const dataProperties=[], parameters = new Map(), edges = [], images = new Set(), sprites = new Set(), tiles = new Set(), tilemaps = new Set(), legacyTiles = new Set(), arrays = new Set(), numbers = new Set(), booleans=new Set(), strings=new Set(), anys=new Set(), specialTypes=[],valueOperations=[], elements=[],arrayCopies=[];
        const definitions = [],captureLinks=[],callbackScopes=new Map(),callbackCaptureNames=new Map();
        const nativeBitwisePrimitiveResults=new Set();
        const inspectionOperatorProofs=new Map(),inspectionLeaves=new Map(),inspectionProducers=new Map(),inspectionOpaqueCells=new Set(),inspectionOperators=[],spriteFlagResults=new Map(),spriteFlagWriterInputs=new Map(),inspectionGlobalReaders=new Map(),inspectionVisited=new Set();
        const throwInputs=new Map(),procedureInputs=[],inspectionInputs=new Map(),scoreThresholdInputs=new Map(),nativeBitwiseInputs=new Map(),sourceBitwiseInputs=new Map(),sourceBitwiseConstructorResults=new Set(),sourceTypeOfInputs=new Map(),sourceTypeOfClasses=new Map(),opaqueCells=new Set(),arrayLocalReaders=new Map();
        const inputBlock = (blocks, b, name) => {
            const input=b.inputs?.[name]?.[1];
            if(Array.isArray(input) && input[0]===12) return {opcode:'data_variable',fields:{VARIABLE:[input[1],input[2]]}};
            if(Array.isArray(input) && input[0]===10)return {opcode:'bw_stringLiteral',value:input[1]};
            if(Array.isArray(input) && [4,5,6,7,8].includes(input[0]))return {opcode:'bw_numberLiteral',value:Number(input[1])};
            return blocks[input];
        };
        const literal = (blocks, b, name) => {
            if(isArrayMenuSelector(b,name))return arrayMenuLiteral({blocks},b,name);
            if(b.fields?.[name])return String(b.fields[name][0]);
            const input = b.inputs?.[name]?.[1];
            return Array.isArray(input) ? String(input[1]) : String(blocks[input]?.fields?.TEXT?.[0] || '');
        };
        // A local reset (:= undefined/null) immediately followed by its definite
        // overwrite (a direct set, or an if/else writing it in both branches
        // before any exit) whose value does not read the local, and never
        // captured, cannot be observed and is not a producer of that local.
        const deadLocalReset=(blocks,block)=>{
            const fixed=value=>value?.opcode==='arrays_specialValue'&&!Object.keys(value.inputs||{}).length&&['undefined','null'].includes(value.fields?.KIND?.[0]);
            if(block?.opcode!=='arcade_setLocal'||!fixed(inputBlock(blocks,block,'VALUE')))return false;
            const name=literal(blocks,block,'NAME');
            if(Object.values(blocks).some(b=>['arcade_getCaptured','arcade_setCaptured'].includes(b?.opcode)&&literal(blocks,b,'NAME')===name))return false;
            const reads=(value,seen=new Set())=>{if(!value||seen.has(value))return false;seen.add(value);if(value.opcode==='arcade_getLocal'&&literal(blocks,value,'NAME')===name)return true;
                return Object.entries(value.inputs||{}).some(([key,slot])=>!key.startsWith('SUBSTACK')&&typeof slot?.[1]==='string'&&reads(blocks[slot[1]],seen));};
            const direct=n=>n?.opcode==='arcade_setLocal'&&literal(blocks,n,'NAME')===name&&!fixed(inputBlock(blocks,n,'VALUE'))&&!reads(inputBlock(blocks,n,'VALUE'));
            const branch=id=>{const seen=new Set();for(let n=blocks[id];n&&!seen.has(n);n=blocks[n.next]){seen.add(n);if(direct(n))return true;if(/return|stop|break|continue|throw/i.test(n.opcode))return false;}return false;};
            const next=blocks[block.next];
            return direct(next)||next?.opcode==='control_if_else'&&branch(next.inputs?.SUBSTACK?.[1])&&branch(next.inputs?.SUBSTACK2?.[1]);
        };
        const inspectionCaptures=analyseConsoleCaptures({targets:this.project.targets,blocks:target=>target.blocks||{},
            input:(node,name,target)=>inputBlock(target.blocks||{},node,name),
            literal:(node,name,target)=>{
                if(node?.fields?.[name])return String(node.fields[name][0]);
                const slot=node?.inputs?.[name]?.[1];
                return Array.isArray(slot)&&slot[0]===10?String(slot[1]):target.blocks?.[slot]?.opcode==='text'?target.blocks[slot].fields?.TEXT?.[0]:null;
            }});
        const inspectionCellKey=cell=>cell.scope.procedure?
            `${cell.scope.target.isStage?'':cell.scope.target.name}:${cell.scope.procedure}:${cell.scope.params.includes(cell.name)?'param':'local'}:${cell.name}`:
            `${cell.scope.target.name}:script:${cell.scope.id}:local:${cell.name}`;
        for (const target of this.project.targets) {
            const blocks = target.blocks || {};
            for (const b of Object.values(blocks)) {
                if (b.opcode !== 'procedures_definition') continue;
                const proto = inputBlock(blocks,b,'custom_block');
                if (!proto?.mutation) continue;
                const key = `${target.isStage ? '' : target.name}:${proto.mutation.proccode}`;
                const names = JSON.parse(proto.mutation.argumentnames || '[]');
                const keys = names.map(name => `${key}:param:${name}`);
                if(parameters.has(key)||new Set(names).size!==names.length){for(const name of [...keys,...(parameters.get(key)||[])])inspectionOpaqueCells.add(name);inspectionOpaqueCells.add(`${key}:result`);}
                parameters.set(key, keys);
                definitions.push({target,blocks,b,key});
            }
        }
        for (const target of this.project.targets) for (const [id,b] of Object.entries(target.blocks || {})) {
            if (b.topLevel && b.opcode !== 'procedures_definition') definitions.push({target,blocks:target.blocks,b,key:`${target.name}:script:${id}`});
        }
        for(const {blocks,b,key} of definitions)if(Object.prototype.hasOwnProperty.call(REGISTERED_HAT_KINDS,b.opcode)){
            callbackScopes.set(literal(blocks,b,'TOKEN'),key);
            const names=new Set(),seen=new Set();
            const collect=id=>{
                if(typeof id!=='string' || seen.has(id) || !blocks[id])return;
                seen.add(id);const value=blocks[id];
                if(['arcade_getCaptured','arcade_setCaptured'].includes(value.opcode))names.add(literal(blocks,value,'NAME'));
                for(const input of Object.values(value.inputs||{}))collect(input[1]);
                collect(value.next);
            };
            collect(b.next);callbackCaptureNames.set(key,names);
        }
        for (const {target,blocks,b,key} of definitions) {
            const localKey = name => parameters.get(key)?.includes(`${key}:param:${name}`) ? `${key}:param:${name}` : `${key}:local:${name}`;
            // Capture bindings belong to the registering script, even when another
            // procedure or callback uses the same local name in this target.
            const scopeBlocks = new Set();
            const collectScope = id => {
                if (typeof id !== 'string' || scopeBlocks.has(id) || !blocks[id]) return;
                scopeBlocks.add(id);
                for (const input of Object.values(blocks[id].inputs || {})) collectScope(input[1]);
                collectScope(blocks[id].next);
            };
            collectScope(b.next);
            const scopeValues = [...scopeBlocks].map(id => blocks[id]);
            const fixedName=value=>{const input=value.inputs?.NAME?.[1];return value.fields?.NAME?.[0]??(Array.isArray(input)&&input[0]===10?String(input[1]):blocks[input]?.opcode==='text'?blocks[input].fields?.TEXT?.[0]:null);};
            const unsafeInspectionLocals=scopeValues.some(value=>value.opcode==='arcade_setLocal'&&typeof fixedName(value)!=='string'||value.opcode==='arcade_createCallable');
            const physicalNumber=value=>value?.opcode==='bw_numberLiteral'?value.value:value?.opcode==='math_number'?Number(value.fields?.NUM?.[0]):null;
            const ownsEventPlayer=value=>{
                if(b.opcode!=='arcade_whenRegisteredMultiplayerConnection')return false;
                const token=literal(blocks,b,'TOKEN');if(!token)return false;
                const hats=Object.values(blocks).filter(node=>node.opcode===b.opcode&&literal(blocks,node,'TOKEN')===token);
                const registrations=Object.values(blocks).filter(node=>node.opcode==='arcade_registerMultiplayerConnection'&&literal(blocks,node,'TOKEN')===token);
                if(hats.length!==1||registrations.length!==1||![1,2].includes(physicalNumber(inputBlock(blocks,registrations[0],'EVENT'))))return false;
                const parents=new Set();let current=value;
                while(current&&current!==b){
                    if(parents.has(current))return false;parents.add(current);
                    const parent=blocks[current.parent],id=Object.keys(blocks).find(id=>blocks[id]===current);
                    if(!parent||parent.next!==id&&!Object.values(parent.inputs||{}).some(slot=>slot[1]===id))return false;
                    current=parent;
                }
                return current===b;
            };
            const ref = value => {
                if (!value) return null;
                if(value.opcode==='arrays_namedReference'){const id='named-array:'+literal(blocks,value,'NAME');arrays.add(id);return id;}
                if(value.opcode==='arrays_jsonValue'){const id=Symbol('JSON aggregate text');strings.add(id);return id;}
                if(['arrays_parseLegacyValue','arrays_pop'].includes(value.opcode)){const id=Symbol('legacy value');anys.add(id);return id;}
                if(value.opcode==='arcade_settingsExists'){const id=Symbol('setting exists');booleans.add(id);return id;}
                if(value.opcode==='arcade_settingsRead'){
                    const type=settingType(value, blocks),id=Symbol('setting value');
                    if(type==='Number')numbers.add(id);else if(type==='String')strings.add(id);else if(type==='Buffer')graphBufferValues.add(id);
                    else if(type==='NumberArray' || type==='StringArray' || type==='List'){arrays.add(id);const item=Symbol('setting array item');(type==='NumberArray'?numbers:strings).add(item);elements.push([id,item]);}
                    else anys.add(id);return id;
                }
                if(value.opcode==='arcade_spriteDataRead') {
                    const type=directMenuValue(value,'TYPE',blocks);
                    const id=Symbol('sprite data value');
                    if(type==='Number')numbers.add(id);else if(type==='String')strings.add(id);else if(type==='Sprite')sprites.add(id);else anys.add(id);
                    return id;
                }
                if(value.opcode==='arcade_spriteDataReadBoolean'){const id=Symbol('sprite data boolean');booleans.add(id);return id;}
                if(['arcade_createSpriteKind','arcade_spriteKindValue'].includes(value.opcode)){const id=Symbol('sprite kind number');numbers.add(id);return id;}
                if(value.opcode==='arcade_askForStringLength'){
                    if(boundedTextPromptInputs(value)){
                        const id=Symbol('bounded text prompt String');strings.add(id);inspectionLeaves.set(id,'string');return id;
                    }
                }
                if(['arrays_stringFromCharCode','arrays_stringConcat'].includes(value.opcode)){const id=Symbol('string primitive');strings.add(id);return id;}
                if(value.opcode==='arrays_stringCharCodeAt'){const id=Symbol('character code number');numbers.add(id);return id;}
                if(['arcade_spriteToString','arcade_characterRuleToString'].includes(value.opcode)) {const id=Symbol('sprite text');strings.add(id);return id;}
                if(['arcade_createBuffer','arcade_bufferFromHex','arcade_bufferFromUTF8','arcade_bufferFromBase64','arcade_bufferLiteral','arcade_bufferSlice','arcade_bufferConcat','arcade_bufferFromArray','arcade_bufferConcatArray','arcade_bufferPack'].includes(value.opcode)){const id=Symbol('byte buffer');graphBufferValues.add(id);return id;}
                if(['arcade_bufferToArray','arcade_bufferChunked','arcade_bufferChunkedFromUTF8','arcade_bufferUnpack'].includes(value.opcode)){const id=`${key}:buffer-array:${Object.keys(blocks).find(id=>blocks[id]===value)}`;arrays.add(id);return id;}
                if(['arcade_bufferLength','arcade_bufferHash','arcade_bufferGetByte','arcade_bufferGetNumber','arcade_bufferIndexOf','arcade_bufferFormatSize','arcade_bufferPackedSize'].includes(value.opcode)){const id=Symbol('buffer number');numbers.add(id);return id;}
                if(['arcade_bufferToHex','arcade_bufferToText','arcade_bufferToBase64'].includes(value.opcode)){const id=Symbol('buffer text');strings.add(id);return id;}
                if(['arcade_bufferIsReadOnly','arcade_bufferEquals'].includes(value.opcode)){const id=Symbol('buffer readonly');booleans.add(id);return id;}
                if(currentSceneClockNumber(blocks,value)) {const id=Symbol('current scene clock Number');numbers.add(id);inspectionLeaves.set(id,'number');return id;}
                if(value.opcode==='arcade_frameDeltaTime'){
                    const id=Symbol('current saved frame delta Number');
                    if(this.frameDeltaNumberResult(target,value)){numbers.add(id);inspectionLeaves.set(id,'number');}
                    else {anys.add(id);inspectionOpaqueCells.add(id);}
                    return id;
                }
                if(value.opcode==='arcade_mathBinary'){
                    const id=Symbol('closed math normal result');
                    if(this.mathNumberResult(target,value)){numbers.add(id);inspectionLeaves.set(id,'number');}
                    else {anys.add(id);inspectionOpaqueCells.add(id);}
                    return id;
                }
                if(value.opcode==='bw_numberLiteral' || value.opcode==='math_number') {const id=Symbol('number value');numbers.add(id);inspectionLeaves.set(id,'number');return id;}
                if(value.opcode==='bw_stringLiteral') {const id=Symbol('string value');strings.add(id);inspectionLeaves.set(id,'string');return id;}
                if(['arrays_valueBinary','arrays_valueUnary','arcade_sourceValueBinary','arcade_sourceValueUnary'].includes(value.opcode)) {
                    const id=`${key}:value-operation:${Object.keys(blocks).find(id=>blocks[id]===value)}`;
                    const source=['arcade_sourceValueBinary','arcade_sourceValueUnary'].includes(value.opcode),operation=source&&sourceValueOperation(value);
                    if(source&&!operation){inspectionOpaqueCells.add(id);anys.add(id);return id;}
                    // A valid fixed source bitwise opcode returns Number or
                    // refuses; this signature lends no domain to its operands.
                    if(operation&&(operation.unary||['&','|','^','<<','>>','>>>'].includes(operation.op))){numbers.add(id);inspectionLeaves.set(id,'number');return id;}
                    const operands=(value.opcode==='arrays_valueUnary'?['VALUE']:['LEFT','RIGHT']).map(name=>ref(inputBlock(blocks,value,name)));
                    // Preserve the original operand/caller inventory before
                    // consuming an independent occurrence result. No variable,
                    // Array or generic arithmetic signature supplies this fact.
                    if(value.opcode==='arrays_valueBinary'&&this.mathNumberResult(target,value)){
                        numbers.add(id);inspectionLeaves.set(id,'number');return id;
                    }
                    // The canonical native bitwise adapter returns a Number or
                    // decoded Undefined on conversion failure. This is only a
                    // primitive result union, never a Number-only fact or a
                    // licence for its operands (every operation keeps its gate).
                    const nativeUnary=value.opcode==='arrays_valueUnary',nativeInputs=nativeUnary?['VALUE']:['LEFT','RIGHT'];
                    if(!source&&value.mutation==null&&value.shadow===false&&value.topLevel===false&&value.next==null&&
                        Object.keys(value.fields||{}).join(',')==='OP'&&Object.keys(value.inputs||{}).sort().join(',')===nativeInputs.slice().sort().join(',')&&
                        (nativeUnary?literal(blocks,value,'OP')==='~':['&','|','^','<<','>>','>>>'].includes(literal(blocks,value,'OP'))))nativeBitwisePrimitiveResults.add(id);
                    if(value.opcode==='arcade_sourceValueBinary'&&literal(blocks,value,'OP')==='+')anys.add(id);
                    else if(value.opcode==='arrays_valueBinary' && literal(blocks,value,'OP')==='+')valueOperations.push([id,...operands]);
                    else numbers.add(id);
                    const dynamicPlus=literal(blocks,value,'OP')==='+'&&['arrays_valueBinary','arcade_sourceValueBinary'].includes(value.opcode);
                    inspectionOperatorProofs.set(id,{type:dynamicPlus?null:'number',operands,numeric:literal(blocks,value,'OP')!=='+'||value.opcode==='arrays_valueUnary',numberPlus:dynamicPlus&&operands.length===2});
                    return id;
                }
                if(value.opcode==='arrays_specialValue'){const id=Symbol('special value');specialTypes.push([id,literal(blocks,value,'KIND')]);inspectionLeaves.set(id,literal(blocks,value,'KIND'));return id;}
                if(this.isBoolean(value) || ['operator_add','operator_subtract','operator_multiply','operator_divide','operator_mod','operator_round','operator_random','operator_join','operator_letter_of','operator_length','planetemaths_min','planetemaths_max'].includes(value.opcode)) {
                    const id=`${key}:primitive:${Object.keys(blocks).find(id=>blocks[id]===value)}`;
                    (this.isBoolean(value)?booleans:['operator_join','operator_letter_of'].includes(value.opcode)?strings:numbers).add(id);const operands=Object.keys(value.inputs||{}).map(name=>ref(inputBlock(blocks,value,name)));inspectionOperators.push([id,operands]);inspectionOperatorProofs.set(id,{type:this.isBoolean(value)?'boolean':['operator_join','operator_letter_of'].includes(value.opcode)?'string':'number',operands});return id;
                }
                if (/^argument_reporter_/.test(value.opcode)){const id=`${key}:param:${value.fields.VALUE[0]}`;if(unsafeInspectionLocals||!inspectionCaptures.proof(inspectionCaptures.local(inspectionCaptures.scopeOf(value),value.fields.VALUE[0])))inspectionOpaqueCells.add(id);return id;}
                if (value.opcode === 'arcade_getCaptured'){const id=`${key}:capture:${literal(blocks,value,'NAME')}`,cell=inspectionCaptures.captured(inspectionCaptures.scopeOf(value),fixedName(value));if(!inspectionCaptures.proof(cell))inspectionOpaqueCells.add(id);else connect(id,inspectionCellKey(cell));return id;}
                if (value.opcode === 'arcade_getLocal') {const cell=localKey(literal(blocks,value,'NAME'));if(unsafeInspectionLocals||typeof fixedName(value)!=='string'||!inspectionCaptures.proof(inspectionCaptures.local(inspectionCaptures.scopeOf(value),fixedName(value))))inspectionOpaqueCells.add(cell);arrayLocalReaders.set(value,cell);return cell;}
                if (value.opcode === 'arcade_callFunction') {
                    const code=`${target.isStage ? '' : target.name}:${literal(blocks,value,'NAME')}`,id=`${code}:result`;
                    if(this.objectClassExport.procedures.has(code))opaqueCells.add(id);
                    return id;
                }
                if (value.opcode === 'data_variable'){const id=`variable:${value.fields.VARIABLE[1] || value.fields.VARIABLE[0]}`;if(!inspectionGlobalReaders.has(id))inspectionGlobalReaders.set(id,new Set());inspectionGlobalReaders.get(id).add(target);return id;}
                if(value.opcode==='arcade_eventLocation'){const id=Symbol('event tile location');tiles.add(id);return id;}
                if(['arcade_tilemapValue','arcade_eventTilemapData'].includes(value.opcode) || value.opcode==='arcade_sceneTilemapProperty' && value.fields?.PROPERTY?.[0]==='data'){const id=`${key}:tilemap:${Object.keys(blocks).find(id=>blocks[id]===value)}`;tilemaps.add(id);return id;}
                // The scene's tiles.TileMap: an SDK object exported untyped.
                if(value.opcode==='arcade_tileLocationTilemap'){const id=Symbol('scene TileMap');anys.add(id);return id;}
                if(value.opcode==='arcade_sceneTilemapProperty'){const id=Symbol('scene TileMap property');(value.fields?.PROPERTY?.[0]==='enabled'?booleans:numbers).add(id);return id;}
                if(value.opcode==='arcade_tilemapTileset'){const id=`${key}:image-array:${Object.keys(blocks).find(id=>blocks[id]===value)}`;arrays.add(id);return id;}
                if(value.opcode==='arcade_legacyTileLocation'){const id=Symbol('legacy tile');legacyTiles.add(id);return id;}
                if(value.opcode==='arcade_legacyTilesOfType'){const id=Symbol('legacy tiles');arrays.add(id);return id;}
                if(['arcade_tileNeighbor','arcade_spriteTileLocation','arcade_randomTileOfType'].includes(value.opcode)){const id=`${key}:tile:${Object.keys(blocks).find(id=>blocks[id]===value)}`;tiles.add(id);return id;}
                if(value.opcode==='arcade_tileLocation'){const id=`${key}:tile:${Object.keys(blocks).find(id=>blocks[id]===value)}`;tiles.add(id);return id;}
                if(value.opcode==='arcade_tilesOfType'){const id=`${key}:tile-array:${Object.keys(blocks).find(id=>blocks[id]===value)}`;arrays.add(id);return id;}
                if(['arcade_getLife','arcade_getPlayerScore'].includes(value.opcode)){const id=Symbol('player life');numbers.add(id);return id;}
                if(value.opcode==='arcade_spriteProperty' && value.fields?.PROPERTY?.[0]==='flags'){
                    const id=Symbol('closed Sprite flags primitive'),writers=this.spriteFlagWriters(target,value);
                    if(writers){spriteFlagResults.set(id,{target,node:value,writers});return id;}
                    inspectionOpaqueCells.add(id);return id;
                }
                if(value.opcode==='arcade_spriteProperty' && value.fields?.PROPERTY?.[0]==='data'){
                    const id=Symbol('sprite data');dataProperties.push([ref(inputBlock(blocks,value,'ID')),id]);return id;
                }
                // The plain geometry accessors are Numbers only for a receiver that is not a procedure parameter: a parameter's Sprite
        // type is itself an unproven obligation here (a malformed flags receiver must keep its visible refusal).
        const geometryReceiverOk=!/^argument_reporter/.test(inputBlock(blocks,value,'ID')?.opcode||'argument_reporter');
                if(value.opcode==='arcade_spriteProperty' && ['fx','fy','sx','sy','scale','rotation','rotationDegrees'].includes(value.fields?.PROPERTY?.[0])||
                    value.opcode==='arcade_spriteProperty' && geometryReceiverOk && value.mutation==null && Object.keys(value.fields||{}).join(',')==='PROPERTY' &&
                    ['x','y','vx','vy','ax','ay','left','right','top','bottom','width','height'].includes(value.fields?.PROPERTY?.[0])){const id=Symbol('sprite numeric property');numbers.add(id);return id;}
                if(value.opcode==='arcade_tileHitFrom'){const id=Symbol('hit tile index');numbers.add(id);return id;}
                if(['arcade_cameraProperty','arcade_cameraDrawOffset'].includes(value.opcode)){const id=Symbol('camera numeric property');numbers.add(id);return id;}
                if(['arcade_tileLocationProperty','arcade_legacyTileProperty'].includes(value.opcode)){const id=Symbol('tile numeric property');numbers.add(id);return id;}
                if(['arcade_playerLookup','arcade_playerBySprite','arcade_eventPlayer'].includes(value.opcode)){const id=Symbol('player value');graphPlayerValues.add(id);if(value.opcode==='arcade_eventPlayer'&&ownsEventPlayer(value))inspectionLeaves.set(id,'Player');return id;}
                if(value.opcode==='arcade_allPlayers'){const id=Symbol('player array');arrays.add(id);return id;}
                if(['arcade_playerConnected','arcade_playerButtonPressed','arcade_ask'].includes(value.opcode)){const id=Symbol('player button pressed');booleans.add(id);return id;}
                if(['arcade_createPlayerState','arcade_getPlayerState'].includes(value.opcode)){const id=Symbol('player state number');numbers.add(id);return id;}
                if(value.opcode==='arcade_playerProperty'){
                    const id=Symbol('player property');numbers.add(id);
                    const valid=literal(blocks,value,'READ')==='safe'&&physicalNumber(inputBlock(blocks,value,'PROPERTY'))===2;
                    inspectionOperatorProofs.set(id,{type:'number',operands:[ref(inputBlock(blocks,value,'PLAYER'))],domain:valid?['Player','null','undefined']:[],requirePlayer:true});return id;
                }
                if(value.opcode==='arcade_currentScene'){const id=Symbol('scene value');graphSceneValues.add(id);return id;}
                if(['arcade_scenePhysicsEngine','arcade_createPhysicsEngine'].includes(value.opcode)){const id=Symbol('physics engine value');graphPhysicsEngineValues.add(id);return id;}
                if(['arcade_sourceTypeOf','arcade_inspectValue'].includes(value.opcode)){const id=Symbol('owned String reporter result');strings.add(id);return id;}
                if(['arcade_physicsEngineProperty','arcade_sceneFlags','arcade_fontMetric'].includes(value.opcode)){const id=Symbol('physics engine numeric property');numbers.add(id);return id;}
                if(value.opcode==='arcade_createAnimation'){const id=Symbol('animation value');graphAnimationValues.add(id);return id;}
                if(value.opcode==='arcade_sevensegDigit'){const id=Symbol('seven segment digit');graphSevensegDigitValues.add(id);return id;}
                if(value.opcode==='arcade_sevensegCounter'){const id=Symbol('seven segment counter');graphSevensegCounterValues.add(id);return id;}
                if(value.opcode==='arcade_sevensegProperty'){const id=Symbol('seven segment property');numbers.add(id);return id;}
                if(value.opcode==='arcade_textSpriteCreate'){const id=Symbol('text sprite');graphTextSpriteValues.add(id);sprites.add(id);return id;}
                if(value.opcode==='arcade_textSpriteProperty'){const id=Symbol('text sprite property');const property=directMenuValue(value,'PROPERTY',blocks);(property==='text'?strings:property==='icon'?images:numbers).add(id);return id;}
                if(value.opcode==='arcade_createDart'){const id=Symbol('dart');graphDartValues.add(id);sprites.add(id);return id;}
                if(value.opcode==='arcade_createCorgi'){const id=Symbol('corgi');graphCorgiValues.add(id);sprites.add(id);return id;}
                if(['arcade_dartProperty','arcade_corgiProperty','arcade_backgroundScrollOffset','arcade_characterRule'].includes(value.opcode)){const id=Symbol('extension property');numbers.add(id);return id;}
                if(value.opcode==='arcade_animationProperty'){const id=Symbol('animation property');(literal(blocks,value,'PROPERTY')==='image'?images:numbers).add(id);return id;}
                if(['arcade_animationAssetFrames','arcade_animationAssetFreshFrames'].includes(value.opcode)) {
                    const id=Symbol('authored animation array'), item=Symbol('authored animation image');
                    arrays.add(id); images.add(item); elements.push([id,item]); return id;
                }
                if(value.opcode==='arcade_animationAssetInterval'){const id=Symbol('animation interval');numbers.add(id);return id;}
                if(value.opcode==='arcade_spritesOfKind'){const id=`${key}:sprite-array:${Object.keys(blocks).find(id=>blocks[id]===value)}`;arrays.add(id);return id;}
                if (['arrays_createReference','arrays_referenceSlice','arrays_referenceConcat','arrays_referenceItem','arrays_referenceTake','arrays_referenceRandom'].includes(value.opcode)) {
                    const id=`${key}:array-value:${Object.keys(blocks).find(id=>blocks[id]===value)}`;
                    if(['arrays_createReference','arrays_referenceSlice','arrays_referenceConcat'].includes(value.opcode))arrays.add(id);
                    // Canonical createReference returns an Array or its
                    // legacy error fallback String. Retain only that union for
                    // source bitwise use, never an Array-only/input/body loan.
                    if(value.opcode==='arrays_createReference')sourceBitwiseConstructorResults.add(id);return id;
                }
                if (['arcade_playerSprite','arcade_spawnSprite','arcade_spawnProjectile','arcade_spawnImageSprite','arcade_spawnImageProjectile','arcade_eventSprite', 'arcade_createSprite', 'arcade_createImageSprite'].includes(value.opcode)) {
                    const id = `${key}:sprite:${Object.keys(blocks).find(id => blocks[id] === value)}`;
                    sprites.add(id);return id;
                }
                if (['arcade_createImage','arcade_cloneImage','arcade_spriteImage','arcade_frameImage','arcade_backgroundImage','arcade_tileAtLocation','arcade_tilemapTileImage'].includes(value.opcode)) {
                    const id = `${key}:image:${Object.keys(blocks).find(id => blocks[id] === value)}`;
                    images.add(id);return id;
                }
                const ownedTypes=this.objectClassExport.valueTypes(target,value);
                if(ownedTypes.size){
                    const id=Symbol('declared class value');
                    if(['arcade_objectField','arcade_callObjectMethod'].includes(value.opcode))opaqueCells.add(id);
                    sourceTypeOfClasses.set(id,ownedTypes);return id;
                }
                return null;
            };
            const connect = (a,c) => {if(a){if(!inspectionProducers.has(a))inspectionProducers.set(a,new Set());inspectionProducers.get(a).add(c);}if (a && c) edges.push([a,c]);else if(a)opaqueCells.add(a); };
            const seen = new Set();
            const visit = id => {
                if (typeof id !== 'string' || seen.has(id) || !blocks[id]) return;
                if(this.isUnreachable(target,blocks[id]))return;
                seen.add(id);const block = blocks[id];inspectionVisited.add(block);
                if(block.opcode==='arcade_throwValue'){
                    const operand=inputBlock(blocks,block,'VALUE');
                    throwInputs.set(block,ref(operand?.opcode==='text'&&operand.shadow&&!Object.keys(operand.inputs||{}).length&&typeof operand.fields?.TEXT?.[0]==='string'?{opcode:'bw_stringLiteral',value:operand.fields.TEXT[0]}:operand));
                }
                for(const obligation of this.procedureConstraints?.obligations(block)||[]){
                    const actual=inputBlock(blocks,block,obligation.input);
                    const operand=actual?.opcode==='text'&&actual.shadow&&!Object.keys(actual.inputs||{}).length&&typeof actual.fields?.TEXT?.[0]==='string'?{opcode:'bw_stringLiteral',value:actual.fields.TEXT[0]}:actual;
                    procedureInputs.push({block,obligation,value:ref(operand)});
                }
                if(['arcade_setSpriteProperty','arcade_setSpriteFlag','arcade_setSpriteStayInScreen','arcade_setSpriteAutoDestroy','arcade_setSpriteBounceOnWall','arcade_setSpriteGhostThroughSprites'].includes(block.opcode))spriteFlagWriterInputs.set(block,ref(inputBlock(blocks,block,block.opcode==='arcade_setSpriteProperty'?'VALUE':'ON')));
                if(block.opcode==='arcade_inspectValue')inspectionInputs.set(block,{value:ref(inputBlock(blocks,block,'VALUE')),limit:ref(inputBlock(blocks,block,'LIMIT'))});
                if(block.opcode==='arcade_registerScoreHandler')scoreThresholdInputs.set(block,ref(inputBlock(blocks,block,'SCORE')));
                if(block.opcode==='arrays_valueUnary'&&literal(blocks,block,'OP')==='~'||block.opcode==='arrays_valueBinary'&&['&','|','^','<<','>>','>>>'].includes(literal(blocks,block,'OP')))
                    nativeBitwiseInputs.set(block,(block.opcode==='arrays_valueUnary'?['VALUE']:['LEFT','RIGHT']).map(name=>ref(inputBlock(blocks,block,name))));
                const sourceOperation=sourceValueOperation(block);
                if(sourceOperation&&(sourceOperation.unary||['&','|','^','<<','>>','>>>'].includes(sourceOperation.op)))
                    sourceBitwiseInputs.set(block,sourceOperation.inputs.map(name=>ref(inputBlock(blocks,block,name))));
                if(block.opcode==='arcade_sourceTypeOf'){
                    const operand=inputBlock(blocks,block,'VALUE');
                    sourceTypeOfInputs.set(block,operand?ref(operand):null);
                }
                for (const input of ['arcade_blitImage','arcade_imagesOverlap','arcade_copyImageFrom'].includes(block.opcode) ? ['IMAGE', 'SOURCE'] : ['IMAGE']) {
                    const image = ref(inputBlock(blocks,block,input));if(image)images.add(image);
                }
                if(block.inputs?.BUFFER){const buffer=ref(inputBlock(blocks,block,'BUFFER'));if(buffer)graphBufferValues.add(buffer);}
                if(['arcade_bufferFromArray','arcade_bufferConcatArray','arcade_bufferToArray','arcade_bufferChunked','arcade_bufferChunkedFromUTF8','arcade_bufferPack','arcade_bufferPackAt','arcade_bufferUnpack'].includes(block.opcode)){
                    const array=['arcade_bufferToArray','arcade_bufferChunked','arcade_bufferChunkedFromUTF8','arcade_bufferUnpack'].includes(block.opcode)?ref(block):ref(inputBlock(blocks,block,'ARRAY'));
                    if(array){arrays.add(array);const item=Symbol('buffer array element');
                        (['arcade_bufferConcatArray','arcade_bufferChunked','arcade_bufferChunkedFromUTF8'].includes(block.opcode)?graphBufferValues:numbers).add(item);elements.push([array,item]);}
                }
                if(block.opcode==='arcade_bufferWrite'){const buffer=ref(inputBlock(blocks,block,'SOURCE'));if(buffer)graphBufferValues.add(buffer);}
                if(['arcade_bufferConcat','arcade_bufferEquals','arcade_bufferIndexOf'].includes(block.opcode)){const buffer=ref(inputBlock(blocks,block,'OTHER'));if(buffer)graphBufferValues.add(buffer);}
                if(/^arcade_textSprite/.test(block.opcode)){
                    const id=ref(inputBlock(blocks,block,'ID'));if(id){graphTextSpriteValues.add(id);sprites.add(id);}
                    if(block.opcode==='arcade_textSpriteSetIcon'){const image=ref(inputBlock(blocks,block,'IMAGE'));if(image)images.add(image);}
                    if(block.opcode==='arcade_textSpriteSetProperty'){const property=directMenuValue(block,'PROPERTY',blocks),value=ref(inputBlock(blocks,block,'VALUE'));if(value)(property==='text'?strings:property==='icon'?images:numbers).add(value);}
                }
                if(block.opcode==='arcade_eventPlayer'){const player=ref(block);if(player)graphPlayerValues.add(player);}
                if(['arcade_playerSprite','arcade_setPlayerSprite','arcade_playerProperty','arcade_movePlayerWithButtons','arcade_playerConnected','arcade_playerButtonPressed','arcade_getPlayerState','arcade_setPlayerState','arcade_changePlayerState'].includes(block.opcode)){
                    const player=ref(inputBlock(blocks,block,'PLAYER'));if(player)graphPlayerValues.add(player);
                }
                if(block.opcode==='arcade_allPlayers'){const array=ref(block),item=Symbol('player collection element');graphPlayerValues.add(item);elements.push([array,item]);}
                if(block.inputs?.SCENE){const value=ref(inputBlock(blocks,block,'SCENE'));if(value)graphSceneValues.add(value);}
                if(block.inputs?.ENGINE){const value=ref(inputBlock(blocks,block,'ENGINE'));if(value)graphPhysicsEngineValues.add(value);}
                if(block.inputs?.ANIMATION){const animation=ref(inputBlock(blocks,block,'ANIMATION'));if(animation)graphAnimationValues.add(animation);}
                if(block.opcode==='arcade_runImageAnimation'){const array=ref(inputBlock(blocks,block,'FRAMES'));if(array){arrays.add(array);const item=Symbol('animation frame');images.add(item);elements.push([array,item]);}}
                for (const input of ['ID', ...(block.opcode === 'arcade_spriteOverlaps' ? ['A','B'] : []), ...(['arcade_spawnProjectile','arcade_spawnImageProjectile'].includes(block.opcode) ? ['SOURCE'] : [])]) {
                    const sprite = ref(inputBlock(blocks,block,input));if(sprite)sprites.add(sprite);
                }
                if(block.opcode.startsWith('arrays_') && block.inputs?.NAME){const id='named-array:'+literal(blocks,block,'NAME');arrays.add(id);const value=Symbol('named array element');anys.add(value);elements.push([id,value]);}
                if(block.inputs?.TILE){const tile=ref(inputBlock(blocks,block,'TILE'));if(tile)legacyTiles.add(tile);}
                if(block.inputs?.LOCATION){const location=ref(inputBlock(blocks,block,'LOCATION'));if(location)tiles.add(location);}
                if(block.inputs?.DATA && /^arcade_(tilemap(Property|Tile|IsWall|TileImage|Tileset)|setTilemap(Tile|Wall|Scale))$/.test(block.opcode)){const data=ref(inputBlock(blocks,block,'DATA'));if(data)tilemaps.add(data);}
                if(['arcade_tileLocation','arcade_legacyTileLocation'].includes(block.opcode))for(const name of ['COLUMN','ROW']){const number=ref(inputBlock(blocks,block,name));if(number)numbers.add(number);}
                if(block.opcode==='arcade_legacyTilesOfType'){const array=ref(block),item=Symbol('legacy tile element');legacyTiles.add(item);elements.push([array,item]);}
                if(block.opcode==='arcade_tilesOfType'){const array=ref(block),item=Symbol('tile collection element');tiles.add(item);elements.push([array,item]);}
                if(block.opcode==='arcade_tilemapTileset'){const array=ref(block),item=Symbol('tileset element');images.add(item);elements.push([array,item]);}
                if(block.opcode==='arcade_spritesOfKind'){const array=ref(block),item=Symbol('sprite collection element');sprites.add(item);elements.push([array,item]);}
                if(block.opcode==='arrays_createReference'){
                    const array=ref(block);let current=inputBlock(blocks,block,'VALUES');
                    while(current?.opcode==='arrays_referenceValues'){elements.push([array,ref(inputBlock(blocks,current,'VALUE'))]);current=inputBlock(blocks,current,'REST');}
                }
                if(['arrays_referenceSlice','arrays_referenceConcat'].includes(block.opcode)){
                    arrayCopies.push([ref(inputBlock(blocks,block,'ARRAY')),ref(block)]);
                    if(block.opcode==='arrays_referenceConcat')arrayCopies.push([ref(inputBlock(blocks,block,'OTHER')),ref(block)]);
                }
                if(['arrays_referenceItem','arrays_referenceTake','arrays_referenceRandom','arrays_referenceRemove','arrays_mutateReference','arrays_referenceLength','arrays_referenceIndexOf','arrays_referenceTruthy'].includes(block.opcode)){
                    const array=ref(inputBlock(blocks,block,'ARRAY'));if(array)arrays.add(array);
                    const index=ref(inputBlock(blocks,block,'INDEX'));if(index)numbers.add(index);
                    if(['arrays_referenceItem','arrays_referenceTake','arrays_referenceRandom'].includes(block.opcode))elements.push([array,ref(block)]);
                    if(isArrayMenuSelector(block,'OP')){
                        const operation=literal(blocks,block,'OP');
                        if(!isKnownArrayMenuOperation(block,operation)){
                            const unknown=Symbol('unproved Array selector element');anys.add(unknown);opaqueCells.add(unknown);elements.push([array,unknown]);
                        }else if(block.opcode==='arrays_mutateReference'&&['push','unshift','insertAt','set'].includes(operation))elements.push([array,ref(inputBlock(blocks,block,'VALUE'))]);
                    }
                }
                if(REGISTERED_COMMANDS.has(block.opcode)){
                    const scope=callbackScopes.get(literal(blocks,block,'TOKEN'));
                    const explicit=new Set(literal(blocks,block,'CAPTURES').split(/\s+/).filter(Boolean));
                    for(const name of new Set([...explicit,...(callbackCaptureNames.get(scope)||[])]))if(scope){
                        const captured=scopeValues.some(value=>value.opcode==='arcade_getCaptured' && literal(blocks,value,'NAME')===name);
                        const local=scopeValues.some(value=>value.opcode==='arcade_setLocal' && literal(blocks,value,'NAME')===name);
                        // Nested registrations inherit the parent's captured cells
                        // even when CAPTURES only names newly owned locals.
                        captureLinks.push([`${scope}:capture:${name}`,!explicit.has(name) || captured && !local?`${key}:capture:${name}`:localKey(name)]);
                    }
                }
                if(block.opcode==='arcade_settingsWrite'){
                    const type=settingType(block, blocks),value=ref(inputBlock(blocks,block,'VALUE'));
                    if((type==='NumberArray' || type==='StringArray') && value){arrays.add(value);const item=Symbol('setting write item');(type==='NumberArray'?numbers:strings).add(item);elements.push([value,item]);}
                    if(type==='Buffer' && value)graphBufferValues.add(value);
                }
                if(block.opcode==='arcade_setSpriteProperty' && literal(blocks,block,'PROPERTY')==='data') {
                    const id=Symbol('sprite data assignment');dataProperties.push([ref(inputBlock(blocks,block,'ID')),id]);
                    connect(id,ref(inputBlock(blocks,block,'VALUE')));
                }
                if(block.opcode==='arcade_setCaptured'){const cell=inspectionCaptures.captured(inspectionCaptures.scopeOf(block),fixedName(block));connect(cell?inspectionCellKey(cell):`${key}:capture:${literal(blocks,block,'NAME')}`,ref(inputBlock(blocks,block,'VALUE')));}
                if (block.opcode === 'arcade_setLocal' && !deadLocalReset(blocks,block)) connect(localKey(literal(blocks,block,'NAME')),ref(inputBlock(blocks,block,'VALUE')));
                if (block.opcode === 'data_setvariableto') connect(`variable:${block.fields.VARIABLE[1] || block.fields.VARIABLE[0]}`,ref(inputBlock(blocks,block,'VALUE')));
                if (block.opcode === 'arcade_returnValue') connect(`${key}:result`,ref(inputBlock(blocks,block,'VALUE')));
                if (block.opcode === 'arcade_callFunction') {
                    const callee = `${target.isStage ? '' : target.name}:${literal(blocks,block,'NAME')}`;
                    let arg=inputBlock(blocks,block,'ARGS'),i=0;
                    while(arg?.opcode==='arcade_functionArgument') {
                        connect(parameters.get(callee)?.[i++],ref(inputBlock(blocks,arg,'VALUE')));arg=inputBlock(blocks,arg,'REST');
                    }
                }
                if (block.opcode === 'procedures_call') {
                    const callee = `${target.isStage ? '' : target.name}:${block.mutation?.proccode}`;
                    const args = JSON.parse(block.mutation?.argumentids || '[]');
                    args.forEach((arg,i) => connect(parameters.get(callee)?.[i],ref(inputBlock(blocks,block,arg))));
                }
                for (const input of Object.values(block.inputs || {})) visit(input[1]);
                visit(block.next);
            };
            visit(b.next);
        }
        edges.push(...captureLinks);
        const graph=new ValueTypeGraph();
        for(const [values,type] of [[graphTextSpriteValues,'TextSprite'],[graphBufferValues,'Buffer'],[graphPlayerValues,'Player'],[graphSceneValues,'Scene'],[graphPhysicsEngineValues,'PhysicsEngine'],[graphAnimationValues,'Animation'],[graphSevensegDigitValues,'SevenSegDigit'],[graphSevensegCounterValues,'DigitCounter'],[graphDartValues,'Dart'],[graphCorgiValues,'Corgio'],[images,'Image'],[sprites,'Sprite'],[tiles,'TileLocation'],[tilemaps,'TileMapData'],[legacyTiles,'LegacyTile'],[arrays,'array'],[numbers,'number'],[booleans,'boolean'],[strings,'string'],[anys,'any']])for(const value of values)graph.add(value,type);
        for(const [value,types] of sourceTypeOfClasses)for(const type of types)graph.add(value,this.objectClassExport.classes.has(type)?`class:${type}`:type);
        for(const cell of this.sourceScalarCells.values())graph.add(`variable:${cell.id}`,cell.type.toLowerCase());
        for(const cell of this.sourceReferenceCells.values()){
            const type=cell.type;
            graph.add(`variable:${cell.id}`,type.endsWith('[]')?'array':this.objectClassExport.classes.has(type)?`class:${type}`:type);
        }
        for(const [a,b] of edges)graph.merge(a,b);
        for(const [receiver,value] of dataProperties)if(receiver)graph.merge(graph.property(receiver,'data'),value);
        for(const [,value] of dataProperties)if(!graph.node(value).types.size)graph.add(value,'any');
        for(const [array,value] of elements)if(array && value){graph.add(array,'array');graph.merge(graph.element(array),value);}
        for(const [source,copy] of arrayCopies)if(source && copy){
            graph.add(source,'array');graph.add(copy,'array');graph.merge(graph.element(source),graph.element(copy));
        }
        for(const [id,type] of specialTypes)graph.add(id,type);
        const inferValueOperations=()=>{
            let revision;
            do {
                revision=graph.revision;
                for(const [result,left,right] of valueOperations){
                    const a=graph.node(left).types,b=graph.node(right).types;
                    if(a.has('any') || b.has('any')){graph.add(result,'any');continue;}
                    if(a.has('string') || b.has('string'))graph.add(result,'string');
                    const nonString=types=>[...types].some(type=>['number','boolean','null','undefined'].includes(type));
                    if(nonString(a) && nonString(b))graph.add(result,'number');
                }
            } while(revision!==graph.revision);
        };
        inferValueOperations();
        const opaqueNodes=new Set([...opaqueCells].map(value=>graph.node(value)));
        const objectClassOwned=name=>{
            const seen=new Set();let cls=this.objectClassExport.classes.get(name);
            if(!cls)return false;
            while(cls){
                if(seen.has(cls.name))return false;seen.add(cls.name);
                if(cls.intrinsic && ['__bwSDK_BaseSprite','Sprite','__bwSDK_ExtendableSprite'].includes(cls.name))return false;
                if(!cls.parent)return true;
                cls=this.objectClassExport.classes.get(cls.parent);if(!cls)return false;
            }
            return false;
        };
        const admittedType=type=>['number','boolean','string','null','undefined','array','Image','Buffer'].includes(type) || type.startsWith('class:') && objectClassOwned(type.slice(6));
        this.sourceTypeOfExportOperands=new Set();
        for(const [block,value] of sourceTypeOfInputs){
            if(!value){if(!block.inputs?.VALUE?.[1])this.sourceTypeOfExportOperands.add(block);continue;}
            const node=graph.node(value);
            if(!opaqueNodes.has(node) && node.types.size && [...node.types].every(admittedType))this.sourceTypeOfExportOperands.add(block);
        }
        for(const target of this.project.targets)for(const writer of Object.values(target.blocks||{}))if(['data_setvariableto','data_changevariableby'].includes(writer.opcode)){
            const id=`variable:${writer.fields?.VARIABLE?.[1]||writer.fields?.VARIABLE?.[0]}`;
            const readers=inspectionGlobalReaders.get(id);
            if(readers&&(!inspectionVisited.has(writer)||[...readers].some(reader=>reader!==target)))inspectionOpaqueCells.add(id);
        }
        const inspectionOpaqueNodes=new Set([...inspectionOpaqueCells,...opaqueCells].map(value=>graph.node(value)));
        let inspectionChanged;do{inspectionChanged=false;for(const [result,inputs]of inspectionOperators)if(inputs.some(value=>!value||inspectionOpaqueNodes.has(graph.node(value))||!graph.node(value).types.size||[...graph.node(value).types].some(type=>!['number','boolean','string','null','undefined'].includes(type)))){const node=graph.node(result);if(!inspectionOpaqueNodes.has(node)){inspectionOpaqueNodes.add(node);inspectionChanged=true;}}}while(inspectionChanged);
        this.inspectionExportOperands=new Set();
        const inspectionUndefinedCells=new Set([...this.sourceScalarCells.values()].filter(cell=>cell.type==='Any').map(cell=>`variable:${cell.id}`));
        const admittedSpriteFlags=new Set();
        const inspectionTypes=(value,allowed,seen=new Set(),origins=null,allowSpriteFlags=false)=>{
            if(!value)return false;
            // Flags never lend a Number-only fact. Actual closed writers must
            // first qualify below; only a complete primitive domain can use it.
            if(allowSpriteFlags&&admittedSpriteFlags.has(value)&&['number','boolean','string','null','undefined'].every(type=>allowed.includes(type))){
                const entry=spriteFlagResults.get(value),current=this.spriteFlagWriters(entry.target,entry.node);
                return !!current&&current.length===entry.writers.length&&current.every((row,index)=>row.target===entry.writers[index].target&&row.node===entry.writers[index].node&&row.input===entry.writers[index].input);
            }
            // Only the source-bitwise allowed domain contains BOTH alternatives.
            // Primitive-only/native and Array-only consumers gain no fact here.
            if(sourceBitwiseConstructorResults.has(value)&&allowed.includes('array')&&allowed.includes('string'))return true;
            // Both alternatives must be accepted. A Number-only constraint
            // must still prove its own actual operand tree independently.
            if(nativeBitwisePrimitiveResults.has(value)&&allowed.includes('number')&&allowed.includes('undefined'))return true;
            if(inspectionLeaves.has(value)){const type=inspectionLeaves.get(value);if(type==='Player'&&allowed.includes(type))origins?.add(value);return allowed.includes(type);}
            const operation=inspectionOperatorProofs.get(value);if(operation){
                // A dynamic `+` whose own two operands are each proved Number
                // adds (PXT and JS never concatenate two Numbers). This uses
                // only its actual operands, not the flow-insensitive annotation
                // node the result shares with other cells (an Any copy target).
                if(operation.numberPlus&&allowed.includes('number')&&!seen.has(value)){
                    const next=new Set([...seen,value]);
                    if(operation.operands.every(operand=>inspectionTypes(operand,['number'],next,null,allowSpriteFlags)))return true;
                }
                const output=operation.type?[operation.type]:[...graph.node(value).types];
                if(!output.length||!output.every(type=>allowed.includes(type)))return false;
                if(seen.has(value))return true;const next=new Set([...seen,value]);
                const evidence=operation.requirePlayer?new Set():origins;
                return operation.operands.every(operand=>inspectionTypes(operand,operation.domain||(operation.numeric?['number','undefined']:['number','boolean','string','null','undefined']),next,evidence,allowSpriteFlags))&&(!operation.requirePlayer||evidence.size>0);
            }
            const node=graph.node(value);
            if(allowed.includes('Player')){
                const producers=inspectionProducers.get(value);
                if(inspectionOpaqueNodes.has(node)||seen.has(value)||!producers?.size)return false;
                const next=new Set([...seen,value]);return [...producers].every(producer=>inspectionTypes(producer,allowed,next,origins,allowSpriteFlags));
            }
            if(inspectionOpaqueNodes.has(node))return false;
            if(!node.types.size||[...node.types].some(type=>type!=='any'&&!allowed.includes(type))){
                // The annotation graph unifies a value with everything it flows
                // into (e.g. a mixed Array element). Its own directed writers
                // still decide what it can actually hold.
                const producers=inspectionProducers.get(value);
                if(anys.has(value)||seen.has(value)||!producers?.size)return false;
                const next=new Set([...seen,value]);
                return [...producers].every(producer=>inspectionTypes(producer,allowed,next,origins,allowSpriteFlags));
            }
            if(!node.types.has('any'))return true;
            // An Any declaration resets a real scalar cell to Undefined. It
            // does not prove its later values. Follow every actual directed
            // writer; a dynamic operation's Any producer remains opaque.
            if(anys.has(value))return false;
            const producers=inspectionProducers.get(value);
            if(!producers?.size)return inspectionUndefinedCells.has(value)&&allowed.includes('undefined');
            if(seen.has(value))return true;const next=new Set([...seen,value]);
            return [...producers].every(producer=>inspectionTypes(producer,allowed,next,origins,allowSpriteFlags));
        };
        // Start from independently primitive actual writers. Self-dependent
        // flags cycles remain refused in this narrow slice, not assumed closed.
        for(const [value,entry]of spriteFlagResults){
            if(!entry.writers.every(row=>inspectionTypes(spriteFlagWriterInputs.get(row.node),['number','boolean','string','null','undefined'])))continue;
            const current=this.spriteFlagWriters(entry.target,entry.node);
            if(current&&current.length===entry.writers.length&&current.every((row,index)=>row.target===entry.writers[index].target&&row.node===entry.writers[index].node&&row.input===entry.writers[index].input))admittedSpriteFlags.add(value);
        }
        // Source result signatures above never prove their operands. Follow
        // every actual directed writer/capture through the same closed graph.
        this.sourceBitwiseExportOperands=new Set();
        for(const [block,operands]of sourceBitwiseInputs)if(operands.every(value=>inspectionTypes(value,['array','number','boolean','string','null','undefined'],new Set(),null,true)))this.sourceBitwiseExportOperands.add(block);
        this.scoreThresholdExportOperands=new Set();
        for(const [block,value]of scoreThresholdInputs)if(inspectionTypes(value,['number']))this.scoreThresholdExportOperands.add(block);
        this.nativeBitwiseExportOperands=new Set();
        // Nonreachability comes only from the closed physical execution-root
        // census. Managed/callable entries deny that proof; their JSON catalogs
        // cannot be treated as ordinary unmentioned procedure names.
        for(const [block,operands]of nativeBitwiseInputs){
            const target=this.project.targets.find(t=>Object.values(t.blocks||{}).includes(block));
            if(operands.every(value=>inspectionTypes(value,['number','boolean','string','null','undefined'],new Set(),null,true))||
                target&&this.isUnreachable(target,block))this.nativeBitwiseExportOperands.add(block);
        }
        for(const expected of this.procedureConstraints?.allObligations||[]){
            const actual=procedureInputs.find(item=>item.block===expected.block&&item.obligation===expected.obligation);
            if(!actual||actual.obligation.type!=='Any'&&!inspectionTypes(actual.value,[actual.obligation.type.toLowerCase()]))this.note('Procedure parameter constraint: actual current caller or writer requires '+expected.obligation.type);
        }
        this.throwExportOperands=new Set();
        const throwOwners=throwExportOwners(this.project,this.objectClassExport.procedures);
        for(const [block,value]of throwInputs)if(throwOwners.has(block)&&inspectionTypes(value,['number','boolean','string','null','undefined']))this.throwExportOperands.add(block);
        for(const target of this.project.targets)for(const block of Object.values(target.blocks||{}))if(block.opcode==='arcade_throwValue'&&!this.throwExportOperands.has(block))this.note('Arcade Throw export requires a proved primitive operand and qualified main/button/ordinary procedure owner');
        for(const [block,input]of inspectionInputs)if(inspectionTypes(input.value,['number','boolean','string','null','undefined'])&&inspectionTypes(input.limit,['number','undefined']))this.inspectionExportOperands.add(block);
        // Unknown operations remain dynamic. Propagate that fact through the
        // same result/alias graph rather than prematurely widening known sums.
        for(const [result] of valueOperations)if(!graph.node(result).types.size)graph.add(result,'any');
        inferValueOperations();
        // Queries do not insert their needles into a collection. Its element
        // type is determined by declarations, writes, copies and aliases.
        // Element and alias joins can make a nested array visible to reads or
        // procedure results that had no annotation of their own.
        const inferred=new Map([[graphTextSpriteValues,'TextSprite'],[graphBufferValues,'Buffer'],[graphPlayerValues,'Player'],[graphSceneValues,'Scene'],[graphPhysicsEngineValues,'PhysicsEngine'],[graphAnimationValues,'Animation'],[graphSevensegDigitValues,'SevenSegDigit'],[graphSevensegCounterValues,'DigitCounter'],[graphDartValues,'Dart'],[graphCorgiValues,'Corgio'],[images,'Image'],[sprites,'Sprite'],[tiles,'TileLocation'],[tilemaps,'TileMapData'],[legacyTiles,'LegacyTile'],[arrays,'array'],[numbers,'number'],[booleans,'boolean'],[strings,'string'],[anys,'any']]);
        for(const [key] of graph.nodes)for(const [values,type] of inferred)if(graph.has(key,type))values.add(key);
        this.spriteReturnFunctions = new Set([...parameters.keys()].filter(key=>graph.arrayType(`${key}:result`)==='Sprite'));
        this.spriteVariableIds = new Set([...sprites].filter(key=>typeof key==='string' && key.startsWith('variable:') && graph.arrayType(key)==='Sprite').map(key=>key.slice(9)));
        this.imageReturnFunctions = new Set([...parameters.keys()].filter(key=>graph.arrayType(`${key}:result`)==='Image'));
        this.imageVariableIds = new Set([...images].filter(key=>typeof key==='string' && key.startsWith('variable:') && graph.arrayType(key)==='Image').map(key=>key.slice(9)));
        const arrayType=value=>graph.arrayType(value);
        this.mixedValueArrayLocalBlocks=new Set([...arrayLocalReaders].filter(([,cell])=>graph.has(cell,'array') && graph.arrayType(cell)==='any').map(([block])=>block));
        this.mixedValueVariableIds=new Set([...graph.nodes.keys()].filter(key=>typeof key==='string' && key.startsWith('variable:') && (graph.node(key).types.size>1 || graph.has(key,'any')) && graph.arrayType(key)==='any').map(key=>key.slice(9)));
        this.booleanVariableIds=new Set([...booleans].filter(key=>typeof key==='string' && key.startsWith('variable:') && graph.arrayType(key)==='boolean').map(key=>key.slice(9)));
        this.primitiveVariableTypes=new Map([...graph.nodes.keys()].filter(key=>typeof key==='string' && key.startsWith('variable:') && ['Buffer','mp.Player','string','tiles.Location','tiles.TileMapData','tiles.Tile','animation.Animation','SevenSegDigit','DigitCounter','Dart','Corgio','TextSprite','scene.Scene','ArcadePhysicsEngine'].includes(graph.arrayType(key))).map(key=>[key.slice(9),graph.arrayType(key)]));
        this.valueReturnTypes=new Map([...parameters.keys()].map(key=>[key,graph.arrayType(`${key}:result`)]));
        this.localValueTypes=new Map();
        for(const key of graph.nodes.keys()){
            if(typeof key!=='string' || !key.includes(':local:'))continue;
            const at=key.lastIndexOf(':local:'),owner=key.slice(0,at),name=ident(key.slice(at+7));
            if(!this.localValueTypes.has(owner))this.localValueTypes.set(owner,new Map());
            this.localValueTypes.get(owner).set(name,arrayType(key));
        }
        this.arrayVariableTypes=new Map([...arrays].filter(k=>typeof k==='string' && k.startsWith('variable:')).map(k=>[k.slice(9),arrayType(k)]));
        this.arrayReturnTypes=new Map([...parameters.keys()].filter(k=>arrays.has(`${k}:result`)).map(k=>[k,arrayType(`${k}:result`)]));
        return new Map([...parameters].map(([key,keys]) => [key,keys.map(value => arrayType(value))]));
    }

    // Dormant declarations still have to type-check in MakeCode. The live
    // producer graph deliberately skips these bodies; do not seed that graph
    // from a declaration requirement. This separate result is used only for
    // an otherwise-any formal at the final signature rendering site.
    inferUnreachableSpriteParameterTypes(target,definition,proto,names,emittedFunction) {
        const denied=()=>new Map();
        if(!this.isUnreachable(target,definition))return denied();
        let original,argumentIds;
        try{
            original=JSON.parse(proto.mutation.argumentnames);
            argumentIds=JSON.parse(proto.mutation.argumentids);
        }catch{return denied();}
        if(!Array.isArray(original)||!Array.isArray(argumentIds)||original.length!==names.length||
            argumentIds.length!==names.length||original.some(name=>typeof name!=='string'||!name)||
            argumentIds.some(id=>typeof id!=='string'||!id)||new Set(original).size!==original.length||
            new Set(argumentIds).size!==argumentIds.length||new Set(names).size!==names.length||
            original.some((name,i)=>ident(name)!==names[i]))return denied();
        const blocks=target.blocks||{},entries=Object.entries(blocks);
        const protoIds=entries.filter(([,node])=>node===proto).map(([id])=>id);
        if(protoIds.length!==1)return denied();
        const declarationReaders=new Set(),eligible=names.map(()=>false),uses=names.map(()=>0);
        for(let i=0;i<argumentIds.length;i++){
            const readerId=proto.inputs?.[argumentIds[i]]?.[1],reader=blocks[readerId];
            if(!reader||reader.parent!==protoIds[0]||reader.shadow!==true||
                !['argument_reporter_string_number','argument_reporter_boolean'].includes(reader.opcode)||
                reader.fields?.VALUE?.[0]!==original[i])return denied();
            declarationReaders.add(reader);
            eligible[i]=reader.opcode==='argument_reporter_string_number';
        }
        const owned=node=>{
            const seen=new Set();
            for(let current=node;current&&!seen.has(current);current=blocks[current.parent]){
                if(current===definition)return true;
                seen.add(current);
            }
            return false;
        };
        // Use the emitter's actual NAME ingress. Editor fields or a retained
        // shadow cannot override the inline input that is really emitted.
        const fixedName=node=>this.literalInput(node,'NAME');
        const flagsReceiver=(id,node)=>{
            const parent=blocks[node.parent],property=parent?.fields?.PROPERTY;
            return parent?.opcode==='arcade_spriteProperty'&&parent.mutation==null&&
                parent.shadow===false&&parent.topLevel===false&&parent.next==null&&
                Object.keys(parent.fields||{}).join(',')==='PROPERTY'&&
                Array.isArray(property)&&property[0]==='flags'&&
                (property.length===1||property.length===2&&property[1]===null)&&
                Object.keys(parent.inputs||{}).join(',')==='ID'&&
                Array.isArray(parent.inputs.ID)&&[1,2,3].includes(parent.inputs.ID[0])&&parent.inputs.ID[1]===id;
        };
        const invalidateName=name=>{
            for(let i=0;i<names.length;i++)if(name===original[i]||ident(name)===names[i])eligible[i]=false;
        };
        const globalUse=name=>{
            if(typeof name!=='string')return false;
            if(this.infoVariable(name))return true; // emitted SDK use is checked below
            const local=Object.values(target.variables||{}).some(value=>value[0]===name);
            const owner=local?target:this.project.targets.find(value=>value.isStage)||target;
            if(local&&this.isClonable(target)&&!this.isGlobalVar(name)){
                invalidateName('self');return true;
            }
            // The body has already been emitted. Read its actual allocated
            // spelling without invoking lookupVar/varName and mutating state.
            const emitted=this.globals.get(`${owner.isStage?'':owner.name}:${name}`);
            if(typeof emitted!=='string')return false;
            for(let i=0;i<names.length;i++)if(emitted===names[i])eligible[i]=false;
            return true;
        };
        for(const [id,node]of entries){
            if(node===definition||node===proto||declarationReaders.has(node)||!owned(node))continue;
            if(node.fields?.VARIABLE&&!globalUse(node.fields.VARIABLE[0]))return denied();
            for(const slot of Object.values(node.inputs||{})){
                const value=slot?.[1];
                if(Array.isArray(value)&&[12,13].includes(value[0])&&!globalUse(value[1]))return denied();
            }
            if(node.opcode.startsWith('arrays_')&&node.inputs?.NAME){
                const named=this.namedArrays.get(this.literalInput(node,'NAME'));
                for(let i=0;i<names.length;i++)if(named===names[i])eligible[i]=false;
            }
            if(['arcade_setLocal','arcade_declareLocal'].includes(node.opcode)){
                const name=fixedName(node);
                if(!name||!/^[A-Za-z_]\w*$/.test(name))return denied();
                invalidateName(name);
            }
            let index=-1;
            if(/^argument_reporter_/.test(node.opcode)){
                const value=node.fields?.VALUE;
                if(!Array.isArray(value)||typeof value[0]!=='string')return denied();
                index=original.indexOf(value[0]);
                if(index<0)return denied();
                if(node.opcode!=='argument_reporter_string_number')eligible[index]=false;
            }else if(node.opcode==='arcade_getLocal'){
                const name=fixedName(node);
                if(!name||!/^[A-Za-z_]\w*$/.test(name))return denied();
                index=original.indexOf(name);
                // A different source spelling that collides after emission is
                // not the formal's actual lexical cell.
                if(index<0){invalidateName(name);continue;}
            }
            if(index<0)continue;
            if(!this.isUnreachable(target,node)||!flagsReceiver(id,node))eligible[index]=false;
            else uses[index]++;
        }
        if(!eligible.some((value,i)=>value&&uses[i]>0))return denied();
        // Count actual emitted lexical reads as well. A generated loop local,
        // helper name or injected parameter must not capture a physical formal
        // read. Binding identity, not a spelling or annotation, selects the cell.
        let program,fn,graph;
        try{
            program=parseMakeCodeTs(emittedFunction);
            if(program.body.length!==1||program.body[0].type!=='FunctionDeclaration')return denied();
            fn=program.body[0];
            if(!fn.body.length||new Set(fn.params).size!==fn.params.length)return denied();
            graph=analyseSourceValueProducers(program,{unboundIsOpaque:true});
        }catch{return denied();}
        const bindings=new Map(),counts=names.map(()=>0),parents=new WeakMap();
        for(let i=0;i<names.length;i++)if(eligible[i]){
            const kinds=graph.bindingKindsAt(fn.body[0],names[i]);
            if(kinds.size!==1||!kinds.has('parameter')||graph.declarationCountAt(fn.body[0],names[i])!==1){eligible[i]=false;continue;}
            const binding=graph.bindingOf(fn.body[0],names[i]);
            if(!binding){eligible[i]=false;continue;}
            bindings.set(binding,i);
        }
        const metadata=new Set(['originalBody','paramTypes','parameterDefaults','typeParameters','returnType','source']);
        const visit=(node,parent=null)=>{
            if(!node||typeof node!=='object')return;
            parents.set(node,parent);
            if(node.type==='Identifier'){
                const index=bindings.get(graph.bindingOf(node));
                if(index!==undefined){
                    const outer=parents.get(parent);
                    if(parent?.type!=='Member'||parent.object!==node||parent.name!=='flags'||parent.optional||
                        outer?.type==='Assignment'&&outer.left===parent||outer?.type==='Update'&&outer.argument===parent||
                        outer?.type==='Unary'&&outer.op==='delete')eligible[index]=false;
                    else counts[index]++;
                }
            }
            for(const [key,value]of Object.entries(node))if(!metadata.has(key)){
                if(Array.isArray(value))for(const child of value)visit(child,node);
                else if(value&&typeof value==='object')visit(value,node);
            }
        };
        visit(fn);
        if(!this.isUnreachable(target,definition)||!this.closedOrdinaryEntryCurrent())return denied();
        return new Map(names.flatMap((name,i)=>eligible[i]&&uses[i]>0&&counts[i]===uses[i]?[[i,'Sprite']]:[]));
    }

    // ── images ───────────────────────────────────────────────────────────
    /** A costume as palette pixels: exact for pixel art, palette-matched otherwise. */
    image (target, costume = target.costumes[target.currentCostume || 0], index = target.currentCostume || 0) {
        const svg = costume && this.opts.costumeSvg ? this.opts.costumeSvg(target, costume) : null;
        const candidate = costume && (this.snapshotCallbacks ?
            this.opts.costumePalette?.(target,costume,snapshotAssetContext(this.project,target,costume)) : this.opts.costumePalette?.(target,costume));
        const sourcePalette = isPalette(candidate) ? candidate : ARCADE_PALETTE;
        if (svg) {
            const px = svgToPixels(svg, sourcePalette);
            if (px) {
                const indexedPalette = px.palette || sourcePalette;
                if (this.hasProjectPalette || samePalette(indexedPalette, this.palette)) return px;
                this.warnings.push(`${target.name}: costume palette mapped to the Arcade project palette`);
                return remapPalette(px, indexedPalette, this.palette);
            }
        }
        const raster = costume && this.opts.costumeRgba ? this.opts.costumeRgba(target, costume) : null;
        if (raster) {
            // A Scratch costume is drawn 3x larger than its Arcade sprite (the stage
            // is 3x the screen); palette-matched, and named, because that is lossy.
            this.warnings.push(`${target.name}: costume "${costume.name}" converted to palette pixels`);
            return quantizeRgba(raster.rgba, raster.width, raster.height,
                Math.max(1, Math.round(raster.width / 3)), Math.max(1, Math.round(raster.height / 3)),
                this.palette);
        }
        if (target.isStage) return null;
        this.warnings.push(`${target.name}: no costume image available — a placeholder square`);
        const w = 8;
        // Each costume's placeholder has its own colour, so a costume switch still shows.
        const px = new Uint8Array(w * w).fill(((target.name.length + index) % 14) + 1);
        return {width: w, height: w, pixels: px};
    }

    /** Costume `index` of a target as palette pixels (an Arcade template's frames). */
    frame (target, index) {
        return this.image(target, target.costumes[index], index);
    }

    /** A backdrop as a 160x120 image expression: its pixels, or a plain fill (named). */
    backdrop (stage, costume, index) {
        const custom = this.opts.stageBackground && index === (stage.currentCostume || 0) ? this.opts.stageBackground(stage, costume) : null;
        const img = custom || this.image(stage, costume, index);
        if (img) return toImgLiteral(img);
        this.warnings.push(`backdrop "${costume.name}": no image available — a plain colour`);
        this.helpers.add('plain');
        return `_plain(${(index % 14) + 1})`;
    }

    // ── scripts ──────────────────────────────────────────────────────────
    /** Emit one script body with the guards a yield must check. */
    body (firstId, guards, preamble = [], implicitLoopYield=true) {
        const saved = {guards:this.guards,implicitLoopYield:this.implicitLoopYield};
        this.guards = guards;
        this.implicitLoopYield=implicitLoopYield;
        const script = [...preamble];
        this.stmts(firstId, 1, script);
        Object.assign(this,saved);
        return script;
    }

    /** A named function for a hat's script; `self` is its sprite when cloned. */
    scriptFunction (prefix, hat, restartable) {
        const t = this.target;
        const n = this.scriptSeq++;
        const fn = `_${prefix}_${ident(t.isStage ? 'stage' : t.name)}_${n}`;
        const clonable = this.isClonable();
        const guards = this.stopGuards();
        const pre = this.tokenLine();
        if (clonable) {
            this.use('gone');
            guards.push('_gone(self)');
        }
        if (restartable) {
            // Started again while it runs, a Scratch script restarts: the
            // older run ends at its next yield.
            this.use('gen');
            if (clonable) {
                pre.push(`    const _g = _genBumpFor(self, "_g${n}")`);
                guards.push(`_g != _genOf(self, "_g${n}")`);
            } else {
                pre.push(`    const _g = _genBump(${n})`);
                guards.push(`_g != _gens[${n}]`);
            }
        }
        const script = this.body(hat.next, guards, pre);
        this.generated.push(`function ${fn} (${clonable ? 'self: Sprite' : ''}) {\n${script.join('\n')}\n}`);
        return {fn, sprite: clonable ? t.name : null};
    }

    /** Start `entries` (receivers) into the wait `w`, each on every instance of its sprite. */
    spawnLines (entries) {
        return entries.map(({fn, sprite}) => (sprite ?
            `        for (const s of ${this.allOf(sprite)}) _spawnFor(w, ${fn}, s)` : `        _spawn(w, ${fn})`));
    }

    dispatcher (name, table, param) {
        const lines = [`function ${name} (${param}: string): _Wait {`, '    const w = new _Wait()'];
        for (const [key, entries] of table) {
            lines.push(`    if (${param} == ${JSON.stringify(key)}) {`, ...this.spawnLines(entries), '    }');
        }
        lines.push('    return w', '}');
        return lines.join('\n');
    }

    prepareCallableExport() {
        this.callableExports=new Map();this.callableGlobals=new Map();this.classCallableDefaultTargets=new Set();
        this.sdkImageLiteralResources=createSdkImageLiteralResources(this.project,this.opts.costumeSvg,this.palette);
        for(const target of this.project.targets) {
            const blocks=target.blocks || {},literal=(block,name)=>{
                const slot=block.inputs?.[name]?.[1];
                if(Array.isArray(slot)&&slot[0]===10)return String(slot[1]);
                const child=typeof slot==='string'&&blocks[slot];
                return child?.opcode==='text'&&child.shadow?String(child.fields.TEXT?.[0]):null;
            };
            const declarations=Object.values(blocks).filter(block=>block.opcode==='arcade_declareCallable');
            if(!declarations.length)continue;
            let envelope;try {envelope=JSON.parse(literal(declarations[0],'METADATA'));} catch(_){this.note('Callable export requires fixed lexical declaration metadata');continue;}
            try {
                let graph,sdkImageEnabled=false;
                if(envelope.version===2&&!this.opts.classCallablePrototype){
                    const proof=classCallableDefaultProjectGate(target,this.project,this.objectClassExport,literal);
                    if(!proof.eligible)throw Error(proof.unsupported.join('; ')||'Class callable default project is unproved');
                    graph=proof.graph;sdkImageEnabled=proof.sdkImageEnabled;this.classCallableDefaultTargets.add(target);
                }else graph=inspectCallableExportGraph(target,envelope.plan,literal,envelope.version===2&&this.opts.classCallablePrototype?{classProvider:this.objectClassExport.classCallableProvider(target),project:this.project}:{project:this.project});
                validateCallableCurrentBodyTypes(graph,literal);
                if(this.clonable.has(target.name))throw Error('Callable lexical export on clone targets is not qualified');
                for(const [bindingId,row] of graph.globalBindings) {
                    const owner=this.project.targets.find(candidate=>Object.hasOwn(candidate.variables || {},row.variableId));
                    if(!owner || owner!==target&&!owner.isStage || (owner.variables[row.variableId]?.[2] || ''))throw Error('Callable global has a foreign or nonscalar variable ID');
                    const name=this.varName(owner,owner.variables[row.variableId][0]);
                    const binding=graph.plan.bindings.find(binding=>binding.id===bindingId);
                    this.callableGlobals.set(name,binding.type);
                }
                const emitter=createCallableLexicalEmitter(graph,(first,context)=>{
                    const previous={target:this.target,blocks:this.blocks,locals:this.currentLocalNames,context:this.currentCallableContext};
                    this.target=target;this.blocks=blocks;this.currentLocalNames=new Set();this.currentCallableContext=context;
                    try{return this.body(first,[],[],false);}finally {this.target=previous.target;this.blocks=previous.blocks;this.currentLocalNames=previous.locals;this.currentCallableContext=previous.context;}
                });
                this.callableExports.set(target,{graph,emitter,sdkImageEnabled:sdkImageEnabled||envelope.version===2&&this.opts.sdkImagePrototype===true});
                for(const owner of graph.plan.owners)if(owner.kind==='declaration')this.functionSymbols.pin(target,owner.procedure,owner.sourceName);
            } catch(error) {this.note(error.message);}
        }
    }
    callableArgumentValues(block) {
        const args=[];let input=block.inputs?.ARGS,child=this.block(input?.[1]),seen=new Set();
        while(child?.opcode==='arcade_functionArgument') {
            if(seen.has(child))throw Error('Callable argument chain is cyclic');seen.add(child);
            args.push(this.arrayValue(child,'VALUE'));input=child.inputs?.REST;child=this.block(input?.[1]);
        }
        const slot=input?.[1];
        if(!(Array.isArray(slot)&&slot[0]===10&&slot[1]==='[]') && !(child?.opcode==='text'&&child.shadow&&child.fields?.TEXT?.[0]==='[]'))
            throw Error('Callable invocation requires its explicit current argument chain');
        return args;
    }

    // ── the program ──────────────────────────────────────────────────────
    emit () {
        const out = [];
        // Arcade values only: a saved default that no code can read before the
        // start script's first assignment is not exported as a producer.
        this.deadSavedInitials = this.arcadeValues ? startupFirstWriteVariables(this.project,
            (target, id, name) => target.isStage ? this.isGlobalVar(name) : !this.isGlobalVar(name) && !this.isClonable(target)) : new Set();
        this.directConcatGlobals = new Set();
        this.directStringArguments = new Set();
        this.globalVariableIds = new Map();
        this.collectKindBindings();
        // Scratch's Stage composites transparent backdrop pixels over white.
        // Native Arcade primitives own their scene defaults instead; do not
        // change those programs merely because they also have a Scratch Stage.
        const nativeArcade = this.project.targets.some(target => Object.values(target.blocks || {})
            .some(block => block?.opcode?.startsWith('arcade_')));
        const flagScripts = [];                             // green-flag scripts: {script, clonable, sv, plain}
        const handlers = [];
        const functions = [];
        const ordinaryDeclarations = [];
        const stage = this.project.targets.find(t => t.isStage);
        this.hasHandles = this.project.targets.some(t => Object.values(t.blocks || {})
            .some(b => b?.opcode?.startsWith('arcade_') &&
                ['arcade_spawnSprite', 'arcade_spawnProjectile', 'arcade_spawnImageProjectile', 'arcade_spawnImageSprite', 'arcade_whenSpriteCreated', 'arcade_whenSpritesOverlap',
                    'arcade_whenRegisteredDestroyed', 'arcade_whenRegisteredCreated', 'arcade_whenRegisteredWall', 'arcade_whenRegisteredTile', ...Object.keys(REGISTERED_HAT_KINDS), ...REGISTERED_COMMANDS, 'arcade_pushScene', 'arcade_popScene', 'arcade_createSprite', 'arcade_createImageSprite']
                    .includes(b.opcode)));
        // The importer represents a constant Arcade background colour as a
        // full-screen Scratch sprite so its artwork reaches the Code editor.
        // Recover that exact representation as an Arcade background again.
        const background = this.sprites.find(t => {
            if (t.name !== 'background' || t.costumes?.length !== 1) return false;
            const opcodes = Object.values(t.blocks || {}).map(b => b.opcode);
            return opcodes.some(opcode => ['event_whenflagclicked','arcade_whenSourceStarts'].includes(opcode)) &&
                ['motion_gotoxy', 'looks_gotofrontback', 'looks_show'].every(opcode => opcodes.includes(opcode)) &&
                opcodes.every(opcode => ['event_whenflagclicked', 'arcade_whenSourceStarts', 'motion_gotoxy',
                    'looks_gotofrontback', 'looks_show'].includes(opcode));
        });
        const backgroundSvg = background && this.opts.costumeSvg?.(background, background.costumes[0]);
        const backgroundFill = backgroundSvg?.match(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="480" height="360" viewBox="0 0 480 360"><rect width="480" height="360" fill="(#[0-9a-fA-F]{6})"\/><\/svg>$/)?.[1];
        const backgroundColor = backgroundFill && ARCADE_PALETTE.findIndex(color =>
            color?.toLowerCase() === backgroundFill.toLowerCase());
        this.importedBackgroundTarget = backgroundColor > 0 ? background : null;
        if (this.importedBackgroundTarget) out.push(`scene.setBackgroundColor(${backgroundColor})`);
        for (const t of this.project.targets) for (const b of Object.values(t.blocks || {})) {
            if (!['arcade_spawnSprite', 'arcade_spawnProjectile', 'arcade_spawnImageProjectile', 'arcade_spawnImageSprite', 'arcade_frameImage', 'arcade_createSprite', 'arcade_createImageSprite'].includes(b?.opcode)) continue;
            const name = this.literalInput(b, 'TEMPLATE');
            if (name) {
                this.templateNames.add(name);
                const kind = this.literalInput(b, 'KIND');
                if (!this.templateKinds.has(name)) this.templateKinds.set(name, kind);
                else if (this.templateKinds.get(name) !== kind) this.templateKinds.set(name, null);
            }
        }
        for (const name of this.templateNames) {
            const target = this.sprites.find(t => t.name === name);
            if (!target) { this.note(`Arcade sprite template ${name} does not exist`); continue; }
            this.artVar.set(name, `__bwArt_${ident(name)}`);
            this.artPixels.set(name, this.image(target));
        }
        for (const t of this.project.targets) {
            if (t === this.importedBackgroundTarget) continue;
            this.target = t;
            this.blocks = t.blocks || {};
            for (const b of Object.values(this.blocks)) {
                if (b?.opcode !== 'data_setvariableto') continue;
                const value = this.block(typeof b.inputs?.VALUE?.[1] === 'string' ? b.inputs.VALUE[1] : null);
                if (!['arcade_spawnSprite', 'arcade_spawnProjectile', 'arcade_spawnImageProjectile', 'arcade_spawnImageSprite', 'arcade_createSprite', 'arcade_createImageSprite'].includes(value?.opcode)) continue;
                const handle = this.lookupVar(this.field(b, 'VARIABLE'));
                const template = this.literalInput(value, 'TEMPLATE');
                if (this.handleTemplateVars.has(handle) && this.handleTemplateVars.get(handle) !== template) {
                    this.handleTemplateVars.set(handle, null);
                } else if (!this.handleTemplateVars.has(handle)) this.handleTemplateVars.set(handle, template);
            }
        }
        // Only native managed value invocations identify synchronous source
        // functions. Scratch hats and ordinary command procedures keep yields.
        for(const t of this.project.targets)for(const b of Object.values(t.blocks || {}))if(b?.opcode==='arcade_callFunction'){
            const code=this.literalInput(b,'NAME');
            if(code!==null)this.managedValueProcedures.add(`${t.isStage?'':t.name}:${code}`);
        }
        const register = (table, key, entry) => {
            if (!table.has(key)) table.set(key, []);
            table.get(key).push(entry);
        };
        for (const target of this.project.targets) {
            this.target = target;this.blocks = target.blocks || {};
            for (const block of Object.values(this.blocks)) {
                if (Object.prototype.hasOwnProperty.call(REGISTERED_HAT_KINDS,block.opcode) && block.topLevel) {
                    const token = this.literalInput(block,'TOKEN');
                    if (!token || this.registeredCallbackBlocks.has(token)) this.note('Arcade registered callback needs a unique fixed token');
                    else this.registeredCallbackBlocks.set(token,{target,block,kind:REGISTERED_HAT_KINDS[block.opcode]});
                }
                if (REGISTERED_COMMANDS.has(block.opcode)) {
                    const token = this.literalInput(block,'TOKEN');
                    if (token) this.registeredCallbackKinds.set(token,this.literalInput(block,'KIND'));
                }
            }
        }

        for(const cell of this.sourceReferenceCells.values())cell.ts=this.varName(cell.target,cell.name);
        try{this.procedureConstraints=prepareProcedureConstraintExport(this.project);}catch(error){this.note(error.message);this.procedureConstraints=null;}
        this.objectClassExport=prepareObjectClassExport(this);
        this.prepareCallableExport();
        this.imageConsumerAbi=createImageConsumerAbiExport({project:this.project,provider:this.objectClassExport});
        const imageParameterTypes = this.imageProcedureParameters();
        const scalarFlow=scalarExportFlow(this.project,block=>this.isBoolean(block),this.sourceScalarCells);
        for(const [key,parameters] of scalarFlow.definitions) {
            const old=imageParameterTypes.get(key)||[];
            // A formal that actually receives Undefined/Null (an omitted optional
            // argument) is not a Number/String/Boolean formal: annotating it so
            // would make the reimport's procedure constraint refuse its own caller.
            const nullable=name=>[...(scalarFlow.types.get(`${key}:local:${name}`)||[])].some(type=>['undefined','null'].includes(type));
            imageParameterTypes.set(key,parameters.map((name,index)=>scalarFlow.primitive(`${key}:local:${name}`)?nullable(name)?'any':scalarFlow.type(`${key}:local:${name}`):old[index]||'any'));
            if(scalarFlow.primitive(`${key}:result`))this.valueReturnTypes.set(key,scalarFlow.type(`${key}:result`));
        }
        for(const key of scalarFlow.types.keys()) {
            if(typeof key!=='string' || !key.includes(':local:') || !scalarFlow.primitive(key))continue;
            const at=key.lastIndexOf(':local:'),owner=key.slice(0,at),name=ident(key.slice(at+7));
            if(!this.localValueTypes.has(owner))this.localValueTypes.set(owner,new Map());
            this.localValueTypes.get(owner).set(name,scalarFlow.type(key));
        }

        for (const cell of this.sourceScalarCells.values()) {
            const {id,type}=cell;cell.ts=this.varName(cell.target,cell.name);
            this.mixedValueVariableIds.delete(id);
            if (type === 'Boolean') this.booleanVariableIds.add(id); else this.booleanVariableIds.delete(id);
            this.primitiveVariableTypes.set(id,type.toLowerCase());
        }

        // Instance destruction callbacks are registered by a command in the
        // startup script. Compile their bodies first, then insert each body at
        // its registration site so PXT captures the handle at that moment.
        for (const t of this.project.targets) {
            this.target = t;
            this.blocks = t.blocks || {};
            for (const b of Object.values(this.blocks)) {
                if (!b?.topLevel || b.opcode !== 'arcade_whenRegisteredDestroyed') continue;
                const token = this.literalInput(b, 'TOKEN');
                if (!token) { this.note('Arcade sprite destruction callback needs a fixed token'); continue; }
                if (this.destroyedCallbacks.has(token)) {
                    this.note(`Arcade sprite destruction callback token ${token} is duplicated`);
                    continue;
                }
                const script = [];
                this.stmts(b.next, 1, script);
                this.destroyedCallbacks.set(token, script);
            }
        }
        for (const t of this.project.targets) {
            if (t === this.importedBackgroundTarget) continue;
            this.target = t;
            this.blocks = t.blocks || {};
            const clonable = this.isClonable();
            const sv = this.spriteVar.get(t.name);
            for (const [, b] of Object.entries(this.blocks)) {
                if (!b || !b.topLevel) continue;
                if (this.templateNames.has(t.name)) {
                    // An Arcade sprite template (E1) is artwork for sprites.create:
                    // its own scripts have no MakeCode instance to run on.
                    if (['event_whenflagclicked','arcade_whenSourceStarts'].includes(b.opcode)) {
                        const commands = [];
                        for (let item = this.block(b.next); item; item = this.block(item.next)) commands.push(item.opcode);
                        if (commands.some(opcode => opcode !== 'looks_hide')) {
                            this.note(`${t.name}: template scripts do not transfer to MakeCode sprite instances`);
                        }
                    } else if (b.opcode !== 'procedures_definition' && !/^(procedures_prototype|argument_)/.test(b.opcode)) {
                        this.note(`${t.name}: template event scripts do not transfer to MakeCode sprite instances`);
                    }
                    continue;
                }
                let script = [];
                // An Arcade hat's locals (arcade_setLocal) are declared in that run, not as file globals.
                const scoped = (emitBody, parameters = []) => {
                    const saved = this.currentLocalNames,savedContext=this.currentCallableContext;
                    this.currentLocalNames = new Set();
                    const entry=this.callableExports?.get(t);
                    if(entry?.graph.plan.version===2){
                        const creates=new Set(entry.graph.plan.sites.filter(site=>site.createdIn===entry.graph.plan.module).map(site=>entry.graph.creates.get(site.id)));
                        this.currentCallableContext=this.objectClassExport.classCallableProvider(t).contextForModuleRoot(b,entry.emitter,creates);
                    }
                    if(entry?.graph.plan.version===3&&b.opcode==='arcade_whenSourceStarts')this.currentCallableContext=entry.emitter.moduleContext(b);
                    const lines = emitBody();
                    const locals = [...this.currentLocalNames].filter(name => !parameters.includes(name));
                    const procedureLocals = this.currentLocalNames;
                    this.currentLocalNames = saved;this.currentCallableContext=savedContext;
                    const scope = `${t.name}:script:${Object.keys(this.blocks).find(id => this.blocks[id] === b)}`;
                    return [...locals.map(name => this.localDeclaration(name, scope, procedureLocals)), ...lines];
                };
                const plainBody = parameters => scoped(() => this.body(b.next, this.stopGuards(), this.tokenLine()), parameters);
                // An Arcade event hat gets its event's sprites as parameters.
                const eventBody = (handles, kind = null, parameters = handles) => {
                    this.eventHandles = handles;
                    this.eventKind = kind;
                    const lines = plainBody(parameters);
                    this.eventHandles = null;
                    this.eventKind = null;
                    return lines;
                };
                if (['event_whenflagclicked','arcade_whenSourceStarts'].includes(b.opcode)) {
                    // The green flag starts the ORIGINAL sprite's scripts; clones do not exist yet.
                    if (clonable) this.use('gone');
                    script = scoped(() => this.body(b.next, [...this.stopGuards(), ...(clonable ? ['_gone(self)'] : [])]));
                    if (script.length) script.unshift(...this.tokenLine());
                    if (script.length) flagScripts.push({script, clonable, sv, plain: !clonable && !this.tokened()});
                } else if (b.opcode === 'event_whenkeypressed') {
                    const key = this.field(b, 'KEY_OPTION');
                    const btn = this.scratchButton(key);
                    if (!btn) {
                        handlers.push(`// ${this.note(`when key "${key}" pressed (Arcade has arrows, A and B)`)}`);
                    } else if (clonable) {
                        // Every instance of a cloned sprite hears the key.
                        const {fn} = this.scriptFunction('key', b, false);
                        this.use('wait');
                        handlers.push(`${btn}.onEvent(ControllerButtonEvent.Pressed, function () {\n    const w = new _Wait()\n    for (const s of ${this.allOf(t.name)}) _spawnFor(w, ${fn}, s)\n})`);
                    } else {
                        script = plainBody();
                        handlers.push(`${btn}.onEvent(ControllerButtonEvent.Pressed, function () {\n${script.join('\n')}\n})`);
                    }
                } else if (b.opcode === 'event_whenbroadcastreceived') {
                    this.use('wait');
                    this.usesBroadcast = true;
                    register(this.receivers, String(this.field(b, 'BROADCAST_OPTION')).toLowerCase(), this.scriptFunction('on', b, true));
                } else if (b.opcode === 'event_whenbackdropswitchesto') {
                    this.use('wait');
                    register(this.backdropHats, String(this.field(b, 'BACKDROP')), this.scriptFunction('backdrop', b, true));
                } else if (b.opcode === 'control_start_as_clone') {
                    if (!clonable) {
                        handlers.push(`// when I start as a clone: ${t.name} is never cloned, so this script never runs (as in Scratch)`);
                        continue;
                    }
                    const {fn} = this.scriptFunction('cloned', b, false);
                    if (!this.cloneScripts.has(t.name)) this.cloneScripts.set(t.name, []);
                    this.cloneScripts.get(t.name).push(fn);
                // ── Arcade event hats (E2: the import's arcade_when* words, back to their PXT calls) ──
                } else if (b.opcode === 'arcade_whenUpdate' || b.opcode === 'arcade_whenInterval') {
                    const period = b.opcode === 'arcade_whenInterval' ? this.literalNumber(b, 'PERIOD') : null;
                    const api = b.opcode === 'arcade_whenUpdate' ? 'game.onUpdate(' : `game.onUpdateInterval(${period}, `;
                    if (b.opcode === 'arcade_whenInterval' && (period === null || period <= 0)) {
                        handlers.push(`// ${this.note('Arcade interval period must be a fixed positive number')}`);
                    } else if (clonable) {
                        // A cloned sprite's hat runs in every instance, as the key hats
                        // do; its body speaks of \`self\`, which a plain handler lacks.
                        const {fn} = this.scriptFunction(b.opcode === 'arcade_whenUpdate' ? 'update' : 'interval', b, false);
                        this.use('wait');
                        handlers.push(`${api}function () {\n    const w = new _Wait()\n    for (const s of ${this.allOf(t.name)}) _spawnFor(w, ${fn}, s)\n})`);
                    } else {
                        handlers.push(`${api}function () {\n${plainBody().join('\n')}\n})`);
                    }
                } else if (b.opcode === 'arcade_whenSpriteCreated') {
                    const kind = this.kindExpr(b, 'KIND');
                    script = eventBody(['sprite'], this.literalInput(b, 'KIND'));
                    handlers.push(`sprites.onCreated(${kind}, function (sprite: Sprite) {\n${script.join('\n')}\n})`);
                } else if (b.opcode === 'arcade_whenSpriteDestroyed') {
                    const kind = this.kindExpr(b, 'KIND');
                    script = eventBody(['sprite']);
                    handlers.push(`sprites.onDestroyed(${kind}, function (sprite: Sprite) {\n${script.join('\n')}\n})`);
                } else if (b.opcode === 'arcade_whenRegisteredDestroyed' || Object.prototype.hasOwnProperty.call(REGISTERED_HAT_KINDS, b.opcode)) {
                    continue;                               // emitted where it is registered
                } else if (b.opcode === 'arcade_whenSpritesOverlap') {
                    const first = this.kindExpr(b, 'A');
                    const second = this.kindExpr(b, 'B');
                    script = eventBody(['sprite', 'otherSprite']);
                    handlers.push(`sprites.onOverlap(${first}, ${second}, function (sprite: Sprite, otherSprite: Sprite) {\n${script.join('\n')}\n})`);
                } else if (b.opcode === 'arcade_whenCountdownEnds') {
                    handlers.push(`info.onCountdownEnd(function () {\n${plainBody().join('\n')}\n})`);
                } else if(b.opcode==='arcade_whenCallableDispatched' && this.callableExports?.has(t)) {
                    continue;
                } else if (b.opcode === 'procedures_definition') {
                    const proto = this.block(b.inputs && b.inputs.custom_block && b.inputs.custom_block[1]);
                    if (!proto || !proto.mutation) continue;
                    const names = JSON.parse(proto.mutation.argumentnames || '[]').map(ident);
                    const key = `${t.isStage ? '' : t.name}:${proto.mutation.proccode}`;
                    const callableEntry=this.callableExports?.get(t);
                    if(callableEntry && [...callableEntry.graph.plan.owners].some(owner=>owner.procedure===proto.mutation.proccode)) {
                        if(!callableEntry.emitted){try{functions.push(...callableEntry.emitter.declarations());}catch(error){this.note(error.message);}callableEntry.emitted=true;}
                        continue;
                    }
                    if(this.objectClassExport.procedures.has(key))continue;
                    // A refused prototype has no actual owned export symbol.
                    // Retain its diagnostic instead of emitting a null function,
                    // but still compile the body (output discarded) so its own
                    // refusals, e.g. inspection proofs, are reported as before.
                    const fn = this.functionName(t,proto.mutation.proccode);
                    if(!fn){
                        const saved=this.currentLocalNames;this.currentLocalNames=new Set();
                        try{this.body(b.next,[],[],!this.managedValueProcedures.has(key));}catch(error){this.note(error.message);}
                        finally{this.currentLocalNames=saved;}
                        continue;
                    }
                    const types = imageParameterTypes.get(key) || [];
                    const declaredTypes=names.map((n,i)=>this.procedureConstraints?.annotation(t,proto.mutation.proccode,i) || this.objectClassExport.procedureParameterType?.(key,n));
                    const params=names.map((n,i)=>`${n}: ${declaredTypes[i] || types[i] || 'any'}`);
                    // It runs in its caller's thread, so it checks the caller's run token.
                    if (this.tokened()) params.unshift('_t: number');
                    if (clonable) {
                        this.use('gone');
                        params.unshift('self: Sprite');
                    }
                    const saved = this.currentLocalNames,savedContext=this.currentCallableContext;
                    this.currentLocalNames = new Set();
                    if(callableEntry?.graph.plan.version===2){
                        const creates=new Set(callableEntry.graph.plan.sites.filter(site=>site.createdIn===callableEntry.graph.plan.module).map(site=>callableEntry.graph.creates.get(site.id)));
                        this.currentCallableContext=this.objectClassExport.classCallableProvider(this.target).contextForModuleRoot(b,callableEntry.emitter,creates);
                    }
                    script = this.body(b.next, [...this.stopGuards(), ...(clonable ? ['_gone(self)'] : [])], [], !this.managedValueProcedures.has(key));
                    const locals = [...this.currentLocalNames].filter(name => !names.includes(name));
                    const procedureLocals = this.currentLocalNames;
                    this.currentLocalNames = saved;this.currentCallableContext=savedContext;
                    // A procedure that returns a value (arcade_returnValue) is typed by
                    // what flows out of it; one that falls off its end returns undefined, as in PXT.
                    const returning = line => /^\s*return [^\s/]/.test(line);
                    const returns = script.some(returning);
                    const returnType = returns ? `: ${this.objectClassExport.procedureResultType?.(key) || this.arrayReturnTypes.get(key) || (this.imageReturnFunctions.has(key) ? 'Image' :
                        this.spriteReturnFunctions.has(key) ? 'Sprite' : this.valueReturnTypes.get(key) || 'any')}` : '';
                    const tail = returns && !returning(script.at(-1) || '') ? ['    return undefined'] : [];
                    // A stop/clone guard exits with a bare \`return\`; in a function that
                    // returns a value PXT rejects that ("Not all code paths return a value").
                    const body = returns ? script.map(line => line.replace(/\breturn\s*$/, 'return undefined')) : script;
                    const localLines=locals.map(name=>this.localDeclaration(name,key,procedureLocals));
                    const lines = [...localLines, ...body, ...tail];
                    const dormantTypes=this.inferUnreachableSpriteParameterTypes(t,b,proto,names,
                        `function ${fn} (${params.join(', ')})${returnType} {\n${lines.join('\n')}\n}`);
                    const injected=params.length-names.length;
                    for(const [i,type]of dormantTypes){
                        // Explicit primitive constraints remain authoritative.
                        // A dormant body still has to compile: retaining a
                        // Number/String/Boolean formal beside `.flags` is a
                        // declaration conflict, not permission to coerce it.
                        if(['number','string','boolean'].includes(declaredTypes[i])){
                            this.note(`Procedure parameter constraint: dormant flags receiver ${names[i]} requires a Sprite declaration, incompatible with ${declaredTypes[i]}`);
                        }else if(!declaredTypes[i]&&(!types[i]||types[i]==='any'))params[injected+i]=`${names[i]}: ${type}`;
                    }
                    const declaration={target:t,definition:b,name:fn,resultType:returnType,
                        localTypes:new Map(locals.map(name=>[name,this.objectClassExport?.localDeclarationType?.(key,name)??this.localValueTypes.get(key)?.get(name)??'any'])),
                        index:functions.length,
                        render:plan=>`function ${fn} (${params.join(', ')})${plan?.result?': Sprite':returnType} {\n${[
                            ...locals.map((name,index)=>plan?.locals.has(name)?`    let ${name}: Sprite = null`:localLines[index]),
                            ...body,...tail].join('\n')}\n}`};
                    declaration.source=declaration.render();
                    ordinaryDeclarations.push(declaration);
                    functions.push(declaration.source);
                } else if (/^(procedures_prototype|argument_|.*_menu$)/.test(b.opcode)) {
                    continue;
                } else if (b.opcode === 'event_whenthisspriteclicked' || b.opcode === 'event_whenstageclicked') {
                    const pointer = this.browserPointer();
                    if (!pointer) handlers.push('// ' + this.note('when ' +
                        (b.opcode === 'event_whenstageclicked' ? 'stage' : 'this sprite') + ' clicked: ' + MOUSE_WHY));
                    else {
                        if (!pointer.scripts.has(t)) pointer.scripts.set(t, {functions: []});
                        pointer.scripts.get(t).functions.push(this.scriptFunction('click', b, false).fn);
                    }
                } else if (/^event_|^control_start_as_clone/.test(b.opcode)) {
                    handlers.push(`// ${this.note(`${b.opcode} script`)}`);
                } else if (!b.parent) {
                    continue;                               // a loose block: not a script
                }
            }
        }
        const pre = [];                                     // kinds, costume and backdrop sets
        const generated = [];                               // clone, broadcast and backdrop machinery
        for (const token of this.registeredCallbackBlocks.keys()) {
            if (!this.usedRegisteredCallbacks.has(token)) this.note(`Arcade registered callback ${token} has no registration`);
        }
        for (const token of this.destroyedCallbacks.keys()) {
            if (!this.usedDestroyedCallbacks.has(token)) this.note(`Arcade sprite destruction callback ${token} has no registration`);
        }
        for (const monitor of this.project.monitors || []) {
            if (monitor?.opcode !== 'data_variable' || !monitor.visible) continue;
            const entry = this.variableMonitor(monitor.id, monitor.params?.VARIABLE);
            if (entry) entry.visible = true;
            if (monitor.mode === 'slider') this.note('Scratch variable monitor sliders have no portable Arcade input');
        }
        if (this.variableMonitors.size) {
            this.warn('Scratch variable monitors use compact labels on the Arcade screen');
            for (const {flag, visible} of this.variableMonitors.values()) pre.push(`let ${flag} = ${visible}`);
            handlers.push(this.variableMonitorDrawing());
        }
        if (this.scratchKeyboard?.setup.length) {
            out.push(...this.scratchKeyboard.setup);
            this.warn('Arcade keyboard controls keep the Scratch keys. Physical controllers use the assigned Arcade buttons.');
        }
        // Declarations: every variable the program touched, then the sprites.
        const objectClasses=this.objectClassExport.render();
        const decls = [...new Set(this.globals.values())];
        if(this.requiresTextSpritePackage)this.customSpriteKinds.delete('Text');
        if (this.boundSpriteKinds.size) {
            out.push('namespace SpriteKind {');
            for (const kind of this.boundSpriteKinds) out.push(`    export let ${kind}: number`);
            out.push('}');
        }
        out.push(...objectClasses);
        for (const n of decls) {
            if(this.callableGlobals?.has(n)){out.push(`let ${n}: ${renderCallableSignature(this.callableGlobals.get(n))}`);continue;}
            const referenceCell=[...this.sourceReferenceCells.values()].find(cell=>cell.ts===n);
            if(referenceCell && this.editedSavedReferenceIds.has(referenceCell.id)) {
                const edited=this.editedSavedReferenceIds.get(referenceCell.id);
                out.push(`let ${n}: any = ${edited === undefined ? 'undefined' : JSON.stringify(edited)}`);
                continue;
            }
            if(referenceCell){out.push(`let ${n}: ${this.objectClassExport?.variableDeclarationTypes?.get(n) ?? referenceCell.type}`);continue;}
            const sourceCell=[...this.sourceScalarCells.values()].find(cell=>cell.ts===n);
            if (sourceCell) {out.push(`let ${n}: ${sourceCell.type.toLowerCase()}`);continue;}
            if(this.objectClassExport?.sdkVariable?.(n)){out.push(`let ${n}: Image`);continue;}
            const actualClassType=this.objectClassExport?.variableDeclarationTypes?.get(n);
            if(actualClassType){
                const reference=actualClassType.endsWith('[]')||this.objectClassExport.hasType(actualClassType);
                const initial=reference?'null':this.initialGlobals.has(n)?JSON.stringify(this.initialGlobals.get(n)):'0';
                out.push(`let ${n}: ${actualClassType} = ${initial}`);continue;
            }
            const objectType=this.objectClassExport?.variableTypes.get(n);
            if(objectType && this.objectClassExport.hasType?.(objectType)){out.push(`let ${n}: ${objectType} = null`);continue;}
            if(['number','boolean','string'].includes(objectType)){out.push(`let ${n}: ${objectType} = ${objectType==='string'?'\"\"':objectType==='boolean'?'false':'0'}`);continue;}
            // A dead saved default (see startup-first-write-globals.js) of a
            // global whose actual writers the type graph proves String is not
            // a producer: declare it string with the type's own default.
            const variableId=this.globalVariableIds.get(n);
            if(variableId&&this.deadSavedInitials.has(variableId)&&this.primitiveVariableTypes.get(variableId)==='string'){out.push(`let ${n} = ""`);continue;}
            const kinds = this.kinds.get(n) || new Set(['number']);
            // A dead saved default of a mixed/any global is not a value either:
            // declare it without an initializer (no root `= 0` producer).
            const deadAny=!!variableId&&this.deadSavedInitials.has(variableId);
            // A variable given both text and numbers is `any` — Scratch's own
            // variables are untyped, and that is the honest translation.
            const arrayKind=[...kinds].find(kind=>kind.endsWith('[]'));
            const initial = this.initialGlobals.has(n) ? JSON.stringify(this.initialGlobals.get(n)) : '0';
            // Scratch's saved zero is a real initial value, even when the
            // script later assigns text or Boolean values. Keep both types.
            const initialScalarType = typeof this.initialGlobals.get(n);
            const mixedInitialScalar = this.initialGlobals.has(n) &&
                ['string', 'boolean', 'number'].some(kind => kinds.has(kind) && kind !== initialScalarType);
            out.push(arrayKind?`let ${n}: ${arrayKind} = null`:this.handleVars.has(n) ? `let ${n}: Sprite = null` :
                kinds.size > 1 || kinds.has('any') || mixedInitialScalar ? (deadAny ? `let ${n}: any` : `let ${n}: any = ${initial}`) : kinds.has('string') ? `let ${n} = ${this.initialGlobals.has(n) ? initial : '""'}` : kinds.has('boolean') ? `let ${n} = ${this.initialGlobals.has(n) ? initial : 'false'}` : kinds.has('Buffer') ? `let ${n}: Buffer = null` : kinds.has('mp.Player') ? `let ${n}: mp.Player = null` : kinds.has('scene.Scene') ? `let ${n}: scene.Scene = null` : kinds.has('ArcadePhysicsEngine') ? `let ${n}: ArcadePhysicsEngine = null` : kinds.has('animation.Animation') ? `let ${n}: animation.Animation = null` : kinds.has('SevenSegDigit') ? `let ${n}: SevenSegDigit = null` : kinds.has('DigitCounter') ? `let ${n}: DigitCounter = null` : kinds.has('TextSprite') ? `let ${n}: TextSprite = null` : kinds.has('Dart') ? `let ${n}: Dart = null` : kinds.has('Corgio') ? `let ${n}: Corgio = null` : kinds.has('tiles.Tile') ? `let ${n}: tiles.Tile = null` : kinds.has('tiles.Location') ? `let ${n}: tiles.Location = null` : kinds.has('tiles.TileMapData') ? `let ${n}: tiles.TileMapData = null` : kinds.has('image') ? `let ${n}: Image = null` : `let ${n} = ${initial}`);
        }
        const stringGlobals=new Set(out.map(line=>/^let ([A-Za-z_$][\w$]*)(?:: string(?: = .*)?| = "(?:[^"\\]|\\.)*")$/.exec(line)?.[1]).filter(Boolean));
        // A receiver whose final declaration is not string (for example a
        // live saved default) keeps the original cast helper form.
        const castConcat=[...this.directConcatGlobals].filter(name=>!stringGlobals.has(name));
        if(castConcat.length)this.use('sdkConcat');
        const castArguments=[...this.directStringArguments].filter(call=>!stringGlobals.has(/\(([^)]*)\)$/.exec(call)[1]));
        const concatForm=chunk=>castArguments.reduce((text,call)=>text.split(call).join(call.replace(/\(([^)]*)\)$/,'("" + $1)')),
            castConcat.reduce((text,name)=>text.split(`${name}.concat(<any>`).join(`__bwSdkConcat(<any>${name}, `),chunk));
        const animationLookupDefinitions=new Map();
        if (this.usesAnimationResources) {
            const resources = [...this.authoredAnimationArrays.values()];
            for (const resource of resources) out.push(`let ${resource.variable}: Image[] = assets.animation\`${resource.nativeId}\``);
            animationLookupDefinitions.set(this.animationFunctionNames.frames,`function ${this.animationFunctionNames.frames} (id: string): Image[] {\n${resources.map(resource =>
                `    if (id == ${JSON.stringify(resource.id)}) return ${resource.variable}`).join('\n')}\n    console.log("Animation resource unavailable: " + id)\n    return undefined\n}`);
            animationLookupDefinitions.set(this.animationFunctionNames.fresh,`function ${this.animationFunctionNames.fresh} (id: string): Image[] {\n${resources.map(resource =>
                `    if (id == ${JSON.stringify(resource.id)}) return assets.animation\`${resource.nativeId}\``).join('\n')}\n    console.log("Animation resource unavailable: " + id)\n    return undefined\n}`);
            animationLookupDefinitions.set(this.animationFunctionNames.interval,`function ${this.animationFunctionNames.interval} (id: string): number {\n${resources.map(resource =>
                `    if (id == ${JSON.stringify(resource.id)}) return ${resource.frames[0].durationMs}`).join('\n')}\n    console.log("Animation resource unavailable: " + id)\n    return undefined\n}`);
        }
        out.push(...animationLookupDefinitions.values());
        for (const {name, frames} of [...this.frameArrays.values(), ...this.sharedImageArrays.values()]) {
            out.push(`let ${name}: Image[] = [${frames.map(frame => toImgLiteral(frame)).join(', ')}]`);
        }
        for (const [n, items] of this.lists) {
            const lit = items.map(x => (typeof x === 'number' || (String(x).trim() !== '' && Number.isFinite(Number(x))) ?
                String(Number(x)) : JSON.stringify(String(x))));
            out.push(`let ${n}: any[] = [${lit.join(', ')}]`);
        }
        for(const variable of this.namedArrays.values())out.push(`let ${variable}: any[] = null`);
        for(const helper of this.legacyValueHelpers.values())out.push(helper.source);
        if (this.usedNa) out.push('let _na = 0  // stands in for values with no Arcade counterpart (see comments)');
        if (this.usesPen) out.push('_penInit()');
        const penColour = nearestIndex([0, 0, 255], this.palette);      // Scratch's pen starts blue
        for (const t of this.sprites) {
            if (t === this.importedBackgroundTarget) continue;
            if (this.templateNames.has(t.name) || (this.hasHandles && t.name === 'Game')) continue;
            // The importer uses Game as a home for program-level scripts even
            // when the source creates no sprite. Do not invent an Arcade sprite
            // or require artwork for that target when its blocks never use self.
            if (this.isScriptHost(t)) continue;
            const s = this.spriteVar.get(t.name);
            this.emittedSprites.add(t);
            const current = t.currentCostume || 0;
            if (this.costumeUsers.has(t.name)) {
                const set = this.costumeSet(t);
                pre.push(`let ${set}: Image[] = [\n${t.costumes.map((c, i) => toImgLiteral(this.image(t, c, i))).join(',\n')}\n]`);
                pre.push(`let ${this.costumeNames(t)}: string[] = ${JSON.stringify(t.costumes.map(c => c.name))}`);
                out.push(`let ${s} = sprites.create(${set}[${current}], SpriteKind.Player)`);
                out.push(`${s}.data["_c"] = ${current}`);
            } else {
                const img = toImgLiteral(this.image(t));
                out.push(`let ${s} = sprites.create(${img}, SpriteKind.Player)`);
            }
            out.push(`${s}.setPosition(${Number(t.x || 0)} / 3 + 80, 60 - ${Number(t.y || 0)} / 3)`);
            if (t.visible === false) out.push(`${s}.setFlag(SpriteFlag.Invisible, true)`);
            if (this.scratchPose.has(t.name)) {
                const style = t.rotationStyle || 'all around';
                out.push(this.use('scratchPose', '_scratchRotationStyle(' + s + ', ' + JSON.stringify(style) + ')'));
                if (Number.isFinite(t.direction) && t.direction !== 90) out.push('_scratchPoint(' + s + ', ' + t.direction + ')');
            }
            if (this.scratchScale.has(t.name) && Number.isFinite(t.size) && t.size !== 100) {
                out.push(s + '.setScale(Math.max(0.01, ' + t.size / 100 + '))');
            }
            if (this.penUsers.has(t.name)) out.push(`${s}.data["_pc"] = ${penColour}`);
            for (const [key, init] of this.cloneVars.get(t.name) || []) {
                const num = typeof init === 'number' || (String(init).trim() !== '' && Number.isFinite(Number(init)));
                out.push(`${s}.data[${JSON.stringify(key)}] = ${num ? String(Number(init)) : JSON.stringify(String(init))}`);
            }
        }
        for (const name of this.clonable) {
            const id = ident(name);
            const kind = this.kindOf(name);
            pre.push(`const ${kind} = SpriteKind.create()`);
            const keys = ['_c', '_pd', '_pc', '_ps', ...(this.cloneVars.get(name) || new Map()).keys()];
            const pose = this.scratchPose.has(name);
            if (pose) keys.push('_bwScratchDirection', '_bwScratchRotationStyle', '_bwScratchFlipped');
            generated.push([
                `function _all_${id} (): Sprite[] {`,
                `    return [${this.spriteVar.get(name)}].concat(sprites.allOfKind(${kind}))`,
                '}',
                // A clone starts as a copy of its parent: place, visibility,
                // layer, costume and pen; then its `when I start as a clone`
                // scripts run on it. Scratch stops at 300 clones.
                `function _clone_${id} (src: Sprite) {`,
                `    if (sprites.allOfKind(${kind}).length >= 300) return`,
                `    const c = sprites.create(src.image, ${kind})`,
                '    c.setPosition(src.x, src.y)',
                '    c.setFlag(SpriteFlag.Invisible, (src.flags & SpriteFlag.Invisible) != 0)',
                '    c.z = src.z',
                ...(pose ? ['    c.rotationDegrees = src.rotationDegrees'] : []),
                ...(this.scratchScale.has(name) ? ['    c.setScale(src.scale)'] : []),
                `    for (const k of ${JSON.stringify(keys)}) c.data[k] = src.data[k]`,
                ...(this.cloneScripts.get(name) || []).map(fn => `    control.runInParallel(function () { ${fn}(c) })`),
                '}'
            ].join('\n'));
        }
        for (const t of this.stopOthers) {
            if (this.isClonable(t)) continue;
            const [mark, kept] = this.stopMarks(t);
            pre.push(`let ${mark} = 0  // stop other scripts in ${t.isStage ? 'stage' : t.name}: runs up to here are ended`);
            pre.push(`let ${kept} = 0  // ... except this one, the run that stopped them`);
        }
        if (this.usesStageSpeech) {
            out.push('let _bwStageSpeech = sprites.create(image.create(1, 1), SpriteKind.create())');
            out.push('_bwStageSpeech.setPosition(80, 65)');
            out.push('_bwStageSpeech.z = 100');
        }
        if (this.usesStopAll) {
            // Scratch's Runtime.stopAll: every script ends, clones are deleted,
            // sounds stop, speech bubbles clear. The sprites, the pen, the
            // variables and the game loop stay — so hats still start scripts.
            generated.push([
                'function _stopAll () {',
                '    _stopMark = _tokens',
                ...[...this.clonable].map(name => `    sprites.destroyAllSpritesOfKind(${this.kindOf(name)})`),
                '    music.stopAllSounds()',
                ...(this.usesStageSpeech ? ['    _bwStageSpeech.sayText("")'] : []),
                ...(this.usesSay ? this.sprites.filter(t => this.emittedSprites.has(t)).map(t => `    ${this.spriteVar.get(t.name)}.sayText("")`) : []),
                '}'
            ].join('\n'));
        }
        if (this.usesBroadcast || this.receivers.size) {
            this.use('wait');
            generated.push(this.dispatcher('_broadcast', this.receivers, 'msg'));
        }
        if (this.usesBackdrops && stage) {
            this.use('wait');
            const current = stage.currentCostume || 0;
            pre.push(`let _backdrops: Image[] = [\n${stage.costumes.map((c, i) => this.backdrop(stage, c, i)).join(',\n')}\n]`);
            pre.push(`let _backdropNames: string[] = ${JSON.stringify(stage.costumes.map(c => c.name))}`);
            pre.push(`let _bd = ${current}`);
            generated.push([
                // Switching shows the backdrop and starts its `when backdrop switches to` scripts.
                'function _setBackdrop (i: number): _Wait {',
                '    i = Math.floor(i) % _backdrops.length',
                '    if (i < 0) i += _backdrops.length',
                '    _bd = i',
                '    scene.setBackgroundImage(_backdrops[i])',
                '    return _backdropHats(_backdropNames[i])',
                '}',
                this.dispatcher('_backdropHats', this.backdropHats, 'name')
            ].join('\n'));
            if (!nativeArcade) out.push(this.stageMatte());
            out.push('scene.setBackgroundImage(_backdrops[_bd])');
        } else if (stage && this.opts.stageBackground) {
            const bg = this.opts.stageBackground(stage);
            if (bg) {
                if (!nativeArcade) out.push(this.stageMatte());
                out.push(`scene.setBackgroundImage(${toImgLiteral(bg)})`);
            }
        }
        if (this.pointer) this.pointerSource(pre, handlers);
        if (this.textAnswer) pre.push('let ' + this.textAnswer + ' = ""');
        // The green flag's scripts run side by side. An imported Arcade program
        // (one flag script, nothing that can stop it) is its own startup code, run
        // in place, so it keeps PXT's order: what it creates exists before the
        // first frame. It becomes a function when it declares locals or returns.
        let startup;
        if (this.arcadeValues && flagScripts.length === 1 && flagScripts[0].plain) {
            const lines = flagScripts[0].script;
            if (lines.some(line => /^\s*(let |const |return\b)|\breturn$/.test(line))) {
                let name = '__bwStartup';
                const occupied = new Set([...this.globals.values(), ...this.functionNames(), ...this.spriteVar.values(), ...this.artVar.values()]);
                while (occupied.has(name)) name += '_';
                functions.push(`function ${name} () {\n${lines.join('\n')}\n}`);
                startup = [`${name}()`];
            } else {
                startup = lines;
            }
        } else {
            startup = flagScripts.map(({script, clonable, sv}) =>
                `control.runInParallel(function () {\n${clonable ? `    const self = ${sv}\n` : ''}${script.join('\n')}\n})`);
        }
        const dormantDeclarations=dormantSpriteDeclarations({project:this.project,records:ordinaryDeclarations,
            isUnreachable:(target,node)=>this.isUnreachable(target,node),current:()=>this.closedOrdinaryEntryCurrent(),
            literal:(target,node,name)=>this.literalInput(node,name),resolveCall:(target,node)=>this.functionSymbols.call(target,node),
            namedArrays:this.namedArrays,globalName:(target,name)=>{
                if(typeof name!=='string')return null;
                const local=Object.values(target.variables||{}).some(value=>value[0]===name);
                if(local&&this.isClonable(target)&&!this.isGlobalVar(name))return 'self';
                const owner=local?target:this.project.targets.find(value=>value.isStage)||target;
                return this.globals.get(`${owner.isStage?'':owner.name}:${name}`)||null;
            }});
        if(this.closedOrdinaryEntryCurrent())for(const [record,plan]of dormantDeclarations){
            for(const conflict of plan.conflicts)this.note(conflict);
            functions[record.index]=record.render(plan);
        }
        const assemble=definitions=>{
            const chunks=[...helperSource(this.helpers),...definitions,
                ...pre,...generated,...this.generated,...functions,...out,...handlers,...startup].map(concatForm);
            const source=chunks.join('\n')+'\n';
            // Final output may prepend these sources after emit(). Until they
            // are included in one reference graph, retain every lookup when
            // any such prefix is present. Do not infer absence from spelling.
            if(!this.snapshotCallbacks||!isProjectJsonSnapshot(this.project)||this.tileAssets.entries.size||
                this.requiresStringArraySettings||this.songAssets.size||!this.animationFrameProducers.isCurrent())return source;
            const unused=unusedAnimationLookups(source,animationLookupDefinitions,
                new Set([...this.authoredAnimationArrays.values()].map(resource=>resource.nativeId)));
            return unused.size?chunks.filter(chunk=>!unused.has(chunk)).join('\n')+'\n':source;
        };
        const definitions=[...this.valueOperationHelpers.values()];
        const addition=this.valueOperationHelpers.get('BinaryAdd');
        if(addition){
            // Analyse the complete emitted Program with the genuine native join
            // body, not declaration annotations or an Array input connection.
            // No user string or call is rewritten: final assembly selects the
            // definition owned by this emitter after complete source proof.
            const candidate=nativeArrayAddHelperSource(addition.name,true,true);
            const draft=assemble(definitions.map(helper=>helper===addition?candidate:helper.source));
            const additionProfile=this.callableExports.size?GENERATED_HELPER_PROFILES.metadata:GENERATED_HELPER_PROFILES.ordinary;
            const proof=inspectNativeAdditionExportDomains(nativeAdditionNamedAssetView(nativeAdditionAnimationView(
                parseMakeCodeTs(draft,additionProfile),this.authoredAnimationArrays.values()),this.namedMissingAssets),additionProfile);
            // Array-free program with primitive/Opaque operands only: the
            // ordinary helper below is main's pre-join export (operator
            // decision 2026-10-27). Every other refusal is retained unchanged.
            if(proof.reason&&proof.ordinaryFallback===true&&proof.current()){ /* ordinary helper */ }
            // Owner decision 2026-10-30: an operand domain or Array effect the
            // proof cannot establish no longer refuses the export. The helper
            // decides per value at run time (Array.isArray -> the same join
            // as the proven Array path, else ordinary `+`). Source-integrity
            // refusals (supplied private tags, ambiguous or changed identity)
            // keep refusing; proven paths below are unchanged.
            else if(proof.reason&&runtimeDispatchAdditionReason(proof.reason))
                return assemble(definitions.map(helper=>helper===addition?runtimeDispatchAddHelperSource(addition.name):helper.source));
            else if(proof.reason){
                this.note(proof.reason);
                try {
                    this.unsupportedDetails.push({reason:proof.reason,
                        refusal:proof.refusal||{schema:'native-addition-refusal-v1',helper:addition.name,
                            operand:'UNAVAILABLE',foundTypes:'UNAVAILABLE',initialization:'UNAVAILABLE',
                            capturedScalar:'UNAVAILABLE',sourceCallOrdinal:'UNAVAILABLE'},
                        physicalOrigin:'UNAVAILABLE',emissionCandidates:this.nativeAdditionSites.map(site=>({...site,operands:[...site.operands]}))});
                    this.refusalEvidence={nativeAdditionDraft:draft};
                }catch { /* Diagnostic failure must preserve the original reason. */ }
            }
            else if(!proof.helpers.has(addition.name)&&proof.current())
                return assemble(definitions.map(helper=>helper===addition?runtimeDispatchAddHelperSource(addition.name):helper.source));
            else if(!proof.helpers.has(addition.name))this.note('native addition requires its complete current helper body and actual caller proof');
            else if(!proof.current())this.note('native helper source changed before export selection');
            else if(proof.arrayHelpers?.has(addition.name))
                return assemble(definitions.map(helper=>helper===addition?candidate:helper.source));
        }
        return assemble(definitions.map(helper=>helper.source));
    }
}

/**
 * @param {object} project a Scratch project JSON (vm.toJSON() / SB3Creator's shape)
 * @param {object} [opts]
 * @param {(target, costume) => string|null} [opts.costumeSvg] the costume's SVG text, if it is an SVG
 * @param {(target, costume) => {rgba, width, height}|null} [opts.costumeRgba] its pixels, for anything else
 * @param {(target, costume) => Array<string|null>|null} [opts.costumePalette] editable palette, if any
 * @param {boolean} [opts.browserPointer] keep Scratch pointer controls in the browser simulator
 * @param {Array<object>} [opts.animationDocuments] full published Pixel timeline source documents
 * @param {(stage) => object|null} [opts.stageBackground] a 160x120 palette image for the backdrop
 * @returns {{ts: string, files: object, unsupported: string[], warnings: string[]}}
 */
function emitProjectToArcade (project, opts, snapshotCallbacks) {
    const e = new ArcadeEmitter(project, opts, snapshotCallbacks);
    const projectTs = e.emit();
    e.prepareAuthoredAnimations();
    const songNamespace = e.animationSymbol('__bwSongAssets');
    const songNames = new Set(e.songAssets.keys());
    let songId = 1;
    for (const resource of e.songAssets.values()) {
        while (songNames.has(`song${songId}`)) songId++;
        resource.id = `song${songId++}`;
    }
    // Plain TypeScript has no companion resource files; keep it executable.
    const songFactory = [...e.songAssets.values()].map(resource =>
        `            case ${JSON.stringify(resource.name)}: case ${JSON.stringify(resource.id)}: return hex\`${resource.hex}\``).join('\n');
    const songSource = songFactory ? `namespace ${songNamespace} {\n    helpers._registerFactory("song", function (name: string) {\n        switch (helpers.stringTrim(name)) {\n${songFactory}\n        }\n        return null\n    })\n}\n` : '';
    const ts = (e.requiresStringArraySettings ? STRING_ARRAY_SETTINGS_SOURCE+'\n' : '') + e.tileAssets.inlineSource() + songSource + projectTs;
    // Publish unused assets as well, without introducing unused main-code helpers.
    e.prepareAuthoredAnimations();
    const resources = [...e.authoredAnimationArrays.values()];
    const assetFiles = resources.length ? {
        'images.g.jres': `${JSON.stringify(Object.fromEntries(resources.map(resource =>
            [`myAnimations.${resource.nativeId}`, resource.nativeEntry])), null, 4)}\n`,
        'images.g.ts': `namespace ${e.animationFactoryNamespace} {\n    helpers._registerFactory("animation", function (name: string) {\n        switch (helpers.stringTrim(name)) {\n${resources.map(resource => [...new Set([resource.nativeEntry.displayName, resource.nativeId])].map(alias =>
            `            case ${JSON.stringify(alias)}:`).join('\n') +
            `\n                return [${resource.literals.join(',\n')}]`).join('\n')}\n        }\n        return null\n    })\n}\n`
    } : {};
    Object.assign(assetFiles, e.tileAssets.files());
    if(e.requiresStringArraySettings)assetFiles[STRING_ARRAY_SETTINGS_PATH]=STRING_ARRAY_SETTINGS_SOURCE;
    if (e.songAssets.size) {
        assetFiles['songs.g.jres'] = JSON.stringify(Object.fromEntries([...e.songAssets.values()].map(resource =>
            [resource.id, {mimeType: SONG_MIME, namespace: 'mySongs.', displayName: resource.name, data: resource.hex}])), null, 4) + '\n';
        assetFiles['songs.g.ts'] = songSource;
    }
    const sourceEntries = [];
    // Companion data comes from the original admitted serialized document,
    // consistent with the normalized native resource even if a callback edited
    // the live input. Final currentness still refuses that stale export.
    for (const resource of resources) {
        try { validateDocument(resource.document); }
        catch (error) {
            // The public behaviour exporter also accepts normalized frame-only
            // inputs. They are not complete, editable artwork documents.
            e.warn(`Animation "${resource.name}" rich source not exported: ${error.message}`);
            continue;
        }
        sourceEntries.push({nativeId: resource.nativeEntry.namespace ?
            `${resource.nativeEntry.namespace}.${resource.nativeEntry.id}` : resource.nativeEntry.id,
        document: resource.document, nativeEntry: resource.nativeEntry});
    }
    if (sourceEntries.length) assetFiles[ANIMATION_COMPANION_PATH] = encodeAnimationCompanion(sourceEntries, e.palette);
    const name = opts.name || 'brickwright-game';
    const files = {
        'main.ts': projectTs,
        ...assetFiles,
        'pxt.json': `${JSON.stringify({
            name, description: 'Exported from BrickWright', dependencies: {device: '*', ...(e.pointer ? {'browser-events': '*'} : {}), ...(e.requiresTextSpritePackage ? {'arcade-text':'github:microsoft/arcade-text#fa2439314c6633943666a763fdae32a5c67a9ae8'} : {}), ...(e.requiresSpriteDataPackage ? {'arcade-sprite-data':'github:microsoft/arcade-sprite-data#332026d12c46286c7afe59bc4829ccf08471d5b1'} : {}), ...(e.requiresCarnivalPackage ? {'arcade-carnival':'github:microsoft/arcade-carnival#v0.0.7'} : {}), ...(e.requiresLegacyTilemapPackage ? {'color-coded-tilemap': '*'} : {}), ...(e.requiresAnimationPackage ? {animation: '*'} : {}), ...(e.requiresSevensegPackage ? {sevenseg: '*'} : {}), ...(e.requiresDartsPackage ? {darts: '*'} : {}), ...(e.requiresCorgioPackage ? {corgio: '*'} : {}), ...(e.requiresScrollerPackage ? {'arcade-background-scroll': e.scrollerVersion===LEGACY_SCROLLER_REVISION?`github:riknoll/arcade-background-scroll#${LEGACY_SCROLLER_REVISION}`:'github:microsoft/arcade-background-scroll#v0.1.2'} : {}), ...(e.requiresCharacterAnimationsPackage ? {'arcade-character-animations': `github:microsoft/arcade-character-animations#${e.characterVersion}`} : {}), ...(e.requiresMultiplayerPackage ? {multiplayer: '*'} : {})},
            files: [...Object.keys(assetFiles), 'main.ts'], preferredEditor: 'tsprj',
            ...(!samePalette(e.palette, ARCADE_PALETTE) ? {palette: ['#000000', ...e.palette.slice(1)]} : {})
        }, null, 4)}\n`
    };
    if((opts.sdkImagePrototype||[...e.callableExports.values()].some(entry=>entry.sdkImageEnabled))&&e.callableExports.size){
        const reconstructed=parseMakeCodeTs(projectTs,{parameterDefaults:true,retainParentheses:true,
            retainWhenUsed:true,retainClassHeritage:true,retainCallableMetadata:true});
        const proof=proveClassCallableSource(reconstructed,{sdkImagePrototype:true});
        if(!proof.eligible)e.note('SDK Image export requires actual producers throughout the complete reconstructed current program');
        for(const diagnostic of proof.unsupported)e.note(diagnostic);
    }
    if(e.callableExports.size && !opts.callableLexicalPrototype && !opts.classCallablePrototype) {
        // Approval covers the complete reconstructed current program, including
        // adjacent functions; lexical metadata cannot grant a broader surface.
        const reconstructed=parseMakeCodeTs(projectTs,{parameterDefaults:true,
            retainParentheses:true,retainWhenUsed:true,retainClassHeritage:true,retainCallableMetadata:true});
        const named=proveNamedFunctionSource(reconstructed);
        const gate=named.eligible?named:e.classCallableDefaultTargets.size?classCallableSourceGate(reconstructed):callableSourceGate(reconstructed);
        if(!gate.eligible)e.note(e.classCallableDefaultTargets.size?'Class callable default export requires the proved complete ordinary-class source surface':'Callable default export requires the bounded numeric factory surface');
        for(const diagnostic of gate.unsupported)e.note(diagnostic);
    }
    if(e.procedureConstraints?.procedures().length){
        const selected=new Set(e.procedureConstraints.procedures().map(({target,code})=>e.functionName(target,code)));
        try{for(const diagnostic of validateProcedureConstraintSource(parseMakeCodeTs(projectTs,{parameterDefaults:true,retainParentheses:true}),{onlyFunctions:selected,ordinaryPrimitiveSdkNumbers:true,sceneClockNumbers:true,closedOrdinaryEntries:true}))e.note(diagnostic);}catch(error){e.note(error.message);}
    }
    const createdFieldReceivers=e.createdFieldWriteSites.length&&[...e.objectClassExport.classes.values()].some(cls=>!cls.intrinsic)?createCreatedFieldExportReceivers({
        sources:[ts,JSON.parse(files['pxt.json']).files.filter(name=>name.endsWith('.ts')).map(name=>files[name]).join('\n')],
        sites:e.createdFieldWriteSites,current:()=>isProjectJsonSnapshot(e.project)||!!e.arrayOwnedSource?.current()
    }):()=>null;
    // Validate only after the complete class/handler program exists. Every
    // existing producer/RHS/declaration equation still runs, even on refusal.
    e.objectClassExport.validatePrimitiveExport(createdFieldReceivers);
    if(!e.frameDeltaNumbersCurrent())e.note('Frame delta Number: current saved reporter proof environment changed during export');
    if(!e.closedOrdinaryEntryCurrent())e.note('Arcade ordinary entry: current execution roots changed during export');
    // Host artwork callbacks can edit current project objects during rendering.
    // Stale owner/global/local inventories must never become a clean export.
    if(!e.functionSymbols?.current())e.note('Arcade ordinary symbol: current project or owner inventory changed during export');
    if(e.arrayProofCheckCount){
        let current=!e.arrayOwnedSourceUsed||e.arrayOwnedSource.current();
        if(current)try{
            for(let i=0;i<e.arrayProofCheckCount;i++){
                const row=e.arrayProofChecks[i];
                if(!row.authority.validateInput(row.target,row.node,row.name).ok){current=false;break;}
            }
        }catch{current=false;}
        if(e.arrayOwnedSourceUsed&&!e.arrayOwnedSource.current())current=false;
        if(!current)e.note('Array export source or owned proof environment changed after the snapshot was captured');
    }
    // Host artwork callbacks can run after the last Array operand. Never
    // publish a clean export against a later document revision.
    if (!e.animationFrameProducers.isCurrent()) e.note('Animation resource documents changed during current export');
    if(!e.mathNumbersCurrent())e.note('Arcade math normal result: current proof environment changed during export');
    const result={ts, files, unsupported: e.unsupported, warnings: e.warnings};
    if(e.unsupportedDetails.length){result.unsupportedDetails=e.unsupportedDetails;result.refusalEvidence=e.refusalEvidence;}
    return result;
}

/** Re-exported for callers that build a background from pixels. */
export {imageToSvg};

/** Direct AST entry keeps its original callback receiver and two arguments. */
export function projectToArcade(project,opts={}){return emitProjectToArcade(project,opts,false);}

const freezeSnapshotContext=Object.freeze,snapshotIndexOf=Array.prototype.indexOf,snapshotApply=Reflect.apply;
const snapshotAssetContext=(project,target,costume)=>freezeSnapshotContext({
    targetIndex:snapshotApply(snapshotIndexOf,project.targets,[target]),
    costumeIndex:snapshotApply(snapshotIndexOf,target.costumes,[costume])
});

/**
 * Export an owned deeply frozen snapshot of actual serialized project JSON.
 * Asset callbacks receive frozen records. costumePalette additionally receives
 * a read-only {targetIndex,costumeIndex}; direct AST callback arity is unchanged.
 */
// Diagnostic serialization never calls an object's getters, toJSON or coercion.
// Capture intrinsics before artwork callbacks can alter inherited methods.
const refusalQuote=JSON.stringify,refusalKeys=Reflect.ownKeys,refusalDescriptor=Object.getOwnPropertyDescriptor,
    refusalPrototype=Object.getPrototypeOf,refusalOwn=Object.hasOwn,refusalArray=Array.isArray,
    refusalFinite=Number.isFinite,refusalIs=Object.is,refusalCreate=Object.create,
    refusalDefine=Object.defineProperty,refusalFreeze=Object.freeze,refusalApply=Reflect.apply,
    refusalCodeUnit=String.prototype.charCodeAt,refusalIndex=String,
    refusalObjectPrototype=Object.prototype,refusalArrayPrototype=Array.prototype;
const refusalLimit=8*1024*1024,refusalSize={},refusalShape={};
const refusalUtf8=text=>{
    let bytes=0;
    for(let i=0;i<text.length;i++){
        const unit=refusalApply(refusalCodeUnit,text,[i]);
        if(unit<0x80)bytes++;
        else if(unit<0x800)bytes+=2;
        else if(unit>=0xd800&&unit<=0xdbff&&i+1<text.length){
            const next=refusalApply(refusalCodeUnit,text,[i+1]);
            if(next>=0xdc00&&next<=0xdfff){bytes+=4;i++;}else bytes+=3;
        }else bytes+=3;
    }
    return bytes;
};
const observeRefusedJson=(input,result)=>{
    const base={schema:'arcade-clean-export-observation-v1',origin:'owned-json-export',limitUtf8Bytes:refusalLimit};
    let inputBytes;
    try{
        if(typeof input!=='string')throw refusalShape;
        inputBytes=refusalUtf8(input);
        if(inputBytes>refusalLimit)throw refusalSize;
        let text='',bytes=0,nodes=0;
        const active=refusalCreate(null),budget=refusalLimit-inputBytes;
        const append=part=>{
            bytes+=refusalUtf8(part);if(bytes>budget)throw refusalSize;text+=part;
        };
        const encode=(value,depth=0)=>{
            if(value===null){append('null');return;}
            if(typeof value==='string'||typeof value==='boolean'){append(refusalQuote(value));return;}
            if(typeof value==='number'){
                if(!refusalFinite(value)||refusalIs(value,-0))throw refusalShape;
                append(refusalQuote(value));return;
            }
            if(typeof value!=='object'||depth>128||++nodes>20000)throw refusalShape;
            for(let i=0;i<depth;i++)if(active[i]===value)throw refusalShape;
            const prototype=refusalPrototype(value),array=refusalArray(value);
            if(prototype!==null&&prototype!==(array?refusalArrayPrototype:refusalObjectPrototype))throw refusalShape;
            active[depth]=value;
            const keys=refusalKeys(value);
            if(array){
                const length=refusalDescriptor(value,'length');
                if(!length||!refusalOwn(length,'value')||!refusalFinite(length.value)||
                    length.value<0||length.value%1||keys.length!==length.value+1)throw refusalShape;
                append('[');
                for(let i=0;i<length.value;i++){
                    const descriptor=refusalDescriptor(value,refusalIndex(i));
                    if(!descriptor||!refusalOwn(descriptor,'value')||!descriptor.enumerable)throw refusalShape;
                    if(i)append(',');encode(descriptor.value,depth+1);
                }
                append(']');
            }else{
                append('{');
                for(let i=0;i<keys.length;i++){
                    const key=keys[i],descriptor=refusalDescriptor(value,key);
                    if(typeof key!=='string'||!descriptor||!refusalOwn(descriptor,'value')||!descriptor.enumerable)throw refusalShape;
                    if(i)append(',');append(refusalQuote(key));append(':');encode(descriptor.value,depth+1);
                }
                append('}');
            }
            delete active[depth];
        };
        encode(result);
        return refusalFreeze({...base,captureStatus:'COMPLETE',inputJson:input,resultJson:text,
            inputUtf8Bytes:inputBytes,resultUtf8Bytes:bytes,totalUtf8Bytes:inputBytes+bytes});
    }catch(error){
        return refusalFreeze({...base,captureStatus:error===refusalSize?'UNAVAILABLE_SIZE':'UNAVAILABLE_SERIALIZATION',
            ...(inputBytes===undefined?{}:{inputUtf8Bytes:inputBytes})});
    }
};

export function projectJsonToArcade(json,opts={}){
    // The GUI can request an observation of a later clean export. Keep the
    // default successful API result shape unchanged, and never invoke an
    // accessor or accept an inherited option while selecting this diagnostic.
    let captureClean=false;
    try{
        const captureOption=opts&&typeof opts==='object'?refusalDescriptor(opts,'captureObservation'):null;
        captureClean=!!captureOption&&refusalOwn(captureOption,'value')&&captureOption.value===true;
    }catch{ /* Diagnostic option inspection cannot replace the original export. */ }
    const result=emitProjectToArcade(createProjectJsonSnapshot(json),opts,true);
    // The single original invocation has already completed. Capture its actual
    // result, never reparse/re-export or replace its original exception.
    if(typeof json==='string'&&(result.unsupported.length||captureClean))try{
        const observation=observeRefusedJson(json,result),previous=refusalDescriptor(result,'refusalEvidence');
        const old=previous&&refusalOwn(previous,'value')?previous.value:null;
        const evidence=refusalCreate(old?refusalPrototype(old):refusalObjectPrototype);
        if(old)for(const key of refusalKeys(old)){
            const descriptor=refusalDescriptor(old,key);
            if(typeof key!=='string'||!descriptor||!refusalOwn(descriptor,'value'))throw refusalShape;
            refusalDefine(evidence,key,descriptor);
        }
        refusalDefine(evidence,'ownedJsonObservation',{value:observation,enumerable:true,writable:true,configurable:true});
        refusalDefine(result,'refusalEvidence',{value:evidence,enumerable:true,writable:true,configurable:true});
    }catch{ /* Evidence failure cannot replace the actual result/refusal. */ }
    return result;
}
