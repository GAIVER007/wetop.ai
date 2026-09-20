---
category: foundation
---
# Icon — иконка набора

Единственный источник иконок стойки: `lucide-react`, обводка 1.7, размер 20 px (`--icon-size`),
`aria-hidden` — смысл всегда несёт соседний текст, а не иконка (DESIGN.md §1 п. 4, §7).

Имена набора: `arrival departure bed check clock chevron today board guests rates money inventory
channels journal incidents analytics search plus arrow close menu settings sun moon collapse expand
booking down filter more external system mail phone receipt refresh send card shield`.
Полный список в рантайме — `iconNames`.

```tsx
<Icon name="guests" />
<Icon name="incidents" width={32} height={32} />
```

Своих SVG на экранах не рисуем: иконка вне набора — повод добавить её в `icon.tsx`, а не в разметку.
