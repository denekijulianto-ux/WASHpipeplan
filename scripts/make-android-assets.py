#!/usr/bin/env python3
"""Membuat ikon & splash Android WASHLY dari logo asli (assets/brand/washly-logo-source.png).
Pemakaian:  python3 scripts/make-android-assets.py
Logo tidak diubah: simbol W dan wordmark dipotong dari berkas logo yang sama, di atas latar putih.
"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
STORE = os.path.join(ROOT, 'store-assets')
SRC = os.path.join(ROOT, 'assets', 'brand', 'washly-logo-source.png')
WHITE = (255, 255, 255, 255)

logo = Image.open(SRC).convert('RGB')


def bbox_non_white(im, thr=720):
    px = im.load(); xs = []; ys = []
    for y in range(im.height):
        for x in range(im.width):
            if sum(px[x, y]) < thr:
                xs.append(x); ys.append(y)
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


# Simbol W (bagian kiri logo) & wordmark + tagline (bagian kanan)
mark = logo.crop((0, 0, 250, logo.height)); mark = mark.crop(bbox_non_white(mark))
word = logo.crop((285, 0, logo.width, logo.height)); word = word.crop(bbox_non_white(word))
full = logo.crop(bbox_non_white(logo))


def to_rgba_on_white(im):
    """Latar putih → transparan (color-to-alpha); hasil identik bila ditaruh di atas putih."""
    im = im.convert('RGB'); out = Image.new('RGBA', im.size)
    src = im.load(); dst = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = src[x, y]
            a = max(255 - r, 255 - g, 255 - b) / 255.0
            if a <= 0.004:
                dst[x, y] = (255, 255, 255, 0); continue
            f = lambda c: int(round(min(255, max(0, (c - 255 * (1 - a)) / a))))
            dst[x, y] = (f(r), f(g), f(b), int(round(a * 255)))
    return out


mark_rgba = to_rgba_on_white(mark)


def fit(im, w, h):
    k = min(w / im.width, h / im.height)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def place(canvas, im, cx=0.5, cy=0.5):
    x = round(canvas.width * cx - im.width / 2); y = round(canvas.height * cy - im.height / 2)
    if im.mode == 'RGBA':
        canvas.alpha_composite(im, (x, y)) if canvas.mode == 'RGBA' else canvas.paste(im, (x, y), im)
    else:
        canvas.paste(im, (x, y))
    return canvas


def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True); im.save(path, optimize=True)


DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

for d, s in DENS.items():
    # ikon lama (< Android 8): kotak putih membulat & lingkaran putih
    n = round(48 * s); big = n * 4
    sq = Image.new('RGBA', (big, big), (0, 0, 0, 0)); m = Image.new('L', (big, big), 0)
    ImageDraw.Draw(m).rounded_rectangle((big * 0.04, big * 0.04, big * 0.96, big * 0.96), radius=big * 0.2, fill=255)
    sq.paste(Image.new('RGBA', (big, big), WHITE), (0, 0), m)
    place(sq, fit(mark_rgba, big * 0.62, big * 0.62))
    save(sq.resize((n, n), Image.LANCZOS), f'{RES}/mipmap-{d}/ic_launcher.png')
    rd = Image.new('RGBA', (big, big), (0, 0, 0, 0)); m2 = Image.new('L', (big, big), 0)
    ImageDraw.Draw(m2).ellipse((big * 0.04, big * 0.04, big * 0.96, big * 0.96), fill=255)
    rd.paste(Image.new('RGBA', (big, big), WHITE), (0, 0), m2)
    place(rd, fit(mark_rgba, big * 0.56, big * 0.56))
    save(rd.resize((n, n), Image.LANCZOS), f'{RES}/mipmap-{d}/ic_launcher_round.png')
    # ikon adaptif (Android 8+): 108 dp, simbol di dalam zona aman 66 dp
    a = round(108 * s)
    fg = Image.new('RGBA', (a, a), (0, 0, 0, 0)); place(fg, fit(mark_rgba, a * 0.52, a * 0.52))
    save(fg, f'{RES}/mipmap-{d}/ic_launcher_foreground.png')
    # ikon bertema / monokrom (Android 13+)
    mono = Image.new('RGBA', (a, a), (0, 0, 0, 0)); sil = fit(mark_rgba, a * 0.52, a * 0.52)
    al = sil.split()[3].point(lambda v: 255 if v > 90 else int(v * 2.8))
    place(mono, Image.merge('RGBA', (Image.new('L', sil.size, 255),) * 3 + (al,)))
    save(mono, f'{RES}/mipmap-{d}/ic_launcher_monochrome.png')

# Splash Android 12+: ikon 288 dp (tanpa latar) di dalam lingkaran 192 dp; branding 200×80 dp (wordmark + tagline)
sp = Image.new('RGBA', (576, 576), (0, 0, 0, 0)); place(sp, fit(mark_rgba, 576 * 0.46, 576 * 0.46))
save(sp, f'{RES}/drawable-xhdpi/splash_icon.png')
br = Image.new('RGBA', (600, 240), (0, 0, 0, 0)); place(br, fit(to_rgba_on_white(word), 560, 200))
save(br, f'{RES}/drawable-xxhdpi/splash_branding.png')

# Splash lama (< Android 12) & cadangan: logo lengkap di tengah latar putih
for d in DENS:
    for orient in ('port', 'land'):
        f = f'{RES}/drawable-{orient}-{d}/splash.png'
        if not os.path.exists(f):
            continue
        w, h = Image.open(f).size
        c = Image.new('RGB', (w, h), (255, 255, 255)); place(c, fit(full, w * (0.62 if orient == 'port' else 0.42), h * 0.3))
        save(c, f)
c = Image.new('RGB', (480, 320), (255, 255, 255)); place(c, fit(full, 480 * 0.5, 320 * 0.3)); save(c, f'{RES}/drawable/splash.png')

# Aset Google Play
os.makedirs(STORE, exist_ok=True)
ic = Image.new('RGB', (512, 512), (255, 255, 255)); place(ic, fit(mark_rgba, 512 * 0.66, 512 * 0.66)); save(ic, f'{STORE}/play-icon-512.png')
print('Ikon & splash Android dibuat.')
