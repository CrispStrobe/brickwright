'use strict';
// Arcade palette structure. Presentation only: opcodes, argument names and the extension id
// are untouched, so saved projects, the MakeCode importer/exporter and the sb3-creator
// dialect keep working. `arrange` takes the finished getInfo() and
//   - orders the blocks in MakeCode Arcade's own toolbox order (Sprites, Controller, Game,
//     Music, Scene, Tilemap, Info, Animation, Images, Physics, Extensions, Advanced), with
//     '---' between MakeCode's `//% group=` clusters;
//   - gives every section a label, and every section but the first its own entry in the
//     category rail (a `label` with `subcategory`, see scripts/lib/palette-hooks.mjs);
//   - shows the basic blocks of a section and hides the rest behind a per-section
//     "show more" button (hideFromPalette: the blocks stay registered, so scripts, import,
//     the Code tab and saved projects still load and run);
//   - hides pure duplicates of a generic block (HIDDEN_ALIASES) the same way;
//   - hides importer plumbing (source-start hats, declarations, registered-handler pairs,
//     externals, callables and classes) from the palette for good.
// Which blocks are basic mirrors MakeCode's non-advanced, high-`weight` blocks per namespace.

const STORAGE_KEY = 'bw.arcade.palette.more';
const words = text => text.trim().split(/\s+/);

// Never offered in the palette: the importer emits these (token/capture plumbing, source
// declarations, external references, callables and classes); a learner has no use picking them.
const PLUMBING = new Set(words(`
  whenSourceStarts declareSourceReference declareParameterConstraint declareSourceScalar sourceWhile
  sourceValueBinary sourceValueUnary sourceTypeOf inspectValue addLiteralDrawing
  startParallelHandler whenParallelHandler registerForeverHandler whenRegisteredForever
  registerCountdownHandler whenRegisteredCountdown registerLifeZeroHandler whenRegisteredLifeZero
  registerScoreHandler whenRegisteredScore registerUpdateHandler whenRegisteredUpdate
  registerPaintHandler whenRegisteredPaint registerShadeHandler whenRegisteredShade
  registerIntervalHandler whenRegisteredInterval
  externalValue externalImage externalImageCall externalCall externalCommand registerExternalHandler whenRegisteredExternal
  allocateControlEventSource controllerEventSource registerMultiplayerConnection
  whenRegisteredMultiplayerConnection registerControlEvent whenRegisteredControlEvent
  registerMultiplayerButtonHandler whenRegisteredMultiplayerButton registerButtonHandler registerPlayerButtonHandler whenRegisteredButton
  registerInstanceOverlapHandler whenRegisteredInstanceOverlap
  registerInstanceDestroyedHandler whenRegisteredInstanceDestroyed registerDestroyedHandler
  whenRegisteredKindDestroyed registerOverlapHandler whenRegisteredOverlap
  registerScenePushHandler whenRegisteredScenePush registerScenePopHandler whenRegisteredScenePop
  registerSpriteCreated registerSpriteDestroyed whenRegisteredCreated whenRegisteredDestroyed
  registerLegacyWallHandler whenRegisteredLegacyWall registerWallHandler registerTileHandler
  whenRegisteredWall whenRegisteredTile registerTilemapEvent unregisterTilemapEvent whenRegisteredTilemapEvent
  eventTilemapData
  createPlayerState bindSpriteKind initializeSpriteKindLibrary
  declareSubclass declareClass createObject objectField setObjectField callObjectMethod
  functionArgument callFunction declareSourceCallable declareCallable createCallable callCallable
  whenCallableDispatched runCallableDispatch returnValue throwValue setLocal getLocal getCaptured setCaptured
`));

