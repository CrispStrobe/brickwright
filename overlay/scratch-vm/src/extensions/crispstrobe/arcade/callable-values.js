const createNamedCallableHost = require('./named-callable-host');
const {validateCallableLexicalPlan} = require('./callable-lexical-plan.generated');
// Explicit PXT callable resources. Executable bodies remain real VM procedures.
// This service retains captured cells; it never executes JavaScript functions.
let nextCallableId = 0;
const classState = new WeakMap();
const namedState = new WeakMap();
const invocationState = new WeakMap();
const structuredState = new WeakMap();

class ArcadeCallableValues {
    constructor(runtime, values, classProvider = null, subscribeLifecycle = null) {
        this.runtime = runtime;
        this.values = values;
        this.definitions = new WeakMap();
        this.labels = new WeakMap();
        this.resources = new Map();
        this.resetListeners = new Set();
        invocationState.set(this,new WeakMap());
        structuredState.set(this,{resources:new WeakMap(),invocations:new WeakMap()});
        this.generation = 0;
        this.disposed = false;
        namedState.set(this,{host:createNamedCallableHost(runtime,values,subscribeLifecycle),declarations:new WeakMap(),invocations:new WeakMap()});
        classState.set(this, {provider:classProvider, declarations:new WeakMap(), invocations:new WeakMap()});
        // Metadata-only extension construction has no runtime or resources.
        // Never turn it into a resource host by attaching a target afterward.
        const boundRuntime = Boolean(runtime && typeof runtime.on === 'function' &&
            typeof runtime.off === 'function');
        this.assertRuntime = () => {
            if (!boundRuntime || this.runtime !== runtime || !Array.isArray(runtime.targets))
                throw new Error('Callable resources require their bound runtime');
        };
        this.reset = () => {
            this.generation++;
            this.definitions = new WeakMap();
            this.labels = new WeakMap();
            this.resources.clear();
            for (const listener of this.resetListeners) listener();
        };
        this.loaded = () => { this.reset(); this.disposed = false; };
        this.suspend = () => { this.reset(); this.disposed = true; };
        this.events = new Map([['PROJECT_START',this.reset], ['PROJECT_STOP_ALL',this.reset],
            ['PROJECT_LOADED',this.loaded], ['RUNTIME_DISPOSED',this.suspend]]);
        const subscribe=subscribeLifecycle || ((event,handler)=>{runtime.on(event,handler);return ()=>runtime.off(event,handler);});
        const unsubscribers=boundRuntime?[...this.events].map(([event,handler])=>subscribe(event,handler)):[];
        this.removeEvents = () => {for(const unsubscribe of unsubscribers)unsubscribe();};
    }

    onReset(listener) {
        if (typeof listener !== 'function') throw new Error('Callable reset listener must be a function');
        this.resetListeners.add(listener);
        return () => this.resetListeners.delete(listener);
    }

