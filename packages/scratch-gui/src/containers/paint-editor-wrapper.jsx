import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import bindAll from 'lodash.bindall';
import VM from 'scratch-vm';
import {inlineSvgFonts} from 'scratch-svg-renderer';
import {COSTUME_PRECISION_EVENT, getCostumePrecision} from '../lib/bw-costume-precision.js';
import {getUndoState} from '../lib/global-undo.js';
import {notifyEditorMenuActions, registerEditorMenuActions} from '../lib/editor-menu-actions.js';
import {getCostumeDocument, resetCostumeDocument, setCostumeDocument, syncAnimationResources} from '../lib/bw-artwork-bundle';

import {connect} from 'react-redux';
import DynamicReducerContext from '../lib/dynamic-reducer-context';

// Split the Paper-backed reducer from the React editor so fetching, parsing and
// installing both cannot become one activation task. Requests are shared, while
// reducer installation remains store-local. A rejected stage resets only its
// own promise, allowing the retry control to resume at the failed boundary.
let paintReducerRequest = null;
const loadPaintReducer = () => {
    if (!paintReducerRequest) {
        paintReducerRequest = import(
            /* webpackChunkName: "paint-reducer" */
            '../lib/lazy-paint-reducer'
        ).catch(error => {
            paintReducerRequest = null;
            throw error;
        });
    }
    return paintReducerRequest;
};

let paintEditorRequest = null;
const loadPaintEditor = () => {
    if (!paintEditorRequest) {
        paintEditorRequest = import(/* webpackChunkName: "paint-editor" */ '../lib/lazy-paint-editor.jsx')
            .catch(error => {
                paintEditorRequest = null;
                throw error;
            });
    }
    return paintEditorRequest;
};

// A timer queues a fresh task without charging the already-tight activation
// budget for a whole animation frame.
const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));

class PaintEditorWrapper extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleEditorMenuActions',
            'handlePrecisionPreference',
            'editorMenuActions',
            'handleUpdateImage',
            'handleUpdateName',
            'loadEditor'
        ]);
        this.state = {PaintEditor: null, loadError: null,
            precisionDrawing: Boolean(process.env.BW_ENABLE_CAD && getCostumePrecision())};
        this.mounted = false;
        this.menuChannels = new Map();
        this.loadGeneration = 0;
    }
    componentDidMount () {
        this.mounted = true;
        if (process.env.BW_ENABLE_CAD) window.addEventListener(COSTUME_PRECISION_EVENT, this.handlePrecisionPreference);
        this.unregisterMenu = registerEditorMenuActions('costumes', this.editorMenuActions);
        this.loadEditor();
    }
    componentWillUnmount () {
        this.mounted = false;
        if (process.env.BW_ENABLE_CAD) window.removeEventListener(COSTUME_PRECISION_EVENT, this.handlePrecisionPreference);
        this.menuChannels.clear();
        if (this.unregisterMenu) this.unregisterMenu();
        this.loadGeneration++;
    }
    componentDidUpdate (prevProps, prevState) {
        if (prevProps.imageId !== this.props.imageId || prevProps.isSelectedEditor !== this.props.isSelectedEditor ||
            prevProps.selectedCostumeIndex !== this.props.selectedCostumeIndex ||
            prevProps.getFileMenuActions !== this.props.getFileMenuActions ||
            prevState.PaintEditor !== this.state.PaintEditor || prevState.loadError !== this.state.loadError) notifyEditorMenuActions();
    }
    handlePrecisionPreference () {
        this.setState({precisionDrawing: getCostumePrecision()});
    }
    handleEditorMenuActions (channel, getter, owner) {
        if (!this.mounted || !['paint', 'selection'].includes(channel) || typeof getter !== 'function' ||
            owner !== this.props.imageId) return () => {};
        const entry = {getter, owner};
        this.menuChannels.set(channel, entry);
        notifyEditorMenuActions();
        return () => {
            if (this.menuChannels.get(channel) !== entry) return;
            this.menuChannels.delete(channel);
            notifyEditorMenuActions();
        };
    }
    editorMenuActions () {
        const target = this.props.vm.editingTarget;
        const costume = target?.sprite?.costumes?.[this.props.selectedCostumeIndex];
        if (!this.mounted || !this.state.PaintEditor || this.state.loadError || this.props.isSelectedEditor !== true ||
            getUndoState().surface !== 'costumes' || !costume || target.currentCostume !== this.props.selectedCostumeIndex ||
            this.props.imageId !== `${target.id}${costume.skinId}`) return null;
        const actions = Object.create(null);
        const append = candidate => {
            if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return;
            for (const [name, action] of Object.entries(candidate)) {
                if (['__proto__', 'constructor', 'prototype'].includes(name) || !action || typeof action.label !== 'string' || typeof action.run !== 'function' ||
                    !['file', 'edit'].includes(action.location) || typeof action.enabled !== 'boolean' ||
                    Object.prototype.hasOwnProperty.call(actions, name)) continue;
                actions[name] = action;
            }
        };
        try {
            if (typeof this.props.getFileMenuActions === 'function') append(this.props.getFileMenuActions());
            for (const {getter, owner} of this.menuChannels.values()) {
                if (owner === this.props.imageId) append(getter());
            }
        } catch (error) { return null; }
        return actions;
    }
    loadEditor () {
        const generation = ++this.loadGeneration;
        if (this.state.loadError) this.setState({loadError: null});
        loadPaintReducer().then(module => {
            if (!this.mounted || generation !== this.loadGeneration) return;
            if (!this.props.installReducer) {
                throw new Error('The paint editor requires a dynamic reducer installer');
            }
            this.props.installReducer('scratchPaint', module.default);
            return yieldTask();
        }).then(() => {
            if (!this.mounted || generation !== this.loadGeneration) return null;
            return loadPaintEditor();
        }).then(module => {
            if (!module || !this.mounted || generation !== this.loadGeneration) return;
            return yieldTask().then(() => module);
        }).then(module => {
            if (!module || !this.mounted || generation !== this.loadGeneration) return;
            if (this.mounted && generation === this.loadGeneration) {
                this.setState({PaintEditor: module.default, loadError: null});
            }
        }).catch(error => {
            if (this.mounted && generation === this.loadGeneration) this.setState({loadError: error});
        });
    }
    shouldComponentUpdate (nextProps, nextState) {
        return this.props.isSelectedEditor !== nextProps.isSelectedEditor ||
            this.props.getFileMenuActions !== nextProps.getFileMenuActions ||
            this.props.selectedCostumeIndex !== nextProps.selectedCostumeIndex ||
            this.props.imageId !== nextProps.imageId ||
            this.props.rtl !== nextProps.rtl ||
            this.props.name !== nextProps.name ||
            this.state.precisionDrawing !== nextState.precisionDrawing ||
            this.state.PaintEditor !== nextState.PaintEditor ||
            this.state.loadError !== nextState.loadError;
    }
    handleUpdateName (name) {
        this.props.vm.renameCostume(this.props.selectedCostumeIndex, name);
    }
    handleUpdateImage (isVector, image, rotationCenterX, rotationCenterY, bitmapDocument) {
        const costume = this.props.vm.editingTarget?.sprite?.costumes?.[this.props.selectedCostumeIndex];
        if (isVector) {
            this.props.vm.updateSvg(
                this.props.selectedCostumeIndex,
                image,
                rotationCenterX,
                rotationCenterY);
            setCostumeDocument(costume, {version: 1, layers: [{id: 'base', type: 'vector',
                name: 'Artwork', visible: true, locked: false, opacity: 1,
                content: {kind: 'svg', value: image}}]});
        } else {
            this.props.vm.updateBitmap(
                this.props.selectedCostumeIndex,
                image,
                rotationCenterX,
                rotationCenterY,
                2 /* bitmapResolution */);
            if (bitmapDocument) setCostumeDocument(costume, bitmapDocument);
            else resetCostumeDocument(costume, this.props.vm);
        }
        syncAnimationResources(this.props.vm);
    }
    render () {
        if (!this.props.imageId) return null;
        if (this.state.loadError) {
            return (
                <button type="button" onClick={this.loadEditor}>
                    <FormattedMessage
                        defaultMessage="Retry costume editor"
                        description="Button to retry loading the costume paint editor"
                        id="gui.costumeTab.retryPaintEditor"
                    />
                </button>
            );
        }
        const PaintEditor = this.state.PaintEditor;
        if (!PaintEditor) return null;
        const {
            selectedCostumeIndex,
            getFileMenuActions, // eslint-disable-line no-unused-vars
            isSelectedEditor, // eslint-disable-line no-unused-vars
            installReducer, // eslint-disable-line no-unused-vars
            vm,
            ...componentProps
        } = this.props;

        return (
            <PaintEditor
                {...componentProps}
                onEditorMenuActions={this.handleEditorMenuActions}
                editorMenuOwner={this.props.imageId}
                precisionDrawing={this.state.precisionDrawing && isSelectedEditor === true}
                artworkDocument={getCostumeDocument(vm.editingTarget.sprite.costumes[selectedCostumeIndex])}
                image={vm.getCostume(selectedCostumeIndex)}
                onUpdateImage={this.handleUpdateImage}
                onUpdateName={this.handleUpdateName}
                fontInlineFn={inlineSvgFonts}
            />
        );
    }
}

