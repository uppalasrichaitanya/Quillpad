"""Generate Quillpad app icons: bold Q-monogram matching src/quill.js.

Draws directly with Pillow (smooth strokes, no turbulence — icons read better
clean at small sizes): a thick ink ring + quill shaft crossing it as the Q
tail + one barb + the rust ink flick. Same geometry language as the in-app
mark, sized for icon clarity.
"""
from PIL import Image, ImageDraw
import math

INK = (54, 43, 30, 255)    # #362B1E
RUST = (188, 90, 50, 255)  # #BC5A32

S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# --- the Q bowl: thick ring, slightly eccentric for hand-drawn feel
cx, cy, r = 512, 460, 300
draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=INK, width=116)

# --- quill shaft: from upper right, crossing the ring's lower right
# (approximates the SVG bezier M 452 84 C 368 168 322 300 334 388 scaled 2x)
def bezier(p0, p1, p2, p3, n=80):
    return [
        (
            (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t ** 2 * p2[0] + t ** 3 * p3[0],
            (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t ** 2 * p2[1] + t ** 3 * p3[1],
        )
        for t in [i / n for i in range(n + 1)]
    ]

def stroke(points, width, color):
    draw.line(points, fill=color, width=width, joint="curve")
    for p in (points[0], points[-1]):
        rr = width / 2
        draw.ellipse([p[0] - rr, p[1] - rr, p[0] + rr, p[1] + rr], fill=color)

shaft = bezier((904, 168), (736, 336), (644, 600), (668, 776))
stroke(shaft, 108, INK)

# --- one bold barb on the shaft
barb = bezier((828, 260), (776, 236), (732, 236), (700, 252))
stroke(barb, 60, INK)

# --- rust ink flick off the bottom of the ring
flick = bezier((600, 784), (632, 868), (696, 912), (772, 924))
stroke(flick, 80, RUST)

img.save("src-tauri/icons/icon.png")
img.resize((128, 128), Image.LANCZOS).save("src-tauri/icons/icon-128.png")
print("icons written: icon.png (1024), icon-128.png")
