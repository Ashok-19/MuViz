from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('visualizer.urls')),
]

# In serverless deployments (e.g., Vercel), static/media routing may not be
# handled by a separate web server. Keep these URL mappings available so Django
# can serve bundled static assets directly.
urlpatterns += static(settings.STATIC_URL, document_root=settings.BASE_DIR / 'static')
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Uploaded audio must remain reachable even when DEBUG=False, otherwise the
# player receives a /media URL that 404s and playback controls never update.
urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
