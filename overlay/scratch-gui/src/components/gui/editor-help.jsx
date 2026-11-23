// SPDX-License-Identifier: BSD-3-Clause
import React, {useRef} from 'react';
import {getCameraPreferences} from '../../lib/bw-camera-preferences.js';
import styles from './editor-help.css';

const help = {
    en: {
        Blocks: ['Build a program', [
            ['Blocks palette', 'Drag a block onto the workspace and snap it to a stack. Drag a block away from a stack to separate it.'],
            ['Trackpad or mouse wheel', 'Slide two fingers to scroll the workspace. Use the zoom buttons or pinch on a trackpad.'],
            ['Keyboard', 'Ctrl or ⌘ + Z undoes an edit. The green flag runs stacks that start with a green flag event.']
        ]],
        Costumes: ['Edit artwork', [
            ['Tools', 'Pick a drawing tool beside the canvas. Use the select tool to move or resize artwork. The list on the left switches artwork.'],
            ['Pointer', 'Drag on the canvas to draw or transform the selection. Use the zoom buttons below the canvas for close work.'],
            ['Keyboard', 'Ctrl or ⌘ + Z undoes an edit. Delete removes the selection.']
        ]],
        Sounds: ['Edit a sound', [
            ['Sound list and waveform', 'Choose a sound from the list. Drag over its waveform to select a section, then use the editing buttons.'],
            ['Playback', 'Use Play and Stop to audition your changes.'],
            ['Keyboard', 'Use Tab to move through the controls and Space or Enter to activate a focused button.']
        ]],
        Code: ['Write a program', [
            ['Code and Blocks', 'Edit pseudocode here. Use the transfer buttons to move between code and Blocks.'],
            ['Trackpad or mouse wheel', 'Scroll the code pane. Click to place the caret or drag to select text.'],
            ['Keyboard', 'Ctrl or ⌘ + F searches. Ctrl or ⌘ + Z undoes a text edit.']
        ]],
        Circuit: ['Wire and test a circuit', [
            ['Parts and wires', 'Choose a component from the parts library. Start a wire at a pin and finish it at another pin.'],
            ['View', 'On the schematic, slide two fingers to pan and pinch to zoom. Click a component to see its properties.'],
            ['Keyboard', 'Press Escape to cancel a wire in progress. Use Tab to reach the toolbar buttons.']
        ]],
        FPGA: ['Design and test digital logic', [
            ['Source and signals', 'Edit the Verilog source and use the toolbar to build and simulate it. Inspect the signals and board pins in the results.'],
            ['Trackpad or mouse wheel', 'Scroll the source or results pane under the pointer.'],
            ['Keyboard', 'Use Tab to reach the toolbar buttons and Ctrl or ⌘ + Z to undo text edits.']
        ]],
        Widgets: ['Build a controller', [
            ['Edit', 'Add a widget, drag it into place, and select it to edit its bindings.'],
            ['Play', 'Use the buttons and sliders to send values to the program. A keyboard widget can send the keys it is configured for.'],
            ['Pointer', 'Use the trackpad or mouse to click and drag. Use Tab to move between the toolbar controls.']
        ]],
        Robots: ['Build and simulate a robot', [
            ['Build', 'Drag parts from the palette into the scene. Click a part to select it or drag on empty space to select several.'],
            ['Simulate', 'Switch to Simulate to run the program and choose an arena.'],
            ['Keyboard in Build', 'Space + drag pans. Press ? over the viewport for part, connector, and placement shortcuts.']
        ]],
        CAD: ['Build a 3D model', [
            ['Model tools', 'Add a shape from the browser or draw a profile with Sketch. The arrow next to Sketch opens Sketch Path and Revolve. Select a solid and open Edit for Mirror or Pattern.'],
            ['Objects and Properties', 'Click a body to select it. Use Properties to change dimensions and the view cube to look from another side.'],
            ['Keyboard', 'Space + drag pans. V selects, W moves, E rotates, R scales, and F frames. Ctrl or ⌘ + Shift + P opens the command palette.']
        ]]
    },
    de: {
        Blocks: ['Ein Programm bauen', [
            ['Blockpalette', 'Ziehe einen Block auf die Arbeitsfläche und füge ihn an einen Stapel an. Ziehe ihn vom Stapel weg, um ihn zu lösen.'],
            ['Trackpad oder Mausrad', 'Bewege zwei Finger, um die Arbeitsfläche zu scrollen. Zoome mit den Tasten oder mit einer Pinch-Geste auf dem Trackpad.'],
            ['Tastatur', 'Strg oder ⌘ + Z macht eine Änderung rückgängig. Die grüne Flagge startet Stapel, die auf das Flaggenereignis reagieren.']
        ]],
        Costumes: ['Bilder bearbeiten', [
            ['Werkzeuge', 'Wähle ein Zeichenwerkzeug neben der Leinwand. Mit dem Auswahlwerkzeug verschiebst oder skalierst du Elemente. Links wechselst du das Bild.'],
            ['Zeiger', 'Ziehe auf der Leinwand, um zu zeichnen oder die Auswahl zu verändern. Nutze die Zoomtasten unter der Leinwand für Details.'],
            ['Tastatur', 'Strg oder ⌘ + Z macht eine Änderung rückgängig. Entf löscht die Auswahl.']
        ]],
        Sounds: ['Einen Klang bearbeiten', [
            ['Klangliste und Wellenform', 'Wähle einen Klang. Ziehe über die Wellenform, um einen Abschnitt auszuwählen, und nutze dann die Bearbeitungstasten.'],
            ['Wiedergabe', 'Höre deine Änderungen mit Wiedergabe und Stopp ab.'],
            ['Tastatur', 'Tab wechselt zwischen den Bedienelementen. Leertaste oder Eingabe betätigt eine fokussierte Taste.']
        ]],
        Code: ['Ein Programm schreiben', [
            ['Code und Blöcke', 'Bearbeite den Pseudocode hier. Nutze die Übertragungstasten für den Wechsel zwischen Code und Blöcken.'],
            ['Trackpad oder Mausrad', 'Scrolle im Codebereich. Klicke, um die Schreibmarke zu setzen, oder ziehe, um Text zu markieren.'],
            ['Tastatur', 'Strg oder ⌘ + F sucht. Strg oder ⌘ + Z macht eine Textänderung rückgängig.']
        ]],
        Circuit: ['Eine Schaltung verdrahten und testen', [
            ['Bauteile und Drähte', 'Wähle ein Bauteil aus der Bibliothek. Beginne einen Draht an einem Pin und verbinde ihn mit einem anderen Pin.'],
            ['Ansicht', 'Bewege im Schaltplan zwei Finger zum Verschieben und nutze die Pinch-Geste zum Zoomen. Klicke ein Bauteil an, um seine Eigenschaften zu sehen.'],
            ['Tastatur', 'Esc bricht das Verlegen eines Drahtes ab. Mit Tab erreichst du die Werkzeuge.']
        ]],
        FPGA: ['Digitale Logik entwerfen und testen', [
            ['Quelltext und Signale', 'Bearbeite den Verilog-Quelltext. Die Werkzeugleiste startet die Synthese und Simulation. Die Ergebnisse zeigen Signale und Anschlüsse.'],
            ['Trackpad oder Mausrad', 'Scrolle im Quelltext oder im Ergebnisbereich unter dem Zeiger.'],
            ['Tastatur', 'Tab wechselt zwischen den Werkzeugen. Strg oder ⌘ + Z macht eine Textänderung rückgängig.']
        ]],
        Widgets: ['Einen Controller bauen', [
            ['Bearbeiten', 'Füge ein Widget hinzu und ziehe es an seinen Platz. Wähle es aus, um seine Bindungen zu ändern.'],
            ['Spielen', 'Mit Tasten und Reglern sendest du Werte an das Programm. Ein Tastatur-Widget sendet die eingestellten Tasten.'],
            ['Zeiger', 'Klicke und ziehe mit dem Trackpad oder der Maus. Tab wechselt zwischen den Werkzeugen.']
        ]],
        Robots: ['Einen Roboter bauen und simulieren', [
            ['Bauen', 'Ziehe Teile aus der Palette in die Szene. Klicke ein Teil an oder ziehe auf freier Fläche einen Auswahlrahmen.'],
            ['Simulieren', 'Wechsle zu Simulieren, um das Programm auszuführen und eine Arena auszuwählen.'],
            ['Tastatur beim Bauen', 'Leertaste + Ziehen verschiebt die Ansicht. Mit ? über der 3D-Ansicht öffnest du die Tasten für Teile, Verbindungen und Platzierung.']
        ]],
        CAD: ['Ein 3D-Modell bauen', [
            ['Modellwerkzeuge', 'Füge eine Form hinzu oder zeichne mit Skizze ein Profil. Der Pfeil neben Skizze öffnet Skizzenpfad und Drehen. Wähle einen Körper und öffne Bearbeiten zum Spiegeln oder Wiederholen.'],
            ['Objekte und Eigenschaften', 'Klicke auf einen Körper, um ihn auszuwählen. Ändere seine Maße in Eigenschaften. Mit dem Ansichtswürfel wechselst du die Blickrichtung.'],
            ['Tastatur', 'Leertaste + Ziehen verschiebt die Ansicht. V wählt aus, W verschiebt, E dreht, R skaliert, und F passt die Ansicht an. Strg oder ⌘ + Umschalt + P öffnet die Befehlspalette.']
        ]]
    }
};

