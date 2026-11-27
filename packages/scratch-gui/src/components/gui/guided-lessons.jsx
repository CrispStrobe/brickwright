/* eslint-disable react/jsx-no-bind, max-len, no-undefined */
import PropTypes from 'prop-types';
import React from 'react';

import coreCatalog from './lessons.json';
import cp1Wave from './lesson-waves/cp1-8.json';
import cardiacWave from './lesson-waves/cardiac-9.json';
import debuggingWave from './lesson-waves/debugging-5.json';
import electricityWave from './lesson-waves/electricity-1.json';
import interactiveWave from './lesson-waves/interactive-4.json';
import languagesWave from './lesson-waves/languages-3.json';
import logikusWave from './lesson-waves/logikus-9.json';
import machinesWave from './lesson-waves/machines-7.json';
import measurementWave from './lesson-waves/measurement-2.json';
import signalsWave from './lesson-waves/signals-6.json';
import styles from './guided-lessons.css';
import {lessonMatchesQuery} from './lesson-search.mjs';

const catalog = {
    lessons: [...coreCatalog.lessons, ...electricityWave.lessons, ...measurementWave.lessons,
        ...languagesWave.lessons, ...interactiveWave.lessons, ...debuggingWave.lessons,
        ...signalsWave.lessons, ...machinesWave.lessons, ...cp1Wave.lessons, ...logikusWave.lessons, ...cardiacWave.lessons]
};

const UI = {
    en: {library: 'Lessons',
        collapse: 'Collapse lessons', expand: 'Expand lessons',
        move: 'Move lessons: drag this header or use the arrow keys',
        close: 'Close lessons',
        back: 'All lessons',
        objective: 'Goal',
        search: 'Search lessons',
        allLevels: 'All levels',
        noResults: 'No lessons match these filters.',
        viewAs: 'Concept lens',
        openProject: 'Open lesson project',
        opening: 'Opening project…',
        opened: 'Project opened',
        prereqs: 'Builds on',
        hint: 'Show hint',
        hideHint: 'Hide hint',
        previous: 'Previous',
        next: 'Next',
        done: 'Lesson complete',
        reset: 'Reset progress',
        observed: 'Observed',
        progress: 'progress',
        resume: 'Resume',
        start: 'Start',
        manualNote: 'Automatic checks are aids, not tests.',
        benchReady: 'Bench ready — mark this step when you have the reading.'},
    de: {library: 'Lektionen',
        collapse: 'Lektionen einklappen', expand: 'Lektionen ausklappen',
        move: 'Lektionen verschieben: Kopfzeile ziehen oder Pfeiltasten verwenden',
        close: 'Lektionen schließen',
        back: 'Alle Lektionen',
        objective: 'Ziel',
        search: 'Lektionen suchen',
        allLevels: 'Alle Stufen',
        noResults: 'Keine Lektion passt zu diesen Filtern.',
        viewAs: 'Sprachperspektive',
        openProject: 'Lektionsprojekt öffnen',
        opening: 'Projekt wird geöffnet…',
        opened: 'Projekt geöffnet',
        prereqs: 'Baut auf auf',
        hint: 'Hinweis zeigen',
        hideHint: 'Hinweis ausblenden',
        previous: 'Zurück',
        next: 'Weiter',
        done: 'Lektion abgeschlossen',
        reset: 'Fortschritt zurücksetzen',
        observed: 'Erkannt',
        progress: 'Fortschritt',
        resume: 'Fortsetzen',
        start: 'Starten',
        manualNote: 'Automatische Prüfungen sind Hilfen, keine Tests.',
        benchReady: 'Aufbau bereit — hake diesen Schritt ab, wenn du die Messung hast.'}
};

const language = locale => (/^de/i.test(locale || '') ? 'de' : 'en');
const localized = (value, lang) => value[lang] || value.en;
const progressKey = lesson => `bw-lesson-progress:${lesson.id}:v${lesson.version}`;

