# 🎵 Forge — Music Visualizer Web Application

> A premium, interactive music visualizer built with Django + Web Audio API, inspired by Claude.ai's elegant design language.

---

## 1. Vision & Overview

**Forge** transforms audio into stunning, real-time visual experiences. Users can upload local music files or paste YouTube links to generate immersive, highly customizable visualizations powered by the Web Audio API, Canvas, and WebGL shaders.

### Core Principles
- **Simplicity** — Clean, minimal interface inspired by Claude.ai's warm, human-centric design
- **Beauty** — Premium visualizations with GLSL shaders, particle systems, and fluid animations
- **Customization** — Deep control over every visual parameter, from presets to pixel-level tuning
- **Performance** — Smooth 60fps rendering via Canvas/WebGL with efficient audio analysis

---

## 2. Design System (Claude.ai-Inspired)

### 2.1 Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Display/Logo | **Styrene A** (or fallback: **Inter**) | 600–700 | 28–36px |
| Headings | **Inter** | 500–600 | 18–24px |
| Body | **Inter** | 400 | 14–16px |
| Mono/Labels | **JetBrains Mono** | 400 | 12–13px |

> **Note**: Styrene is a licensed commercial font by Berton Hasebe. We'll use **Inter** as the primary sans-serif with Styrene-inspired letter-spacing and proportions. For exact replication, the user can supply Styrene web fonts.

### 2.2 Color Palette

```
 ┌──────────────────────────────────────────────────────┐
 │  WARM NEUTRALS (Backgrounds)                         │
 │  ──────────────────────────                          │
 │  Pampas       #F4F3EE   — Primary background        │
 │  Linen        #FAF9F6   — Card surfaces              │
 │  Cloudy       #B1ADA1   — Muted text/borders         │
 │  Stone        #8A8578   — Secondary text              │
 │                                                       │
 │  ACCENT COLORS                                       │
 │  ──────────────────────────                          │
 │  Crail        #C15F3C   — Primary accent (terracotta)│
 │  Crail Hover  #A84E30   — Hover state                │
 │  Crail Light  #E8A990   — Subtle highlights           │
 │                                                       │
 │  DARK MODE                                           │
 │  ──────────────────────────                          │
 │  Charcoal     #1A1A1A   — Dark background            │
 │  Graphite     #2A2A28   — Dark card surfaces          │
 │  Warm Gray    #3A3A37   — Dark borders                │
 │  Off White    #E8E6E1   — Dark mode text              │
 │                                                       │
 │  VISUALIZER ACCENT PALETTE                           │
 │  ──────────────────────────                          │
 │  Amber        #F59E0B   — Warm glow                  │
 │  Rose         #F43F5E   — Bass pulse                  │
 │  Violet       #8B5CF6   — Mid frequencies             │
 │  Cyan         #06B6D4   — High frequencies            │
 │  Emerald      #10B981   — Energy indicator            │
 └──────────────────────────────────────────────────────┘
```

### 2.3 UI Patterns

- **Generous whitespace** — Claude-like breathing room between elements
- **Soft shadows** — `box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`
- **Rounded corners** — `border-radius: 12px` for cards, `8px` for inputs, `24px` for pills
- **Subtle borders** — `1px solid rgba(0,0,0,0.06)` — barely visible structure
- **Micro-animations** — 200ms ease transitions on hover/focus, spring-physics for toggles
- **Glassmorphism** — Frosted glass panels for controls overlay on visualizer canvas
- **No harsh contrasts** — Warm, welcoming feel over clinical sterility

---

## 3. Architecture

### 3.1 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Django 5.x | File upload, YouTube proxy, API endpoints |
| **Database** | SQLite | Track metadata, presets, user sessions |
| **YouTube** | yt-dlp | Server-side audio extraction from YouTube URLs |
| **Audio Processing** | FFmpeg | Audio format conversion, normalization |
| **Frontend** | Vanilla JS + HTML/CSS | UI framework |
| **Audio Analysis** | Web Audio API | Real-time frequency/waveform data extraction |
| **Rendering** | Canvas 2D + WebGL (Three.js) | Visualization rendering engine |
| **Shaders** | GLSL | GPU-accelerated visual effects |

