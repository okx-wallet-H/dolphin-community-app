from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance

ROOT = Path('/home/ubuntu/workspace/hwallet_ui_20260412')
SRC = Path('/home/ubuntu/upload/头像01.png')
ASSETS = ROOT / 'assets' / 'images'

TARGETS = {
    'icon.png': (1024, 1024),
    'splash-icon.png': (420, 420),
    'favicon.png': (256, 256),
    'hwallet-official-logo.png': (640, 640),
    'hwallet-official-logo-square.png': (512, 512),
    'android-icon-foreground.png': (1024, 1024),
    'android-icon-monochrome.png': (432, 432),
}


def make_square(img: Image.Image, size: tuple[int, int], bg: str | tuple[int, int, int, int] = (255, 255, 255, 0)) -> Image.Image:
    fitted = ImageOps.contain(img, size, Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', size, bg)
    x = (size[0] - fitted.width) // 2
    y = (size[1] - fitted.height) // 2
    canvas.paste(fitted, (x, y), fitted if fitted.mode == 'RGBA' else None)
    return canvas


def make_monochrome(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    contained = ImageOps.contain(img.convert('RGBA'), size, Image.Resampling.LANCZOS)
    alpha = contained.getchannel('A') if 'A' in contained.getbands() else None
    gray = ImageOps.grayscale(contained)
    boosted = ImageEnhance.Contrast(gray).enhance(1.2)
    mono = Image.new('RGBA', contained.size, (255, 255, 255, 0))
    pixels = []
    for i, v in enumerate(boosted.getdata()):
        a = alpha.getdata()[i] if alpha else 255
        if a == 0:
            pixels.append((255, 255, 255, 0))
        else:
            pixels.append((255, 255, 255, a))
    mono.putdata(pixels)
    canvas = Image.new('RGBA', size, (255, 255, 255, 0))
    x = (size[0] - mono.width) // 2
    y = (size[1] - mono.height) // 2
    canvas.paste(mono, (x, y), mono)
    return canvas


src = Image.open(SRC).convert('RGBA')
for name, size in TARGETS.items():
    if name == 'android-icon-monochrome.png':
        out = make_monochrome(src, size)
    else:
        out = make_square(src, size)
    out.save(ASSETS / name)

# Adaptive icon background retained as solid white for clarity with foreground logo.
Image.new('RGBA', (512, 512), '#ffffff').save(ASSETS / 'android-icon-background.png')
