"""Builds images/editorial/halftone-holyoke-1941.png from the public-domain source photo.
Black ink dots on a TRANSPARENT background (so the page colour shows through: cream or red).
Usage: python make_halftone.py   (run from anywhere; paths are relative to this file)
Requires Pillow + numpy. Not published (tools/ is in .assetsignore)."""
import math, pathlib
import numpy as np
from PIL import Image, ImageOps, ImageFilter

here = pathlib.Path(__file__).parent
src = Image.open(here / "halftone-source-holyoke-1941.jpg").convert("L")
# Crop to the three men: drop most of the empty sky and the right-hand shop front.
cw, ch = src.size
src = src.crop((int(cw * 0.125), int(ch * 0.075), int(cw * 0.86), ch))
W = 1100                      # output width in px
PITCH = 9                     # dot spacing in output px
ANGLE = math.radians(45)
SS = 3                        # supersampling for smooth dots

h = round(src.height * W / src.width)
img = src.resize((W, h), Image.LANCZOS)
img = ImageOps.autocontrast(img, cutoff=1.5)
img = img.filter(ImageFilter.GaussianBlur(1.0))
a = np.asarray(img, dtype=np.float32) / 255.0
a = np.clip((a - 0.45) * 1.15 + 0.5, 0, 1)        # gentle contrast, lifted
a = a ** 0.8
tone = 1.0 - a                                     # ink coverage 0..1

# build high-res coordinate grids
H2, W2 = h * SS, W * SS
ys, xs = np.mgrid[0:H2, 0:W2].astype(np.float32)
xs /= SS; ys /= SS
u = xs * math.cos(ANGLE) + ys * math.sin(ANGLE)
v = -xs * math.sin(ANGLE) + ys * math.cos(ANGLE)
cu = (np.floor(u / PITCH) + 0.5) * PITCH
cv = (np.floor(v / PITCH) + 0.5) * PITCH
# cell centre back in image space -> sample tone there
cx = cu * math.cos(ANGLE) - cv * math.sin(ANGLE)
cy = cu * math.sin(ANGLE) + cv * math.cos(ANGLE)
ix = np.clip(cx.astype(int), 0, W - 1); iy = np.clip(cy.astype(int), 0, h - 1)
t = tone[iy, ix]
r = PITCH * 0.68 * np.sqrt(t)                      # dot radius: area ~ coverage
d = np.sqrt((u - cu) ** 2 + (v - cv) ** 2)
mask = (d <= r).astype(np.float32)
# downsample the supersampled mask to final size (anti-aliasing)
mask = mask.reshape(h, SS, W, SS).mean(axis=(1, 3))
alpha = (mask * 255).astype(np.uint8)
ink = (0x17, 0x14, 0x0F)
out = np.zeros((h, W, 4), np.uint8)
out[..., 0], out[..., 1], out[..., 2] = ink
out[..., 3] = alpha
dest = here.parent / "images" / "editorial" / "halftone-holyoke-1941.png"
Image.fromarray(out, "RGBA").save(dest, optimize=True)
print(dest, W, h, dest.stat().st_size // 1024, "KB")