// Pure duplicates: each is a fixed-argument form of a block that stays in the palette, and runs
// through it (or, for the legacy micro:bit blocks, through the player-1 form). They stay registered
// so saved projects, the Code tab and the MakeCode importer/exporter keep using them, but they are
// not offered. Covered by:
//   setSpriteStayInScreen/AutoDestroy/BounceOnWall/GhostThroughSprites -> setSpriteFlag [FLAG] [ON]
//   setscore/changescore/getscore -> setPlayerScore/changePlayerScore/getPlayerScore (player 1)
//   gameover -> gameOver; countdown -> startCountdown
//   truncateNumber/signNumber -> mathUnary [OP] (truncate|sign), the unary twin of mathBinary
//   playMusic -> play [PLAYABLE] [MODE]; playSoundEffect -> play with the sound-effect playable (same modes);
//   playMelody/playSound (the deprecated Melody and note-string forms) -> play with melodyPlayable/stringPlayable
const HIDDEN_ALIASES = new Set(words(`
  setSpriteStayInScreen setSpriteAutoDestroy setSpriteBounceOnWall setSpriteGhostThroughSprites
  setscore changescore getscore gameover countdown
  truncateNumber signNumber playMusic playMelody playSoundEffect playSound
`));

// id, English name, German name, basic blocks, more blocks.
const SECTIONS = [
  ['sprites', 'Sprites', 'Figuren',
    // Create / Physics / Effects / Projectiles / Overlaps
    words(`createImageSprite setSpritePosition setSpriteProperty spriteProperty spriteSay destroySprite
      spawnProjectile whenSpritesOverlap eventSprite setSpriteImage`),
    words(`createSprite createOwnedImageSprite spawnSprite spawnImageSprite ---
      followSprite unfollowSprite --- spriteImage setSpriteCostume ---
      startSpriteEffect clearSpriteEffects destroySpriteWithEffect --- spawnImageProjectile ---
      spriteOverlaps setSpriteKind spritesOfKind withoutNullSprites spriteCount createSpriteKind spriteKindValue spriteToString ---
      whenSpriteCreated whenSpriteDestroyed --- setSpriteScale changeSpriteScale setSpriteScaleCore ---
      textSpriteCreate textSpriteSetText textSpriteSetMaxFontHeight textSpriteSetIcon textSpriteSetBorder
      textSpriteSetOutline textSpriteUpdate textSpriteProperty textSpriteSetProperty`)],
  ['controller', 'Controller', 'Steuerung',
    words('whenButton buttonPressed playerButtonPressed controlSprite controllerStep'),
    words(`controlSpriteByController stopControllingSprite --- playerConnected eventPlayer playerLookup allPlayers
      playerSprite setPlayerSprite playerBySprite playerProperty getPlayerState setPlayerState changePlayerState
      movePlayerWithButtons --- setControllerConnected setUserEventsEnabled waitAnyButton ---
      buttonRepeatProperty setButtonRepeatProperty setButtonRepeatDefaults --- lightLevel tilt setPixel clearPixels`)],
  ['game', 'Game', 'Spiel',
    words('whenUpdate whenInterval gameOver resetGame splash ask askForNumber askForNumberLength askForString programMillis'),
    words(`setGameOverEffect setGameOverMessage setGameOverPlayable setGameOverScoringType legacyGameOver ---
      showLongText askForStringLength --- sceneMillis frameDeltaTime setGameStats --- carnivalCountdown carnivalGameOver carnivalCustomGameOver carnivalAddLabel`)],
  ['music', 'Music', 'Musik',
    words('play playTone ringTone rest setMusicVolume setTempo changeTempo stopAllSounds'),
    words(`playNoteMelody melodyPlayable stringPlayable tonePlayable songPlayable
      songFromBuffer namedSongPlayable soundEffect namedMelody soundMelody beat --- musicVolume musicTempo`)],
  ['scene', 'Scene', 'Szene',
    words(`setBackgroundColor setBackgroundImage backgroundColor backgroundImage cameraFollowSprite centerCameraAt
      cameraShake startScreenEffect endScreenEffect`),
    words(`cameraProperty cameraDrawOffset --- setBackgroundScrollVersion scrollBackgroundWithCamera
      scrollBackgroundWithSpeed setBackgroundScrollMultipliers setBackgroundScrollOffset setBackgroundLayerImage
      setBackgroundLayerZ backgroundScrollOffset --- pushScene popScene`)],
  ['tiles', 'Tilemap', 'Kacheln',
    words(`setTilemap placeOnTile placeOnRandomTile setTileAt setWallAt tileLocation tileIs tileIsWall isHittingTile
      spriteTileKindAt`),
    words(`tilesOfType tileLocationProperty tileAtLocation tileNeighbor spriteTileLocation randomTileOfType eventLocation ---
      tilemapValue tilemapProperty tilemapTile tilemapIsWall tilemapTileImage tilemapTileset setTilemapTile setTilemapWall setTilemapScale ---
      tileLocationTilemap sceneTilemapProperty ---
      setLegacyTilemap setLegacyTile
      legacyTileLocation legacyTilesOfType legacyTileProperty setLegacyTileAt placeOnLegacyTile
      placeOnRandomLegacyTile tileHitFrom`)],
  ['info', 'Info', 'Info',
    words(`getPlayerScore setPlayerScore changePlayerScore getLife setLife changeLife startCountdown stopCountdown
      whenCountdownEnds`),
    words('hasPlayerScore highScore hasLife setHudVisibility')],
  ['animation', 'Animation', 'Animation',
    words('runImageAnimation stopAnimation createAnimation addAnimationFrame attachAnimation setAnimationAction'),
    words(`setAnimationInterval animationProperty animationAssetFrames animationAssetFreshFrames
      animationAssetInterval frameImage --- setCharacterAnimationVersion characterFrames
      setCharacterAnimationsEnabled setCharacterState clearCharacterState setCharacterController
      lockCharacterFacing unlockCharacterFacing characterRule characterRuleToString characterMatchesRule`)],
  ['images', 'Images', 'Bilder',
    words('screenImage createImage cloneImage setImagePixel imagePixel imageProperty drawImage'),
    words(`imageEquals imagesOverlap copyImageFrom scrollImage mutateImage drawImageCircle blitImage ---
      mutateSpriteImage setSpritePixel spritePixel drawSpriteCircle drawSpriteImage ---
      printImageText printImageFont printImageFontCenter fontValue fontForText scaleFont fontMetric ---
      setPalette startImageEffect`)],
  ['physics', 'Physics', 'Physik',
    words('setSpriteFlag physicsEngineProperty setPhysicsEngineProperty sceneFlags setSceneFlags'),
    words(`currentScene scenePhysicsEngine createPhysicsEngine setScenePhysicsEngine`)],
  ['extensions', 'Extensions', 'Erweiterungen',
    words('createCorgi corgiControl corgiBark createDart dartAction sevensegCounter sevensegDigit'),
    words(`corgiAddPhrase setCorgiProperty corgiProperty --- dartSwitch setDartProperty dartProperty ---
      sevensegSetCharacter sevensegSetColor sevensegSetRadix sevensegSetScale sevensegSetProperty
      sevensegAddDigit sevensegProperty`)],
  ['advanced', 'Advanced', 'Erweitert',
    words('randomNumber percentChance clampNumber mathBinary mathUnary settingsWrite settingsRead'),
    words(`parseInteger parseIntegerRadix --- settingsExists settingsRemove settingsClear ---
      spriteDataSet spriteDataRead spriteDataReadBoolean spriteDataChange --- raiseControlEvent waitControlEvent ---
      createBuffer bufferFromHex bufferFromUTF8 bufferLiteral bufferFromBase64 bufferFromArray bufferLength
      bufferIsReadOnly bufferConcat bufferEquals bufferHash bufferIndexOf bufferGetByte bufferSetByte
      bufferChunked bufferChunkedFromUTF8 bufferPackedSize bufferPack bufferUnpack bufferPackAt bufferToArray
      bufferConcatArray bufferFormatSize bufferGetNumber bufferSetNumber bufferSlice bufferWrite bufferFill
      bufferShift bufferRotate bufferToBase64 bufferToHex bufferToText ---
      createsprite deletesprite movesprite setspritepos spritex spritey touching touchingedge
      showscore log drawsprites clearscreen setbrightness`)]
];

