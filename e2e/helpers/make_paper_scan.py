"""Draw a small 'scanned' question paper (three numbered questions) as a PNG for the OCR step of the P9 browser test.

    backend/.venv/Scripts/python.exe e2e/helpers/make_paper_scan.py <output.png>
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

out = Path(sys.argv[1])
QUESTIONS = [
    "1. Explain how a hash map resolves collisions and what the load factor means.",
    "2. Write a SQL query to find the second highest salary in the Employee table.",
    "3. Describe the difference between a process and a thread in an operating system.",
]

font = None
for candidate in ("C:/Windows/Fonts/arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/Library/Fonts/Arial.ttf"):
    if Path(candidate).exists():
        font = ImageFont.truetype(candidate, 30)
        break
if font is None:
    font = ImageFont.load_default()

img = Image.new("RGB", (1500, 520), "white")
draw = ImageDraw.Draw(img)
y = 40
for q in QUESTIONS:
    draw.text((50, y), q, fill="black", font=font)
    y += 110
img.save(out)
print("ok")
