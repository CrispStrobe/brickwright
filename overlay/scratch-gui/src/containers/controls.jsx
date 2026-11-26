import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import VM from 'scratch-vm';
import {connect} from 'react-redux';

import ControlsComponent from '../components/controls/controls.jsx';

class Controls extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, ['handleGreenFlagClick', 'handleStopAllClick']);
    }
    handleGreenFlagClick (e) {
        e.preventDefault();
        if (e.shiftKey) {
            this.props.vm.setTurboMode(!this.props.turbo);
        } else {
            const runtime = this.props.vm.runtime;
            if (window.__bwMachineExtracted?.kind === 'cardiac') {
                window.dispatchEvent(new CustomEvent('bw-cardiac-run-request'));
                return;
            }
            if (window.__bwMachineExtracted?.kind === 'cp1') {
                window.dispatchEvent(new CustomEvent('bw-cp1-run-request'));
                return;
            }

            const device = runtime.bwDeviceId || (runtime.stc && runtime.stc.device);
            if (device === 'microbit' || device === 'calliopemini') {
                // The green flag is the global Run affordance. Simulator-only
                // boards do not have a Scratch VM execution target, so hand
                // this real user gesture to the MicroPython runner instead of
                // silently green-flagging an unrelated/empty Scratch stage.
                window.dispatchEvent(new CustomEvent('bw-microbit-run-request', {
                    detail: {source: 'green-flag', autostart: true}
                }));
                return;
            }
            if (!this.props.isStarted) this.props.vm.start();
            // The circuit designer listens to the same user-level action. This
            // keeps the Scratch green flag as the single, unsurprising start
            // control for both block scripts and a visible circuit simulation.
            //
            // BEFORE the VM starts, and synchronously: the designer clears its
            // board for the run (reset, every MCU pin re-armed) when it sees this
            // event, and the program's writes must come after that clear. It was
            // dispatched on a setTimeout(0) after vm.greenFlag(), against the VM's
            // own step interval, and a program's first write was wiped whenever
            // the VM stepped first (task B7, measured in a real browser: `turn on
            // led` at 68.7 ms, the clear at 174 ms). vm.greenFlag() only queues the
            // hats; the scripts run on the VM's next step, after this returns.
            window.dispatchEvent(new CustomEvent('bw-green-flag'));
            this.props.vm.greenFlag();
        }
    }
    handleStopAllClick (e) {
        e.preventDefault();
        if (window.__bwMachineExtracted?.kind === 'cardiac') {
            window.dispatchEvent(new CustomEvent('bw-cardiac-stop-request'));
            return;
        }
        if (window.__bwMachineExtracted?.kind === 'cp1') {
            window.dispatchEvent(new CustomEvent('bw-cp1-stop-request'));
            return;
        }
        this.props.vm.stopAll();
        window.setTimeout(() => window.dispatchEvent(new CustomEvent('bw-stop-all')), 0);
    }
    render () {
        const {vm, isStarted, projectRunning, turbo, ...props} = this.props;
        return <ControlsComponent {...props} active={projectRunning} turbo={turbo}
            onGreenFlagClick={this.handleGreenFlagClick} onStopAllClick={this.handleStopAllClick} />;
    }
}

Controls.propTypes = {
    isStarted: PropTypes.bool.isRequired,
    projectRunning: PropTypes.bool.isRequired,
    turbo: PropTypes.bool.isRequired,
    vm: PropTypes.instanceOf(VM)
};

const mapStateToProps = state => ({
    isStarted: state.scratchGui.vmStatus.running,
    projectRunning: state.scratchGui.vmStatus.running,
    turbo: state.scratchGui.vmStatus.turbo
});

export default connect(mapStateToProps, () => ({}))(Controls);