### 3.2 Project Structure

```
forge-website/
├── manage.py
├── requirements.txt
├── forge/                          # Django project settings
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
│
├── visualizer/                     # Main Django app
│   ├── __init__.py
│   ├── models.py                   # Track, Preset, VisualizerConfig
│   ├── views.py                    # Upload, YouTube fetch, API
│   ├── urls.py
│   ├── forms.py                    # Upload form validation
│   ├── services/
│   │   ├── __init__.py
│   │   ├── youtube.py              # yt-dlp wrapper service
│   │   └── audio.py                # FFmpeg audio processing
│   ├── templates/
│   │   └── visualizer/
│   │       ├── base.html           # Base template with design system
│   │       ├── index.html          # Landing / home page
│   │       └── player.html         # Main visualizer player page
│   └── templatetags/
│       └── visualizer_tags.py      # Custom template filters
│
├── static/
│   ├── css/
│   │   ├── design-system.css       # Variables, reset, typography
│   │   ├── components.css          # Buttons, inputs, cards, modals
│   │   ├── layout.css              # Page layouts, responsive grid
│   │   └── visualizer.css          # Visualizer-specific styles
│   │
│   ├── js/
│   │   ├── app.js                  # Main application controller
│   │   ├── audio-engine.js         # Web Audio API wrapper
│   │   ├── visualizer-engine.js    # Rendering orchestrator
│   │   ├── visualizers/
│   │   │   ├── bars.js             # Frequency bars visualizer
│   │   │   ├── waveform.js         # Waveform visualizer
│   │   │   ├── circular.js         # Circular/radial visualizer
│   │   │   ├── particles.js        # Particle system visualizer
│   │   │   ├── spectrum.js         # 3D spectrum visualizer
│   │   │   ├── nebula.js           # Nebula/fluid shader visualizer
│   │   │   ├── terrain.js          # Audio-reactive terrain
│   │   │   └── kaleidoscope.js     # Kaleidoscope mirror effect
│   │   ├── controls.js             # UI controls & customization panel
│   │   ├── presets.js              # Preset management
│   │   ├── youtube.js              # YouTube URL handler
│   │   └── utils.js                # Shared utilities
│   │
│   ├── shaders/
│   │   ├── nebula.frag             # Nebula fragment shader
│   │   ├── particles.vert          # Particle vertex shader
│   │   ├── particles.frag          # Particle fragment shader
│   │   ├── glow.frag               # Glow post-processing
│   │   └── blur.frag               # Gaussian blur shader
│   │
│   └── fonts/
│       └── inter/                  # Self-hosted Inter font files
│
└── media/
    └── tracks/                     # Uploaded audio files (gitignored)
```

### 3.3 Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   User Input     │────▶│   Django Backend  │────▶│  Audio File URL  │
│                  │     │                  │     │  (served via      │
│  • File Upload   │     │  • Validate      │     │   MEDIA_URL)     │
│  • YouTube URL   │     │  • Store file    │     └────────┬─────────┘
│                  │     │  • yt-dlp fetch  │              │
└─────────────────┘     └──────────────────┘              │
                                                           ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Visualizer     │◀───│  Web Audio API   │◀────│  Audio Element   │
│   Canvas/WebGL   │     │                  │     │  (<audio> tag)   │
│                  │     │  • AnalyserNode  │     │                  │
│  • 60fps render  │     │  • FFT data      │     │  • Play/Pause    │
│  • GLSL shaders  │     │  • Waveform data │     │  • Seek/Volume   │
│  • Particles     │     │  • BPM detection │     │  • Time display  │
└─────────────────┘     └──────────────────┘     └──────────────────┘
                                ▲
                                │
                         ┌──────┴──────┐
                         │  Controls    │
                         │  Panel       │
                         │             │
                         │ • Presets   │
                         │ • Colors   │
                         │ • Speed    │
                         │ • Opacity  │
                         │ • Size     │
                         │ • Filters  │
                         └─────────────┘
