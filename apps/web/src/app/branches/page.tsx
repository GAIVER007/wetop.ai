import { BranchWorkspace } from './workspace';
export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <main id="main-content" className="branches-reference-page">
      <BranchWorkspace query={await searchParams} />
    </main>
  );
}
