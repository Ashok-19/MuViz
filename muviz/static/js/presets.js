/* ═══════════════════════════════════════════════
   PRESETS — MuViz
   Curated audioMotion-analyzer presets
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
];

// Curated Milkdrop preset names (standout ones from the ~200 available)
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
];

window.SPECTRUM_PRESETS = SPECTRUM_PRESETS;
window.MILKDROP_FAVORITES = MILKDROP_FAVORITES;
