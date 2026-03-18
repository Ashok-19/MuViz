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

    // ── File Upload ───────────────────────────────
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadProgress = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const selectedFile = document.getElementById('selectedFile');
    const selectedFileName = document.getElementById('selectedFileName');
    const selectedFileMeta = document.getElementById('selectedFileMeta');
    const linkForm = document.getElementById('linkForm');
    const linkInput = document.getElementById('linkInput');
    const linkSubmit = document.getElementById('linkSubmit');
    const linkStatus = document.getElementById('linkStatus');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) uploadFile(fileInput.files[0]);
    });

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

    function uploadFile(file) {
        selectedFile.hidden = false;
        selectedFileName.textContent = file.name;
        selectedFileMeta.textContent = `${formatFileSize(file.size)} • Preparing upload`;

        const formData = new FormData();
        formData.append('file', file);

        uploadProgress.classList.add('active');
        progressFill.style.width = '0%';
        progressText.textContent = 'Uploading...';

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload/');

        xhr.upload.onprogress = e => {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                progressFill.style.width = pct + '%';
                progressText.textContent = pct + '%';
                selectedFileMeta.textContent = `${formatFileSize(file.size)} • ${pct}% uploaded`;
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                progressText.textContent = 'Redirecting...';
                progressFill.style.width = '100%';
                selectedFileMeta.textContent = `${formatFileSize(file.size)} • Upload complete`;
                window.location.href = '/play/' + data.id + '/';
            } else {
                const err = JSON.parse(xhr.responseText);
                showToast(err.error || 'Upload failed');
                uploadProgress.classList.remove('active');
                selectedFileMeta.textContent = `${formatFileSize(file.size)} • Upload failed`;
            }
        };

        xhr.onerror = () => {
            showToast('Network error during upload');
            uploadProgress.classList.remove('active');
            selectedFileMeta.textContent = `${formatFileSize(file.size)} • Network error`;
        };

        xhr.send(formData);
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

                if (data.preview_only) {
                    linkStatus.textContent = 'Preview only. Opening player...';
                } else {
                    linkStatus.textContent = data.streamed
                        ? 'Link ready. Opening player...'
                        : 'Audio cached. Opening player...';
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
