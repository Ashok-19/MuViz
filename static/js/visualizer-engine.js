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
    const bottomBar = document.getElementById('bottomBar');
    const lyricsOverlay = document.getElementById('lyricsOverlay');
    const lyricsDisplay = document.getElementById('lyricsDisplay');
    const lyricsStatus = document.getElementById('lyricsStatus');
    const lyricsBtn = document.getElementById('lyricsBtn');

    let audioCtx = null;
    let sourceNode = null;

    function ensureAudioPipeline() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            sourceNode = audioCtx.createMediaElementSource(audioEl);
            sourceNode.connect(audioCtx.destination);
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
        mdPresets: {},
        mdPresetNames: [],
        mdCurrentIdx: 0,
        mdInitialPresetChosen: false,
        mdBlendTime: 1.5,
        mdAutoCycle: true,
        mdCycleTime: 5,
        mdCycleTimer: null,
        mdAnimFrame: null,
        audioMotion: null,
        amContainer: document.getElementById('spectrumContainer'),
    };

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

    function initMilkdrop() {
        if (engine.milkdrop || !audioCtx) return;
        if (typeof butterchurn === 'undefined') {
            console.warn('butterchurn not loaded');
            return;
        }

        const canvas = engine.mdCanvas;
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

            let presets = null;
            if (typeof butterchurnPresets !== 'undefined') {
                const bp = butterchurnPresets.default || butterchurnPresets;
                if (typeof bp.getPresets === 'function') {
                    presets = bp.getPresets();
                } else if (typeof bp === 'object') {
                    presets = bp;
                }
            }

            if (presets && typeof presets === 'object') {
                engine.mdPresets = presets;
                engine.mdPresetNames = Object.keys(presets).sort((a, b) => a.localeCompare(b));
            }

            if (engine.mdPresetNames.length > 0) {
                if (!engine.mdInitialPresetChosen) {
                    engine.mdCurrentIdx = Math.floor(Math.random() * engine.mdPresetNames.length);
                    engine.mdInitialPresetChosen = true;
                }
                loadMilkdropPreset(engine.mdCurrentIdx, 0);
            }

            buildMilkdropPresetList();
            console.log('Milkdrop initialized:', engine.mdPresetNames.length, 'presets');
        } catch (error) {
            console.error('Milkdrop init failed:', error);
        }
    }

    function loadMilkdropPreset(index, blendTime) {
        if (!engine.milkdrop || engine.mdPresetNames.length === 0) return;
        const length = engine.mdPresetNames.length;
        const safeIndex = ((index % length) + length) % length;
        engine.mdCurrentIdx = safeIndex;
        const name = engine.mdPresetNames[safeIndex];
        const preset = engine.mdPresets[name];
        if (preset) {
            engine.milkdrop.loadPreset(preset, blendTime);
        }

        document.querySelectorAll('.md-preset-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.idx, 10) === safeIndex);
        });
        const activeItem = document.querySelector('.md-preset-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
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
        if (!engine.mdPresetNames.length) return;
        const index = Math.floor(Math.random() * engine.mdPresetNames.length);
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
        if (engine.mode !== 'milkdrop' || !engine.milkdrop || audioEl.paused) {
            engine.mdAnimFrame = null;
            return;
        }
        engine.milkdrop.render();
        engine.mdAnimFrame = requestAnimationFrame(renderMilkdrop);
    }

    function startMilkdropRender() {
        if (engine.mdAnimFrame || audioEl.paused || engine.mode !== 'milkdrop' || !engine.milkdrop) return;
        engine.mdAnimFrame = requestAnimationFrame(renderMilkdrop);
    }

    function buildMilkdropPresetList(filter = '') {
        const list = document.getElementById('mdPresetList');
        if (!list) return;
        const filterText = filter.toLowerCase();
        list.innerHTML = '';
        engine.mdPresetNames.forEach((name, index) => {
            if (filterText && !name.toLowerCase().includes(filterText)) return;
            const item = document.createElement('div');
            item.className = 'md-preset-item';
            item.dataset.idx = String(index);
            item.textContent = name;
            item.title = name;
            if (index === engine.mdCurrentIdx) item.classList.add('active');
            list.appendChild(item);
        });
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
        synced: false,
        renderer: null,
        rafId: null,
        syncAdvanceSec: 0.12,
    };

    if (window.OpenKaraokeLyricsDisplay && lyricsDisplay) {
        lyrics.renderer = new window.OpenKaraokeLyricsDisplay(lyricsDisplay);
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

    async function fetchLyrics() {
        if (lyrics.fetched || !window.TRACK || !window.TRACK.lyricsUrl) return;
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
            lyrics.synced = true;
            lyrics.available = true;
            showLyricsStatus('Synced lyrics loaded');
        } catch (error) {
            lyrics.fetched = false;
            lyrics.available = false;
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
                lyrics.renderer.update(Math.max(0, audioEl.currentTime + lyrics.syncAdvanceSec));
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
            engine.milkdrop.setRendererSize(engine.mdCanvas.width, engine.mdCanvas.height);
        }
    });

    bindControls();
    syncDurationUI();
    setMode('milkdrop');
})();
