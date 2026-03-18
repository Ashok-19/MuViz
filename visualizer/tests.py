from pathlib import Path
from unittest.mock import patch

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from visualizer.models import Track
from visualizer.services.lyrics import ResolvedLyrics
from visualizer.services.remote_audio import RemoteAudioService


class LandingPageTests(TestCase):
    def test_index_exposes_upload_and_link_ingest(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Play music.')
        self.assertContains(response, 'SoundCloud, Internet Archive, direct audio.')
        self.assertContains(response, 'id="fileInput"')
        self.assertContains(response, 'multiple')


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
        self.assertFalse(payload['streamed'])
        self.assertEqual(payload['source'], 'upload')


class LinkApiTests(TestCase):
    def test_link_endpoint_rejects_invalid_url(self):
        response = self.client.post('/api/link/', {'url': 'notaurl'})
        self.assertEqual(response.status_code, 400)
        self.assertIn('valid', response.json()['error'].lower())

    @patch('visualizer.views.RemoteAudioService.ingest')
    def test_link_endpoint_returns_remote_track_payload(self, mock_ingest):
        track = Track.objects.create(
            title='Remote Track',
            artist='Remote Artist',
            source='remote_url',
            source_url='https://example.com/audio.mp3',
            playback_url='https://example.com/audio.mp3',
            mime_type='audio/mpeg',
        )
        mock_ingest.return_value = track

        response = self.client.post(
            '/api/link/',
            data='{"url":"https://example.com/audio.mp3"}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['id'], track.id)
        self.assertTrue(payload['streamed'])
        self.assertEqual(payload['source'], 'remote_url')
        self.assertFalse(payload['preview_only'])

    @patch('visualizer.views.RemoteAudioService.ingest')
    def test_plain_form_submit_redirects_to_player(self, mock_ingest):
        track = Track.objects.create(
            title='Remote Track',
            artist='Remote Artist',
            source='remote_url',
            source_url='https://example.com/audio.mp3',
            playback_url='https://example.com/audio.mp3',
            mime_type='audio/mpeg',
        )
        mock_ingest.return_value = track

        response = self.client.post('/api/link/', {'url': 'https://example.com/audio.mp3'})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], f'/play/{track.id}/')


class PlayerPageTests(TestCase):
    def test_player_uses_playback_url_and_renders_lyrics_ui(self):
        track = Track.objects.create(
            title='Streaming Track',
            artist='Artist',
            source='remote_url',
            source_url='https://example.com/audio.mp3',
            playback_url='https://example.com/audio.mp3',
            mime_type='audio/mpeg',
        )

        response = self.client.get(f'/play/{track.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'https://example.com/audio.mp3')
        self.assertContains(response, 'id="lyricsBtn"')
        self.assertContains(response, 'id="lyricsDisplay"')
        self.assertContains(response, 'id="prevTrackBtn"')
        self.assertContains(response, 'id="nextTrackBtn"')
        self.assertContains(response, 'open-karaoke-lyrics.js')

    def test_player_shows_preview_warning_when_track_is_preview_only(self):
        track = Track.objects.create(
            title='Preview Track',
            artist='Artist',
            source='soundcloud',
            source_url='https://soundcloud.com/example/preview',
            mime_type='audio/mpeg',
            preview_only=True,
        )

        response = self.client.get(f'/play/{track.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Preview only:')

    def test_legacy_youtube_track_still_loads(self):
        track = Track.objects.create(
            title='Legacy Track',
            artist='Legacy Artist',
            source='youtube',
            source_url='https://youtube.com/watch?v=abc123',
            source_identifier='abc123',
            playback_url='https://cdn.example.com/legacy.mp3',
            mime_type='audio/mpeg',
        )

        response = self.client.get(f'/play/{track.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Legacy Track')


class LyricsApiTests(TestCase):
    @patch('visualizer.views.LyricsService.get_for_track')
    def test_lyrics_json_endpoint_returns_status(self, mock_get_for_track):
        track = Track.objects.create(title='Lyric Track', artist='Singer')
        mock_get_for_track.return_value = ResolvedLyrics(
            lrc='[00:00.00] spaced words here',
            synced=False,
            provider='lrclib',
        )

        response = self.client.get(f'/api/lyrics/{track.id}/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['available'])
        self.assertEqual(payload['provider'], 'lrclib')
        self.assertEqual(payload['url'], f'/api/lyrics/{track.id}/lrc/')

    @patch('visualizer.views.LyricsService.get_for_track')
    def test_lyrics_lrc_endpoint_returns_plain_text(self, mock_get_for_track):
        track = Track.objects.create(title='Lyric Track', artist='Singer')
        mock_get_for_track.return_value = ResolvedLyrics(
            lrc='[00:00.00] spaced words here',
            synced=False,
            provider='lrclib',
        )

        response = self.client.get(f'/api/lyrics/{track.id}/lrc/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/plain; charset=utf-8')
        self.assertContains(response, 'spaced words here')


class RemoteAudioServiceTests(TestCase):
    def test_preview_only_soundcloud_track_is_flagged(self):
        preview_info = {
            'id': '1945951599',
            'formats': [
                {
                    'format_id': 'hls_mp3_1_0_preview',
                    'acodec': 'mp3',
                    'vcodec': 'none',
                    'url': 'https://cf-hls-media.sndcdn.com/playlist/preview-track.m3u8',
                },
                {
                    'format_id': 'http_mp3_1_0_preview',
                    'acodec': 'mp3',
                    'vcodec': 'none',
                    'url': 'https://cf-preview-media.sndcdn.com/preview-track.mp3',
                },
            ],
        }

        with patch.object(RemoteAudioService, 'extract_ytdlp_info', return_value=preview_info):
            resolved = RemoteAudioService.resolve_soundcloud('https://soundcloud.com/example/preview')

        self.assertTrue(resolved.preview_only)


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
