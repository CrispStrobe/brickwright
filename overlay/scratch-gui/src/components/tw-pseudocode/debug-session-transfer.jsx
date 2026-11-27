import React from 'react';
import PropTypes from 'prop-types';

const BUTTON = {
    padding: '3px 7px', borderRadius: 3, border: '1px solid #2c3e50',
    background: '#16213e', color: '#ecf0f1', fontFamily: 'monospace', fontSize: 11,
    cursor: 'pointer'
};

/** Browser transport only; bundle validation and mutation remain runner-owned. */
const DebugSessionTransfer = ({t, disabled, status, onExport, onImport}) => (
    <div data-debug-session-transfer style={{display: 'flex', gap: 5, alignItems: 'center'}}>
        <button data-debug-session-export style={BUTTON} disabled={disabled}
            onClick={onExport} title={t('exportSession')} aria-label={t('exportSession')}>⇧</button>
        <label data-debug-session-import-label title={t('importSession')} style={{...BUTTON,
            cursor: disabled ? 'not-allowed' : 'pointer'}}>
            {'⇩'}
            <input data-debug-session-import aria-label={t('importSession')} type="file" accept=".bwdebug,application/json"
                disabled={disabled} style={{display: 'none'}} onChange={event => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) onImport(file);
                }} />
        </label>
        {status ? <span data-debug-session-transfer-status role={status.accepted === false ? 'alert' : 'status'}>
            {status.message || status.reason || status.code}
        </span> : null}
    </div>
);

DebugSessionTransfer.propTypes = {
    t: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    status: PropTypes.object,
    onExport: PropTypes.func.isRequired,
    onImport: PropTypes.func.isRequired
};

export default DebugSessionTransfer;