const LABELS = {
  en: {more: (name, count) => `Show more ${name} blocks (${count})`, fewer: name => `Show fewer ${name} blocks`},
  de: {more: (name, count) => `Mehr Blöcke zeigen: ${name} (${count})`, fewer: name => `Weniger Blöcke zeigen: ${name}`}
};

const escapeXml = text => String(text).replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
// A flyout label; a `subcategory` one first closes the running <category> and opens a sibling, which the
// category rail shows as its own entry (the runtime splits on the marker, see scripts/lib/palette-hooks.mjs).
const labelBlock = (info, title, subcategory) => {
  const text = escapeXml(title);
  const open = subcategory ? `</category><!--s--><category name="${text}" id="${info.id}_${subcategory}" colour="${info.color1}" secondaryColour="${info.color2}">` : '';
  // The flyout already prints a sub-category's own name as its header; only the first section needs a label.
  return {blockType: 'label', text: title, xml: `${open}${subcategory ? '' : `<label text="${text}"></label>`}`};
};
const readStorage = storage => {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY));
    return new Set(Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : []);
  } catch (error) { return new Set(); }
};
const writeStorage = (storage, open) => {
  try { storage.setItem(STORAGE_KEY, JSON.stringify([...open])); } catch (error) { /* private window or blocked storage */ }
};
const defaultStorage = () => { try { return globalThis.localStorage; } catch (error) { return null; } };

