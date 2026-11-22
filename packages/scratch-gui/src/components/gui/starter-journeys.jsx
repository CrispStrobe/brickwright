import PropTypes from 'prop-types';
import React from 'react';

import journeys from './starter-journeys.json';
import styles from './starter-journeys.css';

const COPY = {
    en: {
        eyebrow: 'Welcome to Brickwright',
        heading: 'What would you like to make?',
        intro: 'Build circuits. Program machines. See how they work.',
        detail: 'Choose a working starter project. You can change everything and open this screen again from Settings.',
        close: 'Not now',
        closeLabel: 'Close getting started',
        loading: 'Opening starter…',
        cancelled: 'Your project was not changed.',
        trademarks: 'LEGO®, SPIKE™ and Technic™ are trademarks of the LEGO Group, which does not ' +
            'sponsor, authorize or endorse Brickwright.'
    },
    de: {
        eyebrow: 'Willkommen bei Brickwright',
        heading: 'Was möchtest du machen?',
        intro: 'Baue Schaltungen. Programmiere Maschinen. Verstehe, wie sie funktionieren.',
        detail: 'Wähle ein fertiges Startprojekt. Du kannst alles verändern und diesen Dialog später ' +
            'in den Einstellungen erneut öffnen.',
        close: 'Nicht jetzt',
        closeLabel: 'Erste Schritte schließen',
        loading: 'Startprojekt wird geöffnet…',
        cancelled: 'Dein Projekt wurde nicht verändert.',
        trademarks: 'LEGO®, SPIKE™ und Technic™ sind Marken der LEGO Gruppe, die Brickwright weder ' +
            'unterstützt noch autorisiert oder empfiehlt.'
    }
};

/** Cards whose surface this build or browser lacks are left out (the CAD card needs a CAD build). */
export const availableJourneys = ({cadAvailable = false} = {}) =>
    journeys.filter(journey => journey.requires !== 'cad' || cadAvailable);

const localeKey = locale => (/^de/i.test(locale || '') ? 'de' : 'en');

const JourneyCard = ({busy, journey, lang, onChoose}) => {
    const card = journey.copy[lang] || journey.copy.en;
    const handleChoose = () => onChoose(journey);
    return (
        <button
            className={styles.card}
            data-starter-id={journey.id}
            disabled={busy}
            type="button"
            onClick={handleChoose}
        >
            <span
                aria-hidden="true"
                className={styles.icon}
            >{journey.icon}</span>
            <span className={styles.cardTitle}>{card.title}</span>
            <span className={styles.cardDescription}>{card.description}</span>
            <span className={styles.meta}>{card.meta}</span>
            <span
                aria-hidden="true"
                className={styles.arrow}
            >{'→'}</span>
        </button>
    );
};

JourneyCard.propTypes = {
    busy: PropTypes.bool,
    journey: PropTypes.shape({
        copy: PropTypes.objectOf(PropTypes.object).isRequired,
        icon: PropTypes.string.isRequired,
        id: PropTypes.string.isRequired
    }).isRequired,
    lang: PropTypes.string.isRequired,
    onChoose: PropTypes.func.isRequired
};

const StarterJourneys = ({busy, cadAvailable, error, locale, onChoose, onClose}) => {
    const dialogRef = React.useRef(null);
    const lang = localeKey(locale);
    const text = COPY[lang];

    React.useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return () => {};
        const focusable = () => Array.from(dialog.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), ' +
            'select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ));
        const first = focusable()[0];
        if (first) first.focus();
        const handleKey = event => {
            if (event.key === 'Escape' && !busy) {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== 'Tab') return;
            const items = focusable();
            if (!items.length) return;
            const firstItem = items[0];
            const lastItem = items[items.length - 1];
            if (event.shiftKey && document.activeElement === firstItem) {
                event.preventDefault();
                lastItem.focus();
            } else if (!event.shiftKey && document.activeElement === lastItem) {
                event.preventDefault();
                firstItem.focus();
            }
        };
        dialog.addEventListener('keydown', handleKey);
        return () => dialog.removeEventListener('keydown', handleKey);
    }, [busy, onClose]);

    return (
        <div
            className={styles.backdrop}
            data-testid="bw-starter-backdrop"
        >
            <section
                aria-describedby="bw-starter-detail"
                aria-labelledby="bw-starter-heading"
                aria-modal="true"
                className={styles.dialog}
                ref={dialogRef}
                role="dialog"
                data-testid="bw-starter-dialog"
            >
                <button
                    aria-label={text.closeLabel}
                    className={styles.close}
                    disabled={busy}
                    type="button"
                    onClick={onClose}
                >{'×'}</button>
                <div className={styles.eyebrow}>{text.eyebrow}</div>
                <h1
                    className={styles.heading}
                    id="bw-starter-heading"
                >{text.heading}</h1>
                <p className={styles.promise}>{text.intro}</p>
                <p id="bw-starter-detail" className={styles.detail}>{text.detail}</p>
                <div className={styles.cards}>
                    {availableJourneys({cadAvailable}).map(journey => (
                        <JourneyCard
                            busy={busy}
                            journey={journey}
                            key={journey.id}
                            lang={lang}
                            onChoose={onChoose}
                        />
                    ))}
                </div>
                <div
                    aria-live="polite"
                    className={styles.footer}
                >
                    <button
                        className={styles.later}
                        disabled={busy}
                        type="button"
                        onClick={onClose}
                    >
                        {text.close}
                    </button>
                    <span className={error ? styles.error : styles.progress}>
                        {busy ? text.loading : (error === 'cancelled' ? text.cancelled : error)}
                    </span>
                </div>
                <p className={styles.trademarks}>{text.trademarks}</p>
            </section>
        </div>
    );
};

StarterJourneys.propTypes = {
    busy: PropTypes.bool,
    cadAvailable: PropTypes.bool,
    error: PropTypes.string,
    locale: PropTypes.string,
    onChoose: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired
};

export default StarterJourneys;