    declare(target, descriptor, declarationOwner = null) {
        this.assertRuntime();
        let sourceOwner, classDeclaration, namedDeclaration;
        if(descriptor?.schema==='bw-callable-declaration') {
            if (descriptor.version === 2) {
                if (!classState.get(this).provider) throw new Error('Class callable declarations require their owned provider');
                classDeclaration = classState.get(this).provider.prepareDeclaration(target, descriptor);
                sourceOwner = classDeclaration.sourceOwner;
                descriptor = classDeclaration.descriptor;
            } else {
            if(Object.keys(descriptor).some(key=>!['schema','version','site','plan','procedure'].includes(key)) || ![1,3].includes(descriptor.version))
                throw new Error('Unknown callable source declaration envelope');
            const plan=validateCallableLexicalPlan(descriptor.plan);
            if(descriptor.version===3)namedDeclaration=namedState.get(this).host?.prepare(target,descriptor);
            if(descriptor.version===3&&!namedDeclaration)throw new Error('Named callable requires its actual owned runtime');
            const site=plan.sites.find(row=>row.id===descriptor.site), owner=site&&plan.owners.find(row=>row.id===site.owner);
            if(!owner || owner.procedure!==descriptor.procedure)throw new Error('Callable source site/procedure owner mismatch');
            sourceOwner=site.createdIn===plan.module ? {module:true} : {procedure:plan.owners.find(row=>row.id===site.createdIn).procedure};
            const captures=site.captures.map(capture=>({name:plan.bindings.find(binding=>binding.id===capture.binding).nativeName,mode:capture.mode}));
            const nativeParameter=name=>plan.bindings.find(binding=>owner.parameters.includes(binding.id)&&binding.sourceName===name).nativeName;
            descriptor={procedure:owner.procedure,site:site.id,parameters:owner.signature.parameters.map(parameter=>nativeParameter(parameter.name)),captures,defaults:site.defaults.map(entry=>({...entry,name:nativeParameter(entry.name)}))};
            }
        }
        if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor) ||
            Object.keys(descriptor).some(key => !['procedure','site','parameters','captures','defaults'].includes(key)))
            throw new Error('Unknown callable definition fields');
        const {procedure, site, parameters, captures, defaults = []} = descriptor;
        if (this.disposed || !this.runtime.targets.includes(target) || !target?.blocks || typeof procedure !== 'string' || !procedure ||
            typeof site !== 'string' || !site || !Array.isArray(parameters) ||
            !Array.isArray(captures)) throw new Error('Invalid callable definition');
        const validNames = names => names.every(name => typeof name === 'string' && /^[A-Za-z_]\w*$/.test(name)) &&
            new Set(names).size === names.length;
        const captureSpecs = captures.map(entry => typeof entry === 'string' ? {name:entry,mode:'cell'} : entry);
        if (captureSpecs.some(entry => !entry || typeof entry !== 'object' ||
            !['cell','value'].includes(entry.mode) || Object.keys(entry).some(key => !['name','mode'].includes(key))) ||
            !validNames(parameters) || !validNames(captureSpecs.map(entry => entry.name)) ||
            parameters.some(name => captureSpecs.some(entry => entry.name === name)))
            throw new Error('Invalid callable parameter or capture bindings');
        if (!Array.isArray(defaults) || defaults.some(entry => !entry || typeof entry !== 'object' ||
            !parameters.includes(entry.name) || !Object.prototype.hasOwnProperty.call(entry,'value') ||
            Object.keys(entry).some(key => !['name','value'].includes(key)) ||
            !(entry.value === null || typeof entry.value === 'boolean' ||
                typeof entry.value === 'number' && Number.isFinite(entry.value))) ||
            new Set(defaults.map(entry => entry.name)).size !== defaults.length)
            throw new Error('Invalid literal callable defaults');
        const definition = target.blocks.getProcedureDefinition(procedure);
        const names = target.blocks.getProcedureParamNamesIdsAndDefaults(procedure)?.[0];
        if (!definition || !Array.isArray(names) || JSON.stringify(names) !== JSON.stringify(parameters))
            throw new Error('Callable definition requires its exact native procedure');
        let declarations = this.definitions.get(target);
        if (!declarations) this.definitions.set(target, declarations = new Map());
        if (declarations.has(procedure) || [...declarations.values()].some(value => value.site === site))
            throw new Error('Duplicate callable procedure or source site');
        const registered = Object.freeze({procedure, site,
            parameters:Object.freeze(parameters.slice()),
            ...(declarationOwner?{declarationOwner:Object.freeze(declarationOwner)}:{}),
            ...(sourceOwner?{sourceOwner:Object.freeze(sourceOwner)}:{}),
            captures:Object.freeze(captureSpecs.map(entry => Object.freeze({...entry}))),
            representation:captureSpecs.length ? 'action' : 'label',
            defaults:Object.freeze(Object.fromEntries(defaults.map(entry => [parameters.indexOf(entry.name),entry.value])))});
        if (classDeclaration) classState.get(this).declarations.set(registered, classDeclaration);
        if (namedDeclaration) namedState.get(this).declarations.set(registered,namedDeclaration);
        declarations.set(procedure, registered);
    }

    create(target, procedure, {locals, inheritedCaptures = new Map(), ownerProcedure, sourceModule=false, util, operationArgs, structuredCaptures=null} = {}) {
        this.assertRuntime();
        const definition = this.definitions.get(target)?.get(procedure);
        if (!definition) throw new Error('Unknown callable definition');
        this.declarationCurrent(target,definition);
        const classDeclaration=classState.get(this).declarations.get(definition);
        const namedDeclaration=namedState.get(this).declarations.get(definition);
        if(namedDeclaration)namedState.get(this).host.assertCreate(namedDeclaration,target,util,operationArgs);
        if(classDeclaration)classState.get(this).provider.assertCreate(classDeclaration,target,util,operationArgs);
        if(definition.sourceOwner && (definition.sourceOwner.module ? !sourceModule : ownerProcedure!==definition.sourceOwner.procedure))
            throw new Error('Callable creation requires its actual lexical frame owner');
        let labels = this.labels.get(target);
        if (!labels) this.labels.set(target, labels = new Map());
        if (!definition.captures.length && labels.has(procedure)) return this.hold(labels.get(procedure));
        const captures = new Map();
        for (const {name,mode} of definition.captures) {
            let cell;
            if (classDeclaration && classState.get(this).provider.ownsReceiver(classDeclaration, name))
                cell = classState.get(this).provider.receiverCell(classDeclaration, name, util);
            else if (structuredCaptures && (cell=structuredCaptures.cell(name))) {}
            else if (locals && Object.prototype.hasOwnProperty.call(locals, name)) cell = {values:locals, key:name};
            else cell = inheritedCaptures.get(name);
            if (!cell || !cell.values || typeof cell.values !== 'object' || Array.isArray(cell.values) ||
                typeof cell.key !== 'string' || !Object.prototype.hasOwnProperty.call(cell.values, cell.key))
                throw new Error('Missing callable capture cell: ' + name);
            if (mode === 'value') {
                const lexical=structuredCaptures?.read(cell);
                let value = lexical ? this.values.encode(lexical.value) : cell.values[cell.key];
                if (Array.isArray(value)) value = this.values.arrayReference(this.runtime,value);
                else {
                    const decoded=this.values.decode(value);
                    if (typeof decoded === 'function' || decoded !== null && typeof decoded === 'object' && !this.values.isReference(decoded))
                        throw new Error('Callable value capture requires a primitive or registered reference');
                    value=this.values.encode(decoded);
                }
                if (this.values.isReference(value) && this.values.referenceId(this.runtime,value,value.bwReference.kind) === null)
                    throw new Error('Callable value capture requires a current reference');
                captures.set(name, Object.freeze({values:Object.freeze({value}),key:'value'}));
            } else captures.set(name, Object.freeze({values:cell.values, key:cell.key}));
        }
        if(structuredCaptures&&!structuredCaptures.current())throw Error('Catch capture creation outlived its owned activation');
        const id = 'callable:' + ++nextCallableId;
        const reference = this.values.reference(this.runtime, 'callable', id);
        if(structuredCaptures&&!structuredCaptures.current())throw Error('Catch capture publication outlived its owned activation');
        const resource=Object.freeze({reference, target, definition, captures, generation:this.generation});
        if(structuredCaptures)structuredState.get(this).resources.set(resource,structuredCaptures);
        this.resources.set(id, resource);
        if (!definition.captures.length) labels.set(procedure, reference);
        return reference;
    }

    declarationCurrent(target, definition) {
        const namedDeclaration=namedState.get(this).declarations.get(definition);
        if(namedDeclaration)namedState.get(this).host.assertCurrent(namedDeclaration,target);
        const classDeclaration = classState.get(this).declarations.get(definition);
        if (classDeclaration) classState.get(this).provider.assertCurrent(classDeclaration, target);
        const owner=definition.declarationOwner;
        if(!owner)return;
        if(target.blocks.getBlock(owner.block.id)!==owner.block)
            throw new Error('Callable declaration no longer owns its current command');
        for(const [slot,expected]of [['NAME',owner.name],['METADATA',owner.metadata]]) {
            const input=owner.block.inputs?.[slot],child=target.blocks.getBlock(input?.block);
            if(!child||child.opcode!=='text'||!child.shadow||input.block!==input.shadow||child.fields?.TEXT?.value!==expected)
                throw new Error('Callable declaration metadata changed after registration');
        }
    }

    resource(reference) {
        this.assertRuntime();
        const id = this.values.referenceId(this.runtime, reference, 'callable');
        const resource = id && this.resources.get(id);
        if (this.disposed || !resource || resource.generation !== this.generation || !this.runtime.targets.includes(resource.target))
            throw new Error('Stale or foreign callable reference');
        this.declarationCurrent(resource.target,resource.definition);
        const definition = resource.target.blocks.getProcedureDefinition(resource.definition.procedure);
        const names = resource.target.blocks.getProcedureParamNamesIdsAndDefaults(resource.definition.procedure)?.[0];
        if (!definition || !Array.isArray(names) || JSON.stringify(names) !== JSON.stringify(resource.definition.parameters))
            throw new Error('Callable resource has no matching current native procedure');
        return resource;
    }

    hold(reference) { return this.resource(reference).reference; }

    signature(reference) {
        const resource = this.resource(reference), declaration = classState.get(this).declarations.get(resource.definition);
        if (!declaration) throw new Error('Callable resource has no qualified class signature');
        return classState.get(this).provider.signature(declaration);
    }

    typeOf(value) {
        const decoded = this.values.decode(value);
        if (this.values.isReference(decoded) && decoded.bwReference.kind === 'callable')
            return this.resource(decoded).definition.representation === 'label' ? 'function' : 'object';
        return typeof decoded;
    }

    invocation(reference, args, rawArgs = args) {
        if (!Array.isArray(args)) throw new Error('Callable invocation requires ordered arguments');
        const resource = this.resource(reference);
        const supplied = args.slice();
        for (let index = supplied.length; index < resource.definition.parameters.length; index++)
            supplied.push(Object.prototype.hasOwnProperty.call(resource.definition.defaults,index) ?
                this.values.encode(resource.definition.defaults[index]) : this.values.UNDEFINED);
        // Each invocation gets its own map, while captured variable cells stay live.
        const invocation = {...resource, args:supplied, captures:new Map(resource.captures)};
        const namedDeclaration=namedState.get(this).declarations.get(resource.definition);
        if(namedDeclaration){if(args.length)throw new Error('Named declaration invocation requires zero actual arguments');namedState.get(this).invocations.set(invocation,{resource,declaration:namedDeclaration});}
        const declaration = classState.get(this).declarations.get(resource.definition);
        if (declaration) classState.get(this).invocations.set(invocation, {signature:classState.get(this).provider.invocation(declaration, supplied, rawArgs),resource});
        invocationState.get(this).set(invocation,{failed:false,captures:invocation.captures});
        const provider=structuredState.get(this).resources.get(resource);
        if(provider)structuredState.get(this).invocations.set(invocation,provider);
        return invocation;
    }

    structuredInvocation(invocation,admit) {
        const provider=structuredState.get(this).invocations.get(invocation);
        if(!provider)return null;
        if(invocationState.get(this).get(invocation)?.captures!==invocation.captures||this.resource(invocation.reference).target!==invocation.target)
            throw Error('Catch capture requires its actual issued callable invocation');
        return admit(provider,invocation.captures);
    }

    // Failed invocations still require settlement checking, including v1 calls
    // that would otherwise take the dispatcher's ordinary untyped-success path.
    hasTypedInvocation(invocation) {return invocationState.get(this).get(invocation)?.failed===true||classState.get(this).invocations.has(invocation)||namedState.get(this).invocations.has(invocation);}

    failInvocation(invocation) {
        const state=invocationState.get(this).get(invocation);
        if(!state)throw new Error('Callable failure requires its actual issued invocation');
        state.failed=true;
        classState.get(this).invocations.delete(invocation);
        namedState.get(this).invocations.delete(invocation);
    }

    complete(invocation, value) {
        if(invocationState.get(this).get(invocation)?.failed)
            throw new Error('Failed callable invocation cannot complete normally');
        const named=namedState.get(this).invocations.get(invocation);
        if(named){if(this.resource(invocation.reference)!==named.resource)throw new Error('Named completion outlived its actual invocation');return namedState.get(this).host.result(named.declaration,value);}
        const record = classState.get(this).invocations.get(invocation);
        if (!record) throw new Error('Class callable completion requires its actual owned invocation');
        const current = this.resource(invocation.reference);
        if (current !== record.resource)
            throw new Error('Class callable completion outlived its resource');
        return classState.get(this).provider.result(record.signature, value);
    }

    dispose() {
        namedState.get(this).host?.dispose();
        this.removeEvents();
        this.suspend();
    }
}

module.exports = ArcadeCallableValues;
