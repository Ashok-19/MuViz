/*
    Open Karaoke Lyrics Renderer (MuViz integration)
    Adapted from ideas in the MIT-licensed project:
    https://github.com/jonesy827/karaoke-lrc-player
*/

(function () {
    'use strict';

    const COMMON_WORDS = new Set([
        'a', 'about', 'after', 'again', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
        'baby', 'back', 'be', 'been', 'before', 'being', 'best', 'better', 'but', 'by',
        'can', 'come', 'day', 'did', 'do', 'done', 'dont', 'down', 'dream',
        'every', 'face', 'feel', 'for', 'from', 'get', 'girl', 'go', 'gonna', 'good', 'got',
        'had', 'has', 'have', 'he', 'heart', 'her', 'here', 'him', 'his', 'how',
        'i', 'if', 'im', 'in', 'into', 'is', 'it', 'its', 'just', 'know', 'la', 'let', 'like',
        'look', 'love', 'made', 'make', 'me', 'mind', 'more', 'my', 'need', 'never', 'no',
        'not', 'now', 'of', 'oh', 'on', 'one', 'or', 'our', 'out', 'over',
        'said', 'say', 'see', 'she', 'so', 'some', 'starboy', 'still', 'take', 'tell',
        'that', 'the', 'their', 'them', 'then', 'there', 'they', 'this', 'time', 'to',
        'told', 'try', 'up', 'us', 've', 'was', 'we', 'what', 'when', 'where', 'who',
        'why', 'will', 'with', 'wont', 'word', 'worry', 'would', 'you', 'your', 'youre',
        'a', 'agora', 'ai', 'alarissinha', 'amor', 'baby', 'boca', 'bota', 'cara', 'com',
        'comer', 'dar', 'de', 'do', 'e', 'ela', 'ele', 'em', 'entao', 'eu', 'hoje', 'me',
        'minha', 'na', 'nao', 'novinho', 'o', 'olhou', 'onde', 'ou', 'para', 'pe', 'por',
        'pra', 'pro', 'quiser', 'quis', 'se', 'so', 'sua', 'te', 'tem', 'todo', 'turn', 'vinho',
        'vou', 'voce', 'voces', 'we', 'weeknd', 'yeah',
    ]);

    const MIN_WORD_DURATION_SEC = 0.03;
    const MAX_WORD_DURATION_SEC = 2.2;
    const DEFAULT_LAST_LINE_SPAN_SEC = 4.2;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    class OpenKaraokeParser {
        static tokenTimingWeight(token) {
            const text = String(token || '');
            if (!text) return 1;

            if (/^[,.;:!?"'()\-]+$/.test(text)) {
                return 0.45;
            }

            const clean = text
                .toLowerCase()
                .replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');

            if (!clean) return 0.65;

            const len = clean.length;
            if (len <= 2) return 0.72;
            if (len <= 4) return 1;
            if (len <= 7) return 1.25;
            return clamp(1.25 + (len - 7) * 0.1, 1.25, 2.15);
        }

        static buildWeightedWordTimeline(tokens, startTime, endTime) {
            const clean = tokens.filter(Boolean);
            if (!clean.length) return [];

            const safeStart = Number.isFinite(startTime) ? startTime : 0;
            const safeEnd = Number.isFinite(endTime) ? endTime : safeStart + DEFAULT_LAST_LINE_SPAN_SEC;
            const span = Math.max(MIN_WORD_DURATION_SEC * clean.length, safeEnd - safeStart);

            const minTotalDuration = MIN_WORD_DURATION_SEC * clean.length;
            if (span <= minTotalDuration + 0.001) {
                const perWord = Math.max(0.01, span / clean.length);
                return clean.map((text, index) => ({
                    text,
                    timestamp: safeStart + perWord * index,
                    duration: perWord,
                }));
            }

            const weights = clean.map(token => this.tokenTimingWeight(token));
            const totalWeight = weights.reduce((sum, value) => sum + value, 0) || clean.length;
            const stretchableSpan = Math.max(0, span - minTotalDuration);

            let cursor = safeStart;
            return clean.map((text, index) => {
                const extra = (weights[index] / totalWeight) * stretchableSpan;
                const duration = clamp(MIN_WORD_DURATION_SEC + extra, MIN_WORD_DURATION_SEC, MAX_WORD_DURATION_SEC);
                const word = {
                    text,
                    timestamp: cursor,
                    duration,
                };
                cursor += duration;
                return word;
            });
        }

        static retimeWords(tokens, startTime, endTime) {
            return this.buildWeightedWordTimeline(tokens, startTime, endTime);
        }

        static expandEnhancedWordTimeline(words, lineStart, lineEnd) {
            const source = Array.isArray(words) ? words.filter(Boolean) : [];
            if (!source.length) return [];

            const safeLineStart = Number.isFinite(lineStart) ? lineStart : 0;
            const safeLineEnd = Number.isFinite(lineEnd) ? Math.max(safeLineStart, lineEnd) : safeLineStart + DEFAULT_LAST_LINE_SPAN_SEC;
            const expanded = [];

            for (let index = 0; index < source.length; index++) {
                const currentWord = source[index];
                const nextWord = source[index + 1];
                const segmentStart = clamp(
                    Number.isFinite(currentWord.timestamp) ? currentWord.timestamp : safeLineStart,
                    safeLineStart,
                    Math.max(safeLineStart, safeLineEnd - MIN_WORD_DURATION_SEC)
                );
                const segmentEnd = clamp(
                    nextWord && Number.isFinite(nextWord.timestamp) ? nextWord.timestamp : safeLineEnd,
                    segmentStart + MIN_WORD_DURATION_SEC,
                    safeLineEnd
                );
                const tokens = this.tokenizeDisplayWords(currentWord.text);

                if (tokens.length <= 1) {
                    expanded.push({
                        text: tokens[0] || currentWord.text,
                        timestamp: segmentStart,
                        duration: clamp(segmentEnd - segmentStart, MIN_WORD_DURATION_SEC, MAX_WORD_DURATION_SEC),
                    });
                    continue;
                }

                const retimedTokens = this.buildWeightedWordTimeline(tokens, segmentStart, segmentEnd);
                retimedTokens.forEach(token => expanded.push(token));
            }

            return expanded;
        }

        static tokenizeDisplayWords(text) {
            const normalized = this.normalizeCompactLyricText((text || '').replace(/\u00A0/g, ' ').trim());
            if (!normalized) return [];

            const atomRegex = /[A-Za-zÀ-ÿ0-9']+|[.,!?;:()"-]+/g;
            const atoms = normalized.match(atomRegex) || [normalized];
            const expanded = [];

            for (const atom of atoms) {
                if (/^[A-Za-zÀ-ÿ0-9']+$/.test(atom)) {
                    expanded.push(...this.expandToken(atom));
                } else {
                    expanded.push(atom);
                }
            }

            const merged = [];
            for (const token of expanded) {
                if (!token) continue;

                if (/^[,.;!?)]$/.test(token) && merged.length) {
                    merged[merged.length - 1] += token;
                    continue;
                }

                if (token === '(' && merged.length) {
                    merged.push(token);
                    continue;
                }

                if (merged.length && merged[merged.length - 1] === '(') {
                    merged[merged.length - 1] = '(' + token;
                    continue;
                }

                merged.push(token);
            }

            return merged.filter(tok => tok && tok !== ')').map(tok => tok.replace(/^\($/, '').trim()).filter(Boolean);
        }

        static normalizeCompactLyricText(text) {
            if (!text) return '';

            const tokens = text.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
            const expanded = [];
            for (const token of tokens) {
                expanded.push(...this.expandToken(token));
            }

            let normalized = expanded.join(' ');
            normalized = normalized
                .replace(/\s+([,.;!?])/g, '$1')
                .replace(/([([{"'])\s+/g, '$1')
                .replace(/\s+([)\]}"'])/g, '$1')
                .replace(/\s+/g, ' ')
                .trim();

            return normalized;
        }

        static expandToken(token) {
            const prefixMatch = token.match(/^[^A-Za-z0-9']+/);
            const suffixMatch = token.match(/[^A-Za-z0-9']+$/);
            const prefix = prefixMatch ? prefixMatch[0] : '';
            const suffix = suffixMatch ? suffixMatch[0] : '';
            const core = token.slice(prefix.length, token.length - suffix.length);

            if (!core) return [token];

            // Split camelCase/PascalCase first.
            if (/([a-z])([A-Z])/.test(core)) {
                const parts = core.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
                if (parts.length > 1) {
                    parts[0] = prefix + parts[0];
                    parts[parts.length - 1] = parts[parts.length - 1] + suffix;
                    return parts;
                }
            }

            if (core.length < 8 || /\d/.test(core)) {
                return [token];
            }

            const splitSegments = this.segmentByDictionary(core);
            if (splitSegments.length <= 1) {
                return [token];
            }

            splitSegments[0] = prefix + splitSegments[0];
            splitSegments[splitSegments.length - 1] = splitSegments[splitSegments.length - 1] + suffix;
            return splitSegments;
        }

        static segmentByDictionary(core) {
            const source = core;
            const lower = source.toLowerCase();
            const n = lower.length;
            const dp = new Array(n + 1).fill(Number.NEGATIVE_INFINITY);
            const prev = new Array(n + 1).fill(-1);

            dp[0] = 0;

            for (let i = 0; i < n; i++) {
                if (!Number.isFinite(dp[i])) continue;

                const maxLen = Math.min(n, i + 18);
                for (let j = i + 1; j <= maxLen; j++) {
                    const piece = lower.slice(i, j);
                    const compact = piece.replace(/'/g, '');
                    const len = j - i;

                    let score = Number.NEGATIVE_INFINITY;
                    if (COMMON_WORDS.has(piece) || COMMON_WORDS.has(compact)) {
                        score = len * len;
                    } else if (len >= 3 && /[aeiouy]/.test(piece)) {
                        score = -4 - len * 0.4;
                    }

                    if (!Number.isFinite(score)) continue;
                    const cand = dp[i] + score;
                    if (cand > dp[j]) {
                        dp[j] = cand;
                        prev[j] = i;
                    }
                }
            }

            if (prev[n] === -1) {
                return [core];
            }

            const spans = [];
            let cur = n;
            while (cur > 0 && prev[cur] !== -1) {
                spans.push([prev[cur], cur]);
                cur = prev[cur];
            }
            if (cur !== 0) {
                return [core];
            }

            spans.reverse();
            const words = spans.map(([s, e]) => source.slice(s, e));

            // Guard against pathological splits.
            const badSplit = words.some(w => w.length === 1 && !/^[aAiI]$/.test(w));
            if (badSplit || words.length <= 1) {
                return [core];
            }

            return words;
        }

        static parseTimestamp(raw) {
            const match = raw.match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
            if (!match) return null;
            const mins = parseInt(match[1], 10);
            const secs = parseInt(match[2], 10);
            const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
            return mins * 60 + secs + ms / 1000;
        }

        static parseEnhancedWords(text) {
            const words = [];
            const regex = /<(\d{1,2}:\d{2}(?:\.\d{1,3})?)>([^<]+)/g;
            let match;
            while ((match = regex.exec(text)) !== null) {
                const time = this.parseTimestamp(match[1]);
                const wordText = match[2].trim();
                if (time === null || !wordText) continue;
                words.push({ text: wordText, timestamp: time, duration: 0.2 });
            }
            return words;
        }

        static estimateWords(lineText, startTime, endTime) {
            const tokens = this.tokenizeDisplayWords(lineText);
            if (!tokens.length) return [];
            return this.buildWeightedWordTimeline(tokens, startTime, endTime);
        }

        parseSyncedLRC(lrcText) {
            const parsed = [];
            const rows = lrcText.split(/\r?\n/);
            let offsetSeconds = 0;

            for (const row of rows) {
                const offsetMatch = row.match(/^\[offset:([+-]?\d+)\]/i);
                if (offsetMatch) {
                    offsetSeconds = parseInt(offsetMatch[1], 10) / 1000;
                    break;
                }
            }

            for (const rawRow of rows) {
                if (!rawRow.trim()) {
                    continue;
                }

                // Skip metadata tags like [ar:...], [ti:...], [al:...]
                if (/^\[[a-zA-Z]+:[^\]]*\]\s*$/.test(rawRow.trim())) {
                    continue;
                }

                const stampRegex = /\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g;
                const timeStamps = [];
                let stampMatch;
                while ((stampMatch = stampRegex.exec(rawRow)) !== null) {
                    const ts = OpenKaraokeParser.parseTimestamp(stampMatch[1]);
                    if (ts !== null) timeStamps.push(ts);
                }

                if (!timeStamps.length) {
                    continue;
                }

                const lyricText = rawRow.replace(stampRegex, '').trim();
                const wordsFromEnhanced = OpenKaraokeParser.parseEnhancedWords(lyricText);
                const cleanLyricTextRaw = wordsFromEnhanced.length
                    ? lyricText.replace(/<(\d{1,2}:\d{2}(?:\.\d{1,3})?)>/g, '').replace(/\s+/g, ' ').trim()
                    : lyricText;
                const cleanLyricText = OpenKaraokeParser.normalizeCompactLyricText(cleanLyricTextRaw);

                for (const time of timeStamps) {
                    parsed.push({
                        isBreak: false,
                        lineTimestamp: time,
                        rawText: cleanLyricText,
                        hasEnhancedWords: wordsFromEnhanced.length > 0,
                        words: wordsFromEnhanced.length
                            ? wordsFromEnhanced.map(word => ({ ...word }))
                            : null,
                        isInstrumental: /(^|\s)(♪|instrumental)(\s|$)/i.test(cleanLyricText),
                    });
                }
            }

            const timed = parsed.filter(line => !line.isBreak).sort((a, b) => a.lineTimestamp - b.lineTimestamp);

            for (let i = 0; i < timed.length; i++) {
                const curr = timed[i];
                const next = timed[i + 1];
                curr.endTime = next ? next.lineTimestamp : curr.lineTimestamp + DEFAULT_LAST_LINE_SPAN_SEC;

                curr.lineTimestamp = Math.max(0, curr.lineTimestamp + offsetSeconds);
                curr.endTime = Math.max(curr.lineTimestamp + 0.2, curr.endTime + offsetSeconds);

                if (!curr.words || !curr.words.length) {
                    curr.words = OpenKaraokeParser.estimateWords(curr.rawText, curr.lineTimestamp, curr.endTime);
                } else {
                    curr.words = curr.words
                        .map(word => ({
                            ...word,
                            timestamp: Math.max(0, word.timestamp + offsetSeconds),
                        }))
                        .sort((a, b) => a.timestamp - b.timestamp);

                    if (curr.words.length) {
                        const firstWordTs = curr.words[0].timestamp;
                        curr.lineTimestamp = Math.min(curr.lineTimestamp, firstWordTs);
                    }

                    for (let w = 0; w < curr.words.length; w++) {
                        const currentWord = curr.words[w];
                        const nextWord = curr.words[w + 1];
                        const safeWordTime = clamp(currentWord.timestamp, curr.lineTimestamp, curr.endTime - MIN_WORD_DURATION_SEC);
                        currentWord.timestamp = safeWordTime;
                        const end = nextWord ? nextWord.timestamp : curr.endTime;
                        currentWord.duration = clamp(end - currentWord.timestamp, MIN_WORD_DURATION_SEC, MAX_WORD_DURATION_SEC);
                    }

                    curr.words = OpenKaraokeParser.expandEnhancedWordTimeline(curr.words, curr.lineTimestamp, curr.endTime);
                }

                // For non-enhanced lines, rebuild from visible text when parsing produced collapsed tokens.
                const displayTokens = OpenKaraokeParser.tokenizeDisplayWords(curr.rawText);
                if (!curr.hasEnhancedWords && displayTokens.length > 1 && (curr.words.length <= 1 || displayTokens.length >= curr.words.length + 2)) {
                    curr.words = OpenKaraokeParser.retimeWords(displayTokens, curr.lineTimestamp, curr.endTime);
                }
            }

            return timed;
        }

        parsePlainLyrics(text) {
            const lines = text
                .split(/\r?\n/)
                .map(line => OpenKaraokeParser.normalizeCompactLyricText(line.trim()))
                .filter(Boolean);
            const result = [];
            let cursor = 0;

            for (const line of lines) {
                const wordCount = Math.max(1, line.split(/\s+/).filter(Boolean).length);
                const lineDuration = clamp(wordCount * 0.55, 2.2, 6.5);
                const lineData = {
                    isBreak: false,
                    lineTimestamp: cursor,
                    endTime: cursor + lineDuration,
                    rawText: line,
                    words: OpenKaraokeParser.retimeWords(OpenKaraokeParser.tokenizeDisplayWords(line), cursor, cursor + lineDuration),
                    isInstrumental: false,
                };
                result.push(lineData);
                cursor += lineDuration;
            }

            return result;
        }
    }

    class OpenKaraokeLyricsDisplay {
        constructor(container) {
            this.container = container;
            this.parser = new OpenKaraokeParser();
            this.lines = [];
            this.loaded = false;
            this.currentLineIndex = -1;
            this.currentWords = [];
            this.singleLineEl = null;
            this.timingProfile = {
                hasEnhancedWords: false,
                avgWordDuration: 0,
                minWordDuration: 0,
                maxWordDuration: 0,
                wordCount: 0,
            };
        }

        loadSyncedLRC(lrcText) {
            const parsed = this.parser.parseSyncedLRC(lrcText || '');
            this._loadLines(parsed);
        }

        loadPlainLyrics(text) {
            const parsed = this.parser.parsePlainLyrics(text || '');
            this._loadLines(parsed);
        }

        clear() {
            this.currentLineIndex = -1;
            this.loaded = false;
            this.lines = [];
            this.currentWords = [];
            this.container.innerHTML = '';
            this.singleLineEl = null;
        }

        _loadLines(lines) {
            this.clear();
            if (!lines.length) return;
            this.lines = lines;

            const durations = [];
            let hasEnhancedWords = false;
            lines.forEach(line => {
                if (line.hasEnhancedWords) {
                    hasEnhancedWords = true;
                }
                (line.words || []).forEach(word => {
                    if (Number.isFinite(word.duration) && word.duration > 0) {
                        durations.push(word.duration);
                    }
                });
            });

            if (durations.length) {
                const total = durations.reduce((sum, value) => sum + value, 0);
                this.timingProfile = {
                    hasEnhancedWords,
                    avgWordDuration: total / durations.length,
                    minWordDuration: Math.min(...durations),
                    maxWordDuration: Math.max(...durations),
                    wordCount: durations.length,
                };
            } else {
                this.timingProfile = {
                    hasEnhancedWords,
                    avgWordDuration: 0,
                    minWordDuration: 0,
                    maxWordDuration: 0,
                    wordCount: 0,
                };
            }

            this.singleLineEl = document.createElement('div');
            this.singleLineEl.className = 'okl-single-line';
            this.container.appendChild(this.singleLineEl);
            this.loaded = true;
        }

        getTimingProfile() {
            return { ...this.timingProfile };
        }

        _lineIndexAt(time) {
            if (!this.lines.length) return -1;
            let lo = 0;
            let hi = this.lines.length - 1;
            let result = -1;

            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                if (this.lines[mid].lineTimestamp <= time) {
                    result = mid;
                    lo = mid + 1;
                } else {
                    hi = mid - 1;
                }
            }

            if (result === -1) return -1;
            const current = this.lines[result];
            if (time >= current.endTime) return -1;
            return result;
        }

        _renderLine(line) {
            if (!this.singleLineEl) return;
            this.currentWords = [];
            this.singleLineEl.innerHTML = '';

            if (!line || !line.rawText || !line.rawText.trim()) {
                this.singleLineEl.classList.remove('active');
                return;
            }

            this.singleLineEl.classList.add('active');

            if (line.isInstrumental) {
                this.singleLineEl.textContent = '♪ Instrumental ♪';
                this.singleLineEl.classList.add('okl-line-instrumental');
                return;
            }

            this.singleLineEl.classList.remove('okl-line-instrumental');

            line.words.forEach(word => {
                const wordEl = document.createElement('span');
                wordEl.className = 'okl-word';
                wordEl.textContent = word.text;
                wordEl.dataset.text = word.text;
                wordEl.dataset.timestamp = String(word.timestamp);
                wordEl.dataset.duration = String(word.duration || 0.4);
                this.singleLineEl.appendChild(wordEl);
                this.currentWords.push(wordEl);
            });
        }

        update(time) {
            if (!this.loaded || !this.singleLineEl) return;

            const activeIdx = this._lineIndexAt(time);

            if (activeIdx !== this.currentLineIndex) {
                this.currentLineIndex = activeIdx;
                const line = activeIdx >= 0 ? this.lines[activeIdx] : null;
                this._renderLine(line);
            }

            this.currentWords.forEach(wordEl => {
                const timestamp = parseFloat(wordEl.dataset.timestamp || '0');
                const duration = Math.max(MIN_WORD_DURATION_SEC, parseFloat(wordEl.dataset.duration || '0.3'));
                const progress = clamp((time - timestamp) / duration, 0, 1);

                wordEl.style.setProperty('--okl-progress', `${progress * 100}%`);
                wordEl.classList.toggle('past', progress >= 1);
                wordEl.classList.toggle('active', progress > 0 && progress < 1);
            });
        }
    }

    window.OpenKaraokeLyricsDisplay = OpenKaraokeLyricsDisplay;
})();
