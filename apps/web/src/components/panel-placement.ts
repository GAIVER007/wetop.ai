/** Отступ окна от края экрана, px */
const EDGE = 16;
/** Зазор между кнопкой и окном, px */
const GAP = 8;

/**
 * Где открыть выпадающее окно (выбор периода и подобные): под кнопкой, от её левого края; если справа не хватает
 * места, окно прижимается правым краем к кнопке; если и так не помещается, встаёт у края экрана. Окно никогда не
 * выходит за экран (владелец 23.10.2026: «вот так криво открывает календарь, сделай чётко, ровно»).
 */
export function panelPlacement(
  button: { left: number; right: number; bottom: number },
  panelWidth: number,
  viewportWidth: number,
): { left: number; top: number } {
  const top = Math.round(button.bottom + GAP);
  const maxLeft = Math.max(EDGE, viewportWidth - EDGE - panelWidth);
  let left = button.left;
  if (left + panelWidth > viewportWidth - EDGE) {
    const alignedRight = button.right - panelWidth;
    left = alignedRight >= EDGE ? alignedRight : maxLeft;
  }
  left = Math.min(Math.max(left, EDGE), maxLeft);
  if (panelWidth > viewportWidth - 2 * EDGE) left = Math.max(0, Math.floor((viewportWidth - panelWidth) / 2));
  return { left: Math.round(left), top };
}

/**
 * Высота и верх окна: под кнопкой, если снизу хватает места, иначе над ней; окно никогда не уходит за низ экрана,
 * поэтому его кнопки («Отмена», «Применить») видны без прокрутки страницы (24.10.2026)
 */
export function panelBox(
  button: { top: number; bottom: number },
  panelHeight: number,
  viewportHeight: number,
): { top: number; maxHeight: number } {
  const below = viewportHeight - EDGE - (button.bottom + GAP);
  const above = button.top - GAP - EDGE;
  if (panelHeight <= below || below >= above) {
    const top = Math.round(Math.max(EDGE, button.bottom + GAP));
    return { top, maxHeight: Math.max(0, Math.round(viewportHeight - EDGE - top)) };
  }
  const height = Math.min(panelHeight, above);
  const top = Math.round(Math.max(EDGE, button.top - GAP - height));
  return { top, maxHeight: Math.round(Math.min(height, viewportHeight - EDGE - top)) };
}
