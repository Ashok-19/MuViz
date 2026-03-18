import glob
import mimetypes
import os
import re
import shutil
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import requests
import yt_dlp
from django.conf import settings

from visualizer.models import Track


class RemoteAudioError(RuntimeError):
    """Raised when a remote audio source cannot be resolved or ingested."""


@dataclass
class ResolvedRemoteTrack:
    source: str
    source_url: str
    source_identifier: str
    title: str
    artist: str = ''
    album: str = ''
    duration: float | None = None
    mime_type: str = ''
    file_size: int = 0
    playback_url: str = ''
    filename_hint: str = ''
    ingest_mode: str = 'cache'
    request_headers: dict[str, str] = field(default_factory=dict)
    ytdlp_url: str = ''
    preview_only: bool = False


class RemoteAudioService:
    AUDIO_EXTENSIONS = {'.mp3', '.wav', '.ogg', '.oga', '.flac', '.aac', '.m4a', '.webm', '.opus'}
    STREAMABLE_SOURCES = {'internet_archive', 'remote_url'}
    USER_AGENT = 'MuViz/1.0 (+https://github.com/)'
    DOWNLOAD_DIR = Path(settings.MEDIA_ROOT) / 'tracks'

    @classmethod
    def ingest(cls, raw_url: str) -> Track:
        normalized_url = cls.normalize_url(raw_url)
        resolved = cls.resolve(normalized_url)
        existing = cls.find_existing_track(resolved)
        if existing and cls.track_is_playable(existing):
            return existing

        if resolved.ingest_mode == 'stream':
            return cls.save_streaming_track(existing, resolved)
        return cls.save_cached_track(existing, resolved)

    @classmethod
    def normalize_url(cls, raw_url: str) -> str:
        parsed = urlparse(raw_url.strip())
        if not parsed.scheme or not parsed.netloc:
            raise RemoteAudioError('Enter a valid public URL.')
        normalized = parsed._replace(fragment='')
        return urlunparse(normalized)

    @classmethod
    def resolve(cls, url: str) -> ResolvedRemoteTrack:
        parsed = urlparse(url)
        host = parsed.netloc.lower().removeprefix('www.')

        if 'soundcloud.com' in host:
            return cls.resolve_soundcloud(url)
        if host == 'archive.org':
            return cls.resolve_internet_archive(url)
        if cls.looks_like_audio_url(url):
            return cls.resolve_direct_audio(url)

        raise RemoteAudioError('Supported links right now are SoundCloud, Internet Archive, or direct audio-file URLs.')

    @classmethod
    def resolve_soundcloud(cls, url: str) -> ResolvedRemoteTrack:
        info = cls.extract_ytdlp_info(url)
        identifier = str(info.get('id') or '')
        if not identifier:
            raise RemoteAudioError('Could not resolve this SoundCloud track.')

        title = info.get('track') or info.get('title') or 'Unknown Track'
        artist = info.get('artist') or info.get('uploader') or ''
        duration = cls.to_float(info.get('duration'))
        filename_hint = cls.slugify_filename(f'soundcloud-{identifier}-{title}') + (f".{info.get('ext')}" if info.get('ext') else '')
        return ResolvedRemoteTrack(
            source='soundcloud',
            source_url=url,
            source_identifier=identifier,
            title=title,
            artist=artist,
            album=info.get('album') or '',
            duration=duration,
            mime_type=mimetypes.guess_type(filename_hint)[0] or '',
            filename_hint=filename_hint,
            ingest_mode='cache',
            ytdlp_url=url,
            preview_only=cls.is_soundcloud_preview_only(info),
        )

    @classmethod
    def resolve_internet_archive(cls, url: str) -> ResolvedRemoteTrack:
        identifier, requested_name = cls.parse_archive_url(url)
        metadata = cls.fetch_archive_metadata(identifier)
        selected = cls.select_archive_file(metadata.get('files', []), requested_name)
        if not selected:
            raise RemoteAudioError('Could not find a browser-playable audio file for this Internet Archive item.')

        file_name = selected['name']
        audio_url = f'https://archive.org/download/{identifier}/{file_name}'
        mime_type = selected.get('format') or mimetypes.guess_type(file_name)[0] or ''
        mime_type = cls.normalize_mime_type(mime_type, file_name)
        can_stream, headers = cls.inspect_remote_audio(audio_url)
        source_url = url
        title = cls.first_non_empty(
            metadata.get('metadata', {}).get('title'),
            selected.get('title'),
            cls.filename_stem(file_name),
        )
        artist = cls.first_non_empty(
            cls.stringify_metadata(metadata.get('metadata', {}).get('creator')),
            cls.stringify_metadata(metadata.get('metadata', {}).get('uploader')),
        )
        duration = cls.to_float(selected.get('length')) or cls.parse_runtime(metadata.get('metadata', {}).get('runtime'))
        return ResolvedRemoteTrack(
            source='internet_archive',
            source_url=source_url,
            source_identifier=f'{identifier}:{file_name}',
            title=title,
            artist=artist,
            album=cls.stringify_metadata(metadata.get('metadata', {}).get('collection')),
            duration=duration,
            mime_type=mime_type,
            file_size=int(headers.get('content-length') or 0),
            playback_url=audio_url,
            filename_hint=cls.slugify_filename(file_name),
            ingest_mode='stream' if can_stream else 'cache',
        )

    @classmethod
    def resolve_direct_audio(cls, url: str) -> ResolvedRemoteTrack:
        can_stream, headers = cls.inspect_remote_audio(url)
        filename = Path(urlparse(url).path).name or 'remote-track'
        mime_type = cls.normalize_mime_type(headers.get('content-type') or '', filename)
        title = cls.filename_stem(filename)
        return ResolvedRemoteTrack(
            source='remote_url',
            source_url=url,
            source_identifier='',
            title=title,
            duration=None,
            mime_type=mime_type,
            file_size=int(headers.get('content-length') or 0),
            playback_url=url,
            filename_hint=cls.slugify_filename(filename),
            ingest_mode='stream' if can_stream else 'cache',
            request_headers={},
        )

    @classmethod
    def find_existing_track(cls, resolved: ResolvedRemoteTrack) -> Track | None:
        filters = {'source': resolved.source}
        if resolved.source_identifier:
            filters['source_identifier'] = resolved.source_identifier
            track = Track.objects.filter(**filters).first()
            if track:
                return track
        if resolved.source_url:
            return Track.objects.filter(source=resolved.source, source_url=resolved.source_url).first()
        return None

    @classmethod
    def track_is_playable(cls, track: Track) -> bool:
        if track.playback_url:
            return True
        if track.file:
            try:
                return track.file.storage.exists(track.file.name)
            except Exception:
                return False
        return False

    @classmethod
    def save_streaming_track(cls, existing: Track | None, resolved: ResolvedRemoteTrack) -> Track:
        track = existing or Track()
        track.title = resolved.title
        track.artist = resolved.artist
        track.album = resolved.album
        track.duration = resolved.duration
        track.source = resolved.source
        track.source_url = resolved.source_url
        track.source_identifier = resolved.source_identifier
        track.playback_url = resolved.playback_url
        track.file = ''
        track.file_size = resolved.file_size
        track.mime_type = resolved.mime_type
        track.preview_only = resolved.preview_only
        track.save()
        return track

    @classmethod
    def save_cached_track(cls, existing: Track | None, resolved: ResolvedRemoteTrack) -> Track:
        cls.DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
        if resolved.source == 'soundcloud':
            file_path = cls.download_with_ytdlp(resolved)
        else:
            file_path = cls.download_with_requests(resolved)

        rel_path = os.path.relpath(file_path, settings.MEDIA_ROOT)
        file_size = os.path.getsize(file_path)
        mime_type = resolved.mime_type or mimetypes.guess_type(file_path)[0] or ''

        track = existing or Track()
        track.title = resolved.title
        track.artist = resolved.artist
        track.album = resolved.album
        track.duration = resolved.duration
        track.source = resolved.source
        track.source_url = resolved.source_url
        track.source_identifier = resolved.source_identifier
        track.playback_url = ''
        track.file = rel_path
        track.file_size = file_size
        track.mime_type = mime_type
        track.preview_only = resolved.preview_only
        track.save()
        return track

    @classmethod
    def download_with_ytdlp(cls, resolved: ResolvedRemoteTrack) -> str:
        identifier = resolved.source_identifier or cls.slugify_filename(resolved.title)
        output_base = cls.DOWNLOAD_DIR / identifier
        existing = cls.find_existing_download(output_base)
        if existing:
            return str(existing)

        opts = {
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
            'outtmpl': str(output_base) + '.%(ext)s',
            'format': (
                'bestaudio[protocol!=m3u8][ext=mp3]/'
                'bestaudio[protocol!=m3u8][ext=m4a]/'
                'bestaudio[protocol!=m3u8][ext=webm]/'
                'bestaudio[protocol!=m3u8][ext=ogg]/'
                'bestaudio[protocol!=m3u8][ext=opus]/'
                'bestaudio[protocol!=m3u8]'
            ),
        }
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.extract_info(resolved.ytdlp_url or resolved.source_url, download=True)
        except Exception as exc:
            raise RemoteAudioError(f'Failed to download the SoundCloud track: {exc}') from exc

        downloaded = cls.find_existing_download(output_base)
        if not downloaded:
            raise RemoteAudioError('SoundCloud download finished without a playable audio file.')
        if downloaded.suffix.lower() not in cls.AUDIO_EXTENSIONS:
            raise RemoteAudioError(f'SoundCloud returned unsupported audio format "{downloaded.suffix}".')
        return str(downloaded)

    @classmethod
    def download_with_requests(cls, resolved: ResolvedRemoteTrack) -> str:
        ext = cls.extension_for_filename(resolved.filename_hint or resolved.playback_url or resolved.source_url)
        if ext not in cls.AUDIO_EXTENSIONS:
            ext = cls.extension_for_mime_type(resolved.mime_type)
        if ext not in cls.AUDIO_EXTENSIONS:
            raise RemoteAudioError('The resolved audio format is not supported for caching.')

        identifier = resolved.source_identifier or cls.slugify_filename(resolved.title) or 'remote-track'
        filename = f'{cls.slugify_filename(identifier)}{ext}'
        output_path = cls.DOWNLOAD_DIR / filename
        if output_path.exists():
            return str(output_path)

        headers = {'User-Agent': cls.USER_AGENT}
        headers.update(resolved.request_headers or {})
        try:
            with requests.get(resolved.playback_url, headers=headers, stream=True, timeout=(15, 60)) as response:
                response.raise_for_status()
                with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
                    for chunk in response.iter_content(chunk_size=1024 * 256):
                        if chunk:
                            tmp_file.write(chunk)
                    temp_name = tmp_file.name
            shutil.move(temp_name, output_path)
        except Exception as exc:
            raise RemoteAudioError(f'Failed to cache remote audio: {exc}') from exc
        return str(output_path)

    @classmethod
    def extract_ytdlp_info(cls, url: str) -> dict:
        opts = {
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
        }
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                return ydl.extract_info(url, download=False)
        except Exception as exc:
            raise RemoteAudioError(f'Failed to resolve the SoundCloud track: {exc}') from exc

    @classmethod
    def is_soundcloud_preview_only(cls, info: dict) -> bool:
        formats = info.get('formats') or []
        audio_formats = [
            fmt for fmt in formats
            if (fmt.get('acodec') and fmt.get('acodec') != 'none') or fmt.get('vcodec') == 'none'
        ]
        if not audio_formats:
            return False

        def is_preview_format(fmt: dict) -> bool:
            format_id = (fmt.get('format_id') or '').lower()
            url = (fmt.get('url') or '').lower()
            note = (fmt.get('format_note') or '').lower()
            return 'preview' in format_id or 'preview' in url or 'preview' in note

        return all(is_preview_format(fmt) for fmt in audio_formats)

    @classmethod
    def inspect_remote_audio(cls, url: str) -> tuple[bool, dict[str, str]]:
        headers = {'User-Agent': cls.USER_AGENT}
        response_headers: dict[str, str] = {}
        try:
            response = requests.head(url, headers=headers, allow_redirects=True, timeout=(10, 20))
            if response.status_code >= 400 or response.status_code == 405:
                response = requests.get(url, headers=headers, allow_redirects=True, stream=True, timeout=(10, 20))
            response.raise_for_status()
            response_headers = {k.lower(): v for k, v in response.headers.items()}
        except Exception as exc:
            raise RemoteAudioError(f'Could not inspect the remote audio URL: {exc}') from exc

        mime_type = cls.normalize_mime_type(response_headers.get('content-type', ''), url)
        if not mime_type.startswith('audio/'):
            raise RemoteAudioError('The pasted URL does not resolve to a supported audio resource.')

        has_cors = bool(response_headers.get('access-control-allow-origin'))
        supports_ranges = response_headers.get('accept-ranges', '').lower() == 'bytes'
        return has_cors and supports_ranges, response_headers

    @classmethod
    def fetch_archive_metadata(cls, identifier: str) -> dict:
        try:
            response = requests.get(
                f'https://archive.org/metadata/{identifier}',
                headers={'User-Agent': cls.USER_AGENT},
                timeout=(10, 30),
            )
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            raise RemoteAudioError(f'Could not load Internet Archive metadata: {exc}') from exc
        if not data:
            raise RemoteAudioError('The Internet Archive item metadata was empty.')
        return data

    @classmethod
    def parse_archive_url(cls, url: str) -> tuple[str, str]:
        parsed = urlparse(url)
        parts = [part for part in parsed.path.split('/') if part]
        if len(parts) < 2:
            raise RemoteAudioError('This Internet Archive URL is missing an item identifier.')
        if parts[0] == 'details':
            return parts[1], ''
        if parts[0] == 'download':
            identifier = parts[1]
            file_name = '/'.join(parts[2:]) if len(parts) > 2 else ''
            return identifier, file_name
        raise RemoteAudioError('Use an Internet Archive details page or download URL.')

    @classmethod
    def select_archive_file(cls, files: list[dict], requested_name: str = '') -> dict | None:
        normalized_requested = requested_name.strip()
        if normalized_requested:
            for file_info in files:
                if file_info.get('name') == normalized_requested:
                    return file_info

        ranked = []
        for file_info in files:
            name = file_info.get('name') or ''
            ext = Path(name).suffix.lower()
            if ext not in cls.AUDIO_EXTENSIONS:
                continue
            source_rank = 0 if (file_info.get('source') or '').lower() == 'original' else 1
            ext_rank = ['.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.webm', '.wav', '.flac'].index(ext)
            ranked.append((source_rank, ext_rank, name.lower(), file_info))
        ranked.sort(key=lambda item: item[:3])
        return ranked[0][3] if ranked else None

    @classmethod
    def looks_like_audio_url(cls, url: str) -> bool:
        path = urlparse(url).path
        return Path(path).suffix.lower() in cls.AUDIO_EXTENSIONS

    @classmethod
    def find_existing_download(cls, output_base: Path) -> Path | None:
        matches = sorted(glob.glob(str(output_base) + '.*'))
        for match in matches:
            path = Path(match)
            if path.suffix.lower() in cls.AUDIO_EXTENSIONS:
                return path
        return None

    @classmethod
    def normalize_mime_type(cls, mime_type: str, filename: str) -> str:
        cleaned = mime_type.split(';', 1)[0].strip().lower()
        if cleaned.startswith('audio/'):
            return cleaned
        guessed = mimetypes.guess_type(filename)[0] or ''
        return guessed.lower()

    @classmethod
    def extension_for_filename(cls, name: str) -> str:
        return Path(urlparse(name).path).suffix.lower()

    @classmethod
    def extension_for_mime_type(cls, mime_type: str) -> str:
        if not mime_type:
            return ''
        return mimetypes.guess_extension(mime_type) or ''

    @classmethod
    def to_float(cls, value) -> float | None:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        return number if number > 0 else None

    @classmethod
    def parse_runtime(cls, value) -> float | None:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        text = str(value).strip()
        if not text:
            return None
        if ':' not in text:
            return cls.to_float(text)
        parts = [part for part in text.split(':') if part]
        try:
            total = 0.0
            for part in parts:
                total = total * 60 + float(part)
            return total
        except ValueError:
            return None

    @classmethod
    def stringify_metadata(cls, value) -> str:
        if isinstance(value, list):
            return ', '.join(str(item) for item in value if item)
        return str(value).strip() if value else ''

    @classmethod
    def first_non_empty(cls, *values) -> str:
        for value in values:
            if value:
                return str(value).strip()
        return ''

    @classmethod
    def slugify_filename(cls, text: str) -> str:
        stem = cls.filename_stem(text)
        stem = re.sub(r'[^A-Za-z0-9._-]+', '_', stem)
        stem = re.sub(r'_+', '_', stem).strip('._')
        return stem or 'track'

    @classmethod
    def filename_stem(cls, name: str) -> str:
        return Path(urlparse(name).path).stem or 'track'
