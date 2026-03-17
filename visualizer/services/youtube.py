import os
import base64
import tempfile
from urllib.parse import parse_qs, urlparse
import yt_dlp
from yt_dlp.utils import DownloadError
from django.conf import settings


class YouTubeService:
    DOWNLOAD_DIR = os.path.join(settings.MEDIA_ROOT, 'tracks')

    @staticmethod
    def _resolve_cookie_file():
        """Resolve cookie file from environment for authenticated yt-dlp requests."""
        cookie_file = os.getenv('YTDLP_COOKIE_FILE', '').strip()
        if cookie_file:
            if not os.path.exists(cookie_file):
                raise RuntimeError(f'YTDLP_COOKIE_FILE does not exist: {cookie_file}')
            return cookie_file

        cookies_b64 = os.getenv('YTDLP_COOKIES_B64', '').strip()
        cookies_raw = os.getenv('YTDLP_COOKIES', '').strip()
        if not cookies_b64 and not cookies_raw:
            return None

        if cookies_b64:
            try:
                cookies_raw = base64.b64decode(cookies_b64).decode('utf-8')
            except Exception as exc:
                raise RuntimeError('Invalid YTDLP_COOKIES_B64 value. Must be base64-encoded Netscape cookie text.') from exc

        cookie_path = os.path.join(tempfile.gettempdir(), 'yt-dlp-cookies.txt')
        with open(cookie_path, 'w', encoding='utf-8') as f:
            f.write(cookies_raw)
            if not cookies_raw.endswith('\n'):
                f.write('\n')

        os.chmod(cookie_path, 0o600)
        return cookie_path

    @staticmethod
    def _base_ydl_opts():
        """Build common yt-dlp options with optional production auth configuration."""
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
        }

        player_clients_raw = os.getenv('YTDLP_PLAYER_CLIENTS', '').strip()
        normalized_clients = player_clients_raw.replace(' ', '').lower()
        if normalized_clients in {'', 'auto', 'default', 'android,web'}:
            player_clients = []
        else:
            player_clients = [
                client.strip()
                for client in player_clients_raw.split(',')
                if client.strip()
            ]
        if player_clients:
            ydl_opts['extractor_args'] = {'youtube': {'player_client': player_clients}}

        cookie_file = YouTubeService._resolve_cookie_file()
        if cookie_file:
            ydl_opts['cookiefile'] = cookie_file

        return ydl_opts

    @staticmethod
    def _normalize_info(info):
        return {
            'title': info.get('title', 'Unknown'),
            'artist': info.get('artist') or info.get('uploader', 'Unknown'),
            'duration': info.get('duration', 0),
            'youtube_id': info.get('id', ''),
            'thumbnail': info.get('thumbnail', ''),
        }

    @staticmethod
    def extract_video_id(url):
        """Parse a YouTube video ID without sending a network request."""
        parsed = urlparse(url.strip())
        host = parsed.netloc.lower().removeprefix('www.')
        path = parsed.path.strip('/')

        if host == 'youtu.be':
            return path.split('/', 1)[0]

        if host in {'youtube.com', 'm.youtube.com', 'music.youtube.com'}:
            if path == 'watch':
                return parse_qs(parsed.query).get('v', [''])[0]
            if path.startswith(('shorts/', 'embed/', 'live/')):
                return path.split('/', 1)[1].split('/', 1)[0]

        return ''

    @staticmethod
    def _raise_friendly_download_error(exc):
        message = str(exc)
        if "Sign in to confirm you're not a bot" in message or 'Sign in to confirm you’re not a bot' in message:
            raise RuntimeError(
                'YouTube blocked anonymous requests from this server IP. Configure YTDLP_COOKIES_B64 '
                '(or YTDLP_COOKIE_FILE) with exported YouTube cookies and retry.'
            ) from exc
        raise RuntimeError(message) from exc

    @staticmethod
    def extract_info(url):
        """Get video metadata without downloading."""
        ydl_opts = YouTubeService._base_ydl_opts()
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                return YouTubeService._normalize_info(info)
        except DownloadError as exc:
            YouTubeService._raise_friendly_download_error(exc)

    @staticmethod
    def download_audio(url, info=None):
        """Download audio from YouTube URL, returns (filepath, info_dict)."""
        os.makedirs(YouTubeService.DOWNLOAD_DIR, exist_ok=True)
        yt_id = (info or {}).get('youtube_id') or YouTubeService.extract_video_id(url)
        if yt_id:
            output_template = os.path.join(YouTubeService.DOWNLOAD_DIR, yt_id)
            cached_path = output_template + '.mp3'
            if os.path.exists(cached_path):
                if info is None:
                    info = YouTubeService.extract_info(url)
                return cached_path, info
        else:
            output_template = os.path.join(YouTubeService.DOWNLOAD_DIR, '%(id)s')

        ydl_opts = YouTubeService._base_ydl_opts()
        ydl_opts.update({
            'format': 'bestaudio/best',
            'outtmpl': output_template + '.%(ext)s',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        })
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                downloaded_info = ydl.extract_info(url, download=True)
        except DownloadError as exc:
            YouTubeService._raise_friendly_download_error(exc)

        info = YouTubeService._normalize_info(downloaded_info)
        cached_path = os.path.join(YouTubeService.DOWNLOAD_DIR, f"{info['youtube_id']}.mp3")
        return cached_path, info