const loadProgress = lesson => {
    try {
        const value = JSON.parse(localStorage.getItem(progressKey(lesson)) || '{}');
        return value.completed && typeof value.completed === 'object' ? value.completed : {};
    } catch {
        return {};
    }
};

const matches = (condition, detail) => {
    if (!condition) return true;
    return Object.keys(condition).every(key => {
        if (key === 'minimumParts') return Number(detail.parts || 0) >= Number(condition[key]);
        return detail[key] === condition[key];
    });
};

const eventNames = {
    'project-run': 'bw-green-flag',
    'project-stop': 'bw-stop-all',
    'circuit-ready': 'bw-circuit-ready',
    'circuit-changed': 'bw-circuit-changed',
    'debug-phase': 'bw-debug-phase',
    'cp1-command': 'bw-cp1-command',
    'cp1-halt': 'bw-cp1-halt',
    'cp1-error': 'bw-cp1-error',
    'hardware-state': 'bw-hardware-state'
};

/**
 * Observables that mean the bench is READY, not that the learner has done
 * anything on it.
 *
 * `bw-circuit-ready` fires exactly once, when the circuit finishes loading —
 * which is after the learner presses Start and before they have measured
 * anything at all. Twenty-eight lessons across four waves hang a MEASURING
 * checkpoint on it ("take the reading at 0.5 tau", "compare the two traces",
 * "verify the map"), and every one of them used to tick itself the moment the
 * example opened. The progress bar filled in on load; nothing it recorded had
 * happened.
 *
 * Wave 1's review found this and filed it as "a structural note that belongs
 * to the whole catalog", and no wave counted it — so the largest defect in the
 * campaign by lessons affected was on nobody's list
 * (`docs/WAVE-OPEN-DEFECTS.md` D1).
 *
 * The fix is not to delete the observable: a learner genuinely wants to know
 * the bench came up, and on a circuit lesson that is the one thing the app can
 * honestly tell them. It ARMS the checkpoint instead — the step says the bench
 * is ready and the "I did it" button stays the thing that completes it. The
 * other four observables are unaffected, because pressing the green flag,
 * editing the circuit, hitting a debug phase and connecting a hub are all
 * things the LEARNER did.
 */
const ARMING_EVENTS = new Set(['circuit-ready']);

