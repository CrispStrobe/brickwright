const primitiveOwner = require('./bw-primitive-owner');
const cachedOwner = require('./bw-cached-primitive-owner');

// Neither Error properties nor a null-looking serialized value confer fault
// ownership. Metadata issuances and fault receipts never leave these WeakMaps.
// Receipts are shared: consume() accepts a lease only from the kind that issued it.
const receipts = new WeakMap();
const properties = new Set(['x', 'y', 'width', 'height']);
const BWValues = require('./bw-values');
// Each faulting primitive is one sealed kind with its own declaration, adapter
// and registration state. A kind names its single method and the exact current
// arguments that may fault; the machinery below is identical for every kind.
function ownDataValue(args, name) {
    const descriptor = Object.getOwnPropertyDescriptor(args, name);
    return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor : null;
}
function makeKind({method, label, read, errorFor}) {
const opcode = 'arcade_' + method;
const rows = new WeakMap(), adapters = new WeakMap(), issues = new WeakMap();
const rowOwner = Symbol('actual ' + label + ' declaration');
const rowIssue = Symbol('actual ' + label + ' registration issuance');

function adapterCurrent(owner, record) {
    return !!record && owner.isCurrent() && owner.isInstance(record.instance) &&
        Object.getOwnPropertyDescriptor(record.adapter, '_inst')?.value === record.instance &&
        Object.getOwnPropertyDescriptor(record.adapter, method)?.value === record.delegate &&
        Object.getPrototypeOf(record.adapter) === record.prototype &&
        !Object.hasOwn(record.adapter, 'getInfo') &&
        Object.getOwnPropertyDescriptor(record.prototype, 'getInfo')?.value === record.getInfo;
}

function declaration(info, owner) {
    const entries = info?.id === 'arcade' && info.blocks?.filter(block => block.opcode === method);
    if (entries?.length !== 1 || !owner) throw Error(label + ' declaration owner is missing');
    rows.set(entries[0], owner);
    Object.defineProperty(entries[0], rowOwner, {value: owner, enumerable: true});
    return info;
}

function bindAdapterInfo(info, adapter, instance) {
    const entry = info?.id === 'arcade' && info.blocks?.find(block => block.opcode === method);
    const owner = entry && Object.getOwnPropertyDescriptor(entry, rowOwner)?.value;
    if (rows.get(entry) !== owner || !owner?.isInstance(instance) || !owner.isCurrent())
        throw Error(label + ' adapter source owner differs');
    const delegate = Object.getOwnPropertyDescriptor(adapter, method)?.value;
    const prototype = Object.getPrototypeOf(adapter), getInfo = Object.getOwnPropertyDescriptor(prototype, 'getInfo')?.value;
    if (typeof delegate !== 'function' || typeof getInfo !== 'function' || Object.hasOwn(adapter, 'getInfo') ||
        Object.getOwnPropertyDescriptor(adapter, '_inst')?.value !== instance)
        throw Error(label + ' adapter delegate differs');
    let record = adapters.get(owner);
    if (!record) {
        record = {adapter, instance, delegate, prototype, getInfo};
        adapters.set(owner, record);
    }
    if (record.adapter !== adapter || record.instance !== instance || record.delegate !== delegate || !adapterCurrent(owner, record))
        throw Error(label + ' adapter identity changed');
    const issue = Object.freeze({});
    issues.set(issue, {owner, adapter: record, arguments: entry.arguments, consumed: false});
    Object.defineProperty(entry, rowIssue, {value: issue, enumerable: true});
}

function create(runtime, owner) {
    if (!runtime || typeof runtime.on !== 'function') return Object.freeze({fault() {throw Error(label + ' requires a bound runtime');}});
    const getter = runtime.getOpcodeFunction;
    let registration = null, valid = !(runtime._blockInfo || []).some(category => category.id === 'arcade');
    let active = false, disposed = false, generation = 0;
    let targets = new Set();
    const capture = (category, refresh = false) => {
        if (category?.id !== 'arcade' || !valid) return;
        const entries = category.blocks?.filter(entry => entry.json?.type === opcode);
        const entry = entries?.length === 1 && entries[0], issue = issues.get(entry?.info?.[rowIssue]);
        const adapter = adapters.get(owner), func = entry?.info?.func;
        if ((refresh ? registration?.category !== category : !!registration) || !issue || issue.consumed ||
            issue.owner !== owner || issue.adapter !== adapter || issue.arguments !== entry?.info?.arguments ||
            entry?.info?.[rowOwner] !== owner || !adapterCurrent(owner, adapter) ||
            !runtime._blockInfo?.includes(category) || typeof func !== 'function' ||
            typeof getter !== 'function' || runtime.getOpcodeFunction !== getter || getter.call(runtime, opcode) !== func) {
            valid = false;return;
        }
        issue.consumed = true;
        registration = {category, entry, func, adapter, issue, arguments: entry.info.arguments};
    };
    const current = () => valid && active && !disposed && registration && adapterCurrent(owner, registration.adapter) &&
        runtime.getOpcodeFunction === getter && getter.call(runtime, opcode) === registration.func &&
        runtime._blockInfo?.includes(registration.category) && registration.category.id === 'arcade' &&
        registration.category.blocks?.filter(entry => entry.json?.type === opcode).length === 1 &&
        registration.category.blocks.includes(registration.entry) && registration.entry.json?.type === opcode &&
        registration.entry.info?.func === registration.func && registration.entry.info?.arguments === registration.arguments &&
        issues.get(registration.entry.info?.[rowIssue]) === registration.issue && registration.issue.consumed &&
        registration.entry.info?.[rowOwner] === owner;
    const physical = (args, util) => {
        if (!current() || util?.runtime !== runtime || primitiveOwner.current(util, args)?.opcode !== opcode)
            throw Error(label + ' requires its original current primitive');
        const block = cachedOwner(runtime, util, args, opcode, []);
        // Read only own data slots from the already-evaluated engine arguments.
        // No getter, coercion, BWValues decode, missing argument or public tag.
        const {property} = read(args);
        return {block: block.id, property};
    };
    runtime.on('EXTENSION_ADDED', capture);
    runtime.on('BLOCKSINFO_UPDATE', category => capture(category, true));
    runtime.on('PROJECT_START', () => {generation++;if (!disposed) {active = true;targets = new Set(runtime.targets);}});
    for (const event of ['PROJECT_STOP_ALL', 'PROJECT_LOADED']) runtime.on(event, () => {active = false;generation++;});
    runtime.on('RUNTIME_DISPOSED', () => {active = false;disposed = true;generation++;});
    runtime.on('PROJECT_LOADED', () => {
        if (disposed && runtime.targets?.length && runtime.targets.every(target => !targets.has(target)) &&
            valid && registration && adapterCurrent(owner, registration.adapter) &&
            runtime.getOpcodeFunction === getter && getter.call(runtime, opcode) === registration.func) {
            disposed = false;targets = new Set(runtime.targets);
        }
    });
    return Object.freeze({fault(args, util) {
        const witness = physical(args, util);
        const call = primitiveOwner.captureActiveCall(util, args);
        if (!call) throw Error(label + ' requires its actual invocation');
        const error = errorFor ? errorFor(args) : new TypeError(read(args).message);
        const lease = Object.freeze({});
        receipts.set(lease, {runtime, args, util, thread: util.thread, generation, error, witness, call,
            current: () => generation, physical});
        return {error, lease};
    }});
}
return Object.freeze({create, declaration, bindAdapterInfo});
}

