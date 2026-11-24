import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import styles from './bw-about.css';
import EditorErrorBoundary from '../editor-error-boundary/editor-error-boundary.jsx';

const VERSION = (typeof process.env.BW_VERSION === 'string' && process.env.BW_VERSION) || 'unknown';
const BUILD_TIME = (typeof process.env.BW_BUILD_TIME === 'string' && process.env.BW_BUILD_TIME) || '';
const POLICY = Object.freeze({
    extensions: process.env.BW_REMOTE_EXTENSIONS_POLICY === 'deny' ? 'deny' : 'allow',
    toolchains: process.env.BW_REMOTE_TOOLCHAINS_POLICY === 'deny' ? 'deny' : 'allow',
    machineImages: process.env.BW_REMOTE_MACHINE_IMAGES_POLICY === 'deny' ? 'deny' : 'allow',
    // data, not code: the Robot Lab's parts from the LDraw catalogue (webpack.config.js)
    parts: process.env.BW_REMOTE_PARTS_POLICY === 'deny' ? 'deny' : 'allow'
});
const POLICY_RECEIPT = process.env.BW_DISTRIBUTION_POLICY_RECEIPT;

const REPO_URL = 'https://github.com/CrispStrobe/brickwright-lite';
const NOTICES_URL = `${REPO_URL}/blob/main/THIRD-PARTY-NOTICES.md`;

/**
 * Full licence texts that SHIP WITH THE APP, served from static/ so they open
 * with no network. BSD-3 clause 2 and MIT both require the notice — conditions
 * and disclaimer included — to accompany a binary distribution; a link to
 * GitHub does not accompany anything.
 */
const BUNDLED_LICENCES = [
    ['Scratch Link (BSD-3-Clause)', 'static/licenses/scratch-link.BSD-3-Clause.txt'],
    ['Scrub (BSD-3-Clause)', 'static/licenses/scrub.BSD-3-Clause.txt'],
    ['labwired-core (MIT)', 'static/licenses/labwired-core.MIT.txt'],
    ['8086 example programs (MIT)', 'static/licenses/amey-thakur-8086.MIT.txt'],
    ['MakeCode extensions: pxt-microturtle, pxt-radio-blockchain, pxt-kitronik-motor-driver, arcade-background-scroll, arcade-character-animations (MIT)',
        'static/licenses/makecode-extensions.MIT.txt'],
    ['MakeCode Arcade runtime: pxt-common-packages image, text and speech code, pxt-arcade built-in images (MIT)',
        'static/licenses/pxt-common-packages.MIT.txt'],
    ['Arcade 12x12 pixel font, based on Adobe Source Han Sans (SIL OFL 1.1)',
        'static/licenses/pxt-speech-font12.OFL.txt'],
    ['SmallerC + ucpp (BSD-2-Clause / BSD)', 'static/licenses/smallerc.BSD-2-Clause.txt'],
    ['Bochs BIOS + VGABios firmware (LGPL-2.1)', 'static/licenses/free-386-firmware.LGPL-2.1.txt'],
    ['bw-circuit-ui (MPL-2.0)', 'static/licenses/bw-circuit-ui.MPL-2.0.txt'],
    ['NQC (MPL-2.0)', 'static/licenses/nqc.MPL-2.0.txt'],
    // The Robot Lab's parts (vendored, and those added from the LDraw catalogue):
    ['LDraw Parts Library: CAreadme', 'static/ldraw/CAreadme.txt'],
    ['LDraw Parts Library (CC BY 4.0)', 'static/ldraw/CAlicense4.txt'],
    ['LDraw Parts Library (CC BY 2.0)', 'static/ldraw/CAlicense.txt']
];
const COMPILER_ABOUT_URL = 'https://stc-compiler.vercel.app/#about';
const COMPILER_HEALTH_URL = 'https://stc-compiler.vercel.app/health';

