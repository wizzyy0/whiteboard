"""Иконка сайта из картинки пользователя: favicon.ico + icon.png + apple-icon.png."""
from PIL import Image

SRC = "/home/z/my-project/upload/pasted_image_1794852598448.png"
APP = "/home/z/my-project/src/app"

src = Image.open(SRC).convert("RGB")
w, h = src.size

# Обрезаем серые поля вокруг доски (~82% центра), чтобы доска читалась в мелком размере
side = int(w * 0.82)
left = (w - side) // 2
top = (h - side) // 2
img = src.crop((left, top, left + side, top + side)).convert("RGBA")

icon = img.resize((256, 256), Image.LANCZOS)
icon.save(f"{APP}/icon.png", "PNG")

apple = img.resize((180, 180), Image.LANCZOS)
apple.save(f"{APP}/apple-icon.png", "PNG")

img.save(f"{APP}/favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

# Контроль
import os
for f in ["favicon.ico", "icon.png", "apple-icon.png"]:
    p = f"{APP}/{f}"
    print(f, os.path.getsize(p), "bytes")
print("done")
