import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import {MIXED} from '../../helper/style-path';

import noFillIcon from './no-fill.svg';
import mixedFillIcon from './mixed-fill.svg';
import styles from './color-button.css';
import GradientTypes from '../../lib/gradient-types';
import log from '../../log/log';

const colorToBackground = (color, color2, gradientType) => {
    if (color === MIXED || (gradientType !== GradientTypes.SOLID && color2 === MIXED)) return 'white';
    if (color === null) color = 'white';
    if (color2 === null) color2 = 'white';
    switch (gradientType) {
    case GradientTypes.SOLID: return color;
    case GradientTypes.HORIZONTAL: return `linear-gradient(to right, ${color}, ${color2})`;
    case GradientTypes.VERTICAL: return `linear-gradient(${color}, ${color2})`;
    case GradientTypes.RADIAL: return `radial-gradient(${color}, ${color2})`;
    default: log.error(`Unrecognized gradient type: ${gradientType}`);
    }
};

const ColorButtonComponent = props => (
    <button
        aria-label={props.label}
        title={props.label}
        disabled={props.disabled}
        type="button"
        className={styles.colorButton}
        onClick={props.onClick}
    >
        <span
            className={classNames(styles.colorButtonSwatch, {
                [styles.outlineSwatch]: props.outline && !(props.color === MIXED)
            })}
            style={{
                background: colorToBackground(props.color, props.color2, props.gradientType)
            }}
        >
            {props.color === null && (props.gradientType === GradientTypes.SOLID || props.color2 === null) ? (
                <img
                    alt=""
                    className={styles.swatchIcon}
                    draggable={false}
                    src={noFillIcon}
                />
            ) : ((props.color === MIXED || (props.gradientType !== GradientTypes.SOLID && props.color2 === MIXED) ? (
                <img
                    alt=""
                    className={styles.swatchIcon}
                    draggable={false}
                    src={mixedFillIcon}
                />
            ) : null))}
        </span>
        <span aria-hidden="true" className={styles.colorButtonArrow}>▾</span>
    </button>
);

ColorButtonComponent.propTypes = {
    label: PropTypes.string,
    disabled: PropTypes.bool,
    color: PropTypes.string,
    color2: PropTypes.string,
    gradientType: PropTypes.oneOf(Object.keys(GradientTypes)).isRequired,
    onClick: PropTypes.func.isRequired,
    outline: PropTypes.bool.isRequired
};

ColorButtonComponent.defaultProps = {
    outline: false
};

export default ColorButtonComponent;
