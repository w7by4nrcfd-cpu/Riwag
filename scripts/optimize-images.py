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
