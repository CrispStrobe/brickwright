import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import BufferedInputHOC from '../forms/buffered-input-hoc.jsx';
import BwPrecisionDrawing from './bw-precision-drawing.jsx';
import BwObjectsPanel from '../../containers/bw-objects-panel.jsx';
import Input from '../forms/input.jsx';
import Modes from '../../lib/modes';
import tx from '../../lib/bw-messages';
import {Alignments, AlignTo, Axes} from '../../helper/bw/align';
import {BooleanOps} from '../../helper/bw/booleans';
import {MirrorAbout} from '../../helper/bw/symmetry';

import {
    AlignBottom,
    AlignHorizontalCenter,
    AlignLeft,
    AlignRight,
    AlignTop,
    AlignVerticalCenter,
    AspectLock,
    Chevron,
    DistributeHorizontal,
    DistributeVertical,
    Divide,
    Exclude,
    Intersect,
    MirrorHorizontal,
    MirrorVertical,
    RotateClockwise,
    RotateCounterClockwise,
    Subtract,
    Unite
} from './bw-icons.jsx';

import styles from './bw-properties-panel.css';

const BufferedInput = BufferedInputHOC(Input);

/** A square icon button. Children are one of the inline SVG glyphs from bw-icons. */
const IconButton = ({active, children, disabled, onClick, title}) => (
    <button
        className={classNames(styles.iconButton, {[styles.iconButtonActive]: active})}
        disabled={disabled}
        title={title}
        type="button"
        onClick={onClick}
    >
        {children}
    </button>
);
IconButton.propTypes = {
    active: PropTypes.bool,
    children: PropTypes.node,
    disabled: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
    title: PropTypes.string
};

/** A labelled numeric field. A null value renders an empty box rather than "0" or "NaN". */
const NumberField = ({disabled, label, step, title, value, onSubmit}) => (
    <label
        className={classNames(styles.field, {[styles.fieldDisabled]: disabled})}
        title={title}
    >
        <span className={styles.fieldLabel}>{label}</span>
        {disabled || value === null ?
            <Input
                className={styles.fieldInput}
                disabled
                readOnly
                type="text"
                value=""
            /> :
            <BufferedInput
                className={styles.fieldInput}
                step={step}
                type="number"
                value={value}
                onSubmit={onSubmit}
            />
        }
    </label>
);
NumberField.propTypes = {
    disabled: PropTypes.bool,
    label: PropTypes.string.isRequired,
    onSubmit: PropTypes.func.isRequired,
    step: PropTypes.number,
    title: PropTypes.string,
    value: PropTypes.number
};

const Section = ({children, title}) => (
    <div className={styles.section}>
        <div className={styles.sectionTitle}>{title}</div>
        {children}
    </div>
);
Section.propTypes = {
    children: PropTypes.node,
    title: PropTypes.string.isRequired
};

/** A labelled checkbox, for the on/off grid and snapping settings. */
const Toggle = ({checked, label, title, onChange}) => (
    <label
        className={styles.toggle}
        title={title}
    >
        <input
            checked={checked}
            type="checkbox"
            onChange={onChange}
        />
        <span>{label}</span>
    </label>
);
Toggle.propTypes = {
    checked: PropTypes.bool.isRequired,
    label: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    title: PropTypes.string
};

/** A two-option toggle, used for "align relative to" and "mirror about". */
const Segmented = ({label, options, value, onChange}) => (
    <div className={styles.segmented}>
        <span className={styles.segmentedLabel}>{label}</span>
        {options.map(option => (
            <button
                className={classNames(styles.segment, {
                    [styles.segmentActive]: value === option.value
                })}
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
            >
                {option.label}
            </button>
        ))}
    </div>
);
Segmented.propTypes = {
    label: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    options: PropTypes.arrayOf(PropTypes.shape({
        label: PropTypes.string,
        value: PropTypes.string
    })).isRequired,
    value: PropTypes.string.isRequired
};

