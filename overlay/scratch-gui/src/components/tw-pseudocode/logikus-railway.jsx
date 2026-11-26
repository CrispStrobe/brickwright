/* eslint-disable react/jsx-no-bind, max-len */
import React from 'react';
import PropTypes from 'prop-types';
import {railwayViolations} from '../../lib/logikus/railway.js';
import styles from './logikus-lab.css';

const violations = {
    'conflicting-routes': ['Both routes have a green signal.', 'Beide Fahrwege haben ein grünes Signal.'],
    'crossing-occupied': ['A signal is green while the crossing is occupied.', 'Ein Signal ist grün, obwohl die Kreuzung besetzt ist.'],
    'exit-a-occupied': ['Route A is green while exit A is occupied.', 'Fahrweg A ist grün, obwohl Ausfahrt A besetzt ist.'],
    'exit-b-occupied': ['Route B is green while exit B is occupied.', 'Fahrweg B ist grün, obwohl Ausfahrt B besetzt ist.'],
    'route-a-unrequested': ['Route A is green without a request.', 'Fahrweg A ist ohne Anforderung grün.'],
    'route-b-unrequested': ['Route B is green without a request.', 'Fahrweg B ist ohne Anforderung grün.']
};

export const railwayViolationText = (code, de) => violations[code]?.[de ? 1 : 0] || code;

const inputLabels = [
    ['Request route A', 'Fahrweg A anfordern'],
    ['Request route B', 'Fahrweg B anfordern'],
    ['Crossing occupied', 'Kreuzung besetzt'],
    ['Exit A occupied', 'Ausfahrt A besetzt'],
    ['Exit B occupied', 'Ausfahrt B besetzt']
];

function Train ({x, y, angle = 0}) {
    return <g transform={`translate(${x} ${y}) rotate(${angle})`}>
        <rect x="-30" y="-15" width="60" height="30" rx="7" fill="#b45309" stroke="#78350f" strokeWidth="2" />
        <rect x="-21" y="-9" width="12" height="18" rx="3" fill="#fef3c7" />
        <rect x="-2" y="-9" width="12" height="18" rx="3" fill="#fef3c7" />
        <path d="M 21 -8 V 8" stroke="#fef3c7" strokeWidth="3" />
    </g>;
}

/** A view of the existing inputs and contact-network outputs. Never derive
 * a live signal from the target formula: a wiring fault must remain visible.
 */
