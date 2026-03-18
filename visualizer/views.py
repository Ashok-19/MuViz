import os
import json
import mimetypes
from django.shortcuts import redirect, render, get_object_or_404
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET

from .models import Track, Preset
from .forms import AudioUploadForm, MusicLinkForm
from .services import LyricsService, RemoteAudioError, RemoteAudioService


def index(request):
    """Landing page."""
    return render(request, 'visualizer/index.html')


def player(request, track_id):
    """Visualizer player page."""
    track = get_object_or_404(Track, pk=track_id)
    presets = Preset.objects.all()
    return render(request, 'visualizer/player.html', {
        'track': track,
        'presets': presets,
        'preview_warning': (
            'Preview only: this source exposes a short sample, so playback may stop early.'
            if track.preview_only else ''
        ),
    })


@csrf_exempt
@require_POST
def api_upload(request):
    """Handle audio file upload."""
    form = AudioUploadForm(request.POST, request.FILES)
    if not form.is_valid():
        return JsonResponse({'error': form.errors['file'][0]}, status=400)

    uploaded_file = form.cleaned_data['file']

    # Extract metadata via mutagen
    title = os.path.splitext(uploaded_file.name)[0]
    artist = ''
    duration = None
    try:
        import mutagen
        audio = mutagen.File(uploaded_file, easy=True)
        if audio:
            title = (audio.get('title', [title]) or [title])[0]
            artist = (audio.get('artist', ['']) or [''])[0]
            duration = audio.info.length if hasattr(audio, 'info') else None
        uploaded_file.seek(0)
    except Exception:
        uploaded_file.seek(0)

    track = Track.objects.create(
        title=title,
        artist=artist,
        duration=duration,
        file=uploaded_file,
        source='upload',
        file_size=uploaded_file.size,
        mime_type=mimetypes.guess_type(uploaded_file.name)[0] or '',
    )

    return JsonResponse({
        'id': track.id,
        'title': track.title,
        'artist': track.artist,
        'duration': track.duration,
        'url': track.audio_url,
        'source': track.source,
        'streamed': False,
    })


@csrf_exempt
@require_POST
def api_link(request):
    """Resolve and ingest a remote music link."""
    if request.content_type and 'application/json' in request.content_type:
        try:
            payload = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            payload = {}
        form = MusicLinkForm(payload)
    else:
        form = MusicLinkForm(request.POST)

    if not form.is_valid():
        return JsonResponse({'error': form.errors['url'][0]}, status=400)

    try:
        track = RemoteAudioService.ingest(form.cleaned_data['url'])
    except RemoteAudioError as exc:
        accepts_json = 'application/json' in request.headers.get('Accept', '')
        if request.content_type and 'application/json' in request.content_type or accepts_json:
            return JsonResponse({'error': str(exc)}, status=400)
        return JsonResponse({'error': str(exc)}, status=400)

    accepts_json = 'application/json' in request.headers.get('Accept', '')
    wants_json = (request.content_type and 'application/json' in request.content_type) or accepts_json
    if not wants_json:
        return redirect('visualizer:player', track_id=track.id)

    return JsonResponse({
        'id': track.id,
        'title': track.title,
        'artist': track.artist,
        'duration': track.duration,
        'url': track.audio_url,
        'source': track.source,
        'streamed': bool(track.playback_url),
        'preview_only': track.preview_only,
    })


@require_GET
def api_presets(request):
    """List all presets."""
    presets = list(Preset.objects.values('id', 'name', 'config', 'is_builtin'))
    return JsonResponse({'presets': presets})


@csrf_exempt
@require_POST
def api_preset_save(request):
    """Save a custom preset."""
    try:
        data = json.loads(request.body)
        name = data.get('name', 'Untitled')
        config = data.get('config', {})
        preset = Preset.objects.create(name=name, config=config)
        return JsonResponse({'id': preset.id, 'name': preset.name})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def api_preset_delete(request, preset_id):
    """Delete a custom preset."""
    if request.method == 'DELETE':
        preset = get_object_or_404(Preset, pk=preset_id, is_builtin=False)
        preset.delete()
        return JsonResponse({'ok': True})
    return JsonResponse({'error': 'Method not allowed'}, status=405)


@require_GET
def api_lyrics(request, track_id):
    """Return lyric availability metadata for a track."""
    track = get_object_or_404(Track, pk=track_id)
    resolved = LyricsService.get_for_track(track)
    if not resolved:
        return JsonResponse({'available': False, 'error': 'No lyrics found'})
    return JsonResponse({
        'available': True,
        'synced': resolved.synced,
        'provider': resolved.provider,
        'url': f'/api/lyrics/{track.id}/lrc/',
    })


@require_GET
def api_lyrics_lrc(request, track_id):
    """Return normalized timed LRC for the lyric visualizer."""
    track = get_object_or_404(Track, pk=track_id)
    resolved = LyricsService.get_for_track(track)
    if not resolved or not resolved.lrc:
        return HttpResponse('No lyrics found', status=404, content_type='text/plain; charset=utf-8')
    return HttpResponse(resolved.lrc, content_type='text/plain; charset=utf-8')
