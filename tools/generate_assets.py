#!/usr/bin/env python3
"""
Generates every binary asset this scene ships.

Nothing here is downloaded or sampled. The star sprite is drawn from a radial
falloff function and the audio is synthesised from sine partials (plus a tiny
seeded PRNG for noise bands), which means the project holds outright rights to
all of it -- what Buildathon T&C §8 asks for, and cleaner than shipping a
third-party "royalty-free" file whose licence terms would need to travel with
the repo.

    python3 tools/generate_assets.py

Requires ffmpeg on PATH for the mp3 encode. Everything else is stdlib. Running
this script is idempotent: every asset, old and new, is rebuilt from scratch
and overwritten every time.
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
# Audio helpers
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


def normalize_peak(samples, target_dbfs=-3.0):
    """
    Peak-normalises a stereo sample list so nothing clips on encode.

    Every build_* function below is written for its own internal balance
    (relative levels between layers) and not for an absolute output level, so
    this is applied once, centrally, right before a clip is written to disk.
    """
    target = 10 ** (target_dbfs / 20.0)
    peak = 0.0
    for l, r in samples:
        if abs(l) > peak:
            peak = abs(l)
        if abs(r) > peak:
            peak = abs(r)
    if peak <= 1e-9:
        return samples
    scale = target / peak
    return [(l * scale, r * scale) for l, r in samples]


def make_lcg(seed):
    """
    A tiny deterministic PRNG for noise bands.

    The stdlib `random` module would work too, but pinning our own linear
    congruential generator keeps the noise bit-for-bit identical across
    Python versions/builds -- this script has to be idempotent, and "noise
    that happens to differ run to run" would quietly violate that.
    """
    state = [seed & 0x7fffffff]

    def next_unit():
        state[0] = (1103515245 * state[0] + 12345) & 0x7fffffff
        return state[0] / 0x7fffffff  # in [0, 1)

    return next_unit


def one_pole_lowpass(x, alpha):
    """Cheap single-pole lowpass; turns white noise into a soft, filtered
    'air' band instead of static. Smaller alpha = more smoothing."""
    y = []
    prev = 0.0
    for v in x:
        prev += alpha * (v - prev)
        y.append(prev)
    return y


# --------------------------------------------------------------------------
# Ambient loop + solve fanfare
# --------------------------------------------------------------------------
def build_ambient(duration=24.0):
    """
    A low drone with a slow-evolving high pad layered above it, looping
    seamlessly.

    Every partial and LFO -- drone and pad alike -- is snapped to a whole
    number of cycles inside the loop window, so the last sample splices onto
    the first with no click, no matter how many layers are stacked on top.
    The pad uses different LFO periods to the drone's on purpose, so the two
    layers drift in and out of phase with each other rather than swelling in
    lockstep -- that's what reads as "evolving" rather than "more drone".
    """
    n = int(SR * duration)
    base = 1.0 / duration

    def snap(f):
        return round(f / base) * base

    partials = [(snap(55.0), 0.30), (snap(82.5), 0.20), (snap(110.0), 0.13),
                (snap(164.8), 0.07), (snap(220.0), 0.05), (snap(329.6), 0.028)]
    lfos = [(snap(0.0417), 0.35), (snap(0.0833), 0.22), (snap(0.125), 0.12)]
    pan_lfo = snap(0.0208)

    pad_partials = [(snap(440.0), 0.05), (snap(659.25), 0.032), (snap(880.0), 0.02)]
    pad_lfos = [(snap(0.0625), 0.55), (snap(0.1458), 0.35)]
    pad_pan_lfo = snap(0.0313)

    out = []
    for i in range(n):
        t = i / SR

        swell = 1.0
        for lf, amt in lfos:
            swell += amt * math.sin(2 * math.pi * lf * t)
        drone = 0.0
        for f, a in partials:
            drone += a * math.sin(2 * math.pi * f * t)
        drone *= swell * 0.30
        pan = 0.5 + 0.16 * math.sin(2 * math.pi * pan_lfo * t)

        pad_swell = 0.0
        for lf, amt in pad_lfos:
            pad_swell += amt * (0.5 + 0.5 * math.sin(2 * math.pi * lf * t))
        pad = 0.0
        for f, a in pad_partials:
            pad += a * math.sin(2 * math.pi * f * t)
        pad *= pad_swell
        pad_pan = 0.5 + 0.3 * math.sin(2 * math.pi * pad_pan_lfo * t)

        l = drone * (1 - pan) + pad * (1 - pad_pan)
        r = drone * pan + pad * pad_pan
        out.append((l, r))
    return out


def build_chime(duration=3.2):
    """
    The solve fanfare: struck-bell partials under a rising four-note figure,
    with a low swell underneath for weight.

    The original three-note hit's bell model (inharmonic partials, per-note
    exponential decay) is kept exactly as it was and simply extended to a
    fourth note, so the struck-bell character survives inside the bigger
    arrangement rather than being replaced by it.
    """
    n = int(SR * duration)
    notes = [(0.00, 587.33), (0.09, 880.00), (0.20, 1174.66), (0.36, 1396.91)]  # D5 A5 D6 F6
    ratios = [(1.0, 1.0), (2.01, 0.42), (2.99, 0.22), (4.21, 0.12), (5.44, 0.06)]

    swell_partials = [(97.99, 0.22), (146.83, 0.14), (196.00, 0.08)]  # G2 D3 G3
    swell_attack, swell_peak = 0.4, 1.6

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

        if t < swell_attack:
            senv = t / swell_attack
        elif t < swell_peak:
            senv = 1.0
        else:
            senv = math.exp(-(t - swell_peak) * 1.1)
        swell = 0.0
        for f, a in swell_partials:
            swell += a * math.sin(2 * math.pi * f * t)
        swell *= senv * 0.5

        mix = s + swell
        pan = 0.5 + 0.06 * math.sin(2 * math.pi * 0.7 * t)
        out.append((mix * (1 - pan), mix * pan))
    return out


# --------------------------------------------------------------------------
# SFX
# --------------------------------------------------------------------------
def build_select(duration=0.18, freq=660.0):
    """
    Soft sine blip, quick attack, exponential decay.

    Kept to a single clean tone (no stacked harmonics) because the engine
    retriggers this clip at varying `pitch` values -- a clean tone transposes
    without artifacts, a busy one would start sounding wrong off-centre.
    """
    n = int(SR * duration)
    attack = max(1, int(SR * 0.004))
    out = []
    for i in range(n):
        t = i / SR
        env = (i / attack) if i < attack else math.exp(-(t - attack / SR) * 22)
        s = env * math.sin(2 * math.pi * freq * t) * 0.85
        out.append((s, s))
    return out


def build_deselect(duration=0.15):
    """
    A downward two-tone falling minor third: softer attack and no bright
    harmonics, so it reads as duller and (via a lower internal mix level,
    see audio.ts's per-clip volume) quieter than select().
    """
    n = int(SR * duration)
    f1 = 480.0
    f2 = f1 / (2 ** (3 / 12.0))  # falling minor third
    split = duration * 0.4
    attack = max(1, int(SR * 0.012))
    out = []
    for i in range(n):
        t = i / SR
        if t < split:
            env = min(1.0, i / attack) * math.exp(-t * 13)
            s = env * math.sin(2 * math.pi * f1 * t)
        else:
            dt = t - split
            env = math.exp(-dt * 15) * 0.8
            s = env * math.sin(2 * math.pi * f2 * t)
        s *= 0.6
        out.append((s, s))
    return out


def build_draw(duration=0.35):
    """
    A rising whoosh that lands on a note: three slightly detuned sines glide
    upward under a decaying filtered-noise band. The noise is white noise
    from a seeded LCG, smoothed with a one-pole lowpass so it reads as air
    rather than static.
    """
    n = int(SR * duration)
    rand = make_lcg(20260826)
    noise = one_pole_lowpass([rand() * 2 - 1 for _ in range(n)], 0.12)

    f_start, f_end = 220.0, 880.0  # A3 -> A5
    detunes_cents = (0, 8, -8)

    def tone_env(frac):
        if frac < 0.12:
            return frac / 0.12
        if frac < 0.82:
            return 1.0
        return max(0.0, 1.0 - (frac - 0.82) / 0.18)

    out = []
    for i in range(n):
        t = i / SR
        frac = t / duration
        freq = f_start * (f_end / f_start) ** frac
        s = 0.0
        for cents in detunes_cents:
            s += math.sin(2 * math.pi * freq * (2 ** (cents / 1200.0)) * t)
        s /= len(detunes_cents)
        s *= tone_env(frac) * 0.75
        s += noise[i] * math.exp(-frac * 4.5) * 0.55
        out.append((s, s))
    return out


def build_erase(duration=0.28):
    """The mirror of build_draw(): a falling sweep, darker and more heavily
    damped -- lower pitch range, more lowpassed noise, faster settle."""
    n = int(SR * duration)
    rand = make_lcg(20260827)
    noise = one_pole_lowpass([rand() * 2 - 1 for _ in range(n)], 0.05)

    f_start, f_end = 660.0, 165.0  # falling, lower overall than draw()
    detunes_cents = (0, 6, -6)

    def tone_env(frac):
        if frac < 0.08:
            return frac / 0.08
        return math.exp(-(frac - 0.08) * 3.2)

    out = []
    for i in range(n):
        t = i / SR
        frac = t / duration
        freq = f_start * (f_end / f_start) ** frac
        s = 0.0
        for cents in detunes_cents:
            s += math.sin(2 * math.pi * freq * (2 ** (cents / 1200.0)) * t)
        s /= len(detunes_cents)
        s *= tone_env(frac) * 0.6
        s += noise[i] * math.exp(-frac * 5.5) * 0.35
        out.append((s, s))
    return out


def build_wrong(duration=0.25):
    """
    A soft muted thunk: low fundamental, fast decay, no harsh upper
    harmonics. The game has no fail state, so this must read as "not that
    one", never as a punishment buzz.
    """
    n = int(SR * duration)
    f0 = 110.0
    out = []
    for i in range(n):
        t = i / SR
        env = math.exp(-t * 17)
        s = env * (math.sin(2 * math.pi * f0 * t) + 0.22 * math.sin(2 * math.pi * f0 * 1.8 * t))
        s *= 0.65
        out.append((s, s))
    return out


def build_hint(duration=0.9):
    """
    A shimmering bell cluster: three inharmonic partials on one struck tone,
    slow attack, gentle tremolo -- mysterious and inviting rather than
    alarming, since this is a nudge, not an alert.
    """
    n = int(SR * duration)
    f0 = 1108.73  # C#6
    partials = [(1.0, 1.0), (2.76, 0.5), (4.32, 0.28)]
    attack = 0.14
    out = []
    for i in range(n):
        t = i / SR
        a_env = min(1.0, t / attack)
        d_env = math.exp(-t * 2.1)
        shimmer = 1.0 + 0.15 * math.sin(2 * math.pi * 6.5 * t)
        s = 0.0
        for rat, amp in partials:
            s += amp * math.sin(2 * math.pi * f0 * rat * t)
        s *= a_env * d_env * shimmer * 0.32
        out.append((s, s))
    return out


def build_streak(duration=0.5):
    """
    A short ascending major-triad arpeggio. The engine pitches this up a
    semitone or more on each successive streak step, so the figure itself
    stays tonally neutral (plain root-third-fifth) rather than anything
    melodically distinctive that would clash once transposed.
    """
    n = int(SR * duration)
    base = 523.25  # C5
    notes = [(0.00, base), (0.13, base * 2 ** (4 / 12.0)), (0.26, base * 2 ** (7 / 12.0))]
    note_dur = 0.22
    out = []
    for i in range(n):
        t = i / SR
        s = 0.0
        for onset, f in notes:
            if t < onset:
                continue
            dt = t - onset
            if dt > note_dur:
                continue
            env = min(1.0, dt / 0.006) * math.exp(-dt * 9)
            s += env * math.sin(2 * math.pi * f * dt)
        s *= 0.5
        out.append((s, s))
    return out


def build_advance(duration=1.1):
    """A low airy swell -- the sky turning over to the next constellation.
    A low sine stack gives it weight; a heavily-smoothed noise band gives it
    air."""
    n = int(SR * duration)
    rand = make_lcg(99118)
    noise = one_pole_lowpass([rand() * 2 - 1 for _ in range(n)], 0.02)
    partials = [(65.41, 0.5), (98.00, 0.3), (130.81, 0.18)]  # C2, G2, C3
    out = []
    for i in range(n):
        t = i / SR
        frac = t / duration
        swell = math.sin(math.pi * min(1.0, frac))
        s = 0.0
        for f, a in partials:
            s += a * math.sin(2 * math.pi * f * t)
        s *= swell * 0.55
        s += noise[i] * swell * 0.16
        pan = 0.5 + 0.1 * math.sin(2 * math.pi * 0.15 * t)
        out.append((s * (1 - pan), s * pan))
    return out


# --------------------------------------------------------------------------
# Encode + orchestration
# --------------------------------------------------------------------------
def encode_mp3(wav_path, mp3_path, bitrate, mono=False):
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-i', wav_path]
    if mono:
        cmd += ['-ac', '1']
    cmd += ['-codec:a', 'libmp3lame', '-b:a', bitrate, mp3_path]
    subprocess.run(cmd, check=True)


def report(path):
    size = os.path.getsize(path)
    print('wrote %s (%d bytes)' % (os.path.relpath(path, ROOT), size))


def main():
    tex_dir = os.path.join(ROOT, 'assets', 'textures')
    aud_dir = os.path.join(ROOT, 'assets', 'audio')
    os.makedirs(tex_dir, exist_ok=True)
    os.makedirs(aud_dir, exist_ok=True)

    star_path = os.path.join(tex_dir, 'star_glow.png')
    write_png(star_path, 128, star_glow)
    report(star_path)

    if not shutil_which('ffmpeg'):
        print('ffmpeg not found; skipping audio', file=sys.stderr)
        return 1

    # (output name, builder, mp3 bitrate, mono-encode)
    # The two musical/atmospheric pieces (ambient, chime) keep their stereo
    # width; every short one-shot SFX is encoded mono at 96k to keep the
    # total added audio weight modest, per the module's size budget.
    clips = [
        ('ambient',  build_ambient,  '96k',  False),
        ('chime',    build_chime,    '128k', False),
        ('select',   build_select,   '96k',  True),
        ('deselect', build_deselect, '96k',  True),
        ('draw',     build_draw,     '96k',  True),
        ('erase',    build_erase,    '96k',  True),
        ('wrong',    build_wrong,    '96k',  True),
        ('hint',     build_hint,     '96k',  True),
        ('streak',   build_streak,   '96k',  True),
        ('advance',  build_advance,  '96k',  True),
    ]

    with tempfile.TemporaryDirectory() as tmp:
        for name, builder, bitrate, mono in clips:
            samples = normalize_peak(builder())
            wav_path = os.path.join(tmp, name + '.wav')
            mp3_path = os.path.join(aud_dir, name + '.mp3')
            save_wav(wav_path, samples)
            encode_mp3(wav_path, mp3_path, bitrate, mono=mono)
            report(mp3_path)

    return 0


def shutil_which(name):
    import shutil
    return shutil.which(name)


if __name__ == '__main__':
    raise SystemExit(main())