export default function LogikusRailway ({result, selectedLamp, onSwitch, onSelectLamp, onInspect, de}) {
    const say = (en, german) => de ? german : en;
    const switches = result.inputs.switches;
    const unsafe = railwayViolations(switches, result.lamps);
    const signal = index => result.lamps[index] ? say('GO', 'FAHRT') : say('STOP', 'HALT');
    const stateDescription = [
        `A: ${signal(0)}. B: ${signal(1)}.`,
        `${say('Crossing', 'Kreuzung')}: ${switches[2] ? say('occupied', 'besetzt') : say('clear', 'frei')}.`,
        `${say('Exit A', 'Ausfahrt A')}: ${switches[3] ? say('occupied', 'besetzt') : say('clear', 'frei')}.`,
        `${say('Exit B', 'Ausfahrt B')}: ${switches[4] ? say('occupied', 'besetzt') : say('clear', 'frei')}.`
    ].join(' ');

    return <section className={styles.railway} aria-label={say('Railway crossing', 'Bahnkreuzung')} data-testid="logikus-railway">
        <div className={styles.railwayHeading}>
            <div><h3>{say('Two routes, one crossing', 'Zwei Fahrwege, eine Kreuzung')}</h3>
                <p>{say('Set the requests and occupied sections. Your wires decide which signal may be green now.',
                    'Stelle Anforderungen und besetzte Abschnitte ein. Deine Drähte entscheiden, welches Signal jetzt grün sein darf.')}</p></div>
            <span className={styles.railwayTag}>{say('LIVE CIRCUIT', 'LIVE-SCHALTUNG')}</span>
        </div>
        <div className={styles.railwayLayout}>
            <div>
                <svg className={styles.railwayMap} viewBox="0 0 620 310" role="img" aria-label={stateDescription}>
                    <rect width="620" height="310" rx="16" fill="#edf3ef" />
                    <path d="M 20 50 Q 120 15 200 40 M 400 265 Q 485 300 600 265" fill="none" stroke="#dce7df" strokeWidth="24" strokeLinecap="round" />
                    <rect x="261" y="116" width="88" height="88" rx="14" fill={switches[2] ? '#fde68a' : '#d7e0df'} stroke="#94a3a2" strokeDasharray="5 5" />
                    {['M 40 160 H 580', 'M 100 280 L 510 40'].map((d, index) => <g key={d}>
                        <path d={d} fill="none" stroke="#8a9b94" strokeWidth="29" strokeDasharray="5 12" />
                        <path d={d} fill="none" stroke="#334155" strokeWidth="19" />
                        <path d={d} fill="none" stroke="#e5ece8" strokeWidth="11" />
                        {result.lamps[index] && <path d={d} fill="none" stroke="#16a34a" strokeWidth="7" opacity=".85" />}
                    </g>)}
                    <g fill="#334155" fontFamily="inherit" fontSize="24" fontWeight="700">
                        <text x="42" y="125">A →</text><text x="513" y="212">A</text>
                        <text x="69" y="258">B</text><text x="515" y="50">B ↗</text>
                    </g>
                    <g stroke="#334155" strokeWidth="4">
                        <path d="M 132 120 V 145 M 203 245 V 265" />
                        <circle cx="132" cy="112" r="15" fill={result.lamps[0] ? '#16a34a' : '#dc2626'} />
                        <circle cx="203" cy="235" r="15" fill={result.lamps[1] ? '#16a34a' : '#dc2626'} />
                    </g>
                    <g fill="#475569" fontFamily="inherit" fontSize="17" fontWeight="600">
                        <text x="305" y="226" textAnchor="middle">S2</text>
                        <text x="485" y="126" textAnchor="middle">S3</text>
                        <text x="430" y="47" textAnchor="middle">S4</text>
                    </g>
                    {switches[2] && <Train x={305} y={160} />}
                    {switches[3] && <Train x={485} y={160} />}
                    {switches[4] && <Train x={430} y={87} angle={-30.3} />}
                </svg>
                <div className={styles.railwaySignals} aria-label={say('Railway signals', 'Bahnsignale')}>
                    {[0, 1].map(index => <button key={index} type="button" className={styles.railwaySignal}
                        data-signal={index} data-green={result.lamps[index]} aria-pressed={selectedLamp === index}
                        aria-label={`${say('Route', 'Fahrweg')} ${index ? 'B' : 'A'}, L${index}: ${signal(index)}`}
                        onClick={() => onSelectLamp(index)}>
                        <span className={styles.signalLight} aria-hidden="true" />
                        <span><strong>{`${say('Route', 'Fahrweg')} ${index ? 'B' : 'A'}`}</strong><small>{`L${index} = ${Number(result.lamps[index])}`}</small></span>
                        <b>{signal(index)}</b>
                    </button>)}
                </div>
                <p className={styles.railwayCaption}>{say('Select a signal to trace its lamp. STOP means its green output is off; no separate red lamp is wired.',
                    'Wähle ein Signal, um seinen Lampenweg zu verfolgen. HALT bedeutet, dass sein grüner Ausgang aus ist; eine rote Lampe ist nicht separat verdrahtet.')}</p>
                <button type="button" onClick={onInspect}>{say('Inspect the wiring', 'Verdrahtung ansehen')}</button>
            </div>
            <div className={styles.railwayControls} role="group" aria-label={say('Railway inputs', 'Bahneingänge')}>
                {inputLabels.map((label, index) => <button key={index} type="button" role="switch"
                    className={styles.railwayInput} data-input={index} data-occupied={index >= 2 && switches[index]}
                    aria-checked={switches[index]} aria-label={`${say('Railway input', 'Bahneingang')} S${index}: ${label[de ? 1 : 0]}`}
                    onClick={() => onSwitch(index)}>
                    <span className={styles.railwayInputId}>{`S${index}`}</span>
                    <strong>{label[de ? 1 : 0]}</strong>
                    <span>{index < 2 ? (switches[index] ? say('Requested', 'Angefordert') : say('No request', 'Keine Anforderung')) :
                        (switches[index] ? say('Occupied', 'Besetzt') : say('Clear', 'Frei'))}</span>
                </button>)}
            </div>
        </div>
        <div role="status" className={styles.railwayState} data-safe={unsafe.length === 0}>
            <strong>{unsafe.length ? say('Unsafe permission in this state', 'Unsichere Freigabe in diesem Zustand') :
                say('This state passes the safety checks', 'Dieser Zustand besteht die Sicherheitsprüfungen')}</strong>
            {unsafe.length > 0 && <ul>{unsafe.map(code => <li key={code}>{railwayViolationText(code, de)}</li>)}</ul>}
            <p>{say('Use Test all states to check every input combination and the required behavior.',
                'Mit Alle Zustände testen prüfst du jede Eingangskombination und das geforderte Verhalten.')}</p>
        </div>
        <details className={styles.railwayRules}><summary>{say('Permission rules and model limits', 'Freigaberegeln und Modellgrenzen')}</summary>
            <p>{say('Both requests mean both signals must stop. Each route needs a request, no competing request, a clear crossing and its own clear exit. The other exit does not block it.',
                'Zwei Anforderungen bedeuten Halt für beide Signale. Jeder Fahrweg braucht eine Anforderung, keine konkurrierende Anforderung sowie eine freie Kreuzung und eigene Ausfahrt. Die andere Ausfahrt sperrt ihn nicht.')}</p>
            <code>L0 = S0 ∧ ¬S1 ∧ ¬S2 ∧ ¬S3</code><code>L1 = S1 ∧ ¬S0 ∧ ¬S2 ∧ ¬S4</code>
            <p>{say('Input and signal mappings stay fixed even if you rename their labels. This experiment checks the present state; it does not move trains, reserve routes or model timing.',
                'Eingangs- und Signalzuordnungen bleiben bei einer Umbenennung gleich. Dieses Experiment prüft den aktuellen Zustand; es bewegt keine Züge, reserviert keine Fahrwege und modelliert keine Zeitabläufe.')}</p>
        </details>
    </section>;
}

LogikusRailway.propTypes = {result: PropTypes.object.isRequired, selectedLamp: PropTypes.number.isRequired,
    onSwitch: PropTypes.func.isRequired, onSelectLamp: PropTypes.func.isRequired, onInspect: PropTypes.func.isRequired,
    de: PropTypes.bool};
