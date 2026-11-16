import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import styles from './menu.css';
import {focusSubmenuIfStillOnOpener, handleMenuKeyDown} from '../../lib/menu-keyboard.js';

const MenuComponent = ({
    className = '',
    children,
    componentRef,
    place = 'right',
    onRequestClose
}) => (
    <ul
        role="menu"
        tabIndex={-1}
        onKeyDown={event => handleMenuKeyDown(event, onRequestClose)}
        className={classNames(
            styles.menu,
            className,
            {
                [styles.left]: place === 'left',
                [styles.right]: place === 'right'
            }
        )}
        ref={componentRef}
    >
        {children}
    </ul>
);

MenuComponent.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    componentRef: PropTypes.func,
    onRequestClose: PropTypes.func,
    place: PropTypes.oneOf(['left', 'right'])
};


const Submenu = ({children, className, place, ...props}) => (
    <div
        className={classNames(
            styles.submenu,
            className,
            {
                [styles.left]: place === 'left',
                [styles.right]: place === 'right'
            }
        )}
    >
        <MenuComponent
            place={place}
            {...props}
        >
            {children}
        </MenuComponent>
    </div>
);

Submenu.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    place: PropTypes.oneOf(['left', 'right'])
};

const MenuItem = ({children, className, ariaLabel, expanded = false, disabled = false, checked, radio = false, onClick}) => {
    const ref = React.useRef(null);
    const [keyboardOpen, setKeyboardOpen] = React.useState(false);
    const [keyboardClosed, setKeyboardClosed] = React.useState(false);
    const hasSubmenu = React.Children.toArray(children).some(child => child && child.type === Submenu);
    const open = !keyboardClosed && (expanded || keyboardOpen);
    const closeSubmenu = () => {
        setKeyboardOpen(false);
        setKeyboardClosed(true);
        ref.current?.focus();
    };
    const contents = React.Children.map(children, child => child && child.type === Submenu ?
        React.cloneElement(child, {onRequestClose: () => {
            closeSubmenu();
            child.props.onRequestClose?.();
        }}) : child);
    return (
        <li
            ref={ref}
            role={typeof checked === 'boolean' ? (radio ? 'menuitemradio' : 'menuitemcheckbox') : 'menuitem'}
            aria-checked={typeof checked === 'boolean' ? checked : undefined}
            aria-label={ariaLabel}
            tabIndex={-1}
            className={classNames(styles.menuItem, styles.hoverable, className,
                {[styles.expanded]: open, [styles.disabled]: disabled})}
            aria-disabled={disabled || undefined}
            aria-haspopup={hasSubmenu ? 'menu' : undefined}
            aria-expanded={hasSubmenu ? open : undefined}
            data-keyboard-closed={keyboardClosed || undefined}
            onMouseEnter={() => setKeyboardClosed(false)}
            onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setKeyboardOpen(false);
                    setKeyboardClosed(true);
                }
            }}
            onKeyDown={event => {
                if (event.target !== event.currentTarget || disabled) return;
                if (hasSubmenu && ['ArrowRight', 'Enter', ' '].includes(event.key)) {
                    event.preventDefault();
                    event.stopPropagation();
                    setKeyboardClosed(false);
                    setKeyboardOpen(true);
                    const opener = ref.current;
                    requestAnimationFrame(() => {
                        if (opener?.isConnected && ref.current === opener &&
                            opener.getAttribute('aria-expanded') === 'true') {
                            focusSubmenuIfStillOnOpener(opener);
                        }
                    });
                } else if (['Enter', ' '].includes(event.key)) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.click();
                }
            }}
            onClick={disabled ? undefined : event => {
                if (event.target.closest('[role^="menuitem"]') !== event.currentTarget) return;
                if (hasSubmenu) {
                    setKeyboardOpen(!open);
                    setKeyboardClosed(open);
                }
                if (onClick) onClick(event);
            }}
        >
            {typeof checked === 'boolean' ? <span aria-hidden="true" style={{display: 'inline-block', width: 16}}>{checked ? '✓' : ''}</span> : null}
            {contents}
        </li>
    );
};

MenuItem.propTypes = {
    checked: PropTypes.bool,
    radio: PropTypes.bool,
    ariaLabel: PropTypes.string,
    children: PropTypes.node,
    className: PropTypes.string,
    expanded: PropTypes.bool,
    disabled: PropTypes.bool,
    onClick: PropTypes.func
};


const addDividerClassToFirstChild = (child, id) => (
    child && React.cloneElement(child, {
        className: classNames(
            child.props.className,
            {[styles.menuSection]: id === 0}
        ),
        key: id
    })
);

const MenuSection = ({children}) => (
    <React.Fragment>{
        React.Children.map(children, addDividerClassToFirstChild)
    }</React.Fragment>
);

MenuSection.propTypes = {
    children: PropTypes.node
};

export {
    MenuComponent as default,
    MenuItem,
    MenuSection,
    Submenu
};