// Sections the learner expanded, kept across getInfo() calls and (through localStorage) sessions.
let expanded = null;
const openSections = storage => {
  if (!expanded) expanded = storage ? readStorage(storage) : new Set();
  return expanded;
};

// The GUI's language (format-message is what vm.setLocale sets); the document language otherwise.
const localeOf = () => {
  let locale = '';
  try { locale = require('format-message').setup().locale; } catch (error) { /* no format-message here */ }
  if (!locale) { try { locale = globalThis.document.documentElement.lang; } catch (error) { /* headless */ } }
  return String(locale || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
};

/**
 * Reorder `info.blocks` in place into labelled sections and hide the plumbing and the collapsed
 * "more" blocks. `host` receives the toggle (it needs `runtime.requestToolboxExtensionsUpdate`).
 */
function arrange (host, info, storage = defaultStorage()) {
  const byOpcode = new Map();
  for (const block of info.blocks) if (block && typeof block === 'object' && block.opcode) byOpcode.set(block.opcode, block);
  const placed = new Set();
  const open = openSections(storage);
  const locale = localeOf();
  const text = LABELS[locale];
  const out = [], hidden = [];
  const take = (names, visible, into) => {
    let separator = false;
    for (const name of names) {
      if (name === '---') { separator = true; continue; }
      const block = byOpcode.get(name);
      if (!block || placed.has(name)) continue;
      placed.add(name);
      if (separator && visible && into.length && typeof into[into.length - 1] === 'object') into.push('---');
      separator = false;
      if (!visible) block.hideFromPalette = true;
      into.push(block);
    }
  };
  // Blocks the table does not know yet (a newer opcode) land in the last section's "more".
  const unlisted = [...byOpcode.keys()].filter(name => !PLUMBING.has(name) && !HIDDEN_ALIASES.has(name) &&
    !SECTIONS.some(section => section[3].includes(name) || section[4].includes(name)));
  SECTIONS.forEach(([id, name, german, basic, more], index) => {
    const title = locale === 'de' ? german : name;
    const extra = index === SECTIONS.length - 1 ? [...more, ...unlisted] : more;
    const count = extra.filter(opcode => opcode !== '---' && byOpcode.has(opcode)).length;
    out.push(labelBlock(info, title, index === 0 ? null : id));
    take(basic, true, out);
    if (!count) return;
    const isOpen = open.has(id);
    out.push({
      blockType: 'button', func: `ARCADE_PALETTE_${id}`,
      text: isOpen ? text.fewer(title) : text.more(title, count),
      callback: () => {
        if (open.has(id)) open.delete(id); else open.add(id);
        writeStorage(storage, open);
        (host._runtime || host.runtime)?.requestToolboxExtensionsUpdate?.();
      }
    });
    take(extra, isOpen, out);
  });
  // The plumbing and the hidden aliases stay registered (the importer and saved projects use them) but never show.
  for (const name of [...PLUMBING, ...HIDDEN_ALIASES]) {
    const block = byOpcode.get(name);
    if (block && !placed.has(name)) { block.hideFromPalette = true; hidden.push(block); }
  }
  info.blocks = out.concat(hidden);
  return info;
}

module.exports = {arrange, PLUMBING, HIDDEN_ALIASES, SECTIONS, STORAGE_KEY, resetForTests: () => { expanded = null; }};
