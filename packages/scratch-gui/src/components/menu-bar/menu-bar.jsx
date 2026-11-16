import classNames from 'classnames';
import {connect} from 'react-redux';
import {compose} from 'redux';
import {defineMessages, FormattedMessage, injectIntl, intlShape} from 'react-intl';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import bowser from 'bowser';
import React from 'react';

import VM from 'scratch-vm';

import Box from '../box/box.jsx';
import Button from '../button/button.jsx';
import CommunityButton from './community-button.jsx';
import ShareButton from './share-button.jsx';
import {ComingSoonTooltip} from '../coming-soon/coming-soon.jsx';
import Divider from '../divider/divider.jsx';
import SaveStatus from './save-status.jsx';
import ProjectWatcher from '../../containers/project-watcher.jsx';
import MenuBarMenu from './menu-bar-menu.jsx';
import {MenuItem, MenuSection, Submenu} from '../menu/menu.jsx';
import OfflineLibraryModal from '../offline-library/offline-library-modal.jsx';
import {isNativeApp} from '../../lib/offline-assets.js';
import {
    nativeDocumentsAvailable,
    nativeMessage,
    openNativeProject,
    recentNativeProjects
} from '../../lib/tauri-bridge.js';
import ProjectTitleInput from './project-title-input.jsx';
import ExampleIntroButton from './example-intro-button.jsx';
import AuthorInfo from './author-info.jsx';
import AccountNav from '../../containers/account-nav.jsx';
import LoginDropdown from './login-dropdown.jsx';
import SB3Downloader from '../../containers/sb3-downloader.jsx';
import {clearActiveLms, hasActiveLms} from '../../lib/mindstorms-lms';
import DeletionRestorer from '../../containers/deletion-restorer.jsx';
import TurboMode from '../../containers/turbo-mode.jsx';
import MenuBarHOC from '../../containers/menu-bar-hoc.jsx';
import SettingsMenu from './settings-menu.jsx';

import {openTipsLibrary} from '../../reducers/modals';
import {setPlayer} from '../../reducers/mode';
import {
    isTimeTravel220022BC,
    isTimeTravel1920,
    isTimeTravel1990,
    isTimeTravel2020,
    isTimeTravelNow,
    setTimeTravel
} from '../../reducers/time-travel';
import {
    autoUpdateProject,
    getIsUpdating,
    getIsShowingProject,
    manualUpdateProject,
    requestNewProject,
    remixProject,
    saveProjectAsCopy
} from '../../reducers/project-state';
import {
    openAboutMenu,
    closeAboutMenu,
    aboutMenuOpen,
    openAccountMenu,
    closeAccountMenu,
    accountMenuOpen,
    openFileMenu,
    closeFileMenu,
    fileMenuOpen,
    openEditMenu,
    closeEditMenu,
    editMenuOpen,
    openLoginMenu,
    closeLoginMenu,
    loginMenuOpen,
    openModeMenu,
    closeModeMenu,
    modeMenuOpen,
    settingsMenuOpen,
    openSettingsMenu,
    closeSettingsMenu
} from '../../reducers/menus';

import collectMetadata from '../../lib/collect-metadata';

import styles from './menu-bar.css';
import {activateUndoSurface, redoActiveSurface, subscribeUndoState, undoActiveSurface} from '../../lib/global-undo.js';
import {editorMenuActionEnabled, getEditorMenuItems, runEditorMenuAction, subscribeEditorMenuActions} from '../../lib/editor-menu-actions.js';

import mystuffIcon from './icon--mystuff.png';
import profileIcon from './icon--profile.png';
import remixIcon from './icon--remix.svg';
import dropdownCaret from './dropdown-caret.svg';
import aboutIcon from './icon--about.svg';
import fileIcon from './icon--file.svg';
import editIcon from './icon--edit.svg';

import scratchLogo from './brick-robot.svg'; // Brickwright: robot mascot in place of the Scratch logo
import ninetiesLogo from './nineties_logo.svg';
import catLogo from './cat_logo.svg';
import prehistoricLogo from './prehistoric-logo.svg';
import oldtimeyLogo from './oldtimey-logo.svg';

import sharedMessages from '../../lib/shared-messages';
import {menuTriggerStyle, openMenuFromKeyboard} from '../../lib/menu-keyboard.js';

const ariaMessages = defineMessages({
    tutorials: {
        id: 'gui.menuBar.tutorialsLibrary',
        defaultMessage: 'Tutorials',
        description: 'accessibility text for the tutorials button'
    }
});

const MenuBarItemTooltip = ({
    children,
    className,
    enable,
    id,
    place = 'bottom'
}) => {
    if (enable) {
        return (
            <React.Fragment>
                {children}
            </React.Fragment>
        );
    }
    return (
        <ComingSoonTooltip
            className={classNames(styles.comingSoon, className)}
            place={place}
            tooltipClassName={styles.comingSoonTooltip}
            tooltipId={id}
        >
            {children}
        </ComingSoonTooltip>
    );
};


MenuBarItemTooltip.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    enable: PropTypes.bool,
    id: PropTypes.string,
    place: PropTypes.oneOf(['top', 'bottom', 'left', 'right'])
};

const MenuItemTooltip = ({id, isRtl, children, className}) => (
    <ComingSoonTooltip
        className={classNames(styles.comingSoon, className)}
        isRtl={isRtl}
        place={isRtl ? 'left' : 'right'}
        tooltipClassName={styles.comingSoonTooltip}
        tooltipId={id}
    >
        {children}
    </ComingSoonTooltip>
);

MenuItemTooltip.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    id: PropTypes.string,
    isRtl: PropTypes.bool
};

const AboutButton = props => (
    <Button
        className={classNames(styles.menuBarItem, styles.hoverable)}
        iconClassName={styles.aboutIcon}
        iconSrc={aboutIcon}
        onClick={props.onClick}
    />
);

AboutButton.propTypes = {
    onClick: PropTypes.func.isRequired
};

const openHistoryPanel = () => window.dispatchEvent(new CustomEvent('bw-open-history-panel'));

