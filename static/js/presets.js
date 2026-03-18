/* ═══════════════════════════════════════════════
   PRESETS — MuViz
    Curated visual presets + Milkdrop quality scoring
   ═══════════════════════════════════════════════ */

const SPECTRUM_PRESETS = [
    {
        name: 'Midnight Bars',
        mode: 0, gradient: 'orangered', ledBars: false, lumiBars: false,
        radial: false, mirror: 0, reflexRatio: 0.35, barSpace: 0.15,
        fillAlpha: 0.2, lineWidth: 2, splitLayout: false,
    },
    {
        name: 'Neon LED',
        mode: 0, gradient: 'neon', ledBars: true, lumiBars: false,
        radial: false, mirror: 0, reflexRatio: 0.3, barSpace: 0.3,
        fillAlpha: 0.2, lineWidth: 2, splitLayout: false,
    },
    {
        name: 'Luminance',
        mode: 0, gradient: 'prism', ledBars: false, lumiBars: true,
        radial: false, mirror: 0, reflexRatio: 0.4, barSpace: 0.1,
        fillAlpha: 0.2, lineWidth: 2, splitLayout: false,
    },
    {
        name: 'Radial Rainbow',
        mode: 0, gradient: 'rainbow', ledBars: false, lumiBars: false,
        radial: true, mirror: 0, reflexRatio: 0, barSpace: 0.1,
        fillAlpha: 0.2, lineWidth: 2, splitLayout: false,
    },
    {
        name: 'Radial LED',
        mode: 0, gradient: 'orangered', ledBars: true, lumiBars: false,
        radial: true, mirror: 0, reflexRatio: 0, barSpace: 0.2,
        fillAlpha: 0.2, lineWidth: 2, splitLayout: false,
    },
    {
        name: 'Mirror Wave',
        mode: 1, gradient: 'steelblue', ledBars: false, lumiBars: false,
        radial: false, mirror: -1, reflexRatio: 0.35, barSpace: 0.1,
        fillAlpha: 0.3, lineWidth: 2.5, splitLayout: false,
    },
    {
        name: 'Dual Channel',
        mode: 0, gradient: 'sunset', ledBars: false, lumiBars: false,
        radial: false, mirror: 0, reflexRatio: 0.3, barSpace: 0.15,
        fillAlpha: 0.2, lineWidth: 2, splitLayout: true,
    },
    {
        name: 'Area Fill',
        mode: 2, gradient: 'cyberpunk', ledBars: false, lumiBars: false,
        radial: false, mirror: -1, reflexRatio: 0.3, barSpace: 0.1,
        fillAlpha: 0.6, lineWidth: 2, splitLayout: false,
    },
    {
        name: 'Octave Classic',
        mode: 10, gradient: 'classic', ledBars: false, lumiBars: false,
        radial: false, mirror: 0, reflexRatio: 0.35, barSpace: 0.15,
        fillAlpha: 0.2, lineWidth: 2, splitLayout: false,
    },
    {
        name: 'Octave Neon',
        mode: 10, gradient: 'neon', ledBars: true, lumiBars: false,
        radial: false, mirror: 0, reflexRatio: 0.3, barSpace: 0.25,
        fillAlpha: 0.2, lineWidth: 2, splitLayout: false,
    },
    {
        name: 'Aurora Slice',
        mode: 2, gradient: 'prism', ledBars: false, lumiBars: false,
        radial: true, mirror: 0, reflexRatio: 0.0, barSpace: 0.08,
        fillAlpha: 0.55, lineWidth: 1.5, splitLayout: false,
    },
    {
        name: 'Steel Tunnel',
        mode: 1, gradient: 'steelblue', ledBars: false, lumiBars: false,
        radial: true, mirror: -1, reflexRatio: 0.0, barSpace: 0.12,
        fillAlpha: 0.25, lineWidth: 3.0, splitLayout: false,
    },
    {
        name: 'Pulse Radar',
        mode: 10, gradient: 'rainbow', ledBars: false, lumiBars: true,
        radial: true, mirror: 0, reflexRatio: 0.0, barSpace: 0.2,
        fillAlpha: 0.2, lineWidth: 2.0, splitLayout: false,
    },
    {
        name: 'Cinema Split',
        mode: 2, gradient: 'sunset', ledBars: false, lumiBars: false,
        radial: false, mirror: 0, reflexRatio: 0.2, barSpace: 0.12,
        fillAlpha: 0.5, lineWidth: 1.5, splitLayout: true,
    },
    {
        name: 'Hard Neon Stack',
        mode: 0, gradient: 'cyberpunk', ledBars: true, lumiBars: true,
        radial: false, mirror: 0, reflexRatio: 0.15, barSpace: 0.33,
        fillAlpha: 0.15, lineWidth: 2.0, splitLayout: false,
    },
    {
        name: 'Glass Wave',
        mode: 1, gradient: 'classic', ledBars: false, lumiBars: false,
        radial: false, mirror: 1, reflexRatio: 0.45, barSpace: 0.1,
        fillAlpha: 0.35, lineWidth: 2.5, splitLayout: false,
    },
    {
        name: 'Fireline Octave',
        mode: 10, gradient: 'orangered', ledBars: true, lumiBars: false,
        radial: false, mirror: 0, reflexRatio: 0.25, barSpace: 0.24,
        fillAlpha: 0.2, lineWidth: 2.0, splitLayout: false,
    },
    {
        name: 'Dual Prism Orbit',
        mode: 0, gradient: 'prism', ledBars: false, lumiBars: true,
        radial: true, mirror: 0, reflexRatio: 0.0, barSpace: 0.16,
        fillAlpha: 0.18, lineWidth: 2.0, splitLayout: true,
    },
    {
        name: 'Retro Analyzer',
        mode: 0, gradient: 'classic', ledBars: true, lumiBars: false,
        radial: false, mirror: 0, reflexRatio: 0.4, barSpace: 0.22,
        fillAlpha: 0.2, lineWidth: 2.0, splitLayout: false,
    },
];