```

---

## 4. Features — Detailed Breakdown

### 4.1 Audio Input

#### Local File Upload
- **Supported formats**: MP3, WAV, OGG, FLAC, AAC, M4A, WEBM
- **Max file size**: 50MB (configurable in settings)
- **Upload UX**: Drag-and-drop zone with animated border + click-to-browse fallback
- **Processing**: Server validates format, stores file, returns streaming URL
- **Metadata extraction**: Title, artist, album, duration (via `mutagen` Python library)

#### YouTube Integration
- **Input**: Paste any YouTube URL (full URL, short URL, or video ID)
- **Backend flow**:
  1. Django view receives URL via AJAX POST
  2. `yt-dlp` extracts best audio stream (preferring opus/m4a)
  3. `FFmpeg` converts to OGG/MP3 if needed
  4. File saved to `media/tracks/` with metadata
  5. Returns audio URL + metadata JSON to frontend
- **Progress**: Real-time progress bar via polling endpoint
- **Caching**: Previously fetched YouTube tracks are cached to avoid re-downloading

### 4.2 Visualizer Engine

The visualizer engine is a modular system where each visualizer is a self-contained class with a common interface:

```javascript
class BaseVisualizer {
    constructor(canvas, audioEngine, config) { ... }
    setup() { ... }          // Initialize geometry, shaders, etc.
    update(audioData) { ... } // Called each frame with frequency/waveform data
    render() { ... }          // Draw to canvas
    destroy() { ... }         // Cleanup resources
    getControls() { ... }     // Return available customization parameters
}
```

#### Visualizer Types

| # | Name | Description | Rendering |
|---|------|------------|-----------|
| 1 | **Frequency Bars** | Classic equalizer bars with reflection, glow, gradient fills | Canvas 2D |
| 2 | **Waveform** | Smooth oscilloscope-style wave with customizable thickness, color, and fill | Canvas 2D |
| 3 | **Circular Spectrum** | Radial frequency bars around a central circle with glow and rotation | Canvas 2D |
| 4 | **Particle Storm** | Thousands of particles reacting to bass, mids, and highs | WebGL + Three.js |
| 5 | **3D Spectrum** | Extruded 3D frequency bars with perspective and lighting | WebGL + Three.js |
| 6 | **Nebula Flow** | Abstract fluid/smoke simulation driven by audio energy | WebGL + GLSL |
| 7 | **Audio Terrain** | 3D mesh terrain where height = frequency amplitude | WebGL + Three.js |
| 8 | **Kaleidoscope** | Mirror/symmetry effect on any base visualizer | Canvas 2D |

### 4.3 Customization System (The Heart of the App)

This is where Forge differentiates itself. The customization panel is a collapsible sidebar that slides from the right edge, with sections organized by category.

#### Global Controls
| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| Background Color | Color Picker | Any hex | `#1A1A1A` |
| Background Opacity | Slider | 0–100% | 100% |
| FPS Cap | Dropdown | 30/60/uncapped | 60 |
| Smoothing | Slider | 0.0–0.99 | 0.85 |
| FFT Size | Dropdown | 256/512/1024/2048/4096/8192 | 2048 |
| Frequency Range | Dual Slider | 20Hz–20kHz | Full |
| Sensitivity | Slider | 0.1–5.0 | 1.0 |
| Decay Speed | Slider | 0.01–0.5 | 0.1 |