function consume(runtime, args, util, error, lease) {
    const saved = receipts.get(lease);
    if (!saved || saved.runtime !== runtime || saved.args !== args || saved.util !== util ||
        saved.thread !== util?.thread || saved.error !== error || saved.generation !== saved.current() ||
        !primitiveOwner.isActiveCall(saved.call, util, args)) return null;
    receipts.delete(lease);
    const witness = saved.physical(args, util);
    return witness.block === saved.witness.block && witness.property === saved.witness.property ? witness : null;
}

// Exact current-argument readers: own data slots only, no getter, coercion or tag.
const nullSprite = 'Expected type Sprite but received type null. Did you forget to assign a variable?';
const isUndefinedValue = value => value === BWValues.UNDEFINED ||
    (value !== null && typeof value === 'object' && Object.keys(value).length === 1 &&
     Object.getOwnPropertyDescriptor(value, 'bwUndefined')?.value === true);
// PXT: a missing Sprite or Image receiver or source throws; other values never do.
const missingOf = (value, type) => value === null ? 'Expected type ' + type + ' but received type null. Did you forget to assign a variable?' :
    isUndefinedValue(value) ? 'Expected type ' + type + ' but received type undefined. Did you forget to assign a variable?' : null;
const missingArguments = (names, type, operations) => args => {
    const operation = operations && ownDataValue(args, 'OP');
    if (operations && (!operation || !operations.includes(operation.value)))
        throw Error('Missing ' + type + ' fault requires a supported current operation');
    for (const name of names) {
        const slot = ownDataValue(args, name), message = slot && missingOf(slot.value, type);
        if (message) return {property: name, message};
    }
    throw Error('Missing ' + type + ' fault requires an actual null or Undefined ' + type + ' argument');
};

