"""
Free Range Tutors — catalogue thumbnail generator.

Permanent, reusable version of the pipeline proven out in
_mockups/shots/process4.py and process5.py. Produces the same duotone
treatment used by every image already in images/resources/:

  square crop -> grayscale -> autocontrast -> per-channel duotone LUT
  (DARK -> category colour) -> 900x900 master -> 480x480 delivered PNG

Two source modes:

  --source <image>            Tier 1: crop a real logo/screenshot.
  --text "<Resource Name>"    Tier 2: typographic fallback card, same
                               display typeface as the site's own
                               oversized-title treatment (Libre Caslon
                               Display / Georgia fallback), rendered
                               directly into the duotone pipeline.

Usage:
  python tools/generate_thumbnail.py --source shot.png --box 40,150,360,470 \
      --category games --id baamboozle

  python tools/generate_thumbnail.py --text "YouGlish" \
      --category web_apps_tools --id youglish

Always writes:
  images/resources/<id>.png        (480x480, final)
  images/resources/_masters/<id>-900.png   (900x900 master, kept for
                                             re-export/inspection, not
                                             referenced by any page)
"""
import argparse
import os
from PIL import Image, ImageDraw, ImageFont, ImageOps

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(REPO_ROOT, "images", "resources")
MASTER_DIR = os.path.join(OUT_DIR, "_masters")

MASTER_SIZE = 900
FINAL_SIZE = 480

# ---- approved 5-colour system, keyed to primary_category. Do not add,
# remove, or repurpose entries here without an explicit design decision —
# these five are the whole catalogue's colour language. ----
COLORS = {
    "websites_resource_hubs": (0xC2, 0x2A, 0x1E),  # vermilion red
    "teaching_materials":     (0x2A, 0x4C, 0x7C),  # cobalt blue
    "web_apps_tools":         (0x9C, 0x6B, 0x14),  # deep ochre/mustard
    "games":                  (0x2C, 0x6E, 0x49),  # forest green
    "media":                  (0x5B, 0x3A, 0x5C),  # muted plum/aubergine
}

DARK = (12, 10, 8)  # warm near-black ink, not pure black — unchanged from process4/5

FONT_CANDIDATES = [
    # Windows-common serif fallbacks approximating the site's
    # Libre Caslon Display heading face, tried in order.
    "C:/Windows/Fonts/georgiab.ttf",
    "C:/Windows/Fonts/georgia.ttf",
    "C:/Windows/Fonts/timesbd.ttf",
    "C:/Windows/Fonts/times.ttf",
]


def make_duotone(im, color):
    l = ImageOps.grayscale(im)
    l = ImageOps.autocontrast(l, cutoff=0)
    r = l.point([int(DARK[0] + (color[0] - DARK[0]) * (i / 255.0)) for i in range(256)])
    g = l.point([int(DARK[1] + (color[1] - DARK[1]) * (i / 255.0)) for i in range(256)])
    b = l.point([int(DARK[2] + (color[2] - DARK[2]) * (i / 255.0)) for i in range(256)])
    return Image.merge("RGB", (r, g, b))


