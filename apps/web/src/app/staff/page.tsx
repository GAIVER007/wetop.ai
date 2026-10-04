import { redirect } from 'next/navigation';

/** Параллельный раздел /staff (01.10) заменён «Сотрудниками» TEAM1: адрес живёт переадресацией. */
export default function StaffPage() {
  redirect('/team');
}