#### Per-Visualizer Controls (Example: Frequency Bars)
| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| Bar Count | Slider | 8–256 | 64 |
| Bar Width | Slider | 1–50px | Auto |
| Bar Gap | Slider | 0–20px | 2 |
| Bar Shape | Dropdown | Rectangle/Rounded/Diamond/Circle | Rounded |
| Bar Alignment | Toggle | Bottom/Center/Top | Bottom |
| Color Mode | Dropdown | Solid/Gradient/Frequency Map/Rainbow | Gradient |
| Primary Color | Color Picker | Any hex | `#C15F3C` |
| Secondary Color | Color Picker | Any hex | `#F59E0B` |
| Gradient Direction | Dropdown | Vertical/Horizontal/Radial | Vertical |
| Glow Enabled | Toggle | On/Off | On |
| Glow Intensity | Slider | 0–50px | 8 |
| Glow Color | Color Picker | Any hex | Auto (match bar) |
| Reflection | Toggle | On/Off | On |
| Reflection Opacity | Slider | 0–100% | 30% |
| Mirror Mode | Toggle | On/Off | Off |
| Animation Easing | Dropdown | Linear/Ease/Spring/Bounce | Ease |
| Scale Mode | Dropdown | Linear/Logarithmic/Mel | Logarithmic |

#### Per-Visualizer Controls (Example: Particle Storm)
| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| Particle Count | Slider | 100–50000 | 5000 |
| Particle Size | Slider | 0.5–10px | 2 |
| Particle Shape | Dropdown | Circle/Square/Star/Custom | Circle |
| Emit Mode | Dropdown | Center/Edge/Random/Bass-Pulse | Center |
| Velocity | Slider | 0.1–10 | 2.0 |
| Turbulence | Slider | 0–5 | 1.0 |
| Color Mode | Dropdown | Solid/Rainbow/Frequency Map/Gradient Field | Rainbow |
| Trail Enabled | Toggle | On/Off | On |
| Trail Length | Slider | 1–50 | 10 |
| Trail Fade | Dropdown | Linear/Exponential | Exponential |
| Gravity | Slider | -2 to 2 | 0 |
| Bloom Enabled | Toggle | On/Off | On |
| Bloom Intensity | Slider | 0–3 | 1.0 |
| Connection Lines | Toggle | On/Off | Off |
| Connection Distance | Slider | 10–200px | 80 |

#### Post-Processing Filters
| Filter | Description | Parameters |
|--------|-------------|------------|
| **Bloom/Glow** | HDR bloom effect on bright areas | Threshold, Intensity, Radius |
| **Chromatic Aberration** | RGB channel offset for retro feel | Offset (px), Angle |
| **CRT Scanlines** | Retro CRT monitor effect | Line Spacing, Opacity, Curve |
| **Vignette** | Darkened corners | Intensity, Softness |
| **Color Grading** | Tone mapping adjustments | Temperature, Tint, Saturation, Contrast |
| **Film Grain** | Subtle noise overlay | Amount, Size, Speed |
| **Motion Blur** | Frame blending for smoothness | Samples, Intensity |
| **Pixelate** | Chunky pixel art style | Block Size |
| **Invert** | Color inversion | Toggle |
| **Hue Rotate** | Continuous hue cycling | Speed, Offset |
| **Mirror** | Horizontal/Vertical/4-way symmetry | Axis, Segments |
| **Distortion** | Wave/Ripple distortion | Type, Amplitude, Frequency |

### 4.4 Preset System

#### Built-in Presets (Ship ~15–20)
- **"Midnight Club"** — Bars, dark bg, purple-cyan gradient, heavy bloom
- **"Sunrise"** — Circular spectrum, warm amber-rose gradient, soft glow
- **"Retro Wave"** — Bars + CRT scanlines + chromatic aberration, neon pink/cyan
- **"Deep Space"** — Particle storm, black bg, star-like particles, slow velocity
- **"Forest"** — Waveform, dark green-emerald palette, organic easing
- **"Aurora"** — Nebula flow, green-blue-purple, high turbulence
- **"Minimal"** — Single color waveform, no effects, clean
- **"Neon City"** — 3D spectrum, neon colors, heavy bloom + vignette
- **"Crystal"** — Particles with connection lines, ice-blue palette
- **"Volcanic"** — Terrain, red-orange-amber, aggressive sensitivity
- **"Kaleidoscope Dream"** — Kaleidoscope mode, rainbow, high segments
- **"Lo-Fi"** — Waveform + film grain + pixelate, muted tones
- **"Pulse"** — Circular, bass-reactive scale, minimalist white
- **"Synthwave"** — Terrain + CRT + vignette, purple-pink grid
- **"Zen"** — Slow particles, minimal, muted earth tones, low sensitivity