def square_center_crop(im):
    w, h = im.size
    side = min(w, h)
    return im.crop(((w - side) // 2, (h - side) // 2, (w - side) // 2 + side, (h - side) // 2 + side))


def compose_on_field(duotoned, category, fill=1.35):
    """Paste an already-duotoned (non-square) crop onto a pure
    category-colour MASTER_SIZE x MASTER_SIZE field, scaled up by
    `fill` so it overflows and bleeds off every edge rather than
    floating with visible field on all sides. The field itself is the
    exact category hex — never a duotoned dark tone — because nothing
    here re-runs the duotone LUT over background pixels.

    Duotoning BEFORE compositing (not after, and not by padding with
    a dark colour pre-duotone) is what keeps the field a true, flat
    category colour: padding with DARK pre-duotone was the original
    bug here — DARK's grayscale value sits near the bottom of the LUT,
    so it duotoned back to near-black instead of to the category hue."""
    w, h = duotoned.size
    long_side = max(w, h)
    scale = (MASTER_SIZE * fill) / long_side
    new_w, new_h = int(w * scale), int(h * scale)
    resized = duotoned.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGB", (MASTER_SIZE, MASTER_SIZE), category)
    x = (MASTER_SIZE - new_w) // 2
    y = (MASTER_SIZE - new_h) // 2
    canvas.paste(resized, (x, y))
    return canvas


def build_from_source(source_path, box, category, fit="crop", fill=1.35):
    im = Image.open(source_path).convert("RGB")
    if box:
        im = im.crop(box)
    color = COLORS[category]
    if fit == "pad":
        # Duotone the crop AS-IS (whatever its aspect ratio), then
        # composite the result onto a pure-colour field — see
        # compose_on_field's docstring for why order matters here.
        duotoned_crop = make_duotone(im, color)
        return compose_on_field(duotoned_crop, color, fill=fill)
    else:
        square = square_center_crop(im)
        square = square.resize((MASTER_SIZE, MASTER_SIZE), Image.LANCZOS)
        return make_duotone(square, color)


def _load_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def build_typographic(name, category):
    """Tier 2 fallback: the resource name set large, bleeding off the
    frame edge — the same 'oversized type as the graphic device'
    treatment the site already uses for its own logo-less originals
    (Speaking Experiments, ZARD, Backstory Objects), run through the
    identical duotone pipeline so a fallback card matches the rest of
    the catalogue rather than reading as a placeholder."""
    canvas = Image.new("L", (MASTER_SIZE, MASTER_SIZE), color=255)
    draw = ImageDraw.Draw(canvas)

    words = name.split(" ")
    size = 220
    font = _load_font(size)

    def line_widths(font_obj, lines):
        return [draw.textbbox((0, 0), line, font=font_obj)[2] for line in lines]

    def wrap(font_obj):
        lines, current = [], ""
        for w in words:
            trial = (current + " " + w).strip()
            width = draw.textbbox((0, 0), trial, font=font_obj)[2]
            if width > MASTER_SIZE * 1.35 and current:
                lines.append(current)
                current = w
            else:
                current = trial
        if current:
            lines.append(current)
        return lines

    lines = wrap(font)
    while size > 60:
        line_h = draw.textbbox((0, 0), "Ag", font=font)[3] * 1.05
        total_h = line_h * len(lines)
        max_w = max(line_widths(font, lines)) if lines else 0
        if max_w <= MASTER_SIZE * 1.3 and total_h <= MASTER_SIZE * 1.3:
            break
        size -= 8
        font = _load_font(size)
        lines = wrap(font)

    line_h = draw.textbbox((0, 0), "Ag", font=font)[3] * 1.05
    total_h = line_h * len(lines)
    y = (MASTER_SIZE - total_h) / 2
    for line in lines:
        w = draw.textbbox((0, 0), line, font=font)[2]
        x = (MASTER_SIZE - w) / 2
        draw.text((x, y), line, font=font, fill=0)
        y += line_h

    rgb = canvas.convert("RGB")
    return make_duotone(rgb, COLORS[category])


def save(master, resource_id):
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(MASTER_DIR, exist_ok=True)
    master_path = os.path.join(MASTER_DIR, f"{resource_id}-900.png")
    master.save(master_path)
    final = master.resize((FINAL_SIZE, FINAL_SIZE), Image.LANCZOS)
    final_path = os.path.join(OUT_DIR, f"{resource_id}.png")
    final.save(final_path, optimize=True)
    return final_path, master_path


def main():
    p = argparse.ArgumentParser(description="Generate an FRT catalogue thumbnail.")
    p.add_argument("--id", required=True, help="resource id, matches data/resources/<id>.json")
    p.add_argument("--category", required=True, choices=list(COLORS.keys()))
    p.add_argument("--source", help="path to a source logo/screenshot image (Tier 1)")
    p.add_argument("--box", help="left,top,right,bottom crop box into --source, before squaring")
    p.add_argument("--fit", choices=["crop", "pad"], default="crop",
                    help="'crop' (default) center-crops to a square — use for an already "
                         "roughly-square source region (a hero photo, an icon grid). "
                         "'pad' duotones the crop as-is (any aspect ratio) then composites "
                         "it onto a pure category-colour field, scaled up by --fill so it "
                         "bleeds off the edges — use for a wide/short or tall/narrow "
                         "wordmark or logo crop, where a plain center-crop would keep only "
                         "a sliver of it.")
    p.add_argument("--fill", type=float, default=1.35,
                    help="only with --fit pad: how much to scale the crop up before "
                         "centering it on the category-colour field. 1.0 fits the crop's "
                         "long edge exactly to the canvas (no bleed); >1.0 overflows and "
                         "crops at the edges for a larger, more recognisable mark. Default "
                         "1.35. Push higher (1.5-1.8) for a small/plain logo, lower "
                         "(1.1-1.2) if the crop already fills the frame.")
    p.add_argument("--text", help="resource name for the typographic fallback (Tier 2)")
    args = p.parse_args()

    if args.source:
        box = tuple(int(x) for x in args.box.split(",")) if args.box else None
        master = build_from_source(args.source, box, args.category, fit=args.fit, fill=args.fill)
        tier = 1
    elif args.text:
        master = build_typographic(args.text, args.category)
        tier = 2
    else:
        raise SystemExit("Provide either --source (Tier 1) or --text (Tier 2).")

    final_path, master_path = save(master, args.id)
    print(f"[tier {tier}] wrote {final_path} (master: {master_path})")


if __name__ == "__main__":
    main()
