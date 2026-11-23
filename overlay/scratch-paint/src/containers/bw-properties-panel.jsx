import paper from '@scratch/paper';
import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import {connect} from 'react-redux';
import {injectIntl, intlShape} from 'react-intl';

import Modes from '../lib/modes';
import {
    changeCornerRadius,
    changePolygonSides,
    changeStarInnerRatio,
    changeStarPoints
} from '../reducers/bw-shape';
import {
    changeGridSize,
    toggleGridVisible,
    toggleSmartGuides,
    toggleSnapToGrid
} from '../reducers/bw-grid';
import {changeMode} from '../reducers/modes';
import {togglePanel} from '../reducers/bw-panel';
import {setSelectedItems} from '../reducers/selected-items';

import {alignSelection, AlignTo, distributeSelection} from '../helper/bw/align';
import {getOpacityPercent, setOpacityPercent} from '../helper/bw/appearance';
import {applyBoolean, getOperands} from '../helper/bw/booleans';
import {MirrorAbout, mirrorDuplicate} from '../helper/bw/symmetry';
import {ART_BOARD_UNITS_PER_COSTUME_UNIT, insertPrecisionShape} from '../helper/bw/precision-shape';
import {getTransform, rotateBy, setPosition, setRotation, setSize} from '../helper/bw/transform';
import {getSelectedLeafItems, getSelectedRootItems} from '../helper/selection';

import BwPropertiesPanelComponent from '../components/bw-properties-panel/bw-properties-panel.jsx';

// paper's art board is twice the size of the exported costume. The panel talks in COSTUME units,
// because those are the numbers the costume, the stage and every other part of Scratch use — a
// 480-wide costume reading as "960" here would be nothing but a trap.
const toCostumeUnits = value => Math.round((value / ART_BOARD_UNITS_PER_COSTUME_UNIT) * 100) / 100;
const toArtBoardUnits = value => value * ART_BOARD_UNITS_PER_COSTUME_UNIT;

/** Which action creator each shape parameter goes through. */
const SHAPE_PARAM_ACTIONS = {
    cornerRadius: changeCornerRadius,
    polygonSides: changePolygonSides,
    starInnerRatio: changeStarInnerRatio,
    starPoints: changeStarPoints
};

/**
 * Brickwright: the designer's properties rail — numeric transform, align and distribute, boolean
 * combine, mirroring, and the parameters of the parametric shape tools.
 *
 * Geometry is read straight out of paper on every render rather than mirrored into redux, because
 * paper is the single source of truth for it and a mirror would drift. What redux provides is the
 * re-render TRIGGER: `selectedItems` changes identity whenever the selection changes, and
 * update-image-hoc additionally dispatches redrawSelectionBox after every committed edit, so a
 * plain drag on the canvas refreshes these numbers too.
 */
