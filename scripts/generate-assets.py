#!/usr/bin/env python3
"""Icons and a high-contrast sample policy for on-device OCR."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT = "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"
PINE = (30, 63, 58)
CREAM = (247, 241, 228)
SEAL = (159, 45, 26)
INK = (28, 25, 21)


def icon(size: int, maskable: bool) -> Image.Image:
    image = Image.new("RGB", (size, size), PINE)
    draw = ImageDraw.Draw(image)
    pad = int(size * (0.16 if maskable else 0.1))
    draw.rounded_rectangle((pad, pad, size - pad, size - pad), radius=size // 10, fill=CREAM)
    radius = int(size * 0.16)
    center = size // 2 + int(size * 0.04)
    draw.ellipse((center - radius, center - radius, center + radius, center + radius), fill=SEAL)
    font = ImageFont.truetype(FONT, int(size * 0.2))
    text = "忘"
    box = draw.textbbox((0, 0), text, font=font)
    draw.text((center - (box[2] - box[0]) / 2, center - (box[3] - box[1]) / 2 - size * 0.02), text, fill=CREAM, font=font)
    return image


def sample() -> Image.Image:
    width, height = 1400, 1600
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    draw.rectangle((48, 48, width - 48, height - 48), outline=PINE, width=6)
    title = ImageFont.truetype(FONT, 92)
    body = ImageFont.truetype(FONT, 64)
    lines = [
        (120, "平安保险单", title),
        (280, "被保险人：李娜", body),
        (420, "保费：¥1,280.00", body),
        (560, "生效日期：2026年1月1日", body),
        (700, "有效期至：2026年12月31日", body),
        (900, "Name: Li Na", body),
        (1040, "Premium: CNY 1280.00", body),
        (1180, "Valid until: 31 Dec 2026", body),
    ]
    for top, text, font in lines:
        draw.text((100, top), text, fill=INK, font=font)
    return image


def main() -> None:
    icons = ROOT / "public" / "icons"
    icons.mkdir(parents=True, exist_ok=True)
    icon(180, False).save(icons / "icon-180.png")
    icon(192, False).save(icons / "icon-192.png")
    icon(512, False).save(icons / "icon-512.png")
    icon(512, True).save(icons / "icon-maskable-512.png")
    sample().save(ROOT / "public" / "sample-policy.png", optimize=True)
    print("wrote icons and sample-policy.png")


if __name__ == "__main__":
    main()
