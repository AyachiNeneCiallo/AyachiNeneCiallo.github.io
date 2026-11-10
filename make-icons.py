"""从 public/favicon.ico 生成站点图标与页头 logo。

- favicon-32.png / favicon-16.png / apple-touch-icon.png（180）
- logo.png 页头用，裁掉透明边并留一点内边距
"""
from PIL import Image

src = Image.open("public/favicon.ico").convert("RGBA")
bbox = src.getchannel("A").getbbox()
cropped = src.crop(bbox)
w, h = cropped.size
# 补成正方形，居中
side = max(w, h)
square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
square.paste(cropped, ((side - w) // 2, (side - h) // 2), cropped)

for size, name in [
    (16, "public/favicon-16.png"),
    (32, "public/favicon-32.png"),
    (180, "public/apple-touch-icon.png"),
    (256, "public/icon-256.png"),
]:
    square.resize((size, size), Image.LANCZOS).save(name, optimize=True)
    print(name)

# 页头 logo：用 128 存，显示时缩到 32px 左右，高分屏也清晰
square.resize((128, 128), Image.LANCZOS).save("public/logo.png", optimize=True)
print("public/logo.png")
