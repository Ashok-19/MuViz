from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('visualizer.urls')),
]

# In serverless deployments (e.g., Vercel), static/media routing may not be
# handled by a separate web server. Keep these URL mappings available so Django
# can serve bundled static assets directly.
urlpatterns += static(settings.STATIC_URL, document_root=settings.BASE_DIR / 'static')
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