const GuidedLessons = ({initialEvent, lessonId, locale, onClose, onSelectLesson}) => {
    const lang = language(locale);
    const text = UI[lang];
    const lesson = catalog.lessons.find(item => item.id === lessonId) || null;
    const [completed, setCompleted] = React.useState(() => (lesson ? loadProgress(lesson) : {}));
    const [step, setStep] = React.useState(0);
    const [hint, setHint] = React.useState(false);
    const [projectStatus, setProjectStatus] = React.useState('');
    // Checkpoints whose bench has come up. Session state, deliberately NOT
    // persisted: "the bench is ready" is true of this sitting, not of the
    // lesson.
    const [armed, setArmed] = React.useState({});
    const [selectedVariant, setSelectedVariant] = React.useState('');
    const [query, setQuery] = React.useState('');
    const [depthFilter, setDepthFilter] = React.useState('');
    const [collapsed, setCollapsed] = React.useState(false);
    const [position, setPosition] = React.useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('bw-lessons-position'));
            if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
        } catch { /* use the initial position */ }
        return {x: 10, y: 52};
    });
    const panel = React.useRef(null);
    const drag = React.useRef(null);
    const bounded = (x, y) => {
        const rect = panel.current && panel.current.getBoundingClientRect();
        return {x: Math.max(0, Math.min(x, window.innerWidth - (rect ? rect.width : 360))),
            y: Math.max(0, Math.min(y, window.innerHeight - (rect ? rect.height : 48)))};
    };
    React.useEffect(() => {
        const resize = () => setPosition(previous => bounded(previous.x, previous.y));
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [collapsed]);
    const savePosition = point => {
        try { localStorage.setItem('bw-lessons-position', JSON.stringify(point)); } catch { /* private mode */ }
    };
    const headerProps = {
        className: styles.header, tabIndex: 0, title: text.move, 'aria-label': text.move,
        'data-testid': 'bw-lessons-drag-handle',
        onPointerDown: event => {
            if (event.button !== 0 || event.target.closest('button, input, select, a')) return;
            event.preventDefault();
            drag.current = {x: event.clientX, y: event.clientY, start: position, point: position};
            event.currentTarget.setPointerCapture(event.pointerId);
        },
        onPointerMove: event => {
            if (!drag.current) return;
            const start = drag.current;
            start.point = bounded(start.start.x + event.clientX - start.x,
                start.start.y + event.clientY - start.y);
            setPosition(start.point);
        },
        onPointerUp: event => {
            if (!drag.current) return;
            savePosition(drag.current.point);
            drag.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        },
        onPointerCancel: () => { drag.current = null; },
        onKeyDown: event => {
            if (event.target !== event.currentTarget || !/^Arrow(Left|Right|Up|Down)$/.test(event.key)) return;
            event.preventDefault();
            const delta = event.shiftKey ? 40 : 10;
            const point = bounded(position.x + (event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0),
                position.y + (event.key === 'ArrowDown' ? delta : event.key === 'ArrowUp' ? -delta : 0));
            setPosition(point);
            savePosition(point);
        }
    };
    const panelStyle = {left: position.x, top: position.y, bottom: 'auto',
        maxHeight: `calc(100vh - ${position.y}px - 10px)`, maxWidth: 'calc(100vw - 20px)',
        ...(collapsed ? {width: 220} : {})};
    const panelButtons = <div className={styles.headerButtons}>
        <button type="button" aria-label={collapsed ? text.expand : text.collapse}
            title={collapsed ? text.expand : text.collapse} aria-expanded={!collapsed}
            data-testid="bw-lessons-collapse" onClick={() => setCollapsed(value => !value)}>
            {collapsed ? '+' : '−'}
        </button>
        <button type="button" aria-label={text.close} onClick={onClose}>×</button>
    </div>;

    React.useEffect(() => {
        setCompleted(lesson ? loadProgress(lesson) : {});
        setStep(0);
        setHint(false);
        setArmed({});
        setProjectStatus('');
        setSelectedVariant(lesson && lesson.languages.length ? lesson.languages[0] : '');
    }, [lessonId]);

    React.useEffect(() => {
        const result = event => {
            const detail = event.detail || {};
            if (!lesson || detail.journeyId !== `lesson:${lesson.id}`) return;
            setProjectStatus(detail.ok ? 'opened' : (detail.cancelled ? '' :
                (detail.error || 'Could not open the lesson project.')));
        };
        window.addEventListener('bw-lesson-project-result', result);
        return () => window.removeEventListener('bw-lesson-project-result', result);
    }, [lesson]);

    const complete = React.useCallback((checkpointId, method) => {
        if (!lesson) return;
        setCompleted(previous => {
            if (previous[checkpointId]) return previous;
            const next = {...previous, [checkpointId]: {method, at: new Date().toISOString()}};
            try {
                localStorage.setItem(progressKey(lesson), JSON.stringify({
                    lessonVersion: lesson.version,
                    completed: next
                }));
            } catch { /* local progress is optional in private mode */ }
            return next;
        });
    }, [lesson]);

    React.useEffect(() => {
        if (!lesson) return undefined;
        const removers = [];
        for (const checkpoint of lesson.checkpoints) {
            if (!checkpoint.observe || checkpoint.observe.event === 'starter-loaded') continue;
            const domName = eventNames[checkpoint.observe.event];
            if (!domName) continue;
            const arming = ARMING_EVENTS.has(checkpoint.observe.event);
            const listener = event => {
                if (!matches(checkpoint.observe.match, event.detail || {})) return;
                if (arming) setArmed(previous => (previous[checkpoint.id] ?
                    previous : {...previous, [checkpoint.id]: true}));
                else complete(checkpoint.id, 'observed');
            };
            window.addEventListener(domName, listener);
            removers.push(() => window.removeEventListener(domName, listener));
        }
        return () => removers.forEach(remove => remove());
    }, [complete, lesson]);

    React.useEffect(() => {
        if (!lesson || initialEvent !== 'starter-loaded') return;
        for (const checkpoint of lesson.checkpoints) {
            if (checkpoint.observe && checkpoint.observe.event === initialEvent) {
                complete(checkpoint.id, 'observed');
            }
        }
    }, [complete, initialEvent, lesson]);

    if (collapsed) {
        return <aside ref={panel} className={styles.drawer} style={panelStyle}
            aria-label={text.library} data-testid="bw-lessons-collapsed">
            <header {...headerProps}><h2>{text.library}</h2>{panelButtons}</header>
        </aside>;
    }
    if (!lesson) {
        const visibleLessons = catalog.lessons.filter(item => {
            if (depthFilter && item.depth !== depthFilter) return false;
            const copy = localized(item.copy, lang);
            return lessonMatchesQuery(item, copy, query);
        });
        return (
            <aside
                className={styles.drawer}
                ref={panel}
                style={panelStyle}
                aria-label={text.library}
                data-testid="bw-lessons-library"
            >
                <header {...headerProps}>
                    <h2>{text.library}</h2>
                    {panelButtons}
                </header>
                <div className={styles.filters}>
                    <input
                        aria-label={text.search}
                        placeholder={text.search}
                        type="search"
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                    />
                    <select
                        aria-label={text.allLevels}
                        value={depthFilter}
                        onChange={event => setDepthFilter(event.target.value)}
                    >
                        <option value="">{text.allLevels}</option>
                        {['discover', 'foundation', 'practitioner', 'advanced', 'research'].map(depth => (
                            <option
                                key={depth}
                                value={depth}
                            >{depth}</option>
                        ))}
                    </select>
                </div>
                <div className={styles.catalog}>
                    {visibleLessons.map(item => {
                        const copy = localized(item.copy, lang);
                        const saved = loadProgress(item);
                        const count = Object.keys(saved).length;
                        return (
                            <button
                                className={styles.lessonCard}
                                data-lesson-id={item.id}
                                key={item.id}
                                type="button"
                                onClick={() => onSelectLesson(item.id)}
                            >
                                <span className={styles.lessonTitle}>{copy.title}</span>
                                <span className={styles.lessonMeta}>
                                    {`${item.depth} · ${item.ageGuidance} · ${item.minutes} min`}
                                </span>
                                {item.topic ? (
                                    <span className={styles.lessonTopic}>{item.topic.replace(/-/g, ' ')}</span>
                                ) : null}
                                <span className={styles.lessonObjective}>{copy.objective}</span>
                                <span className={styles.lessonProgress}>
                                    {count ? `${text.resume} · ${count}/${item.checkpoints.length}` : text.start}
                                </span>
                            </button>
                        );
                    })}
                    {visibleLessons.length === 0 ? <p className={styles.noResults}>{text.noResults}</p> : null}
                </div>
            </aside>
        );
    }

    const checkpoint = lesson.checkpoints[Math.min(step, lesson.checkpoints.length - 1)];
    const copy = localized(lesson.copy, lang);
    const checkpointCopy = localized(checkpoint.copy, lang);
    const variantCopy = lesson.variants && lesson.variants[selectedVariant] ?
        localized(lesson.variants[selectedVariant], lang) : '';
    const count = Object.keys(completed).length;
    const isComplete = count === lesson.checkpoints.length;
    const reset = () => {
        try {
            localStorage.removeItem(progressKey(lesson));
        } catch { /* private mode */ }
        setCompleted({});
        setStep(0);
        setHint(false);
    };

    return (
        <aside
            className={styles.drawer}
            ref={panel}
            style={panelStyle}
            aria-label={copy.title}
            data-testid="bw-guided-lesson"
        >
            <header {...headerProps}>
                <button
                    type="button"
                    onClick={() => onSelectLesson(null)}
                >{'‹ '}{text.back}</button>
                {panelButtons}
            </header>
            <div className={styles.lessonBody}>
                <div className={styles.badges}>
                    <span>{lesson.depth}</span><span>{lesson.ageGuidance}</span><span>{`${lesson.minutes} min`}</span>
                </div>
                <h2>{copy.title}</h2>
                <div className={styles.objective}><strong>{`${text.objective}: `}</strong>{copy.objective}</div>
                <button
                    className={styles.openProject}
                    type="button"
                    onClick={() => {
                        setProjectStatus('opening');
                        window.dispatchEvent(new CustomEvent('bw-open-lesson-project', {detail: lesson}));
                    }}
                >{text.openProject}</button>
                <span
                    className={styles.projectStatus}
                    aria-live="polite"
                >
                    {projectStatus === 'opening' ? text.opening :
                        (projectStatus === 'opened' ? text.opened : projectStatus)}
                </span>
                {lesson.languages.length ? (
                    <div className={styles.variantPicker}>
                        <strong>{`${text.viewAs}: `}</strong>
                        {lesson.languages.map(item => (
                            <button
                                className={item === selectedVariant ? styles.variantSelected : styles.variant}
                                key={item}
                                type="button"
                                onClick={() => setSelectedVariant(item)}
                            >{item}</button>
                        ))}
                        {variantCopy ? <p>{variantCopy}</p> : null}
                    </div>
                ) : null}
                <div
                    className={styles.progressBar}
                    aria-label={`${count}/${lesson.checkpoints.length} ${text.progress}`}
                >
                    <span style={{width: `${100 * count / lesson.checkpoints.length}%`}} />
                </div>
                <div className={styles.stepCount}>{`${step + 1} / ${lesson.checkpoints.length}`}</div>
                <section className={styles.checkpoint}>
                    <h3>{checkpointCopy.action}</h3>
                    <p>{checkpointCopy.explain}</p>
                    {hint ? <div className={styles.hint}>{checkpointCopy.hint}</div> : null}
                    {/* The bench is up. Said plainly, and NOT counted as the
                        measurement — see ARMING_EVENTS above. */}
                    {armed[checkpoint.id] && !completed[checkpoint.id] ?
                        <div className={styles.armed} data-testid="bw-lesson-armed">{text.benchReady}</div> :
                        null}
                    <button
                        className={styles.hintButton}
                        type="button"
                        onClick={() => setHint(value => !value)}
                    >
                        {hint ? text.hideHint : text.hint}
                    </button>
                    <button
                        className={completed[checkpoint.id] ? styles.completedButton : styles.completeButton}
                        data-testid="bw-lesson-complete"
                        type="button"
                        onClick={() => complete(checkpoint.id, 'manual')}
                    >
                        {completed[checkpoint.id] && completed[checkpoint.id].method === 'observed' ?
                            `✓ ${text.observed}` : completed[checkpoint.id] ? `✓ ${checkpointCopy.manual}` : checkpointCopy.manual}
                    </button>
                    <small>{text.manualNote}</small>
                </section>
                <nav className={styles.navigation}>
                    <button
                        disabled={step === 0}
                        type="button"
                        onClick={() => {
                            setStep(step - 1); setHint(false);
                        }}
                    >{text.previous}</button>
                    <button
                        data-testid="bw-lesson-next"
                        disabled={step >= lesson.checkpoints.length - 1}
                        type="button"
                        onClick={() => {
                            setStep(step + 1); setHint(false);
                        }}
                    >{text.next}</button>
                </nav>
                {isComplete ? <div className={styles.done}>{`✓ ${text.done}`}</div> : null}
                <button
                    className={styles.reset}
                    type="button"
                    onClick={reset}
                >{text.reset}</button>
            </div>
        </aside>
    );
};

GuidedLessons.propTypes = {
    initialEvent: PropTypes.string,
    lessonId: PropTypes.string,
    locale: PropTypes.string,
    onClose: PropTypes.func.isRequired,
    onSelectLesson: PropTypes.func.isRequired
};

export default GuidedLessons;
