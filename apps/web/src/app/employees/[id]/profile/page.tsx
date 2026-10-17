import { EmployeePortalScreen } from '../../../../components/employee-portal/screen';
export default async function EmployeeProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string; month?: string }> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const query = { ...(typeof search.date === 'string' ? { date: search.date } : {}), ...(typeof search.month === 'string' ? { month: search.month } : {}) };
  return <EmployeePortalScreen target={{ employeeId: id }} query={query} />;
}
