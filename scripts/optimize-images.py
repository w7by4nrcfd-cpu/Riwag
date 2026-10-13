"""Optional asset preparation. Requires Pillow: python3 -m pip install pillow."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
target = root / 'public' / 'assets'
target.mkdir(parents=True, exist_ok=True)
for source in (root / 'source-assets').glob('*.png'):
    image = Image.open(source).convert('RGB')
    for width in (640, 1200, 1680):
        version = image.copy()
        version.thumbnail((width, width))
        version.save(target / f'{source.stem}-{width}.webp', quality=85, method=6)
    print(source.name)

# Link-preview images (WhatsApp, X, iMessage): 1200x630 JPEG, kept small so messaging apps accept them.
for source in (root / 'source-assets').glob('*.png'):
    image = Image.open(source).convert('RGB')
    w, h = image.size
    target_h = round(w * 630 / 1200)
    top = max(0, (h - target_h) // 2)
    image.crop((0, top, w, top + target_h)).resize((1200, 630), Image.LANCZOS).save(target / f'{source.stem}-og.jpg', quality=78, optimize=True, progressive=True)
