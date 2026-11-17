// SPDX-License-Identifier: BSD-3-Clause
import React from 'react';

const dismissalKey = props => `bw-robot-dismissed-notice:${props.testId}`;
// Keep session history in memory as well, so disabled storage or quota failures
// cannot resurrect a dismissed warning while the application remains open.
const dismissalHistory = new Map();
const readDismissals = props => {
    const key = dismissalKey(props);
    const keys = dismissalHistory.get(key) || new Set();
    try {
        const stored = JSON.parse(window.sessionStorage.getItem(key) || '[]');
        if (Array.isArray(stored)) for (const item of stored) {
            if (typeof item === 'string') keys.add(item);
        }
    } catch (_) { /* The in-memory history remains available. */ }
    dismissalHistory.set(key, keys);
    return keys;
};
const noticeContentKey = props => JSON.stringify([props.content, props.displayContent]);

/** Retain dismissal only for the same diagnostic content, including remounts. */
export default class SimLabNotice extends React.Component {
    constructor (props) {
        super(props);
        const contentKey = noticeContentKey(props);
        const dismissedKeys = readDismissals(props);
        this.state = {contentKey, dismissed: dismissedKeys.has(contentKey)};
    }

    static getDerivedStateFromProps (props, state) {
        const contentKey = noticeContentKey(props);
        if (contentKey === state.contentKey) return null;
        const dismissedKeys = readDismissals(props);
        return {contentKey, dismissed: dismissedKeys.has(contentKey)};
    }

    render () {
        return (
            <div hidden={this.state.dismissed} data-testid={`${this.props.testId}-notice`} style={{position: 'relative', minWidth: 0}}>
                {this.props.children}
                <button type="button" data-testid={`${this.props.testId}-close`} aria-label={this.props.closeLabel}
                    title={this.props.closeLabel} onClick={() => {
                        const dismissedKeys = readDismissals(this.props);
                        dismissedKeys.add(this.state.contentKey);
                        try { window.sessionStorage.setItem(dismissalKey(this.props), JSON.stringify([...dismissedKeys])); }
                        catch (_) { /* In-memory dismissal still works when storage is unavailable. */ }
                        if (this.props.onDismiss) this.props.onDismiss();
                        this.setState({dismissed: true});
                    }}
                    style={{position: 'absolute', top: 2, right: 3, padding: '2px 6px', border: '1px solid #94a3b8', borderRadius: 4,
                        background: '#fff', color: '#334155', cursor: 'pointer', fontSize: 16, lineHeight: '20px'}}>
                    <span aria-hidden="true">×</span>
                </button>
            </div>
        );
    }
}
