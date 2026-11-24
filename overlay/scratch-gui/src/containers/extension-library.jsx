import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import VM from 'scratch-vm';
import {defineMessages, injectIntl, intlShape} from 'react-intl';

import extensionLibraryContent from '../lib/libraries/extensions/index.jsx';
import {getLegacySpikeVisible, LEGACY_SPIKE_CHANGE_EVENT} from '../lib/spike-legacy-debug';
import {remoteExtensionsAllowed} from '../lib/distribution-policy';
import {confirmAsync, promptAsync} from '../lib/native-dialog';
import {setCadEnabled, CAD_OPEN_EVENT} from '../lib/bw-cad-preferences.js';
import {setCircuitView} from '../lib/bw-debug/debug-view.js';

// Extensions whose blocks act on a 3D surface show that surface beside the blocks
// as soon as they are added, so the first block dragged out visibly does something.
const showSurfaceFor = id => {
    if ((id === 'cadshapes' || id === 'cadlab') && process.env.BW_ENABLE_CAD) {
        setCadEnabled(true);
        window.dispatchEvent(new CustomEvent(CAD_OPEN_EVENT));
    } else if (id === 'robotlab') {
        setCircuitView({fullWidth: true, dock: 'robots'});
    }
};

import LibraryComponent from '../components/library/library.jsx';
import extensionIcon from '../components/action-menu/icon--sprite.svg';

// Brickwright: the CrispStrobe extension gallery. Its entries are loaded UNSANDBOXED, in-process,
// by the VM's clean-room loader (extension-manager.loadExtensionURL -> crispstrobe adapter). This
// container merges the gallery (fetched once at open) after our bundled built-ins. Only this host
// is trusted by the VM allow-list, so only these entries actually run in-process.
const GALLERY_BASE = 'https://crispstrobe.github.io/extensions/';
const GALLERY_INDEX = `${GALLERY_BASE}generated-metadata/extensions-v0.json`;

let cachedGallery = null;

// Brickwright: our own extensions get proper wide poster art (hosted under static/);
// the whole LEGO family shares one poster. The inset badge keeps the extension's
// OWN icon (ext.image) when it has one, falling back to a poster crop otherwise.
// Returns {iconURL, insetIconURL} or null.
const POSTER_BASE = 'static/extension-posters/';
// The SPIKE Transpiler ships a nice icon; the other SPIKE variants (BLE/BTC/bridge)
// have none, so they inherit it instead of a generic crop.
const SPIKE_ICON = `${GALLERY_BASE}images/CrispStrobe/legospike_turbowarp_transpile.svg`;
const posterFor = ext => {
    const slug = ext.slug || '';
    const ownIcon = ext.image ? `${GALLERY_BASE}${ext.image}` : null;
    if ((/lego|ev3|spike|nxt|wedo|boost|powered/i).test(slug)) {
        const badge = ownIcon ||
            ((/spike/i).test(slug) ? SPIKE_ICON : `${POSTER_BASE}lego-badge.png`);
        return {iconURL: `${POSTER_BASE}lego.png`, insetIconURL: badge};
    }
    if (ext.id === 'universalgamepad' || (/gamepad/i).test(slug)) {
        return {iconURL: `${POSTER_BASE}gamepad.png`, insetIconURL: ownIcon || `${POSTER_BASE}gamepad-badge.png`};
    }
    if (ext.id === 'csp' || (/\/csp$/i).test(slug)) {
        return {iconURL: `${POSTER_BASE}csp.png`, insetIconURL: ownIcon || `${POSTER_BASE}csp-badge.png`};
    }
    return null;
};

const fetchGallery = async () => {
    if (cachedGallery) return cachedGallery;
    const res = await fetch(GALLERY_INDEX);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cachedGallery = (data.extensions || []).map(ext => {
        const poster = posterFor(ext);
        return {
            name: ext.name,
            description: ext.description,
            extensionId: ext.id,
            extensionURL: `${GALLERY_BASE}${ext.slug}.js`,
            iconURL: poster ? poster.iconURL : (ext.image ? `${GALLERY_BASE}${ext.image}` : extensionIcon),
            insetIconURL: poster ? poster.insetIconURL : undefined,
            tags: ['gallery'],
            featured: true,
            // carry translations through so a later i18n pass can localise the picker
            nameTranslations: ext.nameTranslations || {},
            descriptionTranslations: ext.descriptionTranslations || {}
        };
    });
    return cachedGallery;
};

