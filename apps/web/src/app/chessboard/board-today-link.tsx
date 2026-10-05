'use client';
import Link from 'next/link';
import { RESET_BOARD_POSITION } from './board-position';

export function BoardTodayLink() {
  return (
    <Link
      href="/chessboard"
      className="btn btn--secondary"
      onClick={() => {
        // Reset the current grid and the default week before navigation.
        try {
          sessionStorage.removeItem('wetop:calendar-position:');
        } catch {
          /* Storage is optional. */
        }
        window.dispatchEvent(new Event(RESET_BOARD_POSITION));
      }}
    >
      Сегодня
    </Link>
  );
}
