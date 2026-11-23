// SPDX-License-Identifier: BSD-3-Clause
import PropTypes from 'prop-types';
import React from 'react';

import tx from '../../lib/bw-messages';
import {precisionShapeBounds} from '../../helper/bw/precision-shape';

import styles from './bw-properties-panel.css';

const DraftField = ({label, value, onChange, minimum}) => (
    <label className={styles.field}>
        <span className={styles.fieldLabel}>{label}</span>
        <input
            className={styles.fieldInput}
            min={minimum}
            step="any"
            type="number"
            value={value}
            onChange={event => onChange(event.target.value)}
        />
    </label>
);
DraftField.propTypes = {
    label: PropTypes.string.isRequired,
    minimum: PropTypes.number,
    onChange: PropTypes.func.isRequired,
    value: PropTypes.string.isRequired
};

const BwPrecisionDrawing = ({locale, ready, selecting, onSelectMode, onInsert}) => {
    const [kind, setKind] = React.useState('rectangle');
    const [values, setValues] = React.useState({x: '0', y: '0', width: '60', height: '40', endX: '60', endY: '0',
        radius: '30', startAngle: '0', sweep: '90', stroke: '2'});
    const [failed, setFailed] = React.useState(false);
    const t = key => tx(locale, key);
    const draft = {kind, ...Object.fromEntries(Object.entries(values).map(([key, value]) =>
        [key, value.trim() ? Number(value) : NaN]))};
    const valid = Boolean(precisionShapeBounds(draft));
    const field = (name, label, minimum) => <DraftField label={t(label)} minimum={minimum} value={values[name]}
        onChange={value => setValues(previous => ({...previous, [name]: value}))}
    />;
    const isStroke = kind === 'line' || kind === 'arc';
    const insert = event => {
        event.preventDefault();
        if (ready && selecting && valid) setFailed(!onInsert(draft));
    };
    return (
        <details className={styles.section}>
            <summary className={styles.precisionSummary}>{t('precisionDrawing')}</summary>
            <form className={styles.precisionForm} onSubmit={insert}>
                <p className={styles.hint}>{t('precisionDrawingHint')}</p>
                <label className={styles.field}>
                    <span className={styles.fieldLabel}>{t('shape')}</span>
                    <select aria-label={t('shape')} value={kind} onChange={event => setKind(event.target.value)}>
                        <option value="rectangle">{t('rectangle')}</option>
                        <option value="circle">{t('circle')}</option>
                        <option value="line">{t('line')}</option>
                        <option value="arc">{t('precisionArc')}</option>
                    </select>
                </label>
                <div className={styles.fieldRow}>
                    {field('x', kind === 'line' ? 'precisionStartX' : 'precisionCenterX')}
                    {field('y', kind === 'line' ? 'precisionStartY' : 'precisionCenterY')}
                </div>
                {kind === 'line' && <div className={styles.fieldRow}>
                    {field('endX', 'precisionEndX')}
                    {field('endY', 'precisionEndY')}
                </div>}
                {kind === 'arc' && <>
                    <p className={styles.hint}>{t('precisionArcHint')}</p>
                    {field('radius', 'precisionRadius', .01)}
                    <div className={styles.fieldRow}>
                        {field('startAngle', 'precisionStartAngle')}
                        {field('sweep', 'precisionSweep')}
                    </div>
                </>}
                {isStroke ? <>
                    {field('stroke', 'precisionStrokeWidth', .01)}
                    <p className={styles.hint}>{t('precisionStrokeCadHint')}</p>
                </> : <div className={styles.fieldRow}>
                    {field('width', kind === 'circle' ? 'precisionDiameter' : 'precisionWidth', .01)}
                    {kind === 'rectangle' && field('height', 'precisionHeight', .01)}
                </div>}
                {!valid && <p className={styles.hint} role="status">{t('precisionInvalidShape')}</p>}
                {(!ready || failed) && <p className={styles.hint} role="status">{t('precisionInsertUnavailable')}</p>}
                {selecting ? <button disabled={!ready || !valid} type="submit">{t('precisionAddShape')}</button> :
                    <button type="button" onClick={onSelectMode}>{t('precisionSelectMode')}</button>}
            </form>
        </details>
    );
};
BwPrecisionDrawing.propTypes = {
    locale: PropTypes.string.isRequired,
    onInsert: PropTypes.func.isRequired,
    onSelectMode: PropTypes.func.isRequired,
    ready: PropTypes.bool.isRequired,
    selecting: PropTypes.bool.isRequired
};

export default BwPrecisionDrawing;
