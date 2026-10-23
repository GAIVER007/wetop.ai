/**
 * Подсказка о надёжности нового пароля в окне регистрации (пожелание владельца 22.10.2026). Это подсказка, а не
 * правило: обязательные условия прежние и проверяются сервером (`checkPassword` в домене: не короче 10 знаков и не
 * только цифры). Остальные пункты поднимают оценку, но регистрацию не запрещают.
 */
export interface PasswordRule {
  id: 'length' | 'notDigits' | 'lettersDigits' | 'case' | 'symbol';
  label: string;
  /** Без него сервер пароль не примет */
  required: boolean;
  met: boolean;
}

export interface PasswordStrength {
  /** 0 пусто, 1 слабый, 2 средний, 3 хороший, 4 надёжный */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  rules: PasswordRule[];
  /** Похоже на частый пароль: «qwerty…», «1234…», четыре одинаковых знака подряд */
  guessable: boolean;
}

export const PASSWORD_LEVELS = ['', 'Слабый', 'Средний', 'Хороший', 'Надёжный'] as const;

const COMMON =
  /^(?:password|passw0rd|parol|qwerty|йцукен|letmein|welcome|admin|iloveyou|abc123|111111|123123|123456)/i;
const RUN = /(.)\1{3,}/;
const RUN_UP = /(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|wert|erty|asdf|йцук|фыва)/i;
const SYMBOL = /[^\p{L}\p{N}\s]/u;

/** Длина как у сервера: пробелы по краям не считаются (`checkPassword` обрезает их). */
export function passwordStrength(raw: string): PasswordStrength {
  const value = raw.trim();
  const letters = /\p{L}/u.test(value);
  const digits = /\p{N}/u.test(value);
  const rules: PasswordRule[] = [
    { id: 'length', label: 'Не короче 10 знаков', required: true, met: value.length >= 10 },
    { id: 'notDigits', label: 'Не только цифры', required: true, met: value.length > 0 && !/^\d+$/.test(value) },
    { id: 'lettersDigits', label: 'Буквы и цифры', required: false, met: letters && digits },
    {
      id: 'case',
      label: 'Заглавные и строчные буквы',
      required: false,
      met: /\p{Lu}/u.test(value) && /\p{Ll}/u.test(value),
    },
    { id: 'symbol', label: 'Знак, например ! или #', required: false, met: SYMBOL.test(value) },
  ];
  const guessable = value.length > 0 && (COMMON.test(value) || RUN.test(value) || RUN_UP.test(value));
  let score: PasswordStrength['score'] = 0;
  if (value.length > 0) {
    const requiredMet = rules.every((r) => !r.required || r.met);
    const extra = rules.filter((r) => !r.required && r.met).length;
    score = !requiredMet || guessable ? 1 : extra >= 3 ? 4 : extra === 2 ? 3 : 2;
  }
  return { score, label: PASSWORD_LEVELS[score], rules, guessable };
}