// Curated Milkdrop favorites (standout presets known in butterchurn packs).
const MILKDROP_FAVORITES = [
    'Flexi, martin + geiss - dedicated to the sherwin maxawow',
    'martin - castle in the air',
    'Zylot - Butterfly Wing (Textured Triangle Mix)',
    'Rovastar - Fractopia (Upside Down Mix)',
    'Eo.S. + Phat - cubetrace - vass',
    'flexi - what is the matrix',
    'Geiss - Cosmic Dust 2 - Gravity',
    'Rovastar + Loadus + Geiss - Fractopia vs Jugular vs Cosmic Dust',
    'martin - disco mix 3',
    'Phat_Eo.S._Geiss - Kalideostars',
    'Rovastar - Chapel Of Ghouls',
    'Aderrasi - Antique Abyss',
    'Eo.S. - skylight a1',
    'Rovastar and Geiss - Dynamic Swirls 3',
    'Unchained - Subjective Experience Of The Manifold',
    'martin + geiss - airflow',
    'Rovastar - The Chaos Of Colours',
    'Phat - Fractal Splicer',
    'Aderrasi - Protozoa',
    'Rovastar - Altars Of Madness',
    'Zylot - Psyonik',
    'Eo.S. - Silk Strings',
    'Rovastar - Twilight Tunnel',
    'martin - pressure cooker',
    'Krash and Rovastar - Hyperbolic Time Chamber',
    'Che - Escape',
    'Fvese - ZoomPulse',
    'Rovastar - Time Machine',
    'A05 and Geiss - Cyclone',
    'Unchained - Colliding Geometry',
];

