import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMakeCodeTs, tokenize} from '../overlay/scratch-gui/src/lib/bw-makecode/ts-import.js';
import {lowerObjectClasses} from '../overlay/scratch-gui/src/lib/bw-makecode/lower-object-classes.js';

test('type remains a contextual token while parameters and their uses are identifiers', () => {
    assert.equal(tokenize('type')[0].type, 'type');
    const fn = parseMakeCodeTs('function shift(type:number){return type+1}').body[0];
    assert.deepEqual(fn.params, ['type']);
    assert.equal(fn.paramTypes.type.text, 'number');
    assert.deepEqual(fn.body[0].value.left, {type:'Identifier', name:'type'});
});

test('type declarations retain the following variable and expression statements', () => {
    const body = parseMakeCodeTs('type Count=number;let type:Count=1;type+=2;let next=type;').body;
    assert.deepEqual(body.map(node => node.type), ['Declaration','ExpressionStatement','Declaration']);
    assert.equal(body[0].decls[0].name, 'type');
    assert.equal(body[0].decls[0].typeName, 'Count');
    assert.equal(body[1].expr.left.name, 'type');
    assert.equal(body[1].expr.op, '+=');
    assert.equal(body[2].decls[0].init.name, 'type');
});

test('arrow and function expression type formals keep defaults and body references', () => {
    for (const expression of ['(type:number=2)=>type+1','function(type:number=2){return type+1}']) {
        const fn = parseMakeCodeTs(`let transform=${expression};`).body[0].decls[0].init;
        assert.equal(fn.type, 'FunctionExpression');
        assert.deepEqual(fn.params, ['type']);
        assert.equal(fn.params.parameterDefaults[0].name, 'type');
        assert.equal(fn.body.at(-1).value.left.name, 'type');
    }
});

test('readonly fields named type retain the modifier and constructor assignment', () => {
    const program = parseMakeCodeTs('class Holder{readonly type:number;constructor(kind:number){this.type=kind}read(){return this.type}}let holder=new Holder(2);');
    const cls = program.body[0];
    assert.deepEqual(cls.fields.map(field => [field.name,field.modifiers]), [['type',['readonly']]]);
    assert.deepEqual(lowerObjectClasses(program).unsupported, []);
});

test('readonly parameter properties named type remain distinct declared fields', () => {
    const cls = parseMakeCodeTs('class Holder{constructor(public readonly type:number){}}').body[0];
    assert.deepEqual(cls.ctor.params, ['type']);
    assert.deepEqual(cls.fields.map(field => [field.name,field.modifiers,field.parameterProperty]), [['type',['public','readonly'],true]]);
    assert.equal(cls.ctor.body[0].expr.left.name, 'type');
    assert.equal(cls.ctor.body[0].expr.right.name, 'type');
});

test('typed writes to readonly type fields outside the constructor stay refused', () => {
    for (const write of ['holder.type=3;','holder.type++;']) {
        const source = 'class Holder{readonly type:number;constructor(kind:number){this.type=kind}}let holder=new Holder(2);'+write;
        assert.match(lowerObjectClasses(parseMakeCodeTs(source)).unsupported.join('\n'), /Readonly class field type cannot be assigned outside its constructor/);
    }
    const ordinary = 'class Holder{readonly value:number;constructor(){this.value=2}}let holder=new Holder();holder.value=3;';
    assert.match(lowerObjectClasses(parseMakeCodeTs(ordinary)).unsupported.join('\n'), /Readonly class field value/);
});

test('contextual type function names and object shorthand remain runtime syntax', () => {
    const body = parseMakeCodeTs('function type(value:number){return value}let record={type};').body;
    assert.equal(body[0].name, 'type');
    assert.deepEqual(body[1].decls[0].init.props, [{key:'type',value:{type:'Identifier',name:'type'}}]);
});

test('type calls and comparisons do not enter type-alias declaration grammar', () => {
    const body = parseMakeCodeTs('type(1);type<limit;').body;
    assert.equal(body[0].expr.type, 'Call');
    assert.equal(body[0].expr.callee.name, 'type');
    assert.equal(body[1].expr.type, 'Binary');
    assert.equal(body[1].expr.op, '<');
    assert.equal(body[1].expr.left.name, 'type');
    const alias = parseMakeCodeTs('type Item<T>=T;let after=1;').body;
    assert.equal(alias.length, 1);
    assert.equal(alias[0].decls[0].name, 'after');
});

test('type accessor names and destructuring targets keep their binding grammar', () => {
    const cls = parseMakeCodeTs('class Holder{get type(){return 2}}').body[0];
    assert.deepEqual(cls.methods.map(method => [method.kind,method.name]), [['get','type']]);
    const object = parseMakeCodeTs('let {value:type}=source;').body[0];
    assert.equal(object.declarations[0].pattern.properties[0].value.name, 'type');
    const array = parseMakeCodeTs('let [type]=source;').body[0];
    assert.equal(array.declarations[0].pattern.elements[0].name, 'type');
});

test('a line break after type preserves a following comparison and its effects', () => {
    const body = parseMakeCodeTs('type\nfoo < sideEffect(); let after=1;').body;
    assert.deepEqual(body.map(node => node.type), ['ExpressionStatement','ExpressionStatement','Declaration']);
    assert.deepEqual(body[0].expr, {type:'Identifier',name:'type'});
    assert.equal(body[1].expr.op, '<');
    assert.equal(body[1].expr.left.name, 'foo');
    assert.equal(body[1].expr.right.type, 'Call');
    assert.equal(body[1].expr.right.callee.name, 'sideEffect');
    assert.equal(body[2].decls[0].name, 'after');
    const alias = parseMakeCodeTs('type Count\n=number;let after:Count=1;').body;
    assert.equal(alias.length, 1);
    assert.equal(alias[0].decls[0].name, 'after');
    assert.equal(alias[0].decls[0].typeName, 'Count');
});

test('reserved control keywords do not become parameter identifiers', () => {
    for (const keyword of ['if','return','class','function'])
        assert.throws(() => parseMakeCodeTs(`function invalid(${keyword}:number){return 1}`), /expected ident/);
});
