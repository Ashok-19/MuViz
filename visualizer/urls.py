from django.urls import path
from . import views

app_name = 'visualizer'

urlpatterns = [
    path('', views.index, name='index'),
    path('play/<int:track_id>/', views.player, name='player'),
    path('api/upload/', views.api_upload, name='api_upload'),
    path('api/link/', views.api_link, name='api_link'),
    path('api/presets/', views.api_presets, name='api_presets'),
    path('api/presets/save/', views.api_preset_save, name='api_preset_save'),
    path('api/presets/<int:preset_id>/delete/', views.api_preset_delete, name='api_preset_delete'),
    path('api/lyrics/<int:track_id>/', views.api_lyrics, name='api_lyrics'),
    path('api/lyrics/<int:track_id>/lrc/', views.api_lyrics_lrc, name='api_lyrics_lrc'),
]
