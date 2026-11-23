// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The Robot Lab build editor's shortcut sheet (the ? key or its button): every
// mouse, keyboard and touch control in the learner's language, as a dialog over
// the pane. Esc or Close shuts it and gives the keyboard back to the 3D view.

import React from 'react';

const SimLabShortcuts = ({T, onClose, cameraGestures, onCameraPreference, locale, onCoach = null}) => {
    const de = /^de/i.test(locale);
    const pan = de ? 'Verschieben' : 'Pan';
    const orbit = de ? 'Drehen' : 'Orbit';
    const zoom = de ? 'Zoomen' : 'Zoom';
    const closeRef = React.useRef(null);
    React.useEffect(() => { closeRef.current?.focus(); }, []);
    return (
        <div data-testid="bw-sim-lab-shortcut-sheet" role="dialog" aria-modal="true" aria-label={T.sheetTitle}
            onKeyDown={e => { if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); e.stopPropagation(); onClose(); } }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
            style={{position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(15, 23, 42, 0.35)', display: 'flex',
                alignItems: 'flex-start', justifyContent: 'center', padding: 12, boxSizing: 'border-box', overflowY: 'auto'}}>
            <div style={{background: '#fff', borderRadius: 10, padding: 14, maxWidth: 720, width: '100%', boxSizing: 'border-box', fontSize: 12,
                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.35)'}}>
                <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
                    <strong style={{flex: '1 1 auto', fontSize: 14}}>{T.sheetTitle}</strong>
                    {onCoach && T.coachAgain && (
                        <button type="button" data-testid="bw-sim-lab-coach-again" onClick={onCoach}
                            style={{padding: '4px 10px', marginRight: 6, borderRadius: 6, border: '1px solid #f59e0b', background: '#fffbeb', cursor: 'pointer'}}>{T.coachAgain}</button>
                    )}
                    <button ref={closeRef} type="button" data-testid="bw-sim-lab-shortcuts-close" onClick={onClose}
                        style={{padding: '4px 10px', borderRadius: 6, border: '1px solid #94a3b8', background: '#fff', cursor: 'pointer'}}>{T.close}</button>
                </div>
                {onCameraPreference && cameraGestures && (
                    <label style={{display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8}}>
                        <strong>{de ? 'Zwei Finger bewegen' : 'Two-finger slide'}</strong>
                        <select data-testid="bw-sim-lab-wheel-mode" value={cameraGestures.trackpadSlide} onChange={e => onCameraPreference('trackpadSlide', e.target.value)}
                            style={{font: 'inherit', fontSize: 12, padding: '2px 4px'}}>
                            <option value="pan">{pan}</option>
                            <option value="orbit">{orbit}</option>
                            <option value="zoom">{zoom}</option>
                        </select>
                    </label>
                )}
                {onCameraPreference && cameraGestures && (
                    <label style={{display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8}}>
                        <strong>{de ? 'Mit Sekundärklick ziehen' : 'Secondary-button drag'}</strong>
                        <select data-testid="bw-sim-lab-mouse-preset" value={cameraGestures.secondaryDrag} onChange={e => onCameraPreference('secondaryDrag', e.target.value)}
                            style={{font: 'inherit', fontSize: 12, padding: '2px 4px'}}>
                            <option value="orbit">{orbit}</option>
                            <option value="pan">{pan}</option>
                        </select>
                    </label>
                )}
                <div style={{display: 'flex', flexWrap: 'wrap', gap: 14}}>
                    {T.sheet.map(([title, rows]) => (
                        <section key={title} style={{flex: '1 1 200px', minWidth: 0}}>
                            <h3 style={{fontSize: 13, margin: '0 0 4px'}}>{title}</h3>
                            <table style={{borderCollapse: 'collapse', width: '100%'}}>
                                <tbody>
                                    {rows.map(([keys, what]) => (
                                        <tr key={keys} style={{borderTop: '1px solid #e2e8f0'}}>
                                            <td style={{padding: '3px 6px 3px 0', width: '42%', verticalAlign: 'top'}}>
                                                <kbd style={{fontFamily: 'inherit', fontWeight: 600, background: '#f1f5f9', borderRadius: 4, padding: '1px 4px'}}>{keys}</kbd>
                                            </td>
                                            <td style={{padding: '3px 0', color: '#334155'}}>{what}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SimLabShortcuts;
