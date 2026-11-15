// SPDX-License-Identifier: BSD-3-Clause
import React from 'react';

/** The owner may retain dismissal across model refreshes and notice remounts. */
export default class SimLabNotice extends React.Component {
    constructor (props) {
        super(props);
        this.state = {contentKey: JSON.stringify(props.content), dismissed: false};
    }

    static getDerivedStateFromProps (props, state) {
        const contentKey = JSON.stringify(props.content);
        return contentKey === state.contentKey ? null : {contentKey, dismissed: false};
    }

    render () {
        return (
            <div hidden={this.state.dismissed} data-testid={`${this.props.testId}-notice`} style={{position: 'relative', minWidth: 0}}>
                {this.props.children}
                <button type="button" data-testid={`${this.props.testId}-close`} aria-label={this.props.closeLabel}
                    title={this.props.closeLabel} onClick={() => {
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
