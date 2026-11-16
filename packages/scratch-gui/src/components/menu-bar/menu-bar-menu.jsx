import PropTypes from 'prop-types';
import React from 'react';
import {createPortal} from 'react-dom';
import Menu from '../../containers/menu.jsx';

const MenuBarMenu = ({
    children,
    className,
    onRequestClose,
    open,
    place = 'right',
    ribbonAnchor
}) => {
    const anchor=open&&ribbonAnchor&&document.body.classList.contains('bw-compact-chrome')?document.querySelector(ribbonAnchor):null;
    const rect=anchor?.getBoundingClientRect();
    const content=(
    <div className={className} style={rect?{position:'fixed',left:Math.max(8,Math.min(rect.left,window.innerWidth-280)),top:rect.bottom+4,marginTop:0,zIndex:20000}:undefined}>
        <Menu
            open={open}
            place={place}
            onRequestClose={onRequestClose}
        >
            {children}
        </Menu>
    </div>
    );
    return rect?createPortal(content,document.body):content;
};

MenuBarMenu.propTypes = {
    children: PropTypes.node,
    ribbonAnchor:PropTypes.string,
    className: PropTypes.string,
    onRequestClose: PropTypes.func,
    open: PropTypes.bool,
    place: PropTypes.oneOf(['left', 'right'])
};

export default MenuBarMenu;