const BwPropertiesPanel = props => {
    const {alignTo, locale, mode, selectionCount, shapeParams, transform, visible} = props;
    const t = key => tx(locale, key);

    const hasSelection = transform !== null;
    // Aligning against the canvas is meaningful for a single object; aligning objects to each
    // other is not. Distribute always needs three, so there is a middle item to move.
    const canAlign = hasSelection && (alignTo === AlignTo.CANVAS || selectionCount >= 2);
    const canDistribute = selectionCount >= 3;
    const canCombine = props.booleanOperandCount >= 2;
    const singleItem = selectionCount === 1;

    const alignButton = (alignment, key, Icon) => (
        <IconButton
            disabled={!canAlign}
            title={canAlign ? t(key) : `${t(key)} — ${t('needTwo')}`}
            onClick={() => props.onAlign(alignment)}
        >
            <Icon />
        </IconButton>
    );

    const booleanButton = (op, key, Icon) => (
        <IconButton
            disabled={!canCombine}
            title={canCombine ? t(key) : `${t(key)} — ${t('needTwoPaths')}`}
            onClick={() => props.onBoolean(op)}
        >
            <Icon />
        </IconButton>
    );

    if (!visible) {
        return (
            <div className={styles.railCollapsed}>
                <IconButton
                    title={t('showProperties')}
                    onClick={props.onTogglePanel}
                >
                    <Chevron pointsRight={false} />
                </IconButton>
            </div>
        );
    }

    return (
        <React.Fragment>
            {/* Holds the rail's width open in the flex row; the rail itself is positioned, so it
                cannot stretch the row taller than the window. */}
            <div className={styles.railSpacer} />
            <div className={styles.rail}>
                <div className={styles.header}>
                <IconButton
                    title={t('hideProperties')}
                    onClick={props.onTogglePanel}
                >
                    <Chevron pointsRight />
                </IconButton>
                <span className={styles.headerTitle}>{t('properties')}</span>
            </div>

            <div className={styles.body}>
                {/* The objects tree comes first: it is what you reach for to find the thing you
                    want to change before you change it. */}
                <div className={styles.section}>
                    <BwObjectsPanel onUpdateImage={props.onUpdateImage} />
                </div>

                {props.precisionDrawing && <BwPrecisionDrawing
                    locale={locale}
                    ready={props.readyForDraft}
                    selecting={mode === Modes.SELECT}
                    onInsert={props.onInsertPrecisionShape}
                    onSelectMode={props.onSelectMode}
                />}
                <Section title={t('transform')}>
                    {hasSelection ? null :
                        <div className={styles.hint}>{t('nothingSelected')}</div>}
                    <div className={styles.fieldRow}>
                        <NumberField
                            disabled={!hasSelection}
                            label={t('positionX')}
                            value={hasSelection ? transform.x : null}
                            onSubmit={props.onChangeX}
                        />
                        <NumberField
                            disabled={!hasSelection}
                            label={t('positionY')}
                            value={hasSelection ? transform.y : null}
                            onSubmit={props.onChangeY}
                        />
                    </div>
                    <div className={styles.fieldRow}>
                        <NumberField
                            disabled={!hasSelection}
                            label={t('width')}
                            value={hasSelection ? transform.width : null}
                            onSubmit={props.onChangeWidth}
                        />
                        <NumberField
                            disabled={!hasSelection}
                            label={t('height')}
                            value={hasSelection ? transform.height : null}
                            onSubmit={props.onChangeHeight}
                        />
                        <IconButton
                            active={props.lockAspect}
                            disabled={!hasSelection}
                            title={t('lockAspect')}
                            onClick={props.onToggleLockAspect}
                        >
                            <AspectLock locked={props.lockAspect} />
                        </IconButton>
                    </div>
                    <div className={styles.fieldRow}>
                        <NumberField
                            disabled={!singleItem}
                            label={t('rotation')}
                            title={singleItem ? null : t('rotationMultiple')}
                            value={singleItem ? transform.rotation : null}
                            onSubmit={props.onChangeRotation}
                        />
                        <IconButton
                            disabled={!hasSelection}
                            title={t('rotateCounterClockwise')}
                            onClick={props.onRotateCounterClockwise}
                        >
                            <RotateCounterClockwise />
                        </IconButton>
                        <IconButton
                            disabled={!hasSelection}
                            title={t('rotateClockwise')}
                            onClick={props.onRotateClockwise}
                        >
                            <RotateClockwise />
                        </IconButton>
                    </div>
                </Section>

                <Section title={t('appearance')}>
                    <div className={styles.fieldRow}>
                        <NumberField
                            disabled={!hasSelection}
                            label={t('opacity')}
                            title={hasSelection && props.opacityPercent === null ?
                                t('opacityMixed') : null}
                            value={hasSelection ? props.opacityPercent : null}
                            onSubmit={props.onChangeOpacity}
                        />
                        <span className={styles.fieldSuffix}>{'%'}</span>
                    </div>
                </Section>

                <Section title={t('align')}>
                    <Segmented
                        label={t('alignRelativeTo')}
                        options={[
                            {label: t('alignToSelection'), value: AlignTo.SELECTION},
                            {label: t('alignToCanvas'), value: AlignTo.CANVAS}
                        ]}
                        value={alignTo}
                        onChange={props.onChangeAlignTo}
                    />
                    <div className={styles.buttonRow}>
                        {alignButton(Alignments.LEFT, 'alignLeft', AlignLeft)}
                        {alignButton(Alignments.HORIZONTAL_CENTER, 'alignHorizontalCenter', AlignHorizontalCenter)}
                        {alignButton(Alignments.RIGHT, 'alignRight', AlignRight)}
                    </div>
                    <div className={styles.buttonRow}>
                        {alignButton(Alignments.TOP, 'alignTop', AlignTop)}
                        {alignButton(Alignments.VERTICAL_CENTER, 'alignVerticalCenter', AlignVerticalCenter)}
                        {alignButton(Alignments.BOTTOM, 'alignBottom', AlignBottom)}
                    </div>
                    <div className={styles.buttonRow}>
                        <IconButton
                            disabled={!canDistribute}
                            title={canDistribute ?
                                t('distributeHorizontal') :
                                `${t('distributeHorizontal')} — ${t('needThree')}`}
                            onClick={() => props.onDistribute(Axes.HORIZONTAL)}
                        >
                            <DistributeHorizontal />
                        </IconButton>
                        <IconButton
                            disabled={!canDistribute}
                            title={canDistribute ?
                                t('distributeVertical') :
                                `${t('distributeVertical')} — ${t('needThree')}`}
                            onClick={() => props.onDistribute(Axes.VERTICAL)}
                        >
                            <DistributeVertical />
                        </IconButton>
                    </div>
                </Section>

                <Section title={t('combine')}>
                    <div className={styles.buttonRow}>
                        {booleanButton(BooleanOps.UNITE, 'unite', Unite)}
                        {booleanButton(BooleanOps.SUBTRACT, 'subtract', Subtract)}
                        {booleanButton(BooleanOps.INTERSECT, 'intersect', Intersect)}
                        {booleanButton(BooleanOps.EXCLUDE, 'exclude', Exclude)}
                        {booleanButton(BooleanOps.DIVIDE, 'divide', Divide)}
                    </div>
                    {props.booleanEmpty ?
                        <div className={styles.hint}>{t('booleanEmpty')}</div> : null}
                </Section>

                <Section title={t('symmetry')}>
                    <Segmented
                        label={t('mirrorAbout')}
                        options={[
                            {label: t('mirrorAboutEdge'), value: MirrorAbout.SELECTION_EDGE},
                            {label: t('mirrorAboutCanvas'), value: MirrorAbout.CANVAS_CENTER}
                        ]}
                        value={props.mirrorAbout}
                        onChange={props.onChangeMirrorAbout}
                    />
                    <div className={styles.buttonRow}>
                        <IconButton
                            disabled={!hasSelection}
                            title={t('mirrorHorizontal')}
                            onClick={() => props.onMirror(Axes.HORIZONTAL)}
                        >
                            <MirrorHorizontal />
                        </IconButton>
                        <IconButton
                            disabled={!hasSelection}
                            title={t('mirrorVertical')}
                            onClick={() => props.onMirror(Axes.VERTICAL)}
                        >
                            <MirrorVertical />
                        </IconButton>
                    </div>
                </Section>

                <Section title={t('grid')}>
                    <Toggle
                        checked={props.grid.visible}
                        label={t('showGrid')}
                        onChange={props.onToggleGrid}
                    />
                    <div className={styles.fieldRow}>
                        <NumberField
                            label={t('gridSize')}
                            value={props.grid.size}
                            onSubmit={props.onChangeGridSize}
                        />
                    </div>
                    <Toggle
                        checked={props.grid.snapToGrid}
                        label={t('snapToGrid')}
                        onChange={props.onToggleSnapToGrid}
                    />
                    <Toggle
                        checked={props.grid.smartGuides}
                        label={t('smartGuides')}
                        title={t('smartGuidesHint')}
                        onChange={props.onToggleSmartGuides}
                    />
                </Section>

                {mode === Modes.ROUNDED_RECT || mode === Modes.POLYGON || mode === Modes.STAR ?
                    <Section title={t('shape')}>
                        {mode === Modes.ROUNDED_RECT ?
                            <div className={styles.fieldRow}>
                                <NumberField
                                    label={t('cornerRadius')}
                                    value={shapeParams.cornerRadius}
                                    onSubmit={value => props.onChangeShapeParam('cornerRadius', value)}
                                />
                            </div> : null}
                        {mode === Modes.POLYGON ?
                            <div className={styles.fieldRow}>
                                <NumberField
                                    label={t('polygonSides')}
                                    value={shapeParams.polygonSides}
                                    onSubmit={value => props.onChangeShapeParam('polygonSides', value)}
                                />
                            </div> : null}
                        {mode === Modes.STAR ? [
                            <div
                                className={styles.fieldRow}
                                key="points"
                            >
                                <NumberField
                                    label={t('starPoints')}
                                    value={shapeParams.starPoints}
                                    onSubmit={value => props.onChangeShapeParam('starPoints', value)}
                                />
                            </div>,
                            <div
                                className={styles.fieldRow}
                                key="waist"
                            >
                                <NumberField
                                    label={t('starInnerRatio')}
                                    step={0.05}
                                    value={shapeParams.starInnerRatio}
                                    onSubmit={value => props.onChangeShapeParam('starInnerRatio', value)}
                                />
                            </div>
                        ] : null}
                    </Section> : null}
                </div>
            </div>
        </React.Fragment>
    );
};

