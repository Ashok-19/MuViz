/* ═══════════════════════════════════════════════
   VISUALIZER ENGINE — MuViz
   Orchestrates butterchurn (Milkdrop),
   audioMotion-analyzer (Spectrum), and Braccato lyrics
   ═══════════════════════════════════════════════ */

(function () {
    'use strict';

    const audioEl = document.getElementById('audioEl');
    if (!audioEl) return;

    const playerPage = document.getElementById('playerPage');
    const playBtn = document.getElementById('playBtn');
    const seekBar = document.getElementById('seekBar');
    const currentTimeEl = document.getElementById('currentTime');
    const totalTimeEl = document.getElementById('totalTime');
    const volumeSlider = document.getElementById('volumeSlider');
    const muteBtn = document.getElementById('muteBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const hideBarBtn = document.getElementById('hideBarBtn');
    const showBarBtn = document.getElementById('showBarBtn');
    const prevTrackBtn = document.getElementById('prevTrackBtn');
    const nextTrackBtn = document.getElementById('nextTrackBtn');
    const queueStatusEl = document.getElementById('queueStatus');
    const bottomBar = document.getElementById('bottomBar');
    const lyricsOverlay = document.getElementById('lyricsOverlay');
    const lyricsDisplay = document.getElementById('lyricsDisplay');
    const lyricsStatus = document.getElementById('lyricsStatus');
    const lyricsBtn = document.getElementById('lyricsBtn');
    const startupOverlay = document.getElementById('startupOverlay');
    const startupTitle = document.getElementById('startupTitle');
    const startupSubtitle = document.getElementById('startupSubtitle');

    const QUEUE_STORAGE_KEY = 'muviz-play-queue';
    const LYRICS_STATUS_STORAGE_KEY = 'muviz-lyrics-status';

    let startupReady = false;

    let audioCtx = null;
    let sourceNode = null;
    let analysisAnalyser = null;
    let analysisFreqData = null;
    let analysisPrevFreqData = null;

    function ensureAudioPipeline() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            sourceNode = audioCtx.createMediaElementSource(audioEl);
            sourceNode.connect(audioCtx.destination);
        }

        if (!analysisAnalyser && audioCtx && sourceNode) {
            analysisAnalyser = audioCtx.createAnalyser();
            analysisAnalyser.fftSize = 2048;
            analysisAnalyser.smoothingTimeConstant = 0.72;
            analysisAnalyser.minDecibels = -90;
            analysisAnalyser.maxDecibels = -10;
            sourceNode.connect(analysisAnalyser);

            analysisFreqData = new Uint8Array(analysisAnalyser.frequencyBinCount);
            analysisPrevFreqData = new Uint8Array(analysisAnalyser.frequencyBinCount);
        }

        return { audioCtx, sourceNode };
    }

    async function primeAudioPipeline() {
        const { audioCtx: ctx } = ensureAudioPipeline();
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }
        ensureModeVisualizer();
        return ctx;
    }

    const engine = {
        mode: 'milkdrop',
        milkdrop: null,
        mdCanvas: document.getElementById('milkdropCanvas'),
        mdCanvasEventsBound: false,
        mdContextLost: false,
        mdRecovering: false,
        mdRenderErrorStreak: 0,
        mdLastRenderErrorAt: 0,
        mdBadPresetNames: new Set(),
        mdPresets: {},
        mdPresetNames: [],
        mdCatalog: [],
        mdVisiblePresetIndices: [],
        mdCurrentIdx: 0,
        mdInitialPresetChosen: false,
        mdBlendTime: 1.5,
        mdAutoCycle: true,
        mdCycleTime: 5,
        mdQualityProfile: window.MILKDROP_DEFAULT_QUALITY_PROFILE || 'high',
        mdFavoritesOnly: false,
        mdLastFilter: '',
        mdBeatReactive: true,
        mdBeatSensitivity: 1.05,
        mdBeatLastSwitchAt: 0,
        mdBeatSwitchCooldownMs: 1800,
        mdThirdPartyLoading: false,
        mdThirdPartyLoaded: false,
        mdCycleTimer: null,
        mdAnimFrame: null,
        audioMotion: null,
        amContainer: document.getElementById('spectrumContainer'),
        reactive: {
            fluxAvg: 0,
            energyAvg: 0,
            bassAvg: 0,
            lastBeatAt: 0,
        },
    };

    const queue = {
        tracks: [],
        index: -1,
        active: false,
    };

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function safeReadJSON(key, fallback) {
        try {
            const raw = sessionStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : fallback;
        } catch (_) {
            return fallback;
        }
    }

    function safeWriteJSON(key, value) {
        try {
            sessionStorage.setItem(key, JSON.stringify(value));
        } catch (_) {
            // Storage can fail in strict browser modes.
        }
    }

    function initQueue() {
        const stored = safeReadJSON(QUEUE_STORAGE_KEY, {});
        const tracks = Array.isArray(stored.tracks) ? stored.tracks : [];
        const currentId = Number(window.TRACK && window.TRACK.id);
        const index = tracks.findIndex(track => Number(track.id) === currentId);

        if (index < 0 || tracks.length < 2) {
            queue.active = false;
            queue.tracks = tracks;
            queue.index = index;
            return;
        }

        queue.active = true;
        queue.tracks = tracks;
        queue.index = index;
    }

    function updateQueueUI() {
        if (queueStatusEl) {
            if (queue.active) {
                queueStatusEl.textContent = '• Queue ' + (queue.index + 1) + '/' + queue.tracks.length;
            } else {
                queueStatusEl.textContent = '';
            }
        }

        if (prevTrackBtn) {
            const canPrev = queue.active && queue.index > 0;
            prevTrackBtn.disabled = !canPrev;
            prevTrackBtn.classList.toggle('disabled', !canPrev);
        }

        if (nextTrackBtn) {
            const canNext = queue.active && queue.index >= 0 && queue.index < queue.tracks.length - 1;
            nextTrackBtn.disabled = !canNext;
            nextTrackBtn.classList.toggle('disabled', !canNext);
        }
    }

    function navigateQueueTo(index) {
        if (!queue.active || index < 0 || index >= queue.tracks.length) return false;
        const next = queue.tracks[index];
        if (!next || Number(next.id) === Number(window.TRACK.id)) return false;

        window.location.href = '/play/' + next.id + '/';
        return true;
    }

    function goToNextQueueTrack() {
        if (!queue.active) return false;
        return navigateQueueTo(queue.index + 1);
    }

    function goToPrevQueueTrack() {
        if (!queue.active) return false;
        return navigateQueueTo(queue.index - 1);
    }

    function setStartupPhase(title, subtitle) {
        if (startupTitle && title) startupTitle.textContent = title;
        if (startupSubtitle && subtitle) startupSubtitle.textContent = subtitle;
    }

    function setStartupLock(locked) {
        const controls = [
            playBtn,
            prevTrackBtn,
            nextTrackBtn,
            muteBtn,
            fullscreenBtn,
            hideBarBtn,
            showBarBtn,
            lyricsBtn,
            seekBar,
            volumeSlider,
            document.getElementById('panelToggle'),
            document.getElementById('panelClose'),
            document.getElementById('mdPresetSearch'),
            document.getElementById('mdQualityProfile'),
            document.getElementById('mdAutoCycle'),
            document.getElementById('mdFavoritesOnly'),
            document.getElementById('mdBeatReactive'),
            document.getElementById('mdCycleTime'),
            document.getElementById('mdBlendTime'),
            document.getElementById('mdBeatSensitivity'),
        ];

        controls.forEach(control => {
            if (!control) return;
            control.disabled = !!locked;
            control.classList.toggle('disabled', !!locked);
        });

        document.querySelectorAll('.mode-btn, .spectrum-style-btn, .preset-card, .md-preset-item').forEach(el => {
            el.classList.toggle('disabled', !!locked);
            if (locked) {
                el.setAttribute('aria-disabled', 'true');
            } else {
                el.removeAttribute('aria-disabled');
            }
        });
    }

    function hideStartupOverlay() {
        if (!startupOverlay) return;
        startupOverlay.classList.add('hidden');
    }

    function getMilkdropProfile() {
        if (typeof window.getMilkdropQualityProfile === 'function') {
            return window.getMilkdropQualityProfile(engine.mdQualityProfile);
        }
        return { id: 'all', minScore: 0 };
    }

    function rebuildMilkdropCatalog() {
        if (typeof window.buildMilkdropCatalog === 'function') {
            engine.mdCatalog = window.buildMilkdropCatalog(engine.mdPresetNames);
            return;
        }

        engine.mdCatalog = engine.mdPresetNames.map((name, index) => ({
            name,
            index,
            score: 50,
            tags: [],
            isFavorite: false,
        }));
    }

    function asPresetMap(rawPack) {
        if (!rawPack) return null;
        if (typeof rawPack.getPresets === 'function') {
            return rawPack.getPresets();
        }
        if (typeof rawPack === 'object') {
            return rawPack;
        }
        return null;
    }

    function mergePresetPack(target, rawPack, prefix = '') {
        const pack = asPresetMap(rawPack);
        if (!pack || typeof pack !== 'object') return 0;

        let added = 0;
        Object.keys(pack).forEach(name => {
            const finalName = prefix ? prefix + name : name;
            if (!target[finalName]) {
                target[finalName] = pack[name];
                added += 1;
            }
        });

        return added;
    }

    async function fetchJSON(url) {
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ' for ' + url);
        }
        return response.json();
    }

    async function mapWithConcurrency(items, limit, worker) {
        const output = new Array(items.length);
        let cursor = 0;

        async function run() {
            while (cursor < items.length) {
                const index = cursor;
                cursor += 1;
                try {
                    output[index] = await worker(items[index], index);
                } catch (_) {
                    output[index] = null;
                }
            }
        }

        const workers = [];
        const workerCount = Math.max(1, Math.min(limit, items.length));
        for (let i = 0; i < workerCount; i += 1) {
            workers.push(run());
        }

        await Promise.all(workers);
        return output;
    }

    async function loadThirdPartyInternetPresets() {
        if (engine.mdThirdPartyLoading || engine.mdThirdPartyLoaded) return;
        engine.mdThirdPartyLoading = true;

        try {
            const manifest = await fetchJSON('https://unpkg.com/butterchurn-presets-weekly@0.0.4/weeks/presets.json');
            const entries = Object.entries(manifest || {});
            if (!entries.length) return;

            const baseNames = entries.map(([name]) => name);
            let scored = baseNames.map((name, index) => ({ name, score: 50, index }));

            if (typeof window.buildMilkdropCatalog === 'function') {
                scored = window.buildMilkdropCatalog(baseNames).map(entry => ({
                    name: entry.name,
                    score: entry.score,
                }));
            }

            scored.sort((a, b) => b.score - a.score);
            const topSelection = scored.slice(0, 120);
            const selectionMap = new Map(topSelection.map(item => [item.name, item.score]));

            const selectedEntries = entries
                .filter(([name]) => selectionMap.has(name))
                .sort((a, b) => (selectionMap.get(b[0]) || 0) - (selectionMap.get(a[0]) || 0));

            const loaded = await mapWithConcurrency(selectedEntries, 6, async ([name, url]) => {
                const preset = await fetchJSON(url);
                return { name, preset };
            });

            let added = 0;
            loaded.forEach(item => {
                if (!item || !item.preset || typeof item.preset !== 'object') return;
                const finalName = '[Weekly] ' + item.name;
                if (!engine.mdPresets[finalName]) {
                    engine.mdPresets[finalName] = item.preset;
                    added += 1;
                }
            });

            if (added > 0) {
                engine.mdPresetNames = Object.keys(engine.mdPresets).sort((a, b) => a.localeCompare(b));
                rebuildMilkdropCatalog();
                const search = document.getElementById('mdPresetSearch');
                buildMilkdropPresetList(search ? search.value : '');
            }
        } catch (error) {
            console.warn('Unable to load third-party internet presets:', error);
        } finally {
            engine.mdThirdPartyLoading = false;
            engine.mdThirdPartyLoaded = true;
        }
    }

    function getPresetPoolIndices() {
        if (engine.mdVisiblePresetIndices.length > 0) {
            return engine.mdVisiblePresetIndices;
        }
        const hasFilter = Boolean(engine.mdLastFilter) || engine.mdFavoritesOnly || getMilkdropProfile().minScore > 0;
        if (hasFilter) {
            return [];
        }
        return engine.mdPresetNames.map((_, idx) => idx);
    }

    function computeBandAverage(minHz, maxHz) {
        if (!analysisAnalyser || !analysisFreqData || !audioCtx) return 0;
        const nyquist = audioCtx.sampleRate / 2;
        const binCount = analysisFreqData.length;
        const minBin = Math.max(0, Math.floor((minHz / nyquist) * binCount));
        const maxBin = Math.min(binCount - 1, Math.ceil((maxHz / nyquist) * binCount));
        if (maxBin <= minBin) return 0;

        let sum = 0;
        let count = 0;
        for (let i = minBin; i <= maxBin; i += 1) {
            sum += analysisFreqData[i];
            count += 1;
        }
        return count > 0 ? sum / count : 0;
    }

    function updateReactiveMetrics() {
        if (!analysisAnalyser || !analysisFreqData || audioEl.paused) return { isBeat: false };

        analysisAnalyser.getByteFrequencyData(analysisFreqData);

        let flux = 0;
        let total = 0;
        for (let i = 0; i < analysisFreqData.length; i += 1) {
            const value = analysisFreqData[i];
            total += value;
            const delta = value - analysisPrevFreqData[i];
            if (delta > 0) flux += delta;
            analysisPrevFreqData[i] = value;
        }

        const avgEnergy = total / analysisFreqData.length;
        const bass = computeBandAverage(25, 170);
        const lowMid = computeBandAverage(170, 550);
        const high = computeBandAverage(2000, 8000);
        const fluxNorm = flux / analysisFreqData.length;

        engine.reactive.fluxAvg = engine.reactive.fluxAvg * 0.9 + fluxNorm * 0.1;
        engine.reactive.energyAvg = engine.reactive.energyAvg * 0.92 + avgEnergy * 0.08;
        engine.reactive.bassAvg = engine.reactive.bassAvg * 0.9 + bass * 0.1;

        const weightedEnergy = bass * 0.58 + lowMid * 0.27 + high * 0.15;
        const beatThreshold = (engine.reactive.energyAvg * (1.02 + engine.mdBeatSensitivity * 0.18)) + 8;
        const fluxThreshold = (engine.reactive.fluxAvg * (1.03 + engine.mdBeatSensitivity * 0.22)) + 2;
        const now = performance.now();
        const canTrigger = (now - engine.reactive.lastBeatAt) > 120;
        const isBeat = canTrigger && weightedEnergy > beatThreshold && fluxNorm > fluxThreshold;

        if (isBeat) {
            engine.reactive.lastBeatAt = now;
        }

        return {
            isBeat,
            now,
            weightedEnergy,
            bass,
        };
    }

    function updateModeButtons() {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === engine.mode);
        });
    }

    function ensureModeVisualizer() {
        if (!audioCtx) return;
        if (engine.mode === 'spectrum') {
            initSpectrum();
        } else {
            initMilkdrop();
        }
    }

    // ══════════════════════════════════════════════
    //  SPECTRUM MODE (audioMotion-analyzer)
    // ══════════════════════════════════════════════

    function initSpectrum() {
        if (engine.audioMotion || !audioCtx) return;

        const customGradients = {
            sunset: { colorStops: ['#f12711', '#f5af19'] },
            neon: { colorStops: ['#00f260', '#0575e6', '#a100ff'] },
            cyberpunk: { colorStops: ['#ff006e', '#8338ec', '#3a86ff'] },
        };

        engine.audioMotion = new AudioMotionAnalyzer(engine.amContainer, {
            source: sourceNode,
            audioCtx,
            start: false,
            mode: 0,
            gradient: 'orangered',
            barSpace: 0.15,
            ledBars: false,
            lumiBars: false,
            radial: false,
            mirror: 0,
            reflexRatio: 0.35,
            reflexAlpha: 0.2,
            reflexBright: 1,
            showScaleX: false,
            showScaleY: false,
            showBgColor: true,
            bgAlpha: 0.9,
            overlay: true,
            showPeaks: true,
            smoothing: 0.7,
            fftSize: 8192,
            minFreq: 30,
            maxFreq: 16000,
            lineWidth: 2,
            fillAlpha: 0.2,
            splitLayout: false,
            roundBars: true,
        });

        for (const [name, grad] of Object.entries(customGradients)) {
            engine.audioMotion.registerGradient(name, {
                bgColor: '#050510',
                colorStops: grad.colorStops.map((color, idx, arr) => ({
                    color,
                    pos: idx / (arr.length - 1),
                })),
            });
        }

        updateSpectrumUI();
    }

    function setAudioMotionRunning(shouldRun) {
        if (!engine.audioMotion) return;
        try {
            if (shouldRun) {
                if (typeof engine.audioMotion.start === 'function') {
                    engine.audioMotion.start();
                } else if (typeof engine.audioMotion.toggleAnalyzer === 'function') {
                    engine.audioMotion.toggleAnalyzer(true);
                }
            } else if (typeof engine.audioMotion.stop === 'function') {
                engine.audioMotion.stop();
            } else if (typeof engine.audioMotion.toggleAnalyzer === 'function') {
                engine.audioMotion.toggleAnalyzer(false);
            }
        } catch (error) {
            console.warn('Unable to update spectrum playback state:', error);
        }
    }

    function applySpectrumPreset(preset) {
        if (!engine.audioMotion || !preset) return;
        const am = engine.audioMotion;
        if (preset.mode !== undefined) am.mode = preset.mode;
        if (preset.gradient) am.gradient = preset.gradient;
        if (preset.barSpace !== undefined) am.barSpace = preset.barSpace;
        if (preset.ledBars !== undefined) am.ledBars = preset.ledBars;
        if (preset.lumiBars !== undefined) am.lumiBars = preset.lumiBars;
        if (preset.radial !== undefined) am.radial = preset.radial;
        if (preset.mirror !== undefined) am.mirror = preset.mirror;
        if (preset.reflexRatio !== undefined) am.reflexRatio = preset.reflexRatio;
        if (preset.lineWidth !== undefined) am.lineWidth = preset.lineWidth;
        if (preset.fillAlpha !== undefined) am.fillAlpha = preset.fillAlpha;
        if (preset.splitLayout !== undefined) am.splitLayout = preset.splitLayout;
        updateSpectrumUI();
    }

    function updateSpectrumUI() {
        if (!engine.audioMotion) return;
        const am = engine.audioMotion;
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        };
        const setChecked = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!value;
        };
        const setText = (id, value) => {
            const el = document.getElementById(id + 'Val');
            if (el) el.textContent = value;
        };

        setValue('amGradient', am.gradient);
        setChecked('amLedBars', am.ledBars);
        setChecked('amLumiBars', am.lumiBars);
        setChecked('amRadial', am.radial);
        setValue('amMirror', am.mirror);
        setChecked('amReflect', am.reflexRatio > 0);
        setChecked('amSplitLayout', am.splitLayout);
        setValue('amBarSpace', am.barSpace);
        setText('amBarSpace', am.barSpace);
        setValue('amLineWidth', am.lineWidth);
        setText('amLineWidth', am.lineWidth);
        setValue('amFillAlpha', am.fillAlpha);
        setText('amFillAlpha', am.fillAlpha);

        document.querySelectorAll('.spectrum-style-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.amMode, 10) === am.mode);
        });
    }

    // ══════════════════════════════════════════════
    //  MILKDROP MODE (butterchurn)
    // ══════════════════════════════════════════════

    function bindMilkdropCanvasRecovery() {
        if (!engine.mdCanvas || engine.mdCanvasEventsBound) return;
        engine.mdCanvasEventsBound = true;

        engine.mdCanvas.addEventListener('webglcontextlost', event => {
            event.preventDefault();
            engine.mdContextLost = true;
            stopMilkdropRender();
            clearInterval(engine.mdCycleTimer);
            showLyricsStatus('Visualizer context lost. Recovering...');
            console.warn('Milkdrop WebGL context lost.');
        });

        engine.mdCanvas.addEventListener('webglcontextrestored', () => {
            console.info('Milkdrop WebGL context restored.');
            recoverMilkdropRenderer('context restored');
        });
    }

    function findNextHealthyPresetIndex(startIndex = -1) {
        if (!engine.mdPresetNames.length) return -1;

        const length = engine.mdPresetNames.length;
        for (let i = 1; i <= length; i += 1) {
            const idx = ((startIndex + i) % length + length) % length;
            const name = engine.mdPresetNames[idx];
            if (!engine.mdBadPresetNames.has(name)) {
                return idx;
            }
        }

        return -1;
    }

    function recoverMilkdropRenderer(reason) {
        if (engine.mdRecovering || !audioCtx || engine.mode !== 'milkdrop') return;

        engine.mdRecovering = true;
        stopMilkdropRender();
        clearInterval(engine.mdCycleTimer);
        engine.milkdrop = null;

        window.setTimeout(() => {
            try {
                engine.mdContextLost = false;
                initMilkdrop();
                engine.mdRenderErrorStreak = 0;

                if (!audioEl.paused && engine.milkdrop) {
                    startMilkdropRender();
                    resetCycleTimer();
                }
            } catch (error) {
                console.error('Milkdrop recovery failed after ' + reason + ':', error);
            } finally {
                engine.mdRecovering = false;
            }
        }, 120);
    }

    function handleMilkdropRenderError(error) {
        const now = performance.now();
        if (now - engine.mdLastRenderErrorAt > 4500) {
            engine.mdRenderErrorStreak = 0;
        }
        engine.mdLastRenderErrorAt = now;
        engine.mdRenderErrorStreak += 1;

        const activeName = engine.mdPresetNames[engine.mdCurrentIdx];
        if (activeName) {
            engine.mdBadPresetNames.add(activeName);
        }

        console.warn('Milkdrop render error #' + engine.mdRenderErrorStreak + (activeName ? ' on ' + activeName : ''), error);

        if (engine.mdRenderErrorStreak >= 3) {
            recoverMilkdropRenderer('repeated render errors');
            return;
        }

        const fallbackIndex = findNextHealthyPresetIndex(engine.mdCurrentIdx);
        if (fallbackIndex >= 0 && fallbackIndex !== engine.mdCurrentIdx) {
            loadMilkdropPreset(fallbackIndex, 0.25, false);
        }
    }

    function initMilkdrop() {
        if (engine.milkdrop || !audioCtx || engine.mdContextLost) return;
        if (typeof butterchurn === 'undefined') {
            console.warn('butterchurn not loaded');
            return;
        }

        const canvas = engine.mdCanvas;
        if (!canvas) return;
        bindMilkdropCanvasRecovery();

        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;

        let createVis = null;
        if (butterchurn.createVisualizer) {
            createVis = butterchurn.createVisualizer.bind(butterchurn);
        } else if (butterchurn.default && butterchurn.default.createVisualizer) {
            createVis = butterchurn.default.createVisualizer.bind(butterchurn.default);
        }
        if (!createVis) {
            console.error('butterchurn API not found. Keys:', Object.keys(butterchurn));
            return;
        }

        try {
            engine.milkdrop = createVis(audioCtx, canvas, {
                width: canvas.width,
                height: canvas.height,
                pixelRatio: dpr,
                textureRatio: 1,
            });
            engine.milkdrop.connectAudio(sourceNode);

            const mergedPresets = {};
            if (typeof butterchurnPresets !== 'undefined') {
                mergePresetPack(mergedPresets, butterchurnPresets.default || butterchurnPresets);
            }
            if (typeof butterchurnPresetsExtra !== 'undefined') {
                mergePresetPack(mergedPresets, butterchurnPresetsExtra, '[Extra] ');
            }
            if (typeof butterchurnPresetsExtra2 !== 'undefined') {
                mergePresetPack(mergedPresets, butterchurnPresetsExtra2, '[Extra2] ');
            }
            if (typeof butterchurnPresetsMD1 !== 'undefined') {
                mergePresetPack(mergedPresets, butterchurnPresetsMD1, '[MD1] ');
            }

            if (Object.keys(mergedPresets).length > 0) {
                engine.mdPresets = mergedPresets;
                engine.mdPresetNames = Object.keys(mergedPresets).sort((a, b) => a.localeCompare(b));
                rebuildMilkdropCatalog();
            }

            if (engine.mdPresetNames.length > 0) {
                buildMilkdropPresetList();
                if (!engine.mdInitialPresetChosen) {
                    const pool = getPresetPoolIndices();
                    const fallbackPool = pool.length > 0 ? pool : engine.mdPresetNames.map((_, idx) => idx);
                    const randomPos = Math.floor(Math.random() * fallbackPool.length);
                    engine.mdCurrentIdx = fallbackPool[randomPos];
                    engine.mdInitialPresetChosen = true;
                }
                loadMilkdropPreset(engine.mdCurrentIdx, 0);
            }

            loadThirdPartyInternetPresets();
            console.log('Milkdrop initialized:', engine.mdPresetNames.length, 'presets');
        } catch (error) {
            console.error('Milkdrop init failed:', error);
        }
    }

    function loadMilkdropPreset(index, blendTime, allowFallback = true) {
        if (!engine.milkdrop || engine.mdPresetNames.length === 0) return;
        const length = engine.mdPresetNames.length;
        const safeIndex = ((index % length) + length) % length;
        const name = engine.mdPresetNames[safeIndex];

        if (engine.mdBadPresetNames.has(name)) {
            if (allowFallback) {
                const fallbackIndex = findNextHealthyPresetIndex(safeIndex);
                if (fallbackIndex >= 0 && fallbackIndex !== safeIndex) {
                    loadMilkdropPreset(fallbackIndex, blendTime, false);
                }
            }
            return;
        }

        const preset = engine.mdPresets[name];
        if (!preset) return;

        try {
            engine.milkdrop.loadPreset(preset, blendTime);
            engine.mdCurrentIdx = safeIndex;
        } catch (error) {
            console.warn('Skipping unstable Milkdrop preset:', name, error);
            engine.mdBadPresetNames.add(name);
            if (allowFallback) {
                const fallbackIndex = findNextHealthyPresetIndex(safeIndex);
                if (fallbackIndex >= 0 && fallbackIndex !== safeIndex) {
                    loadMilkdropPreset(fallbackIndex, Math.max(0.2, blendTime || 0), false);
                }
            }
            return;
        }

        document.querySelectorAll('.md-preset-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.idx, 10) === safeIndex);
        });
        const activeItem = document.querySelector('.md-preset-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        updateMilkdropStats();
    }

    function nextMilkdropPreset() {
        const pool = getPresetPoolIndices();
        if (!pool.length) return;
        const pos = pool.indexOf(engine.mdCurrentIdx);
        const nextPos = pos >= 0 ? (pos + 1) % pool.length : 0;
        loadMilkdropPreset(pool[nextPos], engine.mdBlendTime);
        resetCycleTimer();
    }

    function prevMilkdropPreset() {
        const pool = getPresetPoolIndices();
        if (!pool.length) return;
        const pos = pool.indexOf(engine.mdCurrentIdx);
        const prevPos = pos >= 0 ? (pos - 1 + pool.length) % pool.length : 0;
        loadMilkdropPreset(pool[prevPos], engine.mdBlendTime);
        resetCycleTimer();
    }

    function pickWeightedRandomPresetIndex() {
        const pool = getPresetPoolIndices();
        if (!pool.length) return -1;

        const weightedEntries = pool
            .filter(index => !engine.mdBadPresetNames.has(engine.mdPresetNames[index]))
            .map(index => {
            const catalogEntry = engine.mdCatalog.find(entry => entry.index === index);
            const score = catalogEntry ? catalogEntry.score : 50;
            const weight = Math.max(1, Math.pow((score + 12) / 20, 1.4));
            return { index, weight };
        });

        if (!weightedEntries.length) return -1;

        const totalWeight = weightedEntries.reduce((sum, entry) => sum + entry.weight, 0);
        let roll = Math.random() * totalWeight;
        for (let i = 0; i < weightedEntries.length; i += 1) {
            roll -= weightedEntries[i].weight;
            if (roll <= 0) return weightedEntries[i].index;
        }

        return weightedEntries[weightedEntries.length - 1].index;
    }

    function randomMilkdropPreset() {
        if (!engine.mdPresetNames.length) return;
        const index = pickWeightedRandomPresetIndex();
        if (index < 0) return;
        loadMilkdropPreset(index, engine.mdBlendTime);
    }

    function resetCycleTimer() {
        clearInterval(engine.mdCycleTimer);
        if (engine.mdAutoCycle && !audioEl.paused && engine.mode === 'milkdrop') {
            engine.mdCycleTimer = setInterval(() => {
                randomMilkdropPreset();
            }, engine.mdCycleTime * 1000);
        }
    }

    function stopMilkdropRender() {
        if (engine.mdAnimFrame) {
            cancelAnimationFrame(engine.mdAnimFrame);
            engine.mdAnimFrame = null;
        }
    }

    function renderMilkdrop() {
        if (engine.mode !== 'milkdrop' || !engine.milkdrop || audioEl.paused || engine.mdContextLost || engine.mdRecovering) {
            engine.mdAnimFrame = null;
            return;
        }

        try {
            const metrics = updateReactiveMetrics();
            if (engine.mdBeatReactive && metrics.isBeat) {
                const elapsed = metrics.now - engine.mdBeatLastSwitchAt;
                const cooldown = engine.mdBeatSwitchCooldownMs * (1.25 - Math.min(engine.mdBeatSensitivity, 1.5) * 0.3);
                if (elapsed >= cooldown) {
                    const dynamicBlend = Math.max(0.3, engine.mdBlendTime * 0.72);
                    const nextIndex = pickWeightedRandomPresetIndex();
                    if (nextIndex >= 0) {
                        loadMilkdropPreset(nextIndex, dynamicBlend);
                        engine.mdBeatLastSwitchAt = metrics.now;
                    }
                }
            }

            engine.milkdrop.render();
            engine.mdRenderErrorStreak = 0;
        } catch (error) {
            handleMilkdropRenderError(error);
        } finally {
            if (engine.mode === 'milkdrop' && engine.milkdrop && !audioEl.paused && !engine.mdContextLost && !engine.mdRecovering) {
                engine.mdAnimFrame = requestAnimationFrame(renderMilkdrop);
            } else {
                engine.mdAnimFrame = null;
            }
        }
    }

    function startMilkdropRender() {
        if (engine.mdAnimFrame || audioEl.paused || engine.mode !== 'milkdrop' || !engine.milkdrop || engine.mdContextLost || engine.mdRecovering) return;
        engine.mdAnimFrame = requestAnimationFrame(renderMilkdrop);
    }

    function updateMilkdropStats() {
        const stats = document.getElementById('mdPresetStats');
        if (!stats) return;

        const profile = getMilkdropProfile();
        const shown = engine.mdVisiblePresetIndices.length;
        const total = engine.mdPresetNames.length;
        const profileLabel = (profile && profile.label) || 'All';
        const modeLabel = engine.mdFavoritesOnly ? 'favorites only' : 'catalog';
        stats.textContent = shown + ' of ' + total + ' presets • ' + profileLabel + ' • ' + modeLabel;
    }

    function buildMilkdropPresetList(filter = '') {
        const list = document.getElementById('mdPresetList');
        if (!list) return;

        const profile = getMilkdropProfile();
        const filterText = filter.toLowerCase();
        engine.mdLastFilter = filterText;
        list.innerHTML = '';
        engine.mdVisiblePresetIndices = [];

        engine.mdCatalog.forEach(entry => {
            const name = entry.name;
            if (profile && entry.score < profile.minScore) return;
            if (engine.mdFavoritesOnly && !entry.isFavorite) return;
            if (filterText && !name.toLowerCase().includes(filterText)) return;
            if (engine.mdBadPresetNames.has(name)) return;

            engine.mdVisiblePresetIndices.push(entry.index);

            const item = document.createElement('div');
            item.className = 'md-preset-item';
            item.dataset.idx = String(entry.index);

            const nameEl = document.createElement('span');
            nameEl.className = 'md-preset-name';
            nameEl.textContent = name;

            const scoreEl = document.createElement('span');
            scoreEl.className = 'md-preset-score';
            scoreEl.textContent = String(entry.score);

            item.appendChild(nameEl);
            item.appendChild(scoreEl);

            item.title = name + ' • score ' + entry.score;
            if (entry.index === engine.mdCurrentIdx) item.classList.add('active');
            list.appendChild(item);
        });

        updateMilkdropStats();
    }

    // ══════════════════════════════════════════════
    //  MODE SWITCHING
    // ══════════════════════════════════════════════

    function setMode(mode) {
        engine.mode = mode === 'spectrum' ? 'spectrum' : 'milkdrop';
        engine.amContainer.classList.toggle('mode-active', engine.mode === 'spectrum');
        engine.mdCanvas.style.display = engine.mode === 'milkdrop' ? 'block' : 'none';

        const spectrumControls = document.getElementById('spectrumControls');
        const milkdropControls = document.getElementById('milkdropControls');
        if (spectrumControls) spectrumControls.style.display = engine.mode === 'spectrum' ? '' : 'none';
        if (milkdropControls) milkdropControls.style.display = engine.mode === 'milkdrop' ? '' : 'none';

        updateModeButtons();
        ensureModeVisualizer();
        syncVisualizerPlayback();
    }

    function syncVisualizerPlayback() {
        const isPlaying = !audioEl.paused;

        if (engine.mode === 'spectrum') {
            stopMilkdropRender();
            clearInterval(engine.mdCycleTimer);
        }

        setAudioMotionRunning(isPlaying && engine.mode === 'spectrum');

        if (engine.mode === 'milkdrop') {
            if (isPlaying) {
                startMilkdropRender();
                resetCycleTimer();
            } else {
                stopMilkdropRender();
                clearInterval(engine.mdCycleTimer);
            }
        }
    }

    // ══════════════════════════════════════════════
    //  PLAYBACK CONTROLS
    // ══════════════════════════════════════════════

    function formatTime(value) {
        if (!Number.isFinite(value) || value < 0) return '0:00';
        const minutes = Math.floor(value / 60);
        const seconds = Math.floor(value % 60);
        return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    }

    function getKnownDuration() {
        const mediaDuration = Number(audioEl.duration);
        if (Number.isFinite(mediaDuration) && mediaDuration > 0) {
            return mediaDuration;
        }
        const trackDuration = Number(window.TRACK && window.TRACK.duration);
        return Number.isFinite(trackDuration) && trackDuration > 0 ? trackDuration : 0;
    }

    function syncDurationUI() {
        const duration = getKnownDuration();
        if (duration > 0) {
            totalTimeEl.textContent = formatTime(duration);
            seekBar.max = duration;
        }
    }

    function syncVolumeUI() {
        muteBtn.textContent = audioEl.volume > 0 ? '🔊' : '🔇';
    }

    async function togglePlayback() {
        if (!startupReady) {
            showLyricsStatus('Preparing track. Please wait...');
            return;
        }
        try {
            await primeAudioPipeline();
            if (!audioEl.paused) {
                audioEl.pause();
            } else {
                await audioEl.play();
            }
        } catch (error) {
            console.error('Playback failed:', error);
        }
    }

    // ══════════════════════════════════════════════
    //  LYRICS
    // ══════════════════════════════════════════════

    const lyrics = {
        active: false,
        fetched: false,
        available: null,
        availabilityChecked: false,
        synced: false,
        renderer: null,
        rafId: null,
        lastMediaTime: Number.NaN,
        lastPerfNow: Number.NaN,
    };

    if (window.OpenKaraokeLyricsDisplay && lyricsDisplay) {
        lyrics.renderer = new window.OpenKaraokeLyricsDisplay(lyricsDisplay);
    }

    function setCachedLyricsAvailability(trackId, available) {
        const cache = safeReadJSON(LYRICS_STATUS_STORAGE_KEY, {});
        cache[String(trackId)] = !!available;
        safeWriteJSON(LYRICS_STATUS_STORAGE_KEY, cache);
    }

    function getCachedLyricsAvailability(trackId) {
        const cache = safeReadJSON(LYRICS_STATUS_STORAGE_KEY, {});
        const value = cache[String(trackId)];
        return typeof value === 'boolean' ? value : null;
    }

    function applyLyricsAvailability(available) {
        const isAvailable = !!available;
        lyrics.available = isAvailable;
        lyrics.availabilityChecked = true;

        if (lyricsBtn) {
            lyricsBtn.disabled = !isAvailable;
            lyricsBtn.classList.toggle('disabled', !isAvailable);
            lyricsBtn.title = isAvailable ? 'Lyrics' : 'Lyrics unavailable for this track';
        }

        if (!isAvailable) {
            lyrics.active = false;
            lyrics.fetched = false;
            if (lyricsOverlay) lyricsOverlay.classList.remove('active');
            if (lyricsBtn) lyricsBtn.classList.remove('active');
            stopLyricsSync();
        }
    }

    async function primeLyricsAvailability() {
        const trackId = window.TRACK && window.TRACK.id;
        if (!trackId) return;

        const cached = getCachedLyricsAvailability(trackId);
        if (cached === true) {
            applyLyricsAvailability(true);
            return;
        }

        if (cached === false) {
            applyLyricsAvailability(false);
            // Revalidate cached misses in case a prior client-side error wrote a stale false.
        }

        try {
            const response = await fetch('/api/lyrics/' + trackId + '/', {
                headers: {
                    Accept: 'application/json',
                },
            });

            const available = response.ok ? !!(await response.json()).available : false;
            setCachedLyricsAvailability(trackId, available);
            applyLyricsAvailability(available);
        } catch (_) {
            setCachedLyricsAvailability(trackId, false);
            applyLyricsAvailability(false);
        }
    }

    function showLyricsStatus(message, timeout = 2400) {
        if (!lyricsStatus) return;
        lyricsStatus.textContent = message;
        lyricsStatus.classList.add('visible');
        if (timeout > 0) {
            window.clearTimeout(showLyricsStatus.timerId);
            showLyricsStatus.timerId = window.setTimeout(() => {
                lyricsStatus.classList.remove('visible');
            }, timeout);
        }
    }

    function resetLyricsClock() {
        lyrics.lastMediaTime = Number.NaN;
        lyrics.lastPerfNow = Number.NaN;
    }

    function getPreciseLyricsTime() {
        const mediaTime = Number(audioEl.currentTime);
        if (!Number.isFinite(mediaTime)) return 0;
        return Math.max(0, mediaTime);
    }

    function syncLyricsToNow() {
        if (!lyrics.active || !lyrics.available || !lyrics.renderer) return;
        lyrics.renderer.update(getPreciseLyricsTime());
    }

    async function fetchLyrics() {
        if (lyrics.fetched || !window.TRACK || !window.TRACK.lyricsUrl) return;
        if (lyrics.available === false) {
            showLyricsStatus('Lyrics are not available for this track');
            return;
        }
        lyrics.fetched = true;

        if (!lyrics.renderer) {
            lyrics.fetched = false;
            lyrics.available = false;
            showLyricsStatus('Lyrics renderer unavailable');
            return;
        }

        try {
            showLyricsStatus('Fetching lyrics...', 0);
            const response = await fetch(window.TRACK.lyricsUrl, {
                headers: {
                    Accept: 'text/plain',
                },
            });

            if (!response.ok) {
                throw new Error('lyrics-not-found');
            }

            const lrcText = (await response.text()).trim();
            if (!lrcText) {
                throw new Error('lyrics-empty');
            }

            lyrics.renderer.loadSyncedLRC(lrcText);
            resetLyricsClock();
            lyrics.synced = true;
            lyrics.available = true;
            lyrics.availabilityChecked = true;
            setCachedLyricsAvailability(window.TRACK.id, true);
            applyLyricsAvailability(true);
            showLyricsStatus('Synced lyrics loaded');
        } catch (error) {
            lyrics.fetched = false;
            lyrics.available = false;
            lyrics.availabilityChecked = true;
            setCachedLyricsAvailability(window.TRACK.id, false);
            applyLyricsAvailability(false);
            showLyricsStatus('No lyrics found for this track');
        }
    }

    function startLyricsSync() {
        if (lyrics.rafId || !lyrics.renderer) return;

        const tick = () => {
            if (!lyrics.active) {
                lyrics.rafId = null;
                return;
            }

            if (lyrics.available) {
                lyrics.renderer.update(getPreciseLyricsTime());
            }

            lyrics.rafId = window.requestAnimationFrame(tick);
        };

        lyrics.rafId = window.requestAnimationFrame(tick);
    }

    function stopLyricsSync() {
        if (!lyrics.rafId) return;
        window.cancelAnimationFrame(lyrics.rafId);
        lyrics.rafId = null;
    }

    function toggleLyrics() {
        if (!lyricsOverlay || !lyricsBtn || !lyricsDisplay) return;
        if (!startupReady) {
            showLyricsStatus('Preparing track. Please wait...');
            return;
        }
        if (lyricsBtn.disabled) {
            showLyricsStatus('Lyrics are not available for this track');
            return;
        }
        lyrics.active = !lyrics.active;
        lyricsOverlay.classList.toggle('active', lyrics.active);
        lyricsBtn.classList.toggle('active', lyrics.active);

        if (lyrics.active) {
            resetLyricsClock();
            fetchLyrics();
            startLyricsSync();
            syncLyricsToNow();
        } else {
            stopLyricsSync();
        }
    }

    // ══════════════════════════════════════════════
    //  UI BINDINGS
    // ══════════════════════════════════════════════

    function bindSelect(id, callback) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => callback(el.value));
        }
    }

    function bindToggle(id, callback) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => callback(el.checked));
        }
    }

    function bindSlider(id, callback) {
        const el = document.getElementById(id);
        const valueEl = document.getElementById(id + 'Val');
        if (el) {
            el.addEventListener('input', () => {
                if (valueEl) valueEl.textContent = el.value;
                callback(el.value);
            });
        }
    }

    function bindControls() {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    await primeAudioPipeline();
                } catch (_) {
                    // The user can still switch UI state before playback starts.
                }
                setMode(btn.dataset.mode);
            });
        });

        const panel = document.getElementById('controlPanel');
        const panelToggle = document.getElementById('panelToggle');
        const panelClose = document.getElementById('panelClose');
        let panelOpen = false;

        if (panelToggle && panel) {
            panelToggle.addEventListener('click', () => {
                panelOpen = !panelOpen;
                panel.classList.toggle('open', panelOpen);
                panelToggle.classList.toggle('active', panelOpen);
            });
        }
        if (panelClose && panelToggle && panel) {
            panelClose.addEventListener('click', () => {
                panelOpen = false;
                panel.classList.remove('open');
                panelToggle.classList.remove('active');
            });
        }

        document.querySelectorAll('.spectrum-style-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!engine.audioMotion) return;
                engine.audioMotion.mode = parseInt(btn.dataset.amMode, 10);
                updateSpectrumUI();
            });
        });

        bindSelect('amGradient', value => { if (engine.audioMotion) engine.audioMotion.gradient = value; });
        bindToggle('amLedBars', value => { if (engine.audioMotion) engine.audioMotion.ledBars = value; });
        bindToggle('amLumiBars', value => { if (engine.audioMotion) engine.audioMotion.lumiBars = value; });
        bindToggle('amRadial', value => { if (engine.audioMotion) engine.audioMotion.radial = value; });
        bindToggle('amReflect', value => { if (engine.audioMotion) engine.audioMotion.reflexRatio = value ? 0.35 : 0; });
        bindToggle('amSplitLayout', value => { if (engine.audioMotion) engine.audioMotion.splitLayout = value; });
        bindSelect('amMirror', value => { if (engine.audioMotion) engine.audioMotion.mirror = parseInt(value, 10); });
        bindSlider('amBarSpace', value => { if (engine.audioMotion) engine.audioMotion.barSpace = parseFloat(value); });
        bindSlider('amLineWidth', value => { if (engine.audioMotion) engine.audioMotion.lineWidth = parseFloat(value); });
        bindSlider('amFillAlpha', value => { if (engine.audioMotion) engine.audioMotion.fillAlpha = parseFloat(value); });

        const spectrumGrid = document.getElementById('spectrumPresetGrid');
        if (spectrumGrid && window.SPECTRUM_PRESETS) {
            spectrumGrid.innerHTML = SPECTRUM_PRESETS.map((preset, idx) =>
                `<div class="preset-card" data-sp-idx="${idx}">${preset.name}</div>`
            ).join('');
            spectrumGrid.addEventListener('click', event => {
                const card = event.target.closest('.preset-card');
                if (!card) return;
                spectrumGrid.querySelectorAll('.preset-card').forEach(el => el.classList.remove('active'));
                card.classList.add('active');
                applySpectrumPreset(SPECTRUM_PRESETS[parseInt(card.dataset.spIdx, 10)]);
            });
        }

        const milkdropSearch = document.getElementById('mdPresetSearch');
        if (milkdropSearch) {
            milkdropSearch.addEventListener('input', () => buildMilkdropPresetList(milkdropSearch.value));
        }

        const mdQualityProfile = document.getElementById('mdQualityProfile');
        if (mdQualityProfile) {
            mdQualityProfile.value = engine.mdQualityProfile;
            mdQualityProfile.addEventListener('change', () => {
                engine.mdQualityProfile = mdQualityProfile.value;
                buildMilkdropPresetList(milkdropSearch ? milkdropSearch.value : '');
            });
        }

        bindToggle('mdFavoritesOnly', value => {
            engine.mdFavoritesOnly = value;
            buildMilkdropPresetList(milkdropSearch ? milkdropSearch.value : '');
        });

        bindToggle('mdBeatReactive', value => {
            engine.mdBeatReactive = value;
        });

        bindSlider('mdBeatSensitivity', value => {
            engine.mdBeatSensitivity = parseFloat(value);
        });

        const milkdropList = document.getElementById('mdPresetList');
        if (milkdropList) {
            milkdropList.addEventListener('click', event => {
                const item = event.target.closest('.md-preset-item');
                if (!item) return;
                loadMilkdropPreset(parseInt(item.dataset.idx, 10), engine.mdBlendTime);
            });
        }

        bindToggle('mdAutoCycle', value => {
            engine.mdAutoCycle = value;
            resetCycleTimer();
        });
        bindSlider('mdCycleTime', value => {
            engine.mdCycleTime = parseInt(value, 10);
            resetCycleTimer();
        });
        bindSlider('mdBlendTime', value => {
            engine.mdBlendTime = parseFloat(value);
        });

        buildMilkdropPresetList(milkdropSearch ? milkdropSearch.value : '');
    }

    // ══════════════════════════════════════════════
    //  EVENT LISTENERS
    // ══════════════════════════════════════════════

    if (playBtn) {
        playBtn.addEventListener('click', togglePlayback);
    }

    audioEl.addEventListener('play', () => {
        playBtn.textContent = '⏸';
        syncVisualizerPlayback();
        resetLyricsClock();
        syncLyricsToNow();
    });

    audioEl.addEventListener('pause', () => {
        playBtn.textContent = '▶';
        syncVisualizerPlayback();
    });

    audioEl.addEventListener('ended', () => {
        if (goToNextQueueTrack()) return;
        playBtn.textContent = '▶';
        syncVisualizerPlayback();
    });

    audioEl.addEventListener('loadedmetadata', syncDurationUI);
    audioEl.addEventListener('durationchange', syncDurationUI);
    audioEl.addEventListener('canplay', syncDurationUI);
    audioEl.addEventListener('timeupdate', () => {
        syncDurationUI();
        currentTimeEl.textContent = formatTime(audioEl.currentTime);
        seekBar.value = audioEl.currentTime;
    });

    audioEl.addEventListener('seeking', () => {
        resetLyricsClock();
    });

    audioEl.addEventListener('seeked', () => {
        resetLyricsClock();
        syncLyricsToNow();
    });

    audioEl.addEventListener('ratechange', () => {
        resetLyricsClock();
        syncLyricsToNow();
    });

    audioEl.addEventListener('waiting', () => {
        resetLyricsClock();
    });

    seekBar.addEventListener('input', () => {
        audioEl.currentTime = parseFloat(seekBar.value || '0');
    });

    audioEl.volume = parseFloat(volumeSlider.value || '0.8');
    syncVolumeUI();

    volumeSlider.addEventListener('input', () => {
        audioEl.volume = parseFloat(volumeSlider.value || '0');
        syncVolumeUI();
    });

    let previousVolume = audioEl.volume || 0.8;
    muteBtn.addEventListener('click', () => {
        if (audioEl.volume > 0) {
            previousVolume = audioEl.volume;
            audioEl.volume = 0;
            volumeSlider.value = 0;
        } else {
            audioEl.volume = previousVolume;
            volumeSlider.value = previousVolume;
        }
        syncVolumeUI();
    });

    if (prevTrackBtn) {
        prevTrackBtn.addEventListener('click', () => {
            goToPrevQueueTrack();
        });
    }

    if (nextTrackBtn) {
        nextTrackBtn.addEventListener('click', () => {
            goToNextQueueTrack();
        });
    }

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            playerPage.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen();
        }
    });

    let barHidden = false;
    function setBarHidden(hidden) {
        barHidden = !!hidden;
        bottomBar.classList.toggle('hidden-bar', barHidden);
        hideBarBtn.textContent = barHidden ? '⬆' : '⬇';
        hideBarBtn.title = barHidden ? 'Show controls' : 'Hide controls';

        if (showBarBtn) {
            showBarBtn.hidden = !barHidden;
            showBarBtn.classList.toggle('visible', barHidden);
        }
    }

    hideBarBtn.addEventListener('click', () => {
        setBarHidden(!barHidden);
    });

    if (showBarBtn) {
        showBarBtn.addEventListener('click', () => {
            setBarHidden(false);
            showControls();
        });
    }

    if (lyricsBtn) {
        lyricsBtn.addEventListener('click', toggleLyrics);
    }

    let hideTimer = null;
    function showControls() {
        playerPage.classList.add('controls-visible');
        clearTimeout(hideTimer);
        hideTimer = window.setTimeout(() => {
            if (!audioEl.paused) {
                playerPage.classList.remove('controls-visible');
            }
        }, 3000);
    }

    playerPage.addEventListener('mousemove', showControls);
    playerPage.addEventListener('click', showControls);

    document.addEventListener('keydown', event => {
        const tagName = event.target.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return;
        if (!startupReady) return;

        switch (event.key) {
            case ' ':
                event.preventDefault();
                togglePlayback();
                break;
            case 'f':
            case 'F':
                fullscreenBtn.click();
                break;
            case 'h':
            case 'H':
                hideBarBtn.click();
                break;
            case 'l':
            case 'L':
                toggleLyrics();
                break;
            case 'n':
            case 'N':
                if (engine.mode === 'milkdrop') nextMilkdropPreset();
                break;
            case 'p':
            case 'P':
                if (engine.mode === 'milkdrop') prevMilkdropPreset();
                break;
            case 'r':
            case 'R':
                if (engine.mode === 'milkdrop') randomMilkdropPreset();
                break;
            case '[':
                goToPrevQueueTrack();
                break;
            case ']':
                goToNextQueueTrack();
                break;
            case 'b':
            case 'B':
                if (engine.mode === 'milkdrop') {
                    engine.mdBeatReactive = !engine.mdBeatReactive;
                    const beatToggle = document.getElementById('mdBeatReactive');
                    if (beatToggle) beatToggle.checked = engine.mdBeatReactive;
                }
                break;
            case 'ArrowLeft':
                audioEl.currentTime = Math.max(0, audioEl.currentTime - 5);
                break;
            case 'ArrowRight':
                audioEl.currentTime = Math.min(getKnownDuration(), audioEl.currentTime + 5);
                break;
            case 'ArrowUp':
                audioEl.volume = Math.min(1, audioEl.volume + 0.05);
                volumeSlider.value = audioEl.volume;
                syncVolumeUI();
                break;
            case 'ArrowDown':
                audioEl.volume = Math.max(0, audioEl.volume - 0.05);
                volumeSlider.value = audioEl.volume;
                syncVolumeUI();
                break;
        }
    });

    window.addEventListener('resize', () => {
        if (engine.milkdrop) {
            const dpr = window.devicePixelRatio || 1;
            engine.mdCanvas.width = window.innerWidth * dpr;
            engine.mdCanvas.height = window.innerHeight * dpr;
            try {
                engine.milkdrop.setRendererSize(engine.mdCanvas.width, engine.mdCanvas.height);
            } catch (error) {
                console.warn('Milkdrop resize failed, attempting recovery:', error);
                recoverMilkdropRenderer('resize failure');
            }
        }
    });

    async function bootstrapPlayer() {
        setStartupLock(true);
        setStartupPhase('Preparing track', 'Resolving queue and lyrics...');

        initQueue();
        updateQueueUI();
        bindControls();
        syncDurationUI();

        try {
            await primeLyricsAvailability();

            if (lyrics.available) {
                setStartupPhase('Loading lyrics', 'Syncing lyric timeline before visualizer starts...');
                await fetchLyrics();
            } else {
                showLyricsStatus('Lyrics are not available for this track');
            }
        } catch (error) {
            console.warn('Startup preparation failed:', error);
            showLyricsStatus('Track loaded with limited metadata');
        }

        setMode('milkdrop');
        startupReady = true;
        setStartupLock(false);
        applyLyricsAvailability(lyrics.available);
        setStartupPhase('Ready', 'Player loaded');
        hideStartupOverlay();
    }

    bootstrapPlayer();
})();