const messages = defineMessages({
    extensionTitle: {
        defaultMessage: 'Choose an Extension',
        description: 'Heading for the extension library',
        id: 'gui.extensionLibrary.chooseAnExtension'
    },
    extensionUrl: {
        defaultMessage: 'Enter the URL of the extension',
        description: 'Prompt for unoffical extension url',
        id: 'gui.extensionLibrary.extensionUrl'
    },
    customName: {
        defaultMessage: '➕ Extension from URL',
        description: 'Tile that lets you load any TurboWarp/Xcratch extension by URL',
        id: 'gui.extensionLibrary.customName'
    },
    customDescription: {
        defaultMessage: 'Load a sandbox-compatible TurboWarp or Scratch extension from a URL.',
        description: 'Description of the custom-extension-from-URL tile',
        id: 'gui.extensionLibrary.customDescription'
    },
    untrusted: {
        defaultMessage: 'Load code from:\n\n{url}\n\nIt will run in an isolated worker without access to the ' +
            'editor or native device bridge. HTTP(S) requests remain available; direct WebSockets and nested ' +
            'workers are blocked. ' +
            'Extensions which require unsandboxed mode will be refused.',
        description: 'Confirmation before running a custom extension in the worker sandbox',
        id: 'gui.extensionLibrary.untrusted'
    },
    loadFailed: {
        defaultMessage: 'Could not load the extension from {url}\n\n{error}',
        description: 'Alert shown when a custom extension URL fails to load',
        id: 'gui.extensionLibrary.loadFailed'
    },
    unpinned: {
        defaultMessage: 'This gallery extension is newer than this app, so its code has not been pinned or ' +
            'reviewed here yet:\n\n{url}\n\nIt will run in an isolated worker without editor or ' +
            'native-device access. HTTP(S) requests remain available; direct WebSockets and nested workers are ' +
            'blocked. Load it?',
        description: 'Confirmation for a gallery extension published since this build was pinned',
        id: 'gui.extensionLibrary.unpinned'
    }
});

// German for the picker's own prompts (defaultMessage is English; no scratch-l10n bundle carries
// these custom ids). Keyed by message id; falls back to the English defaultMessage for other locales.
const DE_MESSAGES = {
    'gui.extensionLibrary.extensionUrl': 'URL der Erweiterung eingeben',
    'gui.extensionLibrary.customName': '➕ Erweiterung per URL',
    'gui.extensionLibrary.customDescription':
        'Lade eine sandbox-kompatible TurboWarp- oder Scratch-Erweiterung von einer URL.',
    'gui.extensionLibrary.untrusted': 'Code laden von:\n\n{url}\n\nEr läuft in einem isolierten Worker ohne ' +
        'Zugriff auf den Editor oder die native Gerätebrücke. HTTP(S)-Anfragen sind weiterhin möglich; ' +
        'direkte WebSockets und verschachtelte Worker sind gesperrt. ' +
        'Erweiterungen, die den unsicheren Modus benötigen, werden abgelehnt.',
    'gui.extensionLibrary.loadFailed': 'Erweiterung von {url} konnte nicht geladen werden\n\n{error}',
    'gui.extensionLibrary.unpinned': 'Diese Galerie-Erweiterung ist neuer als diese App; ihr Code wurde hier ' +
        'noch nicht festgeschrieben oder geprüft:\n\n{url}\n\nSie läuft in einem isolierten Worker ohne Zugriff ' +
        'auf den Editor oder die native Gerätebrücke. HTTP(S)-Anfragen sind weiterhin möglich; direkte ' +
        'WebSockets und verschachtelte Worker sind gesperrt. Laden?'
};

