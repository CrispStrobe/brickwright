// Load tab measurement after mounting; keep layout bookkeeping out of initial JavaScript.
class TabLabelFit {
    constructor (isCompact, tabList) {
        this.isCompact = isCompact;
        this.tabList = tabList;
        this.fitFrame = null;
        this.scheduleFit = () => {
            if (this.fitFrame !== null) return;
            this.fitFrame = requestAnimationFrame(() => {
                this.fitFrame = null;
                this.fitLabels();
            });
        };
        this.mount();
    }

    mount () {
        if (!this.tabList) return;
        this.canvas = document.createElement('canvas');
        this.menu = document.querySelector('[class*="menu-bar_main-menu"]');
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(this.scheduleFit);
            this.resizeObserver.observe(this.tabList.parentElement);
            this.resizeObserver.observe(document.documentElement);
            if (this.menu) {
                this.resizeObserver.observe(this.menu);
                for (const child of this.menu.children) this.resizeObserver.observe(child);
            }
        }
        this.labelsObserver = new MutationObserver(this.scheduleFit);
        this.labelsObserver.observe(this.tabList, {childList: true, subtree: true, characterData: true});
        window.addEventListener('resize', this.scheduleFit);
        this.scheduleFit();
        if (document.fonts) {
            document.fonts.ready.then(() => {
                if (this.tabList) this.scheduleFit();
            });
        }
    }

    dispose () {
        if (this.resizeObserver) this.resizeObserver.disconnect();
        if (this.labelsObserver) this.labelsObserver.disconnect();
        window.removeEventListener('resize', this.scheduleFit);
        if (this.fitFrame !== null) cancelAnimationFrame(this.fitFrame);
        this.tabList = null;
    }

    fitLabels () {
        const list = this.tabList;
        if (!list) return;
        const context = this.canvas.getContext('2d');
        if (!context) return;
        const touch = document.documentElement.hasAttribute('data-bw-touch');
        const compact = this.isCompact();
        let available = list.parentElement.clientWidth - (compact ? 76 : 36);
        if (touch) {
            const occupied = !compact && this.menu ? Math.max(0, ...Array.from(this.menu.children, child => {
                const rect = child.getBoundingClientRect();
                return rect.width > 0 ? rect.right : 0;
            })) : 0;
            available = compact ? Math.min(window.innerWidth, list.parentElement.clientWidth) - 64 :
                window.innerWidth - occupied - 72;
        }
        const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
        const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
        let required = 0;
        for (const tab of tabs) {
            const label = tab.querySelector('[data-bw-tab-label]');
            if (!label) continue;
            const font = getComputedStyle(label);
            context.font = `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
            const style = getComputedStyle(tab);
            const edges = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth']
                .reduce((sum, key) => sum + (parseFloat(style[key]) || 0), 0);
            const icon = tab.querySelector('[data-bw-tab-icon]');
            const iconWidth = icon ? parseFloat(getComputedStyle(icon).width) || 16 : 0;
            required += Math.max(parseFloat(style.minWidth) || 0,
                Math.ceil(context.measureText(label.textContent).width) + iconWidth +
                (parseFloat(style.columnGap) || 0) + edges) + gap;
        }
        list.style.setProperty('--bw-tab-available', `${Math.max(32, available)}px`);
        list.toggleAttribute('data-bw-tab-icons-only', required > available);
    }

}

export const installTabLabelFit = (isCompact, tabList) => new TabLabelFit(isCompact, tabList);