#### Custom Presets
- Save current configuration as a named preset
- Export/import presets as JSON
- Stored in browser `localStorage` + optionally synced to Django backend

---

## 5. Page Layouts

### 5.1 Landing Page (`/`)

```
┌────────────────────────────────────────────────────────┐
│  ┌─ HEADER ──────────────────────────────────────────┐ │
│  │  🔥 Forge                              [☀/🌙]    │ │
│  └───────────────────────────────────────────────────┘ │
│                                                        │
│                                                        │
│           Transform your music                         │
│           into visual art                              │
│                                                        │
│           Immersive, real-time audio                   │
│           visualization with deep                      │
│           customization                                │
│                                                        │
│  ┌───────────────────────────────────────────────────┐ │
│  │                                                   │ │
│  │   ┌─────────────────────────────────────────┐     │ │
│  │   │  🎵 Drop your audio file here           │     │ │
│  │   │     or click to browse                   │     │ │
│  │   │                                          │     │ │
│  │   │  Supports MP3, WAV, OGG, FLAC, AAC      │     │ │
│  │   └─────────────────────────────────────────┘     │ │
│  │                                                   │ │
│  │   ──────── or ────────                            │ │
│  │                                                   │ │
│  │   ┌──────────────────────────────┐  ┌──────────┐  │ │
│  │   │  Paste YouTube URL...        │  │ Visualize │  │ │
│  │   └──────────────────────────────┘  └──────────┘  │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                        │
│           ┌────┐  ┌────┐  ┌────┐  ┌────┐              │
│           │ 🌊 │  │ ▓▓ │  │ ◉  │  │ ✨ │              │
│           │Wave│  │Bars│  │Ring│  │Dust│              │
│           └────┘  └────┘  └────┘  └────┘              │
│           Preview cards (animated thumbnails)          │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 5.2 Visualizer Page (`/play/`)

```
┌────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────── ┐ │
│ │                                                        │ │
│ │           FULL VIEWPORT CANVAS                         │ │
│ │           (Visualizer renders here)                    │ │
│ │                                                        │ │
│ │                                                        │ │
│ │                                                        │ │
│ │                                                        │ │
│ │                                                        │ │
│ └─────────────────────────────────────────────── ┐       │ │
│                                                  │ CTRL  │ │
│ ┌─ BOTTOM BAR (glassmorphism overlay) ─────────┐ │ PANEL │ │
│ │ Track: Song Name — Artist                    │ │       │ │
│ │ ──●──────────────────────── 2:34 / 4:12      │ │ ≡ Viz │ │
│ │ ◁  ▶ ▷   🔊━━━━━   ⚙️  🎨  [↑↓]  ⛶         │ │ 🎨 Col│ │
│ └──────────────────────────────────────────────┘ │ ⚡ FX  │ │
│                                                  │ 💾 Pre│ │
│                                                  └───────┘ │
└────────────────────────────────────────────────────────────┘

Bottom bar icons:
  ◁ ▶ ▷  = Previous / Play-Pause / Next (if playlist)
  🔊━━━  = Volume slider
  ⚙️     = Settings (FFT, smoothing, fps)
  🎨     = Toggle customization panel
  [↑↓]   = Toggle bottom bar visibility
  ⛶      = Fullscreen toggle
```

---

## 6. Backend Implementation Details

### 6.1 Django Models

```python
# visualizer/models.py

class Track(models.Model):
    title = models.CharField(max_length=255)
    artist = models.CharField(max_length=255, blank=True)
    album = models.CharField(max_length=255, blank=True)
    duration = models.FloatField(null=True)          # seconds
    file = models.FileField(upload_to='tracks/')
    source = models.CharField(max_length=10,
        choices=[('upload', 'Upload'), ('youtube', 'YouTube')])
    youtube_url = models.URLField(blank=True)
    youtube_id = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    file_size = models.BigIntegerField(default=0)    # bytes
    mime_type = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ['-created_at']

