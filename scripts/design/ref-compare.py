"""Сравнение снимка экрана с эталоном владельца (DESIGN.md §21, шаг 5).

Запуск: python3 scripts/design/ref-compare.py <эталон> <снимок> <папка-вывода> [имя]
Нужен Pillow. Снимок приводится к ширине эталона. В папку пишутся:
  <имя>-side-by-side.png  эталон слева, снимок справа;
  <имя>-overlay.png       наложение 50 на 50;
  <имя>-diff.png          тепловая карта отличий (красное: отличие больше порога);
и печатается доля отличающихся пикселей. Число не судья сходства: эталон нарисован с выдуманными
данными, поэтому основное доказательство даёт таблица измеренных расхождений в отчёте среза.
"""

import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

THRESHOLD = 24  # сумма разниц каналов, ниже которой отличие считается сглаживанием


def main() -> None:
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(2)
    ref_path, shot_path, out_dir = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    name = sys.argv[4] if len(sys.argv) > 4 else shot_path.stem
    out_dir.mkdir(parents=True, exist_ok=True)

    ref = Image.open(ref_path).convert("RGB")
    shot = Image.open(shot_path).convert("RGB")
    if shot.width != ref.width:
        shot = shot.resize((ref.width, round(shot.height * ref.width / shot.width)))
    height = max(ref.height, shot.height)
    ref_c = Image.new("RGB", (ref.width, height), "white")
    ref_c.paste(ref, (0, 0))
    shot_c = Image.new("RGB", (ref.width, height), "white")
    shot_c.paste(shot, (0, 0))

    gap = 24
    side = Image.new("RGB", (ref.width * 2 + gap, height + 40), "white")
    side.paste(ref_c, (0, 40))
    side.paste(shot_c, (ref.width + gap, 40))
    draw = ImageDraw.Draw(side)
    draw.text((8, 12), "ЭТАЛОН", fill="black")
    draw.text((ref.width + gap + 8, 12), "РЕАЛИЗАЦИЯ", fill="black")
    side.save(out_dir / f"{name}-side-by-side.png")

    Image.blend(ref_c, shot_c, 0.5).save(out_dir / f"{name}-overlay.png")

    diff = ImageChops.difference(ref_c, shot_c)
    pixels = diff.load()
    heat = Image.new("RGB", diff.size, "white")
    hp = heat.load()
    changed = 0
    for y in range(diff.height):
        for x in range(diff.width):
            r, g, b = pixels[x, y]
            if r + g + b > THRESHOLD:
                changed += 1
                hp[x, y] = (220, 40, 40)
    heat = Image.blend(ref_c.convert("L").convert("RGB"), heat, 0.6)
    heat.save(out_dir / f"{name}-diff.png")
    total = diff.width * diff.height
    print(f"{name}: отличается {changed / total:.1%} пикселей ({diff.width}×{diff.height})")


if __name__ == "__main__":
    main()
