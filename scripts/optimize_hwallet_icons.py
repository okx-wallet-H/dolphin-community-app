from pathlib import Path
from PIL import Image

TARGETS = {
    "icon.png": 1024,
    "splash-icon.png": 1024,
    "favicon.png": 512,
    "android-icon-foreground.png": 1024,
}

base = Path("/home/ubuntu/h-wallet-ui-rebuild/assets/images")

for name, size in TARGETS.items():
    path = base / name
    image = Image.open(path).convert("RGBA")
    image.thumbnail((size, size))
    image.save(path, format="PNG", optimize=True)
    print(f"optimized {name} -> {path.stat().st_size / 1024:.1f}KB")
