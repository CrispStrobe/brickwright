import React from 'react';
import PropTypes from 'prop-types';

const BUTTON = {padding: '3px 7px', borderRadius: 3, border: '1px solid #2c3e50',
    background: '#16213e', color: '#ecf0f1', fontFamily: 'monospace', fontSize: 11};

const cursor = value => value ? `${value.branchId}#${value.eventCursor}` : '—';

const DebugDivergenceBisection = ({status, disabled, onMarkGood, onMarkBad, onStart, onCancel}) => {
    const running = status?.phase === 'running' || status?.phase === 'cancelling';
    return <section data-debug-divergence-bisection style={{display: 'flex', gap: 5,
        alignItems: 'center', flexWrap: 'wrap'}}>
        <button data-debug-bisection-mark-good style={BUTTON} disabled={disabled || running}
            title={`Mark good · ${cursor(status?.good)}`} aria-label="Mark good" aria-pressed={!!status?.good}
            onClick={onMarkGood}><span data-debug-bisection-good>✓</span></button>
        <button data-debug-bisection-mark-bad style={BUTTON} disabled={disabled || running}
            title={`Mark bad · ${cursor(status?.bad)}`} aria-label="Mark bad" aria-pressed={!!status?.bad}
            onClick={onMarkBad}><span data-debug-bisection-bad>✕</span></button>
        <button data-debug-bisection-start style={BUTTON}
            disabled={disabled || running || !status?.good || !status?.bad} onClick={onStart} title="Bisect divergence" aria-label="Bisect divergence">⇄</button>
        {running && <button data-debug-bisection-cancel style={BUTTON} disabled={!running}
            onClick={onCancel} title="Cancel bisection" aria-label="Cancel bisection">⏹</button>}
        {running ? <progress data-debug-bisection-progress max={status.maxProbes || 1}
            value={status.probes || 0} /> : null}
        {status?.result ? <span data-debug-bisection-result role="status">
            {status.result.accepted ? `First mismatch #${status.result.firstMismatchEventSeq}` :
                (status.result.reason || status.result.code)}
        </span> : null}
    </section>;
};

DebugDivergenceBisection.propTypes = {
    status: PropTypes.object,
    disabled: PropTypes.bool,
    onMarkGood: PropTypes.func.isRequired,
    onMarkBad: PropTypes.func.isRequired,
    onStart: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
};

export default DebugDivergenceBisection;