class MenuBar extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleClickNew',
            'handleClickRemix',
            'handleClickSave',
            'handleClickSaveAsCopy',
            'handleClickSeeCommunity',
            'handleClickShare',
            'handleSetMode',
            'handleKeyPress',
            'handleRestoreOption',
            'getSaveToComputerHandler',
            'restoreOptionMessage',
            'handleOpenOfflineLibrary',
            'handleOpenFileMenu',
            'handleNativeOpen',
            'rememberDocumentSaver',
            'handleCloseOfflineLibrary',
            'handleGlobalUndo',
            'handleGlobalRedo'
        ]);
        // Local UI state for the Brickwright offline-library dialog (native app
        // only). Kept out of Redux — it's app-specific and self-contained.
        this.state = {
            offlineLibraryOpen: false,
            globalCanUndo: false,
            globalCanRedo: false,
            undoSurface: 'blocks',
            assetFileItems: [],
            assetEditItems: [],
            codeOpenAvailable: false,
            codeSaveAvailable: false,
            codeToBlocksAvailable: false,
            codeFromBlocksAvailable: false,
            // Desktop app: File > Load/Save use native project documents (lib/tauri-bridge.js).
            nativeDocuments: false,
            recentProjects: []
        };
    }
    componentDidMount () {
        this._mounted = true;
        document.addEventListener('keydown', this.handleKeyPress);
        nativeDocumentsAvailable().then(nativeDocuments => {
            if (this._mounted && nativeDocuments) this.setState({nativeDocuments});
        });
        // Remember which editor each tab last used (a tab can hold several:
        // Costumes has paint, pixel and tilemap), so returning to it restores it.
        this._tabSurfaces = {};
        this._unsubscribeUndo = subscribeUndoState(({canUndo, canRedo, label, surface}) => {
            if (surface !== this._lastSurface) this._tabSurfaces[this.props.activeTabIndex] = surface;
            this._lastSurface = surface;
            this._activeEditorSurface = surface;
            this.refreshAssetMenuItems();
            this.setState({globalCanUndo: canUndo, globalCanRedo: canRedo, undoSurface: label});
        });
        this.activateTabUndoSurface();
        this._unsubscribeCodeActions = subscribeEditorMenuActions(() => {
            this.refreshAssetMenuItems();
            const codeOpenAvailable = editorMenuActionEnabled('code', 'open');
            const codeSaveAvailable = editorMenuActionEnabled('code', 'save');
            const codeToBlocksAvailable = editorMenuActionEnabled('code', 'to-blocks');
            const codeFromBlocksAvailable = editorMenuActionEnabled('code', 'from-blocks');
            if (codeOpenAvailable !== this.state.codeOpenAvailable || codeSaveAvailable !== this.state.codeSaveAvailable ||
                codeToBlocksAvailable !== this.state.codeToBlocksAvailable ||
                codeFromBlocksAvailable !== this.state.codeFromBlocksAvailable) {
                this.setState({codeOpenAvailable, codeSaveAvailable, codeToBlocksAvailable, codeFromBlocksAvailable});
            }
        });
    }
    componentWillUnmount () {
        this._mounted = false;
        document.removeEventListener('keydown', this.handleKeyPress);
        if (this._unsubscribeUndo) this._unsubscribeUndo();
        if (this._unsubscribeCodeActions) this._unsubscribeCodeActions();
    }
    componentDidUpdate (prevProps) {
        if (prevProps.activeTabIndex !== this.props.activeTabIndex) this.activateTabUndoSurface();
    }
    activateTabUndoSurface () {
        // Tabs without a fixed editor here (FPGA, Robots) activate their own
        // surface when shown; until then nothing else's history is touched.
        this._lastSurface = null;
        const index = this.props.activeTabIndex;
        activateUndoSurface(this._tabSurfaces[index] ||
            ['blocks', 'costumes', 'sounds', 'code', 'circuit'][index] || `tab-${index}`);
    }
    handleGlobalUndo () {
        undoActiveSurface();
    }
    handleGlobalRedo () {
        redoActiveSurface();
    }
    resolveAssetMenuSurface () {
        const surface = this._activeEditorSurface;
        const tab = this.props.activeTabIndex;
        if (['pixel', 'tilemap', 'costumes'].includes(surface) && tab === 1) return surface;
        if (surface === 'sounds' && tab === 2) return surface;
        if (surface === 'circuit' && tab === 4) return surface;
        // The Robot provider additionally requires the full tab's explicit
        // visibility, so an unshown arena dock cannot supply commands here.
        if (surface === 'robots') return surface;
        if (surface === 'cad') return surface;
        return null;
    }
    refreshAssetMenuItems () {
        const surface = this.resolveAssetMenuSurface();
        const assetFileItems = getEditorMenuItems(surface, 'file');
        const assetEditItems = getEditorMenuItems(surface, 'edit');
        if (JSON.stringify(assetFileItems) !== JSON.stringify(this.state.assetFileItems) ||
            JSON.stringify(assetEditItems) !== JSON.stringify(this.state.assetEditItems)) {
            this.setState({assetFileItems, assetEditItems});
        }
    }
    handleAssetMenuAction (name, location) {
        if (location === 'file') this.props.onRequestCloseFile();
        else this.props.onRequestCloseEdit();
        const surface = this.resolveAssetMenuSurface();
        if (!surface) return false;
        if (!getEditorMenuItems(surface, location).some(item => item.name === name && item.enabled)) return false;
        return runEditorMenuAction(surface, name);
    }
    renderAssetMenuItems (location) {
        const items = location === 'file' ? this.state.assetFileItems : this.state.assetEditItems;
        if (!items.length) return null;
        const groups = new Map();
        for (const item of items) {
            if (!groups.has(item.submenu)) groups.set(item.submenu, []);
            groups.get(item.submenu).push(item);
        }
        const renderItems = entries => entries.map(item => (
            <MenuItem key={item.name} disabled={!item.enabled} checked={item.checked} radio={item.radio}
                onClick={() => this.handleAssetMenuAction(item.name, location)}>{item.label}</MenuItem>
        ));
        return <MenuSection>{Array.from(groups, ([label, entries]) => label ? (
            <MenuItem key={label} ariaLabel={label}>
                {label}<span aria-hidden="true" style={{float: this.props.isRtl ? 'left' : 'right'}}>›</span>
                <Submenu place={this.props.isRtl ? 'left' : 'right'}>{renderItems(entries)}</Submenu>
            </MenuItem>
        ) : renderItems(entries))}</MenuSection>;
    }
    handleCodeFileAction (action) {
        this.props.onRequestCloseFile();
        if (this.props.activeTabIndex !== 3) return false;
        return runEditorMenuAction('code', action);
    }
    handleCodeConversionAction (action) {
        this.props.onRequestCloseEdit();
        if (this.props.activeTabIndex !== 3) return false;
        return runEditorMenuAction('code', action);
    }
    handleCodeEditorCommand (command) {
        this.props.onRequestCloseEdit();
        if (this.props.activeTabIndex !== 3 || typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent('bw-code-editor-command', {detail: {command}}));
    }
    async handleClickNew () {
        // if the project is dirty, and user owns the project, we will autosave.
        // but if they are not logged in and can't save, user should consider
        // downloading or logging in first.
        // Note that if user is logged in and editing someone else's project,
        // they'll lose their work.
        // The answer is awaited: in the desktop/iOS app the question is a native dialog that
        // cannot block, and nothing may be replaced before the user has said yes.
        this.props.onRequestCloseFile();
        const readyToReplaceProject = await this.props.confirmReadyToReplaceProject(
            this.props.intl.formatMessage(sharedMessages.replaceProjectWarning)
        );
        if (readyToReplaceProject === true) {
            clearActiveLms();
            this.props.onClickNew(this.props.canSave && this.props.canCreateNew);
        }
        this.props.onRequestCloseFile();
    }
    handleOpenFileMenu () {
        this.props.onClickFile();
        if (!this.state.nativeDocuments) return;
        recentNativeProjects()
            .then(recentProjects => this._mounted && this.setState({recentProjects}))
            .catch(() => this._mounted && this.setState({recentProjects: []}));
    }
    handleNativeOpen (path) {
        this.props.onRequestCloseFile();
        openNativeProject(path).catch(error => {
            // eslint-disable-next-line no-console
            console.error('[brickwright] open project failed', error);
            nativeMessage(this.props.intl.formatMessage({id: 'gui.menuBar.openProjectError', defaultMessage: 'Could not open the project: {error}'}, {error: error.message || String(error)}));
        });
    }
    // The File menu's own SB3Downloader exists only while the menu is open, so the save
    // shortcut uses a second, always-mounted one (rendered with no output below).
    rememberDocumentSaver (className, downloadProjectCallback) {
        this.saveDocument = downloadProjectCallback;
        return null;
    }
    handleOpenOfflineLibrary () {
        this.props.onRequestCloseFile();
        this.setState({offlineLibraryOpen: true});
    }
    handleCloseOfflineLibrary () {
        this.setState({offlineLibraryOpen: false});
    }
    handleClickRemix () {
        this.props.onClickRemix();
        this.props.onRequestCloseFile();
    }
    handleClickSave () {
        this.props.onClickSave();
        this.props.onRequestCloseFile();
    }
    handleClickSaveAsCopy () {
        this.props.onClickSaveAsCopy();
        this.props.onRequestCloseFile();
    }
    handleClickSeeCommunity (waitForUpdate) {
        if (this.props.shouldSaveBeforeTransition()) {
            this.props.autoUpdateProject(); // save before transitioning to project page
            waitForUpdate(true); // queue the transition to project page
        } else {
            waitForUpdate(false); // immediately transition to project page
        }
    }
    handleClickShare (waitForUpdate) {
        if (!this.props.isShared) {
            if (this.props.canShare) { // save before transitioning to project page
                this.props.onShare();
            }
            if (this.props.canSave) { // save before transitioning to project page
                this.props.autoUpdateProject();
                waitForUpdate(true); // queue the transition to project page
            } else {
                waitForUpdate(false); // immediately transition to project page
            }
        }
    }
    handleSetMode (mode) {
        return () => {
            // Turn on/off filters for modes.
            if (mode === '1920') {
                document.documentElement.style.filter = 'brightness(.9)contrast(.8)sepia(1.0)';
                document.documentElement.style.height = '100%';
            } else if (mode === '1990') {
                document.documentElement.style.filter = 'hue-rotate(40deg)';
                document.documentElement.style.height = '100%';
            } else {
                document.documentElement.style.filter = '';
                document.documentElement.style.height = '';
            }

            // Change logo for modes
            if (mode === '1990') {
                document.getElementById('logo_img').src = ninetiesLogo;
            } else if (mode === '2020') {
                document.getElementById('logo_img').src = catLogo;
            } else if (mode === '1920') {
                document.getElementById('logo_img').src = oldtimeyLogo;
            } else if (mode === '220022BC') {
                document.getElementById('logo_img').src = prehistoricLogo;
            } else {
                document.getElementById('logo_img').src = this.props.logo;
            }

            this.props.onSetTimeTravelMode(mode);
        };
    }
    handleRestoreOption (restoreFun) {
        return () => {
            restoreFun();
            this.props.onRequestCloseEdit();
        };
    }
    handleKeyPress (event) {
        const modifier = bowser.mac ? event.metaKey : event.ctrlKey;
        if (modifier && event.key === 's') {
            if (this.state.nativeDocuments && this.saveDocument) {
                this.saveDocument('save');
            } else {
                this.props.onClickSave();
            }
            event.preventDefault();
        }
    }
    // `mode` is SB3Downloader's: none exports, 'save' / 'saveAs' save a native document.
    getSaveToComputerHandler (downloadProjectCallback, mode) {
        return () => {
            this.props.onRequestCloseFile();
            downloadProjectCallback(mode);
            if (this.props.onProjectTelemetryEvent) {
                const metadata = collectMetadata(this.props.vm, this.props.projectTitle, this.props.locale);
                this.props.onProjectTelemetryEvent('projectDidSave', metadata);
            }
        };
    }
    restoreOptionMessage (deletedItem) {
        switch (deletedItem) {
        case 'Sprite':
            return (<FormattedMessage
                defaultMessage="Restore Sprite"
                description="Menu bar item for restoring the last deleted sprite."
                id="gui.menuBar.restoreSprite"
            />);
        case 'Sound':
            return (<FormattedMessage
                defaultMessage="Restore Sound"
                description="Menu bar item for restoring the last deleted sound."
                id="gui.menuBar.restoreSound"
            />);
        case 'Costume':
            return (<FormattedMessage
                defaultMessage="Restore Costume"
                description="Menu bar item for restoring the last deleted costume."
                id="gui.menuBar.restoreCostume"
            />);
        default: {
            return (<FormattedMessage
                defaultMessage="Restore"
                description="Menu bar item for restoring the last deleted item in its disabled state." /* eslint-disable-line max-len */
                id="gui.menuBar.restore"
            />);
        }
        }
    }
    buildAboutMenu (onClickAbout) {
        if (!onClickAbout) {
            // hide the button
            return null;
        }
        if (typeof onClickAbout === 'function') {
            // make a button which calls a function
            return <AboutButton onClick={onClickAbout} />;
        }
        // assume it's an array of objects
        // each item must have a 'title' FormattedMessage and a 'handleClick' function
        // generate a menu with items for each object in the array
        return (
            <div
                className={classNames(styles.menuBarItem, styles.hoverable, {
                    [styles.active]: this.props.aboutMenuOpen
                })}
                onMouseUp={this.props.onRequestOpenAbout}
            >
                <img
                    className={styles.aboutIcon}
                    src={aboutIcon}
                />
                <MenuBarMenu
                    className={classNames(styles.menuBarMenu)}
                    open={this.props.aboutMenuOpen}
                    place={this.props.isRtl ? 'right' : 'left'}
                    onRequestClose={this.props.onRequestCloseAbout}
                >
                    {
                        onClickAbout.map(itemProps => (
                            <MenuItem
                                key={itemProps.title}
                                isRtl={this.props.isRtl}
                                onClick={this.wrapAboutMenuCallback(itemProps.onClick)}
                            >
                                {itemProps.title}
                            </MenuItem>
                        ))
                    }
                </MenuBarMenu>
            </div>
        );
    }
    wrapAboutMenuCallback (callback) {
        return () => {
            callback();
            this.props.onRequestCloseAbout();
        };
    }
    render () {
        const saveNowMessage = (
            <FormattedMessage
                defaultMessage="Save now"
                description="Menu bar item for saving now"
                id="gui.menuBar.saveNow"
            />
        );
        const createCopyMessage = (
            <FormattedMessage
                defaultMessage="Save as a copy"
                description="Menu bar item for saving as a copy"
                id="gui.menuBar.saveAsCopy"
            />
        );
        const remixMessage = (
            <FormattedMessage
                defaultMessage="Remix"
                description="Menu bar item for remixing"
                id="gui.menuBar.remix"
            />
        );
        const newProjectMessage = (
            <FormattedMessage
                defaultMessage="New"
                description="Menu bar item for creating a new project"
                id="gui.menuBar.new"
            />
        );
        const remixButton = (
            <Button
                className={classNames(
                    styles.menuBarButton,
                    styles.remixButton
                )}
                iconClassName={styles.remixButtonIcon}
                iconSrc={remixIcon}
                onClick={this.handleClickRemix}
            >
                {remixMessage}
            </Button>
        );
        // Show the About button only if we have a handler for it (like in the desktop app)
        const aboutButton = this.buildAboutMenu(this.props.onClickAbout);
        return (
            <Box
                className={classNames(
                    this.props.className,
                    styles.menuBar
                )}
            >
                <div className={styles.mainMenu}>
                    <div className={styles.fileGroup}>
                        <div className={classNames(styles.menuBarItem)}>
                            <img
                                id="logo_img"
                                alt="Scratch"
                                className={classNames(styles.scratchLogo, {
                                    [styles.clickable]: typeof this.props.onClickLogo !== 'undefined'
                                })}
                                draggable={false}
                                src={this.props.logo}
                                onClick={this.props.onClickLogo}
                            />
                        </div>
                        {/* Brickwright: the running build's commit, and the About box behind it.
                            A page that cannot say which version it is makes every bug report
                            ambiguous — stale tab, undeployed fix and real regression all look
                            identical from the outside. */}
                        <SettingsMenu
                            canChangeLanguage={this.props.canChangeLanguage}
                            canChangeTheme={this.props.canChangeTheme}
                            isRtl={this.props.isRtl}
                            onRequestClose={this.props.onRequestCloseSettings}
                            onRequestOpen={this.props.onClickSettings}
                            settingsMenuOpen={this.props.settingsMenuOpen}
                        />
                        {(this.props.canManageFiles) && (
                            <div
                                className={classNames(styles.menuBarItem, styles.hoverable, {
                                    [styles.active]: this.props.fileMenuOpen
                                })}
                                data-bw-menu-root="" style={{padding: 0}}
                            >
                                <button type="button" data-bw-menu-trigger="" data-testid="bw-file-menu-trigger"
                                    style={menuTriggerStyle} aria-haspopup="menu" aria-expanded={this.props.fileMenuOpen}
                                    aria-label={this.props.intl.formatMessage({id: 'gui.menuBar.file', defaultMessage: 'File'})}
                                    onClick={this.handleOpenFileMenu} onKeyDown={event => openMenuFromKeyboard(event, this.handleOpenFileMenu, this.props.onRequestCloseFile)}>

                                <img src={fileIcon} />
                                <span className={styles.collapsibleLabel}>
                                    <FormattedMessage
                                        defaultMessage="File"
                                        description="Text for file dropdown menu"
                                        id="gui.menuBar.file"
                                    />
                                </span>
                                <img src={dropdownCaret} />
                                </button>
                                <MenuBarMenu
                                    className={classNames(styles.menuBarMenu)}
                                    open={this.props.fileMenuOpen}
                                    place={this.props.isRtl ? 'left' : 'right'}
                                    onRequestClose={this.props.onRequestCloseFile}
                                >
                                    <MenuSection>
                                        <MenuItem onClick={() => {
                                            window.dispatchEvent(new CustomEvent('bw-open-lessons'));
                                            this.props.onRequestCloseFile();
                                        }}>
                                            <FormattedMessage
                                                defaultMessage="Brickwright lessons…"
                                                description="Open the interactive Brickwright lessons library"
                                                id="gui.menuBar.brickwrightLessons"
                                            />
                                        </MenuItem>
                                        <MenuItem onClick={() => {
                                            this.props.onOpenTipLibrary();
                                            this.props.onRequestCloseFile();
                                        }}>
                                            <FormattedMessage defaultMessage="Scratch tutorials" id="gui.menuBar.tutorialsFile" />
                                        </MenuItem>
                                    </MenuSection>
                                    <MenuSection>
                                        <MenuItem
                                            isRtl={this.props.isRtl}
                                            onClick={this.handleClickNew}
                                        >
                                            {newProjectMessage}
                                        </MenuItem>
                                    </MenuSection>
                                    {(this.props.canSave || this.props.canCreateCopy || this.props.canRemix) && (
                                        <MenuSection>
                                            {this.props.canSave && (
                                                <MenuItem onClick={this.handleClickSave}>
                                                    {saveNowMessage}
                                                </MenuItem>
                                            )}
                                            {this.props.canCreateCopy && (
                                                <MenuItem onClick={this.handleClickSaveAsCopy}>
                                                    {createCopyMessage}
                                                </MenuItem>
                                            )}
                                            {this.props.canRemix && (
                                                <MenuItem onClick={this.handleClickRemix}>
                                                    {remixMessage}
                                                </MenuItem>
                                            )}
                                        </MenuSection>
                                    )}
                                    <MenuSection>
                                        <MenuItem
                                            onClick={this.state.nativeDocuments ?
                                                () => this.handleNativeOpen() :
                                                this.props.onStartSelectingFileUpload}
                                        >
                                            {this.props.intl.formatMessage(sharedMessages.loadFromComputerTitle)}
                                        </MenuItem>
                                        {this.state.nativeDocuments && this.state.recentProjects.map(recent => (
                                            <MenuItem
                                                key={recent.path}
                                                onClick={() => this.handleNativeOpen(recent.path)}
                                            >
                                                {this.props.intl.formatMessage({id: 'gui.menuBar.openRecent', defaultMessage: 'Open recent: {name}'}, {name: recent.name})}
                                            </MenuItem>
                                        ))}
                                        <SB3Downloader>{(className, downloadProjectCallback) => (
                                            <React.Fragment>
                                                {this.state.nativeDocuments && (
                                                    <MenuItem
                                                        className={className}
                                                        onClick={this.getSaveToComputerHandler(downloadProjectCallback, 'save')}
                                                    >
                                                        <FormattedMessage id="gui.menuBar.saveProject" defaultMessage="Save project" />
                                                    </MenuItem>
                                                )}
                                                {this.state.nativeDocuments && (
                                                    <MenuItem
                                                        className={className}
                                                        onClick={this.getSaveToComputerHandler(downloadProjectCallback, 'saveAs')}
                                                    >
                                                        <FormattedMessage id="gui.menuBar.saveProjectAs" defaultMessage="Save project as…" />
                                                    </MenuItem>
                                                )}
                                                <MenuItem
                                                    className={className}
                                                    onClick={this.getSaveToComputerHandler(downloadProjectCallback)}
                                                >
                                                    <FormattedMessage
                                                        defaultMessage="Save to your computer"
                                                        description="Menu bar item for downloading a project to your computer" // eslint-disable-line max-len
                                                        id="gui.menuBar.downloadToComputer"
                                                    />
                                                </MenuItem>
                                            </React.Fragment>
                                        )}</SB3Downloader>
                                        {hasActiveLms() && (
                                            <SB3Downloader format="lms">{(className, downloadProjectCallback) => (
                                                <MenuItem className={className}
                                                    onClick={this.getSaveToComputerHandler(downloadProjectCallback)}>
                                                    <FormattedMessage
                                                        defaultMessage="Save as LEGO MINDSTORMS (.lms)"
                                                        id="gui.menuBar.downloadMindstormsLms"
                                                    />
                                                </MenuItem>
                                            )}</SB3Downloader>
                                        )}
                                        {isNativeApp() && (
                                            <MenuItem onClick={this.handleOpenOfflineLibrary}>
                                                <FormattedMessage
                                                    defaultMessage="Offline library…"
                                                    description="Menu item to download the asset library for offline use" // eslint-disable-line max-len
                                                    id="gui.menuBar.offlineLibrary"
                                                />
                                            </MenuItem>
                                        )}
                                    </MenuSection>
                                    {/* Editor files belong to their editor; project files stay global. */}
                                    {this.renderAssetMenuItems('file')}
                                    {this.props.activeTabIndex === 3 && (
                                        <MenuSection>
                                            <MenuItem
                                                disabled={!this.state.codeOpenAvailable}
                                                onClick={() => this.handleCodeFileAction('open')}
                                            >
                                                <FormattedMessage id="gui.menuBar.openCodeFile" defaultMessage="Open code file…" />
                                            </MenuItem>
                                            <MenuItem
                                                disabled={!this.state.codeSaveAvailable}
                                                onClick={() => this.handleCodeFileAction('save')}
                                            >
                                                <FormattedMessage id="gui.menuBar.saveCodeFile" defaultMessage="Save code as…" />
                                            </MenuItem>
                                        </MenuSection>
                                    )}
                                    {this.props.activeTabIndex === 4 && !this.state.assetFileItems.length && (
                                        <MenuSection>
                                            <MenuItem onClick={() => {
                                                if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-circuit-file', {detail: {action: 'load'}}));
                                                this.props.onRequestCloseFile();
                                            }}>
                                                <FormattedMessage id="gui.menuBar.openCircuit" defaultMessage="Open circuit…" />
                                            </MenuItem>
                                            <MenuItem onClick={() => {
                                                if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-circuit-file', {detail: {action: 'save'}}));
                                                this.props.onRequestCloseFile();
                                            }}>
                                                <FormattedMessage id="gui.menuBar.saveCircuit" defaultMessage="Save circuit" />
                                            </MenuItem>
                                            <MenuItem onClick={() => {
                                                if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-circuit-file', {detail: {action: 'import'}}));
                                                this.props.onRequestCloseFile();
                                            }}>
                                                <FormattedMessage id="gui.menuBar.importCircuit" defaultMessage="Import circuit…" />
                                            </MenuItem>
                                            <MenuItem onClick={() => {
                                                if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bw-circuit-file', {detail: {action: 'export'}}));
                                                this.props.onRequestCloseFile();
                                            }}>
                                                <FormattedMessage id="gui.menuBar.exportCircuit" defaultMessage="Export circuit…" />
                                            </MenuItem>
                                        </MenuSection>
                                    )}
                                </MenuBarMenu>
                            </div>
                        )}
                        <div
                            className={classNames(styles.menuBarItem, styles.hoverable, {
                                [styles.active]: this.props.editMenuOpen
                            })}
                            data-bw-menu-root="" style={{padding: 0}}
                        >
                                <button type="button" data-bw-menu-trigger="" data-testid="bw-edit-menu-trigger"
                                    style={menuTriggerStyle} aria-haspopup="menu" aria-expanded={this.props.editMenuOpen}
                                    aria-label={this.props.intl.formatMessage({id: 'gui.menuBar.edit', defaultMessage: 'Edit'})}
                                    onClick={this.props.onClickEdit} onKeyDown={event => openMenuFromKeyboard(event, this.props.onClickEdit, this.props.onRequestCloseEdit)}>

                            <img src={editIcon} />
                            <span className={styles.collapsibleLabel}>
                                <FormattedMessage
                                    defaultMessage="Edit"
                                    description="Text for edit dropdown menu"
                                    id="gui.menuBar.edit"
                                />
                            </span>
                            <img src={dropdownCaret} />
                            </button>
                            <MenuBarMenu
                                className={classNames(styles.menuBarMenu)}
                                open={this.props.editMenuOpen}
                                place={this.props.isRtl ? 'left' : 'right'}
                                onRequestClose={this.props.onRequestCloseEdit}
                            >
                                <MenuSection>
                                    <MenuItem
                                        disabled={!this.state.globalCanUndo}
                                        onClick={() => {
                                            this.handleGlobalUndo();
                                            this.props.onRequestCloseEdit();
                                        }}
                                    >
                                        <FormattedMessage id="gui.menuBar.undo" defaultMessage="Undo" />
                                    </MenuItem>
                                    <MenuItem
                                        disabled={!this.state.globalCanRedo}
                                        onClick={() => {
                                            this.handleGlobalRedo();
                                            this.props.onRequestCloseEdit();
                                        }}
                                    >
                                        <FormattedMessage id="gui.menuBar.redo" defaultMessage="Redo" />
                                    </MenuItem>
                                </MenuSection>
                                {this.renderAssetMenuItems('edit')}
                                {this.props.activeTabIndex === 3 && (
                                    <MenuSection>
                                        <MenuItem onClick={() => this.handleCodeEditorCommand('find')}>
                                            <FormattedMessage id="gui.menuBar.findReplace" defaultMessage="Find and replace…" />
                                        </MenuItem>
                                        <MenuItem onClick={() => this.handleCodeEditorCommand('go-to-line')}>
                                            <FormattedMessage id="gui.menuBar.goToLine" defaultMessage="Go to line…" />
                                        </MenuItem>
                                        <MenuItem onClick={() => this.handleCodeEditorCommand('select-all')}>
                                            <FormattedMessage id="gui.menuBar.selectAll" defaultMessage="Select all" />
                                        </MenuItem>
                                    </MenuSection>
                                )}
                                {this.props.activeTabIndex === 3 && (
                                    <MenuSection>
                                        <MenuItem
                                            disabled={!this.state.codeToBlocksAvailable}
                                            onClick={() => this.handleCodeConversionAction('to-blocks')}
                                        >
                                            <FormattedMessage id="gui.menuBar.codeToBlocks" defaultMessage="Convert code to blocks" />
                                        </MenuItem>
                                        <MenuItem
                                            disabled={!this.state.codeFromBlocksAvailable}
                                            onClick={() => this.handleCodeConversionAction('from-blocks')}
                                        >
                                            <FormattedMessage id="gui.menuBar.codeFromBlocks" defaultMessage="Generate code from blocks" />
                                        </MenuItem>
                                    </MenuSection>
                                )}
                                <DeletionRestorer>{(handleRestore, {restorable, deletedItem}) => (
                                    <MenuItem
                                        disabled={!restorable}
                                        onClick={this.handleRestoreOption(handleRestore)}
                                    >
                                        {this.restoreOptionMessage(deletedItem)}
                                    </MenuItem>
                                )}</DeletionRestorer>
                                <MenuSection>
                                    <TurboMode>{(toggleTurboMode, {turboMode}) => (
                                        <MenuItem onClick={toggleTurboMode}>
                                            {turboMode ? (
                                                <FormattedMessage
                                                    defaultMessage="Turn off Turbo Mode"
                                                    description="Menu bar item for turning off turbo mode"
                                                    id="gui.menuBar.turboModeOff"
                                                />
                                            ) : (
                                                <FormattedMessage
                                                    defaultMessage="Turn on Turbo Mode"
                                                    description="Menu bar item for turning on turbo mode"
                                                    id="gui.menuBar.turboModeOn"
                                                />
                                            )}
                                        </MenuItem>
                                    )}</TurboMode>
                                </MenuSection>
                            </MenuBarMenu>

                        </div>
                        {this.props.isTotallyNormal && (
                            <div
                                className={classNames(styles.menuBarItem, styles.hoverable, {
                                    [styles.active]: this.props.modeMenuOpen
                                })}
                                onMouseUp={this.props.onClickMode}
                            >
                                <div className={classNames(styles.editMenu)}>
                                    <FormattedMessage
                                        defaultMessage="Mode"
                                        description="Mode menu item in the menu bar"
                                        id="gui.menuBar.modeMenu"
                                    />
                                </div>
                                <MenuBarMenu
                                    className={classNames(styles.menuBarMenu)}
                                    open={this.props.modeMenuOpen}
                                    place={this.props.isRtl ? 'left' : 'right'}
                                    onRequestClose={this.props.onRequestCloseMode}
                                >
                                    <MenuSection>
                                        <MenuItem onClick={this.handleSetMode('NOW')}>
                                            <span className={classNames({[styles.inactive]: !this.props.modeNow})}>
                                                {'✓'}
                                            </span>
                                            {' '}
                                            <FormattedMessage
                                                defaultMessage="Normal mode"
                                                description="April fools: resets editor to not have any pranks"
                                                id="gui.menuBar.normalMode"
                                            />
                                        </MenuItem>
                                        <MenuItem onClick={this.handleSetMode('2020')}>
                                            <span className={classNames({[styles.inactive]: !this.props.mode2020})}>
                                                {'✓'}
                                            </span>
                                            {' '}
                                            <FormattedMessage
                                                defaultMessage="Caturday mode"
                                                description="April fools: Cat blocks mode"
                                                id="gui.menuBar.caturdayMode"
                                            />
                                        </MenuItem>
                                    </MenuSection>
                                </MenuBarMenu>
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        className={classNames(styles.menuBarItem, styles.globalUndoButton)}
                        data-testid="bw-global-undo"
                        disabled={!this.state.globalCanUndo}
                        aria-label={this.props.intl.formatMessage({id: 'gui.menuBar.undo', defaultMessage: 'Undo'})}
                        title={this.props.intl.formatMessage({id: 'gui.menuBar.undo', defaultMessage: 'Undo'}) +
                            (this.state.undoSurface ? ` (${this.state.undoSurface})` : '')}
                        onClick={this.handleGlobalUndo}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M9 4 4 9l5 5M4 9h10a5.5 5.5 0 0 1 0 11h-3"
                                fill="none" stroke="currentColor" strokeWidth="2"
                                strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        className={classNames(styles.menuBarItem, styles.globalUndoButton)}
                        data-testid="bw-global-redo"
                        disabled={!this.state.globalCanRedo}
                        aria-label={this.props.intl.formatMessage({id: 'gui.menuBar.redo', defaultMessage: 'Redo'})}
                        title={this.props.intl.formatMessage({id: 'gui.menuBar.redo', defaultMessage: 'Redo'}) +
                            (this.state.undoSurface ? ` (${this.state.undoSurface})` : '')}
                        onClick={this.handleGlobalRedo}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="m15 4 5 5-5 5m5-5H10a5.5 5.5 0 0 0 0 11h3"
                                fill="none" stroke="currentColor" strokeWidth="2"
                                strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        className={classNames(styles.menuBarItem, styles.globalUndoButton)}
                        data-testid="bw-global-history"
                        aria-label={this.props.intl.formatMessage({id: 'gui.menuBar.history', defaultMessage: 'History'})}
                        title={this.props.intl.formatMessage({id: 'gui.menuBar.history', defaultMessage: 'History'})}
                        onClick={openHistoryPanel}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 2"
                                fill="none" stroke="currentColor" strokeWidth="2"
                                strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    {this.props.canEditTitle ? (
                        <div className={classNames(styles.menuBarItem, styles.growable)}>
                            <MenuBarItemTooltip
                                enable
                                id="title-field"
                            >
                                <ProjectTitleInput
                                    className={classNames(styles.titleFieldGrowable)}
                                />
                                {/* The name in this field is the EXAMPLE's when one is
                                    loaded; the (i) says which, and opens its intro. It
                                    renders nothing otherwise. */}
                                <ExampleIntroButton locale={this.props.locale} />
                            </MenuBarItemTooltip>
                        </div>
                    ) : ((this.props.authorUsername && this.props.authorUsername !== this.props.username) ? (
                        <AuthorInfo
                            className={styles.authorInfo}
                            imageUrl={this.props.authorThumbnailUrl}
                            projectTitle={this.props.projectTitle}
                            userId={this.props.authorId}
                            username={this.props.authorUsername}
                        />
                    ) : null)}
                    <div className={classNames(styles.menuBarItem)}>
                        {this.props.canShare ? (
                            (this.props.isShowingProject || this.props.isUpdating) && (
                                <ProjectWatcher onDoneUpdating={this.props.onSeeCommunity}>
                                    {
                                        waitForUpdate => (
                                            <ShareButton
                                                className={styles.menuBarButton}
                                                isShared={this.props.isShared}
                                                /* eslint-disable react/jsx-no-bind */
                                                onClick={() => {
                                                    this.handleClickShare(waitForUpdate);
                                                }}
                                                /* eslint-enable react/jsx-no-bind */
                                            />
                                        )
                                    }
                                </ProjectWatcher>
                            )
                        ) : (
                            this.props.showComingSoon ? (
                                <MenuBarItemTooltip id="share-button">
                                    <ShareButton className={styles.menuBarButton} />
                                </MenuBarItemTooltip>
                            ) : []
                        )}
                        {this.props.canRemix ? remixButton : []}
                    </div>
                    <div className={classNames(styles.menuBarItem, styles.communityButtonWrapper)}>
                        {this.props.enableCommunity ? (
                            (this.props.isShowingProject || this.props.isUpdating) && (
                                <ProjectWatcher onDoneUpdating={this.props.onSeeCommunity}>
                                    {
                                        waitForUpdate => (
                                            <CommunityButton
                                                className={styles.menuBarButton}
                                                /* eslint-disable react/jsx-no-bind */
                                                onClick={() => {
                                                    this.handleClickSeeCommunity(waitForUpdate);
                                                }}
                                                /* eslint-enable react/jsx-no-bind */
                                            />
                                        )
                                    }
                                </ProjectWatcher>
                            )
                        ) : (this.props.showComingSoon ? (
                            <MenuBarItemTooltip id="community-button">
                                <CommunityButton className={styles.menuBarButton} />
                            </MenuBarItemTooltip>
                        ) : [])}
                    </div>
                </div>

                {/* show the proper UI in the account menu, given whether the user is
                logged in, and whether a session is available to log in with */}
                <div className={styles.accountInfoGroup}>
                    <div className={styles.menuBarItem}>
                        {this.props.canSave && (
                            <SaveStatus />
                        )}
                    </div>
                    {this.props.sessionExists ? (
                        this.props.username ? (
                            // ************ user is logged in ************
                            <React.Fragment>
                                <a href="/mystuff/">
                                    <div
                                        className={classNames(
                                            styles.menuBarItem,
                                            styles.hoverable,
                                            styles.mystuffButton
                                        )}
                                    >
                                        <img
                                            className={styles.mystuffIcon}
                                            src={mystuffIcon}
                                        />
                                    </div>
                                </a>
                                <AccountNav
                                    className={classNames(
                                        styles.menuBarItem,
                                        styles.hoverable,
                                        {[styles.active]: this.props.accountMenuOpen}
                                    )}
                                    isOpen={this.props.accountMenuOpen}
                                    isRtl={this.props.isRtl}
                                    menuBarMenuClassName={classNames(styles.menuBarMenu)}
                                    onClick={this.props.onClickAccount}
                                    onClose={this.props.onRequestCloseAccount}
                                    onLogOut={this.props.onLogOut}
                                />
                            </React.Fragment>
                        ) : (
                            // ********* user not logged in, but a session exists
                            // ********* so they can choose to log in
                            <React.Fragment>
                                <div
                                    className={classNames(
                                        styles.menuBarItem,
                                        styles.hoverable
                                    )}
                                    key="join"
                                    onMouseUp={this.props.onOpenRegistration}
                                >
                                    <FormattedMessage
                                        defaultMessage="Join Scratch"
                                        description="Link for creating a Scratch account"
                                        id="gui.menuBar.joinScratch"
                                    />
                                </div>
                                <div
                                    className={classNames(
                                        styles.menuBarItem,
                                        styles.hoverable
                                    )}
                                    key="login"
                                    onMouseUp={this.props.onClickLogin}
                                >
                                    <FormattedMessage
                                        defaultMessage="Sign in"
                                        description="Link for signing in to your Scratch account"
                                        id="gui.menuBar.signIn"
                                    />
                                    <LoginDropdown
                                        className={classNames(styles.menuBarMenu)}
                                        isOpen={this.props.loginMenuOpen}
                                        isRtl={this.props.isRtl}
                                        renderLogin={this.props.renderLogin}
                                        onClose={this.props.onRequestCloseLogin}
                                    />
                                </div>
                            </React.Fragment>
                        )
                    ) : (
                        // ******** no login session is available, so don't show login stuff
                        <React.Fragment>
                            {this.props.showComingSoon ? (
                                <React.Fragment>
                                    <MenuBarItemTooltip id="mystuff">
                                        <div
                                            className={classNames(
                                                styles.menuBarItem,
                                                styles.hoverable,
                                                styles.mystuffButton
                                            )}
                                        >
                                            <img
                                                className={styles.mystuffIcon}
                                                src={mystuffIcon}
                                            />
                                        </div>
                                    </MenuBarItemTooltip>
                                    <MenuBarItemTooltip
                                        id="account-nav"
                                        place={this.props.isRtl ? 'right' : 'left'}
                                    >
                                        <div
                                            className={classNames(
                                                styles.menuBarItem,
                                                styles.hoverable,
                                                styles.accountNavMenu
                                            )}
                                        >
                                            <img
                                                className={styles.profileIcon}
                                                src={profileIcon}
                                            />
                                            <span>
                                                {'scratch-cat'}
                                            </span>
                                            <img
                                                className={styles.dropdownCaretIcon}
                                                src={dropdownCaret}
                                            />
                                        </div>
                                    </MenuBarItemTooltip>
                                </React.Fragment>
                            ) : []}
                        </React.Fragment>
                    )}
                </div>

                {aboutButton}
                {this.state.offlineLibraryOpen && (
                    <OfflineLibraryModal onClose={this.handleCloseOfflineLibrary} />
                )}
                {this.state.nativeDocuments && (
                    <SB3Downloader>{this.rememberDocumentSaver}</SB3Downloader>
                )}
            </Box>
        );
    }
}

MenuBar.propTypes = {
    aboutMenuOpen: PropTypes.bool,
    activeTabIndex: PropTypes.number,
    accountMenuOpen: PropTypes.bool,
    authorId: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    authorThumbnailUrl: PropTypes.string,
    authorUsername: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    autoUpdateProject: PropTypes.func,
    canChangeLanguage: PropTypes.bool,
    canChangeTheme: PropTypes.bool,
    canCreateCopy: PropTypes.bool,
    canCreateNew: PropTypes.bool,
    canEditTitle: PropTypes.bool,
    canManageFiles: PropTypes.bool,
    canRemix: PropTypes.bool,
    canSave: PropTypes.bool,
    canShare: PropTypes.bool,
    className: PropTypes.string,
    confirmReadyToReplaceProject: PropTypes.func,
    currentLocale: PropTypes.string.isRequired,
    editMenuOpen: PropTypes.bool,
    enableCommunity: PropTypes.bool,
    fileMenuOpen: PropTypes.bool,
    intl: intlShape,
    isRtl: PropTypes.bool,
    isShared: PropTypes.bool,
    isShowingProject: PropTypes.bool,
    isTotallyNormal: PropTypes.bool,
    isUpdating: PropTypes.bool,
    locale: PropTypes.string.isRequired,
    loginMenuOpen: PropTypes.bool,
    logo: PropTypes.string,
    mode1920: PropTypes.bool,
    mode1990: PropTypes.bool,
    mode2020: PropTypes.bool,
    mode220022BC: PropTypes.bool,
    modeMenuOpen: PropTypes.bool,
    modeNow: PropTypes.bool,
    onClickAbout: PropTypes.oneOfType([
        PropTypes.func, // button mode: call this callback when the About button is clicked
        PropTypes.arrayOf( // menu mode: list of items in the About menu
            PropTypes.shape({
                title: PropTypes.string, // text for the menu item
                onClick: PropTypes.func // call this callback when the menu item is clicked
            })
        )
    ]),
    onClickAccount: PropTypes.func,
    onClickEdit: PropTypes.func,
    onClickFile: PropTypes.func,
    onClickLogin: PropTypes.func,
    onClickLogo: PropTypes.func,
    onClickMode: PropTypes.func,
    onClickNew: PropTypes.func,
    onClickRemix: PropTypes.func,
    onClickSave: PropTypes.func,
    onClickSaveAsCopy: PropTypes.func,
    onClickSettings: PropTypes.func,
    onLogOut: PropTypes.func,
    onOpenRegistration: PropTypes.func,
    onOpenTipLibrary: PropTypes.func,
    onProjectTelemetryEvent: PropTypes.func,
    onRequestCloseAbout: PropTypes.func,
    onRequestCloseAccount: PropTypes.func,
    onRequestCloseEdit: PropTypes.func,
    onRequestCloseFile: PropTypes.func,
    onRequestCloseLogin: PropTypes.func,
    onRequestCloseMode: PropTypes.func,
    onRequestCloseSettings: PropTypes.func,
    onRequestOpenAbout: PropTypes.func,
    onSeeCommunity: PropTypes.func,
    onSetTimeTravelMode: PropTypes.func,
    onShare: PropTypes.func,
    onStartSelectingFileUpload: PropTypes.func,
    onToggleLoginOpen: PropTypes.func,
    projectTitle: PropTypes.string,
    renderLogin: PropTypes.func,
    sessionExists: PropTypes.bool,
    settingsMenuOpen: PropTypes.bool,
    shouldSaveBeforeTransition: PropTypes.func,
    showComingSoon: PropTypes.bool,
    username: PropTypes.string,
    userOwnsProject: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired
};

MenuBar.defaultProps = {
    logo: scratchLogo,
    onShare: () => {}
};

const mapStateToProps = (state, ownProps) => {
    const loadingState = state.scratchGui.projectState.loadingState;
    const user = state.session && state.session.session && state.session.session.user;
    return {
        aboutMenuOpen: aboutMenuOpen(state),
        activeTabIndex: state.scratchGui.editorTab.activeTabIndex,
        accountMenuOpen: accountMenuOpen(state),
        currentLocale: state.locales.locale,
        fileMenuOpen: fileMenuOpen(state),
        editMenuOpen: editMenuOpen(state),
        isRtl: state.locales.isRtl,
        isUpdating: getIsUpdating(loadingState),
        isShowingProject: getIsShowingProject(loadingState),
        locale: state.locales.locale,
        loginMenuOpen: loginMenuOpen(state),
        modeMenuOpen: modeMenuOpen(state),
        projectTitle: state.scratchGui.projectTitle,
        sessionExists: state.session && typeof state.session.session !== 'undefined',
        settingsMenuOpen: settingsMenuOpen(state),
        username: user ? user.username : null,
        userOwnsProject: ownProps.authorUsername && user &&
            (ownProps.authorUsername === user.username),
        vm: state.scratchGui.vm,
        mode220022BC: isTimeTravel220022BC(state),
        mode1920: isTimeTravel1920(state),
        mode1990: isTimeTravel1990(state),
        mode2020: isTimeTravel2020(state),
        modeNow: isTimeTravelNow(state)
    };
};

const mapDispatchToProps = dispatch => ({
    autoUpdateProject: () => dispatch(autoUpdateProject()),
    onOpenTipLibrary: () => dispatch(openTipsLibrary()),
    onClickAccount: () => dispatch(openAccountMenu()),
    onRequestCloseAccount: () => dispatch(closeAccountMenu()),
    onClickFile: () => dispatch(openFileMenu()),
    onRequestCloseFile: () => dispatch(closeFileMenu()),
    onClickEdit: () => dispatch(openEditMenu()),
    onRequestCloseEdit: () => dispatch(closeEditMenu()),
    onClickLogin: () => dispatch(openLoginMenu()),
    onRequestCloseLogin: () => dispatch(closeLoginMenu()),
    onClickMode: () => dispatch(openModeMenu()),
    onRequestCloseMode: () => dispatch(closeModeMenu()),
    onRequestOpenAbout: () => dispatch(openAboutMenu()),
    onRequestCloseAbout: () => dispatch(closeAboutMenu()),
    onClickSettings: () => dispatch(openSettingsMenu()),
    onRequestCloseSettings: () => dispatch(closeSettingsMenu()),
    onClickNew: needSave => dispatch(requestNewProject(needSave)),
    onClickRemix: () => dispatch(remixProject()),
    onClickSave: () => dispatch(manualUpdateProject()),
    onClickSaveAsCopy: () => dispatch(saveProjectAsCopy()),
    onSeeCommunity: () => dispatch(setPlayer(true)),
    onSetTimeTravelMode: mode => dispatch(setTimeTravel(mode))
});

export default compose(
    injectIntl,
    MenuBarHOC,
    connect(
        mapStateToProps,
        mapDispatchToProps
    )
)(MenuBar);
