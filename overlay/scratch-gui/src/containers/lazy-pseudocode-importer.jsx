import PropTypes from 'prop-types';
import React from 'react';
import {hardReload} from '../lib/hard-reload.js';

let importerRequest = null;
const loadPseudocodeImporter = () => {
    if (!importerRequest) {
        importerRequest = import(
            /* webpackChunkName: "pseudocode-importer" */ '../components/tw-pseudocode/pseudocode-importer.jsx'
        ).then(module => {
            // React.lazy needs a component as the default export. Without one
            // React only reports minified error #306 ("undefined"), which names
            // neither the chunk nor the cause; a deploy that replaced the chunk
            // under an open page is the usual reason.
            const component = module && module.default;
            if (typeof component !== 'function' && !(component && typeof component === 'object')) {
                const error = new Error('The "pseudocode-importer" chunk loaded without a default ' +
                    'export, so this page and the deployed build no longer match.');
                error.bwStaleBuild = true;
                throw error;
            }
            return module;
        }).catch(error => {
            importerRequest = null;
            throw error;
        });
    }
    return importerRequest;
};

// Intent prewarming uses the same cached request as selection. Swallow the
// speculative rejection here: the rendered error boundary owns the visible
// failure and retry once the tab is actually selected.
export const preloadPseudocodeImporter = () => loadPseudocodeImporter().catch(() => null);
const createLazyImporter = () => React.lazy(loadPseudocodeImporter);

// Failures a Retry cannot fix, because the open page and the deployed chunks
// come from different builds; only a reload fetches a matching set.
export const isStaleBuildError = error => Boolean(error) && (error.bwStaleBuild === true ||
    error.name === 'ChunkLoadError' ||
    /Loading (CSS )?chunk|dynamically imported module|Minified React error #306|Element type is invalid/
        .test(String(error.message || error)));

// The innermost component named in React's component stack, so a nested
// lazy child that resolved to undefined is identified too.
export const failingComponentOf = componentStack => {
    const match = /^\s*(?:in|at) ([A-Za-z_$][\w$.]*)/m.exec(componentStack || '');
    return match ? match[1] : null;
};