const PROVIDER = {
    name: 'Christian Strobele',
    address: ['Nikolausstr. 5', '70190 Stuttgart', 'Deutschland / Germany'],
    email: 'postmaster@crispstro.be',
    phone: '+49 176 6421 8601'
};

// "Our apps" (App Store / TestFlight links and icons): its own chunk, fetched
// only when the dialog shows it.
const AppShowcase = React.lazy(() => import(/* webpackChunkName: "about-apps" */ './app-showcase.jsx'));

const L10N = {
    en: {
        about: 'About Brickwright',
        creditsLoading: 'Loading credits…',
        creditsRetry: 'Load credits again',
        version: 'Version',
        built: 'Built',
        remoteDownloads: 'Remote downloads',
        remoteExtensions: 'URL extensions',
        remoteToolchains: 'Executable toolchains',
        remoteMachineImages: 'Machine images',
        remoteParts: 'Parts from the LDraw catalogue',
        policyAllow: 'Allowed',
        policyDeny: 'Restricted',
        source: 'Source code',
        commit: 'View this commit',
        close: 'Close',
        unknownVersion: 'This build was made without a commit stamp.',
        blurb: 'Build and measure circuits, program machines with blocks or code, debug them live, ' +
            'and learn beside the project — in the browser or native app.',
        copied: 'Copied',
        copy: 'Copy version details',
        apps: 'Our apps',
        appsLoading: 'Loading apps…',
        provider: 'Provider (Impressum)',
        contact: 'Contact',
        email: 'E-mail',
        phone: 'Phone',
        privacy: 'Privacy',
        privacyText: 'This is a static page: no accounts, no tracking by us, and projects stay ' +
            'in your browser. Pressing Build/Run sends your program text to the compile service ' +
            'to be compiled and is not stored; the optional local compiler removes even that.',
        disclaimer: 'Disclaimer',
        disclaimerText: 'An educational tool. The simulation is a model, not silicon: check ' +
            'polarity, voltage and current limits before wiring real hardware, and treat ' +
            'anything not verified on a real chip as unverified.',
        components: 'Components and licences',
        licenseNote: 'Open-source under BSD-3-Clause, Apache-2.0, MIT, MPL-2.0, and LGPL-2.1. Brickwright ' +
            'uses the last BSD Scratch stack plus its own editors and engines; it is not a TurboWarp fork.',
        // Named here, not only in the linked file: these ship INSIDE the binary,
        // and BSD-3 clause 2 asks for the notice to travel with it.
        thanks: 'Carried in this app',
        thanksText: 'Scratch Link, Copyright (c) 2019 Scratch Foundation, BSD-3-Clause — the ' +
            'reference Bluetooth implementation, vendored unmodified. Its PerfectWebSockets shim ' +
            'follows Scrub, Copyright (c) 2021 Shinichiro Oba, BSD-3-Clause. labwired-core, ' +
            'Copyright (c) 2026 Andrii Shylenko, MIT — the full-fidelity simulator. ' +
            'avr8js and rp2040js (MIT, Wokwi) are the AVR and Cortex-M0 cores; emu8051 (MIT) ' +
            'the 8051. The ASM tab\'s 8086 example programs are carried verbatim from the ' +
            '8086 Assembly Language Programs collection, Copyright (c) 2021 Amey Thakur and ' +
            'Mega Satish, MIT. The virtual SPIKE Prime hub and arena use Brickwright’s independent simulator.',
        thanksTexts: 'Licence texts (offline):',
        notices: 'Full third-party notices',
        affil: 'Affiliation',
        affilText: 'Not affiliated with or endorsed by Scratch / MIT, the LEGO Group, STC, Arduino, or ' +
            'Raspberry Pi. LEGO®, SPIKE™, Technic™ and MINDSTORMS® are trademarks of the LEGO Group, ' +
            'which does not sponsor, authorize or endorse Brickwright. Other trademarks belong to their owners.',
        toolchain: 'Compile service',
        toolchainLoading: 'asking the service...',
        toolchainDown: 'service not reachable right now — compiling will say why'
    },
    de: {
        about: 'Über Brickwright',
        creditsLoading: 'Danksagungen werden geladen…',
        creditsRetry: 'Danksagungen erneut laden',
        version: 'Version',
        built: 'Erstellt',
        remoteDownloads: 'Remote-Downloads',
        remoteExtensions: 'URL-Erweiterungen',
        remoteToolchains: 'Ausfuhrbare Toolchains',
        remoteMachineImages: 'Maschinenabbilder',
        remoteParts: 'Teile aus dem LDraw-Katalog',
        policyAllow: 'Erlaubt',
        policyDeny: 'Eingeschrankt',
        source: 'Quellcode',
        commit: 'Diesen Commit ansehen',
        close: 'Schliessen',
        unknownVersion: 'Dieser Build wurde ohne Commit-Stempel erzeugt.',
        blurb: 'Schaltungen bauen und messen, Maschinen mit Bloecken oder Code programmieren, ' +
            'live debuggen und direkt am Projekt lernen — im Browser oder in der nativen App.',
        copied: 'Kopiert',
        copy: 'Versionsdetails kopieren',
        apps: 'Unsere Apps',
        appsLoading: 'Apps werden geladen…',
        provider: 'Anbieter (Impressum)',
        contact: 'Kontakt',
        email: 'E-Mail',
        phone: 'Telefon',
        privacy: 'Datenschutz',
        privacyText: 'Dies ist eine statische Seite: keine Konten, kein Tracking durch uns, ' +
            'Projekte bleiben im Browser. Build/Run sendet den Programmtext zum Kompilieren an ' +
            'den Compile-Dienst und wird nicht gespeichert; der optionale lokale Compiler ' +
            'vermeidet auch das.',
        disclaimer: 'Haftungsausschluss',
        disclaimerText: 'Ein Lernwerkzeug. Die Simulation ist ein Modell, kein Silizium: vor ' +
            'echter Hardware Polung, Spannungen und Stromgrenzen prufen; alles ohne Nachweis ' +
            'auf echtem Chip gilt als unverifiziert.',
        components: 'Komponenten und Lizenzen',
        thanks: 'In dieser App enthalten',
        thanksText: 'Scratch Link, Copyright (c) 2019 Scratch Foundation, BSD-3-Clause — die ' +
            'Referenz-Bluetooth-Implementierung, unveraendert uebernommen. Der ' +
            'PerfectWebSockets-Shim folgt Scrub, Copyright (c) 2021 Shinichiro Oba, ' +
            'BSD-3-Clause. labwired-core, Copyright (c) 2026 Andrii Shylenko, MIT — der ' +
            'Simulator mit voller Genauigkeit. avr8js und rp2040js (MIT, Wokwi) sind die AVR- ' +
            'und Cortex-M0-Kerne; emu8051 (MIT) der 8051. Die 8086-Beispielprogramme im ' +
            'ASM-Tab stammen unveraendert aus der Sammlung 8086 Assembly Language Programs, ' +
            'Copyright (c) 2021 Amey Thakur und Mega Satish, MIT. Der virtuelle SPIKE-Prime-Hub und die Arena nutzen Brickwrights eigenen Simulator.',
        thanksTexts: 'Lizenztexte (offline):',
        licenseNote: 'Quelloffen unter BSD-3-Clause, Apache-2.0, MIT, MPL-2.0 und LGPL-2.1. Brickwright nutzt ' +
            'den letzten BSD-Scratch-Stack sowie eigene Editoren und Engines; es ist kein TurboWarp-Fork.',
        notices: 'Vollstandige Third-Party-Hinweise',
        affil: 'Zugehorigkeit',
        affilText: 'Nicht verbunden mit oder unterstutzt von Scratch / MIT, der LEGO Gruppe, STC, Arduino oder ' +
            'Raspberry Pi. LEGO®, SPIKE™, Technic™ und MINDSTORMS® sind Marken der LEGO Gruppe, die ' +
            'Brickwright weder unterstutzt noch autorisiert oder empfiehlt. Andere Marken gehoren ihren Eigentumern.',
        toolchain: 'Compile-Dienst',
        toolchainLoading: 'frage den Dienst...',
        toolchainDown: 'Dienst gerade nicht erreichbar — beim Kompilieren steht warum'
    }
};

