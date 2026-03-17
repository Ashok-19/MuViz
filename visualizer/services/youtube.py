import os
import yt_dlp
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
                'artist': info.get('artist') or info.get('uploader', 'Unknown'),
                'duration': info.get('duration', 0),
                'youtube_id': info.get('id', ''),
                'thumbnail': info.get('thumbnail', ''),
            }

    @staticmethod
    def download_audio(url):
        """Download audio from YouTube URL, returns (filepath, info_dict)."""
        os.makedirs(YouTubeService.DOWNLOAD_DIR, exist_ok=True)
        info = YouTubeService.extract_info(url)
        yt_id = info['youtube_id']
        output_template = os.path.join(YouTubeService.DOWNLOAD_DIR, f'{yt_id}')

        # Check cache
        cached_path = output_template + '.mp3'
        if os.path.exists(cached_path):
            return cached_path, info

        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': output_template + '.%(ext)s',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'quiet': True,
            'no_warnings': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        return cached_path, info
