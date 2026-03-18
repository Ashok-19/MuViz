from django.db import models


class Track(models.Model):
    SOURCE_CHOICES = [
        ('upload', 'Upload'),
        ('soundcloud', 'SoundCloud'),
        ('internet_archive', 'Internet Archive'),
        ('remote_url', 'Remote URL'),
        ('youtube', 'YouTube (Legacy)'),
    ]

    title = models.CharField(max_length=255, default='Unknown Track')
    artist = models.CharField(max_length=255, blank=True, default='')
    album = models.CharField(max_length=255, blank=True, default='')
    duration = models.FloatField(null=True, blank=True)
    file = models.FileField(upload_to='tracks/', blank=True, default='')
    playback_url = models.URLField(blank=True, default='')
    source = models.CharField(max_length=32, choices=SOURCE_CHOICES, default='upload')
    source_url = models.URLField(blank=True, default='')
    source_identifier = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    file_size = models.BigIntegerField(default=0)
    mime_type = models.CharField(max_length=50, blank=True, default='')
    lyrics_lrc = models.TextField(blank=True, default='', help_text='Cached LRC synced lyrics')
    preview_only = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} — {self.artist}" if self.artist else self.title

    @property
    def audio_url(self):
        if self.playback_url:
            return self.playback_url
        if self.file:
            return self.file.url
        return ''

    @property
    def has_audio_source(self):
        return bool(self.audio_url)


class Preset(models.Model):
    name = models.CharField(max_length=100)
    config = models.JSONField(default=dict)
    is_builtin = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