class Preset(models.Model):
    name = models.CharField(max_length=100)
    config = models.JSONField()                      # Full visualizer config
    is_builtin = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    thumbnail = models.ImageField(upload_to='presets/', blank=True)

    class Meta:
        ordering = ['name']
```

### 6.2 API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/` | Landing page |
| `GET` | `/play/<track_id>/` | Visualizer page for a track |
| `POST` | `/api/upload/` | Upload audio file, returns track JSON |
| `POST` | `/api/youtube/` | Fetch YouTube audio, returns track JSON |
| `GET` | `/api/youtube/status/<task_id>/` | Poll YouTube download progress |
| `GET` | `/api/presets/` | List all presets |
| `POST` | `/api/presets/` | Save a custom preset |
| `DELETE` | `/api/presets/<id>/` | Delete a custom preset |

### 6.3 YouTube Service

```python
# visualizer/services/youtube.py

import yt_dlp
import os
from django.conf import settings

class YouTubeService:
    DOWNLOAD_DIR = os.path.join(settings.MEDIA_ROOT, 'tracks')

    @staticmethod
    def extract_info(url):
        """Get video metadata without downloading."""
        ydl_opts = {'quiet': True, 'no_warnings': True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return {
                'title': info.get('title', 'Unknown'),
                'artist': info.get('artist') or info.get('uploader', ''),
                'duration': info.get('duration', 0),
                'youtube_id': info.get('id', ''),
                'thumbnail': info.get('thumbnail', ''),
            }

    @staticmethod
    def download_audio(url, output_filename):
        """Download audio from YouTube URL."""
        output_path = os.path.join(YouTubeService.DOWNLOAD_DIR, output_filename)
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': output_path,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'quiet': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        return output_path + '.mp3'
```

### 6.4 Key Settings

```python
# forge/settings.py additions

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Audio upload constraints
MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_AUDIO_EXTENSIONS = [
    '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.webm'
]

# YouTube
YOUTUBE_CACHE_HOURS = 24  # Cache downloaded YouTube audio
```

---

## 7. Frontend Implementation Details

### 7.1 Audio Engine (`audio-engine.js`)

The audio engine wraps the Web Audio API and provides:

- **AudioContext** management (handles browser autoplay policies)
- **AnalyserNode** setup with configurable FFT size
- **Frequency data** — `getByteFrequencyData()` → Uint8Array of 0–255 values
- **Waveform data** — `getByteTimeDomainData()` → Uint8Array of 0–255 values
- **Band splitting** — Utility to split frequency data into sub-bass, bass, low-mid, mid, high-mid, high, brilliance bands
- **Beat detection** — Simple energy-based beat detection for bass-reactive effects
- **Smoothing** — Configurable temporal smoothing via `AnalyserNode.smoothingTimeConstant`

### 7.2 Visualizer Engine (`visualizer-engine.js`)

Orchestrates rendering:

- Manages the active visualizer instance
- Handles `requestAnimationFrame` loop
- Passes audio data to the active visualizer each frame
- Manages post-processing filter chain (applied after main visualizer)
- Handles canvas resizing and fullscreen transitions
- Provides screenshot/recording capture (bonus feature)

### 7.3 Controls Architecture

A reactive state management approach using vanilla JS:

```javascript
// State object drives all UI and visualizer behavior
const state = {
    visualizer: 'bars',
    config: { /* per-visualizer params */ },
    filters: { /* post-processing params */ },
    audio: { fftSize: 2048, smoothing: 0.85, sensitivity: 1.0 },
    theme: 'dark',
};

// When state changes, update both UI controls and visualizer
function setState(path, value) {
    // Update nested state
    // Re-render affected controls
    // Push new config to active visualizer
}
```

---

## 8. Implementation Phases

### Phase 1 — Foundation (Core Setup)
- [ ] Django project initialization (`forge` project, `visualizer` app)
- [ ] Design system CSS (variables, typography, colors, components)
- [ ] Landing page HTML/CSS with upload area and YouTube input
- [ ] File upload backend (model, view, form validation)
- [ ] Basic audio playback with `<audio>` element
- [ ] Audio engine with Web Audio API + AnalyserNode