class BwPropertiesPanel extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleAlign',
            'handleBoolean',
            'handleChangeHeight',
            'handleChangeOpacity',
            'handleChangeRotation',
            'handleChangeShapeParam',
            'handleChangeWidth',
            'handleChangeX',
            'handleChangeY',
            'handleDistribute',
            'handleInsertPrecisionShape',
            'handleMirror',
            'handleRotateClockwise',
            'handleRotateCounterClockwise',
            'handleToggleLockAspect'
        ]);
        this.state = {
            alignTo: AlignTo.SELECTION,
            // Set when a boolean op yields nothing, so the panel can say why nothing happened
            // instead of looking broken. Cleared by the next selection change.
            booleanEmpty: false,
            lockAspect: false,
            mirrorAbout: MirrorAbout.SELECTION_EDGE
        };
    }
    componentWillReceiveProps (nextProps) {
        if (this.state.booleanEmpty && nextProps.selectedItems !== this.props.selectedItems) {
            this.setState({booleanEmpty: false});
        }
    }
    /**
     * Commit a change that moved or resized existing objects.
     * @param {boolean} changed Whether the helper actually did anything.
     */
    commit (changed) {
        if (changed) this.props.onUpdateImage();
    }
    /**
     * Commit a change that added or removed objects. Those also need the selection pushed back
     * into redux, because the items themselves are different now — not merely moved.
     * @param {boolean} changed Whether the helper actually did anything.
     */
    commitStructural (changed) {
        if (!changed) return;
        this.props.setSelectedItems();
        this.props.onUpdateImage();
    }
    handleInsertPrecisionShape (draft) {
        if (!this.props.readyForDraft || this.props.mode !== Modes.SELECT || !insertPrecisionShape(draft)) return false;
        this.commitStructural(true);
        return true;
    }
    handleChangeX (value) {
        this.commit(setPosition(toArtBoardUnits(value), null));
    }
    handleChangeY (value) {
        this.commit(setPosition(null, toArtBoardUnits(value)));
    }
    handleChangeWidth (value) {
        const transform = getTransform();
        if (!transform) return;
        const width = toArtBoardUnits(value);
        const height = this.state.lockAspect && transform.width > 0 ?
            transform.height * (width / transform.width) :
            null;
        this.commit(setSize(width, height));
    }
    handleChangeHeight (value) {
        const transform = getTransform();
        if (!transform) return;
        const height = toArtBoardUnits(value);
        const width = this.state.lockAspect && transform.height > 0 ?
            transform.width * (height / transform.height) :
            null;
        this.commit(setSize(width, height));
    }
    handleChangeOpacity (value) {
        this.commit(setOpacityPercent(value));
    }
    handleChangeRotation (value) {
        this.commit(setRotation(value));
    }
    handleRotateClockwise () {
        this.commit(rotateBy(90));
    }
    handleRotateCounterClockwise () {
        this.commit(rotateBy(-90));
    }
    handleToggleLockAspect () {
        this.setState({lockAspect: !this.state.lockAspect});
    }
    handleAlign (alignment) {
        this.commit(alignSelection(alignment, this.state.alignTo));
    }
    handleDistribute (axis) {
        this.commit(distributeSelection(axis));
    }
    handleBoolean (op) {
        const changed = applyBoolean(op);
        this.setState({booleanEmpty: !changed && getOperands().length >= 2});
        this.commitStructural(changed);
    }
    handleMirror (axis) {
        this.commitStructural(mirrorDuplicate(axis, this.state.mirrorAbout));
    }
    handleChangeShapeParam (key, value) {
        // Only affects shapes drawn from now on, so there is no image to update.
        this.props.onChangeShapeParam(key, value);
    }
    render () {
        const raw = getTransform();
        const transform = raw === null ? null : {
            x: toCostumeUnits(raw.x),
            y: toCostumeUnits(raw.y),
            width: toCostumeUnits(raw.width),
            height: toCostumeUnits(raw.height),
            rotation: raw.rotation === null ? null : Math.round(raw.rotation * 10) / 10
        };

        return (
            <BwPropertiesPanelComponent
                alignTo={this.state.alignTo}
                booleanEmpty={this.state.booleanEmpty}
                booleanOperandCount={getOperands().length}
                grid={this.props.grid}
                locale={this.props.intl.locale}
                lockAspect={this.state.lockAspect}
                mirrorAbout={this.state.mirrorAbout}
                mode={this.props.mode}
                selectionCount={getSelectedRootItems().length}
                shapeParams={this.props.shapeParams}
                transform={transform}
                visible={this.props.visible}
                onAlign={this.handleAlign}
                onBoolean={this.handleBoolean}
                onChangeAlignTo={alignTo => this.setState({alignTo})}
                onChangeGridSize={this.props.onChangeGridSize}
                onChangeHeight={this.handleChangeHeight}
                onChangeOpacity={this.handleChangeOpacity}
                opacityPercent={getOpacityPercent()}
                precisionDrawing={this.props.precisionDrawing}
                readyForDraft={this.props.readyForDraft}
                onInsertPrecisionShape={this.handleInsertPrecisionShape}
                onSelectMode={this.props.onSelectMode}
                onChangeMirrorAbout={mirrorAbout => this.setState({mirrorAbout})}
                onChangeRotation={this.handleChangeRotation}
                onChangeShapeParam={this.handleChangeShapeParam}
                onChangeWidth={this.handleChangeWidth}
                onChangeX={this.handleChangeX}
                onChangeY={this.handleChangeY}
                onDistribute={this.handleDistribute}
                onMirror={this.handleMirror}
                onRotateClockwise={this.handleRotateClockwise}
                onRotateCounterClockwise={this.handleRotateCounterClockwise}
                onToggleGrid={this.props.onToggleGrid}
                onToggleLockAspect={this.handleToggleLockAspect}
                onTogglePanel={this.props.onTogglePanel}
                onToggleSmartGuides={this.props.onToggleSmartGuides}
                onToggleSnapToGrid={this.props.onToggleSnapToGrid}
                onUpdateImage={this.props.onUpdateImage}
            />
        );
    }
}

BwPropertiesPanel.propTypes = {
    grid: PropTypes.object.isRequired,
    intl: intlShape,
    mode: PropTypes.oneOf(Object.keys(Modes)).isRequired,
    onChangeGridSize: PropTypes.func.isRequired,
    onChangeShapeParam: PropTypes.func.isRequired,
    precisionDrawing: PropTypes.bool,
    readyForDraft: PropTypes.bool.isRequired,
    onSelectMode: PropTypes.func.isRequired,
    onToggleGrid: PropTypes.func.isRequired,
    onTogglePanel: PropTypes.func.isRequired,
    onToggleSmartGuides: PropTypes.func.isRequired,
    onToggleSnapToGrid: PropTypes.func.isRequired,
    onUpdateImage: PropTypes.func.isRequired,
    // Not read for its contents — it is what makes this component re-render when the geometry
    // changes, and what clears the "nothing left" hint.
    selectedItems: PropTypes.arrayOf(PropTypes.instanceOf(paper.Item)),
    setSelectedItems: PropTypes.func.isRequired,
    shapeParams: PropTypes.object.isRequired,
    visible: PropTypes.bool.isRequired
};

const mapStateToProps = state => ({
    // A new costume gets its first snapshot after Paper finishes the import.
    readyForDraft: state.scratchPaint.undo.pointer >= 0,
    grid: state.scratchPaint.bwGrid,
    mode: state.scratchPaint.mode,
    selectedItems: state.scratchPaint.selectedItems,
    shapeParams: state.scratchPaint.bwShape,
    visible: state.scratchPaint.bwPanel.visible
});
const mapDispatchToProps = dispatch => ({
    onSelectMode: () => dispatch(changeMode(Modes.SELECT)),
    onChangeGridSize: size => {
        dispatch(changeGridSize(size));
    },
    onChangeShapeParam: (key, value) => {
        const action = SHAPE_PARAM_ACTIONS[key];
        if (action) dispatch(action(value));
    },
    onToggleGrid: () => {
        dispatch(toggleGridVisible());
    },
    onTogglePanel: () => {
        dispatch(togglePanel());
    },
    onToggleSmartGuides: () => {
        dispatch(toggleSmartGuides());
    },
    onToggleSnapToGrid: () => {
        dispatch(toggleSnapToGrid());
    },
    setSelectedItems: () => {
        dispatch(setSelectedItems(getSelectedLeafItems(), false /* bitmapMode */));
    }
});

export default injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(BwPropertiesPanel));
