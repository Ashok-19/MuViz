from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase


class LandingPageTests(TestCase):
    def test_index_is_local_upload_only(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Local Files Only')
        self.assertContains(response, 'Drop your audio file here')
        self.assertNotContains(response, 'Paste YouTube URL')

    def test_removed_youtube_routes_are_not_available(self):
        self.assertEqual(self.client.get('/live/').status_code, 404)
        self.assertEqual(self.client.post('/api/youtube/').status_code, 404)


class UploadApiTests(TestCase):
    def test_upload_creates_local_track(self):
        response = self.client.post(
            '/api/upload/',
            {'file': SimpleUploadedFile('demo.mp3', b'fake-audio-bytes', content_type='audio/mpeg')},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['title'], 'demo')
        self.assertIn('/media/tracks/', payload['url'])


class MediaServingTests(TestCase):
    def test_uploaded_media_url_is_served(self):
        media_dir = Path(settings.MEDIA_ROOT) / 'tracks'
        media_dir.mkdir(parents=True, exist_ok=True)
        sample_path = media_dir / 'media-route-smoke.txt'

        try:
            sample_path.write_text('muviz-media-ok', encoding='utf-8')
            response = self.client.get('/media/tracks/media-route-smoke.txt')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(b''.join(response.streaming_content), b'muviz-media-ok')
        finally:
            if sample_path.exists():
                sample_path.unlink()
