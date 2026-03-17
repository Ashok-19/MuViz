from django.db import models


class Track(models.Model):
    SOURCE_CHOICES = [
        ('upload', 'Upload'),
        ('youtube', 'YouTube'),
    ]

    title = models.CharField(max_length=255, default='Unknown Track')
    artist = models.CharField(max_length=255, blank=True, default='')
    album = models.CharField(max_length=255, blank=True, default='')
    duration = models.FloatField(null=True, blank=True)
    file = models.FileField(upload_to='tracks/')
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES, default='upload')
    youtube_url = models.URLField(blank=True, default='')
    youtube_id = models.CharField(max_length=20, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    file_size = models.BigIntegerField(default=0)
    mime_type = models.CharField(max_length=50, blank=True, default='')
    lyrics_lrc = models.TextField(blank=True, default='', help_text='Cached LRC synced lyrics')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} — {self.artist}" if self.artist else self.title


class Preset(models.Model):
    name = models.CharField(max_length=100)
    config = models.JSONField(default=dict)
    is_builtin = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
