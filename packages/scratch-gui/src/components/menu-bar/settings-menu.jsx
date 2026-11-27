import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, {useState} from 'react';
import {FormattedMessage, injectIntl, intlShape} from 'react-intl';
import {connect} from 'react-redux';
import locales from 'scratch-l10n';

import MenuBarMenu from './menu-bar-menu.jsx';
import {menuTriggerStyle, openMenuFromKeyboard} from '../../lib/menu-keyboard.js';
import {MenuItem, MenuSection, Submenu} from '../menu/menu.jsx';
import menuBarStyles from './menu-bar.css';
import styles from './settings-menu.css';
import dropdownCaret from './dropdown-caret.svg';
import settingsIcon from './icon--settings.svg';
import {selectLocale} from '../../reducers/locales.js';
import {DEFAULT_THEME, DARK_THEME, HIGH_CONTRAST_THEME, themeMap} from '../../lib/themes';
import {persistTheme} from '../../lib/themes/themePersistance';
import {setTheme} from '../../reducers/theme.js';
import {hardReload} from '../../lib/hard-reload.js';
import {getCameraPreferences, setCameraPreference} from '../../lib/bw-camera-preferences.js';
import {getCostumePrecision, setCostumePrecision} from '../../lib/bw-costume-precision.js';
import {getCadEnabled, setCadEnabled} from '../../lib/bw-cad-preferences.js';
import {getFpgaEnabled, setFpgaEnabled} from '../../lib/bw-fpga-preferences.js';
import {getLegacySpikeVisible, setLegacySpikeVisible} from '../../lib/spike-legacy-debug.js';

// The About, 8086 diagnostics and native i80386 benchmark dialogs (and the benchmark engine
// glue, ~55 KiB together) are fetched on the first request to open one, not with the first load
// (P17 budget, scripts/lib/webpack-ownership.mjs). Until then only this listener is mounted;
// the loaded panel mounts open and from then on listens for the event itself.
const lazyDialog = (load, openEvent, props = {}) => {
    const Panel = React.lazy(load);
    const LazyDialog = () => {
        const [request, setRequest] = React.useState(null);
        React.useEffect(() => {
            if (request) return undefined;
            const want = event => setRequest({detail: event.detail});
            window.addEventListener(openEvent, want);
            return () => window.removeEventListener(openEvent, want);
        }, [request]);
        return request ? <React.Suspense fallback={null}>
            <Panel {...props} initiallyOpen initialOpenDetail={request.detail} />
        </React.Suspense> : null;
    };
    return LazyDialog;
};
const BwAbout = lazyDialog(() => import(/* webpackChunkName: "bw-about" */ './bw-about.jsx'),
    'bw-open-about', {hideTrigger: true});
const I8086Lab = lazyDialog(() => import(/* webpackChunkName: "bw-i8086-lab" */ './i8086-lab.jsx'),
    'bw-open-i8086-lab');
const NativeBenchmarks = lazyDialog(
    () => import(/* webpackChunkName: "bw-native-benchmarks" */ './native-benchmarks.jsx'),
    'bw-open-native-benchmarks');

const DEBUG_DIAGNOSTICS_KEY = 'bw-debug-diagnostics';

const emit = (name, value) => {
    window.dispatchEvent(new CustomEvent(name, {detail: value}));
};

