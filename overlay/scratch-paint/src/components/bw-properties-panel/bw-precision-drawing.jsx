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
    const [x, setX] = React.useState('0'), [y, setY] = React.useState('0');
    const [width, setWidth] = React.useState('60'), [height, setHeight] = React.useState('40');
    const [failed, setFailed] = React.useState(false);
    const t = key => tx(locale, key);
    const number = value => value.trim() ? Number(value) : NaN;
    const draft = {kind, x: number(x), y: number(y), width: number(width), height: number(height)};
    const valid = Boolean(precisionShapeBounds(draft));
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
                    </select>
                </label>
                <div className={styles.fieldRow}>
                    <DraftField label={t('precisionCenterX')} value={x} onChange={setX} />
                    <DraftField label={t('precisionCenterY')} value={y} onChange={setY} />
                </div>
                <div className={styles.fieldRow}>
                    <DraftField label={kind === 'circle' ? t('precisionDiameter') : t('precisionWidth')} minimum={.01}
                        value={width} onChange={setWidth}
                    />
                    {kind === 'rectangle' && <DraftField label={t('precisionHeight')} minimum={.01}
                        value={height} onChange={setHeight}
                    />}
                </div>
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
