import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import {projectTitleInitialState, setProjectTitle} from '../reducers/project-title';
import {setProjectUnchanged} from '../reducers/project-changed';
import {showStandardAlertWithMessage} from '../reducers/alerts';
import downloadBlob from '../lib/download-blob';
import {attachBrickwrightState} from '../lib/bw-project-bundle';
import {writeArtworkToZip} from '../lib/bw-artwork-bundle';
import {packActiveLms} from '../lib/mindstorms-lms';
import {saveNativeProject} from '../lib/tauri-bridge';
/**
 * Project saver component passes a downloadProject function to its child.
 * It expects this child to be a function with the signature
 *     function (downloadProject, props) {}
 * The component can then be used to attach project saving functionality
 * to any other component:
 *
 * <SB3Downloader>{(downloadProject, props) => (
 *     <MyCoolComponent
 *         onClick={downloadProject}
 *         {...props}
 *     />
 * )}</SB3Downloader>
 *
 * Called with no mode (or an event, as an onClick), it exports: a browser download, or in the
 * app the share picker / Save As of lib/download-blob.js. In the desktop app it can instead
 * save the project as a native document: `downloadProject('save')` writes back to the file
 * that was opened, `downloadProject('saveAs')` asks where (lib/tauri-bridge.js).
 */
class SB3Downloader extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'downloadProject'
        ]);
    }
    downloadProject (mode) {
        const project = this.props.vm?.runtime?.getTargetForStage?.();
        const documentMode = (mode === 'save' || mode === 'saveAs') && this.props.format === 'sb3' ?
            mode : null;
        // EVERY step here can fail, and until 2026-08-24 none of them reported it.
        // saveProjectSb3() rejecting, or downloadBlob() throwing, produced an
        // unhandled promise rejection: no dialog, no console entry the user would
        // find, nothing saved. On iOS that is exactly what "the app just crashes
        // and nothing is saved" looked like from the outside, and it made every
        // possible cause — serializer, memory, the blob download path — present
        // identically, which is why the report could not be acted on.
        //
        // The message is shown IN THE GUI rather than logged, because the person
        // who needs it is holding the device.
        this.props.saveProjectSb3()
            // Fold the Circuit / Code / Widgets tabs into the same .sb3 before it
            // leaves. Extra zip entries are inert to every existing reader, so
            // one format serves both directions — see lib/bw-project-bundle.js.
            // It returns the original blob if anything goes wrong: saving the
            // Scratch half beats saving nothing.
            .then(content => attachBrickwrightState(content, {
                project,
                mutateZip: zip => writeArtworkToZip(zip, this.props.vm)
            }))
            .then(content => (this.props.format === 'lms' ?
                packActiveLms(content, this.props.projectFilename.replace(/\.sb3$/i, ''),
                    {unchanged: !this.props.projectChanged}) : content))
            .then(content => {
                if (documentMode) {
                    return saveNativeProject(this.props.projectFilename, content, documentMode)
                        .then(result => {
                            if (!result.saved) return;
                            if (this.props.onSaveFinished) this.props.onSaveFinished();
                            this.props.onDocumentSaved(result.name);
                        });
                }
                if (this.props.onSaveFinished) {
                    this.props.onSaveFinished();
                }
                // downloadBlob is not async on the browser path but CAN throw
                // synchronously (blob URL creation, the anchor click), so it is
                // inside the chain rather than after it.
                return downloadBlob(this.props.format === 'lms' ?
                    this.props.projectFilename.replace(/\.sb3$/i, '.lms') : this.props.projectFilename, content);
            })
            .catch(err => {
                const detail = (err && (err.message || err.name)) || String(err);
                // eslint-disable-next-line no-console
                console.error('[brickwright] project export failed', err);
                if (this.props.onExportError) {
                    this.props.onExportError(detail);
                }
            });
    }
    render () {
        const {
            children
        } = this.props;
        return children(
            this.props.className,
            this.downloadProject
        );
    }
}

const getProjectFilename = (curTitle, defaultTitle) => {
    let filenameTitle = curTitle;
    if (!filenameTitle || filenameTitle.length === 0) {
        filenameTitle = defaultTitle;
    }
    return `${filenameTitle.substring(0, 100)}.sb3`;
};

SB3Downloader.propTypes = {
    children: PropTypes.func,
    className: PropTypes.string,
    onDocumentSaved: PropTypes.func,
    onExportError: PropTypes.func,
    onSaveFinished: PropTypes.func,
    projectFilename: PropTypes.string,
    projectChanged: PropTypes.bool,
    format: PropTypes.oneOf(['sb3', 'lms']),
    saveProjectSb3: PropTypes.func,
    vm: PropTypes.object
};
SB3Downloader.defaultProps = {
    className: '', format: 'sb3'
};

const mapStateToProps = state => ({
    vm: state.scratchGui.vm,
    saveProjectSb3: state.scratchGui.vm.saveProjectSb3.bind(state.scratchGui.vm),
    projectChanged: state.scratchGui.projectChanged,
    projectFilename: getProjectFilename(state.scratchGui.projectTitle, projectTitleInitialState)
});

// The dispatch prop was previously omitted entirely. It is needed now so an
// export failure can reach the GUI rather than only the console.
const mapDispatchToProps = dispatch => ({
    onExportError: detail => dispatch(showStandardAlertWithMessage('exportError', detail)),
    // A native document save leaves the editor in step with the file it wrote.
    onDocumentSaved: name => {
        if (name) dispatch(setProjectTitle(name.replace(/\.sb3$/i, '').substring(0, 100)));
        dispatch(setProjectUnchanged());
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SB3Downloader);
