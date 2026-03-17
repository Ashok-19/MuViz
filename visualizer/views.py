import os
import json
import mimetypes
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET
from django.conf import settings

from .models import Track, Preset
from .forms import AudioUploadForm, YouTubeURLForm
from .services.youtube import YouTubeService


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
        'url': track.file.url,
    })


@csrf_exempt
@require_POST
def api_youtube(request):
    """Fetch audio from YouTube URL."""
    try:
        data = json.loads(request.body)
        url = data.get('url', '')
    except (json.JSONDecodeError, AttributeError):
        url = request.POST.get('url', '')

    if not url:
        return JsonResponse({'error': 'URL is required'}, status=400)

    try:
        youtube_id = YouTubeService.extract_video_id(url)
        if youtube_id:
            existing = Track.objects.filter(youtube_id=youtube_id).first()
            if existing and existing.file and existing.file.storage.exists(existing.file.name):
                return JsonResponse({
                    'id': existing.id,
                    'title': existing.title,
                    'artist': existing.artist,
                    'duration': existing.duration,
                    'url': existing.file.url,
                })

        filepath, info = YouTubeService.download_audio(url)
        rel_path = os.path.relpath(filepath, settings.MEDIA_ROOT)

        # Check if track already exists for this youtube_id
        existing = Track.objects.filter(youtube_id=info['youtube_id']).first()
        if existing:
            track = existing
        else:
            track = Track.objects.create(
                title=info['title'],
                artist=info['artist'],
                duration=info['duration'],
                file=rel_path,
                source='youtube',
                youtube_url=url,
                youtube_id=info['youtube_id'],
                file_size=os.path.getsize(filepath),
                mime_type='audio/mpeg',
            )

        return JsonResponse({
            'id': track.id,
            'title': track.title,
            'artist': track.artist,
            'duration': track.duration,
            'url': settings.MEDIA_URL + rel_path,
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


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
    """Fetch synced lyrics (LRC) for a track."""
    track = get_object_or_404(Track, pk=track_id)
    search_term = f"{track.title} {track.artist}".strip()

    if not search_term:
        return JsonResponse({'lyrics': None, 'error': 'No track info'})

    # Check if we already have cached lyrics
    if hasattr(track, 'lyrics_lrc') and track.lyrics_lrc:
        return JsonResponse({'lyrics': track.lyrics_lrc, 'synced': True})

    try:
        import syncedlyrics
        lrc = syncedlyrics.search(search_term, synced_only=True)
        if lrc:
            # Cache on the model if the field exists
            if hasattr(track, 'lyrics_lrc'):
                track.lyrics_lrc = lrc
                track.save(update_fields=['lyrics_lrc'])
            return JsonResponse({'lyrics': lrc, 'synced': True})

        # Fallback: try plain lyrics
        plain = syncedlyrics.search(search_term, plain_only=True)
        if plain:
            return JsonResponse({'lyrics': plain, 'synced': False})

        return JsonResponse({'lyrics': None, 'error': 'No lyrics found'})
    except Exception as e:
        return JsonResponse({'lyrics': None, 'error': str(e)})
