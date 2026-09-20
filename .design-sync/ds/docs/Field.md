---
category: forms
---
# Field — подпись и поле

Подпись над полем (или слева — `inline`). Текст подписи идёт **первым**, поэтому поле находится по
подписи и читалкой, и тестом. Свой `<label>` вокруг поля писать не нужно.

```tsx
<Field label="Телефон">
  <Input name="phone" type="tel" />
</Field>
<Field label="Только свободные" inline>
  <Input type="checkbox" name="free" />
</Field>
```

Поле без видимой подписи — нарушение: `placeholder` исчезает при вводе и не читается голосом.
