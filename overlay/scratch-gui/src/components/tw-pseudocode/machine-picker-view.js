// Backdrop clicks on a modal dialog are retargeted to the dialog itself.
export const isMachinePickerBackdrop = ({target, currentTarget, clientX, clientY}) => {
    if (target !== currentTarget) return false;
    const {left, right, top, bottom} = currentTarget.getBoundingClientRect();
    return clientX < left || clientX > right || clientY < top || clientY > bottom;
};
