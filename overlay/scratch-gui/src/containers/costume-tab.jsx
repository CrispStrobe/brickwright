import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import {defineMessages, intlShape, injectIntl} from 'react-intl';
import VM from 'scratch-vm';

import AssetPanel from '../components/asset-panel/asset-panel.jsx';
import CostumePrecision from '../components/gui/costume-precision.jsx';
import PaintEditorWrapper from './paint-editor-wrapper.jsx';

// The palette pixel editor (Arcade-style sprites): loaded on first use only.
const PixelArtEditor = React.lazy(() =>
    import(/* webpackChunkName: "bw-pixel-editor" */ '../components/tw-pseudocode/pixel-art-editor.jsx'));
// The Arcade tile map painter: also loaded on first use.
const TilemapEditor = React.lazy(() =>
    import(/* webpackChunkName: "bw-tilemap-editor" */ '../components/tw-pseudocode/tilemap-editor.jsx'));
import {hasTilemapBlocks} from '../lib/bw-makecode/tilemap-presence.js';
import {confirmAsync} from '../lib/native-dialog.js';
import getFonts from '../lib/lazy-render-fonts.js';
import {connect} from 'react-redux';
import {handleFileUpload, costumeUpload} from '../lib/file-uploader.js';
import errorBoundaryHOC from '../lib/error-boundary-hoc.jsx';
import DragConstants from '../lib/drag-constants';
import {emptyCostume} from '../lib/empty-assets';
import sharedMessages from '../lib/shared-messages';
import downloadBlob from '../lib/download-blob';
import {copyCostumeDocument, syncAnimationResources} from '../lib/bw-artwork-bundle';
import {makeT} from '../lib/bw-i18n';
import {activateUndoSurface} from '../lib/global-undo.js';
import {notifyEditorMenuActions} from '../lib/editor-menu-actions.js';
import EditorErrorBoundary from '../components/editor-error-boundary/editor-error-boundary.jsx';
import styles from './costume-tab.css';

const editorT = makeT({
    en: {open: 'Open file…', save: 'Save file', pixel: 'Pixel editor', paint: 'Paint editor'},
    de: {open: 'Datei öffnen…', save: 'Datei speichern', pixel: 'Pixel-Editor', paint: 'Malprogramm'}
});

import {
    openCostumeLibrary,
    openBackdropLibrary
} from '../reducers/modals';

import {
    activateTab,
    SOUNDS_TAB_INDEX
} from '../reducers/editor-tab';

import {setRestore} from '../reducers/restore-deletion';
import {showStandardAlert, closeAlertWithId} from '../reducers/alerts';

import addLibraryBackdropIcon from '../components/asset-panel/icon--add-backdrop-lib.svg';
import addLibraryCostumeIcon from '../components/asset-panel/icon--add-costume-lib.svg';
import fileUploadIcon from '../components/action-menu/icon--file-upload.svg';
import paintIcon from '../components/action-menu/icon--paint.svg';
import surpriseIcon from '../components/action-menu/icon--surprise.svg';
import searchIcon from '../components/action-menu/icon--search.svg';


let messages = defineMessages({
    addLibraryBackdropMsg: {
        defaultMessage: 'Choose a Backdrop',
        description: 'Button to add a backdrop in the editor tab',
        id: 'gui.costumeTab.addBackdropFromLibrary'
    },
    addLibraryCostumeMsg: {
        defaultMessage: 'Choose a Costume',
        description: 'Button to add a costume in the editor tab',
        id: 'gui.costumeTab.addCostumeFromLibrary'
    },
    addBlankCostumeMsg: {
        defaultMessage: 'Paint',
        description: 'Button to add a blank costume in the editor tab',
        id: 'gui.costumeTab.addBlankCostume'
    },
    addSurpriseCostumeMsg: {
        defaultMessage: 'Surprise',
        description: 'Button to add a surprise costume in the editor tab',
        id: 'gui.costumeTab.addSurpriseCostume'
    },
    addFileBackdropMsg: {
        defaultMessage: 'Upload Backdrop',
        description: 'Button to add a backdrop by uploading a file in the editor tab',
        id: 'gui.costumeTab.addFileBackdrop'
    },
    addFileCostumeMsg: {
        defaultMessage: 'Upload Costume',
        description: 'Button to add a costume by uploading a file in the editor tab',
        id: 'gui.costumeTab.addFileCostume'
    }
});

