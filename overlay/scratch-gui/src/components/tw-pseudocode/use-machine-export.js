// SPDX-License-Identifier: BSD-3-Clause
import React from 'react';

/** Keep asynchronous export state scoped to the console that started it. */
export default function useMachineExport (session) {
    const owner = React.useRef(null);
    const [exportBusy, setExportBusy] = React.useState(false);
    const [exportError, setExportError] = React.useState('');
    React.useEffect(() => {
        setExportBusy(false);
        setExportError('');
        return () => { owner.current = null; };
    }, [session]);
    const runExport = async action => {
        if (owner.current) return;
        const request = {};
        owner.current = request;
        const current = () => owner.current === request;
        setExportBusy(true);
        setExportError('');
        try {
            await action(current);
        } catch (error) {
            if (current()) setExportError(error.message || String(error));
        } finally {
            if (current()) {
                owner.current = null;
                setExportBusy(false);
            }
        }
    };
    return {runExport, exportBusy, exportError};
}
