import { BranchWorkspace } from './workspace';
export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // каркас `Page` (main, h1 «Организация», действия) рисует сам экран, в том числе при ошибке загрузки
  return <BranchWorkspace query={await searchParams} />;
}
