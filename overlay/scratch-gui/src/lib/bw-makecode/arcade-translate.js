import {normalizeOwnedPromptOptions,literalLimitedTextPrompt} from './owned-prompt-options-source.js';
import {gameResetSourceSafe,markGameResets,gameResetIntrinsic} from './game-reset-source.js';
import {playerButtonConfiguredSourceSafe,markPlayerButtonRegistrations,playerButtonRegistration} from './player-button-registration-source.js';
import {playerConnectionConfiguredSourceSafe,markPlayerConnectionRegistrations,playerConnectionRegistration} from './player-connection-registration-source.js';
import {normalizeUnusedNamedCallbacks} from './unused-named-callbacks.js';
import {highScoreConfiguredSourceSafe,markHighScoreCalls,highScoreIntrinsic} from './high-score-source.js';
import {consoleLogValueConfiguredSourceSafe,lowerConsoleLogValues} from './lower-console-log-values.js';
import {bindScoreImageSource,scoreImageBindingView} from './score-owned-image-source.js';
import {numberPromptLengthSourceSafe,markNumberPromptLengths,literalNumberPromptLength,markDefaultTextPrompts,literalDefaultTextPrompt} from './number-prompt-length-source.js';
import {MUSIC_MELODIES} from './music-melodies.js';
import {lowerSourceValueOperatorHelpers} from './source-value-operator-helpers.js';
import {NUMBER_FORMAT_MEMBERS} from './ordinary-primitive-sdk-number-source.js';
import {setExternalRoots,externalPath,externalAssetNode,externalAssetText} from './external-references.js';
import {lowerNativeArrayBinaryHelpers} from './native-array-binary-domain.js';
import {lowerRuntimeDispatchAddHelpers} from './native-array-binary-helper-source.js';
import {capturePreparedSharedImageSources,parseSharedImageSourceBoundary,parseSharedImageSourceProgram,bindPreparedSharedImageSource,sharedImageSourceContextCurrent} from './shared-image-array-source-effects.js';
import {prepareSharedImageArrayTransport,projectSharedImageArrayTransport,finishSharedImageArrayTransport,currentSharedImageArrayTransport,reproveSharedImageArrayTransport} from './source-shared-image-array-transport.js';
import {prepareProcedureConstraintSourceForTranslation,procedureConstraintAstMetadata} from './procedure-constraint-source.js';
import {BUTTON_EVENTS,controllerButtonEventNumberLeaves} from './controller-button-event-number-source.js';
import {lowerAnyButtonRegistrations,anyButtonConfiguredSourceSafe} from './any-button-registration-source.js';
import {legacyNoteMelodySourceSafe,markLegacyNoteMelodies,literalLegacyNoteMelody} from './legacy-note-melody-source.js';
import {CAMERA_PROPERTIES} from './camera-property-constants.js';
import {createProcedureOwnerEmission} from './procedure-owner-emission.js';
import {prepareThrowSource,prepareThrowEmission,reproveThrowEmission,hasThrowEmission} from './throw-source-gate.js';
import {proveArrayMapValues} from './lower-array-map-values.js';
import {selectNamedFunctionSourceProof} from './named-function-source-selection.js';
import {lowerNamedFunctionValues} from './lower-named-function-values.js';
import {selectClassCallableSourceProofForTranslation} from './class-callable-source-gate.js';
import {withCompilerOwnedClassResultFlowProof} from './class-callable-result-flow-proof.js';
import {numberLiteralCode,containsNonFiniteNumberLiteral} from './source-number-literal.js';
import {lowerMathIdivValues} from './math-idiv-source.js';
import {lowerConsoleInspectValues} from './lower-console-inspect-values.js';
import {lowerSdkFontValues} from './lower-sdk-font-values.js';
import {callableSourceGate} from './callable-source-gate.js';
import {lowerCallableValues} from './lower-callable-values.js';
import {validateClassCallablePlan} from './class-callable-plan.js';
import {sourceCallableDeclarations} from './source-callable-declarations.js';
import {callableDeclarationEnvelope,callableVariableEnvelope} from './callable-export-graph.js';
import {lowerNamedArrayItemHelpers} from './named-array-item-helpers.js';
import {GENERATED_HELPER_PROFILES,inspectGeneratedHelperBindings,normalizeCompilerOwnedLegacyArrayHelpers,mapGeneratedSourceArray} from './generated-helper-recognition.js';
import {lowerLiveFontMetrics} from './live-font-metrics.js';
import {staticSdkNamespaceReceivers} from './static-sdk-namespaces.js';
import {sourceReferenceDeclarations} from './source-reference-declarations.js';
import {sourceScalarDeclarations} from './source-scalar-declarations.js';
import {lowerObjectClasses} from './lower-object-classes.js';
import {foldPxtNumeric,pxtFoldedNumberCode} from './pxt-numeric-fold.js';
import {TEXT_SPRITE_INITIALIZER} from './text-source-admission.generated.js';
import {LEGACY_CHARACTER_NATIVE_IDENTITY} from './legacy-character-source-admission.generated.js';
const LEGACY_CHARACTER_REVISION=LEGACY_CHARACTER_NATIVE_IDENTITY.revision;
import {applyDeclaredValueType} from './declared-value-types.js';
// PXT effects.ParticleEffect instances; the screen ones are ScreenEffects.
const SCREEN_PARTICLE_EFFECTS = new Set(['confetti', 'hearts', 'smiles', 'blizzard', 'bubbles', 'starField', 'clouds', 'none']);
const PARTICLE_EFFECTS = new Set(['spray', 'trail', 'fountain', 'rings', 'fire', 'warmRadial', 'coolRadial', 'halo', 'ashes',
    'disintegrate', ...SCREEN_PARTICLE_EFFECTS]);
// PXT mixer music (pxt-common-packages mixer, MIT): named Melody instances,
// enum members and the Note frequencies of the pinned enum.
// PXT effects.ImageEffect instances, also background effects for game over.
const IMAGE_EFFECTS = new Set(['dissolve', 'melt', 'slash', 'splatter']);

// The seven segment extension's enums by member name (sevenseg.ts).
// The sprite extensions' calls and adjustable fields (darts.ts, corgio.ts).
// arcade-character-animations: Predicate bits and FacingDirection (= the facing predicates).
// Numeric enum values of the selected MIT Arcade Sprite/physics sources.
const SPRITE_FLAG_VALUES=Object.freeze({AutoDestroy:4,StayInScreen:8,DestroyOnWall:16,BounceOnWall:32,ShowPhysics:64,Invisible:128,RelativeToCamera:512,GhostThroughTiles:1024,GhostThroughWalls:2048,GhostThroughSprites:4096,Ghost:7168});
const PRIVATE_SPRITE_FLAG_VALUES=Object.freeze({...SPRITE_FLAG_VALUES,None:0,Destroyed:2,IsClipping:256,HitboxOverlaps:8192});
// Only source animation lowering issues this complete Array factory node. Its
// validated resource owns the frames; child literals are inference payload only.
const isAnimationResourceFactory = node => node?.type === 'Array' &&
    typeof node.bwAnimationResourceId === 'string' && node.bwAnimationResourceId.length > 0;
const CHARACTER_PREDICATES = Object.freeze({NotMoving: 1, Moving: 2, FacingUp: 4, FacingRight: 8, FacingDown: 16, FacingLeft: 32,
    MovingUp: 64, MovingRight: 128, MovingDown: 256, MovingLeft: 512, HittingWallUp: 1024, HittingWallRight: 2048,
    HittingWallDown: 4096, HittingWallLeft: 8192});
const CHARACTER_FACINGS = Object.freeze({Up: 4, Right: 8, Down: 16, Left: 32});
const DART_SWITCHES = ['setTrace', 'controlWithArrowKeys'], DART_ACTIONS = ['throwDart', 'stopDart'];
const TEXT_SPRITE_PROPERTIES = ['text','bg','fg','maxFontHeight','borderWidth','borderColor','padding','outlineWidth','outlineColor','icon'];
const DART_PROPERTIES = ['angle', 'pow', 'iter', 'traceColor', 'gravity', 'wind', 'angleRate', 'powerRate'];
const CORGI_MODES = ['horizontalMovement', 'verticalMovement', 'updateSprite', 'cameraFollow'];
const CORGI_PROPERTIES = ['maxMoveVelocity', 'gravity', 'jumpVelocity', 'maxJump', 'decelerationRate'];
const SEVENSEG_ENUMS = {
    SegmentStyle: ['Blank', 'Thin', 'Narrow', 'Medium', 'Thick'],
    SegmentScale: ['Full', 'Half'],
    DigitRadix: ['Decimal', 'Hex', 'Octal', 'Alpha'],
    SegmentCharacter: ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
        'A', 'B', 'C', 'D', 'E', 'F', 'H', 'J', 'L', 'o', 'P', 'r', 'U', 'Y', 'Hyphen', 'Degree']
};
const MUSIC_ENUMS = {
    'music.PlaybackMode': ['UntilDone', 'InBackground', 'LoopingInBackground'],
    SoundExpressionPlayMode: ['UntilDone', 'InBackground'],
    WaveShape: ['Sine', 'Sawtooth', 'Triangle', 'Square', 'Noise'],
    SoundExpressionEffect: ['None', 'Vibrato', 'Tremolo', 'Warble'],
    InterpolationCurve: ['Linear', 'Curve', 'Logarithmic'],
    Sounds: ['PowerUp', 'PowerDown', 'JumpUp', 'JumpDown', 'BaDing', 'Wawawawaa', 'MagicWand', 'Siren'],
    BeatFraction: ['Whole', 'Half', 'Quarter', 'Eighth', 'Sixteenth', 'Double', 'Breve', 'Triplet']
};
const NOTE_FREQUENCIES = {C: 262, CSharp: 277, D: 294, Eb: 311, E: 330, F: 349, FSharp: 370, G: 392, GSharp: 415, A: 440, Bb: 466, B: 494,
    C3: 131, CSharp3: 139, D3: 147, Eb3: 156, E3: 165, F3: 175, FSharp3: 185, G3: 196, GSharp3: 208, A3: 220, Bb3: 233, B3: 247,
    C4: 262, CSharp4: 277, D4: 294, Eb4: 311, E4: 330, F4: 349, FSharp4: 370, G4: 392, GSharp4: 415, A4: 440, Bb4: 466, B4: 494,
    C5: 523, CSharp5: 555, D5: 587, Eb5: 622, E5: 659, F5: 698, FSharp5: 740, G5: 784, GSharp5: 831, A5: 880, Bb5: 932, B5: 988};
/**
 * MakeCode Arcade → a Scratch project.
 *
 * WHY THIS IS A TRANSLATION AND NOT AN EMULATION
 * ---------------------------------------------
 * An Arcade game targets a 160x120 screen driven by a Cortex-M4; we
 * cannot run its binary. But its MODEL is unusually close to Scratch's:
 * a sprite is an image with a position and a velocity, collisions are
 * "these two overlap", the score is a number on screen, and the game
 * ends when something says so. Those all have Scratch spellings. So the
 * import is a translation between two sprite models, and what does not
 * survive it is named rather than faked.
 *
 * Native routes preserve supported typed sprites, Images, arrays, animation
 * objects and tile data as editable blocks, with matching Arcade VM APIs and
 * PXT export. Older fixed-target routes remain for their supported subsets.
 * Directional wall contacts and tested tile collision movement are implemented.
 * Terrain events, scrolling cameras, full physics parity, some effects/music
 * and external packages remain named diagnostics. Consult the conversion
 * capability inventory and regression reports for the exact tested subsets.
 *
 * COORDINATES. Arcade is 160x120 with the origin top-left and y growing
 * downwards. The Scratch stage is 480x360 centred with y growing up. So
 * every position is `(x - 80) * 3` and `(60 - y) * 3`, and a downward
 * velocity becomes a negative one. That transform is applied at the
 * points where a coordinate is USED, never to a bare number, so
 * arithmetic in between stays in Arcade's units and reads like the
 * original.
 *
 * @module
 */

import {parseTileAssets} from './tile-assets.js';
import {createAssetKindLookup, lookupAssetTemplate} from './asset-kind-lookup.js';
import {decodeTilemap, createNativeTilemapRegistry, resolveNativeTilemap} from './tilemap-values.js';
import {prepareAnimationImport} from '../bw-animation-import.js';
import {ValueTypeGraph} from './value-type-graph.js';
import {lowerSourceLoopControl} from './lower-source-loop-control.js';
import {lowerLazyValues} from './lower-lazy-values.js';
import {arrayCopyCall} from './array-copy-calls.js';
import {indexedStringValue} from './indexed-string-values.js';
import {closedStringCompare} from './closed-string-compare.js';
import {closedCreatedImageDimensions,createdImageDimensionSourceSafe,markCreatedImageDimensions} from './closed-created-image-dimensions.js';
import {withClosedSpriteNullFilters,lowerClosedSpriteNullFilters,currentClosedSpriteNullFilter,bindClosedSpriteNullFilterConsumer,emitClosedSpriteNullFilter} from './closed-sprite-null-filter.js';
import {withLiteralRenderableSource,bindLiteralRenderableConsumer,literalRenderablePacket} from './literal-renderable-source.js';
import {lowerPxtStagedValues} from './lower-pxt-staged-values.js';
import {lowerNamespaceBindings} from './namespace-bindings.js';
import {ARCADE_SCENE_CONSTANTS} from './arcade-scene-constants.js';
import {lowerStaticCallbackHelpers} from './static-callback-helpers.js';
import {arcadeProjectSource} from './project-source.js';
import {parseMakeCodeTs} from './ts-import.js';
import {animationAssetArray} from './animation-asset-array.js';
import {BaseTranslator, bodyOf, num, tsText} from './translate-base.js';
import {analyseSourceValueProducers} from './source-value-producers.js';
import {prepareOrdinaryCallOmissions} from './ordinary-call-omission.js';
import {
    parseImageLiteral,
    parseJres,
    parseTilemaps,
    renderTilemap,
    decodeMkcdImage,
    imageToSvg,
    ARCADE_PALETTE
} from './arcade-assets.js';
import {svgToPixels} from './pixel-image.js';
import {parseAnimationJres} from './arcade-animation-assets.js';
import {parseSongJres} from './song-jres.js';
import {prepareRootFixedImages} from './root-fixed-jres-images.js';
import {BUILTIN_IMAGES} from './arcade-builtin-images.js';
import {ANIMATION_COMPANION_PATH, recoverAnimationCompanion} from './animation-companion.js';
import {HELPERS} from './arcade-runtime.js';
/** `sprites.castle`, `sprites.dungeon`, … : the namespaces PXT's built-in art lives in. */
const BUILTIN_IMAGE_GROUPS = new Set(Object.keys(BUILTIN_IMAGES).map(key => key.slice(0, key.lastIndexOf('.'))));

// MakeCode's true and false in a value position (see expr's Boolean case).
const ARCADE_TRUE = '(compare value (0) op "<" with (1))';
const ARCADE_FALSE = '(compare value (1) op "<" with (0))';
const DELEGATE = Symbol('base statement');
// NumberFormat ordinal order from retained pxt-core13.2.1 BufferMethods.
const BUFFER_FORMATS=NUMBER_FORMAT_MEMBERS;
// MakeCode text as a dialect string literal, exactly. The dialect decodes
// only \n \t \r \\ and \" inside quotes (it keeps \f, \b and \uXXXX as
// literal text) and reads any other character as itself, so those five are
// escaped and every other character is written raw. (The base translator's
// literal turns a newline into a space, a micro:bit display convention.)
const ESCAPES = {'"': '\\"', '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\t': '\\t'};
const arcadeTextLiteral = text => `"${String(text).replace(/["\\\n\r\t]/g, c => ESCAPES[c])}"`;
// A Scratch predicate the base translator writes (`key a pressed?`,
// `touching x?`): a condition, never a value (quoted text is not one).
const isScratchPredicate = text => typeof text === 'string' && !/^["(]/.test(text.trim()) && /\?$/.test(text.trim());
// A TypeScript expression whose value is a truth value, written by the base
// translator in the CONDITION grammar (`not (…)`, `a < b`, `(…) and (…)`).
const isTruthNode = node => !!node && (
    (node.type === 'Binary' && ['==', '===', '!=', '!==', '<', '>', '<=', '>=', '&&', '||'].includes(node.op)) ||
    (node.type === 'Unary' && node.op === '!'));
// What expr() hands back for a call that is a CONDITION in the dialect: a
// Scratch predicate (`key left arrow pressed?`, `touching ball`), or the
// comparison `info.playerN.hasLife()` is. Never a Boolean reporter WORD
// (`arcade a overlaps b`): those are values (docs/BOOLEAN-IN-VALUE-POSITION.md).
const isConditionCall = (node, text) => node?.type === 'Call' && typeof text === 'string' &&
    (isScratchPredicate(text) || /^touching /.test(text) || /^\S+ > 0$/.test(text));

/** Arcade pixels → stage units. 160x120 scaled by 3 is 480x360 exactly. */
const SCALE = 3;
const HALF_WIDTH = 80;
const HALF_HEIGHT = 60;

// Pinned game/sprite.ts: obstacle slots are left, top, right, bottom.
const COLLISION_DIRECTIONS = Object.freeze({Left:0, Top:1, Right:2, Bottom:3});
// Retained Arcade game/sprite.ts TileDirection; Center also covers default.
const TILE_DIRECTIONS = Object.freeze({...COLLISION_DIRECTIONS, Center:4});



/**
 * Velocity divisor: Arcade's vx is pixels per second and a Scratch
 * forever loop runs about 30 times a second, so one iteration should
 * move vx/30 Arcade pixels — which is vx*3/30 stage units.
 */
const VELOCITY_DIVISOR = 10;

/**
 * How many backdrops to carry over. A level renders to a few hundred
 * kilobytes of SVG; a platformer with eight of them would hand the paint
 * editor several megabytes of rectangles. The ones past the cap are
 * named in the unsupported list rather than dropped in silence.
 */
const MAX_BACKDROPS = 4;

/**
 * How many animation frames to carry onto one sprite. A platformer with
 * eleven animations of eight frames would hand the paint editor ninety
 * costumes; the ones past the cap are named in the unsupported list.
 */
const MAX_ANIMATION_FRAMES = 24;

/**
 * Which variables a player's score and lives live in.
 *
 * MakeCode's plain `info.setScore()` IS player one, so player one shares
 * the variables that API already uses and only players two to four get a
 * suffix. A game that mixes both — and the pong here does — then reads
 * and writes one set of variables rather than two that drift apart.
 */
/**
 * Properties that only make sense on a sprite. A read of one of these on
 * something we cannot resolve is reported rather than turned into a
 * variable of that name — see the note in expr().
 */
const LEGACY_SCROLLER_REVISION='43651f88b917a98ad886fdd4c1c2ad8001ce9b9c';
const SPRITE_PROPERTIES = new Set([
    'x', 'y', 'vx', 'vy', 'ax', 'ay', 'fx', 'fy', 'sx', 'sy', 'scale',
    'width', 'height', 'left', 'right', 'top', 'bottom',
    'image', 'kind', 'lifespan', 'z', 'rotation', 'rotationDegrees', 'data'
]);

const playerVar = (base, player) => (player > 1 ? `${base}${player}` : base);

/** `info.player3` → 3; `info` → 1. */
const playerOf = path => {
    const match = /^info\.player(\d)\b/.exec(path || '');
    return match ? Number(match[1]) : 1;
};

/** MakeCode's controller buttons → the Scratch key names. */
const CONTROLLER_KEYS = {
    up: 'up arrow', down: 'down arrow', left: 'left arrow', right: 'right arrow',
    A: 'space', B: 'z', menu: 'm'
};

class ArcadeTranslator extends BaseTranslator {
    sourceLoopHeader (condition) {return `arcade repeat while ${condition}:`;}
    constructor (assets, tilemaps, assetKindLookup = null, scrollerVersion = 'v0.1.2', characterVersion = 'v0.1.0') {
        super();
        // The legacy Arcade exporter gives global score/lives HUD meaning.
        // Ordinary source bindings retain independent storage under safe names.
        this.reservedVariableNames=new Set(['score','lives']);
        this.assets = assets || {};      // jres images by name
        this.assetKindLookup = assetKindLookup;
        this.scrollerVersion = scrollerVersion;
        this.characterVersion = characterVersion;
        this.tilemaps = tilemaps || {};  // level name → grid of tile indexes
        this.sprites = [];               // {name, image, kind, velocity}
        this.self = null;                // the sprite the current script is on
        this.aliases = new Map();        // handler parameter → sprite name
        this.pendingClone = null;        // a sprite spawned in this block
        this.handleTemplates = null;     // enabled for creation-event projects
        this.referenceArrayProgram = false; // value ownership does not require sprite artwork
        this.projectileTemplates = new Map(); // projectile calls inside functions
        this.handleAliases = new Map();  // callback parameter -> event handle
        this.handleVars = new Set();      // MakeCode variables holding handles
        this.localHandleVars = new Set(); // function locals holding sprite handles
        this.parameterHandleVars = new Set(); // procedure arguments holding sprite handles
        this.destroyedInstanceHandlers = new Map();
        this.createdRegistrations = new Map();
        this.terrainRegistrations = new Map();
        this.capturedBindings = new Map();
        this.localVars = null;
        this.stringVars = new Set();
        this.imageValueResources = new Map();
        this.handleImageArrays = null;   // image array name -> costume range
    }

    /**
     * Arcade spawns a new sprite mid-game with `enemy = sprites.create(…)`
     * and then positions it. Scratch's equivalent is a clone — and a
     * clone inherits the parent's state at the moment it is made, so the
     * `create clone of` goes AFTER the setup, at the end of the block
     * that spawned it. That reordering is the whole reason this override
     * exists; without it every clone would appear where the last one did.
     */
    block (body, indent, out) {
        const outer = this.pendingClone;
        this.pendingClone = null;
        super.block(body, indent, out);
        if (this.pendingClone) {
            out.push(`${'  '.repeat(indent)}create clone of ${this.pendingClone}`);
            this.pendingClone = null;
        }
        this.pendingClone = outer;
    }

    get nativeValues () {return !!this.handleTemplates || this.referenceArrayProgram || this.fontValueProgram || this.throwValueProgram;}

    sprite (name) {
        return this.sprites.find(s => s.name === name) || null;
    }

    /** The sprite a name refers to, following handler parameter aliases. */
    resolveSprite (node) {
        if (!node) return null;
        if (node.type !== 'Identifier') return null;
        const alias = this.aliases.get(node.name);
        return this.sprite(alias || node.name);
    }

    handleRef (node) {
        if (node?.type === 'Index' && this.spriteReferences?.has(node)) return this.expr(node);
        if (node?.type === 'Call' && this.handleTemplates && this.spriteReferences?.has(node)) return this.expr(node);
        if (node?.type !== 'Identifier') return null;
        if (this.handleTemplates && node.temporary && this.spriteReferences?.has(node)) return this.expr(node);
        if (this.localVars?.has(node.name)) {
            return this.localHandleVars.has(node.name) || (this.handleTemplates && this.spriteReferences?.has(node)) ? `arcade local ${this.currentParameters?.has(node.name)?this.varName(node.name):node.name}` : null;
        }
        if (this.capturedBindings.has(node.name) && this.spriteReferences?.has(node)) return `arcade captured ${this.capturedBindings.get(node.name)}`;
        return this.handleAliases.get(node.name) ||
            (this.parameterHandleVars.has(node.name) ? this.varName(node.name) : null) ||
            (this.handleVars.has(node.name) ? this.varName(node.name) :
                this.handleTemplates && this.spriteReferences?.has(node) ? this.expr(node) : null);
    }

    claimNames(node, seen = new Set()) {
        super.claimNames(node, seen);
        if (node?.type !== 'Program') return;
        // Parameters are strings rather than Identifier nodes, so the base name
        // walk cannot reserve them. Generated local cells share their native map.
        const parameterNodes=new WeakSet();
        const reserveNativeParameters=value=>{
            if(!value||typeof value!=='object'||parameterNodes.has(value))return;
            parameterNodes.add(value);
            if(Array.isArray(value)){value.forEach(reserveNativeParameters);return;}
            for(const name of value.params || [])if(typeof name==='string'){this.taken.add(name);this.taken.add(this.varName(name));}
            for(const binding of value.bwCallableLexicalPlan?.bindings || []){this.taken.add(binding.nativeName);this.taken.add(binding.sourceName);}
            Object.values(value).forEach(reserveNativeParameters);
        };
        reserveNativeParameters(node);
        this.boundSourceGlobals=new Set(node.body.filter(st=>st.type==='Declaration').flatMap(st=>st.decls.map(decl=>decl.name)));
        this.sourceScalarTypes=new Map(sourceScalarDeclarations(node).map(({name,type})=>[name,type]));
        this.sourceReferenceTypes=new Map((node.sourceReferenceDeclarations || sourceReferenceDeclarations(node)).map(({name,type})=>[name,type]));
        this.sourceFunctions=new Map(node.body.filter(fn=>fn.type==='FunctionDeclaration').map(fn=>[fn.name,fn]));
        const references = inferImageReferences(node, value => this.path(value), value => this.imageOf(value), value => !!this.assetKindLookup && value?.type === 'Template' && ['assets.image', 'assets.tile'].includes(value.tag));
        bindClosedSpriteNullFilterConsumer(this,node);
        bindLiteralRenderableConsumer(this,node);
        this.objectReferences = references.objects;this.fontReferences=references.fonts;
        this.bufferReferences = references.buffers;this.imageReferences = references.images;this.spriteReferences = references.sprites;this.dataReferences = references.data;
        this.exactStringReferences=references.exactStrings;this.textSpriteReferences=references.textSprites;this.playerReferences=references.players;this.sceneReferences=references.scenes;this.physicsEngineReferences=references.physicsEngines;this.tileReferences = references.tiles;this.tilemapDataReferences = references.tilemapData;this.sceneTilemapReferences = references.sceneTilemaps;this.legacyTileReferences=references.legacyTiles;this.animationReferences = references.animations;this.sevensegDigitReferences=references.sevensegDigits;this.sevensegCounterReferences=references.sevensegCounters;this.dartReferences=references.darts;this.corgiReferences=references.corgis;this.nullReferences=references.nulls;this.arrayReferences = references.arrays;this.numberReferences=references.numbers;this.stringReferences=references.strings;this.booleanReferences=references.booleans;
        this.referenceArrayProgram=containsAst(node,value=>value.type==='Array' || references.arrays.has(value));
        this.fontValueProgram=containsAst(node,value=>!!value.bwFontIntrinsic);
        this.throwValueProgram=hasThrowEmission(node);this.throwSourceProgram=node;
        this.procedureConstraintSource=node.bwProcedureConstraintSource || null;
        this.provenArrayReferences=references.provenArrays;
        this.sourceArrayArithmeticOperands=references.sourceArrayArithmeticOperands;
        // This separate all-writer proof is consumed only by bitwise words.
        // A real no-initializer scalar starts Undefined; inferImageReferences'
        // conservative annotation graph intentionally remains unchanged.
        this.sourceBitwiseOperands=new WeakSet();this.primitiveBitwiseOperands=new WeakSet();this.objectBitwiseOperands=new WeakSet();this.possibleBitwiseArrays=new WeakSet();
        // Compound emitters construct a Binary expression later, but its two
        // operands are these original Assignment nodes. Index their actual
        // identities now; a synthetic expression is never a proof producer.
        const bitwiseOperands=value=>value?.type==='Binary'&&['&','|','^','<<','>>','>>>'].includes(value.op)?[value.left,value.right]:
            value?.type==='Unary'&&value.op==='~'?[value.argument]:
            value?.type==='Assignment'&&['&=','|=','^=','<<=','>>=','>>>='].includes(value.op)?[value.left,value.right]:null;
        const bitwise=value=>bitwiseOperands(value)!==null;
        if(containsAst(node,bitwise)){
            const createdDimensions=closedCreatedImageDimensions(node);
            const facts=analyseSourceValueProducers(node,{arrayValues:true,parenthesized:true,unboundIsOpaque:true,
                declaredLocalUndefined:true,ordinaryPrimitiveSdkNumbers:true,sceneClockNumbers:true});
            const primitive=new Set(['Number','String','Boolean','Null','Undefined']);
            containsAst(node,value=>{
                if(bitwise(value))for(const operand of bitwiseOperands(value)){
                    const types=facts.typesAt(operand),array=type=>type?.kind==='Array';
                    if([...types].some(array)||references.arrays.has(operand))this.possibleBitwiseArrays.add(operand);
                    if(types.size&&[...types].every(type=>primitive.has(type)||array(type)))this.sourceBitwiseOperands.add(operand);
                    if(operand.bwClosedCreatedImageDimension===true&&createdDimensions.has(operand)||references.primitives.has(operand)||types.size&&[...types].every(type=>primitive.has(type)))this.primitiveBitwiseOperands.add(operand);
                    if([...types].some(type=>typeof type==='string'&&!primitive.has(type)&&type!=='Opaque'))this.objectBitwiseOperands.add(operand);
                }
                return false;
            });
        }
        this.inferredSpriteParameters = references.parameters;
        this.primitiveReferences=references.primitives;
        this.sourceTypeOfOperands=references.sourceTypeOfOperands;
        this.strictStringReferences=references.strictStrings;
        this.spriteResultFunctions = references.spriteFunctions;
        this.spriteResultBindings = new Set();
        const bindings = [];
        const collectBindings = value => {
            if (!value || typeof value !== 'object') return;
            if (value.type === 'Declaration') for (const decl of value.decls) bindings.push([decl.name,decl.init]);
            if (value.type === 'Assignment' && value.op === '=' && value.left?.type === 'Identifier') bindings.push([value.left.name,value.right]);
            for (const child of Object.values(value)) {
                if (Array.isArray(child)) child.forEach(collectBindings);
                else if (child && typeof child === 'object') collectBindings(child);
            }
        };
        collectBindings(node);
        let added;
        do {
            added = false;
            for (const [name,value] of bindings) if (!this.spriteResultBindings.has(name) &&
                (value?.type === 'Call' && value.callee?.type === 'Identifier' && references.spriteFunctions.has(value.callee.name) ||
                    value?.type === 'Identifier' && this.spriteResultBindings.has(value.name))) {
                this.spriteResultBindings.add(name);added = true;
            }
        } while (added);
        this.kindRuntimeProgram=containsAst(node,value=>value.type==='SpriteKindReset' || value.type==='Member' && this.path(value.object)==='SpriteKind' || value.type==='Call' && (this.path(value.callee)==='SpriteKind.create' || value.callee?.type==='Member' && ['kind','setKind'].includes(value.callee.name)));
        this.sceneStackProgram=this.kindRuntimeProgram || containsAst(node,value=>!!playerButtonRegistration(value) || !!playerConnectionRegistration(value) || value.type==='Call' && /^(?:mp\.(?:onControllerEvent|onButtonEvent|getPlayerState|setPlayerState|changePlayerStateBy)|game\.(?:pushScene|popScene|addScenePushHandler|addScenePopHandler|removeScenePushHandler|removeScenePopHandler))$/.test(this.path(value.callee)||''));
        this.nativeInfoProgram=this.sceneStackProgram || containsAst(node,value=>value.type==='Call' && isInfoRegistration(this.path(value.callee)));
        this.scoreRegistrationProof=scoreRegistrationProof(node);
        const registrations=discoverRuntimeRegistrations(node,this);
        this.createdRegistrations=new Map([...registrations].filter(([,record])=>record.kind==='creation'));
        this.terrainRegistrations=new Map([...registrations].filter(([,record])=>['wall','tile','legacyWall','tilemapEvent'].includes(record.kind)));
        this.sceneRegistrations=new Map([...registrations].filter(([,record])=>!['creation','wall','tile','legacyWall','tilemapEvent'].includes(record.kind)));
        this.returnFunctions = new Map();
        this.classCallableFactoryFunctions=new Set(node.bwCallableLexicalPlan?.version===2?node.bwCallableLexicalPlan.owners.filter(owner=>owner.kind==='declaration').map(owner=>owner.sourceName):[]);
        const hasReturn = value => value && typeof value === 'object' &&
            (value.type === 'Return' || (!['FunctionDeclaration', 'FunctionExpression'].includes(value.type) &&
                Object.values(value).some(child=>Array.isArray(child)?child.some(hasReturn):hasReturn(child))));
        const hasBareReturn = value => value && typeof value === 'object' &&
            (value.type === 'Return' ? !value.value : !['FunctionDeclaration','FunctionExpression'].includes(value.type) &&
                Object.values(value).some(child=>Array.isArray(child)?child.some(hasBareReturn):hasBareReturn(child)));
        const returnsOnAllPaths = body => (body || []).some(st=>st.type==='Return' ||
            st.type==='Block' && returnsOnAllPaths(st.body) ||
            st.type==='If' && returnsOnAllPaths(st.consequent) && returnsOnAllPaths(st.alternate));
        for (const fn of node.body) if (fn.type === 'FunctionDeclaration' && fn.body.some(hasReturn)) {
            this.returnFunctions.set(fn.name,{...fn,unsupportedUndefined:fn.body.some(hasBareReturn) || !returnsOnAllPaths(fn.body)});
        }

    }

    imageRef(node, allowValueCall = true, namedCalls = true) {
        if(node?.type==='Index' && this.planImageValue)this.planImageValue(node);
        if (node?.type === 'Template' && this.assetKindLookup &&
            lookupAssetTemplate(this.assetKindLookup,node.tag,node.value) === null) return 'null value';
        if (node?.type === 'Template' && /^assets\.(?:image|tile)$/.test(node.tag || '') && !this.imageOf(node)) {
            const text = externalAssetText(node.tag, node.value);
            if (text) return `(arcade external image ${JSON.stringify(text)})`;
        }
        const background = this.imageValueResources.get(node);
        if (background) {
            const resource = `arcade frame image array "${background.key}" index (${background.value ? this.expr(background.value) : 0}) template "${background.name}" start 0 count ${background.count || 1}`;
            return background.fresh ? `arcade copy image (${resource})` : resource;
        }
        if (node?.type === 'Call' && this.path(node.callee) === 'scene.backgroundImage' && !node.args?.length) return 'arcade background image';
        // A call on a name whose source is not in the project, where an Image is expected: kept by name with real argument blocks.
        if (allowValueCall && namedCalls && node?.type === 'Call' && node.callee?.type === 'Member' && !(node.args || []).some(arg => arg?.type === 'FunctionExpression')) {
            const external = this.externalName(node.callee);
            if (external) return `(arcade external image call ${JSON.stringify(external)} arguments (${this.externalArguments(node.args || [])}))`;
        }
        if (node?.type === 'Member') {const external = this.externalName(node);if (external && (!node.bwExternalAsset || /^assets\.(?:image|tile)`/.test(external))) return `(arcade external image ${JSON.stringify(external)})`;}
        // PXT's global screen image, unless the program binds its own \`screen\`.
        if (node?.type === 'Identifier' && node.name === 'screen' && !(this.boundSourceGlobals?.has('screen') || this.sourceFunctions?.has('screen') ||
            this.localVars?.has('screen') || this.currentParameters?.has('screen') || this.capturedBindings?.has('screen'))) return 'arcade screen image';
        if (node?.type === 'Call' && this.path(node.callee) === 'image.create' && node.args?.length === 2) {
            return `arcade new image width (${this.expr(node.args[0])}) height (${this.expr(node.args[1])})`;
        }
        if (node?.type === 'Call' && node.callee?.type === 'Member' && node.callee.name === 'clone' && !node.args?.length) {
            const image = this.imageRef(node.callee.object);
            if (image) return `arcade copy image (${image})`;
        }
        if (node?.type === 'Member' && node.name === 'image') {
            if (this.handleTemplates && this.animationReferences?.has(node.object)) return this.expr(node);
            const handle = this.handleRef(node.object);
            if (handle) return `arcade image of ${handle}`;
        }
        if (node?.type === 'Index' && this.imageReferences?.has(node)) {
            if(this.canonicalFrameArrays?.has(node.object?.name))return null;
            return this.expr(node);
        }
        if (allowValueCall && node?.type === 'Call' && this.imageReferences?.has(node)) return this.expr(node);
        return node?.type === 'Identifier' && this.imageReferences?.has(node) ? this.expr(node) : null;
    }

    /** An x coordinate in Arcade units, as a stage-unit expression. */
    stageX (node) {
        if (node && node.type === 'Number') return num((Number(node.value) - HALF_WIDTH) * SCALE);
        return `(${this.side(node, '-', false)} - ${HALF_WIDTH}) * ${SCALE}`;
    }

    stageY (node) {
        if (node && node.type === 'Number') return num((HALF_HEIGHT - Number(node.value)) * SCALE);
        return `(${HALF_HEIGHT} - ${this.side(node, '-', true)}) * ${SCALE}`;
    }

    /**
     * A length (not a position): scaled, but not shifted or mirrored.
     * Parenthesised, because `0 - 10 * -3` is a precedence accident
     * waiting to happen and a literal `* -3` is not a spelling to rely on.
     */
    stageLength (node, {negate = false} = {}) {
        const literal = node && node.type === 'Number' ? Number(node.value) :
            (node && node.type === 'Unary' && node.op === '-' && node.argument.type === 'Number' ?
                -Number(node.argument.value) : null);
        if (literal !== null) return num(literal * (negate ? -SCALE : SCALE));
        const scaled = `(${this.expr(node)}) * ${SCALE}`;
        return negate ? `0 - ${scaled}` : scaled;
    }

    /**
     * The SVG for whatever art an argument names.
     *
     * Two shapes, and the template's TAG tells them apart: `img\`…\``
     * carries the pixels itself, `assets.image\`Jojojo\`` names an entry
     * in the project's .g.jres gallery.
     */
    artOf (node) {
        const image = this.imageOf(node);
        return image ? imageToSvg(image) : null;
    }

    /**
     * The decoded image behind an art argument, not its SVG.
     *
     * Kept separate because the SIZE is worth knowing on its own: a game
     * asks a sprite for its `width` to do bounds arithmetic, and since we
     * decoded the picture to make the costume, that number is exact
     * rather than a guess.
     */
    imageOf (node) {
        if(node?.type === 'Template' && this.assetKindLookup) {
            const scoped=lookupAssetTemplate(this.assetKindLookup,node.tag,node.value);
            if(scoped !== undefined)return scoped;
        }
        const tileAsset = node?.type === 'Member' && (this.assets[this.path(node)] ||
            (['myTiles','assets','tiles'].includes(this.path(node.object)) && this.assets[node.name]));
        if(tileAsset)return tileAsset;
        if(node?.type === 'Identifier' && /^__bwNamespace_/.test(node.name) && Object.prototype.hasOwnProperty.call(this.assets,node.name))return this.assets[node.name];
        const builtIn = node?.type === 'Member' && BUILTIN_IMAGES[this.path(node)];
        if (builtIn) return decodeMkcdImage(builtIn);
        if (!node || node.type !== 'Template' || !(node.tag === 'img' || /^assets\./.test(node.tag || ''))) return null;
        if (node.tag && /^assets\./.test(node.tag)) {
            return this.assets[node.value.trim()] || null;
        }
        return parseImageLiteral(node.value);
    }

    /** Array values retain their ownership independently of sprite artwork. */
    isArrayReference (node) {
        if (!this.arrayReferences?.has(node)) return false;
        // The artwork fallback must not acquire a reference from an opaque
        // alternative merely because another branch produces an Array.
        return !!this.handleTemplates || !!this.provenArrayReferences?.has(node);
    }

    isBooleanValue (value) {
        return super.isBooleanValue(value) || /^(touching |key .* pressed\?|arcade .* overlaps |arcade images overlap )/.test(value);
    }

    mathOperand (node) {
        const value = this.expr(node);
        return /^[^\s()]+$/.test(value) ? value : `(${value})`;
    }

    single(node, out, pad) {
        if (node?.type === 'Identifier' && (this.currentParameters?.has(node.name) || this.localVars?.has(node.name))) return `(${this.expr(node)})`;
        return super.single(node, out, pad);
    }

    // An `&&`/`||` lowerLazyValues left in place (a switch label that would
    // need lines before it): the program needs the runtime value words.
    hasLazyCondition(node) {
        return node?.type==='Binary' && ['&&','||'].includes(node.op) ||
            node?.type==='Unary' && node.op==='!' && this.hasLazyCondition(node.argument);
    }
    /**
     * A statement, with its own lines-before (this.pre) also for the
     * statements written here rather than by the base translator: a truth
     * value in one of their value slots is chosen into a variable on the
     * lines before it (see truthAsValue), and those lines are THIS
     * statement's, not the enclosing one's.
     */
    statement(st, indent, out) {
        const before=this.unsupported.length;
        const outerPre=this.pre,mark=out.length;
        this.pre=[];
        let delegated=false;
        try {
            delegated=this.arcadeStatement(st,indent,out)===DELEGATE;
            if(this.pre.length)out.splice(mark,0,...this.pre.map(line=>`${'  '.repeat(indent)}${line}`));
        } finally {
            this.pre=outerPre;
        }
        if(delegated)super.statement(st,indent,out);
        const added=this.unsupported.slice(before);
        const missing=[...new Set(added)].filter(reason=>!out.slice(mark).some(line=>line.trim()===`# unsupported: ${reason}`));
        if(missing.length)out.splice(mark,0,...missing.map(reason=>`${'  '.repeat(indent)}# unsupported: ${reason}`));
        const kindBinding=st.type==='ExpressionStatement' && st.expr?.spriteKindName;
        if(kindBinding)out.push(`${'  '.repeat(indent)}arcade bind sprite kind name ${JSON.stringify(kindBinding)} to (${this.expr({type:'Identifier',name:st.expr.spriteKindBinding})})`);
    }
    arcadeStatement(st, indent, out) {
        if(st.type==='ThrowStatement'){
            if(!this.throwValueProgram||!hasThrowEmission(this.throwSourceProgram)){out.push(`${'  '.repeat(indent)}${this.note('Throw source requires qualified source context and canonical protocol')}`);return;}
            out.push(`${'  '.repeat(indent)}arcade throw (${this.arrayElementValue(st.argument)})`);return;
        }
        if(st.type==='ExpressionStatement' && st.expr?.bwNativeNamedArray && ['push','set','insert','remove'].includes(st.expr.bwNativeNamedArray.kind)) {
            this.usesArrays=true;
            const node=st.expr,{kind,registry}=node.bwNativeNamedArray,name=JSON.stringify(registry),args=node.args.slice(1).map(arg=>this.expr(arg));
            const line=kind==='push'?`push (${args[0]}) to array ${name}`:kind==='set'?`set item (${args[0]}) of array ${name} to (${args[1]})`:
                kind==='remove'?`remove item (${args[0]}) of array ${name}`:`insert (${args[1]}) at (${args[0]}) of array ${name}`;
            out.push(`${'  '.repeat(indent)}${line}`);return;
        }
        if (st.type === 'Declaration') {
            const declarations = st.decls.filter(declaration => declaration.init || (!this.sourceScalarTypes?.has(declaration.name) && !this.sourceReferenceTypes?.has(declaration.name)) ||
                this.localVars?.has(declaration.name) || this.currentParameters?.has(declaration.name));
            if (!declarations.length) return;
            if (declarations.length !== st.decls.length) st = {...st, decls: declarations};
        }

        if(st.type==='SpriteKindReset'){out.push(`${'  '.repeat(indent)}set ${this.varName(st.name)} to (undefined value)`);return;}
        if(st?.type==='ExpressionStatement' && this.bufferStatement(st.expr,indent,out))return;
        if(st?.type==='ExpressionStatement' && st.expr?.type==='Call' && this.path(st.expr.callee)==='controller._setUserEventsEnabled' && !this.bindsName('controller')){
            const pad='  '.repeat(indent);
            if(st.expr.args.length!==1)out.push(pad+this.note('controller._setUserEventsEnabled requires one Boolean argument'));
            else out.push(`${pad}arcade set user controller events enabled ${this.boolSlot(st.expr.args[0])}`);return;
        }
        const target=st?.type==='ExpressionStatement' && st.expr?.type==='Assignment' && st.expr.left;
        if(target?.type==='Member' && (this.physicsEngineReferences?.has(target.object) || this.sceneReferences?.has(target.object))) {
            const n=st.expr,pad='  '.repeat(indent);
            if(this.sceneReferences?.has(target.object) && target.name==='flags'){
                if(!this.primitiveReferences?.has(n.right)){out.push(pad+this.note('Scene.flags assignment requires a proven primitive value; opaque conversion is not implemented'));return;}
                const result=n.op==='='?this.expr(n.right):['+=','-=','*=','/=','%=','|=','&=','^=','<<=','>>=','>>>='].includes(n.op)?this.expr({type:'Binary',op:n.op.slice(0,-1),left:target,right:n.right}):null;
                if(result===null)out.push(pad+this.note(`Scene.flags assignment ${n.op} is not implemented`));
                else out.push(`${pad}arcade scene (${this.expr(target.object)}) set flags to (${result})`);return;
            }
            if(this.sceneReferences?.has(target.object) && target.name==='physicsEngine' && n.op==='=' && !['Null','Undefined'].includes(n.right?.type) && this.physicsEngineReferences?.has(n.right)) {
                out.push(`${pad}arcade set physics engine of scene (${this.expr(target.object)}) to (${this.expr(n.right)})`);return;
            }
            if(this.physicsEngineReferences?.has(target.object) && ['maxSpeed','minStep','maxStep'].includes(target.name) && n.op==='=') {
                out.push(`${pad}arcade set physics engine property ${target.name} of (${this.expr(target.object)}) to (${this.expr(n.right)})`);return;
            }
            const owner=this.physicsEngineReferences?.has(target.object)?'PhysicsEngine':'Scene';
            out.push(`${pad}${this.note(`Arcade ${owner}.${target.name} assignment ${n.op} is not supported`)}`);return;
        }
        if(this.nativeValues && st.type==='ExpressionStatement' && st.expr?.type==='Assignment' && st.expr.left?.temporary) {
            out.push(`${'  '.repeat(indent)}arcade set local ${st.expr.left.name} to (${this.arrayElementValue(st.expr.right)})`);return;
        }
        if (st.type==='Declaration' && this.nativeValues) {
            const pad='  '.repeat(indent);
            for(const d of st.decls){
                const gaps=this.unsupported.length;
                if(d.spriteKindLibrary)out.push(`${pad}arcade initialize sprite kind library ${JSON.stringify(d.spriteKindLibrary.library)} version ${JSON.stringify(d.spriteKindLibrary.version)}`);
                let value=d.spriteKindLibrary?`arcade sprite kind value ${JSON.stringify(d.spriteKindName)}`:d.init?this.arrayElementValue(d.init):d.spriteKindName || d.isArray?this.expr({type:'Undefined'}):'0';
                // An array we could not translate (already named as a gap) stands in as an
                // EMPTY array, so \`for (const t of unknownArrayFactory())\` runs no times
                // instead of failing at run time on "Array reference is null or expired".
                if(d.isArray && d.init && value==='0' && this.unsupported.length>gaps)value='new array reference from ("[]")';
                if(d.temporary || this.localVars?.has(d.name))out.push(`${pad}arcade set local ${d.name} to (${value})`);
                else out.push(`${pad}set ${this.varName(d.name)} to (${value})`);
                if(d.spriteKindName && d.init && !d.spriteKindLibrary)out.push(`${pad}arcade bind sprite kind name ${JSON.stringify(d.spriteKindName)} to (${this.expr({type:'Identifier',name:d.name})})`);
            }
            return;
        }
        if(st.type==='ExpressionStatement' && st.expr?.type==='Assignment' && st.expr.op==='=' && st.expr.left?.type==='Identifier' && this.isArrayReference(st.expr.left)) {
            const name=st.expr.left.name,value=this.expr(st.expr.right),pad='  '.repeat(indent);
            out.push((st.expr.left.temporary || this.localVars?.has(name))?`${pad}arcade set local ${name} to (${value})`:`${pad}set ${this.varName(name)} to ${value}`);return;
        }
        if(this.handleTemplates && st.type==='ExpressionStatement' && st.expr?.type==='Assignment' && st.expr.left?.type==='Member' && this.textSpriteReferences?.has(st.expr.left.object) && TEXT_SPRITE_PROPERTIES.includes(st.expr.left.name)) {
            const n=st.expr,l=n.left,value=n.op==='='?this.arrayElementValue(n.right):this.arrayElementValue({type:'Binary',op:n.op.slice(0,-1),left:l,right:n.right});
            out.push(`${'  '.repeat(indent)}arcade set text sprite (${this.expr(l.object)}) property ${l.name} to (${value})`);return;
        }
        if(this.handleTemplates && st.type==='ExpressionStatement' && st.expr?.type==='Assignment' && st.expr.left?.type==='Member' && this.spriteExtensionOf(st.expr.left.object) &&
            (this.spriteExtensionOf(st.expr.left.object)==='dart'?DART_PROPERTIES:CORGI_PROPERTIES).includes(st.expr.left.name)) {
            const n=st.expr,l=n.left,word=this.spriteExtensionOf(l.object)==='dart'?'dart':'corgi';
            const value=n.op==='='?this.expr(n.right):this.expr({type:'Binary',op:n.op.slice(0,-1),left:l,right:n.right});
            out.push(`${'  '.repeat(indent)}arcade set ${word} (${this.expr(l.object)}) property ${l.name} to (${value})`);return;
        }
        if(this.handleTemplates && st.type==='ExpressionStatement' && st.expr?.type==='Assignment' && st.expr.left?.type==='Member' && this.isSevensegDisplay(st.expr.left.object)) {
            const n=st.expr,l=n.left,counter=this.sevensegCounterReferences?.has(l.object),pad='  '.repeat(indent);
            if(!(counter?['x','y','count']:['x','y','value']).includes(l.name)){out.push(`${pad}${this.note(`${counter?'DigitCounter':'SevenSegDigit'}.${l.name} cannot be assigned`)}`);return;}
            const value=n.op==='='?this.expr(n.right):this.expr({type:'Binary',op:n.op.slice(0,-1),left:l,right:n.right});
            out.push(`${pad}arcade set seven segment (${this.expr(l.object)}) property ${l.name} to (${value})`);return;
        }
        if(this.handleTemplates && st.type==='ExpressionStatement' && st.expr?.type==='Assignment' && st.expr.left?.type==='Member' && this.animationReferences?.has(st.expr.left.object)) {
            const n=st.expr,l=n.left;
            if(l.name==='interval' && n.op==='=')out.push(`${'  '.repeat(indent)}arcade set animation interval (${this.expr(l.object)}) to (${this.expr(n.right)})`);
            else out.push(`${'  '.repeat(indent)}${this.note(`animation.Animation.${l.name} assignment ${n.op} requires animation property mutation support`)}`);
            return;
        }
        if(st.type==='ExpressionStatement' && st.expr?.type==='Assignment' && st.expr.left?.type==='Member' && st.expr.left.name==='length' && this.isArrayReference(st.expr.left.object)) {
            const n=st.expr,l=n.left,value=n.op==='='?this.expr(n.right):`(${this.expr(l)}) ${n.op.slice(0,-1)} (${this.expr(n.right)})`;
            out.push(`${'  '.repeat(indent)}mutate array reference (${this.expr(l.object)}) op "length" index (0) value (${value})`);return;
        }
        if (st.type==='ExpressionStatement' && st.expr?.type==='Assignment' && st.expr.left?.type==='Index' && this.isArrayReference(st.expr.left.object)) {
            const n=st.expr,l=n.left;const value=n.op==='='?this.arrayElementValue(n.right):this.expr({type:'Binary',op:n.op.slice(0,-1),left:l,right:n.right});
            out.push(`${'  '.repeat(indent)}mutate array reference (${this.expr(l.object)}) op "set" index (${this.expr(l.index)}) value (${value})`);return;
        }
        if(st.type==='ExpressionStatement' && st.expr?.type==='Call' && st.expr.callee?.type==='Member' && this.isArrayReference(st.expr.callee.object)) {
            const n=st.expr,op=n.callee.name,a=n.args||[];
            if(['push','unshift','insertAt','set','removeAt','removeElement','pop','shift','reverse'].includes(op)) {
                const index=['insertAt','set','removeAt'].includes(op)?this.expr(a[0]):'0';
                const value=['insertAt','set'].includes(op)?this.arrayElementValue(a[1]):['push','unshift','removeElement'].includes(op)?this.arrayElementValue(a[0]):'0';
                out.push(`${'  '.repeat(indent)}mutate array reference (${this.expr(n.callee.object)}) op "${op}" index (${index}) value (${value})`);return;
            }
        }
        // A counter the body reads must start as a number value: the shared
        // loop writes \`set i to 0\`, a text "0" that \`x + i\` would join.
        if (this.nativeValues && st.type === 'For' && st.init?.type === 'Declaration' && st.init.decls.length === 1 &&
            JSON.stringify(st.body).includes(`"name":${JSON.stringify(st.init.decls[0].name)}`)) {
            this.declared?.add(st.init.decls[0].name);
            this.statement(st.init,indent,out);
            return this.statement({...st,init:null},indent,out);
        }
        if (st.type === 'Return') {out.push(`${'  '.repeat(indent)}arcade return value (${st.value ? this.arrayElementValue(st.value) : 'undefined value'})`);return;}
        return DELEGATE;
    }

    varName(name) {
        if(this.nativeValues && String(name).toLowerCase()==='score') {
            if(!this.renamed)this.renamed=new Map();
            if(!this.renamed.has(String(name))){let mapped='score_';while(this.taken?.has(mapped))mapped+='_';this.renamed.set(String(name),mapped);}
            return this.renamed.get(String(name));
        }
        return super.varName(name);
    }
    condition (node) {
        // The node being written as a condition is not a value: expr() on
        // it (the base condition() calls it) writes the condition grammar.
        const outer=this.conditionNode;
        this.conditionNode=node;
        try {
            return this.conditionInner(node);
        } finally {
            this.conditionNode=outer;
        }
    }
    conditionInner (node) {
        // MakeCode true/false. condition() results are also written into
        // value slots (assignments, arguments), where the dialect has no value
        // form for a comparison (it warns and keeps the text), so a word that
        // reports a real boolean carries it (E0).
        if(this.nativeValues && node?.type==='Boolean')return node.value?ARCADE_TRUE:ARCADE_FALSE;
        // \`!x\` AS A CONDITION is the dialect's \`not\`; E9's \`x === false\` value form is
        // for value slots only. Written through it, Lite's own export (\`while (!(!c))\`)
        // came back as nested value comparisons and lost every operator_not.
        if(this.nativeValues && node?.type==='Unary' && node.op==='!') {
            const inner=node.argument;
            if(inner?.type==='Unary' && inner.op==='!')return this.condition(inner.argument);
            return `not (${this.condition(inner)})`;
        }
        if(node?.type==='Index' && this.isArrayReference(node.object))
            return `truthiness of item (${this.expr(node.index)}) of array reference (${this.expr(node.object)})`;
        if(this.nativeValues && node && node.type!=='Boolean' &&
            !(node.type==='Binary' && ['==','!=','===','!==','<','>','<=','>=','&&','||'].includes(node.op)) &&
            !(node.type==='Unary' && node.op==='!')) {
            const value=this.expr(node);
            // A Scratch predicate (`key left arrow pressed?`) is already a
            // condition; in a value slot the dialect would keep it as text.
            if(isScratchPredicate(value))return value;
            this.usesArrays=true;return `truthiness of value (${node?.type==='Number' ? `(0 + (${value}))` : value})`;
        }
        // Text on the fixed-sprite path (E10): MakeCode's "" is false and every
        // other text ("0" too) true. The base's bare-value test, `not (s = 0)`,
        // is Scratch's comparison instead: "" = 0 is false (a blank side
        // compares as text) and "0" = 0 is true, so both came out inverted.
        // The length is the text's own truthiness. (A number stays `not (v = 0)`:
        // its Scratch value may be the literal text "0".)
        if(!this.nativeValues && node && (this.isText(node) || this.stringReferences?.has(node)))
            return `not ((length of ${this.operand(node)}) = 0)`;
        return super.condition(node);
    }

    /** A value word reporting JavaScript's truthiness of node (a real boolean). */
    truthValue (node) {
        if(node?.type==='Boolean')return node.value?ARCADE_TRUE:ARCADE_FALSE;
        if(node?.type==='Binary' && ['==','!=','===','!==','<','>','<=','>='].includes(node.op) ||
            node?.type==='Unary' && node.op==='!')return this.expr(node);
        return `truthiness of value (${this.arrayElementValue(node)})`;
    }

    arrayElementValue (node) {
        if(node?.bwPrimitiveNumberText)return `(${this.arrayElementValue(node.left)}) join ("")`;
        if(node?.type==='Boolean')return node.value?ARCADE_TRUE:ARCADE_FALSE;
        const value=this.expr(node);
        // The dialect has no value form for a Scratch predicate: in a value
        // slot it is kept as literal text, so say so instead.
        if(isScratchPredicate(value)){this.unsupported.push(`${value} as a value (a Scratch condition has no value form here)`);return ARCADE_FALSE;}
        // Scratch string shadows must not turn a numeric array element into text.
        return node?.type==='Number' || /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) ? `(0 + (${value}))` : value;
    }

    callExpression (node) {
        const objectValue=this.objectExpression(node);if(objectValue!==null)return objectValue;
        if(this.textSpriteStatement(node,node.args||[],line=>this.pre.push(line)))return 'undefined value';
        const importedBuffer=this.bufferExpression(node);
        if(importedBuffer!==null)return importedBuffer;
        const settingsValue=this.settingsExpression(node);
        if(settingsValue!==null)return settingsValue;
        const dataApi=this.path(node.callee),dataArgs=node.args||[];
        const dataRead=/^sprites\.readData(Number|String|Boolean|Sprite)$/.exec(dataApi||'');
        if(this.handleTemplates && dataRead && !this.bindsName('sprites')) {
            if(dataArgs.length===2)return dataRead[1]==='Boolean'?`arcade sprite (${this.expr(dataArgs[0])}) boolean data (${this.expr(dataArgs[1])})`:
                `arcade sprite (${this.expr(dataArgs[0])}) data (${this.expr(dataArgs[1])}) type ${dataRead[1]}`;
            this.unsupported.push(`${dataApi} requires a sprite and data key`);return 'undefined value';
        }
        const engineApi=this.path(node.callee),engineArgs=node.args||[];
        if(engineApi?.startsWith('mp.') && (this.boundSourceGlobals?.has('mp') || this.sourceFunctions?.has('mp') || this.localVars?.has('mp') || this.currentParameters?.has('mp') || this.capturedBindings.has('mp'))) {
            this.unsupported.push(`${engineApi} refers to a shadowed mp binding`);return 'undefined value';
        }
        if(engineApi==='MultiplayerState.create') {
            if(this.boundSourceGlobals?.has('MultiplayerState') || this.sourceFunctions?.has('MultiplayerState') || this.localVars?.has('MultiplayerState') || this.currentParameters?.has('MultiplayerState') || this.capturedBindings.has('MultiplayerState')){this.unsupported.push('MultiplayerState.create refers to a shadowed binding');return 'undefined value';}
            if(!engineArgs.length)return 'arcade create player state key';
            this.unsupported.push('MultiplayerState.create requires no arguments');return 'undefined value';
        }
        if(engineApi==='mp.getPlayerState' && engineArgs.length===2)return `arcade state (${this.expr(engineArgs[1])}) of player (${this.expr(engineArgs[0])})`;
        const mpSpecs={'mp.playerSelector':['arcade player by number',1], 'mp.getPlayerByNumber':['arcade player by number',1],
            'mp.getPlayerByIndex':['arcade player by index',1], 'mp.getPlayerSprite':['arcade sprite of player',1],
            'mp.getPlayerBySprite':['arcade player of sprite',1]};
        if(mpSpecs[engineApi]) {
            const [word,arity]=mpSpecs[engineApi];
            if(engineArgs.length===arity)return `${word} (${this.expr(engineArgs[0])})`;
            this.unsupported.push(`${engineApi} requires ${arity} argument`);return 'undefined value';
        }
        if(engineApi==='mp.allPlayers' && !engineArgs.length)return 'arcade all players';
        if(engineApi==='mp.isConnected' && engineArgs.length===1)return `arcade player (${this.expr(engineArgs[0])}) connected`;
        if(engineApi==='mp.isButtonPressed' && engineArgs.length===2)return `arcade player (${this.expr(engineArgs[0])}) button (${this.expr(engineArgs[1])}) pressed`;
        if(engineApi==='mp.getPlayerProperty' && engineArgs.length===2)return `arcade player safe property (${this.expr(engineArgs[1])}) of (${this.expr(engineArgs[0])})`;
        if(engineApi==='game.currentScene') {
            if(!engineArgs.length)return 'arcade current scene';
            this.unsupported.push('game.currentScene requires zero arguments');return 'undefined value';
        }
        if(engineApi==='ArcadePhysicsEngine') {
            if(this.boundSourceGlobals?.has('ArcadePhysicsEngine') || this.localVars?.has('ArcadePhysicsEngine') || this.currentParameters?.has('ArcadePhysicsEngine') || this.capturedBindings.has('ArcadePhysicsEngine')) {
                this.unsupported.push('ArcadePhysicsEngine constructor refers to a shadowed binding');return 'undefined value';
            }
            if(node.constructorCall && engineArgs.length<=3) {
                const args=[0,1,2].map(i=>engineArgs[i]?this.expr(engineArgs[i]):String([500,2,4][i]));
                return `arcade create physics engine max speed (${args[0]}) min step (${args[1]}) max step (${args[2]})`;
            }
            this.unsupported.push('ArcadePhysicsEngine requires new and zero to three constructor arguments');return 'undefined value';
        }
        if(node?.callee?.type==='Member' && this.physicsEngineReferences?.has(node.callee.object)) {
            this.unsupported.push(`Arcade PhysicsEngine.${node.callee.name} requires native PhysicsEngine method support`);return 'undefined value';
        }
        if(node?.callee?.type==='Member' && this.sceneReferences?.has(node.callee.object)) {
            this.unsupported.push(`Arcade Scene.${node.callee.name} requires native Scene method support`);return 'undefined value';
        }
        const owner=node.callee?.type==='Member' && node.callee.object;
        if (owner && this.isArrayReference(owner)) {
            const ref=this.expr(owner),op=node.callee.name,a=node.args||[];
            if (['pop','shift','removeAt'].includes(op)) return `${op} from array reference (${ref}) index (${a[0]?this.expr(a[0]):0})`;
            if (op==='_pickRandom' && !a.length) return `random item of array reference (${ref})`;
            if (op==='get') return `item (${this.expr(a[0])}) of array reference (${ref})`;
            // The pinned PXT Array_.removeElement reports 1 or 0 (measured); the
            // arrays block reports true or false, and true + 0 is 1.
            if (op==='removeElement') return `calculate value (remove value (${this.arrayElementValue(a[0])}) from array reference (${ref})) op "+" with ((0 + (0)))`;
            if (op==='indexOf') return `index of (${this.arrayElementValue(a[0])}) in array reference (${ref}) from (${a[1]?this.expr(a[1]):0})`;
        }
        if (this.path(node.callee)==='Math.pickRandom' && this.isArrayReference(node.args?.[0])) {
            return `random item of array reference (${this.expr(node.args[0])})`;
        }
        const name = this.path(node.callee);
        const a = node.args || [];
        const arrayCopy = arrayCopyCall(this,node);
        if(arrayCopy!==null)return arrayCopy;
        const indexedString = indexedStringValue(this,node);
        if(indexedString!==null)return indexedString;
        const stringComparison = closedStringCompare(this,node);
        if(stringComparison!==null)return stringComparison;
        if(this.handleTemplates && node.callee?.type==='Member' && node.callee.name==='kind' && !a.length && this.spriteReferences?.has(node.callee.object))return `arcade property kind of (${this.expr(node.callee.object)})`;
        const fn = node.callee?.type === 'Identifier' && this.returnFunctions?.get(node.callee.name);
        if (fn) {
            if (a.length > fn.params.length || fn.params.slice(a.length).some(name=>!fn.optionalParams?.includes(name))) {this.unsupported.push(`${fn.name}() argument count differs from its declaration`);return '0';}
            const actual=fn.params.map((_,i)=>a[i] || {type:'Undefined'});
            let args = '"[]"';
            for (let i=actual.length-1;i>=0;i--) args = `arcade function argument (${this.arrayElementValue(actual[i])}) rest (${args})`;
            const code = [fn.name, ...fn.params.map(()=>'%s')].join(' ');
            return `(arcade call function ${JSON.stringify(code)} arguments (${args}))`;
        }
        if (this.handleTemplates && /^characterAnimations\.(rule|ruleToString|matchesRule|_predicate|_direction)$/.test(this.path(node.callee)||'') && !this.bindsName('characterAnimations')) {
            const method=this.path(node.callee).slice(20);
            if(method==='ruleToString'){
                if(a.length!==1){this.unsupported.push('characterAnimations.ruleToString() takes one rule');return '""';}
                return `arcade character rule string (${this.characterRule(a[0])})`;
            }
            if(method==='matchesRule'){
                const sprite=a.length===2 && this.handleRef(a[0]);
                if(!sprite){this.unsupported.push('characterAnimations.matchesRule() takes a typed sprite and a rule');return ARCADE_FALSE;}
                return `arcade character (${sprite}) matches rule (${this.characterRule(a[1])})`;
            }
            if(method==='_direction'){
                if(this.characterVersion===LEGACY_CHARACTER_REVISION){this.unsupported.push('characterAnimations._direction() is not implemented in v0.0.2');return '0';}
                const direction=a.length===1 && this.characterFacing(a[0]);
                if(direction===null || direction===false){this.unsupported.push('characterAnimations._direction() takes a FacingDirection member');return '0';}
                return String(CHARACTER_FACINGS[direction]);
            }
            return this.characterRule(node);
        }
        if (this.handleTemplates && node.callee?.type==='Member' && node.callee.name==='equals' && this.imageReferences?.has(node.callee.object)) {
            if(a.length===1 && (this.imageReferences.has(a[0]) || this.imageOf(a[0])))return `arcade image (${this.expr(node.callee.object)}) equals image (${this.expr(a[0])})`;
            this.unsupported.push('Image.equals requires one typed Image argument');return ARCADE_FALSE;
        }
        if (node.callee?.type==='Member' && node.callee.name==='tileKindAt') {
            const handle=this.handleTemplates && this.handleRef(node.callee.object);
            if(!handle || a.length!==2 || !this.imageReferences?.has(a[1]) && !this.imageOf(a[1])) {
                this.unsupported.push('Sprite.tileKindAt requires a typed sprite reference, direction and tile Image');return ARCADE_FALSE;
            }
            return `arcade sprite (${handle}) tile kind at (${this.expr(a[0])}) equals image (${this.expr(a[1])})`;
        }
        if (node.callee?.type==='Member' && node.callee.name==='isHittingTile') {
            const handle=this.handleTemplates && this.handleRef(node.callee.object);
            if (!handle || a.length!==1) {
                this.unsupported.push('Sprite.isHittingTile requires a typed sprite reference and one collision direction');return ARCADE_FALSE;
            }
            const direction=this.path(a[0]);
            if(direction?.startsWith('CollisionDirection.') && !Object.prototype.hasOwnProperty.call(COLLISION_DIRECTIONS,a[0].name)) {
                this.unsupported.push(`${direction} is not a declared Arcade CollisionDirection member`);return ARCADE_FALSE;
            }
            return `arcade sprite (${handle}) hitting wall (${this.expr(a[0])})`;
        }
        if(node.callee?.type==='Member' && node.callee.name==='concat' && this.stringReferences?.has(node.callee.object)) {
            if(a.length!==1) {this.note('String.concat() requires exactly one argument');return 'undefined value';}
            // Every receiver producer must be a string: PXT faults on Number, null or undefined.
            if(!this.exactStringReferences?.has(node.callee.object)) {this.note('String.concat() receiver must be a proven string value');return 'undefined value';}
            if(!this.primitiveReferences?.has(a[0])) {this.note('String.concat() requires a proven primitive argument; object, reference or unknown conversion is not implemented');return 'undefined value';}
            return `concatenate text (${this.arrayElementValue(node.callee.object)}) with (${this.arrayElementValue(a[0])})`;
        }
        if (node.callee?.type==='Member' && node.callee.name==='toString' && this.spriteReferences?.has(node.callee.object)) {
            if(a.length) {this.unsupported.push('Sprite.toString() requires zero arguments');return '""';}
            return `arcade text of sprite (${this.handleRef(node.callee.object) || this.expr(node.callee.object)})`;
        }
        if (this.projectileTemplates.has(node)) {
            const template = this.projectileTemplates.get(node);
            const mode = name === 'sprites.createProjectileFromSide' ? 'side' :
                name === 'sprites.createProjectileFromSprite' ? 'sprite' : a[4] ? 'kind-source' : 'kind';
            const source = mode === 'sprite' ? a[1] : mode === 'kind-source' ? a[4] : null;
            const sourceHandle = source?.type === 'Null' ? '""' : source && this.handleRef(source);
            if (source && !sourceHandle) this.unsupported.push(`${name}() source must be a sprite handle or null`);
            const vx = mode === 'sprite' ? a[2] : a[1];
            const vy = mode === 'sprite' ? a[3] : a[2];
            if (template.dynamicImage) return `arcade projectile image (${this.imageRef(a[0])}) template "${template.name}" kind ${this.kindSlot(name==='sprites.createProjectile'?a[3]:undefined)} ` +
                `vx ${this.expr(vx)} vy ${this.expr(vy)} mode ${mode}` +
                (source ? ` source ${sourceHandle || this.expr(source)}` : '');
            return `arcade projectile template "${template.name}" kind ${this.kindSlot(name==='sprites.createProjectile'?a[3]:undefined)} ` +
                `vx ${this.expr(vx)} vy ${this.expr(vy)} width ${template.width} ` +
                `height ${template.height} mode ${mode}` +
                (source ? ` source ${sourceHandle || this.expr(source)}` : '');
        }
        const imageValue = this.imageRef(node,false);
        if (imageValue) return imageValue;
        if (this.handleTemplates && name === 'sprites.create') {
            const template = this.handleTemplates.get(node);
            if (!template) {
                this.unsupported.push('sprites.create() — image could not be used as a sprite template');
                return '0';
            }
            if (template.dynamicImage) return `arcade create image (${this.imageRef(a[0])}) template "${template.name}" kind ${this.kindSlot(a[1])}`;
            return `arcade create template "${template.name}" kind ${this.kindSlot(a[1])} ` +
                `width ${template.width} height ${template.height}`;
        }
        if(this.handleTemplates && /^info(?:\.player[1-4])?\.life$/.test(name||'')) {
            if(a.length){this.unsupported.push(`${name} requires no arguments`);return 'undefined value';}
            return `arcade life player (${playerOf(name)})`;
        }
        if(this.handleTemplates && /^info(?:\.player[1-4])?\.(hasLife|score|hasScore)$/.test(name||'')) {
            if(a.length){this.unsupported.push(`${name} requires no arguments`);return 'undefined value';}
            const method=name.split('.').pop(),property=method==='hasLife'?'has life':method==='hasScore'?'has score':'score';
            return `arcade player (${playerOf(name)}) ${property}`;
        }
        switch (name) {
        // Arcade's score is the game's on-screen score: the extension's own, on both
        // paths. (The fixed-sprite path used to keep it in a Scratch variable named
        // `score`, which the export could not tell from a user's, so the HUD was lost.)
        case 'info.highScore':
            if(highScoreIntrinsic(node))return 'arcade high score';
            this.unsupported.push('info.highScore requires its unchanged builtin and settings bindings');return '0';
        case 'info.score': return 'arcade player (1) score';
        case 'info.life': return 'lives';
        case 'game.ask':
            if(a.length>=1 && a.length<=2)return `arcade ask yes ${this.expr(a[0])} subtitle ${a[1]?this.expr(a[1]):'""'}`;
            this.unsupported.push('game.ask() requires a title and optional subtitle');return '0';
        case 'game.askForNumber':
            if (a.length === 1) return `arcade ask number ${this.expr(a[0])}`;
            if(node.bwPxtNumberPromptLength===true&&literalNumberPromptLength(node))return `arcade ask number ${this.expr(a[0])} length ${this.expr(a[1])}`;
            this.unsupported.push('game.askForNumber() with digit limit or other options');
            return '0';
        case 'game.askForString':
            if(node.bwPxtLimitedTextPrompt===true&&literalLimitedTextPrompt(node))return `arcade ask text ${this.expr(a[0])} length ${this.expr(a[1])}`;
            if (a.length === 1 || node.bwPxtDefaultTextPrompt===true&&literalDefaultTextPrompt(node)) return `arcade ask text ${this.expr(a[0])}`;
            this.unsupported.push('game.askForString() with length limit or other options');
            return '""';
        case 'scene.cameraLeft':
        case 'scene.cameraTop':
            if(this.handleTemplates && !a.length)return `arcade camera draw offset ${name==='scene.cameraLeft'?'x':'y'}`;
            this.unsupported.push(`${name} requires no arguments and native camera support`);return 'undefined value';
        case 'scene.cameraProperty':
            if(this.handleTemplates && a.length===1) {
                const property=this.path(a[0]);
                if(property?.startsWith('CameraProperty.') && !Object.prototype.hasOwnProperty.call(CAMERA_PROPERTIES,a[0].name)){
                    this.unsupported.push(`${property} is not a declared Arcade CameraProperty member`);return 'undefined value';
                }
                return `arcade camera property (${this.expr(a[0])})`;
            }
            this.unsupported.push('scene.cameraProperty requires one property selector and native camera support');return 'undefined value';
        case 'scene.screenWidth': return String(HALF_WIDTH * 2);
        case 'scene.screenHeight': return String(HALF_HEIGHT * 2);
        case 'Math.pow':
            if(!this.handleTemplates)return super.callExpression(node);
            if(this.boundSourceGlobals?.has('Math') || this.sourceFunctions?.has('Math') || this.localVars?.has('Math') || this.currentParameters?.has('Math') || this.capturedBindings.has('Math')) {
                this.unsupported.push('Math.pow refers to a shadowed Math binding');return 'undefined value';
            }
            if(a.length!==2){this.unsupported.push('Math.pow() requires exactly two numbers');return 'undefined value';}
            return this.expr({type:'Binary',op:'**',left:a[0],right:a[1]});
        case 'Math.random':
        case 'Math.randomRange':
        case 'Math.min':
        case 'Math.max':
        case 'Math.atan2':
        case 'Math.percentChance':
        case 'Math.clamp':
            if(this.bindsName('Math')) {this.note(`${name} refers to a shadowed Math binding`);return 'undefined value';}
            {const arity=name==='Math.random'?0:name==='Math.percentChance'?1:name==='Math.clamp'?3:2;
            if(a.length!==arity){this.note(`${name}() requires exactly ${arity} arguments`);return 'undefined value';}
            if(name==='Math.random')return 'arcade random fraction';
            if(name==='Math.percentChance')return `arcade percent chance (${this.arrayElementValue(a[0])})`;
            if(name==='Math.atan2'&&a.some(value=>['Array','Object'].includes(value?.type)||
                this.arrayReferences?.has(value)||this.spriteReferences?.has(value)||
                this.bufferReferences?.has(value)||this.imageReferences?.has(value))){
                this.note('Math.atan2 reference argument conversion is not implemented');return 'undefined value';
            }
            if(name==='Math.clamp'){
                if(a.some(value=>!['Null','Undefined'].includes(value?.type) &&
                    (['Array','Object'].includes(value?.type) || this.arrayReferences?.has(value) || this.spriteReferences?.has(value) || this.bufferReferences?.has(value) || this.imageReferences?.has(value)))){
                    this.note('Math.clamp reference argument conversion is not implemented');return 'undefined value';
                }
                return `arcade clamp minimum (${this.arrayElementValue(a[0])}) maximum (${this.arrayElementValue(a[1])}) value (${this.arrayElementValue(a[2])})`;
            }
            return `arcade math ${name.slice(5)} first (${this.arrayElementValue(a[0])}) second (${this.arrayElementValue(a[1])})`;}
        case 'Math.sign':
        case 'Math.trunc':
            if(this.boundSourceGlobals?.has('Math') || this.sourceFunctions?.has('Math') || this.localVars?.has('Math') || this.currentParameters?.has('Math') || this.capturedBindings.has('Math')) {
                this.unsupported.push(`${name} refers to a shadowed Math binding`);return 'undefined value';
            }
            if(a.length!==1){this.unsupported.push(`${name}() requires exactly one number`);return 'undefined value';}
            return `arcade math ${name==='Math.sign'?'sign':'truncate'} of (${this.expr(a[0])})`;
        case 'randint':
            if(a.length!==2){this.note('randint() requires exactly two arguments');return 'undefined value';}
            return `arcade math randomRange first (${this.arrayElementValue(a[0])}) second (${this.arrayElementValue(a[1])})`;
        case 'String.fromCharCode':
            if(a.length!==1 || this.bindsName('String')) {this.note('String.fromCharCode() requires its unshadowed single-argument primitive conversion');return 'undefined value';}
            if(!this.primitiveReferences?.has(a[0])) {this.note('String.fromCharCode() requires a proven primitive argument; object, reference or unknown conversion is not implemented');return 'undefined value';}
            return `text from char code (${this.arrayElementValue(a[0])})`;
        case 'game.runtime':
        case 'control.millis':
            if(a.length || this.bindsName(name.split('.')[0])) {this.note(`${name}() needs its unshadowed zero-argument clock`);return 'undefined value';}
            return name==='game.runtime'?'arcade scene runtime milliseconds':'arcade program runtime milliseconds';
        case 'controller.dx': return `arcade controller x step ${this.expr(a[0] || {type: 'Number', value: 100})}`;
        case 'controller.dy': return `arcade controller y step ${this.expr(a[0] || {type: 'Number', value: 100})}`;
        // Math.min/max/pow/map: the base translator's (task #400) — every
        // argument kept, and Math.map written as its formula with a note,
        // because there is no map reporter off the micro:bit.
        // A sprite KIND is a compile-time label; every Arcade game defines
        // a few, and reporting them as unsupported would bury the real
        // refusals under noise. A number is exactly what they are.
        case 'SpriteKind.create':
            if(a.length || this.bindsName('SpriteKind')){this.unsupported.push('SpriteKind.create() requires no arguments and the original namespace');return 'undefined value';}
            return 'arcade create sprite kind';
        case 'animation.createAnimation':
            if (this.handleTemplates && a.length === 2) return `arcade create animation action (${this.expr(a[0])}) interval (${this.expr(a[1])})`;
            this.unsupported.push('animation.createAnimation requires an action, interval and runtime animation support');
            return '0';
        case 'animation.attachAnimation':
            this.unsupported.push('animation.attachAnimation is a command, not a value');return '0';

        default: {
            // The per-player info API: `info.player2.hasLife()` and friends.
            // Player one shares the plain API's variables by design, so a
            // game that mixes both reads and writes one set, not two.
            if (/^info\.player\d\./.test(name || '')) {
                const player = playerOf(name);
                const method = name.split('.').pop();
                if (method === 'score') return `arcade player (${player}) score`;
                if (method === 'life') return playerVar('lives', player);
                if (method === 'hasLife') {
                    if (this.handleTemplates) {this.usesArrays = true; return `compare value (${playerVar('lives', player)}) op ">" with (0)`;}
                    return `${playerVar('lives', player)} > 0`;
                }
            }

            const imageOwner = node.callee?.object;
            const imageHandle = imageOwner?.type === 'Member' && imageOwner.name === 'image' && this.handleRef(imageOwner.object);
            const resource = this.imageRef(imageOwner);
            if (resource && node.callee.name === 'overlapsWith') {
                const source = this.imageRef(a[0]);
                if (a.length === 3 && source) return `arcade images overlap (${resource}) source (${source}) x (${this.expr(a[1])}) y (${this.expr(a[2])})`;
                this.unsupported.push(`${name}() needs an image source and x/y offsets`);return 'false';
            }
            if (resource && !imageHandle && node.callee.name === 'getPixel' && a.length === 2) {
                return `arcade image pixel (${resource}) x (${this.expr(a[0])}) y (${this.expr(a[1])})`;
            }
            if (imageHandle && node.callee.name === 'getPixel' && a.length === 2) {
                return `arcade pixel of ${imageHandle} x (${this.expr(a[0])}) y (${this.expr(a[1])})`;
            }
            if (name === 'scene.backgroundColor' && a.length === 0) return 'arcade background color';

            // Native queries read the SDK button state, including internal event
            // changes which intentionally do not mutate Scratch keyboard IO.
            const button = /^controller\.(\w+)\.isPressed$/.exec(name || '');
            if (button && CONTROLLER_KEYS[button[1]]) {
                if(this.bindsName('controller')){this.unsupported.push(`${name} refers to a shadowed controller binding`);return 'undefined value';}
                if(this.handleTemplates && button[1]==='menu'){this.unsupported.push('controller.menu.isPressed requires a qualified SDK menu button state reporter');return 'undefined value';}
                if(this.handleTemplates && Object.prototype.hasOwnProperty.call({A:0,B:1,up:2,right:3,down:4,left:5},button[1]))return `arcade player (arcade player by number 1) button (${{A:0,B:1,up:2,right:3,down:4,left:5}[button[1]]}) pressed`;
                return `key ${CONTROLLER_KEYS[button[1]]} pressed?`;
            }

            // `ball.overlapsWith(paddle)` is `touching paddle` — the one
            // sprite method that reports rather than acts.
            if (node.callee && node.callee.type === 'Member' && node.callee.name === 'overlapsWith') {
                const first = this.handleRef(node.callee.object);
                const second = this.handleRef(a[0]);
                if (first && second) return `arcade ${first} overlaps ${second}`;
                const owner = this.resolveSprite(node.callee.object);
                const other = this.resolveSprite(a[0]);
                if (owner && other && owner === this.self) return `touching ${other.name}`;
                if (owner && other) {
                    this.unsupported.push(
                        `${owner.name}.overlapsWith(${other.name}) — only this sprite's own overlaps can be tested`);
                    return 'false';
                }
            }
            return super.callExpression(node);
        }
        }
    }

    /**
     * A truth value in a VALUE slot (task E9). The dialect reads a condition
     * there as literal text (with a warning), so a truth value that has no
     * value word is chosen on the lines before its statement:
     *   IF <condition> THEN: set _mcN to <true> ELSE: set _mcN to <false>
     * and the slot reads _mcN. True and false are the program's own: 1 and 0
     * on the fixed-sprite path (its Boolean literals are 1 and 0, and its
     * conditions read a variable as `not (v = 0)`), the real Booleans
     * ARCADE_TRUE / ARCADE_FALSE on the handle path, whose comparisons and
     * `!` are already value words (compare value, truthiness of value).
     * The condition() a node is being written for is not a value slot.
     */
    // A tilemap literal, asset or factory call as a value (not as the direct
    // argument of tiles.setTilemap, which keeps its inline form).
    tilemapValueData (node) {
        if(node?.type==='Template' && /^(tilemap|assets\.tilemap)$/.test(node.tag||'')) {
            if(node.value.includes('${')){this.unsupported.push('tilemap`…` requires a literal tilemap name');return undefined;}
            const resolved=resolveNativeTilemap(this.tilemaps,node.value);
            if(resolved.unsupported.length){this.unsupported.push(`tilemap\`${node.value}\`: ${resolved.unsupported.join('; ')}`);return undefined;}
            if(resolved.value===undefined){this.unsupported.push(`tilemap\`${node.value}\` — no such tilemap in this project`);return undefined;}
            return resolved.value;
        }
        if(node?.type==='Call' && this.path(node.callee)==='tiles.createTilemap') {
            const data=decodeTilemap(node,item=>this.imageOf(item),item=>this.path(item));
            if(!data)this.unsupported.push('tiles.createTilemap() requires a readable literal tile map with wall layer and tile scale');
            return data||undefined;
        }
        return undefined;
    }
    expr (node) {
        if(node?.type==='ClosedSpriteNullFilter')return emitClosedSpriteNullFilter(this,node);
        if(this.handleTemplates && ((node?.type==='Template' && /^(tilemap|assets\.tilemap)$/.test(node.tag||'')) || (node?.type==='Call' && this.path(node.callee)==='tiles.createTilemap'))) {
            const data=this.tilemapValueData(node);
            if(data===undefined)return 'undefined value';
            return `arcade tilemap value ${JSON.stringify(JSON.stringify(data))}`;
        }
        // Deletion is an unsupported mutation, never a numeric operand/fold.
        if(node?.type==='Unary'&&node.op==='delete')return super.expr(node);
        if(node?.type==='Unary'&&containsNonFiniteNumberLiteral(node.argument)){this.unsupported.push('Non-finite source Number literals lack a qualified Code carrier');return 'undefined value';}
        if(node?.type==='Number'){
            if(!Number.isFinite(Number(node.value))){this.unsupported.push('Non-finite source Number literals lack a qualified Code carrier');return 'undefined value';}
            return numberLiteralCode(node.value);
        }
        if(node?.bwPrimitiveNumberText)return `(${this.arrayElementValue(node.left)}) join ("")`;
        if(node?.type==='FontMetric')return `arcade font ${JSON.stringify(node.font)} metric ${JSON.stringify(node.property)}`;
        if(node?.type === 'Template' && this.assetKindLookup &&
            lookupAssetTemplate(this.assetKindLookup,node.tag,node.value) === null) {
            this.usesArrays=true;return 'null value';
        }
        if (isAnimationResourceFactory(node)) return `arcade animation fresh frames resource ${JSON.stringify(node.bwAnimationResourceId)}`;
        const value=this.valueExpr(node);
        if(!node || node===this.conditionNode)return value;
        // On the fixed-sprite path a truth node's value text IS its condition
        // (the base writes `!`, comparisons, && and || in that grammar).
        if(!isConditionCall(node,value) && !(isTruthNode(node) && !this.nativeValues))return value;
        const repeated=this.inLoopCondition || this.inRepeatedCondition;
        if(this.pre && !repeated)return this.truthAsValue(value);
        this.unsupported.push(`${value} as a value ${repeated ? 'in a condition tested on every pass' : 'outside a statement'} (it cannot be chosen into a variable first)`);
        return value;
    }
    /** A condition tested again and again: nothing in it can be chosen first. */
    repeatedCondition (node) {
        const was=this.inRepeatedCondition;this.inRepeatedCondition=true;
        try {return this.condition(node);} finally {this.inRepeatedCondition=was;}
    }
    truthAsValue (condition) {
        const name=`_mc${++this.temps}`;
        this.declared.add(name);
        const [yes,no]=this.nativeValues?[ARCADE_TRUE,ARCADE_FALSE]:['1','0'];
        this.pre.push(`IF ${condition} THEN:`,`  set ${name} to ${yes}`,'ELSE:',`  set ${name} to ${no}`);
        return name;
    }
    /**
     * Property reads: `ball.x`, `ball.vx`, `sprite.width`.
     *
     * Positions come back in ARCADE units — `x position` is stage units,
     * so it is converted back — because the arithmetic around the read is
     * the game's own and speaks Arcade's coordinates. Mixing the two is
     * how a translated game ends up subtly, unreproducibly wrong.
     * Another sprite's position is readable (`x position of ball`) even
     * though writing it is not.
     */
    controllerRepeatSlot(node) {
        if(node?.type!=='Member' || !['repeatDelay','repeatInterval'].includes(node.name))return null;
        const receiver=this.path(node.object)||'';
        if(!receiver.startsWith('controller.'))return null;
        if(this.bindsName('controller'))return {error:'Controller repeat property refers to a shadowed controller binding'};
        const match=/^controller(?:\.player([1-4]))?\.(A|B|up|down|left|right)$/.exec(receiver);
        return match?{player:match[1]||'1',button:match[2],property:node.name}:{error:'Controller repeat property requires a fixed supported player and button'};
    }
    valueExpr (node) {
        const repeat=this.controllerRepeatSlot(node);
        if(repeat){if(repeat.error){this.unsupported.push(repeat.error);return 'undefined value';}return `arcade player ${repeat.player} button ${repeat.button} repeat property ${repeat.property}`;}
        const indexedString=indexedStringValue(this,node);
        if(indexedString!==null)return indexedString;
        const music=this.musicValue(node);
        if(music!==null)return music;
        if(node?.type==='Member' && node.object?.type==='Identifier' && node.object.name==='Math' &&
            ['E','LN2','LN10','LOG2E','LOG10E','PI','SQRT1_2','SQRT2'].includes(node.name)) {
            if(this.boundSourceGlobals?.has('Math') || this.sourceFunctions?.has('Math') || this.localVars?.has('Math') || this.currentParameters?.has('Math') || this.capturedBindings.has('Math')) {
                this.unsupported.push(`${this.path(node)} refers to a shadowed Math binding`);return 'undefined value';
            }
            return String(Math[node.name]);
        }
        const core=this.coreValue(node);
        if(core!==null)return core;
        if(['MultiplayerState.score','MultiplayerState.life'].includes(this.path(node))) {
            if(this.boundSourceGlobals?.has('MultiplayerState') || this.sourceFunctions?.has('MultiplayerState') || this.localVars?.has('MultiplayerState') || this.currentParameters?.has('MultiplayerState') || this.capturedBindings.has('MultiplayerState')){this.unsupported.push('MultiplayerState constant refers to a shadowed binding');return 'undefined value';}
            return this.path(node).endsWith('.score')?'0':'1';
        }
        const mpEnum = this.path(node);
        const mpConstants={'mp.PlayerNumber.One':1,'mp.PlayerNumber.Two':2,'mp.PlayerNumber.Three':3,'mp.PlayerNumber.Four':4,
            'mp.PlayerProperty.Index':1,'mp.PlayerProperty.Number':2,
            'mp.MultiplayerButton.A':0,'mp.MultiplayerButton.B':1,'mp.MultiplayerButton.Up':2,'mp.MultiplayerButton.Right':3,'mp.MultiplayerButton.Down':4,'mp.MultiplayerButton.Left':5};
        if(Object.prototype.hasOwnProperty.call(mpConstants,mpEnum)) {
            if(this.boundSourceGlobals?.has('mp') || this.sourceFunctions?.has('mp') || this.localVars?.has('mp') || this.currentParameters?.has('mp') || this.capturedBindings.has('mp')) {
                this.unsupported.push(`${mpEnum} refers to a shadowed mp binding`);return 'undefined value';
            }
            return String(mpConstants[mpEnum]);
        }
        if(/^mp\.(PlayerNumber|PlayerProperty|MultiplayerButton)\./.test(mpEnum||'')) {
            this.unsupported.push(`${mpEnum} is not a declared multiplayer enum member`);return 'undefined value';
        }
        if(node?.type==='Member' && this.playerReferences?.has(node.object)) {
            if(['index','number'].includes(node.name))return `arcade player member property (${node.name==='index'?1:2}) of (${this.expr(node.object)})`;
            this.unsupported.push(`mp.Player.${node.name} requires native player member support`);return 'undefined value';
        }
        if(node?.type==='Member' && this.sceneReferences?.has(node.object)) {
            if(node.name==='physicsEngine')return `arcade physics engine of scene (${this.expr(node.object)})`;
            if(node.name==='flags')return `arcade flags of scene (${this.expr(node.object)})`;
            this.unsupported.push(`Arcade Scene.${node.name} requires native Scene member support`);return 'undefined value';
        }
        if(node?.type==='Member' && this.physicsEngineReferences?.has(node.object)) {
            if(['maxSpeed','minStep','maxStep'].includes(node.name))return `arcade physics engine property ${node.name} of (${this.expr(node.object)})`;
            this.unsupported.push(`Arcade PhysicsEngine.${node.name} requires native physics-engine member support`);return 'undefined value';
        }
        if(this.handleTemplates && node?.type==='Call' && this.path(node.callee)==='control.allocateNotifyEvent') {
            if(this.boundSourceGlobals?.has('control') || this.sourceFunctions?.has('control') || this.localVars?.has('control') || this.currentParameters?.has('control') || this.capturedBindings.has('control')){this.unsupported.push('control.allocateNotifyEvent refers to a shadowed control binding');return 'undefined value';}
            if(node.args.length){this.unsupported.push('control.allocateNotifyEvent requires no arguments');return 'undefined value';}return 'arcade allocate control event source';
        }
        if(this.handleTemplates && node?.type==='Member' && /^controller\.player[1-4]$/.test(this.path(node.object)||'') && ['id','connected'].includes(node.name)) {
            if(this.boundSourceGlobals?.has('controller') || this.sourceFunctions?.has('controller') || this.localVars?.has('controller') || this.currentParameters?.has('controller') || this.capturedBindings.has('controller')){this.unsupported.push(`${this.path(node)} refers to a shadowed controller binding`);return 'undefined value';}
            const player=this.path(node.object).slice(-1);
            return node.name==='id'?`arcade controller event source player ${player}`:`arcade player (arcade player by number ${player}) connected`;
        }
        if(this.handleTemplates && node?.type==='Member' && node.object?.type==='Identifier' && node.object.name==='ControllerEvent') {
            if(this.boundSourceGlobals?.has('ControllerEvent') || this.localVars?.has('ControllerEvent') || this.currentParameters?.has('ControllerEvent') || this.capturedBindings.has('ControllerEvent')){this.unsupported.push(`${this.path(node)} refers to a shadowed ControllerEvent binding`);return 'undefined value';}
            const values={Connected:1,Disconnected:2};if(Object.prototype.hasOwnProperty.call(values,node.name))return String(values[node.name]);
            this.unsupported.push(`${this.path(node)} is not a declared Arcade ControllerEvent member`);return 'undefined value';
        }
        // Generic emission accepts the same actual readonly leaves as the
        // caller producer proof; spelling or parameter types are insufficient.
        if(this.buttonEventNumberLeaves?.has(node))return String(BUTTON_EVENTS[node.name]);
        if(this.handleTemplates && node?.type==='Member' && node.object?.type==='Identifier' && node.object.name==='ControllerButtonEvent') {
            if(this.boundSourceGlobals?.has('ControllerButtonEvent') || this.localVars?.has('ControllerButtonEvent') || this.currentParameters?.has('ControllerButtonEvent') || this.capturedBindings.has('ControllerButtonEvent')) {
                this.unsupported.push(`${this.path(node)} refers to a shadowed ControllerButtonEvent binding`);return 'undefined value';
            }
            if(Object.prototype.hasOwnProperty.call(BUTTON_EVENTS,node.name))return String(BUTTON_EVENTS[node.name]);
            this.unsupported.push(`${this.path(node)} is not a declared Arcade ControllerButtonEvent member`);return 'undefined value';
        }
        if(node?.type==='Member' && node.object?.type==='Identifier' && node.object.name==='ScaleAnchor') {
            const values={Middle:0,Top:1,Left:2,Right:4,Bottom:8,TopLeft:3,TopRight:5,BottomLeft:10,BottomRight:12};
            if(this.boundSourceGlobals?.has('ScaleAnchor') || this.localVars?.has('ScaleAnchor') || this.currentParameters?.has('ScaleAnchor') || this.capturedBindings.has('ScaleAnchor')) {
                this.unsupported.push(`${this.path(node)} refers to a shadowed ScaleAnchor binding`);return 'undefined value';
            }
            if(Object.prototype.hasOwnProperty.call(values,node.name))return String(values[node.name]);
            this.unsupported.push(`${this.path(node)} is not a declared Arcade ScaleAnchor member`);return 'undefined value';
        }
        if(node?.type==='Member' && node.object?.type==='Identifier' && node.object.name==='CameraProperty') {
            if(this.boundSourceGlobals?.has('CameraProperty') || this.localVars?.has('CameraProperty') || this.currentParameters?.has('CameraProperty') || this.capturedBindings.has('CameraProperty')) {
                this.unsupported.push(`${this.path(node)} refers to a shadowed CameraProperty binding; object member access is not supported`);return 'undefined value';
            }
            if(Object.prototype.hasOwnProperty.call(CAMERA_PROPERTIES,node.name))return String(CAMERA_PROPERTIES[node.name]);
            this.unsupported.push(`${this.path(node)} is not a declared Arcade CameraProperty member`);return 'undefined value';
        }
        if(node?.type==='Member' && node.object?.type==='Identifier' && node.object.name==='TileDirection' && !this.bindsName('TileDirection')) {
            if(Object.prototype.hasOwnProperty.call(TILE_DIRECTIONS,node.name))return String(TILE_DIRECTIONS[node.name]);
            this.unsupported.push(`${this.path(node)} is not a declared Arcade TileDirection member`);return 'undefined value';
        }
        if(node?.type==='Member' && node.object?.type==='Identifier' && node.object.name==='CollisionDirection' &&
            !this.boundSourceGlobals?.has('CollisionDirection') && !this.localVars?.has('CollisionDirection') && !this.currentParameters?.has('CollisionDirection') && !this.capturedBindings.has('CollisionDirection')) {
            if(Object.prototype.hasOwnProperty.call(COLLISION_DIRECTIONS,node.name))return String(COLLISION_DIRECTIONS[node.name]);
            this.unsupported.push(`${this.path(node)} is not a declared Arcade CollisionDirection member`);return '0';
        }
        if (this.nativeValues && node?.type === 'Unary' && node.op === 'typeof') {
            const value = node.argument;
            if (!this.sourceTypeOfOperands?.has(value) && node.bwSourceCallableTypeOf!==true) {
                this.unsupported.push('Source typeof requires a proven primitive or owned Array, class, Image or Buffer; Sprite, callable and opaque ownership is not qualified');
                return 'undefined value';
            }
            return `arcade source type of (${this.arrayElementValue(value)})`;
        }
        if(this.nativeValues && ['Unary','Binary'].includes(node?.type)) {
            const folded=foldPxtNumeric(node,name=>['NaN','Infinity'].includes(name) && !this.bindsName(name) ? {value:name==='NaN'?NaN:Infinity} : null);
            if(folded){this.usesArrays=true;return pxtFoldedNumberCode(folded.value);}
        }
        if(node?.type==='Identifier' && ['NaN','Infinity'].includes(node.name) && !this.boundSourceGlobals?.has(node.name) && !this.localVars?.has(node.name) && !this.currentParameters?.has(node.name) && !this.capturedBindings.has(node.name)) {
            return this.expr({type:'Binary',op:'/',left:{type:'Number',value:node.name==='NaN'?'0':'1'},right:{type:'Number',value:'0'}});
        }
        if(['NativeNamedArrayCreate','NativeNamedArrayDelete'].includes(node?.type)) {
            this.usesArrays=true;
            if(!this.pre){this.unsupported.push('Named Array construction requires its validated statement owner');return 'undefined value';}
            this.pre.push(node.type==='NativeNamedArrayCreate'?`new array ${JSON.stringify(node.registry)} = ${node.json}`:`delete array ${JSON.stringify(node.registry)}`);
            return node.type==='NativeNamedArrayCreate'?`reference to named array (${JSON.stringify(node.registry)})`:'null value';
        }
        if(node?.type==='Call' && node.bwNativeNamedArray?.kind==='get') {this.usesArrays=true;return `item (${this.expr(node.args[1])}) of array ${JSON.stringify(node.bwNativeNamedArray.registry)}`;}
        if(node?.type==='NativeNamedArrayReference'){this.usesArrays=true;return `reference to named array (${JSON.stringify(node.registry)})`;}
        if(node?.type==='Call' && node.bwNativeNamedArray?.kind==='pop') {this.usesArrays=true;return `pop from array ${JSON.stringify(node.bwNativeNamedArray.registry)}`;}
        if(node?.type==='Call' && node.bwNativeNamedArray?.kind==='indexOf') {this.usesArrays=true;return `index of (${this.expr(node.args[1])}) in array ${JSON.stringify(node.bwNativeNamedArray.registry)}`;}
        if(node?.type==='LegacyParsedValue'){this.usesArrays=true;return `parse array input (${this.arrayElementValue(node.value)})`;}
        if(node?.type==='NativeArrayAccess')return this.expr(node.value);
        const importedBuffer=this.bufferExpression(node);
        if(importedBuffer!==null)return importedBuffer;
        if(node?.type==='LegacyJsonValue'){this.usesArrays=true;return `JSON text of value (${this.arrayElementValue(node.value)})`;}
        if(this.nativeValues && node?.type==='Identifier' && node.temporary)return `arcade local ${node.name}`;
        if(this.nativeValues && node?.type==='Boolean')return node.value?ARCADE_TRUE:ARCADE_FALSE;
        if(this.handleTemplates && node?.type==='Member' && ['SpriteFlag','sprites.Flag'].includes(this.path(node.object))) {
            const prefix=this.path(node.object),root=prefix.split('.')[0],values=prefix==='SpriteFlag'?SPRITE_FLAG_VALUES:PRIVATE_SPRITE_FLAG_VALUES;
            if(this.bindsName(root)){this.unsupported.push(prefix+' refers to a shadowed flag binding');return 'undefined value';}
            if(Object.prototype.hasOwnProperty.call(values,node.name))return `(0 + (${values[node.name]}))`;
            this.unsupported.push(prefix+'.'+node.name+' is not a declared sprite flag');return 'undefined value';
        }
        if(this.handleTemplates && node?.type==='Member' && this.path(node.object)==='TileScale') {
            if(this.boundSourceGlobals?.has('TileScale') || this.sourceFunctions?.has('TileScale') || this.localVars?.has('TileScale') || this.currentParameters?.has('TileScale') || this.capturedBindings.has('TileScale')){this.unsupported.push('TileScale refers to a shadowed binding');return 'undefined value';}
            const values={Four:2,Eight:3,Sixteen:4,ThirtyTwo:5};
            if(Object.prototype.hasOwnProperty.call(values,node.name))return String(values[node.name]);
            this.unsupported.push(`TileScale.${node.name} is not a declared tile scale`);return '4';
        }
        if(this.handleTemplates && node?.type==='Member' && this.path(node.object)==='SpriteKind' && !this.bindsName('SpriteKind'))return `arcade sprite kind value ${JSON.stringify(node.name)}`;
        if(this.nativeValues && node?.type==='String')return arcadeTextLiteral(tsText(node.value));
        if(this.nativeValues && ['Update','Assignment'].includes(node?.type)){this.unsupported.push(`${node.type.toLowerCase()} expression used as a value`);return '0';}
        if (node?.type === 'Undefined' || this.nativeValues && node?.type === 'Null') {
            this.usesArrays=true;return `${node.type.toLowerCase()} value`;
        }
        if(this.nativeValues && node?.type==='Binary' && ['==','!=','===','!==','<','>','<=','>='].includes(node.op)) {
            this.usesArrays=true;
            return `compare value (${this.arrayElementValue(node.left)}) op "${node.op}" with (${this.arrayElementValue(node.right)})`;
        }
        // Without native values the legacy integer words convert silently.
        // An operand with a known object producer (an Image, an object
        // literal...) is diagnosed as in the native route; ordinary SDK
        // results keep the legacy conversion.
        if(!this.nativeValues && (node?.type==='Binary' && ['&','|','^','<<','>>','>>>'].includes(node.op) || node?.type==='Unary' && node.op==='~')) {
            const operands=node.type==='Binary'?[node.left,node.right]:[node.argument];
            if(operands.some(value=>this.objectBitwiseOperands?.has(value)&&!this.primitiveBitwiseOperands?.has(value)&&!this.possibleBitwiseArrays?.has(value))){
                this.unsupported.push('Bitwise operation requires proven primitive operands; opaque reference, object or unknown conversion is not implemented');return '0';
            }
        }
        if(this.nativeValues && (node?.type==='Binary' && ['&','|','^','<<','>>','>>>'].includes(node.op) || node?.type==='Unary' && node.op==='~')) {
            const operands=node.type==='Binary'?[node.left,node.right]:[node.argument];
            if(operands.some(value=>this.possibleBitwiseArrays?.has(value))){
                if(operands.some(value=>!this.sourceBitwiseOperands?.has(value))){
                    this.unsupported.push('Arcade source Array bitwise operation requires current Array or primitive operand producers');return 'undefined value';
                }
                this.usesArrays=true;
                return node.type==='Binary'?`arcade source value (${this.arrayElementValue(node.left)}) op "${node.op}" with (${this.arrayElementValue(node.right)})`:
                    `arcade source unary "~" of (${this.arrayElementValue(node.argument)})`;
            }
            if(operands.some(value=>!this.primitiveBitwiseOperands?.has(value))){this.unsupported.push('Bitwise operation requires proven primitive operands; opaque reference, object or unknown conversion is not implemented');return 'undefined value';}
            this.usesArrays=true;
            return node.type==='Binary'?`calculate value (${this.arrayElementValue(node.left)}) op "${node.op}" with (${this.arrayElementValue(node.right)})`:
                `convert value (${this.arrayElementValue(node.argument)}) op "~"`;
        }
        // A runtime-dispatch helper call in a program without native values
        // has no Array value to dispatch on: it is exactly the ordinary `+`.
        if(!this.nativeValues&&node?.type==='NativeArrayValueBinary')return this.valueExpr({type:'Binary',op:'+',left:node.left,right:node.right});
        if(this.nativeValues&&node?.type==='NativeArrayValueBinary'){
            this.usesArrays=true;return `calculate value (${this.arrayElementValue(node.left)}) op "+" with (${this.arrayElementValue(node.right)})`;
        }
        if(this.nativeValues && node?.type==='Binary' && ['+','-','*','/','%','**'].includes(node.op)) {
            if([node.left,node.right].some(value=>this.spriteReferences?.has(value)))this.unsupported.push('sprite arithmetic conversion requires ToPrimitive support');
            if([node.left,node.right].some(value=>this.playerReferences?.has(value)))this.unsupported.push('player arithmetic conversion requires ToPrimitive support');
            const operands=[node.left,node.right],array=operands.some(value=>this.arrayReferences?.has(value));
            if(array){
                if(operands.some(value=>!this.sourceArrayArithmeticOperands?.has(value))){
                    this.unsupported.push('Arcade source Array arithmetic requires current Array or primitive operand producers');return 'undefined value';
                }
                this.usesArrays=true;return `arcade source value (${this.arrayElementValue(node.left)}) op "${node.op}" with (${this.arrayElementValue(node.right)})`;
            }
            this.usesArrays=true;return `calculate value (${this.arrayElementValue(node.left)}) op "${node.op}" with (${this.arrayElementValue(node.right)})`;
        }
        // `!x` as a value. The value words have no unary `!` (BWValues.unary
        // is + and -), and `not (…)` in a value slot is kept as text, so it is
        // JavaScript's own definition: truthiness of x === false.
        if(this.nativeValues && node?.type==='Unary' && node.op==='!') {
            this.usesArrays=true;
            return `compare value (${this.truthValue(node.argument)}) op "===" with (${ARCADE_FALSE})`;
        }
        if(this.nativeValues && node?.type==='Unary' && ['+','-'].includes(node.op)) {
            this.usesArrays=true;
            // PXT's nonfolded prefix emitter subtracts for unary signs. If the
            // operand itself emits a numeric literal, both branches negate it.
            // Parentheses can block the outer constant fold but not this step.
            if(containsNonFiniteNumberLiteral(node.argument)){this.unsupported.push('Non-finite source Number literals lack a qualified Code carrier');return 'undefined value';}
            const operand=foldPxtNumeric(node.argument,name=>['NaN','Infinity'].includes(name) && !this.bindsName(name) ? {value:name==='NaN'?NaN:Infinity} : null);
            if(operand)return pxtFoldedNumberCode(-operand.value);
            return node.op==='-' ? `calculate value ((0 + (0))) op "-" with (${this.arrayElementValue(node.argument)})` :
                `convert value (${this.arrayElementValue(node.argument)}) op "+"`;
        }
        if(this.nativeValues && node?.type==='Binary' && ['&&','||'].includes(node.op))
            this.unsupported.push(`logical ${node.op} as a value needs operand-preserving lazy evaluation`);
        if (node?.type==='Array' && this.nativeValues) {
            let values='"[]"';for(let i=node.items.length-1;i>=0;i--)values=`array value (${this.arrayElementValue(node.items[i])}) rest (${values})`;
            return `new array reference from (${values})`;
        }
        if(this.handleTemplates && node?.type==='Call' && /^scroller\.getBackground[XY]Offset$/.test(this.path(node.callee)||'') && !this.bindsName('scroller')) {
            const a=node.args||[],layer=this.scrollerLayer(a[0]);
            if(this.scrollerVersion===LEGACY_SCROLLER_REVISION && a.length) {this.note('Legacy background offset getters take no layer argument');return 'undefined value';}
            if(a.length>1 || layer===null){this.unsupported.push(`${this.path(node.callee)}() takes an optional layer`);return '0';}
            return `arcade background scroll offset ${/X/.test(this.path(node.callee))?'x':'y'} layer (${layer})`;
        }
        if(this.handleTemplates && node?.type==='Member' && this.textSpriteReferences?.has(node.object) && TEXT_SPRITE_PROPERTIES.includes(node.name))
            return `arcade text sprite (${this.expr(node.object)}) property ${node.name}`;
        if(this.handleTemplates && node?.type==='Call' && this.path(node.callee)==='textsprite.create' && !this.bindsName('textsprite')) {
            const a=node.args||[];
            if(a.length<1 || a.length>3){this.note('textsprite.create() requires text and optional background and foreground');return 'undefined value';}
            return `arcade create text sprite text (${this.arrayElementValue(a[0])}) background (${a[1]?this.arrayElementValue(a[1]):0}) foreground (${a[2]?this.arrayElementValue(a[2]):1})`;
        }
        if(this.handleTemplates && node?.type==='Member' && this.spriteExtensionOf(node.object)) {
            const kind=this.spriteExtensionOf(node.object);
            if(node.name==='sprite')return this.expr(node.object);
            if((kind==='dart'?DART_PROPERTIES:CORGI_PROPERTIES).includes(node.name))return `arcade ${kind==='dart'?'dart':'corgi'} (${this.expr(node.object)}) property ${node.name}`;
        }
        if(this.handleTemplates && node?.type==='Call' && /^(darts|corgio)\.create$/.test(this.path(node.callee)||'') && !this.bindsName(this.path(node.callee).split('.')[0]))
            return this.spriteExtensionCreate(node);
        if(node?.type==='Member' && Object.prototype.hasOwnProperty.call(ARCADE_SCENE_CONSTANTS,this.path(node))) {
            if(this.bindsName('scene')){this.note(`${this.path(node)} refers to a shadowed scene binding`);return 'undefined value';}
            return String(ARCADE_SCENE_CONSTANTS[this.path(node)]);
        }
        if(this.handleTemplates && node?.type==='Member' && this.isSevensegDisplay(node.object)) {
            const counter=this.sevensegCounterReferences?.has(node.object);
            if((counter?['x','y','count']:['x','y','width','height','value']).includes(node.name))return `arcade seven segment (${this.expr(node.object)}) property ${node.name}`;
            this.unsupported.push(`${counter?'DigitCounter':'SevenSegDigit'}.${node.name} is not a seven segment property`);return '0';
        }
        if(this.handleTemplates && node?.type==='Call' && /^sevenseg\.(createDigit|createCounter)$/.test(this.path(node.callee)||'') && !this.bindsName('sevenseg'))
            return this.sevensegCreate(node);
        if(this.handleTemplates && node?.type==='Member' && this.animationReferences?.has(node.object)) {
            if(['image','action','interval'].includes(node.name))return `arcade animation ${node.name} of (${this.expr(node.object)})`;
            this.unsupported.push(`animation.Animation.${node.name} requires animation property support`);return '0';
        }
        if(this.handleTemplates && node?.type==='Member' && this.legacyTileReferences?.has(node.object)) {
            if(['x','y','tileSet'].includes(node.name))return `arcade color tile ${node.name} of (${this.expr(node.object)})`;
            this.unsupported.push(`tiles.Tile.${node.name} is not a supported legacy Tile property`);return '0';
        }
        if(this.handleTemplates && node?.type==='Member' && this.sceneTilemapReferences?.has(node.object)) {
            if(['data','scale','enabled'].includes(node.name))return `arcade scene tilemap ${node.name} of (${this.expr(node.object)})`;
            this.unsupported.push(`tiles.TileMap.${node.name} is not a supported scene TileMap property`);return '0';
        }
        if(this.handleTemplates && node?.type==='Member' && node.name==='tileMap' && this.tileReferences?.has(node.object))
            return `arcade scene tilemap of tile (${this.expr(node.object)})`;
        if(this.handleTemplates && node?.type==='Member' && this.tilemapDataReferences?.has(node.object)) {
            if(['width','height','scale'].includes(node.name))return `arcade tilemap ${node.name} of (${this.expr(node.object)})`;
            this.unsupported.push(`tiles.TileMapData.${node.name} is not a supported TileMapData property`);return '0';
        }
        if(this.handleTemplates && node?.type==='Member' && this.tileReferences?.has(node.object)) {
            const property=node.name==='col'?'column':node.name;
            if(['column','row','x','y','left','right','top','bottom','tileSet'].includes(property))return `arcade tile ${property} of (${this.expr(node.object)})`;
            this.unsupported.push(`tiles.Location.${node.name} requires tile location property support`);return '0';
        }
        if(this.handleTemplates && node?.type==='Call') {
            const api=this.path(node.callee),args=node.args||[];
            if(node.callee?.type==='Member' && this.animationReferences?.has(node.callee.object) && args.length===0 && ['getImage','getAction','getInterval'].includes(node.callee.name))return `arcade animation ${node.callee.name.slice(3).toLowerCase()} of (${this.expr(node.callee.object)})`;
            if(['scene.getTile','scene.getTilesByType'].includes(api)) {
                if(this.boundSourceGlobals?.has('scene') || this.sourceFunctions?.has('scene') || this.localVars?.has('scene') || this.currentParameters?.has('scene') || this.capturedBindings.has('scene')){this.unsupported.push(`${api} refers to a shadowed scene binding`);return '0';}
                if(api==='scene.getTile' && args.length===2)return `arcade color tile column (${this.expr(args[0])}) row (${this.expr(args[1])})`;
                if(api==='scene.getTilesByType' && args.length===1)return `arcade color tile array index (${this.expr(args[0])})`;
                this.unsupported.push(`${api} has invalid arity`);return '0';
            }
            if(api==='scene.tileHitFrom' && (this.boundSourceGlobals?.has('scene') || this.sourceFunctions?.has('scene') || this.localVars?.has('scene') || this.currentParameters?.has('scene') || this.capturedBindings.has('scene'))){this.unsupported.push('scene.tileHitFrom refers to a shadowed scene binding');return '0';}
            if(api==='scene.tileHitFrom' && args.length===2)return `arcade sprite (${this.expr(args[0])}) wall hit index (${this.expr(args[1])})`;
            if(node.callee?.type==='Member' && node.callee.name==='tileHitFrom' && this.spriteReferences?.has(node.callee.object) && args.length===1)return `arcade sprite (${this.expr(node.callee.object)}) wall hit index (${this.expr(args[0])})`;
            if(api==='tiles.getTileLocation' && args.length===2)return `arcade tile location column (${this.expr(args[0])}) row (${this.expr(args[1])})`;
            if(api==='tiles.getRandomTileByType' && args.length===1)return `arcade random tile location of image (${this.expr(args[0])})`;
            if(node.callee?.type==='Member' && node.callee.name==='tilemapLocation' && args.length===0 && this.spriteReferences?.has(node.callee.object))return `arcade tile location of sprite (${this.expr(node.callee.object)})`;
            if(node.callee?.type==='Member' && node.callee.name==='getNeighboringLocation' && args.length===1 && this.tileReferences?.has(node.callee.object))return `arcade tile neighbor (${this.expr(args[0])}) of (${this.expr(node.callee.object)})`;
            if(api==='tiles.getTilesByType' && args.length===1){this.usesArrays=true;return `arcade tile array image (${this.expr(args[0])})`;}
            if(api==='tiles.tileAtLocationEquals' && args.length===2)return `arcade tile (${this.expr(args[0])}) equals image (${this.expr(args[1])})`;
            if(api==='tiles.tileAtLocationIsWall' && args.length===1)return `arcade tile (${this.expr(args[0])}) is wall`;
            if(['tiles.getTileImage','tiles.tileImageAtLocation'].includes(api) && args.length===1)return `arcade tile image at (${this.expr(args[0])})`;
            if(api==='tiles.getTileAt' && args.length===2)return `arcade tile image at (arcade tile location column (${this.expr(args[0])}) row (${this.expr(args[1])}))`;
            if(node.callee?.type==='Member' && this.tilemapDataReferences?.has(node.callee.object)) {
                const data=this.expr(node.callee.object);
                if(node.callee.name==='getTile' && args.length===2)return `arcade tilemap (${data}) tile index at column (${this.expr(args[0])}) row (${this.expr(args[1])})`;
                if(node.callee.name==='isWall' && args.length===2)return `arcade tilemap (${data}) wall at column (${this.expr(args[0])}) row (${this.expr(args[1])})`;
                if(node.callee.name==='getTileImage' && args.length===1)return `arcade tilemap (${data}) image of tile index (${this.expr(args[0])})`;
                if(node.callee.name==='getTileset' && args.length===0){this.usesArrays=true;return `arcade tilemap (${data}) tileset`;}
            }
            if(node.callee?.type==='Member' && this.sceneTilemapReferences?.has(node.callee.object)) {
                const map=this.expr(node.callee.object);
                if(['areaWidth','areaHeight'].includes(node.callee.name) && args.length===0)return `arcade scene tilemap ${node.callee.name} of (${map})`;
                // PXT TileMap.getTileIndex(col, row) is this.data.getTile(col, row).
                if(node.callee.name==='getTileIndex' && args.length===2)return `arcade tilemap (arcade scene tilemap data of (${map})) tile index at column (${this.expr(args[0])}) row (${this.expr(args[1])})`;
                this.unsupported.push(`tiles.TileMap.${node.callee.name}() is not a supported scene TileMap method`);return '0';
            }
            if(node.callee?.type==='Member' && this.tileReferences?.has(node.callee.object) && args.length===0){
                if(node.callee.name==='getImage')return `arcade tile image at (${this.expr(node.callee.object)})`;
                if(node.callee.name==='isWall')return `arcade tile (${this.expr(node.callee.object)}) is wall`;
            }
        }
        if (node?.type==='Call' && this.handleTemplates && this.path(node.callee)==='sprites.allOfKind') {
            this.usesArrays=true;
            const kind=node.args?.[0];
            if(node.args.length!==1 || !fixedKind(kind)) {
                this.unsupported.push('sprites.allOfKind requires a supported SpriteKind member or fixed negative numeric kind');return '0';
            }
            return `arcade sprite array kind ${this.kindSlot(kind)}`;
        }
        if(node?.type==='Index' && this.planImageValue)this.planImageValue(node);
        if (node?.type==='Index' && this.isArrayReference(node.object) && !this.imageValueResources.has(node)) return `item (${this.expr(node.index)}) of array reference (${this.expr(node.object)})`;
        if (node?.type==='Member' && node.name==='length' && this.isArrayReference(node.object)) return `length of array reference (${this.expr(node.object)})`;

        if (node?.type === 'Template' && this.planImageValue) this.planImageValue(node);
        if (this.imageValueResources.has(node)) return this.imageRef(node);
        // The Arcade exporter writes a Scratch join as `"" + left + right`.
        // Preserve its string coercion and block shape on the way back in.
        if (node?.type === 'Binary' && node.op === '+' &&
            node.left?.type === 'Binary' && node.left.op === '+' &&
            node.left.left?.type === 'String' && node.left.left.value === '') {
            return `${this.expr(node.left.right)} join ${this.expr(node.right)}`;
        }
        if (node?.type === 'Identifier' && this.currentParameters?.has(node.name)) return `arcade local ${this.varName(node.name)}`;
        if (node?.type === 'Identifier' && this.localVars?.has(node.name)) {
            return `arcade local ${node.name}`;
        }
        if (node?.type === 'Identifier' && this.capturedBindings.has(node.name)) return `arcade captured ${this.capturedBindings.get(node.name)}`;
        if (node?.type === 'Member' && node.name === 'length' && node.object?.type === 'Call' &&
            this.path(node.object.callee) === 'sprites.allOfKind') {
            return `arcade count kind ${this.kindSlot(node.object.args?.[0])}`;
        }
        if (node?.type === 'Identifier' && this.handleAliases.has(node.name)) {
            return this.handleAliases.get(node.name);
        }
        const image = node?.type === 'Member' && this.imageRef(node.object, true, false);
        // PXT's screen is always 160x120: its size folds to constants below.
        if (image && image !== 'arcade screen image' && ['width', 'height'].includes(node.name)) return `arcade image ${node.name} of (${image})`;
        const handle = node?.type === 'Member' && this.handleRef(node.object);
        if (handle) {
            if (['x', 'y', 'left', 'right', 'top', 'bottom', 'vx', 'vy', 'ax', 'ay', 'fx', 'fy', 'sx', 'sy', 'scale',
                'width', 'height', 'z', 'lifespan', 'rotation', 'rotationDegrees', 'data', 'flags'].includes(node.name)) {
                return `arcade property ${node.name} of ${handle}`;
            }
            if (node.name === 'image') return `arcade image of ${handle}`;
            this.unsupported.push(`${this.path(node)} — unsupported Arcade handle property`);
            return '0';
        }
        if(node?.type==='Member' && this.dataReferences?.has(node.object)) {
            this.unsupported.push(`Sprite.data.${node.name} requires arbitrary object member support`);return 'undefined value';
        }
        if (node && node.type === 'Member' && node.object.type === 'Identifier' &&
            node.object.name === 'screen') {
            if (node.name === 'width') return String(HALF_WIDTH * 2);
            if (node.name === 'height') return String(HALF_HEIGHT * 2);
        }
        if (node && node.type === 'Member') {
            const owner = this.resolveSprite(node.object);
            if (owner) {
                const mine = owner === this.self;
                const suffix = mine ? '' : ` of ${owner.name}`;
                if (node.name === 'x') return `(x position${suffix} / ${SCALE} + ${HALF_WIDTH})`;
                if (node.name === 'y') return `(${HALF_HEIGHT} - y position${suffix} / ${SCALE})`;
                if (node.name === 'vx' || node.name === 'vy') return `${owner.name}_${node.name}`;
                // A sprite's size is a CONSTANT here: we decoded its
                // picture to build the costume, so the number the game
                // wants for its bounds arithmetic is exactly known.
                if (node.name === 'width' && owner.width) return String(owner.width);
                if (node.name === 'height' && owner.height) return String(owner.height);
                // The edges follow from the centre and the size, in the
                // Arcade units the surrounding arithmetic is written in.
                if (owner.width && owner.height) {
                    const x = mine ? `(x position / ${SCALE} + ${HALF_WIDTH})` :
                        `(x position of ${owner.name} / ${SCALE} + ${HALF_WIDTH})`;
                    const y = mine ? `(${HALF_HEIGHT} - y position / ${SCALE})` :
                        `(${HALF_HEIGHT} - y position of ${owner.name} / ${SCALE})`;
                    if (node.name === 'left') return `${x} - ${owner.width / 2}`;
                    if (node.name === 'right') return `${x} + ${owner.width / 2}`;
                    if (node.name === 'top') return `${y} - ${owner.height / 2}`;
                    if (node.name === 'bottom') return `${y} + ${owner.height / 2}`;
                }
                this.unsupported.push(`${owner.name}.${node.name} — no stage equivalent`);
                return '0';
            }
        }
        // A sprite property on something we could NOT resolve to a sprite —
        // `collisionPaddle.width`, where the variable holds whichever paddle
        // was hit — used to fall through to the base and become a variable
        // literally named `width`. That reads as a working program and is
        // not one.
        if (node && node.type === 'Member' && SPRITE_PROPERTIES.has(node.name)) {
            const owner = node.object.type === 'Identifier' ? node.object.name : 'a value';
            this.unsupported.push(
                `${owner}.${node.name} — a sprite held in a variable, which the stage cannot follow`);
            return '0';
        }
        // \`sprites.dungeon.someTile\`: built-in art we do not carry (an extension's
        // namespace, or one newer than the pinned bundle). Falling through made a
        // variable named \`someTile\` that silently held 0.
        if (node && node.type === 'Member' && !BUILTIN_IMAGES[this.path(node)] &&
            BUILTIN_IMAGE_GROUPS.has(this.path(node.object))) {
            this.unsupported.push(`${this.path(node)} — built-in image art not available`);
            return '0';
        }
        return super.expr(node);
    }

    command (node, indent, out) {
        const pad = '  '.repeat(indent);
        const drawing=literalRenderablePacket(this,node);
        if(drawing){out.push(`${pad}arcade add drawing commands (${JSON.stringify(JSON.stringify(drawing))}) at depth 0`);return;}
        if(node?.callee?.type==='Member' && this.physicsEngineReferences?.has(node.callee.object)) {
            if(node.callee.name==='setMaxSpeed' && node.args?.length===1){out.push(`${pad}arcade set physics engine property maxSpeed of (${this.expr(node.callee.object)}) to (${this.expr(node.args[0])})`);return;}
            out.push(`${pad}${this.note(`Arcade PhysicsEngine.${node.callee.name} requires native PhysicsEngine method support`)}`);return;
        }
        if(node?.callee?.type==='Member' && this.sceneReferences?.has(node.callee.object)) {
            out.push(`${pad}${this.note(`Arcade Scene.${node.callee.name} requires native Scene method support`)}`);return;
        }

        const push = line => out.push(pad + line);
        const name = this.path(node.callee);
        const a = node.args || [];
        if(this.objectStatement(node,push))return;
        if(name?.startsWith('mp.') && (this.boundSourceGlobals?.has('mp') || this.sourceFunctions?.has('mp') || this.localVars?.has('mp') || this.currentParameters?.has('mp') || this.capturedBindings.has('mp'))) {push(this.note(`${name} refers to a shadowed mp binding`));return;}
        if(['mp.setPlayerState','mp.changePlayerStateBy'].includes(name) && a.length===3){push(name==='mp.setPlayerState'?`arcade set state (${this.expr(a[1])}) of player (${this.expr(a[0])}) to (${this.expr(a[2])})`:`arcade change state (${this.expr(a[1])}) of player (${this.expr(a[0])}) by (${this.expr(a[2])})`);return;}
        if(name==='mp.moveWithButtons' && a.length>=1 && a.length<=3){push(`arcade move player (${this.expr(a[0])}) with buttons vx (${a[1]?this.expr(a[1]):100}) vy (${a[2]?this.expr(a[2]):100})`);return;}
        if(name==='mp.setPlayerSprite' && a.length===2){push(`arcade set sprite of player (${this.expr(a[0])}) to (${this.expr(a[1])})`);return;}
        if(name==='controller.setRepeatDefault' && this.handleTemplates) {
            if(this.bindsName('controller'))push(this.note('controller.setRepeatDefault refers to a shadowed controller binding'));
            else if(a.length!==2)push(this.note('controller.setRepeatDefault requires delay and interval'));
            else push(`arcade set button repeat defaults delay (${this.expr(a[0])}) interval (${this.expr(a[1])})`);
            return;
        }
        if(name==='controller.pauseUntilAnyButtonIsPressed' && this.handleTemplates && !this.bindsName('controller')) {
            if(!a.length)push('arcade wait until any button pressed');
            else push(this.note('controller.pauseUntilAnyButtonIsPressed requires no arguments'));
            return;
        }
        if(this.handleTemplates && !this.bindsName('sprites')) {
            const dataSet=/^sprites\.setData(Number|String|Boolean|Sprite)$/.exec(name||'');
            if(dataSet || name==='sprites.changeDataNumberBy') {
                if(a.length!==3){push(this.note(`${name} requires a sprite, data key and value`));return;}
                const receiver=`(${this.expr(a[0])})`,key=`(${this.expr(a[1])})`,value=`(${this.arrayElementValue(a[2])})`;
                push(dataSet?`arcade set sprite ${receiver} data ${key} type ${dataSet[1]} to ${value}`:
                    `arcade change sprite ${receiver} number data ${key} by ${value}`);
                return;
            }
        }
        if(this.settingsStatement(name,a,push))return;
        // Lite's own export's stop machinery, lifted back by liftExporterStops.
        if (name === '__bwStopAll') { push('stop all'); return; }
        if (name === '__bwStopOthers') { push('stop other scripts in sprite'); return; }
        if (this.functions.some(fn=>fn.name===name)) {
            const fn=this.sourceFunctions?.get(name),actual=[...a];
            // Ordinary optional calls were already padded by the call-site
            // omission proof. A refused default/escaped declaration must keep
            // its original arguments; rendering cannot manufacture that proof.
            // The separate creation-event protocol retains its existing ABI.
            if(this.handleTemplates && fn && a.length<fn.params.length){
                if(fn.params.slice(a.length).some(param=>!fn.optionalParams?.includes(param)))this.unsupported.push(`${name}() argument count differs from its declaration`);
                while(actual.length<fn.params.length)actual.push({type:'Undefined'});
            }
            if(this.classCallableFactoryFunctions.has(name)){
                if(!fn||actual.length!==fn.params.length){push(this.note('Class callable factory argument mapping differs'));return;}
                let args='"[]"';for(let index=actual.length-1;index>=0;index--)args=`arcade function argument (${this.arrayElementValue(actual[index])}) rest (${args})`;
                const code=[fn.name,...fn.params.map(()=>'%s')].join(' ');
                const discarded=this.freshName('__bwDiscardCallableFactoryResult');
                push(`arcade set local ${discarded} to (arcade call function ${JSON.stringify(code)} arguments (${args}))`);return;
            }
            const values=actual.map(arg=>`(${this.arrayElementValue(arg)})`);
            push(`CALL: (${[name,...values].join(' ')})`);return;
        }

        if(['pauseUntil','control.waitUntil'].includes(name)) {
            const predicate=a[0];
            if(a.length===1 && predicate?.type==='FunctionExpression' && !predicate.params.length && predicate.body.length===1 && predicate.body[0].type==='Return')push(`wait until ${this.repeatedCondition(predicate.body[0].value)}`);
            else push(this.note(`${name}() requires a pure predicate callback`));
            return;
        }
        if (name === 'scene.setBackgroundImage' && a.length === 1) {
            const image = a[0]?.type === 'Null' ? '""' : this.imageRef(a[0]);
            if (image) push(`arcade set background image (${image})`);
            else push(this.note('scene.setBackgroundImage() with art we could not read'));
            return;
        }
        const directController = /^controller(?:\.player([1-4]))?\.(moveSprite|stopControllingSprite)$/.exec(name || '');
        if (directController && (directController[1] || directController[2]==='moveSprite')) {
            if (this.boundSourceGlobals?.has('controller') || this.sourceFunctions?.has('controller') || this.localVars?.has('controller') || this.currentParameters?.has('controller') || this.capturedBindings.has('controller')) {
                push(this.note(`${name} refers to a shadowed controller binding`));return;
            }
            const stopping=directController[2]==='stopControllingSprite';
            if (!a.length || a.length>(stopping?1:3)) {push(this.note(`${name}() requires a sprite${stopping?'':' and at most two speeds'}`));return;}
            const sprite=this.handleRef(a[0]) || (a[0]?.type==='Null'?'null':null);
            if (!sprite) {push(this.note(`${name}() requires a supported sprite handle`));return;}
            if (stopping) push(`arcade controller ${directController[1] || 1} stop controlling sprite (${sprite})`);
            else if (directController[1]) push(`arcade controller ${directController[1]} move sprite (${sprite}) vx (${a[1]?this.expr(a[1]):100}) vy (${a[2]?this.expr(a[2]):100})`);
            else push(`arcade control sprite (${sprite}) vx (${a[1]?this.expr(a[1]):100}) vy (${a[2]?this.expr(a[2]):100})`);
            return;
        }
        if (name === 'sprites.onCreated') {
            if (!fixedKind(a[0])) {
                push(this.note('sprites.onCreated() runtime kind expressions need support'));return;
            }
            const registration = this.createdRegistrations.get(node);
            if (registration && this.handleTemplates) push(`arcade register creation kind ${this.kindSlot(a[0])} as "${registration.token}" capturing ${JSON.stringify([...registration.ownCaptures].join(' '))}`);
            else push(this.note('sprites.onCreated() needs a supported callback'));
            return;
        }
        if(this.handleTemplates && name==='scene.onHitTile' && (this.boundSourceGlobals?.has('scene') || this.sourceFunctions?.has('scene') || this.localVars?.has('scene') || this.currentParameters?.has('scene') || this.capturedBindings.has('scene'))){push(this.note('scene.onHitTile refers to a shadowed scene binding'));return;}
        if(this.handleTemplates && ['scene.onHitWall','scene.onOverlapTile','scene.onHitTile'].includes(name)) {
            const registration=this.terrainRegistrations.get(node);
            if(!registration){push(this.note(`${name} requires a fixed SpriteKind, exact arguments and an inline callback with at most two parameters`));return;}
            const captures=JSON.stringify([...registration.ownCaptures].join(' '));
            if(registration.kind==='legacyWall')push(`arcade register color wall kind ${this.kindSlot(a[0])} index (${this.expr(a[1])}) as "${registration.token}" capturing ${captures}`);
            else if(registration.kind==='wall')push(`arcade register wall kind ${this.kindSlot(a[0])} as "${registration.token}" capturing ${captures}`);
            else push(`arcade register tile kind ${this.kindSlot(a[0])} image (${this.expr(a[1])}) as "${registration.token}" capturing ${captures}`);
            return;
        }
        if(this.handleTemplates && name==='tiles.addEventListener') {
            const registration=this.terrainRegistrations.get(node),event=/^(?:tiles\.)?TileMapEvent\.(Loaded|Unloaded)$/.exec(this.path(a[0])||'')?.[1];
            if(!registration || !event){push(this.note('tiles.addEventListener requires tiles.TileMapEvent.Loaded or Unloaded and an inline callback with at most one parameter'));return;}
            push(`arcade register tilemap event ${event} as "${registration.token}" capturing ${JSON.stringify([...registration.ownCaptures].join(' '))}`);return;
        }
        if(this.handleTemplates && name==='tiles.removeEventListener') {
            const event=/^(?:tiles\.)?TileMapEvent\.(Loaded|Unloaded)$/.exec(this.path(a[0])||'')?.[1],named=a[1]?.bwNamedCallback;
            if(a.length!==2 || !event || !(named || a[1]?.type==='FunctionExpression')){push(this.note('tiles.removeEventListener requires tiles.TileMapEvent.Loaded or Unloaded and a named function'));return;}
            // An inline function is a new callback value that no listener holds: PXT removes nothing.
            if(named)push(`arcade unregister tilemap event ${event} as "${tilemapFunctionToken(named)}"`);
            return;
        }
        if(this.handleTemplates && ['game.pushScene','game.popScene'].includes(name)) {
            if(a.length){push(this.note(`${name} requires no arguments`));return;}
            push(name==='game.pushScene'?'arcade push scene':'arcade pop scene');return;
        }
        if(this.handleTemplates && /^info\.(showScore|showLife|showCountdown)$/.test(name||'')) {
            if(this.bindsName('info')){push(this.note(`${name} refers to a shadowed info binding`));return;}
            if(a.length!==1){push(this.note(`${name} requires one Boolean visibility value`));return;}
            const element=name.slice('info.show'.length).toLowerCase();
            push(`arcade set hud ${element} visible ${this.boolSlot(a[0])}`);return;
        }
        if(this.handleTemplates && /^info(?:\.player[1-4])?\.(setLife|changeLifeBy)$/.test(name||'')) {
            if(a.length!==1){push(this.note(`${name} requires one life value`));return;}
            push(name.endsWith('.setLife')?`arcade set life player (${playerOf(name)}) to (${this.expr(a[0])})`:`arcade change life player (${playerOf(name)}) by (${this.expr(a[0])})`);return;
        }
        if(this.handleTemplates && /^info(?:\.player[1-4])?\.(setScore|changeScoreBy)$/.test(name||'')) {
            if(a.length!==1){push(this.note(`${name} requires one score value`));return;}
            push(name.endsWith('.setScore')?`arcade set score player (${playerOf(name)}) to (${this.expr(a[0])})`:`arcade change score player (${playerOf(name)}) by (${this.expr(a[0])})`);return;
        }
        if(isFrameRegistration(name) && (this.boundSourceGlobals?.has('game') || this.sourceFunctions?.has('game') || this.localVars?.has('game') || this.currentParameters?.has('game') || this.capturedBindings.has('game'))){push(this.note(`${name} refers to a shadowed game binding`));return;}
        if(isButtonRegistration(name) && (this.boundSourceGlobals?.has('controller') || this.sourceFunctions?.has('controller') || this.localVars?.has('controller') || this.currentParameters?.has('controller') || this.capturedBindings.has('controller'))){push(this.note(`${name} refers to a shadowed controller binding`));return;}
        if(isInfoRegistration(name) && (this.boundSourceGlobals?.has('info') || this.sourceFunctions?.has('info') || this.localVars?.has('info') || this.currentParameters?.has('info') || this.capturedBindings.has('info'))){push(this.note(`${name} refers to a shadowed info binding`));return;}
        if(isForeverRegistration(name) || isParallelLaunch(name)){
            const binding=name.split('.')[0];
            if(this.boundSourceGlobals?.has(binding) || this.sourceFunctions?.has(binding) || this.localVars?.has(binding) || this.currentParameters?.has(binding) || this.capturedBindings.has(binding)){push(this.note(`${name} refers to a shadowed ${binding} binding`));return;}
        }
        if(isSpriteRegistration(name)){
            for(const binding of ['sprites','SpriteKind'])if(this.boundSourceGlobals?.has(binding) || this.sourceFunctions?.has(binding) || this.localVars?.has(binding) || this.currentParameters?.has(binding) || this.capturedBindings.has(binding)){push(this.note(`${name} refers to a shadowed ${binding} binding`));return;}
        }
        if(name==='control.allocateNotifyEvent'){
            if(a.length){push(this.note('control.allocateNotifyEvent requires no arguments'));return;}if(!this.discardedEventSourceName){let n=0,name;do{name=`__bwDiscardedEventSource${++n}`;}while(this.taken.has(name));this.taken.add(name);this.discardedEventSourceName=name;}push(`set ${this.discardedEventSourceName} to (${this.expr(node)})`);return;
        }
        if(/^control\.(?:onEvent|raiseEvent|waitForEvent)$/.test(name||'')) {
            if(this.boundSourceGlobals?.has('control') || this.sourceFunctions?.has('control') || this.localVars?.has('control') || this.currentParameters?.has('control') || this.capturedBindings.has('control')){push(this.note(`${name} refers to a shadowed control binding`));return;}
            if(name!=='control.onEvent'){
                if(a.length!==2){push(this.note(`${name} requires exactly two event identity arguments`));return;}
                push(`arcade ${name==='control.raiseEvent'?'raise control event':'wait for control event'} source (${this.expr(a[0])}) value (${this.expr(a[1])})`);return;
            }
        }
        const sceneSpec=(this.sceneStackProgram || isIndependentRegistration(name)) && sceneRegistrationSpec(name,node);
        if(this.handleTemplates && sceneSpec) {
            const registration=this.sceneRegistrations.get(node);
            if(!registration){push(this.note(isParallelLaunch(name)?'control.runInParallel requires one inline callback without parameters':`${name} requires exact arguments, fixed sprite kinds and a supported inline callback; lifecycle oldScene access is not yet supported`));return;}
            const suffix=`as "${registration.token}" capturing ${JSON.stringify([...registration.ownCaptures].join(' '))}`;
            switch(registration.kind) {
            case 'playerConnection':{const connection=playerConnectionRegistration(node);push(`arcade register control event source (arcade controller event source player ${connection.player}) value (${connection.event}) flags (16) ${suffix}`);break;}
            case 'controlEvent':push(`arcade register control event source (${this.expr(a[0])}) value (${this.expr(a[1])}) flags (${a[3]?this.expr(a[3]):'16'}) ${suffix}`);break;
            case 'update':push(`arcade register update ${suffix}`);break;
            case 'paint':push(`arcade register paint ${suffix}`);break;
            case 'shade':push(`arcade register shade ${suffix}`);break;
            case 'forever':push(`arcade register forever ${suffix}`);break;
            case 'parallel':push(`arcade run parallel ${suffix}`);break;
            case 'lifeZero':push(`arcade register life zero player (${playerOf(name)}) ${suffix}`);break;
            case 'score':push(`arcade register score player (${SCORE_REGISTRATION_APIS.get(name)}) threshold (${this.expr(a[0])}) ${suffix}`);break;
            case 'countdown':push(`arcade register countdown ${suffix}`);break;
            case 'interval':push(`arcade register interval (${this.expr(a[0])}) ${suffix}`);break;
            case 'multiplayerConnection':push(`arcade register multiplayer connection event (${this.expr(a[0])}) ${suffix}`);break;
            case 'multiplayerButton':push(`arcade register multiplayer button (${this.expr(a[0])}) event (${this.expr(a[1])}) ${suffix}`);break;
            case 'button':{const playerButton=playerButtonRegistration(node);if(playerButton){push(`arcade register player (${playerButton.player}) button ${JSON.stringify(playerButton.button)} event (${playerButton.event}) ${suffix}`);break;}push(`arcade register button "${/^controller\.(\w+)\./.exec(name)[1]}" event (${this.expr(a[0])}) ${suffix}`);break;}
            case 'destroyed':push(`arcade register destroyed kind ${this.kindSlot(a[0])} ${suffix}`);break;
            case 'overlap':push(`arcade register overlap kind ${this.kindSlot(a[0])} with kind ${this.kindSlot(a[1])} ${suffix}`);break;
            case 'scenePush':push(`arcade register scene push ${suffix}`);break;
            case 'scenePop':push(`arcade register scene pop ${suffix}`);break;
            }
            return;
        }
        if(this.scrollerStatement(name,a,push))return;
        if(this.characterStatement(name,a,push))return;
        if(this.textSpriteStatement(node,a,push))return;
        if(this.spriteExtensionStatement(node,a,push))return;
        if(this.sevensegStatement(node,a,push))return;
        if(this.musicStatement(name,a,push,node))return;
        if(this.carnivalStatement(name,a,push))return;
        if(name==='game.reset'){if(gameResetIntrinsic(node))push('arcade reset game');else push(this.note('game.reset requires an unchanged builtin, no arguments and a standalone statement'));return;}
        if(this.gameOverStatement(name,a,push))return;
        const screenEffect=/^effects\.(\w+)\.(startScreenEffect|endScreenEffect)$/.exec(name||'');
        if(this.handleTemplates && screenEffect && IMAGE_EFFECTS.has(screenEffect[1]) && screenEffect[2]==='startScreenEffect') {
            if(a.length>2){push(this.note('ImageEffect.startScreenEffect() takes times and delay'));return;}
            push(`arcade start image effect ${screenEffect[1]} times (${a[0]?this.expr(a[0]):0}) delay (${a[1]?this.expr(a[1]):0}) ms`);return;
        }
        if(this.handleTemplates && screenEffect) {
            if(!SCREEN_PARTICLE_EFFECTS.has(screenEffect[1])){push(this.note(`effects.${screenEffect[1]}.${screenEffect[2]}() — not a screen effect`));return;}
            if(screenEffect[2]==='endScreenEffect'){
                if(a.length)push(this.note('ScreenEffect.endScreenEffect() takes no arguments'));
                else push(`arcade end screen effect ${screenEffect[1]}`);
                return;
            }
            if(a.length>1){push(this.note('ScreenEffect.startScreenEffect() particles per second — not represented'));return;}
            push(`arcade start screen effect ${screenEffect[1]} for (${a[0]?this.expr(a[0]):0}) ms`);return;
        }
        if(this.handleTemplates && name==='effects.clearParticles') {
            const target=a.length===1 && this.handleRef(a[0]);
            if(!target){push(this.note('effects.clearParticles() requires one sprite'));return;}
            push(`arcade clear effects on ${target}`);return;
        }
        if(this.handleTemplates && name==='scene.cameraShake') {
            if(a.length>2){push(this.note('scene.cameraShake accepts amplitude and duration only'));return;}
            push(`arcade shake camera by (${a[0]?this.expr(a[0]):4}) pixels for (${a[1]?this.expr(a[1]):500}) ms`);return;
        }
        if(this.handleTemplates && name==='scene.centerCameraAt') {
            if(a.length!==2){push(this.note('scene.centerCameraAt requires x and y coordinates'));return;}
            push(`arcade center camera x (${this.expr(a[0])}) y (${this.expr(a[1])})`);return;
        }
        if(this.handleTemplates && name==='scene.cameraFollowSprite') {
            if(a.length!==1){push(this.note('scene.cameraFollowSprite requires one sprite or null'));return;}
            const sprite=a[0],handle=this.handleRef(sprite);
            if(!handle && sprite.type!=='Null' && !this.nullReferences?.has(sprite)){push(this.note('scene.cameraFollowSprite requires a typed sprite reference or null'));return;}
            push(`arcade camera follow sprite (${handle || this.expr(sprite)})`);return;
        }
        if (name === 'image.setPalette' && a.length === 1) {
            const buffer=a[0];
            if(buffer.type==='Template' && buffer.tag==='hex') {
                const hex=buffer.value.replace(/\s/g,'');
                if(!/^[0-9a-f]{96}$/i.test(hex)){push(this.note('image.setPalette requires exactly 48 RGB bytes'));return;}
                push(`arcade set palette hex "${hex.toLowerCase()}"`);return;
            }
            if(buffer.type==='Call' && this.path(buffer.callee)==='Buffer.fromHex' && buffer.args.length===1) {
                const data=buffer.args[0];
                if(data.type==='String' && !/^[0-9a-f]{96}$/i.test(data.value)) {
                    push(this.note('image.setPalette Buffer.fromHex requires exactly 96 hex digits without whitespace'));return;
                }
                push(`arcade set palette hex (${this.expr(data)})`);return;
            }
            push(this.note('image.setPalette requires a hex literal or Buffer.fromHex expression'));return;
        }
        if (name === 'scene.setBackgroundColor' && a.length === 1) {
            push(`arcade set background color to ${this.expr(a[0])}`);
            return;
        }
        if(this.handleTemplates && name==='animation.attachAnimation' && a.length===2){push(`arcade attach animation (${this.expr(a[1])}) to sprite (${this.expr(a[0])})`);return;}
        if(this.handleTemplates && name==='animation.setAction' && a.length===2){push(`arcade set animation action of (${this.expr(a[0])}) to (${this.expr(a[1])})`);return;}
        if(this.handleTemplates && name==='animation.runImageAnimation' && a.length>=2 && a.length<=4){
            // Pinned game/animation.ts applies frameInterval || 500 and !!loop.
            // Preserve provided operands for the runtime's coercion and evaluate
            // each once; only omitted operands acquire these default literals.
            const interval=a[2] || {type:'Number',value:500};
            const loop=a[3] || {type:'Boolean',value:false};
            push(`arcade animate sprite (${this.expr(a[0])}) frames (${this.expr(a[1])}) interval (${this.expr(interval)}) loop (${this.expr(loop)})`);return;
        }
        if(this.handleTemplates && name==='animation.stopAnimation' && a.length===2){
            const fixed=this.path(a[0]),types={'animation.AnimationTypes.All':0,'animation.AnimationTypes.ImageAnimation':1,'animation.AnimationTypes.MovementAnimation':2};
            if(fixed?.startsWith('animation.AnimationTypes.') && !Object.prototype.hasOwnProperty.call(types,fixed)){push(this.note(`${fixed} is not a declared Arcade AnimationTypes member`));return;}
            push(`arcade stop animations of (${this.expr(a[1])}) type (${Object.prototype.hasOwnProperty.call(types,fixed)?types[fixed]:this.expr(a[0])})`);return;
        }
        if(this.handleTemplates && node.callee?.type==='Member' && node.callee.name==='addAnimationFrame' && this.animationReferences?.has(node.callee.object) && a.length===1){push(`arcade add animation frame (${this.expr(node.callee.object)}) image (${this.expr(a[0])})`);return;}
        if(this.handleTemplates && node.callee?.type==='Member' && node.callee.name==='setInterval' && this.animationReferences?.has(node.callee.object) && a.length===1){push(`arcade set animation interval (${this.expr(node.callee.object)}) to (${this.expr(a[0])})`);return;}
        if(this.handleTemplates && ['scene.setTileMap','scene.setTile','scene.setTileAt','scene.place','scene.placeOnRandomTile'].includes(name) && (this.boundSourceGlobals?.has('scene') || this.sourceFunctions?.has('scene') || this.localVars?.has('scene') || this.currentParameters?.has('scene') || this.capturedBindings.has('scene'))) {push(this.note(`${name} refers to a shadowed scene binding`));return;}
        if(this.handleTemplates && ['scene.setTileAt','scene.place','scene.placeOnRandomTile'].includes(name)) {
            if(a.length!==2){push(this.note(`${name} requires two arguments`));return;}
            if(name==='scene.setTileAt')push(`arcade set color tile (${this.expr(a[0])}) index (${this.expr(a[1])})`);
            else if(name==='scene.place')push(`arcade on color tile (${this.expr(a[0])}) place sprite (${this.expr(a[1])})`);
            else push(`arcade place sprite (${this.expr(a[0])}) on random color tile (${this.expr(a[1])})`);
            return;
        }
        if(this.handleTemplates && node.callee?.type==='Member' && node.callee.name==='place' && this.legacyTileReferences?.has(node.callee.object) && a.length===1){push(`arcade on color tile (${this.expr(node.callee.object)}) place sprite (${this.expr(a[0])})`);return;}
        if(this.handleTemplates && name==='scene.setTileMap') {
            if(a.length<1 || a.length>2){push(this.note('scene.setTileMap requires an image and optional tile scale'));return;}
            const scale=a[1]?this.expr(a[1]):'4';
            push(`arcade set color-coded map image (${this.expr(a[0])}) scale (${scale})`);return;
        }
        if(this.handleTemplates && name==='scene.setTile') {
            if(a.length<2 || a.length>3){push(this.note('scene.setTile requires an index, image and optional wall flag'));return;}
            push(`arcade set color tile (${this.expr(a[0])}) image (${this.expr(a[1])}) wall (${a[2]?this.expr(a[2]):'false'})`);return;
        }
        if(this.handleTemplates && ['tiles.setTilemap','tiles.setCurrentTilemap','scene.setTileMapLevel'].includes(name)) {
            const value=a[0];
            if(a.length===1 && value?.type==='Null'){push('arcade set tilemap data \"null\"');return;}
            let data;
            if(value?.type==='Template' && /^(tilemap|assets\.tilemap)$/.test(value.tag||'')) {
                if(a.length!==1 || value.value.includes('${')){push(this.note(`${name}() requires a literal tilemap name`));return;}
                const resolved=resolveNativeTilemap(this.tilemaps,value.value);
                if(resolved.unsupported.length){push(this.note(`${name}(): ${resolved.unsupported.join('; ')}`));return;}
                data=resolved.value;
                if(data===null){push('arcade set tilemap data \"null\"');return;}
            } else if(a.length===1 && value && !(value.type==='Call' && this.path(value.callee)==='tiles.createTilemap') && this.tilemapDataReferences?.has(value)) {
                push(`arcade set tilemap data (${this.expr(value)})`);return;
            } else data=decodeTilemap(value,node=>this.imageOf(node),node=>this.path(node));
            if(a.length!==1 || !data){this.unsupported.push(`${name}() requires a readable literal tile map with wall layer and tile scale`);return;}
            // Terrain physics is measured frame by frame against the original
            // (test/makecode-arcade-terrain-trajectories.test.mjs).
            push(`arcade set tilemap data ${JSON.stringify(JSON.stringify(data))}`);
            return;
        }
        if(this.handleTemplates && node.callee?.type==='Member' && this.tilemapDataReferences?.has(node.callee.object) && ['setTile','setWall'].includes(node.callee.name) && a.length===3){
            const data=this.expr(node.callee.object);
            push(node.callee.name==='setTile'?`arcade set tilemap (${data}) tile index at column (${this.expr(a[0])}) row (${this.expr(a[1])}) to (${this.expr(a[2])})`:
                `arcade set tilemap (${data}) wall at column (${this.expr(a[0])}) row (${this.expr(a[1])}) to (${this.expr(a[2])})`);return;
        }
        if(this.handleTemplates && node.callee?.type==='Member' && node.callee.name==='place' && a.length===1 && this.tileReferences?.has(node.callee.object)){push(`arcade place sprite (${this.expr(a[0])}) on tile (${this.expr(node.callee.object)})`);return;}
        if(this.handleTemplates && name==='tiles.setTileAt' && a.length===2){push(`arcade set tile (${this.expr(a[0])}) image (${this.expr(a[1])})`);return;}
        if(this.handleTemplates && name==='tiles.setWallAt' && a.length===2){push(`arcade set tile wall (${this.expr(a[0])}) to (${this.expr(a[1])})`);return;}
        if(this.handleTemplates && name==='tiles.placeOnTile' && a.length===2){push(`arcade place sprite (${this.expr(a[0])}) on tile (${this.expr(a[1])})`);return;}
        if(this.handleTemplates && name==='tiles.placeOnRandomTile' && a.length===2){push(`arcade place sprite (${this.expr(a[0])}) on random tile image (${this.expr(a[1])})`);return;}
        if(name==='game.ask') {
            if(!this.discardedQuestionName){let n=0,name;do{name=`__bwDiscardedQuestion${++n}`;}while(this.taken.has(name));
                this.taken.add(name);this.discardedQuestionName=name;}
            push(`set ${this.discardedQuestionName} to ${this.callExpression(node)}`);return;
        }
        if (this.projectileTemplates.has(node)) {
            // Creation is a side effect even when the caller discards its handle.
            // Scratch reporters need a consuming command to execute. Use a
            // private target variable, with a name outside every source binding.
            if (!this.discardedProjectileName) {
                let suffix = 0, name;
                do { name = `__bwDiscardedProjectile${++suffix}`; } while (this.taken.has(name));
                this.taken.add(name);
                this.discardedProjectileName = name;
            }
            push(`set ${this.discardedProjectileName} to ${this.callExpression(node)}`);
            return;
        }
        if (this.handleTemplates && name === 'sprites.create') {
            push(`set __arcadeCreated to ${this.callExpression(node)}`);
            return;
        }
        if (name === 'sprites.destroy' && this.handleRef(a[0])) {
            this.destroyWithEffect(this.handleRef(a[0]), a.slice(1), 'sprites.destroy()', push);
            return;
        }
        const imageOwner = node.callee?.object;
        const imageHandle = imageOwner?.type === 'Member' && imageOwner.name === 'image' && this.handleRef(imageOwner.object);
        const resource = this.imageRef(imageOwner);
        if (resource && ['drawImage', 'drawTransparentImage'].includes(node.callee.name)) {
            const source = this.imageRef(a[0]);
            if (a.length !== 3 || !source) { push(this.note(`${name}() needs an image source and x/y offsets`));return; }
            push(`arcade blit image ${node.callee.name} (${resource}) source (${source}) x (${this.expr(a[1])}) y (${this.expr(a[2])})`);return;
        }
        if(resource && ['print','printCenter'].includes(node.callee.name)){
            const center=node.callee.name==='printCenter',fontIndex=center?3:4;
            if(a.length===fontIndex+1 && this.fontReferences?.has(a[fontIndex])){
                const text=this.expr(a[0]),color=this.expr(a[fontIndex-1]),font=this.expr(a[fontIndex]);
                push(center?`arcade print centered (${text}) on image (${resource}) y (${this.expr(a[1])}) color (${color}) using font (${font})`:
                    `arcade print (${text}) on image (${resource}) x (${this.expr(a[1])}) y (${this.expr(a[2])}) color (${color}) using font (${font})`);return;
            }
        }
        if(resource && node.callee.name==='print') {
            // Image.print(text, x, y, color?, font?): an omitted font is chosen by
            // image.getFontForText, an omitted color is 1.
            const fonts={'image.font5':'small','image.font8':'normal','image.font12':'large'};
            const font=a.length>4 ? fonts[this.path(a[4])] : 'auto';
            if(a.length<3 || a.length>5 || !font){push(this.note(`${name}() requires text, x and y, an optional color and image.font5/font8/font12`));return;}
            push(`arcade print (${this.expr(a[0])}) on image (${resource}) x (${this.expr(a[1])}) y (${this.expr(a[2])}) color (${a.length>3?this.expr(a[3]):0}) font ${font}`);return;
        }
        if(resource && node.callee.name==='copyFrom') {
            const source=this.imageRef(a[0]);
            if(a.length!==1 || !source){push(this.note(`${name}() requires one image source`));return;}
            push(`arcade copy pixels into image (${resource}) from (${source})`);return;
        }
        if(resource && node.callee.name==='scroll') {
            if(a.length!==2){push(this.note(`${name}() requires two scrolling offsets`));return;}
            push(`arcade scroll image (${resource}) x (${this.expr(a[0])}) y (${this.expr(a[1])})`);return;
        }
        if(resource && !imageHandle && ['drawCircle','fillCircle'].includes(node.callee.name)) {
            if(a.length!==4){push(this.note(`${name}() requires center x/y, radius and color`));return;}
            push(`arcade draw image circle ${node.callee.name} (${resource}) x ${this.expr(a[0])} y ${this.expr(a[1])} radius ${this.expr(a[2])} color ${this.expr(a[3])}`);return;
        }
        if (resource && !imageHandle && ['copyFrom', 'scroll', 'fill', 'replace', 'flipX', 'flipY', 'setPixel', 'fillRect', 'drawLine'].includes(node.callee.name)) {
            const operation = node.callee.name;
            const expected = {fill:1, replace:2, flipX:0, flipY:0, setPixel:3, fillRect:5, drawLine:5}[operation];
            if (a.length !== expected) { push(this.note(`${name}() requires ${expected} arguments`)); return; }
            if (operation === 'setPixel') push(`arcade set image pixel (${resource}) x ${this.expr(a[0])} y ${this.expr(a[1])} color ${this.expr(a[2])}`);
            else if (['fillRect', 'drawLine'].includes(operation)) push(`arcade draw image ${operation} (${resource}) x ${this.expr(a[0])} y ${this.expr(a[1])} width ${this.expr(a[2])} height ${this.expr(a[3])} color ${this.expr(a[4])}`);
            else push(`arcade mutate image ${operation} (${resource}) color ${a[0] ? this.expr(a[0]) : 0} replacement ${a[1] ? this.expr(a[1]) : 0}`);
            return;
        }
        if(imageHandle && ['drawCircle','fillCircle'].includes(node.callee.name)) {
            if(a.length!==4){push(this.note(`${name}() requires center x/y, radius and color`));return;}
            push(`arcade draw circle ${node.callee.name} of ${imageHandle} x ${this.expr(a[0])} y ${this.expr(a[1])} radius ${this.expr(a[2])} color ${this.expr(a[3])}`);return;
        }
        if (imageHandle && ['copyFrom', 'scroll', 'fill', 'replace', 'flipX', 'flipY', 'setPixel', 'getPixel', 'fillRect', 'drawLine', 'drawCircle', 'fillCircle', 'drawImage', 'drawTransparentImage', 'overlapsWith'].includes(node.callee.name)) {
            const operation = node.callee.name;
            if (operation === 'setPixel' && a.length === 3) {
                push(`arcade set pixel of ${imageHandle} x ${this.expr(a[0])} y ${this.expr(a[1])} color ${this.expr(a[2])}`);
                return;
            }
            if (['fillRect', 'drawLine'].includes(operation) && a.length === 5) {
                push(`arcade draw ${operation} of ${imageHandle} x ${this.expr(a[0])} y ${this.expr(a[1])} width ${this.expr(a[2])} height ${this.expr(a[3])} color ${this.expr(a[4])}`);
                return;
            }
            if (['setPixel', 'getPixel', 'fillRect', 'drawLine'].includes(operation)) {
                push(this.note(`${name}() — invalid drawing arguments or discarded pixel value`)); return;
            }
            const expected = operation === 'fill' ? 1 : operation === 'replace' ? 2 : 0;
            if (a.length !== expected) { push(this.note(`${name}() requires ${expected} arguments`)); return; }
            push(`arcade image ${operation} of ${imageHandle} color ${a[0] ? this.expr(a[0]) : 0} replacement ${a[1] ? this.expr(a[1]) : 0}`);
            return;
        }
        const handle = node.callee?.type === 'Member' && this.handleRef(node.callee.object);
        if (handle) {
            if (node.callee.name==='setScaleCore') {
                if(a.length>4)push(this.note('sprite.setScaleCore() requires up to four arguments'));
                else push(`arcade scale core of (${handle}) x (${a[0]?this.expr(a[0]):'undefined value'}) y (${a[1]?this.expr(a[1]):'undefined value'}) anchor (${a[2]?this.expr(a[2]):'0'}) proportional (${a[3]?this.expr(a[3]):'false'})`);
            }
            else if (['setScale','changeScale'].includes(node.callee.name)) {
                if(a.length<1 || a.length>2)push(this.note(`sprite.${node.callee.name}() requires one scale and optional anchor`));
                else push(`arcade ${node.callee.name==='setScale'?'set':'change'} scale of (${handle}) ${node.callee.name==='setScale'?'to':'by'} (${this.expr(a[0])}) anchor (${a[1]?this.expr(a[1]):'0'})`);
            }
            else if (node.callee.name === 'follow') {
                if(a.length<1 || a.length>3){push(this.note('sprite.follow() requires a target and optional speed/turn rate'));return;}
                const target=a[0],reference=this.handleRef(target);
                if(!reference && !['Null','Undefined'].includes(target.type) && !this.nullReferences?.has(target)){
                    push(this.note('sprite.follow() requires a typed sprite target or null'));return;
                }
                push(`arcade sprite (${handle}) follow (${reference || this.expr(target)}) speed (${a[1]?this.expr(a[1]):100}) turn rate (${a[2]?this.expr(a[2]):400})`);
            }
            else if (node.callee.name === 'unfollow') {
                if(a.length)push(this.note('sprite.unfollow() takes no arguments'));
                else push(`arcade sprite (${handle}) stop following`);
            }
            else if (node.callee.name === 'destroy') this.destroyWithEffect(handle, a, 'sprite.destroy()', push);
            else if (node.callee.name === 'startEffect') {
                const effect=a.length && a.length<=2 && this.particleEffect(a[0]);
                if(!effect)push(this.note('sprite.startEffect() requires a named effects.* particle effect and an optional duration'));
                else push(`arcade start effect ${effect} on ${handle} for (${a[1]?this.expr(a[1]):0}) ms`);
            }
            else if (node.callee.name === 'say' || node.callee.name === 'sayText') {
                this.spriteSpeech(handle, node.callee.name, a, push);
            }
            else if (['onDestroyed', 'onOverlap'].includes(node.callee.name)) {
                const overlap = node.callee.name === 'onOverlap';
                const registration = this.sceneRegistrations.get(node);
                if (registration) push(`arcade register instance ${overlap ? 'overlap' : 'destruction'} of (${handle}) as "${registration.token}" capturing ${JSON.stringify([...registration.ownCaptures].join(' '))}`);
                else push(this.note(overlap ? 'sprite.onOverlap() requires one inline callback with zero parameters or one Sprite-typed parameter and a typed sprite reference' : 'sprite.onDestroyed() requires one inline callback without parameters and a typed sprite reference'));
            }
            else if (node.callee.name === 'setKind') push(`arcade set kind of ${handle} to ${this.kindSlot(a[0])}`);
            else if (node.callee.name === 'setFlag' && this.path(a[0]) === 'SpriteFlag.AutoDestroy') {
                push(`arcade auto destroy ${handle} outside screen ${this.expr(a[1])}`);
            }
            else if (node.callee.name === 'setStayInScreen') {
                push(`arcade keep ${handle} in screen ${this.expr(a[0])}`);
            }
            else if (node.callee.name === 'setBounceOnWall') {
                push(`arcade bounce ${handle} on wall ${this.expr(a[0])}`);
            }
            else if (node.callee.name === 'setFlag' && this.path(a[0]) === 'SpriteFlag.BounceOnWall') {
                push(`arcade bounce ${handle} on wall ${this.expr(a[1])}`);
            }
            else if (node.callee.name === 'setFlag' && this.path(a[0]) === 'SpriteFlag.GhostThroughSprites') {
                push(`arcade ghost ${handle} through sprites ${this.expr(a[1])}`);
            }
            else if (node.callee.name === 'setFlag' && this.path(a[0]) === 'SpriteFlag.StayInScreen') {
                push(`arcade keep ${handle} in screen ${this.expr(a[1])}`);
            }
            else if (node.callee.name === 'setFlag' &&
                ['Invisible', 'Ghost', 'GhostThroughWalls', 'GhostThroughTiles', 'DestroyOnWall', 'RelativeToCamera', 'ShowPhysics'].some(flag =>
                    this.path(a[0]) === `SpriteFlag.${flag}`)) {
                if(a.length!==2)push(this.note(`SpriteFlag.${a[0].name} requires a flag and one Boolean value`));
                else push(`arcade set flag ${a[0].name} of ${handle} to ${this.expr(a[1])}`);
            }
            else if (node.callee.name === 'setImage' && this.imageRef(a[0])) {
                push(`arcade set image of ${handle} to ${this.imageRef(a[0])}`);
            }
            else if (node.callee.name === 'setImage' && this.handleImageLiterals?.has(node)) {
                push(`arcade set costume of ${handle} to ${this.handleImageLiterals.get(node)}`);
            }
            else if (node.callee.name === 'setImage' && this.handleFrameSelections?.has(node)) {
                const selection = this.handleFrameSelections.get(node);
                const value = this.expr(selection.value);
                push(`arcade set image of ${handle} to arcade frame image array "${selection.key}" index (${value}) template "${selection.template}" start ${selection.offset} count ${selection.count}`);
            }
            else if (node.callee.name === 'setImage' &&
                a[0]?.type === 'Call' && this.path(a[0].callee) === 'Math.pickRandom' &&
                a[0].args?.[0]?.type === 'Identifier' && this.handleImageArrays?.has(a[0].args[0].name)) {
                const range = this.handleImageArrays.get(a[0].args[0].name);
                const template = this.handleTemplates.values().next().value;
                push(`arcade set image of ${handle} to arcade frame image array "${a[0].args[0].name}" index (pick random 0 to ${range.end - range.start}) template "${template.name}" start ${range.start} count ${range.end - range.start + 1}`);
            }
            else if (node.callee.name === 'setPosition') {
                push(`arcade set position of (${handle}) x (${this.expr(a[0])}) y (${this.expr(a[1])})`);
            } else if (node.callee.name === 'setVelocity') {
                push(`arcade set vx of ${handle} to ${this.expr(a[0])}`);
                push(`arcade set vy of ${handle} to ${this.expr(a[1])}`);
            } else push(this.note(`${this.path(node.callee)}() — unsupported Arcade handle method`));
            return;
        }

        // Methods on a sprite: `ball.say("hi")`, `sprite.destroy()`.
        if (node.callee && node.callee.type === 'Member') {
            const owner = this.resolveSprite(node.callee.object);
            if (owner) {
                this.spriteMethod(owner, node.callee.name, a, indent, out);
                return;
            }
        }

        switch (name) {
        case 'pause':
        case 'loops.pause':
            push(`wait ${a[0] && a[0].type === 'Number' ? num(Number(a[0].value) / 1000) : `(${this.expr(a[0])}) / 1000`} seconds`);
            return;

        case 'info.setScore':
            push(`arcade set score to ${this.expr(a[0])}`);
            return;
        // The per-player forms: player one IS the plain score in the extension,
        // so a game that mixes both stays consistent.
        case 'info.player1.setScore':
        case 'info.player2.setScore':
        case 'info.player3.setScore':
        case 'info.player4.setScore':
            push(`arcade set score player (${playerOf(name)}) to (${this.expr(a[0])})`);
            return;
        case 'info.player1.changeScoreBy':
        case 'info.player2.changeScoreBy':
        case 'info.player3.changeScoreBy':
        case 'info.player4.changeScoreBy':
            push(`arcade change score player (${playerOf(name)}) by (${this.expr(a[0])})`);
            return;
        case 'info.player1.setLife':
        case 'info.player2.setLife':
        case 'info.player3.setLife':
        case 'info.player4.setLife':
            push(`set ${playerVar('lives', playerOf(name))} to ${this.expr(a[0])}`);
            return;
        case 'info.player1.changeLifeBy':
        case 'info.player2.changeLifeBy':
        case 'info.player3.changeLifeBy':
        case 'info.player4.changeLifeBy':
            push(`change ${playerVar('lives', playerOf(name))} by ${this.expr(a[0])}`);
            return;
        case 'info.changeScoreBy':
            push(`arcade change score by ${this.expr(a[0])}`);
            return;
        case 'info.setLife':
            push(`set lives to ${this.expr(a[0])}`);
            return;
        case 'info.startCountdown':
            push(`arcade start countdown ${this.expr(a[0])}`);
            return;
        case 'info.stopCountdown':
            push('arcade stop countdown');
            return;
        case 'info.changeLifeBy':
            push(`change lives by ${this.expr(a[0])}`);
            return;

        case 'game.over':
        case 'game.gameOver':
            push('stop all');
            return;
        case 'game.splash':
            if (a.length < 1 || a.length > 2) {
                push(this.note('game.splash() arguments'));
                return;
            }
            if(a.some(value=>!this.primitiveReferences?.has(value))){push(this.note('game.splash() requires proven primitive text; opaque or unknown inspection is not implemented'));return;}
            push(`arcade splash (${this.arrayElementValue(a[0])}) subtitle (${a[1] ? this.arrayElementValue(a[1]) : '""'})`);
            return;
        case 'game.showLongText':
            if (a.length !== 2 || !/^DialogLayout\.(Left|Right|Top|Bottom|Center|Full)$/.test(this.path(a[1]) || '')) {
                push(this.note('game.showLongText() layout must be a fixed DialogLayout value'));
                return;
            }
            if(!this.primitiveReferences?.has(a[0])){push(this.note('game.showLongText() requires proven primitive text; opaque or unknown inspection is not implemented'));return;}
            push(`arcade long text (${this.arrayElementValue(a[0])}) layout "${this.path(a[1]).split('.')[1]}"`);
            return;

        case 'music.playTone':
        case 'music.play':
            push(this.note(`${name}() — Arcade's music has no stage equivalent`));
            return;
        case 'music.stopAllSounds':
            push('stop all sounds');
            return;
        case 'console.log':
            push(`arcade log ${a.length ? this.expr(a[0]) : '""'}`);
            if (a.length > 1) push(this.note('console.log() with multiple values'));
            return;

        // Animation declarations are ASSETS, gathered in pass 1 and turned
        // into costumes; as statements they have nothing to emit, and a
        // generic refusal for each would bury the one note that matters.
        case 'animation.createAnimation':
        case 'animation.attachAnimation':
        case 'animation.setAction':
        case 'animation.runImageAnimation':
        case 'animation.stopAnimation':
            if(this.handleTemplates)push(this.note(`${name}() arguments require supported runtime animation forms`));
            return;

        default:
            // `walkLeft.addAnimationFrame(img`…`)` is a method on a plain
            // variable rather than a sprite, so it arrives here; pass 1
            // already read its art.
            if (node.callee && node.callee.type === 'Member' &&
                node.callee.name === 'addAnimationFrame') {
                if(this.handleTemplates)push(this.note('addAnimationFrame requires a known animation and one image'));
                return;
            }
            super.command(node, indent, out);
        }
    }

    /** `<sprite>.<method>(...)` where <sprite> is a sprite we know. */
    spriteSpeech (handle, method, args, push) {
        const legacy = method === 'say';
        if (!args.length || args.length > (legacy ? 4 : 5)) {
            push(this.note(`sprite.${method}() arguments`));
            return;
        }
        // A literal argument stays a literal in the block's slot: \`false\` is 0 and
        // \`-1\` is -1, as when the import supplies the default (Lite's own export
        // writes them out; read as value words they changed the blocks on a round trip).
        const literal = node => node?.type === 'Boolean' ? (node.value ? '1' : '0') :
            node?.type === 'Unary' && node.op === '-' && node.argument?.type === 'Number' ? num(-Number(node.argument.value)) : null;
        const optional = (index, fallback) => args[index] &&
            args[index].type !== 'Null' &&
            !(args[index].type === 'Identifier' && args[index].name === 'undefined') ? literal(args[index]) ?? this.expr(args[index]) : fallback;
        const escapes = {n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0'};
        const decode = value => value.replace(/\\(?:u\{([0-9a-f]+)\}|u([0-9a-f]{4})|x([0-9a-f]{2})|([\s\S]))/gi,
            (_, point, unicode, hex, char) => point || unicode || hex ?
                String.fromCodePoint(parseInt(point || unicode || hex, 16)) : escapes[char] ?? char);
        const text = args[0]?.type === 'Null' || args[0]?.type === 'Identifier' &&
            ['null', 'undefined'].includes(args[0].name) ? '""' : args[0]?.type === 'Boolean' ?
            JSON.stringify(String(args[0].value)) : args[0]?.type === 'String' ?
                JSON.stringify(decode(args[0].value)) : this.expr(args[0]);
        push(`arcade say ${handle} text ${text} for ${optional(1, '-1')} ms animated ` +
            `${legacy ? '0' : optional(2, '0')} text color ${optional(legacy ? 2 : 3, '15')} ` +
            `box color ${optional(legacy ? 3 : 4, '1')} mode "${legacy ? 'legacy' : 'text'}"`);
    }

    spriteMethod (owner, method, args, indent, out) {
        const pad = '  '.repeat(indent);
        const push = line => out.push(pad + line);
        if (owner !== this.self) {
            push(this.note(`${owner.name}.${method}() — Scratch scripts can only move their own sprite`));
            return;
        }
        switch (method) {
        case 'setPosition':
            push(`go to x: ${this.stageX(args[0])} y: ${this.stageY(args[1])}`);
            return;
        case 'say':
        case 'sayText':
            this.spriteSpeech('"self"', method, args, push);
            return;
        case 'destroy':
            push('hide');
            return;
        case 'setImage':
            push('next costume');
            return;
        case 'setFlag':
        case 'startEffect':
        case 'setVelocity':
        case 'follow':
        case 'setStayInScreen':
            push(this.note(`sprite.${method}() — no stage equivalent`));
            return;
        default:
            push(this.note(`sprite.${method}()`));
        }
    }

    // effects.<name> as one of PXT's ParticleEffect instances.
    /** A program binding (global, function, local, parameter or capture) named `name`. */
    objectArguments(node) {
        if(node?.type!=='Array'){this.unsupported.push('Class arguments require an explicit ordered argument list');return '"[]"';}
        let rest='"[]"';
        for(let i=node.items.length-1;i>=0;i--)rest=`arcade function argument (${this.arrayElementValue(node.items[i])}) rest (${rest})`;
        return rest;
    }
    objectExpression(node) {
        if(node?.bwPrimitiveNumberText)return `(${this.arrayElementValue(node.left)}) join ("")`;
        const name=this.path(node?.callee),a=node?.args || [];
        if(node.bwConsoleInspectIntrinsic===true&&name==='__bwConsoleInspectValue'&&a.length===2)return `arcade inspect value (${this.arrayElementValue(a[0])}) limit (${this.arrayElementValue(a[1])})`;
        if(node.bwFontIntrinsic && name==='__bwSdkFont_'+node.bwFontIntrinsic){
            if(node.bwFontIntrinsic==='constant' && a.length===1)return `arcade font value ${a[0].value}`;
            if(node.bwFontIntrinsic==='getFontForText' && a.length===1)return `arcade font for text (${this.expr(a[0])})`;
            if(node.bwFontIntrinsic==='scaledFont' && a.length===2)return `arcade scaled font (${this.expr(a[0])}) by (${this.expr(a[1])})`;
            if(node.bwFontIntrinsic==='field' && a.length===2)return `arcade object (${this.expr(a[0])}) field (${this.expr(a[1])})`;
        }
        if(node.bwCallableIntrinsic==='create' && name==='__bwCallables.create' && a.length===1) {
            const procedure=this.callableProcedures?.get(a[0]?.value);
            if(!procedure){this.unsupported.push('Callable creation requires its exact emitted source procedure');return 'undefined value';}
            return `arcade callable ${JSON.stringify(procedure)}`;
        }
        if(node.bwCallableIntrinsic==='invoke' && name==='__bwCallables.invoke' && a.length===2)
            return `arcade invoke callable (${this.expr(a[0])}) arguments (${this.objectArguments(a[1])})`;
        if(name==='__bwObjects.assign' && a.length===5) {
            const fresh=base=>{let name;do{name='__bwObject'+base+'_'+(this.objectTemporaryCounter=(this.objectTemporaryCounter||0)+1);}while(this.taken?.has(name));this.taken?.add(name);return name;};
            const receiver=fresh('Receiver'),old=fresh('Old'),next=fresh('Next');
            this.pre.push(`arcade set local ${receiver} to (${this.expr(a[0])})`);
            this.pre.push(`arcade set local ${old} to (arcade object (arcade local ${receiver}) field (${this.expr(a[1])}))`);
            const op=a[2].value,increment=['++','--'].includes(op);
            const left=increment?`convert value (arcade local ${old}) op "+"`:`arcade local ${old}`;
            const right=this.arrayElementValue(a[3]);
            this.pre.push(`arcade set local ${next} to (calculate value (${left}) op ${JSON.stringify(increment?op==='++'?'+':'-':op)} with (${right}))`);
            this.pre.push(`arcade set object (arcade local ${receiver}) field (${this.expr(a[1])}) to (arcade local ${next})`);
            return `arcade local ${a[4].value==='old'?old:next}`;
        }
        if(name==='__bwObjects.procedure' && a.length===2)return `arcade call function (${this.expr(a[0])}) arguments (${this.objectArguments(a[1])})`;
        if(name==='__bwObjects.create' && a.length===2)return `arcade new object class (${this.expr(a[0])}) arguments (${this.objectArguments(a[1])})`;
        if(name==='__bwObjects.get' && a.length===2)return `arcade object (${this.expr(a[0])}) field (${this.expr(a[1])})`;
        if(name==='__bwObjects.call' && a.length===3)return `arcade object (${this.expr(a[0])}) call method (${this.expr(a[1])}) arguments (${this.objectArguments(a[2])})`;
        return null;
    }
    objectStatement(node,push) {
        const name=this.path(node?.callee),a=node?.args || [];
        if(node.bwFontIntrinsic && name==='__bwSdkFont_'+node.bwFontIntrinsic){
            if(node.bwFontIntrinsic==='constant' && a.length===1)return `arcade font value ${a[0].value}`;
            if(node.bwFontIntrinsic==='getFontForText' && a.length===1)return `arcade font for text (${this.expr(a[0])})`;
            if(node.bwFontIntrinsic==='scaledFont' && a.length===2)return `arcade scaled font (${this.expr(a[0])}) by (${this.expr(a[1])})`;
            if(node.bwFontIntrinsic==='field' && a.length===2)return `arcade object (${this.expr(a[0])}) field (${this.expr(a[1])})`;
        }
        if(node.bwCallableIntrinsic==='invoke' && name==='__bwCallables.invoke'){push(`arcade set local ${this.freshName('__bwDiscardCallableResult')} to (${this.objectExpression(node)})`);return true;}
        if(name==='__bwObjects.declareSubclass' && a.length===7){push(`arcade declare subclass (${this.expr(a[0])}) of (${this.expr(a[1])}) fields (${this.expr(a[2])}) initializer (${this.expr(a[3])}) constructor (${this.expr(a[4])}) parameters (${this.expr(a[5])}) methods (${this.expr(a[6])})`);return true;}
        if(name==='__bwObjects.procedure'){push(`arcade set local ${this.freshName('__bwDiscardObjectResult')} to (${this.objectExpression(node)})`);return true;}
        if(name==='__bwObjects.declare' && a.length===6){push(`arcade declare class (${this.expr(a[0])}) fields (${this.expr(a[1])}) initializer (${this.expr(a[2])}) constructor (${this.expr(a[3])}) parameters (${this.expr(a[4])}) methods (${this.expr(a[5])})`);return true;}
        if(name==='__bwObjects.set' && a.length===3){push(`arcade set object (${this.expr(a[0])}) field (${this.expr(a[1])}) to (${this.arrayElementValue(a[2])})`);return true;}
        if(name==='__bwObjects.assign'){push(`arcade set local ${this.freshName('__bwDiscardObjectResult')} to (${this.objectExpression(node)})`);return true;}
        if(name==='__bwObjects.call'){push(`arcade set local ${this.freshName('__bwDiscardObjectResult')} to (${this.objectExpression(node)})`);return true;}
        return false;
    }
    settingsExpression(node) {
        if(!this.handleTemplates || node?.type!=='Call')return null;
        let api=this.path(node.callee);
        if(api==='bwStringArraySettings.read' && !this.bindsName('bwStringArraySettings'))api='blockSettings.readStringArray';
        if(api==='bwStringArraySettings.write' && !this.bindsName('bwStringArraySettings'))api='blockSettings.writeStringArray';
        const match=/^(settings|blockSettings)\.(read(Number|String|NumberArray|StringArray|Buffer)|exists|list|remove|clear|write(Number|String|NumberArray|StringArray|Buffer))$/.exec(api||'');
        if(!match || this.bindsName(match[1]))return null;
        if(match[1]==='settings' && (match[3]==='StringArray' || match[4]==='StringArray')){this.note(`${api} is not an original SDK API; use bwStringArraySettings with its owned helper`);return 'undefined value';}
        const method=match[2],a=node.args||[];
        if(method==='exists' && a.length===1)return `arcade setting (${this.expr(a[0])}) exists`;
        if(method==='list' && a.length<=(match[1]==='blockSettings'?0:1))return `arcade read setting (${a[0]?this.expr(a[0]):'""'}) type List`;
        if(match[3] && a.length===1)return `arcade read setting (${this.expr(a[0])}) type ${match[3]}`;
        if(this.settingsStatement(api,a,line=>this.pre.push(line)))return 'undefined value';
        this.note(`${api} arguments do not match the original Settings API`);return 'undefined value';
    }
    settingsStatement(api,a,push) {
        if(!this.handleTemplates)return false;
        if(api==='bwStringArraySettings.write' && !this.bindsName('bwStringArraySettings'))api='blockSettings.writeStringArray';
        const match=/^(settings|blockSettings)\.(write(Number|String|NumberArray|StringArray|Buffer)|remove|clear)$/.exec(api||'');
        if(!match || this.bindsName(match[1]))return false;
        if(match[1]==='settings' && match[3]==='StringArray'){push(this.note(`${api} is not an original SDK API; use bwStringArraySettings with its owned helper`));return true;}
        const method=match[2];
        if(match[3] && a.length===2)push(`arcade write setting (${this.expr(a[0])}) type ${match[3]} value (${this.arrayElementValue(a[1])})`);
        else if(method==='remove' && a.length===1)push(`arcade remove setting (${this.expr(a[0])})`);
        else if(method==='clear' && !a.length)push('arcade clear user settings');
        else push(this.note(`${api} arguments do not match the original Settings API`));
        return true;
    }

    bufferFormat(node) {
        if(node?.type==='Member' && node.object?.name==='NumberFormat' && !this.bindsName('NumberFormat')) {
            if(BUFFER_FORMATS.includes(node.name))return node.name;
            this.note(`Unknown Buffer NumberFormat.${node.name}`);return '(undefined value)';
        }
        return `(${this.expr(node)})`;
    }
    bufferExpression(node) {
        if(!this.handleTemplates)return null;
        const value=n=>`(${this.expr(n)})`;
        if(node?.type==='Member' && node.object?.name==='NumberFormat' && !this.bindsName('NumberFormat')) {
            if(BUFFER_FORMATS.includes(node.name))return String(BUFFER_FORMATS.indexOf(node.name)+1);
            this.note(`Unknown Buffer NumberFormat.${node.name}`);return 'undefined value';
        }
        if(node?.type==='Template' && node.tag==='hex') {
            const hex=node.value.replace(/\s/g,'');
            if(!/^(?:[0-9a-f]{2})*$/i.test(hex)){this.note('Buffer hex literal requires complete hexadecimal bytes');return 'undefined value';}
            return `arcade byte buffer literal hex ${JSON.stringify(hex)}`;
        }
        if(node?.type==='Index' && this.bufferReferences?.has(node.object))return `arcade byte buffer ${value(node.object)} byte at ${value(node.index)}`;
        if(node?.type==='Member' && this.bufferReferences?.has(node.object)) {
            if(node.name==='length')return `arcade byte buffer ${value(node.object)} length`;
            this.note(`Buffer.${node.name} property requires supported Buffer member access`);return 'undefined value';
        }
        if(node?.type!=='Call')return null;
        const api=this.path(node.callee),a=node.args||[];
        if(['control.createBuffer','control.createBufferFromUTF8','Buffer.fromHex','Buffer.fromUTF8'].includes(api) && !this.bindsName(api.split('.')[0])) {
            if(a.length!==1){this.note(`${api} requires one argument`);return 'undefined value';}
            if(api==='control.createBuffer')return `arcade create byte buffer size ${value(a[0])}`;
            return `arcade byte buffer from ${api==='Buffer.fromHex'?'hex':'UTF8'} text ${value(a[0])}`;
        }
        if(node.callee?.type!=='Member' || !this.bufferReferences?.has(node.callee.object))return null;
        const receiver=value(node.callee.object),op=node.callee.name;
        if(op==='getNumber' && a.length===2)return `arcade byte buffer ${receiver} number ${this.bufferFormat(a[0])} at ${value(a[1])}`;
        if(['toHex','toString','isReadOnly'].includes(op) && !a.length)return `arcade byte buffer ${receiver} ${ {toHex:'to hex',toString:'to UTF8 text',isReadOnly:'is read only'}[op]}`;
        if(op==='slice' && a.length<=2)return `arcade byte buffer ${receiver} slice at ${a[0]?value(a[0]):0} length ${a[1]?value(a[1]):-1}`;
        // The original shared view needs its own native block; do not copy it.
        if(op==='subarray'){this.note('Buffer.subarray requires a native shared-view block');return 'undefined value';}
        this.note(`Buffer.${op} requires supported Buffer expression arguments`);return 'undefined value';
    }
    bufferStatement(node,indent,out) {
        if(!this.handleTemplates)return false;
        const target=node?.type==='Assignment' && node.left;
        if(target?.type==='Index' && this.bufferReferences?.has(target.object)) {
            if(node.op!=='='){out.push(`${'  '.repeat(indent)}${this.note('Buffer byte compound assignment requires single-evaluation lowering')}`);return true;}
            out.push(`${'  '.repeat(indent)}arcade set byte buffer (${this.expr(target.object)}) byte at (${this.expr(target.index)}) to (${this.expr(node.right)})`);return true;
        }
        if(node?.type!=='Call' || node.callee?.type!=='Member' || !this.bufferReferences?.has(node.callee.object))return false;
        const a=node.args||[],op=node.callee.name,receiver=`(${this.expr(node.callee.object)})`,v=(i,fallback)=>a[i]?`(${this.expr(a[i])})`:fallback;
        let code;
        if(op==='setNumber' && a.length===3)code=`arcade set byte buffer ${receiver} number ${this.bufferFormat(a[0])} at ${v(1)} to ${v(2)}`;
        if(op==='fill' && a.length>=1 && a.length<=3)code=`arcade fill byte buffer ${receiver} with ${v(0)} at ${v(1,0)} length ${v(2,-1)}`;
        if(op==='write' && a.length>=2 && a.length<=4)code=`arcade write byte buffer ${receiver} at ${v(0)} from ${v(1)}`;
        if(['shift','rotate'].includes(op) && a.length>=1 && a.length<=3)code=`arcade ${op} byte buffer ${receiver} by ${v(0)} at ${v(1,0)} length ${v(2,-1)}`;
        if(!code)return false;
        if(op==='write' && a.length>2){out.push(`${'  '.repeat(indent)}${this.note('Buffer.write source offset and length require native block arguments')}`);return true;}
        out.push(`${'  '.repeat(indent)}${code}`);return true;
    }

    /** The ordered arguments of an external call as the function-argument chain `arcade call function` uses. */
    externalArguments (args) {
        let chain = '"[]"';
        for (let index = args.length - 1; index >= 0; index--) chain = `arcade function argument (${this.arrayElementValue(args[index])}) rest (${chain})`;
        return chain;
    }

    /** A name whose source is not in the project and that nothing in the program binds. */
    externalName (node) {
        const name = externalPath(node);
        return name && (node.bwExternalAsset || !this.bindsName(name.split('.')[0])) ? name : null;
    }

    /** `ns.member(args)` as a statement: kept by name, with an optional trailing inline callback. */
    externalStatement (node, indent, out) {
        const name = node.callee?.type === 'Member' && this.externalName(node.callee);
        if (!name) return false;
        const pad = '  '.repeat(indent), args = node.args || [];
        const registration = this.sceneRegistrations?.get(node);
        if (registration) {
            out.push(`${pad}arcade register external ${JSON.stringify(name)} arguments (${this.externalArguments(args.slice(0, -1))}) as "${registration.token}" capturing ${JSON.stringify([...registration.ownCaptures].join(' '))}`);
            return true;
        }
        if (args.some(arg => arg?.type === 'FunctionExpression')) {
            out.push(pad + this.note(`${name}() takes a callback that must be the last argument and have no parameters`));
            return true;
        }
        out.push(`${pad}arcade external command ${JSON.stringify(name)} arguments (${this.externalArguments(args)})`);
        return true;
    }

    /** `ns.member(args)` as a value. */
    externalCallValue (node) {
        const name = node.callee?.type === 'Member' && this.externalName(node.callee);
        if (!name) return null;
        const args = node.args || [];
        if (args.some(arg => arg?.type === 'FunctionExpression')) {
            this.unsupported.push(`${name}() takes a callback; only a statement can attach one`);
            return '0';
        }
        return `(arcade external call ${JSON.stringify(name)} arguments (${this.externalArguments(args)}))`;
    }

    /** An asset literal no other rule claimed, kept by its spelling. */
    externalTemplate (node) {
        const text = externalAssetText(node.tag, node.value);
        return text ? `(arcade external value ${JSON.stringify(text)})` : null;
    }

    /** `ns.member` read as a value. */
    externalReference (node) {
        const name = this.externalName(node);
        return name ? `(arcade external value ${JSON.stringify(name)})` : null;
    }

    bindsName (name) {
        return Boolean(this.boundSourceGlobals?.has(name) || this.sourceFunctions?.has(name) || this.localVars?.has(name) ||
            this.currentParameters?.has(name) || this.capturedBindings?.has(name));
    }
    /** A fixed member of a PXT music enum, or null. */
    musicEnum (node, enumeration) {
        const path = this.path(node) || '';
        const prefix = enumeration + '.';
        if (!path.startsWith(prefix) || this.bindsName(enumeration.split('.')[0])) return null;
        const member = path.slice(prefix.length);
        return MUSIC_ENUMS[enumeration].includes(member) ? member : null;
    }
    /** PXT's parseInt and the event context's deltaTime, or null. */
    coreValue (node) {
        if (node?.type === 'Call' && node.callee?.type === 'Identifier' && node.callee.name === 'parseInt' && !this.bindsName('parseInt')) {
            const a = node.args || [];
            if (a.length === 1) return `arcade parse integer (${this.expr(a[0])})`;
            if (a.length === 2) return `arcade parse integer (${this.expr(a[0])}) radix (${this.expr(a[1])})`;
            this.unsupported.push('parseInt() takes a text and an optional radix');
            return 'undefined value';
        }
        if (node?.type === 'Member' && node.name === 'deltaTime' && node.object?.type === 'Call' && !node.object.args?.length &&
            ['game.eventContext', 'control.eventContext'].includes(this.path(node.object.callee)) && !this.bindsName(this.path(node.object.callee).split('.')[0]))
            return 'arcade frame delta time';
        return null;
    }
    /** A character rule: a rule() call of Predicate members as the rule word, else the number's expression. */
    characterRule (node) {
        const predicates = [], read = n => {
            const path = this.path(n) || '', member = /^Predicate\.([A-Za-z]+)$/.exec(path);
            if (member && Object.prototype.hasOwnProperty.call(CHARACTER_PREDICATES, member[1]) && !this.bindsName('Predicate')) return member[1];
            if (n?.type === 'Call' && this.path(n.callee) === 'characterAnimations._predicate' && n.args?.length === 1) return read(n.args[0]);
            return null;
        };
        const single = read(node);
        if (single) return `arcade character rule ${JSON.stringify(single)}`;
        if (node?.type === 'Call' && this.path(node.callee) === 'characterAnimations.rule') {
            const args = node.args || [];
            for (const arg of args) predicates.push(read(arg));
            if (!args.length || args.length > 5 || predicates.includes(null)) {
                this.unsupported.push('characterAnimations.rule() takes one to five Predicate members');
                return '0';
            }
            return `arcade character rule ${JSON.stringify(predicates.join(' '))}`;
        }
        if (/^(Predicate|characterAnimations)\./.test(this.path(node) || '') || (node?.type === 'Call' && /^characterAnimations\./.test(this.path(node.callee) || ''))) {
            this.unsupported.push(`${this.path(node) || this.path(node.callee)} is not a character animation rule`);
            return '0';
        }
        return this.expr(node);
    }
    /** A FacingDirection member name, false if not one. */
    characterFacing (node) {
        const member = /^characterAnimations\.FacingDirection\.(Up|Right|Down|Left)$/.exec(this.path(node) || '');
        if (member) return member[1];
        if (node?.type === 'Call' && this.path(node.callee) === 'characterAnimations._direction' && node.args?.length === 1) return this.characterFacing(node.args[0]);
        return false;
    }
    kindSlot(node) {
        if(!node)return '(undefined value)';
        if(['Array','Object','ObjectLiteral','FunctionExpression'].includes(node.type) || this.arrayReferences?.has(node) || this.imageReferences?.has(node) || this.spriteReferences?.has(node)) {
            this.unsupported.push('SpriteKind argument requires a numeric value, null or undefined');return '(undefined value)';
        }
        return `(${this.expr(node)})`;
    }
    /** arcade-character-animations calls. */
    characterStatement (name, a, push) {
        if (!this.handleTemplates || !/^characterAnimations\./.test(name || '') || this.bindsName('characterAnimations')) return false;
        const method = name.slice(20), fail = message => { push(this.note(`characterAnimations.${method}() ${message}`)); return true; };
        if(this.characterVersion===LEGACY_CHARACTER_REVISION && ['setController','lockFacingDirection','unlockFacingDirection'].includes(method))return fail('is not implemented in v0.0.2');
        const sprite = this.handleRef(a[0]);
        if (!sprite) return fail('needs a typed sprite');
        const frames = node => node?.type === 'Call' && this.path(node.callee) === 'characterAnimations._animationFrames' && node.args?.length === 1 ? node.args[0] : node;
        const bool = node => this.boolSlot(node);
        switch (method) {
        case 'loopFrames': case 'runFrames':
            if (a.length !== 4) return fail('takes a sprite, frames, an interval and a rule');
            push(`arcade character ${method === 'loopFrames' ? 'loop' : 'run'} frames of (${sprite}) images (${this.expr(frames(a[1]))}) interval (${this.expr(a[2])}) rule (${this.characterRule(a[3])})`); return true;
        case 'setCharacterAnimationsEnabled':
            if (a.length !== 2) return fail('takes a sprite and a boolean');
            push(`arcade set character animations of (${sprite}) enabled ${bool(a[1])}`); return true;
        case 'setCharacterState':
            if (a.length !== 2) return fail('takes a sprite and a rule');
            push(`arcade set character state of (${sprite}) to (${this.characterRule(a[1])})`); return true;
        case 'clearCharacterState':
            if (a.length !== 1) return fail('takes a sprite');
            push(`arcade clear character state of (${sprite})`); return true;
        case 'setController':
            // A third operand names another player's controller.
            if (a.length !== 2) return fail('takes a sprite and a boolean (player 1)');
            push(`arcade set character controller of (${sprite}) enabled ${bool(a[1])}`); return true;
        case 'lockFacingDirection': {
            const direction = a.length === 2 && this.characterFacing(a[1]);
            if (!direction) return fail('takes a sprite and a FacingDirection member');
            push(`arcade lock character facing of (${sprite}) to ${direction}`); return true;
        }
        case 'unlockFacingDirection':
            if (a.length !== 1) return fail('takes a sprite');
            push(`arcade unlock character facing of (${sprite})`); return true;
        default:
            return fail('is not supported');
        }
    }
    /** A scroller layer argument (number, BackgroundLayer member or _backgroundLayer call); '0' if omitted. */
    scrollerLayer (node) {
        if (!node) return '0';
        const path = this.path(node) || '', member = /^scroller\.BackgroundLayer\.Layer([0-4])$/.exec(path);
        if (member) return member[1];
        if (node.type === 'Call' && this.path(node.callee) === 'scroller._backgroundLayer' && node.args?.length === 1) return this.scrollerLayer(node.args[0]);
        return /^scroller\./.test(path) ? null : this.expr(node);
    }
    /** arcade-background-scroll calls. */
    scrollerStatement (name, a, push) {
        if (!this.handleTemplates || !/^scroller\./.test(name || '') || this.bindsName('scroller')) return false;
        // Numeric literals (with a leading minus) stay literal numbers.
        const value = i => {
            const node = a[i], negative = node?.type === 'Unary' && node.op === '-' && node.argument?.type === 'Number';
            return node?.type === 'Number' ? String(Number(node.value)) : negative ? String(-Number(node.argument.value)) : this.expr(node);
        }, method = name.slice(9);
        const layer = i => this.scrollerLayer(a[i]);
        const fail = message => { push(this.note(`scroller.${method}() ${message}`)); return true; };
        if(this.scrollerVersion===LEGACY_SCROLLER_REVISION) {
            const arity={scrollBackgroundWithCamera:[1,1],scrollBackgroundWithSpeed:[2,2],setCameraScrollingMultipliers:[0,2],setBackgroundScrollOffset:[2,2]}[method];
            if(!arity || a.length<arity[0] || a.length>arity[1])return fail('is not available with these arguments in the selected single-background library');
        }
        switch (method) {
        case 'scrollBackgroundWithCamera': {
            const mode = /^scroller\.CameraScrollMode\.(OnlyHorizontal|OnlyVertical|BothDirections)$/.exec(this.path(a[0]) || '');
            if (!mode || a.length > 2 || layer(1) === null) return fail('needs a CameraScrollMode member and an optional layer');
            push(`arcade scroll background with camera ${mode[1]} layer (${layer(1)})`); return true;
        }
        case 'scrollBackgroundWithSpeed':
            if (a.length < 2 || a.length > 3 || layer(2) === null) return fail('takes vx, vy and an optional layer');
            push(`arcade scroll background vx (${value(0)}) vy (${value(1)}) layer (${layer(2)})`); return true;
        case 'setCameraScrollingMultipliers':
            if (a.length > 3 || layer(2) === null) return fail('takes x and y multipliers and an optional layer');
            push(`arcade set background scroll multipliers x (${a.length > 0 ? value(0) : '1'}) y (${a.length > 1 ? value(1) : '1'}) layer (${layer(2)})`); return true;
        case 'setBackgroundScrollOffset':
            if (a.length < 2 || a.length > 3 || layer(2) === null) return fail('takes x, y and an optional layer');
            push(`arcade set background scroll offset x (${value(0)}) y (${value(1)}) layer (${layer(2)})`); return true;
        case 'setLayerImage': {
            const image = a.length === 2 && layer(0) !== null && this.imageRef(a[1]);
            if (!image) return fail('takes a layer and an image');
            push(`arcade set background layer (${layer(0)}) image (${image})`); return true;
        }
        case 'setLayerZIndex':
            if (a.length !== 2 || layer(0) === null) return fail('takes a layer and a z index');
            push(`arcade set background layer (${layer(0)}) z (${value(1)})`); return true;
        default:
            return fail('is not supported');
        }
    }
    textSpriteStatement(node,a,push) {
        const callee=node?.callee;
        if(!this.handleTemplates || callee?.type!=='Member' || !this.textSpriteReferences?.has(callee.object))return false;
        const id=this.expr(callee.object),method=callee.name,value=i=>this.arrayElementValue(a[i]);
        if(method==='setText' && a.length===1)push(`arcade text sprite (${id}) set text (${value(0)})`);
        else if(method==='setMaxFontHeight' && a.length===1)push(`arcade text sprite (${id}) set max font height (${value(0)})`);
        else if(method==='setIcon' && a.length===1)push(`arcade text sprite (${id}) set icon (${value(0)})`);
        else if(method==='setBorder' && a.length>=2 && a.length<=3)push(`arcade text sprite (${id}) set border width (${value(0)}) color (${value(1)}) padding (${a[2]?value(2):0})`);
        else if(method==='setOutline' && a.length===2)push(`arcade text sprite (${id}) set outline width (${value(0)}) color (${value(1)})`);
        else if(method==='update' && !a.length)push(`arcade text sprite (${id}) update`);
        else if(['setText','setMaxFontHeight','setIcon','setBorder','setOutline','update'].includes(method))push(this.note(`TextSprite.${method} arguments do not match original source`));
        else return false;
        return true;
    }

    /** 'dart' or 'corgio' for a tracked extension sprite, else null. */
    spriteExtensionOf (node) {
        return !node ? null : this.dartReferences?.has(node) ? 'dart' : this.corgiReferences?.has(node) ? 'corgio' : null;
    }
    spriteExtensionCreate (node) {
        const dart = this.path(node.callee) === 'darts.create', a = node.args || [], first = dart ? 1 : 0;
        if (a.length < first + 1 || a.length > first + 3) { this.unsupported.push(`${dart ? 'darts' : 'corgio'}.create() takes ${dart ? 'an image, a kind' : 'a kind'} and an optional x and y`); return 'undefined value'; }
        const kind = this.kindSlot(a[first]), x = a.length > first + 1 ? this.expr(a[first + 1]) : '10', y = a.length > first + 2 ? this.expr(a[first + 2]) : dart ? '110' : '70';
        if (!dart) return `arcade create corgi kind ${kind} x (${x}) y (${y})`;
        const image = this.imageRef(a[0]);
        if (!image) { this.unsupported.push('darts.create() needs an image'); return 'undefined value'; }
        return `arcade create dart image (${image}) kind ${kind} x (${x}) y (${y})`;
    }
    /** darts and corgio method calls on a tracked extension sprite. */
    spriteExtensionStatement (node, a, push) {
        const callee = node?.callee, kind = this.handleTemplates && callee?.type === 'Member' && this.spriteExtensionOf(callee.object);
        if (!kind) return false;
        const sprite = this.expr(callee.object), method = callee.name, on = () => a.length ? this.boolSlot(a[0]) : '1';
        if (kind === 'dart' && DART_SWITCHES.includes(method) && a.length <= 1) push(`arcade dart (${sprite}) ${method} ${on()}`);
        else if (kind === 'dart' && DART_ACTIONS.includes(method) && !a.length) push(`arcade dart (${sprite}) ${method}`);
        else if (kind === 'corgio' && CORGI_MODES.includes(method) && a.length <= 1) push(`arcade corgi (${sprite}) ${method} ${on()}`);
        else if (kind === 'corgio' && method === 'bark' && !a.length) push(`arcade corgi (${sprite}) bark`);
        else if (kind === 'corgio' && method === 'addToScript' && a.length === 1) push(`arcade corgi (${sprite}) add phrase (${this.expr(a[0])})`);
        else return false;
        return true;
    }
    isSevensegDisplay (node) {
        return !!node && (this.sevensegDigitReferences?.has(node) || this.sevensegCounterReferences?.has(node));
    }
    /** A seven segment enum member as its name, or null. */
    sevensegEnum (node, enumeration) {
        const path = this.path(node) || '', [owner, name] = path.split('.');
        return owner === enumeration && SEVENSEG_ENUMS[enumeration].includes(name) && !this.bindsName(enumeration) ? name : null;
    }
    sevensegCreate (node) {
        const counter = this.path(node.callee) === 'sevenseg.createCounter', a = node.args || [];
        const enumeration = (i, kind, fallback) => i < a.length ? this.sevensegEnum(a[i], kind) : fallback;
        if (a.length > (counter ? 3 : 2)) { this.unsupported.push(`sevenseg.${counter ? 'createCounter' : 'createDigit'}() takes at most ${counter ? 3 : 2} arguments`); return 'undefined value'; }
        const style = enumeration(0, 'SegmentStyle', 'Thick');
        const scale = counter ? enumeration(1, 'SegmentScale', 'Full') : 'Full';
        if (!style || !scale) { this.unsupported.push(`sevenseg.${counter ? 'createCounter' : 'createDigit'}() style and scale must be SegmentStyle and SegmentScale members`); return 'undefined value'; }
        if (counter) return `arcade seven segment counter style ${style} scale ${scale} digits (${a.length > 2 ? this.expr(a[2]) : '1'})`;
        return `arcade seven segment digit style ${style} value (${a.length > 1 ? this.expr(a[1]) : '0'})`;
    }
    /** Seven segment method calls on a tracked digit or counter. */
    sevensegStatement (node, a, push) {
        const callee = node?.callee;
        if (!this.handleTemplates || callee?.type !== 'Member' || !this.isSevensegDisplay(callee.object)) return false;
        const counter = this.sevensegCounterReferences?.has(callee.object), display = this.expr(callee.object), method = callee.name;
        const enumCall = (kind, word) => {
            const name = a.length === 1 && this.sevensegEnum(a[0], kind);
            if (name) push(`arcade set seven segment (${display}) ${word} ${name}`);
            else push(this.note(`${method}() needs a ${kind} member`));
        };
        if (method === 'setDigitColor' && a.length === 1) push(`arcade set seven segment (${display}) color (${this.expr(a[0])})`);
        else if (!counter && method === 'setDigitAlpha') enumCall('SegmentCharacter', 'character');
        else if (!counter && method === 'setRadix') enumCall('DigitRadix', 'radix');
        else if (!counter && method === 'setScale') enumCall('SegmentScale', 'scale');
        else if (counter && method === 'addDigit' && !a.length) push(`arcade add seven segment digit to (${display})`);
        else push(this.note(`${counter ? 'DigitCounter' : 'SevenSegDigit'}.${method}() is not supported`));
        return true;
    }
    /** PXT mixer values: reporter text, or null when the node is not music. */
    musicValue (node) {
        if (!this.handleTemplates) return null;
        const path = this.path(node) || '';
        if (/^Note\.\w+$/.test(path) && Object.prototype.hasOwnProperty.call(NOTE_FREQUENCIES, path.slice(5)) && !this.bindsName('Note'))
            return String(NOTE_FREQUENCIES[path.slice(5)]);
        if (node?.type === 'Member' && path === 'music.' + node.name && MUSIC_MELODIES.has(node.name) && !this.bindsName('music'))
            return `arcade melody ${node.name}`;
        if (node?.type !== 'Call') return null;
        const api = this.path(node.callee) || '';
        if (!api.startsWith('music.') || this.bindsName('music')) return null;
        const a = node.args || [], value = i => `(${this.expr(a[i])})`;
        switch (api) {
        case 'music.melodyPlayable':
            if (a.length === 1) return `arcade melody playable ${value(0)}`;
            break;
        case 'music.stringPlayable':
            if (a.length === 2) return `arcade string playable ${value(0)} at ${value(1)} bpm`;
            break;
        case 'music.createSong': {
            const buffer = a.length === 1 && a[0];
            if (buffer?.type === 'Template' && buffer.tag === 'hex') {
                const text = buffer.value.replace(/\s/g, '');
                if (!/^(?:[0-9a-f]{2}){7,}$/i.test(text) || !/^00/i.test(text)) {
                    this.note('music.createSong requires complete version-zero song bytes');
                    return '0';
                }
                return buffer.bwSongName ?
                    `arcade song named ${JSON.stringify(buffer.bwSongName)} hex ${JSON.stringify(text.toLowerCase())}` :
                    `arcade song playable hex ${JSON.stringify(text.toLowerCase())}`;
            }
            if (this.bufferReferences?.has(buffer))return `arcade song playable byte buffer (${this.expr(buffer)})`;
            this.note('music.createSong requires a hex literal or Buffer.fromHex expression');
            return '0';
        }
        case 'music.tonePlayable':
            if (a.length === 2) return `arcade tone playable ${value(0)} Hz for ${value(1)} ms`;
            break;
        case 'music.createSoundEffect': {
            const wave = a.length === 8 && this.musicEnum(a[0], 'WaveShape');
            const effect = wave && this.musicEnum(a[6], 'SoundExpressionEffect'), curve = effect && this.musicEnum(a[7], 'InterpolationCurve');
            if (curve) return `arcade sound effect wave ${wave} from ${value(1)} Hz to ${value(2)} Hz volume ${value(3)} to ${value(4)} ` +
                `for ${value(5)} ms effect ${effect} curve ${curve}`;
            break;
        }
        case 'music.sounds': {
            const sound = a.length === 1 && this.musicEnum(a[0], 'Sounds');
            if (sound) return `arcade sound ${sound}`;
            break;
        }
        case 'music.beat': {
            if (!a.length) return 'arcade beat Whole';
            const fraction = a.length === 1 && this.musicEnum(a[0], 'BeatFraction');
            if (fraction) return `arcade beat ${fraction}`;
            break;
        }
        case 'music.volume':
            if (!a.length) return 'arcade music volume';
            break;
        case 'music.tempo':
            if (!a.length) return 'arcade music tempo';
            break;
        default:
            return null;
        }
        this.unsupported.push(`${api}() — needs fixed enum members and its declared arguments`);
        return 'undefined value';
    }
    /** A boolean slot: literals as 1/0, anything else as its condition; absent is `fallback`. */
    boolSlot (node, fallback = '0') {
        if (!node) return fallback;
        if (node.type === 'Boolean') return node.value === true || node.value === 'true' ? '1' : '0';
        return `(${this.condition(node)})`;
    }
    /** A fixed effects.* background effect name, or null. */
    backgroundEffect (node) {
        const match = /^effects\.(\w+)$/.exec(this.path(node) || '');
        return match && !this.bindsName('effects') && (SCREEN_PARTICLE_EFFECTS.has(match[1]) || IMAGE_EFFECTS.has(match[1])) ? match[1] : null;
    }
    carnivalStatement(name,a,push) {
        if(this.handleTemplates && !this.bindsName('carnival') && name==='carnival.customGameOverExpanded') {
            const missing = node => !node || node.type==='Undefined';
            const effect = missing(a[1]) ? 'unset' : this.backgroundEffect(a[1]);
            const scoring = missing(a[3]) ? 'unset' :
                /^carnival\.ScoreTypes\.(None|HScore|LScore|HTime|LTime)$/.exec(this.path(a[3]) || '')?.[1];
            if(a.length<1 || a.length>5 || !effect || !scoring) {
                push(this.note(name+'() needs a message, optional fixed effect and optional fixed carnival.ScoreTypes scoring'));return true;
            }
            push(`arcade carnival custom game over message (${this.expr(a[0])}) effect ${effect} sound (${missing(a[2])?'""':this.expr(a[2])}) use sound ${missing(a[2])?'0':'1'} scoring ${scoring} score (${missing(a[4])?'0':this.expr(a[4])}) use score ${missing(a[4])?'0':'1'}`);
            return true;
        }
        if(this.handleTemplates && !this.bindsName('carnival') && name==='carnival.addLabelTo') {
            const missing = node => !node || node.type==='Undefined';
            const area = /^carnival\.Areas\.(Top|Mid|Bottom)$/.exec(this.path(a[1]) || '')?.[1];
            if(a.length<2 || a.length>3 || !area) {
                push(this.note(name+'() needs a label, a fixed carnival.Areas location and an optional colour'));return true;
            }
            push(`arcade carnival add label (${this.expr(a[0])}) position ${area} color (${missing(a[2])?'0':this.expr(a[2])}) use color ${missing(a[2])?'0':'1'}`);
            return true;
        }
        if(!this.handleTemplates || this.bindsName('carnival') || !['carnival.startCountdownGame','carnival.onGameOverExpanded','carnival.customGameOverExpanded'].includes(name))return false;
        const countdown=name==='carnival.startCountdownGame',offset=countdown?1:0;
        const match=/^carnival\.WinTypes\.(Win|Lose|Score|Timed|Multi|Custom)$/.exec(this.path(a[offset]) || '');
        const effect=a.length===offset+2?this.backgroundEffect(a[offset+1]):'unset';
        if(!match || !effect || a.length<offset+1 || a.length>offset+2) {
            push(this.note(name+'() requires a fixed carnival.WinTypes style and optional fixed effects.* effect'));return true;
        }
        push(countdown?`arcade carnival countdown (${this.expr(a[0])}) style ${match[1]} effect ${effect}`:
            `arcade carnival game over style ${match[1]} effect ${effect}`);
        return true;
    }
    /** PXT game over and its configuration; returns whether `name` was one. */
    gameOverStatement (name, a, push) {
        if (!this.handleTemplates || !/^game\./.test(name || '') || this.bindsName('game')) return false;
        const value = i => `(${this.expr(a[i])})`;
        switch (name) {
        case 'game.gameOver':
            if (a.length !== 1) push(this.note('game.gameOver() takes whether the player won'));
            else push(`arcade game over win ${this.boolSlot(a[0])}`);
            return true;
        case 'game.over': {
            const effect = a.length === 2 ? this.backgroundEffect(a[1]) : 'unset';
            if (a.length > 2 || !effect) push(this.note('game.over() takes whether the player won and an optional fixed effects.* effect'));
            else push(`arcade legacy game over win ${this.boolSlot(a[0])} effect ${effect}`);
            return true;
        }
        case 'game.setGameOverEffect': {
            const effect = a.length === 2 && this.backgroundEffect(a[1]);
            if (!effect) push(this.note('game.setGameOverEffect() requires a fixed effects.* effect'));
            else push(`arcade set game over effect ${effect} for win ${this.boolSlot(a[0])}`);
            return true;
        }
        case 'game.setGameOverMessage':
            if (a.length !== 2) push(this.note('game.setGameOverMessage() takes win and a message'));
            else push(`arcade set game over message ${value(1)} for win ${this.boolSlot(a[0])}`);
            return true;
        case 'game.setGameOverPlayable':
            if (a.length !== 3) push(this.note('game.setGameOverPlayable() takes win, a sound and looping'));
            else push(`arcade set game over sound ${value(1)} looping ${this.boolSlot(a[2])} for win ${this.boolSlot(a[0])}`);
            return true;
        case 'game.setGameOverSound':
            if (a.length !== 2) push(this.note('game.setGameOverSound() takes win and a melody'));
            else push(`arcade set game over sound (arcade melody playable ${value(1)}) looping 0 for win ${this.boolSlot(a[0])}`);
            return true;
        case 'game.setGameOverScoringType': {
            const match = a.length === 1 && /^game\.ScoringType\.(HighScore|LowScore|None)$/.exec(this.path(a[0]) || '');
            if (!match) push(this.note('game.setGameOverScoringType() requires a fixed game.ScoringType'));
            else push(`arcade set game over scoring ${match[1]}`);
            return true;
        }
        default: return false;
        }
    }
    /** PXT mixer statements; returns whether `name` was music. */
    musicStatement (name, a, push, node) {
        if (!this.handleTemplates || !/^music\./.test(name || '') || this.bindsName('music')) return false;
        const value = i => `(${this.expr(a[i])})`;
        const melody = /^music\.(\w+)\.(play|playUntilDone|loop)$/.exec(name);
        if (melody && MUSIC_MELODIES.has(melody[1])) {
            if (a.length) push(this.note(`music.${melody[1]}.${melody[2]}() volume — not represented`));
            else push(`arcade play melody (arcade melody ${melody[1]}) mode ${melody[2]}`);
            return true;
        }
        const fixed = (count, line) => {
            if (a.length === count) push(line());
            else push(this.note(`${name}() takes ${count} argument${count === 1 ? '' : 's'}`));
            return true;
        };
        switch (name) {
        case 'music.playMelody':
            if(node?.bwPxtLegacyNoteMelody===true&&literalLegacyNoteMelody(node))push(`arcade play note melody ${value(0)} at ${value(1)} bpm`);
            else push(this.note('music.playMelody() requires unchanged direct SDK bindings, literal melody-editor notes and a finite literal tempo'));
            return true;
        case 'music.play': {
            const mode = a.length === 2 && this.musicEnum(a[1], 'music.PlaybackMode');
            if (mode) push(`arcade play playable ${value(0)} mode ${mode}`);
            else push(this.note('music.play() requires a playable and a fixed music.PlaybackMode'));
            return true;
        }
        case 'music.playSoundEffect': {
            const mode = a.length === 2 && this.musicEnum(a[1], 'SoundExpressionPlayMode');
            if (mode) push(`arcade play sound effect ${value(0)} mode ${mode}`);
            else push(this.note('music.playSoundEffect() requires a sound effect and a fixed SoundExpressionPlayMode'));
            return true;
        }
        case 'music.playSound': return fixed(1, () => `arcade play sound ${value(0)} until done 0`);
        case 'music.playSoundUntilDone': return fixed(1, () => `arcade play sound ${value(0)} until done 1`);
        case 'music.playTone': return fixed(2, () => `arcade play tone ${value(0)} Hz for ${value(1)} ms`);
        case 'music.ringTone': return fixed(1, () => `arcade ring tone ${value(0)} Hz`);
        case 'music.rest': return fixed(1, () => `arcade rest for ${value(0)} ms`);
        case 'music.setVolume': return fixed(1, () => `arcade set music volume to ${value(0)}`);
        case 'music.setTempo': return fixed(1, () => `arcade set tempo to ${value(0)} bpm`);
        case 'music.changeTempoBy': return fixed(1, () => `arcade change tempo by ${value(0)} bpm`);
        case 'music.stopAllSounds': return fixed(0, () => 'arcade stop all sounds');
        default: return false;
        }
    }
    particleEffect (node) {
        const match = /^effects\.(\w+)$/.exec(this.path(node) || '');
        return match && PARTICLE_EFFECTS.has(match[1]) ? match[1] : null;
    }

    // PXT Sprite.destroy(effect?, duration?): a duration of 0 or none means
    // the effect's default, so an omitted duration is written as 0.
    destroyWithEffect (handle, args, label, push) {
        if (!args.length) { push(`arcade destroy ${handle}`); return; }
        const effect = args.length <= 2 && this.particleEffect(args[0]);
        if (!effect) { push(this.note(`${label} requires a named effects.* particle effect and an optional duration`)); return; }
        push(`arcade destroy ${handle} with effect ${effect} for (${args[1] ? this.expr(args[1]) : 0}) ms`);
    }

    statementInner (st, indent, out) {
        if (st.type === 'Declaration' && this.localVars &&
            st.decls.every(decl => this.localVars.has(decl.name))) {
            for (const decl of st.decls) {
                out.push(`${'  '.repeat(indent)}arcade set local ${decl.name} to ` +
                    `${decl.init ? this.expr(decl.init) : '0'}`);
            }
            return;
        }
        super.statementInner(st, indent, out);
    }

    /** Assignments to sprite properties, before the generic handling. */
    expressionStatement (expr, indent, out) {
        const pad = '  '.repeat(indent);
        const push = line => out.push(pad + line);
        const dataTarget=expr.type==='Assignment'?expr.left:expr.type==='Update'?expr.argument:null;
        if(dataTarget?.type==='Member' && Object.prototype.hasOwnProperty.call(ARCADE_SCENE_CONSTANTS,this.path(dataTarget))){push(this.note(`${this.path(dataTarget)} assignment requires a mutable object; SDK Scene constants are readonly`));return;}
        if(dataTarget?.type==='Member' && this.playerReferences?.has(dataTarget.object)){push(this.note(`mp.Player.${dataTarget.name} assignment requires native player member support`));return;}
        if(dataTarget?.type==='Member' && this.dataReferences?.has(dataTarget.object) && !this.spriteReferences?.has(dataTarget.object)) {
            push(this.note(`Sprite.data.${dataTarget.name} assignment requires arbitrary object member support`));return;
        }

        if(this.nativeValues && (expr.type==='Assignment' && expr.left?.type==='Identifier' || expr.type==='Update' && expr.argument?.type==='Identifier')) {
            const target=expr.type==='Update'?expr.argument:expr.left;
            const op=expr.type==='Update'?(expr.op==='++'?'+':'-'):expr.op.slice(0,-1);
            let value;
            if(expr.type==='Assignment' && expr.op==='=')value=this.arrayElementValue(expr.right);
            else if(['+','-','*','/','%','|','&','^','<<','>>','>>>'].includes(op)) {
                const left=expr.type==='Update'?{type:'Unary',op:'+',argument:target}:target;
                value=this.expr({type:'Binary',op,left,right:expr.type==='Update'?{type:'Number',value:'1'}:expr.right});
            } else {push(this.note(`${target.name} ${expr.op} — unsupported value assignment`));return;}
            if(this.capturedBindings.has(target.name))push(`arcade set captured ${this.capturedBindings.get(target.name)} to (${value})`);
            else if(target.temporary || this.localVars?.has(target.name) || this.currentParameters?.has(target.name))push(`arcade set local ${this.currentParameters?.has(target.name)?this.varName(target.name):target.name} to (${value})`);
            else push(`set ${this.varName(target.name)} to (${value})`);
            return;
        }

        const parameter = expr.type === 'Assignment' && expr.left?.type === 'Identifier' ? expr.left.name :
            expr.type === 'Update' && expr.argument?.type === 'Identifier' ? expr.argument.name : null;
        if (parameter && this.currentParameters?.has(parameter)) {
            const name=this.varName(parameter),prior=`arcade local ${name}`;
            const result=expr.type==='Update' ? `${prior} ${expr.op==='++'?'+':'-'} 1` : expr.op==='=' ? this.expr(expr.right) :
                ['+=','-=','*=','/='].includes(expr.op) ? `${prior} ${expr.op[0]} ${this.expr(expr.right)}` : null;
            if(result===null)push(this.note(`${parameter} ${expr.op} — unsupported parameter assignment`));
            else push(`arcade set local ${name} to ${result}`);return;
        }

        if (expr.type === 'Update' && expr.argument?.type === 'Identifier' && this.localVars?.has(expr.argument.name)) {
            push(`arcade set local ${expr.argument.name} to arcade local ${expr.argument.name} ${expr.op==='++'?'+':'-'} 1`);return;
        }

        if (expr.type === 'Assignment' && expr.left?.type === 'Identifier' &&
            (expr.left.temporary || this.localVars?.has(expr.left.name))) {
            const prior = `arcade local ${expr.left.name}`;
            const value = expr.valuePreserving?this.arrayElementValue(expr.right):this.expr(expr.right);
            const result = expr.op === '=' ? value :
                ['+=', '-=', '*=', '/='].includes(expr.op) ?
                    `${prior} ${expr.op[0]} ${value}` : null;
            if (result === null) push(this.note(`${expr.left.name} ${expr.op} — unsupported local assignment`));
            else push(`arcade set local ${expr.left.name} to ${result}`);
            return;
        }

        if (expr.type === 'Assignment' && expr.left?.type === 'Identifier' && this.capturedBindings.has(expr.left.name)) {
            const name = this.capturedBindings.get(expr.left.name), prior = `arcade captured ${name}`;
            const value = this.expr(expr.right);
            const result = expr.op === '=' ? value : ['+=','-=','*=','/='].includes(expr.op) ? `${prior} ${expr.op[0]} ${value}` : null;
            if (result === null) push(this.note(`${expr.left.name} ${expr.op} — unsupported captured assignment`));
            else push(`arcade set captured ${name} to ${result}`);
            return;
        }

        if (expr.type === 'Assignment' && expr.op === '+=' &&
            expr.left?.type === 'Identifier' && this.stringVars.has(expr.left.name)) {
            const name = this.varName(expr.left.name);
            push(`set ${name} to ${name} join ${this.expr(expr.right)}`);
            return;
        }

        // PXT TileMapData.scale setter (the map's own TileScale).
        if (this.handleTemplates && expr.type === 'Assignment' && expr.left?.type === 'Member' && expr.left.name === 'scale' &&
            this.tilemapDataReferences?.has(expr.left.object)) {
            const result = expr.op === '=' ? this.expr(expr.right) :
                ['+=','-=','*=','/=','%=','|=','&=','^=','<<=','>>=','>>>='].includes(expr.op) ? this.expr({type:'Binary',op:expr.op.slice(0,-1),left:expr.left,right:expr.right}) : null;
            if (result === null) push(this.note(`${this.path(expr.left)} ${expr.op} — unsupported assignment`));
            else push(`arcade set tilemap (${this.expr(expr.left.object)}) scale to (${result})`);
            return;
        }
        const handle = expr.type === 'Assignment' && expr.left?.type === 'Member' &&
            this.handleRef(expr.left.object);
        if (handle) {
            const property = expr.left.name;
            if (!['x', 'y', 'left', 'right', 'top', 'bottom', 'vx', 'vy', 'ax', 'ay', 'fx', 'fy', 'sx', 'sy', 'scale',
                'width', 'height', 'z', 'lifespan', 'rotation', 'rotationDegrees', 'data', 'flags'].includes(property)) {
                push(this.note(`${this.path(expr.left)} = … — unsupported Arcade handle property`));
                return;
            }
            if(property==='flags' && !this.primitiveReferences?.has(expr.right)){push(this.note('Sprite.flags assignment requires a proven primitive value; opaque or unknown conversion is not implemented'));return;}
            const value = this.expr(expr.right);
            const result = expr.op === '=' ? value :
                ['+=','-=','*=','/=','%=','|=','&=','^=','<<=','>>=','>>>='].includes(expr.op) ? this.expr({type:'Binary',op:expr.op.slice(0,-1),left:expr.left,right:expr.right}) : null;
            if (result === null) push(this.note(`${this.path(expr.left)} ${expr.op} — unsupported assignment`));
            else push(`arcade set ${property} of ${handle} to ${result}`);
            return;
        }

        if (expr.type === 'Assignment' && expr.left.type === 'Identifier' &&
            expr.right && expr.right.type === 'Call' && this.path(expr.right.callee) === 'sprites.create') {
            const owner = this.sprite(expr.left.name);
            if (owner) {
                this.pendingClone = owner.name;
                push(`# ${owner.name} is spawned here; in Scratch the parent is set up and then cloned`);
                return;
            }
        }

        if(expr.type==='Assignment') {
            const repeat=this.controllerRepeatSlot(expr.left);
            if(repeat){
                if(repeat.error)push(this.note(repeat.error));
                else if(expr.op!=='=')push(this.note('Controller repeat compound assignment requires qualified selected-SDK staging'));
                else push(`arcade set player ${repeat.player} button ${repeat.button} repeat property ${repeat.property} to (${this.expr(expr.right)})`);
                return;
            }
        }
        if(expr.type==='Assignment' && expr.left?.type==='Member' && expr.left.name==='connected' && /^controller\.player[1-4]$/.test(this.path(expr.left.object)||'')) {
            if(this.boundSourceGlobals?.has('controller') || this.sourceFunctions?.has('controller') || this.localVars?.has('controller') || this.currentParameters?.has('controller') || this.capturedBindings.has('controller')){push(this.note(`${this.path(expr.left)} refers to a shadowed controller binding`));return;}
            if(expr.op!=='='){push(this.note('Controller connected compound assignment requires a qualified controller value receiver'));return;}
            push(`arcade set controller player ${this.path(expr.left.object).slice(-1)} connected (${this.expr(expr.right)})`);return;
        }
        if (expr.type === 'Assignment' && expr.left.type === 'Member') {
            const owner = this.resolveSprite(expr.left.object);
            // \`paddle.x = …\` where \`paddle\` is a loop variable or a parameter: no
            // stage sprite to move. Falling through wrote \`set 0 to …\`, a variable
            // literally named 0 (the property read as an unresolved value).
            if (!owner && !(this.handleTemplates && this.handleRef(expr.left.object)) && SPRITE_PROPERTIES.has(expr.left.name)) {
                const name = expr.left.object.type === 'Identifier' ? expr.left.object.name : 'a value';
                push(this.note(`${name}.${expr.left.name} = … — a sprite held in a variable, which the stage cannot follow`));
                return;
            }
            if (owner) {
                const property = expr.left.name;
                // Velocity is the exception, and it costs nothing: vx and vy
                // already live in a shared variable that the owning sprite's
                // motion loop reads every frame, so ANOTHER script setting it
                // is exact and immediate — no broadcast, no frame of lag, and
                // it is what the game meant. Position is not so lucky: only
                // the sprite itself can be moved, which is why that stays a
                // refusal rather than becoming a broadcast behind your back.
                if (property === 'vx' || property === 'vy') {
                    owner.velocity = true;
                    const variable = `${owner.name}_${property}`;
                    this.declared.add(variable);
                    if (expr.op === '=') push(`set ${variable} to ${this.expr(expr.right)}`);
                    else if (expr.op === '+=') push(`change ${variable} by ${this.expr(expr.right)}`);
                    else if (expr.op === '-=') push(`change ${variable} by (0 - ${this.expr(expr.right)})`);
                    else push(`set ${variable} to ${variable} ${expr.op[0]} ${this.expr(expr.right)}`);
                    return;
                }
                if (owner !== this.self) {
                    push(this.note(`${owner.name}.${property} = … — a script can only change its own sprite`));
                    return;
                }
                if (property === 'x' || property === 'y') {
                    const isX = property === 'x';
                    if (expr.op === '=') {
                        push(`set ${isX ? 'x' : 'y'} to ${isX ? this.stageX(expr.right) : this.stageY(expr.right)}`);
                        return;
                    }
                    if (expr.op === '+=' || expr.op === '-=') {
                        // Two sign flips, and they compose: `-=` reverses the
                        // move, and Arcade's y grows DOWNWARD while the stage's
                        // grows up. Treating every compound operator as `+=`
                        // sent a sprite the wrong way on `x -= n` and was right
                        // on `y -= n` only by accident.
                        const negate = isX ? expr.op === '-=' : expr.op === '+=';
                        push(`change ${isX ? 'x' : 'y'} by ${this.stageLength(expr.right, {negate})}`);
                        return;
                    }
                    // `*=` and `/=` scale the ARCADE coordinate, which is not
                    // the stage one — the stage's origin is elsewhere. So read
                    // back into Arcade units, apply the operator there, and
                    // transform the result, rather than scaling a number that
                    // means something different.
                    const arcade = isX ?
                        `(x position / ${SCALE} + ${HALF_WIDTH})` :
                        `(${HALF_HEIGHT} - y position / ${SCALE})`;
                    const applied = `((${arcade}) ${expr.op[0]} ${this.expr(expr.right)})`;
                    push(isX ?
                        `set x to (${applied} - ${HALF_WIDTH}) * ${SCALE}` :
                        `set y to (${HALF_HEIGHT} - ${applied}) * ${SCALE}`);
                    return;
                }
                push(this.note(`sprite.${property} = …`));
                return;
            }
        }
        super.expressionStatement(expr, indent, out);
    }
}

// PXT negative kinds retain their numeric identity for callbacks, but do not
// join spritesByKind. Only fixed literals are admitted here; runtime kind
// expressions and unsupported positive numeric identities remain diagnosed.
const negativeKind = node => {
    const value = node?.type === 'Number' ? Number(node.value) :
        node?.type === 'Unary' && node.op === '-' && node.argument?.type === 'Number' ?
            -Number(node.argument.value) : NaN;
    return Number.isFinite(value) && value < 0 ? value : null;
};
const fixedKind = node => !!node && ['Number','Unary','Identifier','Member','Call','Binary','Null','Undefined','Conditional'].includes(node.type);

/** SpriteKind member or fixed negative numeric kind → native kind identity. */
const kindOf = node => {
    if (negativeKind(node) !== null) return String(negativeKind(node));
    if (node && node.type === 'Member') return node.name;
    if (node && node.type === 'Identifier') return node.name;
    return 'Player';
};

/** Recover pure typed operator helpers emitted for PXT's mixed-value typing.
 * Match the full body and every use before inlining; names alone never grant
 * intrinsic semantics. Evaluating the operands preserves call argument order.
 */
// Arcade destroys the current kind collection, not a live query on each
// iteration. Lower through the same snapshot-array and handle destruction
// primitives exposed in Blocks. Newly created callback sprites survive.
const lowerDestroyAllSprites = (program, source) => {
    let suffix = 0;
    const visit = node => {
        if (Array.isArray(node)) return node.map(visit);
        if (!node || typeof node !== 'object') return node;
        for (const key of Object.keys(node)) node[key] = visit(node[key]);
        const call = node.type === 'ExpressionStatement' && node.expr;
        const callee = call?.type === 'Call' && call.callee;
        const kind = call?.args?.[0];
        if (callee?.type !== 'Member' || callee.object?.type !== 'Identifier' ||
            callee.object.name !== 'sprites' || callee.name !== 'destroyAllSpritesOfKind' ||
            call.args.length !== 1 || !fixedKind(kind)) return node;
        do suffix++; while (source.includes(`__bwDestroyKindSprite${suffix}`));
        const name = `__bwDestroyKindSprite${suffix}`;
        return {type: 'ForOf', kind: 'let', name,
            iterable: {type: 'Call', callee: {...callee, name: 'allOfKind'}, args: [kind]},
            body: [{type: 'ExpressionStatement', expr: {type: 'Call',
                callee: {type: 'Member', object: {type: 'Identifier', name}, name: 'destroy'}, args: []}}]};
    };
    return visit(program);
};

// `for (const x of list)` in MakeCode iterates a SNAPSHOT of the array value
// by index. The parser gives every translator a ForOf node; this importer
// lowers it to that index loop, so a reference array (sprites, rows) keeps
// its identity and an element reads through the array-reference words.
// The two helper names are unique within the program's own identifiers.
// Names a function body declares: its parameters, declarations and nested function names.
const declaredNames = fn => {
    const names = new Set(fn.params || []);
    const visit = node => {
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (!node || typeof node !== 'object') return;
        if (node.type === 'Declaration') for (const decl of node.decls) names.add(decl.name);
        if (node.type === 'FunctionDeclaration') { names.add(node.name); return; }
        if (['ForOf'].includes(node.type)) names.add(node.name);
        if (node.type === 'FunctionExpression') return;
        for (const value of Object.values(node)) visit(value);
    };
    visit(fn.body);
    return names;
};
const referencedNames = node => {
    const names = new Set();
    const visit = value => {
        if (Array.isArray(value)) { value.forEach(visit); return; }
        if (!value || typeof value !== 'object') return;
        if (value.type === 'Identifier') names.add(value.name);
        if (value.type === 'This') names.add('this');
        for (const child of Object.values(value)) visit(child);
    };
    visit(node);
    return names;
};
// An immediately invoked function expression, \`(function () { ... })()\`, becomes a
// generated top-level function and its call, when its body uses no parameter or
// local of an enclosing function (a top-level function cannot reach those).
const lowerIifes = (program, source) => {
    let suffix = 0;
    const fresh = () => { do suffix++; while (source.includes(`__bwIife${suffix}`)); return `__bwIife${suffix}`; };
    const lifted = [];
    const visit = (node, enclosing) => {
        if (Array.isArray(node)) return node.map(child => visit(child, enclosing));
        if (!node || typeof node !== 'object') return node;
        const inner = ['FunctionDeclaration', 'FunctionExpression'].includes(node.type) ?
            new Set([...enclosing, ...declaredNames(node)]) : enclosing;
        for (const key of Object.keys(node)) node[key] = visit(node[key], inner);
        if (node.type !== 'Call' || node.callee?.type !== 'FunctionExpression' || node.args.length || node.callee.params.length) return node;
        const fn = node.callee, own = declaredNames(fn);
        const captured = [...referencedNames(fn.body)].filter(name => name === 'this' || enclosing.has(name) && !own.has(name));
        if (captured.length) return node;
        const name = fresh();
        lifted.push({type: 'FunctionDeclaration', name, params: [], paramTypes: {}, returnType: fn.returnType || '', optionalParams: [], body: fn.body});
        return {type: 'Call', callee: {type: 'Identifier', name}, args: []};
    };
    const body = visit(program.body, new Set());
    return {...program, body: [...lifted, ...body]};
};
// Statement-level \`array.forEach(fn)\` and \`array.filter(pred).forEach(fn)\` become loops.
// filter runs every predicate before any callback, as in PXT, so it fills a fresh
// array first. Callbacks with other returns than a single expression stay calls.
const lowerArrayCallbacks = (program, source) => {
    let suffix = 0;
    const fresh = base => { do suffix++; while (source.includes(`${base}${suffix}`)); return `${base}${suffix}`; };
    const id = name => ({type: 'Identifier', name});
    const hasReturn = body => {
        let found = false;
        const visit = node => {
            if (found || !node || typeof node !== 'object') return;
            if (Array.isArray(node)) { node.forEach(visit); return; }
            if (node.type === 'Return') { found = true; return; }
            if (['FunctionExpression', 'FunctionDeclaration'].includes(node.type)) return;
            Object.values(node).forEach(visit);
        };
        visit(body);
        return found;
    };
    // A callback body as statements: an expression arrow's value is discarded.
    const callbackStatements = fn => {
        const body = fn.body;
        if (body.length === 1 && body[0].type === 'Return' && body[0].value) return [{type: 'ExpressionStatement', expr: body[0].value}];
        return hasReturn(body) ? null : body;
    };
    const closedCallback = fn => fn?.type === 'FunctionExpression' && Array.isArray(fn.params) &&
        fn.params.length >= 1 && fn.params.length <= 2 && new Set(fn.params).size === fn.params.length &&
        fn.params.every(name => typeof name === 'string') && Array.isArray(fn.body) &&
        !['async','isAsync','generator','isGenerator','restParam'].some(key => fn[key]) &&
        !['optionalParams','parameterDefaults','parameterProperties','typeParameters','genericParams'].some(key =>
            fn[key]?.length || fn.params[key]?.length) && !Object.keys(fn.paramDefaults || {}).length;
    const predicate = fn => {
        if (!closedCallback(fn)) return null;
        const last = fn.body[fn.body.length - 1], before = fn.body.slice(0, -1);
        // Every predicate must produce its value after the same straight-line
        // prefix. Early returns retain their original call and remain diagnosed.
        if (last?.type !== 'Return' || !last.value || hasReturn(before)) return null;
        return {before, value: last.value};
    };
    const loop = (array, fn, statements) => {
        if (fn.params.length === 1) return [{type: 'ForOf', name: fn.params[0], kind: 'const', iterable: array, body: statements}];
        // A named array is indexed directly (keeping its element type); any
        // other expression is evaluated once into a fresh alias first.
        const named = array?.type === 'Identifier', items = named ? array.name : fresh('__bwEachArray'), [element, index] = fn.params;
        return [...(named ? [] : [{type: 'Declaration', kind: 'let', decls: [{name: items, init: array, isArray: true}]}]),
            {type: 'For', init: {type: 'Declaration', kind: 'let', decls: [{name: index, init: {type: 'Number', value: '0'}}]},
                test: {type: 'Binary', op: '<', left: id(index), right: {type: 'Member', object: id(items), name: 'length'}},
                update: {type: 'Update', op: '++', argument: id(index), prefix: false},
                body: [{type: 'Declaration', kind: 'const', decls: [{name: element, init: {type: 'Index', object: id(items), index: id(index)}}]}, ...statements]}];
    };
    const lowerStatement = statement => {
        const call = statement.type === 'ExpressionStatement' && statement.expr;
        // A statement-level map discards its result array, so it visits like forEach.
        if (call?.type !== 'Call' || call.callee?.type !== 'Member' || call.callee.name !== 'forEach' || call.args.length !== 1) return null;
        const fn = call.args[0];
        if (!closedCallback(fn)) return null;
        const statements = callbackStatements(fn);
        if (!statements) return null;
        const source = call.callee.object;
        const filter = source?.type === 'Call' && source.callee?.type === 'Member' && source.callee.name === 'filter' && source.args.length === 1 ?
            predicate(source.args[0]) : null;
        if (!filter) return loop(source, fn, statements);
        const kept = fresh('__bwFiltered'), predicateFn = source.args[0], item = predicateFn.params[0];
        return [{type: 'Declaration', kind: 'let', decls: [{name: kept, init: {type: 'Array', items: []}, isArray: true}]},
            ...loop(source.callee.object, predicateFn, [...filter.before, {type: 'If', test: filter.value,
                consequent: [{type: 'ExpressionStatement', expr: {type: 'Call', callee: {type: 'Member', object: id(kept), name: 'push'}, args: [id(item)]}}],
                alternate: null}]),
            ...loop(id(kept), fn, statements)];
    };
    const visit = node => {
        if (Array.isArray(node)) {
            const out = [];
            for (const child of node) {
                const visited = visit(child);
                const lowered = visited && typeof visited === 'object' && !Array.isArray(visited) ? lowerStatement(visited) : null;
                if (lowered) out.push(...lowered); else out.push(visited);
            }
            return out;
        }
        if (!node || typeof node !== 'object') return node;
        for (const key of Object.keys(node)) node[key] = visit(node[key]);
        return node;
    };
    return visit(program);
};
const desugarForOf = (program, source) => {
    let suffix = 0;
    const fresh = () => {
        do suffix++; while (source.includes(`__bwForOfArray${suffix}`) || source.includes(`__bwForOfIndex${suffix}`));
        return suffix;
    };
    const id = name => ({type: 'Identifier', name});
    const visit = node => {
        if (Array.isArray(node)) return node.map(visit);
        if (!node || typeof node !== 'object') return node;
        for (const key of Object.keys(node)) node[key] = visit(node[key]);
        if (node.type !== 'ForOf') return node;
        const n = fresh();
        const array = `__bwForOfArray${n}`;
        const index = `__bwForOfIndex${n}`;
        const body = Array.isArray(node.body) ? node.body : [node.body];
        return {type: 'Block', body: [
            {type: 'Declaration', kind: 'let', decls: [{name: array, init: node.iterable, isArray: true}]},
            {type: 'For', init: {type: 'Declaration', kind: 'let', decls: [{name: index, init: {type: 'Number', value: 0}}]},
                test: {type: 'Binary', op: '<', left: id(index), right: {type: 'Member', object: id(array), name: 'length'}},
                update: {type: 'Update', op: '++', argument: id(index), prefix: false},
                body: [{type: 'Declaration', kind: node.kind || 'let',
                    decls: [{name: node.name, init: {type: 'Index', object: id(array), index: id(index)}}]}, ...body]}
        ]};
    };
    return visit(program);
};

// Lite's own Arcade export carries the run-token machinery that makes Scratch's
// \`stop\` blocks work in PXT (arcade-runtime.js \`tok\`/\`others\`, export-arcade.js
// stop()). Read back as user code it became DEFINE _tok / _dead / _stopAll and
// the \`stop all\` itself was lost. When that machinery is present VERBATIM, this
// lifts it back: \`_stopAll()\` is \`stop all\`, a mark of \`_stopOthers\` is \`stop
// other scripts in sprite\`, and the run-token lines and their guards vanish.
// This recognizer admits the complete no-clone/no-speech recipe. Other
// stop recipes remain ordinary source until their full receiver/effect proof
// is available; a matching first assignment never authorizes deleting a body.
const liftExporterStops = (program,profile) => {
    const proof=inspectGeneratedHelperBindings(program,profile);
    if(!proof.isCurrent())return program;
    const functions=program.body.filter(n=>n.type==='FunctionDeclaration');
    const fn=name=>functions.find(n=>n.name===name);
    const tok=fn('_tok'),dead=fn('_dead'),stop=fn('_stopAll');
    if(!proof.root(tok)||!proof.root(dead)||!stop||!proof.root(stop))return program;
    const tokSource=HELPERS.tok.ts;
    // matches selects the function from a source fragment by its declaration.
    const tokText=tokSource.slice(tokSource.indexOf('function _tok'),tokSource.indexOf('function _dead'));
    const deadText=tokSource.slice(tokSource.indexOf('function _dead'));
    if(!proof.matches(tok,tokText)||!proof.matches(dead,deadText)||
        !proof.matches(stop,'function _stopAll () {_stopMark = _tokens\n music.stopAllSounds()}'))return program;
    const helpers=new Set([tok,dead,stop]),allowed=new Set(),remove=new Set(helpers),replacements=new Map(),guards=new Map();
    const include=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(include);return;}
        allowed.add(node);for(const v of Object.values(node))include(v);};
    helpers.forEach(include);
    const call=(n,target,arity)=>n?.type==='Call'&&n.args?.length===arity&&proof.declarationAt(n.callee)===target;
    const zero=n=>n?.type==='Number'&&Number(n.value)===0;
    const rootDecl=name=>program.body.find(n=>n.type==='Declaration'&&n.decls.length===1&&n.decls[0].name===name&&zero(n.decls[0].init));
    const tokens=rootDecl('_tokens'),mark=rootDecl('_stopMark');
    if(!tokens||!mark||tokens.kind!=='let'||mark.kind!=='let'||!proof.unique('_tokens')||!proof.unique('_stopMark'))return program;
    const storage=(n,d)=>n?.type==='Identifier'&&proof.declarationAt(n)===d.decls[0];
    const path=n=>n?.type==='Identifier'?n.name:n?.type==='Member'?path(n.object)+'.'+n.name:null;
    // The exporter's own sprite prologue, exactly: a root
    // `let <X>Sprite = sprites.create(img`...`, SpriteKind.<K>)` and its
    // literal-arithmetic `<X>Sprite.setPosition(a, b)`. These run no source
    // callback and cannot read or write the stop storage; any other use of
    // the Sprite binding remains subject to the ordinary ambient proof.
    const literalArithmetic=n=>n?.type==='Number'||n?.type==='Binary'&&['+','-','*','/'].includes(n.op)&&literalArithmetic(n.left)&&literalArithmetic(n.right);
    const spritePrologue=new Set(),prologueSprites=new Set();
    for(const n of program.body){
        const d=n.type==='Declaration'&&n.kind==='let'&&n.decls.length===1?n.decls[0]:null,init=d?.init;
        if(!d||!/^\w+Sprite$/.test(d.name)||init?.type!=='Call'||init.isNew||path(init.callee)!=='sprites.create'||init.args?.length!==2||
            init.args[0]?.type!=='Template'||init.args[0].tag!=='img'||init.args[1]?.type!=='Member'||init.args[1].object?.type!=='Identifier'||
            init.args[1].object.name!=='SpriteKind'||!proof.unbound(init.args[1].object)||!proof.unbound(init.callee.object)||!proof.unique(d.name))continue;
        spritePrologue.add(n);prologueSprites.add(d);
    }
    for(const n of program.body){
        const c=n.type==='ExpressionStatement'?n.expr:null;
        if(c?.type==='Call'&&!c.isNew&&c.callee?.type==='Member'&&c.callee.name==='setPosition'&&c.callee.object?.type==='Identifier'&&
            prologueSprites.has(proof.declarationAt(c.callee.object))&&c.args?.length===2&&c.args.every(literalArithmetic))spritePrologue.add(n);
    }
    const inPrologue=n=>{for(let p=n;p;p=proof.parentOf(p))if(spritePrologue.has(p))return true;return false;};
    const activation=node=>{
        let owner=node;while(owner&&!['FunctionDeclaration','FunctionExpression'].includes(owner.type))owner=proof.parentOf(owner);
        if(owner?.type!=='FunctionExpression')return null;
        const registration=proof.parentOf(owner),api=path(registration?.callee);
        if(registration?.type!=='Call'||!registration.args.includes(owner)||registration.isNew||
            !(['game.onUpdate','game.onUpdateInterval','control.runInParallel','info.onCountdownEnd','info.onLifeZero'].includes(api)||
                /^controller\.(?:A|B|up|down|left|right|menu)\.onEvent$/.test(api||'')))return null;
        let base=registration.callee;while(base?.type==='Member')base=base.object;
        return proof.unbound(base)?owner:null;
    };
    // The exporter's second-export form of the same prologue, exactly: a root
    // `let <X>Sprite: Sprite` with no initializer, and as consecutive
    // statements directly in the body of a root `control.runInParallel` start
    // function `<X>Sprite = null`, `<X>Sprite = sprites.create(img`...`,
    // SpriteKind.<K>)` and, optionally next, its literal-arithmetic
    // `<X>Sprite.setPosition(a, b)`. Nothing else (another statement between
    // them, a nested block, another receiver or initializer) is the recipe.
    const createCall=init=>init?.type==='Call'&&!init.isNew&&path(init.callee)==='sprites.create'&&init.args?.length===2&&
        init.args[0]?.type==='Template'&&init.args[0].tag==='img'&&init.args[1]?.type==='Member'&&init.args[1].object?.type==='Identifier'&&
        init.args[1].object.name==='SpriteKind'&&proof.unbound(init.args[1].object)&&proof.unbound(init.callee.object);
    const assigned=(n,d)=>{const x=n?.type==='ExpressionStatement'?n.expr:null;
        return x?.type==='Assignment'&&x.op==='='&&x.left?.type==='Identifier'&&proof.declarationAt(x.left)===d?x.right:undefined;};
    const nullPrologue=new Set(program.body.filter(n=>n.type==='Declaration'&&n.kind==='let'&&n.decls.length===1&&n.decls[0].init==null&&
        n.decls[0].typeName==='Sprite'&&!n.decls[0].isArray&&/^\w+Sprite$/.test(n.decls[0].name)&&proof.unique(n.decls[0].name)).map(n=>n.decls[0]));
    for(const root of program.body){
        const c=root.type==='ExpressionStatement'?root.expr:null,owner=c?.type==='Call'&&c.args?.length===1?c.args[0]:null;
        if(path(c?.callee)!=='control.runInParallel'||owner?.type!=='FunctionExpression'||activation(owner.body?.[0])!==owner)continue;
        const list=owner.body;
        for(let i=0;i<list.length-1;i++){
            const d=[...nullPrologue].find(x=>assigned(list[i],x)?.type==='Null');
            if(!d||!createCall(assigned(list[i+1],d)))continue;
            spritePrologue.add(list[i]);spritePrologue.add(list[i+1]);prologueSprites.add(d);nullPrologue.delete(d);
            const p=list[i+2]?.type==='ExpressionStatement'?list[i+2].expr:null;
            if(p?.type==='Call'&&!p.isNew&&p.callee?.type==='Member'&&p.callee.name==='setPosition'&&p.callee.object?.type==='Identifier'&&
                proof.declarationAt(p.callee.object)===d&&p.args?.length===2&&p.args.every(literalArithmetic))spritePrologue.add(list[i+2]);
        }
    }
    const tokenDecls=new Map(),tokenOwners=new Map();
    for(const n of proof.nodes)if(n.type==='Declaration'&&n.kind==='const'&&n.decls.length===1&&call(n.decls[0].init,tok,0)){
        const owner=activation(n);if(!owner||owner.body?.[0]!==n)return program;
        tokenDecls.set(n.decls[0],n);tokenOwners.set(n.decls[0],owner);include(n);remove.add(n);
    }
    const token=n=>n?.type==='Identifier'&&tokenDecls.has(proof.declarationAt(n));
    const marker=name=>({type:'ExpressionStatement',expr:{type:'Call',callee:{type:'Identifier',name},args:[]}});
    const pairs=[];
    const lists=[];const collectLists=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){lists.push(n);n.forEach(collectLists);}
        else for(const v of Object.values(n))collectLists(v);};collectLists(program);
    for(const list of lists)for(let i=0;i<list.length-1;i++){
        const a=list[i],b=list[i+1],x=a?.type==='ExpressionStatement'&&a.expr,y=b?.type==='ExpressionStatement'&&b.expr;
        if(x?.type!=='Assignment'||x.op!=='='||!storage(x.right,tokens)||y?.type!=='Assignment'||y.op!=='='||!token(y.right))continue;
        const md=proof.declarationAt(x.left),kd=proof.declarationAt(y.left);
        const ms=program.body.find(n=>n.type==='Declaration'&&n.decls.length===1&&n.decls[0]===md&&zero(md.init));
        const ks=program.body.find(n=>n.type==='Declaration'&&n.decls.length===1&&n.decls[0]===kd&&zero(kd.init));
        if(!ms||!ks||ms.kind!=='let'||ks.kind!=='let'||md===kd||[tokens.decls[0],mark.decls[0]].includes(md)||
            [tokens.decls[0],mark.decls[0]].includes(kd)||!proof.unique(md.name)||!proof.unique(kd.name))return program;
        if(activation(a)!==tokenOwners.get(proof.declarationAt(y.right)))return program;
        pairs.push({md,kd,token:proof.declarationAt(y.right)});include(a);include(b);include(ms);include(ks);
        remove.add(ms);remove.add(ks);remove.add(b);replacements.set(a,marker('__bwStopOthers'));
    }
    if(pairs.length){
        // The initial mark recipe is limited to ordinary scripts emitted on
        // Game. A source Sprite/scene/class route needs its own target recipe;
        // marker spellings do not prove the receiver of stop-other scripts.
        const roots=new Set(['game','control','controller','music','basic','pause','console','Math','Array','Object','JSON','String','Number','isNaN','undefined','Infinity','NaN']);
        if(proof.nodes.some(n=>!inPrologue(n)&&['Class','ClassDeclaration','Method'].includes(n.type)||!inPrologue(n)&&(
            n.type==='Identifier'&&(['sprites','SpriteKind','scene','mp','self','this'].includes(n.name)||
                !proof.declarationAt(n)&&!roots.has(n.name))||
            n.type==='Call'&&(n.isNew||n.constructorCall||n.callee?.type==='Index'))))return program;
    }
    const bareReturn=n=>Array.isArray(n)?n.length===1&&bareReturn(n[0]):n?.type==='Return'&&!n.value||n?.type==='Block'&&bareReturn(n.body);
    const terms=n=>n?.type==='Binary'&&n.op==='||'?[...terms(n.left),...terms(n.right)]:[n];
    const guard=n=>{
        if(call(n,dead,1)&&token(n.args[0])&&activation(n)===tokenOwners.get(proof.declarationAt(n.args[0])))return true;
        if(n?.type!=='Binary'||n.op!=='&&')return false;
        const a=n.left,b=n.right;if(a?.type!=='Binary'||a.op!=='<='||b?.type!=='Binary'||b.op!='!=')return false;
        // Every Game script guards with its OWN run token against the pair
        // recorded by whichever script stopped the others.
        return token(a.left)&&token(b.left)&&activation(n)===tokenOwners.get(proof.declarationAt(a.left))&&proof.declarationAt(a.left)===proof.declarationAt(b.left)&&
            pairs.some(p=>proof.declarationAt(a.right)===p.md&&proof.declarationAt(b.right)===p.kd);
    };
    for(const n of proof.nodes){
        if(n.type==='If'&&!n.alternate&&bareReturn(n.consequent)){
            const all=terms(n.test),kept=all.filter(t=>!guard(t));if(kept.length===all.length)continue;
            all.filter(guard).forEach(include);guards.set(n,kept);
        }
        if(n.type==='ExpressionStatement'&&call(n.expr,stop,0)){
            const owner=activation(n),list=lists.find(rows=>rows.includes(n)),at=list?.indexOf(n);
            if(!owner||![...tokenOwners.values()].includes(owner)||!list||
                !(bareReturn(list[at+1])||list===owner.body&&at===list.length-1))return program;
            include(n);replacements.set(n,marker('__bwStopAll'));
        }
    }
    include(tokens);include(mark);remove.add(tokens);remove.add(mark);
    // Every actual binding reference is accounted for before deleting any
    // storage, token, guard or helper. Foreign writes/reads/escapes refuse all.
    const protectedDeclarations=new Set([tok,dead,stop,tokens.decls[0],mark.decls[0],...tokenDecls.keys(),...pairs.flatMap(p=>[p.md,p.kd])]);
    for(const n of proof.nodes)if(n.type==='Identifier'){
        if(protectedDeclarations.has(proof.declarationAt(n))&&!allowed.has(n))return program;
        if(n.name==='music'&&(!allowed.has(n)||!proof.unbound(n)))return program;
    }
    if(!proof.ambient(new Set([...helpers,...spritePrologue]))||!proof.calls(tok,[0],helpers)||!proof.calls(dead,[1],helpers)||!proof.calls(stop,[0],helpers)||!proof.isCurrent())return program;
    const rewrite=n=>{
        if(!n||typeof n!=='object')return n;
        if(Array.isArray(n)){
            const kept=n.filter(x=>!remove.has(x)&&!(guards.has(x)&&!guards.get(x).length));
            return mapGeneratedSourceArray(kept.length===n.length?n:kept,rewrite);
        }
        if(replacements.has(n))return replacements.get(n);
        if(guards.has(n)){const kept=guards.get(n);return {...n,test:kept.map(rewrite).reduce((left,right)=>({type:'Binary',op:'||',left,right})),consequent:rewrite(n.consequent)};}
        return Object.fromEntries(Object.entries(n).map(([k,v])=>[k,rewrite(v)]));
    };
    return rewrite(program);
};

// A nested function declaration whose only free references to its enclosing
// root function are that function's never-written parameters is lifted to the
// root with those parameters appended, and each direct call passes them. A
// read-only parameter has one value for the whole activation, so the lifted
// call reads exactly what the closure read in original PXT. Anything else
// (writes, enclosing locals, escapes, defaults, deeper nesting, name
// collisions) keeps the original program and its existing diagnostics.
const liftNestedParameterCaptures = program => {
    if(!program||!Array.isArray(program.body))return program;
    const walk=(node,visit,parent=null)=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){for(const x of node)walk(x,visit,parent);return;}
        visit(node,parent);for(const v of Object.values(node))if(v&&typeof v==='object')walk(v,visit,node);};
    const topNames=new Set();
    for(const n of program.body){if(n.type==='FunctionDeclaration')topNames.add(n.name);if(n.type==='Declaration')for(const d of n.decls||[])topNames.add(d.name);}
    const plain=fn=>Array.isArray(fn.params)&&fn.params.every(p=>typeof p==='string')&&!(fn.optionalParams||[]).length&&!(fn.parameterDefaults||[]).length&&!(fn.typeParameters||[]).length;
    let changed=false;const body=[];
    for(const root of program.body){
        if(root.type!=='FunctionDeclaration'||!plain(root)||!Array.isArray(root.body)){body.push(root);continue;}
        const params=new Set(root.params);
        const rootLocals=new Set();walk(root.body,n=>{if(n.type==='Declaration')for(const d of n.decls||[])rootLocals.add(d.name);});
        const written=new Set();
        walk(root.body,n=>{const t=n.type==='Assignment'?n.left:n.type==='Update'?n.argument:null;if(t?.type==='Identifier')written.add(t.name);});
        const lifted=[],rewrites=new Map();
        for(const nested of root.body){
            if(nested.type!=='FunctionDeclaration'||!plain(nested)||!Array.isArray(nested.body))continue;
            let ok=!topNames.has(nested.name)&&!params.has(nested.name)&&!rootLocals.has(nested.name);
            const own=new Set(nested.params),captured=[];
            walk(nested.body,n=>{
                if(['FunctionDeclaration','FunctionExpression','Class','ClassDeclaration','Method'].includes(n.type))ok=false;
                if(n.type==='Declaration')for(const d of n.decls||[])own.add(d.name);
            });
            walk(nested.body,(n,parent)=>{
                if(n.type!=='Identifier'||parent?.type==='Member'&&parent.object!==n&&parent.name===n.name)return;
                if(own.has(n.name))return;
                if(params.has(n.name)){if(written.has(n.name)||rootLocals.has(n.name))ok=false;else if(!captured.includes(n.name))captured.push(n.name);}
                else if(rootLocals.has(n.name)||root.body.some(x=>x!==nested&&x.type==='FunctionDeclaration'&&x.name===n.name))ok=false;
            });
            for(const name of captured)if(own.has(name))ok=false;
            if(!ok)continue;
            // Every reference to the nested name in the root is its direct call
            // with exactly its declared arity; nothing outside the root names it.
            const calls=[];
            walk(root.body,(n,parent)=>{
                if(n.type!=='Identifier'||n.name!==nested.name)return;
                if(parent?.type==='Call'&&parent.callee===n&&!parent.isNew&&(parent.args||[]).length===nested.params.length&&
                    !(parent.args||[]).some(a=>a?.type==='Spread'))calls.push(parent);
                else ok=false;
            });
            let outside=false;
            for(const other of program.body)if(other!==root)walk(other,n=>{if(n.type==='Identifier'&&n.name===nested.name)outside=true;});
            if(!ok||outside)continue;
            const paramTypes={...(nested.paramTypes||{})};for(const name of captured)if(root.paramTypes?.[name])paramTypes[name]=root.paramTypes[name];
            lifted.push({...nested,params:[...nested.params,...captured],paramTypes});
            for(const call of calls)rewrites.set(call,captured);
            topNames.add(nested.name);
        }
        if(!lifted.length){body.push(root);continue;}
        changed=true;
        const liftedNames=new Set(lifted.map(fn=>fn.name));
        const rewrite=node=>{
            if(!node||typeof node!=='object')return node;
            if(Array.isArray(node))return node.filter(x=>!(x?.type==='FunctionDeclaration'&&liftedNames.has(x.name)&&root.body.includes(x))).map(rewrite);
            const out=Object.fromEntries(Object.entries(node).map(([k,v])=>[k,rewrite(v)]));
            if(rewrites.has(node))out.args=[...out.args,...rewrites.get(node).map(name=>({type:'Identifier',name}))];
            return out;
        };
        body.push({...root,body:rewrite(root.body)},...lifted.map(fn=>({...fn,body:rewrite(fn.body)})));
    }
    return changed?{...program,body}:program;
};

// PXT library calls that are, by their own definition, expressions the
// translator already has, rewritten to those before translation:
// Math.percentChance retains a dedicated operation: boundary guards consume no entropy.
// Math.clamp retains its original three-argument evaluation and raw selection order.
// Scene and program clocks keep distinct native reporters; no clock alias is lowered.
// These Math APIs use dedicated native reporters. Retain the source expression
// tree: rewriting calls changed caller order and raw numeric selection.
const lowerLibraryCalls = program => program;



const inlineValueHelpers = (program, requireUnshadowedBindings = false) => {
    const helpers=new Map();
    for(const fn of program.body) {
        if(fn.type!=='FunctionDeclaration' || !/^__bw(?:Binary|Unary|Compare)/.test(fn.name) || fn.body.length!==1 || fn.body[0].type!=='Return')continue;
        const value=fn.body[0].value;
        if(value?.type==='Binary' && ['+','-','*','/','%','**','==','!=','===','!==','<','>','<=','>='].includes(value.op) && fn.params.length===2 && value.left?.type==='Identifier' && value.left.name===fn.params[0] && value.right?.type==='Identifier' && value.right.name===fn.params[1])helpers.set(fn.name,{fn,value});
        if(value?.type==='Unary' && ['+','-'].includes(value.op) && fn.params.length===1 && value.argument?.type==='Identifier' && value.argument.name===fn.params[0])helpers.set(fn.name,{fn,value});
    }
    const unsafe=new Set();
    const inspect=(node,parent,key)=>{
        if(!node || typeof node!=='object')return;
        if(node.type==='Identifier' && helpers.has(node.name) && !(parent?.type==='Call' && key==='callee' && parent.args.length===helpers.get(node.name).fn.params.length))unsafe.add(node.name);
        for(const [key,value] of Object.entries(node))if(Array.isArray(value))value.forEach(child=>inspect(child,node,key));else inspect(value,node,key);
    };
    inspect(program);for(const name of unsafe)helpers.delete(name);
    if(requireUnshadowedBindings){
        const counts=new Map();
        const add=name=>{if(helpers.has(name))counts.set(name,(counts.get(name)||0)+1);};
        const bindings=node=>{
            if(!node || typeof node!=='object')return;
            if(Array.isArray(node)){node.forEach(bindings);return;}
            if(node.type==='Declaration')node.decls.forEach(decl=>add(decl.name));
            if(['FunctionDeclaration','Class','ForOf'].includes(node.type))add(node.name);
            if(Array.isArray(node.params))node.params.forEach(add);
            Object.values(node).forEach(bindings);
        };
        bindings(program);for(const name of helpers.keys())if(counts.get(name)!==1)helpers.delete(name);
    }
    if(!helpers.size)return program;
    const rewrite=node=>{
        if(!node || typeof node!=='object')return node;
        if(Array.isArray(node))return mapGeneratedSourceArray(node,rewrite);
        if(node.type==='Call' && node.callee?.type==='Identifier' && helpers.has(node.callee.name)) {
            const {value}=helpers.get(node.callee.name),args=node.args.map(rewrite);
            return value.type==='Binary'?{...value,left:args[0],right:args[1]}:{...value,argument:args[0]};
        }
        return Object.fromEntries(Object.entries(node).map(([key,value])=>[key,rewrite(value)]));
    };
    return rewrite({...program,body:program.body.filter(fn=>!(fn.type==='FunctionDeclaration' && helpers.has(fn.name)))});
};

/** Infer which procedure parameters receive runtime sprite handles. Follow
 * calls until a function forwarding a handle to another one reaches a fixed
 * point; callback parameters seed the graph with their event handles. */
const inferProcedureHandleParameters = (ast, functions, globalHandles, pathOf) => {
    const byName = new Map(functions.map(fn => [fn.name, fn]));
    const handles = new Map(functions.map(fn => [fn.name, new Set()]));
    for (const fn of functions) {
        const walk = node => {
            if (!node || typeof node !== 'object' || node.type === 'FunctionExpression') return;
            const owner = node.type === 'Call' && node.callee?.object;
            if (owner?.type === 'Member' && owner.name === 'image' && owner.object?.type === 'Identifier' &&
                fn.params.includes(owner.object.name) && ['copyFrom', 'scroll', 'fill', 'replace', 'flipX', 'flipY', 'setPixel', 'getPixel', 'fillRect', 'drawLine', 'drawCircle', 'fillCircle', 'drawImage', 'drawTransparentImage', 'overlapsWith'].includes(node.callee.name)) {
                handles.get(fn.name).add(owner.object.name);
            }
            for (const value of Object.values(node)) {
                if (Array.isArray(value)) value.forEach(walk);
                else if (value && typeof value === 'object') walk(value);
            }
        };
        fn.body.forEach(walk);
    }
    const localSpriteNames = body => {
        const names = new Set();
        const create = node => node?.type === 'Call' &&
            ['sprites.create', 'sprites.createProjectile', 'sprites.createProjectileFromSide',
                'sprites.createProjectileFromSprite'].includes(pathOf(node.callee));
        const walk = statements => {
            for (const st of statements || []) {
                if (st.type === 'Declaration') for (const decl of st.decls) {
                    if (create(decl.init)) names.add(decl.name);
                }
                if (st.type === 'ExpressionStatement' && st.expr?.type === 'Assignment' &&
                    st.expr.left?.type === 'Identifier' && create(st.expr.right)) names.add(st.expr.left.name);
                if (st.type === 'If') { walk(st.consequent); walk(st.alternate); }
                if (['For', 'While', 'Block'].includes(st.type)) walk(st.body);
            }
        };
        walk(body);
        return names;
    };
    const visit = (node, scope = new Set(), shadowed = new Set()) => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'FunctionDeclaration') {
            const local = new Set([...(handles.get(node.name) || []), ...localSpriteNames(node.body)]);
            node.body.forEach(st => visit(st, local, new Set(node.params || [])));
            return;
        }
        if (node.type === 'FunctionExpression') {
            const local = new Set([...scope, ...localSpriteNames(node.body)]);
            node.body.forEach(st => visit(st, local, new Set([...shadowed, ...node.params])));
            return;
        }
        if (node.type === 'Call') {
            const callee = node.callee?.type === 'Identifier' && byName.get(node.callee.name);
            if (callee) node.args.forEach((arg, index) => {
                if (arg?.type !== 'Identifier' || index >= callee.params.length) return;
                if (scope.has(arg.name) || (!shadowed.has(arg.name) && globalHandles.has(arg.name))) {
                    handles.get(callee.name).add(callee.params[index]);
                }
            });
            const event = pathOf(node.callee);
            const eventArgs = event === 'sprites.onOverlap' ? 2 :
                ['sprites.onCreated', 'sprites.onDestroyed','scene.onHitTile','scene.onHitWall','scene.onOverlapTile','tiles.addEventListener'].includes(event) ? 1 : 0;
            for (const arg of node.args || []) {
                if (arg?.type === 'FunctionExpression' && eventArgs) {
                    const eventScope = new Set([...scope, ...arg.params.slice(0, eventArgs)]);
                    visit(arg, eventScope, shadowed);
                } else visit(arg, scope, shadowed);
            }
            visit(node.callee, scope, shadowed);
            return;
        }
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(item => visit(item, scope, shadowed));
            else if (value && typeof value === 'object') visit(value, scope, shadowed);
        }
    };
    let changed;
    do {
        const before = [...handles.values()].reduce((n, set) => n + set.size, 0);
        ast.body.forEach(st => visit(st));
        changed = [...handles.values()].reduce((n, set) => n + set.size, 0) !== before;
    } while (changed);
    return handles;
};

/** Infer Image references from bindings and calls, retaining lexical scope.
 * Passing a resource does not copy it. Forwarded parameters and local aliases
 * reach a fixed point, including recursive procedures and callback callers. */
const inferImageReferences = (ast, pathOf, imageOf, isScopedAssetFactory = () => false) => {
    const sdkNumericCalls=staticSdkNamespaceReceivers(ast,{builtinIdentifiers:['randint']});
    const textSprites=new WeakSet(), objects=new WeakSet();
    const buffers = new WeakSet(), players = new WeakSet(), references = new WeakSet(), tiles = new WeakSet(), tilemapData = new WeakSet(), sceneTilemaps = new WeakSet(), legacyTiles = new WeakSet(), sprites = new WeakSet(), animations = new WeakSet(), sevensegDigits = new WeakSet(), sevensegCounters = new WeakSet(), darts = new WeakSet(), corgis = new WeakSet(), scenes = new WeakSet(), physicsEngines = new WeakSet(), nulls = new WeakSet(), arrays = new WeakSet(), numbers = new WeakSet(), strings = new WeakSet(), booleans = new WeakSet();
    const entries = [];
    const functions = new Map();
    const scope = parent => ({parent, bindings: new Map()});
    const global = scope(null);
    // The early member/result fixed point and the later constraint graph must
    // agree on declared SDK references, even for an uncalled helper. Reuse the
    // annotation decoder; it does not admit unknown aliases or callable types.
    const declaredGraph = new ValueTypeGraph();
    const declaredNames = {Image:'image',Sprite:'sprite',TileLocation:'tile',LegacyTile:'legacy-tile',
        Animation:'animation',SevenSegDigit:'sevenseg-digit',DigitCounter:'sevenseg-counter',
        Dart:'dart',Corgio:'corgio',TextSprite:'text-sprite',Scene:'scene',PhysicsEngine:'physics-engine',
        Player:'player',number:'number',string:'string',boolean:'boolean',array:'array'};
    const seedDeclared = (value,annotation) => {
        const key=String(annotation || '');
        applyDeclaredValueType(declaredGraph,key,key);
        for(const name of declaredGraph.node(key).types)if(declaredNames[name])value.add(declaredNames[name]);
        if(declaredGraph.has(key,'array'))for(const name of declaredGraph.node(declaredGraph.element(key)).types)
            if(declaredNames[name])value.add(`${declaredNames[name]}-array`);
    };
    const binding = (owner, name, declare = false) => {
        if (declare) {
            if (!owner.bindings.has(name)) owner.bindings.set(name, new Set());
            return owner.bindings.get(name);
        }
        for (let current = owner; current; current = current.parent) {
            if (current.bindings.has(name)) return current.bindings.get(name);
        }
        return binding(global, name, true);
    };
    const visit = (node, owner, eventParameters = []) => {
        if (!node || typeof node !== 'object') return;
        if (['FunctionDeclaration', 'FunctionExpression'].includes(node.type)) {
            owner = scope(owner);
            for (const [i, name] of (node.params || []).entries()) {
                const value = binding(owner, name, true);
                seedDeclared(value,node.paramTypes?.[name]?.text);
                if (eventParameters[i]) value.add(eventParameters[i]);
            }
            if (node.type === 'FunctionDeclaration') {
                const returns=new Set();seedDeclared(returns,node.returnType);
                functions.set(node.name, {node, owner, returns});
            }
        }
        entries.push({node, owner});
        if (node.type === 'Declaration') for (const decl of node.decls) {const value=binding(owner,decl.name,true);seedDeclared(value,decl.typeName);if(decl.isArray)value.add('array');}
        if (node.type === 'Call') {
            const api = pathOf(node.callee);
            const types = ['mp.onButtonEvent','mp.onControllerEvent'].includes(api)?['player']:api==='sprites.onOverlap'?['sprite','sprite']:
                api==='scene.onHitTile'?['sprite']:api==='tiles.addEventListener'?['tilemap']:['scene.onHitWall','scene.onOverlapTile'].includes(api)?['sprite','tile']:
                ['sprites.onCreated','sprites.onDestroyed'].includes(api)?['sprite']:[];
            visit(node.callee, owner);
            for (const arg of node.args || []) visit(arg, owner, types);
            return;
        }
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(child => visit(child, owner));
            else if (value && typeof value === 'object') visit(value, owner);
        }
    };
    visit(ast, global);
    // The global \`screen\` image, unless any binding of that name exists.
    const screenDeclared=entries.some(({node})=>node.type==='Declaration' && node.decls?.some(decl=>decl.name==='screen') ||
        ['FunctionDeclaration','FunctionExpression'].includes(node.type) && (node.params||[]).includes('screen') ||
        node.type==='FunctionDeclaration' && node.name==='screen');
    const isScreen=node=>node?.type==='Identifier' && node.name==='screen' && !screenDeclared;
    const mathDeclared=entries.some(({node})=>node.type==='Declaration' && node.decls?.some(decl=>decl.name==='Math') ||
        ['FunctionDeclaration','FunctionExpression'].includes(node.type) && (node.params || []).includes('Math'));
    const typeOf = (node, owner) => {
        if(currentClosedSpriteNullFilter(node))return new Set(['array','sprite-array']);
        if(highScoreIntrinsic(node))return new Set(['number']);
        if(node?.bwConsoleInspectIntrinsic===true && node.callee?.name==='__bwConsoleInspectValue')return new Set(['string']);
        if(node?.bwFontIntrinsic && node.bwFontType==='image.Font')return new Set(['font']);
        if(node?.bwFontIntrinsic==='field' && node.bwFontType==='number')return new Set(['number']);
        if(node?.bwFontIntrinsic==='field' && node.bwFontType==='Buffer')return new Set(['buffer']);
        if(node?.bwObjectTypes?.length)return new Set(node.bwObjectTypes);
        if(node?.type==='Template' && /^(tilemap|assets\.tilemap)$/.test(node.tag||''))return new Set(['tilemap']);
        if (imageOf(node) || isScreen(node) || isScopedAssetFactory(node)) return new Set(['image']);
        if(node?.type==='Number')return new Set(['number']);
        if(node?.type==='FontMetric')return new Set(['number']);
        if(node?.type==='Member' && (Object.prototype.hasOwnProperty.call(ARCADE_SCENE_CONSTANTS,pathOf(node)) || node.object?.type==='Identifier' && node.object.name==='SpriteKind'))return new Set(['number']);
        if(node?.type==='Null')return new Set(['null']);
        if(node?.type==='Undefined')return new Set(['undefined']);
        if(node?.type==='Object')return new Set(['object']);
        if(node?.type==='Identifier' && ['NaN','Infinity'].includes(node.name) && !global.bindings.has(node.name))return new Set(['number']);
        if(node?.type==='Member' && ((pathOf(node.object)==='SpriteFlag' && !binding(owner,'SpriteFlag').size && Object.prototype.hasOwnProperty.call(SPRITE_FLAG_VALUES,node.name)) || (pathOf(node.object)==='sprites.Flag' && !binding(owner,'sprites').size && Object.prototype.hasOwnProperty.call(PRIVATE_SPRITE_FLAG_VALUES,node.name))))return new Set(['number']);
        if(node?.type==='Member' && node.object?.name==='Math' && !mathDeclared && ['E','LN2','LN10','LOG2E','LOG10E','PI','SQRT1_2','SQRT2'].includes(node.name))return new Set(['number']);
        if(node?.type==='Member' && node.object?.name==='CameraProperty' && Object.prototype.hasOwnProperty.call(CAMERA_PROPERTIES,node.name))return new Set(['number']);
        if(node?.type==='Member' && node.object?.name==='TileDirection' && Object.prototype.hasOwnProperty.call(TILE_DIRECTIONS,node.name))return new Set(['number']);
        if(node?.type==='Member' && node.object?.name==='CollisionDirection' && Object.prototype.hasOwnProperty.call(COLLISION_DIRECTIONS,node.name))return new Set(['number']);
        if(node?.type==='String')return new Set(['string']);
        if(node?.type==='Boolean' || node?.type==='Unary' && node.op==='!' || node?.type==='Binary' && ['==','!=','===','!==','<','>','<=','>='].includes(node.op))return new Set(['boolean']);
        if(node?.type==='Unary' && ['+','-','~'].includes(node.op))return new Set(['number']);
        if(node?.type==='Binary' && ['-','*','/','%','**','&','|','^','<<','>>','>>>'].includes(node.op))return new Set(['number']);
        if(node?.type==='Binary' && node.op==='+') {
            const left=typeOf(node.left,owner),right=typeOf(node.right,owner);
            if(left.has('string')||right.has('string'))return new Set(['string']);
            if(left.has('number')&&right.has('number'))return new Set(['number']);
        }
        if(node?.type==='NativeArrayValueBinary')return new Set(['number','string']);
        if(node?.type==='NativeArrayAccess' || node?.type==='NativeNamedArrayCreate' || node?.type==='NativeNamedArrayReference')return new Set(['array']);
        if(node?.type==='NativeNamedArrayDelete')return new Set(['null']);
        if(node?.type==='LegacyJsonValue')return new Set(['string']);
        if(node?.type==='LegacyParsedValue')return new Set(['any']);
        if (node?.type === 'Array') return new Set(['array',...node.items.flatMap(item=>[...typeOf(item,owner)].filter(t=>['image','sprite','tile','tilemap','number','string','scene','physics-engine'].includes(t)).map(t=>`${t}-array`))]);
        if (node?.type === 'Index') return new Set([...typeOf(node.object,owner)].filter(t=>['image-array','sprite-array','tile-array','tilemap-array','legacy-tile-array','number-array','string-array','scene-array','physics-engine-array'].includes(t)).map(t=>t.slice(0,-6)));
        if (node?.type === 'Identifier') return binding(owner, node.name);
        if(node?.type==='Member' && node.name==='length' && node.object?.type==='Index' && typeOf(node.object,owner).has('string'))return new Set(['number']);
        if(node?.type==='Call' && node.callee?.type==='Member') {
            const receiver=typeOf(node.callee.object,owner),operation=node.callee.name;
            if(receiver.has('string') && operation==='charCodeAt')return new Set(['number']);
            if(receiver.has('array') && ['slice','concat'].includes(operation)) {
                const result=new Set(['array',...[...receiver].filter(type=>type.endsWith('-array'))]);
                if(operation==='concat' && node.args.length===1)for(const type of typeOf(node.args[0],owner))
                    if(type.endsWith('-array'))result.add(type);
                return result;
            }
        }
        if(node?.type==='Member' && ['index','number'].includes(node.name) && typeOf(node.object,owner).has('player'))return new Set(['number']);
        // Location.tileMap is the scene's TileMap; its data is a TileMapData.
        if(node?.type==='Member' && node.name==='tileMap' && typeOf(node.object,owner).has('tile'))return new Set(['scene-tilemap']);
        if(node?.type==='Member' && typeOf(node.object,owner).has('scene-tilemap')){
            if(node.name==='data')return new Set(['tilemap']);
            if(node.name==='scale')return new Set(['number']);
            if(node.name==='enabled')return new Set(['boolean']);
        }
        if(node?.type==='Member' && ['maxSpeed','minStep','maxStep'].includes(node.name) && typeOf(node.object,owner).has('physics-engine'))return new Set(['number']);
        if(node?.type==='Member' && node.name==='physicsEngine' && typeOf(node.object,owner).has('scene'))return new Set(['physics-engine']);
        if(node?.type==='Member' && node.name==='flags' && typeOf(node.object,owner).has('scene'))return new Set(['number']);
        if(node?.type==='Member' && ['fx','fy','sx','sy','scale','flags'].includes(node.name) && typeOf(node.object,owner).has('sprite'))return new Set(['number']);
        if (node?.type === 'Member' && node.name === 'image' && (typeOf(node.object, owner).has('sprite') || typeOf(node.object, owner).has('animation'))) return new Set(['image']);
        if (node?.type === 'Member' && ['action','interval'].includes(node.name) && typeOf(node.object,owner).has('animation')) return new Set(['number']);
        if(node?.type==='Member' && typeOf(node.object,owner).has('text-sprite') && TEXT_SPRITE_PROPERTIES.includes(node.name))return new Set([node.name==='text'?'string':node.name==='icon'?'image':'number']);
        if (node?.type === 'Member' && node.name === 'sprite' && (typeOf(node.object,owner).has('dart') || typeOf(node.object,owner).has('corgio'))) return typeOf(node.object,owner);
        if (node?.type === 'Member' && ((DART_PROPERTIES.includes(node.name) && typeOf(node.object,owner).has('dart')) ||
            (CORGI_PROPERTIES.includes(node.name) && typeOf(node.object,owner).has('corgio')))) return new Set(['number']);
        if (node?.type === 'Member' && ['x','y','width','height','value','count'].includes(node.name) &&
            (typeOf(node.object,owner).has('sevenseg-digit') || typeOf(node.object,owner).has('sevenseg-counter'))) return new Set(['number']);
        if (node?.type === 'Call') {
            const api = pathOf(node.callee);
            if(api==='randint' && node.callee?.type==='Identifier' && node.args.length===2 && !node.isNew && sdkNumericCalls.has(node.callee))return new Set(['number']);
            if(api==='game.askForString' && node.callee?.type==='Member' && node.args.length>=1 && node.args.length<=3 && !node.isNew && sdkNumericCalls.has(node.callee.object))return new Set(['string']);
            if(api==='SpriteKind.create' || node.callee?.type==='Member' && node.callee.name==='kind' && typeOf(node.callee.object,owner).has('sprite'))return new Set(['number']);
            if(api==='characterAnimations.ruleToString' && node.args.length===1)return new Set(['string']);
            if(['characterAnimations.rule','characterAnimations._predicate','characterAnimations._direction'].includes(api))return new Set(['number']);
            if(api==='characterAnimations.matchesRule')return new Set(['boolean']);
            if(!mathDeclared && /^Math\.(?:abs|min|max|pow|round|floor|ceil|trunc|sign|sqrt|sin|cos|tan|asin|acos|atan|atan2|log|exp|random|randomRange|clamp|imul)$/.test(api || ''))return new Set(['number']);
            if(['mp.playerSelector','mp.getPlayerByNumber','mp.getPlayerByIndex','mp.getPlayerBySprite'].includes(api))return new Set(['player']);
            if(api==='bwStringArraySettings.read')return new Set(['array','string-array']);
            if(['control.createBuffer','control.createBufferFromUTF8','Buffer.fromHex','Buffer.fromUTF8'].includes(api) && !binding(owner,api.split('.')[0]).size)return new Set(['buffer']);
            const settingRead=/^(?:settings|blockSettings)\.(read(Number|String|NumberArray|StringArray|Buffer)|exists|list)$/.exec(api||'');
            if(settingRead){
                if(settingRead[1]==='list')return new Set(['array','string-array']);
                if(settingRead[1]==='exists')return new Set(['boolean']);
                if(settingRead[2]==='StringArray')return new Set(['array','string-array']);
                if(settingRead[2]==='NumberArray')return new Set(['array','number-array']);
                if(settingRead[2]==='Number')return new Set(['number']);
                if(settingRead[2]==='String')return new Set(['string']);
            }
            const dataRead=/^sprites\.readData(Number|String|Boolean|Sprite)$/.exec(api||'');
            if(dataRead && node.args.length===2)return new Set([dataRead[1].toLowerCase()]);
            if(api==='mp.getPlayerSprite')return new Set(['sprite']);
            if(api==='mp.allPlayers')return new Set(['array']);
            if(api==='mp.getPlayerState' || api==='MultiplayerState.create')return new Set(['number']);
            if(api==='mp.getPlayerProperty')return new Set(['number']);
            if(api==='mp.isConnected' || api==='mp.isButtonPressed' || api==='game.ask' || node.callee?.type==='Member' && (node.callee.name==='tileKindAt' && typeOf(node.callee.object,owner).has('sprite') || node.callee.name==='equals' && typeOf(node.callee.object,owner).has('image')))return new Set(['boolean']);
            if(api==='game.currentScene' && !node.args.length)return new Set(['scene']);
            if(api==='ArcadePhysicsEngine' && node.constructorCall && node.args.length<=3)return new Set(['physics-engine']);
            if(api==='scene.cameraProperty' && node.args.length===1 || ['scene.cameraLeft','scene.cameraTop'].includes(api) && !node.args.length || /^info(?:\.player[1-4])?\.(life|score)$/.test(api||'') && !node.args.length)return new Set(['number']);
            if(/^info(?:\.player[1-4])?\.(hasLife|hasScore)$/.test(api||'') && !node.args.length)return new Set(['boolean']);
            if(api==='animation.createAnimation')return new Set(['animation']);
            if(api==='sevenseg.createDigit')return new Set(['sevenseg-digit']);
            if(api==='sevenseg.createCounter')return new Set(['sevenseg-counter']);
            if(api==='String.fromCharCode' && node.args.length===1)return new Set(['string']);
            if(node.callee?.type==='Member' && node.callee.name==='concat' && node.args.length===1 && typeOf(node.callee.object,owner).has('string'))return new Set(['string']);
            if(api==='textsprite.create')return new Set(['sprite','text-sprite']);
            if(api==='darts.create')return new Set(['sprite','dart']);
            if(api==='corgio.create')return new Set(['sprite','corgio']);
            if(node.callee?.type==='Member' && typeOf(node.callee.object,owner).has('animation') && node.args.length===0){
                if(node.callee.name==='getImage')return new Set(['image']);
                if(['getAction','getInterval'].includes(node.callee.name))return new Set(['number']);
            }
            if(api==='sprites.allOfKind')return new Set(['array','sprite-array']);
            if(api==='tiles.getTilesByType')return new Set(['array','tile-array']);
            if(['tiles.getTileLocation','tiles.getRandomTileByType'].includes(api))return new Set(['tile']);
            if(api==='tiles.createTilemap' && node.args.length===4)return new Set(['tilemap']);
            if(node.callee?.type==='Member' && typeOf(node.callee.object,owner).has('scene-tilemap')){
                if(['areaWidth','areaHeight','getTileIndex'].includes(node.callee.name))return new Set(['number']);
            }
            if(node.callee?.type==='Member' && typeOf(node.callee.object,owner).has('tilemap')){
                if(node.callee.name==='getTileset' && node.args.length===0)return new Set(['array','image-array']);
                if(node.callee.name==='getTileImage' && node.args.length===1)return new Set(['image']);
                if(node.callee.name==='getTile' && node.args.length===2)return new Set(['number']);
                if(node.callee.name==='isWall' && node.args.length===2)return new Set(['boolean']);
            }
            if(node.callee?.type==='Member' && ((node.callee.name==='tilemapLocation' && node.args.length===0 && typeOf(node.callee.object,owner).has('sprite')) || (node.callee.name==='getNeighboringLocation' && node.args.length===1 && typeOf(node.callee.object,owner).has('tile'))))return new Set(['tile']);
            if(['tiles.getTileImage','tiles.tileImageAtLocation','tiles.getTileAt'].includes(api))return new Set(['image']);
            if(node.callee?.type==='Member' && node.args.length===0 && typeOf(node.callee.object,owner).has('tile')){
                if(node.callee.name==='getImage')return new Set(['image']);
                if(node.callee.name==='isWall')return new Set(['boolean']);
            }
            if(api==='scene.getTile')return new Set(['legacy-tile']);
            if(api==='scene.getTilesByType')return new Set(['array','legacy-tile-array']);
            if(['tiles.tileAtLocationEquals','tiles.tileAtLocationIsWall'].includes(api))return new Set(['boolean']);
            if(node.callee?.type==='Member' && node.callee.name==='isHittingTile' && node.args.length===1 && typeOf(node.callee.object,owner).has('sprite'))return new Set(['boolean']);
            if(node.callee?.type==='Member' && node.callee.name==='toString' && !node.args.length && typeOf(node.callee.object,owner).has('sprite'))return new Set(['string']);
            if (api === 'image.create' && node.args.length === 2 || api === 'scene.backgroundImage' && !node.args.length) return new Set(['image']);
            if (node.callee?.type === 'Member' && (['pop','shift','removeAt','get'].includes(node.callee.name) || node.callee.name==='_pickRandom' && !node.args.length) && typeOf(node.callee.object,owner).has('array')) return new Set([...typeOf(node.callee.object,owner)].filter(t=>['image-array','sprite-array','tile-array','tilemap-array','legacy-tile-array','number-array','string-array','scene-array','physics-engine-array'].includes(t)).map(t=>t.slice(0,-6)));
            if (api==='Math.pickRandom' && node.args.length===1) return new Set([...typeOf(node.args[0],owner)].filter(t=>['image-array','sprite-array','tile-array','tilemap-array','legacy-tile-array','number-array','string-array','scene-array','physics-engine-array'].includes(t)).map(t=>t.slice(0,-6)));
            if (node.callee?.type === 'Identifier' && functions.has(node.callee.name)) return functions.get(node.callee.name).returns || new Set();
            if (['sprites.create', 'sprites.createProjectile', 'sprites.createProjectileFromSide',
                'sprites.createProjectileFromSprite'].includes(api)) return new Set(['sprite']);
            if (node.callee?.type === 'Member' && node.callee.name === 'clone' &&
                !node.args.length && typeOf(node.callee.object, owner).has('image')) return new Set(['image']);
        }
        return new Set();
    };
    let changed;
    const merge = (into, from) => {
        for (const value of from) if (!into.has(value)) { into.add(value); changed = true; }
    };
    do {
        changed = false;
        for (const {node, owner} of entries) {
            if (node.type === 'Return') for (const fn of functions.values()) if (fn.owner === owner) {
                if (!fn.returns) fn.returns = new Set();merge(fn.returns, typeOf(node.value,owner));
            }
            if (node.type === 'Declaration') for (const decl of node.decls) merge(binding(owner, decl.name), typeOf(decl.init, owner));
            if (node.type === 'Assignment' && node.op === '=' && node.left?.type === 'Identifier') merge(binding(owner, node.left.name), typeOf(node.right, owner));
            if (node.type==='Assignment' && node.left?.type==='Index' && node.left.object?.type==='Identifier') {
                merge(binding(owner,node.left.object.name),new Set([...typeOf(node.right,owner)].filter(t=>['image','sprite','tile','tilemap','number','string','scene','physics-engine'].includes(t)).map(t=>`${t}-array`)));
            }
            if (node.type==='Call' && node.callee?.type==='Member' && ['push','unshift','insertAt','set'].includes(node.callee.name) && node.callee.object?.type==='Identifier') {
                const value=node.args[['insertAt','set'].includes(node.callee.name)?1:0];
                merge(binding(owner,node.callee.object.name),new Set([...typeOf(value,owner)].filter(t=>['image','sprite','tile','tilemap','number','string','scene','physics-engine'].includes(t)).map(t=>`${t}-array`)));
            }
            if (node.type === 'Call' && node.callee?.type === 'Identifier') {
                const fn = functions.get(node.callee.name);
                if (fn) node.args.forEach((arg, i) => {
                    if (i < fn.node.params.length) merge(binding(fn.owner, fn.node.params[i]), typeOf(arg, owner));
                });
            }
        }
    } while (changed);
    // Join array element constraints as a graph, so nested arrays and aliases
    // retain their element types without unrolling recursive array types.
    const graph = new ValueTypeGraph();
    const primitiveTypes=new Set(['number','string','boolean','null','undefined']);
    const applyPrimitiveAnnotation=(value,annotation)=>{
        const types=String(annotation || '').replace(/\s+/g,'').split('|');
        if(types.length && types.every(type=>primitiveTypes.has(type)))for(const type of types)graph.add(value,type);
    };
    const cell = (node, owner) => {
        if(isScreen(node)){const value=binding(owner,node.name);graph.add(value,'Image');return value;}
        if(node?.type === 'Identifier')return binding(owner,node.name);
        if(node?.type === 'Member' && node.name === 'data') {
            const value=graph.property(cell(node.object,owner),'data');graph.add(value,'SpriteData');return value;
        }
        return node;
    };
    const connect = (left,right) => {if(left && right)graph.merge(left,right);};
    for (const fn of functions.values()) {
        fn.resultCell = Symbol('procedure result');
        if(fn.node.returnType!=='image.Font')applyDeclaredValueType(graph, fn.resultCell, fn.node.returnType);
        applyPrimitiveAnnotation(fn.resultCell,fn.node.returnType);
    }
    for (const {node, owner} of entries) {
        if (['FunctionDeclaration', 'FunctionExpression'].includes(node.type)) {
            for (const name of node.params || []) {
                if(node.paramTypes?.[name]?.text!=='image.Font')applyDeclaredValueType(graph, binding(owner, name), node.paramTypes?.[name]?.text);
                applyPrimitiveAnnotation(binding(owner,name),node.paramTypes?.[name]?.text);
            }
        }
        if (node.type === 'Declaration') for (const decl of node.decls) {
            if(decl.typeName!=='image.Font')applyDeclaredValueType(graph, binding(owner, decl.name), decl.typeName);
            applyPrimitiveAnnotation(binding(owner,decl.name),decl.typeName);
        }
    }
    for (const {node,owner} of entries) {
        const value=cell(node,owner);
        applyPrimitiveAnnotation(value,node.assertedType);
        for (const type of typeOf(node,owner)) {
            const name={font:'Font',buffer:'Buffer',image:'Image',sprite:'Sprite',tile:'TileLocation',tilemap:'TileMapData','scene-tilemap':'SceneTileMap','legacy-tile':'LegacyTile',animation:'Animation','sevenseg-digit':'SevenSegDigit','sevenseg-counter':'DigitCounter',dart:'Dart',corgio:'Corgio','text-sprite':'TextSprite',scene:'Scene','physics-engine':'PhysicsEngine',player:'Player',number:'number',string:'string',boolean:'boolean',null:'null',undefined:'undefined',object:'object',any:'unknown',array:'array'}[type];
            if(name)graph.add(value,name);
        }
        if(highScoreIntrinsic(node))graph.add(value,'number');
        if(node.bwConsoleInspectIntrinsic===true && node.callee?.name==='__bwConsoleInspectValue')graph.add(value,'string');
        if(node.bwFontType==='image.Font' && ['constant','getFontForText','scaledFont'].includes(node.bwFontIntrinsic))graph.add(value,'Font');
        if(node.bwFontIntrinsic==='field' && node.bwFontType==='number')graph.add(value,'number');
        if(node.bwFontIntrinsic==='field' && node.bwFontType==='Buffer')graph.add(value,'Buffer');
        if(node.type==='Template' && node.tag==='hex' || node.type==='Call' && ['control.createBuffer','control.createBufferFromUTF8','Buffer.fromHex','Buffer.fromUTF8','settings.readBuffer','blockSettings.readBuffer'].includes(pathOf(node.callee)))graph.add(value,'Buffer');
        if(node.type==='Call' && pathOf(node.callee)==='mp.allPlayers'){graph.add(value,'array');graph.add(graph.element(value),'Player');}
        if(node.type==='Call' && pathOf(node.callee)==='sprites.allOfKind'){graph.add(value,'array');graph.add(graph.element(value),'Sprite');}
        if(node.type==='Call' && pathOf(node.callee)==='scene.getTilesByType'){graph.add(value,'array');graph.add(graph.element(value),'LegacyTile');}
        if(node.type==='Call' && pathOf(node.callee)==='tiles.getTilesByType'){graph.add(value,'array');graph.add(graph.element(value),'TileLocation');}
        if(node.type==='Array') for(const item of node.items)connect(graph.element(value),cell(item,owner));
        if(node.type==='Declaration')for(const decl of node.decls){
            const variable=binding(owner,decl.name);
            if(decl.isArray)graph.add(variable,'array');
            if(!decl.init && !decl.bwFontProducer && !graph.node(variable).types.size)graph.add(variable,'unknown');
            connect(variable,cell(decl.init,owner));
        }
        if(node.type==='Assignment' && node.op==='=')connect(cell(node.left,owner),cell(node.right,owner));
        if(node.type==='Conditional'){
            connect(value,cell(node.consequent,owner));connect(value,cell(node.alternate,owner));
        }
        if(node.type==='Return')for(const fn of functions.values())if(fn.owner===owner)connect(fn.resultCell,cell(node.value,owner));
        if(node.type==='Call' && node.callee?.type==='Identifier'){
            const fn=functions.get(node.callee.name);
            if(fn){
                connect(value,fn.resultCell);
                node.args.forEach((arg,i)=>{if(i<fn.node.params.length)connect(binding(fn.owner,fn.node.params[i]),cell(arg,owner));});
            }
        }
    }
    let revision;
    do {
        revision=graph.revision;
        for(const {node,owner} of entries){
            const value=cell(node,owner);
            if(node.type==='Index' && graph.has(cell(node.object,owner),'array'))connect(value,graph.element(cell(node.object,owner)));
            if(node.type==='Member' && node.name==='image' && (graph.has(cell(node.object,owner),'Sprite') || graph.has(cell(node.object,owner),'Animation')))graph.add(value,'Image');
            if(node.type!=='Call')continue;
            const receiver=node.callee?.type==='Member' && cell(node.callee.object,owner),op=node.callee?.name;
            if(receiver && graph.has(receiver,'array')){
                if(['slice','concat'].includes(op)){
                    graph.add(value,'array');connect(graph.element(value),graph.element(receiver));
                    if(op==='concat' && node.args.length===1)connect(graph.element(value),graph.element(cell(node.args[0],owner)));
                }
                if(['push','unshift','insertAt','set'].includes(op))connect(graph.element(receiver),cell(node.args[['insertAt','set'].includes(op)?1:0],owner));
                if(['pop','shift','removeAt','get'].includes(op) || op==='_pickRandom' && !node.args.length)connect(value,graph.element(receiver));
            }
            if(pathOf(node.callee)==='Math.pickRandom' && node.args.length===1 && graph.has(cell(node.args[0],owner),'array'))connect(value,graph.element(cell(node.args[0],owner)));
            if(receiver && graph.has(receiver,'Buffer') && ['slice','subarray'].includes(op))graph.add(value,'Buffer');
            if(receiver && op==='clone' && !node.args.length && graph.has(receiver,'Image'))graph.add(value,'Image');
        }
    } while(revision!==graph.revision);
    // Unknown value leaves must survive joins with known primitive branches.
    // An assertion adds metadata but never erases an observed object/reference.
    for(const {node,owner} of entries){
        const asserted=String(node.assertedType || '').replace(/\s+/g,'').split('|');
        const primitiveAssertion=asserted.every(type=>primitiveTypes.has(type));
        const receiver=node.callee?.type==='Member' && cell(node.callee.object,owner);
        const arrayResult=receiver && graph.has(receiver,'array') && ['get','pop','shift','removeAt','_pickRandom'].includes(node.callee.name);
        const unknownCall=node.type==='Call' && !typeOf(node,owner).size && !arrayResult && !(node.callee?.type==='Identifier' && functions.has(node.callee.name));
        const unknownMember=node.type==='Member' && !typeOf(node,owner).size;
        if(!primitiveAssertion && (unknownCall || unknownMember) || ['Identifier','Call','Member','Index','Object'].includes(node.type) && !graph.node(cell(node,owner)).types.size)graph.add(cell(node,owner),'unknown');
    }
    const primitives=new WeakSet(),strictStrings=new WeakSet(),exactStrings=new WeakSet(),sourceTypeOfOperands=new WeakSet(),provenArrays=new WeakSet(),sourceArrayArithmeticOperands=new WeakSet();
    const sourceTypeOfOpaque=new Set(entries.filter(({node})=>node.bwSourceTypeOfOpaque).map(({node,owner})=>graph.node(cell(node,owner))));
    const sourceTypeOfKinds=new Set(['number','boolean','string','null','undefined','array','Image','Buffer','object']);
    for(const {node,owner} of entries){
        const types=graph.node(cell(node,owner)).types;
        if(types.has('array') && [...types].every(type=>['array','null','undefined'].includes(type)))provenArrays.add(node);
        if(types.size && [...types].every(type=>type==='array'||primitiveTypes.has(type)))sourceArrayArithmeticOperands.add(node);
        if(types.size && [...types].every(type=>primitiveTypes.has(type)))primitives.add(node);
        if(types.has('string') && [...types].every(type=>primitiveTypes.has(type)))strictStrings.add(node);
        // Every producer is a string: PXT String methods fault on any other receiver.
        if(types.size && [...types].every(type=>type==='string'))exactStrings.add(node);
        if(!sourceTypeOfOpaque.has(graph.node(cell(node,owner))) && types.size && [...types].every(type=>sourceTypeOfKinds.has(type)) &&
            (!types.has('object') || node.bwObjectTypes?.includes('object')))sourceTypeOfOperands.add(node);
    }
    const data = new WeakSet(),fonts=new WeakSet();
    for (const {node, owner} of entries) {
        const value=cell(node,owner);
        if(graph.has(value,'Font') && [...graph.node(value).types].every(type=>['Font','null','undefined'].includes(type)))fonts.add(node);
        if(graph.has(value,'object'))objects.add(node);
        if(graph.has(value,'Buffer'))buffers.add(node);
        if(graph.has(value,'SpriteData'))data.add(node);
        if (graph.has(value,'array')) arrays.add(node);
        if (graph.has(value,'string')) strings.add(node);
        if (graph.has(value,'boolean')) booleans.add(node);
        if (node.type==='Number' || graph.has(value,'number') && !['array','Image','Sprite','string','boolean'].some(type=>graph.has(value,type))) numbers.add(node);
        if (graph.has(value,'Image')) references.add(node);
        if (graph.has(value,'Sprite')) sprites.add(node);
        if (graph.has(value,'Player')) players.add(node);
        if (graph.has(value,'TileLocation')) tiles.add(node);
        if (graph.has(value,'TileMapData')) tilemapData.add(node);
        if (graph.has(value,'SceneTileMap')) sceneTilemaps.add(node);
        if (graph.has(value,'LegacyTile')) legacyTiles.add(node);
        if (graph.has(value,'Animation')) animations.add(node);
        if (graph.has(value,'SevenSegDigit')) sevensegDigits.add(node);
        if (graph.has(value,'DigitCounter')) sevensegCounters.add(node);
        if(graph.has(value,'TextSprite'))textSprites.add(node);
        if (graph.has(value,'Dart')) darts.add(node);
        if (graph.has(value,'Corgio')) corgis.add(node);
        const types=typeOf(node,owner);
        if(types.has('scene') || graph.has(value,'Scene') && !['number','string','boolean','Image','Sprite','PhysicsEngine'].some(type=>graph.has(value,type)))scenes.add(node);
        if(types.has('physics-engine') || graph.has(value,'PhysicsEngine') && !['number','string','boolean','Image','Sprite','Scene'].some(type=>graph.has(value,type)))physicsEngines.add(node);
        if(types.has('null') && [...types].every(type=>type==='null'||type==='sprite'))nulls.add(node);
    }
    return {fonts,objects,primitives,strictStrings,exactStrings,sourceTypeOfOperands,provenArrays,sourceArrayArithmeticOperands,textSprites, buffers, players, images: references, tiles, tilemapData, sceneTilemaps, legacyTiles, sprites, animations, sevensegDigits, sevensegCounters, darts, corgis, scenes, physicsEngines, nulls, arrays, numbers, strings, booleans, data,
        spriteFunctions:new Set([...functions].filter(([,fn])=>graph.has(fn.resultCell,'Sprite')).map(([name])=>name)),
        parameters:new Map([...functions].map(([name,fn])=>[name,new Set(fn.node.params.filter(param=>graph.has(binding(fn.owner,param),'Sprite')))]))};
};

const containsAst = (node,predicate) => node && typeof node==='object' &&
    (predicate(node) || Object.values(node).some(value=>Array.isArray(value)?value.some(child=>containsAst(child,predicate)):containsAst(value,predicate)));
const isFrameRegistration = name => ['game.onUpdate','game.onUpdateInterval','game.onPaint','game.onShade'].includes(name);
const isButtonRegistration = name => /^controller\.(A|B|up|down|left|right)\.onEvent$/.test(name || '');
const SCORE_REGISTRATION_APIS = new Map([...['info','info.player1','info.player2','info.player3','info.player4'].map((root,index)=>[root+'.onScore',index || 1]),['info.player1.impl.onScore',1]]);
// A known SDK spelling alone is not enough: close every actual info-root use,
// reject aliases/property writers/shadows, and prove the threshold's Number
// producer through the existing all-writer graph. The retained SDK's fixed
// player-one impl receiver is admitted only with a side-effect-free threshold:
// moving registration to the native command must not reorder receiver creation
// across an authored side effect. No extracted/aliased impl object is admitted.
const scoreRegistrationProof = program => {
    const pathOf=node=>node?.type==='Identifier'?node.name:node?.type==='Member'?pathOf(node.object)+'.'+node.name:null;
    if(!containsAst(program,node=>node.type==='Call'&&SCORE_REGISTRATION_APIS.has(pathOf(node.callee))))return {has:()=>false};
    let proof=inspectGeneratedHelperBindings(program,GENERATED_HELPER_PROFILES.ordinary),view=null;
    if(!proof.isCurrent()){view=scoreImageBindingView(program);if(view)proof=inspectGeneratedHelperBindings(view.program,GENERATED_HELPER_PROFILES.ordinary);}
    if(!proof.isCurrent()||view&&!view.current())return {has:()=>false};
    const methods=['score','hasScore','setScore','changeScoreBy','life','hasLife','setLife','changeLifeBy','onLifeZero','onScore'];
    const publicCalls=new Set(['info','info.player1','info.player2','info.player3','info.player4'].flatMap(root=>methods.map(method=>root+'.'+method)));
    for(const method of ['startCountdown','stopCountdown','onCountdownEnd','showScore','showLife','showCountdown'])publicCalls.add('info.'+method);
    publicCalls.add('info.player1.impl.onScore');
    for(const node of proof.nodes){
        if(node.type==='Unknown'||node.type==='Identifier'&&['globalThis','global','window','self','eval','Function','Reflect','arguments'].includes(node.name)||
            node.type==='Member'&&node.name==='constructor'||node.type==='Template'&&typeof node.tag==='string'&&node.tag.split('.')[0]==='info')return {has:()=>false};
    }
    for(const node of proof.nodes)if(node.type==='Identifier'&&node.name==='info'&&proof.unbound(node)){
        let top=node,parent=proof.parentOf(top);
        while(parent?.type==='Member'&&parent.object===top){top=parent;parent=proof.parentOf(top);}
        if(parent?.type!=='Call'||parent.callee!==top||parent.isNew||!publicCalls.has(pathOf(top)))return {has:()=>false};
    }
    const facts=analyseSourceValueProducers(program,{arrayValues:true,parenthesized:true,unboundIsOpaque:true,
        uninitializedLocalsAreOpaque:true,declaredLocalUndefined:true,initializationEntries:true,ordinaryPrimitiveSdkNumbers:true});
    const pureRead=node=>node?.type==='Number'||node?.type==='Identifier'&&facts.isInitializedAt(node)||
        node?.type==='Parenthesized'&&pureRead(node.expression)||node?.type==='Unary'&&['+','-'].includes(node.op)&&pureRead(node.argument);
    const selected=new Set();
    for(const node of proof.nodes)if(node.type==='Call'&&SCORE_REGISTRATION_APIS.has(pathOf(node.callee))){
        let root=node.callee;while(root?.type==='Member')root=root.object;
        if(!node.args?.length)continue;
        const actual=view?view.originalOf(node):node;
        if(view&&(actual?.args?.[0]?.type!=='Number'||!Number.isFinite(Number(actual.args[0].value))))continue;
        const types=facts.typesAt(actual.args[0]);
        const internal=pathOf(node.callee)==='info.player1.impl.onScore';
        if(!node.isNew&&!node.constructorCall&&!node.optional&&!node.typeArguments?.length&&!node.args.some(arg=>arg?.type==='Spread')&&
            proof.unbound(root)&&types.size&&[...types].every(type=>type==='Number')&&(!internal||pureRead(actual.args[0])))selected.add(actual);
    }
    return {has:node=>proof.isCurrent()&&(!view||view.current())&&selected.has(node)};
};
const isInfoRegistration = name => SCORE_REGISTRATION_APIS.has(name)||/^info(?:\.player[1-4])?\.onLifeZero$/.test(name || '') || name==='info.onCountdownEnd';
const isForeverRegistration = name => ['forever','game.forever','basic.forever'].includes(name);
const isSpriteRegistration = name => ['sprites.onDestroyed','sprites.onOverlap'].includes(name);
const isParallelLaunch = name => name==='control.runInParallel';
const isControlRegistration = name => name==='control.onEvent';
const isIndependentRegistration = name => isControlRegistration(name) || isParallelLaunch(name) || isFrameRegistration(name) || isButtonRegistration(name) || isInfoRegistration(name) || isForeverRegistration(name) || isSpriteRegistration(name);
const sceneRegistrationSpec = (name,node) => {
    if(playerConnectionRegistration(node))return {kind:'playerConnection',handlerIndex:1,arity:2,prefix:'__bwPlayerConnection',maxParams:0};
    if(playerButtonRegistration(node))return {kind:'button',handlerIndex:2,arity:3,prefix:'__bwPlayerButton',maxParams:0};
    const specs={
        'mp.onControllerEvent':{kind:'multiplayerConnection',handlerIndex:1,arity:2,prefix:'__bwMPConnection',maxParams:1},
        'control.onEvent':{kind:'controlEvent',handlerIndex:2,arities:[3,4],prefix:'__bwControlEvent',maxParams:0},
        'game.addScenePushHandler':{kind:'scenePush',handlerIndex:0,arity:1,prefix:'__bwScenePush',maxParams:1},
        'game.addScenePopHandler':{kind:'scenePop',handlerIndex:0,arity:1,prefix:'__bwScenePop',maxParams:1},
        'forever':{kind:'forever',handlerIndex:0,arity:1,prefix:'__bwForever',maxParams:0},
        'control.runInParallel':{kind:'parallel',handlerIndex:0,arity:1,prefix:'__bwParallel',maxParams:0},
        'game.forever':{kind:'forever',handlerIndex:0,arity:1,prefix:'__bwForever',maxParams:0},
        'basic.forever':{kind:'forever',handlerIndex:0,arity:1,prefix:'__bwForever',maxParams:0},
        ...Object.fromEntries([...SCORE_REGISTRATION_APIS.keys()].map(name=>[name,{kind:'score',handlerIndex:1,arity:2,prefix:'__bwScore',maxParams:0}])),
        'info.onLifeZero':{kind:'lifeZero',handlerIndex:0,arity:1,prefix:'__bwLifeZero',maxParams:0},
        'info.player1.onLifeZero':{kind:'lifeZero',handlerIndex:0,arity:1,prefix:'__bwLifeZero',maxParams:0},
        'info.onCountdownEnd':{kind:'countdown',handlerIndex:0,arity:1,prefix:'__bwCountdown',maxParams:0},
        'mp.onButtonEvent':{kind:'multiplayerButton',handlerIndex:2,arity:3,prefix:'__bwMPButton',maxParams:1},
        'game.onUpdate':{kind:'update',handlerIndex:0,arity:1,prefix:'__bwUpdate',maxParams:0},
        'game.onPaint':{kind:'paint',handlerIndex:0,arity:1,prefix:'__bwPaint',maxParams:0},
        'game.onShade':{kind:'shade',handlerIndex:0,arity:1,prefix:'__bwShade',maxParams:0},
        'game.onUpdateInterval':{kind:'interval',handlerIndex:1,arity:2,prefix:'__bwInterval',maxParams:0},
        'sprites.onDestroyed':{kind:'destroyed',handlerIndex:1,arity:2,prefix:'__bwKindDestroyed',maxParams:1,kinds:[0]},
        'sprites.onOverlap':{kind:'overlap',handlerIndex:2,arity:3,prefix:'__bwOverlap',maxParams:2,kinds:[0,1]}
    };
    return specs[name] || (/^info\.player[1-4]\.onLifeZero$/.test(name||'')?{kind:'lifeZero',handlerIndex:0,arity:1,prefix:'__bwLifeZero',maxParams:0}:null) || (/^controller\.(A|B|up|down|left|right)\.onEvent$/.test(name||'')?{kind:'button',handlerIndex:1,arity:2,prefix:'__bwButton',maxParams:0}:null);
};

// PXT keeps tilemap listeners by callback identity: removeEventListener drops
// the one addEventListener entry with the same event and the same function.
// A named global procedure is that identity, so both calls take it through the
// static callback route, and its registration token is derived from its name.
const tilemapListenerSpec = name => ['tiles.addEventListener','tiles.removeEventListener'].includes(name) ? {kind:'tilemapListener',handlerIndex:1,arity:2} : null;
const callbackRegistrationSpec = (name, node) => sceneRegistrationSpec(name, node) || tilemapListenerSpec(name);
const TILEMAP_FUNCTION_TOKEN = '__bwTilemapFn_';
const tilemapFunctionToken = name => name.startsWith(TILEMAP_FUNCTION_TOKEN) ? name : TILEMAP_FUNCTION_TOKEN + name;

const discoverRuntimeRegistrations = (ast, translator) => {
    const specs={
        'sprites.onCreated':{kind:'creation',handlerIndex:1,arity:2,prefix:'__bwCreated'},
        'scene.onHitTile':{kind:'legacyWall',handlerIndex:2,arity:3,prefix:'__bwColorWall',maxParams:1,kinds:[0]},
        'scene.onHitWall':{kind:'wall',handlerIndex:1,arity:2,prefix:'__bwWall'},
        'scene.onOverlapTile':{kind:'tile',handlerIndex:2,arity:3,prefix:'__bwTile'},
        'tiles.addEventListener':{kind:'tilemapEvent',handlerIndex:1,arity:2,prefix:'__bwTilemapEvent',maxParams:1,kinds:[]}
    };
    const counts=new Map();
    const registrations = new Map();
    const localNames = body => {
        const names = new Set();
        const visit = statements => { for (const st of statements || []) {
            if (st.type === 'Declaration') for (const decl of st.decls) names.add(decl.name);
            // A `for (let i …)` counter is block-scoped to its loop: it belongs to this run of the
            // callback, not to a program variable of the same name that other scripts share.
            if (st.type === 'For' && st.init?.type === 'Declaration') for (const decl of st.init.decls) names.add(decl.name);
            if (st.type === 'If') { visit(st.consequent);visit(st.alternate); }
            if (['For','ForOf','While','Block'].includes(st.type)) visit(st.body);
        }};
        visit(body);return names;
    };
    const visit = (node, bindings = new Map(), owner = null) => {
        if (!node || typeof node !== 'object') return;
        if (['FunctionDeclaration','FunctionExpression'].includes(node.type)) {
            bindings = new Map(bindings);owner = node;
            for (const param of node.params || []) bindings.set(param, {key:translator.varName(param),owner});
            for (const local of localNames(node.body)) bindings.set(local, {key:local,owner});
        }
        const instance=node.type==='Call' && node.callee?.type==='Member' && ['onDestroyed','onOverlap'].includes(node.callee.name) && translator.spriteReferences.has(node.callee.object);
        const externalName=node.type==='Call' && node.callee?.type==='Member' && translator.externalName(node.callee);
        const externalHandler=externalName && node.args?.length && node.args[node.args.length-1]?.type==='FunctionExpression'?
            {kind:'external',handlerIndex:node.args.length-1,arity:node.args.length,prefix:'__bwExternal',maxParams:0}:null;
        const baseSpec=instance?(node.callee.name==='onOverlap'?{kind:'instanceOverlap',handlerIndex:0,arity:1,prefix:'__bwInstanceOverlap',maxParams:1}:{kind:'instanceDestroyed',handlerIndex:0,arity:1,prefix:'__bwInstanceDestroyed',maxParams:0}):node.type==='Call' && (specs[translator.path(node.callee)] || (translator.sceneStackProgram || isIndependentRegistration(translator.path(node.callee))) && sceneRegistrationSpec(translator.path(node.callee),node));
        const spec=externalHandler||baseSpec;
        if (spec && (spec.kind!=='score'||translator.scoreRegistrationProof.has(node))) {
            const handler=node.args?.[spec.handlerIndex];
            const kind=node.args?.[0];
            const nativeScene=spec.maxParams!==undefined;
            const validScene=nativeScene && handler?.params?.length<=spec.maxParams &&
                (spec.kind!=='instanceOverlap' || handler.params.every(param=>{const type=handler.paramTypes?.[param];return type==='Sprite' || type?.text==='Sprite' && !type.isArray;})) &&
                (spec.kinds||[]).every(index=>fixedKind(node.args[index])) &&
                (!['scenePush','scenePop'].includes(spec.kind) || !handler.params.length || !containsAst(handler.body,value=>value.type==='Identifier' && value.name===handler.params[0]));
            if (handler?.type==='FunctionExpression' && (spec.arities?spec.arities.includes(node.args.length):node.args.length===spec.arity) &&
                (nativeScene?validScene:spec.kind==='creation' || handler.params.length<=2 && fixedKind(kind))) {
                const captures = new Map(bindings);
                for (const name of [...(handler.params || []), ...localNames(handler.body)]) captures.delete(name);
                const named=spec.kind==='tilemapEvent' && handler.bwNamedCallback;
                const index=named?0:(counts.get(spec.kind)||0)+1;if(!named)counts.set(spec.kind,index);
                registrations.set(node, {kind:spec.kind, token:named?tilemapFunctionToken(named):`${spec.prefix}${index}`, handler,
                    captures:new Map([...captures].map(([name,value])=>[name,value.key])),
                    ownCaptures:new Set([...captures.values()].filter(value=>value.owner===owner).map(value=>value.key)),
                    locals: localNames(handler.body)});
            }
        }
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(child => visit(child, bindings, owner));
            else if (value && typeof value === 'object') visit(value, bindings, owner);
        }
    };
    visit(ast);return registrations;
};

const emitCreatedRegistrations = (translator, out, localHandles = new Map(), callbackLocals = new Map()) => {
    for (const {token, handler, captures, locals} of translator.createdRegistrations.values()) {
        const previousCaptures = translator.capturedBindings;
        translator.capturedBindings = captures;
        translator.localVars = locals;
        translator.localHandleVars = localHandles.get(callbackLocals.get(handler)) || new Set();
        translator.handleAliases = new Map(handler.params?.[0] ? [[handler.params[0], 'arcade event first']] : []);
        out.push(`WHEN arcade creation handler "${token}" runs:`);
        // Keep callback arguments available as cells if a nested registration
        // captures them after this handler returns.
        if (handler.params?.[0]) out.push(`  arcade set local ${translator.varName(handler.params[0])} to arcade event first`);
        translator.block(handler.body, 1, out);
        translator.capturedBindings = previousCaptures;
        translator.localVars = null;translator.localHandleVars = new Set();translator.handleAliases = new Map();
        out.push('');
    }
};

const emitTerrainRegistrations = (translator,out,localHandles=new Map(),callbackLocals=new Map()) => {
    const emitted=new Set();
    for(const {kind,token,handler,captures,locals} of translator.terrainRegistrations.values()) {
        // Every registration of one named procedure shares its token and handler.
        if(emitted.has(token))continue;emitted.add(token);
        const previous={captures:translator.capturedBindings,locals:translator.localVars,parameters:translator.currentParameters,handles:translator.localHandleVars,aliases:translator.handleAliases};
        translator.capturedBindings=captures;
        translator.localVars=new Set([...locals,...handler.params]);
        translator.currentParameters=new Set(handler.params);
        translator.localHandleVars=new Set([...(localHandles.get(callbackLocals.get(handler)) || []),...(handler.params[0] && kind!=='tilemapEvent'?[handler.params[0]]:[])]);
        translator.handleAliases=new Map();
        out.push(`WHEN arcade ${kind==='legacyWall'?'color wall':kind==='tilemapEvent'?'tilemap event':kind} handler "${token}" runs:`);
        for(const [index,param] of handler.params.entries())out.push(`  arcade set local ${translator.varName(param)} to ${kind==='tilemapEvent'?'arcade event tilemap data':index===0?'arcade event first':'arcade event location'}`);
        translator.block(handler.body,1,out);out.push('');
        translator.capturedBindings=previous.captures;translator.localVars=previous.locals;translator.currentParameters=previous.parameters;translator.localHandleVars=previous.handles;translator.handleAliases=previous.aliases;
    }
};

const emitSceneRegistrations = (translator,out,localHandles=new Map(),callbackLocals=new Map()) => {
    for(const {kind,token,handler,captures,locals} of translator.sceneRegistrations.values()) {
        const previous={captures:translator.capturedBindings,locals:translator.localVars,parameters:translator.currentParameters,handles:translator.localHandleVars,aliases:translator.handleAliases};
        translator.capturedBindings=captures;
        translator.localVars=new Set([...locals,...handler.params]);
        translator.currentParameters=new Set(handler.params);
        const spriteParams=kind==='instanceOverlap'?handler.params.slice(0,1):kind==='destroyed'?handler.params.slice(0,1):kind==='overlap'?handler.params.slice(0,2):[];
        translator.localHandleVars=new Set([...(localHandles.get(callbackLocals.get(handler)) || []),...spriteParams]);
        translator.handleAliases=new Map();
        const label=['controlEvent','playerConnection'].includes(kind)?'control event':kind==='multiplayerConnection'?'multiplayer connection':kind==='multiplayerButton'?'multiplayer button':kind==='scenePush'?'scene push':kind==='scenePop'?'scene pop':kind==='instanceOverlap'?'instance overlap':kind==='instanceDestroyed'?'instance destruction':kind==='destroyed'?'destroyed kind':kind==='lifeZero'?'life zero':kind;
        out.push(`WHEN arcade ${label} handler "${token}" runs:`);
        if(['multiplayerButton','multiplayerConnection'].includes(kind) && handler.params[0])out.push(`  arcade set local ${translator.varName(handler.params[0])} to arcade event player`);
        for(const [index,param] of spriteParams.entries())out.push(`  arcade set local ${translator.varName(param)} to arcade event ${kind==='instanceOverlap'?'second':index===0?'first':'second'}`);
        translator.block(handler.body,1,out);out.push('');
        translator.capturedBindings=previous.captures;translator.localVars=previous.locals;translator.currentParameters=previous.parameters;translator.localHandleVars=previous.handles;translator.handleAliases=previous.aliases;
    }
};

const appendHandleProcedures = (translator, functions, parameterHandles, out, localHandles = new Map()) => {
    for (const fn of functions) {
        const signature = fn.params?.length ?
            `${fn.name} ${fn.params.map(param => `(${translator.varName(param)})`).join(' ')}` : fn.name;
        const lines = [`DEFINE ${signature}:`];
        lines.push(...(translator.procedureConstraintSource?.prefix(fn,fn.name+(fn.params||[]).map(()=> ' %s').join(''),name=>translator.varName(name)) || []));
        const collectLocals = body => {
            for (const st of body || []) {
                if (st.type === 'Declaration') for (const decl of st.decls) translator.localVars.add(decl.name);
                if (st.type === 'For' && st.init?.type === 'Declaration') for (const decl of st.init.decls) translator.localVars.add(decl.name);
                if (st.type === 'If') { collectLocals(st.consequent); collectLocals(st.alternate); }
                if (['For', 'While', 'Block'].includes(st.type)) collectLocals(st.body);
            }
        };
        translator.localVars = new Set();
        translator.currentParameters = new Set(fn.params || []);
        const previousCaptures=translator.capturedBindings;
        translator.capturedBindings=new Map((fn.bwCallableDefinition?.captures || []).map(capture=>[capture.name,translator.varName(capture.name)]));
        collectLocals(fn.body);
        translator.parameterHandleVars = new Set([...(parameterHandles.get(fn.name) || []), ...(translator.inferredSpriteParameters?.get(fn.name) || [])]);
        translator.localHandleVars = localHandles.get(fn.name) || new Set();
        translator.block(fn.body, 1, lines);
        translator.parameterHandleVars = new Set();
        translator.localHandleVars = new Set();
        translator.currentParameters = null;
        translator.localVars = null;
        translator.capturedBindings=previousCaptures;
        out.push(...lines, '');
    }
};

/**
 * A small, exact path for games that create unnamed sprites and configure
 * each one in sprites.onCreated. A fixed Scratch target cannot represent
 * this pattern: each callback receives a different runtime sprite. Keep the
 * older translator for programs with named sprites or other setup until the
 * handle path covers their full control flow.
 */
const translateCreationEvents = (ast, assets, assetKindLookup = null, scrollerVersion = 'v0.1.2', characterVersion = 'v0.1.0') => {
    const t = new ArcadeTranslator(assets, {}, assetKindLookup, scrollerVersion, characterVersion);
    const calls = ast.body.map(st => st.type === 'ExpressionStatement' && st.expr?.type === 'Call' ? st.expr : null);
    const nameOf = call => call && t.path(call.callee);
    const created = calls.filter(call => nameOf(call) === 'sprites.onCreated');
    if (!created.length) return null;
    const allowed = new Set(['sprites.onCreated', 'sprites.onDestroyed', 'game.onUpdateInterval',
        'sprites.create', 'game.splash', 'pause']);
    for (const [index, st] of ast.body.entries()) {
        if (st.type === 'Namespace' && st.name === 'SpriteKind') continue;
        if (st.type === 'FunctionDeclaration') continue;
        if (st.type === 'If') continue;
        if (st.type === 'For') continue;
        if (st.type === 'ExpressionStatement' && st.expr?.type === 'Assignment' &&
            st.expr.left?.type === 'Identifier' &&
            !(st.expr.right?.type === 'Call' && nameOf(st.expr.right) === 'sprites.create')) continue;
        if (st.type === 'Declaration' && st.decls.every(d => d.isArray || d.init?.type === 'Array' ||
            !(d.init?.type === 'Call' && nameOf(d.init) === 'sprites.create'))) continue;
        if (!allowed.has(nameOf(calls[index]))) return null;
    }
    const intervals = calls.filter(call => nameOf(call) === 'game.onUpdateInterval');
    const destroyed = calls.filter(call => nameOf(call) === 'sprites.onDestroyed');
    if (intervals.some(call => !call.args?.[1] || call.args[1].type !== 'FunctionExpression' ||
        !call.args[1].body.every(st => st.type === 'ExpressionStatement' &&
            st.expr?.type === 'Call' && nameOf(st.expr) === 'sprites.create'))) return null;
    if ([...created, ...destroyed].some(call => call.args?.[1]?.type !== 'FunctionExpression')) return null;

    const creates = [];
    const collectCreates = body => {
        for (const st of body || []) {
            if (st.type === 'ExpressionStatement' && st.expr?.type === 'Call') {
                if (nameOf(st.expr) === 'sprites.create') creates.push(st.expr);
                for (const arg of st.expr.args || []) if (arg?.type === 'FunctionExpression') collectCreates(arg.body);
            }
            if (st.type === 'If') { collectCreates(st.consequent); collectCreates(st.alternate); }
            if (['For', 'While', 'Block', 'FunctionDeclaration'].includes(st.type)) collectCreates(st.body);
        }
    };
    collectCreates(ast.body);
    if (!creates.length) return null;
    t.claimNames(ast);
    for (const st of ast.body) if (st.type === 'Declaration') for (const d of st.decls) {
        if (d.init?.type === 'String' || d.init?.type === 'Call' &&
            t.path(d.init.callee) === 'game.askForString') t.stringVars.add(d.name);
    }
    t.functions.push(...ast.body.filter(st => st.type === 'FunctionDeclaration')
        .map(fn => ({name: fn.name, params: fn.params, body: fn.body,...(t.procedureConstraintSource?{source:fn.source,paramTypes:fn.paramTypes}:{})})));
    const parameterHandles = inferProcedureHandleParameters(ast, t.functions, new Set(), node => t.path(node));
    const imageArrays = new Map();
    let nextCostume = 1;
    for (const st of ast.body) if (st.type === 'Declaration') for (const d of st.decls) {
        if (!d.isArray && d.init?.type !== 'Array') continue;
        const images = d.init?.items?.map(node => t.imageOf(node)) || [];
        if (images.length && images.every(Boolean)) {
            imageArrays.set(d.name, {images, start: nextCostume, end: nextCostume + images.length - 1});
            nextCostume += images.length;
        } else t.unsupported.push(`array ${d.name} — data is not imported by the Arcade creation-event path`);
    }
    const costumes = [];
    t.handleTemplates = new Map();
    t.handleImageArrays = imageArrays;
    for (const [index, call] of creates.entries()) {
        const image = t.imageOf(call.args[0]);
        if (!image) return null;
        const template = {name: `__arcadeTemplate${index + 1}`,
            kind: kindOf(call.args[1]), width: image.width, height: image.height};
        t.handleTemplates.set(call, template);
        costumes.push({sprite: template.name, name: `${template.name}-art`,
            svg: imageToSvg(image), mode: 'replace'});
        for (const [arrayName, range] of imageArrays) for (const [choice, art] of range.images.entries()) {
            costumes.push({sprite: template.name, name: `${arrayName}-${choice + 1}`,
                svg: imageToSvg(art), mode: 'add'});
        }
    }
    const globals = ast.body.filter(st => st.type === 'Declaration')
        .flatMap(st => st.decls.filter(d => !d.isArray && d.init?.type !== 'Array').map(d => d.name));
    const out = ['DEVICE ARCADE', '', 'GLOBAL __arcadeCreated',
        ...globals.map(name => `GLOBAL ${t.varName(name)}`), '', 'SPRITE Game:'];
    const setup = ast.body.filter(st => st.type === 'Declaration' &&
        st.decls.every(d => !d.isArray && d.init?.type !== 'Array') || ['If', 'For'].includes(st.type) ||
        st.type === 'ExpressionStatement' && st.expr?.type === 'Assignment' &&
            st.expr.left?.type === 'Identifier' ||
        ['sprites.create', 'sprites.onCreated', 'game.splash', 'pause'].includes(nameOf(st.type === 'ExpressionStatement' ? st.expr : null)));
    {
        out.push('WHEN flag clicked:', '  hide');
        for (const st of setup) t.statement(st, 1, out);
        out.push('');
    }
    for (const call of intervals) {
        const ms = Number(call.args[0]?.value);
        if (!Number.isFinite(ms) || ms <= 0) return null;
        out.push(`WHEN arcade every ${num(ms)} ms:`);
        t.block(call.args[1].body, 1, out);
        out.push('');
    }
    emitCreatedRegistrations(t, out);
    for (const call of destroyed) {
        const handler = call.args[1];
        t.handleAliases = new Map(handler.params?.[0] ? [[handler.params[0], 'arcade event first']] : []);
        out.push(`WHEN arcade kind "${kindOf(call.args[0])}" destroyed:`);
        t.block(handler.body, 1, out);
        t.handleAliases = new Map();
        out.push('');
    }
    appendHandleProcedures(t, t.functions, parameterHandles, out);
    const names = ['Game'];
    for (const template of t.handleTemplates.values()) {
        names.push(template.name);
        out.push(`SPRITE ${template.name}:`, 'WHEN flag clicked:', '  hide', '');
    }
    return {sourceReferences:(ast.sourceReferenceDeclarations || sourceReferenceDeclarations(ast)).map(({name,type})=>({name:t.varName(name),type})),sourceScalars:sourceScalarDeclarations(ast).map(({name,type})=>({name:t.varName(name),type})),code: `${out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`,
        unsupported: [...new Set(t.unsupported)], costumes, sprites: names};
};

// Resource planning is independent of whole-program route admission. A partial
// program still evaluates each admitted image literal at its original position;
// artwork carriers are hidden templates, never additional live actors.
const planImageValues = (t, ast, {creationApis, requiresSpriteRuntime, directImageOwners,
    frameArrays = new Map(), wrappedFrameValue = () => null, usedFrameArrays = new Set(),
    acceptImage = () => true, eager = true,
    allocateName = null}) => {
    const nameOf = call => call && t.path(call.callee);
    const sharedTransport = currentSharedImageArrayTransport(ast);
    const occupied = new Set(['Game','Stage']);
    containsAst(ast,node=>{if(typeof node.name==='string')occupied.add(node.name);for(const decl of node.decls||[])occupied.add(decl.name);for(const name of node.params||[])occupied.add(name);return false;});
    let nextResource=0;
    const resourceName = index => {
        const base=allocateName?allocateName(index):`__arcadeBackground${++nextResource}`;
        let name=base,suffix=1;
        while(occupied.has(name) || occupied.has(`${name}Image`))name=`${base}_${++suffix}`;
        occupied.add(name);occupied.add(`${name}Image`);return name;
    };
    const imageValueCostumes = [];
    const builtinImageResources = new Map();
    const sharedFrameResources = new Map();
    const stagedImageGroups = new Map(), stagedImageAliases = new Map(), artworkNames = {};
    // `shared<N>` is the exporter's older anonymous bank name, not a carrier name.
    const frameBankLabel = name => {
        const label = /^__bwFrames_([A-Za-z]\w*?)_*$/.exec(String(name))?.[1];
        return label && !/^shared\d+$/.test(label) ? label : undefined;
    };
    const artworkUserName = name => /^__bwNamespace_[A-Za-z0-9]+_([A-Za-z_]\w*)$/.exec(name || '')?.[1] ||
        frameBankLabel(name) ||
        (typeof name==='string' && !/^__/.test(name)?name:null);
    const visitArtworkSource = (node, visit, seen = new Set()) => {
        if (!node || typeof node !== 'object' || seen.has(node)) return;
        seen.add(node);visit(node);
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(child=>visitArtworkSource(child,visit,seen));
            else visitArtworkSource(value,visit,seen);
        }
    };
    if (eager) {
        visitArtworkSource(ast,node=>{
            if(node.type!=='Template' || node.tag!=='img' || !acceptImage(node) || typeof node.bwImageArrayGroup!=='string')return;
            const {bwImageArrayGroup:id,bwImageArrayIndex:index,bwImageArrayCount:count}=node,image=t.imageOf(node);
            if(!image || !Number.isInteger(index) || !Number.isInteger(count) || count<2 || index<0 || index>=count)return;
            if(!stagedImageGroups.has(id))stagedImageGroups.set(id,{count,members:new Map(),nodes:[],invalid:false});
            const group=stagedImageGroups.get(id),prior=group.members.get(index);
            if(group.count!==count || prior && (prior.width!==image.width || prior.height!==image.height ||
                prior.pixels.length!==image.pixels.length || prior.pixels.some((pixel,i)=>pixel!==image.pixels[i])))group.invalid=true;
            group.members.set(index,image);group.nodes.push(node);
        });
        for(const [id,group] of stagedImageGroups) {
            if(group.invalid || group.members.size!==group.count){stagedImageGroups.delete(id);continue;}
            stagedImageAliases.set(id,new Set([id]));
        }
        // Union assignments conservatively: a reused name must not label a later
        // image group as if it belonged to a unique animation/actor.
        let artworkAliasesChanged;
        do {
            artworkAliasesChanged=false;
            visitArtworkSource(ast,node=>{
                const entries=node.type==='Declaration'?node.decls.map(d=>[d.name,d.init]):
                    node.type==='Assignment' && node.op==='=' && node.left?.type==='Identifier'?[[node.left.name,node.right]]:[];
                for(const [name,value]of entries)if(value?.type==='Identifier' && stagedImageAliases.has(value.name)) {
                    const ids=stagedImageAliases.get(name)||new Set();
                    for(const id of stagedImageAliases.get(value.name))if(!ids.has(id)){ids.add(id);artworkAliasesChanged=true;}
                    stagedImageAliases.set(name,ids);
                    for(const id of ids)if(artworkUserName(name) && !stagedImageGroups.get(id).label)stagedImageGroups.get(id).label=artworkUserName(name);
                }
            });
        }while(artworkAliasesChanged);
        visitArtworkSource(ast,node=>{
            if(node.type!=='Call' || !['animation.runImageAnimation','characterAnimations.loopFrames','characterAnimations.runFrames'].includes(nameOf(node)))return;
            const frames=node.args?.[1],ids=frames?.type==='Identifier' && stagedImageAliases.get(frames.name);
            const actor=node.args?.[0];
            if(ids?.size===1 && actor?.type==='Identifier' && artworkUserName(actor.name)) {
                const group=stagedImageGroups.get([...ids][0]);if(!group.label)group.label=artworkUserName(actor.name)+'Animation';
            }
        });
        for(const group of stagedImageGroups.values()) {
            const name=resourceName(imageValueCostumes.length+1);
            const resource={name,key:`${name}Image`,count:group.count,fresh:true};
            for(let index=0;index<group.count;index++)imageValueCostumes.push({sprite:name,name:`${name}-frame-${index}`,svg:imageToSvg(group.members.get(index)),mode:index?'add':'replace'});
            for(const node of group.nodes)t.imageValueResources.set(node,{...resource,value:{type:'Number',value:node.bwImageArrayIndex}});
            if(group.label)artworkNames[name]=group.label;
        }
    }
    // The exporter names a frame bank after its artwork template
    // (`__bwFrames_<template>`, `_` appended on a clash). That is the carrier's
    // own name, so a bank that no user-facing name reaches keeps it on re-import.
    const bankItemLabels = new Map(), bankOfTemporary = new Map();
    visitArtworkSource(ast, node => {
        if (node.type !== 'Declaration') return;
        for (const d of node.decls) if (frameBankLabel(d.name)) {
            if (d.init?.type === 'Array') for (const item of d.init.items || []) bankItemLabels.set(item, d.name);
            // Value staging builds the array in a temporary and aliases the bank to it.
            else if (d.init?.type === 'Identifier') bankOfTemporary.set(d.init.name, d.name);
        }
    });
    visitArtworkSource(ast, node => {
        if (node.type === 'Call' && node.callee?.type === 'Member' && node.callee.name === 'push' &&
            bankOfTemporary.has(node.callee.object?.name) && node.args?.[0]?.type === 'Template') {
            bankItemLabels.set(node.args[0], bankOfTemporary.get(node.callee.object.name));
        }
    });
    const labelFrameBank = (carrier, bank) => {
        const label = frameBankLabel(bank);
        if (label && !artworkNames[carrier]) artworkNames[carrier] = label;
    };
    const collectImageValues = (node, parent) => {
        if (!node || typeof node !== 'object') return;
        if (t.imageValueResources.has(node)) return;
        // Emission consumes this whole factory, so allocating its child images
        // would leave an unused ordinary target that export makes an actor.
        if (isAnimationResourceFactory(node)) return;
        if (sharedTransport?.declarations.has(node)) return;
        if (node.type==='Declaration' && node.decls.every(d=>frameArrays.has(d.name))) return;
        // Map resources are embedded in tile data; they are not sprite image values.
        if(node.type==='Call' && nameOf(node)==='tiles.createTilemap')return;
        // An inline array of image literals (animation frames) is one resource
        // with a costume per frame, so the frames stay together in the costume
        // editor's timeline. Each element is still a fresh copy of its frame.
        if (node.type === 'Array' && node.items?.length >= 2 && node.items.every(item => item?.type === 'Template' && item.tag === 'img' && acceptImage(item) && t.imageOf(item))) {
            const name = resourceName(imageValueCostumes.length+1);
            const resource = {name, key:`${name}Image`, count:node.items.length, fresh:true};
            labelFrameBank(name, bankItemLabels.get(node.items[0]));
            node.items.forEach((item, i) => {
                imageValueCostumes.push({sprite:name, name:`${name}-frame-${i}`, svg:imageToSvg(t.imageOf(item)), mode:i ? 'add' : 'replace'});
                t.imageValueResources.set(item, {...resource, value:{type:'Number', value:i}});
            });
            return;
        }
        const selected = sharedTransport?.selection(node);
        if (selected) {
            let resource=sharedFrameResources.get(selected.key);
            if (!resource) {
                const name=resourceName(imageValueCostumes.length+1);
                resource={name,key:selected.key,count:selected.images.length};
                labelFrameBank(name,selected.key);
                sharedFrameResources.set(selected.key,resource);
                selected.images.forEach((image,i)=>imageValueCostumes.push({sprite:name,name:`${name}-frame-${i}`,svg:imageToSvg(image),mode:i?'add':'replace'}));
            }
            usedFrameArrays.add(selected.key);
            t.imageValueResources.set(node,{...resource,value:{type:'Number',value:selected.index}});
            return;
        }
        // A namespace Image binding has useful artwork metadata, but reading
        // that binding is not another allocation. Only its initializer owns
        // the literal resource; aliases and comparisons read the actual cell.
        if (node.type === 'Identifier') return;
        const image = acceptImage(node) ? t.imageOf(node) : null;
        // Runtime setImage owns a newly evaluated Image, including a creation
        // callback whose kind can be computed. Static costume-slot matching
        // cannot bind that image to every possible future sprite template.
        const directArt = parent?.type === 'Call' && parent.args?.[0] === node &&
            (creationApis.has(nameOf(parent)) || parent.callee?.name === 'setImage' &&
                !requiresSpriteRuntime && directImageOwners.has(parent.callee.object?.name) || nameOf(parent) === 'scene.setBackgroundImage');
        if (image && (!directArt || node.type === 'Member')) {
            const builtin = node.type === 'Member' ? t.path(node) : node.type === 'Template' && node.tag === 'assets.tile' && image.tileId ? image.tileId : null;
            let resource = builtin && builtinImageResources.get(builtin);
            if (!resource) {
                const name = resourceName(imageValueCostumes.length+1);
                resource = {name,key:`${name}Image`,fresh:!builtin};
                labelFrameBank(name, bankItemLabels.get(node));
                imageValueCostumes.push({sprite:name,name:`${name}-art`,svg:imageToSvg(image),mode:'replace'});
                if (builtin) builtinImageResources.set(builtin,resource);
            }
            t.imageValueResources.set(node,resource);
            return;
        }
        const spriteFrame = parent?.type === 'Call' && parent.args?.[0] === node && parent.callee?.name === 'setImage';
        if (node.type === 'Index' && !spriteFrame) {
            const arrayName=node.object?.type==='Identifier' && node.object.name;
            const frames=frameArrays.get(arrayName),value=frames && wrappedFrameValue(node.index,frames.length);
            if (frames && value) {
                let resource=sharedFrameResources.get(arrayName);
                if (!resource) {
                    const name=resourceName(imageValueCostumes.length+1);
                    resource={name,key:arrayName,count:frames.length};labelFrameBank(name,arrayName);sharedFrameResources.set(arrayName,resource);
                    frames.forEach((image,i)=>imageValueCostumes.push({sprite:name,name:`${name}-frame-${i}`,svg:imageToSvg(image),mode:i?'add':'replace'}));
                }
                usedFrameArrays.add(arrayName);t.imageValueResources.set(node,{...resource,value});
            }
        }
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(child=>collectImageValues(child,node));
            else if (value && typeof value === 'object') collectImageValues(value,node);
        }
    };
    if (eager) collectImageValues(ast);
    return {imageValueCostumes, artworkNames, collectImageValue: node => collectImageValues(node)};
};

/** `ns.name` or `name` as the image argument of a creation call, when nothing in the program
 * defines it: the path to report, else null. */
const unreadableArtPath = (t, node) => {
    if (!node || !['Member', 'Identifier'].includes(node.type)) return null;
    if (t.imageRef(node) || t.imageOf(node)) return null;
    return t.path(node);
};

/** Handle-valued globals plus onCreated/onOverlap callbacks. Kept separate
 * from the fixed-target path until its other sprite APIs can use handles. */
const translateNamedHandleEvents = (ast, assets, tilemaps = {}, forceSpriteRuntime = false, assetKindLookup = null, scrollerVersion = 'v0.1.2', characterVersion = 'v0.1.0') => {
    const t = new ArcadeTranslator(assets, tilemaps, assetKindLookup, scrollerVersion, characterVersion);
    t.callableProcedures=new Map(ast.body.filter(fn=>fn.bwCallableDefinition).map(fn=>[fn.name,fn.name+fn.params.map(()=> ' %s').join('')]));
    const needsProjectileHandles = node => {
        if (!node || typeof node !== 'object') return false;
        if (node.type === 'Call' && ['sprites.onCreated', 'image.create'].includes(t.path(node.callee))) return true;
        if (node.type === 'ExpressionStatement' && node.expr?.type === 'Call' &&
            ['sprites.createProjectile', 'sprites.createProjectileFromSide',
                'sprites.createProjectileFromSprite'].includes(t.path(node.expr.callee))) return true;
        if (node.type === 'Call' && ['sprites.createProjectile', 'sprites.createProjectileFromSide',
            'sprites.createProjectileFromSprite'].includes(t.path(node.callee)) &&
            ['Identifier', 'Call', 'Index'].includes(node.args?.[0]?.type)) return true;
        if (node.type === 'Call' && ['sprites.createProjectile', 'sprites.createProjectileFromSide',
            'sprites.createProjectileFromSprite'].includes(t.path(node.callee)) && node.args?.[0]?.type === 'Member' &&
            node.args[0].name === 'image') return true;
        return Object.values(node).some(value=>Array.isArray(value)?value.some(needsProjectileHandles):needsProjectileHandles(value));
    };
    const hasReturnedCreations = node => node && typeof node === 'object' && (node.type === 'Return' && node.value?.type === 'Call' && /^sprites\.create/.test(t.path(node.value.callee) || '') || Object.values(node).some(value => Array.isArray(value) ? value.some(hasReturnedCreations) : hasReturnedCreations(value)));
    const hasCreationCallbacks = needsProjectileHandles(ast) || hasReturnedCreations(ast);
    const creationApis = new Set(['sprites.create', 'sprites.createProjectile',
        'sprites.createProjectileFromSide', 'sprites.createProjectileFromSprite']);
    // A declaration with a sprite-valued initializer creates a handle at that
    // exact point, just like a later assignment to the same variable. Lower
    // only this form so the existing ordered setup path owns both forms.
    const beforeHandleProjection=ast;
    let changedCreation=false;
    const orderedBody = ast.body.flatMap(st => {
        if (st.type !== 'Declaration' || !st.decls.some(d => !d.temporary && d.init?.type === 'Call' &&
            creationApis.has(t.path(d.init.callee)))) return [st];
        changedCreation=true;
        return st.decls.flatMap(d => !d.temporary && d.init?.type === 'Call' &&
            creationApis.has(t.path(d.init.callee)) ? [
                {...st, decls: [{...d, init: {type: 'Null',spritePlaceholder:true}}]},
                {type: 'ExpressionStatement', expr: {type: 'Assignment', op: '=',
                    left: {type: 'Identifier', name: d.name}, right: d.init}}
            ] : [{...st, decls: [d]}]);
    });
    if(changedCreation) {
        const next={...ast,body:orderedBody};
        if(currentSharedImageArrayTransport(ast)) {
            const projected=reproveSharedImageArrayTransport(ast,next);
            // The outer current AST remains untouched for the generic route.
            if(!projected)return null;
            ast=projected;
        } else ast=next;
    }
    if(ast!==beforeHandleProjection&&hasThrowEmission(beforeHandleProjection))t.unsupported.push(...reproveThrowEmission(ast,beforeHandleProjection));
    const callOf = st => st.type === 'ExpressionStatement' && st.expr?.type === 'Call' ? st.expr : null;
    const nameOf = call => call && t.path(call.callee);
    const calls = ast.body.map(callOf);
    const names = calls.map(nameOf);
    const assignsCreate = st => st.type === 'ExpressionStatement' &&
        st.expr?.type === 'Assignment' && st.expr.op === '=' &&
        st.expr.left?.type === 'Identifier' && st.expr.right?.type === 'Call' &&
        creationApis.has(nameOf(st.expr.right));
    t.claimNames(ast);
    const usesRuntimeSpriteMethods = node => {
        if (!node || typeof node !== 'object') return false;
        if(node.loweredStaticCallbacks || node.optionalParams?.length || node.loweredLazyValues || node.type==='Undefined' || node.type==='Null' && !node.spritePlaceholder || t.hasLazyCondition(node))return true;
        if(['LegacyParsedValue','LegacyJsonValue','NativeArrayAccess'].includes(node.type) || node.type==='Identifier' && ['NaN','Infinity'].includes(node.name) && !t.boundSourceGlobals.has(node.name))return true;
        if(node.type==='SpriteKindReset' || node.type==='Member' && t.path(node.object)==='SpriteKind' || node.type==='Call' && (t.path(node.callee)==='SpriteKind.create' || node.callee?.type==='Member' && ['kind','setKind'].includes(node.callee.name) || t.path(node.callee)==='sprites.create' && (!node.args[1] || !['Member'].includes(node.args[1].type))))return true;
        if(node.type==='Call' && (isSpriteRegistration(t.path(node.callee)) || t.path(node.callee)==='sprites.onCreated'))return true;
        if(node.type==='Call' && /^info\.(showScore|showLife|showCountdown)$/.test(t.path(node.callee)||''))return true;
        if(t.bufferReferences.has(node))return true;
        if(node.type==='Declaration' && node.decls.some(decl=>decl.isArray && !decl.init))return true;
        const constantNumber=value=>value?.type==='Number'?Number(value.value):value?.type==='Unary' && value.op==='-' && value.argument?.type==='Number'?-Number(value.argument.value):value?.type==='Member' && value.object?.name==='Math' && value.name==='PI'?Math.PI:NaN;
        if(node.type==='Binary' && ['**','&','|','^','<<','>>','>>>'].includes(node.op) || node.type==='Unary' && node.op==='~')return true;
        if(node.type==='Binary' && node.op==='/' && (!Number.isFinite(constantNumber(node.right)) || constantNumber(node.right)===0))return true;
        if(node.type==='Unary' && node.op==='-' && constantNumber(node.argument)===0)return true;
        if(node.type==='Unary' && ['+','-'].includes(node.op))return true;
        if(node.type==='Call' && (isIndependentRegistration(t.path(node.callee)) || ['control.allocateNotifyEvent','control.raiseEvent','control.waitForEvent','game.ask','game.askForString','game.askForNumber','controller.pauseUntilAnyButtonIsPressed'].includes(t.path(node.callee))))return true;
        // A name whose source is not in the project is kept by name only on the native route.
        if(node.type==='Member' && t.externalName(node))return true;
        if(node.type==='Call' && /^bwStringArraySettings\.(?:read|write)$/.test(t.path(node.callee)||''))return true;
        if(node.type==='Call' && /^(?:settings|blockSettings)\.(?:(?:write|read)(?:Number|String|NumberArray|StringArray|Buffer)|exists|list|remove|clear)$/.test(t.path(node.callee)||''))return true;
        if(t.textSpriteReferences?.has(node) || node.type==='Call' && t.path(node.callee)==='textsprite.create')return true;
        if(node.type==='Call' && /^sprites\.(?:(?:set|read)Data(?:Number|String|Boolean|Sprite)|changeDataNumberBy)$/.test(t.path(node.callee)||''))return true;
        if(node.type==='Call' && t.path(node.callee)==='MultiplayerState.create')return true;
        if(node.type==='Call' && /^controller\.player[1-4]\.(?:moveSprite|stopControllingSprite)$/.test(t.path(node.callee)||''))return true;
        if(node.type==='Call' && /^mp\./.test(t.path(node.callee)||''))return true;
        if(node.type==='Call' && /^effects\.(?:\w+\.(?:startScreenEffect|endScreenEffect)|clearParticles)$/.test(t.path(node.callee)||''))return true;
        if(node.type==='Call' && /^music\./.test(t.path(node.callee)||''))return true;
        if(node.type==='Call' && /^carnival\.(?:startCountdownGame|onGameOverExpanded|customGameOverExpanded|addLabelTo)$/.test(t.path(node.callee)||''))return true;
        if(node.type==='Call' && /^game\.(?:gameOver|over|setGameOver\w+)$/.test(t.path(node.callee)||''))return true;
        if(node.type==='Call' && node.callee?.type==='Member' && (node.callee.name==='startEffect' || node.callee.name==='destroy' && node.args?.length))return true;
        if(node.type==='Call' && (['controller.setRepeatDefault','controller._setUserEventsEnabled','game.splash','game.showLongText','game.currentScene','ArcadePhysicsEngine','sprites.allOfKind','scene.onHitTile','scene.tileHitFrom','scene.onHitWall','scene.onOverlapTile','scene.centerCameraAt','scene.cameraShake','scene.cameraFollowSprite','scene.cameraProperty','scene.cameraLeft','scene.cameraTop','game.pushScene','game.popScene','game.addScenePushHandler','game.addScenePopHandler','game.removeScenePushHandler','game.removeScenePopHandler'].includes(t.path(node.callee)) || /^tiles\./.test(t.path(node.callee)||'')))return true;
        if(highScoreIntrinsic(node)||playerButtonRegistration(node)||gameResetIntrinsic(node))return true;
        if(node.type==='Call' && /^info(?:\.player[1-4])?\.(?:life|hasLife|setLife|changeLifeBy|onLifeZero|onScore)$/.test(t.path(node.callee)||''))return true;
        if(node.type==='Member' && ['repeatDelay','repeatInterval'].includes(node.name) && (t.path(node.object)||'').startsWith('controller.'))return true;
        if(node.type==='Member' && ['fx','fy','sx','sy','scale','flags'].includes(node.name))return true;
        if(node.type==='Call' && node.callee?.type==='Member' && node.callee.name==='toString' && t.spriteReferences.has(node.callee.object))return true;
        const mixedValue=value=>['String','Boolean','Null','Undefined','Array'].includes(value?.type) || t.stringReferences.has(value) || t.booleanReferences.has(value) || t.arrayReferences.has(value) || t.imageReferences.has(value);
        if(node.type==='Binary' && (node.op==='%' || ['+','-','*','/','==','!=','===','!==','<','>','<=','>='].includes(node.op) && (mixedValue(node.left) || mixedValue(node.right))) || node.type==='Unary' && ['+','-'].includes(node.op) && mixedValue(node.argument))return true;
        // Array literals are values with reference identity, including unused
        // function arguments/returns. Always select the existing native array
        // route so their elements are evaluated and their aliases are retained.
        if(node.type==='Array')return true;
        if(['FunctionDeclaration','FunctionExpression'].includes(node.type) && node.body.some(st=>st.type==='Declaration'))return true;
        if (node.type==='Array' && node.items.some(item=>t.imageReferences.has(item)||t.spriteReferences.has(item))) return true;
        if(node.type==='Index' && (t.imageReferences.has(node)||t.spriteReferences.has(node)||t.arrayReferences.has(node.object)))return true;
        if(node.type==='Call' && ['Math.random','Math.randomRange','Math.percentChance','Math.clamp','Math.min','Math.max','Math.atan2','randint','Math.sign','Math.trunc','Math.sqrt','Math.log','Math.log10','Math.asin','Math.acos','Math.pow','Math.pickRandom'].includes(t.path(node.callee)))return true;
        if(node.type==='Call' && node.callee?.type==='Member' && t.arrayReferences.has(node.callee.object))return true;
        if (node.type === 'Declaration' && node.decls.some(d => t.imageOf(d.init))) return true;
        if (node.type === 'Return' && (t.imageOf(node.value) || t.imageReferences.has(node.value))) return true;
        if (node.type === 'Assignment' && t.imageOf(node.right)) return true;
        if (node.type === 'Call' && node.callee?.type === 'Member' && t.imageReferences.has(node.callee.object)) return true;
        if (node.type === 'Call' && /^sevenseg\.(createDigit|createCounter)$/.test(t.path(node.callee) || '')) return true;
        if (node.type === 'Call' && /^(darts|corgio)\.create$/.test(t.path(node.callee) || '')) return true;
        if (node.type === 'Call' && /^scroller\./.test(t.path(node.callee) || '')) return true;
        if (node.type === 'Call' && /^characterAnimations\./.test(t.path(node.callee) || '')) return true;
        if (node.type === 'Call' && ['image.setPalette','image.create','scene.setTileMap','scene.setTile','scene.getTile','scene.getTilesByType','scene.setTileAt','scene.place','scene.placeOnRandomTile','scene.setBackgroundImage','scene.backgroundImage', 'animation.createAnimation','animation.attachAnimation','animation.setAction','animation.runImageAnimation','animation.stopAnimation'].includes(t.path(node.callee))) return true;
        if (node.type === 'Call' && node.callee?.type === 'Member' &&
            (['follow', 'unfollow', 'setScaleCore', 'setScale', 'changeScale', 'setStayInScreen', 'setBounceOnWall', 'setFlag', 'setVelocity', 'setImage', 'isHittingTile', 'tileKindAt'].includes(node.callee.name) ||
                (node.callee.object?.type === 'Member' && node.callee.object.name === 'image' &&
                    ['copyFrom', 'scroll', 'fill', 'replace', 'flipX', 'flipY', 'setPixel', 'getPixel', 'fillRect', 'drawLine', 'drawCircle', 'fillCircle', 'drawImage', 'drawTransparentImage', 'overlapsWith'].includes(node.callee.name)))) return true;
        return Object.values(node).some(value => Array.isArray(value) ?
            value.some(usesRuntimeSpriteMethods) : usesRuntimeSpriteMethods(value));
    };
    const mapCalls=new Set();
    const collectMapCalls=node=>{
        if(!node || typeof node!=='object')return;
        if(node.type==='Call')mapCalls.add(t.path(node.callee));
        for(const value of Object.values(node))if(Array.isArray(value))value.forEach(collectMapCalls);else collectMapCalls(value);
    };
    collectMapCalls(ast);
    if(['scene.setTileMap','scene.setTile','scene.getTile','scene.getTilesByType','scene.setTileAt','scene.place','scene.placeOnRandomTile'].some(name=>mapCalls.has(name)) &&
        ['tiles.setTilemap','tiles.setCurrentTilemap','scene.setTileMapLevel','tiles.getTilesByType','tiles.tileAtLocationEquals','tiles.setTileAt','tiles.setWallAt','tiles.placeOnRandomTile'].some(name=>mapCalls.has(name)))
        t.unsupported.push('Mixing legacy color-coded maps with modern map replacement, image lookup or per-location mutation is not yet supported');
    const requiresSpriteRuntime = !!ast.bwCallables?.length || !!ast.bwObjectClasses || forceSpriteRuntime || !!ast.loweredSourceLoopControl || usesRuntimeSpriteMethods(ast);
    const callbackLocals = new Map();
    const createAssignments = [];
    const localCreateAssignments = [];
    const standaloneCreates = [];
    const localCreates = [];
    const returnedCreates = [];
    const localHandles = new Map();
    const declaredWithin = body => {
        const names = new Set();
        const visit = statements => {
            for (const st of statements || []) {
                if (st.type === 'Declaration') for (const decl of st.decls) names.add(decl.name);
                if (st.type === 'If') { visit(st.consequent); visit(st.alternate); }
                if (['For', 'While', 'Block'].includes(st.type)) visit(st.body);
            }
        };
        visit(body);
        return names;
    };
    const collectCreateAssignments = (body, functionName = null, localNames = new Set()) => {
        for (const st of body || []) {
            if (st.type === 'Return' && st.value?.type === 'Call' && creationApis.has(nameOf(st.value))) returnedCreates.push(st.value);
            if (assignsCreate(st)) {
                if (functionName && localNames.has(st.expr.left.name)) {
                    localCreateAssignments.push(st);
                    if (!localHandles.has(functionName)) localHandles.set(functionName, new Set());
                    localHandles.get(functionName).add(st.expr.left.name);
                } else createAssignments.push(st);
            }
            if (callOf(st) && creationApis.has(nameOf(callOf(st)))) standaloneCreates.push(callOf(st));
            if (functionName && st.type === 'Declaration') for (const decl of st.decls) {
                if (decl.init?.type !== 'Call' || !creationApis.has(nameOf(decl.init))) continue;
                localCreates.push({name: decl.name, call: decl.init});
                if (!localHandles.has(functionName)) localHandles.set(functionName, new Set());
                localHandles.get(functionName).add(decl.name);
            }
            if (callOf(st)) for (const arg of callOf(st).args || []) {
                if (arg?.type !== 'FunctionExpression') continue;
                const key = `__callback${callbackLocals.size + 1}`;
                callbackLocals.set(arg, key);
                collectCreateAssignments(arg.body, key, declaredWithin(arg.body));
            }
            if (st.type === 'If') {
                collectCreateAssignments(st.consequent, functionName, localNames);
                collectCreateAssignments(st.alternate, functionName, localNames);
            }
            if (['For', 'While', 'Block'].includes(st.type)) {
                collectCreateAssignments(st.body, functionName, localNames);
            }
            if (st.type === 'FunctionDeclaration') {
                collectCreateAssignments(st.body, st.name, declaredWithin(st.body));
            }
        }
    };
    collectCreateAssignments(ast.body);
    if (!names.includes('sprites.onOverlap') && !hasCreationCallbacks &&
        !createAssignments.length && !localCreateAssignments.length && !localCreates.length && !returnedCreates.length && !requiresSpriteRuntime) return null;
    const handleProperty = st => st.type === 'ExpressionStatement' &&
        st.expr?.type === 'Assignment' && (st.expr.left?.type==='Index' || st.expr.left?.type === 'Member') &&
        ['Identifier','Call','Index'].includes(st.expr.left.object?.type);
    const ordinaryAssignment = st => st.type === 'ExpressionStatement' &&
        st.expr?.type === 'Assignment' && st.expr.left?.type === 'Identifier' && !assignsCreate(st);
    const sharedTransport = currentSharedImageArrayTransport(ast);
    const frameArrays = sharedTransport?.frames || new Map();
    const wrappedFrameValue = (node, count) => {
        const isCount = item => item?.type === 'Number' && Number(item.value) === count;
        if (node?.type !== 'Binary' || node.op !== '%' || !isCount(node.right)) return null;
        const plus = node.left;
        if (plus?.type !== 'Binary' || plus.op !== '+' || !isCount(plus.right)) return null;
        const inner = plus.left;
        if (inner?.type !== 'Binary' || inner.op !== '%' || !isCount(inner.right)) return null;
        const round = inner.left;
        return round?.type === 'Call' && t.path(round.callee) === 'Math.round' &&
            round.args?.length === 1 ? round.args[0] : null;
    };
    t.canonicalFrameArrays=frameArrays;
    const usedFrameArrays = new Set();
    const frameDeclaration = st => st.type === 'Declaration' && st.decls.every(d => frameArrays.has(d.name));
    const plainDeclaration = st => st.type === 'Declaration' && st.decls.every(d =>
        !frameArrays.has(d.name) && !(d.init?.type === 'Call' && nameOf(d.init) === 'sprites.create'));
    const creates = [...createAssignments.map(st => st.expr.right),
        ...localCreateAssignments.map(st => st.expr.right), ...standaloneCreates,
        ...localCreates.map(item => item.call), ...returnedCreates];
    const findEmbeddedCreates=node=>{
        if(!node||typeof node!=='object')return;
        if(node.type==='Call'&&creationApis.has(nameOf(node))&&!creates.includes(node))creates.push(node);
        for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(findEmbeddedCreates);else if(value&&typeof value==='object')findEmbeddedCreates(value);}
    };
    findEmbeddedCreates(ast);
    if (!creates.length && !requiresSpriteRuntime) return null;
    const functions = ast.body.filter(st => st.type === 'FunctionDeclaration');
    const functionNames = new Set(functions.map(fn => fn.name));
    const allowedCalls = new Set(['sprites.onCreated', 'sprites.onDestroyed', 'sprites.onOverlap', 'sprites.destroy',
        ...creationApis, 'game.onUpdateInterval', 'game.onUpdate', 'control.runInParallel', 'forever', 'game.forever', 'basic.forever',
        'controller.A.onEvent', 'controller.moveSprite', 'info.setLife', 'info.setScore',
        'carnival.startCountdownGame', 'carnival.onGameOverExpanded', 'carnival.customGameOverExpanded', 'carnival.addLabelTo', 'info.startCountdown', 'info.stopCountdown', 'info.onCountdownEnd', 'info.onLifeZero', 'info.onScore', 'console.log',
        'pause', 'game.splash', 'game.showLongText', 'image.setPalette', 'scene.setBackgroundColor', 'scene.setBackgroundImage']);
    for (const [index, st] of ast.body.entries()) {
        if (st.type === 'Namespace' && st.name === 'SpriteKind') continue;
        if (st.type === 'FunctionDeclaration' || st.type==='SpriteKindReset') continue;
        if (plainDeclaration(st) || frameDeclaration(st)) continue;
        if (assignsCreate(st)) continue;
        if (handleProperty(st)) continue;
        if (ordinaryAssignment(st) || ['If', 'For', 'While','Block'].includes(st.type) || ast.loweredSourceLoopControl && ['Switch','Enum','Interface'].includes(st.type) || requiresSpriteRuntime && st.type==='ExpressionStatement' && ['Assignment','Update'].includes(st.expr?.type)) continue;
        const name = names[index];
        if (allowedCalls.has(name) || functionNames.has(name) ||
            /^controller\.(A|B|up|down|left|right)\.onEvent$/.test(name || '') || /^info\.player[1-4]\.(?:onLifeZero|onScore)$/.test(name || '') ||
            // The runtime path keeps score and lives in native player state, which the HUD draws.
            /^info(?:\.player[1-4])?\.(setScore|changeScoreBy|setLife|changeLifeBy)$/.test(name || '') ||
            (name && /^[A-Za-z_]\w*\.onDestroyed$/.test(name)) ||
            (name && /\.(destroy|say|sayText|setStayInScreen|setBounceOnWall|setFlag|setPosition|setVelocity|setImage)$/.test(name))) continue;
        if (!(requiresSpriteRuntime && callOf(st))) return null;
    }
    for (const call of calls) if (!t.sceneStackProgram && nameOf(call)==='sprites.onCreated' &&
        !call.args?.some(arg => arg.type === 'FunctionExpression')) return null;

    for (const st of ast.body) if (st.type === 'Declaration') for (const d of st.decls) {
        if (d.init?.type === 'String' || d.init?.type === 'Call' &&
            t.path(d.init.callee) === 'game.askForString') t.stringVars.add(d.name);
    }
    t.handleVars = new Set(createAssignments.map(st => st.expr.left.name));
    const declaredTopLevel = new Set(ast.body.filter(st => st.type === 'Declaration')
        .flatMap(st => st.decls.map(decl => decl.name)));
    for (const call of calls) {
        const event = nameOf(call);
        if (!['sprites.onCreated', 'sprites.onDestroyed', 'sprites.onOverlap'].includes(event)) continue;
        const handler = call.args?.find(arg => arg.type === 'FunctionExpression');
        const eventParameters = new Set(handler?.params?.slice(0, event === 'sprites.onOverlap' ? 2 : 1));
        const collectEventAliases = body => {
            for (const st of body || []) {
                if (ordinaryAssignment(st) && st.expr.op === '=' &&
                    declaredTopLevel.has(st.expr.left.name) &&
                    eventParameters.has(st.expr.right?.name)) t.handleVars.add(st.expr.left.name);
                if (st.type === 'If') {
                    collectEventAliases(st.consequent);
                    collectEventAliases(st.alternate);
                }
                if (['For', 'While', 'Block'].includes(st.type)) collectEventAliases(st.body);
            }
        };
        collectEventAliases(handler?.body);
    }
    // An assignment copies the handle, not the sprite. Keep aliases typed as
    // handles so a later reassignment of the source variable cannot move an
    // event registration to the new sprite.
    let aliasesChanged;
    do {
        aliasesChanged = false;
        for (const st of ast.body) {
            if (st.type === 'Declaration') for (const decl of st.decls) {
                if (decl.init?.type === 'Identifier' && t.handleVars.has(decl.init.name) && !t.handleVars.has(decl.name)) {
                    t.handleVars.add(decl.name);aliasesChanged = true;
                }
            }
            if (!ordinaryAssignment(st) || st.expr.op !== '=' || st.expr.right?.type !== 'Identifier') continue;
            if (t.handleVars.has(st.expr.right.name) && !t.handleVars.has(st.expr.left.name)) {
                t.handleVars.add(st.expr.left.name);
                aliasesChanged = true;
            }
        }
    } while (aliasesChanged);
    t.functions.push(...functions.map(fn => ({name: fn.name, params: fn.params, body: fn.body,...(t.procedureConstraintSource?{source:fn.source,paramTypes:fn.paramTypes}:{}),...(fn.bwCallableDefinition?{bwCallableDefinition:fn.bwCallableDefinition}:{})})));
    const parameterHandles = inferProcedureHandleParameters(ast, functions, t.handleVars, node => t.path(node));
    t.handleTemplates = new Map();
    t.handleImageArrays = new Map();
    t.handleImageLiterals = new Map();
    t.handleFrameSelections = new Map();
    const templateByVariable = new Map();
    const initialImageByTemplate = new Map();
    const costumes = [];
    const directImageOwners=new Set([...createAssignments,...localCreateAssignments].map(st=>st.expr.left.name));
    for(const item of localCreates)directImageOwners.add(item.name);
    for(const call of calls.filter(c=>nameOf(c)==='sprites.onCreated')) {
        const handler=call.args?.find(arg=>arg.type==='FunctionExpression');
        if(handler?.params?.[0])directImageOwners.add(handler.params[0]);
    }
    const {imageValueCostumes, artworkNames} = planImageValues(t, ast,
        {creationApis, requiresSpriteRuntime, directImageOwners, frameArrays, wrappedFrameValue, usedFrameArrays});
    for (const [index, call] of creates.entries()) {
        const api = nameOf(call), projectile = api !== 'sprites.create';
        const dynamicImage = t.imageRef(call.args[0]);
        // The reference is kept by name; the absent artwork is still said once.
        const absentArt = !dynamicImage ? null : call.args[0]?.type === 'Member' ? t.externalName(call.args[0]) :
            call.args[0]?.type === 'Template' ? externalAssetText(call.args[0].tag, call.args[0].value) : null;
        if (absentArt) t.unsupported.push(`${absentArt} — sprite artwork is unavailable in this project`);
        let image = dynamicImage ? {width: 1, height: 1, pixels: new Uint8Array(1)} : t.imageOf(call.args[0]);
        if (!image) {
            // A named image the project does not supply (its asset file is not part of the source we
            // were given) is art we cannot read, not a different program: the sprite is still created
            // natively, with a transparent stand-in, and the missing art is said once.
            const source = projectile ? null : unreadableArtPath(t, call.args[0]);
            if (!source) return null;
            t.unsupported.push(`${source} — sprite artwork is unavailable in this project`);
            image = {width: 1, height: 1, pixels: new Uint8Array(1)};
        }
        const kindArgument = projectile ? api === 'sprites.createProjectile' ? call.args[3] : null : call.args[1];
        const kind = kindArgument?.type==='Member' && t.path(kindArgument.object)==='SpriteKind'?kindArgument.name:projectile?'Projectile':'Player';
        const template = {name: `__arcadeTemplate${index + 1}`, dynamicImage: !!dynamicImage, kind,
            width: image.width, height: image.height};
        t.handleTemplates.set(call, template);
        if (projectile) t.projectileTemplates.set(call, template);
        initialImageByTemplate.set(template.name, image);
        costumes.push({sprite: template.name, name: `${template.name}-art`,
            svg: imageToSvg(image), mode: 'replace'});
    }
    const imageTemplates = [...new Set(imageValueCostumes.map(c=>c.sprite))];
    const collectBackgroundArt = node => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'Call' && nameOf(node) === 'scene.setBackgroundImage' && node.args?.length === 1) {
            const image = t.imageOf(node.args[0]);
            if (image && !t.imageValueResources.has(node.args[0])) {
                // A resource holding several frames takes one name for all of them,
                // so count names in use rather than resources.
                let n = imageTemplates.length + 1;
                while (imageTemplates.includes(`__arcadeBackground${n}`)) n++;
                const name = `__arcadeBackground${n}`, key = `${name}Image`;
                t.imageValueResources.set(node.args[0],{name,key,fresh:true});imageTemplates.push(name);
                costumes.push({sprite:name,name:`${name}-art`,svg:imageToSvg(image),mode:'replace'});
            }
        }
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(collectBackgroundArt);
            else if (value && typeof value === 'object') collectBackgroundArt(value);
        }
    };
    collectBackgroundArt(ast);
    costumes.push(...imageValueCostumes);
    for (const st of [...createAssignments, ...localCreateAssignments]) {
        const variable = st.expr.left.name;
        const template = t.handleTemplates.get(st.expr.right);
        if (templateByVariable.has(variable) && templateByVariable.get(variable) !== template) {
            templateByVariable.set(variable, null);
        } else if (!templateByVariable.has(variable)) templateByVariable.set(variable, template);
    }
    for (const {name, call} of localCreates) {
        const template = t.handleTemplates.get(call);
        if (templateByVariable.has(name) && templateByVariable.get(name) !== template) {
            templateByVariable.set(name, null);
        } else if (!templateByVariable.has(name)) templateByVariable.set(name, template);
    }
    const sameImage = (a, b) => a?.width === b?.width && a?.height === b?.height &&
        a.pixels?.length === b.pixels?.length && a.pixels.every((pixel, index) => pixel === b.pixels[index]);
    const frameCostumes = new Map();
    const imageCalls = [];
    const collectImageCalls = body => {
        for (const st of body || []) {
            const call = callOf(st);
            if (call?.callee?.type === 'Member' && call.callee.name === 'setImage') imageCalls.push(call);
            if (call) for (const arg of call.args || []) {
                if (arg?.type === 'FunctionExpression') collectImageCalls(arg.body);
            }
            if (st.type === 'If') {
                collectImageCalls(st.consequent);
                collectImageCalls(st.alternate);
            }
            if (['For', 'While'].includes(st.type)) collectImageCalls(st.body);
        }
    };
    collectImageCalls(ast.body);
    const eventImageCalls = new Map();
    for (const call of calls) {
        if (nameOf(call) !== 'sprites.onCreated') continue;
        const handler = call.args?.find(arg => arg.type === 'FunctionExpression');
        const parameter = handler?.params?.[0];
        if (!parameter) continue;
        const scan = body => {
            for (const st of body || []) {
                const imageCall = callOf(st);
                if (imageCall?.callee?.type === 'Member' && imageCall.callee.name === 'setImage' &&
                    imageCall.callee.object?.type === 'Identifier' &&
                    imageCall.callee.object.name === parameter) {
                    eventImageCalls.set(imageCall, kindOf(call.args[0]));
                }
                if (st.type === 'If') { scan(st.consequent); scan(st.alternate); }
                if (['For', 'While', 'Block'].includes(st.type)) scan(st.body);
            }
        };
        scan(handler.body);
    }
    const imagesByTemplate = new Map([...initialImageByTemplate].map(([name, image]) => [name, [image]]));
    // Register arrays before literal changes. The former define costume index
    // order; literal setImage calls can then reuse an existing frame by content.
    for (const call of [...imageCalls.filter(c => c.args?.[0]?.type === 'Index'),
        ...imageCalls.filter(c => c.args?.[0]?.type !== 'Index')].filter(c => !eventImageCalls.has(c))) {
        const variable = call.callee.object?.type === 'Identifier' && call.callee.object.name;
        const template = templateByVariable.get(variable);
        if (t.imageRef(call.args?.[0])) continue;
        if (!template) return null;
        const image = t.imageOf(call.args?.[0]);
        if (image) {
            const known = imagesByTemplate.get(template.name);
            let index = known.findIndex(existing => sameImage(existing, image));
            if (index < 0) {
                index = known.length;
                known.push(image);
                costumes.push({sprite: template.name, name: `${template.name}-frame-${index}`,
                    svg: imageToSvg(image), mode: 'add'});
            }
            t.handleImageLiterals.set(call, index);
            continue;
        }
        const arg = call.args?.[0];
        const arrayName = arg?.type === 'Index' && arg.object?.type === 'Identifier' && arg.object.name;
        const frames = frameArrays.get(arrayName);
        const value = frames && wrappedFrameValue(arg.index, frames.length);
        if (!frames || !value) return null;
        usedFrameArrays.add(arrayName);
        const key = `${template.name}:${arrayName}`;
        if (!frameCostumes.has(key)) {
            const known = imagesByTemplate.get(template.name);
            const offset = sameImage(frames[0], initialImageByTemplate.get(template.name)) ? 0 : known.length;
            for (let i = offset === 0 ? 1 : 0; i < frames.length; i++) {
                const frame = frames[i];
                known.push(frame);
                costumes.push({sprite: template.name, name: `${template.name}-frame-${i}`,
                    svg: imageToSvg(frame), mode: 'add'});
            }
            frameCostumes.set(key, offset);
        }
        t.handleFrameSelections.set(call, {value, offset: frameCostumes.get(key), key: arrayName, template: template.name, count: frames.length});
    }
    for (const [call, kind] of eventImageCalls) {
        const arg = call.args?.[0];
        if (t.imageRef(arg)) continue;
        const templates = [...t.handleTemplates.values()].filter(template => template.kind === kind);
        const arrayName = arg?.type === 'Index' && arg.object?.type === 'Identifier' && arg.object.name;
        const frames = frameArrays.get(arrayName);
        const value = frames && wrappedFrameValue(arg.index, frames.length);
        if (frames && value && templates.length) {
            const offset = Math.max(...templates.map(template => imagesByTemplate.get(template.name).length));
            for (const template of templates) {
                const known = imagesByTemplate.get(template.name);
                while (known.length < offset) {
                    const prior = known[known.length - 1];
                    costumes.push({sprite: template.name, name: `${template.name}-frame-${known.length}`,
                        svg: imageToSvg(prior), mode: 'add'});
                    known.push(prior);
                }
                for (const frame of frames) {
                    costumes.push({sprite: template.name, name: `${template.name}-frame-${known.length}`,
                        svg: imageToSvg(frame), mode: 'add'});
                    known.push(frame);
                }
            }
            usedFrameArrays.add(arrayName);
            t.handleFrameSelections.set(call, {value, offset, key: arrayName, template: templates[0].name, count: frames.length});
            continue;
        }
        const image = t.imageOf(arg);
        if (!image || !templates.length) return null;
        const index = Math.max(...templates.map(template => imagesByTemplate.get(template.name).length));
        for (const template of templates) {
            const known = imagesByTemplate.get(template.name);
            while (known.length < index) {
                const prior = known[known.length - 1];
                costumes.push({sprite: template.name, name: `${template.name}-frame-${known.length}`,
                    svg: imageToSvg(prior), mode: 'add'});
                known.push(prior);
            }
            known.push(image);
            costumes.push({sprite: template.name, name: `${template.name}-frame-${index}`,
                svg: imageToSvg(image), mode: 'add'});
        }
        t.handleImageLiterals.set(call, index);
    }
    if ([...frameArrays.keys()].some(name => !usedFrameArrays.has(name))) return null;
    const declaredGlobals = ast.body.filter(plainDeclaration).flatMap(st => st.decls.filter(d=>!d.temporary).map(d => d.name));
    const out = ['DEVICE ARCADE', '', ...[...new Set([...t.handleVars, ...declaredGlobals])]
        .map(name => `GLOBAL ${t.varName(name)}`),
        '', 'SPRITE Game:'];
    const setup = ast.body.filter(st => st.type==='SpriteKindReset' || assignsCreate(st) || handleProperty(st) || ordinaryAssignment(st) ||
        st.type==='ExpressionStatement' && ['Assignment','Update'].includes(st.expr?.type) ||
        plainDeclaration(st) ||
        ['If', 'For', 'While','Block'].includes(st.type) ||
        callOf(st));
    {
        out.push('WHEN flag clicked:', '  hide');
        for (const st of setup) t.statement(st, 1, out);
        out.push('');
    }
    emitCreatedRegistrations(t, out, localHandles, callbackLocals);
    emitTerrainRegistrations(t,out,localHandles,callbackLocals);
    emitSceneRegistrations(t,out,localHandles,callbackLocals);
    appendHandleProcedures(t, t.functions, parameterHandles, out, localHandles);
    const callablePlan=ast.bwCallableLexicalPlan && structuredClone(ast.bwCallableLexicalPlan);
    if(callablePlan)for(const binding of callablePlan.bindings)if(['global','parameter'].includes(binding.kind))binding.nativeName=t.varName(binding.nativeName);
    const sourceCallables=(callablePlan?ast.bwCallables || []:[]).map(definition=>({procedure:t.callableProcedures.get(definition.name),
        metadata:callablePlan?.version===2 ? {schema:'bw-callable-declaration',version:2,site:definition.site,plan:validateClassCallablePlan(callablePlan)} : callableDeclarationEnvelope(callablePlan,definition.site)}));
    for(const definition of sourceCallables)out.push(`WHEN arcade callable ${JSON.stringify(definition.procedure)} dispatched:`, '  arcade run dispatched callable','');
    const sourceCallableGlobals=(callablePlan?ast.sourceCallableDeclarations || []:[]).map(({name})=>{const binding=callablePlan.bindings.find(row=>row.owner===callablePlan.module&&row.kind==='global'&&row.sourceName===name);return {name:t.varName(name),signature:callableVariableEnvelope(callablePlan,binding.id)};});

    const spriteNames = ['Game'];
    for (const template of t.handleTemplates.values()) {
        spriteNames.push(template.name);
        out.push(`SPRITE ${template.name}:`, 'WHEN flag clicked:', '  hide', '');
    }
    for (const name of imageTemplates) {spriteNames.push(name);out.push(`SPRITE ${name}:`, 'WHEN flag clicked:', '  hide', '');}
    return {sourceCallables,sourceCallableGlobals,sourceReferences:(ast.sourceReferenceDeclarations || sourceReferenceDeclarations(ast)).map(({name,type})=>({name:t.varName(name),type})),sourceScalars:sourceScalarDeclarations(ast).map(({name,type})=>({name:t.varName(name),type})),code: `${out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`,
        unsupported: [...new Set(t.unsupported)], costumes, sprites: spriteNames, artworkNames};
};

/** Top-level projectile creation with a named handle. PXT starts side
 * projectiles one pixel inside the incoming edge, then integrates velocity. */
const translateSideProjectiles = (ast, assets, assetKindLookup = null, scrollerVersion = 'v0.1.2', characterVersion = 'v0.1.0') => {
    const t = new ArcadeTranslator(assets, {}, assetKindLookup, scrollerVersion, characterVersion);
    const path = call => call && t.path(call.callee);
    const literal = node => node?.type === 'Number' ? Number(node.value) :
        node?.type === 'Unary' && node.op === '-' && node.argument?.type === 'Number' ?
            -Number(node.argument.value) : null;
    const projectile = node => node?.type === 'Call' &&
        ['sprites.createProjectileFromSide', 'sprites.createProjectile'].includes(path(node));
    const create = st => st.type === 'ExpressionStatement' && st.expr?.type === 'Assignment' &&
        st.expr.op === '=' && st.expr.left?.type === 'Identifier' && projectile(st.expr.right) ?
        {name: st.expr.left.name, call: st.expr.right} :
        st.type === 'Declaration' && st.decls.length === 1 && projectile(st.decls[0].init) ?
            {name: st.decls[0].name, call: st.decls[0].init} : null;
    const creates = ast.body.map(create).filter(Boolean);
    if (!creates.length) return null;
    const vars = new Set(creates.map(item => item.name));
    for (const st of ast.body) {
        if (create(st)) continue;
        if (st.type === 'Declaration' && st.decls.every(d => vars.has(d.name) &&
            (!d.init || d.init.type === 'Null'))) continue;
        if (st.type === 'ExpressionStatement' && st.expr?.type === 'Call' && path(st.expr) === 'pause') continue;
        if (st.type === 'ExpressionStatement' && st.expr?.type === 'Assignment' &&
            st.expr.left?.type === 'Member' && st.expr.left.object?.type === 'Identifier' &&
            vars.has(st.expr.left.object.name) &&
            ['x', 'y', 'vx', 'vy', 'ax', 'ay', 'fx', 'fy', 'sx', 'sy', 'scale', 'lifespan', 'rotation', 'rotationDegrees', 'data'].includes(st.expr.left.name)) continue;
        return null;
    }
    t.claimNames(ast);
    t.handleVars = vars;
    const templates = new Map();
    const costumes = [];
    for (const [index, item] of creates.entries()) {
        const args = item.call.args || [];
        const image = t.imageOf(args[0]);
        const vx = literal(args[1]), vy = literal(args[2]);
        if (!image || !Number.isFinite(vx) || !Number.isFinite(vy) || args[4]) return null;
        const name = `__arcadeTemplate${index + 1}`;
        templates.set(item.call, {name, image, vx, vy,
            kind: path(item.call) === 'sprites.createProjectileFromSide' || !args[3] ||
                (args[3].type === 'Number' && [0, 1].includes(Number(args[3].value))) ?
                'Projectile' : args[3].type === 'Number' ? String(args[3].value) : kindOf(args[3])});
        costumes.push({sprite: name, name: `${name}-art`, svg: imageToSvg(image), mode: 'replace'});
    }
    const out = ['DEVICE ARCADE', '', ...[...vars].map(name => `GLOBAL ${t.varName(name)}`),
        '', 'SPRITE Game:', 'WHEN flag clicked:', '  hide'];
    for (const st of ast.body) {
        const item = create(st);
        if (item) {
            const template = templates.get(item.call);
            const {width, height} = template.image;
            const x = template.vx < 0 ? 160 + Math.floor(width / 2) - 1 :
                template.vx > 0 ? 1 - Math.floor(width / 2) : 0;
            const y = template.vy < 0 ? 120 + Math.floor(height / 2) - 1 :
                template.vy > 0 ? 1 - Math.floor(height / 2) : 0;
            const id = t.varName(item.name);
            out.push(`  set ${id} to arcade spawn template "${template.name}" kind "${template.kind}" ` +
                `x ${x} y ${y} width ${width} height ${height}`,
            `  arcade set vx of ${id} to ${template.vx}`,
            `  arcade set vy of ${id} to ${template.vy}`,
            `  arcade auto destroy ${id} outside screen 1`);
        } else if (st.type !== 'Declaration') t.statement(st, 1, out);
    }
    for (const template of templates.values()) {
        out.push('', `SPRITE ${template.name}:`, 'WHEN flag clicked:', '  hide');
    }
    return {sourceReferences:(ast.sourceReferenceDeclarations || sourceReferenceDeclarations(ast)).map(({name,type})=>({name:t.varName(name),type})),sourceScalars:sourceScalarDeclarations(ast).map(({name,type})=>({name:t.varName(name),type})),code: `${out.join('\n').trimEnd()}\n`, unsupported: [...new Set(t.unsupported)],
        costumes, sprites: ['Game', ...[...templates.values()].map(template => template.name)]};
};

/** Event-only Arcade snippets can be imported as real kind-filtered hats.
 * Their callback parameters are runtime handles even when the snippet itself
 * contains no sprite creation. */
const translateOverlapOnly = (ast, assets, assetKindLookup = null, scrollerVersion = 'v0.1.2', characterVersion = 'v0.1.0') => {
    const t = new ArcadeTranslator(assets, {}, assetKindLookup, scrollerVersion, characterVersion);
    const call = st => st.type === 'ExpressionStatement' && st.expr?.type === 'Call' ? st.expr : null;
    const overlap = st => call(st) && t.path(call(st).callee) === 'sprites.onOverlap';
    if (!ast.body.some(overlap)) return null;
    for (const st of ast.body) {
        if (overlap(st)) {
            if (call(st).args?.[2]?.type !== 'FunctionExpression') return null;
        } else if (!(st.type === 'Declaration' && st.decls.every(d => d.init?.type === 'Number'))) return null;
    }
    t.claimNames(ast);
    const out = ['DEVICE ARCADE', '', 'SPRITE Game:', 'WHEN flag clicked:', '  hide'];
    const declarations = ast.body.filter(st => st.type === 'Declaration');
    if (declarations.length) {
        for (const st of declarations) t.statement(st, 1, out);
    }
    out.push('');
    for (const st of ast.body.filter(overlap)) {
        const args = call(st).args;
        const handler = args[2];
        t.handleAliases = new Map();
        if (handler.params?.[0]) t.handleAliases.set(handler.params[0], 'arcade event first');
        if (handler.params?.[1]) t.handleAliases.set(handler.params[1], 'arcade event second');
        out.push(`WHEN arcade kinds "${kindOf(args[0])}" and "${kindOf(args[1])}" overlap:`);
        t.block(handler.body, 1, out);
        out.push('');
    }
    return {sourceReferences:(ast.sourceReferenceDeclarations || sourceReferenceDeclarations(ast)).map(({name,type})=>({name:t.varName(name),type})),sourceScalars:sourceScalarDeclarations(ast).map(({name,type})=>({name:t.varName(name),type})),code: `${out.join('\n').trimEnd()}\n`, unsupported: [...new Set(t.unsupported)],
        costumes: [], sprites: ['Game']};
};

/**
 * Give the art holders of an imported game readable names. The runtime path
 * keeps each image in a helper sprite (`__arcadeTemplate1`, `__arcadeBackground2`)
 * that the code refers to by name; in the sprite list and costume editor those
 * names say nothing. Each is renamed after what the generated code does with it
 * — the variable a sprite is assigned to (`hero`), `background`, `<sprite>Animation`
 * — and its costumes after it (`hero`, `coinAnimation-1`, …; Code's COSTUME
 * lines end a name at a space). Costumes are read by
 * position, so only the sprite name has to change in step with the code.
 */
export function nameArtworkSprites (result) {
    const INTERNAL = /__arcade(?:Template|Background)\d+(?![\w])/g;
    const code = String(result.code || '');
    const internal = [...new Set([...(code.match(INTERNAL) || []),
        ...(result.costumes || []).map(c => c.sprite).filter(n => /^__arcade(?:Template|Background)\d+$/.test(n || ''))])];
    if (!internal.length) return result;
    const lines = code.split('\n');
    const taken = new Set(['Game', 'Stage', ...(code.match(/^SPRITE ([^:\n]+):/gm) || []).map(h => h.slice(7, -1))
        .filter(n => !/^__arcade(?:Template|Background)\d+$/.test(n))]);
    const quote = name => `template "${name}"`;
    const lowerFirst = text => text.charAt(0).toLowerCase() + text.slice(1);
    // A user-facing variable name: namespace constants keep their own name
    // (`spritesheet.player` → player); the translator's own temporaries have none.
    const userName = variable => {
        // The exporter writes a host-local variable as `Game_<name>`; label the art after
        // the name the author gave it, so a re-import names carriers as the first import did.
        const name = variable.replace(/^Game_(?=[A-Za-z_])/, '');
        const namespaced = /^__bwNamespace_[A-Za-z0-9]+_([A-Za-z_]\w*)$/.exec(name);
        if (namespaced) return namespaced[1];
        return /^__/.test(name) ? null : name;
    };
    const labelOf = name => {
        if(result.artworkNames?.[name])return userName(result.artworkNames[name]) || result.artworkNames[name];
        for (const line of lines) {
            const at = line.indexOf(quote(name));
            if (at < 0) continue;
            const head = line.slice(0, at);
            const kind = /kind "([A-Za-z_]\w*)"/.exec(line.slice(at)) || /kind "([A-Za-z_]\w*)"/.exec(head);
            if (/^\s*arcade set background image /.test(head)) return 'background';
            const animated = /arcade (?:animate sprite|character (?:loop|run) frames of) \(?([A-Za-z_]\w*)\)? /.exec(head);
            if (animated && userName(animated[1])) return `${userName(animated[1])}Animation`;
            // `set hero to (arcade create template "…" kind "Player" …)` and the
            // namespace/local forms: named after the variable, else after the kind.
            const assigned = /^\s*(?:set|arcade set local) ([A-Za-z_]\w*) to /.exec(head);
            if (assigned) {
                const base = userName(assigned[1]) ||
                    (kind ? lowerFirst(kind[1]) : /arcade projectile /.test(head) ? 'projectile' : null);
                if (base) {
                    // `create image (… template "A" …) template "B"`: A, still inside the
                    // image argument, holds the art (hero); B is the plain sprite (heroSprite).
                    const fromImage = head.indexOf('arcade create image (');
                    if (fromImage < 0) return base;
                    const depth = (head.match(/\(/g) || []).length - (head.match(/\)/g) || []).length;
                    const outer = (head.slice(0, fromImage).match(/\(/g) || []).length -
                        (head.slice(0, fromImage).match(/\)/g) || []).length;
                    return depth <= outer ? `${base}Sprite` : base;
                }
            }
            const imageOf = /arcade set image of ([A-Za-z_]\w*) to /.exec(head);
            if (imageOf && userName(imageOf[1])) return userName(imageOf[1]);
            const tileKind = /arcade register tile kind "([A-Za-z_]\w*)"/.exec(head);
            if (tileKind) return lowerFirst(tileKind[1]);
            const colourTile = /arcade set color tile \((\d+)\) image /.exec(head);
            if (colourTile) return `tile${colourTile[1]}`;
            if (/arcade set color-coded map image /.test(head)) return 'tilemap';
        }
        return /Template/.test(name) ? 'spriteArt' : 'image';
    };
    const names = new Map();
    for (const name of internal) {
        const base = labelOf(name).replace(/[^\w]/g, '') || 'image';
        let label = base, n = 2;
        while (taken.has(label)) label = `${base}${n++}`;
        taken.add(label);
        names.set(name, label);
    }
    const rename = text => String(text).replace(/__arcade(?:Template|Background)\d+(?=Image(?![\w]))|__arcade(?:Template|Background)\d+(?![\w])/g, m => names.get(m) || m);
    const costumes = (result.costumes || []).map(costume => {
        const label = names.get(costume.sprite);
        if (!label) return costume;
        const frame = new RegExp(`^${costume.sprite}-frame-(\\d+)$`).exec(costume.name || '');
        return {...costume, sprite: label, name: frame ? `${label}-${Number(frame[1]) + 1}` : label};
    });
    return {...result, code: rename(code), costumes,
        ...(Array.isArray(result.sprites) ? {sprites: result.sprites.map(rename)} : {})};
}

/**
 * Translate a MakeCode Arcade project.
/**
 * Translate a MakeCode Arcade project.
 *
 * @param {Object<string, string>|string} files the project's file map
 *   (main.ts plus any *.g.jres), or just main.ts
 * @param {object} [opts]
 * @param {string} [opts.name]
 * @returns {{
 *   code: string,
 *   unsupported: Array<string>,
 *   costumes: Array<{sprite: string, name: string, svg: string, mode: string}>,
 *   sprites: Array<string>
 * }}
 */
export function arcadeToPseudocode(files,opts={}) {
    const map=typeof files==='string'?{'main.ts':files}:files||{};
    const prepared=prepareRootFixedImages(map),view=prepared.files;
    const result=withLiteralRenderableSource(view,()=>withClosedSpriteNullFilters(view,()=>arcadeToPseudocodeImpl(view,opts)));
    return prepared.diagnostics.length?{...result,unsupported:[...new Set([...result.unsupported,...prepared.diagnostics])]}:result;
}
function arcadeToPseudocodeImpl (files, opts = {}) {
    const map = typeof files === 'string' ? {'main.ts': files} : (files || {});
    const selectedSource = arcadeProjectSource(map);
    const source = selectedSource.source;
    const anyButtonSourceSafe = source.includes('anyButton') && anyButtonConfiguredSourceSafe(map);
    const highScoreSourceSafe = source.includes('highScore') && highScoreConfiguredSourceSafe(map);
    const playerButtonSourceSafe=source.includes('onButtonEvent')&&playerButtonConfiguredSourceSafe(map);
    const playerConnectionSourceSafe=source.includes('onEvent')&&playerConnectionConfiguredSourceSafe(map);
    const resetSourceSafe=source.includes('reset')&&gameResetSourceSafe(map);
    const logValueSourceSafe = source.includes('logValue') && consoleLogValueConfiguredSourceSafe(map);
    const defaultTextPromptSourceSafe = source.includes('askForString') && numberPromptLengthSourceSafe(map);
    const numberPromptSourceSafe = source.includes('askForNumber') && numberPromptLengthSourceSafe(map);
    const legacyMelodySourceSafe = source.includes('playMelody') && legacyNoteMelodySourceSafe(map);
    setExternalRoots(map, source);
    const sharedSourcePreparation = capturePreparedSharedImageSources(map,selectedSource);
    let sharedSourceConsumed=false;
    const projectInputDiagnostics = [...selectedSource.diagnostics];
    // Parse each boundary independently before the combined parse. This keeps
    // syntax errors in one file from consuming the following file's tokens,
    // while the combined parser allocates its generated temporary names once.
    if (selectedSource.entries.length > 1) {
        for (const entry of selectedSource.entries) {
            try { parseSharedImageSourceBoundary(sharedSourcePreparation,entry,true); }
            catch (error) { throw new Error(`${entry.name}: ${error.message}`, {cause: error}); }
        }
    }
    let projectPalette = ARCADE_PALETTE;
    let projectPaletteHex = null;
    if (map['pxt.json']) {
        try {
            const palette = JSON.parse(map['pxt.json']).palette;
            if (palette !== undefined) {
                if (!Array.isArray(palette) || palette.length !== 16 ||
                    !palette.every(color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))) {
                    projectInputDiagnostics.push('Invalid project palette: expected 16 RGB colors');
                } else {
                    projectPalette = [null, ...palette.slice(1).map(color => color.toLowerCase())];
                    if (palette.some((color, index) => color.toLowerCase() !== (ARCADE_PALETTE[index] || '#000000'))) {
                        projectPaletteHex = palette.map(color => color.slice(1).toLowerCase()).join('');
                    }
                }
            }
        } catch (error) { projectInputDiagnostics.push(`Project pxt.json could not be read: ${error.message}`); }
    }

    // Internal dependency resources are qualified constants, not root image
    // factories. Keep incomplete standalone snippets diagnosed when their
    // galleries are absent; only supplied root galleries establish null lookup.
    const rootAssetFiles=Object.fromEntries(Object.entries(map).filter(([name])=>!name.startsWith('__bwDependencyInputs/')));
    let characterVersion='v0.1.0';
    try {const cfg=JSON.parse(map['pxt.json'] || '{}');if(cfg.bwArcadeNativeLibraries?.characterAnimations===LEGACY_CHARACTER_REVISION || Object.values(cfg.dependencies || {}).some(ref=>[`github:microsoft/arcade-character-animations#${LEGACY_CHARACTER_REVISION}`,'github:microsoft/arcade-character-animations#v0.0.2'].includes(ref)))characterVersion=LEGACY_CHARACTER_REVISION;}catch{}
    let scrollerVersion='v0.1.2';
    try {const cfg=JSON.parse(map['pxt.json'] || '{}');if(cfg.bwArcadeNativeLibraries?.scroller===LEGACY_SCROLLER_REVISION || Object.values(cfg.dependencies || {}).some(ref=>ref===`github:riknoll/arcade-background-scroll#${LEGACY_SCROLLER_REVISION}`))scrollerVersion=LEGACY_SCROLLER_REVISION;}catch{}
    let assetFileOrder;try{assetFileOrder=JSON.parse(map['pxt.json'] || '{}').files;}catch{}
    const assetKindLookup=Object.keys(rootAssetFiles).some(name=>/\.g\.jres$/.test(name)) ?
        createAssetKindLookup(rootAssetFiles,assetFileOrder?{fileOrder:assetFileOrder}:{}) : null;
    const assets = Object.create(null);
    const tilemaps = {};
    const songAliases = new Map();
    const animationAliases = new Map(), animationDiagnostics = [], animationIds = new Set(), nativeAnimations = [];
    let duplicateAnimationId = false;
    for (const [filename, text] of Object.entries(map)) {
        if (/\.jres$/.test(filename)) {
            Object.assign(assets, parseJres(text), parseTileAssets(text));
            const parsedSongs = parseSongJres(text);
            animationDiagnostics.push(...parsedSongs.unsupported.map(message => `${filename}: ${message}`));
            for (const song of parsedSongs.songs) {
                for (const alias of song.aliases) {
                    if (songAliases.has(alias)) {
                        songAliases.set(alias, null);
                        animationDiagnostics.push(`Ambiguous song asset alias: ${JSON.stringify(alias)}`);
                    } else songAliases.set(alias, song);
                }
            }
            const parsedAnimations = parseAnimationJres(text);
            animationDiagnostics.push(...parsedAnimations.unsupported.map(message => `${filename}: ${message}`));
            for (const animation of parsedAnimations.animations) {
                const duplicateId = animationIds.has(animation.id);
                if (duplicateId) {
                    duplicateAnimationId = true;
                    animationDiagnostics.push(`Duplicate animation asset ID: ${animation.id}`);
                    for (const [alias, prior] of animationAliases) if (prior?.id === animation.id) animationAliases.set(alias, null);
                }
                animationIds.add(animation.id);
                nativeAnimations.push(animation);
                for (const alias of animation.aliases) {
                    if (animationAliases.has(alias)) {
                        animationAliases.set(alias, null);
                        animationDiagnostics.push(`Ambiguous animation asset alias: ${JSON.stringify(alias)}`);
                    } else animationAliases.set(alias, duplicateId ? null : animation);
                }
            }
        }
        if (/\.g\.ts$/.test(filename)) Object.assign(tilemaps, parseTilemaps(text));
    }

    // Recover rich source only when it matches native pixels. Resource import
    // optionally binds fresh factories to an explicitly installed artwork library.
    const recovered = duplicateAnimationId && map[ANIMATION_COMPANION_PATH] === undefined ? {resources: [], warnings: []} :
        recoverAnimationCompanion(map[ANIMATION_COMPANION_PATH], nativeAnimations, projectPalette);
    const recoveredById = new Map(recovered.resources.map(resource => [resource.nativeId, resource]));
    let animationResources = duplicateAnimationId ? [] : nativeAnimations.map(animation => ({...animation,
        palette: [...projectPalette], document: recoveredById.get(animation.id)?.document || null,
        ...(recoveredById.get(animation.id)?.reason ? {sourceReason: recoveredById.get(animation.id).reason} : {})}));

    if (opts.animationResources) animationResources = prepareAnimationImport(animationResources);
    const resourceIds = new Map(animationResources.map(resource => [resource.id, resource.document?.animation.resource.id]));

    // Native assets.animation produces a fresh Image[] per lookup. Lower to
    // the existing typed image-array machinery, preserving ordinary variable
    // aliases/mutation. Resource mode annotates the same typed array AST so
    // inference stays intact while emission uses the fresh resource reporter.
    // With no gallery at all the asset simply lives in a file we were not given: kept by name. With a gallery that
    // lacks it, PXT yields undefined, which stays a named diagnostic.
    const hasGallery = Object.keys(map).some(filename => /\.jres$/.test(filename));
    const lowerAnimationAssets = node => {
        if (!node || typeof node !== 'object') return node;
        if (node.type === 'Template' && node.tag === 'assets.song') {
            const alias = node.value.trim(), song = songAliases.get(alias);
            if (!song) {
                // An asset the project does not carry is kept by name; only a collision is a diagnostic.
                // Kept by name so export writes it back, and still diagnosed: the asset is absent from the project.
                const external = hasGallery || songAliases.has(alias) ? null : externalAssetNode('assets.song', alias);
                if (external) {
                    animationDiagnostics.push(`Missing song asset reference: ${JSON.stringify(alias)}`);
                    return external;
                }
                animationDiagnostics.push(`${songAliases.has(alias) ? 'Ambiguous' : 'Missing'} song asset reference: ${JSON.stringify(alias)}`);
                return {type: 'Undefined'};
            }
            return {type: 'Template', tag: 'hex', value: song.hex, bwSongName: song.name};
        }
        if (node.type === 'Template' && node.tag === 'assets.animation') {
            const alias = node.value.trim(), animation = animationAliases.get(alias);
            if (!animation) {
                // Kept by name so export writes it back, and still diagnosed: the asset is absent from the project.
                const external = hasGallery || animationAliases.has(alias) ? null : externalAssetNode('assets.animation', alias);
                if (external) {
                    animationDiagnostics.push(`Missing animation asset reference: ${JSON.stringify(alias)}`);
                    return external;
                }
                animationDiagnostics.push(`${animationAliases.has(alias) ? 'Ambiguous' : 'Missing'} animation asset reference: ${JSON.stringify(alias)}`);
                return {type: 'Undefined'};
            }
            return {type: 'Array', ...(opts.animationResources ? {bwAnimationResourceId: resourceIds.get(animation.id)} : {}),
                items: animationAssetArray(animation).items};
        }
        if (Array.isArray(node)) return node.map(lowerAnimationAssets);
        return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, lowerAnimationAssets(value)]));
    };
    const callableParseOptions={namedFunctionExpressions:true,parameterDefaults:true,retainParentheses:true,retainWhenUsed:true,retainClassHeritage:true,retainOrdinaryDefaultProvenance:true};
    const ordinarySource=normalizeOwnedPromptOptions(markHighScoreCalls(markDefaultTextPrompts(markNumberPromptLengths(markLegacyNoteMelodies(lowerAnyButtonRegistrations(normalizeUnusedNamedCallbacks(markGameResets(markPlayerConnectionRegistrations(markPlayerButtonRegistrations(parseSharedImageSourceProgram(sharedSourcePreparation,source,opts.procedureConstraintsPrototype===true,opts.procedureConstraintsPrototype!==true,true,true),playerButtonSourceSafe),playerConnectionSourceSafe),resetSourceSafe),map,callbackRegistrationSpec,projectInputDiagnostics),anyButtonSourceSafe,projectInputDiagnostics),legacyMelodySourceSafe),numberPromptSourceSafe),defaultTextPromptSourceSafe),highScoreSourceSafe),map);
    const callableSourceParsed=normalizeOwnedPromptOptions(markHighScoreCalls(markDefaultTextPrompts(markNumberPromptLengths(markLegacyNoteMelodies(lowerAnyButtonRegistrations(normalizeUnusedNamedCallbacks(markGameResets(markPlayerConnectionRegistrations(markPlayerButtonRegistrations(parseMakeCodeTs(source,{...callableParseOptions,retainCallableMetadata:true,retainAuthoredEmptyBranches:true}),playerButtonSourceSafe),playerConnectionSourceSafe),resetSourceSafe),map,callbackRegistrationSpec,projectInputDiagnostics),anyButtonSourceSafe),legacyMelodySourceSafe),numberPromptSourceSafe),defaultTextPromptSourceSafe),highScoreSourceSafe),map);
    const createdDimensionSourceSafe=createdImageDimensionSourceSafe(map);
    const namedEligibility=selectNamedFunctionSourceProof(callableSourceParsed,{ordinaryProgram:ordinarySource,registrationSpec:callbackRegistrationSpec});
    const namedEnabled=namedEligibility.eligible;
    const namedLowering=namedEnabled?lowerNamedFunctionValues(callableSourceParsed):null;
    const callableEligibility=callableSourceGate(callableSourceParsed,{normalize:true});
    const callableEnabled=opts.callableLexicalPrototype===true || callableEligibility.eligible;
    const {proof:classEligibility,sdkImageEnabled}=selectClassCallableSourceProofForTranslation(callableSourceParsed,{sdkImagePrototype:opts.sdkImagePrototype===true});
    const classEnabled=opts.classCallablePrototype===true || classEligibility.eligible;
    if(opts.sdkImagePrototype===true&&!classEligibility.eligible)projectInputDiagnostics.push(...classEligibility.unsupported,'SDK Image prototype requires its completed actual source producer proof');
    // Ordinary programs retain their ordinary parse. Only the proved numeric
    // surface uses lexical metadata and the existing callable lowering path.
    const callableSourceInput=namedEnabled ? namedLowering.program : classEnabled ? withCompilerOwnedClassResultFlowProof(callableSourceParsed,classEligibility) : callableEnabled ? (callableEligibility.program || callableSourceParsed) : ordinarySource;
    if(!namedEnabled&&!opts.callableLexicalPrototype&&!opts.classCallablePrototype&&!classEligibility.eligible){
        projectInputDiagnostics.push(...callableEligibility.unsupported,...classEligibility.unsupported,...namedEligibility.unsupported);
    }
    const sharedSourceContext = !namedEnabled&&!callableEnabled&&!classEnabled ? bindPreparedSharedImageSource(sharedSourcePreparation,ordinarySource) : null;
    const generatedProfile=(namedEnabled||classEnabled||callableEnabled||opts.procedureConstraintsPrototype===true)?
        GENERATED_HELPER_PROFILES.metadata:GENERATED_HELPER_PROFILES.ordinary;
    const closedFilterInputs=lowerClosedSpriteNullFilters(callableSourceInput);
    const sourceOperatorInputs=lowerRuntimeDispatchAddHelpers(lowerSourceValueOperatorHelpers(closedFilterInputs,generatedProfile),generatedProfile);
    const nativeBinaryInputs=lowerNativeArrayBinaryHelpers(sourceOperatorInputs,generatedProfile);
    const namedArrayInputs=lowerNamedArrayItemHelpers(inlineValueHelpers(nativeBinaryInputs.program,true),{profile:generatedProfile});
    // Recognition consumes the selected parse context before clone-heavy
    // lowerings erase its parameter descriptors or alter canonical bodies.
    const generatedSource=liftNestedParameterCaptures(normalizeCompilerOwnedLegacyArrayHelpers(liftExporterStops(namedArrayInputs.program,generatedProfile),generatedProfile));
    const parsed = lowerSourceLoopControl(inlineValueHelpers(desugarForOf(lowerArrayCallbacks(lowerIifes(lowerDestroyAllSprites(lowerLibraryCalls(
        lowerAnimationAssets(generatedSource)), source), source), source), source)));
    const containsPaletteCall = node => {
        if(!node || typeof node!=='object')return false;
        if(node.type==='Call' && node.callee?.type==='Member' && node.callee.name==='setPalette' &&
            node.callee.object?.type==='Identifier' && node.callee.object.name==='image')return true;
        return Object.values(node).some(value=>Array.isArray(value)?value.some(containsPaletteCall):containsPaletteCall(value));
    };
    const runtimePaletteRequested=containsPaletteCall(parsed);
    let admittedThrowProgram=null;
    const withAnimationDiagnostics = result => {
        result = nameArtworkSprites(result);
        if(admittedThrowProgram&&!hasThrowEmission(admittedThrowProgram))result={...result,unsupported:[...(result.unsupported||[]),'Throw source changed during actual emission']};
        let code = result.code;
        const sourceWarnings=[...(parsed.sourceWarnings || []),...(namespaceBindings.warnings || [])];
        if(sourceWarnings.length)code=code.replace(/^(DEVICE ARCADE.*)$/m, (_,header)=>header+'\n'+sourceWarnings.map(warning=>'# source warning: '+warning).join('\n'));
        if(scrollerVersion===LEGACY_SCROLLER_REVISION)code=code.replace(/^WHEN flag clicked:$/m, `WHEN flag clicked:\n  arcade use background scroll version "${scrollerVersion}"`);
        if(characterVersion===LEGACY_CHARACTER_REVISION)code=code.replace(/^WHEN flag clicked:$/m, `WHEN flag clicked:\n  arcade use character animation version "${characterVersion}"`);
        let costumes = result.costumes;
        if (projectPaletteHex) {
            const command = `  arcade set palette hex "${projectPaletteHex}"`;
            code = /^WHEN flag clicked:$/m.test(code) ?
                code.replace(/^WHEN flag clicked:$/m, `WHEN flag clicked:\n${command}`) :
                `${code.trimEnd()}\nWHEN flag clicked:\n${command}\n`;
            costumes = (costumes || []).map(costume => {
                const pixels = /shape-rendering="crispEdges"/.test(costume.svg || '') && svgToPixels(costume.svg);
                const svg = pixels ? imageToSvg(pixels, {scale:pixels.scale,palette:projectPalette}) :
                    String(costume.svg || '').replace(/fill="(#[0-9a-f]{6})"/gi, (fill,color) => {
                        const index=ARCADE_PALETTE.findIndex(entry=>entry?.toLowerCase()===color.toLowerCase());
                        return index>0 ? `fill="${projectPalette[index]}"` : fill;
                    });
                return {...costume,svg};
            });
        }
        const paletteDiagnostics=[];
        const nativeImages=/arcade (?:create (?:sprite|image|template)|spawn (?:template|image)|frame image|projectile image)/.test(code);
        if(runtimePaletteRequested && (costumes || []).length && !nativeImages) {
            paletteDiagnostics.push('Runtime palette changes require native Arcade image rendering; fixed Scratch costume rendering is not supported');
        }
        if(projectPaletteHex && projectPaletteHex.slice(0,6)!=='000000' &&
            (result.costumes || []).some(costume=>costume.sprite==='background' && !/shape-rendering="crispEdges"/.test(costume.svg || ''))) {
            paletteDiagnostics.push('Project palette index zero on a fixed Scratch background requires native Arcade background rendering');
        }
        code = code.replace(/^WHEN flag clicked:$/gm, 'WHEN arcade source starts:');
        const globalNames = new Set([...code.matchAll(/^GLOBAL (.+)$/gm)].map(match=>match[1]));
        const callableGlobals=new Map((result.sourceCallableGlobals || []).map(row=>[row.name,row.signature]));
        const sourceDeclarations = (result.sourceScalars || []).filter(({name})=>globalNames.has(name)&&!callableGlobals.has(name))
            .map(({name,type})=>`  declare arcade source scalar ${name} as ${type}`);
        sourceDeclarations.push(...(result.sourceReferences || []).filter(({name})=>globalNames.has(name)&&!callableGlobals.has(name)).map(({name,type})=>`  declare arcade source reference ${name} as ${JSON.stringify(type)}`));
        sourceDeclarations.push(...[...callableGlobals].filter(([name])=>globalNames.has(name)).map(([name,signature])=>`  declare arcade source callable ${name} signature ${JSON.stringify(JSON.stringify(signature))}`));
        if (sourceDeclarations.length) {
            if (!/^WHEN arcade source starts:$/m.test(code)) code += '\nSPRITE Game:\nWHEN arcade source starts:\n';
            code = code.replace(/^WHEN arcade source starts:$/m, header=>header+'\n'+sourceDeclarations.join('\n'));
        }

        const callableDeclarations=(result.sourceCallables || []).map(({procedure,metadata})=>`  arcade declare callable ${JSON.stringify(procedure)} metadata ${JSON.stringify(JSON.stringify(metadata))}`);
        if(callableDeclarations.length) {
            if(result.sourceCallables.some(row=>row.metadata.version===2)) {
                const rows=code.split('\n'),source=rows.findIndex(row=>row==='WHEN arcade source starts:');
                let last=-1;
                for(let index=source+1;index<rows.length&&rows[index].startsWith('  ');index++)
                    if(/^  arcade declare (?:class|subclass) /.test(rows[index]))last=index;
                if(source<0||last<0)result.unsupported.push('Class callable declarations require their actual source class registration prefix');
                else {rows.splice(last+1,0,...callableDeclarations);code=rows.join('\n');}
            }else code=code.replace(/^WHEN arcade source starts:((?:\n  declare arcade source (?:scalar|reference|callable) .+)*)/m,prefix=>prefix+'\n'+callableDeclarations.join('\n'));
        }
        const sourceReceiptDiagnostics=sharedSourceConsumed&&!sharedImageSourceContextCurrent(sharedSourceContext)?['Shared Image Array selected-source receipt expired; admitted source and artwork retained']:[];
        return {...result,code,costumes,animationResources,warnings:[...recovered.warnings,...sourceWarnings],
            unsupported:[...new Set([...nativeBinaryInputs.unsupported,...namedArrayInputs.unsupported,...animationDiagnostics,...projectInputDiagnostics,...paletteDiagnostics,...sourceReceiptDiagnostics,...result.unsupported])]};
    };
    let textSpriteInitializer=false;
    try {const cfg=JSON.parse(map['pxt.json'] || '{}');textSpriteInitializer=cfg.bwArcadeNativeLibraries?.textsprite==='v1.3.0' && selectedSource.entries.some(entry=>entry.name.startsWith('__bwDependencyInputs/arcade-text/') && entry.source===TEXT_SPRITE_INITIALIZER);}catch{}
    const namespaceBindings = lowerNamespaceBindings(parsed,{spriteKinds:true,textSpriteInitializer});
    // Namespace image constants (\`namespace myTiles { export const tile0 = img\`...\` }\`)
    // keep pixel metadata for artwork planning. Their runtime reads still use
    // the actual binding; an immutable binding can hold a mutable Image.
    for (const statement of namespaceBindings.program?.body || []) {
        if (statement.type !== 'Declaration' || statement.kind !== 'const') continue;
        for (const decl of statement.decls) {
            if (!/^__bwNamespace_/.test(decl.name)) continue;
            const literal = decl.init?.type === 'Template' && decl.init.tag === 'img' ? parseImageLiteral(decl.init.value) : null;
            const image = assets[decl.assetPath] || (literal ?
                {...literal, tileId: decl.assetPath, displayName: decl.assetPath?.split('.').pop()} : null);
            if (image && !Object.prototype.hasOwnProperty.call(assets, decl.name)) assets[decl.name] = image;
        }
    }
    const tileImagePath = node => node?.type==='Identifier' ? node.name : node?.type==='Member' ? `${tileImagePath(node.object)}.${node.name}` : null;
    const tileImageOf = node => node?.type==='Template' && node.tag==='img' ? parseImageLiteral(node.value) : node?.type==='Template' && assetKindLookup && ['assets.image','assets.tile'].includes(node.tag) ? lookupAssetTemplate(assetKindLookup,node.tag,node.value) : node?.type==='Template' && /^assets\./.test(node.tag||'') ? assets[node.value.trim()] : node?.type==='Member' ?
        assets[tileImagePath(node)] || assets[node.name] || (BUILTIN_IMAGES[tileImagePath(node)] ? decodeMkcdImage(BUILTIN_IMAGES[tileImagePath(node)]) : null) :
        node?.type==='Identifier' ? assets[node.name] : null;
    const ordinaryProgram=namespaceBindings.program || parsed;
    const integerDivisions=lowerMathIdivValues(ordinaryProgram);
    projectInputDiagnostics.push(...integerDivisions.unsupported);
    const ordinaryOmissions = prepareOrdinaryCallOmissions(integerDivisions.program);
    projectInputDiagnostics.push(...ordinaryOmissions.unsupported);
    const procedureConstraints=prepareProcedureConstraintSourceForTranslation(ordinaryOmissions.program,{mode:opts.procedureConstraintsPrototype===true?'prototype':'supported-default'});
    if(procedureConstraints)projectInputDiagnostics.push(...procedureConstraints.diagnostics);
    // Never attach the preparation's Program inside the executable AST: general
    // walkers would otherwise see a second copy of all declarations and effects.
    const protocolProgram=procedureConstraints?{...procedureConstraints.program,bwProcedureConstraintSource:procedureConstraintAstMetadata(procedureConstraints)}:integerDivisions.program;
    const throwSource=prepareThrowSource(protocolProgram);
    projectInputDiagnostics.push(...throwSource.unsupported);
    if(throwSource.present&&opts.throwPrototype!==true)projectInputDiagnostics.push('Throw source requires its qualified canonical protocol; prototype admission is not enabled');
    const throwProgram=throwSource.program;
    const inspectionValues=lowerConsoleInspectValues(throwProgram);
    projectInputDiagnostics.push(...inspectionValues.unsupported);
    const logValues = lowerConsoleLogValues(inspectionValues.program,logValueSourceSafe);
    const fontValues = lowerSdkFontValues(logValues);
    projectInputDiagnostics.push(...fontValues.unsupported);
    const fontSource = lowerLiveFontMetrics(fontValues.program);
    const sharedPreparation = !namedEnabled && !callableEnabled && !classEnabled ? prepareSharedImageArrayTransport(fontSource,{sourceContext:sharedSourceContext}) : null;
    const buildCurrentAst = (input, transport = null) => {
        const diagnostics = [];
        const queryReferences = inferImageReferences(input,tileImagePath,tileImageOf,
            node => !!assetKindLookup && node?.type==='Template' && ['assets.image','assets.tile'].includes(node.tag));
        const arrayMaps=proveArrayMapValues(input,source);
        diagnostics.push(...arrayMaps.unsupported);
        const stagedSource = lowerPxtStagedValues(input, {
            sharedImageArrayPlan: transport?.plan || null,
            lowerArrayMap:arrayMaps.lower,
            isStaticResource: node => !!decodeTilemap(node,tileImageOf,tileImagePath),
            isArrayQuery: node => node.callee?.type==='Member' &&
                ['indexOf','removeElement'].includes(node.callee.name) && queryReferences.arrays.has(node.callee.object)
        });
        stagedSource.sourceReferenceDeclarations = sourceReferenceDeclarations(stagedSource);
        stagedSource.sourceCallableDeclarations=namedEnabled?stagedSource.sourceCallableDeclarations || []:callableEnabled?sourceCallableDeclarations(stagedSource).declarations:[];
        const callables=namedEnabled?{program:stagedSource,unsupported:namedLowering.unsupported}:classEnabled?lowerCallableValues(stagedSource,{classPrototype:true,sdkImagePrototype:sdkImageEnabled}):callableEnabled?lowerCallableValues(stagedSource):{program:stagedSource,unsupported:[]};
        diagnostics.push(...callables.unsupported);
        // This actual build/fallback owns its own fresh source proof.
        const stagedThrow=throwSource.physicalUpdateSource?prepareThrowSource(callables.program):throwSource;
        if(stagedThrow!==throwSource)diagnostics.push(...stagedThrow.unsupported);
        const objectClasses = lowerObjectClasses(callables.program,{classCallablePrototype:classEnabled,sdkImagePrototype:sdkImageEnabled,
            physicalUpdateSource:stagedThrow.physicalUpdateSource});
        if(classEnabled && !callables.unsupported.length && !objectClasses.unsupported.length) {
            try {objectClasses.program.bwCallableLexicalPlan=callables.finishClassPlan(objectClasses.program.bwClassCallableProcedures || []);}
            catch(error){objectClasses.unsupported.push(String(error.message));}
        }
        diagnostics.push(...objectClasses.unsupported);
        const callbacks = lowerStaticCallbackHelpers(objectClasses.program, {registrationSpec:callbackRegistrationSpec});
        diagnostics.push(...callbacks.unsupported);
        const ast = lowerLazyValues(callbacks.program, {unsupported:diagnostics});
        return {ast:transport ? projectSharedImageArrayTransport(ast,transport.plan) : ast,diagnostics,stagedThrow,physicalUpdateLowering:objectClasses.physicalUpdateLowering};
    };
    let built = buildCurrentAst(sharedPreparation?.program || fontSource,sharedPreparation);
    if(sharedPreparation && !finishSharedImageArrayTransport(built.ast,sharedPreparation.plan)) {
        // No emitter/artwork callback has run. Recompile this SAME current AST
        // with ordinary staging, retaining both diagnostics and explicit refusal.
        const refused = built.diagnostics;
        built = buildCurrentAst(fontSource);
        built.diagnostics.push(...refused,'Shared Image Array transport projection refused; ordinary current source staging retained');
    }
    projectInputDiagnostics.push(...built.diagnostics);
    const ast = built.ast;
    if(!sharedPreparation)markCreatedImageDimensions(ast,createdDimensionSourceSafe);
    if(source.includes('onScore')&&source.includes('assets.image'))bindScoreImageSource(ast,map);
    const sharedImageTransport = currentSharedImageArrayTransport(ast);
    // Issue only for the actual chosen output, after transport finishing or
    // ordinary-current fallback. No abandoned build transfers an emission fact.
    if(throwSource.present&&!throwSource.unsupported.length&&!built.stagedThrow.unsupported.length&&opts.throwPrototype===true){
        const finalThrow=prepareThrowEmission(ast,built.stagedThrow,built.physicalUpdateLowering,throwSource);
        projectInputDiagnostics.push(...finalThrow);if(!finalThrow.length)admittedThrowProgram=ast;
    }
    sharedSourceConsumed=!!sharedImageTransport&&!!sharedSourceContext;
    const flattened = namespaceBindings.program ? ast : null;
    const nativeTilemaps = createNativeTilemapRegistry(map,tileImageOf,assetFileOrder?{fileOrder:assetFileOrder}:{});
    const namedEvents = flattened && translateNamedHandleEvents(flattened, assets, nativeTilemaps, !!projectPaletteHex || runtimePaletteRequested || sourceScalarDeclarations(flattened).length > 0, assetKindLookup, scrollerVersion, characterVersion);
    if (namedEvents) return withAnimationDiagnostics(namedEvents);
    const creationEvents = flattened && translateCreationEvents(flattened, assets, assetKindLookup, scrollerVersion, characterVersion);
    if (creationEvents) return withAnimationDiagnostics(creationEvents);
    const sideProjectiles = namespaceBindings.program && translateSideProjectiles(ast, assets, assetKindLookup, scrollerVersion, characterVersion);
    if (sideProjectiles) return withAnimationDiagnostics(sideProjectiles);
    const overlapOnly = namespaceBindings.program && translateOverlapOnly(ast, assets, assetKindLookup, scrollerVersion, characterVersion);
    if (overlapOnly) return withAnimationDiagnostics(overlapOnly);
    const t = new ArcadeTranslator(assets, tilemaps, assetKindLookup, scrollerVersion, characterVersion);
    t.unsupported.push(...animationDiagnostics, ...namespaceBindings.unsupported);
    // Before anything is emitted: a variable this program has to be
    // renamed must not land on a name the program already uses.
    t.claimNames(ast);
    t.buttonEventNumberLeaves = controllerButtonEventNumberLeaves(ast);
    // A retained unsupported class/helper must not discard neighboring Image
    // values. Claim only actual literals here: a variable or namespace alias
    // reads the single value allocated by its initializer, not a new copy.
    // Conservative binding refusal also covers a parameter/local named img in
    // an otherwise untranslatable neighbor; a tag's spelling is no authority.
    const tagWriter = node => {
        const value = node.type === 'Assignment' ? node.left : node.type === 'Update' ? node.argument : null;
        let root = value;
        while (['Member', 'Index'].includes(root?.type)) root = root.object;
        if (root?.type === 'Identifier' && root.name === 'img') return true;
        // An ambient global write is also a configured replacement of the tag.
        if (!['globalThis', 'window', 'self'].includes(value?.object?.name)) return false;
        return value.type === 'Member' ? value.name === 'img' : value.type === 'Index' &&
            (value.index?.type !== 'String' || value.index.value === 'img');
    };
    let imageIndexFacts = null;
    if (containsAst(parsed, node => node.type === 'Index')) {
        try {
            imageIndexFacts = analyseSourceValueProducers(parsed, {arrayValues:true, parenthesized:true,
                unboundIsOpaque:true, opaqueDeclarationValues:true, uninitializedLocalsAreOpaque:true,
                declaredLocalUndefined:true});
        } catch (error) {
            t.unsupported.push(`Image literal configured Array index proof refused: ${error.message}`);
        }
    }
    const safeImageIndex = node => {
        const facts = imageIndexFacts;
        if (!facts || !facts.arrayAllocationsAt(node.object).length ||
            !facts.arrayMapReceiverSafeAt(node.object) || facts.arrayConstraintErrorsAt(node.object).length ||
            node.object?.type === 'Identifier' && !facts.isInitializedAt(node.object)) return false;
        const types = facts.typesAt(node.index);
        if (types.size !== 1 || !types.has('Number')) return false;
        return !containsAst(node.index, value => value.type === 'Identifier' && !facts.isInitializedAt(value));
    };
    const imgBound = containsAst(parsed, node =>
        node.type === 'Declaration' && node.decls.some(decl => decl.name === 'img') ||
        ['FunctionDeclaration', 'FunctionExpression', 'Class', 'Enum', 'Namespace', 'ForOf'].includes(node.type) && node.name === 'img' ||
        Array.isArray(node.params) && node.params.includes('img') || tagWriter(node) ||
        // This bounded source domain does not interpret ambient objects, tag
        // escapes or dynamic code/reflection. Refuse them even in unused bodies
        // rather than trying to prove every possible aliased host mutation.
        node.type === 'Identifier' && ['img', 'this', 'globalThis', 'window', 'self', 'eval', 'Function', 'Reflect'].includes(node.name) ||
        node.type === 'Member' && node.name === 'constructor' ||
        node.type === 'Index' && !safeImageIndex(node) ||
        node.type === 'Unknown');
    const occupiedImageNames = new Set(['Game', 'Stage']);
    containsAst(ast, node => {
        if (typeof node.name === 'string') occupiedImageNames.add(node.name);
        for (const decl of node.decls || []) occupiedImageNames.add(decl.name);
        for (const param of node.params || []) occupiedImageNames.add(param);
        return false;
    });
    let nextImageName = 0;
    const allocateImageName = () => {
        let name;
        do { name = `__arcadeBackground${++nextImageName}`; } while (occupiedImageNames.has(name));
        occupiedImageNames.add(name);
        return name;
    };
    const {imageValueCostumes, artworkNames, collectImageValue} = planImageValues(t, ast, {
        creationApis: new Set(['sprites.create', 'sprites.createProjectile',
            'sprites.createProjectileFromSide', 'sprites.createProjectileFromSprite']),
        requiresSpriteRuntime: false, directImageOwners: new Set(),
        acceptImage: node => node?.type === 'Template' && node.tag === 'img' && !imgBound,
        eager: false, allocateName: allocateImageName
    });
    if (imgBound && containsAst(ast, node => node.type === 'Template' && node.tag === 'img'))
        t.unsupported.push('Image literal requires an unshadowed img binding; ambient handles, tag escapes, dynamic code and incomplete configured tag-writer census remain unsupported');
    const costumes = [];

    // ── pass 1: find the sprites, because everything else refers to them
    const registerSprite = (name, createCall) => {
        const image = t.imageOf(createCall.args[0]);
        const art = image ? imageToSvg(image) : null;
        if (!art) {
            const source = t.path(createCall.args[0]) || 'sprite image';
            t.unsupported.push(`${name}: ${source} — sprite artwork is unavailable in this project`);
        }
        const sprite = {
            name,
            kind: kindOf(createCall.args[1]),
            velocity: false,
            width: image ? image.width : null,
            height: image ? image.height : null
        };
        t.sprites.push(sprite);
        if (art) costumes.push({sprite: name, name: `${name}-art`, svg: art, mode: 'replace'});
        return sprite;
    };

    /**
     * Backdrop art: the first becomes the costume, the rest are added
     * beside it.
     *
     * The backdrop is a SPRITE and not a Stage costume because the route
     * the Code tab uses (`applyCustomSVG`) deliberately skips the Stage —
     * a full-screen sprite sent to the back looks the same and actually
     * arrives. And a game usually has both a background image and one or
     * more levels, so they all land as costumes on it and the user can
     * switch between them, rather than the second being refused for
     * having come second.
     */
    const backdropArt = (label, svg) => {
        if (!t.sprite('background')) {
            t.sprites.unshift({name: 'background', kind: 'Background', velocity: false, backdrop: true});
        }
        const existing = costumes.filter(c => c.sprite === 'background').length;
        if (existing >= MAX_BACKDROPS) {
            t.unsupported.push(`${label} — only the first ${MAX_BACKDROPS} backdrops are carried over`);
            return;
        }
        costumes.push({sprite: 'background', name: label, svg, mode: existing ? 'add' : 'replace'});
    };

    /**
     * A level becomes a picture of itself, painted tile by tile.
     *
     * Scratch has no scrolling tilemap, so what arrives is the level as an
     * image rather than terrain a sprite can collide with. Said once, in
     * the unsupported list, because it is the difference that matters.
     */
    const registerTilemap = node => {
        const name = node && node.type === 'Template' ? node.value.trim() : '';
        const tilemap = t.tilemaps[name];
        if (!tilemap) {
            t.unsupported.push(`tiles.setTilemap(${name || '…'}) — no such tilemap in this project`);
            return;
        }
        const image = renderTilemap(tilemap, t.assets);
        if (!image) {
            t.unsupported.push(`tiles.setTilemap(${name}) — the level's tiles could not be read`);
            return;
        }
        backdropArt(`level-${name}`, imageToSvg(image, {scale: 1}));
        t.unsupported.push('tiles.* — the level arrives as a picture, not as terrain a sprite collides with');
    };

    const registerBackground = node => {
        const art = t.artOf(node);
        if (!art) {
            t.unsupported.push('scene.setBackgroundImage() with art we could not read');
            return;
        }
        backdropArt('background', art);
    };

    /**
     * Backdrops are declared wherever the game happens to declare them —
     * a level is usually set inside a `setLevel()` function, not at the
     * top level — so this scan goes all the way down. Sprite creation
     * does NOT: one inside a body is a spawn, and pass 2 turns it into a
     * clone.
     */
    /**
     * MakeCode animations, brought in as costumes.
     *
     * The shape a real game uses is the action API, not runImageAnimation:
     *
     *   walkLeft = animation.createAnimation(ActionKind.Walking, 100)
     *   animation.attachAnimation(hero, walkLeft)
     *   walkLeft.addAnimationFrame(img`…`)
     *
     * Scratch has costumes but no NAMED animation with its own timer, and
     * a game here binds several animations to one sprite under the same
     * ActionKind — so `setAction` cannot be resolved to one of them. What
     * CAN be saved is the artwork, which is otherwise lost outright: every
     * frame becomes a costume on the sprite it was attached to, and the
     * switching is reported rather than invented.
     */
    const animations = new Map();          // variable name → {sprite, frames}

    const animationFor = name => {
        if (!animations.has(name)) animations.set(name, {sprite: null, frames: []});
        return animations.get(name);
    };

    const collectAnimations = (node, seen = new Set()) => {
        if (!node || typeof node !== 'object' || seen.has(node)) return;
        seen.add(node);
        if (node.type === 'Assignment' && node.left.type === 'Identifier' &&
            node.right && node.right.type === 'Call' &&
            t.path(node.right.callee) === 'animation.createAnimation') {
            animationFor(node.left.name);
        }
        if (node.type === 'Declaration') {
            for (const d of node.decls || []) {
                if (d.init && d.init.type === 'Call' &&
                    t.path(d.init.callee) === 'animation.createAnimation') {
                    animationFor(d.name);
                }
            }
        }
        if (node.type === 'Call') {
            const called = t.path(node.callee);
            if (called === 'animation.attachAnimation') {
                const sprite = t.resolveSprite(node.args[0]);
                const variable = node.args[1] && node.args[1].type === 'Identifier' ? node.args[1].name : null;
                if (sprite && variable) animationFor(variable).sprite = sprite.name;
            }
            // `walkLeft.addAnimationFrame(img`…`)`
            if (node.callee && node.callee.type === 'Member' &&
                node.callee.name === 'addAnimationFrame' &&
                node.callee.object.type === 'Identifier') {
                const art = t.artOf(node.args[0]);
                if (art) animationFor(node.callee.object.name).frames.push(art);
            }
        }
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(v => collectAnimations(v, seen));
            else if (value && typeof value === 'object') collectAnimations(value, seen);
        }
    };

    const visitCalls = (node, seen = new Set()) => {
        if (!node || typeof node !== 'object' || seen.has(node)) return;
        seen.add(node);
        if (node.type === 'Call') {
            const called = t.path(node.callee);
            if (called === 'scene.setBackgroundImage') registerBackground(node.args[0]);
            if (called === 'tiles.setTilemap' || called === 'scene.setTileMapLevel') {
                registerTilemap(node.args[0]);
            }
        }
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(v => visitCalls(v, seen));
            else if (value && typeof value === 'object') visitCalls(value, seen);
        }
    };

    const walkForSprites = body => {
        for (const st of body) {
            if (st.type === 'Declaration') {
                for (const d of st.decls) {
                    if (d.init && d.init.type === 'Call' && t.path(d.init.callee) === 'sprites.create') {
                        registerSprite(d.name, d.init);
                    }
                }
            }
            if (st.type === 'ExpressionStatement' && st.expr.type === 'Assignment' &&
                st.expr.right && st.expr.right.type === 'Call' &&
                t.path(st.expr.right.callee) === 'sprites.create' &&
                st.expr.left.type === 'Identifier') {
                registerSprite(st.expr.left.name, st.expr.right);
            }
            if (st.type === 'Enum') t.statement(st, 0, []);
            if (st.type === 'FunctionDeclaration') t.functions.push({name: st.name, params: st.params, body: st.body,...(t.procedureConstraintSource?{source:st.source,paramTypes:st.paramTypes}:{})});
        }
    };
    walkForSprites(ast.body);
    ast.body.forEach(st => visitCalls(st));
    // After the sprites, because an animation is bound to one by name.
    ast.body.forEach(st => collectAnimations(st));

    // A projectile made inside a function belongs to that invocation. Keep
    // its handle in the procedure frame and use a reusable image template,
    // rather than creating one shared Scratch variable for every call.
    const functionLocalHandles = new Map();
    const functionDestructionCallbacks = [];
    const projectileApis = new Set(['sprites.createProjectile', 'sprites.createProjectileFromSide',
        'sprites.createProjectileFromSprite']);
    const registerProjectile = (call, scope) => {
        const api = call?.type === 'Call' && t.path(call.callee);
        if (!projectileApis.has(api)) return false;
        if (t.projectileTemplates.has(call)) return true;
        const argCount = call.args?.length || 0;
        const validArity = api === 'sprites.createProjectileFromSide' ? argCount === 3 :
            api === 'sprites.createProjectileFromSprite' ? argCount === 4 :
                argCount >= 3 && argCount <= 5;
        if (!validArity) {
            t.unsupported.push(`${api}() with missing or extra arguments in ${scope}`);
            return true;
        }
        const image = t.imageOf(call.args[0]);
        if (!image) {
            t.unsupported.push(`${api}() in ${scope} — projectile artwork is unavailable`);
            return true;
        }
        const name = `__arcadeProjectileTemplate${t.projectileTemplates.size + 1}`;
        const kindArg = api === 'sprites.createProjectile' ? call.args[3] : null;
        if (kindArg?.type === 'Number' && negativeKind(kindArg) === null && ![0, 1].includes(Number(kindArg.value))) {
            t.unsupported.push(`${api}() numeric kind ${kindArg.value} in ${scope}`);
        }
        const kind = api === 'sprites.createProjectileFromSide' || !kindArg ||
            (kindArg.type === 'Number' && [0, 1].includes(Number(kindArg.value))) ?
            'Projectile' : kindOf(kindArg);
        t.projectileTemplates.set(call, {name, kind, width: image.width, height: image.height});
        costumes.push({sprite: name, name: `${name}-art`, svg: imageToSvg(image), mode: 'replace'});
        return true;
    };
    for (const fn of t.functions) {
        const handles = new Set();
        const locals = new Set(fn.params || []);
        const scan = body => {
            for (const st of body || []) {
                if (st.type === 'Declaration') for (const decl of st.decls) {
                    locals.add(decl.name);
                    if (registerProjectile(decl.init, `${fn.name}()`)) handles.add(decl.name);
                }
                const assignment = st.type === 'ExpressionStatement' && st.expr?.type === 'Assignment' &&
                    st.expr.op === '=' && st.expr.left?.type === 'Identifier' ? st.expr : null;
                if (assignment && locals.has(assignment.left.name) &&
                    registerProjectile(assignment.right, `${fn.name}()`)) {
                    handles.add(assignment.left.name);
                }
                if (st.type === 'If') { scan(st.consequent); scan(st.alternate); }
                if (['For', 'While', 'Block'].includes(st.type)) scan(st.body);
            }
        };
        scan(fn.body);
        functionLocalHandles.set(fn, handles);
        const scanCallbacks = body => {
            for (const st of body || []) {
                const call = st.type === 'ExpressionStatement' && st.expr?.type === 'Call' ? st.expr : null;
                if (call?.callee?.type === 'Member' && call.callee.name === 'onDestroyed' &&
                    call.callee.object?.type === 'Identifier' && handles.has(call.callee.object.name) &&
                    call.args?.[0]?.type === 'FunctionExpression') {
                    const token = `__bwFunctionDestroyed${functionDestructionCallbacks.length + 1}`;
                    t.destroyedInstanceHandlers.set(call, token);
                    functionDestructionCallbacks.push({token, body: call.args[0].body, locals});
                }
                if (st.type === 'If') { scanCallbacks(st.consequent); scanCallbacks(st.alternate); }
                if (['For', 'While', 'Block'].includes(st.type)) scanCallbacks(st.body);
            }
        };
        scanCallbacks(fn.body);
    }
    const callbackProjectileScopes = new Map();
    for (const st of ast.body) {
        const call = st.type === 'ExpressionStatement' && st.expr?.type === 'Call' ? st.expr : null;
        if (!call) continue;
        for (const handler of call.args || []) {
            if (handler?.type !== 'FunctionExpression') continue;
            const locals = new Set();
            const handles = new Set();
            const collectLocals = body => {
                for (const item of body || []) {
                    if (item.type === 'Declaration') for (const decl of item.decls) locals.add(decl.name);
                    if (item.type === 'If') { collectLocals(item.consequent); collectLocals(item.alternate); }
                    if (['For', 'While', 'Block'].includes(item.type)) collectLocals(item.body);
                }
            };
            collectLocals(handler.body);
            const collectProjectiles = body => {
                for (const item of body || []) {
                    if (item.type === 'Declaration') for (const decl of item.decls) {
                        if (registerProjectile(decl.init, `${t.path(call.callee)} callback`)) {
                            handles.add(decl.name);
                        }
                    }
                    const assignment = item.type === 'ExpressionStatement' && item.expr?.type === 'Assignment' &&
                        item.expr.op === '=' && item.expr.left?.type === 'Identifier' ? item.expr : null;
                    if (assignment && locals.has(assignment.left.name) &&
                        registerProjectile(assignment.right, `${t.path(call.callee)} callback`)) {
                        handles.add(assignment.left.name);
                    }
                    if (item.type === 'If') {
                        collectProjectiles(item.consequent);
                        collectProjectiles(item.alternate);
                    }
                    if (['For', 'While', 'Block'].includes(item.type)) collectProjectiles(item.body);
                }
            };
            collectProjectiles(handler.body);
            if (handles.size) callbackProjectileScopes.set(handler.body, {locals, handles});
        }
    }

    // Frames become costumes on the sprite they were attached to. An
    // animation nothing attached has no home here, so it is reported.
    const framesTaken = new Map();
    let hasAnimationFrames = false;
    for (const [variable, animation] of animations) {
        if (!animation.frames.length) continue;
        if (!animation.sprite) {
            t.unsupported.push(`animation ${variable} — attached to no sprite, so its frames have no home`);
            continue;
        }
        for (const [index, svg] of animation.frames.entries()) {
            const taken = framesTaken.get(animation.sprite) || 0;
            if (taken >= MAX_ANIMATION_FRAMES) {
                t.unsupported.push(
                    `animation frames for ${animation.sprite} past ${MAX_ANIMATION_FRAMES} — ` +
                    'the rest are not carried over');
                break;
            }
            framesTaken.set(animation.sprite, taken + 1);
            hasAnimationFrames = true;
            costumes.push({
                sprite: animation.sprite,
                name: `${variable}-${index + 1}`,
                svg,
                mode: 'add'
            });
        }
    }
    if (hasAnimationFrames) {
        t.unsupported.push(
            'animation.setAction() — the frames arrive as costumes, but Scratch has no named ' +
            'animation with its own timer, and one ActionKind here covers several animations');
    }
    for (const st of ast.body) {
        if (st.type === 'ExpressionStatement' && st.expr.type === 'Call') {
            for (const arg of st.expr.args || []) {
                if (arg.type === 'FunctionExpression') walkForSprites(arg.body);
            }
        }
    }

    if (!t.sprites.length) t.sprites.push({name: 'Game', kind: 'Player', velocity: false, scriptHost: true});

    /** Where ownerless scripts and top-level setup go — never the backdrop. */
    const mainSprite = t.sprites.find(s => !s.backdrop) || t.sprites[0];

    // ── pass 2: scripts, each landing on the sprite it talks about
    /** name → array of script line-blocks */
    const scriptsFor = new Map(t.sprites.map(s => [s.name, []]));
    const setup = [];
    // Pass-one probes (including enum bookkeeping into discarded output) must
    // not register resources. Only the actual script/procedure emission does.
    t.planImageValue = collectImageValue;

    /** Which sprite a body is about: the first one it mentions. */
    const ownerOf = body => {
        let found = null;
        const visit = node => {
            if (!node || found || typeof node !== 'object') return;
            if (node.type === 'Identifier' && t.sprite(node.name)) {
                found = t.sprite(node.name);
                return;
            }
            for (const value of Object.values(node)) {
                if (Array.isArray(value)) value.forEach(visit);
                else if (value && typeof value === 'object') visit(value);
            }
        };
        body.forEach(visit);
        return found || mainSprite;
    };

    /**
     * @param {object} owner the sprite this script lives on
     * @param {Array<string>} header the lines above the body
     * @param {Array} body statements
     * @param {object} [options]
     * @param {number} [options.indent] nesting depth of the body — NOT
     *   header.length, because a header line can be a comment or a `wait`
     *   rather than a level of nesting.
     */
    const emitScript = (owner, header, body, {aliases = {}, indent = header.length} = {}) => {
        t.self = owner;
        t.aliases = new Map(Object.entries(aliases));
        const projectileScope = callbackProjectileScopes.get(body);
        if (projectileScope) {
            t.localVars = projectileScope.locals;
            t.localHandleVars = projectileScope.handles;
        }
        const lines = [...header];
        t.block(body, indent, lines);
        scriptsFor.get(owner.name).push(lines);
        t.self = null;
        t.aliases = new Map();
        t.localVars = null;
        t.localHandleVars = new Set();
    };

    for (const st of ast.body) {
        if (st.type === 'Enum' || st.type === 'FunctionDeclaration' || sharedImageTransport?.declarations.has(st)) continue;
        const call = st.type === 'ExpressionStatement' && st.expr.type === 'Call' ? st.expr : null;
        const name = call ? t.path(call.callee) : null;
        const handler = call ? (call.args || []).find(arg => arg.type === 'FunctionExpression') : null;

        if (name === 'game.onUpdate' && handler) {
            const owner = ownerOf(handler.body);
            emitScript(owner, ['WHEN arcade updates:'], handler.body, {indent: 1});
            continue;
        }
        if (name === 'forever' && handler) {
            emitScript(ownerOf(handler.body), ['WHEN flag clicked:', '  FOREVER:'], handler.body);
            continue;
        }
        if (name === 'game.onUpdateInterval' && handler) {
            const owner = ownerOf(handler.body);
            const period = call.args[0]?.type === 'Number' ? Number(call.args[0].value) : NaN;
            if (!Number.isFinite(period) || period <= 0) {
                t.unsupported.push('game.onUpdateInterval() period must be a positive constant');
                continue;
            }
            emitScript(owner, [`WHEN arcade every ${num(period)} ms:`], handler.body, {indent: 1});
            continue;
        }
        if (name === 'sprites.onOverlap' && handler) {
            // The handler's two parameters are "me" and "the other one";
            // in Scratch that is this sprite and a `touching` test.
            const mine = t.sprites.find(s => s.kind === kindOf(call.args[0])) || mainSprite;
            const other = t.sprites.find(s => s.kind === kindOf(call.args[1]));
            const params = handler.params || [];
            const aliases = {};
            if (params[0]) aliases[params[0]] = mine.name;
            if (params[1] && other) aliases[params[1]] = other.name;
            const target = other ? other.name : kindOf(call.args[1]);
            emitScript(mine, [
                `# sprites.onOverlap(${kindOf(call.args[0])}, ${kindOf(call.args[1])})`,
                'WHEN flag clicked:',
                '  FOREVER:',
                `    IF touching ${target} THEN:`
            ], handler.body, {aliases, indent: 3});
            continue;
        }
        if (name === 'sprites.onDestroyed' && handler) {
            const owner = ownerOf(handler.body);
            t.handleAliases = new Map(handler.params?.[0] ? [[handler.params[0], 'arcade event first']] : []);
            emitScript(owner, [`WHEN arcade kind "${kindOf(call.args[0])}" destroyed:`], handler.body, {indent: 1});
            t.handleAliases = new Map();
            continue;
        }
        if (name === 'controller.moveSprite') {
            const owner = t.resolveSprite(call.args[0]) || mainSprite;
            const vx = call.args[1] ? Math.round((Number(call.args[1].value) || 100) / 20) : 5;
            const vy = call.args[2] ? Math.round((Number(call.args[2].value) || 0) / 20) : 0;
            const lines = ['# controller.moveSprite — the arrow keys, at the same speed',
                'WHEN flag clicked:', '  FOREVER:'];
            if (vx) {
                lines.push('    IF key right arrow pressed? THEN:', `      change x by ${vx}`);
                lines.push('    IF key left arrow pressed? THEN:', `      change x by 0 - ${vx}`);
            }
            if (vy) {
                lines.push('    IF key up arrow pressed? THEN:', `      change y by ${vy}`);
                lines.push('    IF key down arrow pressed? THEN:', `      change y by 0 - ${vy}`);
            }
            scriptsFor.get(owner.name).push(lines);
            continue;
        }
        if (/^controller\.(\w+)\.on(Event|Pressed)$/.test(name || '') && handler) {
            const button = /^controller\.(\w+)\./.exec(name)[1];
            const key = CONTROLLER_KEYS[button] || 'space';
            const owner = ownerOf(handler.body);
            emitScript(owner, [`WHEN ${key} key pressed:`], handler.body);
            continue;
        }
        if (name === 'info.onCountdownEnd' && handler) {
            emitScript(ownerOf(handler.body), ['WHEN arcade countdown ends:'], handler.body);
            continue;
        }
        // Wait for a positive life count before detecting zero. This keeps
        // an event-only snippet from firing at Scratch's initial zero and
        // allows a callback that grants another life to arm again.
        if ((name === 'info.onLifeZero' || /^info\.player\d\.onLifeZero$/.test(name || '')) && handler) {
            const variable = playerVar('lives', playerOf(name));
            const owner = ownerOf(handler.body);
            const lines = [
                `# ${name} — fires when lives fall to zero.`,
                'WHEN flag clicked:',
                '  FOREVER:',
                `    wait until ${variable} > 0`,
                `    wait until ${variable} < 1`
            ];
            t.self = owner;
            t.block(handler.body, 2, lines);
            t.self = null;
            scriptsFor.get(owner.name).push(lines);
            continue;
        }

        if (name === 'scene.setBackgroundImage') continue;    // handled in pass 1
        if (name === 'scene.setBackgroundColor' || name === 'image.setPalette') {
            t.statement(st, 1, setup);
            continue;
        }
        if (name === 'tiles.setTilemap' || name === 'scene.setTileMapLevel') continue;
        if (name && /^(tiles|scene)\.(set|place)/.test(name)) {
            t.unsupported.push(`${name}() — tilemaps have no stage equivalent`);
            continue;
        }

        // A declaration that creates a sprite was consumed by pass 1;
        // re-emitting it would be a variable set to a sprite that is
        // already a sprite.
        if (st.type === 'Declaration') {
            // Drop both `let ball = sprites.create(...)` and the
            // `let ball: Sprite = null` that MakeCode hoists above it:
            // pass 1 already made `ball` a sprite, and a variable of the
            // same name beside it would only confuse the reader.
            const remaining = st.decls.filter(d => !t.sprite(d.name) &&
                !(d.init && d.init.type === 'Call' && t.path(d.init.callee) === 'sprites.create'));
            if (!remaining.length) continue;
            t.self = mainSprite;
            t.statement({type: 'Declaration', kind: st.kind, decls: remaining}, 1, setup);
            t.self = null;
            continue;
        }
        if (st.type === 'ExpressionStatement' && st.expr.type === 'Assignment' &&
            st.expr.right && st.expr.right.type === 'Call' &&
            t.path(st.expr.right.callee) === 'sprites.create') {
            continue;
        }

        // Anything else at the top level is setup, and runs on the sprite
        // it concerns.
        t.self = mainSprite;
        t.statement(st, 1, setup);
        t.self = null;
    }

    // Velocity becomes a motion loop, once per sprite that has one.
    for (const sprite of t.sprites) {
        if (!sprite.velocity) continue;
        scriptsFor.get(sprite.name).push([
            '# sprite.vx / vy — Arcade integrates these every frame',
            'WHEN flag clicked:',
            '  FOREVER:',
            `    change x by ${sprite.name}_vx / ${VELOCITY_DIVISOR}`,
            `    change y by 0 - ${sprite.name}_vy / ${VELOCITY_DIVISOR}`
        ]);
    }

    // ── assemble
    const out = [];
    out.push('DEVICE ARCADE', '');
    if(t.referenceArrayProgram || t.fontValueProgram || t.throwValueProgram){
        const globals=ast.body.filter(st=>st.type==='Declaration' && !sharedImageTransport?.declarations.has(st)).flatMap(st=>st.decls)
            .filter(decl=>!decl.temporary && !t.sprite(decl.name) && !(decl.init?.type==='Call' && t.path(decl.init.callee)==='sprites.create'));
        out.push(...globals.map(decl=>`GLOBAL ${t.varName(decl.name)}`),'');
    }
    if (opts.name) out.push(`# Imported from MakeCode Arcade: ${opts.name}`);
    out.push('# Arcade is 160x120 with y downwards; the stage is 480x360 centred,',
        `# so positions are scaled x${SCALE} and y is mirrored.`, '');
    // `change x by …` below IS the motion block, on purpose. A program's own
    // variable called `x` is a different thing and cannot keep the name.
    const renames = t.renameNotes();
    if (renames.length) out.push(...renames, '');

    // Destruction callbacks of function-made sprites: their scripts went
    // after the functions, i.e. on the last sprite, and still do.
    const lastSprite = t.sprites[t.sprites.length - 1];
    const callbackLines = [];
    for (const callback of functionDestructionCallbacks) {
        const referencesLocal = node => {
            if (!node || typeof node !== 'object') return false;
            if (node.type === 'Identifier' && callback.locals.has(node.name)) return true;
            return Object.values(node).some(value => Array.isArray(value) ?
                value.some(referencesLocal) : referencesLocal(value));
        };
        if (callback.body.some(referencesLocal)) {
            t.unsupported.push('sprite.onDestroyed() callback captures a function local');
        }
        callbackLines.push(`WHEN arcade destruction handler "${callback.token}" runs:`);
        t.block(callback.body, 1, callbackLines);
        callbackLines.push('');
    }

    /**
     * A Scratch procedure belongs to ONE sprite: a script on another sprite
     * that calls it finds no such block (a command does nothing, a reporter
     * gives 0). So a function is defined on every sprite with a script that
     * calls it, directly or through another function (E10), each copy
     * translated as that sprite (`self`). One nobody calls stays on the
     * sprite whose setup runs the program. They used to land after the last
     * sprite, whatever called them.
     */
    const translateFunction = (fn, owner) => {
        const signature = fn.params && fn.params.length ?
            `${fn.name} ${fn.params.map(p => `(${t.varName(p)})`).join(' ')}` : fn.name;
        const lines = [`DEFINE ${signature}:`];
        lines.push(...(procedureConstraints?.prefix(fn,fn.name+(fn.params||[]).map(()=> ' %s').join(''),name=>t.varName(name)) || []));
        const collectLocals = body => {
            for (const st of body || []) {
                if (st.type === 'Declaration') for (const decl of st.decls) t.localVars.add(decl.name);
                if (st.type === 'For' && st.init?.type === 'Declaration') for (const decl of st.init.decls) t.localVars.add(decl.name);
                if (st.type === 'If') { collectLocals(st.consequent); collectLocals(st.alternate); }
                if (['For', 'While', 'Block'].includes(st.type)) collectLocals(st.body);
            }
        };
        t.localVars = new Set();
        t.currentParameters = new Set(fn.params || []);
        collectLocals(fn.body);
        for (const param of fn.params || []) t.localVars.delete(param);
        t.localHandleVars = functionLocalHandles.get(fn) || new Set();
        t.self = owner;
        t.block(fn.body, 1, lines);
        t.self = null;
        t.currentParameters = null;
        t.localVars = null;
        return lines;
    };
    const escaped = name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // The functions these lines call: a command line starting with the name,
    // or the reporter `arcade call function "name …"`.
    const calledIn = lines => t.functions.filter(fn => {
        const name = escaped(fn.name);
        const command = new RegExp(`^\\s*(?:CALL:?\\s+(?:\\(\\s*)?)?${name}(?:\\s|\\)|$)`), reporter = new RegExp(`arcade call function "${name}(?:\\s|")`);
        return lines.some(line => command.test(line) || reporter.test(line));
    });
    const definesFor = new Map(t.sprites.map(s => [s.name, []]));
    const defined = new Set();
    const markProcedureEmitted = createProcedureOwnerEmission();
    const defineOn = (sprite, roots) => {
        const queue = [...roots];
        while (queue.length) {
            const fn = queue.shift();
            if (!markProcedureEmitted(sprite, fn)) continue;
            defined.add(fn);
            const lines = translateFunction(fn, sprite);
            definesFor.get(sprite.name).push(lines);
            queue.push(...calledIn(lines));
        }
    };
    t.sprites.forEach(sprite => {
        const lines = [...(sprite === mainSprite ? setup : []), ...scriptsFor.get(sprite.name).flat(),
            ...(sprite === lastSprite ? callbackLines : [])];
        defineOn(sprite, calledIn(lines));
    });
    // Functions only a translation added (a specialised copy) are found the
    // same way; any still undefined go on the setup sprite.
    for (let fn; (fn = t.functions.find(f => !defined.has(f)));) defineOn(mainSprite, [fn]);

    t.sprites.forEach(sprite => {
        out.push(`SPRITE ${sprite.name}:`);
        const scripts = scriptsFor.get(sprite.name);
        if (sprite === mainSprite && setup.length) {
            out.push('WHEN flag clicked:');
            if (sprite.scriptHost) out.push('  hide');
            out.push(...setup, '');
        }
        for (const script of scripts) out.push(...script, '');
        if (sprite.backdrop) {
            out.push('WHEN flag clicked:', '  go to x: 0 y: 0', '  go to back');
            out.push('  show', '');
        } else if (!scripts.length && !(sprite === mainSprite && setup.length)) {
            out.push('WHEN flag clicked:', '  show', '');
        }
        for (const lines of definesFor.get(sprite.name)) out.push(...lines, '');
        if (sprite === lastSprite) out.push(...callbackLines);
    });

    for (const template of t.projectileTemplates.values()) {
        out.push(`SPRITE ${template.name}:`, 'WHEN flag clicked:', '  hide', '');
    }

    // Only actual emitted value expressions register generic artwork. A
    // diagnostic-only class body cannot leave an unreferenced actor on export.
    costumes.push(...imageValueCostumes);
    const imageTemplates = [...new Set(imageValueCostumes.map(costume => costume.sprite))];
    for (const name of imageTemplates)
        out.push(`SPRITE ${name}:`, 'WHEN flag clicked:', '  hide', '');

    return withAnimationDiagnostics({
        sourceReferences:(ast.sourceReferenceDeclarations || sourceReferenceDeclarations(ast)).map(({name,type})=>({name:t.varName(name),type})),sourceScalars:sourceScalarDeclarations(ast).map(({name,type})=>({name:t.varName(name),type})),
        code: `${out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`,
        unsupported: [...new Set(t.unsupported)],
        costumes, artworkNames,
        sprites: [...t.sprites.map(s => s.name), ...[...t.projectileTemplates.values()].map(t => t.name), ...imageTemplates]
    });
}

export default arcadeToPseudocode;
