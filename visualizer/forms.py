import os
from urllib.parse import urlparse
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


class MusicLinkForm(forms.Form):
    url = forms.URLField()

    def clean_url(self):
        url = self.cleaned_data['url'].strip()
        parsed = urlparse(url)
        if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
            raise forms.ValidationError('Enter a valid http(s) URL.')
        return url