const SettingsMenu = ({intl, canChangeLanguage, canChangeTheme, isRtl, onRequestClose, onRequestOpen, settingsMenuOpen}) => {
    const t = (id, defaultMessage) => intl.formatMessage({id, defaultMessage});
    const de = /^de/i.test(intl.locale);
    const [cameraOpen, setCameraOpen] = useState(false);
    const camera = getCameraPreferences();
    const setCamera = (name, value) => {
        setCameraPreference(name, value);
        onRequestClose();
    };
    const cameraHeading = t('gui.camera.heading', de ? '3D-Navigation' : '3D navigation');
    const pan = {value: 'pan', label: t('gui.camera.pan', de ? 'Verschieben' : 'Pan')};
    const orbit = {value: 'orbit', label: t('gui.camera.orbit', de ? 'Drehen' : 'Orbit')};
    const zoom = {value: 'zoom', label: t('gui.camera.zoom', de ? 'Zoomen' : 'Zoom')};
    const [workspaceOpen, setWorkspaceOpen] = useState(false);
    const [preferencesOpen, setPreferencesOpen] = useState(false);
    const current = key => {
        try { return localStorage.getItem(key); } catch { return null; }
    };
    const [debugDiagnostics, setDebugDiagnostics] = useState(() => current(DEBUG_DIAGNOSTICS_KEY) === '1');
    const changeDebugDiagnostics = value => {
        setDebugDiagnostics(value === '1');
        try { localStorage.setItem(DEBUG_DIAGNOSTICS_KEY, value); } catch { /* allow a session-only preference */ }
        onRequestClose();
    };
    const workspaceValue = (key, fallback) => current(key) || fallback;
    const setWorkspace = (key, value) => {
        emit('bw-settings-change', {key, value});
        onRequestClose();
    };
    const openGettingStarted = () => {
        emit('bw-open-getting-started');
        onRequestClose();
    };
    const openLessons = () => {
        emit('bw-open-lessons');
        onRequestClose();
    };
    const presentation = (() => {
        const layout = workspaceValue('bw-hide-stage', '0') === '1' ? 'full' : 'stage';
        const theme = workspaceValue('bw-circuit-theme', 'light');
        return `${layout}-${theme}`;
    })();
    const setPresentation = value => {
        const [layout, theme] = value.split('-');
        emit('bw-settings-change', {key: 'bw-hide-stage', value: layout === 'full' ? '1' : '0'});
        emit('bw-settings-change', {key: 'bw-circuit-theme', value: theme});
        onRequestClose();
    };
    const workspaceSelect = (label, value, onChange, options, title) => (
        <label className={styles.preferenceRow} title={title}>
            <span>{label}</span>
            <select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
                {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
        </label>
    );
    return (
        <div
            data-bw-menu-root="" style={{padding: 0}}
            className={classNames(menuBarStyles.menuBarItem, menuBarStyles.hoverable, menuBarStyles.themeMenu, {
                [menuBarStyles.active]: settingsMenuOpen
            })}

        >
            <button type="button" data-bw-menu-trigger="" data-testid="bw-settings-menu-trigger"
                style={menuTriggerStyle} aria-haspopup="menu" aria-expanded={settingsMenuOpen}
                aria-label={intl.formatMessage({id: 'gui.menuBar.settings', defaultMessage: 'Settings'})}
                onClick={onRequestOpen} onKeyDown={event => openMenuFromKeyboard(event, onRequestOpen, onRequestClose)}>

            <img src={settingsIcon} />
            <span className={styles.dropdownLabel}><FormattedMessage defaultMessage="Settings" id="gui.menuBar.settings" /></span>
            <img src={dropdownCaret} />
            </button>
            <MenuBarMenu
                className={menuBarStyles.menuBarMenu}
                open={settingsMenuOpen}
                place={isRtl ? 'left' : 'right'}
                onRequestClose={onRequestClose}
            >
                <MenuSection>
                    <MenuItem expanded={workspaceOpen} ariaLabel={intl.formatMessage({id: 'gui.workspace.heading', defaultMessage: 'Workspace'})}>
                        <div className={styles.groupRow} onClick={() => setWorkspaceOpen(value => !value)}>
                            <span>{t('gui.workspace.heading', 'Workspace')}</span>
                            <img className={styles.groupCaret} src={dropdownCaret} />
                        </div>
                        <Submenu place={isRtl ? 'left' : 'right'}>
                            {workspaceSelect(t('gui.workspace.debugger', 'Debugger'), workspaceValue('bw-debug-dock', 'top'),
                                value => {
                                    setWorkspace('bw-debug-dock', value);
                                    if (value === 'right' || value === 'solo') setWorkspace('bw-stage-circuit', '1');
                                }, [
                                    {value: 'top', label: t('gui.workspace.top', 'Top')},
                                    {value: 'right', label: t('gui.workspace.right', 'Right')},
                                    {value: 'solo', label: t('gui.workspace.fullPane', 'Full pane')},
                                    {value: 'off', label: t('gui.workspace.off', 'Off')}
                                ], t('gui.workspace.debuggerHint', 'Choose where the circuit debugger appears — Full pane gives it the whole right pane while coding'))}
                            {workspaceSelect(t('gui.workspace.whileCoding', 'While coding'), workspaceValue('bw-stage-circuit', '0'),
                                value => setWorkspace('bw-stage-circuit', value), [
                                    {value: '1', label: t('gui.workspace.circuit', 'Circuit')},
                                    {value: '0', label: t('gui.workspace.scratchStage', 'Scratch stage')}
                                ], t('gui.workspace.codingHint', 'Choose what replaces the normal right pane while coding'))}
                            {workspaceSelect(t('gui.workspace.presentation', 'Circuit presentation'), presentation, setPresentation, [
                                {value: 'stage-light', label: t('gui.workspace.stageLight', 'Stage · light')},
                                {value: 'stage-dark', label: t('gui.workspace.stageDark', 'Stage · dark')},
                                {value: 'full-light', label: t('gui.workspace.fullLight', 'Full width · light')},
                                {value: 'full-dark', label: t('gui.workspace.fullDark', 'Full width · dark')}
                            ], t('gui.workspace.presentationHint', 'Choose circuit layout and appearance'))}
                            {/* Build-time gate: DefinePlugin drops this whole item when the FPGA
                                surface is not bundled, so it never offers a tab that cannot exist. */}
                            {process.env.BW_ENABLE_FPGA ? workspaceSelect(
                                t('gui.workspace.fpga', 'FPGA lab (⬢ tab)'), getFpgaEnabled() ? '1' : '0',
                                value => { setFpgaEnabled(value === '1'); onRequestClose(); }, [
                                    {value: '0', label: t('gui.workspace.off', 'Off')},
                                    {value: '1', label: t('gui.workspace.on', 'On')}
                                ], t('gui.workspace.fpgaHint', 'Show the ⬢ FPGA tab: synthesise Verilog for the Tang Nano 20K and drive the on-screen board')) : null}
                            {process.env.BW_ENABLE_CAD ? workspaceSelect(
                                t('gui.workspace.cad', /^de/i.test(intl.locale) ? 'CAD-Editor' : 'CAD Editor'), getCadEnabled() ? '1' : '0',
                                value => { setCadEnabled(value === '1'); onRequestClose(); }, [
                                    {value: '0', label: t('gui.workspace.off', 'Off')},
                                    {value: '1', label: t('gui.workspace.on', 'On')}
                                ], t('gui.workspace.cadHint', /^de/i.test(intl.locale) ? 'CAD-Tab zum Entwerfen von Körpern anzeigen' : 'Show the CAD tab to design solid models')) : null}
                            {process.env.BW_ENABLE_CAD ? workspaceSelect(
                                t('gui.workspace.costumePrecision', de ? 'Präzisionsdesign für Kostüme' : 'Costumes precision design'),
                                getCostumePrecision() ? '1' : '0',
                                value => { setCostumePrecision(value === '1'); onRequestClose(); }, [
                                    {value: '0', label: t('gui.workspace.off', 'Off')},
                                    {value: '1', label: t('gui.workspace.on', 'On')}
                                ], t('gui.workspace.costumePrecisionHint', de ?
                                    'Vektorflächen als bearbeitbare CAD-Skizzen übernehmen' : 'Send vector regions to CAD as editable sketches')) : null}
                            {workspaceSelect(t('gui.workspace.debugDiagnostics', de ? 'Debug-Diagnose' : 'Debug diagnostics'),
                                debugDiagnostics ? '1' : '0', changeDebugDiagnostics, [
                                    {value: '0', label: t('gui.workspace.off', 'Off')},
                                    {value: '1', label: t('gui.workspace.on', 'On')}
                                ], de ? 'Verbindungs-, Fähigkeits- und CPU-Diagnosen im Menü anzeigen' :
                                    'Show connection, capability and CPU diagnostics in Settings')}
                            {workspaceSelect(t('gui.workspace.legacySpike', 'Legacy SPIKE extensions'), getLegacySpikeVisible() ? '1' : '0',
                                value => { setLegacySpikeVisible(value === '1'); onRequestClose(); }, [
                                    {value: '0', label: t('gui.workspace.off', 'Off')},
                                    {value: '1', label: t('gui.workspace.showDebugging', 'Show for debugging')}
                                ], t('gui.workspace.legacyHint', 'Show four archived SPIKE Prime drivers in the extension gallery for hardware diagnosis'))}
                        </Submenu>
                    </MenuItem>
                    <MenuItem expanded={cameraOpen} ariaLabel={cameraHeading}>
                        <div className={styles.groupRow} onClick={() => setCameraOpen(value => !value)}>
                            <span>{cameraHeading}</span>
                            <img className={styles.groupCaret} src={dropdownCaret} />
                        </div>
                        <Submenu place={isRtl ? 'left' : 'right'}>
                            {workspaceSelect(t('gui.camera.trackpadSlide', de ? 'Zwei Finger bewegen' : 'Two-finger slide'),
                                camera.trackpadSlide, value => setCamera('trackpadSlide', value), [pan, orbit, zoom])}
                            {workspaceSelect(t('gui.camera.secondaryDrag', de ? 'Mit Sekundärklick ziehen' : 'Secondary-button drag'),
                                camera.secondaryDrag, value => setCamera('secondaryDrag', value), [orbit, pan])}
                        </Submenu>
                    </MenuItem>
                </MenuSection>
                <MenuSection>
                    <MenuItem onClick={openGettingStarted}>
                        <FormattedMessage
                            defaultMessage="Getting started…"
                            description="Open the Brickwright starter journey chooser"
                            id="gui.menuBar.gettingStarted"
                        />
                    </MenuItem>
                    <MenuItem onClick={openLessons}>
                        <FormattedMessage
                            defaultMessage="Lessons…"
                            description="Open the Brickwright guided lessons library"
                            id="gui.menuBar.lessons"
                        />
                    </MenuItem>
                    <MenuItem onClick={() => { onRequestClose(); hardReload(); }}>
                        <FormattedMessage
                            defaultMessage="Reload BrickWright"
                            description="Settings action that clears frontend caches and reloads the app"
                            id="gui.menuBar.reloadBrickwright"
                        />
                    </MenuItem>
                    {(canChangeLanguage || canChangeTheme) && <MenuItem expanded={preferencesOpen} ariaLabel={intl.formatMessage({id: 'gui.menuBar.preferences', defaultMessage: 'Preferences'})}>
                        <div className={styles.groupRow} onClick={() => setPreferencesOpen(value => !value)}>
                            <span>{t('gui.menuBar.preferences', 'Preferences')}</span>
                            <img className={styles.groupCaret} src={dropdownCaret} />
                        </div>
                        <PreferencesSubmenu
                            canChangeLanguage={canChangeLanguage}
                            canChangeTheme={canChangeTheme}
                            isRtl={isRtl}
                            onRequestClose={onRequestClose}
                        />
                    </MenuItem>}
                    <MenuItem onClick={() => { emit('bw-open-history-panel', {view: 'autosave'}); onRequestClose(); }}>
                        {t('gui.menuBar.autosaveHistory', 'Autosave & history…')}
                    </MenuItem>
                    <MenuItem onClick={() => { emit('bw-open-scratchlink-transport'); onRequestClose(); }}>
                        <FormattedMessage
                            defaultMessage="How Scratch Link connects…"
                            description="Settings action that chooses which carrier the Scratch Link protocol uses"
                            id="gui.menuBar.scratchLinkTransport"
                        />
                    </MenuItem>
                    {/* Peer sessions (task E11): only in a BW_ENABLE_PEERS=1 build, only in the app. */}
                    {process.env.BW_ENABLE_PEERS === true && window.__TAURI__ ? (
                        <MenuItem onClick={() => { emit('bw-open-peer-sessions'); onRequestClose(); }}>
                            <FormattedMessage id="gui.menuBar.peerSessions" defaultMessage="Peer sessions…" />
                        </MenuItem>
                    ) : null}
                    <MenuItem onClick={() => { emit('bw-open-virtual-spike'); onRequestClose(); }}>
                        <FormattedMessage
                            defaultMessage="Virtual SPIKE Prime…"
                            description="Settings action that opens the virtual LEGO SPIKE Prime controls"
                            id="gui.menuBar.virtualSpikePrime"
                        />
                    </MenuItem>
                    <MenuItem onClick={() => { emit('bw-open-toolchain-manager'); onRequestClose(); }}>
                        <FormattedMessage
                            defaultMessage="C compiler for 8051 boards…"
                            description="Settings item opening the SDCC toolchain download manager"
                            id="gui.menuBar.toolchainManager"
                        />
                    </MenuItem>
                    <MenuItem onClick={() => { emit('bw-open-about'); onRequestClose(); }}>
                        {t('gui.menuBar.aboutBrickwright', 'About Brickwright…')}
                    </MenuItem>
                    {debugDiagnostics && <>
                        <MenuItem onClick={() => { emit('bw-open-ble-diagnostics'); onRequestClose(); }}>
                            <FormattedMessage
                                defaultMessage="Connection diagnostics…"
                                description="Settings action that opens the on-screen Bluetooth/connection log"
                                id="gui.menuBar.connectionDiagnostics"
                            />
                        </MenuItem>
                        <MenuItem onClick={() => { emit('bw-open-capability-diagnostics'); onRequestClose(); }}>
                            <FormattedMessage
                                defaultMessage="Capability diagnostics…"
                                description="Settings action that opens the extension capability audit panel"
                                id="gui.menuBar.capabilityDiagnostics"
                            />
                        </MenuItem>
                        <MenuItem onClick={() => { emit('bw-open-i8086-lab'); onRequestClose(); }}>
                            {t('gui.menuBar.i8086Diagnostics', '8086 execution diagnostics…')}
                        </MenuItem>
                        <MenuItem onClick={() => { emit('bw-open-native-benchmarks'); onRequestClose(); }}>
                            {t('gui.menuBar.nativeBenchmarks', 'Benchmarks (native i80386)…')}
                        </MenuItem>
                    </>}
                </MenuSection>
            </MenuBarMenu>
            <BwAbout />
            <I8086Lab />
            <NativeBenchmarks />
        </div>
    );
};

const PreferencesSubmenuComponent = ({intl, canChangeLanguage, canChangeTheme, currentLocale, currentTheme, isRtl, onChangeLocale, onChangeTheme, onRequestClose}) => {
    const t = (id, defaultMessage) => intl.formatMessage({id, defaultMessage});
    const enabledThemes = [DEFAULT_THEME, DARK_THEME, HIGH_CONTRAST_THEME];

    return (
        <Submenu className={styles.preferencesSubmenu} place={isRtl ? 'left' : 'right'}>
            {canChangeLanguage && <label className={styles.preferenceRow}>
                <span>{t('gui.menuBar.language', 'Language')}</span>
                <select value={currentLocale} onChange={event => {
                    onChangeLocale(event.target.value);
                    onRequestClose();
                }}>
                    {Object.keys(locales).map(key => <option key={key} value={key}>{locales[key].name}</option>)}
                </select>
            </label>}
            {canChangeTheme && <label className={styles.preferenceRow}>
                <span>{t('gui.menuBar.colorMode', 'Color mode')}</span>
                <select value={currentTheme} onChange={event => {
                    onChangeTheme(event.target.value);
                    onRequestClose();
                }}>
                    {enabledThemes.map(key => <option key={key} value={key}>{intl.formatMessage(themeMap[key].label)}</option>)}
                </select>
            </label>}
        </Submenu>
    );
};

PreferencesSubmenuComponent.propTypes = {
    intl: intlShape.isRequired,
    canChangeLanguage: PropTypes.bool,
    canChangeTheme: PropTypes.bool,
    currentLocale: PropTypes.string,
    currentTheme: PropTypes.string,
    isRtl: PropTypes.bool,
    onChangeLocale: PropTypes.func,
    onChangeTheme: PropTypes.func,
    onRequestClose: PropTypes.func
};

const PreferencesSubmenu = connect(
    state => ({
        currentLocale: state.locales.locale,
        currentTheme: state.scratchGui.theme.theme
    }),
    dispatch => ({
        onChangeLocale: locale => dispatch(selectLocale(locale)),
        onChangeTheme: theme => {
            dispatch(setTheme(theme));
            persistTheme(theme);
        }
    })
)(injectIntl(PreferencesSubmenuComponent));

SettingsMenu.propTypes = {
    intl: intlShape.isRequired,
    canChangeLanguage: PropTypes.bool,
    canChangeTheme: PropTypes.bool,
    isRtl: PropTypes.bool,
    onRequestClose: PropTypes.func,
    onRequestOpen: PropTypes.func,
    settingsMenuOpen: PropTypes.bool
};

export default injectIntl(SettingsMenu);