const tx = (locale, key) => {
    const language = String(locale || 'en').split('-')[0];
    return (L10N[language] || L10N.en)[key] || L10N.en[key] || key;
};

const formatBuildTime = iso => {
    if (!iso) return '';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? '' : date.toLocaleString();
};

/** Render one licence group with collapsible entries. */
const LicenceGroup = ({group, locale}) => {
    const isDe = String(locale || 'en').split('-')[0] === 'de';
    const groupTitle = isDe && group.titleDe ? group.titleDe : group.title;
    return (
        <div className={styles.group}>
            <div className={styles.groupHeading}>{groupTitle}</div>
            <table className={styles.licences}>
                <tbody>
                    {group.entries.map(entry => (
                        <tr key={entry.name}>
                            <td className={styles.entryName}>
                                {entry.url ? (
                                    <a
                                        href={entry.url}
                                        rel="noopener noreferrer"
                                        target="_blank"
                                    >{entry.name}</a>
                                ) : entry.name}
                            </td>
                            <td className={styles.entryRole}>{entry.role}</td>
                            <td className={styles.entryLicense}>
                                {entry.licenseUrl ? (
                                    <a
                                        href={entry.licenseUrl}
                                        rel="noopener noreferrer"
                                        target="_blank"
                                    >{entry.license}</a>
                                ) : entry.license}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {/* Render notes for entries that have them */}
            {group.entries.filter(e => e.note).map(entry => (
                <p key={`${entry.name}-note`} className={styles.entryNote}>
                    {entry.name}: {entry.note}
                </p>
            ))}
        </div>
    );
};

LicenceGroup.propTypes = {
    group: PropTypes.shape({
        title: PropTypes.string.isRequired,
        titleDe: PropTypes.string,
        entries: PropTypes.arrayOf(PropTypes.shape({
            name: PropTypes.string.isRequired,
            url: PropTypes.string,
            license: PropTypes.string.isRequired,
            licenseUrl: PropTypes.string,
            role: PropTypes.string.isRequired,
            note: PropTypes.string
        })).isRequired
    }).isRequired,
    locale: PropTypes.string
};

class BwAbout extends React.Component {
    constructor (props) {
        super(props);
        // initiallyOpen: settings-menu.jsx loads this dialog lazily on the first bw-open-about.
        this.state = {open: Boolean(props.initiallyOpen), copied: false, toolchain: null, groups: null, groupsError: false};
        this.handleToggle = this.handleToggle.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.handleCopy = this.handleCopy.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }
    componentDidMount () {
        this.mounted = true;
        document.addEventListener('keydown', this.handleKeyDown);
        this.openFromSettings = () => this.setState({open: true, copied: false});
        window.addEventListener('bw-open-about', this.openFromSettings);
        if (this.state.open) this.loadGroups();
    }
    componentWillUnmount () {
        this.mounted = false;
        document.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('bw-open-about', this.openFromSettings);
    }
    componentDidUpdate (previousProps, previousState) {
        if (this.state.open && !previousState.open) this.loadGroups();
    }
    loadGroups () {
        if (this.state.groups || this.loadingGroups) return;
        this.loadingGroups = true;
        this.setState({groupsError: false});
        import(/* webpackChunkName: "about-credits" */ './about-data.js')
            .then(({default: groups}) => {
                if (this.mounted) this.setState({groups});
            })
            .catch(() => {
                if (this.mounted) this.setState({groupsError: true});
            })
            .finally(() => { this.loadingGroups = false; });
    }
    handleKeyDown (event) {
        if (event.key === 'Escape' && this.state.open) this.handleClose();
    }
    handleToggle () {
        const opening = !this.state.open;
        this.setState({open: opening, copied: false});
        if (opening && !this.state.toolchain) {
            fetch(COMPILER_HEALTH_URL, {cache: 'no-store'})
                .then(r => r.json())
                .then(info => this.setState({toolchain: info}))
                .catch(() => this.setState({toolchain: {ok: false}}));
        }
    }
    handleClose () {
        this.setState({open: false});
    }
    handleCopy () {
        const text = `Brickwright ${VERSION}${BUILD_TIME ? ` (built ${BUILD_TIME})` : ''}` +
            ` [${POLICY_RECEIPT}]\n` +
            `${navigator.userAgent}`;
        const done = () => this.setState({copied: true});
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, () => {});
        }
    }
    render () {
        const {locale} = this.props;
        const t = key => tx(locale, key);
        const known = VERSION !== 'unknown';
        const buildTime = formatBuildTime(BUILD_TIME);

        return (
            <React.Fragment>
                {this.props.hideTrigger ? null : (
                    <button
                        className={styles.trigger}
                        title={`${t('about')} — ${VERSION}`}
                        type="button"
                        onClick={this.handleToggle}
                    >
                        {VERSION}
                    </button>
                )}
                {this.state.open ? (
                    <div
                        className={styles.backdrop}
                        onClick={this.handleClose}
                    >
                        <div
                            className={styles.dialog}
                            onClick={event => event.stopPropagation()}
                        >
                            <div className={styles.title}>{t('about')}</div>
                            <p className={styles.blurb}>{t('blurb')}</p>

                            <dl className={styles.details}>
                                <dt>{t('version')}</dt>
                                <dd className={styles.mono}>{VERSION}</dd>
                                {buildTime ? [
                                    <dt key="built-label">{t('built')}</dt>,
                                    <dd key="built-value">{buildTime}</dd>
                                ] : null}
                                <dt>{t('remoteExtensions')}</dt>
                                <dd
                                    className={styles.mono}
                                    data-testid="about-remote-code-policy"
                                >
                                    {POLICY.extensions === 'allow' ? t('policyAllow') : t('policyDeny')}
                                    {` (${POLICY.extensions})`}
                                </dd>
                                <dt>{t('remoteToolchains')}</dt>
                                <dd className={styles.mono} data-testid="about-toolchain-policy">
                                    {POLICY.toolchains === 'allow' ? t('policyAllow') : t('policyDeny')}
                                    {` (${POLICY.toolchains})`}
                                </dd>
                                <dt>{t('remoteMachineImages')}</dt>
                                <dd className={styles.mono} data-testid="about-machine-image-policy">
                                    {POLICY.machineImages === 'allow' ? t('policyAllow') : t('policyDeny')}
                                    {` (${POLICY.machineImages})`}
                                </dd>
                                <dt>{t('remoteParts')}</dt>
                                <dd className={styles.mono} data-testid="about-parts-policy">
                                    {POLICY.parts === 'allow' ? t('policyAllow') : t('policyDeny')}
                                    {` (${POLICY.parts})`}
                                </dd>
                            </dl>

                            {known ? null :
                                <p className={styles.warning}>{t('unknownVersion')}</p>}

                            <div className={styles.section}>
                                <div className={styles.heading}>{t('apps')}</div>
                                <EditorErrorBoundary name={t('apps')}>
                                    <React.Suspense fallback={<p role="status">{t('appsLoading')}</p>}>
                                        <AppShowcase locale={locale} />
                                    </React.Suspense>
                                </EditorErrorBoundary>
                            </div>

                            <div className={styles.section}>
                                <div className={styles.heading}>{t('provider')}</div>
                                <address className={styles.address}>
                                    <strong>{PROVIDER.name}</strong><br />
                                    {PROVIDER.address.map(line => [line, <br key={line} />])}
                                </address>
                                <div className={styles.heading}>{t('contact')}</div>
                                <p className={styles.body}>
                                    {t('email')}: <a href={`mailto:${PROVIDER.email}`}>{PROVIDER.email}</a><br />
                                    {t('phone')}: <a href={`tel:${PROVIDER.phone.replace(/[^+0-9]/g, '')}`}>{PROVIDER.phone}</a>
                                </p>
                                <div className={styles.heading}>{t('privacy')}</div>
                                <p className={styles.body}>{t('privacyText')}</p>
                                <div className={styles.heading}>{t('disclaimer')}</div>
                                <p className={styles.body}>{t('disclaimerText')}</p>

                                <div className={styles.heading}>{t('components')}</div>
                                <p className={styles.body}>{t('licenseNote')}</p>
                                <div className={styles.groupList} data-testid="about-licence-groups">
                                    {this.state.groups ? this.state.groups.map(group => (
                                        <LicenceGroup
                                            key={group.title}
                                            group={group}
                                            locale={locale}
                                        />
                                    )) : this.state.groupsError ? (
                                        <button type="button" onClick={() => this.loadGroups()}>{t('creditsRetry')}</button>
                                    ) : <p role="status">{t('creditsLoading')}</p>}
                                </div>

                                {/* Named IN the app, not only behind a link: these ship inside
                                    the binary, and the link needs a network and a browser. */}
                                <div className={styles.heading}>{t('thanks')}</div>
                                <p className={styles.body}>{t('thanksText')}</p>
                                <p className={styles.body}>
                                    {t('thanksTexts')}{' '}
                                    {BUNDLED_LICENCES.map(([label, href], i) => (
                                        <span key={href}>
                                            {i > 0 ? ' · ' : ''}
                                            <a href={href} rel="noopener noreferrer" target="_blank">{label}</a>
                                        </span>
                                    ))}
                                </p>
                                <p className={styles.body}>
                                    <a href={NOTICES_URL} rel="noopener noreferrer" target="_blank">{t('notices')}</a>
                                </p>
                                <div className={styles.heading}>{t('toolchain')}</div>
                                <p className={classNames(styles.body, styles.mono)}>
                                    {this.state.toolchain === null ? t('toolchainLoading') :
                                        this.state.toolchain.ok === false ? t('toolchainDown') : [
                                            this.state.toolchain.version ?
                                                `service ${this.state.toolchain.version}` : null,
                                            this.state.toolchain.sdcc || null,
                                            this.state.toolchain.avr_gcc || null
                                        ].filter(Boolean).join(' \u00b7 ')}
                                </p>
                                <div className={styles.heading}>{t('affil')}</div>
                                <p className={styles.body}>{t('affilText')}</p>
                            </div>

                            <div className={styles.links}>
                                <a
                                    href={REPO_URL}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                >{t('source')}</a>
                                {known ? (
                                    <a
                                        href={`${REPO_URL}/commit/${VERSION}`}
                                        rel="noopener noreferrer"
                                        target="_blank"
                                    >{t('commit')}</a>
                                ) : null}
                            </div>

                            <div className={styles.actions}>
                                <button
                                    className={classNames(styles.button, styles.buttonSecondary)}
                                    type="button"
                                    onClick={this.handleCopy}
                                >
                                    {this.state.copied ? t('copied') : t('copy')}
                                </button>
                                <button
                                    className={styles.button}
                                    type="button"
                                    onClick={this.handleClose}
                                >
                                    {t('close')}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}
            </React.Fragment>
        );
    }
}

BwAbout.propTypes = {
    locale: PropTypes.string,
    hideTrigger: PropTypes.bool,
    initiallyOpen: PropTypes.bool
};

const mapStateToProps = state => ({
    locale: state.locales && state.locales.locale
});

export default connect(mapStateToProps)(BwAbout);