const spriteGetter = makeKind({method: 'spriteProperty', label: 'Null Sprite getter', read(args) {
    const receiver = Object.getOwnPropertyDescriptor(args, 'ID');
    const property = Object.getOwnPropertyDescriptor(args, 'PROPERTY');
    if (!receiver || !Object.hasOwn(receiver, 'value') || receiver.value !== null ||
        !property || !Object.hasOwn(property, 'value') || !properties.has(property.value))
        throw Error('Null Sprite getter requires actual null and a supported current property');
    return {property: property.value, message: nullSprite};
}});
// Sprite.setImage on a missing receiver; the image argument never faults it.
const spriteImageSetter = makeKind({method: 'setSpriteImage', label: 'Missing Sprite setter', read: missingArguments(['ID'], 'Sprite')});
// Sprite property setters, destroy and setPosition on a missing receiver (any property of a null Sprite throws).
const spriteSetterProperties = ['x', 'y', 'left', 'right', 'top', 'bottom', 'vx', 'vy', 'ax', 'ay', 'fx', 'fy', 'sx', 'sy', 'scale',
    'width', 'height', 'z', 'lifespan', 'rotation', 'rotationDegrees', 'data', 'flags'];
const spriteSetter = makeKind({method: 'setSpriteProperty', label: 'Missing Sprite property setter', read(args) {
    const property = ownDataValue(args, 'PROPERTY');
    if (!property || !spriteSetterProperties.includes(property.value)) throw Error('Missing Sprite setter fault requires a supported current property');
    return missingArguments(['ID'], 'Sprite')(args);
}});
const spritePosition = makeKind({method: 'setSpritePosition', label: 'Missing Sprite setPosition', read: missingArguments(['ID'], 'Sprite')});
// Image reads and scroll on a missing receiver: width, height, getPixel and scroll all throw.
const imageProperty = makeKind({method: 'imageProperty', label: 'Missing Image property', read(args) {
    const property = ownDataValue(args, 'PROPERTY');
    if (!property || !['width', 'height'].includes(property.value)) throw Error('Missing Image property fault requires width or height');
    return missingArguments(['IMAGE'], 'Image')(args);
}});
const imagePixel = makeKind({method: 'imagePixel', label: 'Missing Image getPixel', read: missingArguments(['IMAGE'], 'Image')});
const imageScroll = makeKind({method: 'scrollImage', label: 'Missing Image scroll', read: missingArguments(['IMAGE'], 'Image')});
// Image drawing: a missing receiver or source image. Operation menus are exact.
const imageKinds = Object.freeze([
    ['blitImage', ['IMAGE', 'SOURCE'], ['drawImage', 'drawTransparentImage']],
    ['drawImage', ['IMAGE'], ['fillRect', 'drawLine']],
    ['drawImageCircle', ['IMAGE'], ['drawCircle', 'fillCircle']],
    ['setImagePixel', ['IMAGE'], null],
    ['mutateImage', ['IMAGE'], ['fill', 'replace', 'flipX', 'flipY']],
    ['createImageSprite', ['IMAGE'], null],
    ['spawnImageProjectile', ['IMAGE'], null],
    ['spawnImageSprite', ['IMAGE'], null]
].map(([method, names, operations]) => Object.freeze({method, kind: makeKind({method, label: 'Missing Image operation', read: missingArguments(names, 'Image', operations)})})));
// Every kind in install order: the first is the original null Sprite getter.
const kinds = Object.freeze([Object.freeze({method: 'spriteProperty', kind: spriteGetter}),
    Object.freeze({method: 'setSpriteImage', kind: spriteImageSetter}), ...imageKinds,
    ...[['setSpriteProperty', spriteSetter], ['setSpritePosition', spritePosition],
        ['imageProperty', imageProperty], ['imagePixel', imagePixel], ['scrollImage', imageScroll]].map(([method, kind]) => Object.freeze({method, kind}))]);
// One owner implementation check per kind lets the Arcade constructor create each service.
const bindAll = (info, adapter, instance) => {for (const {kind} of kinds) kind.bindAdapterInfo(info, adapter, instance);};
const declareAll = (info, ownerOf) => {for (const {method, kind} of kinds) kind.declaration(info, ownerOf(method));return info;};

// makeKind/ownDataValue/missingOf: further kinds that live in lazily loaded modules
// (bw-tile-lookup-faults.js) share these receipts and this consume().
module.exports = Object.freeze({...spriteGetter, consume, kinds, bindAll, declareAll, isMissing: value => missingOf(value, 'Sprite') !== null,
    makeKind, ownDataValue, missingOf});