const actions = {
    en: {pan: 'Pan', orbit: 'Orbit', zoom: 'Zoom'},
    de: {pan: 'Verschieben', orbit: 'Drehen', zoom: 'Zoomen'}
};

const EditorHelp = ({editor, label, locale, inTabList = false}) => {
    const dialog = useRef(null);
    const trigger = useRef(null);
    React.useEffect(() => {
        const closeOnEscape = event => {
            if (event.key !== 'Escape' || !dialog.current?.open) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            dialog.current.close();
        };
        // The drawing workspace also owns Escape. Give the open help dialog
        // first use of it while focus is in the dialog.
        window.addEventListener('keydown', closeOnEscape, true);
        return () => window.removeEventListener('keydown', closeOnEscape, true);
    }, []);
    const [camera, setCamera] = React.useState(getCameraPreferences);
    const de = /^de/i.test(locale);
    const language = de ? 'de' : 'en';
    const [heading, items] = help[language][editor === 'Backdrops' ? 'Costumes' : editor];
    const title = de ? `Hilfe für ${label}` : `${label} help`;
    const mode = actions[language];
    const alternative = action => mode[action === 'orbit' ? 'pan' : 'orbit'];
    const hasCamera = editor === 'Robots' || editor === 'CAD';
    const Slot = inTabList ? 'li' : 'div';
    const testId = inTabList ? 'bw-editor-help' : 'bw-widgets-help';
    return (
        <Slot className={styles.slot} role={inTabList ? 'presentation' : undefined}>
            <button ref={trigger} className={styles.trigger} type="button" aria-label={title} aria-haspopup="dialog"
                title={title} data-testid={testId} onClick={() => {
                    setCamera(getCameraPreferences());
                    dialog.current.showModal();
                }}>
                <span aria-hidden="true">?</span>
            </button>
            <dialog ref={dialog} className={styles.dialog} aria-label={title} data-testid={`${testId}-dialog`}
                onClose={() => trigger.current?.focus({preventScroll: true})}>
                <form method="dialog" className={styles.header}>
                    <h2>{title}</h2>
                    <button type="submit" autoFocus>{de ? 'Schließen' : 'Close'}</button>
                </form>
                <h3>{heading}</h3>
                <dl>{items.map(([term, detail]) => (
                    <div key={term}><dt>{term}</dt><dd>{detail}</dd></div>
                ))}</dl>
                {hasCamera && <React.Fragment>
                    <h3>{de ? '3D-Navigation' : '3D navigation'}{editor === 'Robots' ? (de ? ' beim Bauen' : ' in Build') : ''}</h3>
                    <dl>
                        <div><dt>{de ? 'Zwei Finger bewegen' : 'Two-finger slide'}</dt>
                            <dd>{mode[camera.trackpadSlide]} · {de ? 'mit Umschalt' : 'with Shift'} {alternative(camera.trackpadSlide)}</dd></div>
                        <div><dt>{de ? 'Mit Sekundärklick ziehen' : 'Secondary-click and drag'}</dt>
                            <dd>{mode[camera.secondaryDrag]} · {de ? 'mit Umschalt' : 'with Shift'} {alternative(camera.secondaryDrag)}</dd></div>
                        <div><dt>{de ? 'Pinch-Geste oder Mausrad' : 'Pinch or mouse wheel'}</dt><dd>{mode.zoom}</dd></div>
                        <div><dt>{de ? 'Mit mittlerer Maustaste ziehen' : 'Middle-button drag'}</dt>
                            <dd>{mode.pan} · {de ? 'mit Umschalt' : 'with Shift'} {mode.orbit}</dd></div>
                    </dl>
                    <p>{de ? 'Ändere die Gesten unter Einstellungen → 3D-Navigation.' : 'Change the gestures in Settings → 3D navigation.'}</p>
                </React.Fragment>}
            </dialog>
        </Slot>
    );
};

export default EditorHelp;
