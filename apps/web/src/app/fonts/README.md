# Шрифт стойки: `inter-wetop.woff2`

Inter 4.001, вариативный (OFL, `google/fonts/ofl/inter`), подмножество для стойки (Q-DES-3, 13.10.2026).

Собран из `Inter[opsz,wght].ttf` (fontTools 4.x):

```
python -m fontTools.varLib.instancer 'Inter[opsz,wght].ttf' opsz=14 -o Inter-opsz14.ttf
pyftsubset Inter-opsz14.ttf \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0400-04FF,U+2000-206F,U+2070-209F,U+20A0-20CF,U+2100-214F,U+2190-21FF,U+2212,U+2215,U+2318,U+2713,U+2715,U+FEFF,U+FFFD" \
  --layout-features="kern,liga,calt,case,locl,tnum,zero,cv05,cv08,ss01,ccmp,mark,mkmk" \
  --flavor=woff2 --output-file=inter-wetop.woff2
```

Проверено по файлу: все казахские буквы, ₸, №, «», ⌘, ↑↓, €, ₽, узкий неразрывный пробел; ось `wght` 100–900;
табличные цифры `tnum`. Размер 83 КБ.