class LazyPseudocodeImporter extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            activated: props.isVisible,
            componentStack: null,
            error: null,
            generation: 0,
            importerReady: false,
            pendingBundleDetail: null
        };
        this.importerReady = false;
        this.pendingPseudocodeDetail = null;
        this.pendingReadBlocks = false;
        this.Importer = createLazyImporter();
    }
    static getDerivedStateFromError (error) {
        return {error};
    }
    componentDidCatch (error, info) {
        this.pendingPseudocodeDetail?.onComplete?.({ok: false, message: error.message});
        const componentStack = (info && info.componentStack) || null;
        this.setState({componentStack});
        // eslint-disable-next-line no-console
        console.error('[code editor]', error, componentStack || '');
    }
    componentDidMount () {
        window.addEventListener('bw-project-bundle-loaded', this.handleBundleLoaded);
        window.addEventListener('bw-load-pseudocode', this.handleLoadPseudocode);
        window.addEventListener('bw-read-blocks-into-code', this.handleReadBlocks);
        this.bindRuntime(this.props.vm);
    }
    componentDidUpdate (previousProps) {
        if (this.props.isVisible && !this.state.activated) this.setState({activated: true});
        if (previousProps.vm !== this.props.vm) {
            this.unbindRuntime(previousProps.vm);
            this.bindRuntime(this.props.vm);
        }
    }
    componentWillUnmount () {
        this.pendingPseudocodeDetail?.onComplete?.({ok: false, message: 'Code editor closed.'});
        this.pendingPseudocodeDetail = null;
        window.removeEventListener('bw-project-bundle-loaded', this.handleBundleLoaded);
        window.removeEventListener('bw-load-pseudocode', this.handleLoadPseudocode);
        window.removeEventListener('bw-read-blocks-into-code', this.handleReadBlocks);
        this.unbindRuntime(this.props.vm);
    }
    bindRuntime (vm) {
        if (vm?.runtime?.on) vm.runtime.on('PROJECT_CHANGED', this.handleProjectChanged);
    }
    unbindRuntime (vm) {
        if (vm?.runtime?.removeListener) vm.runtime.removeListener('PROJECT_CHANGED', this.handleProjectChanged);
    }
    handleProjectChanged = () => {
        // Ordinary Scratch startup emits PROJECT_CHANGED. Only a source parked
        // by the Circuit example handoff needs the Code component while hidden.
        if (!this.state.activated && this.props.vm?.runtime?.bwPseudocodeSource) {
            this.setState({activated: true});
        }
    };
    handleBundleLoaded = event => {
        if (!this.state.importerReady) {
            this.setState({activated: true, pendingBundleDetail: event?.detail || {}});
        }
    };
    handlePendingBundleHandled = () => this.setState({pendingBundleDetail: null});
    handleLoadPseudocode = event => {
        // Robot Lab can be opened before Code. Keep the latest explicit example
        // selection while its editor chunk loads; ordinary startup stays lazy.
        if (this.importerReady || typeof event?.detail?.code !== 'string') return;
        this.pendingPseudocodeDetail?.onComplete?.({ok: false, message: 'A newer example was selected.'});
        this.pendingPseudocodeDetail = event.detail;
        this.setState({activated: true});
    };
    handleReadBlocks = () => {
        if (this.importerReady) return;
        this.pendingReadBlocks = true;
        this.setState({activated: true});
    };
    handleImporterReady = () => {
        // The child has installed its event listener before calling onReady.
        // Mark readiness synchronously so replay is handled only by that child.
        this.importerReady = true;
        this.setState({importerReady: true});
        const detail = this.pendingPseudocodeDetail;
        this.pendingPseudocodeDetail = null;
        if (detail) window.dispatchEvent(new CustomEvent('bw-load-pseudocode', {detail}));
        if (this.pendingReadBlocks) {
            this.pendingReadBlocks = false;
            window.dispatchEvent(new CustomEvent('bw-read-blocks-into-code'));
        }
    };
    handleRetry = () => {
        this.importerReady = false;
        this.Importer = createLazyImporter();
        this.setState(state => ({componentStack: null, error: null, generation: state.generation + 1, importerReady: false}));
    };
    // A plain reload is not enough: the service worker can hand back the same
    // stale chunk. hardReload clears caches and the worker first.
    handleReload = () => hardReload();
    render () {
        if (!this.state.activated) return null;
        if (this.state.error) {
            const {componentStack, error} = this.state;
            const stale = isStaleBuildError(error);
            const component = failingComponentOf(componentStack);
            return (
                <div
                    data-pseudocode-importer-load-error
                    data-stale-build={stale ? 'true' : 'false'}
                    role="alert"
                    style={{padding: 16}}
                >
                    <p>{String(error.message || error)}</p>
                    {component ? <p data-pseudocode-importer-failing-component>In: {component}</p> : null}
                    {stale ? (
                        <p>The code editor was updated since this page opened. Reload to fetch the matching version.</p>
                    ) : null}
                    {stale ? <button type="button" onClick={this.handleReload}>Reload page</button> : null}
                    <button type="button" onClick={this.handleRetry}>Retry code editor</button>
                    {componentStack || error.stack ? (
                        <details>
                            <summary>Details</summary>
                            <pre style={{whiteSpace: 'pre-wrap', fontSize: 11}}>
                                {[error.stack, componentStack].filter(Boolean).join('\n')}
                            </pre>
                        </details>
                    ) : null}
                </div>
            );
        }
        const Importer = this.Importer;
        return (
            <React.Suspense fallback={
                <div data-pseudocode-importer-loading aria-busy="true" style={{padding: 16}}>
                    Loading code editor…
                </div>
            }>
                <Importer
                    key={this.state.generation}
                    isVisible={this.props.isVisible}
                    onCp1CodeSlot={this.props.onCp1CodeSlot}
                    onCardiacCodeSlot={this.props.onCardiacCodeSlot}
                    onCardiacToolsSlot={this.props.onCardiacToolsSlot}
                    pendingBundleDetail={this.state.pendingBundleDetail}
                    onPendingBundleHandled={this.handlePendingBundleHandled}
                    onReady={this.handleImporterReady}
                />
            </React.Suspense>
        );
    }
}

LazyPseudocodeImporter.propTypes = {
    onCp1CodeSlot: PropTypes.func,
    onCardiacCodeSlot: PropTypes.func,
    onCardiacToolsSlot: PropTypes.func,
    isVisible: PropTypes.bool,
    vm: PropTypes.shape({runtime: PropTypes.shape({
        on: PropTypes.func,
        removeListener: PropTypes.func,
        bwPseudocodeSource: PropTypes.string
    })}).isRequired
};

LazyPseudocodeImporter.defaultProps = {
    isVisible: false
};

export default LazyPseudocodeImporter;
