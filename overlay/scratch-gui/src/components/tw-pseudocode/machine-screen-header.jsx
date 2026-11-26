import React from 'react';

const button = {background: '#374151', color: '#fff', border: 0, borderRadius: 4,
    padding: '4px 9px', cursor: 'pointer'};

export default function MachineScreenHeader({title, help, isFullScreen, onToggleFullScreen}) {
    const [helpOpen, setHelpOpen] = React.useState(false);
    return (
        <header style={{position: 'relative', display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 8px', background: '#111827', color: '#cbd5e1', fontSize: 12}}>
            <span style={{flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'}}>{title}</span>
            {help && (
                <button type="button" style={button} aria-label="Screen help" title="Screen help"
                    aria-expanded={helpOpen} onClick={() => setHelpOpen(!helpOpen)}>ⓘ</button>
            )}
            {onToggleFullScreen && (
                <button type="button" style={button} data-testid="bw-machine-fullscreen"
                    onClick={onToggleFullScreen}>
                    {isFullScreen ? 'Exit full screen' : 'Full screen'}
                </button>
            )}
            {helpOpen && <div role="note" style={{position: 'absolute', top: '100%', right: 8, zIndex: 5,
                maxWidth: 'min(34rem, 95%)', padding: 8, borderRadius: 4, background: '#1e293b'}}>{help}</div>}
        </header>
    );
}
