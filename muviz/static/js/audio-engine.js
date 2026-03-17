/* ═══════════════════════════════════════════════
   AUDIO ENGINE — MuViz
   Web Audio API wrapper with analysis
   ═══════════════════════════════════════════════ */

class AudioEngine {
    constructor(audioElement) {
        this.audio = audioElement;
        this.ctx = null;
        this.analyser = null;
        this.source = null;
        this.initialized = false;
        this.frequencyData = null;
        this.waveformData = null;
        this.fftSize = 2048;
        this.smoothing = 0.85;
        this.sensitivity = 1.0;
        this._lastBassEnergy = 0;
        this._beatThreshold = 1.4;
        this.isBeat = false;
    }

    init() {
        if (this.initialized) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyser.smoothingTimeConstant = this.smoothing;
        this.analyser.minDecibels = -90;
        this.analyser.maxDecibels = -10;

        this.source = this.ctx.createMediaElementSource(this.audio);
        this.source.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.waveformData = new Uint8Array(this.analyser.frequencyBinCount);
        this.initialized = true;
    }

    setFFTSize(size) {
        this.fftSize = size;
        if (this.analyser) {
            this.analyser.fftSize = size;
            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            this.waveformData = new Uint8Array(this.analyser.frequencyBinCount);
        }
    }

    setSmoothing(val) {
        this.smoothing = val;
        if (this.analyser) this.analyser.smoothingTimeConstant = val;
    }

    update() {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(this.frequencyData);
        this.analyser.getByteTimeDomainData(this.waveformData);
        this._detectBeat();
    }

    _detectBeat() {
        // Simple bass-energy beat detection
        const bassEnd = Math.floor(this.frequencyData.length * 0.1);
        let sum = 0;
        for (let i = 0; i < bassEnd; i++) sum += this.frequencyData[i];
        const bassEnergy = sum / bassEnd;
        this.isBeat = bassEnergy > this._lastBassEnergy * this._beatThreshold && bassEnergy > 100;
        this._lastBassEnergy = this._lastBassEnergy * 0.9 + bassEnergy * 0.1;
    }

    // Get frequency data split into bands
    getBands() {
        const len = this.frequencyData.length;
        const band = (start, end) => {
            let sum = 0, count = 0;
            const s = Math.floor(len * start), e = Math.floor(len * end);
            for (let i = s; i < e; i++) { sum += this.frequencyData[i]; count++; }
            return count ? (sum / count) * this.sensitivity : 0;
        };
        return {
            subBass: band(0, 0.02),
            bass: band(0.02, 0.06),
            lowMid: band(0.06, 0.15),
            mid: band(0.15, 0.35),
            highMid: band(0.35, 0.6),
            high: band(0.6, 0.8),
            brilliance: band(0.8, 1),
        };
    }

    getAverageFrequency() {
        if (!this.frequencyData) return 0;
        let sum = 0;
        for (let i = 0; i < this.frequencyData.length; i++) sum += this.frequencyData[i];
        return (sum / this.frequencyData.length) * this.sensitivity;
    }

    play() {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.audio.play();
    }

    pause() { this.audio.pause(); }

    get playing() { return !this.audio.paused; }
    get currentTime() { return this.audio.currentTime; }
    set currentTime(v) { this.audio.currentTime = v; }
    get duration() { return this.audio.duration || 0; }
    get volume() { return this.audio.volume; }
    set volume(v) { this.audio.volume = Math.max(0, Math.min(1, v)); }
}

window.AudioEngine = AudioEngine;