const MILKDROP_QUALITY_PROFILES = {
    ultra: {
        id: 'ultra',
        label: 'Ultra',
        minScore: 82,
        description: 'Only the strongest cinematic or complex presets.',
    },
    high: {
        id: 'high',
        label: 'High',
        minScore: 68,
        description: 'High quality default for day-to-day playback.',
    },
    balanced: {
        id: 'balanced',
        label: 'Balanced',
        minScore: 52,
        description: 'More variety while filtering obvious low-quality entries.',
    },
    all: {
        id: 'all',
        label: 'All',
        minScore: 0,
        description: 'Every available preset.',
    },
};

const MILKDROP_DEFAULT_QUALITY_PROFILE = 'high';

const MILKDROP_POSITIVE_RULES = [
    { regex: /(rovastar|martin|geiss|phat|eo\.s|e\.o\.s|zylot|aderrasi|krash|flexi|unchained|a05|che|fvese)/i, score: 18, tag: 'artist' },
    { regex: /(fractal|fractopia|hyper|kaleido|cathedral|castle|matrix|cosmic|galaxy|mandala|nebula|spiral|dream|dystopia|tunnel)/i, score: 14, tag: 'cinematic' },
    { regex: /(shader|mesh|warp|texture|textured|wave|chaos|swirl|geometry|3d|dynamic|plasma|pulse)/i, score: 11, tag: 'complex' },
    { regex: /([+]|\bvs\b|mix|mashup|double)/i, score: 8, tag: 'mashup' },
];

const MILKDROP_NEGATIVE_RULES = [
    { regex: /(test|debug|blank|default|sample|prototype|wip|old)/i, score: -24, tag: 'low-signal' },
    { regex: /(simple|basic|minimal)/i, score: -14, tag: 'simple' },
    { regex: /(lowres|legacy)/i, score: -10, tag: 'legacy' },
];

function clampScore(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function scoreMilkdropPresetName(name, favoriteLookup) {
    const normalized = String(name || '').trim();
    const tags = [];
    let score = 44;

    if (favoriteLookup.has(normalized)) {
        score += 28;
        tags.push('favorite');
    }

    MILKDROP_POSITIVE_RULES.forEach(rule => {
        if (rule.regex.test(normalized)) {
            score += rule.score;
            tags.push(rule.tag);
        }
    });

    MILKDROP_NEGATIVE_RULES.forEach(rule => {
        if (rule.regex.test(normalized)) {
            score += rule.score;
            tags.push(rule.tag);
        }
    });

    if (normalized.length > 32) {
        score += 4;
        tags.push('detailed');
    }
    if (/[()\[\]]/.test(normalized)) {
        score += 3;
    }

    return {
        score: clampScore(score, 0, 100),
        tags,
    };
}

function buildMilkdropCatalog(presetNames, favorites = MILKDROP_FAVORITES) {
    const favoriteLookup = new Set((favorites || []).map(name => String(name).trim()));
    return (presetNames || []).map((name, index) => {
        const quality = scoreMilkdropPresetName(name, favoriteLookup);
        return {
            name,
            index,
            score: quality.score,
            tags: quality.tags,
            isFavorite: favoriteLookup.has(String(name).trim()),
        };
    });
}

function getMilkdropQualityProfile(profileId) {
    if (profileId && MILKDROP_QUALITY_PROFILES[profileId]) {
        return MILKDROP_QUALITY_PROFILES[profileId];
    }
    return MILKDROP_QUALITY_PROFILES[MILKDROP_DEFAULT_QUALITY_PROFILE];
}

window.SPECTRUM_PRESETS = SPECTRUM_PRESETS;
window.MILKDROP_FAVORITES = MILKDROP_FAVORITES;
window.MILKDROP_QUALITY_PROFILES = MILKDROP_QUALITY_PROFILES;
window.MILKDROP_DEFAULT_QUALITY_PROFILE = MILKDROP_DEFAULT_QUALITY_PROFILE;
window.buildMilkdropCatalog = buildMilkdropCatalog;
window.getMilkdropQualityProfile = getMilkdropQualityProfile;
