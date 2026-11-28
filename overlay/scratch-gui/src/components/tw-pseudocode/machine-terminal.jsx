import React from 'react';
import MachineScreenHeader from './machine-screen-header.jsx';

const LinuxTerminal = React.lazy(() =>
    import(/* webpackChunkName: "bw-xterm" */ './linux-terminal.jsx')
);

export default function MachineTerminal({session, isFullScreen, onToggleFullScreen, locale}) {
    const [text, setText] = React.useState('');
    const [line, setLine] = React.useState('');
    const output = React.useRef(null);
    const exportOwner = React.useRef(null);
    const [exportBusy, setExportBusy] = React.useState(false);
    const [exportError, setExportError] = React.useState('');
    React.useEffect(() => {
        setExportBusy(false);
        setExportError('');
        return () => { exportOwner.current = null; };
    }, [session]);
    const exportFiles = async () => {
        if (exportOwner.current) return;
        const request = {};
        exportOwner.current = request;
        setExportBusy(true);
        setExportError('');
        try {
            await session.exportFiles();
        } catch (error) {
            if (exportOwner.current === request) setExportError(error.message);
        } finally {
            if (exportOwner.current === request) {
                exportOwner.current = null;
                setExportBusy(false);
            }
        }
    };
    React.useEffect(() => session.raw ? undefined : session.subscribe(setText), [session]);
    React.useLayoutEffect(() => {
        if (output.current) output.current.scrollTop = output.current.scrollHeight;
    }, [text]);
    return (
        <section aria-label={session.title} data-testid="bw-machine-terminal"
            style={{height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
                background: '#0d1117', color: '#d0d7de'}}>
            <MachineScreenHeader locale={locale} title={session.title} help={session.help}
                isFullScreen={isFullScreen} onToggleFullScreen={onToggleFullScreen}
                onExportFiles={session.exportFiles ? exportFiles : undefined} exportBusy={exportBusy} />
            {exportError && <div role="alert" style={{padding: '4px 8px'}}>{exportError}</div>}
            {session.raw ? (
                <div style={{flex: 1, minHeight: 0, overflow: 'auto'}}>
                    <React.Suspense fallback={<div data-testid="bw-linux-terminal-loading">…</div>}>
                        <LinuxTerminal key={session.raw.id} terminal={session.raw} />
                    </React.Suspense>
                </div>
            ) : (
                <React.Fragment>
                    <pre ref={output} data-testid="bw-serial-console" aria-label={session.title}
                        style={{flex: 1, minHeight: 0, margin: 0, padding: 8, overflow: 'auto',
                            fontSize: 14, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{text}</pre>
                    {session.send && (
                        <form onSubmit={event => {
                            event.preventDefault();
                            if (session.send(line)) setLine('');
                        }} style={{display: 'flex', gap: 4, padding: 6}}>
                            <input type="text" data-testid="bw-serial-input" aria-label={session.inputLabel}
                                value={line} onChange={event => setLine(event.target.value)}
                                style={{flex: 1, minWidth: 0, fontFamily: 'monospace'}} />
                            <button type="submit" data-testid="bw-serial-send"
                                aria-label={session.inputLabel} title={session.inputLabel}>↵</button>
                        </form>
                    )}
                </React.Fragment>
            )}
        </section>
    );
}
