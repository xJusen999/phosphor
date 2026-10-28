"""Builds the switch sounds in web/public/sounds/<profile>/ from Mechvibes recordings.

Sources (MIT): https://github.com/hainguyents13/mechvibes/tree/master/src/audio
  linear  = nk-cream           per-key .wav files
  tactile = holy-pandas        GENERIC_R0..4 / SPACE / ENTER / BACKSPACE .mp3 + release/*.mp3 (from tplai/kbsim, MIT)
  clicky  = cherrymx-blue-pbt  one sound.ogg sprite + config.json defines {scancode: [offsetMs, durationMs]}

Usage (from proyectos/phosphor, with the PersonalGr venv; needs soundfile, numpy, scipy):
  python -I scripts/build-sounds.py            downloads into raw/sounds/ if missing, then writes the assets
Output per profile: press0..4.wav, space.wav, enter.wav, backspace.wav (+ up.wav, up-space.wav, up-enter.wav,
up-backspace.wav where the pack has keyup sounds). 16-bit mono 44.1 kHz WAV: every browser decodes it with
no encoder delay (an mp3/ogg start offset would lag each press). Keep the names in sync with web/src/audio/switches.ts.
"""
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import lfilter

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'raw' / 'sounds'
OUT = ROOT / 'web' / 'public' / 'sounds'
BASE = 'https://raw.githubusercontent.com/hainguyents13/mechvibes/master/src/audio'
SR = 44100
TARGET_DB = -20.0  # K-weighted RMS of a generic press over its first 100 ms
CEILING = 10 ** (-1 / 20)  # peak limit, -1 dBFS
BUDGET = 400_000  # bytes, all profiles

NK = ['a', 'f', 'j', 'l', 's']  # five keys from across the board
HP = [f'GENERIC_R{i}' for i in range(5)]
MX = {'press0': 30, 'press1': 33, 'press2': 36, 'press3': 19, 'press4': 23, 'space': 57, 'enter': 28, 'backspace': 14}

FILES = {
    'nk-cream': [f'{k}.wav' for k in NK + ['space', 'enter', 'backspace']] + ['config.json'],
    'holy-pandas': [f'{k}.mp3' for k in HP + ['SPACE', 'ENTER', 'BACKSPACE']]
    + [f'release/{k}.mp3' for k in ['GENERIC', 'SPACE', 'ENTER', 'BACKSPACE']] + ['LICENSE', 'config.json'],
    'cherrymx-blue-pbt': ['sound.ogg', 'config.json'],
}


def download():
    for pack, names in FILES.items():
        for name in names:
            dst = RAW / pack / name
            if dst.exists():
                continue
            dst.parent.mkdir(parents=True, exist_ok=True)
            print('get', pack, name)
            urllib.request.urlretrieve(f'{BASE}/{pack}/{name}'.replace(' ', '%20'), dst)
    if not (RAW / 'LICENSE').exists():
        urllib.request.urlretrieve('https://raw.githubusercontent.com/hainguyents13/mechvibes/master/LICENSE', RAW / 'LICENSE')


def read(path, start_ms=None, dur_ms=None):
    d, sr = sf.read(path, always_2d=True, dtype='float64')
    assert sr == SR, f'{path}: {sr} Hz'
    if start_ms is not None:
        d = d[int(start_ms * SR / 1000):int((start_ms + dur_ms) * SR / 1000)]
    return d.mean(axis=1)