messages = {...messages, ...sharedMessages};

class CostumeTab extends React.Component {
    constructor (props) {
        super(props);
        this.pixelEditor = React.createRef();
        this.tilemapEditor = React.createRef();
        bindAll(this, [
            'costumeMenuActions',
            'handleSelectCostume',
            'handleDeleteCostume',
            'handleDuplicateCostume',
            'handleExportCostume',
            'handleNewCostume',
            'handleNewBlankCostume',
            'handleSurpriseCostume',
            'handleSurpriseBackdrop',
            'handleFileUploadClick',
            'handleCostumeUpload',
            'handleDrop',
            'setFileInput'
        ]);
        const {
            editingTarget,
            sprites,
            stage
        } = props;
        const target = editingTarget && sprites[editingTarget] ? sprites[editingTarget] : stage;
        if (target && target.currentCostume) {
            this.state = {selectedCostumeIndex: target.currentCostume, pixelMode: false, tilemapMode: false};
        } else {
            this.state = {selectedCostumeIndex: 0, pixelMode: false, tilemapMode: false};
        }
    }
    componentDidMount () {
        this._menuMounted = true;
        // The paint editor's text tool draws with the render fonts, which are a
        // lazy chunk (lib/lazy-render-fonts.js). This tab is mounted only while
        // it is shown, so this is the first moment they are worth having.
        getFonts.loadFonts().catch(() => { /* fallback faces; the tool still works */ });
    }
    componentWillUnmount () {
        this._menuMounted = false;
        notifyEditorMenuActions();
    }
    componentDidUpdate (prevProps, prevState) {
        if (prevState.selectedCostumeIndex !== this.state.selectedCostumeIndex ||
            prevState.pixelMode !== this.state.pixelMode || prevState.tilemapMode !== this.state.tilemapMode ||
            prevProps.editingTarget !== this.props.editingTarget || prevProps.sprites !== this.props.sprites ||
            prevProps.stage !== this.props.stage || prevProps.intl !== this.props.intl) notifyEditorMenuActions();
        // Menu-bar Undo / Redo / History follow the editor that is showing.
        if (prevState.pixelMode !== this.state.pixelMode || prevState.tilemapMode !== this.state.tilemapMode) {
            activateUndoSurface(this.state.tilemapMode ? 'tilemap' : this.state.pixelMode ? 'pixel' : 'costumes');
        }
    }
    componentWillReceiveProps (nextProps) {
        const {
            editingTarget,
            sprites,
            stage
        } = nextProps;

        const target = editingTarget && sprites[editingTarget] ? sprites[editingTarget] : stage;
        if (!target || !target.costumes) {
            return;
        }

        if (this.props.editingTarget === editingTarget) {
            // If costumes have been added or removed, change costumes to the editing target's
            // current costume.
            const oldTarget = this.props.sprites[editingTarget] ?
                this.props.sprites[editingTarget] : this.props.stage;
            // @todo: Find and switch to the index of the costume that is new. This is blocked by
            // https://github.com/LLK/scratch-vm/issues/967
            // Right now, you can land on the wrong costume if a costume changing script is running.
            if (oldTarget.costumeCount !== target.costumeCount) {
                this.setState({selectedCostumeIndex: target.currentCostume});
            }
        } else {
            // If switching editing targets, update the costume index
            this.setState({selectedCostumeIndex: target.currentCostume});
        }
    }
    savePixelBeforeSwitch () {
        const editor = this.pixelEditor.current;
        return !this.state.pixelMode || !editor?.hasUnsavedChanges() || editor.save() !== false;
    }
    handleSelectCostume (costumeIndex) {
        if (!this.savePixelBeforeSwitch()) return;
        this.props.vm.editingTarget.setCostume(costumeIndex);
        this.setState({selectedCostumeIndex: costumeIndex});
    }
    handleDeleteCostume (costumeIndex) {
        if (!this.savePixelBeforeSwitch()) return;
        const restoreCostumeFun = this.props.vm.deleteCostume(costumeIndex);
        syncAnimationResources(this.props.vm);
        this.props.dispatchUpdateRestore({
            restoreFun: (...args) => {
                const result = restoreCostumeFun(...args);
                return Promise.resolve(result).then(value => { syncAnimationResources(this.props.vm); return value; });
            },
            deletedItem: 'Costume'
        });
    }
    handleDuplicateCostume (costumeIndex) {
        const vm = this.props.vm;
        const target = vm.editingTarget;
        const original = target.sprite.costumes[costumeIndex];
        return vm.duplicateCostume(costumeIndex).then(() => {
            copyCostumeDocument(original, target.sprite.costumes[costumeIndex + 1], this.props.vm);
        });
    }
    handleExportCostume (costumeIndex) {
        const item = this.props.vm.editingTarget.sprite.costumes[costumeIndex];
        const blob = new Blob([item.asset.data], {type: item.asset.assetType.contentType});
        downloadBlob(`${item.name}.${item.asset.dataFormat}`, blob);
    }
    handleNewCostume (costume, fromCostumeLibrary, targetId) {
        const costumes = Array.isArray(costume) ? costume : [costume];

        return Promise.all(costumes.map(c => {
            if (fromCostumeLibrary) {
                return this.props.vm.addCostumeFromLibrary(c.md5, c);
            }
            // If targetId is falsy, VM should default it to editingTarget.id
            // However, targetId should be provided to prevent #5876,
            // if making new costume takes a while
            return this.props.vm.addCostume(c.md5, c, targetId);
        }));
    }
    handleNewBlankCostume () {
        if (!this.savePixelBeforeSwitch()) return;
        const target = this.props.vm.editingTarget;
        const name = target.isStage ?
            this.props.intl.formatMessage(messages.backdrop, {index: 1}) :
            this.props.intl.formatMessage(messages.costume, {index: 1});
        this.handleNewCostume(emptyCostume(name), false, target.id);
    }
    handleSurpriseCostume () {
        // Brickwright: the manifests are a lazy chunk shared with the library modals.
        import(/* webpackChunkName: "asset-library-index" */ '../lib/libraries/costumes.json').then(mod => {
            const content = mod.default;
            const item = content[Math.floor(Math.random() * content.length)];
            const vmCostume = {
                name: item.name,
                md5: item.md5ext,
                rotationCenterX: item.rotationCenterX,
                rotationCenterY: item.rotationCenterY,
                bitmapResolution: item.bitmapResolution,
                skinId: null
            };
            this.handleNewCostume(vmCostume, true /* fromCostumeLibrary */);
        });
    }
    handleSurpriseBackdrop () {
        import(/* webpackChunkName: "asset-library-index" */ '../lib/libraries/backdrops.json').then(mod => {
            const content = mod.default;
            const item = content[Math.floor(Math.random() * content.length)];
            const vmCostume = {
                name: item.name,
                md5: item.md5ext,
                rotationCenterX: item.rotationCenterX,
                rotationCenterY: item.rotationCenterY,
                bitmapResolution: item.bitmapResolution,
                skinId: null
            };
            this.handleNewCostume(vmCostume);
        });
    }
    handleCostumeUpload (e) {
        const storage = this.props.vm.runtime.storage;
        const targetId = this.props.vm.editingTarget.id;
        this.props.onShowImporting();
        handleFileUpload(e.target, (buffer, fileType, fileName, fileIndex, fileCount) => {
            costumeUpload(buffer, fileType, storage, vmCostumes => {
                vmCostumes.forEach((costume, i) => {
                    costume.name = `${fileName}${i ? i + 1 : ''}`;
                });
                this.handleNewCostume(vmCostumes, false, targetId).then(() => {
                    if (fileIndex === fileCount - 1) {
                        this.props.onCloseImporting();
                    }
                });
            }, this.props.onCloseImporting);
        }, this.props.onCloseImporting);
    }
    handleFileUploadClick () {
        this.fileInput.click();
    }
    handleDrop (dropInfo) {
        if (dropInfo.dragType === DragConstants.COSTUME) {
            const sprite = this.props.vm.editingTarget.sprite;
            const activeCostume = sprite.costumes[this.state.selectedCostumeIndex];
            this.props.vm.reorderCostume(this.props.vm.editingTarget.id,
                dropInfo.index, dropInfo.newIndex);
            this.setState({selectedCostumeIndex: sprite.costumes.indexOf(activeCostume)});
        } else if (dropInfo.dragType === DragConstants.BACKPACK_COSTUME) {
            this.props.vm.addCostume(dropInfo.payload.body, {
                name: dropInfo.payload.name
            });
        } else if (dropInfo.dragType === DragConstants.BACKPACK_SOUND) {
            this.props.onActivateSoundsTab();
            this.props.vm.addSound({
                md5: dropInfo.payload.body,
                name: dropInfo.payload.name
            });
        }
    }
    setFileInput (input) {
        this.fileInput = input;
    }
    formatCostumeDetails (size, optResolution) {
        // If no resolution is given, assume that the costume is an SVG
        const resolution = optResolution ? optResolution : 1;
        // Convert size to stage units by dividing by resolution
        // Round up width and height for scratch-flash compatibility
        // https://github.com/LLK/scratch-flash/blob/9fbac92ef3d09ceca0c0782f8a08deaa79e4df69/src/ui/media/MediaInfo.as#L224-L237
        return `${Math.ceil(size[0] / resolution)} x ${Math.ceil(size[1] / resolution)}`;
    }
    costumeMenuActions () {
        const target = this.props.vm.editingTarget;
        const index = this.state.selectedCostumeIndex;
        const costume = target?.sprite?.costumes?.[index];
        if (!this._menuMounted || this.state.pixelMode || this.state.tilemapMode ||
            !target || target.currentCostume !== index || !costume) return null;
        const intl = this.props.intl;
        const action = (label, enabled, run) => ({label, location: 'file', enabled: !!enabled, run});
        return {
            open: action(editorT(intl.locale, 'open'), typeof this.fileInput?.click === 'function', this.handleFileUploadClick),
            export: action(editorT(intl.locale, 'save'), costume.asset, () => this.handleExportCostume(index)),
            new: action(intl.formatMessage(messages.addBlankCostumeMsg), true, this.handleNewBlankCostume),
            duplicate: action(intl.formatMessage({id: 'gui.spriteSelectorItem.contextMenuDuplicate', defaultMessage: 'duplicate'}),
                true, () => this.handleDuplicateCostume(index))
        };
    }
    render () {
        const {
            dispatchUpdateRestore, // eslint-disable-line no-unused-vars
            intl,
            isRtl,
            onNewLibraryBackdropClick,
            onNewLibraryCostumeClick,
            vm
        } = this.props;

        if (!vm.editingTarget) {
            return null;
        }

        const isStage = vm.editingTarget.isStage;
        const target = vm.editingTarget.sprite;

        const addLibraryMessage = isStage ? messages.addLibraryBackdropMsg : messages.addLibraryCostumeMsg;
        const addFileMessage = isStage ? messages.addFileBackdropMsg : messages.addFileCostumeMsg;
        const addSurpriseFunc = isStage ? this.handleSurpriseBackdrop : this.handleSurpriseCostume;
        const addLibraryFunc = isStage ? onNewLibraryBackdropClick : onNewLibraryCostumeClick;
        const addLibraryIcon = isStage ? addLibraryBackdropIcon : addLibraryCostumeIcon;

        const costumeData = target.costumes ? target.costumes.map(costume => ({
            name: costume.name,
            asset: costume.asset,
            details: costume.size ? this.formatCostumeDetails(costume.size, costume.bitmapResolution) : null,
            dragPayload: costume
        })) : [];
        const de = intl.locale.startsWith('de');
        const newLabel = vm.editingTarget.isStage ?
            (de ? 'Neuer Hintergrund' : 'New Backdrop') : (de ? 'Neues Kostüm' : 'New Costume');
        const openFileLabel = editorT(intl.locale, 'open');
        const saveFileLabel = editorT(intl.locale, 'save');
        const editorLabel = editorT(intl.locale, this.state.pixelMode ? 'paint' : 'pixel');
        const toolIcon = name => {
            const paths = {
                open: <><path d="M3 7V4h7l2 2h9v3" /><path d="M3 10h18l-2 10H5L3 10z" /></>,
                save: <><path d="M4 3h14l3 3v15H3V3h1z" /><path d="M7 3v7h10V3M7 21v-8h10v8" /></>,
                pixel: <><rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="1"
                /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></>,
                new: <><path d="M13 3H5v18h14V9l-6-6zM13 3v6h6M9 15h6m-3-3v6" /></>,
                cad: <><path d="m12 3 9 5v9l-9 5-9-5V8l9-5zM3 8l9 5 9-5m-9 5v9" /></>,
                paint: <><path d="M4 20l4.5-1 10-10-3.5-3.5-10 10L4 20z" /><path d="M13.5 7l3.5 3.5" /></>,
                tilemap: <><rect
                    x="3"
                    y="3"
                    width="7"
                    height="7"
                /><rect
                    x="14"
                    y="3"
                    width="7"
                    height="7"
                /><rect
                    x="3"
                    y="14"
                    width="7"
                    height="7"
                /><path d="M14 17.5h7M17.5 14v7" /></>
            };
            return (<svg
                aria-hidden="true"
                className={styles.editorToolIcon}
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
            >
                {paths[name]}
            </svg>);
        };
        // A level lives in a `set Arcade tilemap` block; the painter is offered
        // when the project has one or uses the Arcade extension.
        const hasTilemaps = this.state.tilemapMode || hasTilemapBlocks(vm) ||
            Boolean(vm.extensionManager?.isExtensionLoaded?.('arcade'));
        const tilemapLabel = intl.locale.startsWith('de') ? 'Kachelkarten' : 'Tile maps';
        const toggleTilemap = async () => {
            const painter = this.tilemapEditor.current;
            // confirmAsync, not confirm(): the app's dialog plugin answers confirm() with a
            // Promise, which is always truthy (test/native-confirm.test.mjs).
            if (this.state.tilemapMode && painter?.hasUnsavedChanges() &&
                !(await confirmAsync(intl.locale.startsWith('de') ? 'Ungespeicherte Änderungen an der Kachelkarte verwerfen?' :
                    'Discard unsaved tile map changes?'))) return;
            if (!this.state.tilemapMode && !this.savePixelBeforeSwitch()) return;
            this.setState(state => ({tilemapMode: !state.tilemapMode}));
        };
        const editorTools = (pixel, mode = pixel ? 'pixel' : 'paint') => {
            // Each editor's tool row has its own ids (all rows stay mounted).
            const testId = base => (mode === 'paint' ? base : `${base}-${mode}`);
            return (
            <div className={styles.editorTools}>
                <button type="button" data-testid={testId('bw-costume-new')} onClick={this.handleNewBlankCostume}
                    className={styles.editorToolButton} aria-label={newLabel} title={newLabel}>
                    {toolIcon('new')}<span className={styles.editorToolLabel}>{newLabel}</span>
                </button>
                {process.env.BW_ENABLE_CAD && mode === 'paint' ? <CostumePrecision
                    getCostume={() => vm.editingTarget?.sprite?.costumes?.[this.state.selectedCostumeIndex]}
                    locale={intl.locale}
                    buttonClass={styles.editorToolButton}
                    labelClass={styles.editorToolLabel}
                    icon={toolIcon('cad')}
                /> : null}
                <select
                    data-testid={testId('bw-image-target')}
                    aria-label={intl.locale.startsWith('de') ? 'Bildziel wählen' : 'Choose image target'}
                    value={vm.editingTarget.id}
                    onChange={event => {
                        if (pixel && !this.savePixelBeforeSwitch()) return;
                        vm.setEditingTarget(event.target.value);
                    }}
                    className={styles.targetSelect}
                >
                    <optgroup label={intl.locale.startsWith('de') ? 'Kostüme' : 'Costumes'}>
                        {Object.values(this.props.sprites).filter(sprite => !vm.runtime.getTargetById(sprite.id)?.bwAssetLibrary).map(sprite => (
                            <option key={sprite.id} value={sprite.id}>{sprite.name}</option>
                        ))}
                    </optgroup>
                    <optgroup label={intl.locale.startsWith('de') ? 'Bildbibliotheken' : 'Artwork libraries'}>
                        {Object.values(this.props.sprites).filter(sprite => vm.runtime.getTargetById(sprite.id)?.bwAssetLibrary).map(sprite => (
                            <option key={sprite.id} value={sprite.id}>{sprite.name}</option>
                        ))}
                    </optgroup>
                    {this.props.stage ? (
                        <option value={this.props.stage.id}>
                            {intl.locale.startsWith('de') ? 'Hintergründe' : 'Backdrops'}
                        </option>
                    ) : null}
                </select>
                <button
                    type="button"
                    data-testid={testId('bw-costume-import')}
                    onClick={this.handleFileUploadClick}
                    className={styles.editorToolButton}
                    aria-label={openFileLabel}
                    title={openFileLabel}
                >
                    {toolIcon('open')}<span className={styles.editorToolLabel}>
                        {openFileLabel}</span></button>
                <button
                    type="button"
                    data-testid={testId('bw-costume-export')}
                    onClick={() => this.handleExportCostume(this.state.selectedCostumeIndex)}
                    className={styles.editorToolButton}
                    aria-label={saveFileLabel}
                    title={saveFileLabel}
                >
                    {toolIcon('save')}<span className={styles.editorToolLabel}>
                        {saveFileLabel}</span></button>
                <button
                    type="button"
                    data-testid={testId('bw-pixel-toggle')}
                    onClick={() => this.setState(state => (state.tilemapMode ? {pixelMode: true, tilemapMode: false} : {pixelMode: !state.pixelMode}))}
                    className={styles.editorToolButton}
                    aria-label={editorLabel}
                    title={editorLabel}
                >
                    {toolIcon(this.state.pixelMode ? 'paint' : 'pixel')}
                    <span className={styles.editorToolLabel}>{editorLabel}</span>
                </button>
                {hasTilemaps ? (
                    <button
                        type="button"
                        data-testid={testId('bw-tilemap-toggle')}
                        aria-pressed={this.state.tilemapMode}
                        onClick={toggleTilemap}
                        className={styles.editorToolButton}
                        aria-label={tilemapLabel}
                        title={tilemapLabel}
                    >
                        {toolIcon('tilemap')}
                        <span className={styles.editorToolLabel}>{tilemapLabel}</span>
                    </button>
                ) : null}
            </div>
            );
        };
        return (
            <AssetPanel
                buttons={[
                    {
                        title: intl.formatMessage(addLibraryMessage),
                        img: addLibraryIcon,
                        onClick: addLibraryFunc
                    },
                    {
                        title: intl.formatMessage(addFileMessage),
                        img: fileUploadIcon,
                        onClick: this.handleFileUploadClick,
                        fileAccept: '.svg, .png, .bmp, .jpg, .jpeg, .gif',
                        fileChange: this.handleCostumeUpload,
                        fileInput: this.setFileInput,
                        fileMultiple: true
                    },
                    {
                        title: intl.formatMessage(messages.addSurpriseCostumeMsg),
                        img: surpriseIcon,
                        onClick: addSurpriseFunc
                    },
                    {
                        title: intl.formatMessage(messages.addBlankCostumeMsg),
                        img: paintIcon,
                        onClick: this.handleNewBlankCostume
                    },
                    {
                        title: intl.formatMessage(addLibraryMessage),
                        img: searchIcon,
                        onClick: addLibraryFunc
                    }
                ]}
                dragType={DragConstants.COSTUME}
                isRtl={isRtl}
                items={costumeData}
                selectedItemIndex={this.state.selectedCostumeIndex}
                onDeleteClick={target && target.costumes && target.costumes.length > 1 ?
                    this.handleDeleteCostume : null}
                onDrop={this.handleDrop}
                onDuplicateClick={this.handleDuplicateCostume}
                onExportClick={this.handleExportCostume}
                onItemClick={this.handleSelectCostume}
            >
                {target.costumes ? (
                    <div
                        style={{display: 'flex',
                            flexDirection: 'column',
                            flex: '1 1 0',
                            width: '100%',
                            minWidth: 0,
                            height: '100%',
                            minHeight: 0}}
                    >
                        {/* scratch-paint has no grid and no palette lock; Arcade
                            art is edited AS pixels in the palette editor. */}
                        <div style={{flex: '1 1 0', minWidth: 0, minHeight: 0}}>
                            {/* The paint editor stays MOUNTED and is only hidden: unmounting
                                it while scratch-paint is still importing a costume leaves a
                                pending paper.js callback reading a destroyed project
                                ("reading 'layers'"), which crashes the whole tab. */}
                            <div style={{display: this.state.pixelMode || this.state.tilemapMode ? 'none' : 'contents'}}>
                                <EditorErrorBoundary name="Paint editor"><PaintEditorWrapper
                                    selectedCostumeIndex={this.state.selectedCostumeIndex}
                                    isSelectedEditor={!this.state.pixelMode && !this.state.tilemapMode}
                                    getFileMenuActions={this.costumeMenuActions}
                                    editorTools={editorTools(false)}
                                /></EditorErrorBoundary>
                            </div>
                            {this.state.tilemapMode ? (
                                <EditorErrorBoundary name="Tilemap editor"><React.Suspense fallback={null}>
                                    <TilemapEditor
                                        ref={this.tilemapEditor}
                                        vm={vm}
                                        locale={intl.locale}
                                        editorTools={editorTools(false, 'tilemap')}
                                    />
                                </React.Suspense></EditorErrorBoundary>
                            ) : this.state.pixelMode ? (
                                <EditorErrorBoundary name="Pixel editor"><React.Suspense fallback={null}>
                                    <PixelArtEditor
                                        ref={this.pixelEditor}
                                        costumeIndex={this.state.selectedCostumeIndex}
                                        vm={vm}
                                        editorTools={editorTools(true)}
                                    />
                                </React.Suspense></EditorErrorBoundary>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </AssetPanel>
        );
    }
}

CostumeTab.propTypes = {
    dispatchUpdateRestore: PropTypes.func,
    editingTarget: PropTypes.string,
    intl: intlShape,
    isRtl: PropTypes.bool,
    onActivateSoundsTab: PropTypes.func.isRequired,
    onCloseImporting: PropTypes.func.isRequired,
    onNewLibraryBackdropClick: PropTypes.func.isRequired,
    onNewLibraryCostumeClick: PropTypes.func.isRequired,
    onShowImporting: PropTypes.func.isRequired,
    sprites: PropTypes.shape({
        id: PropTypes.shape({
            costumes: PropTypes.arrayOf(PropTypes.shape({
                url: PropTypes.string,
                name: PropTypes.string.isRequired,
                skinId: PropTypes.number
            }))
        })
    }),
    stage: PropTypes.shape({
        sounds: PropTypes.arrayOf(PropTypes.shape({
            name: PropTypes.string.isRequired
        }))
    }),
    vm: PropTypes.instanceOf(VM)
};

const mapStateToProps = state => ({
    editingTarget: state.scratchGui.targets.editingTarget,
    isRtl: state.locales.isRtl,
    sprites: state.scratchGui.targets.sprites,
    stage: state.scratchGui.targets.stage,
    dragging: state.scratchGui.assetDrag.dragging
});

const mapDispatchToProps = dispatch => ({
    onActivateSoundsTab: () => dispatch(activateTab(SOUNDS_TAB_INDEX)),
    onNewLibraryBackdropClick: e => {
        e.preventDefault();
        dispatch(openBackdropLibrary());
    },
    onNewLibraryCostumeClick: e => {
        e.preventDefault();
        dispatch(openCostumeLibrary());
    },
    dispatchUpdateRestore: restoreState => {
        dispatch(setRestore(restoreState));
    },
    onCloseImporting: () => dispatch(closeAlertWithId('importingAsset')),
    onShowImporting: () => dispatch(showStandardAlert('importingAsset'))
});

export default errorBoundaryHOC('Costume Tab')(
    injectIntl(connect(
        mapStateToProps,
        mapDispatchToProps
    )(CostumeTab))
);
