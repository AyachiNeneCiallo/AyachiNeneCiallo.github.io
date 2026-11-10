"""
生成邮箱图片 public/email.png（透明背景）。
避免在网页里出现可被抓取的明文邮箱。

用法：python make-email-image.py
邮箱地址从 src/site.config.ts 读取，改配置后重跑即可。
"""
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / "src" / "site.config.ts"
OUT = ROOT / "public" / "email.png"

email = re.search(r"email:\s*'([^']+)'", CONFIG.read_text(encoding="utf-8")).group(1)

# 4 倍尺寸渲染，显示时缩小，保证高分屏也清晰
SCALE = 4
FONT_SIZE = 15 * SCALE
COLOR = (71, 85, 127, 255)  # --color-accent #47557f

candidates = [
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\segoeui.ttf",
]
font = None
for path in candidates:
    if Path(path).exists():
        font = ImageFont.truetype(path, FONT_SIZE)
        break
if font is None:
    raise SystemExit("没找到可用字体")

# 先量尺寸
probe = Image.new("RGBA", (10, 10))
bbox = ImageDraw.Draw(probe).textbbox((0, 0), email, font=font)
w = bbox[2] - bbox[0]
h = bbox[3] - bbox[1]
pad = 2 * SCALE

img = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
ImageDraw.Draw(img).text((pad - bbox[0], pad - bbox[1]), email, font=font, fill=COLOR)
img.save(OUT, optimize=True)

print(f"saved {OUT.relative_to(ROOT)}  {img.size[0]}x{img.size[1]}  {OUT.stat().st_size} bytes")
print(f"email length = {len(email)}")
