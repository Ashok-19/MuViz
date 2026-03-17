import os
from django import forms
from django.conf import settings


class AudioUploadForm(forms.Form):
    file = forms.FileField()

    def clean_file(self):
        f = self.cleaned_data['file']
        ext = os.path.splitext(f.name)[1].lower()
        if ext not in settings.ALLOWED_AUDIO_EXTENSIONS:
            raise forms.ValidationError(
                f'Unsupported format "{ext}". Allowed: {", ".join(settings.ALLOWED_AUDIO_EXTENSIONS)}'
            )
        if f.size > settings.MAX_UPLOAD_SIZE:
            max_mb = settings.MAX_UPLOAD_SIZE // (1024 * 1024)
            raise forms.ValidationError(f'File too large. Maximum size is {max_mb}MB.')
        return f


class YouTubeURLForm(forms.Form):
    url = forms.URLField(max_length=500)
