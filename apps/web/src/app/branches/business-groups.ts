import type { BranchItem } from '../../lib/api';
export type BusinessGroup = {
  id: string;
  vertical: BranchItem['vertical'];
  branches: BranchItem[];
};
export function groupBusinessBranches(
  items: BranchItem[],
  businesses: Array<{ id: string; vertical: BranchItem['vertical'] }> = [],
): BusinessGroup[] {
  const groups = new Map<string, BusinessGroup>();
  for (const business of businesses) groups.set(business.id, { ...business, branches: [] });
  for (const branch of items) {
    const id = branch.location.businessId;
    const group = groups.get(id);
    if (group) group.branches.push(branch);
    else groups.set(id, { id, vertical: branch.vertical, branches: [branch] });
  }
  return [...groups.values()];
}
