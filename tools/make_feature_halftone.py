"""Builds the black-on-transparent halftone photograph for the homepage featured-website band.

Usage (run from anywhere; paths are resolved relative to the project):
    python tools/make_feature_halftone.py <resource-id> <source-image> [--focus FX,FY] [--out PATH]
    python tools/make_feature_halftone.py holyoke-1941 tools/halftone-source-holyoke-1941.jpg --crop 0.125,0.075,0.86,1.0 --out PATH

Default output: images/editorial/feature-<resource-id>.png (1100 x 1364 RGBA, near-black dots on a TRANSPARENT background,
so the page colour shows through: cream above the red band, red inside it).

The look is LOCKED. The numbers below are the exact values used for the original Holyoke halftone
(tools/make_halftone.py, 2026-10-14) and must not be tuned per image; the regression test
(data/featured-images.test.js) re-runs this script on the Holyoke source and requires the committed PNG back.
The only per-image choices are WHICH part of the photo is used: --focus (cover-crop anchor, default centre) or
--crop (explicit fractions x0,y0,x1,y1 of the source). See tools/FEATURED_IMAGE_WORKFLOW.md.

Requires Pillow + numpy. Not published (tools/ is in .assetsignore)."""
import argparse, math, pathlib, sys
import numpy as np
from PIL import Image, ImageOps, ImageFilter

# ---- LOCKED LOOK (identical to tools/make_halftone.py) ----
W = 1100                      # output width in px
H_OUT = 1364                  # output height in px (aspect of the committed Holyoke image 1100 x 1364)
PITCH = 9                     # dot spacing in output px
ANGLE = math.radians(45)
SS = 3                        # supersampling for smooth dots
INK = (0x17, 0x14, 0x0F)      # near-black ink
# ------------------------------------------------------------

ROOT = pathlib.Path(__file__).resolve().parent.parent


def crop_fractions(src, crop):
    cw, ch = src.size
    x0, y0, x1, y1 = crop
    return src.crop((int(cw * x0), int(ch * y0), int(cw * x1), int(ch * y1)))


def cover_crop(src, focus):
    """Crop to the 1100:1364 aspect (like CSS object-fit: cover), anchored at focus (0..1, 0..1)."""
    cw, ch = src.size
    target = W / H_OUT
    if cw / ch > target:           # too wide: trim the sides
        nw = round(ch * target); x0 = round((cw - nw) * focus[0]); return src.crop((x0, 0, x0 + nw, ch))
    nh = round(cw / target); y0 = round((ch - nh) * focus[1]); return src.crop((0, y0, cw, y0 + nh))


def halftone(src):
    """src: PIL 'L' image already cropped to the wanted region. Returns an RGBA numpy array."""
    h = round(src.height * W / src.width)
    img = src.resize((W, h), Image.LANCZOS)
    img = ImageOps.autocontrast(img, cutoff=1.5)
    img = img.filter(ImageFilter.GaussianBlur(1.0))
    a = np.asarray(img, dtype=np.float32) / 255.0
    a = np.clip((a - 0.45) * 1.15 + 0.5, 0, 1)        # gentle contrast, lifted
    a = a ** 0.8
    tone = 1.0 - a                                     # ink coverage 0..1

    H2, W2 = h * SS, W * SS
    ys, xs = np.mgrid[0:H2, 0:W2].astype(np.float32)
    xs /= SS; ys /= SS
    u = xs * math.cos(ANGLE) + ys * math.sin(ANGLE)
    v = -xs * math.sin(ANGLE) + ys * math.cos(ANGLE)
    cu = (np.floor(u / PITCH) + 0.5) * PITCH
    cv = (np.floor(v / PITCH) + 0.5) * PITCH
    cx = cu * math.cos(ANGLE) - cv * math.sin(ANGLE)
    cy = cu * math.sin(ANGLE) + cv * math.cos(ANGLE)
    ix = np.clip(cx.astype(int), 0, W - 1); iy = np.clip(cy.astype(int), 0, h - 1)
    t = tone[iy, ix]
    r = PITCH * 0.68 * np.sqrt(t)                      # dot radius: area ~ coverage
    d = np.sqrt((u - cu) ** 2 + (v - cv) ** 2)
    mask = (d <= r).astype(np.float32)
    mask = mask.reshape(h, SS, W, SS).mean(axis=(1, 3))
    alpha = (mask * 255).astype(np.uint8)
    out = np.zeros((h, W, 4), np.uint8)
    out[..., 0], out[..., 1], out[..., 2] = INK
    out[..., 3] = alpha
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('resource_id', help='directory resource id, e.g. gapminder (used in the default output name)')
    ap.add_argument('source', help='source photograph (JPEG/PNG)')
    g = ap.add_mutually_exclusive_group()
    g.add_argument('--focus', default='0.5,0.5', help='cover-crop anchor FX,FY in 0..1 (default 0.5,0.5)')
    g.add_argument('--crop', help='explicit crop as fractions x0,y0,x1,y1 of the source (used for the Holyoke regression)')
    ap.add_argument('--out', help='output PNG path (default images/editorial/feature-<resource-id>.png)')
    a = ap.parse_args(argv)

    src = Image.open(a.source)
    src = ImageOps.exif_transpose(src).convert('L')
    if a.crop:
        region = crop_fractions(src, [float(x) for x in a.crop.split(',')])
    else:
        region = cover_crop(src, [float(x) for x in a.focus.split(',')])
    out = halftone(region)
    dest = pathlib.Path(a.out) if a.out else ROOT / 'images' / 'editorial' / ('feature-' + a.resource_id + '.png')
    if dest.exists() and not a.out:
        sys.exit('refusing to overwrite existing ' + str(dest) + ' (delete it first or pass --out)')
    Image.fromarray(out, 'RGBA').save(dest, optimize=True)
    print(dest, out.shape[1], out.shape[0], dest.stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
