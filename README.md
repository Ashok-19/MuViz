# MuViz

MuViz is a Django-based music visualizer web app.
It supports:
- local audio upload
- real-time visualization (Milkdrop + spectrum mode)
- synced lyric overlay with karaoke-style word highlighting

## What You Get

- Upload audio files and start visualizing immediately
- Two visualizer engines in one player:
  - Milkdrop presets via `butterchurn`
  - Spectrum mode via `audiomotion-analyzer`
- Customization panel for presets and visualizer options
- Karaoke-like lyric rendering with smooth screen transitions and progressive word highlight

## Tech Stack

- Backend: Django 5
- Database: SQLite (`db.sqlite3`)
- Audio metadata: `mutagen`
- Frontend: Django templates + vanilla JS + CSS
- Visualizer libraries (loaded from CDN):
  - `butterchurn`
  - `butterchurn-presets`
  - `audiomotion-analyzer`

## Repository Layout

```text
forge-website/
  manage.py
  db.sqlite3
  requirements.txt
  README.md
  muviz/
    settings.py
    urls.py
  visualizer/
    models.py
    views.py
    urls.py
    forms.py
    migrations/
  templates/
    visualizer/
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
      audio-engine.js
      presets.js
      visualizer-engine.js
      open-karaoke-lyrics.js
  media/
    tracks/
```

## Prerequisites

- Python 3.10+
- Internet access (for CDN scripts and lyric lookup)

Optional but recommended:
- `syncedlyrics` package for automatic lyric search (the app calls it in `api_lyrics`)

## Installation

1. Create and activate a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Install lyric dependency (optional but enables automatic lyric fetch):

```bash
pip install syncedlyrics
```

4. Apply migrations:

```bash
python manage.py migrate
```

5. Run the development server:

```bash
python manage.py runserver
```

6. Open:

```text
http://127.0.0.1:8000/
```

## Configuration

Core settings are in `muviz/settings.py`.

Important defaults:
- `DEBUG = True`
- `ALLOWED_HOSTS = ['*']`
- max upload size: 50 MB
- allowed upload extensions:
  - `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`, `.webm`

For production, change at minimum:
- `SECRET_KEY`
- `DEBUG`
- `ALLOWED_HOSTS`
- static/media serving strategy

## How the Player Works

The player page (`templates/visualizer/player.html`) includes:
- audio element for playback
- Milkdrop canvas
- spectrum container
- right-side customization panel
- lyrics overlay

`static/js/visualizer-engine.js` orchestrates:
- audio context creation
- visualizer mode switching
- preset loading and cycling
- playback controls (seek, mute, fullscreen)
- lyric fetch + sync loop

### Default Visualizer Behavior

Current default mode is **Milkdrop**.
The panel opens with Milkdrop controls active by default.

### Milkdrop Presets

- Presets are loaded from `butterchurn-presets`
- Favorites from `static/js/presets.js` are sorted to the top
- Preset list supports search and keyboard navigation

Keyboard shortcuts in player:
- `Space`: play/pause
- `L`: toggle lyrics
- `F`: fullscreen
- `H`: hide/show bottom bar
- `N`: next Milkdrop preset
- `P`: previous Milkdrop preset
- `R`: random Milkdrop preset
- `Left/Right`: seek -/+ 5s
- `Up/Down`: volume up/down

## Lyrics System

Lyrics endpoint: `GET /api/lyrics/<track_id>/`

Backend behavior:
- returns cached synced LRC when available
- otherwise tries to fetch synced lyrics using `syncedlyrics`
- falls back to plain lyrics if synced lyrics are not found

Frontend behavior:
- `static/js/open-karaoke-lyrics.js` renders karaoke screens
- synced lyrics: line timing + per-word progressive highlight
- plain lyrics: converted to estimated timed flow for smooth display

### Open-Source Integration Note

The karaoke renderer is inspired by the MIT-licensed project:
- `jonesy827/karaoke-lrc-player`

Adapted concepts include:
- screen-based lyric grouping
- active line emphasis
- progressive word highlighting

## API Endpoints

Base routes are defined in `visualizer/urls.py`.

- `GET /` -> landing page
- `GET /play/<track_id>/` -> visualizer player
- `POST /api/upload/` -> upload local audio
- `GET /api/presets/` -> list saved presets
- `POST /api/presets/save/` -> save custom preset
- `DELETE /api/presets/<preset_id>/delete/` -> delete non-built-in preset
- `GET /api/lyrics/<track_id>/` -> fetch lyrics data

## Data Models

`Track`:
- metadata (title, artist, album, duration)
- file path and mime data
- source type
- cached synced lyric text (`lyrics_lrc`)

`Preset`:
- `name`
- JSON `config`
- `is_builtin`

## Development Commands

Run Django checks:

```bash
python manage.py check
```

Create migrations after model changes:

```bash
python manage.py makemigrations
python manage.py migrate
```

## Troubleshooting

### Lyrics return errors
- Install `syncedlyrics`:

```bash
pip install syncedlyrics
```

- Some tracks may not have available synced lyrics in providers

### Visualizer library does not load
- Player depends on CDN scripts in `player.html`
- Verify internet access and browser console errors

### Uploaded file rejected
- Check extension and file size constraints in `muviz/settings.py`

## Notes

- This project currently uses SQLite and debug-friendly settings.
- Media files are stored under `media/tracks/`.
- No production deployment configuration is included by default.
# MuViz
