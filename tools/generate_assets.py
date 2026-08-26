#!/usr/bin/env python3
"""
Generates every binary asset this scene ships.

Nothing here is downloaded or sampled. The star sprite is drawn from a radial
falloff function and the audio is synthesised from sine partials, which means
the project holds outright rights to all of it -- what Buildathon T&C §8 asks
for, and cleaner than shipping a third-party "royalty-free" file whose licence
terms would need to travel with the repo.

    python3 tools/generate_assets.py

Requires ffmpeg on PATH for the mp3 encode. Everything else is stdlib.
"""
import math
import os
import struct
import subprocess
import sys
import tempfile
import wave
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100


# --------------------------------------------------------------------------
# Star sprite
# --------------------------------------------------------------------------
def write_png(path, size, fn):
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter type 0 (None)
        for x in range(size):
            r, g, b, a = fn(x, y, size)
            raw += bytes((r, g, b, a))

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def star_glow(x, y, size):
    """Hot core, wide halo, faint four-point diffraction flare."""
    cx = cy = (size - 1) / 2.0
    dx, dy = (x - cx) / cx, (y - cy) / cy
    d = math.sqrt(dx * dx + dy * dy)
    if d >= 1.0:
        return (255, 255, 255, 0)
    core = math.exp(-(d * 4.4) ** 2)
    halo = (1.0 - d) ** 2.6 * 0.5
    ang = math.atan2(dy, dx)
    spike = (abs(math.cos(2 * ang)) ** 14) * (1.0 - d) ** 2.0 * 0.42
    a = min(1.0, core + halo + spike)
    t = min(1.0, core * 1.5)
    return (int(215 + 40 * t), int(228 + 27 * t), 255, int(a * 255))


# --------------------------------------------------------------------------
# Audio
# --------------------------------------------------------------------------
def save_wav(path, samples):
    w = wave.open(path, 'wb')
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = bytearray()
    for l, r in samples:
        frames += struct.pack(
            '<hh',
            max(-32767, min(32767, int(l * 32767))),
            max(-32767, min(32767, int(r * 32767))))
    w.writeframes(bytes(frames))
    w.close()


def build_ambient(duration=24.0):
    """
    A low drone that loops seamlessly.

    Every partial and LFO is snapped to a whole number of cycles inside the loop
    window, so the last sample splices onto the first with no click.
    """
    n = int(SR * duration)
    base = 1.0 / duration

    def snap(f):
        return round(f / base) * base

    partials = [(snap(55.0), 0.30), (snap(82.5), 0.20), (snap(110.0), 0.13),
                (snap(164.8), 0.07), (snap(220.0), 0.05), (snap(329.6), 0.028)]
    lfos = [(snap(0.0417), 0.35), (snap(0.0833), 0.22), (snap(0.125), 0.12)]
    pan_lfo = snap(0.0208)

    out = []
    for i in range(n):
        t = i / SR
        swell = 1.0
        for lf, amt in lfos:
            swell += amt * math.sin(2 * math.pi * lf * t)
        s = 0.0
        for f, a in partials:
            s += a * math.sin(2 * math.pi * f * t)
        s *= swell * 0.30
        pan = 0.5 + 0.16 * math.sin(2 * math.pi * pan_lfo * t)
        out.append((s * (1 - pan), s * pan))
    return out


def build_chime(duration=2.6):
    """A struck bell: inharmonic partials, exponential decay, rising figure."""
    n = int(SR * duration)
    notes = [(0.00, 587.33), (0.09, 880.00), (0.20, 1174.66)]  # D5, A5, D6
    ratios = [(1.0, 1.0), (2.01, 0.42), (2.99, 0.22), (4.21, 0.12), (5.44, 0.06)]
    out = []
    for i in range(n):
        t = i / SR
        s = 0.0
        for onset, f0 in notes:
            if t < onset:
                continue
            dt = t - onset
            for rat, amp in ratios:
                s += amp * math.exp(-dt * (2.4 + rat * 1.5)) \
                     * math.sin(2 * math.pi * f0 * rat * dt)
        s *= 0.17
        pan = 0.5 + 0.06 * math.sin(2 * math.pi * 0.7 * t)
        out.append((s * (1 - pan), s * pan))
    return out


def encode_mp3(wav_path, mp3_path, bitrate):
    subprocess.run(
        ['ffmpeg', '-y', '-loglevel', 'error', '-i', wav_path,
         '-codec:a', 'libmp3lame', '-b:a', bitrate, mp3_path],
        check=True)


def main():
    tex_dir = os.path.join(ROOT, 'assets', 'textures')
    aud_dir = os.path.join(ROOT, 'assets', 'audio')
    os.makedirs(tex_dir, exist_ok=True)
    os.makedirs(aud_dir, exist_ok=True)

    star_path = os.path.join(tex_dir, 'star_glow.png')
    write_png(star_path, 128, star_glow)
    print('wrote', os.path.relpath(star_path, ROOT))

    if not shutil_which('ffmpeg'):
        print('ffmpeg not found; skipping audio', file=sys.stderr)
        return 1

    with tempfile.TemporaryDirectory() as tmp:
        amb_wav = os.path.join(tmp, 'ambient.wav')
        chi_wav = os.path.join(tmp, 'chime.wav')
        save_wav(amb_wav, build_ambient())
        save_wav(chi_wav, build_chime())
        encode_mp3(amb_wav, os.path.join(aud_dir, 'ambient.mp3'), '96k')
        encode_mp3(chi_wav, os.path.join(aud_dir, 'chime.mp3'), '128k')
    print('wrote assets/audio/ambient.mp3')
    print('wrote assets/audio/chime.mp3')
    return 0


def shutil_which(name):
    import shutil
    return shutil.which(name)


if __name__ == '__main__':
    raise SystemExit(main())
