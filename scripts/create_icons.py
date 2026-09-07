"""Regenerate the code-drawn app icon. Pillow is needed only for this dev script."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / 'public/icons'
root.mkdir(parents=True, exist_ok=True)
scale = 4
im = Image.new('RGBA', (512*scale, 512*scale), '#254f40')
d = ImageDraw.Draw(im)
def line(points, color='#e7efb0', width=18):
    d.line([(x*scale,y*scale) for x,y in points], fill=color, width=width*scale, joint='curve')
line([(132,140),(188,140),(229,154),(256,178),(283,154),(324,140),(380,140),(380,358),(325,358),(287,371),(256,395),(225,371),(187,358),(132,358),(132,140)])
line([(256,178),(256,391)],width=13)
line([(177,211),(216,226)],width=12)
line([(177,270),(216,284)],width=12)
line([(296,226),(335,211)],width=12)
line([(296,284),(335,270)],width=12)
for size in [192,512]:
    im.resize((size,size),Image.Resampling.LANCZOS).save(root/f'icon-{size}.png')
print('Created 192px and 512px app icons')
