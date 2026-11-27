// SPDX-License-Identifier: BSD-3-Clause
import React, {useEffect, useMemo, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import CardiacPanel from './cardiac-panel.jsx';
import {assembleCardiac, parseCardiacDeck, formatCardiacDeck, exportCardiacListing} from '../../lib/cardiac-program.js';
import {CARDIAC_EXAMPLES} from '../../lib/cardiac-examples.js';
import {CARDIAC_WORKSPACE_KEY, createCardiacWorkspace, validateCardiacWorkspace,
    serializeCardiacWorkspace, deserializeCardiacWorkspace} from '../../lib/cardiac-project.js';
import {checkCardiacPrediction} from '../../lib/cardiac-debug-view.js';
import downloadBlob from '../../lib/download-blob.js';

const initialWorkspace = () => {
    try {
        const result = validateCardiacWorkspace(JSON.parse(localStorage.getItem(CARDIAC_WORKSPACE_KEY)));
        if (result.ok) return result.project;
    } catch (error) { /* A first visit or unavailable storage keeps the in-memory draft. */ }
    const example = CARDIAC_EXAMPLES['cardiac-echo'];
    return createCardiacWorkspace(example.source, formatCardiacDeck(example.input));
};
const exampleForSource = source => Object.values(CARDIAC_EXAMPLES)
    .find(example => example.source.trim() === source.trim())?.id || '';
const imageOf = assembly => ({entry: assembly.entry,
    words: assembly.words.map(({address, value}) => ({address, value})).sort((a, b) => a.address - b.address)});
const diagnosticText = diagnostics => diagnostics.map(item => `${item.line}:${item.column} — ${item.message}`).join('\n');

/** Owns drafts and user actions. The shared debug runner alone executes. */
export default function CardiacHost ({runner, locale, configuration, onReady}) {
    const [workspace, setWorkspace] = useState(initialWorkspace);
    const [exampleId, setExampleId] = useState(() => exampleForSource(workspace.source));
    const [suppliedCards, setSuppliedCards] = useState(0);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [prediction, setPrediction] = useState(null);
    const [revision, setRevision] = useState(0);
    const current = useRef(workspace);
    const callbacks = useRef({runner, onReady});
    const alive = useRef(true);
    const generation = useRef(0);
    const actions = useRef(Promise.resolve());
    callbacks.current = {runner, onReady};
    const assembly = useMemo(() => assembleCardiac(workspace.source), [workspace.source]);

    const save = next => {
        const candidate = typeof next === 'function' ? next(current.current) : next;
        const checked = validateCardiacWorkspace({...candidate, active: true});
        if (!checked.ok) throw new Error(checked.errors.map(item => item.message).join('\n'));
        current.current = checked.project;
        setWorkspace(checked.project);
        try { localStorage.setItem(CARDIAC_WORKSPACE_KEY, JSON.stringify(checked.project)); }
        catch (failure) {
            setError(/^de/i.test(locale || '') ? 'Automatisches Speichern ist nicht verfügbar. Speichere den Arbeitsstand als Datei.' :
                'Autosave is unavailable. Save the workspace to a file to keep this draft.');
        }
        return checked.project;
    };
    const request = action => {
        const token = generation.current;
        const operation = actions.current.catch(() => {}).then(async () => {
            if (!alive.current || token !== generation.current) return;
            setBusy(true);
            setError('');
            try {
                const result = await action(() => alive.current && token === generation.current);
                if (alive.current && token === generation.current) setRevision(value => value + 1);
                return result;
            } catch (failure) {
                if (alive.current && token === generation.current) setError(failure.message || String(failure));
            } finally {
                if (alive.current && token === generation.current) setBusy(false);
            }
        });
        actions.current = operation;
        return operation;
    };
    const ready = async () => {
        const latest = callbacks.current;
        if (latest.runner?.cardiacSnapshot?.()) return latest.runner;
        return latest.onReady();
    };
    const parsedSource = () => {
        const result = assembleCardiac(current.current.source);
        if (!result.ok) throw new Error(diagnosticText(result.diagnostics));
        if (result.entry === null) throw new Error(/^de/i.test(locale || '') ? 'Füge einen Befehl oder ENTRY hinzu.' : 'Add an instruction or an ENTRY directive.');
        return result;
    };
    const deckValues = () => {
        const deck = parseCardiacDeck(current.current.inputDeck);
        if (!deck.ok) throw new Error(diagnosticText(deck.diagnostics));
        return deck.values;
    };
    const load = start => request(async valid => {
        // Validate both before touching the running machine: a malformed deck
        // must not erase a good program as a side effect of Run source.
        const program = imageOf(parsedSource());
        const values = start && current.current.inputMode === 'manual' ? deckValues() : [];
        const selected = await ready();
        if (!valid()) return;
        selected.cardiacControl('loadProgram', program);
        save(previous => ({...previous, loadedProgram: program}));
        setPrediction(null);
        if (values.length) selected.cardiacControl('enqueueInput', values);
        setSuppliedCards(values.length);
        if (start) selected.resume();
    });
    const control = (verb, value) => request(async valid => {
        const input = verb === 'queueDeck' ? deckValues() : value;
        const selected = await ready();
        if (!valid()) return;
        const result = selected.cardiacControl(verb === 'queueDeck' ? 'enqueueInput' : verb, input);
        if (verb === 'queueDeck') setSuppliedCards(count => count + input.length);
        if (verb === 'reset') {
            setPrediction(null);
            setSuppliedCards(0);
        }
        return result;
    });

    useEffect(() => {
        alive.current = true;
        const sourceLoad = event => {
            if (typeof event.detail?.source !== 'string') return;
            generation.current++;
            callbacks.current.runner?.pause?.();
            setExampleId(CARDIAC_EXAMPLES[event.detail.exampleId] ? event.detail.exampleId : exampleForSource(event.detail.source));
            save(previous => ({...previous, source: event.detail.source,
                inputDeck: typeof event.detail.inputDeck === 'string' ? event.detail.inputDeck : '',
                inputMode: event.detail.inputMode === 'circuit' ? 'circuit' : 'manual', loadedProgram: null}));
            setPrediction(null);
            setBusy(false);
            load(false);
        };
        const restore = event => {
            if (['future', 'invalid', 'storage-failed'].includes(event?.detail?.outcome)) return;
            if (event.type === 'storage' && event.key !== null && event.key !== CARDIAC_WORKSPACE_KEY) return;
            generation.current++;
            callbacks.current.runner?.pause?.();
            const next = initialWorkspace();
            current.current = next;
            setWorkspace(next);
            setExampleId(exampleForSource(next.source));
            setSuppliedCards(0);
            setPrediction(null);
            setBusy(false);
            // Reopening restores the authored image, paused, never live memory.
            if (callbacks.current.runner?.cardiacSnapshot?.()) {
                callbacks.current.runner.cardiacControl('loadProgram', next.loadedProgram || {words: [], entry: 0});
            }
        };
        const runRequest = () => load(true);
        const stopRequest = () => {
            generation.current++;
            callbacks.current.runner?.pause?.();
            setBusy(false);
        };
        window.addEventListener('bw-cardiac-run-request', runRequest);
        window.addEventListener('bw-cardiac-stop-request', stopRequest);
        window.addEventListener('bw-cardiac-source-load', sourceLoad);
        window.addEventListener('bw-project-bundle-loaded', restore);
        window.addEventListener('storage', restore);
        return () => {
            alive.current = false;
            generation.current++;
            window.removeEventListener('bw-cardiac-run-request', runRequest);
            window.removeEventListener('bw-cardiac-stop-request', stopRequest);
            window.removeEventListener('bw-cardiac-source-load', sourceLoad);
            window.removeEventListener('bw-project-bundle-loaded', restore);
            window.removeEventListener('storage', restore);
        };
    }, []);

    useEffect(() => {
        request(async valid => {
            const selected = await ready();
            if (!valid()) return;
            const existing = selected.cardiacSnapshot();
            if (configuration?.partId) {
                // A circuit handoff adopts its existing program and state.
                save(previous => ({...previous, loadedProgram: existing.program}));
            } else {
                const parsed = assembleCardiac(current.current.source);
                const program = current.current.loadedProgram || (parsed.ok && parsed.entry !== null ? imageOf(parsed) : null);
                if (program) {
                    selected.cardiacControl('loadProgram', program);
                    save(previous => ({...previous, loadedProgram: program}));
                }
            }
        });
    }, [configuration?.partId]);

    // Parent runner notifications refresh this observation; it owns the clock.
    const snapshot = runner?.cardiacSnapshot?.() || null;
    void revision;
    return <section data-cardiac-host>
        <CardiacPanel workspace={workspace} assembly={assembly} snapshot={snapshot} busy={busy}
            error={error} locale={locale} attached={!!configuration?.partId} prediction={prediction}
            exampleId={exampleId} suppliedCards={suppliedCards}
            onSource={source => save(previous => ({...previous, source}))}
            onDeck={inputDeck => save(previous => ({...previous, inputDeck}))}
            onMode={inputMode => save(previous => ({...previous, inputMode}))}
            onExample={id => {
                const example = CARDIAC_EXAMPLES[id];
                if (!example) return;
                setExampleId(id);
                runner?.pause?.();
                save(previous => ({...previous, source: example.source,
                    inputDeck: formatCardiacDeck(example.input), inputMode: 'manual'}));
                setPrediction(null);
            }}
            onLoad={() => load(false)} onRunSource={() => load(true)} onControl={control}
            onRun={() => request(async valid => { const selected = await ready(); if (valid()) selected.resume(); })}
            onPredict={(pc, acc) => request(async valid => {
                if (!/^\d+$/.test(pc.trim()) || !/^-?\d+$/.test(acc.trim())) { setPrediction({kind: 'missing'}); return; }
                if (Number(pc) > 99 || Math.abs(Number(acc)) > 9999) { setPrediction({kind: 'invalid'}); return; }
                const selected = await ready();
                if (!valid()) return;
                const before = selected.cardiacSnapshot();
                const after = selected.cardiacControl('step');
                setPrediction(checkCardiacPrediction(before, after, pc, acc));
            })}
            onSave={() => request(() => downloadBlob('cardiac.bwcardiac.json',
                new Blob([serializeCardiacWorkspace(current.current)], {type: 'application/json'})))}
            onListing={() => request(() => downloadBlob('program.cardiac',
                new Blob([exportCardiacListing(parsedSource())], {type: 'text/plain'})))}
            onOpen={file => request(async valid => {
                if (file.size > 256 * 1024) throw new Error('CARDIAC files must be at most 256 KB.');
                const text = await file.text();
                const next = /\.json$/i.test(file.name) ? deserializeCardiacWorkspace(text) :
                    {...current.current, source: text};
                if (!valid()) return;
                runner?.pause?.();
                save(next);
                setExampleId(exampleForSource(next.source));
                if (/\.json$/i.test(file.name)) {
                    const selected = await ready();
                    if (valid()) selected.cardiacControl('loadProgram', next.loadedProgram || {words: [], entry: 0});
                }
                setPrediction(null);
            })} />
    </section>;
}

CardiacHost.propTypes = {
    runner: PropTypes.object, running: PropTypes.bool, locale: PropTypes.string,
    configuration: PropTypes.object, onReady: PropTypes.func.isRequired
};
