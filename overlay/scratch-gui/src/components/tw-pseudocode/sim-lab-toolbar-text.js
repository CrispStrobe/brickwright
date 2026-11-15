// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The Robot Lab toolbar in the learner's language (sim-lab-toolbar.jsx, sim-lab-pane.jsx):
// every action's name and its keyboard shortcut, kept apart so a tooltip can say
// "Turn 90° (R)" while the button's accessible name stays "Turn 90°". Key names are
// the ones printed on a keyboard in that language (Strg, Umschalt, Entf).

export const TOOLBAR_TEXT = {
    en: {
        toolbar: 'Robot Lab tools',
        groups: {mode: 'Mode', run: 'Program', edit: 'Edit', arrange: 'Arrange', view: 'View', show: 'Show', tools: 'Tools', panels: 'Panels', file: 'File'},
        actions: {
            simulate: 'Simulate', build: 'Build', instructions: 'Instructions', examples: 'Examples',
            run: 'Run', pause: 'Pause', reset: 'Reset',
            'mode-move': 'Move with arrows', 'mode-rotate': 'Turn with rings',
            turn: 'Turn 90°', 'turn-back': 'Turn back 90°', tip: 'Tip 90°',
            group: 'Group', ungroup: 'Ungroup', duplicate: 'Duplicate', delete: 'Delete', cancel: 'Cancel',
            copy: 'Copy', paste: 'Paste', 'select-all': 'Select all', undo: 'Undo', redo: 'Redo',
            'view-home': 'Home view', 'view-fit': 'Fit in view', 'view-top': 'View from the top', 'view-front': 'View from the front', 'view-side': 'View from the side',
            grid: 'Grid', 'show-ports': 'Show ports', 'show-motion': 'Show how it moves',
            speed: 'Speed', 'show-sensors': 'Show sensor rays', readings: 'Readings', 'show-stats': 'Show statistics', challenges: 'Challenges',
            'mirror-x': 'Mirror left ↔ right', 'mirror-z': 'Mirror front ↔ back',
            hide: 'Hide', isolate: 'Isolate', 'show-all': 'Show all', measure: 'Measure', eyedropper: 'Eyedropper',
            'parts-toggle': 'Parts', properties: 'Properties', shortcuts: 'Shortcuts',
            'file-menu': 'File', open: 'Open a model…', save: 'Save as', help: 'Help', more: 'More'
        },
        keys: {
            'mode-move': 'W', 'mode-rotate': 'E', turn: 'R', 'turn-back': 'Shift+R', tip: 'T',
            group: 'Ctrl+G', ungroup: 'Ctrl+Shift+G', duplicate: 'Ctrl+D', delete: 'Delete', cancel: 'Esc',
            copy: 'Ctrl+C', paste: 'Ctrl+V', 'select-all': 'Ctrl+A', undo: 'Ctrl+Z', redo: 'Ctrl+Y',
            'view-fit': 'F', hide: 'H', isolate: 'I', 'show-all': 'Shift+H', measure: 'M', eyedropper: 'K', shortcuts: '?'
        },
        tooltip: '{label} ({keys})',
        gridValue: '{n} LDU',
        selectedOne: '{name}', selectedMany: '{n} parts', selectionChip: 'Selected',
        helpTitle: 'Robot Lab',
        helpIntro: 'A model from real LEGO® Technic parts with physics. Write a program for its hub (SPIKE Prime: ports A and B drive the wheels) and press Run: it starts on the green flag.',
        cameraTitle: 'Moving the view',
        camera: [
            ['Middle drag · drag empty space in Simulate', 'turn the view'],
            ['Right drag · Shift+drag (Simulate)', 'slide the view'],
            ['Space+drag (Build, no part in hand)', 'slide the view'],
            ['Wheel · pinch', 'zoom toward the pointer'],
            ['Arrows · Shift+arrows · + / -', 'turn · slide · zoom (click the view first; in Build with nothing selected)'],
            ['Home · Fit (F) · Top · Front · Side', 'the view buttons']
        ],
        buildTitle: 'Building',
        build: [
            ['Click · Shift+click', 'select a part · add one'],
            ['Drag a part', 'move it (in Build, drag empty space to select; Shift adds parts)']
        ],
        allShortcuts: 'All shortcuts…',
        resizeParts: 'Resize the parts panel', resizeProperties: 'Resize the properties panel',
        resizeTip: 'Drag to resize · double-click to close'
    },
    de: {
        toolbar: 'Werkzeuge des Roboter-Labors',
        groups: {mode: 'Modus', run: 'Programm', edit: 'Bearbeiten', arrange: 'Anordnen', view: 'Ansicht', show: 'Anzeigen', tools: 'Werkzeuge', panels: 'Leisten', file: 'Datei'},
        actions: {
            simulate: 'Simulieren', build: 'Bauen', instructions: 'Bauanleitung', examples: 'Beispiele',
            run: 'Start', pause: 'Pause', reset: 'Zurücksetzen',
            'mode-move': 'Mit Pfeilen schieben', 'mode-rotate': 'Mit Ringen drehen',
            turn: 'Um 90° drehen', 'turn-back': 'Um 90° zurückdrehen', tip: 'Um 90° kippen',
            group: 'Gruppieren', ungroup: 'Gruppe lösen', duplicate: 'Verdoppeln', delete: 'Löschen', cancel: 'Abbrechen',
            copy: 'Kopieren', paste: 'Einfügen', 'select-all': 'Alle wählen', undo: 'Rückgängig', redo: 'Wiederholen',
            'view-home': 'Startansicht', 'view-fit': 'Einpassen', 'view-top': 'Ansicht von oben', 'view-front': 'Ansicht von vorne', 'view-side': 'Ansicht von der Seite',
            grid: 'Raster', 'show-ports': 'Ports zeigen', 'show-motion': 'Zeigen, wie es sich bewegt',
            speed: 'Tempo', 'show-sensors': 'Sensorstrahlen zeigen', readings: 'Messwerte', 'show-stats': 'Statistik zeigen', challenges: 'Aufgaben',
            'mirror-x': 'Links ↔ rechts spiegeln', 'mirror-z': 'Vorne ↔ hinten spiegeln',
            hide: 'Ausblenden', isolate: 'Nur diese zeigen', 'show-all': 'Alle zeigen', measure: 'Messen', eyedropper: 'Pipette',
            'parts-toggle': 'Teile', properties: 'Eigenschaften', shortcuts: 'Tastenkürzel',
            'file-menu': 'Datei', open: 'Ein Modell öffnen…', save: 'Speichern als', help: 'Hilfe', more: 'Mehr'
        },
        keys: {
            'mode-move': 'W', 'mode-rotate': 'E', turn: 'R', 'turn-back': 'Umschalt+R', tip: 'T',
            group: 'Strg+G', ungroup: 'Strg+Umschalt+G', duplicate: 'Strg+D', delete: 'Entf', cancel: 'Esc',
            copy: 'Strg+C', paste: 'Strg+V', 'select-all': 'Strg+A', undo: 'Strg+Z', redo: 'Strg+Y',
            'view-fit': 'F', hide: 'H', isolate: 'I', 'show-all': 'Umschalt+H', measure: 'M', eyedropper: 'K', shortcuts: '?'
        },
        tooltip: '{label} ({keys})',
        gridValue: '{n} LDU',
        selectedOne: '{name}', selectedMany: '{n} Teile', selectionChip: 'Ausgewählt',
        helpTitle: 'Roboter-Labor',
        helpIntro: 'Ein Modell aus echten LEGO®-Technic-Teilen mit Physik. Schreibe ein Programm für seinen Hub (SPIKE Prime: Ports A und B treiben die Räder an) und drücke Start: es beginnt mit der grünen Flagge.',
        cameraTitle: 'Die Ansicht bewegen',
        camera: [
            ['Mitte ziehen · leere Fläche ziehen beim Simulieren', 'Ansicht drehen'],
            ['Rechts ziehen · Umschalt+Ziehen (Simulieren)', 'Ansicht schieben'],
            ['Leertaste+Ziehen (Bauen, kein Teil in der Hand)', 'Ansicht schieben'],
            ['Mausrad · zwei Finger', 'zum Mauszeiger hin zoomen'],
            ['Pfeile · Umschalt+Pfeile · + / -', 'drehen · schieben · zoomen (erst in die Ansicht klicken; beim Bauen, wenn nichts ausgewählt ist)'],
            ['Start · Einpassen (F) · Oben · Vorne · Seite', 'die Ansichtsknöpfe']
        ],
        buildTitle: 'Bauen',
        build: [
            ['Klick · Umschalt+Klick', 'ein Teil auswählen · eins dazu nehmen'],
            ['Teil ziehen', 'verschieben (leere Fläche ziehen wählt mit Rahmen; Umschalt nimmt Teile dazu)']
        ],
        allShortcuts: 'Alle Tastenkürzel…',
        resizeParts: 'Breite der Teileleiste ändern', resizeProperties: 'Breite der Eigenschaftenleiste ändern',
        resizeTip: 'Ziehen zum Ändern · Doppelklick zum Schließen'
    }
};
