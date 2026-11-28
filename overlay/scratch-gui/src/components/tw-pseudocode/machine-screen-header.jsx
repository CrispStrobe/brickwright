import React from 'react';
import {browserLocale, makeT} from '../../lib/bw-i18n.js';

const t = makeT({
    en: {help: 'Screen help', fullScreen: 'Full screen', exitFullScreen: 'Exit full screen', exportFiles: 'Export files'},
    de: {help: 'Hilfe zum Bildschirm', fullScreen: 'Vollbild', exitFullScreen: 'Vollbild verlassen', exportFiles: 'Dateien exportieren'}
});

const button = {background: '#374151', color: '#fff', border: 0, borderRadius: 4,
    padding: '4px 9px', cursor: 'pointer'};

export default function MachineScreenHeader({title, help, isFullScreen, onToggleFullScreen, onExportFiles, exportBusy, locale = browserLocale()}) {
    const [helpOpen, setHelpOpen] = React.useState(false);
    return (
        <header style={{position: 'relative', display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 8px', background: '#111827', color: '#cbd5e1', fontSize: 12}}>
            <span style={{flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'}}>{title}</span>
            {onExportFiles && (
                <button type="button" style={button} disabled={exportBusy} onClick={onExportFiles}>
                    {t(locale, 'exportFiles')}
                </button>
            )}
            {help && (
                <button type="button" style={button} aria-label={t(locale, 'help')} title={t(locale, 'help')}
                    aria-expanded={helpOpen} onClick={() => setHelpOpen(!helpOpen)}>ⓘ</button>
            )}
            {onToggleFullScreen && (
                <button type="button" style={button} data-testid="bw-machine-fullscreen"
                    onClick={onToggleFullScreen}>
                    {t(locale, isFullScreen ? 'exitFullScreen' : 'fullScreen')}
                </button>
            )}
            {helpOpen && <div role="note" style={{position: 'absolute', top: '100%', right: 8, zIndex: 5,
                maxWidth: 'min(34rem, 95%)', padding: 8, borderRadius: 4, background: '#1e293b'}}>{help}</div>}
        </header>
    );
}