PaintEditorWrapper.propTypes = {
    imageFormat: PropTypes.string.isRequired,
    imageId: PropTypes.string.isRequired,
    editorTools: PropTypes.node,
    getFileMenuActions: PropTypes.func,
    isSelectedEditor: PropTypes.bool,
    installReducer: PropTypes.func,
    name: PropTypes.string,
    rotationCenterX: PropTypes.number,
    rotationCenterY: PropTypes.number,
    rtl: PropTypes.bool,
    selectedCostumeIndex: PropTypes.number.isRequired,
    vm: PropTypes.instanceOf(VM)
};

const mapStateToProps = (state, {selectedCostumeIndex}) => {
    const targetId = state.scratchGui.vm.editingTarget.id;
    const sprite = state.scratchGui.vm.editingTarget.sprite;
    // Make sure the costume index doesn't go out of range.
    const index = selectedCostumeIndex < sprite.costumes.length ?
        selectedCostumeIndex : sprite.costumes.length - 1;
    const costume = state.scratchGui.vm.editingTarget.sprite.costumes[index];
    return {
        name: costume && costume.name,
        rotationCenterX: costume && costume.rotationCenterX,
        rotationCenterY: costume && costume.rotationCenterY,
        imageFormat: costume && costume.dataFormat,
        imageId: targetId && `${targetId}${costume.skinId}`,
        rtl: state.locales.isRtl,
        selectedCostumeIndex: index,
        vm: state.scratchGui.vm,
        zoomLevelId: targetId
    };
};

const PaintEditorWithReducer = props => (
    <DynamicReducerContext.Consumer>
        {installReducer => <PaintEditorWrapper {...props} installReducer={installReducer} />}
    </DynamicReducerContext.Consumer>
);
PaintEditorWithReducer.propTypes = PaintEditorWrapper.propTypes;

export default connect(
    mapStateToProps
)(PaintEditorWithReducer);
