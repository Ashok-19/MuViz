# MuViz

MuViz is a Django music visualizer app with two playback/visual modes and karaoke-style lyrics.

***Demo -> [MuViz](https://muviz.onrender.com/)*** 

(might experience some delays in loading times because of free tier hosting)

## Main Features

- Upload local audio files (single or multi-file queue upload, up to 10 files per batch).
- Ingest remote audio links (SoundCloud, Internet Archive, direct audio URL).
- Play audio in a full-screen visualizer player.
- Navigate queued tracks with on-screen previous/next controls.
- Switch between:
  - Milkdrop mode (`butterchurn`)
  - Spectrum mode (`audiomotion-analyzer`)
- Control playback (seek, volume, mute, fullscreen, hide controls, keyboard shortcuts).
- Show synced lyrics with progressive per-word highlight and availability-aware UI state.
- Cache resolved LRC lyrics on the track record.

## Recent Visualizer Upgrades

- Quality-scored Milkdrop catalog with profile filters: `ultra`, `high`, `balanced`, `all`.
- Favorites-only filtering and weighted random preset selection.
- Beat-reactive Milkdrop switching with sensitivity control.
- Expanded preset sources via bundled extra packs (`Extra`, `Extra2`, `MD1`) plus curated weekly internet presets.
- Startup gate overlay in player so interactions unlock only after queue and lyric preparation completes.

## Tech Stack

- Backend: Django 5
- Database: SQLite by default (PostgreSQL via `DATABASE_URL`)
- Audio metadata: `mutagen`
- Remote ingestion/lyrics HTTP calls: `requests`
- SoundCloud resolution/download: `yt-dlp`
- Static serving in deployment: `whitenoise`
- Frontend: Django templates + vanilla JS + CSS

## Current Source Types

`Track.source` values:

- `upload`
- `soundcloud`
- `internet_archive`
- `remote_url`
- `youtube` (legacy value retained for existing records)

Notes:

- SoundCloud is loaded as cached file download in backend flow.
- If SoundCloud formats are preview-only, `preview_only=true` is stored and a warning is shown in player UI.
- Internet Archive and direct URLs may stream directly if CORS + byte-range headers are available; otherwise they are cached locally.

## Project Layout

```text
forge-website/
  manage.py
  requirements.txt
  build.sh
  Dockerfile
  render.yaml
  muviz/
    settings.py
    urls.py
  visualizer/
    models.py
    views.py
    urls.py
    forms.py
    services/
      lyrics.py
      remote_audio.py
    migrations/
    tests.py
  templates/visualizer/
    base.html
    index.html
    player.html
  static/
    css/
      design-system.css
      layout.css
      visualizer.css
    js/
      app.js
      presets.js
      visualizer-engine.js
      open-karaoke-lyrics.js
      audio-engine.js
  media/
    tracks/
```

Static file note:

- Runtime static files are taken from top-level `static/` (`STATICFILES_DIRS` in `muviz/settings.py`).
- `muviz/static/` contains duplicates and is not the primary runtime source.

## Local Setup

1. Create and activate virtual environment.

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. Install dependencies.

```bash
pip install -r requirements.txt
```

3. Run migrations.

```bash
python manage.py migrate
```

4. Start server.

```bash
python manage.py runserver
```

5. Open:

```text
http://127.0.0.1:8000/
```

## Environment and Settings

Defined in `muviz/settings.py`.

- `SECRET_KEY` (required in production)
- `DEBUG` (default: `True`)
- `ALLOWED_HOSTS` (CSV, default: `*`)
- `DATABASE_URL` (optional, enables non-SQLite DB)
- `CSRF_TRUSTED_ORIGINS` (CSV)
- `MEDIA_ROOT` (default: `<BASE_DIR>/media`)

Upload constraints:

- Max size: 50 MB
- Allowed extensions: `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`, `.webm`

## API Endpoints

- `GET /` -> landing page
- `GET /play/<track_id>/` -> player page
- `POST /api/upload/` -> upload local file
- `POST /api/link/` -> ingest remote link (JSON or form)
- `GET /api/presets/` -> list presets
- `POST /api/presets/save/` -> create custom preset
- `DELETE /api/presets/<preset_id>/delete/` -> delete non-built-in preset
- `GET /api/lyrics/<track_id>/` -> lyrics availability + provider metadata
- `GET /api/lyrics/<track_id>/lrc/` -> normalized LRC plain text

## Data Models

### Track

- Metadata: `title`, `artist`, `album`, `duration`
- Storage and playback: `file`, `playback_url`, `mime_type`, `file_size`
- Source fields: `source`, `source_url`, `source_identifier`
- Lyrics cache: `lyrics_lrc`
- Remote status: `preview_only`
- Helper properties: `audio_url`, `has_audio_source`

### Preset

- `name`
- `config` (JSON)
- `is_builtin`

## Player Behavior

Player template: `templates/visualizer/player.html`

Frontend orchestration: `static/js/visualizer-engine.js`

- Creates Web Audio context and media element source.
- Initializes selected visualizer mode on demand.
- Default mode is `milkdrop`.
- Supports Milkdrop preset browsing/search/auto-cycle plus quality profiles and beat-reactive transitions.
- Supports Spectrum style + gradient + reflection/radial/mirror controls.
- Handles play/pause/seek/volume/mute/fullscreen/hide-controls.
- Supports queue navigation controls and queue status display when multiple tracks are queued.
- Locks interactive controls during startup preparation and unlocks after lyrics precheck/preload stage.
- Fetches and renders LRC lyrics through `OpenKaraokeLyricsDisplay`.

Keyboard shortcuts:

- `Space`: play/pause
- `L`: lyrics on/off
- `F`: fullscreen
- `H`: hide/show bottom bar
- `N`: next Milkdrop preset
- `P`: previous Milkdrop preset
- `R`: random Milkdrop preset
- `B`: toggle beat-reactive Milkdrop switching
- `[`: previous track in queue
- `]`: next track in queue
- `Left/Right`: seek -/+ 5 seconds
- `Up/Down`: volume -/+ 5%

## Lyrics Resolution Flow

Backend service: `visualizer/services/lyrics.py`

Resolution order:

1. Use cached `Track.lyrics_lrc` if available.
2. Query LRCLIB (`https://lrclib.net/api/search`).
3. Fallback to `syncedlyrics` package lookup.
4. If only plain lyrics are found, estimate timestamps into LRC.

Frontend renderer: `static/js/open-karaoke-lyrics.js`

- Parses synced and plain lyrics.
- Rebuilds compact/collapsed text into display tokens.
- Computes per-word progress and highlights active word segment.

## Development Commands

```bash
python manage.py check
python manage.py makemigrations
python manage.py migrate
python manage.py test
```

Current test status in this workspace:

- `python manage.py test visualizer` runs 12 tests.
- All 12 tests are passing.

## Deployment

### Render

- Build: `bash build.sh`
- Start: `gunicorn muviz.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 180`

### Docker

```bash
docker build -t muviz .
docker run -p 8000:8000 muviz
```

Container startup command runs `collectstatic`, `migrate`, then `gunicorn`.

## Troubleshooting

- Upload rejected: check extension/size limits in `muviz/settings.py`.
- Visualizer not rendering: check CDN access for `butterchurn`, `butterchurn-presets`, `audiomotion-analyzer`.
- Lyrics not available: provider may not have track data; app returns `available=false`.
- Frontend changes not appearing: hard refresh the browser to clear cached static assets.
