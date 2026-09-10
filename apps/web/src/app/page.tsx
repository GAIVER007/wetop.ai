import { redirect } from 'next/navigation';

/** Корень ведёт на рабочий день стойки: это первое, что открывает администратор в смену (SPEC §6). */
export default function Home() {
  redirect('/today');
}
