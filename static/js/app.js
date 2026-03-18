/* ═══════════════════════════════════════════════
   LANDING PAGE APP — MuViz
   ═══════════════════════════════════════════════ */

(function () {
    'use strict';

    // ── Theme Toggle ──────────────────────────────
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('muviz-theme', theme);
        themeIcon.innerHTML = theme === 'dark'
            ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
            : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    }

    const savedTheme = localStorage.getItem('muviz-theme') || 'light';
    setTheme(savedTheme);

    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
    });

    // ── Toast ──────────────────────────────────────
    const toast = document.getElementById('toast');
    function showToast(msg, type = 'error') {
        toast.textContent = msg;
        toast.className = `toast ${type} show`;
        setTimeout(() => toast.classList.remove('show'), 3500);
    }

    // ── Upload + Queue + Lyrics Prefetch ─────────
    const MAX_PERSISTED_QUEUE = 500;
    const QUEUE_STORAGE_KEY = 'muviz-play-queue';
    const LYRICS_STATUS_STORAGE_KEY = 'muviz-lyrics-status';

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadProgress = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const selectedFile = document.getElementById('selectedFile');
    const selectedFileName = document.getElementById('selectedFileName');
    const selectedFileMeta = document.getElementById('selectedFileMeta');
    const queuedUpload = document.getElementById('queuedUpload');
    const queuedUploadTitle = document.getElementById('queuedUploadTitle');
    const queuedUploadList = document.getElementById('queuedUploadList');
    const startQueueBtn = document.getElementById('startQueueBtn');
    const clearQueueBtn = document.getElementById('clearQueueBtn');
    const linkForm = document.getElementById('linkForm');
    const linkInput = document.getElementById('linkInput');
    const linkSubmit = document.getElementById('linkSubmit');
    const linkStatus = document.getElementById('linkStatus');

    const stagedUploads = [];
    const stagedUploadKeys = new Set();

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
            // No-op if storage is unavailable.
        }
    }

    function updateLyricsStatusCache(trackId, available) {
        const map = safeReadJSON(LYRICS_STATUS_STORAGE_KEY, {});
        map[String(trackId)] = !!available;
        safeWriteJSON(LYRICS_STATUS_STORAGE_KEY, map);
    }

    function normalizeQueueTrack(track) {
        if (!track || track.id === undefined || track.id === null) return null;
        return {
            id: Number(track.id),
            title: track.title || 'Unknown Track',
            artist: track.artist || '',
            source: track.source || 'upload',
        };
    }

    function persistQueue(tracks, options = {}) {
        const append = options.append !== false;
        const incoming = (tracks || [])
            .map(normalizeQueueTrack)
            .filter(Boolean);

        const existingQueue = safeReadJSON(QUEUE_STORAGE_KEY, {});
        const existingTracks = Array.isArray(existingQueue.tracks)
            ? existingQueue.tracks.map(normalizeQueueTrack).filter(Boolean)
            : [];

        const merged = append ? existingTracks.concat(incoming) : incoming;
        const deduped = [];
        const seen = new Set();

        for (let i = merged.length - 1; i >= 0; i -= 1) {
            const track = merged[i];
            if (!track || seen.has(track.id)) continue;
            seen.add(track.id);
            deduped.push(track);
        }

        deduped.reverse();
        const finalTracks = deduped.slice(-MAX_PERSISTED_QUEUE);

        safeWriteJSON(QUEUE_STORAGE_KEY, {
            tracks: finalTracks,
            createdAt: Date.now(),
        });

        return finalTracks;
    }

    function updateProgress(percent, text) {
        uploadProgress.classList.add('active');
        progressFill.style.width = Math.max(0, Math.min(100, percent)) + '%';
        progressText.textContent = text;
    }

    function toUploadFileKey(file) {
        return [file.name, file.size, file.lastModified].join('::');
    }

    function renderQueuedUploads() {
        const count = stagedUploads.length;
        const totalBytes = stagedUploads.reduce((sum, file) => sum + (file.size || 0), 0);

        if (!count) {
            selectedFile.hidden = true;
            if (queuedUpload) queuedUpload.hidden = true;
            if (startQueueBtn) startQueueBtn.disabled = true;
            if (clearQueueBtn) clearQueueBtn.disabled = true;
            return;
        }

        selectedFile.hidden = false;
        selectedFileName.textContent = count + (count === 1 ? ' track queued' : ' tracks queued');
        selectedFileMeta.textContent = formatFileSize(totalBytes) + ' total • Add more files or start processing';

        if (queuedUpload) queuedUpload.hidden = false;
        if (queuedUploadTitle) {
            queuedUploadTitle.textContent = count + (count === 1 ? ' track queued' : ' tracks queued');
        }

        if (queuedUploadList) {
            queuedUploadList.innerHTML = '';
            stagedUploads.forEach(file => {
                const item = document.createElement('div');
                item.className = 'queued-upload-item';

                const name = document.createElement('span');
                name.className = 'queued-upload-item-name';
                name.textContent = file.name;

                const size = document.createElement('span');
                size.className = 'queued-upload-item-size';
                size.textContent = formatFileSize(file.size);

                item.appendChild(name);
                item.appendChild(size);
                queuedUploadList.appendChild(item);
            });
        }

        if (startQueueBtn) startQueueBtn.disabled = false;
        if (clearQueueBtn) clearQueueBtn.disabled = false;
    }

    function stageUploadFiles(filesInput) {
        const incoming = Array.from(filesInput || []);
        if (!incoming.length) return;

        let added = 0;
        let duplicates = 0;

        incoming.forEach(file => {
            const key = toUploadFileKey(file);
            if (stagedUploadKeys.has(key)) {
                duplicates += 1;
                return;
            }
            stagedUploadKeys.add(key);
            stagedUploads.push(file);
            added += 1;
        });

        renderQueuedUploads();

        if (!added && duplicates) {
            showToast('These files are already in the queued upload list.');
            return;
        }

        if (duplicates) {
            showToast('Added ' + added + ' file(s). Skipped ' + duplicates + ' duplicate(s).', 'success');
        } else {
            showToast('Added ' + added + ' file(s) to queued upload.', 'success');
        }
    }

    function clearStagedUploads() {
        stagedUploads.length = 0;
        stagedUploadKeys.clear();
        renderQueuedUploads();
    }

    function showSelectedFiles(files) {
        if (!files.length) return;
        selectedFile.hidden = false;

        if (files.length === 1) {
            selectedFileName.textContent = files[0].name;
            selectedFileMeta.textContent = formatFileSize(files[0].size) + ' • Preparing upload';
            return;
        }

        const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
        selectedFileName.textContent = files.length + ' tracks selected';
        selectedFileMeta.textContent = formatFileSize(totalBytes) + ' total • Queue mode';
    }

    async function uploadSingleFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload/', {
            method: 'POST',
            body: formData,
        });

        let payload = {};
        try {
            payload = await response.json();
        } catch (_) {
            payload = {};
        }

        if (!response.ok) {
            throw new Error(payload.error || 'Upload failed for ' + file.name);
        }

        return payload;
    }

    async function resolveLyricsAvailability(trackId) {
        try {
            const response = await fetch('/api/lyrics/' + trackId + '/', {
                headers: { Accept: 'application/json' },
            });

            if (!response.ok) return { available: false };
            const payload = await response.json();
            return { available: !!payload.available };
        } catch (_) {
            return { available: false };
        }
    }

    async function uploadFiles(filesInput) {
        const files = Array.from(filesInput || []);
        if (!files.length) return;

        showSelectedFiles(files);

        const uploadedTracks = [];
        const missingLyrics = [];
        const totalSteps = files.length * 2;

        for (let i = 0; i < files.length; i += 1) {
            const file = files[i];
            const stepBase = i * 2;

            updateProgress((stepBase / totalSteps) * 100, 'Uploading ' + (i + 1) + '/' + files.length + ': ' + file.name);
            selectedFileMeta.textContent = formatFileSize(file.size) + ' • Uploading';
            const track = await uploadSingleFile(file);

            updateProgress(((stepBase + 1) / totalSteps) * 100, 'Checking lyrics ' + (i + 1) + '/' + files.length + '...');
            const lyrics = typeof track.lyrics_available === 'boolean'
                ? { available: track.lyrics_available }
                : await resolveLyricsAvailability(track.id);
            updateLyricsStatusCache(track.id, lyrics.available);

            if (!lyrics.available) {
                missingLyrics.push(track.title || file.name);
            }

            uploadedTracks.push({
                id: track.id,
                title: track.title,
                artist: track.artist,
                source: track.source,
                lyricsAvailable: lyrics.available,
            });

            selectedFileMeta.textContent = (i + 1) + '/' + files.length + ' queued';
            updateProgress(((stepBase + 2) / totalSteps) * 100, 'Prepared ' + (i + 1) + '/' + files.length + ' tracks');
        }

        persistQueue(uploadedTracks, { append: true });

        if (missingLyrics.length) {
            const message = missingLyrics.length === 1
                ? 'Lyrics are not available for: ' + missingLyrics[0]
                : 'Lyrics are not available for ' + missingLyrics.length + ' queued tracks';
            showToast(message);
        }

        updateProgress(100, 'Opening queue player...');
        window.location.href = '/play/' + uploadedTracks[0].id + '/';
    }

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (!e.dataTransfer.files.length) return;

        stageUploadFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', () => {
        if (!fileInput.files.length) return;

        stageUploadFiles(fileInput.files);
        fileInput.value = '';
    });

    if (clearQueueBtn) {
        clearQueueBtn.addEventListener('click', clearStagedUploads);
    }

    if (startQueueBtn) {
        startQueueBtn.addEventListener('click', async () => {
            if (!stagedUploads.length) {
                showToast('Add files to the upload queue first.');
                return;
            }

            startQueueBtn.disabled = true;
            if (clearQueueBtn) clearQueueBtn.disabled = true;

            try {
                await uploadFiles(stagedUploads);
            } catch (error) {
                showToast(error.message || 'Queue upload failed');
                uploadProgress.classList.remove('active');
                selectedFileMeta.textContent = 'Upload failed';
                startQueueBtn.disabled = false;
                if (clearQueueBtn) clearQueueBtn.disabled = false;
            }
        });
    }

    renderQueuedUploads();

    function formatFileSize(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return 'Unknown size';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex += 1;
        }
        const precision = unitIndex === 0 ? 0 : 1;
        return `${size.toFixed(precision)} ${units[unitIndex]}`;
    }

    if (linkForm && linkInput && linkSubmit && linkStatus) {
        linkForm.addEventListener('submit', async e => {
            e.preventDefault();
            const url = linkInput.value.trim();
            if (!url) return;

            linkStatus.hidden = false;
            linkStatus.textContent = 'Resolving link...';
            linkSubmit.disabled = true;
            linkInput.disabled = true;

            try {
                const response = await fetch('/api/link/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url }),
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Link import failed');
                }

                linkStatus.textContent = data.preview_only
                    ? 'Preview only source detected. Checking lyrics...'
                    : 'Audio ready. Checking lyrics...';

                const lyrics = typeof data.lyrics_available === 'boolean'
                    ? { available: data.lyrics_available }
                    : await resolveLyricsAvailability(data.id);
                updateLyricsStatusCache(data.id, lyrics.available);
                persistQueue([{
                    id: data.id,
                    title: data.title,
                    artist: data.artist,
                    source: data.source,
                }], { append: true });

                if (!lyrics.available) {
                    linkStatus.textContent = 'Lyrics are not available for this track. Opening player...';
                } else {
                    linkStatus.textContent = 'Lyrics ready. Opening player...';
                }

                window.location.href = '/play/' + data.id + '/';
            } catch (error) {
                linkStatus.textContent = error.message || 'Link import failed';
                showToast(linkStatus.textContent);
            } finally {
                linkSubmit.disabled = false;
                linkInput.disabled = false;
            }
        });
    }

    // ── Preview Animations ────────────────────────
    function animatePreviews() {
        const cards = document.querySelectorAll('.preview-card canvas');
        cards.forEach(canvas => {
            const ctx = canvas.getContext('2d');
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width * 2;
            canvas.height = rect.height * 2;
            ctx.scale(2, 2);
            const w = rect.width, h = rect.height;
            const type = canvas.parentElement.dataset.viz;

            function draw(t) {
                ctx.clearRect(0, 0, w, h);

                if (type === 'bars') {
                    const bars = 12;
                    const bw = w / (bars * 2);
                    for (let i = 0; i < bars; i++) {
                        const val = (Math.sin(t * 0.003 + i * 0.5) + 1) * 0.5;
                        const bh = val * h * 0.6;
                        const x = (w - bars * bw * 2) / 2 + i * bw * 2;
                        const gradient = ctx.createLinearGradient(0, h, 0, h - bh);
                        gradient.addColorStop(0, '#C15F3C');
                        gradient.addColorStop(1, '#F59E0B');
                        ctx.fillStyle = gradient;
                        ctx.beginPath();
                        ctx.roundRect(x, h - bh, bw, bh, 2);
                        ctx.fill();
                    }
                } else if (type === 'waveform') {
                    ctx.beginPath();
                    ctx.strokeStyle = '#C15F3C';
                    ctx.lineWidth = 2;
                    for (let x = 0; x < w; x++) {
                        const y = h / 2 + Math.sin(x * 0.05 + t * 0.004) * h * 0.25
                            + Math.sin(x * 0.02 + t * 0.002) * h * 0.1;
                        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                } else if (type === 'circular') {
                    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.25;
                    const segs = 32;
                    for (let i = 0; i < segs; i++) {
                        const angle = (i / segs) * Math.PI * 2 - Math.PI / 2;
                        const val = (Math.sin(t * 0.003 + i * 0.4) + 1) * 0.5;
                        const len = r + val * r * 0.6;
                        const x1 = cx + Math.cos(angle) * r;
                        const y1 = cy + Math.sin(angle) * r;
                        const x2 = cx + Math.cos(angle) * len;
                        const y2 = cy + Math.sin(angle) * len;
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.strokeStyle = `hsl(${(i / segs) * 360}, 70%, 60%)`;
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }
                } else if (type === 'particles') {
                    for (let i = 0; i < 40; i++) {
                        const px = (Math.sin(t * 0.001 + i * 1.3) + 1) * 0.5 * w;
                        const py = (Math.cos(t * 0.0015 + i * 0.8) + 1) * 0.5 * h;
                        const s = 1.5 + Math.sin(t * 0.005 + i) * 1;
                        ctx.beginPath();
                        ctx.arc(px, py, s, 0, Math.PI * 2);
                        ctx.fillStyle = `hsla(${(i * 9) % 360}, 70%, 70%, 0.8)`;
                        ctx.fill();
                    }
                }

                requestAnimationFrame(draw);
            }
            requestAnimationFrame(draw);
        });
    }

    animatePreviews();
})();
