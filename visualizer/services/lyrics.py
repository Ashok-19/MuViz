import html
import re
from dataclasses import dataclass

import requests


@dataclass
class ResolvedLyrics:
    lrc: str
    synced: bool
    provider: str


class LyricsService:
    USER_AGENT = 'MuViz/1.0 (+https://github.com/)'

    @classmethod
    def get_for_track(cls, track) -> ResolvedLyrics | None:
        if track.lyrics_lrc:
            return ResolvedLyrics(lrc=track.lyrics_lrc, synced=True, provider='cache')

        title, artist = cls.infer_title_artist(track.title, track.artist)
        if not title:
            return None

        resolved = cls.fetch_from_lrclib(title, artist, track.duration)
        if not resolved:
            resolved = cls.fetch_from_syncedlyrics(title, artist, track.duration)
        if not resolved:
            return None

        track.lyrics_lrc = resolved.lrc
        track.save(update_fields=['lyrics_lrc'])
        return resolved

    @classmethod
    def infer_title_artist(cls, raw_title: str, raw_artist: str) -> tuple[str, str]:
        title = html.unescape((raw_title or '').strip())
        artist = html.unescape((raw_artist or '').strip())

        if not artist and ' - ' in title:
            maybe_artist, maybe_title = title.split(' - ', 1)
            if maybe_artist and maybe_title:
                artist = maybe_artist.strip()
                title = maybe_title.strip()

        title = cls.clean_title(title)
        artist = cls.clean_artist(artist)
        return title, artist

    @classmethod
    def clean_title(cls, title: str) -> str:
        cleaned = re.sub(r'\[[^\]]*(official|lyrics|audio|video|visualizer)[^\]]*\]', '', title, flags=re.I)
        cleaned = re.sub(r'\([^\)]*(official|lyrics|audio|video|visualizer)[^\)]*\)', '', cleaned, flags=re.I)
        cleaned = re.sub(r'\s+(official\s+)?(audio|video|lyrics)\s*$', '', cleaned, flags=re.I)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip(' -')
        return cleaned

    @classmethod
    def clean_artist(cls, artist: str) -> str:
        return re.sub(r'\s+', ' ', artist).strip(' -')

    @classmethod
    def fetch_from_lrclib(cls, title: str, artist: str, duration: float | None) -> ResolvedLyrics | None:
        params = {'track_name': title}
        if artist:
            params['artist_name'] = artist
        try:
            response = requests.get(
                'https://lrclib.net/api/search',
                params=params,
                headers={'User-Agent': cls.USER_AGENT},
                timeout=(10, 20),
            )
            response.raise_for_status()
            data = response.json()
        except Exception:
            return None
        if not isinstance(data, list) or not data:
            return None

        candidate = cls.select_best_lrclib_match(data, title, artist, duration)
        if not candidate:
            return None

        synced = (candidate.get('syncedLyrics') or '').strip()
        if synced:
            return ResolvedLyrics(lrc=synced, synced=True, provider='lrclib')

        plain = (candidate.get('plainLyrics') or '').strip()
        if not plain:
            return None
        estimated = cls.estimate_lrc(plain, duration or candidate.get('duration'))
        return ResolvedLyrics(lrc=estimated, synced=False, provider='lrclib')

    @classmethod
    def fetch_from_syncedlyrics(cls, title: str, artist: str, duration: float | None) -> ResolvedLyrics | None:
        search_term = f'{title} {artist}'.strip()
        if not search_term:
            return None
        try:
            import syncedlyrics
            synced = syncedlyrics.search(search_term, synced_only=True)
            if synced:
                return ResolvedLyrics(lrc=synced, synced=True, provider='syncedlyrics')

            plain = syncedlyrics.search(search_term, plain_only=True)
            if plain:
                return ResolvedLyrics(
                    lrc=cls.estimate_lrc(plain, duration),
                    synced=False,
                    provider='syncedlyrics',
                )
        except Exception:
            return None
        return None

    @classmethod
    def select_best_lrclib_match(cls, candidates: list[dict], title: str, artist: str, duration: float | None) -> dict | None:
        target_title = cls.normalized_text(title)
        target_artist = cls.normalized_text(artist)

        def score(entry: dict) -> float:
            entry_title = cls.normalized_text(entry.get('trackName') or entry.get('name') or '')
            entry_artist = cls.normalized_text(entry.get('artistName') or '')
            total = 0.0
            if entry_title == target_title:
                total += 60
            elif entry_title and (entry_title in target_title or target_title in entry_title):
                total += 30

            if target_artist and entry_artist == target_artist:
                total += 45
            elif target_artist and entry_artist and (entry_artist in target_artist or target_artist in entry_artist):
                total += 20

            entry_duration = entry.get('duration')
            if duration and entry_duration:
                total -= min(abs(float(entry_duration) - float(duration)), 30)
            return total

        ranked = sorted(candidates, key=score, reverse=True)
        best = ranked[0]
        return best if score(best) >= 25 else None

    @classmethod
    def normalized_text(cls, text: str) -> str:
        return re.sub(r'[^a-z0-9]+', ' ', (text or '').lower()).strip()

    @classmethod
    def estimate_lrc(cls, plain_lyrics: str, duration: float | None) -> str:
        lines = [line.strip() for line in plain_lyrics.splitlines() if line.strip()]
        if not lines:
            return ''

        weights = [max(1.0, len(line.split()) * 0.55) for line in lines]
        total_weight = sum(weights)
        total_duration = max(float(duration or 0), total_weight)
        scale = total_duration / total_weight if total_weight else 1.0

        cursor = 0.0
        output = []
        for line, weight in zip(lines, weights):
            output.append(f'[{cls.format_timestamp(cursor)}] {line}')
            cursor += weight * scale
        return '\n'.join(output)

    @classmethod
    def format_timestamp(cls, seconds: float) -> str:
        seconds = max(0.0, float(seconds))
        minutes = int(seconds // 60)
        remainder = seconds - minutes * 60
        return f'{minutes:02d}:{remainder:05.2f}'
