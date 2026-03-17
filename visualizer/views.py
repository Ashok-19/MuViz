import os
import json
import mimetypes
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET

from .models import Track, Preset
from .forms import AudioUploadForm


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
