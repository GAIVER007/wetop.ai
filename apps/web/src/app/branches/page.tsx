import { Page } from '../../components/page';
import { BranchWorkspace } from './workspace';
export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Page className="branches-page" width="full" title="Организация и филиалы">
      <BranchWorkspace query={await searchParams} />
    </Page>
  );
}
