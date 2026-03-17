/* ═══════════════════════════════════════════════
   VISUALIZER ENGINE — MuViz
   Orchestrates butterchurn (Milkdrop) and
   audioMotion-analyzer (Spectrum)
   ═══════════════════════════════════════════════ */

(function () {
    'use strict';

    const audioEl = document.getElementById('audioEl');
    const playerPage = document.getElementById('playerPage');

    // ── Audio Context (shared) ─────────────────
    let audioCtx = null;
    let sourceNode = null;

    function getAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            sourceNode = audioCtx.createMediaElementSource(audioEl);
            sourceNode.connect(audioCtx.destination);
        }
        return { audioCtx, sourceNode };
    }

    // ── State ──────────────────────────────────
    const engine = {
        mode: 'milkdrop',    // 'spectrum' | 'milkdrop'
        initialPresetApplied: false,
        // Milkdrop
        milkdrop: null,
        mdCanvas: document.getElementById('milkdropCanvas'),
        mdPresets: {},
        mdPresetNames: [],
        mdCurrentIdx: 0,
        mdBlendTime: 1.5,
        mdAutoCycle: true,
        mdCycleTime: 5,
        mdCycleTimer: null,
        mdAnimFrame: null,
        // audioMotion
        audioMotion: null,
        amContainer: document.getElementById('spectrumContainer'),
    };

    function randomIndex(length) {
        return length > 0 ? Math.floor(Math.random() * length) : 0;
    }

    function applyRandomSpectrumPreset() {
        if (!window.SPECTRUM_PRESETS || !window.SPECTRUM_PRESETS.length) return;
        const preset = window.SPECTRUM_PRESETS[randomIndex(window.SPECTRUM_PRESETS.length)];
        applySpectrumPreset(preset);

        const specGrid = document.getElementById('spectrumPresetGrid');
        if (specGrid) {
            specGrid.querySelectorAll('.preset-card').forEach(card => {
                const presetIdx = parseInt(card.dataset.spIdx, 10);
                card.classList.toggle('active', window.SPECTRUM_PRESETS[presetIdx] === preset);
            });
        }
    }

    function applyRandomMilkdropPreset() {
        if (!engine.mdPresetNames.length) return;
        loadMilkdropPreset(randomIndex(engine.mdPresetNames.length), 0);
    }

    function applyRandomInitialVisualizer() {
        if (engine.initialPresetApplied) return;
        engine.initialPresetApplied = true;

        const modes = ['milkdrop', 'spectrum'];
        const initialMode = modes[randomIndex(modes.length)];
        setMode(initialMode);
    }

    // ══════════════════════════════════════════════
    //  SPECTRUM MODE (audioMotion-analyzer)
    // ══════════════════════════════════════════════

    function initSpectrum() {
        if (engine.audioMotion) return;

        const { audioCtx: ctx, sourceNode: src } = getAudioContext();

        // Custom gradients
        const customGradients = {
            sunset: { colorStops: ['#f12711', '#f5af19'] },
            neon: { colorStops: ['#00f260', '#0575e6', '#a100ff'] },
            cyberpunk: { colorStops: ['#ff006e', '#8338ec', '#3a86ff'] },
        };

        engine.audioMotion = new AudioMotionAnalyzer(engine.amContainer, {
            source: src,
            audioCtx: ctx,
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

        // Register custom gradients
        for (const [name, grad] of Object.entries(customGradients)) {
            engine.audioMotion.registerGradient(name, {
                bgColor: '#050510',
                colorStops: grad.colorStops.map((c, i, arr) => ({
                    color: c,
                    pos: i / (arr.length - 1),
                })),
            });
        }

        engine.audioMotion.gradient = 'orangered';

        if (engine.mode === 'spectrum' && engine.initialPresetApplied) {
            applyRandomSpectrumPreset();
        }
    }

    function applySpectrumPreset(preset) {
        if (!engine.audioMotion) return;
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
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        const setV = (id, v) => { const el = document.getElementById(id + 'Val'); if (el) el.textContent = v; };
        const setC = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

        set('amGradient', am.gradient);
        setC('amLedBars', am.ledBars);
        setC('amLumiBars', am.lumiBars);
        setC('amRadial', am.radial);
        set('amMirror', am.mirror);
        setC('amReflect', am.reflexRatio > 0);
        setC('amSplitLayout', am.splitLayout);
        set('amBarSpace', am.barSpace); setV('amBarSpace', am.barSpace);
        set('amLineWidth', am.lineWidth); setV('amLineWidth', am.lineWidth);
        set('amFillAlpha', am.fillAlpha); setV('amFillAlpha', am.fillAlpha);

        // Mode buttons
        document.querySelectorAll('.spectrum-style-btn').forEach(b => {
            b.classList.toggle('active', parseInt(b.dataset.amMode) === am.mode);
        });
    }

    // ══════════════════════════════════════════════
    //  MILKDROP MODE (butterchurn)
    // ══════════════════════════════════════════════

    function initMilkdrop() {
        if (engine.milkdrop) return;
        if (typeof butterchurn === 'undefined') {
            console.warn('butterchurn not loaded');
            return;
        }

        const { audioCtx: ctx, sourceNode: src } = getAudioContext();
        const canvas = engine.mdCanvas;
        canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
        canvas.height = window.innerHeight * (window.devicePixelRatio || 1);

        // Resolve butterchurn API (handle UMD .default wrapping)
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
            engine.milkdrop = createVis(ctx, canvas, {
                width: canvas.width,
                height: canvas.height,
                pixelRatio: window.devicePixelRatio || 1,
                textureRatio: 1,
            });
            engine.milkdrop.connectAudio(src);

            // Resolve presets (handle all possible UMD patterns)
            let presets = null;
            if (typeof butterchurnPresets !== 'undefined') {
                const bp = butterchurnPresets.default || butterchurnPresets;
                if (typeof bp.getPresets === 'function') {
                    presets = bp.getPresets();
                } else if (typeof bp === 'function') {
                    try { presets = bp(); } catch (_) {
                        try { presets = new bp(); } catch (__) { /* not a class */ }
                    }
                } else if (typeof bp === 'object') {
                    presets = bp;
                }
            }

            if (presets && typeof presets === 'object') {
                engine.mdPresets = presets;
                const names = Object.keys(presets);
                const favoriteSet = new Set((window.MILKDROP_FAVORITES || []).map(name => name.toLowerCase()));
                engine.mdPresetNames = names.sort((a, b) => {
                    const aFav = favoriteSet.has(a.toLowerCase()) ? 0 : 1;
                    const bFav = favoriteSet.has(b.toLowerCase()) ? 0 : 1;
                    if (aFav !== bFav) return aFav - bFav;
                    return a.localeCompare(b);
                });
            }

            if (engine.mode === 'milkdrop' && engine.initialPresetApplied) {
                applyRandomMilkdropPreset();
            } else if (engine.mdPresetNames.length > 0) {
                loadMilkdropPreset(0, 0);
            }

            console.log('Milkdrop initialized:', engine.mdPresetNames.length, 'presets');
            buildMilkdropPresetList();
        } catch (e) {
            console.error('Milkdrop init failed:', e);
        }
    }

    function loadMilkdropPreset(index, blendTime) {
        if (!engine.milkdrop || engine.mdPresetNames.length === 0) return;
        index = ((index % engine.mdPresetNames.length) + engine.mdPresetNames.length) % engine.mdPresetNames.length;
        engine.mdCurrentIdx = index;
        const name = engine.mdPresetNames[index];
        const preset = engine.mdPresets[name];
        if (preset) {
            engine.milkdrop.loadPreset(preset, blendTime);
        }
        // Update active state in list
        document.querySelectorAll('.md-preset-item').forEach((el, i) => {
            el.classList.toggle('active', parseInt(el.dataset.idx, 10) === index);
        });
        // Scroll into view
        const activeEl = document.querySelector('.md-preset-item.active');
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function nextMilkdropPreset() {
        loadMilkdropPreset(engine.mdCurrentIdx + 1, engine.mdBlendTime);
        resetCycleTimer();
    }

    function prevMilkdropPreset() {
        loadMilkdropPreset(engine.mdCurrentIdx - 1, engine.mdBlendTime);
        resetCycleTimer();
    }

    function randomMilkdropPreset() {
        const idx = Math.floor(Math.random() * engine.mdPresetNames.length);
        loadMilkdropPreset(idx, engine.mdBlendTime);
    }

    function resetCycleTimer() {
        clearInterval(engine.mdCycleTimer);
        if (engine.mdAutoCycle && !audioEl.paused) {
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
        if (engine.mode !== 'milkdrop' || !engine.milkdrop || audioEl.paused) {
            engine.mdAnimFrame = null;
            return;
        }
        engine.milkdrop.render();
        engine.mdAnimFrame = requestAnimationFrame(renderMilkdrop);
    }

    function startMilkdropRender() {
        if (engine.mdAnimFrame || audioEl.paused || engine.mode !== 'milkdrop') return;
        engine.mdAnimFrame = requestAnimationFrame(renderMilkdrop);
    }

    function syncVisualizerPlayback() {
        const isPlaying = !audioEl.paused;

        if (engine.audioMotion) {
            engine.audioMotion.isOn = isPlaying && engine.mode === 'spectrum';
        }

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

    function buildMilkdropPresetList(filter = '') {
        const list = document.getElementById('mdPresetList');
        if (!list) return;
        const filterLower = filter.toLowerCase();
        list.innerHTML = '';
        engine.mdPresetNames.forEach((name, i) => {
            if (filterLower && !name.toLowerCase().includes(filterLower)) return;
            const item = document.createElement('div');
            item.className = 'md-preset-item';
            if (i === engine.mdCurrentIdx) item.classList.add('active');
            item.dataset.idx = String(i);
            item.title = name;
            item.textContent = name;
            list.appendChild(item);
        });
    }

    // ══════════════════════════════════════════════
    //  MODE SWITCHING
    // ══════════════════════════════════════════════

    function setMode(mode) {
        engine.mode = mode;

        // Toggle canvases
        engine.amContainer.classList.toggle('mode-active', mode === 'spectrum');
        engine.mdCanvas.style.display = mode === 'milkdrop' ? 'block' : 'none';

        // Toggle control panels
        const specCtrl = document.getElementById('spectrumControls');
        const mdCtrl = document.getElementById('milkdropControls');
        if (specCtrl) specCtrl.style.display = mode === 'spectrum' ? '' : 'none';
        if (mdCtrl) mdCtrl.style.display = mode === 'milkdrop' ? '' : 'none';

        // Mode buttons
        document.querySelectorAll('.mode-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === mode);
        });

        if (mode === 'spectrum') {
            initSpectrum();
            stopMilkdropRender();
            clearInterval(engine.mdCycleTimer);
        } else {
            initMilkdrop();
            syncVisualizerPlayback();
        }

        // Keep renderer state consistent with current playback on every mode change.
        syncVisualizerPlayback();
    }

    // ══════════════════════════════════════════════
    //  UI BINDINGS
    // ══════════════════════════════════════════════

    function bindControls() {
        // ── Mode toggle ────────────────────────
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => setMode(btn.dataset.mode));
        });

        // ── Panel toggle ───────────────────────
        const panel = document.getElementById('controlPanel');
        const toggle = document.getElementById('panelToggle');
        const close = document.getElementById('panelClose');
        let panelOpen = false;

        toggle.addEventListener('click', () => {
            panelOpen = !panelOpen;
            panel.classList.toggle('open', panelOpen);
            toggle.classList.toggle('active', panelOpen);
        });
        close.addEventListener('click', () => {
            panelOpen = false;
            panel.classList.remove('open');
            toggle.classList.remove('active');
        });

        // ── Spectrum controls ──────────────────
        // Mode selector
        document.querySelectorAll('.spectrum-style-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.spectrum-style-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (engine.audioMotion) engine.audioMotion.mode = parseInt(btn.dataset.amMode);
            });
        });

        // Gradient
        bindSelect('amGradient', v => { if (engine.audioMotion) engine.audioMotion.gradient = v; });

        // Toggles
        bindToggle('amLedBars', v => { if (engine.audioMotion) engine.audioMotion.ledBars = v; });
        bindToggle('amLumiBars', v => { if (engine.audioMotion) engine.audioMotion.lumiBars = v; });
        bindToggle('amRadial', v => { if (engine.audioMotion) engine.audioMotion.radial = v; });
        bindToggle('amReflect', v => { if (engine.audioMotion) engine.audioMotion.reflexRatio = v ? 0.35 : 0; });
        bindToggle('amSplitLayout', v => { if (engine.audioMotion) engine.audioMotion.splitLayout = v; });
        bindSelect('amMirror', v => { if (engine.audioMotion) engine.audioMotion.mirror = parseInt(v); });

        bindSlider('amBarSpace', v => { if (engine.audioMotion) engine.audioMotion.barSpace = parseFloat(v); });
        bindSlider('amLineWidth', v => { if (engine.audioMotion) engine.audioMotion.lineWidth = parseFloat(v); });
        bindSlider('amFillAlpha', v => { if (engine.audioMotion) engine.audioMotion.fillAlpha = parseFloat(v); });

        // Spectrum presets
        const specGrid = document.getElementById('spectrumPresetGrid');
        if (specGrid && window.SPECTRUM_PRESETS) {
            specGrid.innerHTML = SPECTRUM_PRESETS.map((p, i) =>
                `<div class="preset-card" data-sp-idx="${i}">${p.name}</div>`
            ).join('');
            specGrid.addEventListener('click', e => {
                const card = e.target.closest('.preset-card');
                if (!card) return;
                specGrid.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                applySpectrumPreset(SPECTRUM_PRESETS[parseInt(card.dataset.spIdx)]);
            });
        }

        // ── Milkdrop controls ──────────────────
        // Preset search
        const mdSearch = document.getElementById('mdPresetSearch');
        if (mdSearch) {
            mdSearch.addEventListener('input', () => buildMilkdropPresetList(mdSearch.value));
        }

        // Preset list click
        const mdList = document.getElementById('mdPresetList');
        if (mdList) {
            mdList.addEventListener('click', e => {
                const item = e.target.closest('.md-preset-item');
                if (!item) return;
                loadMilkdropPreset(parseInt(item.dataset.idx), engine.mdBlendTime);
            });
        }

        // Auto-cycle
        bindToggle('mdAutoCycle', v => {
            engine.mdAutoCycle = v;
            resetCycleTimer();
        });
        bindSlider('mdCycleTime', v => {
            engine.mdCycleTime = parseInt(v, 10);
            resetCycleTimer();
        });
        bindSlider('mdBlendTime', v => {
            engine.mdBlendTime = parseFloat(v);
        });
    }

    // ── Helper binders ─────────────────────────
    function bindSelect(id, cb) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => cb(el.value));
    }
    function bindToggle(id, cb) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => cb(el.checked));
    }
    function bindSlider(id, cb) {
        const el = document.getElementById(id);
        const valEl = document.getElementById(id + 'Val');
        if (el) el.addEventListener('input', () => {
            if (valEl) valEl.textContent = el.value;
            cb(el.value);
        });
    }

    // ══════════════════════════════════════════════
    //  PLAYBACK CONTROLS
    // ══════════════════════════════════════════════

    const playBtn = document.getElementById('playBtn');
    const seekBar = document.getElementById('seekBar');
    const currentTimeEl = document.getElementById('currentTime');
    const totalTimeEl = document.getElementById('totalTime');
    const volumeSlider = document.getElementById('volumeSlider');
    const muteBtn = document.getElementById('muteBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const hideBarBtn = document.getElementById('hideBarBtn');
    const bottomBar = document.getElementById('bottomBar');

    function formatTime(s) {
        if (isNaN(s)) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return m + ':' + (sec < 10 ? '0' : '') + sec;
    }

    function getKnownDuration() {
        const mediaDuration = Number(audioEl.duration);
        if (Number.isFinite(mediaDuration) && mediaDuration > 0) {
            return mediaDuration;
        }
        const trackDuration = Number(window.TRACK && window.TRACK.duration);
        if (Number.isFinite(trackDuration) && trackDuration > 0) {
            return trackDuration;
        }
        return 0;
    }

    function syncDurationUI() {
        const duration = getKnownDuration();
        if (duration > 0) {
            totalTimeEl.textContent = formatTime(duration);
            seekBar.max = duration;
        }
    }

    playBtn.addEventListener('click', async () => {
        getAudioContext(); // ensure ctx created on user gesture
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        if (!audioEl.paused) {
            audioEl.pause();
        } else {
            await audioEl.play();
        }
    });

    audioEl.addEventListener('play', () => {
        playBtn.textContent = '⏸';
        syncVisualizerPlayback();
    });

    audioEl.addEventListener('pause', () => {
        playBtn.textContent = '▶';
        syncVisualizerPlayback();
    });

    audioEl.addEventListener('ended', () => {
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
    seekBar.addEventListener('input', () => {
        audioEl.currentTime = parseFloat(seekBar.value);
    });

    // Initialize seek UI even if media metadata loaded before listeners were attached.
    syncDurationUI();
    audioEl.volume = parseFloat(volumeSlider.value || '0.8');
    muteBtn.textContent = audioEl.volume > 0 ? '🔊' : '🔇';
    volumeSlider.addEventListener('input', () => {
        audioEl.volume = parseFloat(volumeSlider.value);
        muteBtn.textContent = audioEl.volume > 0 ? '🔊' : '🔇';
    });
    let prevVolume = 0.8;
    muteBtn.addEventListener('click', () => {
        if (audioEl.volume > 0) {
            prevVolume = audioEl.volume;
            audioEl.volume = 0;
            volumeSlider.value = 0;
            muteBtn.textContent = '🔇';
        } else {
            audioEl.volume = prevVolume;
            volumeSlider.value = prevVolume;
            muteBtn.textContent = '🔊';
        }
    });

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            playerPage.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen();
        }
    });

    let barHidden = false;
    hideBarBtn.addEventListener('click', () => {
        barHidden = !barHidden;
        bottomBar.classList.toggle('hidden-bar', barHidden);
        hideBarBtn.textContent = barHidden ? '⬆' : '⬇';
    });

    // Auto-hide controls
    let hideTimer;
    function showControls() {
        playerPage.classList.add('controls-visible');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            if (!audioEl.paused) {
                playerPage.classList.remove('controls-visible');
            }
        }, 3000);
    }
    playerPage.addEventListener('mousemove', showControls);
    playerPage.addEventListener('click', showControls);

    // ══════════════════════════════════════════════
    //  LYRICS SYSTEM
    // ══════════════════════════════════════════════

    const lyrics = {
        active: false,
        fetched: false,
        available: false,
        synced: false,
        // Render lyrics slightly ahead of audio clock to offset provider lag.
        syncAdvanceSec: 0.14,
        renderer: null,
        rafId: null,
    };

    const lyricsOverlay = document.getElementById('lyricsOverlay');
    const lyricsScroll = document.getElementById('lyricsScroll');
    const lyricsStatus = document.getElementById('lyricsStatus');
    const lyricsBtn = document.getElementById('lyricsBtn');

    if (window.OpenKaraokeLyricsDisplay && lyricsScroll) {
        lyrics.renderer = new window.OpenKaraokeLyricsDisplay(lyricsScroll, {
            maxLinesPerScreen: 4,
        });
    }

    // ── Fetch Lyrics ───────────────────────────
    async function fetchLyrics() {
        if (lyrics.fetched) return;
        lyrics.fetched = true;

        if (!lyrics.renderer) {
            lyrics.fetched = false;
            showLyricsStatus('Lyrics renderer unavailable');
            setTimeout(() => hideLyricsStatus(), 2500);
            return;
        }

        showLyricsStatus('Fetching lyrics...');

        try {
            const resp = await fetch(`/api/lyrics/${window.TRACK.id}/`);
            const data = await resp.json();

            if (data.lyrics && data.synced) {
                lyrics.synced = true;
                lyrics.renderer.loadSyncedLRC(data.lyrics);
                lyrics.available = true;
                showLyricsStatus('Synced karaoke lyrics loaded');
                setTimeout(() => hideLyricsStatus(), 2000);
            } else if (data.lyrics && !data.synced) {
                // Plain lyrics are converted to timed karaoke flow using reading-speed estimation.
                lyrics.synced = false;
                lyrics.renderer.loadPlainLyrics(data.lyrics);
                lyrics.available = true;
                showLyricsStatus('Plain lyrics converted to karaoke mode');
                setTimeout(() => hideLyricsStatus(), 3000);
            } else {
                lyrics.available = false;
                showLyricsStatus(data.error || 'No lyrics found');
                setTimeout(() => hideLyricsStatus(), 3000);
            }
        } catch (err) {
            lyrics.available = false;
            lyrics.fetched = false;
            showLyricsStatus('Failed to fetch lyrics');
            setTimeout(() => hideLyricsStatus(), 3000);
        }
    }

    function showLyricsStatus(msg) {
        if (lyricsStatus) {
            lyricsStatus.textContent = msg;
            lyricsStatus.classList.add('visible');
        }
    }
    function hideLyricsStatus() {
        if (lyricsStatus) lyricsStatus.classList.remove('visible');
    }

    // Sync loop
    function startLyricsSync() {
        if (lyrics.rafId || !lyrics.renderer) return;
        const tick = () => {
            if (!lyrics.active) {
                lyrics.rafId = null;
                return;
            }
            if (lyrics.available) {
                lyrics.renderer.update(Math.max(0, audioEl.currentTime + lyrics.syncAdvanceSec));
            }
            lyrics.rafId = requestAnimationFrame(tick);
        };
        lyrics.rafId = requestAnimationFrame(tick);
    }

    function stopLyricsSync() {
        if (lyrics.rafId) {
            cancelAnimationFrame(lyrics.rafId);
            lyrics.rafId = null;
        }
    }

    // ── Toggle lyrics ──────────────────────────
    function toggleLyrics() {
        if (!lyricsOverlay || !lyricsBtn) return;
        lyrics.active = !lyrics.active;
        lyricsOverlay.classList.toggle('active', lyrics.active);
        lyricsBtn.classList.toggle('active', lyrics.active);

        if (lyrics.active) {
            fetchLyrics();
            startLyricsSync();
        } else {
            stopLyricsSync();
        }
    }

    if (lyricsBtn) {
        lyricsBtn.addEventListener('click', toggleLyrics);
    }

    // ── Keyboard ───────────────────────────────
    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        switch (e.key) {
            case ' ':
                e.preventDefault(); playBtn.click(); break;
            case 'f': case 'F':
                fullscreenBtn.click(); break;
            case 'h': case 'H':
                hideBarBtn.click(); break;
            case 'n': case 'N':
                if (engine.mode === 'milkdrop') nextMilkdropPreset(); break;
            case 'p': case 'P':
                if (engine.mode === 'milkdrop') prevMilkdropPreset(); break;
            case 'r': case 'R':
                if (engine.mode === 'milkdrop') randomMilkdropPreset(); break;
            case 'ArrowLeft':
                audioEl.currentTime = Math.max(0, audioEl.currentTime - 5); break;
            case 'ArrowRight':
                audioEl.currentTime = Math.min(audioEl.duration, audioEl.currentTime + 5); break;
            case 'ArrowUp':
                audioEl.volume = Math.min(1, audioEl.volume + 0.05);
                volumeSlider.value = audioEl.volume; break;
            case 'ArrowDown':
                audioEl.volume = Math.max(0, audioEl.volume - 0.05);
                volumeSlider.value = audioEl.volume; break;
        }
    });

    // ── Window resize ──────────────────────────
    window.addEventListener('resize', () => {
        if (engine.milkdrop) {
            const dpr = window.devicePixelRatio || 1;
            engine.mdCanvas.width = window.innerWidth * dpr;
            engine.mdCanvas.height = window.innerHeight * dpr;
            engine.milkdrop.setRendererSize(engine.mdCanvas.width, engine.mdCanvas.height);
        }
    });

    // ── Initialize ─────────────────────────────
    bindControls();
    applyRandomInitialVisualizer();
})();