class ExtensionLibrary extends React.PureComponent {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleItemSelect',
            'handleLegacySpikeChange'
        ]);
        this.state = {gallery: [], galleryError: null, showLegacySpike: getLegacySpikeVisible()};
    }
    componentDidMount () {
        window.addEventListener(LEGACY_SPIKE_CHANGE_EVENT, this.handleLegacySpikeChange);
        // A deliberately restricted distribution exposes only extensions already bundled with it.
        // This is a webpack build policy, not a Tauri/runtime-platform inference.
        if (remoteExtensionsAllowed()) {
            fetchGallery()
                .then(gallery => this.setState({gallery}))
                .catch(err => this.setState({galleryError: err.message}));
        }
    }
    componentWillUnmount () {
        window.removeEventListener(LEGACY_SPIKE_CHANGE_EVENT, this.handleLegacySpikeChange);
    }
    handleLegacySpikeChange () {
        this.setState({showLegacySpike: getLegacySpikeVisible()});
    }
    // Locale-aware message: German from DE_MESSAGES when the editor is set to Deutsch, else the
    // react-intl (English defaultMessage) string. Handles simple {placeholder} interpolation.
    msg (m, values) {
        const loc = this.props.intl.locale;
        if (loc && loc.startsWith('de') && DE_MESSAGES[m.id]) {
            return DE_MESSAGES[m.id].replace(/\{(\w+)\}/g, (_, k) => (values && values[k] != null ? values[k] : ''));
        }
        return this.props.intl.formatMessage(m, values);
    }
    async handleItemSelect (item) {
        if (item.disabled) return;
        if (item.legacySpikeDebug && !getLegacySpikeVisible()) return;
        const em = this.props.vm.extensionManager;
        const id = item.extensionId;
        let url = item.extensionURL || id;
        // The "Extension from URL" tile (and any entry without a URL/id) asks for a URL.
        if (item.custom || (!item.extensionURL && !id)) {
            // Awaited: in the desktop/iOS app `prompt` returns null at once (lib/native-dialog.js).
            url = await promptAsync(this.msg(messages.extensionUrl), '');
            if (!url) return;
            url = url.trim();
        }
        if (!url) return;
        // Unpinned URLs run in the worker sandbox, but still execute downloaded code with network
        // access. Distinguish a genuinely new gallery entry from a disguised or foreign URL without
        // weakening the user decision at this boundary.
        if (/^https?:\/\//.test(url) && !em.isTrustedExtensionURL(url)) {
            const newEntry = typeof em.pinStatusFor === 'function' && em.pinStatusFor(url) === 'unpinned';
            // Awaited: in the desktop/iOS app `confirm` cannot block (lib/native-dialog.js), and
            // this is the consent to run downloaded code.
            if (!(await confirmAsync(this.msg(newEntry ? messages.unpinned : messages.untrusted, {url})))) return;
        }
        const done = () => {
            if (id) showSurfaceFor(id);
            return id ? this.props.onCategorySelected(id) : this.props.onRequestClose();
        };
        if (em.isExtensionLoaded(url)) { done(); return; }
        em.loadExtensionURL(url, item.legacySpikeDebug ? {legacySpikeDebug: true} : undefined).then(done).catch(e => {
            // eslint-disable-next-line no-alert
            alert(this.msg(messages.loadFailed, {url, error: String((e && e.message) || e)}));
        });
    }
    render () {
        // bundled built-ins first, then the fetched gallery — minus any gallery entry whose id we
        // already bundle (e.g. planetemaths, arrays), so they don't appear twice.
        const bundledIds = new Set(extensionLibraryContent.map(e => e.extensionId).filter(Boolean));
        const bundled = extensionLibraryContent.filter(e => !e.legacySpikeDebug || this.state.showLegacySpike);
        const gallery = this.state.gallery.filter(e => !bundledIds.has(e.extensionId));
        // "Extension from URL" action tile (TurboWarp/Xcratch-style direct load), first in the list.
        const customEntry = {
            custom: true,
            name: this.msg(messages.customName),
            description: this.msg(messages.customDescription),
            iconURL: 'static/extension-posters/extensionurl.png',
            insetIconURL: 'static/extension-posters/extensionurl-badge.png',
            tags: ['gallery'],
            featured: true
        };
        const allExtensions = (remoteExtensionsAllowed() ? [customEntry] : []).concat(bundled, gallery);
        const extensionLibraryThumbnailData = allExtensions.map(extension => ({
            rawURL: extension.iconURL || extensionIcon,
            ...extension
        }));
        return (
            <LibraryComponent
                data={extensionLibraryThumbnailData}
                filterable
                id="extensionLibrary"
                title={this.props.intl.formatMessage(messages.extensionTitle)}
                visible={this.props.visible}
                onItemSelected={this.handleItemSelect}
                onRequestClose={this.props.onRequestClose}
            />
        );
    }
}

ExtensionLibrary.propTypes = {
    intl: intlShape.isRequired,
    onCategorySelected: PropTypes.func,
    onRequestClose: PropTypes.func,
    visible: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired // eslint-disable-line react/no-unused-prop-types
};

export default injectIntl(ExtensionLibrary);
