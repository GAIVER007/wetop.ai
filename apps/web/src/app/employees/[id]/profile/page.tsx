import { requireFeature } from '../../../../lib/vertical-guard';
import { EmployeePortalScreen } from '../../../../components/employee-portal/screen';
export default async function EmployeeProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string; month?: string }> }) {
  // раздел направления по реестру функций (У1): по прямой ссылке чужое направление уходит на свою стартовую
  await requireFeature('/employees');
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const query = { ...(typeof search.date === 'string' ? { date: search.date } : {}), ...(typeof search.month === 'string' ? { month: search.month } : {}) };
  return <EmployeePortalScreen target={{ employeeId: id }} query={query} />;
}
