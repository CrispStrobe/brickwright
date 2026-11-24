// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
export const EXAMPLE_TOPICS = Object.freeze({
    linkages: {en: 'Linkages & motion conversion', de: 'Gestänge und Bewegungswandlung'},
    motion: {en: 'Motion & traction', de: 'Bewegung & Haftung'},
    sensing: {en: 'Sensors & feedback', de: 'Sensoren & Regelung'},
    forces: {en: 'Forces & gravity', de: 'Kräfte & Schwerkraft'},
    gears: {en: 'Gears & clutches', de: 'Zahnräder & Kupplungen'},
    chains: {en: 'Chain transmission', de: 'Kettenantrieb'},
    inertia: {en: 'Rotational inertia', de: 'Rotationsträgheit'},
    fluids: {en: 'Air pressure', de: 'Luftdruck'}
});

// Fold accents and punctuation so classical names survive spelling and dash variants.
export const normalizeExampleSearch = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// Curated simulation checks do not change the experimental builder contract.
export const visibleExampleModels = (models, includeExperimental = false) =>
    models.filter(entry => !entry.experimental || entry.simulationChecked === true || includeExperimental);

/** Pure filtering for the model gallery. Metadata stays separate from the model registry. */
export const filterModelExamples = (models, details, {query = '', topic = '', size = '', locale = 'en'} = {}) => {
    const terms = normalizeExampleSearch(query).split(/\s+/).filter(Boolean);
    return models.filter(entry => {
        const key = entry.id || entry.file;
        const d = details[key];
        if (!d || (topic && d.topic !== topic)) return false;
        if (size === 'large' && d.pieces <= 50) return false;
        if (size === 'small' && d.pieces > 50) return false;
        if (!terms.length) return true;
        const words = [entry.title[locale] || entry.title.en, d.description[locale] || d.description.en,
            EXAMPLE_TOPICS[d.topic]?.[locale], ...d.hubs, d.author, key, ...Object.values(d.mechanism || {}), ...(d.keywords || [])].join(' ');
        const searchable = normalizeExampleSearch(words);
        return terms.every(term => searchable.includes(term));
    });
};
