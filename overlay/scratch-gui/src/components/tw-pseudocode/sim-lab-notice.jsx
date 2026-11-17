// SPDX-License-Identifier: BSD-3-Clause
import React from 'react';

const dismissalKey = props => `bw-robot-dismissed-notice:${props.testId}`;
const wasDismissed = (props, contentKey) => {
    try { return window.sessionStorage.getItem(dismissalKey(props)) === contentKey; }
    catch (_) { return false; }
};

/** Retain dismissal only for the same diagnostic content, including remounts. */
export default class SimLabNotice extends React.Component {
    constructor (props) {
        super(props);
        const contentKey = JSON.stringify(props.content);
        this.state = {contentKey, dismissed: wasDismissed(props, contentKey)};
    }

    static getDerivedStateFromProps (props, state) {
        const contentKey = JSON.stringify(props.content);
        return contentKey === state.contentKey ? null : {contentKey, dismissed: wasDismissed(props, contentKey)};
    }

    render () {
        return (
            <div hidden={this.state.dismissed} data-testid={`${this.props.testId}-notice`} style={{position: 'relative', minWidth: 0}}>
                {this.props.children}
                <button type="button" data-testid={`${this.props.testId}-close`} aria-label={this.props.closeLabel}
                    title={this.props.closeLabel} onClick={() => {
                        try { window.sessionStorage.setItem(dismissalKey(this.props), this.state.contentKey); }
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
