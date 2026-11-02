# 2026-11-02 · fix/partner-profile-kpi-20261102: импорт Stat/Stats в кабинете партнёра

**Проблема.** Гейт main f6768866 (release-checks 41375753759) красный на typecheck: при слиянии main в PR1014
(4b82e154) из `apps/web/src/app/partner/page.tsx` ушёл импорт `Stat, Stats` (главная и «Деньги» перешли на
`KpiStrip`), а карточка партнёра VTOP во вкладке «Профиль» из PR1014 их использует. Прод не двигался (4a65811f).

**Решение.** Вернуть импорт `Stat, Stats`; разметку не менять, UI-тест platform-money (partner-card, partner-score,
partner-success) проверяет карточку как была.

**Последствия.** Гейт main снова может выкатить PR1014 (миграция 179 идёт обычной цепочкой гейта).
