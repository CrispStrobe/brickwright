// SPDX-License-Identifier: BSD-3-Clause

// The CAD editor renders inside a shadow root. Install this same stylesheet
// there and in the workspace so the popups use the same palette and spacing.
const rows = `:is([data-editor-overflow] :is(button, label)[data-overflow-action],
    [data-editor-overflow] [data-code-overflow-controls] button,
    .circuit-menu-popup[data-toolbar-more-menu] .circuit-menu-row, .command-popup button):not([hidden])`;

export const editorOverflowStyles = `
:is([data-editor-overflow], .circuit-menu-popup[data-toolbar-more-menu], .command-popup) {
    background: #fff;
    color: #1e293b;
    border: 1px solid #94a3b8;
    border-radius: 8px;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.25);
    scrollbar-width: thin;
}
${rows} {
    display: flex !important;
    align-items: center;
    justify-content: flex-start !important;
    gap: 7px;
    width: 100% !important;
    min-height: 30px;
    height: auto !important;
    padding: 5px 8px !important;
    box-sizing: border-box;
    border: 0 !important;
    border-radius: 6px !important;
    background: transparent !important;
    color: #1e293b !important;
    font: normal 12px/1.25 system-ui, sans-serif !important;
    text-align: left;
    white-space: normal;
}
${rows}:is([aria-checked="true"], [aria-pressed="true"]) {
    background: #e0e7ff !important;
    color: #312e81 !important;
}
${rows}:not(:disabled):hover {
    background: #eef2f7 !important;
}
${rows}:focus-visible {
    outline: 2px solid #8190df;
    outline-offset: -2px;
}
${rows}:disabled {
    opacity: .45;
    cursor: default;
}
.circuit-menu-popup[data-toolbar-more-menu] :is(.circuit-menu-heading, kbd) {
    color: #64748b;
}
.circuit-menu-popup[data-toolbar-more-menu] .circuit-menu-heading {
    border-top-color: #e2e8f0;
}
.circuit-menu-popup[data-toolbar-more-menu] .circuit-menu-trigger {
    color: #1e293b;
    border-color: #cbd5e1;
    background: #f1f5f9;
}
[data-code-overflow-controls], [data-code-overflow-controls] > div,
[data-code-overflow-controls] > div > span, [data-cardiac-overflow-tools] > div {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr);
    justify-items: stretch;
    min-width: 0;
    gap: 1px !important;
}
[data-editor-overflow] [data-code-menu-group] + [data-code-menu-group] {
    margin-top: 3px;
    padding-top: 3px;
    border-top: 1px solid #e2e8f0;
}
[data-code-menu-group] > :is(label, details) {
    min-width: 0;
}
[data-code-menu-group] :is(select, summary) {
    width: 100%;
    box-sizing: border-box;
    color: #1e293b;
    font: 12px system-ui, sans-serif;
}
[data-code-menu-group] summary[data-overflow-action] {
    display: flex;
    align-items: center;
    gap: 7px;
    min-height: 30px;
    padding: 5px 8px;
    border-radius: 6px;
    cursor: pointer;
    list-style: none;
}
[data-code-menu-group] summary::-webkit-details-marker { display: none; }
[data-code-menu-group] summary:hover { background: #eef2f7; }
[data-code-menu-group] details[open] > summary svg:last-child { transform: rotate(90deg); }
[data-code-menu-group] summary svg:last-child { margin-inline-start: auto; }
[data-code-menu-group] [data-code-machine-select] {
    display: flex;
    gap: 7px;
    align-items: center;
    padding: 3px 8px;
}
[data-code-menu-group] [data-code-machine-select] select {
    flex: 1;
    min-width: 0;
    width: auto;
}
@media (pointer: coarse) {
    ${rows} {
        min-height: 40px;
    }
}
`;
