const makeExt = require('../adapter');
const createConsoleInspectValues = require('./console-inspect-values');
const nullSpriteGetter = require('../../../util/bw-null-sprite-getter');
const highScoreFaults = require('./high-score-faults');
const tileLookupFaults = require('../../../util/bw-tile-lookup-faults');
const sceneClockNumber = require('./scene-clock-number');
const frameDeltaNumber = require('./frame-delta-number');

// Shared game-console blocks. The original extension described a micro:bit
// 5x5 game API but implemented every VM method as a no-op. Keep its opcodes
// compatible while making them useful in Scratch, MakeCode Arcade, PyBadge
// and SAMD51 projects; the GUI console reads the same runtime state.
module.exports = makeExt(`// Name: Arcade
// ID: arcade
// Description: Game controls, sprites, score and badge hardware for micro:bit and Arcade boards.
// By: CrispStrobe <https://github.com/CrispStrobe>
// License: MPL-2.0
(function (Scratch) {
  "use strict";

  const dependencies = Scratch.BWExtensionDependencies;
  const nullFilterDescriptor=Object.getOwnPropertyDescriptor,nullFilterKeys=Reflect.ownKeys;
  const nullFilterPrototype=Object.getPrototypeOf,nullFilterArrayPrototype=Array.prototype;
  const nullFilterDefine=Object.defineProperty;
  const fontSelectorOwner = dependencies.fontSelectorOwner;
  const spriteUpdateHosts = new WeakMap();
  const classCallableHosts = new WeakMap();
  const managedReturnHosts = new WeakMap();
  const sdkImageOwners = new WeakMap();
  const ownedSpriteOwners = new WeakMap();
  const ownedSpriteBridges = new WeakMap();
  const exceptionOwners = new WeakMap();
  // Result of a dispatched user handler whose fiber ended with an uncaught exception.
  const fiberDied = Object.freeze({});
  const procedureOwners = new WeakMap();
  const scoreNumberOwners = new WeakMap();
  const scoreThresholdRegistrations = new WeakMap();
  const sceneClockOwners = new WeakMap(), sceneClockValues = new WeakMap();
  const frameDeltaOwners = new WeakMap(), frameDeltaValues = new WeakMap();
  const nullSpriteOwners = new WeakMap();
  const nullSpriteFaults = new WeakMap();
  const procedureEntryDisposers = new WeakMap();
  // An image sprite's opacity mask is derived from its pixels when it is read.
  // Drawing into the image (often many draws per frame) only marks it stale.
  // Assigning a mask (costume artwork) turns it back into plain data.
  const imageMasks = new WeakMap();
  function markImageMask(sprite) {
    const entry=imageMasks.get(sprite);
    if(entry && Object.getOwnPropertyDescriptor(sprite,'mask')?.get){entry.stale=true;return;}
    imageMasks.set(sprite,{stale:true,mask:null});
    Object.defineProperty(sprite,'mask',{configurable:true,enumerable:true,
      get(){const own=imageMasks.get(sprite);if(own.stale){const pixels=sprite.image?.pixels;if(pixels)own.mask=pixels.map(color=>color?1:0);own.stale=false;}return own.mask;},
      set(value){imageMasks.delete(sprite);Object.defineProperty(sprite,'mask',{configurable:true,enumerable:true,writable:true,value});}});
  }
  const speechPalette = ['#000000', '#ffffff', '#ff2121', '#ff93c4', '#ff8135', '#fff609',
    '#249ca3', '#78dc52', '#003fad', '#87f2ff', '#8e2ec4', '#a4839f', '#5c406c', '#e5cdc4', '#91463d', '#000000'];

  const imageEngine = dependencies.createImageEngine(speechPalette, dependencies.initializeImage);
  const originalSpriteData = dependencies.initializeSpriteData();
  const animationResourceMenuItems = dependencies.animationResourceMenuItems;
  const {RotatedBoundingBox, rasterWindow: rotatedRasterWindow, rasterFootprint: rotatedRasterFootprint} = dependencies.initializeRotation();

  const spriteFlags = {AutoDestroy: 4, StayInScreen: 8, DestroyOnWall: 16, BounceOnWall: 32, ShowPhysics: 64, Invisible: 128, RelativeToCamera: 512,
    GhostThroughTiles: 1024, GhostThroughWalls: 2048, GhostThroughSprites: 4096, Ghost: 7168};

  class Arcade {
    constructor(runtime) {
      this._runtime = runtime;
      const newExceptionOwner=()=>dependencies.arcadeExceptions.create(runtime,(args,util)=>
        Scratch.BWValues.decode(dependencies.currentNumberInput(runtime,args,util,'arcade_throwValue')),
        (child,args,util)=>spriteUpdateHosts.get(this)?.consumeChild(child,args,util));
      exceptionOwners.set(this,newExceptionOwner());
      managedReturnHosts.set(this,dependencies.createManagedReturnValues(runtime));
      scoreThresholdRegistrations.set(this,new WeakMap());
      this._sourceScalarCells = dependencies.createSourceScalarCells(runtime, Scratch.BWValues, dependencies.sourceReferenceTypes, dependencies.sourceCallableCells);
      // A module-held owner ties the narrow score Number ingress to this actual
      // implementation, including its writers. It exposes no score/state value.
      const scorePrototype=Object.getPrototypeOf(this),scoreMethods=new Map(
        ['getInfo','getPlayerScore','setPlayerScore','changePlayerScore','_lifeState','_infoState','_state'].map(name=>
          [name,Object.getOwnPropertyDescriptor(scorePrototype,name)?.value]));
      const sourceResultDescriptor=Object.getOwnPropertyDescriptor,sourceResultPrototype=Object.getPrototypeOf,sourceResultOwn=Object.prototype.hasOwnProperty,sourceResultApply=Reflect.apply;
      const sourceResultMethods=['sourceValueBinary','sourceValueUnary','_bindSourceOperationAdapter'].map(name=>[name,Object.getOwnPropertyDescriptor(scorePrototype,name)?.value]);
      const promptResultMethods=['askForStringLength','_askForString'].map(name=>[name,Object.getOwnPropertyDescriptor(scorePrototype,name)?.value]);
      const highScoreMethods=['highScore','_readHighScore','_settingsStore','_highScoreFailure'].map(name=>[name,Object.getOwnPropertyDescriptor(scorePrototype,name)?.value]);
      const scoreNumberOwner=Object.freeze({isInstance:value=>value===this,isHighScoreCurrent:()=>Object.getPrototypeOf(this)===scorePrototype&&Object.getOwnPropertyDescriptor(this,'_runtime')?.value===runtime&&highScoreMethods.every(([name,method])=>typeof method==='function'&&!Object.hasOwn(this,name)&&Object.getOwnPropertyDescriptor(scorePrototype,name)?.value===method),isCurrent:()=>Object.getPrototypeOf(this)===scorePrototype &&
        Object.getOwnPropertyDescriptor(this,'_runtime')?.value===runtime && [...scoreMethods].every(([name,method])=>
          typeof method==='function' && !Object.prototype.hasOwnProperty.call(this,name) &&
          Object.getOwnPropertyDescriptor(scorePrototype,name)?.value===method),
        isPromptCurrent:()=>sourceResultPrototype(this)===scorePrototype&&sourceResultDescriptor(this,'_runtime')?.value===runtime&&promptResultMethods.every(([name,method])=>typeof method==='function'&&!sourceResultApply(sourceResultOwn,this,[name])&&sourceResultDescriptor(scorePrototype,name)?.value===method),
        isSourceCurrent:()=>{
          if(sourceResultPrototype(this)!==scorePrototype||sourceResultDescriptor(this,'_runtime')?.value!==runtime)return false;
          for(let i=0;i<sourceResultMethods.length;i++){
            const name=sourceResultMethods[i][0],method=sourceResultMethods[i][1];
            if(typeof method!=='function'||sourceResultApply(sourceResultOwn,this,[name])||sourceResultDescriptor(scorePrototype,name)?.value!==method)return false;
          }
          return true;
        }});
      scoreNumberOwners.set(this,scoreNumberOwner);
      // One sealed owner and fault service per faulting primitive (null Sprite
      // getter, missing Sprite setter, missing Image operations).
      const getterPrototype=Object.getPrototypeOf(this),getterOwners=new Map(),getterFaults=new Map();
      for(const {method,kind} of [...dependencies.nullSpriteGetter.kinds,...dependencies.tileLookupFaults.kinds,...dependencies.highScoreFaults.kinds]){
        const getterMethods=new Map(['getInfo',method,...(dependencies.highScoreFaults.kinds.some(row=>row.method===method)?['_readHighScore','_settingsStore','_highScoreFailure',...(method==='highScore'?[]:['_runGameOver','_prepareGameOverScores','_isBetterScore'])]:[])].map(name=>[name,Object.getOwnPropertyDescriptor(getterPrototype,name)?.value]));
        const getterOwner=Object.freeze({isInstance:value=>value===this,isCurrent:()=>Object.getPrototypeOf(this)===getterPrototype &&
          Object.getOwnPropertyDescriptor(this,'_runtime')?.value===runtime && [...getterMethods].every(([name,method])=>
            typeof method==='function' && !Object.prototype.hasOwnProperty.call(this,name) &&
            Object.getOwnPropertyDescriptor(getterPrototype,name)?.value===method)});
        getterOwners.set(method,getterOwner);getterFaults.set(method,kind.create(runtime,getterOwner));
      }
      nullSpriteOwners.set(this,getterOwners);
      nullSpriteFaults.set(this,getterFaults);
      let clockScenes;
      const clockPrototype=Object.getPrototypeOf(this),clockMethods=new Map(
        ['getInfo','sceneMillis','_state','_ensureSceneEngine','_activateScene','pushScene','popScene'].map(name=>
          [name,Object.getOwnPropertyDescriptor(clockPrototype,name)?.value]));
      const clockData=(object,name)=>{const d=object&&Object.getOwnPropertyDescriptor(object,name);return d&&Object.prototype.hasOwnProperty.call(d,'value')?d.value:undefined;};
      const clockOwner=Object.freeze({isInstance:value=>value===this,isCurrent:()=>Object.getPrototypeOf(this)===clockPrototype&&
        clockData(this,'_runtime')===runtime&&clockScenes instanceof Map&&clockData(this,'_sceneValues')===clockScenes&&[...clockMethods].every(([name,method])=>typeof method==='function'&&
          !Object.prototype.hasOwnProperty.call(this,name)&&clockData(clockPrototype,name)===method),
        context:()=>({state:clockData(runtime,'bwArcadeDeviceState'),serial:clockData(this,'_ownedSpriteSceneSerial'),
          epoch:clockData(this,'_terrainEpoch'),scenes:clockData(this,'_sceneValues')})});
      sceneClockOwners.set(this,clockOwner);sceneClockValues.set(this,dependencies.sceneClockNumber.create(runtime,clockOwner));
      const frameMethods=new Map(['getInfo','frameDeltaTime','_state','_ensureSceneEngine','_activateScene','pushScene','popScene'].map(name=>[name,Object.getOwnPropertyDescriptor(clockPrototype,name)?.value]));
      const frameOwner=Object.freeze({
        isInstance:value=>value===this,
        isCurrent:()=>Object.getPrototypeOf(this)===clockPrototype&&clockData(this,'_runtime')===runtime&&clockScenes instanceof Map&&clockData(this,'_sceneValues')===clockScenes&&[...frameMethods].every(([name,method])=>typeof method==='function'&&!Object.prototype.hasOwnProperty.call(this,name)&&clockData(clockPrototype,name)===method),
        context:()=>({state:clockData(runtime,'bwArcadeDeviceState'),serial:clockData(this,'_ownedSpriteSceneSerial'),epoch:clockData(this,'_terrainEpoch'),scenes:clockData(this,'_sceneValues')})
      });
      frameDeltaOwners.set(this,frameOwner);frameDeltaValues.set(this,dependencies.frameDeltaNumber.create(runtime,frameOwner));
      this._consoleInspectValues=dependencies.createConsoleInspectValues(runtime,this._sourceScalarCells,scoreNumberOwner,sceneClockValues.get(this),frameDeltaValues.get(this));
      const installProcedureOwner=()=>{
        procedureEntryDisposers.get(this)?.();procedureOwners.get(this)?.dispose();
        const owner=dependencies.createProcedureConstraints(runtime,this._consoleInspectValues);
        procedureOwners.set(this,owner);
        procedureEntryDisposers.set(this,dependencies.procedureEntry.register(runtime,owner,
          (args,util,error)=>exceptionOwners.get(this).rejectConstraint(args,util,error)));
      };
      installProcedureOwner();
      this._resetProgramClock();
      this._bufferSuspended = false;
      this._sdkFontValues=runtime && typeof runtime.on==='function' ? dependencies.sdkFontValues.create(runtime,Scratch.BWValues,
        {reference:body=>this._bufferReference(body),resolve:ref=>this._buffer(ref)},{managedStart:true}) : null;
      runtime?.on?.('PROJECT_LOADED',()=>{if(this._sdkFontValues?.isDisposed())this._sdkFontValues=dependencies.sdkFontValues.create(runtime,Scratch.BWValues,
        {reference:body=>this._bufferReference(body),resolve:ref=>this._buffer(ref)},{managedStart:true});});
      this._speechEngine = dependencies.createSpeechEngine(dependencies.initializeSpeech, dependencies.fonts,
        dependencies.initializeNativeLegacy);
      this._fallbackState = null;
      // Palette is display state shared by every scene, never an image mutation.
      this._projectPalette = null;
      this._gameStats=dependencies.createGameStats(text=>{
        if(!runtime)return; // Metadata-only construction has no display owner.
        runtime.bwArcadeStatsText=text;runtime.emit?.('ARCADE_DEVICE_STATS',text);
      });
      this._gameStats.reset();
      this._sceneStack = [];this._sceneParents=new WeakMap();this._seeThroughSources=new WeakMap();this._renderingScenes=new WeakSet();this._sceneFrames=new WeakMap();this._pendingSceneSeconds=new WeakMap();this._frameFaults=new WeakSet();
      this._sceneBundles = new Set();
      this._sceneFlags=dependencies.sceneFlags.create();
      this._particleScenes=new WeakMap();this._particleOverlays=new Map();this._particleAnchors=new WeakMap();
      this._sdkObjectClasses=dependencies.sdkObjectClasses.create(this,Scratch.BWValues);
      let imageOwner;
      const newImageOwner=()=>dependencies.createSdkImageOwner(runtime,Scratch.BWValues,()=>({extension:this,images:this._images,identities:this._imageIds,resolve:this._image,current:sdkImageOwners.get(this)===imageOwner}));
      imageOwner=newImageOwner();sdkImageOwners.set(this,imageOwner);
      const sdkImages=Object.freeze({assert:value=>imageOwner.assert(value)});
      this._ownedSpriteSceneSerial=0;
      let spriteOwner;
      const newSpriteOwner=()=>dependencies.createOwnedSpriteValues(runtime,Scratch.BWValues,{body:value=>imageOwner.body(value)},()=>({
        extension:this,sprites:this._spriteValues,scene:this._state(),epoch:this._terrainEpoch,sceneSerial:this._ownedSpriteSceneSerial,
        current:ownedSpriteOwners.get(this)===spriteOwner,running:!this._terrainStopped}));
      spriteOwner=newSpriteOwner();ownedSpriteOwners.set(this,spriteOwner);
      const ownedApi=Object.freeze({body:value=>spriteOwner.body(value),assert:value=>spriteOwner.assert(value),ownsReference:value=>spriteOwner.ownsReference(value)});
      const spriteBridge=dependencies.createOwnedSpriteBridge(ownedApi,Scratch.BWValues,{
        set:(body,key,value,util)=>this.setSpriteProperty({ID:body.id,PROPERTY:key,VALUE:value},util),
        setPosition:(body,x,y,util)=>this.setSpritePosition({ID:body.id,X:x,Y:y},util)});
      ownedSpriteBridges.set(this,spriteBridge);
      const legacyHooks=this._sdkObjectClasses.heapHooks,ownedHooks=spriteBridge.heapHooks;
      const nativeHooks={...legacyHooks,
        definition:name=>ownedHooks.definition(name)||legacyHooks.definition(name),
        external:value=>ownedHooks.external(value)||legacyHooks.external(value),
        externalClass:value=>ownedHooks.external(value)?ownedHooks.externalClass(value):legacyHooks.externalClass(value),
        assertExternal:(value,definition)=>{if(definition?.name==='__bwOwnedSDKSprite'||ownedHooks.external(value))ownedHooks.assertExternal(value);},
        assertTransport:value=>{if(ownedHooks.external(value))ownedHooks.assertExternal(value);},
        get:(value,key)=>ownedHooks.external(value)?ownedHooks.get(value,key):legacyHooks.get(value,key),
        set:(value,key,valueToSet,util)=>ownedHooks.external(value)?ownedHooks.set(value,key,valueToSet,util):legacyHooks.set(value,key,valueToSet,util)};
      let classCallableOwner;
      const classCallables=dependencies.createClassCallableHost(runtime,Scratch.BWValues,dependencies.createObjectHeap,
        nativeHooks,()=>classCallableOwner,sdkImages);
      if(classCallables)classCallableHosts.set(this,classCallables);
      this._objectHeap=classCallables?.heap || dependencies.createObjectHeap(runtime,Scratch.BWValues,nativeHooks);
      const spriteUpdates=dependencies.spriteUpdateActivation.create(this);
      spriteUpdateHosts.set(this,spriteUpdates);
      this._sdkSpriteUpdates=Object.freeze({claim:spriteUpdates.claim,hasSceneUpdates:spriteUpdates.hasSceneUpdates});
      this._callableValues=new dependencies.CallableValues(runtime,Scratch.BWValues,classCallables?.provider,classCallables?.subscribeLifecycle);
      classCallableOwner=this._callableValues;
      this._callableDispatch=new dependencies.CallableDispatch(runtime,this._callableValues,
        (invocation,util,args)=>this._callableProcedure(invocation,util,args,'arcade_runCallableDispatch'));
      this._renderables=new WeakMap();this._screen=null;this._extensionSprites=new Map();this._frameHandlers=new WeakMap();this._extensionCreationWaits=[];
      this._scenePushHandlers = [];this._scenePopHandlers = [];
      this._scrollerVersion = 'v0.1.2';
      this._characterAnimationVersion = 'v0.1.0';
      this._globalElapsedMs = 0;this._nextMultiplayerState=2;
      this._buttonStates = {};this._repeatDefaults={delay:500,interval:30};this._controllerConnections={};this._controllerInputs={};this._userControllerEvents=true;this._nativeTextDialogs=[];
      this._activeLegacyAnimations = new Set();
      this._updateHandlers = [];this._intervalHandlers = [];this._buttonHandlers = [];
      this._destroyedHandlers = [];this._overlapHandlers = [];this._foreverHandlers=[];this._countdownHandlers=[];
      this._speech = new Map();
      this._imageSkins = new Map();
      this._images = new Map();
      this._sourceTypeOfDisposed = false;
      const sourceObjectOwner = this._objectHeap;
      const sourceCallableOwner = this._callableValues;
      this._sourceTypeOf = dependencies.createSourceTypeOfValues(runtime, Scratch.BWValues, {
        current: () => this._runtime === runtime && this._objectHeap === sourceObjectOwner && this._callableValues === sourceCallableOwner && !this._sourceTypeOfDisposed,
        array: value => Array.isArray(Scratch.BWValues.arrayValue(runtime, value)),
        image: (value, id) => this._images.has(id) && this._image(value) === this._images.get(id),
        buffer: (value, id) => !this._bufferSuspended && Boolean(this._bufferHeap?.values.get(id)),
        object: value => {sourceObjectOwner.inspect(value);return true;},
        callable: value => {
          if(sourceCallableOwner.resource(value).target.isOriginal===false)throw new Error('Callable reflection on clone targets is not qualified');
          return sourceCallableOwner.typeOf(value);
        }
      });
      this._spriteValues = new Map();
      this._playerValues = new Map();this._nextPlayerValue=0;
      this._sceneValues=new Map();this._physicsEngines=new Map();this._nextSceneValue=0;this._nextPhysicsEngine=0;clockScenes=this._sceneValues;
      this._kindRegistry=dependencies.createKindRegistry();
      this._kindInsertion = 0;
      this._animations = new Map();
      this._nextAnimationId = 0;
      this._imageAnimations = new Map();
      this._animationUpdateOrder = [];
      this._tileLocations = new Map();
      this._nextTileLocationId = 0;
      this._tilemapData = new Map();this._nextTilemapData = 0;this._tilemapHandlers = [];this._sceneTilemaps = new Map();
      this._imageIds = new WeakMap();
      this._frameImages = new Map();
      this._animationAssetCache = new Map();
      this._frameDefinitions = new Map();
      this._nextImageId = 0;
      this._creationWaits = new Set();
      this._functionCalls = new Set();
      this._createdHandlers = [];
      this._wallHandlers = [];this._legacyWallHandlers = [];
      this._tileHandlers = [];
      this._terrainWaits = new Set();
      this._nativeButtonWaiters = new Set();
      this._resetSuspensions = new Set();
      this._textPromptWaits = new Set();this._textPromptTail=Promise.resolve();
      this._controllerEventIds = null;this._controlEvents = null;this._controlEventContexts = new WeakMap();
      this._terrainEpoch = 0;
      this._terrainFrame = null;
      this._terrainStopped = false;
      if (runtime && runtime.on) {
        runtime.on('ARCADE_FRAME', elapsedMs => { if(this._sourceSceneTimers())return;this._pumpFunctionCalls(); this._pumpCreationWaits(); this._pumpTerrainWaits(); this._pumpQuestion(Number.isFinite(elapsedMs) && elapsedMs >= 0 ? elapsedMs : 1000 / 30); this._advance(Number.isFinite(elapsedMs) && elapsedMs >= 0 ? elapsedMs / 1000 : 1 / 30); this._musicHost?.pump(); });
        runtime.on('ARCADE_FRAME_END', () => { this._pumpFunctionCalls(); this._pumpCreationWaits(); this._pumpTerrainWaits(); });
        runtime.on('ARCADE_DIALOG_BUTTON_EDGE',(button,held)=>{if(this._dialogs?.[0]?.type==='ask')this._questionButtonEdge(button,held);else this._nativeDialogButtonEdge(button,held);});
        runtime.on('ARCADE_CONTROLLER_INPUT',(player,button,held)=>this._observeControllerInput(player,button,held));
        runtime.on('ARCADE_CONTROLLER_CONNECTION',(player,connected)=>this._controllerConnectionChanged(player,connected));
        runtime.on('ARCADE_PLAYER_BUTTON_EDGE',(player,button,isDown)=>this._controllerButtonEdge(player,button,isDown));
        runtime.on('KEY_STATE_CHANGED',(key,isDown)=>this._keyboardButtonEdge(key,isDown));
        const cancelCreations = () => {
          for(const resolve of this._resetSuspensions)resolve();this._resetSuspensions.clear();
          spriteOwner.stop();
          for(const resolve of this._nativeButtonWaiters)resolve();this._nativeButtonWaiters.clear();
          for(const cancel of this._textPromptWaits)cancel();this._textPromptWaits.clear();
          this._textPromptTail=Promise.resolve();runtime.bwArcadeTextPrompt=null;
          for (const pending of this._creationWaits) pending.resolve('');
          this._creationWaits.clear();
          for(const dialog of this._dialogs || [])dialog.resolve(dialog.type==='ask' ? false : undefined);
          this._dialogs=[];this._cancelNativeTextDialogs();this._showNextDialog();
          for (const call of this._functionCalls) {call.unlink?.();runtime.sequencer?.retireThread(call.thread);if(call.cancel)call.cancel();else call.resolve(0);}
          this._functionCalls.clear();
          this._controlEvents?.cancel();this._controllerEventIds = null;this._controlEventContexts = new WeakMap();
          this._terrainEpoch++;this._terrainFrame = null;this._terrainStopped = true;
          for (const pending of this._terrainWaits) {runtime.sequencer?.retireThread(pending.thread);pending.resolve();}
          this._terrainWaits.clear();
          if(this._foreverTimer!==undefined)this._foreverTimer.clear(this._foreverTimer.handle);this._foreverTimer=undefined;
        };
        runtime.on('PROJECT_STOP_ALL', () => {procedureOwners.get(this).invalidate();this._sourceScalarCells.invalidate();this._sourceTypeOf.invalidateInputs();this._consoleInspectValues.invalidate();managedReturnHosts.get(this).invalidate();});
        runtime.on('RUNTIME_DISPOSED', () => {procedureEntryDisposers.get(this)?.();procedureOwners.get(this).dispose();spriteOwner.dispose();imageOwner.dispose();this._sourceScalarCells.dispose();this._sourceTypeOf.invalidateInputs();this._consoleInspectValues.invalidate();managedReturnHosts.get(this).invalidate();this._sourceTypeOfDisposed=true;this._consoleInspectValues.dispose();managedReturnHosts.get(this).dispose();});
        runtime.on('PROJECT_STOP_ALL', () => this._stopProgramClock());
        runtime.on('PROJECT_STOP_ALL', cancelCreations);
        runtime.on('PROJECT_STOP_ALL', () => {this._carnivalHost?.cancel();this._carnivalHost=null;this._musicHost?.stopAll();});
        runtime.on('RUNTIME_DISPOSED', () => {this._bufferSuspended=true;this._musicHost?.reset();this._musicHost=null;this._musicIds=new Map();this._musicValues=new Map();this._musicGeneration=dependencies.buffers.newHeapId();this._carnivalHost?.cancel();this._carnivalHost=null;this._bufferHeap=null;cancelCreations();this._clearTilemap();this._tileLocations.clear();this._animationAssetCache.clear();for(const id of this._imageSkins.keys())this._clearImage(id);});
        const reset = () => {
          this._resetProgramClock();
          this._gameStats.reset();
          cancelCreations();
          this._terrainStopped = false;
          this._projectPalette = null;
          for(const bundle of this._sceneBundles){
            for(const target of Object.values(bundle.state.spriteTargets || {})) runtime.disposeTarget?.(target);
            for(const entry of bundle._speech.values()){
              // Reset discards native scene ownership; it must not invoke old
              // project callbacks while rebuilding the sprite registries.
              if(!entry.nativeBubbleId)entry.renderer.destroy();
              if(entry.drawableId!==undefined)runtime.renderer?.destroyDrawable(entry.drawableId,'sprite');
              if(entry.skinId!==undefined)runtime.renderer?.destroySkin(entry.skinId);
            }
            for(const key of ['_background','_backgroundImage','_tilemapDrawable'])if(bundle[key]){
              runtime.renderer?.destroyDrawable(bundle[key].drawable,'background');runtime.renderer?.destroySkin(bundle[key].skin);
            }
          }
          this._sceneBundles.clear();this._sceneStack=[];this._sceneParents=new WeakMap();this._seeThroughSources=new WeakMap();this._renderingScenes=new WeakSet();this._sceneFrames=new WeakMap();this._pendingSceneSeconds=new WeakMap();this._frameFaults=new WeakSet();
          this._scenePushHandlers=[];this._scenePopHandlers=[];this._globalElapsedMs=0;this._nextMultiplayerState=2;this._buttonStates={};this._repeatDefaults={delay:500,interval:30};this._controllerConnections={};this._controllerInputs={};this._userControllerEvents=true;this._cancelNativeTextDialogs();
          this._activeLegacyAnimations=new Set();this._updateHandlers=[];this._intervalHandlers=[];this._buttonHandlers=[];
          this._destroyedHandlers=[];this._overlapHandlers=[];this._foreverHandlers=[];this._countdownHandlers=[];
          this._createdHandlers = [];
          this._wallHandlers = [];this._legacyWallHandlers = [];this._tileHandlers = [];
          for (const id of this._speech.keys()) this._clearSpeech(id, undefined, true);
          this._clearParticleOverlays();this._particleScenes=new WeakMap();this._particleAnchors=new WeakMap();
          this._renderables=new WeakMap();this._screen=null;
          this._musicHost?.reset();this._musicIds=new Map();this._musicValues=new Map();this._musicGeneration=dependencies.buffers.newHeapId();
          this._bufferHeap = null;
          this._sevensegIds=new Map();this._sevensegValues=new Map();
          this._scrollerVersion='v0.1.2';this._characterAnimationVersion='v0.1.0';
          this._extensionSprites=new Map();this._frameHandlers=new WeakMap();this._scrollerModule=null;this._characterAnimationModule=null;this._textSpriteModule=null;this._textModule=null;
          this._carnivalHost?.cancel();this._carnivalHost=null;this._gameOver=null;this._buttonPressWaiters=[];
          this._clearBackground();
          for (const id of this._imageSkins.keys()) this._clearImage(id);
          this._images.clear();
          this._spriteValues.clear();
          this._playerValues.clear();this._nextPlayerValue=0;
          this._sceneValues.clear();this._physicsEngines.clear();this._nextSceneValue=0;this._nextPhysicsEngine=0;
          this._kindRegistry.reset();
          this._kindInsertion = 0;
          this._animations.clear();
          this._imageAnimations.clear();
          this._animationUpdateOrder = [];
          this._tileLocations.clear();
          this._nextTileLocationId = 0;
          this._tilemapData.clear();this._nextTilemapData = 0;this._tilemapHandlers = [];this._sceneTilemaps.clear();
          this._clearTilemap();
          this._imageIds = new WeakMap();
          this._frameImages.clear();
          this._animationAssetCache.clear();
          this._frameDefinitions.clear();
          runtime.bwArcadeDeviceState = {};
          this._currentEvent = null;
          for (const dialog of this._dialogs || []) dialog.resolve();
          this._dialogs = [];
          runtime.bwArcadeDialogOpen = false;
          runtime.bwArcadeDialogType = null;
          runtime.emit('ARCADE_DIALOG', null);
          this._changed();
        };
        runtime.on('PROJECT_LOADED', () => {
          exceptionOwners.get(this).dispose();exceptionOwners.set(this,newExceptionOwner());
          imageOwner.dispose();imageOwner=newImageOwner();sdkImageOwners.set(this,imageOwner);
          spriteOwner.dispose();spriteOwner=newSpriteOwner();ownedSpriteOwners.set(this,spriteOwner);
          this._sourceScalarCells.invalidate();this._sourceTypeOf.invalidateInputs();this._consoleInspectValues.dispose();managedReturnHosts.get(this).dispose();
          this._consoleInspectValues=dependencies.createConsoleInspectValues(runtime,this._sourceScalarCells,scoreNumberOwner,sceneClockValues.get(this),frameDeltaValues.get(this));
          installProcedureOwner();
          managedReturnHosts.set(this,dependencies.createManagedReturnValues(runtime));
          // Registry publications belong to the loaded project. GUI artwork
          // restoration repopulates them after successful deserialization.
          runtime.bwArcadeAnimationResources = new Map();
          reset();
          this._bufferSuspended = false;this._sourceTypeOfDisposed=false;
        });
        runtime.on('PROJECT_START',()=>{if(!this._sdkFontValues?.isDisposed())this._sdkFontValues?.startProgram();reset();if(!imageOwner.isDisposed())imageOwner.start();if(!spriteOwner.isDisposed())spriteOwner.start();this._sourceScalarCells.initialize();this._sourceTypeOf.snapshotInputs();this._consoleInspectValues.snapshot();procedureOwners.get(this).start();managedReturnHosts.get(this).start();this._initializeImplicitTextKinds();runtime.startHats('arcade_whenSourceStarts');});
        runtime.on('targetWasRemoved', target => {
          for (const [id, entry] of this._imageSkins) if (entry.target === target) this._clearImage(id);
          for (const [id, entry] of this._speech) if (entry.target === target) this._clearSpeech(id);
        });
        runtime._attachArcadeFramePhase?.(this,dependencies.framePhase);
      }
    }

    getInfo() {
      const str = (name, def) => ({ [name]: { type: Scratch.ArgumentType.STRING, defaultValue: def || '' } });
      const n = (name, def) => ({ [name]: { type: Scratch.ArgumentType.NUMBER, defaultValue: def == null ? 0 : def } });
      return dependencies.highScoreFaults.declareAll(dependencies.palette.arrange(this,dependencies.frameDeltaNumber.declaration(dependencies.sceneClockNumber.declaration(dependencies.tileLookupFaults.declareAll(dependencies.nullSpriteGetter.declareAll(dependencies.createConsoleInspectValues.scoreInfo({
        id: 'arcade',
        name: 'Arcade',
        color1: '#E64980',
        color2: '#D63878',
        color3: '#C42870',
        blocks: [
          {opcode:'whenSourceStarts',blockType:Scratch.BlockType.HAT,text:'when Arcade source starts',isEdgeActivated:false},
          {opcode:'declareSourceReference',blockType:Scratch.BlockType.COMMAND,text:'declare Arcade source reference [VARIABLE] as [TYPE]',arguments:{VARIABLE:{type:Scratch.ArgumentType.STRING},TYPE:{type:Scratch.ArgumentType.STRING,menu:'sourceReferenceTypes',defaultValue:'Sprite'}}},
          {opcode:'declareParameterConstraint',blockType:Scratch.BlockType.COMMAND,text:'declare Arcade procedure [PROCEDURE] parameter [PARAMETER] as [TYPE]',arguments:{PROCEDURE:{type:Scratch.ArgumentType.STRING,menu:'constraintProcedures'},PARAMETER:{type:Scratch.ArgumentType.STRING,menu:'constraintParameters'},TYPE:{type:Scratch.ArgumentType.STRING,menu:'sourceScalarTypes',defaultValue:'Any'}}},
          {opcode:'declareSourceScalar',blockType:Scratch.BlockType.COMMAND,text:'declare Arcade source scalar [VARIABLE] as [TYPE]',arguments:{VARIABLE:{type:Scratch.ArgumentType.STRING},TYPE:{type:Scratch.ArgumentType.STRING,menu:'sourceScalarTypes',defaultValue:'Any'}}},
          {opcode:'sourceWhile',blockType:Scratch.BlockType.LOOP,text:'Arcade repeat while [CONDITION]',arguments:{CONDITION:{type:Scratch.ArgumentType.BOOLEAN}}},
          {opcode:'sceneMillis',blockType:Scratch.BlockType.REPORTER,text:'Arcade scene runtime milliseconds',arguments:{}},
          {opcode:'programMillis',blockType:Scratch.BlockType.REPORTER,text:'Arcade program runtime milliseconds'},
          {opcode:'textSpriteCreate',blockType:Scratch.BlockType.REPORTER,text:'Arcade create text sprite [TEXT] background [BACKGROUND] foreground [FOREGROUND]',arguments:{...str('TEXT','Hello'),...n('BACKGROUND',0),...n('FOREGROUND',1)}},
          {opcode:'textSpriteSetText',blockType:Scratch.BlockType.COMMAND,text:'Arcade text sprite [ID] set text [TEXT]',arguments:{...str('ID',''),...str('TEXT','Hello')}},
          {opcode:'textSpriteSetMaxFontHeight',blockType:Scratch.BlockType.COMMAND,text:'Arcade text sprite [ID] set max font height [HEIGHT]',arguments:{...str('ID',''),...n('HEIGHT',8)}},
          {opcode:'textSpriteSetIcon',blockType:Scratch.BlockType.COMMAND,text:'Arcade text sprite [ID] set icon [IMAGE]',arguments:{...str('ID',''),...str('IMAGE','')}},
          {opcode:'textSpriteSetBorder',blockType:Scratch.BlockType.COMMAND,text:'Arcade text sprite [ID] set border width [WIDTH] color [COLOR] padding [PADDING]',arguments:{...str('ID',''),...n('WIDTH',1),...n('COLOR',6),...n('PADDING',0)}},
          {opcode:'textSpriteSetOutline',blockType:Scratch.BlockType.COMMAND,text:'Arcade text sprite [ID] set outline width [WIDTH] color [COLOR]',arguments:{...str('ID',''),...n('WIDTH',1),...n('COLOR',6)}},
          {opcode:'textSpriteUpdate',blockType:Scratch.BlockType.COMMAND,text:'Arcade text sprite [ID] redraw',arguments:str('ID','')},
          {opcode:'textSpriteProperty',blockType:Scratch.BlockType.REPORTER,text:'Arcade text sprite [ID] property [PROPERTY]',arguments:{...str('ID',''),PROPERTY:{type:Scratch.ArgumentType.STRING,menu:'textSpriteProperties',defaultValue:'text'}}},
          {opcode:'textSpriteSetProperty',blockType:Scratch.BlockType.COMMAND,text:'Arcade text sprite [ID] set property [PROPERTY] to [VALUE]',arguments:{...str('ID',''),...str('VALUE',''),PROPERTY:{type:Scratch.ArgumentType.STRING,menu:'textSpriteProperties',defaultValue:'text'}}},
          {opcode:'followSprite',blockType:Scratch.BlockType.COMMAND,text:'Arcade sprite [ID] follow [TARGET] speed [SPEED] turn rate [TURN]',arguments:{...str('ID',''),...str('TARGET',''),...n('SPEED',100),...n('TURN',400)}},
          {opcode:'unfollowSprite',blockType:Scratch.BlockType.COMMAND,text:'Arcade sprite [ID] stop following',arguments:str('ID','')},
          {opcode:'startParallelHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade run parallel as [TOKEN] capturing [CAPTURES]',arguments:{...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenParallelHandler',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade parallel handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'registerForeverHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register forever as [TOKEN] capturing [CAPTURES]',arguments:{...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredForever',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade forever handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'registerCountdownHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register countdown as [TOKEN] capturing [CAPTURES]',arguments:{...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredCountdown',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade countdown handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'hasLife',blockType:Scratch.BlockType.BOOLEAN,text:'Arcade player [PLAYER] has life',arguments:n('PLAYER',1)},
          {opcode:'getPlayerScore',blockType:Scratch.BlockType.REPORTER,text:'Arcade score player [PLAYER]',arguments:n('PLAYER',1)},
          {opcode:'hasPlayerScore',blockType:Scratch.BlockType.BOOLEAN,text:'Arcade player [PLAYER] has score',arguments:n('PLAYER',1)},
          {opcode:'setPlayerScore',blockType:Scratch.BlockType.COMMAND,text:'Arcade set score player [PLAYER] to [VALUE]',arguments:{...n('PLAYER',1),...n('VALUE',0)}},
          {opcode:'changePlayerScore',blockType:Scratch.BlockType.COMMAND,text:'Arcade change score player [PLAYER] by [VALUE]',arguments:{...n('PLAYER',1),...n('VALUE',1)}},
          {opcode:'setHudVisibility',blockType:Scratch.BlockType.COMMAND,text:'Arcade HUD [ELEMENT] visible [VISIBLE]',arguments:{ELEMENT:{type:Scratch.ArgumentType.STRING,menu:'hudElements',defaultValue:'score'},VISIBLE:{type:Scratch.ArgumentType.BOOLEAN,defaultValue:true}}},
          {opcode:'setLife',blockType:Scratch.BlockType.COMMAND,text:'Arcade set life player [PLAYER] to [VALUE]',arguments:{...n('PLAYER',1),...n('VALUE',3)}},
          {opcode:'changeLife',blockType:Scratch.BlockType.COMMAND,text:'Arcade change life player [PLAYER] by [VALUE]',arguments:{...n('PLAYER',1),...n('VALUE',-1)}},
          {opcode:'getLife',blockType:Scratch.BlockType.REPORTER,text:'Arcade life player [PLAYER]',arguments:n('PLAYER',1)},
          {opcode:'registerLifeZeroHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register life zero player [PLAYER] as [TOKEN] capturing [CAPTURES]',arguments:{...n('PLAYER',1),...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredLifeZero',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade life zero handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'registerScoreHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register score player [PLAYER] threshold [SCORE] as [TOKEN] capturing [CAPTURES]',arguments:{...n('PLAYER',1),...n('SCORE',10),...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredScore',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade score handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'pushScene',blockType:Scratch.BlockType.COMMAND,text:'Arcade push scene'},
          {opcode:'setGameStats',blockType:Scratch.BlockType.COMMAND,text:'Arcade game stats [MODE]',arguments:{MODE:{type:Scratch.ArgumentType.STRING,menu:'gameStatsModes',defaultValue:'enabled'}}},
          {opcode:'setPalette',blockType:Scratch.BlockType.COMMAND,text:'Arcade set palette hex [DATA]',arguments:str('DATA','000000ffffffff2121ff93c4ff8135fff609249ca378dc52003fad87f2ff8e2ec4a4839f5c406ce5cdc491463d000000')},
          {opcode:'popScene',blockType:Scratch.BlockType.COMMAND,text:'Arcade pop scene'},
          {opcode:'buttonRepeatProperty',blockType:Scratch.BlockType.REPORTER,text:'Arcade player [PLAYER] button [BUTTON] repeat property [PROPERTY]',arguments:{PLAYER:{type:Scratch.ArgumentType.STRING,menu:'controlPlayers',defaultValue:'1'},BUTTON:{type:Scratch.ArgumentType.STRING,menu:'repeatButtons',defaultValue:'A'},PROPERTY:{type:Scratch.ArgumentType.STRING,menu:'repeatProperties',defaultValue:'repeatDelay'}}},
          {opcode:'setButtonRepeatProperty',blockType:Scratch.BlockType.COMMAND,text:'set Arcade player [PLAYER] button [BUTTON] repeat property [PROPERTY] to [VALUE]',arguments:{PLAYER:{type:Scratch.ArgumentType.STRING,menu:'controlPlayers',defaultValue:'1'},BUTTON:{type:Scratch.ArgumentType.STRING,menu:'repeatButtons',defaultValue:'A'},PROPERTY:{type:Scratch.ArgumentType.STRING,menu:'repeatProperties',defaultValue:'repeatDelay'},...n('VALUE',0)}},
          {opcode:'setButtonRepeatDefaults',blockType:Scratch.BlockType.COMMAND,text:'set Arcade button repeat defaults delay [DELAY] interval [INTERVAL]',arguments:{...n('DELAY',500),...n('INTERVAL',30)}},
          {opcode:'registerUpdateHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register update as [TOKEN] capturing [CAPTURES]',arguments:{...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredUpdate',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade update handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'addLiteralDrawing',blockType:Scratch.BlockType.COMMAND,hideFromPalette:true,text:'Arcade add drawing commands [COMMANDS] at depth 0',arguments:str('COMMANDS','[]')},
          {opcode:'registerPaintHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register paint as [TOKEN] capturing [CAPTURES]',arguments:{...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredPaint',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade paint handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'registerShadeHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register shade as [TOKEN] capturing [CAPTURES]',arguments:{...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredShade',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade shade handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'screenImage',blockType:Scratch.BlockType.REPORTER,text:'Arcade screen image'},
          // A name the program uses but whose source is not part of it (a missing user namespace or asset): kept by name so
          // export writes it back. Run here it is inert, as PXT would refuse to compile it: a call is a no-op that
          // reports 0, a value reads 0, an image is a 1x1 transparent stand-in, and its callback never fires.
          {opcode:'externalValue',blockType:Scratch.BlockType.REPORTER,text:'Arcade external value [NAME]',arguments:str('NAME','')},
          {opcode:'externalImage',blockType:Scratch.BlockType.REPORTER,text:'Arcade external image [NAME]',arguments:str('NAME','')},
          {opcode:'externalImageCall',blockType:Scratch.BlockType.REPORTER,text:'Arcade external image call [NAME] arguments [ARGS]',arguments:{...str('NAME',''),...str('ARGS','[]')}},
          {opcode:'externalCall',blockType:Scratch.BlockType.REPORTER,text:'Arcade external call [NAME] arguments [ARGS]',arguments:{...str('NAME',''),...str('ARGS','[]')}},
          {opcode:'externalCommand',blockType:Scratch.BlockType.COMMAND,text:'Arcade external command [NAME] arguments [ARGS]',arguments:{...str('NAME',''),...str('ARGS','[]')}},
          {opcode:'registerExternalHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register external [NAME] arguments [ARGS] as [TOKEN] capturing [CAPTURES]',arguments:{...str('NAME',''),...str('ARGS','[]'),...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredExternal',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade external handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'sourceValueBinary',blockType:Scratch.BlockType.REPORTER,text:'Arcade source value [LEFT] [OP] with [RIGHT]',arguments:{...str('LEFT',''),OP:{type:Scratch.ArgumentType.STRING,menu:'sourceBinaryOperations',defaultValue:'+'},...str('RIGHT','')}},
          {opcode:'sourceValueUnary',blockType:Scratch.BlockType.REPORTER,text:'Arcade source unary [OP] of [VALUE]',arguments:{OP:{type:Scratch.ArgumentType.STRING,menu:'sourceUnaryOperations',defaultValue:'~'},...str('VALUE','')}},
          {opcode:'sourceTypeOf',blockType:Scratch.BlockType.REPORTER,text:'Arcade source type of [VALUE]',arguments:{VALUE:{type:Scratch.ArgumentType.STRING}}},
          {opcode:'inspectValue',blockType:Scratch.BlockType.REPORTER,text:'Arcade inspect value [VALUE] limit [LIMIT]',output:'String',arguments:{...str('VALUE',''),...n('LIMIT',20)}},
          {opcode:'fontValue',blockType:Scratch.BlockType.REPORTER,text:'Arcade font [FONT]',arguments:{FONT:{type:Scratch.ArgumentType.STRING,menu:'fontValueNames',defaultValue:'font8'}}},
          {opcode:'fontForText',blockType:Scratch.BlockType.REPORTER,text:'Arcade font for text [TEXT]',arguments:{TEXT:{type:Scratch.ArgumentType.STRING,defaultValue:''}}},
          {opcode:'scaleFont',blockType:Scratch.BlockType.REPORTER,text:'Arcade scale font [FONT] by [SIZE]',arguments:{FONT:{type:Scratch.ArgumentType.STRING,defaultValue:''},SIZE:{type:Scratch.ArgumentType.NUMBER,defaultValue:2}}},
          {opcode:'printImageFont',blockType:Scratch.BlockType.COMMAND,text:'Arcade print [TEXT] on image [IMAGE] x [X] y [Y] color [COLOR] using font [FONT]',
            arguments:{IMAGE:{type:Scratch.ArgumentType.STRING,defaultValue:''},TEXT:{type:Scratch.ArgumentType.STRING,defaultValue:'Hello'},X:{type:Scratch.ArgumentType.NUMBER,defaultValue:0},Y:{type:Scratch.ArgumentType.NUMBER,defaultValue:0},COLOR:{type:Scratch.ArgumentType.NUMBER,defaultValue:1},FONT:{type:Scratch.ArgumentType.STRING,defaultValue:''}}},
          {opcode:'printImageFontCenter',blockType:Scratch.BlockType.COMMAND,text:'Arcade print centered [TEXT] on image [IMAGE] y [Y] color [COLOR] using font [FONT]',
            arguments:{IMAGE:{type:Scratch.ArgumentType.STRING,defaultValue:''},TEXT:{type:Scratch.ArgumentType.STRING,defaultValue:'Hello'},Y:{type:Scratch.ArgumentType.NUMBER,defaultValue:0},COLOR:{type:Scratch.ArgumentType.NUMBER,defaultValue:1},FONT:{type:Scratch.ArgumentType.STRING,defaultValue:''}}},
          {opcode:'fontMetric',blockType:Scratch.BlockType.REPORTER,text:'Arcade font [FONT] metric [PROPERTY]',arguments:{FONT:{type:Scratch.ArgumentType.STRING,menu:'fontMetricFonts',defaultValue:'font5'},PROPERTY:{type:Scratch.ArgumentType.STRING,menu:'fontMetricProperties',defaultValue:'charHeight'}}},
          {opcode:'printImageText',blockType:Scratch.BlockType.COMMAND,text:'Arcade print [TEXT] on image [IMAGE] x [X] y [Y] color [COLOR] font [FONT]',
            arguments:{...str('TEXT','Hello'),...str('IMAGE',''),...n('X',0),...n('Y',0),...n('COLOR',1),FONT:{type:Scratch.ArgumentType.STRING,menu:'imageFonts',defaultValue:'auto'}}},
          {opcode:'legacyGameOver',blockType:Scratch.BlockType.COMMAND,text:'Arcade legacy game over win [WIN] effect [EFFECT]',arguments:{WIN:{type:Scratch.ArgumentType.BOOLEAN},EFFECT:{type:Scratch.ArgumentType.STRING,menu:'legacyGameOverEffects',defaultValue:'unset'}}},
          {opcode:'gameOver',blockType:Scratch.BlockType.COMMAND,text:'Arcade game over win [WIN]',arguments:{WIN:{type:Scratch.ArgumentType.BOOLEAN}}},
          {opcode:'resetGame',blockType:Scratch.BlockType.COMMAND,text:'Arcade reset game',arguments:{}},
          {opcode:'setGameOverEffect',blockType:Scratch.BlockType.COMMAND,text:'Arcade set game over effect [EFFECT] for win [WIN]',arguments:{EFFECT:{type:Scratch.ArgumentType.STRING,menu:'backgroundEffects',defaultValue:'confetti'},WIN:{type:Scratch.ArgumentType.BOOLEAN}}},
          {opcode:'setGameOverMessage',blockType:Scratch.BlockType.COMMAND,text:'Arcade set game over message [MESSAGE] for win [WIN]',arguments:{...str('MESSAGE','GAME OVER!'),WIN:{type:Scratch.ArgumentType.BOOLEAN}}},
          {opcode:'setGameOverPlayable',blockType:Scratch.BlockType.COMMAND,text:'Arcade set game over sound [PLAYABLE] looping [LOOPING] for win [WIN]',arguments:{...str('PLAYABLE',''),LOOPING:{type:Scratch.ArgumentType.BOOLEAN},WIN:{type:Scratch.ArgumentType.BOOLEAN}}},
          {opcode:'setGameOverScoringType',blockType:Scratch.BlockType.COMMAND,text:'Arcade set game over scoring [TYPE]',arguments:{TYPE:{type:Scratch.ArgumentType.STRING,menu:'scoringTypes',defaultValue:'HighScore'}}},
          {opcode:'carnivalCountdown',blockType:Scratch.BlockType.COMMAND,text:'Arcade carnival countdown [SECONDS] seconds style [STYLE] effect [EFFECT]',arguments:{...n('SECONDS',15),STYLE:{type:Scratch.ArgumentType.STRING,menu:'carnivalStyles',defaultValue:'Score'},EFFECT:{type:Scratch.ArgumentType.STRING,menu:'carnivalEffects',defaultValue:'unset'}}},
          {opcode:'carnivalAddLabel',blockType:Scratch.BlockType.COMMAND,text:'Arcade carnival add label [LABEL] position [AREA] color [COLOR] use color [HAS_COLOR]',arguments:{...str('LABEL','Whack-the-Mole'),AREA:{type:Scratch.ArgumentType.STRING,menu:'carnivalAreas',defaultValue:'Bottom'},...n('COLOR',4),HAS_COLOR:{type:Scratch.ArgumentType.BOOLEAN}}},
          {opcode:'carnivalGameOver',blockType:Scratch.BlockType.COMMAND,text:'Arcade carnival game over style [STYLE] effect [EFFECT]',arguments:{STYLE:{type:Scratch.ArgumentType.STRING,menu:'carnivalStyles',defaultValue:'Win'},EFFECT:{type:Scratch.ArgumentType.STRING,menu:'carnivalEffects',defaultValue:'unset'}}},
          {opcode:'carnivalCustomGameOver',blockType:Scratch.BlockType.COMMAND,text:'Arcade carnival custom game over message [MESSAGE] effect [EFFECT] sound [SOUND] use sound [HAS_SOUND] scoring [SCORING] score [SCORE] use score [HAS_SCORE]',arguments:{...str('MESSAGE','Great Job!'),EFFECT:{type:Scratch.ArgumentType.STRING,menu:'carnivalEffects',defaultValue:'unset'},...str('SOUND',''),HAS_SOUND:{type:Scratch.ArgumentType.BOOLEAN},SCORING:{type:Scratch.ArgumentType.STRING,menu:'carnivalScoring',defaultValue:'HScore'},...n('SCORE',0),HAS_SCORE:{type:Scratch.ArgumentType.BOOLEAN}}},
          {opcode:'startImageEffect',blockType:Scratch.BlockType.COMMAND,text:'Arcade start image effect [EFFECT] times [TIMES] delay [DELAY] ms',arguments:{EFFECT:{type:Scratch.ArgumentType.STRING,menu:'imageEffects',defaultValue:'dissolve'},...n('TIMES',0),...n('DELAY',0)}},
          {opcode:'setBackgroundScrollVersion',blockType:Scratch.BlockType.COMMAND,text:'Arcade background scroll version [VERSION]',arguments:{VERSION:{type:Scratch.ArgumentType.STRING,menu:'backgroundScrollVersions',defaultValue:'v0.1.2'}}},
          {opcode:'scrollBackgroundWithCamera',blockType:Scratch.BlockType.COMMAND,text:'Arcade scroll background with camera [MODE] layer [LAYER]',arguments:{MODE:{type:Scratch.ArgumentType.STRING,menu:'cameraScrollModes',defaultValue:'OnlyHorizontal'},...n('LAYER',0)}},
          {opcode:'scrollBackgroundWithSpeed',blockType:Scratch.BlockType.COMMAND,text:'Arcade scroll background vx [VX] vy [VY] layer [LAYER]',arguments:{...n('VX',-50),...n('VY',-50),...n('LAYER',0)}},
          {opcode:'setBackgroundScrollMultipliers',blockType:Scratch.BlockType.COMMAND,text:'Arcade set background scroll multipliers x [X] y [Y] layer [LAYER]',arguments:{...n('X',1),...n('Y',1),...n('LAYER',0)}},
          {opcode:'setBackgroundScrollOffset',blockType:Scratch.BlockType.COMMAND,text:'Arcade set background scroll offset x [X] y [Y] layer [LAYER]',arguments:{...n('X',0),...n('Y',0),...n('LAYER',0)}},
          {opcode:'setBackgroundLayerImage',blockType:Scratch.BlockType.COMMAND,text:'Arcade set background layer [LAYER] image [IMAGE]',arguments:{...n('LAYER',0),...str('IMAGE','')}},
          {opcode:'setBackgroundLayerZ',blockType:Scratch.BlockType.COMMAND,text:'Arcade set background layer [LAYER] z [Z]',arguments:{...n('LAYER',0),...n('Z',-1000)}},
          {opcode:'setCharacterAnimationVersion',blockType:Scratch.BlockType.COMMAND,text:'Arcade character animation version [VERSION]',arguments:{VERSION:{type:Scratch.ArgumentType.STRING,menu:'characterAnimationVersions',defaultValue:'v0.1.0'}}},
          {opcode:'characterFrames',blockType:Scratch.BlockType.COMMAND,text:'Arcade character [MODE] frames of [SPRITE] images [FRAMES] interval [INTERVAL] rule [RULE]',arguments:{MODE:{type:Scratch.ArgumentType.STRING,menu:'characterFrameModes',defaultValue:'loop'},...str('SPRITE',''),...str('FRAMES',''),...n('INTERVAL',500),...n('RULE',0)}},
          {opcode:'setCharacterAnimationsEnabled',blockType:Scratch.BlockType.COMMAND,text:'Arcade set character animations of [SPRITE] enabled [ENABLED]',arguments:{...str('SPRITE',''),ENABLED:{type:Scratch.ArgumentType.BOOLEAN}}},
          {opcode:'setCharacterState',blockType:Scratch.BlockType.COMMAND,text:'Arcade set character state of [SPRITE] to [RULE]',arguments:{...str('SPRITE',''),...n('RULE',0)}},
          {opcode:'clearCharacterState',blockType:Scratch.BlockType.COMMAND,text:'Arcade clear character state of [SPRITE]',arguments:str('SPRITE','')},
          {opcode:'setCharacterController',blockType:Scratch.BlockType.COMMAND,text:'Arcade set character controller of [SPRITE] enabled [ENABLED]',arguments:{...str('SPRITE',''),ENABLED:{type:Scratch.ArgumentType.BOOLEAN}}},
          {opcode:'lockCharacterFacing',blockType:Scratch.BlockType.COMMAND,text:'Arcade lock character facing of [SPRITE] to [DIRECTION]',arguments:{...str('SPRITE',''),DIRECTION:{type:Scratch.ArgumentType.STRING,menu:'characterFacings',defaultValue:'Right'}}},
          {opcode:'unlockCharacterFacing',blockType:Scratch.BlockType.COMMAND,text:'Arcade unlock character facing of [SPRITE]',arguments:str('SPRITE','')},
          {opcode:'dartAction',blockType:Scratch.BlockType.COMMAND,text:'Arcade dart [SPRITE] [ACTION]',arguments:{...str('SPRITE',''),ACTION:{type:Scratch.ArgumentType.STRING,menu:'dartActions',defaultValue:'throwDart'}}},
          {opcode:'dartSwitch',blockType:Scratch.BlockType.COMMAND,text:'Arcade dart [SPRITE] [SETTING] [ON]',arguments:{...str('SPRITE',''),SETTING:{type:Scratch.ArgumentType.STRING,menu:'dartSettings',defaultValue:'setTrace'},ON:{type:Scratch.ArgumentType.BOOLEAN}}},
          {opcode:'setDartProperty',blockType:Scratch.BlockType.COMMAND,text:'Arcade set dart [SPRITE] property [PROPERTY] to [VALUE]',arguments:{...str('SPRITE',''),PROPERTY:{type:Scratch.ArgumentType.STRING,menu:'dartProperties',defaultValue:'angle'},...n('VALUE',0)}},
          {opcode:'corgiControl',blockType:Scratch.BlockType.COMMAND,text:'Arcade corgi [SPRITE] [MODE] [ON]',arguments:{...str('SPRITE',''),MODE:{type:Scratch.ArgumentType.STRING,menu:'corgiModes',defaultValue:'horizontalMovement'},ON:{type:Scratch.ArgumentType.BOOLEAN}}},
          {opcode:'corgiBark',blockType:Scratch.BlockType.COMMAND,text:'Arcade corgi [SPRITE] bark',arguments:str('SPRITE','')},
          {opcode:'corgiAddPhrase',blockType:Scratch.BlockType.COMMAND,text:'Arcade corgi [SPRITE] add phrase [TEXT]',arguments:{...str('SPRITE',''),...str('TEXT','bark')}},
          {opcode:'setCorgiProperty',blockType:Scratch.BlockType.COMMAND,text:'Arcade set corgi [SPRITE] property [PROPERTY] to [VALUE]',arguments:{...str('SPRITE',''),PROPERTY:{type:Scratch.ArgumentType.STRING,menu:'corgiProperties',defaultValue:'gravity'},...n('VALUE',0)}},
          {opcode:'sevensegSetCharacter',blockType:Scratch.BlockType.COMMAND,text:'Arcade set seven segment [DISPLAY] character [CHARACTER]',arguments:{...str('DISPLAY',''),CHARACTER:{type:Scratch.ArgumentType.STRING,menu:'segmentCharacters',defaultValue:'ZERO'}}},
          {opcode:'sevensegSetColor',blockType:Scratch.BlockType.COMMAND,text:'Arcade set seven segment [DISPLAY] color [COLOR]',arguments:{...str('DISPLAY',''),...n('COLOR',2)}},
          {opcode:'sevensegSetRadix',blockType:Scratch.BlockType.COMMAND,text:'Arcade set seven segment [DISPLAY] radix [RADIX]',arguments:{...str('DISPLAY',''),RADIX:{type:Scratch.ArgumentType.STRING,menu:'digitRadixes',defaultValue:'Decimal'}}},
          {opcode:'sevensegSetScale',blockType:Scratch.BlockType.COMMAND,text:'Arcade set seven segment [DISPLAY] scale [SCALE]',arguments:{...str('DISPLAY',''),SCALE:{type:Scratch.ArgumentType.STRING,menu:'segmentScales',defaultValue:'Full'}}},
          {opcode:'sevensegSetProperty',blockType:Scratch.BlockType.COMMAND,text:'Arcade set seven segment [DISPLAY] property [PROPERTY] to [VALUE]',arguments:{...str('DISPLAY',''),PROPERTY:{type:Scratch.ArgumentType.STRING,menu:'sevensegWritable',defaultValue:'value'},...n('VALUE',0)}},
          {opcode:'sevensegAddDigit',blockType:Scratch.BlockType.COMMAND,text:'Arcade add seven segment digit to [DISPLAY]',arguments:str('DISPLAY','')},
          {opcode:'playMusic',blockType:Scratch.BlockType.COMMAND,text:'Arcade play music [PLAYABLE] mode [MODE]',arguments:{...str('PLAYABLE',''),MODE:{type:Scratch.ArgumentType.STRING,menu:'playbackModes',defaultValue:'UntilDone'}}},
          {opcode:'play',blockType:Scratch.BlockType.COMMAND,text:'Arcade play [PLAYABLE] mode [MODE]',arguments:{...str('PLAYABLE',''),MODE:{type:Scratch.ArgumentType.STRING,menu:'playbackModes',defaultValue:'UntilDone'}}},
          {opcode:'playMelody',blockType:Scratch.BlockType.COMMAND,text:'Arcade play melody [MELODY] mode [MODE]',arguments:{...str('MELODY',''),MODE:{type:Scratch.ArgumentType.STRING,menu:'melodyModes',defaultValue:'play'}}},
          {opcode:'playNoteMelody',blockType:Scratch.BlockType.COMMAND,text:'Arcade play note melody [NOTES] at [TEMPO] bpm',arguments:{...str('NOTES','C D E F G A B C5'),...n('TEMPO',120)}},
          {opcode:'playSoundEffect',blockType:Scratch.BlockType.COMMAND,text:'Arcade play sound effect [EFFECT] mode [MODE]',arguments:{...str('EFFECT',''),MODE:{type:Scratch.ArgumentType.STRING,menu:'soundPlayModes',defaultValue:'UntilDone'}}},
          {opcode:'playSound',blockType:Scratch.BlockType.COMMAND,text:'Arcade play sound [SOUND] until done [UNTIL_DONE]',arguments:{...str('SOUND','c d e'),UNTIL_DONE:{type:Scratch.ArgumentType.BOOLEAN}}},
          {opcode:'playTone',blockType:Scratch.BlockType.COMMAND,text:'Arcade play tone [FREQUENCY] Hz for [DURATION] ms',arguments:{...n('FREQUENCY',262),...n('DURATION',500)}},
          {opcode:'ringTone',blockType:Scratch.BlockType.COMMAND,text:'Arcade ring tone [FREQUENCY] Hz',arguments:n('FREQUENCY',262)},
          {opcode:'rest',blockType:Scratch.BlockType.COMMAND,text:'Arcade rest for [DURATION] ms',arguments:n('DURATION',500)},
          {opcode:'setMusicVolume',blockType:Scratch.BlockType.COMMAND,text:'Arcade set music volume to [VOLUME]',arguments:n('VOLUME',128)},
          {opcode:'setTempo',blockType:Scratch.BlockType.COMMAND,text:'Arcade set tempo to [TEMPO] bpm',arguments:n('TEMPO',120)},
          {opcode:'changeTempo',blockType:Scratch.BlockType.COMMAND,text:'Arcade change tempo by [TEMPO] bpm',arguments:n('TEMPO',20)},
          {opcode:'stopAllSounds',blockType:Scratch.BlockType.COMMAND,text:'Arcade stop all sounds'},
          {opcode:'backgroundScrollOffset',blockType:Scratch.BlockType.REPORTER,text:'Arcade background scroll offset [AXIS] layer [LAYER]',arguments:{AXIS:{type:Scratch.ArgumentType.STRING,menu:'scrollAxes',defaultValue:'x'},...n('LAYER',0)}},
          {opcode:'characterRule',blockType:Scratch.BlockType.REPORTER,text:'Arcade character rule [PREDICATES]',arguments:str('PREDICATES','Moving')},
          {opcode:'characterRuleToString',blockType:Scratch.BlockType.REPORTER,text:'Arcade character rule [RULE] as text',arguments:n('RULE',0)},
          {opcode:'characterMatchesRule',blockType:Scratch.BlockType.BOOLEAN,text:'Arcade character [SPRITE] matches rule [RULE]',arguments:{...str('SPRITE',''),...n('RULE',0)}},
          {opcode:'createDart',blockType:Scratch.BlockType.REPORTER,text:'Arcade create dart image [IMAGE] kind [KIND] x [X] y [Y]',arguments:{...str('IMAGE',''),...str('KIND','Player'),...n('X',10),...n('Y',110)}},
          {opcode:'createCorgi',blockType:Scratch.BlockType.REPORTER,text:'Arcade create corgi kind [KIND] x [X] y [Y]',arguments:{...str('KIND','Player'),...n('X',10),...n('Y',70)}},
          {opcode:'dartProperty',blockType:Scratch.BlockType.REPORTER,text:'Arcade dart [SPRITE] property [PROPERTY]',arguments:{...str('SPRITE',''),PROPERTY:{type:Scratch.ArgumentType.STRING,menu:'dartProperties',defaultValue:'angle'}}},
          {opcode:'corgiProperty',blockType:Scratch.BlockType.REPORTER,text:'Arcade corgi [SPRITE] property [PROPERTY]',arguments:{...str('SPRITE',''),PROPERTY:{type:Scratch.ArgumentType.STRING,menu:'corgiProperties',defaultValue:'gravity'}}},
          {opcode:'sevensegDigit',blockType:Scratch.BlockType.REPORTER,text:'Arcade seven segment digit style [STYLE] value [VALUE]',arguments:{STYLE:{type:Scratch.ArgumentType.STRING,menu:'segmentStyles',defaultValue:'Thick'},...n('VALUE',0)}},
          {opcode:'sevensegCounter',blockType:Scratch.BlockType.REPORTER,text:'Arcade seven segment counter style [STYLE] scale [SCALE] digits [DIGITS]',arguments:{STYLE:{type:Scratch.ArgumentType.STRING,menu:'segmentStyles',defaultValue:'Thick'},SCALE:{type:Scratch.ArgumentType.STRING,menu:'segmentScales',defaultValue:'Full'},...n('DIGITS',1)}},
          {opcode:'sevensegProperty',blockType:Scratch.BlockType.REPORTER,text:'Arcade seven segment [DISPLAY] property [PROPERTY]',arguments:{...str('DISPLAY',''),PROPERTY:{type:Scratch.ArgumentType.STRING,menu:'sevensegReadable',defaultValue:'value'}}},
          {opcode:'melodyPlayable',blockType:Scratch.BlockType.REPORTER,text:'Arcade melody playable [MELODY]',arguments:str('MELODY','')},
          {opcode:'stringPlayable',blockType:Scratch.BlockType.REPORTER,text:'Arcade string playable [MELODY] at [TEMPO] bpm',arguments:{...str('MELODY','C D E F'),...n('TEMPO',120)}},
          {opcode:'tonePlayable',blockType:Scratch.BlockType.REPORTER,text:'Arcade tone playable [FREQUENCY] Hz for [DURATION] ms',arguments:{...n('FREQUENCY',262),...n('DURATION',500)}},
          {opcode:'songPlayable',blockType:Scratch.BlockType.REPORTER,text:'Arcade song playable hex [HEX]',arguments:str('HEX','00780004080100')},
          {opcode:'createBuffer',blockType:Scratch.BlockType.REPORTER,text:'Arcade create byte buffer size [SIZE]',arguments:n('SIZE',8)},
          {opcode:'bufferFromHex',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer from hex text [HEX]',arguments:str('HEX','01020304')},
          {opcode:'bufferFromUTF8',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer from UTF8 text [TEXT]',arguments:str('TEXT','Hello')},
          {opcode:'bufferLiteral',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer literal hex [HEX]',arguments:str('HEX','01020304')},
          {opcode:'bufferLength',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer [BUFFER] length',arguments:str('BUFFER','')},
          {opcode:'bufferIsReadOnly',blockType:Scratch.BlockType.BOOLEAN,text:'Arcade byte buffer [BUFFER] is read only',arguments:str('BUFFER','')},
          {opcode:'bufferConcat',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer [BUFFER] concatenated with byte buffer [OTHER]',arguments:{...str('BUFFER',''),...str('OTHER','')}},
          {opcode:'bufferEquals',blockType:Scratch.BlockType.BOOLEAN,text:'Arcade byte buffer [BUFFER] equals byte buffer [OTHER]',arguments:{...str('BUFFER',''),...str('OTHER','')}},
          {opcode:'bufferHash',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer [BUFFER] hash [BITS] bits',arguments:{...str('BUFFER',''),...n('BITS',32)}},
          {opcode:'bufferIndexOf',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer [BUFFER] index of byte buffer [OTHER]',arguments:{...str('BUFFER',''),...str('OTHER','')}},
          {opcode:'bufferGetByte',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer [BUFFER] byte at [OFFSET]',arguments:{...str('BUFFER',''),...n('OFFSET',0)}},
          {opcode:'bufferSetByte',blockType:Scratch.BlockType.COMMAND,text:'Arcade set byte buffer [BUFFER] byte at [OFFSET] to [VALUE]',arguments:{...str('BUFFER',''),...n('OFFSET',0),...n('VALUE',0)}},
          {opcode:'bufferFromBase64',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer from Base64 text [TEXT]',arguments:str('TEXT','AQID')},
          {opcode:'bufferChunked',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer [BUFFER] chunks of at most [SIZE] bytes',arguments:{...str('BUFFER',''),...n('SIZE',256)}},
          {opcode:'bufferChunkedFromUTF8',blockType:Scratch.BlockType.REPORTER,text:'Arcade UTF8 text [TEXT] byte buffer chunks of at most [SIZE] bytes',arguments:{...str('TEXT','hello'),...n('SIZE',256)}},
          {opcode:'bufferPackedSize',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer packed format [FORMAT] size',arguments:str('FORMAT','<BH')},
          {opcode:'bufferPack',blockType:Scratch.BlockType.REPORTER,text:'Arcade pack number array [ARRAY] as byte buffer format [FORMAT]',arguments:{...str('ARRAY',''),...str('FORMAT','<BH')}},
          {opcode:'bufferUnpack',blockType:Scratch.BlockType.REPORTER,text:'Arcade unpack byte buffer [BUFFER] format [FORMAT] at [OFFSET]',arguments:{...str('BUFFER',''),...str('FORMAT','<BH'),...n('OFFSET',0)}},
          {opcode:'bufferPackAt',blockType:Scratch.BlockType.COMMAND,text:'Arcade pack number array [ARRAY] into byte buffer [BUFFER] at [OFFSET] format [FORMAT]',arguments:{...str('ARRAY',''),...str('BUFFER',''),...n('OFFSET',0),...str('FORMAT','<BH')}},
          {opcode:'bufferFromArray',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer from number array [ARRAY]',arguments:str('ARRAY','')},
          {opcode:'settingsWrite',blockType:Scratch.BlockType.COMMAND,text:'Arcade write setting [KEY] type [TYPE] value [VALUE]',arguments:{...str('KEY',''),...str('VALUE',''),TYPE:{type:Scratch.ArgumentType.STRING,menu:'settingWriteTypes',defaultValue:'Number'}}},
          {opcode:'highScore',blockType:Scratch.BlockType.REPORTER,text:'Arcade high score',arguments:{}},
          {opcode:'settingsRead',blockType:Scratch.BlockType.REPORTER,text:'Arcade read setting [KEY] type [TYPE]',arguments:{...str('KEY',''),TYPE:{type:Scratch.ArgumentType.STRING,menu:'settingReadTypes',defaultValue:'Number'}}},
          {opcode:'settingsExists',blockType:Scratch.BlockType.BOOLEAN,text:'Arcade setting [KEY] exists',arguments:str('KEY','')},
          {opcode:'settingsRemove',blockType:Scratch.BlockType.COMMAND,text:'Arcade remove setting [KEY]',arguments:str('KEY','')},
          {opcode:'settingsClear',blockType:Scratch.BlockType.COMMAND,text:'Arcade clear user settings'},
          {opcode:'spriteDataSet',blockType:Scratch.BlockType.COMMAND,text:'Arcade set sprite [ID] data [KEY] type [TYPE] to [VALUE]',arguments:{...str('ID',''),...str('KEY',''),...str('VALUE',''),TYPE:{type:Scratch.ArgumentType.STRING,menu:'spriteDataTypes',defaultValue:'Number'}}},
          {opcode:'spriteDataRead',blockType:Scratch.BlockType.REPORTER,text:'Arcade sprite [ID] data [KEY] type [TYPE]',arguments:{...str('ID',''),...str('KEY',''),TYPE:{type:Scratch.ArgumentType.STRING,menu:'spriteDataReadTypes',defaultValue:'Number'}}},
          {opcode:'spriteDataReadBoolean',blockType:Scratch.BlockType.BOOLEAN,text:'Arcade sprite [ID] boolean data [KEY]',arguments:{...str('ID',''),...str('KEY','')}},
          {opcode:'spriteDataChange',blockType:Scratch.BlockType.COMMAND,text:'Arcade change sprite [ID] number data [KEY] by [VALUE]',arguments:{...str('ID',''),...str('KEY',''),...str('VALUE','')}},
          {opcode:'bufferToArray',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer [BUFFER] to number array format [FORMAT]',arguments:{...str('BUFFER',''),FORMAT:{type:Scratch.ArgumentType.STRING,menu:'bufferFormats',defaultValue:'UInt8LE'}}},
          {opcode:'bufferConcatArray',blockType:Scratch.BlockType.REPORTER,text:'Arcade concatenate byte buffers in array [ARRAY]',arguments:str('ARRAY','')},
          {opcode:'bufferFormatSize',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer number format [FORMAT] size',arguments:{FORMAT:{type:Scratch.ArgumentType.STRING,menu:'bufferFormats',defaultValue:'UInt16LE'}}},
          {opcode:'bufferGetNumber',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer [BUFFER] number [FORMAT] at [OFFSET]',arguments:{...str('BUFFER',''),FORMAT:{type:Scratch.ArgumentType.STRING,menu:'bufferFormats',defaultValue:'UInt16LE'},...n('OFFSET',0)}},
          {opcode:'bufferSetNumber',blockType:Scratch.BlockType.COMMAND,text:'Arcade set byte buffer [BUFFER] number [FORMAT] at [OFFSET] to [VALUE]',arguments:{...str('BUFFER',''),FORMAT:{type:Scratch.ArgumentType.STRING,menu:'bufferFormats',defaultValue:'UInt16LE'},...n('OFFSET',0),...n('VALUE',0)}},
          {opcode:'bufferSlice',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer [BUFFER] slice at [OFFSET] length [LENGTH]',arguments:{...str('BUFFER',''),...n('OFFSET',0),...n('LENGTH',-1)}},
          {opcode:'bufferWrite',blockType:Scratch.BlockType.COMMAND,text:'Arcade write byte buffer [BUFFER] at [OFFSET] from [SOURCE]',arguments:{...str('BUFFER',''),...n('OFFSET',0),...str('SOURCE','')}},
          {opcode:'bufferFill',blockType:Scratch.BlockType.COMMAND,text:'Arcade fill byte buffer [BUFFER] with [VALUE] at [OFFSET] length [LENGTH]',arguments:{...str('BUFFER',''),...n('VALUE',0),...n('OFFSET',0),...n('LENGTH',-1)}},
          {opcode:'bufferShift',blockType:Scratch.BlockType.COMMAND,text:'Arcade shift byte buffer [BUFFER] by [AMOUNT] at [OFFSET] length [LENGTH]',arguments:{...str('BUFFER',''),...n('AMOUNT',1),...n('OFFSET',0),...n('LENGTH',-1)}},
          {opcode:'bufferRotate',blockType:Scratch.BlockType.COMMAND,text:'Arcade rotate byte buffer [BUFFER] by [AMOUNT] at [OFFSET] length [LENGTH]',arguments:{...str('BUFFER',''),...n('AMOUNT',1),...n('OFFSET',0),...n('LENGTH',-1)}},
          {opcode:'bufferToBase64',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer [BUFFER] to Base64 text',arguments:str('BUFFER','')},
          {opcode:'bufferToHex',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer [BUFFER] to hex',arguments:str('BUFFER','')},
          {opcode:'bufferToText',blockType:Scratch.BlockType.REPORTER,text:'Arcade byte buffer [BUFFER] to UTF8 text',arguments:str('BUFFER','')},
          {opcode:'songFromBuffer',blockType:Scratch.BlockType.REPORTER,text:'Arcade song playable byte buffer [BUFFER]',arguments:str('BUFFER','')},
          {opcode:'namedSongPlayable',blockType:Scratch.BlockType.REPORTER,text:'Arcade song named [NAME] hex [HEX]',arguments:{...str('NAME','mySong'),...str('HEX','00780004080100')}},
          {opcode:'soundEffect',blockType:Scratch.BlockType.REPORTER,text:'Arcade sound effect wave [WAVE] from [START_FREQUENCY] Hz to [END_FREQUENCY] Hz volume [START_VOLUME] to [END_VOLUME] for [DURATION] ms effect [EFFECT] curve [CURVE]',
            arguments:{WAVE:{type:Scratch.ArgumentType.STRING,menu:'waveShapes',defaultValue:'Square'},...n('START_FREQUENCY',400),...n('END_FREQUENCY',600),...n('START_VOLUME',255),...n('END_VOLUME',0),...n('DURATION',500),
              EFFECT:{type:Scratch.ArgumentType.STRING,menu:'soundEffects',defaultValue:'None'},CURVE:{type:Scratch.ArgumentType.STRING,menu:'soundCurves',defaultValue:'Linear'}}},
          {opcode:'namedMelody',blockType:Scratch.BlockType.REPORTER,text:'Arcade melody [NAME]',arguments:{NAME:{type:Scratch.ArgumentType.STRING,menu:'melodies',defaultValue:'baDing'}}},
          {opcode:'soundMelody',blockType:Scratch.BlockType.REPORTER,text:'Arcade sound [SOUND]',arguments:{SOUND:{type:Scratch.ArgumentType.STRING,menu:'sounds',defaultValue:'BaDing'}}},
          {opcode:'beat',blockType:Scratch.BlockType.REPORTER,text:'Arcade beat [FRACTION]',arguments:{FRACTION:{type:Scratch.ArgumentType.STRING,menu:'beats',defaultValue:'Whole'}}},
          {opcode:'parseIntegerRadix',blockType:Scratch.BlockType.REPORTER,text:'Arcade parse integer [TEXT] radix [RADIX]',arguments:{...str('TEXT','ff'),...n('RADIX',16)}},
          {opcode:'parseInteger',blockType:Scratch.BlockType.REPORTER,text:'Arcade parse integer [TEXT]',arguments:str('TEXT','123')},
          {opcode:'frameDeltaTime',blockType:Scratch.BlockType.REPORTER,text:'Arcade frame delta time',arguments:{}},
          {opcode:'musicVolume',blockType:Scratch.BlockType.REPORTER,text:'Arcade music volume'},
          {opcode:'musicTempo',blockType:Scratch.BlockType.REPORTER,text:'Arcade music tempo'},
          {opcode:'registerIntervalHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register interval [INTERVAL] ms as [TOKEN] capturing [CAPTURES]',arguments:{...n('INTERVAL',1000),...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredInterval',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade interval handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'allocateControlEventSource',blockType:Scratch.BlockType.REPORTER,text:'Arcade allocate control event source'},
          {opcode:'controllerEventSource',blockType:Scratch.BlockType.REPORTER,text:'Arcade controller event source player [PLAYER]',arguments:{PLAYER:{type:Scratch.ArgumentType.STRING,menu:'controlPlayers',defaultValue:'1'}}},
          {opcode:'setControllerConnected',blockType:Scratch.BlockType.COMMAND,text:'Arcade set controller player [PLAYER] connected [CONNECTED]',arguments:{PLAYER:{type:Scratch.ArgumentType.STRING,menu:'controlPlayers',defaultValue:'1'},CONNECTED:{type:Scratch.ArgumentType.BOOLEAN,defaultValue:true}}},
          {opcode:'registerMultiplayerConnection',blockType:Scratch.BlockType.COMMAND,text:'Arcade register multiplayer connection event [EVENT] as [TOKEN] capturing [CAPTURES]',arguments:{...n('EVENT',1),...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredMultiplayerConnection',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade multiplayer connection handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'registerControlEvent',blockType:Scratch.BlockType.COMMAND,text:'Arcade register control event source [SOURCE] value [VALUE] flags [FLAGS] as [TOKEN] capturing [CAPTURES]',arguments:{...n('SOURCE',777),...n('VALUE',1),...n('FLAGS',16),...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredControlEvent',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade control event handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'raiseControlEvent',blockType:Scratch.BlockType.COMMAND,text:'Arcade raise control event source [SOURCE] value [VALUE]',arguments:{...n('SOURCE',777),...n('VALUE',1)}},
          {opcode:'waitControlEvent',blockType:Scratch.BlockType.COMMAND,text:'Arcade wait for control event source [SOURCE] value [VALUE]',arguments:{...n('SOURCE',777),...n('VALUE',1)}},
          {opcode:'registerMultiplayerButtonHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register multiplayer button [BUTTON] event [EVENT] as [TOKEN] capturing [CAPTURES]',arguments:{...n('BUTTON',0),EVENT:{type:Scratch.ArgumentType.NUMBER,menu:'buttonEvents',defaultValue:2049},...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredMultiplayerButton',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade multiplayer button handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'eventPlayer',blockType:Scratch.BlockType.REPORTER,text:'Arcade event player'},
          {opcode:'playerConnected',blockType:Scratch.BlockType.BOOLEAN,text:'Arcade player [PLAYER] connected?',arguments:str('PLAYER','')},
          {opcode:'playerButtonPressed',blockType:Scratch.BlockType.BOOLEAN,text:'Arcade player [PLAYER] button [BUTTON] pressed?',arguments:{...str('PLAYER',''),...n('BUTTON',0)}},
          {opcode:'registerPlayerButtonHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register player [PLAYER] button [BUTTON] event [EVENT] as [TOKEN] capturing [CAPTURES]',arguments:{...n('PLAYER',1),BUTTON:{type:Scratch.ArgumentType.STRING,menu:'buttons',defaultValue:'a'},EVENT:{type:Scratch.ArgumentType.NUMBER,menu:'buttonEvents',defaultValue:2049},...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'registerButtonHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register button [BUTTON] event [EVENT] as [TOKEN] capturing [CAPTURES]',arguments:{BUTTON:{type:Scratch.ArgumentType.STRING,menu:'buttons',defaultValue:'a'},EVENT:{type:Scratch.ArgumentType.NUMBER,menu:'buttonEvents',defaultValue:2049},...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredButton',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade button handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'registerInstanceOverlapHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register instance overlap of [ID] as [TOKEN] capturing [CAPTURES]',arguments:{...str('ID',''),...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredInstanceOverlap',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade instance overlap handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'registerInstanceDestroyedHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register instance destruction of [ID] as [TOKEN] capturing [CAPTURES]',arguments:{...str('ID',''),...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredInstanceDestroyed',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade instance destruction handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'registerDestroyedHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register destroyed kind [KIND] as [TOKEN] capturing [CAPTURES]',arguments:{...str('KIND','Player'),...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredKindDestroyed',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade destroyed kind handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'registerOverlapHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register overlap kind [KIND] with [OTHER_KIND] as [TOKEN] capturing [CAPTURES]',arguments:{...str('KIND','Player'),...str('OTHER_KIND','Food'),...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredOverlap',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade overlap handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'registerScenePushHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register scene push as [TOKEN] capturing [CAPTURES]',arguments:{...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredScenePush',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade scene push handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          {opcode:'registerScenePopHandler',blockType:Scratch.BlockType.COMMAND,text:'Arcade register scene pop as [TOKEN] capturing [CAPTURES]',arguments:{...str('TOKEN','handler'),...str('CAPTURES','')}},
          {opcode:'whenRegisteredScenePop',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,text:'when Arcade scene pop handler [TOKEN] runs',arguments:str('TOKEN','handler')},
          { opcode: 'whenButton', blockType: Scratch.BlockType.HAT,
            text: 'when [BUTTON] button pressed', isEdgeActivated: false,
            arguments: { BUTTON: {type: Scratch.ArgumentType.STRING, menu: 'buttons', defaultValue: 'a'} } },
          { opcode: 'buttonPressed', blockType: Scratch.BlockType.BOOLEAN,
            text: '[BUTTON] button pressed?',
            arguments: { BUTTON: {type: Scratch.ArgumentType.STRING, menu: 'buttons', defaultValue: 'a'} } },
          { opcode: 'controllerStep', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade controller [AXIS] step [STEP]',
            arguments: { AXIS: {type: Scratch.ArgumentType.STRING, menu: 'axes', defaultValue: 'x'},
              ...n('STEP', 100) } },
          {opcode:'playerLookup',blockType:Scratch.BlockType.REPORTER,text:'Arcade player by [MODE] [VALUE]',arguments:{MODE:{type:Scratch.ArgumentType.STRING,menu:'playerLookupModes',defaultValue:'number'},...n('VALUE',1)}},
          {opcode:'allPlayers',blockType:Scratch.BlockType.REPORTER,text:'Arcade all players'},
          {opcode:'playerSprite',blockType:Scratch.BlockType.REPORTER,text:'Arcade sprite of player [PLAYER]',arguments:str('PLAYER','')},
          {opcode:'createPlayerState',blockType:Scratch.BlockType.REPORTER,text:'Arcade create player state key'},
          {opcode:'getPlayerState',blockType:Scratch.BlockType.REPORTER,text:'Arcade state [KEY] of player [PLAYER]',arguments:{...str('PLAYER',''),...n('KEY',0)}},
          {opcode:'setPlayerState',blockType:Scratch.BlockType.COMMAND,text:'Arcade set state [KEY] of player [PLAYER] to [VALUE]',arguments:{...str('PLAYER',''),...n('KEY',0),...n('VALUE',0)}},
          {opcode:'changePlayerState',blockType:Scratch.BlockType.COMMAND,text:'Arcade change state [KEY] of player [PLAYER] by [VALUE]',arguments:{...str('PLAYER',''),...n('KEY',0),...n('VALUE',1)}},
          {opcode:'movePlayerWithButtons',blockType:Scratch.BlockType.COMMAND,text:'Arcade move player [PLAYER] with buttons vx [VX] vy [VY]',arguments:{...str('PLAYER',''),...n('VX',100),...n('VY',100)}},
          {opcode:'setPlayerSprite',blockType:Scratch.BlockType.COMMAND,text:'Arcade set sprite of player [PLAYER] to [ID]',arguments:{...str('PLAYER',''),...str('ID','')}},
          {opcode:'playerBySprite',blockType:Scratch.BlockType.REPORTER,text:'Arcade player of sprite [ID]',arguments:str('ID','')},
          {opcode:'playerProperty',blockType:Scratch.BlockType.REPORTER,text:'Arcade player [READ] property [PROPERTY] of [PLAYER]',arguments:{READ:{type:Scratch.ArgumentType.STRING,menu:'playerReadModes',defaultValue:'safe'},...n('PROPERTY',2),...str('PLAYER','')}},
          { opcode: 'controlSprite', blockType: Scratch.BlockType.COMMAND,
            text: 'move Arcade sprite [ID] with buttons vx [VX] vy [VY]',
            arguments: {...str('ID', ''), ...n('VX', 100), ...n('VY', 100)} },
          { opcode: 'controlSpriteByController', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade controller [CONTROLLER] move sprite [ID] vx [VX] vy [VY]',
            arguments: {CONTROLLER: {type: Scratch.ArgumentType.STRING, menu: 'controllerNumbers', defaultValue: '1'},
              ...str('ID', ''), ...n('VX', 100), ...n('VY', 100)} },
          { opcode: 'stopControllingSprite', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade controller [CONTROLLER] stop controlling sprite [ID]',
            arguments: {CONTROLLER: {type: Scratch.ArgumentType.STRING, menu: 'controllerNumbers', defaultValue: '1'}, ...str('ID', '')} },
          {opcode:'declareSubclass',blockType:Scratch.BlockType.COMMAND,text:'Arcade declare subclass [NAME] of [BASE] fields [FIELDS] initializer [INITIALIZER] constructor [CONSTRUCTOR] parameters [PARAMETERS] methods [METHODS]',arguments:{...str('NAME','Child'),...str('BASE','Record'),...str('FIELDS','[]'),...str('INITIALIZER',''),...str('CONSTRUCTOR',''),...str('PARAMETERS','[]'),...str('METHODS','[]')}},
          {opcode:'declareClass',blockType:Scratch.BlockType.COMMAND,text:'Arcade declare class [NAME] fields [FIELDS] initializer [INITIALIZER] constructor [CONSTRUCTOR] parameters [PARAMETERS] methods [METHODS]',arguments:{...str('NAME','Record'),...str('FIELDS','[]'),...str('INITIALIZER',''),...str('CONSTRUCTOR',''),...str('PARAMETERS','[]'),...str('METHODS','[]')}},
          {opcode:'createObject',blockType:Scratch.BlockType.REPORTER,text:'Arcade new object class [CLASS] arguments [ARGS]',arguments:{...str('CLASS','Record'),...str('ARGS','[]')}},
          {opcode:'objectField',blockType:Scratch.BlockType.REPORTER,text:'Arcade object [OBJECT] field [FIELD]',arguments:{...str('OBJECT',''),...str('FIELD','value')}},
          {opcode:'setObjectField',blockType:Scratch.BlockType.COMMAND,text:'Arcade set object [OBJECT] field [FIELD] to [VALUE]',arguments:{...str('OBJECT',''),...str('FIELD','value'),...str('VALUE','0')}},
          {opcode:'callObjectMethod',blockType:Scratch.BlockType.REPORTER,text:'Arcade object [OBJECT] call method [METHOD] arguments [ARGS]',arguments:{...str('OBJECT',''),...str('METHOD','calculate'),...str('ARGS','[]')}},
          { opcode: 'functionArgument', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade function argument [VALUE] followed by [REST]', arguments: {...str('VALUE', '0'), ...str('REST', '[]')} },
          { opcode: 'callFunction', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade call function [NAME] arguments [ARGS]', arguments: {...str('NAME', 'calculate %s'), ...str('ARGS', '[]')} },
          {opcode:'declareSourceCallable',blockType:Scratch.BlockType.COMMAND,
            text:'declare Arcade source callable [VARIABLE] signature [SIGNATURE]',arguments:{...str('VARIABLE',''),...str('SIGNATURE','{\"kind\":\"callable\",\"parameters\":[],\"result\":{\"kind\":\"named\",\"name\":\"number\"}}')}},
          { opcode:'declareCallable',blockType:Scratch.BlockType.COMMAND,
            text:'declare Arcade callable [NAME] metadata [METADATA]',arguments:{...str('NAME','callback'),...str('METADATA','{}')} },
          { opcode:'createCallable',blockType:Scratch.BlockType.REPORTER,
            text:'Arcade callable [NAME]',arguments:str('NAME','callback') },
          { opcode:'callCallable',blockType:Scratch.BlockType.REPORTER,
            text:'Arcade invoke callable [CALLABLE] arguments [ARGS]',arguments:{...str('CALLABLE',''),...str('ARGS','[]')} },
          { opcode:'whenCallableDispatched',blockType:Scratch.BlockType.HAT,isEdgeActivated:false,
            text:'when Arcade callable [NAME] dispatched',arguments:str('NAME','callback') },
          { opcode:'runCallableDispatch',blockType:Scratch.BlockType.COMMAND,
            text:'run Arcade dispatched callable' },
          { opcode: 'returnValue', blockType: Scratch.BlockType.COMMAND,
            text: 'return Arcade value [VALUE]', arguments: str('VALUE', '0') },
          { opcode: 'throwValue', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade throw [VALUE]', arguments: str('VALUE', '') },
          { opcode: 'setLocal', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade local [NAME] to [VALUE]',
            arguments: { ...str('NAME', 'value'), ...str('VALUE', '') } },
          { opcode: 'registerSpriteCreated', blockType: Scratch.BlockType.COMMAND,
            text: 'register Arcade creation kind [KIND] as [TOKEN] capturing [CAPTURES]', arguments: {...str('KIND', 'Player'), ...str('TOKEN', 'handler'), ...str('CAPTURES', '')} },
          { opcode: 'getCaptured', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade captured [NAME]', arguments: str('NAME', 'value') },
          { opcode: 'setCaptured', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade captured [NAME] to [VALUE]', arguments: {...str('NAME', 'value'), ...str('VALUE', '0')} },
          { opcode: 'getLocal', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade local [NAME]', arguments: str('NAME', 'value') },
          { opcode: 'ask', blockType: Scratch.BlockType.BOOLEAN,
            text: 'ask Arcade yes/no [TITLE] subtitle [SUBTITLE]', arguments: {...str('TITLE','Continue?'),...str('SUBTITLE','')} },
          { opcode: 'askForNumber', blockType: Scratch.BlockType.REPORTER,
            text: 'ask Arcade number [QUESTION]', arguments: str('QUESTION', 'Number?') },
          { opcode: 'askForNumberLength', blockType: Scratch.BlockType.REPORTER,
            text: 'ask Arcade number [QUESTION] length [LENGTH]', arguments: {...str('QUESTION', 'Number?'),...n('LENGTH', 3)} },
          { opcode: 'askForStringLength', blockType: Scratch.BlockType.REPORTER,
            text: 'ask Arcade text [QUESTION] length [LENGTH]', arguments: {...str('QUESTION', 'Text?'),...n('LENGTH', 2)} },
          { opcode: 'askForString', blockType: Scratch.BlockType.REPORTER,
            text: 'ask Arcade text [QUESTION]', arguments: str('QUESTION', 'Text?') },
          { opcode: 'setBackgroundColor', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade set background color to [COLOR]', arguments: n('COLOR', 0) },
          { opcode: 'setBackgroundImage', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade background image [IMAGE]', arguments: str('IMAGE', '') },
          { opcode: 'backgroundImage', blockType: Scratch.BlockType.REPORTER, text: 'Arcade background image' },
          { opcode: 'backgroundColor', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade background color' },
          { opcode: 'splash', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade splash [TITLE] subtitle [SUBTITLE]',
            arguments: { ...str('TITLE', 'Title'), ...str('SUBTITLE', '') } },
          { opcode: 'showLongText', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade long text [TEXT] layout [LAYOUT]',
            arguments: { ...str('TEXT', 'Message'), LAYOUT: {
              type: Scratch.ArgumentType.STRING, menu: 'dialogLayouts', defaultValue: 'Center' } } },
          { opcode: 'lightLevel', blockType: Scratch.BlockType.REPORTER, text: 'light level' },
          { opcode: 'tilt', blockType: Scratch.BlockType.REPORTER, text: 'tilt [AXIS]',
            arguments: { AXIS: {type: Scratch.ArgumentType.STRING, menu: 'axes', defaultValue: 'x'} } },
          { opcode: 'setPixel', blockType: Scratch.BlockType.COMMAND,
            text: 'set badge pixel [INDEX] to [COLOR]',
            arguments: { INDEX: {type: Scratch.ArgumentType.NUMBER, defaultValue: 0},
              COLOR: {type: Scratch.ArgumentType.COLOR, defaultValue: '#00ff88'} } },
          { opcode: 'clearPixels', blockType: Scratch.BlockType.COMMAND, text: 'clear badge pixels' },

          // ── Sprite creation ──────────────────────────────────────
          { opcode: 'createsprite', blockType: Scratch.BlockType.COMMAND,
            text: 'create sprite [NAME] at x [X] y [Y]',
            arguments: { ...str('NAME', 'player'), ...n('X', 2), ...n('Y', 2) } },
          { opcode: 'deletesprite', blockType: Scratch.BlockType.COMMAND,
            text: 'delete sprite [NAME]',
            arguments: str('NAME', 'player') },

          // ── Movement ─────────────────────────────────────────────
          '---',
          { opcode: 'movesprite', blockType: Scratch.BlockType.COMMAND,
            text: 'move sprite [NAME] by dx [DX] dy [DY]',
            arguments: { ...str('NAME', 'player'), ...n('DX', 1), ...n('DY', 0) } },
          { opcode: 'setspritepos', blockType: Scratch.BlockType.COMMAND,
            text: 'set sprite [NAME] to x [X] y [Y]',
            arguments: { ...str('NAME', 'player'), ...n('X', 2), ...n('Y', 2) } },
          { opcode: 'spritex', blockType: Scratch.BlockType.REPORTER,
            text: 'sprite [NAME] x',
            arguments: str('NAME', 'player') },
          { opcode: 'spritey', blockType: Scratch.BlockType.REPORTER,
            text: 'sprite [NAME] y',
            arguments: str('NAME', 'player') },

          // ── Collision ────────────────────────────────────────────
          '---',
          { opcode: 'touching', blockType: Scratch.BlockType.BOOLEAN,
            text: 'sprite [A] touching [B]?',
            arguments: { ...str('A', 'player'), ...str('B', 'enemy') } },
          { opcode: 'touchingedge', blockType: Scratch.BlockType.BOOLEAN,
            text: 'sprite [NAME] touching edge?',
            arguments: str('NAME', 'player') },

          // ── Score ────────────────────────────────────────────────
          '---',
          { opcode: 'setscore', blockType: Scratch.BlockType.COMMAND,
            text: 'set score to [N]',
            arguments: n('N', 0) },
          { opcode: 'changescore', blockType: Scratch.BlockType.COMMAND,
            text: 'change score by [N]',
            arguments: n('N', 1) },
          { opcode: 'getscore', blockType: Scratch.BlockType.REPORTER,
            text: 'score' },
          { opcode: 'showscore', blockType: Scratch.BlockType.COMMAND,
            text: 'show score' },
          { opcode: 'log', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade serial log [TEXT]', arguments: str('TEXT', 'Hello') },

          // ── Display ──────────────────────────────────────────────
          '---',
          { opcode: 'drawsprites', blockType: Scratch.BlockType.COMMAND,
            text: 'draw all sprites' },
          { opcode: 'clearscreen', blockType: Scratch.BlockType.COMMAND,
            text: 'clear game screen' },
          { opcode: 'setbrightness', blockType: Scratch.BlockType.COMMAND,
            text: 'set sprite [NAME] brightness [B]',
            arguments: { ...str('NAME', 'player'), ...n('B', 9) } },

          // MakeCode Arcade sprite handles. IDs survive in Scratch variables;
          // the blocks, including their arguments, serialize in normal .sb3.
          '---',
          { opcode: 'spawnSprite', blockType: Scratch.BlockType.REPORTER,
            text: 'spawn Arcade sprite from [TEMPLATE] kind [KIND] x [X] y [Y] width [WIDTH] height [HEIGHT]',
            arguments: { ...str('TEMPLATE', 'sprite'), ...str('KIND', 'Player'),
              ...n('X', 80), ...n('Y', 60), ...n('WIDTH', 16), ...n('HEIGHT', 16) } },
          { opcode: 'spawnProjectile', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade projectile from [TEMPLATE] kind [KIND] vx [VX] vy [VY] width [WIDTH] height [HEIGHT] mode [MODE] source [SOURCE]',
            arguments: { ...str('TEMPLATE', 'projectile'), ...str('KIND', 'Projectile'),
              ...n('VX', -50), ...n('VY', 0), ...n('WIDTH', 8), ...n('HEIGHT', 8),
              ...str('MODE', 'kind'), ...str('SOURCE', '') } },
          { opcode: 'spawnImageProjectile', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade projectile image [IMAGE] template [TEMPLATE] kind [KIND] vx [VX] vy [VY] mode [MODE] source [SOURCE]',
            arguments: {...str('IMAGE', ''), ...str('TEMPLATE', 'projectile'), ...str('KIND', 'Projectile'),
              ...n('VX', 50), ...n('VY', 0), ...str('MODE', 'side'), ...str('SOURCE', '')} },
          { opcode: 'spriteToString', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade sprite [ID] as text', arguments: str('ID', '') },
          { opcode: 'destroySprite', blockType: Scratch.BlockType.COMMAND,
            text: 'destroy Arcade sprite [ID]', arguments: str('ID', '') },
          { opcode: 'destroySpriteWithEffect', blockType: Scratch.BlockType.COMMAND,
            text: 'destroy Arcade sprite [ID] with effect [EFFECT] for [DURATION] ms',
            arguments: {...str('ID', ''), EFFECT: {type: Scratch.ArgumentType.STRING, menu: 'particleEffects', defaultValue: 'disintegrate'}, ...n('DURATION', 0)} },
          { opcode: 'startSpriteEffect', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade start effect [EFFECT] on sprite [ID] for [DURATION] ms',
            arguments: {EFFECT: {type: Scratch.ArgumentType.STRING, menu: 'particleEffects', defaultValue: 'spray'}, ...str('ID', ''), ...n('DURATION', 0)} },
          { opcode: 'startScreenEffect', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade start screen effect [EFFECT] for [DURATION] ms',
            arguments: {EFFECT: {type: Scratch.ArgumentType.STRING, menu: 'screenEffects', defaultValue: 'confetti'}, ...n('DURATION', 0)} },
          { opcode: 'endScreenEffect', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade end screen effect [EFFECT]',
            arguments: {EFFECT: {type: Scratch.ArgumentType.STRING, menu: 'screenEffects', defaultValue: 'confetti'}} },
          { opcode: 'clearSpriteEffects', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade clear effects on sprite [ID]', arguments: str('ID', '') },
          { opcode: 'spriteSay', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade sprite [ID] say [TEXT] for [DURATION] ms animated [ANIMATED] text color [FOREGROUND] box color [BACKGROUND] mode [MODE]',
            arguments: { ...str('ID', 'self'), ...str('TEXT', 'Hello'), ...n('DURATION', -1),
              ANIMATED: {type: Scratch.ArgumentType.BOOLEAN}, ...n('FOREGROUND', 15), ...n('BACKGROUND', 1),
              MODE: {type: Scratch.ArgumentType.STRING, menu: 'speechModes', defaultValue: 'text'} } },
          { opcode: 'registerSpriteDestroyed', blockType: Scratch.BlockType.COMMAND,
            text: 'when Arcade sprite [ID] is destroyed run [TOKEN]',
            arguments: { ...str('ID', ''), ...str('TOKEN', 'handler') } },
          { opcode: 'setSpritePosition', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade sprite [ID] position x [X] y [Y]',
            arguments: {...str('ID', ''), ...n('X', 80), ...n('Y', 60)} },
          { opcode: 'createSprite', blockType: Scratch.BlockType.REPORTER,
            text: 'create Arcade sprite template [TEMPLATE] kind [KIND] width [WIDTH] height [HEIGHT]',
            arguments: {...str('TEMPLATE', 'sprite'), ...str('KIND', 'Player'), ...n('WIDTH', 16), ...n('HEIGHT', 16)} },
          { opcode: 'createImageSprite', blockType: Scratch.BlockType.REPORTER,
            text: 'create Arcade sprite image [IMAGE] template [TEMPLATE] kind [KIND]',
            arguments: {...str('IMAGE', ''), ...str('TEMPLATE', 'sprite'), ...str('KIND', 'Player')} },
          { opcode: 'createOwnedImageSprite', blockType: Scratch.BlockType.REPORTER,
            text: 'create owned Arcade sprite image [IMAGE] template [TEMPLATE] kind [KIND]',
            arguments: {...str('IMAGE', ''), ...str('TEMPLATE', 'sprite'), ...n('KIND', 0)} },
          { opcode: 'createAnimation', blockType: Scratch.BlockType.REPORTER,
            text: 'create Arcade animation action [ACTION] interval [INTERVAL] ms',
            arguments: {...n('ACTION', 0), ...n('INTERVAL', 100)} },
          { opcode: 'addAnimationFrame', blockType: Scratch.BlockType.COMMAND,
            text: 'add Arcade image [IMAGE] to animation [ANIMATION]',
            arguments: {...str('IMAGE', ''), ...str('ANIMATION', '')} },
          { opcode: 'attachAnimation', blockType: Scratch.BlockType.COMMAND,
            text: 'attach Arcade animation [ANIMATION] to sprite [ID]',
            arguments: {...str('ANIMATION', ''), ...str('ID', '')} },
          { opcode: 'setAnimationAction', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade sprite [ID] animation action [ACTION]',
            arguments: {...str('ID', ''), ...n('ACTION', 0)} },
          { opcode: 'animationProperty', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade animation [ANIMATION] [PROPERTY]',
            arguments: {...str('ANIMATION', ''), PROPERTY: {type: Scratch.ArgumentType.STRING,
              menu: 'animationProperties', defaultValue: 'interval'}} },
          { opcode: 'setAnimationInterval', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade animation [ANIMATION] interval [INTERVAL] ms',
            arguments: {...str('ANIMATION', ''), ...n('INTERVAL', 100)} },
          { opcode: 'animationAssetFrames', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade animation asset [RESOURCE] frames',
            arguments: {RESOURCE: {type: Scratch.ArgumentType.STRING, menu: 'animationAssets', defaultValue: 'none'}} },
          { opcode: 'animationAssetFreshFrames', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade animation asset [RESOURCE] fresh frames',
            arguments: {RESOURCE: {type: Scratch.ArgumentType.STRING, menu: 'animationAssets', defaultValue: 'none'}} },
          { opcode: 'animationAssetInterval', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade animation asset [RESOURCE] interval ms',
            arguments: {RESOURCE: {type: Scratch.ArgumentType.STRING, menu: 'animationAssets', defaultValue: 'none'}} },
          { opcode: 'runImageAnimation', blockType: Scratch.BlockType.COMMAND,
            text: 'animate Arcade sprite [ID] frames [FRAMES] interval [INTERVAL] ms loop [LOOP]',
            arguments: {...str('ID', ''), ...str('FRAMES', ''), ...n('INTERVAL', 500), LOOP: {type: Scratch.ArgumentType.BOOLEAN}} },
          { opcode: 'stopAnimation', blockType: Scratch.BlockType.COMMAND,
            text: 'stop Arcade sprite [ID] animations type [TYPE]',
            arguments: {...str('ID', ''), TYPE: {type: Scratch.ArgumentType.STRING,
              menu: 'animationTypes', defaultValue: '0'}} },
          {opcode:'setSpriteScale',blockType:Scratch.BlockType.COMMAND,text:'set Arcade sprite [ID] scale to [VALUE] anchor [ANCHOR]',arguments:{...str('ID',''),...n('VALUE',1),ANCHOR:{type:Scratch.ArgumentType.NUMBER,menu:'scaleAnchors',defaultValue:0}}},
          {opcode:'changeSpriteScale',blockType:Scratch.BlockType.COMMAND,text:'change Arcade sprite [ID] scale by [VALUE] anchor [ANCHOR]',arguments:{...str('ID',''),...n('VALUE',1),ANCHOR:{type:Scratch.ArgumentType.NUMBER,menu:'scaleAnchors',defaultValue:0}}},
          {opcode:'setSpriteScaleCore',blockType:Scratch.BlockType.COMMAND,text:'set Arcade sprite [ID] scale x [SX] y [SY] anchor [ANCHOR] proportional [PROPORTIONAL]',arguments:{...str('ID',''),...str('SX',''),...str('SY',''),ANCHOR:{type:Scratch.ArgumentType.NUMBER,menu:'scaleAnchors',defaultValue:0},PROPORTIONAL:{type:Scratch.ArgumentType.BOOLEAN}}},
          { opcode: 'setSpriteProperty', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade sprite [ID] [PROPERTY] to [VALUE]',
            arguments: { ...str('ID', ''), PROPERTY: {type: Scratch.ArgumentType.STRING, menu: 'spriteProperties', defaultValue: 'x'},
              ...n('VALUE', 0) } },
          { opcode: 'mutateSpriteImage', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade sprite [ID] image [OP] color [COLOR] replacement [TO]',
            arguments: {...str('ID', ''), OP: {type: Scratch.ArgumentType.STRING,
              menu: 'imageOperations', defaultValue: 'fill'}, ...n('COLOR', 1), ...n('TO', 2)} },
          { opcode: 'setSpritePixel', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade sprite [ID] image pixel x [X] y [Y] color [COLOR]',
            arguments: {...str('ID', ''), ...n('X', 0), ...n('Y', 0), ...n('COLOR', 1)} },
          { opcode: 'spritePixel', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade sprite [ID] image pixel x [X] y [Y]',
            arguments: {...str('ID', ''), ...n('X', 0), ...n('Y', 0)} },
          {opcode:'drawSpriteCircle',blockType:Scratch.BlockType.COMMAND,
            text:'Arcade sprite [ID] image circle [OP] center x [X] y [Y] radius [RADIUS] color [COLOR]',
            arguments:{...str('ID',''),OP:{type:Scratch.ArgumentType.STRING,menu:'imageCircleOperations',defaultValue:'drawCircle'},
              ...n('X',0),...n('Y',0),...n('RADIUS',4),...n('COLOR',1)}},
          { opcode: 'drawSpriteImage', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade sprite [ID] image [OP] x [X] y [Y] width / end x [W] height / end y [H] color [COLOR]',
            arguments: {...str('ID', ''), OP: {type: Scratch.ArgumentType.STRING,
              menu: 'imageDrawOperations', defaultValue: 'fillRect'}, ...n('X', 0), ...n('Y', 0),
              ...n('W', 4), ...n('H', 4), ...n('COLOR', 1)} },
          { opcode: 'createImage', blockType: Scratch.BlockType.REPORTER,
            text: 'new Arcade image width [WIDTH] height [HEIGHT]', arguments: {...n('WIDTH', 16), ...n('HEIGHT', 16)} },
          { opcode: 'cloneImage', blockType: Scratch.BlockType.REPORTER,
            text: 'copy Arcade image [IMAGE]', arguments: str('IMAGE', '') },
          {opcode:'imageEquals',blockType:Scratch.BlockType.BOOLEAN,text:'Arcade image [IMAGE] equals image [OTHER]',arguments:{...str('IMAGE',''),...str('OTHER','')}},
          {opcode:'waitAnyButton',blockType:Scratch.BlockType.COMMAND,text:'Arcade wait until any button pressed'},
          { opcode: 'imageProperty', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade image [IMAGE] [PROPERTY]', arguments: {...str('IMAGE', ''),
              PROPERTY: {type: Scratch.ArgumentType.STRING, menu: 'imageProperties', defaultValue: 'width'}} },
          {opcode:'copyImageFrom',blockType:Scratch.BlockType.COMMAND,text:'copy pixels into Arcade image [IMAGE] from [SOURCE]',arguments:{...str('IMAGE',''),...str('SOURCE','')}},
          {opcode:'scrollImage',blockType:Scratch.BlockType.COMMAND,text:'scroll Arcade image [IMAGE] x [X] y [Y]',arguments:{...str('IMAGE',''),...n('X',0),...n('Y',1)}},
          { opcode: 'mutateImage', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade image [IMAGE] [OP] color [COLOR] replacement [TO]',
            arguments: {...str('IMAGE', ''), OP: {type: Scratch.ArgumentType.STRING,menu:'imageOperations',defaultValue:'fill'}, ...n('COLOR', 1), ...n('TO', 2)} },
          { opcode: 'setImagePixel', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade image [IMAGE] pixel x [X] y [Y] color [COLOR]', arguments: {...str('IMAGE', ''), ...n('X', 0), ...n('Y', 0), ...n('COLOR', 1)} },
          { opcode: 'imagePixel', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade image [IMAGE] pixel x [X] y [Y]', arguments: {...str('IMAGE', ''), ...n('X', 0), ...n('Y', 0)} },
          {opcode:'drawImageCircle',blockType:Scratch.BlockType.COMMAND,
            text:'Arcade image [IMAGE] circle [OP] center x [X] y [Y] radius [RADIUS] color [COLOR]',
            arguments:{...str('IMAGE',''),OP:{type:Scratch.ArgumentType.STRING,menu:'imageCircleOperations',defaultValue:'drawCircle'},
              ...n('X',0),...n('Y',0),...n('RADIUS',4),...n('COLOR',1)}},
          { opcode: 'drawImage', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade image [IMAGE] [OP] x [X] y [Y] width / end x [W] height / end y [H] color [COLOR]',
            arguments: {...str('IMAGE', ''), OP: {type: Scratch.ArgumentType.STRING,menu:'imageDrawOperations',defaultValue:'fillRect'},
              ...n('X', 0), ...n('Y', 0), ...n('W', 4), ...n('H', 4), ...n('COLOR', 1)} },
          { opcode: 'blitImage', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade image [IMAGE] [OP] source [SOURCE] x [X] y [Y]',
            arguments: {...str('IMAGE', ''), ...str('SOURCE', ''), ...n('X', 0), ...n('Y', 0),
              OP: {type: Scratch.ArgumentType.STRING, menu:'imageBlitOperations', defaultValue:'drawImage'}} },
          { opcode: 'imagesOverlap', blockType: Scratch.BlockType.BOOLEAN,
            text: 'Arcade image [IMAGE] overlaps image [SOURCE] x [X] y [Y]',
            arguments: {...str('IMAGE', ''), ...str('SOURCE', ''), ...n('X', 0), ...n('Y', 0)} },
          { opcode: 'spawnImageSprite', blockType: Scratch.BlockType.REPORTER,
            text: 'spawn Arcade sprite image [IMAGE] template [TEMPLATE] kind [KIND] x [X] y [Y]',
            arguments: {...str('IMAGE', ''), ...str('TEMPLATE', 'sprite'), ...str('KIND', 'Player'), ...n('X', 80), ...n('Y', 60)} },
          { opcode: 'spriteImage', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade sprite [ID] image', arguments: str('ID', '') },
          { opcode: 'setSpriteImage', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade sprite [ID] image to [IMAGE]', arguments: {...str('ID', ''), ...str('IMAGE', '')} },
          { opcode: 'frameImage', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade image array [KEY] frame [INDEX] from [TEMPLATE] start [START] count [COUNT]',
            arguments: {...str('KEY', 'frames'), ...n('INDEX', 0), ...str('TEMPLATE', 'sprite'), ...n('START', 0), ...n('COUNT', 1)} },
          { opcode: 'setSpriteCostume', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade sprite [ID] costume to [COSTUME]',
            arguments: { ...str('ID', ''), ...n('COSTUME', 0) } },
          { opcode: 'registerLegacyWallHandler', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade register color wall kind [KIND] index [INDEX] as [TOKEN] capturing [CAPTURES]',
            arguments: {...str('KIND','Player'),...n('INDEX',1),...str('TOKEN','colorwall'),...str('CAPTURES','')} },
          { opcode: 'whenRegisteredLegacyWall', blockType: Scratch.BlockType.HAT, isEdgeActivated: false,
            text: 'when Arcade color wall handler [TOKEN] runs', arguments: str('TOKEN','colorwall') },
          { opcode: 'tileHitFrom', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade sprite [ID] wall hit index [DIRECTION]', arguments: {...str('ID',''),DIRECTION:{type:Scratch.ArgumentType.STRING,menu:'collisionDirections',defaultValue:'2'}} },
          { opcode: 'registerWallHandler', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade register wall kind [KIND] as [TOKEN] capturing [CAPTURES]',
            arguments: {...str('KIND', 'Player'), ...str('TOKEN', 'wall'), ...str('CAPTURES', '')} },
          { opcode: 'registerTileHandler', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade register tile kind [KIND] image [IMAGE] as [TOKEN] capturing [CAPTURES]',
            arguments: {...str('KIND', 'Player'), ...str('IMAGE', ''), ...str('TOKEN', 'tile'), ...str('CAPTURES', '')} },
          { opcode: 'whenRegisteredWall', blockType: Scratch.BlockType.HAT, isEdgeActivated: false,
            text: 'when Arcade wall handler [TOKEN] runs', arguments: str('TOKEN', 'wall') },
          { opcode: 'whenRegisteredTile', blockType: Scratch.BlockType.HAT, isEdgeActivated: false,
            text: 'when Arcade tile handler [TOKEN] runs', arguments: str('TOKEN', 'tile') },
          { opcode: 'eventLocation', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade event location' },
          { opcode: 'centerCameraAt', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade center camera x [X] y [Y]', arguments: {...n('X', 80), ...n('Y', 60)} },
          { opcode: 'cameraShake', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade shake camera by [AMPLITUDE] pixels for [DURATION] ms', arguments: {...n('AMPLITUDE', 4), ...n('DURATION', 500)} },
          { opcode: 'cameraFollowSprite', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade camera follow sprite [ID]', arguments: str('ID', '') },
          {opcode:'cameraDrawOffset',blockType:Scratch.BlockType.REPORTER,text:'Arcade camera draw offset [AXIS]',arguments:{AXIS:{type:Scratch.ArgumentType.STRING,menu:'cameraAxes',defaultValue:'x'}}},
          { opcode: 'cameraProperty', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade camera property [PROPERTY]', arguments: {PROPERTY: {type: Scratch.ArgumentType.STRING,
              menu: 'cameraProperties', defaultValue: '0'}} },
          { opcode: 'isHittingTile', blockType: Scratch.BlockType.BOOLEAN,
            text: 'Arcade sprite [ID] hitting wall [DIRECTION]', arguments: {...str('ID', ''),
              DIRECTION: {type: Scratch.ArgumentType.STRING, menu: 'collisionDirections', defaultValue: '3'}} },
          { opcode: 'setSpriteFlag', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade sprite [ID] flag [FLAG] to [ON]',
            arguments: { ...str('ID', ''), FLAG: {type: Scratch.ArgumentType.STRING,
              menu: 'spriteFlags', defaultValue: 'Invisible'}, ...n('ON', 1) } },
          { opcode: 'setSpriteStayInScreen', blockType: Scratch.BlockType.COMMAND,
            text: 'keep Arcade sprite [ID] in screen [ON]',
            arguments: { ...str('ID', ''), ...n('ON', 1) } },
          { opcode: 'setSpriteAutoDestroy', blockType: Scratch.BlockType.COMMAND,
            text: 'auto destroy Arcade sprite [ID] outside screen [ON]',
            arguments: { ...str('ID', ''), ...n('ON', 1) } },
          { opcode: 'setSpriteBounceOnWall', blockType: Scratch.BlockType.COMMAND,
            text: 'bounce Arcade sprite [ID] on screen edge [ON]',
            arguments: { ...str('ID', ''), ...n('ON', 1) } },
          { opcode: 'setSpriteGhostThroughSprites', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade sprite [ID] passes through other sprites [ON]',
            arguments: { ...str('ID', ''), ...n('ON', 1) } },
          {opcode:'currentScene',blockType:Scratch.BlockType.REPORTER,text:'Arcade current scene'},
          {opcode:'scenePhysicsEngine',blockType:Scratch.BlockType.REPORTER,text:'Arcade physics engine of scene [SCENE]',arguments:str('SCENE','')},
          {opcode:'createPhysicsEngine',blockType:Scratch.BlockType.REPORTER,text:'Arcade create physics engine max speed [MAX_SPEED] min step [MIN_STEP] max step [MAX_STEP]',arguments:{...n('MAX_SPEED',500),...n('MIN_STEP',2),...n('MAX_STEP',4)}},
          {opcode:'physicsEngineProperty',blockType:Scratch.BlockType.REPORTER,text:'Arcade physics engine [ENGINE] property [PROPERTY]',arguments:{...str('ENGINE',''),PROPERTY:{type:Scratch.ArgumentType.STRING,menu:'physicsEngineProperties',defaultValue:'maxSpeed'}}},
          {opcode:'setPhysicsEngineProperty',blockType:Scratch.BlockType.COMMAND,text:'set Arcade physics engine [ENGINE] property [PROPERTY] to [VALUE]',arguments:{...str('ENGINE',''),PROPERTY:{type:Scratch.ArgumentType.STRING,menu:'physicsEngineProperties',defaultValue:'maxSpeed'},...n('VALUE',500)}},
          {opcode:'setScenePhysicsEngine',blockType:Scratch.BlockType.COMMAND,text:'set Arcade physics engine of scene [SCENE] to [ENGINE]',arguments:{...str('SCENE',''),...str('ENGINE','')}},
          {opcode:'sceneFlags',blockType:Scratch.BlockType.REPORTER,text:'Arcade flags of scene [SCENE]',arguments:str('SCENE','')},
          {opcode:'setSceneFlags',blockType:Scratch.BlockType.COMMAND,text:'Arcade scene [SCENE] set flags to [VALUE]',arguments:{...str('SCENE',''),...n('VALUE',0)}},
          {opcode:'setUserEventsEnabled',blockType:Scratch.BlockType.COMMAND,text:'Arcade set user controller events enabled [ENABLED]',arguments:{ENABLED:{type:Scratch.ArgumentType.BOOLEAN}}},
          { opcode: 'spriteProperty', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade sprite [ID] [PROPERTY]',
            arguments: { ...str('ID', ''), PROPERTY: {type: Scratch.ArgumentType.STRING, menu: 'readableSpriteProperties', defaultValue: 'x'} } },
          { opcode: 'setSpriteKind', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade sprite [ID] kind [KIND]',
            arguments: { ...str('ID', ''), ...str('KIND', 'Player') } },
          { opcode: 'spriteOverlaps', blockType: Scratch.BlockType.BOOLEAN,
            text: 'Arcade sprite [A] overlaps [B]?',
            arguments: { ...str('A', ''), ...str('B', '') } },
          { opcode: 'setLegacyTilemap', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade color-coded map image [IMAGE] scale exponent [SCALE]', arguments: {...str('IMAGE',''), ...n('SCALE',4)} },
          { opcode: 'setLegacyTile', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade color tile [INDEX] image [IMAGE] wall [WALL]', arguments: {...n('INDEX',1), ...str('IMAGE',''), ...n('WALL',0)} },
          { opcode: 'legacyTileLocation', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade color tile column [COLUMN] row [ROW]', arguments: {...n('COLUMN',0),...n('ROW',0)} },
          { opcode: 'legacyTilesOfType', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade color tiles of index [INDEX]', arguments: n('INDEX',1) },
          { opcode: 'legacyTileProperty', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade color tile [TILE] [PROPERTY]', arguments: {...str('TILE',''),PROPERTY:{type:Scratch.ArgumentType.STRING,menu:'legacyTileProperties',defaultValue:'x'}} },
          { opcode: 'setLegacyTileAt', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade color tile [TILE] index [INDEX]', arguments: {...str('TILE',''),...n('INDEX',1)} },
          { opcode: 'placeOnLegacyTile', blockType: Scratch.BlockType.COMMAND,
            text: 'on Arcade color tile [TILE] place sprite [ID]', arguments: {...str('TILE',''),...str('ID','')} },
          { opcode: 'placeOnRandomLegacyTile', blockType: Scratch.BlockType.COMMAND,
            text: 'place Arcade sprite [ID] on random color tile [INDEX]', arguments: {...str('ID',''),...n('INDEX',1)} },
          { opcode: 'setTilemap', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade tilemap [DATA]', arguments: str('DATA', '') },
          { opcode: 'tileLocation', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade tile location column [COLUMN] row [ROW]', arguments: {...n('COLUMN', 0), ...n('ROW', 0)} },
          { opcode: 'tilesOfType', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade tile locations of image [IMAGE]', arguments: str('IMAGE', '') },
          { opcode: 'tileLocationProperty', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade tile location [LOCATION] [PROPERTY]', arguments: {...str('LOCATION', ''), PROPERTY:{type:Scratch.ArgumentType.STRING,menu:'tileLocationProperties',defaultValue:'column'}} },
          { opcode: 'tileAtLocation', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade tile image at [LOCATION]', arguments: str('LOCATION', '') },
          {opcode:'spriteTileKindAt',blockType:Scratch.BlockType.BOOLEAN,text:'Arcade sprite [ID] tile kind at [DIRECTION] equals image [IMAGE]',arguments:{...str('ID',''),...str('IMAGE',''),DIRECTION:{type:Scratch.ArgumentType.STRING,menu:'tileDirections',defaultValue:'4'}}},
          { opcode: 'tileIs', blockType: Scratch.BlockType.BOOLEAN,
            text: 'Arcade tile at [LOCATION] is image [IMAGE]', arguments: {...str('LOCATION', ''), ...str('IMAGE', '')} },
          { opcode: 'tileIsWall', blockType: Scratch.BlockType.BOOLEAN,
            text: 'Arcade tile at [LOCATION] is wall', arguments: str('LOCATION', '') },
          { opcode: 'setTileAt', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade tile at [LOCATION] to image [IMAGE]', arguments: {...str('LOCATION', ''), ...str('IMAGE', '')} },
          { opcode: 'setWallAt', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade wall at [LOCATION] to [WALL]', arguments: {...str('LOCATION', ''), WALL: {type: Scratch.ArgumentType.BOOLEAN}} },
          { opcode: 'placeOnTile', blockType: Scratch.BlockType.COMMAND,
            text: 'place Arcade sprite [ID] on tile [LOCATION]', arguments: {...str('ID', ''), ...str('LOCATION', '')} },
          { opcode: 'placeOnRandomTile', blockType: Scratch.BlockType.COMMAND,
            text: 'place Arcade sprite [ID] on random tile image [IMAGE]', arguments: {...str('ID', ''), ...str('IMAGE', '')} },
          { opcode: 'tileNeighbor', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade tile [DIRECTION] neighbor of [LOCATION]', arguments: {...str('LOCATION', ''), DIRECTION: {type: Scratch.ArgumentType.STRING, menu: 'collisionDirections', defaultValue: '0'}} },
          { opcode: 'spriteTileLocation', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade tile location of sprite [ID]', arguments: str('ID', '') },
          { opcode: 'randomTileOfType', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade random tile location of image [IMAGE]', arguments: str('IMAGE', '') },
          { opcode: 'registerTilemapEvent', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade register tilemap event [EVENT] as [TOKEN] capturing [CAPTURES]',
            arguments: {EVENT: {type: Scratch.ArgumentType.STRING, menu: 'tilemapEvents', defaultValue: 'Loaded'}, ...str('TOKEN', 'tilemap'), ...str('CAPTURES', '')} },
          { opcode: 'unregisterTilemapEvent', blockType: Scratch.BlockType.COMMAND,
            text: 'Arcade unregister tilemap event [EVENT] as [TOKEN]',
            arguments: {EVENT: {type: Scratch.ArgumentType.STRING, menu: 'tilemapEvents', defaultValue: 'Loaded'}, ...str('TOKEN', 'tilemap')} },
          { opcode: 'whenRegisteredTilemapEvent', blockType: Scratch.BlockType.HAT, isEdgeActivated: false,
            text: 'when Arcade tilemap event handler [TOKEN] runs', arguments: str('TOKEN', 'tilemap') },
          { opcode: 'eventTilemapData', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade event tilemap data' },
          { opcode: 'tilemapValue', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade tilemap value [DATA]', arguments: str('DATA', '') },
          { opcode: 'tilemapProperty', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade tilemap [PROPERTY] of [DATA]', arguments: {...str('DATA', ''), PROPERTY: {type: Scratch.ArgumentType.STRING, menu: 'tilemapProperties', defaultValue: 'width'}} },
          { opcode: 'tilemapTile', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade tilemap [DATA] tile index at column [COLUMN] row [ROW]', arguments: {...str('DATA', ''), ...n('COLUMN', 0), ...n('ROW', 0)} },
          { opcode: 'tilemapIsWall', blockType: Scratch.BlockType.BOOLEAN,
            text: 'Arcade tilemap [DATA] wall at column [COLUMN] row [ROW]', arguments: {...str('DATA', ''), ...n('COLUMN', 0), ...n('ROW', 0)} },
          { opcode: 'tilemapTileImage', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade tilemap [DATA] image of tile index [INDEX]', arguments: {...str('DATA', ''), ...n('INDEX', 0)} },
          { opcode: 'setTilemapTile', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade tilemap [DATA] tile index at column [COLUMN] row [ROW] to [INDEX]', arguments: {...str('DATA', ''), ...n('COLUMN', 0), ...n('ROW', 0), ...n('INDEX', 0)} },
          { opcode: 'setTilemapWall', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade tilemap [DATA] wall at column [COLUMN] row [ROW] to [WALL]', arguments: {...str('DATA', ''), ...n('COLUMN', 0), ...n('ROW', 0), WALL: {type: Scratch.ArgumentType.BOOLEAN}} },
          { opcode: 'setTilemapScale', blockType: Scratch.BlockType.COMMAND,
            text: 'set Arcade tilemap [DATA] scale to [VALUE]', arguments: {...str('DATA', ''), ...n('VALUE', 4)} },
          { opcode: 'tilemapTileset', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade tilemap [DATA] tileset', arguments: str('DATA', '') },
          { opcode: 'tileLocationTilemap', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade scene tilemap of tile [LOCATION]', arguments: str('LOCATION', '') },
          { opcode: 'sceneTilemapProperty', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade scene tilemap [PROPERTY] of [MAP]', arguments: {...str('MAP', ''), PROPERTY: {type: Scratch.ArgumentType.STRING, menu: 'sceneTilemapProperties', defaultValue: 'data'}} },
          {opcode:'createSpriteKind',blockType:Scratch.BlockType.REPORTER,text:'Arcade create sprite kind'},
          {opcode:'spriteKindValue',blockType:Scratch.BlockType.REPORTER,text:'Arcade sprite kind value [NAME]',arguments:str('NAME','Player')},
          {opcode:'bindSpriteKind',blockType:Scratch.BlockType.COMMAND,text:'Arcade bind sprite kind name [NAME] to [KIND]',arguments:{...str('NAME','Custom'),...n('KIND',1003)}},
          {opcode:'initializeSpriteKindLibrary',blockType:Scratch.BlockType.COMMAND,text:'Arcade initialize sprite kind library [LIBRARY] version [VERSION]',arguments:{...str('LIBRARY','textsprite'),...str('VERSION','v1.3.0')}},
          { opcode: 'spritesOfKind', blockType: Scratch.BlockType.REPORTER,
            text: 'array of Arcade sprites of kind [KIND]', arguments: str('KIND', 'Player') },
          {opcode:'withoutNullSprites',blockType:Scratch.BlockType.REPORTER,
            text:'Arcade sprite array [ARRAY] without null',arguments:str('ARRAY','')},
          { opcode: 'spriteCount', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade sprites of kind [KIND]', arguments: str('KIND', 'Player') },
          { opcode: 'whenSpriteCreated', blockType: Scratch.BlockType.HAT,
            text: 'when Arcade sprite kind [KIND] created', isEdgeActivated: false,
            arguments: str('KIND', 'Player') },
          { opcode: 'whenSpriteDestroyed', blockType: Scratch.BlockType.HAT,
            text: 'when Arcade sprite kind [KIND] destroyed', isEdgeActivated: false,
            arguments: str('KIND', 'Player') },
          { opcode: 'whenRegisteredCreated', blockType: Scratch.BlockType.HAT,
            text: 'when Arcade creation handler [TOKEN] runs', isEdgeActivated: false, arguments: str('TOKEN', 'handler') },
          { opcode: 'whenRegisteredDestroyed', blockType: Scratch.BlockType.HAT,
            text: 'when Arcade destruction handler [TOKEN] runs', isEdgeActivated: false,
            arguments: str('TOKEN', 'handler') },
          { opcode: 'whenSpritesOverlap', blockType: Scratch.BlockType.HAT,
            text: 'when Arcade kinds [A] and [B] overlap', isEdgeActivated: false,
            arguments: { ...str('A', 'Player'), ...str('B', 'Enemy') } },
          { opcode: 'eventSprite', blockType: Scratch.BlockType.REPORTER,
            text: 'Arcade event sprite [WHICH]',
            arguments: { WHICH: {type: Scratch.ArgumentType.STRING, menu: 'eventSprites', defaultValue: 'first'} } },

          {opcode:'mathUnary',blockType:Scratch.BlockType.REPORTER,text:'Arcade math [OP] of [NUM]',arguments:{OP:{type:Scratch.ArgumentType.STRING,menu:'mathUnaryOperations',defaultValue:'truncate'},...n('NUM',0)}},
          {opcode:'truncateNumber',blockType:Scratch.BlockType.REPORTER,text:'Arcade truncate [NUM] toward zero',arguments:n('NUM',0)},
          {opcode:'signNumber',blockType:Scratch.BlockType.REPORTER,text:'Arcade sign of [NUM]',arguments:n('NUM',0)},
          {opcode:'randomNumber',blockType:Scratch.BlockType.REPORTER,text:'Arcade random fraction'},
          {opcode:'mathBinary',blockType:Scratch.BlockType.REPORTER,text:'Arcade math [OP] first [A] second [B]',arguments:{OP:{type:Scratch.ArgumentType.STRING,menu:'mathOperations',defaultValue:'randomRange'},...n('A',0),...n('B',10)}},
          {opcode:'percentChance',blockType:Scratch.BlockType.BOOLEAN,text:'Arcade percent chance [PERCENTAGE]',arguments:n('PERCENTAGE',50)},
          {opcode:'clampNumber',blockType:Scratch.BlockType.REPORTER,text:'Arcade clamp minimum [MIN] maximum [MAX] value [VALUE]',arguments:{...n('MIN',0),...n('MAX',100),...n('VALUE',50)}},

          // ── Game flow ────────────────────────────────────────────
          '---',
          { opcode: 'whenInterval', blockType: Scratch.BlockType.HAT,
            text: 'every [PERIOD] ms in Arcade', isEdgeActivated: false,
            arguments: n('PERIOD', 1000) },
          { opcode: 'whenUpdate', blockType: Scratch.BlockType.HAT,
            text: 'each Arcade game update', isEdgeActivated: false },
          { opcode: 'gameover', blockType: Scratch.BlockType.COMMAND,
            text: 'game over' },
          { opcode: 'whenCountdownEnds', blockType: Scratch.BlockType.HAT,
            text: 'when Arcade countdown ends', isEdgeActivated: false },
          { opcode: 'countdown', blockType: Scratch.BlockType.COMMAND,
            text: 'countdown from [N]',
            arguments: n('N', 3) }
          ,{ opcode: 'startCountdown', blockType: Scratch.BlockType.COMMAND,
            text: 'start Arcade countdown [N] seconds', arguments: n('N', 3) }
          ,{ opcode: 'stopCountdown', blockType: Scratch.BlockType.COMMAND,
            text: 'stop Arcade countdown' }
        ],
        menus: {
          fontValueNames:{acceptReporters:false,items:['font5','font8','font12']},
          fontMetricFonts:{acceptReporters:false,items:['font5','font8','font12']},
          fontMetricProperties:{acceptReporters:false,items:['charWidth','charHeight']},
          sourceReferenceTypes:{acceptReporters:false,items:'_sourceReferenceChoices'},
          constraintProcedures:{acceptReporters:false,items:'_constraintProcedures'},
          constraintParameters:{acceptReporters:false,items:'_constraintParameters'},
          sourceBinaryOperations:{acceptReporters:false,items:['+','-','*','/','%','**','&','|','^','<<','>>','>>>']},
          sourceUnaryOperations:{acceptReporters:false,items:['~']},
          gameStatsModes:{acceptReporters:false,items:['enabled','disabled']},
          sourceScalarTypes:{acceptReporters:false,items:['Number','Boolean','String','Any']},
          mathOperations:{acceptReporters:false,items:['min','max','randomRange','atan2']},
          mathUnaryOperations:{acceptReporters:false,items:['truncate','sign']},
          hudElements:{acceptReporters:false,items:['score','life','countdown']},
          buttons: {acceptReporters: true, items: [
            {text: 'A', value: 'a'}, {text: 'B', value: 'b'},
            {text: 'up', value: 'up'}, {text: 'down', value: 'down'},
            {text: 'left', value: 'left'}, {text: 'right', value: 'right'},
            {text: 'Start', value: 'start'}, {text: 'Select / menu', value: 'select'}
          ]},
          repeatButtons:{acceptReporters:false,items:['A','B','up','down','left','right']},
          repeatProperties:{acceptReporters:false,items:[{text:'delay (ms)',value:'repeatDelay'},{text:'interval (ms)',value:'repeatInterval'}]},
          controlPlayers:{acceptReporters:false,items:['1','2','3','4']},
          buttonEvents:{acceptReporters:true,items:[{text:'pressed',value:'2049'},{text:'released',value:'2048'},{text:'repeated',value:'2054'}]},
          axes: {acceptReporters: true, items: ['x', 'y']}
          ,particleEffects: {acceptReporters: false, items: ['spray', 'trail', 'fountain', 'rings', 'fire', 'warmRadial', 'coolRadial', 'halo',
            'ashes', 'disintegrate', 'confetti', 'hearts', 'smiles', 'blizzard', 'bubbles', 'starField', 'clouds', 'none']}
          ,imageFonts: {acceptReporters: false, items: ['auto', 'normal', 'small', 'large']}
          ,backgroundEffects: {acceptReporters: false, items: ['confetti', 'hearts', 'smiles', 'blizzard', 'bubbles', 'starField', 'clouds', 'none', 'dissolve', 'melt', 'slash', 'splatter']}
          ,legacyGameOverEffects: {acceptReporters: false, items: ['unset', 'confetti', 'hearts', 'smiles', 'blizzard', 'bubbles', 'starField', 'clouds', 'none', 'dissolve', 'melt', 'slash', 'splatter']}
          ,imageEffects: {acceptReporters: false, items: ['dissolve', 'melt', 'slash', 'splatter']}
          ,backgroundScrollVersions:{acceptReporters:false,items:[{text:'Layers (v0.1.2)',value:'v0.1.2'},{text:'Single background (legacy)',value:'43651f88b917a98ad886fdd4c1c2ad8001ce9b9c'}]},
          cameraScrollModes: {acceptReporters: false, items: ['OnlyHorizontal', 'OnlyVertical', 'BothDirections']}
          ,scrollAxes: {acceptReporters: false, items: ['x', 'y']}
          ,characterFrameModes: {acceptReporters: false, items: ['loop', 'run']}
          ,characterAnimationVersions:{acceptReporters:false,items:[{text:'Character (v0.1.0)',value:'v0.1.0'},{text:'Character (v0.0.2)',value:'a8df7de6f7073b553976b9e47fbfadebcdc4f0ec'}]}
          ,characterFacings: {acceptReporters: false, items: ['Up', 'Right', 'Down', 'Left']}
          ,dartActions: {acceptReporters: false, items: ['throwDart', 'stopDart']}
          ,tileDirections: {acceptReporters:true,items:[{text:'Left',value:'0'},{text:'Top',value:'1'},{text:'Right',value:'2'},{text:'Bottom',value:'3'},{text:'Center',value:'4'}]}
          ,dartSettings: {acceptReporters: false, items: ['setTrace', 'controlWithArrowKeys']}
          ,dartProperties: {acceptReporters: false, items: ['angle', 'pow', 'iter', 'traceColor', 'gravity', 'wind', 'angleRate', 'powerRate']}
          ,corgiModes: {acceptReporters: false, items: ['horizontalMovement', 'verticalMovement', 'updateSprite', 'cameraFollow']}
          ,corgiProperties: {acceptReporters: false, items: ['maxMoveVelocity', 'gravity', 'jumpVelocity', 'maxJump', 'decelerationRate']}
          ,segmentStyles: {acceptReporters: false, items: ['Blank', 'Thin', 'Narrow', 'Medium', 'Thick']}
          ,segmentScales: {acceptReporters: false, items: ['Full', 'Half']}
          ,digitRadixes: {acceptReporters: false, items: ['Decimal', 'Hex', 'Octal', 'Alpha']}
          ,segmentCharacters: {acceptReporters: false, items: ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
            'A', 'B', 'C', 'D', 'E', 'F', 'H', 'J', 'L', 'o', 'P', 'r', 'U', 'Y', 'Hyphen', 'Degree']}
          ,sevensegWritable: {acceptReporters: false, items: ['x', 'y', 'value', 'count']}
          ,sevensegReadable: {acceptReporters: false, items: ['x', 'y', 'width', 'height', 'value', 'count']}
          ,scoringTypes: {acceptReporters: false, items: ['HighScore', 'LowScore', 'None']}
          ,playbackModes: {acceptReporters: false, items: ['UntilDone', 'InBackground', 'LoopingInBackground']}
          ,carnivalScoring:{acceptReporters:false,items:['unset','None','HScore','LScore','HTime','LTime']}
          ,carnivalAreas:{acceptReporters:false,items:['Top','Mid','Bottom']}
          ,carnivalStyles:{acceptReporters:false,items:['Win','Lose','Score','Timed','Multi','Custom']}
          ,carnivalEffects:{acceptReporters:false,items:['unset','confetti','hearts','smiles','blizzard','bubbles','starField','clouds','none','dissolve','melt','slash','splatter']}
          ,melodyModes: {acceptReporters: false, items: ['play', 'playUntilDone', 'loop']}
          ,soundPlayModes: {acceptReporters: false, items: ['UntilDone', 'InBackground']}
          ,waveShapes: {acceptReporters: false, items: ['Sine', 'Sawtooth', 'Triangle', 'Square', 'Noise']}
          ,soundEffects: {acceptReporters: false, items: ['None', 'Vibrato', 'Tremolo', 'Warble']}
          ,soundCurves: {acceptReporters: false, items: ['Linear', 'Curve', 'Logarithmic']}
          ,melodies: {acceptReporters: false, items: ['baDing', 'wawawawaa', 'jumpUp', 'jumpDown', 'powerUp', 'powerDown', 'magicWand', 'siren',
            'pewPew', 'knock', 'footstep', 'thump', 'smallCrash', 'bigCrash', 'zapped', 'buzzer', 'sonar', 'spooky', 'beamUp']}
          ,sounds: {acceptReporters: false, items: ['PowerUp', 'PowerDown', 'JumpUp', 'JumpDown', 'BaDing', 'Wawawawaa', 'MagicWand', 'Siren']}
          ,beats: {acceptReporters: false, items: ['Whole', 'Half', 'Quarter', 'Eighth', 'Sixteenth', 'Double', 'Breve', 'Triplet']}
          ,screenEffects: {acceptReporters: false, items: ['confetti', 'hearts', 'smiles', 'blizzard', 'bubbles', 'starField', 'clouds', 'none']}
          ,dialogLayouts: {acceptReporters: false, items: ['Left', 'Right', 'Top', 'Bottom', 'Center', 'Full']}
          ,legacyTileProperties: {acceptReporters:false,items:['x','y','tileSet']}
          ,tileLocationProperties: {acceptReporters:false,items:['column','row','x','y','left','right','top','bottom','tileSet']}
          ,physicsEngineProperties: {acceptReporters:false,items:['maxSpeed','minStep','maxStep']}
          ,scaleAnchors:{acceptReporters:true,items:[{text:'middle',value:'0'},{text:'top',value:'1'},{text:'left',value:'2'},{text:'right',value:'4'},{text:'bottom',value:'8'},{text:'top left',value:'3'},{text:'top right',value:'5'},{text:'bottom left',value:'10'},{text:'bottom right',value:'12'}]}
          ,spriteProperties: {acceptReporters: false, items: ['x', 'y', 'left', 'right', 'top', 'bottom',
            'vx', 'vy', 'ax', 'ay', 'fx', 'fy', 'sx', 'sy', 'scale', 'width', 'height', 'z', 'lifespan',
            'rotation', 'rotationDegrees', 'data', 'flags']}
          ,readableSpriteProperties: {acceptReporters:false,items:['x','y','left','right','top','bottom',
            'vx','vy','ax','ay','fx','fy','sx','sy','scale','width','height','z','lifespan',
            'rotation','rotationDegrees','data','kind','flags']}
          ,eventSprites: {acceptReporters: false, items: ['first', 'second']}
          ,cameraAxes:{acceptReporters:false,items:['x','y']}
          ,cameraProperties: {acceptReporters: true, items: [{text:'x',value:'0'}, {text:'y',value:'1'}, {text:'left',value:'2'}, {text:'right',value:'3'}, {text:'top',value:'4'}, {text:'bottom',value:'5'}]}
          ,tilemapEvents: {acceptReporters: false, items: [{text:'Loaded',value:'Loaded'}, {text:'Unloaded',value:'Unloaded'}]}
          ,tilemapProperties: {acceptReporters: false, items: [{text:'width',value:'width'}, {text:'height',value:'height'}, {text:'scale',value:'scale'}]}
          ,sceneTilemapProperties: {acceptReporters: false, items: ['data','scale','enabled','areaWidth','areaHeight']}
          ,collisionDirections: {acceptReporters: true, items: [{text:'left',value:'0'}, {text:'top',value:'1'}, {text:'right',value:'2'}, {text:'bottom',value:'3'}]}
          ,controllerNumbers: {acceptReporters:false,items:['1','2','3','4']}
          ,playerReadModes: {acceptReporters:false,items:['safe','member']}
          ,playerLookupModes: {acceptReporters:false,items:['number','index']}
          ,animationAssets: {acceptReporters: true, items: 'getAnimationAssets'}
          ,animationProperties: {acceptReporters: false, items: ['image', 'action', 'interval']}
          ,animationTypes: {acceptReporters: true, items: [{text:'all',value:'0'}, {text:'image',value:'1'}, {text:'movement',value:'2'}]}
          ,imageProperties: {acceptReporters: false, items: ['width', 'height']}
          ,settingWriteTypes:{acceptReporters:false,items:['Number','String','NumberArray','StringArray','Buffer']}
          ,textSpriteProperties:{acceptReporters:false,items:['text','bg','fg','maxFontHeight','borderWidth','borderColor','padding','outlineWidth','outlineColor','icon']}
          ,settingReadTypes:{acceptReporters:false,items:['Number','String','NumberArray','StringArray','Buffer','List']}
          ,spriteDataTypes:{acceptReporters:false,items:['Number','String','Boolean','Sprite']}
          ,spriteDataReadTypes:{acceptReporters:false,items:['Number','String','Sprite']}
          ,bufferFormats: {acceptReporters: true, items: Object.keys(dependencies.buffers.NumberFormat).filter(key=>!/^\\d+$/.test(key))}
          ,imageBlitOperations: {acceptReporters: false, items: ['drawImage', 'drawTransparentImage']},
          imageCircleOperations: {acceptReporters:false,items:['drawCircle','fillCircle']},
          imageDrawOperations: {acceptReporters: false, items: ['fillRect', 'drawLine']},
          imageOperations: {acceptReporters: false, items: ['fill', 'replace', 'flipX', 'flipY']},
          spriteFlags: {acceptReporters: false, items: Object.keys(spriteFlags)}
          ,speechModes: {acceptReporters: false, items: ['text', 'legacy']}
        }
      },scoreNumberOwners.get(this)),method=>nullSpriteOwners.get(this).get(method)),method=>nullSpriteOwners.get(this).get(method)),sceneClockOwners.get(this)),frameDeltaOwners.get(this))),method=>nullSpriteOwners.get(this).get(method));
    }

    // An owned runtime may inject {now:()=>milliseconds} for deterministic
    // controls. Production uses the platform monotonic clock when available;
    // this epoch is independent of Scratch's resettable project timer.
    _resetProgramClock() {
      const supplied=this._runtime?.bwArcadeProgramClock;
      const now=supplied===undefined ? (()=>globalThis.performance?.now?.() ?? Date.now()) :
        supplied && typeof supplied.now==='function' ? supplied.now.bind(supplied) : null;
      const suppliedTimers=supplied && (supplied.setTimeout!==undefined || supplied.clearTimeout!==undefined);
      if(suppliedTimers && (typeof supplied.setTimeout!=='function' || typeof supplied.clearTimeout!=='function'))throw new Error('Arcade program timer source needs setTimeout and clearTimeout');
      const rawSetTimeout=suppliedTimers?supplied.setTimeout.bind(supplied):supplied===undefined?globalThis.setTimeout.bind(globalThis):undefined;
      const epoch={now,start:undefined,last:0,active:true,timerAuthority:supplied===undefined || suppliedTimers,rawSetTimeout,lastWake:0,
        // Every timer is a PXT fiber wake. pxtsim stamps a wake that waited over 3 ms as the last yield (see frame-phase.js).
        setTimeout:rawSetTimeout&&((callback,delay,...rest)=>rawSetTimeout(function(...fired){
          if(epoch.active && delay>3 && Number.isFinite(epoch.start))epoch.lastWake=Math.max(epoch.lastWake,Math.floor(epoch.now()-epoch.start));
          return callback.apply(this,fired);
        },delay,...rest)),
        clearTimeout:suppliedTimers?supplied.clearTimeout.bind(supplied):supplied===undefined?globalThis.clearTimeout.bind(globalThis):undefined};this._programClockEpoch=epoch;
      if(!now)throw new Error('Arcade program clock source needs a now function');
      const start=now();
      if(this._programClockEpoch!==epoch || !Number.isFinite(start))throw new Error('Arcade program clock initialization is invalid');
      epoch.start=start;
    }
    _programMillis() {
      const epoch=this._programClockEpoch;if(!epoch || !Number.isFinite(epoch.start))throw new Error('Arcade program clock is not initialized');if(!epoch.active)return epoch.last;
      const now=epoch.now();
      if(this._programClockEpoch!==epoch)throw new Error('Arcade program clock run changed during read');
      if(!Number.isFinite(now) || now<epoch.start+epoch.last)throw new Error('Arcade program clock source is invalid or moved backwards');
      return epoch.last=Math.floor(now-epoch.start);
    }
    _stopProgramClock() {
      const epoch=this._programClockEpoch;
      try{this._programMillis();}catch(error){this._runtime?.emit?.('BLOCKS_ERROR',error.message);}
      if(this._programClockEpoch===epoch)epoch.active=false;
    }
    programMillis() {try{return this._programMillis();}catch(error){this._runtime?.emit?.('BLOCKS_ERROR',error.message);return Scratch.BWValues.encode(undefined);}}
    sceneMillis(args,util) {
      return sceneClockValues.get(this).read(args,util,()=>{
        // Refuse effectful clock access before _state's existing initialization
        // check. Genuine own data keeps that initializer and scene policy.
        const current=Object.getOwnPropertyDescriptor(this._runtime,'bwArcadeDeviceState');
        if(current&&!Object.prototype.hasOwnProperty.call(current,'value'))throw Error('Scene clock Number: scene accessor is not owned data');
        const existing=current?.value;
        if(existing&&typeof existing==='object'){
          const prototype=Object.getPrototypeOf(existing),elapsed=Object.getOwnPropertyDescriptor(existing,'elapsedMs');
          // _state reads elapsedMs before initializing it: an inherited getter
          // must not run on the certified path when the own value is absent.
          let inherited=false;for(let parent=prototype;parent;parent=Object.getPrototypeOf(parent))if(Object.getOwnPropertyDescriptor(parent,'elapsedMs')){inherited=true;break;}
          if(prototype!==Object.prototype&&prototype!==null||!elapsed&&inherited||elapsed&&!Object.prototype.hasOwnProperty.call(elapsed,'value'))throw Error('Scene clock Number: clock accessor is not owned data');
        }
        const state=this._state(),elapsed=Object.getOwnPropertyDescriptor(state,'elapsedMs');
        if(!elapsed||!Object.prototype.hasOwnProperty.call(elapsed,'value'))throw Error('Scene clock Number: clock value is not owned data');
        return {state,value:elapsed.value};
      },()=>this._state().elapsedMs || 0);
    }

    _state() {
      if (this._runtime) {
        if (!this._runtime.bwArcadeDeviceState) this._runtime.bwArcadeDeviceState = {};
        const state = this._runtime.bwArcadeDeviceState;
        if (!state.buttons) state.buttons = {};
        if (!state.controllerButtons) state.controllerButtons = {};
        if (!state.sprites) state.sprites = {};
        if (!Number.isFinite(state.nextSpriteId)) state.nextSpriteId = 0;
        if (!state.spriteTargets) state.spriteTargets = {};
        if (!Array.isArray(state.neopixels)) state.neopixels = Array(5).fill('#111827');
        if (!Number.isFinite(state.score)) state.score = 0;
        state.palette=this._paletteColors().slice();
        this._ensureSceneEngine(state);return state;
      }
      if (!this._fallbackState) this._fallbackState = {buttons: {}, controllerButtons: {}, sprites: {}, neopixels: Array(5).fill('#111827'), score: 0};
      this._fallbackState.palette=this._paletteColors().slice();
      this._ensureSceneEngine(this._fallbackState);return this._fallbackState;
    }

    _players() {
      const state=this._state();
      if(!state._mpPlayers)state._mpPlayers=Array.from({length:4},(_,index)=>{
        const player={id:'arcade-player:'+(++this._nextPlayerValue),index,sprite:undefined};
        this._playerValues.set(player.id,player);return player;
      });
      return state._mpPlayers;
    }
    _settingsStore() {
      const stage=this._runtime.getTargetForStage();
      if(!this._settingsBinding || this._settingsBinding.stage!==stage){
        const options={changed:()=>this._runtime.emitProjectChanged?.()};
        if(Object.prototype.hasOwnProperty.call(this._runtime,'bwArcadeSettingsStorage'))options.storage=this._runtime.bwArcadeSettingsStorage;
        this._settingsBinding={stage,store:dependencies.createProgramSettings(stage,options)};
      }
      return this._settingsBinding.store;
    }
    _settingsGuard(work,boolean=false){try{return work();}catch(error){this._runtime?.emit?.('BLOCKS_ERROR',error.message);return boolean?false:Scratch.BWValues.encode(undefined);}}
    settingsWrite(args,util){return this._settingsGuard(()=>{
      const type=args.TYPE,key=Scratch.BWValues.decode(args.KEY);
      let value=Scratch.BWValues.decode(args.VALUE);
      // Editor shadows deliver numeric strings; connected typed reporters keep
      // their values and diagnostics. BWValues does not tag primitive strings.
      const block=util?.target?.blocks?.getBlock(util.thread?.peekStack?.());
      const input=block?.inputs?.VALUE;
      const shadow=input && input.block===input.shadow && util?.target?.blocks?.getBlock(input?.shadow);
      if(type==='Number' && typeof value==='string' && shadow && ['math_number','math_integer','math_whole_number','math_positive_number','math_angle','text'].includes(shadow.opcode))value=Scratch.Cast.toNumber(value);
      if(type==='NumberArray' || type==='StringArray'){value=Scratch.BWValues.arrayValue(this._runtime,args.VALUE);const elementType=type==='NumberArray'?'number':'string';if(!value || value.some(v=>typeof Scratch.BWValues.decode(v)!==elementType))throw new Error('Arcade settings require a '+elementType+' array');value=value.map(v=>Scratch.BWValues.decode(v));}
      else if(type==='Buffer')value=this._buffer(args.VALUE);
      else if(type==='Number' && typeof value!=='number' && value!=null || type==='String' && typeof value!=='string')throw new Error('Arcade setting value type does not match');
      if(!['Number','String','NumberArray','StringArray','Buffer'].includes(type))throw new Error('Arcade setting type is not supported');
      this._settingsStore().call('write'+type,key,value);
    });}
    settingsRead(args){return this._settingsGuard(()=>{
      const type=args.TYPE,key=Scratch.BWValues.decode(args.KEY);
      if(!['Number','String','NumberArray','StringArray','Buffer','List'].includes(type))throw new Error('Arcade setting read type is not supported');
      const value=this._settingsStore().call(type==='List'?'list':'read'+type,key);
      if(type==='List')return Scratch.BWValues.arrayReference(this._runtime,value.data);
      if((type==='NumberArray' || type==='StringArray') && Array.isArray(value))return Scratch.BWValues.arrayReference(this._runtime,value);
      if(type==='Buffer' && value)return this._bufferReference(value);
      return Scratch.BWValues.encode(value);
    });}
    _readHighScore() {return this._settingsStore().call('readNumber','high-score') || 0;}
    _highScoreFailure(method,args,util,error) {
      if(!util)throw error;
      return dependencies.highScoreFaults.fault(method,nullSpriteFaults.get(this).get(method),args,util,error,
        fault=>exceptionOwners.get(this).rejectPrimitiveFault(args,util,fault.error,fault.lease));
    }
    highScore(args,util) {
      try{return this._readHighScore();}catch(error){return this._highScoreFailure('highScore',args,util,error);}
    }
    settingsExists(args){return this._settingsGuard(()=>this._settingsStore().call('exists',Scratch.BWValues.decode(args.KEY)),true);}
    settingsRemove(args){return this._settingsGuard(()=>this._settingsStore().call('remove',Scratch.BWValues.decode(args.KEY)));}
    settingsClear(){return this._settingsGuard(()=>this._settingsStore().call('clear'));}

    _sourceReferenceChoices() {
      const names = ['Sprite','Image','number[]','boolean[]','string[]','Sprite[]','Image[]'];
      const targets = this._runtime.targets.filter(target => target.isOriginal !== false);
      for (const name of dependencies.sourceReferenceTypes.catalogue(targets).keys()) names.push(name, name + '[]');
      return names;
    }
    declareSourceReference(args, util) {return this._sourceScalarCells.declareReference(args, util);}
    declareSourceScalar(args, util) {return this._sourceScalarCells.declare(args, util);}

    _initializeImplicitTextKinds() {
      const blocks=(this._runtime?.targets || []).flatMap(target=>Object.values(target.blocks?._blocks || {}));
      const explicit=blocks.some(block=>block.opcode==='arcade_initializeSpriteKindLibrary');
      if(!explicit && blocks.some(block=>String(block.opcode).startsWith('arcade_textSprite')))this._textSprites();
    }
    _textSprites() {
      if(!this._textSpriteModule)this._textSpriteModule=dependencies.createTextSpriteHost(this,imageEngine,host=>dependencies.initializeTextSprite({...host,createKind:()=>this._kindRegistry.bindName('Text',this._kindRegistry.create())}));
      return this._textSpriteModule;
    }
    _textSprite(value) {
      const instance=this._extensionSprites.get(String(Scratch.BWValues.decode(value)));
      if(!instance || !(instance instanceof this._textSprites().TextSprite))throw new Error('Arcade expected an owned text sprite');
      return instance;
    }
    _textSpriteGuard(call) {
      try {return call();}catch(error){this._runtime?.emit?.('BLOCKS_ERROR',String(error.message || error));return Scratch.BWValues.encode(undefined);}
    }
    textSpriteCreate(args) {return this._textSpriteGuard(()=>this._textSprites().textsprite.create(Scratch.BWValues.decode(args.TEXT),
      this._animationNumericValue(args.BACKGROUND),this._animationNumericValue(args.FOREGROUND)).__bwId);}
    textSpriteSetText(args) {return this._textSpriteGuard(()=>this._textSprite(args.ID).setText(Scratch.BWValues.decode(args.TEXT)));}
    textSpriteSetMaxFontHeight(args) {return this._textSpriteGuard(()=>this._textSprite(args.ID).setMaxFontHeight(this._animationNumericValue(args.HEIGHT)));}
    _textSpriteImage(value) {
      const decoded=Scratch.BWValues.decode(value);
      if(decoded==null)return null;
      const image=this._image(value);if(!image)throw new Error('Arcade text sprite icon needs an image or null');
      return this._textSprites().wrapImage(image);
    }
    textSpriteSetIcon(args) {return this._textSpriteGuard(()=>this._textSprite(args.ID).setIcon(this._textSpriteImage(args.IMAGE)));}
    textSpriteSetBorder(args) {return this._textSpriteGuard(()=>this._textSprite(args.ID).setBorder(this._animationNumericValue(args.WIDTH),
      this._animationNumericValue(args.COLOR),this._animationNumericValue(args.PADDING)));}
    textSpriteSetOutline(args) {return this._textSpriteGuard(()=>this._textSprite(args.ID).setOutline(this._animationNumericValue(args.WIDTH),this._animationNumericValue(args.COLOR)));}
    textSpriteUpdate(args) {return this._textSpriteGuard(()=>this._textSprite(args.ID).update());}
    _textSpritePropertyName(value) {
      const property=String(value);
      if(!['text','bg','fg','maxFontHeight','borderWidth','borderColor','padding','outlineWidth','outlineColor','icon'].includes(property))throw new Error('Arcade Text Sprite property is not supported');
      return property;
    }
    textSpriteProperty(args) {return this._textSpriteGuard(()=>{
      const property=this._textSpritePropertyName(args.PROPERTY),value=this._textSprite(args.ID)[property];
      return property==='icon' && value?this._imageHandle(value.raw):Scratch.BWValues.encode(value);
    });}
    textSpriteSetProperty(args) {return this._textSpriteGuard(()=>{
      const property=this._textSpritePropertyName(args.PROPERTY);
      this._textSprite(args.ID)[property]=property==='icon'?this._textSpriteImage(args.VALUE):Scratch.BWValues.decode(args.VALUE);
      // Original public field writes store only; update() explicitly redraws.
    });}

    // Original v0.0.5 helpers run unchanged over the owned Sprite data object.
    // The facade supplies its historical data() accessor; values retain aliases.
    _spriteDataCall(args,method,value) {
      const key=Scratch.BWValues.decode(args.KEY),id=Scratch.BWValues.decode(args.ID);
      let facade=null;
      if(id && key) {
        const sprite=this._sprite(args.ID);
        if(!sprite)throw new Error('Arcade Sprite Data sprite is not available');
        facade={data:()=>{
          let data=sprite.data;
          if(!Scratch.BWValues.truth(data)){data={};sprite.data=data;}
          if(!data || typeof data!=='object' || Array.isArray(data) || Scratch.BWValues.isReference(data) || ![null,Object.prototype].includes(Object.getPrototypeOf(data)))throw new Error('Arcade Sprite Data requires an owned data record');
          const descriptor=Object.getOwnPropertyDescriptor(data,String(key));
          if(descriptor && (descriptor.get || descriptor.set))throw new Error('Arcade Sprite Data accessor keys are not supported');
          if((method.startsWith('set') || method==='changeDataNumberBy') && (!Object.isExtensible(data) || descriptor?.writable===false))throw new Error('Arcade Sprite Data record is read only');
          // PXT RefMap lookup reads only stored keys, including names that
          // JavaScript normally inherits. Keep the actual record and its aliases;
          // this helper-only facade must not change its prototype or replace it.
          return new Proxy(data, {
            get:(record,name)=>Object.prototype.hasOwnProperty.call(record,name)?record[name]:undefined,
            set:(record,name,next)=>{
              const own=Object.getOwnPropertyDescriptor(record,name);
              Object.defineProperty(record,name,own?{...own,value:next}:{value:next,writable:true,enumerable:true,configurable:true});
              return true;
            }
          });
        }};
      }
      return originalSpriteData[method](facade,key,value);
    }
    _spriteDataGuard(work,boolean=false) {
      try{return work();}catch(error){this._runtime?.emit?.('BLOCKS_ERROR',error.message);return boolean?false:Scratch.BWValues.encode(undefined);}
    }
    spriteDataSet(args) {return this._spriteDataGuard(()=>{
      const type=args.TYPE;
      if(!['Number','String','Boolean','Sprite'].includes(type))throw new Error('Arcade Sprite Data type is not supported');
      const value=Scratch.BWValues.decode(args.VALUE);
      if(type==='Sprite' && Scratch.BWValues.truth(args.ID) && Scratch.BWValues.truth(args.KEY) && value && !this._sprite(args.VALUE))throw new Error('Arcade Sprite Data value sprite is not available');
      this._spriteDataCall(args,'setData'+type,value);this._changed();
    });}
    spriteDataRead(args) {return this._spriteDataGuard(()=>{
      if(!['Number','String','Sprite'].includes(args.TYPE))throw new Error('Arcade Sprite Data read type is not supported');
      return Scratch.BWValues.encode(this._spriteDataCall(args,'readData'+args.TYPE));
    });}
    spriteDataReadBoolean(args) {return this._spriteDataGuard(()=>this._spriteDataCall(args,'readDataBoolean'),true);}
    spriteDataChange(args) {return this._spriteDataGuard(()=>{this._spriteDataCall(args,'changeDataNumberBy',Scratch.BWValues.decode(args.VALUE));this._changed();});}

    _player(value) {return this._playerValues.get(Scratch.BWValues.referenceId(this._runtime,value,'player'));}
    _playerRef(player) {return player?Scratch.BWValues.reference(this._runtime,'player',player.id):Scratch.BWValues.encode(undefined);}
    playerLookup(args) {
      const raw=Scratch.BWValues.decode(args.VALUE);
      const key=String(args.MODE)==='number'?Number(raw)-1:raw;
      // PXT indexes the player array directly. A null index is not index zero;
      // canonical numeric strings name array slots, other property names do not.
      const index=typeof key==='string' && String(Number(key))===key?Number(key):key;
      return this._playerRef(Number.isInteger(index)&&index>=0&&index<4?this._players()[index]:undefined);
    }
    allPlayers() {return Scratch.BWValues.arrayReference(this._runtime,this._players().map(player=>this._playerRef(player)));}
    playerSprite(args) {return Scratch.BWValues.encode(this._player(args.PLAYER)?.sprite);}
    setPlayerSprite(args) {
      const player=this._player(args.PLAYER);if(!player)return;
      if(player.movement)this._stopControllingSprite(player.index+1,player.sprite);
      player.sprite=Scratch.BWValues.decode(args.ID);
      if(player.movement)this._controlSprite(player.index+1,player.sprite,player.vx,player.vy);
    }
    movePlayerWithButtons(args) {
      const player=this._player(args.PLAYER);if(!player)return;
      player.movement=true;player.vx=Scratch.BWValues.decode(args.VX);player.vy=Scratch.BWValues.decode(args.VY);
      this._controlSprite(player.index+1,player.sprite,player.vx,player.vy);
    }
    createPlayerState() {return this._nextMultiplayerState++;}
    _playerStateNumber(value) {const raw=Scratch.BWValues.decode(value);return typeof raw==='string'?Number(raw):raw;}
    _customPlayerState(player,key) {
      const entries=player.states || (player.states=[]);
      let entry=entries.find(value=>value.key===key);
      if(!entry){entry={key,value:0};entries.push(entry);}return entry;
    }
    getPlayerState(args) {
      const player=this._player(args.PLAYER);if(!player)return 0;
      const key=this._playerStateNumber(args.KEY);
      if(key===0)return this.getPlayerScore({PLAYER:player.index+1});
      if(key===1)return this.getLife({PLAYER:player.index+1});
      return Scratch.BWValues.encode(this._customPlayerState(player,key).value);
    }
    setPlayerState(args,util) {return this._runTerrainGenerator(this._setPlayerStateSteps(args,util));}
    *_setPlayerStateSteps(args,util) {
      const epoch=this._terrainEpoch;
      const player=this._player(args.PLAYER);if(!player)return;
      const key=this._playerStateNumber(args.KEY),value=this._playerStateNumber(args.VALUE);
      if(key===0){yield* this._setPlayerScoreSteps({PLAYER:player.index+1,VALUE:value},util);if(epoch!==this._terrainEpoch)return;}
      if(key===1)this.setLife({PLAYER:player.index+1,VALUE:value});
      this._customPlayerState(player,key).value=value;
    }
    changePlayerState(args,util) {
      if(!this._player(args.PLAYER))return;
      return this.setPlayerState({...args,VALUE:Scratch.BWValues.decode(this.getPlayerState(args))+this._playerStateNumber(args.VALUE)},util);
    }
    playerBySprite(args) {const sprite=Scratch.BWValues.decode(args.ID);return this._playerRef(this._players().find(player=>player.sprite===sprite));}
    playerProperty(args) {
      const player=this._player(args.PLAYER),property=Number(Scratch.BWValues.decode(args.PROPERTY));
      if(String(args.READ)==='member' && !player)throw new TypeError('Cannot read property of missing mp.Player');
      return player?(property===1?player.index:property===2?player.index+1:0):0;
    }

    _newPhysicsEngine(maxSpeed=500,minStep=2,maxStep=4) {
      const id='arcade-engine:'+(++this._nextPhysicsEngine);
      const engine={id,members:[],maxVelocity:(Number(maxSpeed)*256)|0,minSingleStep:(Number(minStep)*256)|0,maxSingleStep:(Number(maxStep)*256)|0};
      this._physicsEngines.set(id,engine);return engine;
    }
    _sourceSceneTimers() {return !!(this._runtime?.bwArcadeFrameAuthority!=='manual' && this._programClockEpoch?.active && this._programClockEpoch.timerAuthority && this._runtime?._arcadeFramePhase?.hasSourceProject());}
    _sceneFrameContexts() {
      if(!this._sceneFrameHost){
        const epoch=this._programClockEpoch;
        this._sceneFrameHost=dependencies.createSceneFrameContexts({now:()=>this._programMillis(),
          setTimeout:epoch.setTimeout,clearTimeout:epoch.clearTimeout,polls:()=>this._nativePollEvents(),
          runFrame:(owner,delta)=>this._runtime._arcadeFramePhase.requestSceneFrame(()=>{
            if(this._state()!==owner)return;
            this._globalElapsedMs=this._programMillis();this._pumpQuestion(delta);
            const result=this._advance(delta/1000);this._musicHost?.pump();return result;
          }),onFrameBegin:owner=>this._gameStats.begin(owner),
          onFrameEnd:(owner,runtime)=>this._gameStats.finish(owner,runtime),
          onError:error=>this._runtime?.emit?.('BLOCKS_ERROR',String(error?.message || error))});
      }
      return this._sceneFrameHost;
    }
    _ensureSceneEngine(state) {
      if(state.elapsedMs===undefined)state.elapsedMs=0;
      if(state.frameDeltaTime===undefined)state.frameDeltaTime=0;
      if(!Object.hasOwn(state,'flags'))state.flags=0;
      if(!Object.getOwnPropertyDescriptor(state,'seeThrough')?.get){
        const previous=state.seeThrough;
        Object.defineProperty(state,'seeThrough',{enumerable:true,configurable:true,
          get(){return !!(this.flags & 2);},set(value){this.flags=value?this.flags|2:this.flags&~2;}});
        if(previous)state.flags |= 2;
      }
      if(this._sceneValues.get(state._sceneValueId)!==state){state._sceneValueId='arcade-scene:'+(++this._nextSceneValue);this._sceneValues.set(state._sceneValueId,state);}
      if(this._physicsEngines.get(state.physicsEngine?.id)!==state.physicsEngine || !state.physicsEngine)state.physicsEngine=this._newPhysicsEngine();
      if(this._sourceSceneTimers() && !this._askHeldScenes?.has(state))this._sceneFrameContexts().register(state);
    }
    _sceneValue(value) {return this._sceneValues.get(Scratch.BWValues.referenceId(this._runtime,value,'scene'));}
    _engineValue(value) {return this._physicsEngines.get(Scratch.BWValues.referenceId(this._runtime,value,'physics-engine'));}
    currentScene() {return Scratch.BWValues.reference(this._runtime,'scene',this._state()._sceneValueId);}
    sceneFlags(args) {const scene=this._sceneValue(args.SCENE);if(!scene)return this._objectError(new Error('Arcade scene flags require a live Scene reference'));return Scratch.BWValues.encode(scene.flags);}
    setSceneFlags(args,util) {const scene=this._sceneValue(args.SCENE);if(!scene)return this._objectError(new Error('Arcade scene flags require a live Scene reference'));scene.flags=this._mathArgument(args,'VALUE',util,'Arcade scene flags require a primitive value');this._changed();}
    setUserEventsEnabled(args) {this._userControllerEvents=!!Scratch.BWValues.decode(args.ENABLED);}
    scenePhysicsEngine(args) {const scene=this._sceneValue(args.SCENE);return scene?Scratch.BWValues.reference(this._runtime,'physics-engine',scene.physicsEngine.id):Scratch.BWValues.encode(undefined);}
    createPhysicsEngine(args) {
      const defaults=[500,2,4];
      const values=['MAX_SPEED','MIN_STEP','MAX_STEP'].map((key,index)=>Object.prototype.hasOwnProperty.call(args,key)?Number(Scratch.BWValues.decode(args[key])):defaults[index]);
      const engine=this._newPhysicsEngine(...values);return Scratch.BWValues.reference(this._runtime,'physics-engine',engine.id);
    }
    physicsEngineProperty(args) {
      const engine=this._engineValue(args.ENGINE),key={maxSpeed:'maxVelocity',minStep:'minSingleStep',maxStep:'maxSingleStep'}[String(args.PROPERTY)];
      return engine&&key?(engine[key]+128)>>8:Scratch.BWValues.encode(undefined);
    }
    setPhysicsEngineProperty(args) {
      const engine=this._engineValue(args.ENGINE),key={maxSpeed:'maxVelocity',minStep:'minSingleStep',maxStep:'maxSingleStep'}[String(args.PROPERTY)];
      if(engine&&key)engine[key]=(Number(Scratch.BWValues.decode(args.VALUE))*256)|0;
    }
    setScenePhysicsEngine(args) {const scene=this._sceneValue(args.SCENE),engine=this._engineValue(args.ENGINE);if(scene&&engine)scene.physicsEngine=engine;}

    _sceneBundle() {
      const bundle={state:this._state()};
      for(const key of ['_speech','_background','_backgroundImage','_tilemapDrawable','_createdHandlers','_wallHandlers','_legacyWallHandlers','_tileHandlers',
        '_activeLegacyAnimations','_imageAnimations','_animationUpdateOrder','_updateHandlers','_intervalHandlers','_buttonHandlers','_destroyedHandlers','_overlapHandlers','_foreverHandlers','_countdownHandlers'])bundle[key]=this[key];
      return bundle;
    }
    _sceneVisible(bundle, visible) {
      const renderer=this._runtime?.renderer;
      for(const [id,target] of Object.entries(bundle.state.spriteTargets || {}))target.setVisible?.(visible && !bundle.state.sprites[id]?.invisible);
      for(const [id,sprite] of Object.entries(bundle.state.sprites || {})) {
        const entry=this._imageSkins.get(id);
        if(entry?.drawableId!==undefined)renderer?.updateDrawableVisible?.(entry.drawableId,visible && !sprite.invisible);
      }
      for(const key of ['_background','_backgroundImage','_tilemapDrawable'])if(bundle[key])renderer?.updateDrawableVisible?.(bundle[key].drawable,visible);
      for(const entry of bundle._speech.values())if(entry.drawableId!==undefined)renderer?.updateDrawableVisible?.(entry.drawableId,visible && entry.target?.visible!==false);
    }
    _activateScene(bundle) {
      this._ownedSpriteSceneSerial++;ownedSpriteOwners.get(this)?.stop();
      if(this._runtime)this._runtime.bwArcadeDeviceState=bundle.state;else this._fallbackState=bundle.state;
      for(const key of Object.keys(bundle))if(key!=='state')this[key]=bundle[key];
      this._terrainFrame=this._sceneFrames.get(bundle.state) || null;
      if(this._controlEvents)this._controlEvents.activate(this._controlEventContext(bundle.state));
      this._sceneVisible(bundle,true);
      const ownedSprites=ownedSpriteOwners.get(this);if(ownedSprites&&!ownedSprites.isDisposed()&&!this._terrainStopped)ownedSprites.start();
      for(const sprite of Object.values(bundle.state.sprites || {})){if(sprite.image)this._renderSpriteImage(sprite.id);this._positionSprite(sprite.id);}
      this._renderPalette();
      this._showNextDialog();
      this._changed();
    }
    _freshScene(previous) {
      const state={overlapLocks:new Set(),buttons:previous.buttons,controllerButtons:previous.controllerButtons,neopixels:previous.neopixels,light:previous.light,tiltX:previous.tiltX,tiltY:previous.tiltY,serial:previous.serial};
      const bundle={state,_speech:new Map(),_background:null,_backgroundImage:null,_tilemapDrawable:null,_createdHandlers:[],_wallHandlers:[],_legacyWallHandlers:[],_tileHandlers:[],
        _activeLegacyAnimations:new Set(),_imageAnimations:new Map(),_animationUpdateOrder:[],_updateHandlers:[],_intervalHandlers:[],_buttonHandlers:[],_destroyedHandlers:[],_overlapHandlers:[],_foreverHandlers:[],_countdownHandlers:[]};
      this._sceneParents.set(state,previous);
      return bundle;
    }
    pushScene(args,util) {
      if(this._particleModule){this._particleModule.particles.clearAll();this._particleModule.particles.disableAll();}
      const old=this._sceneBundle();old.state.controllerConnectionState={...this._controllerConnections};this._sceneFrameHost?.unregister(old.state);this._sceneBundles.add(old);this._sceneStack.push(old);this._sceneVisible(old,false);
      this._activateScene(this._freshScene(old.state));
      return this._runTerrainGenerator(this._sceneHandlerSteps(this._scenePushHandlers.slice(),'arcade_whenRegisteredScenePush',util));
    }
    popScene(args,util) {
      const old=this._sceneBundle();this._sceneFrameHost?.unregister(old.state);this._sceneBundles.add(old);this._sceneVisible(old,false);
      const restored=this._sceneStack.pop() || this._freshScene(old.state);this._sceneBundles.delete(restored);this._activateScene(restored);
      if(restored.state.controllerConnectionState)for(let player=1;player<=4;player++)if(!!restored.state.controllerConnectionState[player]!==!!this._controllerConnections[player]) {
        const bus=this._controlEventBus();bus.raise(this._controllerEventIds.get(player),this._controllerConnections[player]?1:2);
      }
      if(this._particleModule)this._particleModule.particles.enableAll();
      return this._runTerrainGenerator(this._sceneHandlerSteps(this._scenePopHandlers.slice(),'arcade_whenRegisteredScenePop',util));
    }
    // Program and extension scene handlers, in registration order.
    *_sceneHandlerSteps(handlers,opcode,util) {
      const epoch=this._terrainEpoch;
      for(const handler of handlers){
        if(epoch!==this._terrainEpoch)return;
        if(handler.host)handler.host();
        else yield* this._registeredCallbackSteps([handler],opcode,{},util);
      }
    }
    _handlerRegistration(args,util) {return this._terrainRegistration(args,util);}
    _controlEventContext(state=this._state()) {
      let context=this._controlEventContexts.get(state);
      if(!context){
        context=this._controlEvents.createContext();this._controlEventContexts.set(state,context);
        // SDK Scene.init calls multiplayer.initPlayerConnectionListeners.
        for(let player=1;player<=4;player++)for(const [source,connected]of [[3241,true],[3242,false]])
          this._controlEvents.registerContext(context,source,player,()=>this._setControllerConnection(player,connected));
      }
      return context;
    }
    _controlEventBus() {
      if(!this._controlEvents)this._controlEvents=dependencies.createControlEvents({
        enqueue:work=>Promise.resolve().then(work),
        dispatch:registration=>{
          if(typeof registration==='function')return registration();
          const pending=this._runTerrainGenerator(this._registeredCallbackSteps([registration],'arcade_whenRegisteredControlEvent',{},undefined,true));
          if(pending?.then)this._runtime?._arcadeFramePhase?.requestContinuation().catch(error=>this._runtime.emit('BLOCKS_ERROR',error.message));
          return pending?.then?pending.then(faulted=>faulted===true?fiberDied:faulted):pending===true?fiberDied:pending;
        },
        died:result=>result===fiberDied,
        onError:error=>this._runtime?.emit?.('BLOCKS_ERROR',error.message)
      });
      if(!this._controllerEventIds){
        this._controllerEventIds=new Map();
        // Exact selected controlleroverrides.ts whenUsed initialization order.
        // Scene's transport listeners reference all four fixed instances.
        for(const player of [2,3,4,1])this._controllerEventIds.set(player,this._controlEvents.allocate());
        // Button constructors register these internal sources outside contexts.
        // The actual SDK setPressed path changes button/controller state and
        // announces the selected user/system event; it never posts keyboard IO.
        for(let player=1;player<=4;player++)for(const button of ['left','up','right','down','a','b','start'])for(const [source,held]of [[2051,true],[2050,false]])
          this._controlEvents.registerInternal(source,this._controlButtonId(player,button),()=>this._controllerButtonEdge(player,button,held));
      }
      this._controlEvents.activate(this._controlEventContext());return this._controlEvents;
    }
    allocateControlEventSource() {return this._controlEventBus().allocate();}
    controllerEventSource(args) {
      this._controlEventBus();const value=this._controllerEventIds.get(Number(args.PLAYER));
      if(value===undefined)throw new TypeError('Controller event source requires a fixed player 1 through 4');return value;
    }
    setControllerConnected(args,util) {
      const player=Number(args.PLAYER);if(!Number.isInteger(player)||player<1||player>4)throw new TypeError('Controller connection requires a fixed player 1 through 4');
      this._setControllerConnection(player,this._mathArgument(args,'CONNECTED',util,'Controller connected requires a primitive value'));
    }
    _setControllerConnection(player,value) {
      const previous=Object.prototype.hasOwnProperty.call(this._controllerConnections,player)?this._controllerConnections[player]:false;
      if(value!=previous){this._controllerConnections[player]=value;const bus=this._controlEventBus();bus.raise(this._controllerEventIds.get(player),value?1:2);}
    }
    registerMultiplayerConnection(args,util) {
      const bus=this._controlEventBus(),event=this._mathArgument(args,'EVENT',util,'Controller event requires a primitive value'),state=this._state(),entries=state.mpConnectionHandlers || (state.mpConnectionHandlers=[]);
      let entry=entries.find(entry=>entry.event===event);const registration=this._handlerRegistration(args,util);
      if(entry){entry.registration=registration;return;}
      entry={event,registration};entries.push(entry);
      for(const player of this._players()) {
        const ref=this._playerRef(player);
        bus.register(this._controllerEventIds.get(player.index+1),event,()=>{
          const pending=this._runTerrainGenerator(this._registeredCallbackSteps([entry.registration],'arcade_whenRegisteredMultiplayerConnection',{player:ref},undefined,true));
          if(pending?.then)this._runtime?._arcadeFramePhase?.requestContinuation().catch(error=>this._runtime.emit('BLOCKS_ERROR',error.message));return pending;
        });
      }
    }
    whenRegisteredMultiplayerConnection(args,util) {return this.whenRegisteredWall(args,util);}
    registerControlEvent(args,util) {
      this._controlEventBus().register(this._mathArgument(args,'SOURCE',util,'Event source requires a primitive value'),this._mathArgument(args,'VALUE',util,'Event value requires a primitive value'),this._handlerRegistration(args,util),Scratch.BWValues.decode(args.FLAGS));
    }
    raiseControlEvent(args,util) {this._controlEventBus().raise(this._mathArgument(args,'SOURCE',util,'Event source requires a primitive value'),this._mathArgument(args,'VALUE',util,'Event value requires a primitive value'));}
    waitControlEvent(args,util) {return this._controlEventBus().wait(this._mathArgument(args,'SOURCE',util,'Event source requires a primitive value'),this._mathArgument(args,'VALUE',util,'Event value requires a primitive value'));}
    whenRegisteredControlEvent(args,util) {return this.whenRegisteredWall(args,util);}
    registerUpdateHandler(args,util) {this._updateHandlers.push(this._handlerRegistration(args,util));}
    registerIntervalHandler(args,util) {
      const interval=Number(args.INTERVAL);if(interval<0)return;
      this._intervalHandlers.push({...this._handlerRegistration(args,util),interval,timer:0});
    }
    registerButtonHandler(args,util) {
      const button=String(args.BUTTON).toLowerCase(),event=Number(args.EVENT);
      const registration={...this._handlerRegistration(args,util),button,event,player:1};
      const index=this._buttonHandlers.findIndex(h=>h.player===1 && h.button===button && h.event===event);
      if(index<0){this._buttonHandlers.push(registration);this._registerControlButton(1,button,event);}else this._buttonHandlers[index]=registration;
    }
    registerPlayerButtonHandler(args,util) {
      const player=Number(Scratch.BWValues.decode(args.PLAYER));
      if(!Number.isInteger(player)||player<1||player>4)throw new TypeError('Button registration requires player 1 through 4');
      const button=String(args.BUTTON).toLowerCase(),event=Number(args.EVENT);
      const registration={...this._handlerRegistration(args,util),button,event,player};
      const index=this._buttonHandlers.findIndex(h=>h.player===player && h.button===button && h.event===event);
      if(index<0){this._buttonHandlers.push(registration);this._registerControlButton(player,button,event);}else this._buttonHandlers[index]=registration;
    }
    _multiplayerButton(value) {const raw=Scratch.BWValues.decode(value);return raw===null || raw===undefined?undefined:['a','b','up','right','down','left'][Number(raw)];}
    registerMultiplayerButtonHandler(args,util) {
      const button=this._multiplayerButton(args.BUTTON),event=Number(args.EVENT);if(!button)throw new TypeError('Invalid multiplayer button');
      const state=this._state(),entries=state.mpButtonHandlers || (state.mpButtonHandlers=[]);
      let entry=entries.find(h=>h.button===button && h.event===event);
      const registration=this._handlerRegistration(args,util);
      if(entry){entry.registration=registration;return;}
      entry={button,event,registration};entries.push(entry);
      for(const player of this._players()){
        const wrapper={button,event,player:player.index+1,mp:entry,playerValue:this._playerRef(player)};
        const index=this._buttonHandlers.findIndex(h=>h.player===wrapper.player && h.button===button && h.event===event);
        if(index<0){this._buttonHandlers.push(wrapper);this._registerControlButton(wrapper.player,button,event);}else this._buttonHandlers[index]=wrapper;
      }
    }
    eventPlayer(args,util) {return util?.thread?.bwArcadeEvent?.player || Scratch.BWValues.encode(undefined);}
    _heldButton(number,button) {
      const state=this._state(),buttons=number===1?state.buttons:state.controllerButtons[number] || {};
      const key={left:'left arrow',up:'up arrow',right:'right arrow',down:'down arrow',a:'space',b:'z',start:'enter',select:'m'}[button];
      return Object.prototype.hasOwnProperty.call(buttons,button)?!!buttons[button]:Boolean(number===1 && this._runtime?.ioDevices?.keyboard?.getKeyIsDown?.(key));
    }
    playerConnected(args) {
      const player=this._player(args.PLAYER);
      return player?Scratch.BWValues.encode(Object.prototype.hasOwnProperty.call(this._controllerConnections,player.index+1)?this._controllerConnections[player.index+1]:false):false;
    }
    _controllerConnectionChanged(number,connected) {
      if(!Number.isInteger(number) || number<1 || number>4 || typeof connected!=='boolean')return;
      this._setControllerConnection(number,connected);
    }
    _observeControllerInput(number,button,held) {
      if(!Number.isInteger(number) || number<1 || number>4 || !['left','up','right','down','a','b','start','select'].includes(button))return;
      const key=number+':'+button,pressed=!!held;
      if(!!this._controllerInputs[key]===pressed)return;
      this._controllerInputs[key]=pressed;
      // Original controller.Button.setPressed connects its owner before
      // dispatching either changed-state button event. Release stays connected.
      this._controllerConnectionChanged(number,true);
    }
    playerButtonPressed(args) {
      const player=this._player(args.PLAYER);if(!player)return false;
      const button=this._multiplayerButton(args.BUTTON);if(!button)throw new TypeError('Invalid multiplayer button');
      return this._heldButton(player.index+1,button);
    }
    _controlButtonId(number,button) {
      const id={left:1,up:2,right:3,down:4,a:5,b:6,start:7}[String(button).toLowerCase()];
      return id===undefined?undefined:id+(number-1)*7;
    }
    _registerControlButton(number,button,event) {
      const id=this._controlButtonId(number,button);if(id===undefined)return;
      this._controlEventBus().register(event,id,()=>{
        const pending=this._runTerrainGenerator(this._controllerButtonCallbacks(number,button,event,true,true));
        if(pending?.then)this._runtime?._arcadeFramePhase?.requestContinuation().catch(error=>this._runtime.emit('BLOCKS_ERROR',error.message));return pending;
      });
    }
    _announceControlButton(number,button,event) {
      const id=this._controlButtonId(number,button);
      if(id===undefined)return this._runTerrainGenerator(this._controllerButtonCallbacks(number,button,event,true));
      const source=this._userControllerEvents?event:({2048:2052,2049:2053,2054:2055}[event]??event);
      this._controlEventBus().raise(source,id);
    }
    *_controllerButtonCallbacks(number,button,event,deferred=false,explicitEvent=false) {
      const epoch=this._terrainEpoch;
      if(!explicitEvent && !this._userControllerEvents)return;
      const handlers=this._buttonHandlers.filter(h=>h.player===number && h.button===button && h.event===event);
      for(const handler of handlers){
        if(epoch!==this._terrainEpoch)return;
        if(handler.host){handler.host();continue;}
        // A handler fiber that died keeps its event queue locked: later events of this button never run it.
        if(handler.fiberDied)continue;
        if(yield* this._registeredCallbackSteps([handler.mp?handler.mp.registration:handler],handler.mp?'arcade_whenRegisteredMultiplayerButton':'arcade_whenRegisteredButton',handler.mp?{player:handler.playerValue}:{},undefined,deferred))handler.fiberDied=true;
      }
    }
    registerDestroyedHandler(args,util) {if(this._kindValue(args.KIND)==null)return;this._destroyedHandlers.push(this._handlerRegistration(args,util));}
    registerOverlapHandler(args,util) {const kind=this._kindValue(args.KIND),otherKind=this._kindValue(args.OTHER_KIND);if(kind==null || otherKind==null)return;this._overlapHandlers.push({...this._handlerRegistration(args,util),kind,otherKind});}
    startParallelHandler(args,util) {
      // Queue one independent fiber per call. The caller must not await it;
      // captures retain the enclosing cells, including after that call returns.
      const work=this._runTerrainGenerator(this._registeredCallbackSteps([this._handlerRegistration(args,util)],'arcade_whenParallelHandler',{},undefined,true));
      work?.catch?.(error=>this._runtime?.emit?.('BLOCKS_ERROR',error.message));
    }
    whenParallelHandler(args,util) {return this.whenRegisteredWall(args,util);}
    registerForeverHandler(args,util) {
      this._foreverHandlers.push({...this._handlerRegistration(args,util),lock:false});
      if(this._foreverTimer===undefined)this._scheduleForever(0);
    }
    // PXT game.forever: one fiber that starts each unlocked handler of the
    // current scene, then pause(20). The pause is on the program clock when
    // source timers own time; a host timer would follow wall time instead.
    _scheduleForever(delay) {
      const source=this._sourceSceneTimers(),clock=source?this._programClockEpoch:null,epoch=this._terrainEpoch;
      const timer={clear:source?clock.clearTimeout:clearTimeout};
      timer.handle=(source?clock.setTimeout:setTimeout)(()=>{
        if(this._foreverTimer!==timer)return;
        this._foreverTimer=undefined;
        if(epoch===this._terrainEpoch)this._pumpForever(source);
      },delay);
      timer.handle?.unref?.();this._foreverTimer=timer;
    }
    _pumpForever(source) {
      const epoch=this._terrainEpoch;
      if(this._terrainStopped)return;
      for(const h of this._foreverHandlers.slice())if(!h.lock){
        if(epoch!==this._terrainEpoch)return;
        h.lock=true;
        const work=this._runTerrainGenerator(this._registeredCallbackSteps([h],'arcade_whenRegisteredForever',{}));
        // PXT's h.lock = false follows h.handler() in the same fiber, so a handler that dies stays locked.
        if(work?.then)work.then(faulted=>{if(epoch===this._terrainEpoch&&faulted!==true)h.lock=false;},error=>{if(epoch!==this._terrainEpoch)return;h.lock=false;throw error;});else if(epoch===this._terrainEpoch&&work!==true)h.lock=false;
      }
      if(epoch!==this._terrainEpoch)return;
      this._scheduleForever(20);
      // A handler that waits continues in source turns, which arm its timers.
      if(source && this._sourceSceneTimers())this._runtime._arcadeFramePhase.requestContinuation()
        .catch(error=>this._runtime?.emit?.('BLOCKS_ERROR',String(error?.message || error)));
    }
    setHudVisibility(args) {
      const methods={score:'showScore',life:'showLife',countdown:'showCountdown'};
      const method=Object.prototype.hasOwnProperty.call(methods,String(args.ELEMENT))?methods[String(args.ELEMENT)]:undefined;
      if(!method){this._runtime?.emit?.('BLOCKS_ERROR','Arcade HUD element is not implemented: '+String(args.ELEMENT));return;}
      const state=this._infoState(),info=this._hud().info;
      info._setInfoState(state.hudInfo);
      info[method](Scratch.Cast.toBoolean(Scratch.BWValues.decode(args.VISIBLE)));
      this._changed();
    }
    _infoState() {
      const state=this._state();
      // PXT initHUD installs one scene renderable, which shares sprite IDs
      // even though it is not included in sprites.allOfKind().
      if(!state.infoRenderable){
        state.infoRenderable={pxtId:state.nextSpriteId++,z:100};
        if(!state.players)state.players=[];
        // PXT's InfoState; the native player state objects are its playerStates.
        state.hudInfo=this._hud().info._newInfoState();
        state.hudInfo.playerStates=state.players;
        this._addSceneRenderable(state,{z:100,id:state.infoRenderable.pxtId,drawSteps:screen=>this._drawHudSteps(state,screen)});
      }
      return state;
    }
    // PXT's head-up display (hud-pxt.js): the drawing code of game/info.ts on
    // the native player state. The renderable's conditions follow initHUD; the
    // life-zero and countdown-end events stay native.
    _hud() {
      if(this._hudModule)return this._hudModule;
      const text=this._pxtText(),ext=this;
      class HudImage {
        constructor(raw){this.raw=raw;}
        get width(){return this.raw.width;}
        get height(){return this.raw.height;}
        clone(){return new HudImage({width:this.raw.width,height:this.raw.height,pixels:this.raw.pixels.slice()});}
        replace(from,to){imageEngine.mutate(this.raw,'replace',from,to);}
        fillRect(x,y,w,h,c){imageEngine.draw(this.raw,'fillRect',x,y,w,h,c);}
        drawTransparentImage(source,x,y){imageEngine.blit(this.raw,source.raw,'drawTransparentImage',x,y);}
        drawIcon(icon,x,y,color){text.drawIcon({_width:this.raw.width,_height:this.raw.height,data:this.raw.pixels,makeWritable(){},color:c=>Number(c)&15},{data:icon},x,y,color);}
        print(value,x,y,color,font){text.helpers.imagePrint(this,String(value),x,y,color,font);}
      }
      const img=strings=>{
        const rows=String(strings.raw?strings.raw[0]:strings[0]).split(String.fromCharCode(10)).map(line=>line.replace(/[^0-9a-fA-F.]/g,'')).filter(Boolean);
        const width=Math.max(0,...rows.map(row=>row.length)),pixels=new Uint8Array(width*rows.length);
        rows.forEach((row,y)=>[...row].forEach((c,x)=>{pixels[y*width+x]=c==='.'?0:parseInt(c,16);}));
        return new HudImage({width,height:rows.length,pixels});
      };
      // The screen PXT draws into: the frame being composed.
      const screen=new HudImage({width:160,height:120,pixels:new Uint8Array(160*120)});
      Object.defineProperty(screen,'isMono',{value:false});
      Object.defineProperty(screen,'raw',{get:()=>ext._hudScreen || {width:160,height:120,pixels:new Uint8Array(160*120)}});
      const module=dependencies.initializeHud({image:{font5:text.image.font5,font8:text.image.font8},img,screen});
      this._hudModule={info:module.info,players:[1,2,3,4].map(n=>new module.info.PlayerInfo(n))};
      return this._hudModule;
    }
    _drawHud(state,screen) {return this._runTerrainGenerator(this._drawHudSteps(state,screen));}
    *_drawHudSteps(owner,screen) {
      // A previous scene render runs while the child remains current. PXT's
      // HUD closure reads that current scene's InfoState, not the parent's.
      const state=this._state();if(owner!==state && !state.hudInfo)return;
      const {info,players}=this._hud(),hud=state.hudInfo,V=info.Visibility;
      const pass={screen,epoch:this._terrainEpoch};state._hudPass=pass;
      info._setInfoState(hud);this._hudScreen=screen;
      try {
        if(hud.visibilityFlag & V.Multi)for(const player of players)player.drawPlayer();
        else {
          const player=players[0];
          if(player.impl.hasScore() && (hud.visibilityFlag & V.Score))player.drawScore();
          if(player.impl.hasLife() && (hud.visibilityFlag & V.Life))player.drawLives();
        }
        // info.ts raises life events after drawing lives and before the timer.
        // Registered callbacks can wait or change scenes; preserve that boundary.
        yield* this._lifeZeroSteps(screen);
        if(this._frameFaults.has(state))return;
        if(this._state()!==state || pass.epoch!==this._terrainEpoch || state._defaultGameOverPending)return;
        // A callback can push and restore scenes. Resume with this HUD's state.
        info._setInfoState(hud);this._hudScreen=screen;
        if(state.countdownActive && (hud.visibilityFlag & V.Countdown)){
          info._drawTimer(Math.round((Number(state.countdown) || 0)*1000));
          yield* this._countdownEndSteps(state,screen);
        }
      } finally {
        if(state._hudPass===pass)delete state._hudPass;
        if(this._hudScreen===screen)this._hudScreen=null;
      }
    }
    _lifeState(player) {
      const state=this._infoState(),index=(Number(player)||1)-1;if(index<0 || index>3)return null;
      if(index>0){state.multiplayerInfo=true;this._hud().info._setInfoState(state.hudInfo);this._hud().info._initMultiHUD();}
      if(!state.players)state.players=[];
      const PlayerState=this._hud().info.PlayerState;
      return state.players[index] || (state.players[index]=new PlayerState());
    }
    hasLife(args) {const state=this._lifeState(args.PLAYER);return !!state && state.life!==undefined && state.life!==null;}
    getPlayerScore(args) {const state=this._lifeState(args.PLAYER);if(!state)return 0;if(state.showScore===undefined)state.showScore=true;if(state.showPlayer===undefined)state.showPlayer=true;if(state.score==null)state.score=0;if((Number(args.PLAYER)||1)===1)this._state().score=state.score;return state.score;}
    hasPlayerScore(args) {const state=this._lifeState(args.PLAYER);return !!state && state.score!==undefined;}
    setPlayerScore(args,util) {return this._runTerrainGenerator(this._setPlayerScoreSteps(args,util));}
    *_setPlayerScoreSteps(args,util) {
      const epoch=this._terrainEpoch;
      const owner=this._infoState(),state=this._lifeState(args.PLAYER);if(!state)return;
      const hud=owner.hudInfo,V=this._hud().info.Visibility;
      if(!(hud.visibilityFlag & V._ExplicitlySetScore))hud.visibilityFlag|=V.Score;
      // The same score() side effects and integer assignment as PlayerInfoImpl.
      const oldScore=this.getPlayerScore(args) || 0;
      state.score=Number(args.VALUE)|0;if((Number(args.PLAYER)||1)===1)owner.score=state.score;
      this._changed();
      // PXT uses forEach: capture its initial length, but read each live row and
      // the current score AFTER every completed callback, including suspension.
      const handlers=state.scoreReachedHandlers,length=handlers.length;
      for(let index=0;index<length;index++)if(index in handlers){
        const entry=handlers[index];
        if((oldScore<entry.score && state.score>=entry.score) || (oldScore>entry.score && state.score<=entry.score)){
          const registration=scoreThresholdRegistrations.get(this).get(entry.handler);
          if(!registration)throw new Error('Arcade score handler has no current registration');
          yield* this._registeredCallbackSteps([registration],'arcade_whenRegisteredScore',{},util);
          if(epoch!==this._terrainEpoch)return;
        }
      }
    }
    changePlayerScore(args,util) {return this.setPlayerScore({PLAYER:args.PLAYER,VALUE:this.getPlayerScore(args)+Number(args.VALUE)},util);}
    registerScoreHandler(args,util) {
      const player=Number(Scratch.BWValues.decode(args.PLAYER));
      if(!Number.isInteger(player)||player<1||player>4)throw new Error('Arcade score registration requires a fixed player from 1 to 4');
      const score=this._mathArgument(args,'SCORE',util,'Arcade score threshold requires a Number');
      if(typeof score!=='number')throw new TypeError('Arcade score threshold requires a Number');
      const state=this._lifeState(player);if(!state)return;
      const registration=this._handlerRegistration(args,util);
      const handler=()=>this._runTerrainGenerator(this._registeredCallbackSteps([registration],'arcade_whenRegisteredScore',{}));
      scoreThresholdRegistrations.get(this).set(handler,registration);
      const {info,players}=this._hud();info._setInfoState(this._state().hudInfo);
      // Reuse the actual retained SDK registration/replacement algorithm.
      players[player-1].onScore(score,handler);
    }
    whenRegisteredScore(args,util) {return this.whenRegisteredWall(args,util);}
    getLife(args) {const state=this._lifeState(args.PLAYER);if(!state)return 0;if(state.showLife===undefined)state.showLife=true;if(state.showPlayer===undefined)state.showPlayer=true;if(state.life===undefined)state.life=3;return state.life || 0;}
    setLife(args) {const state=this._lifeState(args.PLAYER);if(state){const hud=this._state().hudInfo,V=this._hud().info.Visibility;if(!(hud.visibilityFlag & V._ExplicitlySetLife))hud.visibilityFlag|=V.Life;if(state.showLife===undefined)state.showLife=true;if(state.showPlayer===undefined)state.showPlayer=true;state.life=Number(args.VALUE)|0;this._changed();}}
    changeLife(args) {this.setLife({PLAYER:args.PLAYER,VALUE:this.getLife(args)+Number(args.VALUE)});}
    registerLifeZeroHandler(args,util) {const state=this._lifeState(args.PLAYER);if(state)state.lifeZero=this._handlerRegistration(args,util);}
    whenRegisteredLifeZero(args,util) {return this.whenRegisteredWall(args,util);}
    *_lifeZeroSteps(screen) {
      const owner=this._state(),epoch=this._terrainEpoch;
      for(const state of owner.players || [])if(state && state.life!==undefined && state.life!==null && state.life<=0){
        state.life=null;
        // The callback runs inside the HUD renderable, so an uncaught exception ends the frame fiber (PXT info.ts).
        if(state.lifeZero){if(yield* this._registeredCallbackSteps([state.lifeZero],'arcade_whenRegisteredLifeZero',{}))return this._faultFrameLoop(owner);}
        else if(!owner.multiplayerInfo)this._defaultInfoGameOver(owner,screen.pixels.slice());
        if(this._state()!==owner || epoch!==this._terrainEpoch || owner._defaultGameOverPending)return;
      }
    }
    registerCountdownHandler(args,util) {this._infoState();this._countdownHandlers=[this._handlerRegistration(args,util)];}
    whenRegisteredForever(args,util) {return this.whenRegisteredWall(args,util);}
    whenRegisteredCountdown(args,util) {return this.whenRegisteredWall(args,util);}
    registerScenePushHandler(args,util) {this._scenePushHandlers.push(this._handlerRegistration(args,util));}
    registerScenePopHandler(args,util) {this._scenePopHandlers.push(this._handlerRegistration(args,util));}
    whenRegisteredUpdate(args,util) {return this.whenRegisteredWall(args,util);}
    whenRegisteredInterval(args,util) {return this.whenRegisteredWall(args,util);}
    whenRegisteredMultiplayerButton(args,util) {return this.whenRegisteredWall(args,util);}
    whenRegisteredButton(args,util) {return this.whenRegisteredWall(args,util);}
    whenRegisteredKindDestroyed(args,util) {return this.whenRegisteredWall(args,util);}
    whenRegisteredOverlap(args,util) {
      const event=util?.thread?.bwArcadeEvent,a=this._spriteValues.get(event?.first),b=this._spriteValues.get(event?.second);
      return this.whenRegisteredWall(args,util) && !!a && !!b && !a._destroyed && !b._destroyed &&
        !((a.flags|b.flags)&(spriteFlags.GhostThroughSprites|spriteFlags.RelativeToCamera));
    }
    whenRegisteredScenePush(args,util) {return this.whenRegisteredWall(args,util);}
    whenRegisteredScenePop(args,util) {return this.whenRegisteredWall(args,util);}
    // Returns true when a callback fiber died with an uncaught exception (PXT:
    // the fiber ends and whatever waited on its completion never resumes).
    *_registeredCallbackSteps(registrations,opcode,event,util,deferred=false) {
      const runtime=this._runtime,epoch=this._terrainEpoch;if(!runtime?.allScriptsByOpcodeDo || !runtime?._pushThread)return false;
      let faulted=false;
      // Scene transitions do not cancel callback fibers already running.
      for(const registration of registrations){
        if(epoch!==this._terrainEpoch || this._terrainStopped)return faulted;
        if(registration.host){yield registration.host();if(epoch!==this._terrainEpoch || this._terrainStopped)return faulted;continue;}
        const scripts=[];
        runtime.allScriptsByOpcodeDo(opcode,(script,target)=>{
          const hat=target.blocks.getBlock(script.blockId),token=target.blocks.getBlock(hat.inputs?.TOKEN?.block);
          if(token?.fields?.TEXT?.value===registration.token)scripts.push({script,target});
        });
        for(const {script,target} of scripts){
          if(epoch!==this._terrainEpoch || this._terrainStopped)return faulted;
          const thread=runtime._pushThread(script.blockId,target);thread.bwArcadeEvent={...event,TOKEN:registration.token};thread.bwArcadeCaptures=registration.captures;
          const caller=util?.thread,active=runtime.sequencer.activeThread,exceptions=exceptionOwners.get(this);
          let structuredInvocation=null;
          try{exceptionOwners.get(this).bindStructuredRegistration(registration,thread);}
          catch(error){runtime.sequencer.retireThread(thread);throw error;}
          try{
            try{if(!deferred){runtime.sequencer.activeThread=thread;
              structuredInvocation=exceptions.beginStructuredInvocation?.(thread);
              dependencies.primitiveOwner.stepChild(runtime,thread,()=>runtime.sequencer.stepThread(thread));}}
            finally{if(util){util.thread=caller;util.sequencer=runtime.sequencer;}runtime.sequencer.activeThread=active;}
            if(thread.status!==thread.constructor.STATUS_DONE && !thread.isKilled && runtime.threads.includes(thread)){
              const suspension=structuredInvocation&&exceptions.suspendStructuredInvocation(structuredInvocation);
              try{yield new Promise(resolve=>this._terrainWaits.add({thread,resolve}));}
              finally{if(suspension)exceptions.resumeStructuredInvocation(structuredInvocation,suspension);}
            }
            if(epoch!==this._terrainEpoch || this._terrainStopped)return faulted;
            if(exceptionOwners.get(this).failure(thread))faulted=true;
          }finally{if(structuredInvocation)exceptions.closeStructuredInvocation(structuredInvocation);}
        }
      }
      return faulted;
    }
    _keyboardButtonEdge(key,isDown) {
      const button={'space':'a','Z':'b','enter':'start','M':'select','left arrow':'left','up arrow':'up','right arrow':'right','down arrow':'down'}[String(key)];
      if(!button)return;
      this._controllerButtonEdge(1,button,isDown);
    }
    _repeatButton(args) {
      const player=Number(args.PLAYER),button=String(args.BUTTON);
      if(!Number.isInteger(player)||player<1||player>4||!['A','B','up','down','left','right'].includes(button))throw new TypeError('Controller repeat requires a fixed player and button');
      const key=player+':'+button.toLowerCase();
      return this._buttonStates[key] || (this._buttonStates[key]={held:false,elapsed:0,count:0});
    }
    buttonRepeatProperty(args) {
      if(!['repeatDelay','repeatInterval'].includes(args.PROPERTY))throw new TypeError('Unknown controller repeat property');
      return Scratch.BWValues.encode(this._repeatButton(args)[args.PROPERTY]);
    }
    setButtonRepeatProperty(args,util) {
      if(!['repeatDelay','repeatInterval'].includes(args.PROPERTY))throw new TypeError('Unknown controller repeat property');
      this._repeatButton(args)[args.PROPERTY]=this._mathArgument(args,'VALUE',util,'Controller repeat property requires a primitive value');
    }
    setButtonRepeatDefaults(args,util) {
      const delay=this._mathArgument(args,'DELAY',util,'Controller repeat default requires a primitive value');
      const interval=this._mathArgument(args,'INTERVAL',util,'Controller repeat default requires a primitive value');
      this._repeatDefaults={delay,interval};
    }
    _controllerButtonEdge(number,button,isDown) {
      if(!Number.isInteger(number) || number<1 || number>4)return;
      // The text-entry screen owns player 1's buttons. The system keyboard
      // disables button events altogether; the on-screen keyboard reads
      // key-down edges.
      const prompting=this._textPromptUi;
      if(prompting && number===1 && prompting.owner===this._state()){
        if(!prompting.prompt.useSystemKeyboard){
          const current=this._buttonStates['1:'+button] || (this._buttonStates['1:'+button]={held:false,elapsed:0,count:0});
          this._state().buttons[button]=!!isDown;
          if(!!isDown!==current.held){current.held=!!isDown;current.elapsed=0;current.count=0;if(isDown)prompting.onButton(button);}
        }
        return;
      }
      const state=this._state(),buttons=number===1?state.buttons:state.controllerButtons[number] || (state.controllerButtons[number]={});buttons[button]=!!isDown;
      this._observeControllerInput(number,button,isDown);
      const key=number+':'+button,current=this._buttonStates[key] || (this._buttonStates[key]={held:false,elapsed:0,count:0});
      const held=!!isDown;if(current.held===held)return;
      current.held=held;current.elapsed=0;current.count=0;
      if(held)this._buttonPressed();
      if(this._dialogs?.[0]?.type==='ask'){if(number===1)this._questionButtonEdge(button,held);return;}
      if(this._terrainStopped)return;
      const pending=this._announceControlButton(number,button,held?2049:2048);
      pending?.catch?.(error=>this._runtime?.emit?.('BLOCKS_ERROR',error.message));
      // The real edge already registered a ready user callback. Dispatch it
      // as a source continuation at this program time, without a scene frame.
      if(pending?.then && this._runtime?._arcadeFramePhase?.hasSourceProject()){
        this._runtime._arcadeFramePhase.requestContinuation().catch(error=>this._runtime.emit('BLOCKS_ERROR',error.message));
      }
    }
    *_sceneButtons(dt) {
      const state=this._state();
      for(let number=1;number<=4;number++)for(const button of ['left','up','right','down','a','b','start','select']){
        const held=this._heldButton(number,button),key=number+':'+button;
        this._observeControllerInput(number,button,held);
        const current=this._buttonStates[key] || (this._buttonStates[key]={held:false,elapsed:0,count:0});
        let event;
        if(held!==current.held){current.held=held;current.elapsed=0;current.count=0;event=held?2049:2048;if(held)this._buttonPressed();}
        else if(held){
          // Selected MIT game/controllerbutton.ts __update: undefined alone
          // selects defaults; zero, NaN and other primitive operands stay raw.
          current.elapsed+=(dt*1000)|0;
          const delay=current.repeatDelay===undefined?this._repeatDefaults.delay:current.repeatDelay;
          const interval=current.repeatInterval===undefined?this._repeatDefaults.interval:current.repeatInterval;
          if(!(current.elapsed<delay)){const count=Math.floor((current.elapsed-delay-interval)/interval);if(count!==current.count){current.count=count;event=2054;}}
        }
        if(event!==undefined){const pending=this._announceControlButton(number,button,event);if(pending?.then)yield pending;}
        if(this._state()!==state)return;
      }
    }
    // PXT runs every frame callback of a scene's event context in one fiber
    // (control.EventContext.registerFrameCallbacks). An uncaught exception in
    // any of them (controller, intervals, updates, paint, shade) ends that
    // fiber: the scene's physics, timers and screen stop for good, even when
    // the scene is later restored. Button, forever and overlap fibers are other
    // fibers and keep running. Returns true so callers end the frame.
    _faultFrameLoop(state) {
      this._frameFaults.add(state);this._sceneFrameHost?.kill(state);return true;
    }
    *_sceneUpdates() {
      const state=this._state();
      for(const h of this._intervalHandlers.slice())if(h.timer<=(state.elapsedMs || 0)){
        h.timer=(state.elapsedMs || 0)+h.interval;
        if(yield* this._registeredCallbackSteps([h],'arcade_whenRegisteredInterval',{}))return this._faultFrameLoop(state);
        if(this._state()!==state)return;
      }
      // PXT iterates its frame callbacks live: a handler registered during
      // this frame's updates runs later in the same frame. Extension
      // game.onUpdate callbacks keep their registration order among them.
      const updates=this._updateHandlers;
      for(let i=0;i<updates.length;i++){
        if(updates[i].host)updates[i].host();
        else if(yield* this._registeredCallbackSteps([updates[i]],'arcade_whenRegisteredUpdate',{}))return this._faultFrameLoop(state);
        if(this._state()!==state)return;
      }
      // PXT particles.init registers game.onUpdate and onUpdateInterval(250)
      // when the first source of a scene is created: after earlier handlers.
      const particles=this._particleScenes.get(state);
      if(particles){
        for(const h of particles.intervals.slice())if(h.timer<=(state.elapsedMs || 0)){h.timer=(state.elapsedMs || 0)+h.period;h.fn();}
        particles.update?.();
      }
    }
    setGameStats(args) {
      const mode=Scratch.BWValues.decode(args.MODE);
      if(mode!=='enabled' && mode!=='disabled')return this._objectError(new TypeError('Arcade game stats requires a fixed enabled or disabled mode'));
      this._gameStats.setEnabled(mode==='enabled');
    }
    _drawGameStats(state) {
      this._gameStats.ensure(state);
      if(this._gameStats.enabled)this._gameStats.draw(state,this._sceneSpriteObjects(state).length);
    }
    _changed() {
      if (this._runtime && this._runtime.emit) this._runtime.emit('ARCADE_DEVICE_CHANGED', this._state());
      if (this._runtime && this._runtime.requestRedraw) this._runtime.requestRedraw();
    }

    _bounds() {
      const device = String((this._runtime && (this._runtime.bwDeviceId || (this._runtime.stc && this._runtime.stc.device))) || 'arcade');
      return device === 'microbit' ? {x: 4, y: 4} : {x: 159, y: 119};
    }

    _sprite(name) {return this._state().sprites[String(name)] || null;}
    _clamp(value, max) { return Math.max(0, Math.min(max, Number(value) || 0)); }

    whenButton(args) { return this.buttonPressed(args); }
    buttonPressed(args) { return Boolean(this._state().buttons[String(args.BUTTON).toLowerCase()]); }
    controllerStep(args) {
      const buttons = this._state().buttons;
      const keyboard = this._runtime?.ioDevices?.keyboard;
      const held = name => Boolean(buttons[name] || keyboard?.getKeyIsDown?.(name + ' arrow'));
      const axis = String(args.AXIS).toLowerCase();
      const negative = axis === 'y' ? 'up' : 'left';
      const positive = axis === 'y' ? 'down' : 'right';
      // PXT controller.dx/dy: direction * step * the frame's actual delta time (seconds).
      return (Number(held(positive)) - Number(held(negative))) * (Number(args.STEP) || 0) * (Number(this._state().frameDeltaTime) || 0);
    }
    _mathArgument(args,key,util,errorMessage='Arcade math needs a primitive value') {
      const value=Scratch.BWValues.decode(args[key]);
      const block=util?.target?.blocks?.getBlock(util.thread?.peekStack?.());
      const input=block?.inputs?.[key];
      const shadow=input && input.block===input.shadow && util?.target?.blocks?.getBlock(input.shadow);
      // Numeric editor shadows carry text; connected primitive reporters do not.
      if (typeof value==='string' && shadow && ['math_number','math_integer','math_whole_number','math_positive_number','math_angle'].includes(shadow.opcode)) return Number(value);
      if (value!==null && typeof value==='object') throw new TypeError(errorMessage);
      return value;
    }
    randomNumber() {return Math.random();}
    mathBinary(args,util) {
      const a=this._mathArgument(args,'A',util),b=this._mathArgument(args,'B',util);
      const operation=String(args.OP);
      let value;
      if (operation==='min') value=a<=b?a:b;
      else if (operation==='max') value=a>=b?a:b;
      else if (operation==='randomRange') value=this._randomRange(a,b);
      else if (operation==='atan2') value=Math.atan2(a,b);
      else throw new TypeError('Arcade math operation is not implemented: '+operation);
      return Scratch.BWValues.encode(value);
    }
    _randomRange(min,max) {
      // PXT simulator Math_.randomRange (MIT), Copyright (c) Microsoft Corporation.
      // See scratch-gui/static/licenses/pxt-core.MIT.txt and
      // https://github.com/microsoft/pxt/blob/v13.2.1/pxtsim/langsupport.ts
      // Preserve its equality guard,
      // numeric integer test, bound swapping, and one platform entropy draw.
      if (min==max) return min;
      if (min>max) {const swap=min;min=max;max=swap;}
      return Math.floor(min)==min && Math.floor(max)==max
        ? min+Math.floor(Math.random()*(max-min+1)) : min+Math.random()*(max-min);
    }
    clampNumber(args,util) {
      // MIT PXT pxt-helpers.ts, Copyright (c) Microsoft Corporation;
      // retained notice scratch-gui/static/licenses/pxt-core.MIT.txt.
      // SDK argument order and raw argument selection are observable.
      const minimum=this._mathArgument(args,'MIN',util);
      const maximum=this._mathArgument(args,'MAX',util);
      const value=this._mathArgument(args,'VALUE',util);
      const inner=minimum>=value?minimum:value;
      return Scratch.BWValues.encode(maximum<=inner?maximum:inner);
    }
    percentChance(args,util) {
      const percentage=this._mathArgument(args,'PERCENTAGE',util);
      if (percentage>=100) return true;
      if (percentage<=0) return false;
      return this._randomRange(0,99)<percentage;
    }
    truncateNumber(args) {return Math.trunc(Number(Scratch.BWValues.decode(args.NUM)));}
    // truncate and sign of a number: the two former single-purpose reporters, run unchanged.
    mathUnary(args) {
      const operation=String(args.OP);
      if(operation==='truncate')return this.truncateNumber(args);
      if(operation==='sign')return this.signNumber(args);
      throw new TypeError('Arcade math operation is not implemented: '+operation);
    }
    signNumber(args) {
      const value=Number(Scratch.BWValues.decode(args.NUM));
      // PXT Math.sign deliberately returns +0 for -0 and -1 for NaN.
      return value===0 ? 0 : value>0 ? 1 : -1;
    }
    controlSprite(args) {this._controlSprite(1,args.ID,args.VX,args.VY);}
    _controllerNumber(value) {
      const number=Number(value);
      if(!Number.isInteger(number) || number<1 || number>4)throw new Error('Arcade controller must be 1, 2, 3 or 4');
      return number;
    }
    controlSpriteByController(args) {this._controlSprite(this._controllerNumber(args.CONTROLLER),args.ID,args.VX,args.VY);}
    stopControllingSprite(args) {this._stopControllingSprite(this._controllerNumber(args.CONTROLLER),args.ID);}
    _controlSprite(number,id,vx=100,vy=100) {
      const sprite=this._sprite(id);if(!sprite)return;
      const state=this._state();
      const controllers=state.controlledSprites || (state.controlledSprites={});
      const bindings=controllers[number] || (controllers[number]=[]);
      let control=bindings.find(binding=>binding.sprite===sprite);
      if(!control){control={inputLastFrame:false};Object.defineProperty(control,'sprite',{value:sprite});bindings.push(control);}
      vx=Scratch.BWValues.decode(vx);vy=Scratch.BWValues.decode(vy);
      vx=vx===undefined?100:Number(vx)||0;vy=vy===undefined?100:Number(vy)||0;
      if(control.vx && !vx)sprite.vx=0;
      if(control.vy && !vy)sprite.vy=0;
      control.vx=vx;control.vy=vy;
      // Retain the legacy controller-one inspection surface.
      if(number===1)sprite.controller=control;
    }
    _stopControllingSprite(number,id) {
      const sprite=this._sprite(id),controllers=this._state().controlledSprites;
      if(!sprite || !controllers?.[number])return;
      controllers[number]=controllers[number].filter(binding=>binding.sprite!==sprite);
      if(number===1)delete sprite.controller;
      // PXT detaches the binding without changing the sprite's velocity.
    }
    followSprite(args) {
      const self=this._spriteValues.get(String(Scratch.BWValues.decode(args.ID)));
      const targetValue=Scratch.BWValues.decode(args.TARGET);
      const target=targetValue==null || targetValue===''?null:this._spriteValues.get(String(targetValue));
      if(!self || !target && targetValue!=null && targetValue!==''){
        this._runtime?.emit?.('BLOCKS_ERROR','Arcade following requires sprite references from this project.');return;
      }
      if(self===target)return;
      const state=this._state();
      // PXT follow times its turn-rate clamp with game.runtime(): the scene's own clock.
      if(!state.followingSprites){state.followingSprites=[];state.followLastTime=state.elapsedMs || 0;}
      const speed=Scratch.BWValues.decode(args.SPEED),turn=Scratch.BWValues.decode(args.TURN);
      const rate=Number(speed===undefined?100:speed),turnRate=Number(turn===undefined?400:turn);
      const binding=state.followingSprites.find(entry=>entry.self===self);
      if(!target || !rate){
        if(binding){state.followingSprites=state.followingSprites.filter(entry=>entry!==binding);self.vx=0;self.vy=0;}
      }else if(binding){binding.target=target;binding.rate=rate;binding.turnRate=turnRate;}
      else {
        const entry={rate,turnRate};
        Object.defineProperties(entry,{self:{value:self},target:{value:target,writable:true}});
        state.followingSprites.push(entry);
      }
      this._changed();
    }
    unfollowSprite(args) {this.followSprite({ID:args.ID,TARGET:Scratch.BWValues.encode(null),SPEED:0,TURN:400});}
    _moveFollowingSprites() {return this._runTerrainGenerator(this._moveFollowingSpriteSteps());}
    *_moveFollowingSpriteSteps() {
      const state=this._state(),epoch=this._terrainEpoch,now=state.elapsedMs || 0;
      if(!state.followingSprites)return;
      const dt=(now-state.followLastTime)/1000;
      for(const {self,target,rate,turnRate} of state.followingSprites){
        if(self._destroyed || self._destroying || target._destroyed || target._destroying){self.vx=0;self.vy=0;continue;}
        const dx=target.x-self.x,dy=target.y-self.y;
        if(Math.abs(dx)<2 && Math.abs(dy)<2){
          // Sprite.x/y setters in PXT use physics.moveSprite, in this order.
          const x=((target.x-self.width/2)*256)|0;
          yield* this._moveSpriteExplicitSteps(self,(x-self._fx)|0,0);
          if(epoch!==this._terrainEpoch || this._state()!==state)return;
          const y=((target.y-self.height/2)*256)|0;
          yield* this._moveSpriteExplicitSteps(self,0,(y-self._fy)|0);
          if(epoch!==this._terrainEpoch || this._state()!==state)return;
          self.vx=0;self.vy=0;continue;
        }
        const limit=dt*turnRate*(rate/50),angle=Math.atan2(dy,dx);
        // PXT sprite.ts: independently clamp each velocity delta; retain the
        // fixed-point setters and controller-before-follow-before-physics order.
        self.vx+=Math.min(limit,Math.max(-limit,Math.cos(angle)*rate-self.vx));
        self.vy+=Math.min(limit,Math.max(-limit,Math.sin(angle)*rate-self.vy));
      }
      state.followLastTime=now;
      state.followingSprites=state.followingSprites.filter(({self,target})=>!self._destroyed && !self._destroying && !target._destroyed && !target._destroying);
    }
    _moveControlledSprites(live) {
      const state=this._state(),keyboard=this._runtime?.ioDevices?.keyboard;
      const liveSet=new Set(live);
      for(const number of Object.keys(state.controlledSprites || {}).map(Number).sort((a,b)=>a-b)){
        const buttons=number===1?state.buttons:(state.controllerButtons?.[number] || {});
        const held=name=>Boolean(buttons[name] || (number===1 && keyboard?.getKeyIsDown?.(name+' arrow')));
        const x=(Number(held('right'))-Number(held('left')))*256;
        const y=(Number(held('down'))-Number(held('up')))*256;
        const square=x*x+y*y,scale=square>65536?Math.sqrt(65536/square):1;
        const normalizedX=Math.trunc(x*scale),normalizedY=Math.trunc(y*scale);
        state.controlledSprites[number]=state.controlledSprites[number].filter(control=>liveSet.has(control.sprite) && !control.sprite._destroying);
        for(const control of state.controlledSprites[number]){
          const sprite=control.sprite;
          if(control.inputLastFrame){if(control.vx)sprite.vx=0;if(control.vy)sprite.vy=0;}
          if(x || y){
            const both=control.vx && control.vy;
            if(control.vx)sprite.vx=Math.trunc((both?normalizedX:x)*control.vx)/256;
            if(control.vy)sprite.vy=Math.trunc((both?normalizedY:y)*control.vy)/256;
            control.inputLastFrame=true;
          }else control.inputLastFrame=false;
        }
      }
    }
    _constraintDefinitions() {
      const target=this._runtime?.getEditingTarget?.() || this._runtime?.targets?.find(target=>!target.isStage);
      return Object.values(target?.blocks?._blocks || {}).filter(block=>block?.opcode==='procedures_prototype' && block.mutation);
    }
    _constraintProcedures() {const values=[...new Set(this._constraintDefinitions().map(block=>block.mutation.proccode))];return values.length?values:[''];}
    _constraintParameters() {
      const values=new Set();for(const block of this._constraintDefinitions()) {
        try {for(const name of JSON.parse(block.mutation.argumentnames))values.add(String(name));}catch {}
      }
      return values.size?[...values]:[''];
    }
    declareParameterConstraint(args,util) {return procedureOwners.get(this).declare(args,util);}
    // Internal disabled control body; getInfo and the parser do not register it.
    structuredJump(args,util) {if(!exceptionOwners.get(this).jumpStructured(args,util))throw new Error('Structured jump requires its actual owned entry');}
    structuredTry(args,util) {if(!exceptionOwners.get(this).startStructuredHandler(args,util))throw new Error('Structured try requires its actual owned entry');}
    throwValue(args,util) {return exceptionOwners.get(this).raise(args,util);}
    _objectError(error) {
      exceptionOwners.get(this).rethrow(error);
      this._runtime?.emit?.('BLOCKS_ERROR',error);return Scratch.BWValues.UNDEFINED;
    }
    declareClass(args) {
      try {this._objectHeap.register({name:String(args.NAME),fields:JSON.parse(String(args.FIELDS)),initializer:String(args.INITIALIZER),constructor:String(args.CONSTRUCTOR),parameters:JSON.parse(String(args.PARAMETERS)),methods:JSON.parse(String(args.METHODS))});}
      catch(error){return this._objectError(error);}
    }
    declareSubclass(args) {
      try {this._objectHeap.register({name:String(args.NAME),parent:String(args.BASE),fields:JSON.parse(String(args.FIELDS)),initializer:String(args.INITIALIZER),constructor:String(args.CONSTRUCTOR),parameters:JSON.parse(String(args.PARAMETERS)),methods:JSON.parse(String(args.METHODS))});}
      catch(error){return this._objectError(error);}
    }
    _objectProcedure(name,values,util,token,exceptionCaller=null) {
      const target=util?.target || util?.thread?.target;
      if(util?.thread && (util.thread.isKilled || !this._runtime.threads.includes(util.thread))){const error=new Error('Class construction or method invocation was cancelled');error.bwObjectCancelled=true;throw error;}
      if(ownedSpriteBridges.get(this)?.matches(name))return ownedSpriteBridges.get(this).invoke(name,values,util);
      if(this._sdkObjectClasses.matches(name))return this._sdkObjectClasses.invoke(name,values,util,token);
      if(!target?.blocks?.getProcedureDefinition(name))throw new Error('Class procedure is not defined: '+name);
      // Dispatch through the real managed-call queue. Its source phase owns
      // runnable eligibility; a Promise continuation must not synchronously
      // re-enter execute's shared BlockUtility with a different caller.
      const args={NAME:name,ARGS:JSON.stringify(values,Scratch.BWValues.jsonReplacer),bwObjectConstruction:token,bwExceptionCaller:exceptionCaller};
      const callUtil={thread:util?.thread,target,sequencer:null};
      spriteUpdateHosts.get(this).prepareCall(name,values,util,args,callUtil);
      return this.callFunction(args,callUtil);
    }
    createObject(args,util) {
      // BlockUtility is reused by the sequencer. Promise continuations retain
      // the actual calling thread, not whichever thread last used that utility.
      const originalUtil=util;
      let exceptionCaller;
      util={thread:util?.thread,target:util?.target || util?.thread?.target,sequencer:util?.sequencer,bwObjectUtility:util};
      let allocation;
      try {
        exceptionCaller=exceptionOwners.get(this).captureCaller(args,originalUtil);
        const argsText=String(args.ARGS),rawValues=JSON.parse(argsText);
        if(!Array.isArray(rawValues))throw new Error('Class constructor arguments must be an ordered argument list');
        rawValues.forEach(value=>this._objectHeap.validateTransport(value));
        const className=String(args.CLASS);
        classCallableHosts.get(this)?.validateConstructor(this._objectHeap.definition(className),rawValues,util.target);
        let values=JSON.parse(argsText,(_key,value)=>Scratch.BWValues.encode(Scratch.BWValues.decode(value)));
        values=values.map(value=>this._objectHeap.hold(value));
        allocation=this._objectHeap.allocate(className);
        const {ref,def,token}=allocation;
        if(values.length>def.parameters.length)throw new Error('Class constructor has too many arguments');
        while(values.length<def.parameters.length){const param=def.parameters[values.length];values.push(Object.prototype.hasOwnProperty.call(param,'default')?Scratch.BWValues.encode(param.default):Scratch.BWValues.UNDEFINED);}
        const invokeConstructor=()=>{if(!this._objectHeap.constructionActive(ref,token)){const error=new Error('Class construction was cancelled by project replacement');error.bwObjectCancelled=true;throw error;}return def.constructor?this._objectProcedure(def.constructor,[ref,...values],util,token,exceptionCaller):undefined;};
        const finish=()=>{exceptionOwners.get(this).releaseCaller(exceptionCaller);if(util?.thread && (util.thread.isKilled || !this._runtime.threads.includes(util.thread))){this._objectHeap.abort(ref,token);return Scratch.BWValues.UNDEFINED;}return this._objectHeap.finish(ref,token);};
        const failed=error=>{exceptionOwners.get(this).releaseCaller(exceptionCaller);this._objectHeap.abort(ref,token);exceptionOwners.get(this).rethrow(error);return error.bwObjectCancelled || util?.thread && (util.thread.isKilled || !this._runtime.threads.includes(util.thread))?Scratch.BWValues.UNDEFINED:this._objectError(error);};
        const initial=def.initializer?this._objectProcedure(def.initializer,[ref],util,token,exceptionCaller):undefined;
        if(initial && typeof initial.then==='function')return initial.then(invokeConstructor).then(finish).catch(failed);
        const body=invokeConstructor();
        if(body && typeof body.then==='function')return body.then(finish).catch(failed);
        return finish();
      }catch(error){exceptionOwners.get(this).releaseCaller(exceptionCaller);if(allocation)this._objectHeap.abort(allocation.ref,allocation.token);return this._objectError(error);}
    }
    objectField(args,util) {
      try{const field=this._objectHeap.property(args.OBJECT,String(args.FIELD));
        if(field.getter || field.setter){if(!field.getter)throw new Error('Class accessor has no getter');return this._objectProcedure(field.getter,[args.OBJECT],util,util?.thread?.bwObjectConstruction);}
        const value=this._objectHeap.get(args.OBJECT,String(args.FIELD));
        classCallableHosts.get(this)?.observeObjectField(args,util,value);return value;}catch(error){return this._objectError(error);}
    }
    setObjectField(args,util) {
      try{const field=this._objectHeap.property(args.OBJECT,String(args.FIELD));
        const value=dependencies.currentNumberInput(this._runtime,args,util,'arcade_setObjectField');
        if(field.getter || field.setter){if(!field.setter)throw new Error('Class accessor has no setter');return this._objectProcedure(field.setter.procedure,[args.OBJECT,this._objectHeap.hold(value)],util,util?.thread?.bwObjectConstruction);}
        return this._objectHeap.set(args.OBJECT,String(args.FIELD),value,util?.thread?.bwObjectConstruction,util);}catch(error){return this._objectError(error);}
    }
    callObjectMethod(args,util) {
      try {
        const method=this._objectHeap.method(args.OBJECT,String(args.METHOD));
        const argsText=String(args.ARGS),rawValues=JSON.parse(argsText);
        if(!Array.isArray(rawValues))throw new Error('Class method arguments must be an ordered argument list');
        rawValues.forEach(value=>this._objectHeap.validateTransport(value));
        classCallableHosts.get(this)?.validateMethodInputs(method,rawValues);
        let values=JSON.parse(argsText,(_key,value)=>Scratch.BWValues.encode(Scratch.BWValues.decode(value)));
        if(!Array.isArray(values))throw new Error('Class method arguments must be an ordered argument list');
        if(values.length>method.parameters.length)throw new Error('Class method has too many arguments');
        while(values.length<method.parameters.length){const param=method.parameters[values.length];values.push(Object.prototype.hasOwnProperty.call(param,'default')?Scratch.BWValues.encode(param.default):Scratch.BWValues.UNDEFINED);}
        return this._objectProcedure(method.procedure,[args.OBJECT,...values.map(value=>this._objectHeap.hold(value))],util,util?.thread?.bwObjectConstruction);
      }catch(error){return this._objectError(error);}
    }
    functionArgument(args,util) {
      let rest;try {rest = JSON.parse(String(args.REST));} catch {rest = [];}
      return JSON.stringify([dependencies.currentNumberInput(this._runtime,args,util,'arcade_functionArgument'), ...(Array.isArray(rest) ? rest : [])], Scratch.BWValues.jsonReplacer);
    }
    _pumpFunctionCalls() {
      for (const call of this._functionCalls) {
        const transfer=exceptionOwners.get(this).takeManagedTransfer(call.thread,call.caller);
        if(transfer){this._functionCalls.delete(call);call.reject(transfer);continue;}
        const failure=exceptionOwners.get(this).failure(call.thread) || exceptionOwners.get(this).failure(call.caller);
        if(failure){this._functionCalls.delete(call);call.unlink?.();call.reject(failure);continue;}
        if (call.caller && (call.caller.status === call.caller.constructor.STATUS_DONE || call.caller.isKilled || !this._runtime.threads.includes(call.caller))) {
          this._functionCalls.delete(call);call.unlink?.();this._runtime.sequencer.retireThread(call.thread);if(call.cancel)call.cancel();else call.resolve(0);continue;
        }
        if (call.thread.stack.length === 1 || call.thread.status === call.thread.constructor.STATUS_DONE || call.thread.isKilled ||
            !this._runtime.threads.includes(call.thread)) {
          this._functionCalls.delete(call);call.unlink?.();this._runtime.sequencer.retireThread(call.thread);call.resolve(Scratch.BWValues.encode(call.thread.bwReturnValue));
        }
      }
    }
    callFunction(args, util) {
      const runtime = this._runtime, target = util?.target || util?.thread?.target;
      const name = String(args.NAME);
      if(this._sdkObjectClasses.matches(name)) {try {const values=JSON.parse(String(args.ARGS),(_key,value)=>Scratch.BWValues.encode(Scratch.BWValues.decode(value)));if(!Array.isArray(values))throw new Error('SDK Sprite call requires ordered arguments');const owner=dependencies.primitiveOwner,sequencer=this._runtime.sequencer,nested=owner.current(util,args)?thread=>{if(owner.current(util,args))return owner.stepNested(util,args,thread);sequencer.activeThread=thread;return sequencer.stepThread(thread);}:null;const exceptionOwner=exceptionOwners.get(this),captured=Object.hasOwn(args,'bwExceptionCaller')?null:(()=>{try{return exceptionOwner.captureCaller(args,util,'arcade_callFunction');}catch{return null;}})(),caller=captured||args.bwExceptionCaller||null,release=()=>exceptionOwner.releaseCaller(captured);let result;try{result=this._sdkObjectClasses.invoke(name,values,util,args.bwObjectConstruction || util?.thread?.bwObjectConstruction,nested,caller);}catch(error){release();throw error;}if(result&&typeof result.then==='function')return result.finally(release);release();return result;}catch(error){return this._objectError(error);}}
      let constraintRecord;
      try {constraintRecord=procedureOwners.get(this).prepare(target).procedures.get(name);}
      catch(error){return exceptionOwners.get(this).rejectConstraint(args,util,error);}
      const definition = target?.blocks?.getProcedureDefinition(name);
      if (!definition || !runtime?._pushThread) {
        if(constraintRecord)return exceptionOwners.get(this).rejectConstraint(args,util,new Error('Procedure parameter constraint: actual procedure execution entry is missing'));
        return 0;
      }
      if(constraintRecord && definition!==constraintRecord.definitionId)
        return exceptionOwners.get(this).rejectConstraint(args,util,new Error('Procedure parameter constraint: actual procedure definition differs'));
      let values,rawValues;try {const argsText=String(args.ARGS);rawValues=JSON.parse(argsText);values = JSON.parse(argsText, (_key,value)=>
        Scratch.BWValues.encode(Scratch.BWValues.decode(value)));} catch(error) {
        if(constraintRecord)return exceptionOwners.get(this).rejectConstraint(args,util,new Error('Procedure parameter constraint: malformed argument transport',{cause:error}));
        return 0;
      }
      if (!Array.isArray(values)) {
        if(constraintRecord)return exceptionOwners.get(this).rejectConstraint(args,util,new Error('Procedure parameter constraint: ordered argument array required'));
        return 0;
      }
      try {rawValues.forEach(value=>this._objectHeap.validateTransport(value));}catch(error){
        if(constraintRecord)return exceptionOwners.get(this).rejectConstraint(args,util,error);
        return this._objectError(error);
      }
      let checkedEntry;
      try {checkedEntry=procedureOwners.get(this).managedEntry(target,name,values,rawValues,util,args);}
      catch(error){return exceptionOwners.get(this).rejectConstraint(args,util,error);}
      if(checkedEntry)values=checkedEntry;
      const signature=target.blocks.getProcedureParamNamesIdsAndDefaults(name);
      if(constraintRecord && (!Array.isArray(signature) || signature.length!==3 ||
        [constraintRecord.names,constraintRecord.ids,constraintRecord.defaults].some((expected,index)=>JSON.stringify(signature[index])!==JSON.stringify(expected))))
        return exceptionOwners.get(this).rejectConstraint(args,util,new Error('Procedure parameter constraint: actual procedure parameter mapping differs'));
      const [names, , defaults] = signature;
      const thread = runtime._pushThread(definition, target);
      const exceptions=exceptionOwners.get(this);
      let unlink;
      const cleanup=()=>{classCallableHosts.get(this)?.abortThread(thread);managedReturnHosts.get(this).forget(thread);};
      try {unlink=util.thread ? exceptions.linkManagedCall(thread,args,util,cleanup) :
        exceptions.linkPhysicalUpdate(thread,args,util,cleanup);}catch(error){runtime.sequencer.retireThread(thread);throw error;}
      // A sentinel caller frame retains arguments/locals while the native
      // sequencer replaces body frames. Each invocation owns its own cells.
      // The caller frame carries cells but has no executable block. Reusing
      // the definition ID here reruns a falling-through void body without its
      // parameters before the managed-call pump can observe completion.
      thread.stack[0] = null;
      thread.stackFrames[0].waitingReporter = name;
      thread.stackFrames[0].params = Object.fromEntries(names.map((n,i)=>[n,i < values.length ? values[i] : defaults[i]]));
      if(checkedEntry) {
        try {procedureOwners.get(this).bind(thread,target,name,thread.stackFrames[0].params,checkedEntry);}
        catch(error){unlink();runtime.sequencer.retireThread(thread);return exceptions.rejectConstraint(args,util,error);}
      }
      thread.pushStack(definition);
      thread.bwObjectConstruction = args.bwObjectConstruction || util.thread?.bwObjectConstruction;
      let classSignature=null;
      try {classSignature=classCallableHosts.get(this)?.bind(thread,target,name,thread.stackFrames[0].params,thread.bwObjectConstruction,values,rawValues);}
      catch(error){unlink();classCallableHosts.get(this)?.abortThread(thread);runtime.sequencer.retireThread(thread);return this._objectError(error);}
      managedReturnHosts.get(this).bind(thread,target,name,definition,util.thread);
      const managedCaller=util.thread;
      const complete=value=>{const transfer=exceptions.takeManagedTransfer(thread,managedCaller);if(transfer)throw transfer;const failure=exceptions.failure(thread) || exceptions.failure(managedCaller);if(failure)throw failure;unlink();if(classSignature && (managedCaller.isKilled || !runtime.threads.includes(managedCaller)))return Scratch.BWValues.UNDEFINED;try{this._objectHeap.validateTransport(value);return classCallableHosts.get(this)?.result(classSignature,value) ?? value;}catch(error){return this._objectError(error);}};
      thread.bwArcadeEvent = util.thread?.bwArcadeEvent;
      thread.bwArcadeCaptures = args.bwCallableCaptures || util.thread?.bwArcadeCaptures;
      thread.bwFunctionNames = new Set(util.thread?.bwFunctionNames || []);
      const recursive = thread.bwFunctionNames.has(name) || util.thread?.stack.some(id=>target.blocks.getBlock(id)?.mutation?.proccode===name);
      thread.bwFunctionNames.add(name);
      runtime._arcadeFramePhase?.linkManagedCall(thread,util.thread);
      if (util.sequencer === runtime.sequencer && !recursive) {
        const caller = util.thread, sequencer = util.sequencer, active = sequencer.activeThread;
        const currentLoan=dependencies.primitiveOwner.current(util,args);
        const step=()=>{
          if(currentLoan)return dependencies.primitiveOwner.stepNested(util,args,thread);
          return dependencies.primitiveOwner.stepChild(runtime,thread,()=>{
            sequencer.activeThread=thread;return sequencer.stepThread(thread);
          });
        };
        try {
          const deadline=Date.now()+0.75*runtime.currentStepTime;
          step();
          // Native source functions do not add a physics frame for finite loop
          // bookkeeping. Continue only loop yields within the real scheduler
          // budget; promises, explicit waits and stop retirements still suspend.
          while(runtime.threads.includes(thread) && thread.status===thread.constructor.STATUS_RUNNING &&
            thread.peekStackFrame()?.isLoop && !thread.peekStackFrame()?.timer && Date.now()<deadline)
            step();
        }
        finally {util.thread = caller;util.sequencer = sequencer;sequencer.activeThread = active;}
        const transfer=exceptions.takeManagedTransfer(thread,caller);if(transfer)throw transfer;
        const failure=exceptions.failure(thread) || exceptions.failure(caller);if(failure)throw failure;
        if (!runtime.threads.includes(caller)) {unlink();sequencer.retireThread(caller);sequencer.retireThread(thread);return 0;}
      }
      if (thread.stack.length === 1 || thread.status === thread.constructor.STATUS_DONE || thread.isKilled || !runtime.threads.includes(thread)) {runtime.sequencer.retireThread(thread);return complete(Scratch.BWValues.encode(thread.bwReturnValue));}
      return new Promise((resolve,reject)=>this._functionCalls.add({thread,unlink,reject,resolve:value=>{try{resolve(complete(value));}catch(error){reject(error);}},...(classSignature?{cancel:()=>resolve(Scratch.BWValues.UNDEFINED)}:{}),caller:util.thread}));
    }
    returnValue(args, util) {
      const thread = util?.thread;if (!thread) return;
      let frame = thread.stackFrames.length - 1;
      while (frame >= 0 && thread.stackFrames[frame].params == null) frame--;
      const sequencer=util.sequencer;
      const managed=frame < 0 || (frame === 0 && thread.stackFrames[0].waitingReporter);
      const read=()=>managed?managedReturnHosts.get(this).value(args,util):undefined;
      const settle=value=>{
        if(managed){thread.bwReturnValue=value;sequencer.retireThread(thread);return;}
        while(thread.stack.length>frame+1)thread.popStack();
        thread.goToNextBlock();
      };
      if(exceptionOwners.get(this).returnStructured(args,util,Math.max(0,frame),read,settle))return;
      if (managed) {settle(read());return;}
      // A command procedure discards its value but an early return must leave
      // only this invocation, including any nested loop/control frames.
      while (thread.stack.length > frame + 1) thread.popStack();
      thread.goToNextBlock();
    }
    declareSourceCallable(args,util) {
      try {return this._sourceScalarCells.declareAdditional(args,util);} catch(error){return this._objectError(error);}
    }
    declareCallable(args,util) {
      try {
        const target=util?.target || util?.thread?.target,block=target?.blocks.getBlock(util?.thread?.peekStack());
        if(!block||block.opcode!=='arcade_declareCallable')throw Error('Callable declaration requires its current native command');
        this._callableValues.declare(target,{...JSON.parse(String(args.METADATA)),procedure:String(args.NAME)},
          {block,name:String(args.NAME),metadata:String(args.METADATA)});
      }
      catch(error){return this._objectError(error);}
    }
    createCallable(args,util) {
      try {return this._callableValues.create(util?.target || util?.thread?.target,String(args.NAME),
        {locals:this._localParams(util),inheritedCaptures:util?.thread?.bwArcadeCaptures,
          structuredCaptures:exceptionOwners.get(this).captureStructuredLocals(args,util),
          ownerProcedure:util?.thread?.stackFrames.find(frame=>frame.waitingReporter&&frame.params)?.waitingReporter,
          sourceModule:util?.target?.blocks.getBlock(util?.thread?.topBlock)?.opcode==='arcade_whenSourceStarts',util,operationArgs:args});}
      catch(error){return this._objectError(error);}
    }
    _callableProcedure(invocation,util,operationArgs=null,operationOpcode='arcade_callCallable') {
      const caller=util?.thread;
      const exceptions=exceptionOwners.get(this);let callerLease=null;
      const release=()=>{exceptions.releaseCaller(callerLease);callerLease=null;};
      const failed=error=>{release();this._callableValues.failInvocation(invocation);return this._objectError(error);};
      let result;
      try {
        const witness=this._callableValues.structuredInvocation(invocation,(provider,map)=>exceptions.captureStructuredInvocation(operationArgs,util,provider,map,operationOpcode));
        if(witness)callerLease=exceptions.captureCaller(operationArgs,util,operationOpcode);
        result=this.callFunction({NAME:invocation.definition.procedure,
          ARGS:JSON.stringify(invocation.args,Scratch.BWValues.jsonReplacer),bwCallableCaptures:invocation.captures,
          ...(witness?{bwStructuredCatchInvocation:witness,bwExceptionCaller:callerLease}:{})},util);
      }catch(error){return failed(error);}
      const complete=value=>{release();try{const failure=exceptionOwners.get(this).failure(caller);if(failure){this._callableValues.failInvocation(invocation);throw failure;}if(!this._callableValues.hasTypedInvocation(invocation))return value;if(caller && (caller.isKilled || !this._runtime.threads.includes(caller)))return Scratch.BWValues.UNDEFINED;return this._callableValues.complete(invocation,value);}catch(error){return this._objectError(error);}};
      return result && typeof result.then==='function'?result.then(complete,failed):complete(result);
    }
    callCallable(args,util) {
      try {const argsText=String(args.ARGS),rawValues=JSON.parse(argsText),values=JSON.parse(argsText,(_key,value)=>Scratch.BWValues.encode(Scratch.BWValues.decode(value)));
        if(Array.isArray(rawValues))rawValues.forEach(value=>this._objectHeap.validateTransport(value));
        return this._callableProcedure(this._callableValues.invocation(args.CALLABLE,values,rawValues),util,args);}
      catch(error){return this._objectError(error);}
    }
    holdCallable(reference) {return this._callableValues.hold(reference);}
    invokeHeldCallable(reference,args,event) {return this._callableDispatch.dispatch(reference,args,event);}
    whenCallableDispatched(args,util) {return this._callableDispatch.matches(args.NAME,util);}
    runCallableDispatch(args,util) {return this._callableDispatch.run(util,args);}
    _localParams(util) {
      const frames = util?.thread?.stackFrames || [];
      for (let i = frames.length - 1; i >= 0; i--) {
        if (frames[i].params != null) return frames[i].params;
      }
      // Ordinary hat scripts have no procedure frame. Scratch replaces their
      // block frames between commands, so keep these locals on the thread
      // that owns the callback rather than on a transient block frame.
      const thread = util?.thread;
      if (!thread) return null;
      if (!thread._bwArcadeLocals) thread._bwArcadeLocals = {};
      return thread._bwArcadeLocals;
    }
    setLocal(args, util) {
      const params = this._localParams(util);
      if (params) {
        const name=String(args.NAME),value=dependencies.currentNumberInput(this._runtime,args,util,'arcade_setLocal');
        if(exceptionOwners.get(this).writeStructuredLocal(args,util,Scratch.BWValues.decode(value)))return;
        try {procedureOwners.get(this).write(params,name,value,util,args);}
        catch(error){return exceptionOwners.get(this).rejectConstraint(args,util,error);}
        params[name]=value;
      }
    }
    getLocal(args, util) {
      const lexical=exceptionOwners.get(this).readStructuredLocal(args,util);
      if(lexical)return Scratch.BWValues.encode(lexical.value);
      const params = this._localParams(util);
      const name = String(args.NAME);
      return params && Object.prototype.hasOwnProperty.call(params, name) ? params[name] : 0;
    }
    registerSpriteCreated(args, util) {
      const captures = new Map(util?.thread?.bwArcadeCaptures || []);
      const values = this._localParams(util);
      for (const key of String(args.CAPTURES || '').split(/\\s+/).filter(Boolean)) if (values) captures.set(key, {values, key});
      const kind=this._kindValue(args.KIND);if(kind==null)return;
      this._createdHandlers.push({kind, token: String(args.TOKEN),
        captures:exceptionOwners.get(this).captureStructuredRegistration(args,util,captures)});
    }
    _terrainRegistration(args, util) {
      const captures = new Map(util?.thread?.bwArcadeCaptures || []), values = this._localParams(util);
      for (const key of String(args.CAPTURES || '').split(/\\s+/).filter(Boolean)) if (values) captures.set(key, {values, key});
      return {kind:this._kindValue(args.KIND), token: String(args.TOKEN),
        captures:exceptionOwners.get(this).captureStructuredRegistration(args,util,captures)};
    }
    registerLegacyWallHandler(args,util) {
      const index=Number(Scratch.BWValues.decode(args.INDEX));
      if(index<0 || index>15)return;
      this._legacyWallHandlers.push({...this._terrainRegistration(args,util),index});
    }
    whenRegisteredLegacyWall(args,util) {return util?.thread?.bwArcadeEvent?.TOKEN===String(args.TOKEN);}
    tileHitFrom(args) {
      const sprite=this._spriteValues.get(String(args.ID));
      return sprite?(sprite._wallObstacles?.[Number(Scratch.BWValues.decode(args.DIRECTION))]?.tileIndex ?? -1):0;
    }
    registerWallHandler(args, util) {this._wallHandlers.push(this._terrainRegistration(args, util));}
    registerTileHandler(args, util) {
      const image = this._image(args.IMAGE);
      if (image) this._tileHandlers.push({...this._terrainRegistration(args, util), image});
    }
    whenRegisteredWall(args, util) {return util?.thread?.bwArcadeEvent?.TOKEN === String(args.TOKEN);}
    whenRegisteredTile(args, util) {return util?.thread?.bwArcadeEvent?.TOKEN === String(args.TOKEN);}
    eventLocation(args, util) {return util?.thread?.bwArcadeEvent?.location || Scratch.BWValues.encode(undefined);}
    _pumpTerrainWaits() {
      for (const pending of this._terrainWaits) {
        if (pending.thread.status === pending.thread.constructor.STATUS_DONE || pending.thread.isKilled ||
          !this._runtime.threads.includes(pending.thread)) {
          this._terrainWaits.delete(pending);pending.resolve();
        }
      }
    }
    _runTerrainGenerator(generator) {
      const epoch = this._terrainEpoch;
      const close = () => {
        // Only return-completion cleanup may run after cancellation. Drive
        // yielded finally work, never the ordinary body; cap unexpected cleanup.
        let remaining=64;
        const finish=(method='return',error)=>{
          if(remaining--<=0)throw new Error('Arcade cancelled iterator cleanup exceeded its finite step bound');
          const step=generator[method](error);
          if(!step.done)return Promise.resolve(step.value).then(()=>finish('next'),error=>finish('throw',error));
        };
        return finish();
      };
      const resume = (failed=false,error) => {
        // A cancelled actual turn must close its suspended iterator, not run
        // its authored continuation or retain a physical update entry.
        if (epoch !== this._terrainEpoch) return close();
        // Rejection belongs to this same yielded operation. Throw it through
        // delegation so every owned iterator finally runs before propagation.
        const step = failed ? generator.throw(error) : generator.next();
        if (!step.done) return Promise.resolve(step.value).then(()=>resume(),error=>resume(true,error));
        return step.value;
      };
      return resume();
    }
    *_terrainCallbackSteps(registrations, opcode, sprite, column, row, util) {
      const runtime = this._runtime, epoch=this._terrainEpoch;if (!runtime?.allScriptsByOpcodeDo || !runtime?._pushThread) return;
      const id = 'arcade-tile:' + (++this._nextTileLocationId);
      this._tileLocations.set(id, {column, row});
      const location = Scratch.BWValues.reference(runtime, 'tile', id);
      // Filter registrations once per obstacle/location, just like PXT's
      // filter(...).forEach(...). Later handlers retain their captured cells.
      for (const registration of registrations) {
        const scripts = [];
        runtime.allScriptsByOpcodeDo(opcode, (script, target) => {
          const hat = target.blocks.getBlock(script.blockId), token = target.blocks.getBlock(hat.inputs?.TOKEN?.block);
          if (token?.fields?.TEXT?.value === registration.token) scripts.push({script, target});
        });
        for (const {script, target} of scripts) {
          const thread = runtime._pushThread(script.blockId, target);
          thread.bwArcadeEvent = {TOKEN:registration.token, first:sprite.id, location};
          thread.bwArcadeCaptures = registration.captures;
          try{exceptionOwners.get(this).bindStructuredRegistration(registration,thread);}
          catch(error){runtime.sequencer.retireThread(thread);throw error;}
          const caller = util?.thread, active = runtime.sequencer.activeThread;
          try {runtime.sequencer.activeThread = thread;dependencies.primitiveOwner.stepChild(runtime,thread,()=>runtime.sequencer.stepThread(thread));}
          finally {if (util) {util.thread = caller;util.sequencer = runtime.sequencer;}runtime.sequencer.activeThread = active;}
          if(epoch!==this._terrainEpoch)return;
          if (thread.status !== thread.constructor.STATUS_DONE && !thread.isKilled && runtime.threads.includes(thread))
            yield new Promise(resolve => this._terrainWaits.add({thread, resolve}));
          if(epoch!==this._terrainEpoch)return;
        }
      }
    }
    *_tileOverlapSteps(sprite, map, box, util) {
      const epoch=this._terrainEpoch,owner=this._state();
      if (sprite._destroyed || sprite.flags & (2|spriteFlags.GhostThroughTiles | spriteFlags.RelativeToCamera) || !this._sprite(sprite.id)) return;
      const size = map.tileSize*256, left = sprite._fx+box.left*256, right = left+(box.width-1)*256;
      const top = sprite._fy+box.top*256, bottom = top+(box.height-1)*256, locations = [], seen = new Set();
      for (let x=left;x<right+size;x+=size) for (let y=top;y<bottom+size;y+=size) {
        const column=Math.floor((Math.min(x,right)+128)/size),row=Math.floor((Math.min(y,bottom)+128)/size),key=column+':'+row;
        if(seen.has(key)) continue;seen.add(key);
        if(!this._wallAt(map,column,row) || sprite.flags & spriteFlags.GhostThroughWalls) locations.push({column,row});
      }
      for (const {column,row} of locations) {
        const current=this._state().tilemap;
        if(!current) continue;
        const index = column<0 || row<0 || column>=current.columns || row>=current.rows ? 0 : current.indices[row*current.columns+column];
        const image=current.images[index];
        const matches=this._tileHandlers.filter(h => h.kind===sprite.kind && image && h.image.width===image.width && h.image.height===image.height &&
          h.image.pixels.every((value,i)=>value===image.pixels[i]));
        yield* this._terrainCallbackSteps(matches,'arcade_whenRegisteredTile',sprite,column,row,util);
        if(epoch!==this._terrainEpoch || this._state()!==owner)return;
      }
    }
    getCaptured(args, util) {
      const cell = util?.thread?.bwArcadeCaptures?.get(String(args.NAME));
      const lexical=exceptionOwners.get(this).readStructuredCaptured(args,util,cell);
      return lexical ? Scratch.BWValues.encode(lexical.value) : cell ? cell.values[cell.key] : 0;
    }
    setCaptured(args, util) {
      const cell = util?.thread?.bwArcadeCaptures?.get(String(args.NAME));
      if (cell) {
        const value=dependencies.currentNumberInput(this._runtime,args,util,'arcade_setCaptured');
        if(exceptionOwners.get(this).writeStructuredCaptured(args,util,cell,Scratch.BWValues.decode(value)))return;
        try {procedureOwners.get(this).write(cell.values,cell.key,value,util,args);}
        catch(error){return exceptionOwners.get(this).rejectConstraint(args,util,error);}
        cell.values[cell.key]=value;
      }
    }
    // game.Prompt and game.NumberPrompt (prompt-pxt.js): the original text-entry
    // screen is a renderable of a pushed scene. By default the text comes from the
    // system keyboard: here the stage's Question box (QUESTION/ANSWER) stands in for
    // the simulator's hidden text field, and ARCADE_PROMPT_INPUT reports each edit so
    // the scene shows the typed characters live. ARCADE_PROMPT_CANCEL is the
    // simulator's cancelSystemKeyboard: the prompt then runs the on-screen keyboard
    // (arrows move, A types, B deletes), as it does when useOnScreenKeyboard is set.
    _textPromptModule() {
      if(this._promptPxt)return this._promptPxt;
      this._gameOverModule();
      const text=this._pxtText(),image=this._dialogHost.image;
      const speech=dependencies.initializeSpeech(image,{millis:()=>0},
        {runtime:()=>0,currentScene:()=>({camera:{},eventContext:{deltaTimeMillis:0}}),eventContext:()=>({deltaTime:0})},
        {width:160,height:120},{Ghost:4,RelativeToCamera:2},{toInt:value=>value|0},value=>String(value));
      this._promptPxt=dependencies.initializePrompt({font8:text.image.font8,RenderText:speech.RenderText,screenWidth:160,screenHeight:120});
      return this._promptPxt;
    }
    _askForString(args, util, answerLength=12, numbersOnly=false, useOnScreenKeyboard=false) {
      const ask = this._runtime && this._runtime.getOpcodeFunction &&
        this._runtime.getOpcodeFunction('sensing_askandwait');
      const answer = this._runtime && this._runtime.getOpcodeFunction &&
        this._runtime.getOpcodeFunction('sensing_answer');
      if (!ask || !answer || !util || !util.target) return '';
      const epoch=this._terrainEpoch;
      const operation=this._textPromptTail.then(async()=>{
        if(epoch!==this._terrainEpoch)return '';
        await this.pushScene({},util);
        if(epoch!==this._terrainEpoch)return '';
        let cancel, restored=false;
        const cancelled=new Promise(resolve=>{cancel=()=>resolve('stopped');this._textPromptWaits.add(cancel);});
        const runtime=this._runtime,module=this._textPromptModule(),owner=this._state();
        const prompt=new (numbersOnly?module.NumberPrompt:module.Prompt)(()=>owner.elapsedMs || 0);
        const message=String(Scratch.BWValues.decode(args.QUESTION));
        prompt.begin(message,answerLength,!useOnScreenKeyboard);
        const raw=this._dialogHost.wrap;
        this._addSceneRenderable(owner,{z:-1,id:owner.nextSpriteId++,draw:screen=>prompt.draw(raw(screen))});
        let switched,screenDone;
        const switchedToScreen=new Promise(resolve=>{switched=()=>resolve('switched');});
        const confirmed=new Promise(resolve=>{screenDone=()=>resolve('confirmed');});
        const ui=this._textPromptUi={prompt,owner,onButton:button=>{
          if(prompt.onButton(button) && prompt.confirmPressed)screenDone();
        }};
        const edit=value=>{
          if(!prompt.useSystemKeyboard)return;
          const cleaned=numbersOnly?module.cleanNumberInput(value):String(value);
          prompt.keyboardChange(cleaned,cleaned.length,cleaned.length);
        };
        const cancelKeyboard=()=>{if(prompt.useSystemKeyboard){prompt.keyboardCancel();switched();}};
        runtime.on('ARCADE_PROMPT_INPUT',edit);runtime.on('ARCADE_PROMPT_CANCEL',cancelKeyboard);
        runtime.bwArcadeTextPrompt={answerLength,numbersOnly};
        try {
          let outcome=useOnScreenKeyboard?'switched':await Promise.race([
            Promise.resolve(ask({QUESTION:message},util)).then(()=>'answered'),cancelled,switchedToScreen]);
          if(outcome==='stopped' || epoch!==this._terrainEpoch)return '';
          let reply;
          if(outcome==='answered'){
            reply=String(answer()).substr(0,answerLength);
            if(numbersOnly)reply=module.cleanNumberInput(reply);
          } else {
            // The system keyboard was cancelled: the Question box gives way to the on-screen keyboard.
            if(!useOnScreenKeyboard){runtime.emit('ANSWER',prompt.result);runtime.emit('QUESTION',null);}
            outcome=await Promise.race([confirmed,cancelled]);
            if(outcome==='stopped' || epoch!==this._terrainEpoch)return '';
            reply=prompt.result;
          }
          restored=true;
          await this.popScene({},util);
          return reply;
        }finally{
          runtime.removeListener('ARCADE_PROMPT_INPUT',edit);runtime.removeListener('ARCADE_PROMPT_CANCEL',cancelKeyboard);
          if(this._textPromptUi===ui)this._textPromptUi=null;
          this._textPromptWaits.delete(cancel);
          if(epoch===this._terrainEpoch){
            runtime.bwArcadeTextPrompt=null;
            if(!restored)await this.popScene({},util);
          }
        }
      });
      this._textPromptTail=operation.catch(()=>{});
      return operation;
    }
    askForString(args, util) { return this._askForString(args, util); }
    askForStringLength(args, util) {
      if(typeof Scratch.BWValues.decode(args.QUESTION)!=='string')throw new TypeError('Arcade limited text prompt requires a String question');
      const length=dependencies.readPromptLength(this._runtime,args,util);
      return Promise.resolve(this._askForString(args,util,length,false,false)).then(reply=>{
        if(typeof reply!=='string')throw new TypeError('Arcade limited text prompt result must remain a String');
        return reply;
      });
    }
    askForNumber(args, util) {
      return Promise.resolve(this._askForString(args, util,6,true)).then(reply => parseFloat(reply));
    }
    askForNumberLength(args, util) {
      // This reporter represents only the literal-String message slice.
      if(typeof Scratch.BWValues.decode(args.QUESTION)!=='string')throw new TypeError('Arcade limited number prompt requires a String question');
      const length=Math.max(0,Math.min(10,this._mathArgument(args,'LENGTH',util)));
      return Promise.resolve(this._askForString(args,util,length,true,false)).then(reply=>parseFloat(reply));
    }
    // PXT game.ask waits 500 ms, then requires release before A/B confirmation.
    // Behaviour reference: microsoft/pxt-common-packages libs/game/ask.ts (MIT).
    ask(args) {
      return this._queueDialog({type:'ask',title:String(Scratch.BWValues.decode(args.TITLE)),
        subtitle:String(Scratch.BWValues.decode(args.SUBTITLE)),elapsed:0,
        held:{a:this._heldButton(1,'a'),b:this._heldButton(1,'b')},armed:{a:false,b:false}});
    }
    _questionButtonEdge(button,held) {
      const dialog=this._dialogs?.[0];
      if(dialog?.type!=='ask' || dialog.fiber || !['a','b'].includes(button))return;
      dialog.held[button]=!!held;
      if(dialog.elapsed>=500 && !held)dialog.armed[button]=true;
    }
    _pumpQuestion(milliseconds) {
      const dialog=this._dialogs?.[0];if(dialog?.type!=='ask' || dialog.fiber)return;
      const wasReady=dialog.elapsed>=500;
      dialog.elapsed+=milliseconds;
      if(dialog.screen && dialog.elapsed>=dialog.refreshIn-1e-6)this._showAskScreen(dialog);
      if(dialog.elapsed<500)return;
      if(!wasReady)this._showNextDialog();
      for(const button of ['a','b'])if(!dialog.held[button])dialog.armed[button]=true;
      if(dialog.armed.a && dialog.held.a)dialog.dismiss(true);
      else if(dialog.armed.b && dialog.held.b)dialog.dismiss(false);
    }
    _dialogPrimitive(value) {
      const decoded=Scratch.BWValues.decode(value);
      if(decoded!==null && !['string','number','boolean','undefined'].includes(typeof decoded))throw new Error('Arcade dialog text needs a supported primitive; opaque inspection is not implemented');
      // console.inspect's primitive branch in the pinned console.ts.
      return decoded;
    }
    splash(args,util) {
      try {return this._startNativeTextDialog('splash',this._dialogPrimitive(args.TITLE),this._dialogPrimitive(args.SUBTITLE),undefined,util);}
      catch(error){this._runtime?.emit?.('BLOCKS_ERROR',error.message);}
    }
    showLongText(args,util) {
      const layout=String(Scratch.BWValues.decode(args.LAYOUT));
      if(!['Left','Right','Top','Bottom','Center','Full'].includes(layout)){
        this._runtime?.emit?.('BLOCKS_ERROR','Arcade long text layout must be a fixed DialogLayout value: '+layout);return;
      }
      try {return this._startNativeTextDialog('longText',this._dialogPrimitive(args.TEXT),undefined,layout,util);}
      catch(error){this._runtime?.emit?.('BLOCKS_ERROR',error.message);}
    }
    _nativeDialogButtonEdge(button,held) {
      if(!['a','b','up','down','left','right','start','select'].includes(button) || typeof held!=='boolean')return;
      this._state().buttons[button]=held;
      this._controllerButtonEdge(1,button,held);
    }
    _cancelNativeTextDialogs() {
      this._sceneFrameHost?.cancel();this._sceneFrameHost=null;
      this._pollEvents?.cancel();this._pollEvents=null;
      for(const dialog of this._nativeTextDialogs || []){dialog.closed=true;dialog.resolve();}
      this._nativeTextDialogs=[];this._userControllerEvents=true;
    }
    _nativePollEvents() {
      if(!this._pollEvents){
        const epoch=this._programClockEpoch;
        if(!epoch?.timerAuthority)throw new Error('Native Arcade condition polling requires program timer authority; a now-only manual clock supplies frames but not timers');
        this._pollEvents=dependencies.createPollEvents({now:()=>this._programMillis(),
          setTimeout:epoch.setTimeout,clearTimeout:epoch.clearTimeout,
          onReady:()=>this._runtime?._arcadeFramePhase?.requestContinuation(),
          onError:error=>this._runtime?.emit?.('BLOCKS_ERROR',String(error?.message || error))});
      }
      return this._pollEvents;
    }
    _startNativeTextDialog(type,title,subtitle,layout,util) {
      // BlockUtility is shared across concurrently running VM threads.
      util={thread:util?.thread,sequencer:util?.sequencer};
      const epoch=this._terrainEpoch,game=this._gameOverModule().game;
      const text=String(title),subtext=subtitle?String(subtitle):'';
      this._userControllerEvents=false;
      const pushed=this.pushScene({},util),owner=this._state();owner.seeThrough=true;
      let width=160,height=subtext?42:35,left,top;
      if(type==='longText'){
        const sizes={Bottom:[156,45,2,75],Top:[156,45,2,0],Left:[58,120,0,0],Right:[58,120,102,0],Center:[106,106,27,7],Full:[160,120,0,0]};
        [width,height,left,top]=sizes[layout];
      }
      return new Promise(resolve=>{
        const dialog={type,title:text,subtitle:subtext,layout,body:null,owner,epoch,resolve,closed:false,done:false,pressed:true,upPressed:true};
        this._nativeTextDialogs.push(dialog);this._showNextDialog();
        const ready=()=>{
          if(dialog.closed || epoch!==this._terrainEpoch)return;
          if(this._state()!==owner){this._runtime?.emit?.('BLOCKS_ERROR','Arcade dialog scene changed during creation');dialog.closed=true;resolve();return;}
          // Original constructs the dialog only after push handlers return.
          const body=type==='splash'?new game.SplashDialog(width,height):new game.Dialog(width,height);
          body.setText(text);if(type==='splash' && subtext)body.setSubtext(subtext);dialog.body=body;
          const created=this.createImageSprite({KIND:-1,IMAGE:this._imageHandle(body.image.raw)},util);
          const complete=id=>{
            if(dialog.closed || epoch!==this._terrainEpoch || this._state()!==owner)return;
            dialog.id=id;
            if(type==='longText'){this.setSpriteProperty({ID:id,PROPERTY:'left',VALUE:left});this.setSpriteProperty({ID:id,PROPERTY:'top',VALUE:top});}
            this._updateHandlers.push({host:()=>this._updateNativeTextDialog(dialog,util)});
            this._showNextDialog();
            // The original pauseUntil(done) checks optimistically and then
            // waits for the shared condition-poll event, independently of frames.
            if(dialog.done)resolve();
            else this._nativePollEvents().enqueue(()=>dialog.done,()=>{
              if(dialog.epoch!==this._terrainEpoch)return;
              this._userControllerEvents=true;resolve();
            });
          };
          if(created?.then)created.then(complete).catch(error=>this._runtime?.emit?.('BLOCKS_ERROR',String(error)));else complete(created);
        };
        if(pushed?.then)pushed.then(ready).catch(error=>this._runtime?.emit?.('BLOCKS_ERROR',String(error)));else ready();
      });
    }
    _updateNativeTextDialog(dialog,util) {
      if(dialog.closed || dialog.epoch!==this._terrainEpoch || this._state()!==dialog.owner)return;
      dialog.body.update();this._refreshImage(dialog.body.image.raw);
      const current=this._heldButton(1,'a') || (dialog.type==='longText' && this._heldButton(1,'down'));
      if(current && !dialog.pressed){
        dialog.pressed=true;
        if(dialog.type==='longText' && dialog.body.hasNext()){dialog.body.nextPage();this._showNextDialog();}
        else this._closeNativeTextDialog(dialog,util);
      } else if(dialog.pressed && !current)dialog.pressed=false;
      if(dialog.type==='longText'){
        const previous=this._heldButton(1,'up');
        if(previous && !dialog.upPressed){dialog.upPressed=true;if(dialog.body.hasPrev()){dialog.body.prevPage();this._showNextDialog();}}
        else if(dialog.upPressed && !previous)dialog.upPressed=false;
      }
    }
    _closeNativeTextDialog(dialog,util) {
      if(dialog.closed || dialog.epoch!==this._terrainEpoch || this._state()!==dialog.owner)return;
      dialog.closed=true;dialog.owner.backgroundImage=null;this._renderBackgroundImage();
      const popped=this.popScene({},util);
      const finish=()=>{
        if(dialog.epoch!==this._terrainEpoch)return;
        this._nativeTextDialogs=this._nativeTextDialogs.filter(value=>value!==dialog);
        this._showNextDialog();dialog.done=true;
      };
      if(popped?.then)popped.then(finish).catch(error=>this._runtime?.emit?.('BLOCKS_ERROR',String(error)));else finish();
    }
    _queueDialog(fields) {
      return new Promise(resolve => {
        if (!this._dialogs) this._dialogs = [];
        const dialog = {...fields, resolve};
        dialog.dismiss = answer => {
          if(dialog.type==='ask' && (typeof answer!=='boolean' || dialog.elapsed<500))return;
          if (this._dialogs[0] !== dialog) return;
          this._dialogs.shift();
          resolve(dialog.type==='ask' ? answer : undefined);
          this._showNextDialog();
        };
        this._dialogs.push(dialog);
        if (this._dialogs.length === 1) this._showNextDialog();
      });
    }
    _showNextDialog() {
      if (this._runtime) {
        const native=(this._nativeTextDialogs || []).findLast(value=>!value.closed && value.owner===this._state());
        const dialog=native || this._dialogs?.[0];
        if(dialog?.type==='ask' && !dialog.started){
          dialog.started=true;
          for(const button of ['a','b'])dialog.held[button]=this._heldButton(1,button);
          this._drawAskDialog(dialog);
          this._startAskFiber(dialog);
        }
        this._runtime.bwArcadeDialogOpen = Boolean(dialog);
        this._runtime.bwArcadeDialogType = dialog?.type || null;
        // UI containers compare dialog identity. Publish a snapshot when the
        // guard changes; dismissal still closes over the authoritative queue.
        this._runtime.emit('ARCADE_DIALOG', native ? {type:native.type,title:native.title,subtitle:native.subtitle,layout:native.layout,native:true,page:native.body?.chunkIndex || 0,pages:native.body?.chunks?.length || 1,hasNext:native.body?.hasNext?.() || false,hasPrev:native.body?.hasPrev?.() || false} : dialog ? {...dialog} : null);
      }
    }
    lightLevel() { return Number(this._state().light) || 0; }
    tilt(args) { return Number(this._state()[String(args.AXIS).toLowerCase() === 'y' ? 'tiltY' : 'tiltX']) || 0; }
    setPixel(args) {
      const state = this._state();
      const index = Math.max(0, Math.min(state.neopixels.length - 1, Math.floor(Number(args.INDEX) || 0)));
      let color = args.COLOR;
      if (typeof color === 'number') color = '#' + (color >>> 0).toString(16).padStart(6, '0').slice(-6);
      state.neopixels[index] = /^#[0-9a-f]{6}$/i.test(String(color)) ? String(color) : '#000000';
      this._changed();
    }
    clearPixels() { this._state().neopixels.fill('#111827'); this._changed(); }
    createsprite(args) {
      const bounds = this._bounds();
      this._state().sprites[String(args.NAME)] = {x: this._clamp(args.X, bounds.x), y: this._clamp(args.Y, bounds.y), brightness: 9};
      this._changed();
    }
    deletesprite(args) { delete this._state().sprites[String(args.NAME)]; this._changed(); }
    movesprite(args) {
      const sprite = this._sprite(args.NAME); if (!sprite) return;
      const bounds = this._bounds();
      sprite.x = this._clamp(sprite.x + Number(args.DX || 0), bounds.x);
      sprite.y = this._clamp(sprite.y + Number(args.DY || 0), bounds.y);
      this._changed();
    }
    setspritepos(args) {
      const sprite = this._sprite(args.NAME); if (!sprite) return;
      const bounds = this._bounds();
      sprite.x = this._clamp(args.X, bounds.x); sprite.y = this._clamp(args.Y, bounds.y); this._changed();
    }
    spritex(args) { const sprite = this._sprite(args.NAME); return sprite ? sprite.x : 0; }
    spritey(args) { const sprite = this._sprite(args.NAME); return sprite ? sprite.y : 0; }
    touching(args) {
      const a = this._sprite(args.A); const b = this._sprite(args.B);
      return Boolean(a && b && a.x === b.x && a.y === b.y);
    }
    touchingedge(args) {
      const sprite = this._sprite(args.NAME); if (!sprite) return false;
      const bounds = this._bounds(); return sprite.x <= 0 || sprite.x >= bounds.x || sprite.y <= 0 || sprite.y >= bounds.y;
    }
    setscore(args,util) {return this.setPlayerScore({PLAYER:1,VALUE:args.N},util);}
    changescore(args,util) {return this.changePlayerScore({PLAYER:1,VALUE:args.N},util);}
    getscore() {return this.getPlayerScore({PLAYER:1});}
    showscore() { this._state().scoreVisible = true; this._changed(); }
    log(args) {
      const state = this._state();
      state.serial = ((state.serial || '') + String(args.TEXT ?? '') + '\\n').slice(-8000);
      this._changed();
    }
    drawsprites() { this._state().screenCleared = false; this._changed(); }
    clearscreen() { this._state().screenCleared = true; this._changed(); }
    setbrightness(args) {
      const sprite = this._sprite(args.NAME); if (!sprite) return;
      sprite.brightness = this._clamp(args.B, 9); this._changed();
    }
    _camera(state=this._state()) {
      if (!state.camera) state.camera = {offsetX:0, offsetY:0, drawOffsetX:0, drawOffsetY:0, followId:null};
      return state.camera;
    }
    _cameraOffset(axis, value) {
      const map = this._state().tilemap, size = axis==='x' ? 160 : 120;
      if (map) value = Math.max(0,Math.min(Math.max(0,(axis==='x'?map.columns:map.rows)*map.tileSize-size),value));
      return Math.floor(value);
    }
    centerCameraAt(args) {
      const camera=this._camera();camera.followId=null;
      camera.offsetX=this._cameraOffset('x',Number(Scratch.BWValues.decode(args.X))-80);
      camera.offsetY=this._cameraOffset('y',Number(Scratch.BWValues.decode(args.Y))-60);
      this._changed();
    }
    cameraShake(args) {
      const camera=this._camera();
      const strength=Scratch.BWValues.decode(args.AMPLITUDE),length=Scratch.BWValues.decode(args.DURATION);
      const amplitude=Number(strength===undefined?4:strength);
      const duration=Number(length===undefined?500:length);
      if(amplitude<=0 || duration<=0)camera.shakeStartTime=undefined;
      else {
        camera.shakeStartTime=this._globalElapsedMs;
        camera.shakeAmplitude=amplitude;camera.shakeDuration=duration;
      }
    }
    cameraFollowSprite(args) {
      const value=Scratch.BWValues.decode(args.ID),camera=this._camera();
      if(value==null || value==='')camera.followId=null;
      else if(this._spriteValues.has(String(value)))camera.followId=String(value);
      else {this._runtime?.emit?.('BLOCKS_ERROR','Arcade camera follow requires a sprite from this project.');return;}
      this._updateCamera();this._changed();
    }
    _cameraIsUpdated() {
      const camera=this._camera(),sprite=this._spriteValues.get(camera.followId);
      return !sprite || sprite.x===camera.lastX && sprite.y===camera.lastY;
    }
    _updateCamera() {
      const camera=this._camera(),sprite=this._spriteValues.get(camera.followId);
      if(sprite){
        camera.lastX=sprite.x;camera.lastY=sprite.y;
        camera.offsetX=this._cameraOffset('x',sprite._fx/256+(sprite.width>>1)-80);
        // The pinned PXT camera uses width here as well, even on non-square art.
        camera.offsetY=this._cameraOffset('y',sprite._fy/256+(sprite.width>>1)-60);
      }
      let x=camera.offsetX,y=camera.offsetY;
      // PXT camera.ts: replace an active shake, damp its final quarter, and
      // apply integer jitter to draw offsets only (not logical camera bounds).
      if(camera.shakeStartTime!==undefined){
        const elapsed=this._globalElapsedMs-camera.shakeStartTime;
        if(elapsed>=camera.shakeDuration)camera.shakeStartTime=undefined;
        else {
          const progress=elapsed/camera.shakeDuration;
          const amplitude=camera.shakeAmplitude*(progress>=.75?Math.max(0,1-progress):1);
          x+=(Math.random()*amplitude)>>0;y+=(Math.random()*amplitude)>>0;
        }
      }
      const changed=camera.drawOffsetX!==x || camera.drawOffsetY!==y;
      camera.drawOffsetX=x;camera.drawOffsetY=y;
      if(changed){
        this._renderTilemap();
        for(const id of Object.keys(this._state().sprites))this._positionSprite(id);
        this._changed();
      }
    }
    whenSourceStarts() {return true;}

    sourceWhile(args, util) {
        if (args.CONDITION) util.startBranch(1, true);
    }

    cameraDrawOffset(args) {
      const camera=this._camera();
      if(args.AXIS==='x')return camera.drawOffsetX;
      if(args.AXIS==='y')return camera.drawOffsetY;
      throw new Error('Arcade camera draw offset requires x or y');
    }
    cameraProperty(args) {
      if(!this._cameraIsUpdated())this._updateCamera();
      const camera=this._camera();
      const values=[camera.offsetX+80,camera.offsetY+60,camera.offsetX,camera.offsetX+160,camera.offsetY,camera.offsetY+120];
      return Scratch.BWValues.encode(values[Number(Scratch.BWValues.decode(args.PROPERTY))]);
    }
    _spriteViewPosition(sprite,state=this._state()) {
      const camera=this._camera(state),relative=!!(sprite.flags & spriteFlags.RelativeToCamera);
      return {x:Math.floor(sprite._fx/256-(relative?0:camera.drawOffsetX))+sprite.width/2,
        y:Math.floor(sprite._fy/256-(relative?0:camera.drawOffsetY))+sprite.height/2};
    }
    _positionSprite(id) {
      const s = this._sprite(id);
      const target = this._state().spriteTargets[id];
      if (s && ((target && target.setXY) || this._imageSkins.get(id)?.drawableId!==undefined)) {
        let crop;
        if(s.image && this._runtime?.renderer){
          crop=this._spriteRasterWindow(s);
          if(this._imageSkins.get(id)?.windowKey!==crop.key)this._renderSpriteImage(id,crop);
        }
        const view=this._spriteViewPosition(s);
        // Position the visible raster itself. Huge scales can put the original
        // center millions of pixels away; subtracting that again in the GPU
        // loses pixel precision even though the viewport is only 160x120.
        if(crop){view.x+=crop.x+crop.width/2-s.width/2;view.y+=crop.y+crop.height/2-s.height/2;}
        if(target?.setXY)target.setXY((view.x-80)*3,(60-view.y)*3);
        else this._runtime.renderer.updateDrawablePosition(this._imageSkins.get(id).drawableId,[(view.x-80)*3,(60-view.y)*3]);
      }
    }
    _speechOwner(id, target) {
      const sprite = this._sprite(id);
      if (sprite) return sprite;
      if (!target || this._runtime?.targets && !this._runtime.targets.includes(target)) return null;
      const costume = target.getCostumes?.()[target.currentCostume];
      const size = this._costumeImageSize(costume) || {width: 16, height: 16};
      return {x: (target.x || 0) / 3 + 80, y: 60 - (target.y || 0) / 3,
        width: size.width, height: size.height, mask: this._costumePixelMask(costume, size)};
    }
    spriteSay(args, util) {
      const state = this._state();
      const self = String(args.ID) === 'self';
      const id = self ? 'target:' + util?.target?.id : String(args.ID);
      const target = self ? util?.target : state.spriteTargets[id];
      let owner = this._speechOwner(id, target), detached = false;
      if (!owner && !self) {
        // PXT keeps a sprite object usable after its scene is suspended: a handler that was
        // already running when a game over replaced the scene can still make it say something.
        // The legacy renderer draws one bubble sprite into the CURRENT scene and, as the owner
        // is not updated there, never moves or expires it.
        const stale = this._spriteValues.get(id);
        if (stale && !stale._destroyed && stale.image && !state.sprites[id]) { owner = stale; detached = true; }
      }
      if (!owner) return;
      const rawText = Scratch.BWValues.decode(args.TEXT), rawDuration = Scratch.BWValues.decode(args.DURATION);
      const text = rawText == null ? '' : String(rawText);
      const duration = Number(rawDuration);
      const legacy = String(args.MODE) === 'legacy';
      const foreground = (Number(args.FOREGROUND) || 0) & 15;
      const background = (Number(args.BACKGROUND) || 0) & 15;
      const previous = this._speech.get(id);
      // PXT's legacy persistent say avoids restarting its horizontal scroll
      // when an overlap callback repeats the same message every frame.
      if (text && legacy && previous?.legacy && previous.text === text &&
        previous.foreground === foreground && previous.background === background &&
        (rawDuration === undefined || Number.isFinite(duration) && duration < 0) && previous.end === null) return;
      const now = this._globalElapsedMs, speech = this._speech, epoch=this._terrainEpoch, caller=util?.thread;
      const entry = {target, text, legacy, foreground, background, animated: Scratch.Cast.toBoolean(args.ANIMATED),
        end: Number.isFinite(duration) && duration >= 0 ? now + duration : null, util};
      const finish = renderer => this._withSpeechCaller(util,caller,()=>{
        if(!renderer || epoch!==this._terrainEpoch)return;
        entry.renderer = renderer;
        if (detached) { this._renderSpeech(id, entry, owner, 0); this._changed(); return; }
        speech.set(id, entry);
        if (!state.speech) state.speech = {};
        state.speech[id] = {text, duration, animated: entry.animated, foreground, background,
          mode: legacy ? 'legacy' : 'text', end: entry.end};
        this._renderSpeech(id, entry, owner, 0);
        this._changed();
      });
      const create = () => this._withSpeechCaller(util,caller,()=>{
        if(epoch!==this._terrainEpoch)return;
        if (!text) {this._changed();return;}
        if (!legacy) return finish(this._speechEngine.create(text, Number.isFinite(duration) ? duration : -1,
          entry.animated, foreground, background, false, owner, this._globalElapsedMs));
        const work = this._speechEngine.createNative(text,
          Number.isFinite(duration) ? duration : -1, foreground, background, owner,
          {time:()=>this._globalElapsedMs,camera:()=>this._camera(),hitbox:()=>this._wallHitbox(owner),
            deltaTime:()=>this._state().frameDeltaTime || 0},
          image=>this._createSpeechBubble(image, entry, util));
        return work && typeof work.then === 'function' ? work.then(finish) : finish(work);
      });
      const cleared = this._clearSpeech(id, util);
      return cleared && typeof cleared.then === 'function' ? cleared.then(create) : create();
    }
    _withSpeechCaller(util, caller, action) {
      if(!util || !caller)return action();
      // BlockUtility is reused by the sequencer. Promise continuations must
      // restore the originating fiber before nested creation callbacks run.
      const previousThread=util.thread,previousSequencer=util.sequencer;
      util.thread=caller;util.sequencer=this._runtime?.sequencer || previousSequencer;
      try{return action();}
      finally{util.thread=previousThread;util.sequencer=previousSequencer;}
    }
    _createSpeechBubble(image, entry, util) {
      const width=image.width,height=image.height;
      const id=this._createSprite({KIND:'-1',WIDTH:width,HEIGHT:height,
        X:((160-width)>>1)+width/2,Y:((120-height)>>1)+height/2,IMAGE:this._imageHandle(image)});
      const sprite=this._spriteValues.get(id),ext=this;
      entry.nativeBubbleId=id;
      // This facade delegates to the ordinary native sprite and image. It does
      // not allocate an extra ID or own an independent pixel buffer.
      const bubble={
        get image(){return ext._speechEngine.pixelImage(sprite.image);},
        get width(){return sprite.width;},get height(){return sprite.height;},
        get x(){return sprite.x;},set x(value){sprite.x=value;},
        get y(){return sprite.y;},set y(value){sprite.y=value;},
        get z(){return sprite.z;},set z(value){ext.setSpriteProperty({ID:id,PROPERTY:'z',VALUE:value});},
        get left(){return sprite._fx/256;},set left(value){sprite.x=value+sprite.width/2;},
        get right(){return sprite._fx/256+sprite.width;},set right(value){sprite.x=value-sprite.width/2;},
        get top(){return sprite._fy/256;},
        get flags(){return (sprite._destroyed?1:0)|(sprite.flags&spriteFlags.RelativeToCamera?2:0)|(sprite.flags&spriteFlags.Ghost?4:0);},
        get destroyed(){return !!sprite._destroyed;},
        setImage(value){ext.setSpriteImage({ID:id,IMAGE:ext._imageHandle(value)});},
        setFlag(flag,on){ext.setSpriteFlag({ID:id,FLAG:flag===4?'Ghost':'RelativeToCamera',ON:on});},
        destroy(){return ext.destroySprite({ID:id},entry.util);}
      };
      const created=this._finishSpriteCreation(id,util);
      return created && typeof created.then==='function' ? created.then(value=>value ? bubble : null) : created ? bubble : null;
    }
    _paletteColors() { return this._projectPalette || speechPalette; }
    _imagePalette(image) { return this._projectPalette ? [null,...this._projectPalette.slice(1)] : image?.palette; }
    setPalette(args) {
      const hex = String(Scratch.BWValues.decode(args.DATA));
      if (!/^[0-9a-f]{96}$/i.test(hex)) throw new RangeError('Arcade palette requires exactly 16 RGB colors (48 bytes)');
      this._projectPalette = hex.match(/.{6}/g).map(color => '#'+color.toLowerCase());
      this._renderPalette();
    }
    _renderPalette() {
      const state=this._state();
      if(this._background || this._projectPalette)this.setBackgroundColor({COLOR:this.backgroundColor()});
      this._renderBackgroundImage();
      const presentLegacy=!!(state.tilemap?.legacy && state.tilemap.image);
      if(presentLegacy)state.tilemap.needsRender=true;
      this._renderTilemap(presentLegacy);
      for(const sprite of Object.values(state.sprites))this._renderSpriteImageIfPresent(sprite);
      for(const [id,entry] of this._speech){const owner=state.sprites[id];if(owner)this._renderSpeech(id,entry,owner,0);}
      this._changed();
    }
    backgroundColor() { return this._state().backgroundColor || 0; }
    setBackgroundColor(args) {
      const color = Number(args.COLOR) || 0;
      this._state().backgroundColor = color;
      const renderer = this._runtime?.renderer;
      if (renderer) {
        // Extend the solid fill beyond stage edges to avoid filtered SVG edge seams.
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="482" height="362"><rect width="482" height="362" fill="' + this._paletteColors()[(color | 0) & 15] + '"/></svg>';
        if (!this._background) {
          const skin = renderer.createSVGSkin(svg, [241, 181]);
          const drawable = renderer.createDrawable('background');
          renderer.updateDrawableSkinId(drawable, skin);
          renderer.updateDrawablePosition(drawable, [0, 0]);
          this._background = {skin, drawable};
        } else renderer.updateSVGSkin(this._background.skin, svg, [241, 181]);
        // createDrawable appends within the background group: above the Stage,
        // below sprites and transparent background images. Keep that group order
        // so resource disposal can remove the drawable correctly on restart.
      }
      this._orderBackgroundLayers();
      this._changed();
    }
    setBackgroundImage(args) {
      const image = this._image(args.IMAGE);
      if (!image && String(args.IMAGE) !== '') return;
      this._state().backgroundImage = image || null;
      if (!this._background && this._runtime?.renderer) this.setBackgroundColor({COLOR: this.backgroundColor()});
      this._renderBackgroundImage();this._changed();
    }
    backgroundImage() {
      const state = this._state();
      if (!state.backgroundImage) {
        state.backgroundImage = {width:160,height:120,pixels:new Uint8Array(160*120)};
        if (!this._background && this._runtime?.renderer) this.setBackgroundColor({COLOR:this.backgroundColor()});
        this._renderBackgroundImage();
      }
      return this._imageHandle(state.backgroundImage);
    }
    _renderBackgroundImage() {
      const renderer = this._runtime?.renderer;
      if (!renderer) return;
      const image = this._state().backgroundImage;
      if (!image) {
        if (this._backgroundImage) {
          renderer.destroyDrawable(this._backgroundImage.drawable,'background');renderer.destroySkin(this._backgroundImage.skin);
          this._backgroundImage = null;
        }
        this._runtime.requestRedraw?.();return;
      }
      const svg = imageEngine.svg(image.width && image.height ? image : {width:1,height:1,pixels:new Uint8Array(1)},this._imagePalette(image));
      const center = [image.width*2,image.height*2];
      if (!this._backgroundImage) {
        const skin = renderer.createSVGSkin(svg,center), drawable = renderer.createDrawable('background');
        renderer.updateDrawableSkinId(drawable,skin);renderer.updateDrawableScale(drawable,[75,75]);this._backgroundImage = {skin,drawable};
      } else renderer.updateSVGSkin(this._backgroundImage.skin,svg,center);
      renderer.updateDrawablePosition(this._backgroundImage.drawable,[(image.width/2-80)*3,(60-image.height/2)*3]);
      this._orderBackgroundLayers();
      this._runtime.requestRedraw?.();
    }
    _orderBackgroundLayers() {
      const renderer = this._runtime?.renderer;
      if (!renderer?.setDrawableOrder || !renderer?.getDrawableOrder) return;
      const layers = [this._background, this._backgroundImage, this._tilemapDrawable].filter(Boolean);
      const orders = layers.map(layer => renderer.getDrawableOrder(layer.drawable));
      if (!orders.length || orders.some(order => !Number.isInteger(order) || order < 0)) return;
      // RenderWebGL computes the group end before removing the moved drawable.
      // Its Infinity order can consequently insert into the following group.
      // A current member's maximum index stays inside the original group.
      const last = Math.max(...orders);
      for (const layer of layers) renderer.setDrawableOrder(layer.drawable, last, 'background');
    }
    _clearBackground() {
      const renderer = this._runtime?.renderer;
      if (this._backgroundImage) {
        renderer?.destroyDrawable(this._backgroundImage.drawable,'background');renderer?.destroySkin(this._backgroundImage.skin);this._backgroundImage = null;
      }
      if (!this._background) return;
      renderer?.destroyDrawable(this._background.drawable, 'background');
      renderer?.destroySkin(this._background.skin);
      this._background = null;
    }
    _clearSpeech(id, util, discard = false) {
      const entry = this._speech.get(id);
      if (!entry) return;
      entry.util=util;
      const work=discard ? undefined : entry.renderer.destroy();
      const renderer = this._runtime?.renderer;
      if (entry.drawableId !== undefined) renderer?.destroyDrawable(entry.drawableId, 'sprite');
      if (entry.skinId !== undefined) renderer?.destroySkin(entry.skinId);
      this._speech.delete(id);
      if (this._state().speech) delete this._state().speech[id];
      return work;
    }
    _renderSpeech(id, entry, owner, dt) {
      const camera=this._camera(),relative=!!(owner.flags & spriteFlags.RelativeToCamera);
      const view={...owner,x:owner.x-(relative?0:camera.drawOffsetX),y:owner.y-(relative?0:camera.drawOffsetY)};
      entry.raster=this._speechEngine.renderRaster(entry.renderer,entry.legacy ? owner : view,
        this._globalElapsedMs,dt,entry.legacy ? camera : undefined);
      if(entry.nativeBubbleId) {
        const bubble=this._spriteValues.get(entry.nativeBubbleId);
        if(bubble && !bubble._destroyed){this._refreshImage(bubble.image);this._positionSprite(bubble.id);}
        return;
      }
      const pixels=entry.raster.pixels;
      const renderer = this._runtime?.renderer;
      if (!renderer) return;
      const paths = Array.from({length: 16}, () => []);
      for (let y = 0; y < 120; y++) for (let x = 0; x < 160;) {
        const color = pixels[y * 160 + x];
        const start = x++;
        while (x < 160 && pixels[y * 160 + x] === color) x++;
        if (color) paths[color].push('M' + start + ' ' + y + 'h' + (x - start) + 'v1h-' + (x - start) + 'z');
      }
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" shape-rendering="crispEdges">' +
        paths.map((path, color) => path.length ? '<path fill="' + this._paletteColors()[color] + '" d="' + path.join('') + '"/>' : '').join('') + '</svg>';
      if (entry.skinId === undefined) {
        entry.skinId = renderer.createSVGSkin(svg, [80, 60]);
        entry.drawableId = renderer.createDrawable('sprite');
        renderer.updateDrawableSkinId(entry.drawableId, entry.skinId);
        renderer.updateDrawablePosition(entry.drawableId, [0, 0]);
        renderer.updateDrawableScale(entry.drawableId, [300, 300]);
      } else if (entry.svg !== svg) renderer.updateSVGSkin(entry.skinId, svg, [80, 60]);
      entry.svg = svg;
      renderer.updateDrawableVisible(entry.drawableId, entry.target?.visible !== false);
      if (entry.target?.drawableID !== undefined) {
        renderer.setDrawableOrder(entry.drawableId, renderer.getDrawableOrder(entry.target.drawableID) + 1, 'sprite');
      }
    }
    *_advanceSpeechSteps(dt,only) {
      // PXT speech deadlines and animation time use control.millis/game.runtime,
      // which continue while the owning scene is suspended.
      const now = this._globalElapsedMs, state = this._state();
      for (const [id, entry] of this._speech) {
        if(only!==undefined ? id!==only : state.sprites[id]===this._spriteValues.get(id))continue;
        const owner = this._speechOwner(id, entry.target);
        if (!owner || entry.end !== null && now + 1e-6 >= entry.end) {
          const work=this._clearSpeech(id);if(work && typeof work.then==='function')yield work;
          if(this._state()!==state)return;
        }
        else this._renderSpeech(id, entry, owner, dt);
      }
    }
    _emitSpriteHat(opcode, fields, first, second, destroyedSprite) {
      if (!this._runtime || !this._runtime.startHats) return;
      const event = {first, second, destroyedSprite, ...fields};
      // startHats drops a second event when the same hat already has a live
      // thread. Arcade destruction and overlap callbacks must run once per
      // occurrence, including two sprites destroyed in one VM frame. Create
      // one thread per event; its hat predicate reads this thread's snapshot.
      if (this._runtime.allScriptsByOpcodeDo && this._runtime._pushThread) {
        this._runtime.allScriptsByOpcodeDo(opcode, (script, target) => {
          const thread = this._runtime._pushThread(script.blockId, target);
          thread.bwArcadeEvent = event;
        });
        return;
      }
      // Older hosts retain the ordinary Scratch dispatch as a fallback.
      const previous = this._currentEvent;
      this._currentEvent = event;
      let threads;
      try { threads = this._runtime.startHats(opcode) || []; }
      finally { this._currentEvent = previous; }
      for (const thread of threads) thread.bwArcadeEvent = event;
    }
    _pumpCreationWaits() {
      const runtime = this._runtime;
      for (const pending of this._creationWaits) {
        const failure=pending.failure?.(pending.thread);if(failure){this._creationWaits.delete(pending);pending.reject(failure);continue;}
        if (pending.thread && runtime.threads.includes(pending.thread) &&
            !pending.thread.isKilled && pending.thread.status !== pending.thread.constructor.STATUS_DONE) continue;
        const next = pending.handlers.shift();
        if (next) {
          pending.thread = runtime._pushThread(next.script.blockId, next.target);
          pending.thread.bwArcadeEvent = {...pending.event, TOKEN: next.token};
          pending.thread.bwArcadeCaptures = next.captures;
          if(next.captures){
            try{exceptionOwners.get(this).bindStructuredRegistration(next,pending.thread);}
            catch(error){runtime.sequencer.retireThread(pending.thread);this._creationWaits.delete(pending);pending.reject(error);}
          }
        } else {
          this._creationWaits.delete(pending);
          pending.resolve(pending.id);
        }
      }
    }
    _finishSpriteCreation(id, util, creationContext = null) {
      const sprite = (creationContext?.state || this._state()).sprites[id] || this._spriteValues.get(id), runtime = this._runtime,creationKind=sprite._creationKind;
      // Original create filters callbacks using its supplied argument, not the
      // constructor's -1 fallback for an absent kind.
      if(creationKind==null)return id;
      if (!runtime?.allScriptsByOpcodeDo || !runtime?._pushThread || !Array.isArray(runtime.threads)) {
        this._emitSpriteHat('arcade_whenSpriteCreated', {KIND: creationKind}, id, '');
        return id;
      }
      const handlers = [];
      runtime.allScriptsByOpcodeDo('arcade_whenSpriteCreated', (script, target) => {
        const hat = target.blocks.getBlock(script.blockId);
        const kindBlock = target.blocks.getBlock(hat.inputs?.KIND?.block);
        const fixedKind = kindBlock?.opcode === 'text' ? kindBlock.fields.TEXT?.value : null;
        if (fixedKind === null || this._kindValue(fixedKind) === creationKind) handlers.push({script, target});
      });
      // Snapshot registrations when creation starts, as PXT does before
      // invoking callbacks. Repeated registrations retain separate closures.
      for (const registration of (creationContext?.handlers || this._createdHandlers).filter(h => h.kind === creationKind)) {
        runtime.allScriptsByOpcodeDo('arcade_whenRegisteredCreated', (script, target) => {
          const hat = target.blocks.getBlock(script.blockId);
          const tokenBlock = target.blocks.getBlock(hat.inputs?.TOKEN?.block);
          if (tokenBlock?.fields?.TEXT?.value === registration.token) handlers.push({script, target, ...registration});
        });
      }
      if (!handlers.length) return id;
      const event = {first: id, second: '', KIND: creationKind};
      let thread;
      // Fast callbacks execute in the same fiber turn. The VM's BlockUtility
      // is shared, so restore its caller context after every nested execution.
      if (util?.thread && util.sequencer === runtime.sequencer) {
        const caller = util.thread, sequencer = util.sequencer;
        while (handlers.length) {
          const next = handlers.shift();
          thread = runtime._pushThread(next.script.blockId, next.target);
          thread.bwArcadeEvent = {...event, TOKEN: next.token};thread.bwArcadeCaptures = next.captures;
          if(next.captures){
            try{exceptionOwners.get(this).bindStructuredRegistration(next,thread);}
            catch(error){runtime.sequencer.retireThread(thread);throw error;}
          }
          const activeThread = sequencer.activeThread;
          try { if(creationContext?.stepNested)creationContext.stepNested(thread);else {sequencer.activeThread = thread;dependencies.primitiveOwner.stepChild(runtime,thread,()=>sequencer.stepThread(thread));} }
          finally { util.thread = caller;util.sequencer = sequencer;sequencer.activeThread = activeThread; }
          const failure=creationContext?.failure?.(thread);if(failure)throw failure;
          if (!runtime.threads.includes(caller)) { sequencer.retireThread(caller);return ''; }
          if (thread.status !== thread.constructor.STATUS_DONE && !thread.isKilled && runtime.threads.includes(thread)) break;
          thread = null;
        }
        if (!thread) return id;
      }
      return new Promise((resolve,reject) => {
        this._creationWaits.add({id, resolve, reject, handlers, thread, event, failure:creationContext?.failure});
        this._pumpCreationWaits();
      });
    }
    createSprite(args, util) {
      const width = Math.max(1, Number(args.WIDTH) || 16), height = Math.max(1, Number(args.HEIGHT) || 16);
      return this._finishSpriteCreation(this._createSprite({...args, WIDTH:width, HEIGHT:height, X: ((160-width) >> 1) + width/2,
        Y: ((120-height) >> 1) + height/2}), util);
    }
    createImageSprite(args, util) {
      if(this._missingOperand(util,args,'IMAGE'))return this._primitiveFault('createImageSprite',args,util);
      const image = this._image(args.IMAGE);
      if(!image){this._runtime?.emit?.('BLOCKS_ERROR','Sprite image cannot be undefined or null');return ''; }
      // Image dimensions are constructor data: zero is a genuine empty image.
      const width=image.width,height=image.height;
      return this._finishSpriteCreation(this._createSprite({...args,WIDTH:width,HEIGHT:height,
        X:((160-width)>>1)+width/2,Y:((120-height)>>1)+height/2}),util);
    }
    createOwnedImageSprite(args,util) {
      const owner=ownedSpriteOwners.get(this),exceptions=exceptionOwners.get(this);
      let token;
      const caller=util?.thread,target=util?.target||caller?.target,epoch=this._terrainEpoch;
      const failed=error=>{if(token)owner.abort(token);exceptions.rethrow(error);
        if(epoch!==this._terrainEpoch||caller&&(caller.isKilled||!this._runtime.threads.includes(caller)))return Scratch.BWValues.UNDEFINED;
        return this._objectError(error);};
      try {
        const factoryBlock=dependencies.primitiveOwner.current(util,args);
        if(factoryBlock?.opcode!=='arcade_createOwnedImageSprite')throw new Error('Owned SDK Sprite factory requires its current physical primitive');
        dependencies.cachedPrimitiveOwner(this._runtime,util,args,'arcade_createOwnedImageSprite',[]);
        const container=util.thread.blockContainer,templateInput=factoryBlock.inputs?.TEMPLATE,
          literal=container.getBlock(templateInput?.block),cached=literal&&container._cache?._executeCached?.[literal.id];
        if(!templateInput||templateInput.block!==templateInput.shadow||literal?.opcode!=='text'||literal.parent!==factoryBlock.id||
          Object.keys(literal.inputs||{}).length||typeof args.TEMPLATE!=='string'||literal.fields?.TEXT?.value!==args.TEMPLATE||
          cached?.id!==literal.id||cached.opcode!=='text'||cached.fields!==literal.fields||cached.inputs!==container.getInputs(literal)||
          cached._isShadowBlock!==true||cached._shadowValue!==args.TEMPLATE||cached._parentValues!==args||cached._parentKey!=='TEMPLATE')
          throw new Error('Owned SDK Sprite factory requires its actual literal TEMPLATE shadow');
        const image=args.IMAGE,template=args.TEMPLATE,kind=Scratch.BWValues.decode(dependencies.currentNumberInput(this._runtime,args,util,'arcade_createOwnedImageSprite','KIND'));
        if(typeof template!=='string'||typeof kind!=='number'||!Number.isFinite(kind))throw new Error('Owned SDK Sprite factory requires actual template String and Number kind');
        const body=sdkImageOwners.get(this).body(image),stableUtil={thread:caller,target,sequencer:util.sequencer};
        token=owner.begin(image,stableUtil);
        const width=body.width,height=body.height;
        const id=this._createSprite({IMAGE:image,TEMPLATE:template,KIND:kind,WIDTH:width,HEIGHT:height,X:((160-width)>>1)+width/2,Y:((120-height)>>1)+height/2});
        owner.allocated(token,id);
        const complete=result=>{const failure=exceptions.failure(caller);if(failure)throw failure;return owner.complete(token,result);};
        const result=this._finishSpriteCreation(id,stableUtil,{failure:thread=>exceptions.failure(thread),stepNested:thread=>dependencies.primitiveOwner.stepNested(util,args,thread)});
        return result&&typeof result.then==='function'?result.then(complete).catch(failed):complete(result);
      } catch(error) {return failed(error);}
    }
    // Arcade stores edges, velocity and acceleration as signed 24.8 values.
    // Keep the actual object in fixed point: reads, image resizing and subsequent
    // writes must all observe the same storage, including after destruction.
    _installSpriteFixedPoint(sprite) {
      const x = sprite.x, y = sprite.y;
      sprite._fx = ((x - sprite.width/2) * 256) | 0;
      sprite._fy = ((y - sprite.height/2) * 256) | 0;
      sprite._imageWidth=sprite.width;sprite._imageHeight=sprite.height;sprite._sx=256;sprite._sy=256;
      const extension=this;
      for(const [property,storage] of [['sx','_sx'],['sy','_sy']])Object.defineProperty(sprite,property,{enumerable:true,configurable:true,
        get(){return this[storage]/256;},set(value){const x=this.x,y=this.y;this[storage]=(Math.max(0,Number(value))*256)|0;extension._recalcSpriteSize(this);this.y=y;this.x=x;}});
      Object.defineProperty(sprite,'scale',{enumerable:true,configurable:true,get(){return Math.max(this.sx,this.sy);},set(value){this.sy=value;this.sx=value;}});
      // PXT Sprite.rotation (radians): the first rotation gives the sprite a
      // rotated bounding box, whose axis-aligned size becomes its width and
      // height; the center stays put. The box is not enumerable: it points back
      // at the sprite, and a destroyed sprite's {...copy} must not carry it.
      Object.defineProperty(sprite,'rotation',{enumerable:true,configurable:true,
        get(){return this._rotatedBBox?this._rotatedBBox.rotation:0;},
        set(value){const x=this.x,y=this.y;
          if(!this._rotatedBBox)Object.defineProperty(this,'_rotatedBBox',{enumerable:false,configurable:true,writable:true,value:new RotatedBoundingBox(this,this.width,this.height)});
          this._rotatedBBox.setRotation(Number(value)||0);extension._recalcSpriteSize(this);this.x=x;this.y=y;}});
      Object.defineProperty(sprite,'rotationDegrees',{enumerable:true,configurable:true,
        get(){return this.rotation*180/Math.PI;},set(value){this.rotation=Number(value)*Math.PI/180;}});
      // PXT lazily replaces any falsy stored data with a new object.
      Object.defineProperty(sprite,'data',{enumerable:true,configurable:true,
        get(){if(!Scratch.BWValues.truth(this._data))this._data={};return this._data;},
        set(value){this._data=value;}});
      for (const axis of ['x', 'y']) {
        const storage = axis === 'x' ? '_fx' : '_fy', size = axis === 'x' ? 'width' : 'height';
        Object.defineProperty(sprite, axis, {enumerable:true, configurable:true,
          get() {
            // Fx.div shifts its dividend before dividing. Retain that signed
            // overflow for huge dimensions; the renderer still uses actual edges.
            const half=((((this[size]*256)|0)<<8)/512)|0;
            return ((this[storage]+half)|0)/256;
          },
          set(value) { this[storage] = ((Number(value) - this[size]/2) * 256) | 0; }});
      }
      for (const property of ['vx', 'vy', 'ax', 'ay']) {
        const storage = '_' + property;
        sprite[storage] = (Number(sprite[property]) * 256) | 0;
        Object.defineProperty(sprite, property, {enumerable:true, configurable:true,
          get() {return this[storage] / 256;}, set(value) {this[storage] = (Number(value) * 256) | 0;}});
      }
      for(const [property,storage] of [['fx','_frictionX'],['fy','_frictionY']]){
        sprite[storage]=(Math.max(0,Number(sprite[property]))*256)|0;
        Object.defineProperty(sprite,property,{enumerable:true,configurable:true,
          get(){return this[storage]/256;},set(value){this[storage]=(Math.max(0,Number(value))*256)|0;}});
      }
    }
    _recalcSpriteSize(sprite) {
      if(sprite._rotatedBBox){
        // PXT recalcSize: the rotated box takes the scaled image size, and the
        // sprite's size is the box's (an integer).
        sprite._rotatedBBox.setDimensions(sprite._imageWidth*sprite.sx,sprite._imageHeight*sprite.sy);
        sprite.width=sprite._rotatedBBox.width;sprite.height=sprite._rotatedBBox.height;
      } else {
        sprite.width=(((sprite._imageWidth*sprite.sx)*256)|0)/256;
        sprite.height=(((sprite._imageHeight*sprite.sy)*256)|0)/256;
      }
      delete sprite._wallHitbox;
    }
    *_setSpriteScalePropertySteps(sprite,property,value,util){
      const epoch=this._terrainEpoch;if(this._spriteValues.get(sprite.id)!==sprite)return;
      if(property==='scale'){yield* this._setSpriteScalePropertySteps(sprite,'sy',value,util);if(epoch!==this._terrainEpoch)return;yield* this._setSpriteScalePropertySteps(sprite,'sx',value,util);return;}
      const oldX=sprite._fx,oldY=sprite._fy;sprite[property]=value;
      const desiredX=sprite._fx,desiredY=sprite._fy;sprite._fx=oldX;sprite._fy=oldY;
      yield* this._moveSpriteExplicitSteps(sprite,0,(desiredY-sprite._fy)|0,util);
      if(epoch!==this._terrainEpoch)return;
      yield* this._moveSpriteExplicitSteps(sprite,(desiredX-sprite._fx)|0,0,util);
    }
    setSpriteScaleCore(args,util) {
      const sprite=this._spriteValues.get(String(args.ID)) || this._sprite(args.ID);if(!sprite)return;
      const epoch=this._terrainEpoch;
      const finish=()=>{if(epoch!==this._terrainEpoch || this._spriteValues.get(sprite.id)!==sprite)return;this._renderSpriteImageIfPresent(sprite);this._positionSprite(sprite.id);this._changed();};
      const work=this._runTerrainGenerator(this._setSpriteScaleCoreSteps(sprite,args,util));return work?.then?work.then(finish):finish();
    }
    *_setSpriteScaleCoreSteps(sprite,args,util){
      const epoch=this._terrainEpoch;
      const sx=Scratch.BWValues.decode(args.SX),sy=Scratch.BWValues.decode(args.SY),anchor=Number(args.ANCHOR)||0;
      const hasX=sx!=null,hasY=sy!=null,oldW=sprite.width,oldH=sprite.height;
      if(hasX){const old=sprite.sx;yield* this._setSpriteScalePropertySteps(sprite,'sx',Number(sx),util);if(epoch!==this._terrainEpoch)return;if(!hasY && Scratch.Cast.toBoolean(args.PROPORTIONAL))yield* this._setSpriteScalePropertySteps(sprite,'sy',sprite.sy*Number(sx)/old,util);}
      if(hasY){const old=sprite.sy;yield* this._setSpriteScalePropertySteps(sprite,'sy',Number(sy),util);if(epoch!==this._terrainEpoch)return;if(!hasX && Scratch.Cast.toBoolean(args.PROPORTIONAL))yield* this._setSpriteScalePropertySteps(sprite,'sx',sprite.sx*Number(sy)/old,util);}
      if(epoch!==this._terrainEpoch)return;
      const dx=(sprite.width-oldW)/2,dy=(sprite.height-oldH)/2;
      if(anchor&2)yield* this._moveSpriteExplicitSteps(sprite,(dx*256)|0,0,util);
      if(epoch!==this._terrainEpoch)return;
      if(anchor&4)yield* this._moveSpriteExplicitSteps(sprite,(-dx*256)|0,0,util);
      if(epoch!==this._terrainEpoch)return;
      if(anchor&1)yield* this._moveSpriteExplicitSteps(sprite,0,(dy*256)|0,util);
      if(epoch!==this._terrainEpoch)return;
      if(anchor&8)yield* this._moveSpriteExplicitSteps(sprite,0,(-dy*256)|0,util);
    }
    setSpriteScale(args,util){return this.setSpriteScaleCore({...args,SX:Number(args.VALUE),SY:Number(args.VALUE)},util);}
    changeSpriteScale(args,util){const s=this._spriteValues.get(String(args.ID)) || this._sprite(args.ID);if(s)return this.setSpriteScaleCore({...args,SX:s.sx+Number(args.VALUE),SY:s.sy+Number(args.VALUE)},util);}
    _renderSpriteImageIfPresent(sprite){
      if(!this._sprite(sprite.id))return;
      if(!sprite.image && this._state().spriteTargets[sprite.id])this._imageForSprite(sprite.id,{quiet:true});
      if(sprite.image)this._renderSpriteImage(sprite.id);
    }
    setSpritePosition(args, util) {
      const epoch=this._terrainEpoch;
      if(this._missingOperand(util,args,'ID'))return this._primitiveFault('setSpritePosition',args,util);
      const sprite = this._spriteValues.get(String(args.ID)) || this._sprite(args.ID);
      if (!sprite) return;
      // Sprite.setPosition converts the displacement, not the absolute edge.
      const dx = ((Number(args.X) - sprite.x) * 256) | 0;
      const dy = ((Number(args.Y) - sprite.y) * 256) | 0;
      const result = this._moveSpriteExplicit(sprite, dx, dy, util);
      const finish = () => {if(epoch!==this._terrainEpoch || this._spriteValues.get(sprite.id)!==sprite)return;this._positionSprite(String(args.ID));this._changed();};
      return result?.then ? result.then(finish) : finish();
    }
    spawnSprite(args, util) {
      // The positioned factory is constructor + setPosition, just as exported
      // TypeScript is. Creation callbacks see the constructor's center first.
      const epoch=this._terrainEpoch,created = this.createSprite(args, util);
      const position = id => {if(epoch!==this._terrainEpoch)return "";const moved=this.setSpritePosition({ID:id, X:args.X, Y:args.Y},util);return moved?.then ? moved.then(()=>id) : id;};
      return created && typeof created.then === 'function' ? created.then(position) : position(created);
    }
    _reserveSdkSprite() {const id=dependencies.sdkSpriteClasses.allocateHandle();this._spriteValues.set(id,{id,_sdkBaseOnly:true});return id;}
    _registerSdkSprite(id,util) {const sprite=this._spriteValues.get(id),state=this._state();if(sprite._sdkRegistered)throw new Error('SDK BaseSprite was registered twice');spriteUpdateHosts.get(this).register(sprite,util,state);sprite._sdkRegistered=true;sprite._sdkScene=state;sprite.pxtId=state.nextSpriteId++;state.sprites[id]=sprite;this._sceneFlags.register(state,sprite);}
    _initializeSdkSprite(id,image) {const sprite=this._spriteValues.get(id),width=image.width,height=image.height;sprite._sdkBaseOnly=false;Object.assign(sprite,{x:((160-width)>>1)+width/2,y:((120-height)>>1)+height/2,vx:0,vy:0,ax:0,ay:0,fx:0,fy:0,width,height,flags:0});this._installSpriteFixedPoint(sprite);sprite._creationKind=null;}
    _spriteKindSets(state=this._state()) {if(!state._nativeKindSets){state._nativeKindSets=new Map();for(const sprite of Object.values(state.sprites))if(sprite.kind>=0){if(!state._nativeKindSets.has(sprite.kind))state._nativeKindSets.set(sprite.kind,[]);state._nativeKindSets.get(sprite.kind).push(sprite);}}return state._nativeKindSets;}
    _addSpriteKind(sprite,kind,state=this._state()) {if(!(kind>=0))return;const sets=this._spriteKindSets(state);if(!sets.has(kind))sets.set(kind,[]);if(!sets.get(kind).includes(sprite))sets.get(kind).push(sprite);}
    _createSprite(args) {
      const state = this._state(),inputKind=this._kindValue(args.KIND),kind=inputKind==null?-1:inputKind;
      const id = dependencies.sdkSpriteClasses.allocateHandle();state.nextSpriteId++;
      const sprite = {id, pxtId: state.nextSpriteId - 1, kind, _creationKind:inputKind, x: Number(args.X) || 0, y: Number(args.Y) || 0,
        vx: 0, vy: 0, ax: 0, ay: 0, fx: 0, fy: 0, z: 0, lifespan: undefined, flags: 0,
        // Public creation normalizes defaults before entering this private path;
        // native image constructors may supply genuine zero dimensions.
        width: args.WIDTH===0?0:Math.max(1,Number(args.WIDTH)||16),
        height: args.HEIGHT===0?0:Math.max(1,Number(args.HEIGHT)||16)};
      Object.defineProperty(sprite,'kindName',{enumerable:true,get:()=>this._kindRegistry.displayName(sprite.kind)});
      this._installSpriteFixedPoint(sprite);
      sprite._kindInsertion = ++this._kindInsertion;
      state.sprites[id] = sprite;
      this._sceneFlags.register(state,sprite);
      this._addSpriteKind(sprite,kind,state);
      state.physicsEngine.members.push(sprite);
      this._spriteValues.set(id, sprite);
      const template = this._runtime && this._runtime.getSpriteTargetByName &&
        this._runtime.getSpriteTargetByName(String(args.TEMPLATE));
      if (template && template.makeClone) {
        const clone = template.makeClone();
        if (clone) {
          this._runtime.addTarget(clone);
          if (clone.setVisible) clone.setVisible(true);
          state.spriteTargets[id] = clone;
          const costume = clone.getCostumes && clone.getCostumes()[clone.currentCostume];
          const size = this._costumeImageSize(costume);
          if (size && size.width === sprite.width && size.height === sprite.height) {
            // Canonical artwork uses four SVG units per Arcade pixel; the
            // Scratch stage uses three display units per Arcade pixel.
            this._scalePixelTarget(clone);
            sprite.mask = this._costumePixelMask(costume, size);
          }
          this._positionSprite(id);
          // A new clone enters Scratch's front layer; restore z order.
          this._orderSpriteDrawables();
        }
      }
      if (args.IMAGE) this.setSpriteImage({ID: id, IMAGE: args.IMAGE});
      else if (this._projectPalette) this._renderSpriteImageIfPresent(sprite);
      if (state.tilemap) this._setSpriteClipping(sprite,this._spriteOnWall(sprite,state.tilemap));
      this._changed();
      return id;
    }
    spawnProjectile(args, util) {
      const epoch=this._terrainEpoch;
      args = {...args, KIND:this._kindValue(args.KIND) || this._kindRegistry.builtin('Projectile')};
      // PXT creates at the scene center, runs creation handlers, then applies
      // projectile motion and edge/source placement using the resulting size.
      const created = this.createSprite({TEMPLATE: args.TEMPLATE, KIND: args.KIND,
        X: 80, Y: 60, WIDTH: args.WIDTH, HEIGHT: args.HEIGHT, IMAGE: args.IMAGE}, util);
      const finish = id => {
        if(epoch!==this._terrainEpoch)return "";
        const state=this._state();
        // Creation handlers can destroy either reference or change the current
        // scene. PXT still finalizes the actual allocated projectile object.
        const sprite = this._spriteValues.get(id) || state.sprites[id];
        if (!sprite) return id;
        const vx = Number(args.VX) || 0, vy = Number(args.VY) || 0;
        const xOffset = state.tilemap ? -(sprite.width >> 1) : (sprite.width >> 1) - 1;
        const yOffset = state.tilemap ? -(sprite.height >> 1) : (sprite.height >> 1) - 1;
        const sourceId=String(args.SOURCE),source=this._spriteValues.get(sourceId) || state.sprites[sourceId];
        const fromSprite = ['sprite', 'kind-source'].includes(String(args.MODE)) && source;
        const camera=this._camera();
        sprite.vx = vx; sprite.vy = vy;
        sprite.x = fromSprite ? source.x : camera.offsetX+(vx < 0 ? 160 + xOffset : vx > 0 ? -xOffset : 0);
        sprite.y = fromSprite ? source.y : camera.offsetY+(vy < 0 ? 120 + yOffset : vy > 0 ? -yOffset : 0);
        sprite.flags |= spriteFlags.AutoDestroy | spriteFlags.DestroyOnWall;
        this._syncSpriteFlagState(sprite);
        // StayInScreen/BounceOnWall apply in physics, after authored creation
        // returns; projectile placement does not introduce an extra clamp.
        this._positionSprite(id); this._changed();
        return id;
      };
      return created && typeof created.then === 'function' ? created.then(finish) : finish(created);
    }
    registerInstanceOverlapHandler(args,util) {
      const sprite=this._spriteValues.get(String(args.ID)) || this._state().sprites[String(args.ID)];if(!sprite)return;
      sprite._overlapRegistration=this._handlerRegistration(args,util);
    }
    whenRegisteredInstanceOverlap(args,util) {return this.whenRegisteredWall(args,util);}
    *_instanceOverlapSteps(receiver,other) {
      const clock=this._sourceSceneTimers()?this._programClockEpoch:null;
      yield new Promise(resolve=>(clock?clock.setTimeout:setTimeout)(resolve,0));
      if(this._terrainStopped || this._spriteValues.get(receiver.id)!==receiver)return false;
      // The historical SDK reads the replacing slot when the fiber starts.
      const registration=receiver._overlapRegistration;if(!registration)return false;
      return yield* this._registeredCallbackSteps([registration],'arcade_whenRegisteredInstanceOverlap',
        {first:receiver.id,second:other.id},undefined,false);
    }
    registerInstanceDestroyedHandler(args,util) {
      const id=String(args.ID),state=this._state();
      const sprite=this._spriteValues.get(id) || state.sprites[id];if(!sprite)return;
      (state.spriteDestroyedHandlers ||= {})[id]=this._handlerRegistration(args,util);
      sprite._destroyedRegistration=state.spriteDestroyedHandlers[id];
    }
    whenRegisteredInstanceDestroyed(args,util) {return this.whenRegisteredWall(args,util);}
    *_instanceDestroyedSteps(registration,kind,id,util) {
      const epoch=this._terrainEpoch;
      if(registration && typeof registration==='object')yield* this._registeredCallbackSteps([registration],'arcade_whenRegisteredInstanceDestroyed',{first:id},util);
      if(epoch!==this._terrainEpoch)return;
      yield* this._registeredCallbackSteps(this._destroyedHandlers.filter(h=>h.kind===kind),'arcade_whenRegisteredKindDestroyed',{first:id},util);
    }
    registerSpriteDestroyed(args) {
      const id = String(args.ID);
      const state = this._state();
      const sprite=this._spriteValues.get(id) || state.sprites[id];if(!sprite)return;
      if (!state.spriteDestroyedHandlers) state.spriteDestroyedHandlers = {};
      state.spriteDestroyedHandlers[id] = String(args.TOKEN);
      sprite._destroyedRegistration=state.spriteDestroyedHandlers[id];
    }
    destroySprite(args,util) {
      const id = String(args.ID);
      const state = this._state();
      const sprite = this._spriteValues.get(id) || state.sprites[id];
      if (!sprite || !args._core && (sprite.flags & 2)) return;
      // PXT Sprite.destroy() returns once the Destroyed flag is set; only the
      // lifespan expiry (_destroyCore) completes an effect destruction.
      sprite.flags=(sprite.flags|0)|2;
      sprite._destroyed=true;
      const members=state.physicsEngine.members,index=members.indexOf(sprite);if(index>=0)members.splice(index,1);
      if(this._speech.get(id)?.nativeBubbleId) {
        // Original PXT removes the owner without destroying its independent
        // legacy bubble. It stops receiving owner speech updates and expiry.
        this._speech.delete(id);if(state.speech)delete state.speech[id];
      }else this._clearSpeech(id,util);
      this._clearImage(id);
      const target = state.spriteTargets[id];
      if (target && this._runtime && this._runtime.disposeTarget) {
        this._runtime.disposeTarget(target);
        if (this._runtime.stopForTarget) this._runtime.stopForTarget(target);
      }
      delete state.spriteTargets[id];
      this._sceneFlags.remove(state,sprite);
      delete state.sprites[id];
      const token = sprite._destroyedRegistration ?? state.spriteDestroyedHandlers?.[id];
      if (state.spriteDestroyedHandlers) delete state.spriteDestroyedHandlers[id];
      if (typeof token==='string') this._emitSpriteHat('arcade_whenRegisteredDestroyed', {TOKEN: token}, id, '', {...sprite});
      this._emitSpriteHat('arcade_whenSpriteDestroyed', {KIND: sprite.kind}, id, '', {...sprite});
      this._changed();
      return this._runTerrainGenerator(this._instanceDestroyedSteps(token,sprite.kind,id,util));
    }
    setSpriteProperty(args, util) {
      const epoch=this._terrainEpoch;
      if(this._missingOperand(util,args,'ID') && ['x','y','left','right','top','bottom','vx','vy','ax','ay','fx','fy','sx','sy','scale','width','height','z','lifespan','rotation','rotationDegrees','data','flags'].includes(String(args.PROPERTY)))return this._primitiveFault('setSpriteProperty',args,util);
      const sprite = this._spriteValues.get(String(args.ID)) || this._sprite(args.ID);
      const name = String(args.PROPERTY);
      if (!sprite || !['x', 'y', 'left', 'right', 'top', 'bottom',
        'vx', 'vy', 'ax', 'ay', 'fx', 'fy', 'sx', 'sy', 'scale', 'width', 'height', 'z', 'lifespan',
        'rotation', 'rotationDegrees', 'data', 'flags'].includes(name)) return;
      // PXT Sprite.data holds any value; it is stored as given, not as a number.
      if (name === 'data') { sprite.data = args.VALUE; this._changed(); return; }
      if(name==='flags'){
        sprite.flags=this._mathArgument(args,'VALUE',util,'Arcade sprite flags require a primitive value');
        this._syncSpriteFlagState(sprite);this._updateSpriteFlagVisibility(sprite);this._positionSprite(sprite.id);this._changed();return;
      }
      if(name==='z'){
        const value=this._mathArgument(args,'VALUE',util,'Arcade sprite z requires a primitive value');
        if(sprite.z!==value){sprite.z=value;this._sceneFlags.dirty(this._state());this._particleOrderDirty=true;}
        this._orderSpriteDrawables();this._changed();return;
      }
      const value = Number(args.VALUE);
      if(['sx','sy','scale'].includes(name)){
        const finish=()=>{if(epoch!==this._terrainEpoch || this._spriteValues.get(sprite.id)!==sprite)return;this._renderSpriteImageIfPresent(sprite);this._positionSprite(sprite.id);this._changed();};
        const work=this._runTerrainGenerator(this._setSpriteScalePropertySteps(sprite,name,value,util));return work?.then?work.then(finish):finish();
      }
      const oldX = sprite._fx, oldY = sprite._fy;
      if (!Number.isFinite(value) && !['x','y','left','right','top','bottom','vx','vy','ax','ay','fx','fy','sx','sy','scale'].includes(name)) return;
      if (name === 'left') sprite._fx = (value * 256) | 0;
      else if (name === 'right') sprite._fx = ((value - sprite.width) * 256) | 0;
      else if (name === 'top') sprite._fy = (value * 256) | 0;
      else if (name === 'bottom') sprite._fy = ((value - sprite.height) * 256) | 0;
      else sprite[name] = name === 'width' || name === 'height' ? Math.max(1, value) : value;
      let moved;
      if (['x','y','left','right','top','bottom'].includes(name) && this._state().tilemap) {
        const dx = (sprite._fx - oldX) | 0, dy = (sprite._fy - oldY) | 0;
        sprite._fx = oldX; sprite._fy = oldY;moved=this._moveSpriteExplicit(sprite, dx, dy, util);
      }
      const finish = () => {
        if(epoch!==this._terrainEpoch || this._spriteValues.get(sprite.id)!==sprite)return;
        if(['sx','sy','scale','rotation','rotationDegrees'].includes(name))this._renderSpriteImageIfPresent(sprite);
        this._clampSprite(sprite);
        if (['sx','sy','scale','rotation','rotationDegrees','x', 'y', 'left', 'right', 'top', 'bottom'].includes(name)) this._positionSprite(String(args.ID));
        this._changed();
      };
      return moved?.then ? moved.then(finish) : finish();
    }
    isHittingTile(args) {
      const sprite = this._spriteValues.get(String(args.ID));
      return !!sprite?._wallObstacles?.[Number(args.DIRECTION)];
    }
    _wallHitbox(sprite) {
      // PXT game.calculateHitBox: a rotated sprite's hitbox is its whole box.
      if(sprite._rotatedBBox)return {left:0,top:0,width:sprite.width,height:sprite.height};
      const image = this._imageForSprite(sprite.id, {quiet: true}), pixels = image?.pixels || sprite.mask;
      let left = 0, top = 0, right = sprite._imageWidth - 1, bottom = sprite._imageHeight - 1;
      if (pixels) {
        left = sprite._imageWidth; top = sprite._imageHeight; right = 0; bottom = 0;
        for (let y = 0; y < sprite._imageHeight; y++) for (let x = 0; x < sprite._imageWidth; x++) {
          if (!pixels[y * sprite._imageWidth + x]) continue;
          left = Math.min(left, x);right = Math.max(right, x);top = Math.min(top, y);bottom = Math.max(bottom, y);
        }
        // PXT retains its degenerate min=size/max=0 box for completely
        // blank artwork; its forward wall probes still observe that box.
      }
      // Fx.mul wraps its 32-bit product BEFORE shifting back to 24.8.
      // Multiply min/max separately: combining the extent changes overflow.
      const minX=Math.imul((left*256)|0,sprite._sx)>>8,maxX=Math.imul((right*256)|0,sprite._sx)>>8;
      const minY=Math.imul((top*256)|0,sprite._sy)>>8,maxY=Math.imul((bottom*256)|0,sprite._sy)>>8;
      const width=(maxX-minX+sprite._sx)/256,height=(maxY-minY+sprite._sy)/256;
      left=Math.floor(minX/256);top=Math.floor(minY/256);
      const fresh = {left, top, width, height};
      const cached = sprite._wallHitbox;
      // PXT keeps changes of at most two pixels on each axis to prevent
      // animated artwork jittering into walls. Image replacement resets it.
      if (cached) {
        if (Math.abs(cached.left-left)+Math.abs(cached.left+cached.width-left-fresh.width) <= 2) {
          fresh.left = cached.left;fresh.width = cached.width;
        }
        if (Math.abs(cached.top-top)+Math.abs(cached.top+cached.height-top-fresh.height) <= 2) {
          fresh.top = cached.top;fresh.height = cached.height;
        }
      }
      sprite._wallHitbox = fresh;return fresh;
    }
    _wallAt(map, column, row) {
      map=this._state().tilemap;if(!map || (map.legacy && !map.mapImage))return false;
      return column < 0 || row < 0 || column >= map.columns || row >= map.rows || !!map.walls[row*map.columns+column];
    }
    _spriteOnWall(sprite, map) {
      const box = this._wallHitbox(sprite);if (!box) return false;
      const size = map.tileSize * 256;
      const left = Math.floor((sprite._fx+box.left*256)/size), top = Math.floor((sprite._fy+box.top*256)/size);
      const right = Math.floor((sprite._fx+(box.left+box.width-1)*256)/size), bottom = Math.floor((sprite._fy+(box.top+box.height-1)*256)/size);
      for (let x=left;x<=right;x++) for (let y=top;y<=bottom;y++) if (this._wallAt(map,x,y)) return true;
      return false;
    }
    _resolveSpriteClipping(sprite, map) {
      if (sprite.flags & spriteFlags.GhostThroughWalls) return false;
      const box = this._wallHitbox(sprite);if (!box) return true;
      const x = sprite._fx, y = sprite._fy, size = map.tileSize,maxMove=(this._state().physicsEngine.maxSingleStep+128)>>8;
      const left = Math.floor(x/256+box.left+.5), right = Math.floor(x/256+box.left+box.width-1+.5);
      const top = Math.floor(y/256+box.top+.5), bottom = Math.floor(y/256+box.top+box.height-1+.5);
      const offsets = [[0,-((bottom+1)%size)], [0,(Math.floor(top/size)+1)*size-top],
        [-((right+1)%size),0], [(Math.floor(left/size)+1)*size-left,0]];
      for (const [dx,dy] of offsets) {
        if (Math.abs(dx)>maxMove || Math.abs(dy)>maxMove) continue;
        sprite._fx = (x+dx*256)|0;sprite._fy = (y+dy*256)|0;
        if (!this._spriteOnWall(sprite,map)) return true;
      }
      sprite._fx=x;sprite._fy=y;return false;
    }
    _moveSpriteExplicit(sprite, dx, dy, util) {return this._runTerrainGenerator(this._moveSpriteExplicitSteps(sprite,dx,dy,util));}
    *_moveSpriteExplicitSteps(sprite, dx, dy, util) {
      if(this._spriteValues.get(sprite.id)!==sprite)return;
      const oldX = sprite._fx, oldY = sprite._fy;
      sprite._fx = (oldX+dx)|0;sprite._fy = (oldY+dy)|0;
      const map = this._state().tilemap;if (!map) return;
      const maxDist=(this._state().physicsEngine.maxSingleStep+128)>>8;
      if (Math.abs((dx+128)>>8)<=maxDist && Math.abs((dy+128)>>8)<=maxDist) {
        yield* this._collideTileWallsSteps(sprite,map,dx,dy,{dx,dy,xStep:dx,yStep:dy,cachedVx:sprite._vx,cachedVy:sprite._vy},util);
      } else {
        this._setSpriteClipping(sprite,this._spriteOnWall(sprite,map) && !this._resolveSpriteClipping(sprite,map));
      }
    }
    *_collideTileWallsSteps(sprite, map, dx, dy, motion, util) {
      const epoch=this._terrainEpoch,owner=this._state();
      map=owner.tilemap;if(!map) return;
      if (sprite._wallClipping && !this._spriteOnWall(sprite,map)) this._setSpriteClipping(sprite,false);
      const box = this._wallHitbox(sprite);if (!box) return;
      const size=map.tileSize*256, blocked=()=>sprite._wallClipping || sprite._destroyed || !this._sprite(sprite.id) || sprite.flags & (2|spriteFlags.GhostThroughWalls|spriteFlags.RelativeToCamera);
      if(!blocked()) for(const axis of ['x','y']){
        const delta=axis==='x'?dx:dy;if(!delta) continue;
        const positive=delta>0, horizontal=axis==='x', storage=horizontal?'_fx':'_fy', offset=horizontal?box.left:box.top, extent=horizontal?box.width:box.height;
        const edge=sprite[storage]+(offset+(positive?extent:-1))*256, coordinate=Math.floor((edge+128)/size);
        const first=horizontal?sprite._fy+box.top*256-dy:sprite._fx+box.left*256;
        const last=first+((horizontal?box.height:box.width)-1)*256, contacts=[], seen=new Set();
        for(let value=first;value<last+size;value+=size){
          const other=Math.floor((Math.min(value,last)+128)/size),column=horizontal?coordinate:other,row=horizontal?other:coordinate;
          if(!this._wallAt(map,column,row)) continue;
          const current=this._state().tilemap;
          const index=!current || column<0 || row<0 || column>=current.columns || row>=current.rows?0:current.indices[row*current.columns+column];
          if(seen.has(index)) continue;seen.add(index);contacts.push({column,row,index});
        }
        if(!contacts.length) continue;
        sprite[storage]=(coordinate*size+(positive?-extent*256:size)-offset*256)|0;
        const direction=horizontal?(positive?2:0):(positive?3:1);
        for(const {column,row,index} of contacts){
          if(blocked()) continue;
          if(!sprite._wallObstacles) sprite._wallObstacles=[];sprite._wallObstacles[direction]={column,row,tileIndex:index};
          const legacyMatches=this._legacyWallHandlers.filter(h=>h.kind===sprite.kind && h.index===index);
          yield* this._terrainCallbackSteps(legacyMatches,'arcade_whenRegisteredLegacyWall',sprite,column,row,util);
          if(epoch!==this._terrainEpoch || this._state()!==owner)return;
          const matches=this._wallHandlers.filter(h=>h.kind===sprite.kind);
          yield* this._terrainCallbackSteps(matches,'arcade_whenRegisteredWall',sprite,column,row,util);
          if(epoch!==this._terrainEpoch || this._state()!==owner)return;
        }
        if(sprite.flags & spriteFlags.DestroyOnWall){this.destroySprite({ID:sprite.id});return;}
        const velocity=horizontal?'_vx':'_vy',cached=horizontal?motion.cachedVx:motion.cachedVy,remaining=horizontal?'dx':'dy',step=horizontal?'xStep':'yStep';
        if(sprite[velocity]===cached && !blocked()){
          if(sprite.flags & spriteFlags.BounceOnWall){
            if(positive?sprite[velocity]>0:sprite[velocity]<0){sprite[velocity]=-sprite[velocity];motion[remaining]=-motion[remaining];motion[step]=-motion[step];}
          }else{sprite[velocity]=0;motion[remaining]=0;}
        }else if(Math.sign(Math.floor(sprite[velocity]/256+.5))===Math.sign(Math.floor(cached/256+.5))) motion[remaining]=0;
      }
      yield* this._tileOverlapSteps(sprite,map,box,util);
    }
    _physicsMotion(sprite,dtMs,half,engine=this._state().physicsEngine) {
      const constrain=value=>Math.max(-engine.maxVelocity,Math.min(engine.maxVelocity,value));
      const vx=constrain(sprite._vx),vy=constrain(sprite._vy);
      for(const [velocity,acceleration,friction] of [['_vx','_ax','_frictionX'],['_vy','_ay','_frictionY']]){
        if(sprite[acceleration])sprite[velocity]+=Math.trunc(Math.imul(sprite[acceleration],Math.trunc(dtMs))/1000);
        else if(sprite[friction]){
          const amount=Math.trunc(Math.imul(sprite[friction],Math.trunc(dtMs))/1000),difference=sprite[velocity]-amount;
          if(difference<0)sprite[velocity]=Math.min(0,sprite[velocity]+amount);
          else if(difference>0)sprite[velocity]=Math.max(0,sprite[velocity]-amount);
          else sprite[velocity]=0;
        }
        sprite[velocity]=constrain(sprite[velocity]);
      }
      const motion={sprite,dx:((sprite._vx+vx)*half/1000)|0,dy:((sprite._vy+vy)*half/1000)|0,cachedVx:sprite._vx,cachedVy:sprite._vy};
      motion.xStep=motion.dx;motion.yStep=motion.dy;
      while(Math.abs(motion.xStep)>engine.maxSingleStep || Math.abs(motion.yStep)>engine.maxSingleStep){
        const x=motion.xStep,y=motion.yStep;
        if(Math.abs(motion.xStep)>engine.minSingleStep)motion.xStep=Math.trunc(motion.xStep/2);
        if(Math.abs(motion.yStep)>engine.minSingleStep)motion.yStep=Math.trunc(motion.yStep/2);
        if(x===motion.xStep && y===motion.yStep){
          this._runtime?.emit?.('ARCADE_RUNTIME_DIAGNOSTIC',{code:'physics-step-no-progress',engine:engine.id,maxSpeed:engine.maxVelocity/256,minStep:engine.minSingleStep/256,maxStep:engine.maxSingleStep/256});
          motion.dx=motion.dy=motion.xStep=motion.yStep=0;break;
        }
      }
      return motion;
    }
    _legacyOverlapRegistrations() {
      const handlers=[];
      this._runtime?.allScriptsByOpcodeDo?.('arcade_whenSpritesOverlap',(script,target)=>{
        const hat=target.blocks.getBlock(script.blockId);
        const argument=name=>{
          if(hat.fields?.[name])return hat.fields[name].value;
          const block=target.blocks.getBlock(hat.inputs?.[name]?.block);
          return block?.fields?.TEXT?.value ?? Object.values(block?.fields || {})[0]?.value;
        };
        const kind=argument('A'),otherKind=argument('B');
        if(kind!==undefined && otherKind!==undefined)handlers.push({kind:this._kindValue(kind),otherKind:this._kindValue(otherKind),script,target,legacy:true});
      });
      return handlers;
    }
    _physicsGrid(live,map) {
      const width=map?map.columns*map.tileSize:(this._state().tilemapInitialized?0:160);
      const height=map?map.rows*map.tileSize:(this._state().tilemapInitialized?0:120);
      const maxWidth=live.reduce((n,s)=>Math.max(n,s.width),0),maxHeight=live.reduce((n,s)=>Math.max(n,s.height),0);
      const cellWidth=Math.min(width>>2,Math.max(8,maxWidth<<1)),cellHeight=Math.min(height>>2,Math.max(8,maxHeight<<1));
      return {cellWidth,cellHeight,columns:(width/cellWidth)|0,rows:(height/cellHeight)|0,buckets:new Map(),filled:[]};
    }
    _physicsInsert(grid,sprite) {
      const {cellWidth,cellHeight,columns,rows}=grid;
      const key=(x,y)=>Math.min(columns,Math.max(0,(x/cellWidth)|0))+Math.min(rows,Math.max(0,(y/cellHeight)|0))*columns;
      const xn=((sprite.width+cellWidth-1)/cellWidth)|0,yn=((sprite.height+cellHeight-1)/cellHeight)|0;
      for(let x=0;x<=xn;x++)for(let y=0;y<=yn;y++){
        const index=key(sprite._fx/256+Math.min(sprite.width,x*cellWidth),sprite._fy/256+Math.min(sprite.height,y*cellHeight));
        let bucket=grid.buckets.get(index);if(!bucket){bucket=[];grid.buckets.set(index,bucket);grid.filled.push(bucket);}
        if(!bucket.includes(sprite))bucket.push(sprite);
      }
    }
    _queueOverlapPair(first,second,matches,owner) {
      if(!owner.overlapLocks)owner.overlapLocks=new Set();
      const pair=[first.id,second.id].sort().join('|');if(owner.overlapLocks.has(pair) || !matches.length)return;
      owner.overlapLocks.add(pair);let remaining=matches.length;
      for(const h of matches){
        const flipped=h.instanceReceiver?h.instanceReceiver!==first.id:h.kind!==first.kind,a=flipped?second:first,b=flipped?first:second;
        const finish=()=>{if(--remaining===0)owner.overlapLocks.delete(pair);};
        let work;
        if(h.legacy){
          const thread=this._runtime._pushThread(h.script.blockId,h.target);
          thread.bwArcadeEvent={A:h.kind,B:h.otherKind,first:a.id,second:b.id};
          // A hat-based handler that ends in an uncaught exception keeps its pair overlapping, like a dead fiber.
          work=new Promise(resolve=>this._terrainWaits.add({thread,resolve})).then(()=>!!exceptionOwners.get(this).failure(thread));
        }else if(h.instanceReceiver)work=this._runTerrainGenerator(this._instanceOverlapSteps(a,b));
        else work=this._runTerrainGenerator(this._registeredCallbackSteps([h],'arcade_whenRegisteredOverlap',{first:a.id,second:b.id,deferredFiber:true},undefined,true));
        // PXT removes the pair from _overlappers after the handler returns; a dead fiber leaves it overlapping.
        if(work?.then)work.then(faulted=>{if(faulted!==true)finish();},error=>{finish();throw error;});else if(work!==true)finish();
      }
    }
    _physicsOverlapRounds(grid,handlers,owner) {
      const instanceOverlap=Object.values(owner.sprites).some(sprite=>sprite._overlapRegistration);
      if(!handlers.length && !instanceOverlap)return;
      const checked=new Set(),blocked=s=>s._destroyed || s.flags&(2|spriteFlags.GhostThroughSprites|spriteFlags.RelativeToCamera);
      for(const bucket of grid.filled){
        if(bucket.length===1)continue;
        for(const first of bucket){if(blocked(first))continue;
          for(const second of bucket){
            if(first===second || blocked(second))continue;
            const pair=[first.id,second.id].sort().join('|');if(checked.has(pair))continue;checked.add(pair);
            if(owner.overlapLocks?.has(pair))continue;
            const matches=handlers.filter(h=>(h.kind===first.kind && h.otherKind===second.kind)||(h.kind===second.kind && h.otherKind===first.kind));
            if(instanceOverlap) {
              const receiver=[first,second].sort((a,b)=>a.pxtId-b.pxtId).find(sprite=>sprite._overlapRegistration);
              if(receiver)matches.unshift({...receiver._overlapRegistration,instanceReceiver:receiver.id});
            }
            if(!matches.length)continue;
            const higher=first.pxtId>second.pxtId?first:second,lower=higher===first?second:first;
            if(this.spriteOverlaps({A:higher.id,B:lower.id}))this._queueOverlapPair(first,second,matches,owner);
          }
        }
      }
    }
    *_advancePhysicsSteps(live,dt,map) {
      const owner=this._state(),epoch=this._terrainEpoch,dtMs=Math.min(100,dt*1000),half=Math.trunc(dtMs/2);
      const handlers=[...this._overlapHandlers,...this._legacyOverlapRegistrations()];
      const engine=owner.physicsEngine;
      let movers=live.map(sprite=>this._physicsMotion(sprite,dtMs,half,engine));
      for(const sprite of live)if(sprite._vx || sprite._vy)sprite._wallObstacles=[];
      const grid=this._physicsGrid(live,map);
      const ratio=((engine.maxVelocity<<8)/engine.minSingleStep)|0;
      const count=(Math.trunc(Math.imul(ratio,Math.trunc(dtMs))/1000)+128)>>8;
      for(let round=0;round<count && movers.length;round++){
        const remaining=[],instanceOverlap=live.some(sprite=>sprite._overlapRegistration);
        for(const motion of movers){
          const sprite=motion.sprite;
          for(const axis of ['x','y']){
            const velocity=axis==='x'?'_vx':'_vy',cache=axis==='x'?'cachedVx':'cachedVy',delta=axis==='x'?'dx':'dy',step=axis==='x'?'xStep':'yStep';
            if(sprite[velocity]!==motion[cache]){
              if(!sprite[velocity])motion[delta]=0;
              else if(sprite[velocity]<0 && motion[cache]>0 || sprite[velocity]>0 && motion[cache]<0){motion[delta]=-motion[delta];motion[step]=-motion[step];}
              motion[cache]=sprite[velocity];
            }
          }
          const dx=Math.abs(motion.xStep)>Math.abs(motion.dx)?motion.dx:motion.xStep;
          const dy=Math.abs(motion.yStep)>Math.abs(motion.dy)?motion.dy:motion.yStep;
          motion.dx-=dx;motion.dy-=dy;
          sprite._fx=(sprite._fx+dx)|0;sprite._fy=(sprite._fy+dy)|0;
          if(!sprite._destroyed && !(sprite.flags&(2|spriteFlags.GhostThroughSprites|spriteFlags.RelativeToCamera)) &&
            (instanceOverlap ||
            [...this._overlapHandlers,...handlers.filter(h=>h.legacy)].some(h=>h.kind===sprite.kind || h.otherKind===sprite.kind)))this._physicsInsert(grid,sprite);
          if(map)yield* this._collideTileWallsSteps(sprite,map,dx,dy,motion);
          if(epoch!==this._terrainEpoch || this._state()!==owner)return;
          this._clampSprite(sprite);
          if(Math.abs(motion.dx)>25 || Math.abs(motion.dy)>25)remaining.push(motion);
        }
        this._physicsOverlapRounds(grid,handlers,owner);
        movers=remaining;
      }
    }
    *_advanceTilePhysicsSteps(sprite,dt,map) {yield* this._advancePhysicsSteps([sprite],dt,map);}
    _clampSprite(sprite) {
      if (!sprite.stayInScreen && (!sprite.bounceOnWall || this._state().tilemap)) return;
      if(!this._cameraIsUpdated())this._updateCamera();
      const camera=this._camera(),box=this._wallHitbox(sprite);if(!box)return;
      const left=sprite._fx/256+box.left,right=left+box.width-1;
      const top=sprite._fy/256+box.top,bottom=top+box.height-1;
      let dx=0,dy=0;
      if(left<camera.offsetX)dx=camera.offsetX-left;
      else if(right>camera.offsetX+160)dx=camera.offsetX+160-right;
      if(top<camera.offsetY)dy=camera.offsetY-top;
      else if(bottom>camera.offsetY+120)dy=camera.offsetY+120-bottom;
      if(dx){sprite._fx=(sprite._fx+((dx*256)|0))|0;if(sprite.bounceOnWall)sprite.vx=-sprite.vx;}
      if(dy){sprite._fy=(sprite._fy+((dy*256)|0))|0;if(sprite.bounceOnWall)sprite.vy=-sprite.vy;}
    }
    _setSpriteClipping(sprite,clipping) {sprite._wallClipping=!!clipping;sprite.flags=clipping?(sprite.flags|256):(sprite.flags&~256);}
    _syncSpriteFlagState(sprite) {
      sprite._wallClipping=!!(sprite.flags&256);
      sprite.autoDestroy = !!(sprite.flags & spriteFlags.AutoDestroy);
      sprite.stayInScreen = !!(sprite.flags & spriteFlags.StayInScreen);
      sprite.bounceOnWall = !!(sprite.flags & spriteFlags.BounceOnWall);
      sprite.ghostThroughSprites = !!(sprite.flags & spriteFlags.GhostThroughSprites);
      sprite.ghostThroughWalls = !!(sprite.flags & spriteFlags.GhostThroughWalls);
      sprite.ghostThroughTiles = !!(sprite.flags & spriteFlags.GhostThroughTiles);
      sprite.invisible = !!(sprite.flags & spriteFlags.Invisible);
    }
    setSpriteFlag(args) {
      const sprite = this._spriteValues.get(String(args.ID)) || this._sprite(args.ID);
      const mask = spriteFlags[String(args.FLAG)];
      if (!sprite || mask === undefined) return;
      const on = Scratch.Cast.toBoolean(args.ON);
      sprite.flags = on ? (sprite.flags || 0) | mask : (sprite.flags || 0) & ~mask;
      this._syncSpriteFlagState(sprite);
      if (String(args.FLAG) === 'Invisible') {
        this._updateSpriteFlagVisibility(sprite);
      }
      if (String(args.FLAG) === 'RelativeToCamera') this._positionSprite(sprite.id);
      if (String(args.FLAG) === 'StayInScreen') {
        this._clampSprite(sprite);
        this._positionSprite(String(args.ID));
      }
      this._changed();
    }
    _updateSpriteFlagVisibility(sprite) {
      const target=this._state().spriteTargets[sprite.id];
      if(target?.setVisible)target.setVisible(!sprite.invisible);
      const drawable=this._imageSkins.get(sprite.id)?.drawableId;
      if(drawable!==undefined)this._runtime?.renderer?.updateDrawableVisible(drawable,!sprite.invisible && this._state().sprites[sprite.id]===sprite);
    }
    setSpriteStayInScreen(args) { this.setSpriteFlag({...args, FLAG: 'StayInScreen'}); }
    setSpriteAutoDestroy(args) { this.setSpriteFlag({...args, FLAG: 'AutoDestroy'}); }
    setSpriteBounceOnWall(args) { this.setSpriteFlag({...args, FLAG: 'BounceOnWall'}); }
    setSpriteGhostThroughSprites(args) { this.setSpriteFlag({...args, FLAG: 'GhostThroughSprites'}); }
    _costumeImageSize(costume) {
      if (!costume || costume.dataFormat !== 'svg') return null;
      const cx = Number(costume.rotationCenterX), cy = Number(costume.rotationCenterY);
      if (!Number.isFinite(cx) || !Number.isFinite(cy) || cx <= 0 || cy <= 0) return null;
      // Imported Arcade images use imageToSvg's four SVG units per pixel,
      // centred at exactly half the canvas. Check the SVG itself when the
      // asset is available; the centres remain in the SB3 when it is not.
      const data = costume.asset && costume.asset.data;
      if (data) {
        const head = typeof data === 'string' ? data.slice(0, 1024) :
          Array.from(data.slice(0, 1024), byte => String.fromCharCode(byte)).join('');
        const tag = /<svg\\b[^>]*>/i.exec(head);
        const width = tag && /\\bwidth="(\\d+)"/.exec(tag[0]);
        const height = tag && /\\bheight="(\\d+)"/.exec(tag[0]);
        if (!tag || !width || !height || !/shape-rendering="crispEdges"/.test(tag[0]) ||
          Number(width[1]) !== cx * 2 || Number(height[1]) !== cy * 2) return null;
      }
      return {width: cx / 2, height: cy / 2};
    }
    _costumePixelMask(costume, size) {
      const data = costume && costume.asset && costume.asset.data;
      if (!data || !size || !Number.isInteger(size.width) || !Number.isInteger(size.height)) return null;
      const svg = typeof data === 'string' ? data :
        Array.from(data, byte => String.fromCharCode(byte)).join('');
      const root = /<svg\\b[^>]*>/i.exec(svg);
      if (!root || !/shape-rendering="crispEdges"/.test(root[0])) return null;
      const body = svg.slice(root.index + root[0].length).replace(/<\\/svg>\\s*$/i, '');
      const rects = [...body.matchAll(/<rect\\b([^>]*)\\/\\s*>/gi)];
      if (body.replace(/<rect\\b[^>]*\\/\\s*>/gi, '').trim()) return null;
      const attr = (tag, name) => {
        const match = new RegExp('\\\\b' + name + '="([^"]*)"', 'i').exec(tag);
        return match && match[1];
      };
      const mask = new Uint8Array(size.width * size.height);
      for (const rect of rects) {
        const [x, y, width, height] = ['x', 'y', 'width', 'height']
          .map(name => Number(attr(rect[1], name)) / 4);
        if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0 ||
          width < 0 || height < 0 || x + width > size.width || y + height > size.height ||
          !/^#[0-9a-f]{6}$/i.test(attr(rect[1], 'fill') || '')) return null;
        for (let row = y; row < y + height; row++) {
          for (let col = x; col < x + width; col++) mask[row * size.width + col] = 1;
        }
      }
      return mask;
    }
    _spriteMask(sprite) {
      // Image aliases stay live even while their sprite's scene is hidden.
      // Renderer mask caches must not determine object-level pixel queries.
      if(sprite.image?.pixels)return sprite.image.pixels;
      if (sprite.mask) return sprite.mask;
      const target = this._state().spriteTargets[sprite.id];
      const costume = target && target.getCostumes && target.getCostumes()[target.currentCostume];
      const size = this._costumeImageSize(costume);
      if (size && size.width === sprite.width && size.height === sprite.height) {
        sprite.mask = this._costumePixelMask(costume, size);
      }
      return sprite.mask || null;
    }
    _clearImage(id) {
      const entry = this._imageSkins.get(id);
      if (!entry) return;
      // Restore the authored skin before destroying this sprite's private skin.
      entry.target?.setCostume?.(entry.target.currentCostume);
      if(entry.drawableId!==undefined)this._runtime?.renderer?.destroyDrawable(entry.drawableId,'sprite');
      this._runtime?.renderer?.destroySkin(entry.skinId);
      this._imageSkins.delete(id);
    }
    // quiet: a probe that has its own fallback (rendering, wall hitboxes) asks
    // without reporting; only the image blocks themselves report a costume
    // that is not pixel art (a vector costume has no Arcade image).
    _imageForSprite(id, {quiet = false} = {}) {
      const sprite = this._spriteValues.get(String(id)) || this._sprite(id);
      // A referenced sprite retains its own artwork while another Scene is
      // active (including SeeThrough rendering). Resolve the actual retained
      // target owner before decoding; never invent an image for a missing one.
      const target = this._state().spriteTargets?.[id] || [...this._sceneBundles]
        .find(bundle=>bundle.state.sprites?.[id]===sprite)?.state.spriteTargets?.[id];
      if (!sprite) return null;
      if (sprite.image) return sprite.image;
      if (!target) return null;
      if (!sprite.image) {
        const costume = target.getCostumes?.()[target.currentCostume];
        sprite.image = imageEngine.decode(costume, this._costumeImageSize(costume));
      }
      if (!sprite.image) {
        if (!quiet) this._runtime?.emit?.('BLOCKS_ERROR', 'Arcade image mutation cannot read this sprite artwork. Use an imported Arcade pixel image.');
        return;
      }
      return sprite.image;
    }
    createImage(args) {
      const width = Number(args.WIDTH) | 0, height = Number(args.HEIGHT) | 0;
      if (width < 0 || height < 0 || width > 2000 || height > 2000) return '';
      return this._imageHandle({width, height, pixels: new Uint8Array(width * height)});
    }
    cloneImage(args) {
      const image = this._image(args.IMAGE);
      return image ? this._imageHandle({width: image.width, height: image.height, pixels: image.pixels.slice(), ...(image.palette ? {palette: image.palette.slice()} : {})}) : '';
    }
    imageProperty(args,util) {
      if(this._missingOperand(util,args,'IMAGE'))return this._primitiveFault('imageProperty',args,util);
      const image = this._image(args.IMAGE);
      return image && ['width', 'height'].includes(String(args.PROPERTY)) ? image[args.PROPERTY] : 0;
    }
    copyImageFrom(args) {
      const image=this._image(args.IMAGE),source=this._image(args.SOURCE);
      if(image && source && imageEngine.copyFrom(image,source))this._refreshImage(image);
    }
    scrollImage(args,util) {
      if(this._missingOperand(util,args,'IMAGE'))return this._primitiveFault('scrollImage',args,util);
      const image=this._image(args.IMAGE);
      if(image){imageEngine.scroll(image,args.X,args.Y);this._refreshImage(image);}
    }
    mutateImage(args,util) {
      if(this._missingOperand(util,args,'IMAGE')&&['fill','replace','flipX','flipY'].includes(args.OP))return this._primitiveFault('mutateImage',args,util);
      const image = this._image(args.IMAGE);
      if (image && imageEngine.mutate(image, String(args.OP), args.COLOR, args.TO)) this._refreshImage(image);
    }
    setImagePixel(args,util) {
      if(this._missingOperand(util,args,'IMAGE'))return this._primitiveFault('setImagePixel',args,util);
      const image = this._image(args.IMAGE);
      if (image) { imageEngine.draw(image, 'setPixel', args.X, args.Y, args.COLOR); this._refreshImage(image); }
    }
    imagePixel(args,util) {
      if(this._missingOperand(util,args,'IMAGE'))return this._primitiveFault('imagePixel',args,util);
      const image = this._image(args.IMAGE);
      return image ? imageEngine.getPixel(image, args.X, args.Y) : 0;
    }
    drawImageCircle(args,util) {
      if(this._missingOperand(util,args,'IMAGE')&&['drawCircle','fillCircle'].includes(args.OP))return this._primitiveFault('drawImageCircle',args,util);
      const image = this._image(args.IMAGE);
      if(image && ['drawCircle','fillCircle'].includes(String(args.OP))) {
        imageEngine.draw(image,String(args.OP),args.X,args.Y,args.RADIUS,args.COLOR);
        this._refreshImage(image);
      }
    }
    drawImage(args,util) {
      if(this._missingOperand(util,args,'IMAGE')&&['fillRect','drawLine'].includes(args.OP))return this._primitiveFault('drawImage',args,util);
      const image = this._image(args.IMAGE);
      if (image && ['fillRect', 'drawLine'].includes(String(args.OP))) {
        imageEngine.draw(image, String(args.OP), args.X, args.Y, args.W, args.H, args.COLOR); this._refreshImage(image);
      }
    }
    blitImage(args,util) {
      if(this._missingOperand(util,args,'IMAGE','SOURCE')&&['drawImage','drawTransparentImage'].includes(args.OP))return this._primitiveFault('blitImage',args,util);
      const image = this._image(args.IMAGE), source = this._image(args.SOURCE);
      if (image && source && ['drawImage', 'drawTransparentImage'].includes(String(args.OP))) {
        imageEngine.blit(image, source, String(args.OP), args.X, args.Y);this._refreshImage(image);
      }
    }
    imagesOverlap(args) {
      const image = this._image(args.IMAGE), source = this._image(args.SOURCE);
      return !!(image && source && imageEngine.blit(image, source, 'overlapsWith', args.X, args.Y));
    }
    spawnImageProjectile(args, util) {
      if(this._missingOperand(util,args,'IMAGE'))return this._primitiveFault('spawnImageProjectile',args,util);
      const image = this._image(args.IMAGE);
      return image ? this.spawnProjectile({...args, WIDTH: image.width, HEIGHT: image.height}, util) : '';
    }
    spawnImageSprite(args, util) {
      if(this._missingOperand(util,args,'IMAGE'))return this._primitiveFault('spawnImageSprite',args,util);
      const image = this._image(args.IMAGE);
      return image ? this.spawnSprite({...args, WIDTH: image.width, HEIGHT: image.height}, util) : '';
    }
    imageEquals(args) {
      const image=this._image(args.IMAGE),other=this._image(args.OTHER);
      if(!image){this._runtime?.emit?.('BLOCKS_ERROR','Arcade expected an image for equality');return false;}
      return imageEngine.equals(image,other);
    }
    _image(value) {
      const id = Scratch.BWValues.referenceId(this._runtime, value, 'image');
      return id === null ? null : this._images.get(id);
    }
    _imageHandle(image) {
      if (!image) return '';
      if (!this._imageIds.has(image)) {
        const id = 'arcade-image:' + (++this._nextImageId);
        this._imageIds.set(image, id); this._images.set(id, image);
      }
      return Scratch.BWValues.reference(this._runtime, 'image', this._imageIds.get(image));
    }
    spriteImage(args) { return this._imageHandle(this._imageForSprite(args.ID)); }
    frameImage(args) {
      const arrayKey = String(args.KEY);
      const definition = this._frameDefinitions.get(arrayKey) || {template: String(args.TEMPLATE),
        start: Number(args.START) | 0, count: Number(args.COUNT) | 0};
      const count = definition.count;
      const index = ((Math.round(Number(args.INDEX)) % count) + count) % count;
      if (!Number.isFinite(index) || count < 1) return '';
      const key = JSON.stringify([arrayKey, index]);
      if (this._frameImages.has(key)) return this._frameImages.get(key);
      const template = this._runtime?.getSpriteTargetByName?.(definition.template);
      const costume = template?.getCostumes?.()[index + definition.start];
      const image = imageEngine.decode(costume, this._costumeImageSize(costume));
      if (!image) {
        this._runtime?.emit?.('BLOCKS_ERROR', 'Arcade cannot read this frame image artwork.'); return '';
      }
      this._frameDefinitions.set(arrayKey, definition);
      const id = this._imageHandle(image); this._frameImages.set(key, id); return id;
    }
    _animation(value) {
      const id = Scratch.BWValues.referenceId(this._runtime, value, 'animation');
      return id === null ? null : this._animations.get(id);
    }
    _animationNumericValue(value) {
      const decoded = Scratch.BWValues.decode(value);
      // Scratch number shadows arrive as text. PXT stores legal missing/null
      // numeric arguments unchanged, so do not turn them into NaN or zero.
      return decoded == null ? decoded : Number(decoded);
    }
    createAnimation(args) {
      if (!this._animationUpdateOrder.includes('legacy')) this._animationUpdateOrder.push('legacy');
      const id = 'arcade-animation:' + (++this._nextAnimationId);
      this._activeLegacyAnimations.add(id);
      this._animations.set(id, {action: this._animationNumericValue(args.ACTION),
        interval: this._animationNumericValue(args.INTERVAL), index: -1, frames: [], sprites: [],
        lastTime: this._globalElapsedMs || 0});
      return Scratch.BWValues.reference(this._runtime, 'animation', id);
    }
    addAnimationFrame(args) {
      const animation = this._animation(args.ANIMATION), image = this._image(args.IMAGE);
      if (animation && image) animation.frames[++animation.index] = image;
    }
    attachAnimation(args) {
      const animation = this._animation(args.ANIMATION), sprite = this._spriteValues.get(String(args.ID));
      if (animation && sprite && !animation.sprites.includes(sprite)) animation.sprites.push(sprite);
    }
    setAnimationAction(args) {
      const sprite = this._spriteValues.get(String(args.ID));
      if (sprite) sprite._action = this._animationNumericValue(args.ACTION);
    }
    animationProperty(args) {
      const animation = this._animation(args.ANIMATION);
      if (!animation) return Scratch.BWValues.encode(undefined);
      if (args.PROPERTY === 'image') {
        const image = animation.frames[animation.index];
        return image ? this._imageHandle(image) : Scratch.BWValues.encode(undefined);
      }
      return Scratch.BWValues.encode(['action', 'interval'].includes(String(args.PROPERTY)) ? animation[args.PROPERTY] : undefined);
    }
    setAnimationInterval(args) {
      const animation = this._animation(args.ANIMATION);
      if (animation) animation.interval = this._animationNumericValue(args.INTERVAL);
    }
    getAnimationAssets() {
      const resources = this._runtime?.bwArcadeAnimationResources;
      const items = animationResourceMenuItems(resources, this._runtime);
      return items.length ? items : [{text: 'No animation assets — create one in Pixel', value: 'none'}];
    }
    _animationAsset(value) {
      const id = String(Scratch.BWValues.decode(value));
      const resource = this._runtime?.bwArcadeAnimationResources?.get?.(id);
      const fail = reason => {
        this._animationAssetCache.delete(id);
        this._runtime?.emit?.('BLOCKS_ERROR', 'Arcade animation asset "' + id + '": ' + reason + '.');
        return null;
      };
      if (!resource) return fail('missing or deleted resource');
      const {width, height, palette, frames, revision} = resource;
      if (resource.id !== id || typeof resource.name !== 'string' || !resource.name.trim() ||
          !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 512 || height > 512 ||
          !((Number.isInteger(revision) && revision >= 0) || (typeof revision === 'string' && revision.length > 0)) || !Array.isArray(palette) || palette.length !== 16 ||
          palette[0] !== null || !Array.from(palette.slice(1)).every(colour => /^#[0-9a-f]{6}$/i.test(colour)) ||
          !Array.isArray(frames) || !frames.length || frames.length > 64 ||
          width * height * (frames.length + 1) > 8 * 1024 * 1024) return fail('invalid resource metadata');
      const ids = new Set();
      const interval = frames[0]?.durationMs;
      for (const frame of frames) {
        if (!frame || typeof frame.id !== 'string' || !frame.id || ids.has(frame.id) ||
            !Number.isInteger(frame.durationMs) || frame.durationMs < 1 || frame.durationMs > 65535 ||
            frame.durationMs !== interval || !ArrayBuffer.isView(frame.pixels) ||
            typeof frame.pixels.every !== 'function' || frame.pixels.length !== width * height ||
            !frame.pixels.every(pixel => Number.isInteger(pixel) && pixel >= 0 && pixel <= 15)) {
          return fail('invalid frames or nonuniform frame duration');
        }
        ids.add(frame.id);
      }
      return resource;
    }
    animationAssetFrames(args) {
      const resource = this._animationAsset(args.RESOURCE);
      if (!resource) return Scratch.BWValues.encode(undefined);
      const cached = this._animationAssetCache.get(resource.id);
      if (cached?.revision === resource.revision) return cached.reference;
      // Snapshot authored pixels. Existing animations keep their actual image
      // objects when the editor publishes a later resource revision.
      const images = resource.frames.map(frame => this._imageHandle({width: resource.width, height: resource.height,
        pixels: Uint8Array.from(frame.pixels), palette: resource.palette.slice()}));
      const reference = Scratch.BWValues.arrayReference(this._runtime, images);
      this._animationAssetCache.set(resource.id, {revision: resource.revision, reference});
      return reference;
    }
    animationAssetFreshFrames(args) {
      const resource = this._animationAsset(args.RESOURCE);
      if (!resource) return Scratch.BWValues.encode(undefined);
      // Start from authored data, never the shared (possibly mutated) cache.
      // Each evaluation owns its array, image handles, pixels and palettes.
      const images = resource.frames.map(frame => this._imageHandle({width: resource.width, height: resource.height,
        pixels: Uint8Array.from(frame.pixels), palette: resource.palette.slice()}));
      return Scratch.BWValues.arrayReference(this._runtime, images);
    }
    animationAssetInterval(args) {
      const resource = this._animationAsset(args.RESOURCE);
      return Scratch.BWValues.encode(resource ? resource.frames[0].durationMs : undefined);
    }
    runImageAnimation(args) {
      const sprite = this._spriteValues.get(String(args.ID));
      const frames = Scratch.BWValues.arrayValue(this._runtime, args.FRAMES);
      // PXT: an undefined frame list (an absent animation asset) starts nothing and is not an error.
      if (sprite && !frames && Scratch.BWValues.decode(args.FRAMES) === undefined) return;
      if (!sprite || !frames) {
        this._runtime?.emit?.('BLOCKS_ERROR', 'Arcade image animation requires a sprite and an image array reference.');
        return;
      }
      // Keep the actual source array: adding/replacing frames after starting is
      // observable in MakeCode. Resolve image handles only when displaying them.
      if (!this._animationUpdateOrder.includes('image')) this._animationUpdateOrder.push('image');
      this._imageAnimations.set(sprite, {frames, elapsed: 0, lastFrame: -1,
        interval: Number(Scratch.BWValues.decode(args.INTERVAL)) || 500,
        loop: Scratch.BWValues.truth(args.LOOP)});
    }
    stopAnimation(args) {
      const sprite = this._spriteValues.get(String(args.ID)), type = Number(args.TYPE);
      if (!sprite) return;
      if (type === 0 || type === 1) {
        this._imageAnimations.delete(sprite);
        sprite._action = -1;
      }
      // Movement animations remain a named conversion gap until their complete
      // path engine is implemented. Type 2 does not stop image animations.
    }
    _advanceAnimations(dt) {
      const state = this._state();
      // Frame handlers at equal priority run in registration order. The two
      // animation libraries register on their first use, not on extension load.
      for (const group of this._animationUpdateOrder) {
        if (group === 'legacy') for (const id of this._activeLegacyAnimations) {
          const animation=this._animations.get(id);
          if (this._globalElapsedMs - animation.lastTime >= animation.interval && animation.frames.length) {
            animation.index = (animation.index + 1) % animation.frames.length;
            animation.lastTime = this._globalElapsedMs;
          }
          animation.sprites = animation.sprites.filter(sprite => !sprite._destroyed && !sprite._destroying);
          for (const sprite of animation.sprites) {
            const image = animation.frames[animation.index];
            if (sprite._action === animation.action && image && sprite.image !== image)
              this.setSpriteImage({ID: sprite.id, IMAGE: this._imageHandle(image)});
          }
        }
        if (group === 'image') for (const [sprite, animation] of this._imageAnimations) {
          if (state.sprites[sprite.id] !== sprite) {this._imageAnimations.delete(sprite); continue;}
          animation.elapsed += dt * 1000;
          const index = Math.floor(animation.elapsed / animation.interval);
          if (animation.lastFrame !== index && animation.frames.length) {
            if (!animation.loop && index >= animation.frames.length) {this._imageAnimations.delete(sprite); continue;}
            const image = this._image(animation.frames[index % animation.frames.length]);
            if (image && sprite.image !== image) this.setSpriteImage({ID: sprite.id, IMAGE: this._imageHandle(image)});
          }
          animation.lastFrame = index;
        }
      }
    }
    setSpriteImage(args,util) {
      if(this._missingOperand(util,args,'ID'))return this._primitiveFault('setSpriteImage',args,util);
      const sprite = this._spriteValues.get(String(args.ID)) || this._sprite(args.ID), image = this._image(args.IMAGE);
      if (!sprite || !image) return;
      // Keep the same private skin while image frames change. Restoring the
      // authored costume and creating a fresh asynchronous SVG skin here can
      // expose a blank frame; costume changes/destruction/reset own restoration.
      sprite.image = image;
      delete sprite._wallHitbox;
      sprite._imageWidth=image.width;sprite._imageHeight=image.height;this._recalcSpriteSize(sprite);
      this._clampSprite(sprite); this._positionSprite(sprite.id);
      if(this._sprite(sprite.id))this._renderSpriteImage(sprite.id);
    }
    _refreshImage(image) {
      // Object identity is intentional: aliases share pixels, equal literals do not.
      if (this._state().backgroundImage === image) this._renderBackgroundImage();
      const map = this._state().tilemap;
      if (map && (map.mapImage === image || map.images.includes(image) || map.views.includes(image))) this._renderTilemap();
      for (const sprite of Object.values(this._state().sprites)) {
        if (sprite.image === image) this._renderSpriteImage(sprite.id);
      }
    }
    mutateSpriteImage(args) {
      const image = this._imageForSprite(args.ID);
      if (image && imageEngine.mutate(image, String(args.OP), args.COLOR, args.TO)) this._refreshImage(image);
    }
    setSpritePixel(args) {
      const image = this._imageForSprite(args.ID);
      if (image) { imageEngine.draw(image, 'setPixel', args.X, args.Y, args.COLOR); this._refreshImage(image); }
    }
    spritePixel(args) {
      const image = this._imageForSprite(args.ID);
      return image ? imageEngine.getPixel(image, args.X, args.Y) : 0;
    }
    drawSpriteCircle(args) {
      const image = this._imageForSprite(args.ID);
      if(image && ['drawCircle','fillCircle'].includes(String(args.OP))) {
        imageEngine.draw(image,String(args.OP),args.X,args.Y,args.RADIUS,args.COLOR);
        this._refreshImage(image);
      }
    }
    drawSpriteImage(args) {
      const image = this._imageForSprite(args.ID);
      if (image && ['fillRect', 'drawLine'].includes(String(args.OP))) {
        imageEngine.draw(image, String(args.OP), args.X, args.Y, args.W, args.H, args.COLOR);
        this._refreshImage(image);
      }
    }
    // PXT game/sprite.ts drawDebug ShowPhysics layout (MIT; retained PXT notice).
    // A reusable non-handle raster belongs to the sprite; glyphs use the actual
    // selected SDK font5 through the existing licensed image-print bridge.
    _spritePhysicsLayer(sprite,state=this._state()) {
      if(!(sprite.flags & spriteFlags.ShowPhysics) || sprite.invisible || sprite._destroyed)return null;
      const camera=this._camera(state),relative=!!(sprite.flags & spriteFlags.RelativeToCamera);
      const left=sprite._fx/256-(relative?0:camera.drawOffsetX),top=sprite._fy/256-(relative?0:camera.drawOffsetY);
      if(left+sprite.width<0 || top+sprite.height<0 || left>160 || top>120)return null;
      let layer=sprite._physicsLayer;
      if(!layer){
        const pixels=new Uint8Array(160*120),writes=new Uint8Array(160*120);
        layer=sprite._physicsLayer={image:{width:160,height:120,pixels},writes,x:0,y:0,z:sprite.z,id:sprite.pxtId,source:{z:sprite.z,id:sprite.pxtId}};
      }
      if(layer.source.z!==sprite.z)this._particleOrderDirty=true;
      layer.z=layer.source.z=sprite.z;
      layer.image.pixels.fill(0);layer.writes.fill(0);
      const text=this._pxtText(),font=text.image.font5,image=layer.image;
      const target={_width:image.width,_height:image.height,data:image.pixels,makeWritable(){},color:c=>Number(c)&15};
      const wrapper={width:image.width,height:image.height,
        drawIcon:(icon,x,y,color)=>text.drawIcon(target,{data:icon},x,y,color),
        fillRect:(x,y,w,h,color)=>imageEngine.draw(image,'fillRect',x,y,w,h,color)};
      const print=(value,x,y)=>text.helpers.imagePrint(wrapper,value,x,y,1,font);
      let tx=Math.floor(left),ty=Math.floor(top)+sprite.height+2;
      print(String(sprite.x>>0)+','+String(sprite.y>>0),tx,ty);tx-=font.charWidth;
      if(sprite.vx || sprite.vy){ty+=font.charHeight+2;print('v'+String(sprite.vx>>0)+','+String(sprite.vy>>0),tx,ty);}
      if(sprite.ax || sprite.ay){ty+=font.charHeight+2;print('a'+String(sprite.ax>>0)+','+String(sprite.ay>>0),tx,ty);}
      for(let i=0;i<layer.writes.length;i++)if(image.pixels[i])layer.writes[i]=1;
      return layer;
    }
    _layersForSceneSprite(sprite,state) {
      const layers=[],missingSpriteImages=[];
      const bundle=state===this._state()?null:[...this._sceneBundles].find(bundle=>bundle.state===state);
      const speechMap=bundle?bundle._speech:this._speech;
        if(sprite.invisible || sprite._destroyed)return {layers,missingSpriteImages};
        const source=sprite.image || this._imageForSprite(sprite.id,{quiet:true});
        if(!source){missingSpriteImages.push(sprite.id);return {layers,missingSpriteImages};}
        const speech=speechMap.get(sprite.id);
        if(speech && !speech.legacy && speech.raster)
          layers.push({image:speech.raster,writes:speech.raster.writes,x:0,y:0,z:sprite.z,id:sprite.pxtId,bwSceneSprite:sprite});
        const window=this._spriteRasterWindow(sprite,state),view=this._spriteViewPosition(sprite,state);
        layers.push({image:this._scaledSpriteImage(sprite,window),
          x:view.x-sprite.width/2+window.x,y:view.y-sprite.height/2+window.y,
          z:sprite.z,id:sprite.pxtId,bwSceneSprite:sprite});
        const physics=this._spritePhysicsLayer(sprite,state);
        if(physics){physics.bwSceneSprite=sprite;layers.push(physics);}
      return {layers,missingSpriteImages};
    }
    _sceneLayers(state=this._state()) {
      // This internal scene raster is not the global PXT screen. Snapshot
      // reporters remain unavailable until all renderable layers are covered.
      const layers=[],missingSpriteImages=[];
      const tilemap=state.tilemap;
      if(tilemap && (!tilemap.legacy || tilemap.mapImage)) {
        const renderable=this._ensureTilemapRenderable(tilemap.legacy?'legacy':'modern',state);
        layers.push({image:this._tilemapRaster(tilemap,state),x:0,y:0,z:renderable.z,id:renderable.pxtId,bwSceneSprite:renderable});
      }
      for(const sprite of Object.values(state.sprites)) {
        const found=this._layersForSceneSprite(sprite,state);layers.push(...found.layers);missingSpriteImages.push(...found.missingSpriteImages);
      }
      return {layers,missingSpriteImages};
    }
    _composeSceneFrame() {
      const state=this._state();
      if(!this._sceneFlags.begin(state))return state.sceneFrame;
      try {
        const {layers,missingSpriteImages}=this._sceneLayers(),frame=state.sceneFrame || (state.sceneFrame={width:160,height:120,pixels:new Uint8Array(160*120)});
        const particles=this._drawParticleSources();layers.push(...particles);
        if(state.flags & dependencies.sceneFlags.NeedsSorting)this._particleOrderDirty=true;
        const order=this._sceneFlags.order(state,this._sceneSpriteObjects(state)),rank=item=>order.indexOf(item.bwSceneSprite || item.source);
        layers.sort((a,b)=>rank(a)-rank(b));
        imageEngine.composeFrame(frame,state.backgroundColor,state.backgroundImage,[]);
        for(const layer of layers)imageEngine.drawLayer(frame,layer);
        this._renderOverlayLayers(layers.filter(layer=>layer.source));
        frame.coverage=['background','tilemap','sprites','modernSpeech','particles'];frame.remaining=['renderables','hud','legacySpeech','effects'];
        frame.missingSpriteImages=missingSpriteImages;frame.sequence=(frame.sequence || 0)+1;return frame;
      } finally {this._sceneFlags.finish(state);}
    }
    // Particle effects run the generated PXT particle sources, factories and
    // effects. The host gives them the current native scene, the shared sprite
    // id counter, the global clock and an indexed screen raster per source.
    _particles() {
      if (this._particleModule) return this._particleModule;
      const ext=this;
      class PxtImage {
        constructor(raw){this.raw=raw;}
        get width(){return this.raw.width;}
        get height(){return this.raw.height;}
        clone(){return new PxtImage({width:this.raw.width,height:this.raw.height,pixels:this.raw.pixels.slice()});}
        getPixel(x,y){return imageEngine.getPixel(this.raw,x,y);}
        replace(from,to){imageEngine.mutate(this.raw,'replace',from,to);}
        setPixel(x,y,c){imageEngine.draw(this.raw,'setPixel',x,y,c);}
        drawLine(x0,y0,x1,y1,c){imageEngine.draw(this.raw,'drawLine',x0,y0,x1,y1,c);}
        fillRect(x,y,w,h,c){imageEngine.draw(this.raw,'fillRect',x,y,w,h,c);}
        // screen image.ts imageDrawRect
        drawRect(x,y,w,h,c){if(w==0 || h==0)return;w--;h--;this.drawLine(x,y,x+w,y,c);this.drawLine(x,y,x,y+h,c);
          this.drawLine(x+w,y+h,x+w,y,c);this.drawLine(x+w,y+h,x,y+h,c);}
        drawImage(source,x,y){imageEngine.blit(this.raw,source.raw,'drawImage',x,y);}
        drawTransparentImage(source,x,y){imageEngine.blit(this.raw,source.raw,'drawTransparentImage',x,y);}
      }
      // Particle drawing targets one transparent layer; writes keeps color 0
      // pixels a source explicitly set apart from untouched ones.
      const screen={width:160,height:120,layer:null,
        setPixel(x,y,c){x|=0;y|=0;if(!this.layer || x<0 || y<0 || x>=160 || y>=120)return;const i=y*160+x;this.layer.pixels[i]=Number(c)&15;this.layer.writes[i]=1;},
        drawTransparentImage(source,x,y){if(!this.layer)return;imageEngine.blit(this.layer,source.raw,'drawTransparentImage',x,y);
          for(let i=0;i<this.layer.pixels.length;i++)if(this.layer.pixels[i])this.layer.writes[i]=1;}};
      // PXT image literals: '.' is transparent, each other character one hex color.
      const img=strings=>{
        const rows=String(strings.raw?strings.raw[0]:strings[0]).split('\\n').map(line=>line.replace(/[^0-9a-fA-F.]/g,'')).filter(Boolean);
        const width=Math.max(0,...rows.map(row=>row.length)),pixels=new Uint8Array(width*rows.length);
        rows.forEach((row,y)=>[...row].forEach((c,x)=>{pixels[y*width+x]=c==='.'?0:parseInt(c,16);}));
        return new PxtImage({width,height:rows.length,pixels});
      };
      class BaseSprite {
        constructor(z){this.z=z;ext._particleScene().addSprite(this);}
        get z(){return this._z;}
        set z(v){if(this._z!==v){this._z=v;ext._sceneFlags.dirty(ext._state());ext._particleOrderDirty=true;}}
        __visible(){return true;}
        __draw(camera){if(this.__visible())this.__drawCore(camera);}
        __drawCore(){}
        __update(){}
      }
      this._pxtImage=raw=>raw?new PxtImage(raw):undefined;
      this._particleScreen=screen;
      this._particleModule=dependencies.initializeParticles({
        game:{currentScene:()=>ext._particleScene(),
          onUpdate:fn=>{if(fn)ext._particleScene().update=fn;},
          onUpdateInterval:(period,fn)=>{if(fn && period>=0)ext._particleScene().intervals.push({period,fn,timer:0});}},
        // Image screen effects pause in control.runInParallel: their lowered
        // generators run as fibers beside music, redrawing the background
        // image after each step changes it.
        control:{millis:()=>ext._globalElapsedMs,ramSize:()=>32*1024*1024,
          runInParallel:fiber=>ext._music().spawn((function*(){
            const inner=fiber(),refresh=()=>{const image=ext._state().backgroundImage;if(image)ext._refreshImage(image);};
            for(let step=inner.next();!step.done;step=inner.next()){refresh();yield step.value;}
            refresh();
          })())},
        *pause(ms){yield ms;},
        screen,img,SpriteFlag:{Ghost:spriteFlags.Ghost},BaseSprite,
        scene:{SPRITE_Z:0,backgroundImage:()=>ext._pxtImage(ext._state().backgroundImage)},
        // pxsim Math_.randomRange
        randomRange:(min,max)=>{if(min==max)return min;if(min>max){const t=min;min=max;max=t;}
          return Math.floor(min)==min && Math.floor(max)==max ? min+Math.floor(Math.random()*(max-min+1)) : min+Math.random()*(max-min);}
      });
      return this._particleModule;
    }
    _particleScene() {
      const state=this._state(),ext=this;
      let scene=this._particleScenes.get(state);
      if(!scene){
        // Kept beside, not inside, the published device state: sources hold
        // anchors and factories that are not serializable.
        scene={particleSources:undefined,allSprites:[],get flags(){return state.flags;},set flags(value){state.flags=value;},update:null,intervals:[],
          get camera(){return ext._camera();},
          background:{hasBackgroundImage:()=>!!state.backgroundImage},
          addSprite(sprite){this.allSprites.push(sprite);sprite.id=state.nextSpriteId++;ext._sceneFlags.register(state,sprite);}};
        this._particleScenes.set(state,scene);
      }
      return scene;
    }
    _particleAnchor(sprite) {
      let anchor=this._particleAnchors.get(sprite);
      if(anchor)return anchor;
      const ext=this;
      anchor={
        get x(){return sprite.x;},get y(){return sprite.y;},get vx(){return sprite.vx;},get vy(){return sprite.vy;},
        get width(){return sprite.width;},get height(){return sprite.height;},
        get flags(){return sprite.flags;},
        get lifespan(){return sprite.lifespan;},set lifespan(value){sprite.lifespan=value;},
        get image(){ext._particles();return ext._pxtImage(sprite.image || ext._imageForSprite(sprite.id,{quiet:true}));},
        setImage(image){ext._particles();if(image?.raw)ext._assignSpriteRaster(sprite,image.raw);},
        setFlag(flag,on){sprite.flags=on?(sprite.flags|flag):(sprite.flags&~flag);ext._changed();}
      };
      this._particleAnchors.set(sprite,anchor);
      return anchor;
    }
    _assignSpriteRaster(sprite,image) {
      if(sprite._destroyed)return;
      sprite.image=image;delete sprite._wallHitbox;
      sprite._imageWidth=image.width;sprite._imageHeight=image.height;this._recalcSpriteSize(sprite);
      this._clampSprite(sprite);this._positionSprite(sprite.id);
      if(this._sprite(sprite.id))this._renderSpriteImage(sprite.id);
    }
    _particleEffect(name) {
      const effects=this._particles().effects,key=String(name);
      return Object.prototype.hasOwnProperty.call(effects,key) && typeof effects[key]?.start==='function' ? effects[key] : null;
    }
    _effectError(name){this._runtime?.emit?.('BLOCKS_ERROR',\`Arcade has no particle effect named "\${String(name)}".\`);}
    destroySpriteWithEffect(args,util) {
      const id=String(args.ID),sprite=this._spriteValues.get(id) || this._state().sprites[id];
      if(!sprite || (sprite.flags&2))return;
      const effect=this._particleEffect(args.EFFECT);
      if(!effect){this._effectError(args.EFFECT);return this.destroySprite({ID:id},util);}
      // PXT Sprite.destroy(effect, duration): Destroyed is set first, the sprite
      // keeps moving as a ghost until its lifespan ends in _destroyCore.
      sprite.flags=(sprite.flags|0)|2;sprite._destroying=true;
      effect.destroy(this._particleAnchor(sprite),Number(args.DURATION) || undefined);
      this._changed();
    }
    startSpriteEffect(args) {
      const id=String(args.ID),sprite=this._spriteValues.get(id) || this._state().sprites[id];
      if(!sprite)return;
      const effect=this._particleEffect(args.EFFECT);
      if(!effect)return this._effectError(args.EFFECT);
      effect.start(this._particleAnchor(sprite),Number(args.DURATION) || undefined,null,!!(sprite.flags & spriteFlags.RelativeToCamera));
      this._changed();
    }
    startScreenEffect(args) {
      const effect=this._particleEffect(args.EFFECT);
      if(!effect || typeof effect.startScreenEffect!=='function')return this._effectError(args.EFFECT);
      effect.startScreenEffect(Number(args.DURATION) || undefined);
      this._changed();
    }
    endScreenEffect(args) {
      const effect=this._particleEffect(args.EFFECT);
      if(!effect || typeof effect.endScreenEffect!=='function')return this._effectError(args.EFFECT);
      effect.endScreenEffect();
      this._changed();
    }
    clearSpriteEffects(args) {
      const id=String(args.ID),sprite=this._spriteValues.get(id) || this._state().sprites[id];
      if(sprite)this._particles().effects.clearParticles(this._particleAnchor(sprite));
      this._changed();
    }
    _drawParticleSources(state=this._state(),only=null) {
      const scene=this._particleScenes.get(state);
      const layers=[];
      if(scene?.allSprites.length){
        const screen=this._particleScreen,camera=this._camera(state);
        // scene.render draws allSprites by z then id.
        for(const source of scene.allSprites.slice().sort((a,b)=>a.z-b.z || a.id-b.id)){
          if(only && source!==only)continue;
          screen.layer={width:160,height:120,pixels:new Uint8Array(160*120),writes:new Uint8Array(160*120)};
          source.__draw(camera);
          layers.push({image:screen.layer,writes:screen.layer.writes,x:0,y:0,z:source.z,id:source.id,source});
        }
        screen.layer=null;
      }
      return layers;
    }
    _layerSvg(layer) {
      const paths=Array.from({length:16},()=>[]),palette=this._paletteColors();
      for(let y=0;y<120;y++)for(let x=0;x<160;){
        const i=y*160+x,color=layer.writes[i]?layer.image.pixels[i]:-1,start=x++;
        while(x<160 && (layer.writes[y*160+x]?layer.image.pixels[y*160+x]:-1)===color)x++;
        if(color>=0)paths[color].push('M'+start+' '+y+'h'+(x-start)+'v1h-'+(x-start)+'z');
      }
      return '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" shape-rendering="crispEdges">'+
        paths.map((path,color)=>path.length?'<path fill="'+(color?palette[color]:'#000000')+'" d="'+path.join('')+'"/>':'').join('')+'</svg>';
    }
    _renderOverlayLayers(layers) {
      const renderer=this._runtime?.renderer;
      if(!renderer)return;
      const live=new Set(layers.map(layer=>layer.source));
      for(const [source,entry] of this._particleOverlays)if(!live.has(source)){
        renderer.destroyDrawable(entry.drawableId,'sprite');renderer.destroySkin(entry.skinId);this._particleOverlays.delete(source);
      }
      let created=false;
      for(const layer of layers){
        const svg=this._layerSvg(layer);
        let entry=this._particleOverlays.get(layer.source);
        if(!entry){
          entry={skinId:renderer.createSVGSkin(svg,[80,60]),drawableId:renderer.createDrawable('sprite'),svg};
          renderer.updateDrawableSkinId(entry.drawableId,entry.skinId);
          renderer.updateDrawablePosition(entry.drawableId,[0,0]);
          renderer.updateDrawableScale(entry.drawableId,[300,300]);
          this._particleOverlays.set(layer.source,entry);created=true;
        }else if(entry.svg!==svg){renderer.updateSVGSkin(entry.skinId,svg,[80,60]);entry.svg=svg;}
        // Debug rasters have a synthetic cache key but share their sprite's
        // place in the scene, just as the CPU composition layers do.
        const owner=layer.bwSceneSprite || layer.source;
        if(entry.owner!==owner){entry.owner=owner;this._particleOrderDirty=true;}
      }
      if(created || this._particleOrderDirty){this._particleOrderDirty=false;this._orderSpriteDrawables();}
    }
    _clearParticleOverlays() {
      const renderer=this._runtime?.renderer;
      for(const entry of this._particleOverlays.values()){renderer?.destroyDrawable(entry.drawableId,'sprite');renderer?.destroySkin(entry.skinId);}
      this._particleOverlays.clear();
    }
    // PXT's global screen image. Only the scene's UPDATE_SCREEN frame handler
    // presents it, right after each render, so direct drawing outside paint
    // and shade renderables is never displayed (the original stays black).
    _screenRaw() {
      if(!this._screen)this._screen={width:160,height:120,pixels:new Uint8Array(160*120)};
      return this._screen;
    }
    // ---- game over: PXT's GameOverConfig and GameOverDialog (gameover-pxt.js),
    // run the way game.ts _gameOverImpl does ----
    _gameOverModule() {
      if(this._gameOverPxt)return this._gameOverPxt;
      const ext=this,text=this._pxtText();
      class DialogImage {
        constructor(raw){this.raw=raw;}
        get width(){return this.raw.width;}
        get height(){return this.raw.height;}
        getPixel(x,y){return imageEngine.getPixel(this.raw,x,y);}
        setPixel(x,y,c){imageEngine.draw(this.raw,'setPixel',x,y,c);}
        fillRect(x,y,w,h,c){imageEngine.draw(this.raw,'fillRect',x,y,w,h,c);}
        drawLine(x0,y0,x1,y1,c){imageEngine.draw(this.raw,'drawLine',x0,y0,x1,y1,c);}
        drawTransparentImage(source,x,y){imageEngine.blit(this.raw,source.raw,'drawTransparentImage',x,y);}
        // The simulator image helpers address a buffer through this shape.
        drawIcon(icon,x,y,color){text.drawIcon({_width:this.raw.width,_height:this.raw.height,data:this.raw.pixels,makeWritable(){},color:c=>Number(c)&15},{data:icon},x,y,color);}
        print(value,x,y,color,font){text.helpers.imagePrint(this,String(value),x,y,color,font);}
        printCenter(value,y,color,font){text.helpers.imagePrintCenter(this,String(value),y,color,font);}
      }
      // PXT image literals: '.' is transparent, each other character one hex color.
      const img=strings=>{
        const rows=String(strings.raw?strings.raw[0]:strings[0]).split(String.fromCharCode(10)).map(line=>line.replace(/[^0-9a-fA-F.]/g,'')).filter(Boolean);
        const width=Math.max(0,...rows.map(row=>row.length)),pixels=new Uint8Array(width*rows.length);
        rows.forEach((row,y)=>[...row].forEach((c,x)=>{pixels[y*width+x]=c==='.'?0:parseInt(c,16);}));
        return new DialogImage({width,height:rows.length,pixels});
      };
      const effects={};
      for(const name of ['confetti','hearts','smiles','blizzard','bubbles','starField','clouds','none'])effects[name]={kind:'particle',name};
      for(const name of ['dissolve','melt','slash','splatter'])effects[name]={kind:'image',name};
      this._gameOverEffects=effects;
      const music=this._music().pxt.music;
      this._dialogHost={wrap:raw=>new DialogImage(raw),img,image:{create:(width,height)=>{width=Number(width)|0;height=Number(height)|0;if(width<0||height<0||width>2000||height>2000)return undefined;return new DialogImage({width,height,pixels:new Uint8Array(width*height)});},
          font5:text.image.font5,font8:text.image.font8,font12:text.image.font12,getFontForText:value=>text.image.getFontForText(value)}};
      this._gameOverPxt=dependencies.initializeGameOver({
        image:this._dialogHost.image,img,screen:this._dialogScreen={width:160,height:120,isMono:false,target:null,
          fillRect(...a){this.target.fillRect(...a);},drawLine(...a){this.target.drawLine(...a);},print(...a){this.target.print(...a);}},effects,music,
        info:{isBetterScore:(next,previous)=>ext._isBetterScore(next,previous)},
        control:{},controller:{},scene:{}
      });
      this._gameOverPxt.game.eventContext=()=>({deltaTime:ext._state().frameDeltaTime || 0});
      return this._gameOverPxt;
    }
    _gameOverState() {
      if(!this._gameOver){const {game}=this._gameOverModule();this._gameOver={config:new game.GameOverConfig(),over:false};}
      return this._gameOver;
    }
    // info.isBetterScore
    _isBetterScore(next,previous) {
      const {game}=this._gameOverModule(),type=this._gameOverState().config.scoringType;
      if(type===game.ScoringType.HighScore)return previous==null || next>previous;
      if(type===game.ScoringType.LowScore)return previous==null || next<previous;
      return false;
    }
    _gameOverEffect(name,optional) {
      this._gameOverModule();
      const key=String(name);
      if(optional && key==='unset')return undefined;
      if(Object.prototype.hasOwnProperty.call(this._gameOverEffects,key))return this._gameOverEffects[key];
      this._runtime?.emit?.('BLOCKS_ERROR','Arcade has no background effect "'+key+'".');
      return null;
    }
    setGameOverEffect(args) {
      const effect=this._gameOverEffect(args.EFFECT,false);
      if(effect)this._gameOverState().config.setEffect(Scratch.Cast.toBoolean(args.WIN),effect,true);
    }
    setGameOverMessage(args) {this._gameOverState().config.setMessage(Scratch.Cast.toBoolean(args.WIN),String(Scratch.BWValues.decode(args.MESSAGE) ?? ''),true);}
    setGameOverPlayable(args) {
      const playable=this._musicValue(args.PLAYABLE,'Playable');
      if(playable)this._gameOverState().config.setSound(Scratch.Cast.toBoolean(args.WIN),playable,Scratch.Cast.toBoolean(args.LOOPING),true);
    }
    setGameOverScoringType(args) {
      const {game}=this._gameOverModule(),type=game.ScoringType[String(args.TYPE)];
      if(typeof type!=='number'){this._runtime?.emit?.('BLOCKS_ERROR','Arcade has no scoring type "'+String(args.TYPE)+'".');return;}
      this._gameOverState().config.setScoringType(type,true);
    }
    startImageEffect(args) {
      const name=String(args.EFFECT),effect=['dissolve','melt','slash','splatter'].includes(name)?this._particles().effects[name]:null;
      if(!effect){this._runtime?.emit?.('BLOCKS_ERROR','Arcade has no image effect "'+name+'".');return;}
      effect.startScreenEffect(Scratch.Cast.toNumber(args.TIMES) || undefined,Scratch.Cast.toNumber(args.DELAY) || undefined);
    }
    _carnivalCall(method,args) {
      try {
        if(!this._carnivalHost)this._carnivalHost=dependencies.createCarnivalHost(this);
        const result=this._carnivalHost[method](args);
        return result?.catch?result.catch(error=>{if(error.code!=='CARNIVAL_CANCELLED')throw error;}):result;
      }catch(error){if(error.code!=='CARNIVAL_CANCELLED')throw error;}
    }
    carnivalCountdown(args) {return this._carnivalCall('countdown',args);}
    carnivalAddLabel(args) {
      return this._carnivalCall('addLabel',{...args,LABEL:String(Scratch.BWValues.decode(args.LABEL) ?? ''),
        COLOR:Number(Scratch.BWValues.decode(args.COLOR)),HAS_COLOR:Scratch.Cast.toBoolean(args.HAS_COLOR)});
    }
    carnivalGameOver(args) {return this._carnivalCall('gameOver',args);}
    carnivalCustomGameOver(args) {
      return this._carnivalCall('customGameOver',{...args,
        MESSAGE:String(Scratch.BWValues.decode(args.MESSAGE) ?? ''),
        HAS_SOUND:Scratch.Cast.toBoolean(args.HAS_SOUND),HAS_SCORE:Scratch.Cast.toBoolean(args.HAS_SCORE),
        SCORE:Number(Scratch.BWValues.decode(args.SCORE))});
    }
    gameOver(args,util) {return this._runGameOver(Scratch.Cast.toBoolean(args.WIN),util,undefined,{method:'gameOver',args});}
    resetGame(args,util) {
      const runtime=this._runtime;
      if(runtime?.bwArcadeHoldControlReset){
        runtime.bwArcadeControlResets=(runtime.bwArcadeControlResets||0)+1;
        // The original simulator posts its request and never resumes this
        // fiber. Stop/Load invalidates its async lease before cleanup resolves it.
        return new Promise(resolve=>this._resetSuspensions.add(resolve));
      }
      if(typeof runtime?.greenFlag!=='function'||typeof runtime.sequencer?.retireThread!=='function'||!Array.isArray(runtime.threads))throw new Error('Arcade reset requires the real VM restart lifecycle');
      // The sequencer may still hold its current thread-array snapshot. Retire
      // every old entry through its lifecycle API before greenFlag replaces it;
      // merely removing runtime.threads could run an old sibling in this pass.
      const old=new Set(runtime.threads);if(util?.thread)old.add(util.thread);
      for(const thread of old)runtime.sequencer.retireThread(thread);
      runtime.greenFlag();
    }
    // game.over(win, effect?): the effect applies unless the program chose one.
    legacyGameOver(args,util) {
      const win=Scratch.Cast.toBoolean(args.WIN),effect=this._gameOverEffect(args.EFFECT,true);
      if(effect===null)return;
      this._gameOverState().config.setEffect(win,effect,false);
      return this._runGameOver(win,util,undefined,{method:'legacyGameOver',args});
    }
    // Resolves after ms of Arcade time (PXT pause).
    _arcadePause(ms) {return new Promise(resolve=>this._music().spawn((function*(){yield ms;resolve();})()));}
    // controller.pauseUntilAnyButtonIsPressed: the next button press.
    _nextButtonPress() {return new Promise(resolve=>{(this._buttonPressWaiters || (this._buttonPressWaiters=[])).push(resolve);});}
    waitAnyButton() {return new Promise(resolve=>this._nativeButtonWaiters.add(resolve));}
    _buttonPressed() {const waiters=this._buttonPressWaiters;this._buttonPressWaiters=[];if(waiters)for(const resolve of waiters)resolve();for(const resolve of this._nativeButtonWaiters)resolve();this._nativeButtonWaiters.clear();}
    _prepareGameOverScores(judged,win,players) {
      const {game}=this._gameOverModule();
      // Display fallback and raw comparator reads are separate SDK operations.
      const previousBest=judged && this._readHighScore();
      let winner=null,winningScore=null;
      if(judged && win)for(const player of players)if(this._isBetterScore(player.score,winningScore)){winningScore=player.score;winner=player;}
      const scores=players.map(player=>new game.GameOverPlayerScore(player.number,player.score,player===winner));
      if(judged && winner){
        const stored=this._settingsStore().call('readNumber','high-score');
        if(this._isBetterScore(winner.score,stored))this._settingsStore().call('writeNumber','high-score',winner.score);
      }
      return {previousBest,winner,scores};
    }
    async _runGameOver(win,util,capturedFrame,storageCall) {
      const epoch=this._terrainEpoch;
      const go=this._gameOverState();
      if(go.over)return;
      go.over=true;
      const ext=this,{game}=this._gameOverModule(),goc=go.config,state=this._infoState();
      const judged=goc.scoringType!==game.ScoringType.None;
      const players=(state.players || []).map((player,index)=>({number:index+1,score:player?.score})).filter(player=>player.score!==undefined);
      let previousBest,winner,scores;
      try {({previousBest,winner,scores}=this._prepareGameOverScores(judged,win,players));}
      catch(error) {
        // No yield preceded this actual storage failure; retain its primitive loan.
        if(storageCall)return this._highScoreFailure(storageCall.method,storageCall.args,util,error);
        throw error;
      }
      if(epoch!==this._terrainEpoch)return;
      const message=goc.getMessage(win,false),effect=goc.getEffect(win),sound=goc.getSound(win);
      const mode=goc.getSoundLooping(win)?this._music().pxt.music.PlaybackMode.LoopingInBackground:this._music().pxt.music.PlaybackMode.InBackground;
      // Explicit game over captures the last frame; default info loss captures
      // the partial HUD pass at the original terminal draw boundary.
      const shown=capturedFrame || (state._hudPass?.epoch===this._terrainEpoch && state._hudPass.screen.pixels.slice()) ||
        (this._state()._renderPass?.epoch===this._terrainEpoch && this._state()._renderPass.screen.pixels.slice()) || state.sceneFrame?.pixels?.slice() || new Uint8Array(160*120);
      while(this._sceneStack.length){const pending=this.popScene({},util);if(epoch!==this._terrainEpoch)return;if(pending?.then)await pending;if(epoch!==this._terrainEpoch)return;}
      const pushed=this.pushScene({},util);if(epoch!==this._terrainEpoch)return;if(pushed?.then)await pushed;if(epoch!==this._terrainEpoch)return;
      const scene=this._state();
      scene.backgroundImage={width:160,height:120,pixels:shown};this._renderBackgroundImage();
      if(sound)this._music().spawn(this._music().pxt.music.play(sound,mode));
      if(effect?.kind==='particle')this.startScreenEffect({EFFECT:effect.name,DURATION:0});
      else if(effect?.kind==='image') {
        // An image effect runs in control.runInParallel: its first step comes after
        // the fiber that started it yields, i.e. after the new scene's first frame.
        const imageEffect=this._particles().effects[effect.name],start=()=>{if(epoch===ext._terrainEpoch && ext._state()===scene)imageEffect.startScreenEffect();};
        if(scene._framesDone)start();else (scene._afterFrame || (scene._afterFrame=[])).push(start);
      }
      await this._arcadePause(400);
      if(epoch!==this._terrainEpoch || this._state()!==scene)return;
      const dialog=new game.GameOverDialog(win,message,judged,scores,previousBest,undefined);
      this._addSceneRenderable(scene,{z:100,id:scene.nextSpriteId++,draw:screen=>{
        dialog.update();
        imageEngine.blit(screen,dialog.image.raw,'drawTransparentImage',0,(120-dialog.image.height)>>1);
      }});
      await this._arcadePause(500);
      if(epoch!==this._terrainEpoch)return;
      dialog.displayCursor();
      await this._nextButtonPress();
      if(epoch!==this._terrainEpoch)return;
      // control.reset restarts the program. A host that owns restarts (the
      // differential harness: the original simulator only posts a restart
      // message to its parent) holds it and counts the request instead.
      if(this._runtime?.bwArcadeHoldControlReset){this._runtime.bwArcadeControlResets=(this._runtime.bwArcadeControlResets || 0)+1;return;}
      this._runtime?.stopAll?.();
      this._runtime?.greenFlag?.();
    }
    // game.ask: game.showDialog (gameover-pxt.js) draws over the screen as the last
    // frame left it, and nothing repaints it until the question is answered. The
    // simulator's display shows that screen only at its fallback refresh
    // (screen/frame.ts: a loop that pauses 200 ms and refreshes when no frame
    // updated the display meanwhile), so the dialog appears at the first such
    // check at least 200 ms after the last frame.
    _screenClock() {return this._sourceSceneTimers()?this._programMillis():this._globalElapsedMs;}
    _drawAskDialog(dialog) {
      const {game}=this._gameOverModule(),state=this._state();
      // A question raised from inside the frame's draw (a HUD-pass event) is
      // asked once that draw is over: the screen as drawn so far.
      const pass=(state._hudPass?.epoch===this._terrainEpoch && state._hudPass) || (state._renderPass?.epoch===this._terrainEpoch && state._renderPass);
      const base=pass?.screen?.pixels || state.sceneFrame?.pixels || this._screenRaw().pixels;
      // PXT shows that frame before the question starts; the frame's own tail must not repaint over it.
      if(pass)state._askPaintDone=true;
      const raw={width:160,height:120,pixels:base.slice()};
      this._dialogScreen.target=this._dialogHost.wrap(raw);
      try {game.showDialog(dialog.title,dialog.subtitle,'A = OK, B = CANCEL');}
      finally {this._dialogScreen.target=null;}
      const now=this._screenClock(),last=this._lastScreenUpdateMs ?? now;
      const refreshAt=200*(Math.ceil(last/200-1e-9)+1);
      dialog.screen=raw.pixels;dialog.refreshIn=Math.max(0,refreshAt-now);
    }
    // On the program clock game.ask runs as PXT's ask.ts does, in a fiber of its
    // own: pause(500), then pauseUntil over the live A/B state (an immediate
    // check, then base/poll.ts's 50 ms polling), independently of the frame
    // that raised it (a HUD-pass event handler may still be waiting for it).
    _startAskFiber(dialog) {
      const epoch=this._programClockEpoch;
      if(!this._sourceSceneTimers() || !epoch?.setTimeout)return;
      dialog.fiber=true;
      // game.ask pushes an event context: the scene's frame worker is unregistered for as long as the
      // prompt is up, and popping registers a fresh worker that waits (on the poll queue) for the old one to exit.
      const owner=this._state(),held=this._askHeldScenes || (this._askHeldScenes=new WeakSet()),frames=this._sceneFrameContexts();
      held.add(owner);frames.unregister(owner);
      const dismiss=dialog.dismiss;
      dialog.dismiss=answer=>{
        const open=this._dialogs?.[0]===dialog;dismiss(answer);
        if(open && this._dialogs?.[0]!==dialog && held.delete(owner) && this._sourceSceneTimers())this._sceneFrameContexts().register(owner);
      };
      const live=()=>this._dialogs?.[0]===dialog && this._programClockEpoch===epoch && epoch.active;
      const continuation=()=>this._runtime._arcadeFramePhase?.requestContinuation?.()?.catch?.(error=>this._runtime?.emit?.('BLOCKS_ERROR',String(error?.message || error)));
      if(dialog.screen)epoch.setTimeout(()=>{if(live() && dialog.screen)this._showAskScreen(dialog);},dialog.refreshIn)?.unref?.();
      let aNotHeld=false,bNotHeld=false,answer=null;
      const condition=()=>{
        const a=this._heldButton(1,'a'),b=this._heldButton(1,'b');
        aNotHeld=aNotHeld || !a;bNotHeld=bNotHeld || !b;
        if(aNotHeld && a)answer=true;else if(bNotHeld && b)answer=false;
        return answer!==null;
      };
      const finish=()=>{if(live()){dialog.elapsed=500;dialog.dismiss(answer);}};
      epoch.setTimeout(()=>{
        if(!live())return;
        // The 500 ms guard has passed: publish readiness the way _pumpQuestion
        // does on the frame path, so the dialog's Yes/No controls enable.
        dialog.elapsed=500;this._showNextDialog();
        if(condition()){finish();continuation();}
        else this._nativePollEvents().enqueue(condition,finish);
      },500)?.unref?.();
    }
    _showAskScreen(dialog) {
      const pixels=dialog.screen;dialog.screen=null;
      const state=this._state(),frame=state.sceneFrame || (state.sceneFrame={width:160,height:120,pixels:new Uint8Array(160*120)});
      frame.pixels.set(pixels);this._screenRaw().pixels.set(pixels);frame.sequence=(frame.sequence || 0)+1;
      this._changed();
    }
    screenImage() {return this._imageHandle(this._screenRaw());}
    // An asset literal the project does not carry compiles in PXT and evaluates to undefined (an animation made from it
    // is a no-op). Any other absent name stays the inert stand-in.
    _absentAsset(args) {return /^assets\./.test(String(args?.NAME ?? ''));}
    externalValue(args) {return this._absentAsset(args) ? Scratch.BWValues.encode(undefined) : 0;}
    externalImage(args) {return this._absentAsset(args) ? Scratch.BWValues.encode(undefined) : this._imageHandle({width: 1, height: 1, pixels: new Uint8Array(1)});}
    externalImageCall() {return this.externalImage();}
    externalCall() {return 0;}
    externalCommand() {}
    registerExternalHandler() {}
    whenRegisteredExternal(args,util) {return this.whenRegisteredWall(args,util);}
    // ---- music: PXT's mixer runs as fibers on the Arcade clock (music.js) ----
    _music() {
      // Source timers: PXT fibers run on the program clock and resume from their
      // own pause deadline (a timer), not at the next scene frame's pump.
      if(!this._musicHost)this._musicHost=dependencies.createMusic({initializePxtMusic:dependencies.initializeMusic,
        clock:()=>this._sourceSceneTimers()?this._programMillis():this._globalElapsedMs,
        wake:delay=>{
          if(!this._sourceSceneTimers())return;
          const epoch=this._programClockEpoch;
          const handle=epoch.setTimeout(()=>{
            if(this._programClockEpoch!==epoch || !epoch.active || !this._sourceSceneTimers())return;
            this._musicHost?.pump();this._runtime._arcadeFramePhase.requestContinuation().catch(error=>this._runtime?.emit?.('BLOCKS_ERROR',String(error?.message || error)));
          },delay);handle?.unref?.();
        },audioContext:()=>this._runtime?.audioEngine?.audioContext || null,
        onError:error=>this._runtime?.emit?.('BLOCKS_ERROR',String(error?.message || error))});
      // The queued play instructions, for observation (newest last, bounded).
      if(this._runtime)this._runtime.bwArcadeMusicLog=this._musicHost.log;
      return this._musicHost;
    }
    // The scroller extension (arcade-background-scroll) runs its original source
    // (scroller-pxt.js). Its frame handler runs after the camera update and
    // before rendering, as PXT's pre-render priority places it; each layer is a
    // renderable of its scene.
    setBackgroundScrollVersion(args) {
      const version=String(args.VERSION);
      if(!['v0.1.2','43651f88b917a98ad886fdd4c1c2ad8001ce9b9c'].includes(version)) {
        this._runtime?.emit?.('BLOCKS_ERROR','Arcade background scroll version is not implemented: '+version);return;
      }
      if(this._scrollerModule && version!==this._scrollerVersion) {
        this._runtime?.emit?.('BLOCKS_ERROR','Arcade background scroll version must be selected before its first operation.');return;
      }
      this._scrollerVersion=version;
    }
    _scroller() {
      if (this._scrollerModule) return this._scrollerModule;
      const ext=this;
      if(this._scrollerVersion==='43651f88b917a98ad886fdd4c1c2ad8001ce9b9c') {
        this._scrollerModule=dependencies.createLegacyScrollerHost(this,imageEngine,dependencies.initializeLegacyScroller);
        return this._scrollerModule;
      }
      const wrap=raw=>raw?{raw,get width(){return raw.width;},get height(){return raw.height;}}:null;
      this._scrollerModule=dependencies.initializeScroller({
        game:{
          currentScene:()=>{
            const state=ext._state();
            return {
              eventContext:{
                registerFrameHandler:(order,handler)=>{const list=ext._frameHandlersOf(state);let i=list.length;while(i>0 && list[i-1].order>order)i--;list.splice(i,0,{order,handler});},
                get deltaTime(){return state.frameDeltaTime || 0;}
              },
              camera:ext._camera()
            };
          },
          addScenePushHandler:handler=>{if(handler)ext._scenePushHandlers.push({host:handler});},
          addScenePopHandler:handler=>{if(handler)ext._scenePopHandlers.push({host:handler});}
        },
        scene:{
          PRE_RENDER_UPDATE_PRIORITY:55,
          createRenderable:(z,draw)=>{
            const state=ext._state(),renderable={z,id:state.nextSpriteId++,draw:screen=>draw({
              drawTransparentImage:(image,x,y)=>{if(image?.raw)imageEngine.blit(screen,image.raw,'drawTransparentImage',x,y);}})};
            ext._addSceneRenderable(state,renderable);
            return renderable;
          },
          // PXT's background always has an image: a blank screen-sized one until set.
          backgroundImage:()=>{
            const state=ext._state();
            if(!state.backgroundImage)state.backgroundImage={width:160,height:120,pixels:new Uint8Array(160*120)};
            return wrap(state.backgroundImage);
          }
        }
      });
      return this._scrollerModule;
    }
    // The character animations extension runs its original main.ts
    // (character-animations-pxt.js) on native sprites. Its frame handler
    // follows physics at PXT's ANIMATION_UPDATE_PRIORITY.
    setCharacterAnimationVersion(args) {
      const version=String(args.VERSION);
      const legacy=dependencies.initializeLegacyCharacterAnimations.sourceIdentity.revision;
      if(version!=='v0.1.0' && version!==legacy) {
        this._runtime?.emit?.('BLOCKS_ERROR','Arcade character animation version is not implemented: '+version);return;
      }
      if(this._characterAnimationModule && version!==this._characterAnimationVersion) {
        this._runtime?.emit?.('BLOCKS_ERROR','Arcade character animation version must be selected before its first operation.');return;
      }
      this._characterAnimationVersion=version;
    }
    _characterAnimations() {
      if (this._characterAnimationModule) return this._characterAnimationModule;
      if(this._characterAnimationVersion===dependencies.initializeLegacyCharacterAnimations.sourceIdentity.revision) {
        this._characterAnimationModule=dependencies.createLegacyCharacterHost(this,dependencies.initializeLegacyCharacterAnimations);
        return this._characterAnimationModule;
      }
      const ext=this,wrappers=new WeakMap();
      const button=name=>({isPressed:()=>ext._heldButton(1,name)});
      this._characterAnimationModule=dependencies.initializeCharacterAnimations({
        game:{
          currentScene:()=>{
            const state=ext._state();
            return {eventContext:{
              registerFrameHandler:(order,handler)=>{const list=ext._frameHandlersOf(state);let i=list.length;while(i>0 && list[i-1].order>order)i--;list.splice(i,0,{order,handler});},
              get deltaTimeMillis(){return Math.round((state.frameDeltaTime || 0)*1000);}
            }};
          },
          addScenePushHandler:handler=>{if(handler)ext._scenePushHandlers.push({host:handler});},
          addScenePopHandler:handler=>{if(handler)ext._scenePopHandlers.push({host:handler});}
        },
        scene:{ANIMATION_UPDATE_PRIORITY:15},
        // PXT sprites.Flag.Destroyed (1 << 1).
        sprites:{Flag:{Destroyed:2}},
        controller:{player1:{up:button('up'),down:button('down'),left:button('left'),right:button('right')}},
        CollisionDirection:{Left:0,Top:1,Right:2,Bottom:3}
      });
      const module=this._characterAnimationModule;
      // One wrapper per native sprite, so the module's identity checks hold.
      module.sprite=sprite=>{
        if(!sprite)return null;
        let wrapper=wrappers.get(sprite);
        if(wrapper)return wrapper;
        wrapper={
          get x(){return ext.spriteProperty({ID:sprite.id,PROPERTY:'x'});},
          get y(){return ext.spriteProperty({ID:sprite.id,PROPERTY:'y'});},
          get vx(){return ext.spriteProperty({ID:sprite.id,PROPERTY:'vx'});},
          get vy(){return ext.spriteProperty({ID:sprite.id,PROPERTY:'vy'});},
          get flags(){return ext._state().sprites[sprite.id]===sprite ? 0 : (2);},
          isHittingTile:direction=>ext.isHittingTile({ID:sprite.id,DIRECTION:direction}),
          // PXT setImage ignores the current image; frames are image values.
          setImage:value=>{const image=ext._image(value);if(image && sprite.image!==image && ext._state().sprites[sprite.id]===sprite)ext.setSpriteImage({ID:sprite.id,IMAGE:ext._imageHandle(image)});}
        };
        wrappers.set(sprite,wrapper);
        return wrapper;
      };
      return module;
    }
    _characterSprite(value) {return this._characterAnimations().sprite(this._spriteValues.get(String(value)));}
    _characterRuleValue(value) {return Math.floor(Scratch.Cast.toNumber(Scratch.BWValues.decode(value)));}
    characterFrames(args) {
      const module=this._characterAnimations(),sprite=this._characterSprite(args.SPRITE),frames=Scratch.BWValues.arrayValue(this._runtime,args.FRAMES);
      const call=String(args.MODE)==='run'?'runFrames':'loopFrames';
      module.characterAnimations[call](sprite,frames,Scratch.Cast.toNumber(Scratch.BWValues.decode(args.INTERVAL)),this._characterRuleValue(args.RULE));
    }
    setCharacterAnimationsEnabled(args) {this._characterAnimations().characterAnimations.setCharacterAnimationsEnabled(this._characterSprite(args.SPRITE),Scratch.BWValues.truth(args.ENABLED));}
    setCharacterState(args) {this._characterAnimations().characterAnimations.setCharacterState(this._characterSprite(args.SPRITE),this._characterRuleValue(args.RULE));}
    clearCharacterState(args) {this._characterAnimations().characterAnimations.clearCharacterState(this._characterSprite(args.SPRITE));}
    _characterApi(name) {
      const api=this._characterAnimations().characterAnimations;
      if(typeof api[name]!=='function') {
        this._runtime?.emit?.('BLOCKS_ERROR','Arcade character animation '+name+' is not implemented for version '+this._characterAnimationVersion+'.');return null;
      }
      return api;
    }
    setCharacterController(args) {const api=this._characterApi('setController');if(api)api.setController(this._characterSprite(args.SPRITE),Scratch.BWValues.truth(args.ENABLED));}
    lockCharacterFacing(args) {
      const api=this._characterApi('lockFacingDirection');if(!api)return;
      const direction=api.FacingDirection[String(args.DIRECTION)];
      if(direction===undefined){this._runtime?.emit?.('BLOCKS_ERROR','Arcade has no character facing direction "'+String(args.DIRECTION)+'".');return;}
      api.lockFacingDirection(this._characterSprite(args.SPRITE),direction);
    }
    unlockCharacterFacing(args) {const api=this._characterApi('unlockFacingDirection');if(api)api.unlockFacingDirection(this._characterSprite(args.SPRITE));}
    characterRuleToString(args) {return this._characterAnimations().characterAnimations.ruleToString(Scratch.Cast.toNumber(Scratch.BWValues.decode(args.RULE)));}
    characterRule(args) {
      const module=this._characterAnimations(),names=String(args.PREDICATES).trim().split(/\\s+/).filter(Boolean);
      const values=names.map(name=>Object.prototype.hasOwnProperty.call(module.Predicate,name) && typeof module.Predicate[name]==='number' ? module.Predicate[name] : undefined);
      if(!names.length || names.length>5 || values.includes(undefined)){this._runtime?.emit?.('BLOCKS_ERROR','Arcade character rule needs one to five predicates, not "'+String(args.PREDICATES)+'".');return 0;}
      return module.characterAnimations.rule(...values);
    }
    characterMatchesRule(args) {
      const sprite=this._characterSprite(args.SPRITE);
      return sprite ? !!this._characterAnimations().characterAnimations.matchesRule(sprite,this._characterRuleValue(args.RULE)) : false;
    }
    _frameHandlersOf(state=this._state()) {
      let list=this._frameHandlers.get(state);
      if(!list){list=[];this._frameHandlers.set(state,list);}
      return list;
    }
    // PXT frame handlers by priority: below UPDATE_INTERVAL_PRIORITY (19) they
    // run after physics and before the update handlers, the rest after the camera.
    _runFrameHandlers(state,low=19,high=Infinity) {
      const list=this._frameHandlers.get(state);
      if(list)for(let i=0;i<list.length;i++)if(list[i].order>=low && list[i].order<high)list[i].handler();
    }
    _scrollerLayer(value) {
      const layer=Math.floor(Scratch.Cast.toNumber(value));
      if(this._scrollerVersion!=='v0.1.2' && layer!==0)throw new Error('Legacy Arcade background scroll does not support layers.');
      return layer;
    }
    scrollBackgroundWithCamera(args) {
      const modes={OnlyHorizontal:0,OnlyVertical:1,BothDirections:2},mode=modes[String(args.MODE)];
      if(mode===undefined){this._runtime?.emit?.('BLOCKS_ERROR','Arcade has no camera scroll mode "'+String(args.MODE)+'".');return;}
      this._scroller().scroller.scrollBackgroundWithCamera(mode,this._scrollerLayer(args.LAYER));
    }
    scrollBackgroundWithSpeed(args) {this._scroller().scroller.scrollBackgroundWithSpeed(Scratch.Cast.toNumber(args.VX),Scratch.Cast.toNumber(args.VY),this._scrollerLayer(args.LAYER));}
    setBackgroundScrollMultipliers(args) {this._scroller().scroller.setCameraScrollingMultipliers(Scratch.Cast.toNumber(args.X),Scratch.Cast.toNumber(args.Y),this._scrollerLayer(args.LAYER));}
    setBackgroundScrollOffset(args) {this._scroller().scroller.setBackgroundScrollOffset(Scratch.Cast.toNumber(args.X),Scratch.Cast.toNumber(args.Y),this._scrollerLayer(args.LAYER));}
    setBackgroundLayerImage(args) {
      if(this._scrollerVersion!=='v0.1.2') {this._runtime?.emit?.('BLOCKS_ERROR','Legacy Arcade background scroll does not support layers.');return;}
      const image=this._image(args.IMAGE);
      if(!image){this._runtime?.emit?.('BLOCKS_ERROR','Arcade background layers need an image.');return;}
      this._scroller().scroller.setLayerImage(this._scrollerLayer(args.LAYER),{raw:image,get width(){return image.width;},get height(){return image.height;}});
    }
    setBackgroundLayerZ(args) {
      if(this._scrollerVersion!=='v0.1.2') {this._runtime?.emit?.('BLOCKS_ERROR','Legacy Arcade background scroll does not support layers.');return;}
      this._scroller().scroller.setLayerZIndex(this._scrollerLayer(args.LAYER),Scratch.Cast.toNumber(args.Z));}
    backgroundScrollOffset(args) {
      const scroller=this._scroller().scroller,layer=this._scrollerLayer(args.LAYER);
      return String(args.AXIS)==='y' ? scroller.getBackgroundYOffset(layer) : scroller.getBackgroundXOffset(layer);
    }
    // The sprite extensions (darts, corgio) run their original classes
    // (sprite-extensions-pxt.js). Their sprites.ExtendableSprite base is a real
    // native sprite; game.onUpdate and button events join the scene's
    // registration lists in order, beside the program's own handlers.
    _spriteExtensions() {
      if (this._spriteExtensionModule) return this._spriteExtensionModule;
      const ext=this;
      class ExtensionImage {
        constructor(raw){this.raw=raw;}
        get width(){return this.raw.width;}
        get height(){return this.raw.height;}
        clone(){return new ExtensionImage({width:this.raw.width,height:this.raw.height,pixels:this.raw.pixels.slice()});}
        flipX(){imageEngine.mutate(this.raw,'flipX',0,0);ext._refreshImage(this.raw);}
        flipY(){imageEngine.mutate(this.raw,'flipY',0,0);ext._refreshImage(this.raw);}
        setPixel(x,y,c){imageEngine.draw(this.raw,'setPixel',x,y,c);ext._refreshImage(this.raw);}
        getPixel(x,y){return imageEngine.getPixel(this.raw,x,y);}
      }
      // PXT image literals: '.' is transparent, each other character one hex color.
      const img=strings=>{
        const rows=String(strings.raw?strings.raw[0]:strings[0]).split('\\n').map(line=>line.replace(/[^0-9a-fA-F.]/g,'')).filter(Boolean);
        const width=Math.max(0,...rows.map(row=>row.length)),pixels=new Uint8Array(width*rows.length);
        rows.forEach((row,y)=>[...row].forEach((c,x)=>{pixels[y*width+x]=c==='.'?0:parseInt(c,16);}));
        return new ExtensionImage({width,height:rows.length,pixels});
      };
      const flagNames=Object.fromEntries(Object.entries(spriteFlags).map(([name,mask])=>[mask,name]));
      class ExtendableSprite {
        constructor(image,kind){
          const raw=image?.raw || {width:16,height:16,pixels:new Uint8Array(256)},width=raw.width,height=raw.height;
          const id=ext._createSprite({KIND:kind,TEMPLATE:'',WIDTH:width,HEIGHT:height,X:((160-width)>>1)+width/2,Y:((120-height)>>1)+height/2});
          Object.defineProperty(this,'__bwId',{value:id});
          ext._assignSpriteRaster(ext._state().sprites[id],raw);
          ext._extensionSprites.set(id,this);
          // PXT runs created handlers inside the constructor; a handler that
          // pauses makes the creating block wait for it.
          const created=ext._finishSpriteCreation(id,ext._extensionUtil);
          if(created?.then)ext._extensionCreationWaits.push(created);
          this.hasCustomDimensions=false;
        }
        update(){}
        setImage(image){const sprite=ext._sprite(this.__bwId);if(image?.raw && sprite && sprite.image!==image.raw)ext._assignSpriteRaster(sprite,image.raw);}
        get image(){const sprite=ext._sprite(this.__bwId);return sprite?.image?new ExtensionImage(sprite.image):null;}
        setFlag(flag,on){const name=flagNames[flag];if(name)ext.setSpriteFlag({ID:this.__bwId,FLAG:name,ON:!!on});}
        say(text,timeOnScreen){ext.spriteSay({ID:this.__bwId,TEXT:text,DURATION:timeOnScreen===undefined?-1:timeOnScreen,ANIMATED:0,FOREGROUND:15,BACKGROUND:1,MODE:'legacy'},ext._extensionUtil);}
        isHittingTile(direction){return ext.isHittingTile({ID:this.__bwId,DIRECTION:direction});}
        destroy(){ext.destroySprite({ID:this.__bwId},ext._extensionUtil);}
      }
      for(const property of ['x','y','vx','vy','ax','ay','fx','fy','left','right','top','bottom','z','lifespan'])
        Object.defineProperty(ExtendableSprite.prototype,property,{configurable:true,
          get(){return ext.spriteProperty({ID:this.__bwId,PROPERTY:property});},
          set(value){ext.setSpriteProperty({ID:this.__bwId,PROPERTY:property,VALUE:value});}});
      for(const property of ['width','height'])
        Object.defineProperty(ExtendableSprite.prototype,property,{configurable:true,get(){return ext.spriteProperty({ID:this.__bwId,PROPERTY:property});}});
      const button=name=>({
        isPressed:()=>ext._heldButton(1,name),
        onEvent:(event,handler)=>{if(handler)ext._buttonHandlers.push({player:1,button:name,event:Number(event),host:handler});}
      });
      // PXT controller._dxInternal: step times the frame's delta time.
      const axis=(negative,positive)=>(step=100)=>{
        const dt=ext._state().frameDeltaTime || 0,low=ext._heldButton(1,negative),high=ext._heldButton(1,positive);
        return low ? (high ? 0 : -step*dt) : high ? step*dt : 0;
      };
      const module=dependencies.initializeSpriteExtensions({
        sprites:{ExtendableSprite},img,
        screen:{width:160,height:120},
        SpriteFlag:spriteFlags,
        CollisionDirection:{Left:0,Top:1,Right:2,Bottom:3},
        ControllerButtonEvent:{Pressed:2049,Released:2048,Repeated:2054},
        game:{
          onUpdate:handler=>{if(handler)ext._updateHandlers.push({host:handler});},
          currentScene:()=>({camera:ext._camera()})
        },
        controller:{dx:axis('left','right'),dy:axis('up','down'),up:button('up'),down:button('down'),left:button('left'),right:button('right'),A:button('a'),B:button('b')},
        scene:{
          centerCameraAt:(x,y)=>ext.centerCameraAt({X:x,Y:y}),
          setBackgroundImage:image=>{if(image?.raw)ext.setBackgroundImage({IMAGE:ext._imageHandle(image.raw)});},
          // PXT scene.createRenderable: draw into the screen image with the
          // camera; shouldBeVisible gates each frame's drawing.
          createRenderable:(z,draw,shouldBeVisible)=>{
            const state=ext._state(),renderable={z,id:state.nextSpriteId++,draw:screen=>{
              if(shouldBeVisible && !shouldBeVisible())return;
              const camera=ext._camera(),target={setPixel:(x,y,c)=>imageEngine.draw(screen,'setPixel',x,y,c)};
              draw(target,{offsetX:camera.drawOffsetX ?? camera.offsetX,offsetY:camera.drawOffsetY ?? camera.offsetY});
            }};
            ext._addSceneRenderable(state,renderable);
            return {destroy:()=>{const list=ext._renderablesOf(state),index=list.indexOf(renderable);if(index>=0)list.splice(index,1);}};
          }
        },
        // pxsim Math_.pickRandom over Math.randomRange
        pickRandom:list=>list && list.length ? list[Math.floor(Math.random()*list.length)] : undefined
      });
      this._spriteExtensionModule=module;
      return module;
    }
    // Run an extension call as the creating block, then wait for any created
    // handler that paused, as PXT's constructor would.
    _withExtension(util,call) {
      this._extensionUtil=util;this._extensionCreationWaits=[];
      let result;
      try {result=call(this._spriteExtensions());} finally {this._extensionUtil=undefined;}
      const waits=this._extensionCreationWaits;this._extensionCreationWaits=[];
      return waits.length ? Promise.all(waits).then(()=>result) : result;
    }
    _extensionSprite(value,kind) {
      const sprite=this._extensionSprites?.get(String(value));
      if(sprite && sprite instanceof this._spriteExtensions()[kind] && this._sprite(sprite.__bwId))return sprite;
      this._runtime?.emit?.('BLOCKS_ERROR','Arcade expected a '+(kind==='Dart'?'dart':'corgi')+'.');
      return null;
    }
    createDart(args,util) {
      const image=this._image(args.IMAGE);
      if(!image){this._runtime?.emit?.('BLOCKS_ERROR','Arcade darts need an image.');return '';}
      return this._withExtension(util,module=>module.darts.create(new (this._spriteExtensionImage())(image),this._kindValue(args.KIND),
        Scratch.Cast.toNumber(args.X),Scratch.Cast.toNumber(args.Y)).__bwId);
    }
    _spriteExtensionImage() {return Object.getPrototypeOf(this._spriteExtensions().corgio._corgi_still[0]).constructor;}
    createCorgi(args,util) {
      return this._withExtension(util,module=>module.corgio.create(this._kindValue(args.KIND),Scratch.Cast.toNumber(args.X),Scratch.Cast.toNumber(args.Y)).__bwId);
    }
    dartAction(args,util) {
      const dart=this._extensionSprite(args.SPRITE,'Dart'),action=String(args.ACTION);
      if(dart && ['throwDart','stopDart'].includes(action))this._withExtension(util,()=>dart[action]());
    }
    dartSwitch(args,util) {
      const dart=this._extensionSprite(args.SPRITE,'Dart'),setting=String(args.SETTING);
      if(dart && ['setTrace','controlWithArrowKeys'].includes(setting))this._withExtension(util,()=>dart[setting](Scratch.Cast.toBoolean(args.ON)));
    }
    setDartProperty(args) {
      const dart=this._extensionSprite(args.SPRITE,'Dart'),property=String(args.PROPERTY);
      if(dart && ['angle', 'pow', 'iter', 'traceColor', 'gravity', 'wind', 'angleRate', 'powerRate'].includes(property))dart[property]=Scratch.Cast.toNumber(args.VALUE);
    }
    dartProperty(args) {
      const dart=this._extensionSprite(args.SPRITE,'Dart'),property=String(args.PROPERTY);
      return dart && ['angle', 'pow', 'iter', 'traceColor', 'gravity', 'wind', 'angleRate', 'powerRate'].includes(property) ? dart[property] : 0;
    }
    corgiControl(args,util) {
      const corgi=this._extensionSprite(args.SPRITE,'Corgio'),mode=String(args.MODE);
      if(corgi && ['horizontalMovement','verticalMovement','updateSprite','cameraFollow'].includes(mode))this._withExtension(util,()=>corgi[mode](Scratch.Cast.toBoolean(args.ON)));
    }
    corgiBark(args,util) {const corgi=this._extensionSprite(args.SPRITE,'Corgio');if(corgi)this._withExtension(util,()=>corgi.bark());}
    corgiAddPhrase(args) {const corgi=this._extensionSprite(args.SPRITE,'Corgio');if(corgi)corgi.addToScript(String(Scratch.BWValues.decode(args.TEXT)));}
    setCorgiProperty(args) {
      const corgi=this._extensionSprite(args.SPRITE,'Corgio'),property=String(args.PROPERTY);
      if(corgi && ['maxMoveVelocity', 'gravity', 'jumpVelocity', 'maxJump', 'decelerationRate'].includes(property))corgi[property]=Scratch.Cast.toNumber(args.VALUE);
    }
    corgiProperty(args) {
      const corgi=this._extensionSprite(args.SPRITE,'Corgio'),property=String(args.PROPERTY);
      return corgi && ['maxMoveVelocity', 'gravity', 'jumpVelocity', 'maxJump', 'decelerationRate'].includes(property) ? corgi[property] : 0;
    }
    // The seven segment extension runs its original classes (sevenseg-pxt.js).
    // The host gives them images drawn with the native image engine and real
    // native sprites; images a call drew are re-rendered once it returns.
    _sevenseg() {
      if (this._sevensegModule) return this._sevensegModule;
      const ext=this,drawn=new Set();
      class SevensegImage {
        constructor(raw){this.raw=raw;}
        get width(){return this.raw.width;}
        get height(){return this.raw.height;}
        fill(c){imageEngine.mutate(this.raw,'fill',c,0);drawn.add(this.raw);}
        fillRect(x,y,w,h,c){imageEngine.draw(this.raw,'fillRect',x,y,w,h,c);drawn.add(this.raw);}
      }
      const spriteOf=id=>({
        get x(){return ext.spriteProperty({ID:id,PROPERTY:'x'});},set x(v){ext.setSpriteProperty({ID:id,PROPERTY:'x',VALUE:v});},
        get y(){return ext.spriteProperty({ID:id,PROPERTY:'y'});},set y(v){ext.setSpriteProperty({ID:id,PROPERTY:'y',VALUE:v});},
        get width(){return ext.spriteProperty({ID:id,PROPERTY:'width'});},
        get height(){return ext.spriteProperty({ID:id,PROPERTY:'height'});},
        setImage(image){const sprite=ext._sprite(id);if(sprite && image?.raw)ext._assignSpriteRaster(sprite,image.raw);}
      });
      // PXT Buffer literals; sevenseg reads them as signed bytes.
      const hex=strings=>{
        const text=String(strings.raw?strings.raw[0]:strings[0]).replace(/\s/g,''),bytes=new Int8Array(text.length>>1);
        for(let i=0;i<bytes.length;i++)bytes[i]=parseInt(text.slice(2*i,2*i+2),16);
        return {length:bytes.length,getNumber:(format,offset)=>format==='Int8LE' && offset>=0 && offset<bytes.length ? bytes[offset] : 0};
      };
      const module=dependencies.initializeSevenseg({hex,NumberFormat:{Int8LE:'Int8LE'},
        image:{create:(width,height)=>new SevensegImage({width,height,pixels:new Uint8Array(width*height)})},
        sprites:{create:(image,kind)=>{
          const width=image.width,height=image.height;
          const id=ext._createSprite({KIND:kind,TEMPLATE:'',WIDTH:width,HEIGHT:height,X:((160-width)>>1)+width/2,Y:((120-height)>>1)+height/2});
          ext._assignSpriteRaster(ext._state().sprites[id],image.raw);
          ext._emitSpriteHat('arcade_whenSpriteCreated',{KIND:ext._state().sprites[id].kind},id,'');
          return spriteOf(id);
        }}});
      this._sevensegModule={...module,flush(){for(const raw of drawn)ext._refreshImage(raw);drawn.clear();}};
      return this._sevensegModule;
    }
    _sevensegHandle(display) {
      if(!display)return '';
      if(!this._sevensegIds)this._sevensegIds=new Map(),this._sevensegValues=new Map();
      if(!this._sevensegIds.has(display)){const id='arcade-sevenseg:'+(this._sevensegIds.size+1);this._sevensegIds.set(display,id);this._sevensegValues.set(id,display);}
      return Scratch.BWValues.reference(this._runtime,'sevenseg',this._sevensegIds.get(display));
    }
    // A digit or counter (or either), or an explicit error.
    _sevensegValue(value,kinds) {
      const id=Scratch.BWValues.referenceId(this._runtime,value,'sevenseg'),display=id===null?null:this._sevensegValues?.get(id);
      const module=this._sevenseg();
      if(display && kinds.some(kind=>display instanceof module[kind]))return display;
      this._runtime?.emit?.('BLOCKS_ERROR','Arcade expected a seven segment '+(kinds.length>1?'display':kinds[0]==='DigitCounter'?'counter':'digit')+'.');
      return null;
    }
    _sevensegCall(value,kinds,call) {
      const display=this._sevensegValue(value,kinds);
      if(!display)return undefined;
      try {return call(display);} finally {this._sevenseg().flush();}
    }
    sevensegDigit(args) {
      const module=this._sevenseg(),style=this._sevensegEnum(module.SegmentStyle,args.STYLE);
      if(style===null)return '';
      try {return this._sevensegHandle(module.sevenseg.createDigit(style,Scratch.Cast.toNumber(args.VALUE)));} finally {module.flush();}
    }
    sevensegCounter(args) {
      const module=this._sevenseg(),style=this._sevensegEnum(module.SegmentStyle,args.STYLE),scale=this._sevensegEnum(module.SegmentScale,args.SCALE);
      if(style===null || scale===null)return '';
      try {return this._sevensegHandle(module.sevenseg.createCounter(style,scale,Scratch.Cast.toNumber(args.DIGITS)));} finally {module.flush();}
    }
    _sevensegEnum(enumeration,name) {
      const key=String(name);
      if(Object.prototype.hasOwnProperty.call(enumeration,key) && typeof enumeration[key]==='number')return enumeration[key];
      this._runtime?.emit?.('BLOCKS_ERROR',\`Arcade has no seven segment option "\${key}".\`);
      return null;
    }
    sevensegSetCharacter(args) {
      const character=this._sevensegEnum(this._sevenseg().SegmentCharacter,args.CHARACTER);
      if(character!==null)this._sevensegCall(args.DISPLAY,['SevenSegDigit'],digit=>digit.setDigitAlpha(character));
    }
    sevensegSetColor(args) {this._sevensegCall(args.DISPLAY,['SevenSegDigit','DigitCounter'],display=>display.setDigitColor(Scratch.Cast.toNumber(args.COLOR)));}
    sevensegSetRadix(args) {
      const radix=this._sevensegEnum(this._sevenseg().DigitRadix,args.RADIX);
      if(radix!==null)this._sevensegCall(args.DISPLAY,['SevenSegDigit'],digit=>digit.setRadix(radix));
    }
    sevensegSetScale(args) {
      const scale=this._sevensegEnum(this._sevenseg().SegmentScale,args.SCALE);
      if(scale!==null)this._sevensegCall(args.DISPLAY,['SevenSegDigit'],digit=>digit.setScale(scale));
    }
    sevensegAddDigit(args) {this._sevensegCall(args.DISPLAY,['DigitCounter'],counter=>counter.addDigit());}
    sevensegSetProperty(args) {
      const property=String(args.PROPERTY),kinds={x:['SevenSegDigit','DigitCounter'],y:['SevenSegDigit','DigitCounter'],value:['SevenSegDigit'],count:['DigitCounter']}[property];
      if(!kinds){this._runtime?.emit?.('BLOCKS_ERROR',\`Arcade seven segment displays have no settable "\${property}".\`);return;}
      this._sevensegCall(args.DISPLAY,kinds,display=>{display[property]=Scratch.Cast.toNumber(args.VALUE);});
    }
    sevensegProperty(args) {
      const property=String(args.PROPERTY),kinds={x:['SevenSegDigit','DigitCounter'],y:['SevenSegDigit','DigitCounter'],width:['SevenSegDigit'],height:['SevenSegDigit'],value:['SevenSegDigit'],count:['DigitCounter']}[property];
      if(!kinds){this._runtime?.emit?.('BLOCKS_ERROR',\`Arcade seven segment displays have no "\${property}".\`);return 0;}
      const value=this._sevensegCall(args.DISPLAY,kinds,display=>display[property]);
      return value===undefined?0:value;
    }
    _musicHandle(value) {
      if(!value)return '';
      if(!this._musicIds)this._musicIds=new Map(),this._musicValues=new Map(),this._musicGeneration=dependencies.buffers.newHeapId();
      if(!this._musicIds.has(value)){const id='arcade-music:'+this._musicGeneration+':'+(this._musicIds.size+1);this._musicIds.set(value,id);this._musicValues.set(id,value);}
      return Scratch.BWValues.reference(this._runtime,'music',this._musicIds.get(value));
    }
    // A music value of the given PXT class, or an explicit error.
    _musicValue(value,kind) {
      const id=Scratch.BWValues.referenceId(this._runtime,value,'music'),object=id===null?null:this._musicValues?.get(id);
      const music=this._music().pxt.music;
      if(object instanceof music[kind])return object;
      this._runtime?.emit?.('BLOCKS_ERROR','Arcade expected a '+(kind==='Melody'?'melody':'playable sound')+'.');
      return null;
    }
    _musicMenu(enumeration,name) {
      if(Object.prototype.hasOwnProperty.call(enumeration,name) && typeof enumeration[name]==='number')return enumeration[name];
      this._runtime?.emit?.('BLOCKS_ERROR','Arcade has no music option "'+String(name)+'".');
      return null;
    }
    playMusic(args) {
      const music=this._music(),playable=this._musicValue(args.PLAYABLE,'Playable'),mode=this._musicMenu(music.pxt.music.PlaybackMode,String(args.MODE));
      if(!playable || mode===null)return;
      return music.run(music.pxt.music.play(playable,mode));
    }
    // The general form of playMusic: music.play(playable, mode). The playable comes from a playable reporter.
    play(args) {return this.playMusic(args);}
    playMelody(args) {
      const music=this._music(),melody=this._musicValue(args.MELODY,'Melody'),mode=String(args.MODE);
      if(!melody)return;
      if(mode==='loop'){melody.loop();return;}
      if(mode!=='play' && mode!=='playUntilDone'){this._musicMenu({},mode);return;}
      return music.run(melody[mode]());
    }
    playNoteMelody(args,util) {
      const music=this._music(),notes=Scratch.BWValues.decode(args.NOTES);
      let tempo=Scratch.BWValues.decode(args.TEMPO);
      // Only a numeric editor shadow needs parsing. Opaque connected operands
      // reach the original generator unchanged, after its notes.split check.
      if(typeof tempo==='string')tempo=this._mathArgument(args,'TEMPO',util);
      // This original API formats rests/octaves and uses Melody's default255;
      // stringPlayable instead reads the mutable global music.volume().
      return music.run(music.pxt.music.playMelody(notes,tempo));
    }
    playSoundEffect(args) {
      const music=this._music(),effect=this._musicValue(args.EFFECT,'Playable'),mode=this._musicMenu(music.pxt.SoundExpressionPlayMode,String(args.MODE));
      if(!effect || mode===null)return;
      return music.run(music.pxt.music.playSoundEffect(effect,mode));
    }
    playSound(args) {
      const music=this._music().pxt.music,text=String(Scratch.BWValues.decode(args.SOUND) ?? '');
      return this._music().run(Scratch.Cast.toBoolean(args.UNTIL_DONE)?music.playSoundUntilDone(text):music.playSound(text));
    }
    playTone(args) {return this._music().run(this._music().pxt.music.playTone(Scratch.Cast.toNumber(args.FREQUENCY),Scratch.Cast.toNumber(args.DURATION)));}
    ringTone(args) {return this._music().run(this._music().pxt.music.ringTone(Scratch.Cast.toNumber(args.FREQUENCY)));}
    rest(args) {return this._music().run(this._music().pxt.music.rest(Scratch.Cast.toNumber(args.DURATION)));}
    setMusicVolume(args) {this._music().pxt.music.setVolume(Scratch.Cast.toNumber(args.VOLUME));}
    setTempo(args) {this._music().pxt.music.setTempo(Scratch.Cast.toNumber(args.TEMPO));}
    changeTempo(args) {this._music().pxt.music.changeTempoBy(Scratch.Cast.toNumber(args.TEMPO));}
    stopAllSounds() {this._music().pxt.music.stopAllSounds();}
    melodyPlayable(args) {
      const melody=this._musicValue(args.MELODY,'Melody');
      return melody?this._musicHandle(this._music().pxt.music.melodyPlayable(melody)):'';
    }
    stringPlayable(args) {
      return this._musicHandle(this._music().pxt.music.stringPlayable(String(Scratch.BWValues.decode(args.MELODY) ?? ''),Scratch.Cast.toNumber(args.TEMPO)));
    }
    namedSongPlayable(args) { return this.songPlayable(args); }
    _bufferState() {
      if(this._bufferSuspended)throw new Error('Arcade byte buffer owner is disposed; load a project before allocating');
      if(!this._bufferHeap)this._bufferHeap={generation:dependencies.buffers.newHeapId(),values:new Map(),ids:new WeakMap(),literals:new Map(),next:0};
      return this._bufferHeap;
    }
    _bufferMemorySnapshot(extraRoots=[],limits={}) {
      return dependencies.bufferMemory.inspect({...limits,runtime:this._runtime,values:Scratch.BWValues,
        heap:this._bufferHeap,roots:[...dependencies.bufferMemory.ownerRoots(this),...extraRoots]});
    }
    _bufferReference(bytes) {
      const heap=this._bufferState();let id=heap.ids.get(bytes);
      if(id===undefined){id='buffer:'+heap.generation+':'+ ++heap.next;heap.ids.set(bytes,id);heap.values.set(id,bytes);}
      return Scratch.BWValues.reference(this._runtime,'buffer',id);
    }
    _buffer(value) {
      const id=Scratch.BWValues.referenceId(this._runtime,value,'buffer'),bytes=id===null?null:this._bufferState().values.get(id);
      if(!bytes)throw new Error('Arcade byte buffer is not available in this project run');
      return bytes;
    }
    _bufferGuard(action) {
      try{if(this._bufferSuspended)throw new Error('Arcade byte buffer owner is disposed; load a project before allocating');return action();}catch(error){this._runtime?.emit?.('BLOCKS_ERROR',String(error?.message || error));return Scratch.BWValues.UNDEFINED;}
    }
    createBuffer(args) {return this._bufferGuard(()=>this._bufferReference(new dependencies.buffers.PxtBuffer(Scratch.Cast.toNumber(args.SIZE))));}
    bufferFromHex(args) {return this._bufferGuard(()=>this._bufferReference(dependencies.buffers.fromHex(Scratch.BWValues.decode(args.HEX))));}
    bufferFromUTF8(args) {return this._bufferGuard(()=>this._bufferReference(dependencies.buffers.fromUTF8(Scratch.BWValues.decode(args.TEXT))));}
    bufferLiteral(args,util) {
      return this._bufferGuard(()=>{
        const block=util?.thread?.peekStack?.(),heap=this._bufferState();
        const key=block?String(util.target?.id)+':'+block:null;
        if(key===null)return this._bufferReference(dependencies.buffers.literal(args.HEX));
        if(!heap.literals.has(key))heap.literals.set(key,dependencies.buffers.literal(args.HEX));
        return this._bufferReference(heap.literals.get(key));
      });
    }
    bufferLength(args) {return this._bufferGuard(()=>this._buffer(args.BUFFER).length);}
    bufferIsReadOnly(args) {return this._bufferGuard(()=>this._buffer(args.BUFFER).isReadOnly());}
    bufferConcat(args) {return this._bufferGuard(()=>this._bufferReference(this._buffer(args.BUFFER).concat(this._buffer(args.OTHER))));}
    bufferEquals(args) {
      return this._bufferGuard(()=>{
        const resolve=value=>Scratch.BWValues.decode(value)==null?null:this._buffer(value);
        return dependencies.buffers.equals(resolve(args.BUFFER),resolve(args.OTHER));
      });
    }
    bufferHash(args) {return this._bufferGuard(()=>this._buffer(args.BUFFER).hash(Number(args.BITS)));}
    bufferIndexOf(args) {return this._bufferGuard(()=>this._buffer(args.BUFFER).indexOf(this._buffer(args.OTHER)));}
    bufferGetByte(args) {return this._bufferGuard(()=>this._buffer(args.BUFFER).getByte(Scratch.Cast.toNumber(args.OFFSET)));}
    bufferSetByte(args) {return this._bufferGuard(()=>{this._sdkFontValues?.guardBufferMutation(args.BUFFER);return this._buffer(args.BUFFER).setByte(Scratch.Cast.toNumber(args.OFFSET),Scratch.Cast.toNumber(args.VALUE))});}
    _bufferArray(value) {
      const array=Scratch.BWValues.arrayValue(this._runtime,value);
      if(!array)throw new Error('Arcade buffer input array is not available in this project run');
      if(array.length>dependencies.buffers.MAX_BUFFER_BYTES)throw new RangeError('Arcade buffer exceeds byte allocation limit');
      return array;
    }
    bufferFromBase64(args) {return this._bufferGuard(()=>this._bufferReference(dependencies.buffers.fromBase64(Scratch.BWValues.decode(args.TEXT))));}
    _bufferChunks(chunks) {return Scratch.BWValues.arrayReference(this._runtime,chunks.map(bytes=>this._bufferReference(bytes)));}
    bufferChunked(args) {return this._bufferGuard(()=>this._bufferChunks(this._buffer(args.BUFFER).chunked(Scratch.Cast.toNumber(args.SIZE))));}
    bufferChunkedFromUTF8(args) {return this._bufferGuard(()=>this._bufferChunks(dependencies.buffers.chunkedFromUTF8(Scratch.BWValues.decode(args.TEXT),Scratch.Cast.toNumber(args.SIZE))));}
    bufferPackedSize(args) {return this._bufferGuard(()=>dependencies.buffers.packedSize(Scratch.BWValues.decode(args.FORMAT)));}
    bufferPack(args) {return this._bufferGuard(()=>this._bufferReference(dependencies.buffers.pack(Scratch.BWValues.decode(args.FORMAT),this._bufferArray(args.ARRAY).map(value=>Scratch.BWValues.decode(value)))));}
    bufferUnpack(args) {return this._bufferGuard(()=>Scratch.BWValues.arrayReference(this._runtime,this._buffer(args.BUFFER).unpack(Scratch.BWValues.decode(args.FORMAT),Scratch.Cast.toNumber(args.OFFSET))));}
    bufferPackAt(args) {return this._bufferGuard(()=>{this._sdkFontValues?.guardBufferMutation(args.BUFFER);return this._buffer(args.BUFFER).packAt(Scratch.Cast.toNumber(args.OFFSET),Scratch.BWValues.decode(args.FORMAT),this._bufferArray(args.ARRAY).map(value=>Scratch.BWValues.decode(value)))});}
    bufferFromArray(args) {return this._bufferGuard(()=>this._bufferReference(dependencies.buffers.fromArray(this._bufferArray(args.ARRAY).map(value=>Scratch.BWValues.decode(value)))));}
    bufferToArray(args) {return this._bufferGuard(()=>Scratch.BWValues.arrayReference(this._runtime,this._buffer(args.BUFFER).toArray(args.FORMAT)));}
    bufferConcatArray(args) {return this._bufferGuard(()=>this._bufferReference(dependencies.buffers.concatArrays(this._bufferArray(args.ARRAY).map(value=>this._buffer(value)))));}
    bufferFormatSize(args) {return this._bufferGuard(()=>dependencies.buffers.sizeOfNumberFormat(args.FORMAT));}
    bufferGetNumber(args) {return this._bufferGuard(()=>this._buffer(args.BUFFER).getNumber(args.FORMAT,Scratch.Cast.toNumber(args.OFFSET)));}
    bufferSetNumber(args) {return this._bufferGuard(()=>{this._sdkFontValues?.guardBufferMutation(args.BUFFER);return this._buffer(args.BUFFER).setNumber(args.FORMAT,Scratch.Cast.toNumber(args.OFFSET),Scratch.Cast.toNumber(args.VALUE))});}
    bufferSlice(args) {return this._bufferGuard(()=>this._bufferReference(this._buffer(args.BUFFER).slice(Scratch.Cast.toNumber(args.OFFSET),Scratch.Cast.toNumber(args.LENGTH))));}
    bufferWrite(args) {return this._bufferGuard(()=>{this._sdkFontValues?.guardBufferMutation(args.BUFFER);return this._buffer(args.BUFFER).write(Scratch.Cast.toNumber(args.OFFSET),this._buffer(args.SOURCE))});}
    bufferFill(args) {return this._bufferGuard(()=>{this._sdkFontValues?.guardBufferMutation(args.BUFFER);return this._buffer(args.BUFFER).fill(Scratch.Cast.toNumber(args.VALUE),Scratch.Cast.toNumber(args.OFFSET),Scratch.Cast.toNumber(args.LENGTH))});}
    bufferShift(args) {return this._bufferGuard(()=>{this._sdkFontValues?.guardBufferMutation(args.BUFFER);return this._buffer(args.BUFFER).shift(Scratch.Cast.toNumber(args.AMOUNT),Scratch.Cast.toNumber(args.OFFSET),Scratch.Cast.toNumber(args.LENGTH))});}
    bufferRotate(args) {return this._bufferGuard(()=>{this._sdkFontValues?.guardBufferMutation(args.BUFFER);return this._buffer(args.BUFFER).rotate(Scratch.Cast.toNumber(args.AMOUNT),Scratch.Cast.toNumber(args.OFFSET),Scratch.Cast.toNumber(args.LENGTH))});}
    bufferToBase64(args) {return this._bufferGuard(()=>this._buffer(args.BUFFER).toBase64());}
    bufferToHex(args) {return this._bufferGuard(()=>this._buffer(args.BUFFER).toHex());}
    bufferToText(args) {return this._bufferGuard(()=>this._buffer(args.BUFFER).toString());}
    songFromBuffer(args) {return this._bufferGuard(()=>this._musicHandle(this._music().createSongBuffer(this._buffer(args.BUFFER))));}
    songPlayable(args) {
      try {return this._musicHandle(this._music().createSong(String(Scratch.BWValues.decode(args.HEX) ?? '')));}
      catch(error){this._runtime?.emit?.('BLOCKS_ERROR',String(error?.message || error));return '';}
    }
    tonePlayable(args) {return this._musicHandle(this._music().pxt.music.tonePlayable(Scratch.Cast.toNumber(args.FREQUENCY),Scratch.Cast.toNumber(args.DURATION)));}
    soundEffect(args) {
      const pxt=this._music().pxt,wave=this._musicMenu(pxt.WaveShape,String(args.WAVE)),effect=this._musicMenu(pxt.SoundExpressionEffect,String(args.EFFECT)),
        curve=this._musicMenu(pxt.InterpolationCurve,String(args.CURVE));
      if(wave===null || effect===null || curve===null)return '';
      const number=name=>Scratch.Cast.toNumber(args[name]);
      return this._musicHandle(pxt.music.createSoundEffect(wave,number('START_FREQUENCY'),number('END_FREQUENCY'),number('START_VOLUME'),
        number('END_VOLUME'),number('DURATION'),effect,curve));
    }
    namedMelody(args) {
      const music=this._music().pxt.music,name=String(args.NAME),melody=Object.prototype.hasOwnProperty.call(music,name)?music[name]:null;
      if(!(melody instanceof music.Melody)){this._musicMenu({},name);return '';}
      return this._musicHandle(melody);
    }
    soundMelody(args) {
      const pxt=this._music().pxt,sound=this._musicMenu(pxt.Sounds,String(args.SOUND));
      return sound===null?'':pxt.music.sounds(sound);
    }
    beat(args) {
      const pxt=this._music().pxt,fraction=this._musicMenu(pxt.BeatFraction,String(args.FRACTION));
      return fraction===null?0:pxt.music.beat(fraction);
    }
    // PXT's own parseInt (helpers-pxt.js); its text argument is a string.
    parseInteger(args) {return dependencies.helpers.parseInt(String(Scratch.BWValues.decode(args.TEXT) ?? ''));}
    parseIntegerRadix(args) {return dependencies.helpers.parseInt(String(Scratch.BWValues.decode(args.TEXT) ?? ''),Scratch.Cast.toNumber(args.RADIX));}
    // game.eventContext().deltaTime: seconds since the previous frame.
    frameDeltaTime(args,util) {
      return frameDeltaValues.get(this).read(args,util,()=>{
        // Refuse effectful clock access before _state's existing initialization
        // check. Genuine own data keeps that initializer and scene policy.
        const current=Object.getOwnPropertyDescriptor(this._runtime,'bwArcadeDeviceState');
        if(current&&!Object.prototype.hasOwnProperty.call(current,'value'))throw Error('Frame delta Number: scene accessor is not owned data');
        const existing=current?.value;
        if(existing&&typeof existing==='object'){
          const prototype=Object.getPrototypeOf(existing),elapsed=Object.getOwnPropertyDescriptor(existing,'frameDeltaTime');
          // _state reads frameDeltaTime before initializing it: an inherited getter
          // must not run on the certified path when the own value is absent.
          let inherited=false;for(let parent=prototype;parent;parent=Object.getPrototypeOf(parent))if(Object.getOwnPropertyDescriptor(parent,'frameDeltaTime')){inherited=true;break;}
          if(prototype!==Object.prototype&&prototype!==null||!elapsed&&inherited||elapsed&&!Object.prototype.hasOwnProperty.call(elapsed,'value'))throw Error('Frame delta Number: frame accessor is not owned data');
        }
        const state=this._state(),elapsed=Object.getOwnPropertyDescriptor(state,'frameDeltaTime');
        if(!elapsed||!Object.prototype.hasOwnProperty.call(elapsed,'value'))throw Error('Frame delta Number: frame value is not owned data');
        const value=state.frameDeltaTime; // retain the original property read and its effects
        return {state,value};
      },()=>this._state().frameDeltaTime || 0);
    }
    musicVolume() {return this._music().pxt.music.volume();}
    musicTempo() {return this._music().pxt.music.tempo();}
    _pxtText() {
      if(this._sdkFontValues)return this._sdkFontValues.textModule();
      if(this._textModule)return this._textModule;
      class PxtBuffer extends Uint8Array {
        getNumber(format,offset){return format==='UInt16LE'?(this[offset] | this[offset+1]<<8):this[offset];}
        // PXT Buffer.slice(offset, length)
        slice(offset=0,length){const end=length===undefined?this.length:Math.min(this.length,offset+length);const out=new PxtBuffer(Math.max(0,end-offset));out.set(this.subarray(offset,end));return out;}
        write(offset,source){this.set(source.subarray(0,Math.max(0,Math.min(source.length,this.length-offset))),offset);}
      }
      const fromBytes=bytes=>{const out=new PxtBuffer(bytes.length);out.set(bytes);return out;};
      this._textModule=dependencies.initializeText({
        control:{createBuffer:size=>new PxtBuffer(size)},
        NumberFormat:{UInt8LE:'UInt8LE',UInt16LE:'UInt16LE'},
        hex:strings=>{const text=String(strings.raw?strings.raw[0]:strings[0]).replace(/\\s/g,'');return fromBytes(text.match(/../g)?.map(byte=>parseInt(byte,16)) || []);},
        base64:data=>fromBytes(Uint8Array.from(atob(data),c=>c.charCodeAt(0)))
      });
      return this._textModule;
    }
    // Constructor-only delegate binding: the owner stays in this source closure.
    _bindSourceOperationAdapter(adapter) {
      dependencies.bindSourceOperationAdapter(adapter,this,scoreNumberOwners.get(this));
    }

    sourceValueBinary(args,util) {
      try {this._sourceTypeOf.assertOwner();return dependencies.sourceValueBinary(this._runtime,args,util);}
      catch(error){return exceptionOwners.get(this).rejectConstraint(args,util,error);}
    }
    sourceValueUnary(args,util) {
      try {this._sourceTypeOf.assertOwner();return dependencies.sourceValueUnary(this._runtime,args,util);}
      catch(error){return exceptionOwners.get(this).rejectConstraint(args,util,error);}
    }
    inspectValue(args,util) {return this._consoleInspectValues.inspect(args,util,error=>this._objectError(error));}
    sourceTypeOf(args,util) {
      try {this._sourceTypeOf.assertOwner();const literalType=this._sourceTypeOf.validateInput(this._sourceScalarCells,util,args.VALUE,args);return literalType || this._sourceTypeOf(args.VALUE);}catch(error){return this._objectError(error);}
    }
    _fontGuard(action) {
      try{if(!this._sdkFontValues)throw new Error('SDK Font needs its actual runtime owner');return action();}catch(error){return this._objectError(error);}
    }
    fontValue(args,util) {return this._fontGuard(()=>{
      fontSelectorOwner(this._runtime,util,args,'arcade_fontValue',['FONT']);
      if(!['font5','font8','font12'].includes(args.FONT))throw new Error('SDK Font value requires a fixed builtin FONT');
      return this._sdkFontValues.constant(args.FONT);
    });}
    fontForText(args) {return this._fontGuard(()=>this._sdkFontValues.forText(Scratch.BWValues.decode(args.TEXT)));}
    scaleFont(args) {return this._fontGuard(()=>this._sdkFontValues.scale(args.FONT,Scratch.Cast.toNumber(args.SIZE)));}
    _fontImageAdapter(image) {
      const module=this._pxtText(),target={_width:image.width,_height:image.height,data:image.pixels,makeWritable(){},color:c=>Number(c)&255};
      return {width:image.width,height:image.height,
        drawIcon:(icon,x,y,color)=>module.drawIcon(target,{data:icon},x,y,color),
        fillRect:(x,y,w,h,color)=>imageEngine.draw(image,'fillRect',x,y,w,h,color)};
    }
    printImageFont(args) {return this._fontGuard(()=>{
      this._sdkFontValues.resolve(args.FONT);
      const image=this._image(args.IMAGE);if(!image)throw new Error('SDK Font printing needs an actual current Image');
      this._sdkFontValues.print(this._fontImageAdapter(image),String(Scratch.BWValues.decode(args.TEXT) ?? ''),Scratch.Cast.toNumber(args.X),Scratch.Cast.toNumber(args.Y),Scratch.Cast.toNumber(args.COLOR),args.FONT);
      this._refreshImage(image);
    });}
    printImageFontCenter(args) {return this._fontGuard(()=>{
      this._sdkFontValues.resolve(args.FONT);
      const image=this._image(args.IMAGE);if(!image)throw new Error('SDK Font printing needs an actual current Image');
      this._sdkFontValues.printCenter(this._fontImageAdapter(image),String(Scratch.BWValues.decode(args.TEXT) ?? ''),Scratch.Cast.toNumber(args.Y),Scratch.Cast.toNumber(args.COLOR),args.FONT);
      this._refreshImage(image);
    });}
    fontMetric(args,util) {
      fontSelectorOwner(this._runtime,util,args,'arcade_fontMetric',['FONT','PROPERTY']);
      const font=args.FONT,property=args.PROPERTY;
      if(!['font5','font8','font12'].includes(font) || !['charWidth','charHeight'].includes(property))
        throw new Error('Arcade font metric requires a builtin FONT and numeric PROPERTY.');
      return this._pxtText().image[font][property];
    }
    printImageText(args) {
      const image=this._image(args.IMAGE);
      if(!image)return;
      const text=this._pxtText(),name=String(args.FONT),font={small:text.image.font5,normal:text.image.font8,large:text.image.font12,auto:undefined}[name];
      if(font===undefined && name!=='auto'){this._runtime?.emit?.('BLOCKS_ERROR',\`Arcade has no font named "\${String(args.FONT)}".\`);return;}
      // The simulator image helpers address a buffer through this shape.
      const target={_width:image.width,_height:image.height,data:image.pixels,makeWritable(){},color:c=>Number(c)&255};
      const wrapper={width:image.width,height:image.height,
        drawIcon:(icon,x,y,color)=>text.drawIcon(target,{data:icon},x,y,color),
        fillRect:(x,y,w,h,color)=>imageEngine.draw(image,'fillRect',x,y,w,h,color)};
      text.helpers.imagePrint(wrapper,String(Scratch.BWValues.decode(args.TEXT) ?? ''),Number(args.X) || 0,Number(args.Y) || 0,Number(args.COLOR) || 0,font);
      this._refreshImage(image);
    }
    _renderablesOf(state=this._state()) {
      let list=this._renderables.get(state);
      if(!list){list=[];this._renderables.set(state,list);}
      return list;
    }
    _addSceneRenderable(state,renderable) {this._renderablesOf(state).push(renderable);this._sceneFlags.register(state,renderable);return renderable;}
    _sceneSpriteObjects(state) {return [...Object.values(state.sprites),...(state.tilemapRenderable?[state.tilemapRenderable]:[]),...(this._particleScenes.get(state)?.allSprites || []),...(this._renderables.get(state) || [])];}
    _registerRenderable(args,util,z) {
      // scene.createRenderable: a scene sprite with its own id, drawn with the
      // sprites by z then id. game.onPaint is ON_PAINT_Z -20, onShade ON_SHADE_Z 80.
      const state=this._state();
      this._addSceneRenderable(state,{...this._handlerRegistration(args,util),z,id:state.nextSpriteId++});
    }
    addLiteralDrawing(args) {
      const fail=()=>this._objectError(new Error('Literal drawing requires bounded rectangle/line commands'));
      const text=Scratch.BWValues.decode(args.COMMANDS);
      if(typeof text!=='string'||text.length>4096)return fail();
      let commands;try{commands=JSON.parse(text);}catch{return fail();}
      if(!Array.isArray(commands)||commands.length>32)return fail();
      for(const row of commands){
        if(!Array.isArray(row)||row.length!==6||!['fillRect','drawRect','drawLine'].includes(row[0])||!row.slice(1).every(Number.isInteger)||row[5]<0||row[5]>15)return fail();
        const a=row[1],b=row[2],c=row[3],d=row[4];
        if(row[0]==='drawLine'?(a<0||a>=160||c<0||c>=160||b<0||b>=120||d<0||d>=120):(a<0||b<0||c<0||d<0||a+c>160||b+d>120))return fail();
      }
      const state=this._state();
      // The ignored original Renderable still allocates a scene id at z=0.
      // Pure literal drawing runs synchronously in the real render pass.
      this._addSceneRenderable(state,{z:0,id:state.nextSpriteId++,draw:screen=>{
        for(const row of commands){
          if(row[0]!=='drawRect'){imageEngine.draw(screen,row[0],row[1],row[2],row[3],row[4],row[5]);continue;}
          // The SDK drawRect helper delegates to four inclusive drawLine edges.
          const x=row[1],y=row[2],w=row[3]-1,h=row[4]-1,c=row[5];
          if(row[3]===0||row[4]===0)continue;
          imageEngine.draw(screen,'drawLine',x,y,x+w,y,c);
          imageEngine.draw(screen,'drawLine',x,y,x,y+h,c);
          imageEngine.draw(screen,'drawLine',x+w,y,x+w,y+h,c);
          imageEngine.draw(screen,'drawLine',x,y+h,x+w,y+h,c);
        }
      }});
    }
    registerPaintHandler(args,util) {this._registerRenderable(args,util,-20);}
    registerShadeHandler(args,util) {this._registerRenderable(args,util,80);}
    whenRegisteredPaint(args,util) {return this.whenRegisteredWall(args,util);}
    whenRegisteredShade(args,util) {return this.whenRegisteredWall(args,util);}
    // scene.render with renderables: background, then sprites and renderables
    // by z then id into the screen; each renderable's changes become a layer.
    *_drawSceneOwnerSteps(owner,screen,active,epoch,output) {
      if(this._renderingScenes.has(owner) || !this._sceneFlags.begin(owner))return;
      this._renderingScenes.add(owner);
      try {
        const parent=this._sceneParents.get(owner);
        if(owner.seeThrough && parent){
          const parentOutput={layers:[],missingSpriteImages:[]};
          yield* this._drawSceneOwnerSteps(parent,screen,active,epoch,parentOutput);
          if(this._state()!==active || epoch!==this._terrainEpoch)return;
          let source=this._seeThroughSources.get(owner);
          if(!source){source={z:-Infinity,id:-Infinity};this._seeThroughSources.set(owner,source);}
          output.layers.push({image:{width:160,height:120,pixels:screen.pixels.slice()},writes:new Uint8Array(160*120).fill(1),x:0,y:0,z:source.z,id:source.id,source});
          output.missingSpriteImages.push(...parentOutput.missingSpriteImages);
        } else imageEngine.composeFrame(screen,owner.backgroundColor,owner.backgroundImage,[]);
        if(owner===active && (owner.flags & dependencies.sceneFlags.NeedsSorting))this._particleOrderDirty=true;
        const objects=this._sceneFlags.order(owner,this._sceneSpriteObjects(owner));
        for(const object of objects){
          let layers=[];
          if(Object.values(owner.sprites).includes(object)){
            const found=this._layersForSceneSprite(object,owner);layers=found.layers;output.missingSpriteImages.push(...found.missingSpriteImages);
          } else if(object===owner.tilemapRenderable){
            layers=this._sceneLayers(owner).layers.filter(layer=>layer.bwSceneSprite===object);
          } else if((this._particleScenes.get(owner)?.allSprites || []).includes(object)){
            layers=this._drawParticleSources(owner,object);
          } else {
            const before=screen.pixels.slice();
            // A game over started from a renderable keeps the screen as drawn so far (game.ts: screen.clone()).
            owner._renderPass={screen,epoch:this._terrainEpoch};
            try {
              if(object.drawSteps)yield* object.drawSteps(screen);
              else if(object.draw)object.draw(screen);
              else if(yield* this._registeredCallbackSteps([object],object.z===-20?'arcade_whenRegisteredPaint':'arcade_whenRegisteredShade',{}))this._faultFrameLoop(active);
            } finally {delete owner._renderPass;}
            if(this._frameFaults.has(active))return;
            if(this._state()!==active || epoch!==this._terrainEpoch)return;
            const writes=new Uint8Array(screen.pixels.length);for(let i=0;i<writes.length;i++)if(screen.pixels[i]!==before[i])writes[i]=1;
            output.layers.push({image:{width:160,height:120,pixels:screen.pixels.slice()},writes,x:0,y:0,z:object.z,id:object.id,source:object});
            if(active._defaultGameOverPending)return;
          }
          for(const layer of layers){imageEngine.drawLayer(screen,layer);if(layer.source)output.layers.push(layer);}
        }
      } finally {this._renderingScenes.delete(owner);this._sceneFlags.finish(owner);}
    }
    *_composeSceneSteps() {
      const epoch=this._terrainEpoch,state=this._state(),renderables=this._renderables.get(state);
      const previousUpdateMs=this._lastScreenUpdateMs;
      this._lastScreenUpdateMs=this._screenClock();
      if(state.flags & 4)return state.sceneFrame;
      if(!renderables?.length && !state.seeThrough){
        const frame=this._composeSceneFrame();
        if(this._screen && frame?.pixels)this._screen.pixels.set(frame.pixels);
        return frame;
      }
      const screen=this._screenRaw(),output={layers:[],missingSpriteImages:[]};
      yield* this._drawSceneOwnerSteps(state,screen,state,epoch,output);
      // A renderable that died mid-frame leaves the screen as drawn so far (PXT shows its shared screen buffer).
      if(this._state()!==state || epoch!==this._terrainEpoch)return;
      if(state._askPaintDone){state._askPaintDone=false;return state.sceneFrame;}
      const publish=pixels=>{
        const frame=state.sceneFrame || (state.sceneFrame={width:160,height:120,pixels:new Uint8Array(160*120)});
        frame.pixels.set(pixels);
        frame.coverage=['background','tilemap','sprites','modernSpeech','particles','renderables'];
        frame.remaining=['hud','legacySpeech','effects'];
        frame.missingSpriteImages=output.missingSpriteImages;
        frame.sequence=(frame.sequence || 0)+1;
        this._renderOverlayLayers(output.layers);
        return frame;
      };
      if(this._frameFaults.has(state)){
        // The frame fiber died mid-render, so no screen update ran. The display keeps the
        // last frame until PXT's 200 ms fallback refresh (screen/frame.ts) copies the
        // shared screen buffer as drawn so far.
        this._lastScreenUpdateMs=previousUpdateMs;
        // The fallback fiber clears __updated every 200 ms from program start and refreshes at the first tick after a
        // quiet interval; an update at a tick instant follows that tick's clear, so it counts for the interval it starts.
        const partial=screen.pixels.slice(),now=this._screenClock(),last=previousUpdateMs ?? now;
        const refreshIn=Math.max(0,200*(Math.floor(last/200+1e-9)+2)-now),clock=this._programClockEpoch;
        if(this._sourceSceneTimers() && clock?.setTimeout)clock.setTimeout(()=>{
          if(epoch!==this._terrainEpoch || !clock.active)return;
          publish(partial);this._changed();
        },refreshIn)?.unref?.();
        else {publish(partial);}
        return state.sceneFrame;
      }
      return publish(screen.pixels);
    }
    _scalePixelTarget(target) {
      target.setSize?.(75);
      // Scratch enforces a five-display-pixel minimum; Arcade allows 1x1
      // images, which must still occupy exactly three stage pixels.
      if (target.size !== 75) {
        target.size = 75;
        this._runtime?.renderer?.updateDrawableProperties?.(target.drawableID, {scale: [75, 75]});
      }
    }
    _spriteRasterWindow(sprite,state=this._state()){
      const view=this._spriteViewPosition(sprite,state),left=view.x-sprite.width/2,top=view.y-sprite.height/2;
      const fullWidth=Math.max(0,sprite.width|0),fullHeight=Math.max(0,sprite.height|0);
      // __drawCore culls using logical bounds before scattering the image.
      const camera=this._camera(state),relative=!!(sprite.flags & spriteFlags.RelativeToCamera);
      const logicalLeft=sprite._fx/256-(relative?0:camera.drawOffsetX),logicalTop=sprite._fy/256-(relative?0:camera.drawOffsetY);
      if(logicalLeft+sprite.width<0 || logicalTop+sprite.height<0 || logicalLeft>160 || logicalTop>120)
        return {x:0,y:0,width:0,height:0,key:'empty'};
      const bounds=sprite._rotatedBBox && sprite.image ? rotatedRasterFootprint(sprite.image,sprite.sx,sprite.sy,sprite.rotation) :
        {left:0,top:0,right:fullWidth-1,bottom:fullHeight-1};
      if(sprite._rotatedBBox && (left>=160 || top>=120 || left+bounds.cullWidth<0 || top+bounds.cullHeight<0))
        return {x:0,y:0,width:0,height:0,key:'empty'};
      const x=Math.max(bounds.left,-left),y=Math.max(bounds.top,-top);
      const width=Math.max(0,Math.min(bounds.right+1,160-left)-x),height=Math.max(0,Math.min(bounds.bottom+1,120-top)-y);
      // Completely hidden sprites share a single transparent skin, regardless
      // of their distance from the viewport. No raster grows with sprite scale.
      if(!width || !height)return {x:0,y:0,width:0,height:0,key:'empty'};
      return {x,y,width,height,key:[x,y,width,height,fullWidth,fullHeight].join(':')};
    }
    _scaledSpriteImage(sprite,window=this._spriteRasterWindow(sprite)){
      const source=sprite.image,{x,y,width,height}=window;
      if(sprite._rotatedBBox){
        return rotatedRasterWindow(source,sprite.sx,sprite.sy,sprite.rotation,window);
      }
      if(sprite._sx===256 && sprite._sy===256 && x===0 && y===0 && width===source.width && height===source.height)return source;
      const pixels=new Uint8Array(width*height);
      const fullWidth=Math.max(0,sprite.width|0),fullHeight=Math.max(0,sprite.height|0);
      const dx=((source.width<<16)/fullWidth)|0,dy=((source.height<<16)/fullHeight)|0;
      // PXT blit clips the destination first, then starts the 16.16 source
      // accumulator at clippedPixels * step. Sampling the cropped rectangle
      // as if it were a new resized image would change its pixels.
      for(let row=0,sy=y*dy;row<height;row++,sy+=dy)
        for(let col=0,sx=x*dx;col<width;col++,sx+=dx)
          pixels[row*width+col]=source.pixels[(sy>>16)*source.width+(sx>>16)];
      return {width,height,pixels};
    }
    // PXT Sprite.overlapsWith past the hitbox test, for a rotated sprite (\`a\`
    // is \`this\`): the rotated boxes first, then the simulator's pixel test,
    // with \`other\`'s image as the destination exactly as PXT passes it.
    _rotatedSpriteOverlap(a,b){
      if(!a._rotatedBBox)return this._rotatedSpriteOverlap(b,a);
      const ai=a.image||this._imageForSprite(a.id,{quiet:true}),bi=b.image||this._imageForSprite(b.id,{quiet:true});
      if(!ai || !bi)return true;
      // this.left - other.left, truncated by the helper's \`| 0\` (not each edge floored).
      const dx=((a._fx-b._fx)/256)|0,dy=((a._fy-b._fy)/256)|0;
      if(b._rotatedBBox){
        if(!a._rotatedBBox.overlaps(b._rotatedBBox))return false;
        return imageEngine.overlapsTwoScaledRotated(bi,dx,dy,b.sx,b.sy,b.rotation,ai,a.sx,a.sy,a.rotation);
      }
      const bl=b._fx/256,bt=b._fy/256;
      if(!a._rotatedBBox.overlapsAABB(bl,bt,bl+b.width,bt+b.height))return false;
      return imageEngine.overlapsScaledRotated(bi,dx,dy,ai,a.sx,a.sy,a.rotation);
    }
    _scaledSpriteOverlap(a,b,am,bm){
      if(!a.sx || !a.sy || !b.sx || !b.sy)return false;
      if(!(a.sx*a.sy<b.sx*b.sy)){const tmp=a;a=b;b=tmp;const mask=am;am=bm;bm=mask;}
      const x=((b._fx-a._fx)/256/a.sx)|0,y=((b._fy-a._fy)/256/a.sy)|0,w=(b.width/a.sx)|0,h=(b.height/a.sy)|0;
      const dx=((b._imageWidth<<16)/w)|0,dy=((b._imageHeight<<16)/h)|0,cx=Math.abs(Math.min(0,x)),cy=Math.abs(Math.min(0,y));
      for(let row=y+cy,sy=Math.max(0,cy*dy);row<Math.min(a._imageHeight,y+h) && sy<(b._imageHeight<<16);row++,sy+=dy)
        for(let col=x+cx,sx=Math.max(0,cx*dx);col<Math.min(a._imageWidth,x+w) && sx<(b._imageWidth<<16);col++,sx+=dx)
          if(am[row*a._imageWidth+col] && bm[(sy>>16)*b._imageWidth+(sx>>16)])return true;
      return false;
    }
    _orderSpriteDrawables() {
      const renderer=this._runtime?.renderer;
      if(!renderer?.setDrawableOrder)return;
      const state=this._state();
      // Arcade's z then creation order applies equally to native drawables and
      // template clones. Leave ordinary Scratch layering alone only when no
      // Arcade sprite owns a drawable; a clone-only game still needs z order.
      const drawableOf=sprite=>this._imageSkins.get(sprite.id)?.drawableId ?? state.spriteTargets[sprite.id]?.drawableID;
      // Particle sources share the sprites' z then id order.
      const entries=[...Object.values(state.sprites).map(sprite=>({owner:sprite,z:sprite.z,id:sprite.pxtId,drawable:drawableOf(sprite)})),
        ...[...this._particleOverlays].map(([source,entry])=>({owner:entry.owner || source,z:source.z,id:source.id,drawable:entry.drawableId}))];
      if(!entries.some(entry=>entry.drawable!=null))return;
      const order=this._sceneFlags.currentOrder(state);
      for(const entry of entries.sort((a,b)=>order.indexOf(a.owner)-order.indexOf(b.owner)))
        if(entry.drawable!=null)renderer.setDrawableOrder(entry.drawable,Infinity,'sprite');
    }
    _renderSpriteImage(id,window) {
      const sprite = this._sprite(id), target = this._state().spriteTargets[id];
      markImageMask(sprite);
      const renderer = this._runtime?.renderer;
      if (renderer) {
        if(target?.drawableID!=null)this._scalePixelTarget(target);
        window=window || this._spriteRasterWindow(sprite);
        const rendered=this._scaledSpriteImage(sprite,window);
        const svg = imageEngine.svg(rendered.width && rendered.height ? rendered :
          {width: 1, height: 1, pixels: new Uint8Array(1)}, this._imagePalette(sprite.image));
        const center = [window.width * 2, window.height * 2];
        let entry = this._imageSkins.get(sprite.id);
        if (!entry) {
          entry = {target, skinId: renderer.createSVGSkin(svg, center),windowKey:window.key};
          if(target?.drawableID==null)entry.drawableId=renderer.createDrawable('sprite');
          this._imageSkins.set(sprite.id, entry);
          const drawable=entry.drawableId ?? target.drawableID;
          renderer.updateDrawableSkinId(drawable, entry.skinId);
          if(entry.drawableId!==undefined) {
            renderer.updateDrawableScale(drawable,[75,75]);
            renderer.updateDrawableVisible(drawable,!sprite.invisible);
          }
          this._orderSpriteDrawables();
        } else {renderer.updateSVGSkin(entry.skinId, svg, center);entry.windowKey=window.key;}
        this._positionSprite(id);
        this._runtime.requestRedraw?.();
      }
      this._changed();
    }
    setSpriteCostume(args) {
      const id = String(args.ID);
      const target = this._state().spriteTargets[id];
      const index = Number(args.COSTUME);
      if (!target || !target.setCostume || !Number.isFinite(index)) return;
      this._clearImage(id);
      target.setCostume(Math.round(index));
      const sprite = this._sprite(id);
      if (sprite) {
        delete sprite.image;
        sprite.costume = target.currentCostume;
        const size = this._costumeImageSize(target.getCostumes && target.getCostumes()[target.currentCostume]);
        if (size) {
          sprite._imageWidth=size.width;sprite._imageHeight=size.height;this._recalcSpriteSize(sprite);
          sprite.mask = this._costumePixelMask(target.getCostumes()[target.currentCostume], size);
          this._clampSprite(sprite);
          this._positionSprite(id);this._renderSpriteImageIfPresent(sprite);
        } else sprite.mask = null;
      }
      this._changed();
    }
    spriteToString(args) {
      const sprite = this._spriteValues.get(String(args.ID));
      if (!sprite) {
        this._runtime?.emit?.('BLOCKS_ERROR', 'Arcade sprite text requires a live or destroyed sprite from this project.');
        return '';
      }
      return sprite.pxtId + '(' + sprite.x + ',' + sprite.y + ')->(' + sprite.vx + ',' + sprite.vy + ')';
    }
    // A missing Sprite or Image is an uncaught PXT exception at the call. Only a
    // physical primitive invocation may raise it, through its sealed fault kind.
    _missingOperand(util,args,...names) {return !!util && names.some(name=>dependencies.nullSpriteGetter.isMissing(args[name]));}
    _primitiveFault(method,args,util) {
      const fault=nullSpriteFaults.get(this).get(method).fault(args,util);
      return exceptionOwners.get(this).rejectPrimitiveFault(args,util,fault.error,fault.lease);
    }
    spriteProperty(args, util) {
      // The VM already evaluated this receiver. Actual null is distinct from
      // missing IDs, tagged objects, Undefined and the ordinary text "null".
      const receiver=args.ID;
      if(receiver===null && util && ['x','y','width','height'].includes(args.PROPERTY)) {
        return this._primitiveFault('spriteProperty',args,util);
      }
      const event = util?.thread?.bwArcadeEvent;
      const sprite = this._spriteValues.get(String(receiver)) || this._sprite(receiver) ||
        (event?.first === String(receiver) ? event.destroyedSprite : null);
      if (!sprite) return 0;
      const property = String(args.PROPERTY);
      if(property==='id')return Scratch.BWValues.encode(sprite.pxtId);
      if(property==='flags')return Scratch.BWValues.encode(sprite.flags);
      if(property==='lifespan')return Scratch.BWValues.encode(sprite.lifespan);
      if (property === 'left') return sprite._fx / 256;
      if (property === 'right') return sprite._fx / 256 + sprite.width;
      if (property === 'top') return sprite._fy / 256;
      if (property === 'bottom') return sprite._fy / 256 + sprite.height;
      return Object.prototype.hasOwnProperty.call(sprite, property) ? sprite[property] : 0;
    }
    setSpriteKind(args) {
      const sprite = this._spriteValues.get(String(args.ID)) || this._sprite(args.ID);
      const kind=this._kindValue(args.KIND);if(kind==null)return;
      if (sprite && sprite.kind !== kind) {
        const sets=this._spriteKindSets(),previous=sets.get(sprite.kind),index=previous?.indexOf(sprite)??-1;if(index>=0)previous.splice(index,1);
        sprite.kind = kind; sprite._kindInsertion = ++this._kindInsertion;this._addSpriteKind(sprite,kind);this._changed();
      }
    }
    spriteOverlaps(args) {
      const a = this._spriteValues.get(String(args.A)) || this._sprite(args.A), b = this._spriteValues.get(String(args.B)) || this._sprite(args.B);
      if (!a || !b || a === b || (a.flags|b.flags)&(2|spriteFlags.GhostThroughSprites|spriteFlags.RelativeToCamera) ||
        Math.abs(a.x - b.x) * 2 >= a.width + b.width ||
        Math.abs(a.y - b.y) * 2 >= a.height + b.height) return false;
      const ab=this._wallHitbox(a),bb=this._wallHitbox(b);
      const al=a._fx+ab.left*256,ar=al+(ab.width-1)*256,at=a._fy+ab.top*256,ad=at+(ab.height-1)*256;
      const bl=b._fx+bb.left*256,br=bl+(bb.width-1)*256,bt=b._fy+bb.top*256,bd=bt+(bb.height-1)*256;
      if(al>br || at>bd || ar<bl || ad<bt)return false;
      if((a.flags|b.flags)&8192)return true;
      if(a._rotatedBBox || b._rotatedBBox)return this._rotatedSpriteOverlap(a,b);
      const am = this._spriteMask(a), bm = this._spriteMask(b);
      if (!am || !bm) return true;
      if(a._sx!==256 || a._sy!==256 || b._sx!==256 || b._sy!==256)return this._scaledSpriteOverlap(a,b,am,bm);
      const dx = Math.trunc((a.x - a.width / 2) - (b.x - b.width / 2));
      const dy = Math.trunc((a.y - a.height / 2) - (b.y - b.height / 2));
      for (let y = 0; y < a.height; y++) {
        const by = y + dy;
        if (by < 0 || by >= b.height) continue;
        for (let x = 0; x < a.width; x++) {
          const bx = x + dx;
          if (bx >= 0 && bx < b.width && am[y * a.width + x] && bm[by * b.width + bx]) return true;
        }
      }
      return false;
    }
    // Tile locations are separate identity-bearing objects. Their coordinates
    // survive map replacement, while their pixel bounds use the current scale,
    // just like the pinned PXT Location getters.
    _tileLocation(value) {
      const id = Scratch.BWValues.referenceId(this._runtime, value, 'tile');
      return id === null ? null : this._tileLocations.get(id);
    }
    tileLocation(args) {
      const column = Scratch.BWValues.decode(args.COLUMN), row = Scratch.BWValues.decode(args.ROW);
      if (column === undefined || row === undefined || !this._state().tilemapInitialized) return Scratch.BWValues.encode(null);
      const id = 'arcade-tile:' + (++this._nextTileLocationId);
      this._tileLocations.set(id, {column: Number(column), row: Number(row)});
      return Scratch.BWValues.reference(this._runtime, 'tile', id);
    }
    _tileOffset(location, map) {
      if (!map || !location || location.column < 0 || location.row < 0 ||
        location.column >= map.columns || location.row >= map.rows) return -1;
      return (location.column | 0) + (location.row | 0) * map.columns;
    }
    _tileIndex(location, map) {
      const offset = this._tileOffset(location, map);
      return offset < 0 ? 0 : map.indices[offset];
    }
    tileLocationProperty(args) {
      const location = this._tileLocation(args.LOCATION);
      if (!location) throw new TypeError('Expected type Location but received type null. Did you forget to assign a variable?');
      const property=String(args.PROPERTY);
      if (property==='column' || property==='col') return location.column;
      if (property==='row') return location.row;
      if (!this._state().tilemapInitialized)
        throw new TypeError("Cannot read properties of undefined (reading 'fields')");
      const map = this._state().tilemap, size = map?.tileSize || this._state().tilemapScale || 16;
      const scale = Math.log2(size), x = location.column << scale, y = location.row << scale;
      switch (String(args.PROPERTY)) {
      case 'column': case 'col': return location.column;
      case 'row': return location.row;
      case 'x': return x + size / 2;
      case 'y': return y + size / 2;
      case 'left': return x;
      case 'top': return y;
      case 'right': return x + size;
      case 'bottom': return y + size;
      case 'tileSet':
        if (!map) throw new TypeError('Expected type TileMapData but received type null. Did you forget to assign a variable?');
        return this._tileIndex(location, map);
      default: return 0;
      }
    }
    _tileImageIndex(map, image) {
      if (!map || !image) return -1;
      const index = map.images.findIndex(candidate => candidate.width === image.width &&
        candidate.height === image.height && candidate.pixels.length === image.pixels.length &&
        candidate.pixels.every((pixel, i) => pixel === image.pixels[i]));
      if (index >= 0) return index;
      if (map.images.length >= 256) return -1;
      map.images.push(image);return map.images.length - 1;
    }
    _tileImage(map, index) {
      if (map?.legacy) {
        let definition=map.definitions[index];
        if (!definition) {
          const size=map.tileSize,pixels=new Uint8Array(size*size);pixels.fill(index);
          const image={width:size,height:size,pixels};
          definition=map.definitions[index]={image,wall:false};map.images[index]=image;
        }
        const image=definition.image,size=map.tileSize;
        if (!definition.view || definition.view.width!==size) {
          if (image.width===size && image.height===size) definition.view=image;
          else {
            const pixels=new Uint8Array(size*size);
            for(let y=0;y<Math.min(size,image.height);y++)for(let x=0;x<Math.min(size,image.width);x++)pixels[y*size+x]=image.pixels[y*image.width+x];
            definition.view={width:size,height:size,pixels};
          }
        }
        return definition.view;
      }
      const image = map?.images[index];
      if (!image) return null;
      if (image.width <= map.tileSize && image.height <= map.tileSize) return image;
      if (!map.views[index]) {
        const size = map.tileSize, pixels = new Uint8Array(size * size);
        for (let y = 0; y < Math.min(size, image.height); y++)
          for (let x = 0; x < Math.min(size, image.width); x++) pixels[y*size+x] = image.pixels[y*image.width+x];
        map.views[index] = {width:size, height:size, pixels};
      }
      return map.views[index];
    }
    // PXT distinguishes an absent scene TileMap from a TileMap whose data was
    // cleared (setTilemap(null/undefined)). TileMap.getImageType dereferences
    // the cleared data, so every image lookup faults the calling fiber then.
    // Under the engine the fault ends only the calling fiber, as in PXT; a direct
    // (engine-less) call throws the same TypeError.
    _clearedTileImageLookup(state,image,util) {
      if (!image || state.tilemap || !state.tilemapInitialized) return false;
      if (!util) throw new TypeError("Cannot read properties of null (reading 'fields')");
      return true;
    }
    tilesOfType(args,util) {
      const state=this._state(),map=state.tilemap,image=this._image(args.IMAGE);
      if (this._clearedTileImageLookup(state,image,util)) return this._primitiveFault('tilesOfType',args,util);
      const index=this._tileImageIndex(map,image),locations = [];
      if (index >= 0) for (let column = 0; column < map.columns; column++)
        for (let row = 0; row < map.rows; row++) if (map.indices[row*map.columns+column] === index)
          locations.push(this.tileLocation({COLUMN:column, ROW:row}));
      return Scratch.BWValues.arrayReference(this._runtime, locations);
    }
    tileAtLocation(args) {
      const map = this._state().tilemap, location = this._tileLocation(args.LOCATION);
      if (!location || !this._state().tilemapInitialized) return Scratch.BWValues.encode(null);
      if (!map) throw new TypeError('Expected type TileMapData but received type null. Did you forget to assign a variable?');
      return this._imageHandle(this._tileImage(map, this._tileIndex(location, map)));
    }
    tileIs(args) {
      const map = this._state().tilemap, location = this._tileLocation(args.LOCATION), image = this._image(args.IMAGE);
      if (!location || !image || !this._state().tilemapInitialized) return false;
      if (!map) throw new TypeError('Expected type TileMapData but received type null. Did you forget to assign a variable?');
      return this._tileIndex(location,map) === this._tileImageIndex(map,image);
    }
    spriteTileKindAt(args) {
      const sprite=this._sprite(args.ID),map=this._state().tilemap,image=this._image(args.IMAGE);
      if(!sprite || !map || !image){this._runtime?.emit?.('BLOCKS_ERROR','Arcade tile kind requires a sprite, tile map and image');return false;}
      const scale=Math.log2(map.tileSize),direction=Number(args.DIRECTION);
      let column=(sprite._fx/256)>>scale,row=(sprite._fy/256)>>scale;
      if(direction===0)column--;else if(direction===1)row--;else if(direction===2)column++;else if(direction===3)row++;
      const tile=this._tileImage(map,this._tileIndex({column,row},map));
      return tile ? imageEngine.equals(tile,image) : false;
    }
    tileIsWall(args) {
      const map = this._state().tilemap, location = this._tileLocation(args.LOCATION);
      if (!map || !location || (map.legacy && !map.mapImage)) return false;
      const offset = this._tileOffset(location,map);
      if(map.legacy && map.mapImage && offset>=0 && !map.definitions[map.indices[offset]])return Scratch.BWValues.encode(undefined);
      return offset < 0 || Boolean(map.walls[offset]);
    }
    setTileAt(args) {
      const map = this._state().tilemap, location = this._tileLocation(args.LOCATION), image = this._image(args.IMAGE);
      if (!map || !location || !image) return;
      const index = this._tileImageIndex(map,image), scale = Math.log2(map.tileSize);
      const offset = this._tileOffset({column: ((location.column << scale) + map.tileSize/2) >> scale,
        row: ((location.row << scale) + map.tileSize/2) >> scale},map);
      if (index >= 0 && offset >= 0) {map.indices[offset] = index;this._renderTilemap();this._changed();}
    }
    setWallAt(args) {
      const map = this._state().tilemap, location = this._tileLocation(args.LOCATION);
      if (!map || !location) return;
      const scale = Math.log2(map.tileSize), offset = this._tileOffset({column: ((location.column << scale)+map.tileSize/2) >> scale,
        row: ((location.row << scale)+map.tileSize/2) >> scale},map);
      if (offset >= 0) {map.walls[offset] = Boolean(Scratch.BWValues.decode(args.WALL));this._changed();}
    }
    placeOnTile(args, util) {
      // PXT returns for a missing sprite; only Sprite.setPosition itself throws.
      if (this._missingOperand(util,args,'ID') || !this._tileLocation(args.LOCATION)) return;
      return this.setSpritePosition({ID:args.ID, X:this.tileLocationProperty({...args,PROPERTY:'x'}),
        Y:this.tileLocationProperty({...args,PROPERTY:'y'})},util);
    }
    // PXT samples one location by reservoir sampling, visiting columns first;
    // the first match consumes no randomness (sampleTilesByType).
    _sampleTile(map, index) {
      let chosen = null, count = 0;
      for (let column = 0; column < map.columns; column++) for (let row = 0; row < map.rows; row++)
        if (map.indices[row*map.columns+column] === index) {
          if (count === 0 || Math.floor(Math.random()*(count+1)) === 0) chosen = {COLUMN:column,ROW:row};
          count++;
        }
      return chosen;
    }
    placeOnRandomTile(args, util) {
      if (this._missingOperand(util,args,'ID')) return;
      const state = this._state(), map = state.tilemap, image = this._image(args.IMAGE);
      // A destroyed sprite is still a truthy Sprite in PXT: only a missing one returns early.
      if (this._clearedTileImageLookup(state,image,util)) return this._primitiveFault('placeOnRandomTile',args,util);
      const index = this._tileImageIndex(map,image);
      if (index < 0) return;
      const chosen = this._sampleTile(map, index);
      if (chosen) return this.placeOnTile({ID:args.ID,LOCATION:this.tileLocation(chosen)},util);
    }
    randomTileOfType(args,util) {
      const map = this._state().tilemap, image = this._image(args.IMAGE);
      if (!image || !this._state().tilemapInitialized) return Scratch.BWValues.encode(undefined);
      if (this._clearedTileImageLookup(this._state(),image,util)) return this._primitiveFault('randomTileOfType',args,util);
      const index = this._tileImageIndex(map, image);
      if (index < 0) return Scratch.BWValues.encode(undefined);
      const chosen = this._sampleTile(map, index);
      return chosen ? this.tileLocation(chosen) : Scratch.BWValues.encode(undefined);
    }
    tileNeighbor(args) {
      const location = this._tileLocation(args.LOCATION);
      if (!location) throw new TypeError("Cannot read properties of null (reading 'tileMap')");
      const direction = Number(args.DIRECTION);
      let {column, row} = location;
      if (direction === 0) column--; else if (direction === 1) row--;
      else if (direction === 2) column++; else if (direction === 3) row++;
      else return Scratch.BWValues.encode(undefined);
      return this.tileLocation({COLUMN: column, ROW: row});
    }
    spriteTileLocation(args) {
      const sprite = this._sprite(args.ID), map = this._state().tilemap;
      if (!sprite || !this._state().tilemapInitialized || !map) return Scratch.BWValues.encode(undefined);
      const scale = Math.log2(map.tileSize);
      return this.tileLocation({COLUMN: (sprite._fx/256) >> scale, ROW: (sprite._fy/256) >> scale});
    }
    // Legacy Tile retains its creating map; modern Location resolves the
    // current scene. Keep separate reference kinds even though both use cells.
    _legacyTile(value) {
      const id=Scratch.BWValues.referenceId(this._runtime,value,'legacy-tile');
      return id===null?null:this._tileLocations.get(id);
    }
    legacyTileLocation(args) {
      const map=this._legacyMap(),id='arcade-legacy-tile:'+(++this._nextTileLocationId);
      this._tileLocations.set(id,{column:Number(Scratch.BWValues.decode(args.COLUMN)),row:Number(Scratch.BWValues.decode(args.ROW)),map});
      return Scratch.BWValues.reference(this._runtime,'legacy-tile',id);
    }
    legacyTileProperty(args) {
      const tile=this._legacyTile(args.TILE);if(!tile)return 0;
      const scale=Math.log2(tile.map.tileSize);
      switch(String(args.PROPERTY)) {
      case 'x':return (tile.column<<scale)+(1<<(scale-1));
      case 'y':return (tile.row<<scale)+(1<<(scale-1));
      case 'tileSet':
        if(!tile.map.mapImage)throw new TypeError('Cannot read a legacy Tile index while its map is disabled');
        return imageEngine.getPixel(tile.map.mapImage,tile.column,tile.row);
      default:return 0;
      }
    }
    legacyTilesOfType(args) {
      const map=this._legacyMap(),index=Number(Scratch.BWValues.decode(args.INDEX)),result=[];
      this._syncLegacyMap(map);
      if(map.mapImage && index>=0 && index<=15)for(let column=0;column<map.columns;column++)
        for(let row=0;row<map.rows;row++)if(map.indices[row*map.columns+column]===index)
          result.push(this.legacyTileLocation({COLUMN:column,ROW:row}));
      return Scratch.BWValues.arrayReference(this._runtime,result);
    }
    setLegacyTileAt(args) {
      const map=this._legacyMap(),tile=this._legacyTile(args.TILE),index=Number(Scratch.BWValues.decode(args.INDEX));
      if(!tile || !map.mapImage || index<0 || index>15)return;
      const scale=Math.log2(map.tileSize),column=this.legacyTileProperty({...args,PROPERTY:'x'})>>scale,
        row=this.legacyTileProperty({...args,PROPERTY:'y'})>>scale;
      imageEngine.draw(map.mapImage,'setPixel',column,row,index);this._refreshImage(map.mapImage);
    }
    placeOnLegacyTile(args,util) {
      if(this._missingOperand(util,args,'ID') || !this._legacyTile(args.TILE))return;
      return this.setSpritePosition({ID:args.ID,X:this.legacyTileProperty({...args,PROPERTY:'x'}),Y:this.legacyTileProperty({...args,PROPERTY:'y'})},util);
    }
    placeOnRandomLegacyTile(args,util) {
      // The original checks sprite/map before lookup (which can create a map).
      if(!this._sprite(args.ID) || !this._state().tilemap)return;
      const values=Scratch.BWValues.arrayValue(this._runtime,this.legacyTilesOfType(args));
      if(values.length)return this.placeOnLegacyTile({ID:args.ID,TILE:values[Math.floor(Math.random()*values.length)]},util);
    }
    _ensureTilemapRenderable(kind,state=this._state()) {
      if(!state.tilemapRenderable || state.tilemapRenderable.kind!==kind){
        if(state.tilemapRenderable)this._sceneFlags.remove(state,state.tilemapRenderable);
        state.tilemapRenderable={kind,z:-1,pxtId:state.nextSpriteId++};this._sceneFlags.register(state,state.tilemapRenderable);
      }
      return state.tilemapRenderable;
    }
    _legacyMap() {
      const state=this._state();
      if(!state.tilemap?.legacy)state.tilemap={legacy:true,tileSize:16,columns:0,rows:0,indices:new Uint8Array(0),walls:new Uint8Array(0),images:[],views:[],definitions:[]};
      this._ensureTilemapRenderable('legacy');
      state.tilemapInitialized=true;state.tilemapScale=state.tilemap.tileSize;
      return state.tilemap;
    }
    _syncLegacyMap(map) {
      if(!map?.legacy)return;
      map.columns=map.mapImage?.width || 0;map.rows=map.mapImage?.height || 0;
      map.indices=map.mapImage?.pixels || new Uint8Array(0);
      if(map.walls.length!==map.indices.length)map.walls=new Uint8Array(map.indices.length);
      for(let i=0;i<map.indices.length;i++)map.walls[i]=map.definitions[map.indices[i]]?.wall?1:0;
    }
    setLegacyTilemap(args) {
      const value=Scratch.BWValues.decode(args.IMAGE),image=this._image(args.IMAGE);
      const scale=Number(Scratch.BWValues.decode(args.SCALE));
      if(![2,3,4,5].includes(scale) || (!image && value!==null && value!==undefined))return;
      const map=this._legacyMap();map.mapImage=image || null;map.tileSize=1<<scale;
      this._state().tilemapScale=map.tileSize;this._syncLegacyMap(map);
      if (!this._background && this._runtime?.renderer) this.setBackgroundColor({COLOR:this.backgroundColor()});
      this._renderTilemap();this._changed();
    }
    setLegacyTile(args) {
      const map=this._legacyMap(),index=Number(Scratch.BWValues.decode(args.INDEX)),image=this._image(args.IMAGE);
      if(!Number.isInteger(index) || index<0 || index>15 || !image)return;
      map.definitions[index]={image,wall:!!Scratch.BWValues.decode(args.WALL)};map.images[index]=image;
      this._syncLegacyMap(map);this._renderTilemap();this._changed();
    }
    // Validates one serialized map (the shape arcade-translate writes). Returns
    // the live data object, or throws for malformed input.
    _parseTilemapData(decoded) {
      const data = JSON.parse(String(decoded));
      if (data === null) return null;
      if (!Number.isInteger(data.columns) || !Number.isInteger(data.rows) || data.columns < 0 || data.rows < 0 ||
        data.columns > 65535 || data.rows > 65535 || ![4,8,16,32].includes(data.tileSize) ||
        !Array.isArray(data.indices) || data.indices.length !== data.columns*data.rows ||
        !Array.isArray(data.walls) || data.walls.length !== data.indices.length ||
        !Array.isArray(data.images) || data.images.length > 256) throw Error('Invalid tilemap data');
      for (const index of data.indices) if (!Number.isInteger(index) || index < 0 || index > 255) throw Error('Invalid tile index');
      data.images = data.images.map(image => {
        if (!Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 0 || image.height < 0 ||
          !Array.isArray(image.pixels) || image.pixels.length !== image.width*image.height ||
          image.pixels.some(pixel => !Number.isInteger(pixel) || pixel < 0 || pixel > 15)) throw Error('Invalid tile image');
        return {width:image.width,height:image.height,pixels:Uint8Array.from(image.pixels)};
      });
      data.indices = Uint8Array.from(data.indices);
      data.walls = Uint8Array.from(data.walls,wall => wall ? 1 : 0);
      data.views = [];
      return data;
    }
    // A TileMapData value is one mutable object shared by every holder, so edits
    // survive switching away from the level and back.
    // It travels as a 'tile' reference whose id ('arcade-tilemap:N') is never a location id:
    // the shared BWValues reference kinds (and their pinned canonical supplier) stay unchanged.
    _tilemapDataOf(value) {
      const id = Scratch.BWValues.referenceId(this._runtime, value, 'tile');
      return id === null ? undefined : this._tilemapData.get(id);
    }
    tilemapValue(args) {
      const decoded = Scratch.BWValues.decode(args.DATA);
      if (decoded === null || decoded === '') return Scratch.BWValues.encode(null);
      let data;
      try {data = this._parseTilemapData(decoded);} catch (error) {
        this._runtime?.emit?.('BLOCKS_ERROR',{message:error.message,extensionId:'arcade',opcode:'tilemapValue'});return Scratch.BWValues.encode(null);
      }
      if (data === null) return Scratch.BWValues.encode(null);
      const id = 'arcade-tilemap:' + (++this._nextTilemapData);
      // One identity per map: events and Location.tileMap.data report this same reference.
      data.referenceId = id;
      this._tilemapData.set(id, data);
      return Scratch.BWValues.reference(this._runtime, 'tile', id);
    }
    _requireTilemapData(value) {
      const data = this._tilemapDataOf(value);
      if (!data) throw new TypeError('Expected type TileMapData but received type null. Did you forget to assign a variable?');
      return data;
    }
    tilemapProperty(args) {
      const data = this._requireTilemapData(args.DATA);
      switch (String(args.PROPERTY)) {
      case 'width': return data.columns;
      case 'height': return data.rows;
      case 'scale': return data.dataScale ?? Math.log2(data.tileSize);
      default: return 0;
      }
    }
    _tilemapLoaded(data) {
      return this._state().tilemap === data || this._sceneStack.some(bundle => bundle?.state?.tilemap === data);
    }
    // PXT TileMapData.scale setter: the map's own scale (getTileImage crops to it)
    // changes now; a scene TileMap copies the scale only when it loads the map
    // (TileMap.setData), so a loaded map keeps its grid until it is set again.
    setTilemapScale(args) {
      const data = this._requireTilemapData(args.DATA), value = Number(Scratch.BWValues.decode(args.VALUE));
      const shift = (value | 0) & 31;
      // The renderer admits the tile sizes a tilemap literal can carry (4 to 32 pixels).
      if (!Number.isFinite(value) || shift < 2 || shift > 5) {
        this._runtime?.emit?.('BLOCKS_ERROR',{message:'Arcade tilemap scale must be a tile scale from 2 to 5',extensionId:'arcade',opcode:'setTilemapScale'});return;
      }
      data.dataScale = value;data.views = [];
      if (!this._tilemapLoaded(data)) data.tileSize = 1 << shift;
    }
    // PXT TileMapData.getTileset returns the map's own tileset Array: one Array per
    // map, holding the same Image objects the map draws (setPixel on one shows on
    // every tile of that index; images added by setTileAt appear in it).
    tilemapTileset(args) {
      const data = this._requireTilemapData(args.DATA);
      if (!data.tilesetArray) data.tilesetArray = [];
      const array = data.tilesetArray;
      array.length = 0;
      for (const image of data.images) array.push(this._imageHandle(image));
      return Scratch.BWValues.arrayReference(this._runtime, array);
    }
    // PXT Location.tileMap is game.currentScene().tileMap: one TileMap per scene,
    // created by the scene's first setTilemap, and undefined before that.
    tileLocationTilemap(args) {
      if (!this._tileLocation(args.LOCATION)) throw new TypeError("Cannot read properties of null (reading 'tileMap')");
      const state = this._state();
      if (!state.tilemapInitialized) return Scratch.BWValues.encode(undefined);
      if (!state.sceneTilemapId) {
        state.sceneTilemapId = 'arcade-scene-tilemap:' + (++this._nextTilemapData);
        this._sceneTilemaps.set(state.sceneTilemapId, state);
      }
      return Scratch.BWValues.reference(this._runtime, 'tile', state.sceneTilemapId);
    }
    sceneTilemapProperty(args) {
      const id = Scratch.BWValues.referenceId(this._runtime, args.MAP, 'tile'), state = id === null ? undefined : this._sceneTilemaps.get(id);
      if (!state) throw new TypeError('Expected type TileMap but received type ' + (Scratch.BWValues.decode(args.MAP) === null ? 'null' : 'undefined') + '. Did you forget to assign a variable?');
      const map = state.tilemap && !state.tilemap.legacy ? state.tilemap : null, scale = Math.log2(state.tilemapScale || 16);
      switch (String(args.PROPERTY)) {
      case 'data': return map ? this._tilemapReference(map) : Scratch.BWValues.encode(null);
      case 'scale': return scale;
      case 'enabled': return !!map;
      case 'areaWidth': return map ? map.columns << scale : 0;
      case 'areaHeight': return map ? map.rows << scale : 0;
      default: return 0;
      }
    }
    tilemapTile(args) {
      const data = this._requireTilemapData(args.DATA), column = Number(Scratch.BWValues.decode(args.COLUMN)), row = Number(Scratch.BWValues.decode(args.ROW));
      return this._tileIndex({column, row}, data);
    }
    tilemapIsWall(args) {
      const data = this._requireTilemapData(args.DATA), offset = this._tileOffset({column: Number(Scratch.BWValues.decode(args.COLUMN)), row: Number(Scratch.BWValues.decode(args.ROW))}, data);
      return offset >= 0 && Boolean(data.walls[offset]);
    }
    tilemapTileImage(args) {
      const data = this._requireTilemapData(args.DATA), view = this._tileImage(data, Number(Scratch.BWValues.decode(args.INDEX)));
      return view ? this._imageHandle(view) : Scratch.BWValues.encode(undefined);
    }
    setTilemapTile(args) {
      const data = this._requireTilemapData(args.DATA), column = Number(Scratch.BWValues.decode(args.COLUMN)) | 0, row = Number(Scratch.BWValues.decode(args.ROW)) | 0;
      const offset = this._tileOffset({column, row}, data);
      if (offset < 0) return;
      data.indices[offset] = Number(Scratch.BWValues.decode(args.INDEX));
      if (data === this._state().tilemap) {this._renderTilemap();this._changed();}
    }
    setTilemapWall(args) {
      const data = this._requireTilemapData(args.DATA), offset = this._tileOffset({column: Number(Scratch.BWValues.decode(args.COLUMN)) | 0, row: Number(Scratch.BWValues.decode(args.ROW)) | 0}, data);
      if (offset >= 0) {data.walls[offset] = Scratch.BWValues.decode(args.WALL) ? 1 : 0;this._changed();}
    }
    _applyTilemap(data) {
      this._ensureTilemapRenderable('modern');
      if (data === null) {this._state().tilemapInitialized=true;delete this._state().tilemap;this._clearTilemap();this._changed();return;}
      // TileMap.setData copies the map's own scale (see setTilemapScale).
      if (data.dataScale !== undefined && !data.legacy) {data.tileSize = 1 << ((data.dataScale | 0) & 31);data.views = [];}
      this._state().tilemap = data;
      this._state().tilemapInitialized = true;
      this._state().tilemapScale = data.tileSize;
      if (!this._background && this._runtime?.renderer) this.setBackgroundColor({COLOR:this.backgroundColor()});
      this._renderTilemap();this._changed();
    }
    _tilemapReference(data) {
      if (!data.referenceId) {
        data.referenceId = 'arcade-tilemap:' + (++this._nextTilemapData);
        this._tilemapData.set(data.referenceId, data);
      }
      return Scratch.BWValues.reference(this._runtime, 'tile', data.referenceId);
    }
    // PXT's TileMap.setData runs each Unloaded handler for the outgoing map and
    // each Loaded handler for the incoming one, synchronously on the caller's fiber.
    *_tilemapEventSteps(event, data, util) {
      const runtime = this._runtime, epoch = this._terrainEpoch;
      if (!data || !runtime?.allScriptsByOpcodeDo || !runtime?._pushThread) return;
      const reference = this._tilemapReference(data);
      for (const registration of this._tilemapHandlers.filter(handler => handler.event === event)) {
        const scripts = [];
        runtime.allScriptsByOpcodeDo('arcade_whenRegisteredTilemapEvent', (script, target) => {
          const hat = target.blocks.getBlock(script.blockId), token = target.blocks.getBlock(hat.inputs?.TOKEN?.block);
          if (token?.fields?.TEXT?.value === registration.token) scripts.push({script, target});
        });
        for (const {script, target} of scripts) {
          const thread = runtime._pushThread(script.blockId, target);
          thread.bwArcadeEvent = {TOKEN: registration.token, data: reference};
          thread.bwArcadeCaptures = registration.captures;
          try{exceptionOwners.get(this).bindStructuredRegistration(registration,thread);}
          catch(error){runtime.sequencer.retireThread(thread);throw error;}
          const caller = util?.thread, active = runtime.sequencer.activeThread;
          try {runtime.sequencer.activeThread = thread;runtime.sequencer.stepThread(thread);}
          finally {if (util) {util.thread = caller;util.sequencer = runtime.sequencer;}runtime.sequencer.activeThread = active;}
          if (epoch !== this._terrainEpoch) return;
          if (thread.status !== thread.constructor.STATUS_DONE && !thread.isKilled && runtime.threads.includes(thread))
            yield new Promise(resolve => this._terrainWaits.add({thread, resolve}));
          if (epoch !== this._terrainEpoch) return;
        }
      }
    }
    registerTilemapEvent(args, util) {
      const event = String(args.EVENT), token = String(args.TOKEN);
      if (!['Loaded', 'Unloaded'].includes(event)) return;
      if (this._tilemapHandlers.some(handler => handler.event === event && handler.token === token)) return;
      const captures = new Map(util?.thread?.bwArcadeCaptures || []), values = this._localParams(util);
      for (const key of String(args.CAPTURES || '').split(/\\s+/).filter(Boolean)) if (values) captures.set(key, {values, key});
      this._tilemapHandlers.push({event, token,
        captures:exceptionOwners.get(this).captureStructuredRegistration(args,util,captures)});
    }
    unregisterTilemapEvent(args) {
      const index = this._tilemapHandlers.findIndex(handler => handler.event === String(args.EVENT) && handler.token === String(args.TOKEN));
      if (index >= 0) this._tilemapHandlers.splice(index, 1);
    }
    whenRegisteredTilemapEvent(args, util) {return util?.thread?.bwArcadeEvent?.TOKEN === String(args.TOKEN);}
    eventTilemapData(args, util) {return util?.thread?.bwArcadeEvent?.data || Scratch.BWValues.encode(undefined);}
    setTilemap(args, util) {
      const decoded = Scratch.BWValues.decode(args.DATA);
      const shared = this._tilemapDataOf(args.DATA);
      let data;
      if (shared !== undefined) data = shared;
      else if (decoded === null || decoded === '') data = null;
      else try {
        data = this._parseTilemapData(decoded);
      } catch (error) {
        this._runtime?.emit?.('BLOCKS_ERROR',{message:error.message,extensionId:'arcade',opcode:'setTilemap'});return;
      }
      const previous = this._state().tilemap;
      const outgoing = previous && !previous.legacy && previous !== data;
      if (!this._tilemapHandlers.length || (!outgoing && !data) || (data && data.legacy)) return this._applyTilemap(data);
      const epoch=this._terrainEpoch;
      const steps = function* () {
        if (outgoing) yield* this._tilemapEventSteps('Unloaded', previous, util);
        if(epoch!==this._terrainEpoch)return;
        this._applyTilemap(data);
        if (data && previous !== data) yield* this._tilemapEventSteps('Loaded', data, util);
      }.call(this);
      return this._runTerrainGenerator(steps);
    }
    _tilemapRaster(map,state=this._state()) {
      this._syncLegacyMap(map);
      const image={width:160,height:120,pixels:new Uint8Array(160*120)};
      if(map.legacy && !map.mapImage)return image;
      const camera=this._camera(state),size=map.tileSize,scale=Math.log2(size);
      const offsetX=camera.drawOffsetX & (size-1),offsetY=camera.drawOffsetY & (size-1);
      const firstX=Math.max(0,camera.drawOffsetX>>scale),firstY=Math.max(0,camera.drawOffsetY>>scale);
      const lastX=Math.min(map.columns,((camera.drawOffsetX+160)>>scale)+1);
      const lastY=Math.min(map.rows,((camera.drawOffsetY+120)>>scale)+1);
      // PXT draws inclusive bounds, using tile zero outside the map. Iterate
      // tiles rather than RGB pixels, preserving cached padded legacy images.
      for(let column=firstX;column<=lastX;column++)for(let row=firstY;row<=lastY;row++) {
        const index=column<0 || row<0 || column>=map.columns || row>=map.rows?0:map.indices[row*map.columns+column];
        const tile=this._tileImage(map,index);
        if(tile?.width && tile?.height)imageEngine.blit(image,tile,'drawTransparentImage',
          ((column-firstX)<<scale)-offsetX,((row-firstY)<<scale)-offsetY);
      }
      return image;
    }
    _renderTilemap(presentLegacy=false) {
      const map = this._state().tilemap;
      if (!map) {this._clearTilemap();return;}
      this._syncLegacyMap(map);
      // Legacy defaults allocate during drawing, after source setters/queries.
      // Image mutation marks a redraw, without moving that allocation earlier.
      if(map.legacy && !presentLegacy){map.needsRender=true;return;}
      if(map.legacy && !map.needsRender)return;
      if(map.legacy)map.needsRender=false;
      if(map.legacy && !map.mapImage){this._clearTilemap();return;}
      // The screen view is separate from scene.backgroundImage(), which must
      // remain editable and observable without including the tile layer.
      const image=this._tilemapRaster(map);
      map.image = image;
      const renderer = this._runtime?.renderer;
      if (!renderer) return;
      const svg = imageEngine.svg(image,this._imagePalette(image));
      if (!this._tilemapDrawable) {
        const skin = renderer.createSVGSkin(svg,[320,240]), drawable = renderer.createDrawable('background');
        renderer.updateDrawableSkinId(drawable,skin);renderer.updateDrawableScale(drawable,[75,75]);
        renderer.updateDrawablePosition(drawable,[0,0]);this._tilemapDrawable = {skin,drawable};
      } else renderer.updateSVGSkin(this._tilemapDrawable.skin,svg,[320,240]);
      this._orderBackgroundLayers();
      this._runtime.requestRedraw?.();
    }
    _clearTilemap() {
      const renderer = this._runtime?.renderer;
      if (this._tilemapDrawable) {
        renderer?.destroyDrawable(this._tilemapDrawable.drawable,'background');renderer?.destroySkin(this._tilemapDrawable.skin);
        this._tilemapDrawable = null;
      }
    }
    _kindValue(value) {return this._kindRegistry.normalize(Scratch.BWValues.decode(value));}
    createSpriteKind() {return this._kindRegistry.create();}
    spriteKindValue(args) {
      const name=String(Scratch.BWValues.decode(args.NAME)),entry=this._kindRegistry.bindings().find(binding=>binding.name===name);
      if(!entry)throw new TypeError('Unregistered sprite kind name: '+name);
      return entry.kind;
    }
    bindSpriteKind(args) {this._kindRegistry.bindName(String(Scratch.BWValues.decode(args.NAME)),this._kindValue(args.KIND));}
    initializeSpriteKindLibrary(args) {
      const library=String(Scratch.BWValues.decode(args.LIBRARY)),version=String(Scratch.BWValues.decode(args.VERSION));
      if(library!=='textsprite' || !['v1.3.0','fa2439314c6633943666a763fdae32a5c67a9ae8'].includes(version))throw new Error('Arcade sprite kind library initializer is not implemented: '+library+'@'+version);
      this._textSprites();
    }
    _spritesOfKind(kind) {
      // PXT allOfKind explicitly excludes negative kinds. Those sprites stay
      // in scene/physics ownership and continue to receive lifecycle callbacks.
      kind=this._kindValue(kind);if(kind==null || !(kind>=0))return [];
      // SpriteSet.sprites() also drops sprites an effect is destroying.
      return (this._spriteKindSets().get(kind)||[]).filter(s=>!(s.flags&2));
    }
    spritesOfKind(args) {
      return Scratch.BWValues.arrayReference(this._runtime, this._spritesOfKind(args.KIND).map(s => s.id));
    }
    withoutNullSprites(args) {
      const fail=()=>this._objectError(new Error('Null filtering requires a dense native Sprite/null array'));
      if(!Scratch.BWValues.hasNativeReferenceMetadata(args.ARRAY))return fail();
      const array=Scratch.BWValues.arrayValue(this._runtime,args.ARRAY);
      if(!array||nullFilterPrototype(array)!==nullFilterArrayPrototype)return fail();
      const size=nullFilterDescriptor(array,'length');
      if(!size||!Object.hasOwn(size,'value')||typeof size.value!=='number'||size.value<0||size.value%1!==0)return fail();
      const keys=nullFilterKeys(array);
      if(keys.length!==size.value+1)return fail();
      const result=[];
      for(let i=0;i<size.value;i++){
        const cell=nullFilterDescriptor(array,String(i));
        if(!cell||!Object.hasOwn(cell,'value'))return fail();
        const value=cell.value;
        if(value===null)continue;
        // Retained destroyed Sprites are still the same Sprite handles.
        if(typeof value!=='string'||!this._spriteValues.has(value))return fail();
        nullFilterDefine(result,String(result.length),{value,writable:true,enumerable:true,configurable:true});
      }
      // A synchronous reporter: no guest callback, loop block or VM yield.
      return Scratch.BWValues.arrayReference(this._runtime,result);
    }
    spriteCount(args) { return this._spritesOfKind(args.KIND).length; }
    whenSpriteCreated(args, util) {
      const event = this._currentEvent || (util && util.thread && util.thread.bwArcadeEvent);
      return Boolean(event && event.KIND === this._kindValue(args.KIND));
    }
    whenSpriteDestroyed(args, util) {
      const event = this._currentEvent || (util && util.thread && util.thread.bwArcadeEvent);
      return Boolean(event && event.KIND === this._kindValue(args.KIND));
    }
    whenRegisteredCreated(args, util) {
      const event = util?.thread?.bwArcadeEvent;
      return Boolean(event && String(event.TOKEN) === String(args.TOKEN));
    }
    whenRegisteredDestroyed(args, util) {
      const event = this._currentEvent || (util && util.thread && util.thread.bwArcadeEvent);
      return Boolean(event && String(event.TOKEN) === String(args.TOKEN));
    }
    whenSpritesOverlap(args, util) {
      const event = this._currentEvent || (util && util.thread && util.thread.bwArcadeEvent);
      const first=this._spriteValues.get(event?.first),second=this._spriteValues.get(event?.second);
      return Boolean(event && first && second && !first._destroyed && !second._destroyed && !((first.flags|second.flags)&(spriteFlags.GhostThroughSprites|spriteFlags.RelativeToCamera)) && event.A===this._kindValue(args.A) && event.B===this._kindValue(args.B));
    }
    eventSprite(args, util) {
      return util && util.thread && util.thread.bwArcadeEvent?.[args.WHICH] || '';
    }
    whenInterval(args, util) {
      const block = util?.thread?.topBlock;
      if (!block) return false;
      const state = this._state();
      if (!state.intervalDue) state.intervalDue = {};
      if (!state.intervalPeriods) state.intervalPeriods = {};
      const key = (util.target?.id || '') + ':' + block;
      const period = state.intervalPeriods[key] || Math.max(1000 / 30, Number(args.PERIOD) || 0);
      state.intervalPeriods[key] = period;
      if (state.intervalDue[key] === undefined) state.intervalDue[key] = period;
      const now = state.elapsedMs || 0;
      if (now + 1e-6 < state.intervalDue[key]) return false;
      state.intervalDue[key] += (Math.floor((now - state.intervalDue[key]) / period) + 1) * period;
      return true;
    }
    whenUpdate() { return true; }
    _startFrameHats() {
      if (!this._runtime?.startHats) return;
      this._runtime.startHats('arcade_whenInterval');
      this._runtime.startHats('arcade_whenUpdate');
    }
    _advance(dt) {
      if(this._terrainStopped || this._dialogs?.[0]?.type==='ask' || this._frameFaults.has(this._state()))return;
      const owner=this._state();
      const elapsed=(this._pendingSceneSeconds.get(owner) || 0)+dt;
      this._pendingSceneSeconds.set(owner,elapsed);
      const existing=this._sceneFrames.get(owner);if(existing)return existing;
      this._pendingSceneSeconds.delete(owner);
      const epoch=this._terrainEpoch,result=this._runTerrainGenerator(this._advanceFrameSteps(elapsed));
      if(result?.then){
        const pending=result.catch(error=>{if(epoch===this._terrainEpoch&&!dependencies.arcadeExceptions.reported(this._runtime,error))this._runtime?.emit?.('BLOCKS_ERROR',error?.message ?? String(error));}).finally(()=>{if(this._sceneFrames.get(owner)===pending)this._sceneFrames.delete(owner);if(this._terrainFrame===pending && epoch===this._terrainEpoch)this._terrainFrame=null;});
        this._sceneFrames.set(owner,pending);if(this._state()===owner)this._terrainFrame=pending;return pending;
      }
      return result;
    }
    *_advanceFrameSteps(dt) {
      const epoch=this._terrainEpoch,owner=this._state();
      const manual=!this._sourceSceneTimers(),began=manual?this._programMillis():0;let completed=false;
      if(manual)this._gameStats.ensure(owner);
      try {yield* this._advanceFrameBody(dt);completed=true;}
      finally {
        if(manual && completed && epoch===this._terrainEpoch && !this._frameFaults.has(owner))this._gameStats.finish(owner,this._programMillis()-began);
        owner._framesDone=(owner._framesDone || 0)+1;
        const queued=owner._afterFrame;owner._afterFrame=undefined;
        if(queued && epoch===this._terrainEpoch)for(const start of queued)start();
      }
    }
    *_advanceFrameBody(dt) {
      const epoch=this._terrainEpoch;
      const state = this._state();
      state.frameDeltaTime=dt;
      if(!this._sourceSceneTimers())this._globalElapsedMs+=dt*1000;
      state.elapsedMs = (state.elapsedMs || 0) + dt * 1000;
      yield* this._sceneButtons(dt);if(this._state()!==state)return;
      // The countdown runs down with the frame but ends in the HUD pass, below.
      if (state.countdownActive) state.countdown = Math.max(0, (state.countdownEndMs-state.elapsedMs)/1000);
      const live = Object.values(state.sprites).filter(s => s.id);
      this._moveControlledSprites(live);yield* this._moveFollowingSpriteSteps();
      if(epoch!==this._terrainEpoch || this._state()!==state)return;
      if (!live.length && !state.physicsEngine.members.length) {this._runFrameHandlers(state,0,19);if(yield* this._sceneUpdates())return;if(this._state()!==state)return;this._advanceAnimations(dt);this._updateCamera();this._runFrameHandlers(state);if(state.tilemap?.legacy)this._renderTilemap(true);yield* this._advanceSpeechSteps(dt);if(this._state()!==state)return;yield* this._composeSceneSteps();if(this._state()!==state || epoch!==this._terrainEpoch || state._defaultGameOverPending)return;this._drawGameStats(state);if(!this._frameFaults.has(state))this._startFrameHats();return;}
      yield* this._advancePhysicsSteps(state.physicsEngine.members.slice(),dt,state.tilemap);
      if(epoch!==this._terrainEpoch || this._state()!==state)return;
      for(const sprite of live)if(state.sprites[sprite.id])this._positionSprite(sprite.id);
      // Extension handlers at ANIMATION_UPDATE_PRIORITY (15) follow physics.
      this._runFrameHandlers(state,0,19);
      if(yield* this._sceneUpdates())return;
      if(this._state()!==state)return;
      this._advanceAnimations(dt);
      this._updateCamera();
      // Extension frame handlers at PXT's pre-render priority (after the camera).
      this._runFrameHandlers(state,19,55);
      const updateCamera=this._camera();
      yield* spriteUpdateHosts.get(this).steps(state,sprite=>this._sdkSpriteBaseUpdateSteps(sprite,dt,updateCamera));
      if(this._state()!==state || epoch!==this._terrainEpoch)return;
      this._runFrameHandlers(state,55);
      if(state.tilemap?.legacy)this._renderTilemap(true);
      yield* this._advanceSpeechSteps(dt);
      if(this._state()!==state)return;
      yield* this._composeSceneSteps();
      if(this._state()!==state || epoch!==this._terrainEpoch || state._defaultGameOverPending)return;
      this._drawGameStats(state);
      this._changed();
      if(!this._frameFaults.has(state))this._startFrameHats();
    }
    *_sdkSpriteBaseUpdateSteps(sprite,dt,camera) {
      const epoch=this._terrainEpoch;
      // Selected Sprite.__update orders lifespan, AutoDestroy, then speech.
      // Its caller still invokes ExtendableSprite.update after destruction.
      if(sprite.lifespan!==undefined){sprite.lifespan-=dt*1000;if(sprite.lifespan<=0){
        sprite.lifespan=undefined;const work=this.destroySprite({ID:sprite.id,_core:true});if(work?.then)yield work;
      }}
      if(epoch!==this._terrainEpoch)return;
      const relative=!!(sprite.flags & spriteFlags.RelativeToCamera),ox=relative?0:camera.drawOffsetX,oy=relative?0:camera.drawOffsetY;
      if(sprite.autoDestroy && (sprite.x+sprite.width/2<ox || sprite.x-sprite.width/2>ox+160 ||
          sprite.y+sprite.height/2<oy || sprite.y-sprite.height/2>oy+120)){
        const work=this.destroySprite({ID:sprite.id});if(work?.then)yield work;
        if(epoch!==this._terrainEpoch)return;
      }
      yield* this._advanceSpeechSteps(dt,sprite.id);
    }
    // PXT's HUD pass raises the life-zero events and then ends the countdown,
    // after the frame's updates and physics. Default terminal actions wait for
    // their final HUD draw; authored callback scheduling stays unchanged.
    *_countdownEndSteps(state,screen) {
      if (!state.countdownActive || state.countdown > 0 || !(state.hudInfo?.visibilityFlag & this._hud().info.Visibility.Countdown)) return;
      state.countdownActive=false;
      state.countdown = 0;
      this._changed();
      if(this._countdownHandlers.length){if(yield* this._registeredCallbackSteps(this._countdownHandlers.slice(),'arcade_whenRegisteredCountdown',{}))return this._faultFrameLoop(state);}
      else {
        const threads=this._runtime?.startHats?.('arcade_whenCountdownEnds') || [];
        if(!threads.length)this._defaultInfoGameOver(state,screen.pixels.slice());
      }
    }
    _defaultInfoGameOver(owner,capturedFrame) {
      if(owner._defaultGameOverPending || this._state()!==owner)return;
      owner._defaultGameOverPending=true;
      // info.ts clears the default loss effect/sound, preserving explicit user
      // choices. Use the retained GameOverConfig setters, not replacement rules.
      const config=this._gameOverState().config;
      config.setEffect(false,null,false);
      config.setSound(false,null,false,false);
      // PXT raises this from the HUD draw, inside the frame fiber: scene.push and the first
      // pause happen right there, and fibers queued earlier in the frame (overlap callbacks
      // started by this frame's physics) resume afterwards, in the NEW scene. Start the
      // terminal operation synchronously so the scene switch precedes those callbacks; its
      // later awaits (scene handlers, pauses) do not block the frame.
      Promise.resolve(this._runGameOver(false,undefined,capturedFrame)).catch(error=>this._runtime?.emit?.('BLOCKS_ERROR',String(error)));
    }
    gameover() {
      this._state().gameOver = true; this._changed();
      if (this._runtime && this._runtime.stopAll) this._runtime.stopAll();
    }
    whenCountdownEnds() { return true; }
    countdown(args) {
      const seconds = Math.max(0, Number(args.N) || 0);
      this._state().countdown = seconds; this._changed();
      return new Promise(resolve => setTimeout(() => { this._state().countdown = 0; this._changed(); resolve(); }, seconds * 1000));
    }
    startCountdown(args) {
      const state = this._infoState();
      state.countdown = Math.max(0, Number(args.N) || 0);
      state.countdownActive = true;
      state.countdownEndMs=state.elapsedMs+state.countdown*1000;
      state.hudInfo.visibilityFlag |= this._hud().info.Visibility.Countdown;
      this._changed();
    }
    stopCountdown() {
      const state = this._infoState();
      state.hudInfo.visibilityFlag = ~(~state.hudInfo.visibilityFlag | this._hud().info.Visibility.Countdown);
      state.countdownActive = false;
      state.countdown = 0;
      this._changed();
    }
  }

  Scratch.extensions.register(new Arcade(Scratch.vm && Scratch.vm.runtime));
})(Scratch);
`, {
  fontSelectorOwner: require('./font-selector-owner'),
  sdkFontValues: require('./sdk-font-values'),
  sdkSpriteClasses: require('./sdk-sprite-classes'),
  sdkObjectClasses: require('./sdk-object-classes'),
  sceneFlags: require('./scene-flags'),
  spriteUpdateActivation: require('./sprite-update-activation'),
  createObjectHeap: require('./object-heap'),
  sourceCallableCells: require('./source-callable-cells'),
  CallableValues: require('./callable-values'),
  createSdkImageOwner: require('./sdk-image-owner'),
  createOwnedSpriteValues: require('./owned-sprite-values'),
  createOwnedSpriteBridge: require('./owned-sprite-bridge'),
  primitiveOwner: require('../../../util/bw-primitive-owner'),
  cachedPrimitiveOwner: require('../../../util/bw-cached-primitive-owner'),
  arcadeExceptions: require('../../../util/bw-arcade-exceptions'),
  readPromptLength: require('./prompt-length-input'),
  sourceValueBinary: require('../../../util/bw-array-source-values').sourceValueBinary,
  sourceValueUnary: require('../../../util/bw-array-source-values').sourceValueUnary,
  createClassCallableHost: require('./class-callable-host'),
  CallableDispatch: require('./callable-dispatch'),
  sourceReferenceTypes: require('./source-reference-types'),
  createSourceScalarCells: require('./source-scalar-cells'),
  createSourceTypeOfValues: require('./source-typeof-values'),
  createConsoleInspectValues,
  bindScoreAdapterInfo: createConsoleInspectValues.bindScoreAdapterInfo,
  bindSourceOperationAdapter: createConsoleInspectValues.bindSourceOperationAdapter,
  sceneClockNumber,
  bindSceneClockAdapterInfo: sceneClockNumber.bindAdapterInfo,
  frameDeltaNumber,
  bindFrameDeltaAdapterInfo: frameDeltaNumber.bindAdapterInfo,
  nullSpriteGetter,
  highScoreFaults,
  tileLookupFaults,
  bindNullSpriteAdapterInfo: (info, adapter, instance) => {nullSpriteGetter.bindAll(info, adapter, instance);tileLookupFaults.bindAll(info, adapter, instance);highScoreFaults.bindAll(info, adapter, instance);},
  createProcedureConstraints: require('./procedure-parameter-constraints'),
  procedureEntry: require('../../../util/bw-procedure-entry'),
  createManagedReturnValues: require('./managed-return-values'),
  currentNumberInput: require('./current-number-input'),
  createSceneFrameContexts: require('./scene-frame-contexts'),
  createGameStats: require('./game-stats'),
  createControlEvents: require('./control-events'),
  createPollEvents: require('./poll-events'),
  createKindRegistry: require('./kind-registry'),
  createTextSpriteHost: require('./text-sprite-host'),
  initializeTextSprite: require('./text-sprite-pxt'),
  createProgramSettings: require('./program-settings').createProgramSettings,
  initializeSpriteData: require('./sprite-data-pxt'),
  createSpeechEngine: require('./speech'),
  initializeSpeech: require('./speech-pxt'),
  initializeNativeLegacy: require('./speech-native-legacy'),
  fonts: require('./speech-fonts.json'),
  createImageEngine: require('./image'),
  initializeImage: require('./image-pxt'),
  animationResourceMenuItems: require('../../../util/bw-animation-resource-menu'),
  initializeRotation: require('./rotation-pxt'),
  initializeParticles: require('./particles-pxt'),
  initializeSevenseg: require('./sevenseg-pxt'),
  initializeSpriteExtensions: require('./sprite-extensions-pxt'),
  initializeScroller: require('./scroller-pxt'),
  initializeLegacyScroller: require('./legacy-scroller-pxt'),
  createLegacyScrollerHost: require('./legacy-scroller-host'),
  initializeCharacterAnimations: require('./character-animations-pxt'),
  initializeLegacyCharacterAnimations: require('./legacy-character-pxt'),
  createLegacyCharacterHost: require('./legacy-character-host'),
  initializeText: require('./text-pxt'),
  createMusic: require('./music'),
  buffers: require('./buffer'),
  bufferMemory: require('./buffer-memory'),
  initializeMusic: require('./music-pxt'),
  helpers: require('./helpers-pxt'),
  createCarnivalHost: require('./carnival-host'),
  initializeGameOver: require('./gameover-pxt'),
  initializeHud: require('./hud-pxt'),
  initializePrompt: require('./prompt-pxt'),
  palette: require('./palette'),
  framePhase: require('./frame-phase')
});