BwPropertiesPanel.propTypes = {
    alignTo: PropTypes.oneOf(Object.keys(AlignTo).map(key => AlignTo[key])).isRequired,
    booleanEmpty: PropTypes.bool,
    booleanOperandCount: PropTypes.number.isRequired,
    grid: PropTypes.shape({
        size: PropTypes.number,
        smartGuides: PropTypes.bool,
        snapToGrid: PropTypes.bool,
        visible: PropTypes.bool
    }).isRequired,
    locale: PropTypes.string,
    lockAspect: PropTypes.bool,
    mirrorAbout: PropTypes.oneOf(Object.keys(MirrorAbout).map(key => MirrorAbout[key])).isRequired,
    mode: PropTypes.oneOf(Object.keys(Modes)).isRequired,
    onAlign: PropTypes.func.isRequired,
    onInsertPrecisionShape: PropTypes.func.isRequired,
    onSelectMode: PropTypes.func.isRequired,
    precisionDrawing: PropTypes.bool,
    readyForDraft: PropTypes.bool.isRequired,
    opacityPercent: PropTypes.number,
    onBoolean: PropTypes.func.isRequired,
    onChangeAlignTo: PropTypes.func.isRequired,
    onChangeGridSize: PropTypes.func.isRequired,
    onChangeHeight: PropTypes.func.isRequired,
    onChangeOpacity: PropTypes.func.isRequired,
    onChangeMirrorAbout: PropTypes.func.isRequired,
    onChangeRotation: PropTypes.func.isRequired,
    onChangeShapeParam: PropTypes.func.isRequired,
    onChangeWidth: PropTypes.func.isRequired,
    onChangeX: PropTypes.func.isRequired,
    onChangeY: PropTypes.func.isRequired,
    onDistribute: PropTypes.func.isRequired,
    onMirror: PropTypes.func.isRequired,
    onRotateClockwise: PropTypes.func.isRequired,
    onRotateCounterClockwise: PropTypes.func.isRequired,
    onToggleGrid: PropTypes.func.isRequired,
    onToggleLockAspect: PropTypes.func.isRequired,
    onUpdateImage: PropTypes.func.isRequired,
    onTogglePanel: PropTypes.func.isRequired,
    onToggleSmartGuides: PropTypes.func.isRequired,
    onToggleSnapToGrid: PropTypes.func.isRequired,
    selectionCount: PropTypes.number.isRequired,
    shapeParams: PropTypes.shape({
        cornerRadius: PropTypes.number,
        polygonSides: PropTypes.number,
        starInnerRatio: PropTypes.number,
        starPoints: PropTypes.number
    }).isRequired,
    transform: PropTypes.shape({
        height: PropTypes.number,
        rotation: PropTypes.number,
        width: PropTypes.number,
        x: PropTypes.number,
        y: PropTypes.number
    }),
    visible: PropTypes.bool.isRequired
};

export default BwPropertiesPanel;
