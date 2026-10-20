import { EmployeePortalScreen } from '../../components/employee-portal/screen';
export default async function MyWorkPage({ searchParams }: { searchParams: Promise<{ date?: string; month?: string }> }) {
  const params = await searchParams;
  const query = { ...(typeof params.date === 'string' ? { date: params.date } : {}), ...(typeof params.month === 'string' ? { month: params.month } : {}) };
  return <EmployeePortalScreen target={{ employeeId: null }} query={query} />;
}
