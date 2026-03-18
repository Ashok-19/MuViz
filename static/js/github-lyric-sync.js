/*
    GitHub Lyric Sync Adapter (MuViz)
    Uses the MIT-licensed Liricle project:
    https://github.com/mcanam/liricle
*/

(function () {
    'use strict';

    const MIN_WORD_DURATION_SEC = 0.08;
    const DEFAULT_LAST_LINE_DURATION_SEC = 3.2;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    class OpenKaraokeLyricsDisplay {
        constructor(container) {
            this.container = container;
            this.loaded = false;
            this.singleLineEl = null;
            this.liricle = null;
            this.currentLineText = '';
            this.currentLineIndex = -1;
            this.currentWordIndex = -1;
            this.currentTime = 0;
            this.data = null;
            this.lineWordMap = new Map();
            this.lineTimeline = [];
            this.wordSpans = [];

            if (!window.Liricle) {
                throw new Error('Liricle is not loaded');
            }

            this.liricle = new window.Liricle();
            this.liricle.on('sync', (line, word) => {
                this._onSync(line, word);
            });

            this.liricle.on('load', (data) => {
                this.loaded = true;
                this.data = data || null;
                this._buildLineWordMap(this.data);
            });

            this.liricle.on('loaderror', () => {
                this.loaded = false;
                this.data = null;
                this.lineWordMap = new Map();
                this.lineTimeline = [];
            });

            this._resetDOM();
        }

        _resetDOM() {
            if (!this.container) return;
            this.container.innerHTML = '';
            this.singleLineEl = document.createElement('div');
            this.singleLineEl.className = 'okl-single-line';
            this.container.appendChild(this.singleLineEl);
        }

        clear() {
            this.loaded = false;
            this.currentLineText = '';
            this.currentLineIndex = -1;
            this.currentWordIndex = -1;
            this.currentTime = 0;
            this.data = null;
            this.lineWordMap = new Map();
            this.lineTimeline = [];
            this.wordSpans = [];
            this._resetDOM();
        }

        _tokenizeLine(text) {
            return String(text || '')
                .replace(/\s+/g, ' ')
                .trim()
                .split(' ')
                .filter(Boolean);
        }

        _buildLineWordMap(data) {
            const map = new Map();
            const timeline = [];
            const lines = Array.isArray(data && data.lines) ? data.lines : [];
            const enhanced = !!(data && data.enhanced);

            lines.forEach((line, index) => {
                const lineStart = Number.isFinite(Number(line && line.time)) ? Number(line.time) : 0;
                const nextLine = lines[index + 1];
                const nextLineTime = Number(nextLine && nextLine.time);
                const lineEnd = Number.isFinite(nextLineTime) && nextLineTime > lineStart
                    ? nextLineTime
                    : lineStart + DEFAULT_LAST_LINE_DURATION_SEC;

                let words = [];
                const enhancedWords = enhanced && Array.isArray(line && line.words)
                    ? line.words.filter(word => word && String(word.text || '').trim())
                    : [];

                if (enhancedWords.length) {
                    words = enhancedWords.map((word, wordIndex) => {
                        const wordStart = Number.isFinite(Number(word.time)) ? Number(word.time) : lineStart;
                        const nextWord = enhancedWords[wordIndex + 1];
                        const nextWordTime = Number(nextWord && nextWord.time);
                        const safeEnd = Number.isFinite(nextWordTime) && nextWordTime > wordStart
                            ? nextWordTime
                            : Math.max(lineEnd, wordStart + MIN_WORD_DURATION_SEC);

                        return {
                            text: String(word.text || '').trim(),
                            start: wordStart,
                            end: safeEnd,
                        };
                    });
                } else {
                    const tokens = this._tokenizeLine(line && line.text);
                    if (!tokens.length) {
                        map.set(index, {
                            text: String((line && line.text) || '').trim(),
                            start: lineStart,
                            end: lineEnd,
                            words: [],
                        });
                        return;
                    }

                    const span = Math.max(MIN_WORD_DURATION_SEC * tokens.length, lineEnd - lineStart);
                    const step = span / tokens.length;

                    words = tokens.map((token, wordIndex) => {
                        const start = lineStart + step * wordIndex;
                        const end = wordIndex === tokens.length - 1
                            ? lineStart + span
                            : lineStart + step * (wordIndex + 1);
                        return {
                            text: token,
                            start,
                            end: Math.max(end, start + MIN_WORD_DURATION_SEC),
                        };
                    });
                }

                map.set(index, {
                    text: String((line && line.text) || '').trim(),
                    start: lineStart,
                    end: lineEnd,
                    words,
                });

                timeline.push({
                    index,
                    start: lineStart,
                    end: lineEnd,
                    text: String((line && line.text) || '').trim(),
                });
            });

            this.lineWordMap = map;
            this.lineTimeline = timeline;
        }

        _findLineIndexByStartTime(timeSeconds) {
            if (!this.lineTimeline.length || !Number.isFinite(timeSeconds)) return -1;

            let lo = 0;
            let hi = this.lineTimeline.length - 1;
            let best = -1;

            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                const start = this.lineTimeline[mid].start;
                if (start <= timeSeconds) {
                    best = mid;
                    lo = mid + 1;
                } else {
                    hi = mid - 1;
                }
            }

            if (best < 0) return -1;
            return this.lineTimeline[best].index;
        }

        _resolveLineIndexFromSyncLine(line) {
            const directIndex = Number(line && line.index);
            if (Number.isFinite(directIndex) && directIndex >= 0) {
                return directIndex;
            }

            const startTime = Number(line && line.time);
            if (Number.isFinite(startTime)) {
                const byTime = this._findLineIndexByStartTime(startTime);
                if (byTime >= 0) return byTime;
            }

            const text = String((line && line.text) || '').trim();
            if (!text) return -1;

            for (const [idx, entry] of this.lineWordMap.entries()) {
                if (String(entry && entry.text || '').trim() === text) {
                    return idx;
                }
            }

            return -1;
        }

        loadSyncedLRC(lrcText) {
            const text = String(lrcText || '').trim();
            if (!text) {
                this.clear();
                return;
            }

            this.clear();

            this.liricle.load({
                text,
                skipBlankLine: true,
            });

            // Some builds emit load synchronously. Prime state immediately when available.
            if (this.liricle.data) {
                this.loaded = true;
                this.data = this.liricle.data;
                this._buildLineWordMap(this.data);
            }
        }

        // Backward-compatible fallback if plain text is ever supplied.
        loadPlainLyrics(text) {
            this.clear();
            const asLrc = String(text || '')
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean)
                .map((line, idx) => {
                    const seconds = idx * 2;
                    const mins = Math.floor(seconds / 60);
                    const secs = seconds % 60;
                    const minText = mins < 10 ? '0' + mins : String(mins);
                    const secText = secs < 10 ? '0' + secs : String(secs);
                    return '[' + minText + ':' + secText + '.00] ' + line;
                })
                .join('\n');

            if (asLrc) {
                this.loadSyncedLRC(asLrc);
            }
        }

        _renderLine(lineText) {
            if (!this.singleLineEl) return;

            if (!lineText) {
                this.singleLineEl.textContent = '';
                this.singleLineEl.classList.remove('active');
                return;
            }

            this.singleLineEl.textContent = lineText;
            this.singleLineEl.classList.add('active');
        }

        _renderLineWords(lineIndex, fallbackLineText = '') {
            if (!this.singleLineEl) return;

            const line = this.lineWordMap.get(lineIndex);
            if (!line || !line.words.length) {
                this.wordSpans = [];

                const safeText = String(fallbackLineText || (line ? line.text : '') || '').trim();
                if (!safeText) {
                    this._renderLine('');
                    return;
                }

                const tokens = this._tokenizeLine(safeText);
                if (tokens.length > 1) {
                    this.singleLineEl.innerHTML = '';
                    this.singleLineEl.classList.add('active');
                    tokens.forEach(token => {
                        const wordEl = document.createElement('span');
                        wordEl.className = 'okl-word past';
                        wordEl.textContent = token;
                        wordEl.dataset.text = token;
                        wordEl.style.setProperty('--okl-progress', '100%');
                        this.singleLineEl.appendChild(wordEl);
                    });

                    this.singleLineEl.classList.remove('line-enter');
                    void this.singleLineEl.offsetWidth;
                    this.singleLineEl.classList.add('line-enter');
                    return;
                }

                this._renderLine(safeText);
                return;
            }

            this.singleLineEl.innerHTML = '';
            this.singleLineEl.classList.add('active');
            this.wordSpans = [];

            line.words.forEach((word, index) => {
                const wordEl = document.createElement('span');
                wordEl.className = 'okl-word';
                wordEl.textContent = word.text;
                wordEl.dataset.text = word.text;
                wordEl.dataset.wordIndex = String(index);
                wordEl.style.setProperty('--okl-progress', '0%');
                this.singleLineEl.appendChild(wordEl);
                this.wordSpans.push(wordEl);
            });

            this.singleLineEl.classList.remove('line-enter');
            void this.singleLineEl.offsetWidth;
            this.singleLineEl.classList.add('line-enter');
        }

        _onSync(line, word) {
            if (!this.singleLineEl) return;

            if (!line || !line.text) {
                if (this.currentLineText !== '') {
                    this.currentLineText = '';
                    this.currentLineIndex = -1;
                    this.currentWordIndex = -1;
                    this.wordSpans = [];
                    this._renderLine('');
                }
                return;
            }

            const lineText = String(line.text || '').trim();
            const lineIndex = this._resolveLineIndexFromSyncLine(line);

            if (lineText !== this.currentLineText || lineIndex !== this.currentLineIndex) {
                this.currentLineText = lineText;
                this.currentLineIndex = lineIndex;
                this.currentWordIndex = (word && Number.isFinite(Number(word.index))) ? Number(word.index) : -1;
                this._renderLineWords(lineIndex, lineText);
            }

            if (word && word.text) {
                this.singleLineEl.dataset.currentWord = String(word.text);
                this.currentWordIndex = Number.isFinite(Number(word.index)) ? Number(word.index) : this.currentWordIndex;
            } else if (this.singleLineEl.dataset.currentWord) {
                delete this.singleLineEl.dataset.currentWord;
                this.currentWordIndex = -1;
            }
        }

        _updateWordProgress() {
            if (!this.wordSpans.length || this.currentLineIndex < 0) return;

            const line = this.lineWordMap.get(this.currentLineIndex);
            if (!line || !line.words.length) return;

            const now = this.currentTime;

            this.wordSpans.forEach((wordEl, index) => {
                const word = line.words[index];
                if (!word) return;

                const start = Number.isFinite(word.start) ? word.start : line.start;
                const end = Number.isFinite(word.end) ? word.end : Math.max(start + MIN_WORD_DURATION_SEC, line.end);
                const duration = Math.max(MIN_WORD_DURATION_SEC, end - start);
                const progress = clamp((now - start) / duration, 0, 1);

                wordEl.style.setProperty('--okl-progress', `${progress * 100}%`);
                wordEl.classList.toggle('past', progress >= 1);

                const fromEnhanced = this.currentWordIndex >= 0;
                const isFocused = fromEnhanced
                    ? this.currentWordIndex === index
                    : (progress > 0 && progress < 1);

                wordEl.classList.toggle('active', isFocused);
                wordEl.classList.toggle('focus', isFocused);
            });
        }

        update(timeSeconds) {
            if (!this.loaded) return;

            const safeTime = Number(timeSeconds);
            if (!Number.isFinite(safeTime)) {
                return;
            }

            this.currentTime = Math.max(0, safeTime);

            // Use continuous mode so seek/scrub and rapid timing updates stay exact.
            this.liricle.sync(this.currentTime, true);
            this._updateWordProgress();
        }

        getTimingProfile() {
            const durations = [];
            this.lineWordMap.forEach(line => {
                line.words.forEach(word => {
                    const duration = Number(word.end) - Number(word.start);
                    if (Number.isFinite(duration) && duration > 0) {
                        durations.push(duration);
                    }
                });
            });

            const sum = durations.reduce((acc, value) => acc + value, 0);
            const min = durations.length ? Math.min(...durations) : 0;
            const max = durations.length ? Math.max(...durations) : 0;
            const avg = durations.length ? sum / durations.length : 0;

            return {
                hasEnhancedWords: !!(this.data && this.data.enhanced),
                avgWordDuration: avg,
                minWordDuration: min,
                maxWordDuration: max,
                wordCount: durations.length,
            };
        }
    }

    // Keep the same global name used by visualizer-engine.js.
    window.OpenKaraokeLyricsDisplay = OpenKaraokeLyricsDisplay;
})();
