import type { WebVertical } from '../../lib/vertical-landing';
import { mayAccess, mayBeautyAccess, type NavigationAccess } from '../../lib/navigation';

interface BarShellAccess {
  access: NavigationAccess;
  readOnly: boolean;
}

export interface BarActionAccess {
  createStock: boolean;
  updateStock: boolean;
  deleteStock: boolean;
  createFinance: boolean;
  refundFinance: boolean;
  createCatalog: boolean;
  receiveStock: boolean;
  updateCatalog: boolean;
  operateStock: boolean;
  archiveCatalog: boolean;
  sell: boolean;
}

export function barActionAccess(shell: BarShellAccess, vertical: WebVertical): BarActionAccess {
  if (shell.readOnly) {
    return {
      createStock: false,
      updateStock: false,
      deleteStock: false,
      createFinance: false,
      refundFinance: false,
      createCatalog: false,
      receiveStock: false,
      updateCatalog: false,
      operateStock: false,
      archiveCatalog: false,
      sell: false,
    };
  }
  if (vertical === 'BEAUTY') {
    const createStock = mayBeautyAccess(shell.access, 'stock', 'create', { legacy: 'settings' });
    const updateStock = mayBeautyAccess(shell.access, 'stock', 'update', { legacy: 'desk' });
    const deleteStock = mayBeautyAccess(shell.access, 'stock', 'delete', { legacy: 'settings' });
    const createFinance = mayBeautyAccess(shell.access, 'finance', 'create', { legacy: 'desk' });
    const refundFinance = mayBeautyAccess(shell.access, 'finance', 'refund', { legacy: 'refunds' });
    return {
      createStock, updateStock, deleteStock, createFinance, refundFinance,
      createCatalog: createStock,
      receiveStock: createStock,
      updateCatalog: updateStock,
      operateStock: updateStock,
      archiveCatalog: updateStock,
      sell: createStock && createFinance,
    };
  }
  const createCatalog = mayAccess(shell.access, 'settings');
  const receiveStock = mayAccess(shell.access, 'desk');
  const updateCatalog = mayAccess(shell.access, 'settings');
  const operateStock = mayAccess(shell.access, 'desk');
  const archiveCatalog = mayAccess(shell.access, 'settings');
  const createFinance = mayAccess(shell.access, 'desk');
  const refundFinance = mayAccess(shell.access, 'refunds');
  return {
    createStock: createCatalog || receiveStock,
    updateStock: updateCatalog || operateStock,
    deleteStock: archiveCatalog,
    createFinance,
    refundFinance,
    createCatalog,
    receiveStock,
    updateCatalog,
    operateStock,
    archiveCatalog,
    sell: receiveStock && createFinance,
  };
}