def trim(x):
    """Cuts leading silence (keeps 1 ms) and the tail below -50 dB of the peak, with a 6 ms fade out."""
    a = np.abs(x)
    on = np.nonzero(a > a.max() * 10 ** (-36 / 20))[0]
    end = np.nonzero(a > a.max() * 10 ** (-50 / 20))[0][-1]
    x = x[max(on[0] - SR // 1000, 0):end + SR * 6 // 1000].copy()
    fade = min(len(x), SR * 6 // 1000)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x


def k_weight(x):
    # BS.1770 pre-filter (high shelf + high pass), coefficients for 48 kHz: close enough at 44.1 kHz for a level match.
    x = lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585], x)
    return lfilter([1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621], x)


def loudness(x):
    w = k_weight(np.pad(x, (0, max(0, SR // 10 - len(x)))))[:SR // 10]
    return 20 * np.log10(np.sqrt(np.mean(w ** 2)) + 1e-12)


def write(profile, name, x):
    path = OUT / profile / f'{name}.wav'
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(path, x, SR, subtype='PCM_16')
    return path


def build(profile, clips):
    """clips: {name: samples}. Each press and special key is matched to TARGET_DB; keyups keep the median press
    gain so they stay as much quieter as recorded. Returns {name: (samples, gain)}; levels go out in main()."""
    clips = {k: trim(v) for k, v in clips.items()}
    gains = {k: 10 ** ((TARGET_DB - loudness(v)) / 20) for k, v in clips.items() if not k.startswith('up')}
    press = float(np.median([g for k, g in gains.items() if k.startswith('press')]))
    return {k: (v, gains.get(k, press)) for k, v in clips.items()}


def main():
    download()
    for d in OUT.glob('*/*.wav'):
        d.unlink()
    nk = RAW / 'nk-cream'
    hp = RAW / 'holy-pandas'
    mx = RAW / 'cherrymx-blue-pbt'
    defines = json.loads((mx / 'config.json').read_text())['defines']
    packs = {'linear': build('linear', {
        **{f'press{i}': read(nk / f'{k}.wav') for i, k in enumerate(NK)},
        **{k: read(nk / f'{k}.wav') for k in ['space', 'enter', 'backspace']},
    })}
    packs['tactile'] = build('tactile', {
        **{f'press{i}': read(hp / f'{k}.mp3') for i, k in enumerate(HP)},
        **{k.lower(): read(hp / f'{k}.mp3') for k in ['SPACE', 'ENTER', 'BACKSPACE']},
        'up': read(hp / 'release' / 'GENERIC.mp3'),
        **{f'up-{k.lower()}': read(hp / 'release' / f'{k}.mp3') for k in ['SPACE', 'ENTER', 'BACKSPACE']},
    })
    packs['clicky'] = build('clicky', {name: read(mx / 'sound.ogg', *defines[str(code)]) for name, code in MX.items()})
    # One scale for all profiles, so they keep the same level while the loudest peak stays under the ceiling.
    peak = max(np.abs(x).max() * g for clips in packs.values() for x, g in clips.values())
    scale = min(1.0, CEILING / peak)
    rows = []
    for profile, clips in packs.items():
        for name, (x, g) in clips.items():
            y = x * g * scale
            rows.append((profile, name, write(profile, name, y).stat().st_size, len(y) / SR, loudness(y)))
    total = 0
    for profile, name, size, dur, lu in rows:
        total += size
        print(f'{profile:8} {name:13} {size:7,d} B {dur * 1000:5.0f} ms {lu:6.1f} dB')
    # MIT asks for the notices to travel with the recordings.
    notices = [
        'Switch recordings from Mechvibes, https://github.com/hainguyents13/mechvibes',
        'linear: NK Cream; tactile: Holy Pandas (pack from https://github.com/tplai/kbsim); clicky: Cherry MX Blue, PBT.',
        '',
        (RAW / 'LICENSE').read_text(encoding='utf8').strip(),
        '',
        '--- Holy Pandas pack ---',
        '',
        (RAW / 'holy-pandas' / 'LICENSE').read_text(encoding='utf8').strip(),
    ]
    (OUT / 'LICENSE.txt').write_text('\n'.join(notices) + '\n', encoding='utf8')
    print(f'total {total:,d} B')
    if total > BUDGET:
        sys.exit(f'over budget ({BUDGET:,d} B)')


if __name__ == '__main__':
    main()
