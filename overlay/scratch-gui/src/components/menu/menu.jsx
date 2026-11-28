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
}) => {
    const own = React.useRef(null);
    const setRef = node => {
        own.current = node;
        if (componentRef) componentRef(node);
    };
    // A top-level menu taller than the window (the File menu with the CAD editor's sections, on an
    // iPad in landscape) scrolls inside the window; its submenus then open fixed beside their item
    // (MenuItem's fitSubmenu), since the scrolling list would clip them.
    React.useLayoutEffect(() => {
        const list = own.current;
        if (!list || list.parentElement?.classList.contains(styles.submenu)) return;
        const fit = () => {
            const scrolled = list.scrollTop;
            list.style.maxHeight = '';
            list.style.overflowY = '';
            list.style.overflowX = '';
            delete list.dataset.scrolls;
            const box = list.getBoundingClientRect(), bottom = window.innerHeight - 8;
            if (box.height && box.bottom > bottom) {
                list.style.maxHeight = `${Math.max(120, bottom - box.top)}px`;
                list.style.overflowY = 'auto';
                list.style.overflowX = 'hidden';
                list.dataset.scrolls = 'true';
                list.scrollTop = scrolled;
            }
        };
        fit();
        window.addEventListener('resize', fit);
        return () => window.removeEventListener('resize', fit);
    });
    return (
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
            ref={setRef}
        >
            {children}
        </ul>
    );
};

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
    // A long submenu (the CAD editor's tools, say) is moved up and scrolls inside the window
    // rather than running off its bottom edge, where a tablet could never reach its last items.
    const fitSubmenu = () => requestAnimationFrame(() => {
        const submenu = ref.current && Array.from(ref.current.children).find(child => child.classList.contains(styles.submenu));
        const list = submenu && submenu.firstElementChild;
        if (!list || getComputedStyle(submenu).display === 'none') return;
        submenu.style.position = submenu.style.left = submenu.style.right = submenu.style.top = '';
        list.style.maxHeight = '';
        // Inside a scrolling top-level menu, open fixed beside the item instead of being clipped.
        let top = -1;
        if (ref.current.parentElement?.dataset.scrolls === 'true') {
            const item = ref.current.getBoundingClientRect(), width = submenu.offsetWidth;
            let left = submenu.classList.contains(styles.left) ? item.left - width : item.right;
            if (left + width > window.innerWidth - 8) left = item.left - width;
            submenu.style.position = 'fixed';
            submenu.style.left = `${Math.max(8, left)}px`;
            submenu.style.right = 'auto';
            top = item.top - 1;
            submenu.style.top = `${top}px`;
        }
        const box = submenu.getBoundingClientRect(), bottom = window.innerHeight - 8;
        const shift = box.bottom > bottom ? Math.max(0, Math.min(box.bottom - bottom, box.top - 8)) : 0;
        if (shift) submenu.style.top = `${top - shift}px`;
        if (box.bottom - shift > bottom) list.style.maxHeight = `${Math.max(120, bottom - (box.top - shift))}px`;
    });
    React.useLayoutEffect(() => { if (hasSubmenu && open) fitSubmenu(); }, [hasSubmenu, open]);
    // Scrolling the menu moves the item: a fixed submenu follows it.
    React.useEffect(() => {
        const list = hasSubmenu && ref.current?.parentElement;
        if (!list) return;
        const follow = () => fitSubmenu();
        list.addEventListener('scroll', follow, {passive: true});
        return () => list.removeEventListener('scroll', follow);
    }, [hasSubmenu]);
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
            onMouseEnter={() => { setKeyboardClosed(false); if (hasSubmenu) fitSubmenu(); }}
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
