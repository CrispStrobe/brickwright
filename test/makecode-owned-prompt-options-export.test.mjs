import test from 'node:test';import assert from 'node:assert/strict';
import {SB3Creator} from './helpers/bw-vm.mjs';import {projectToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
const code=`DEVICE ARCADE
GLOBAL answer
SPRITE Game:
WHEN arcade source starts:
  set answer to (arcade call function "first %s" arguments (arcade function argument (arcade ask text "Grade" length 2) rest ("[]")))
DEFINE first (s):
  declare arcade procedure "first %s" parameter "s" as String
  arcade return value (letter 1 of (arcade local s))`;
const exported=source=>{const creator=new SB3Creator();creator.parse(source);assert.deepEqual(creator.warnings,[]);return projectToArcade(creator.project)};
test('bounded text prompt has actual export String producer and retains explicit SDK length',()=>{const out=exported(code);assert.deepEqual(out.unsupported,[]);assert.match(out.ts,/game\.askForString\("Grade", 2\)/);});
test('edited or opaque option inputs never acquire export String authority',()=>{for(const value of ['4','0','("2")','(new array reference from ("[2]"))']){const out=exported(code.replace('length 2','length '+value));assert.ok(out.unsupported.some(x=>/literal String question and length|requires String/.test(x)),value);}});
