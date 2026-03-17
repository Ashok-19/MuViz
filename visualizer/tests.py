import json
import tempfile
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from .models import Track
from .services.youtube import YouTubeService


class YouTubeServiceTests(TestCase):
    def test_extract_video_id_handles_common_youtube_urls(self):
        cases = {
            'https://youtu.be/72DMrkE8jks?si=KhpbYEQnDpjU7Zn8': '72DMrkE8jks',
            'https://www.youtube.com/watch?v=72DMrkE8jks': '72DMrkE8jks',
            'https://m.youtube.com/watch?v=72DMrkE8jks&feature=youtu.be': '72DMrkE8jks',
            'https://www.youtube.com/shorts/72DMrkE8jks': '72DMrkE8jks',
            'https://www.youtube.com/embed/72DMrkE8jks': '72DMrkE8jks',
            'https://example.com/not-youtube': '',
        }

        for url, expected in cases.items():
            with self.subTest(url=url):
                self.assertEqual(YouTubeService.extract_video_id(url), expected)

    @patch.dict('os.environ', {'YTDLP_PLAYER_CLIENTS': 'android,web'}, clear=False)
    def test_legacy_player_client_default_uses_yt_dlp_auto_selection(self):
        opts = YouTubeService._base_ydl_opts()
        self.assertNotIn('extractor_args', opts)

    @patch.dict('os.environ', {'YTDLP_PLAYER_CLIENTS': 'ios,tv'}, clear=False)
    def test_custom_player_clients_are_still_supported(self):
        opts = YouTubeService._base_ydl_opts()
        self.assertEqual(opts['extractor_args'], {'youtube': {'player_client': ['ios', 'tv']}})


class YouTubeApiTests(TestCase):
    @override_settings(MEDIA_ROOT=tempfile.gettempdir())
    @patch('visualizer.views.YouTubeService.download_audio')
    def test_api_youtube_returns_cached_track_without_hitting_youtube(self, mock_download_audio):
        track = Track.objects.create(
            title='Cached Track',
            artist='Fusion Media',
            duration=195,
            file=SimpleUploadedFile('72DMrkE8jks.mp3', b'cached-audio', content_type='audio/mpeg'),
            source='youtube',
            youtube_url='https://youtu.be/72DMrkE8jks',
            youtube_id='72DMrkE8jks',
            file_size=12,
            mime_type='audio/mpeg',
        )

        response = self.client.post(
            '/api/youtube/',
            data=json.dumps({'url': 'https://youtu.be/72DMrkE8jks?si=KhpbYEQnDpjU7Zn8'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['id'], track.id)
        self.assertEqual(payload['title'], track.title)
        self.assertEqual(payload['url'], track.file.url)
        mock_download_audio.assert_not_called()
