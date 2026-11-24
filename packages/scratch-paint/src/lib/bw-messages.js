/**
 * Brickwright: strings for the designer additions.
 *
 * Our components aren't part of scratch-l10n, so react-intl has no translations for them and
 * `formatMessage` would only ever return the English default. Following the same convention as
 * the rest of the Brickwright UI, we keep a per-locale table here and pick from it with the
 * locale react-intl already knows. Adding a language is adding a column.
 */

const STRINGS = {
    en: {
        properties: 'Properties',
        showProperties: 'Show properties',
        hideProperties: 'Hide properties',
        brushPreset: 'Brush preset', brushCustom: 'Custom',
        brushFine: 'Fine · 2 px', brushMedium: 'Medium · 8 px',
        brushBroad: 'Broad · 24 px', brushLight: 'Light · 35%',
        recentColours: 'Recent colours', reuseColour: 'Reuse colour',

        precisionDrawing: 'Precision drawing',
        precisionDrawingHint: 'Costume units. X points right and Y points down from the canvas center.',
        precisionCenterX: 'Center X', precisionCenterY: 'Center Y',
        precisionWidth: 'Width', precisionHeight: 'Height', precisionDiameter: 'Diameter', circle: 'Circle',
        precisionArc: 'Circular arc', precisionRadius: 'Radius', precisionStrokeWidth: 'Stroke width',
        precisionStartX: 'Start X', precisionStartY: 'Start Y', precisionEndX: 'End X', precisionEndY: 'End Y',
        precisionStartAngle: 'Start angle (°)', precisionSweep: 'Sweep (°)',
        precisionArcHint: 'Zero points right. Use a positive sweep for clockwise or a negative sweep for counterclockwise, under 360°.',
        precisionStrokeCadHint: 'In Send to CAD, choose Open paths for centerlines or Strokes for filled outlines.',
        precisionInvalidShape: 'Check the dimensions and position. The shape must fit in the drawing area.',
        precisionInsertUnavailable: 'The vector canvas is still loading. Try again when it is ready.',
        precisionAddShape: 'Add shape', precisionSelectMode: 'Switch to Select to add a shape',
        transform: 'Transform',
        positionX: 'X',
        positionY: 'Y',
        width: 'W',
        height: 'H',
        rotation: 'Rotation',
        lockAspect: 'Lock aspect ratio',
        rotateClockwise: 'Rotate 90° clockwise',
        rotateCounterClockwise: 'Rotate 90° counter-clockwise',
        nothingSelected: 'Select something to transform it.',
        rotationMultiple: 'Rotation can only be typed for a single object — use the buttons.',

        appearance: 'Appearance',
        opacity: 'Opacity',
        opacityMixed: 'The selected objects have different opacities.',

        align: 'Align',
        alignLeft: 'Align left',
        alignHorizontalCenter: 'Align horizontal centres',
        alignRight: 'Align right',
        alignTop: 'Align top',
        alignVerticalCenter: 'Align vertical centres',
        alignBottom: 'Align bottom',
        distributeHorizontal: 'Space evenly across',
        distributeVertical: 'Space evenly down',
        alignToSelection: 'Selection',
        alignToCanvas: 'Canvas',
        alignRelativeTo: 'Relative to',
        needTwo: 'Select two or more objects.',
        needThree: 'Select three or more objects.',

        combine: 'Combine',
        unite: 'Unite',
        subtract: 'Subtract front',
        intersect: 'Intersect',
        exclude: 'Exclude overlap',
        divide: 'Divide',
        needTwoPaths: 'Select two or more shapes.',
        booleanEmpty: 'Those shapes do not overlap, so there would be nothing left.',

        symmetry: 'Symmetry',
        mirrorHorizontal: 'Mirror a copy left/right',
        mirrorVertical: 'Mirror a copy up/down',
        mirrorAbout: 'Mirror about',
        mirrorAboutEdge: 'Edge',
        mirrorAboutCanvas: 'Canvas',

        objects: 'Objects',
        noObjects: 'Nothing drawn yet.',
        showObject: 'Show',
        hideObject: 'Hide while editing',
        lockObject: 'Lock',
        unlockObject: 'Unlock',
        renameHint: 'Click to select, double-click to rename, drag to reorder',
        roundedRectangle: 'Rounded rectangle',
        rectangle: 'Rectangle', lasso: 'Lasso', magicWand: 'Magic wand', tolerance: 'Tolerance',
        triangle: 'Triangle', ellipse: 'Ellipse', line: 'Line',
        polygon: 'Polygon', star: 'Star', shapeObject: 'Shape', groupObject: 'Group',
        imageObject: 'Image', compoundPath: 'Compound path', textObject: 'Text', object: 'Object',
        sides: 'sides', points: 'points',

        grid: 'Grid & snapping',
        showGrid: 'Show grid',
        gridSize: 'Size',
        snapToGrid: 'Snap to grid',
        smartGuides: 'Snap to objects',
        smartGuidesHint: 'Dragging lines up with other objects’ edges and centres.',

        shape: 'Shape',
        cornerRadius: 'Corner radius',
        polygonSides: 'Sides',
        starPoints: 'Points',
        starInnerRatio: 'Waist'
    },
    de: {
        properties: 'Eigenschaften',
        showProperties: 'Eigenschaften einblenden',
        hideProperties: 'Eigenschaften ausblenden',
        brushPreset: 'Pinselvorlage', brushCustom: 'Benutzerdefiniert',
        brushFine: 'Fein · 2 px', brushMedium: 'Mittel · 8 px',
        brushBroad: 'Breit · 24 px', brushLight: 'Leicht · 35%',
        recentColours: 'Letzte Farben', reuseColour: 'Farbe erneut verwenden',

        precisionDrawing: 'Präzisionszeichnen',
        precisionDrawingHint: 'Kostümeinheiten. X zeigt von der Zeichenflächenmitte nach rechts, Y nach unten.',
        precisionCenterX: 'Mitte X', precisionCenterY: 'Mitte Y',
        precisionWidth: 'Breite', precisionHeight: 'Höhe', precisionDiameter: 'Durchmesser', circle: 'Kreis',
        precisionArc: 'Kreisbogen', precisionRadius: 'Radius', precisionStrokeWidth: 'Linienstärke',
        precisionStartX: 'Start X', precisionStartY: 'Start Y', precisionEndX: 'Ende X', precisionEndY: 'Ende Y',
        precisionStartAngle: 'Startwinkel (°)', precisionSweep: 'Bogenwinkel (°)',
        precisionArcHint: 'Null zeigt nach rechts. Positive Winkel laufen im Uhrzeigersinn, negative dagegen. Der Betrag muss kleiner als 360° sein.',
        precisionStrokeCadHint: 'Wähle unter An CAD senden offene Pfade für Mittellinien oder Linienzüge für gefüllte Konturen.',
        precisionInvalidShape: 'Prüfe Maße und Position. Die Form muss in die Zeichenfläche passen.',
        precisionInsertUnavailable: 'Die Vektorzeichenfläche wird noch geladen. Versuche es danach erneut.',
        precisionAddShape: 'Form hinzufügen', precisionSelectMode: 'Zum Hinzufügen einer Form auf Auswählen wechseln',
        transform: 'Transformieren',
        positionX: 'X',
        positionY: 'Y',
        width: 'B',
        height: 'H',
        rotation: 'Drehung',
        lockAspect: 'Seitenverhältnis sperren',
        rotateClockwise: 'Um 90° im Uhrzeigersinn drehen',
        rotateCounterClockwise: 'Um 90° gegen den Uhrzeigersinn drehen',
        nothingSelected: 'Wähle etwas aus, um es zu transformieren.',
        rotationMultiple: 'Die Drehung lässt sich nur für ein einzelnes Objekt eintippen — nutze die Schaltflächen.',

        appearance: 'Darstellung',
        opacity: 'Deckkraft',
        opacityMixed: 'Die ausgewählten Objekte haben unterschiedliche Deckkraft.',

        align: 'Ausrichten',
        alignLeft: 'Linksbündig ausrichten',
        alignHorizontalCenter: 'Horizontal zentrieren',
        alignRight: 'Rechtsbündig ausrichten',
        alignTop: 'Oben ausrichten',
        alignVerticalCenter: 'Vertikal zentrieren',
        alignBottom: 'Unten ausrichten',
        distributeHorizontal: 'Horizontal gleichmäßig verteilen',
        distributeVertical: 'Vertikal gleichmäßig verteilen',
        alignToSelection: 'Auswahl',
        alignToCanvas: 'Zeichenfläche',
        alignRelativeTo: 'Relativ zu',
        needTwo: 'Wähle zwei oder mehr Objekte aus.',
        needThree: 'Wähle drei oder mehr Objekte aus.',

        combine: 'Kombinieren',
        unite: 'Vereinen',
        subtract: 'Vorderes abziehen',
        intersect: 'Schnittmenge',
        exclude: 'Überlappung ausschließen',
        divide: 'Unterteilen',
        needTwoPaths: 'Wähle zwei oder mehr Formen aus.',
        booleanEmpty: 'Diese Formen überlappen sich nicht — es bliebe nichts übrig.',

        symmetry: 'Symmetrie',
        mirrorHorizontal: 'Kopie links/rechts spiegeln',
        mirrorVertical: 'Kopie oben/unten spiegeln',
        mirrorAbout: 'Spiegeln an',
        mirrorAboutEdge: 'Kante',
        mirrorAboutCanvas: 'Zeichenfläche',

        objects: 'Objekte',
        noObjects: 'Noch nichts gezeichnet.',
        showObject: 'Einblenden',
        hideObject: 'Beim Bearbeiten ausblenden',
        lockObject: 'Sperren',
        unlockObject: 'Entsperren',
        renameHint: 'Klicken zum Auswählen, Doppelklick zum Umbenennen, Ziehen zum Umsortieren',
        roundedRectangle: 'Abgerundetes Rechteck',
        rectangle: 'Rechteck', lasso: 'Lasso', magicWand: 'Zauberstab', tolerance: 'Toleranz',
        triangle: 'Dreieck', ellipse: 'Ellipse', line: 'Linie',
        polygon: 'Vieleck', star: 'Stern', shapeObject: 'Form', groupObject: 'Gruppe',
        imageObject: 'Bild', compoundPath: 'Zusammengesetzter Pfad', textObject: 'Text', object: 'Objekt',
        sides: 'Seiten', points: 'Punkte',

        grid: 'Raster & Einrasten',
        showGrid: 'Raster anzeigen',
        gridSize: 'Größe',
        snapToGrid: 'Am Raster einrasten',
        smartGuides: 'An Objekten einrasten',
        smartGuidesHint: 'Beim Ziehen an Kanten und Mitten anderer Objekte ausrichten.',

        shape: 'Form',
        cornerRadius: 'Eckenradius',
        polygonSides: 'Seiten',
        starPoints: 'Zacken',
        starInnerRatio: 'Taille'
    }
};

/**
 * @param {?string} locale A locale tag such as "de" or "de-CH".
 * @param {!string} key Key into the string table.
 * @return {string} The localised string, falling back to English and then to the key itself.
 */
const tx = function (locale, key) {
    const language = String(locale || 'en').split('-')[0];
    const table = STRINGS[language] || STRINGS.en;
    return table[key] || STRINGS.en[key] || key;
};

export {
    STRINGS,
    tx as default,
    tx
};