### Phase 2 — Core Visualizers
- [ ] Canvas 2D rendering loop
- [ ] Frequency Bars visualizer
- [ ] Waveform visualizer
- [ ] Circular Spectrum visualizer
- [ ] Visualizer switching UI
- [ ] Bottom playback controls bar (glass overlay)

### Phase 3 — Advanced Visualizers + WebGL
- [ ] Three.js integration
- [ ] Particle Storm visualizer (WebGL)
- [ ] 3D Spectrum visualizer (WebGL)
- [ ] Nebula Flow visualizer (GLSL shaders)
- [ ] Audio Terrain visualizer
- [ ] Kaleidoscope effect

### Phase 4 — YouTube Integration
- [ ] yt-dlp service implementation
- [ ] YouTube URL input handler
- [ ] Download progress polling
- [ ] Cache management for downloaded tracks

### Phase 5 — Customization Panel
- [ ] Sliding control panel UI
- [ ] Per-visualizer controls generation
- [ ] Color pickers, sliders, dropdowns, toggles
- [ ] Real-time config updates
- [ ] Global audio controls (FFT, smoothing, sensitivity)

### Phase 6 — Filters & Presets
- [ ] Post-processing filter chain
- [ ] Bloom, vignette, CRT, chromatic aberration, film grain
- [ ] Built-in presets (15–20)
- [ ] Custom preset save/load/export/import
- [ ] Dark/light mode toggle

### Phase 7 — Polish
- [ ] Responsive design (tablet/mobile considerations)
- [ ] Keyboard shortcuts (space = play/pause, F = fullscreen, etc.)
- [ ] Performance optimization (throttling, GPU detection)
- [ ] Loading states and error handling
- [ ] Metadata display animations
- [ ] Fullscreen mode
- [ ] Micro-animations and transitions

---

## 9. Dependencies

### Python (`requirements.txt`)
```
django>=5.0,<6.0
yt-dlp
mutagen            # Audio metadata extraction
Pillow             # Image processing for preset thumbnails
```

### System Dependencies
```
ffmpeg             # Required by yt-dlp for audio extraction
```

### Frontend (CDN / vendored)
```
three.js           # WebGL 3D rendering (r168+)
```

> All other frontend code is vanilla JS — no React, Vue, or build tools.

---

## 10. Verification Plan

### Automated
1. **Django unit tests**: Model creation, file upload validation, YouTube service mock tests
   ```bash
   python3 manage.py test visualizer
   ```

2. **Frontend smoke test**: Browser-based verification that:
   - Landing page loads correctly
   - File upload works and redirects to player
   - Audio plays and visualizer renders
   - Controls panel opens and parameters change visualization

### Manual
1. **Upload different formats** — Test MP3, WAV, OGG, FLAC
2. **YouTube URLs** — Test standard URLs, short URLs, playlist URLs (should reject), invalid URLs
3. **Visualizer switching** — Confirm smooth transitions between all 8 visualizer types
4. **Customization** — Verify each control parameter actually affects the visualization
5. **Presets** — Save, load, delete, export/import custom presets
6. **Dark/Light mode** — Toggle and verify color consistency
7. **Fullscreen** — Enter/exit fullscreen, verify canvas resizes correctly
8. **Performance** — Monitor FPS counter, ensure 60fps on particle/shader visualizers

---

## 11. Open Questions for User

> [!IMPORTANT]
> **Design Decision**: Styrene is a commercial font (~$300+). Should we:
> 1. Use **Inter** throughout (free, similar vibe, highly readable)
> 2. Use a Styrene-like alternative (e.g., **Bricolage Grotesque**, **Satoshi**)
> 3. You'll provide the Styrene font files

> [!NOTE]
> **YouTube ToS**: Using yt-dlp to extract audio from YouTube technically violates YouTube's Terms of Service. This is fine for a personal/educational project but should be noted. The app will include a disclaimer.
