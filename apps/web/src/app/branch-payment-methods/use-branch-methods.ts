'use client';
import { useEffect, useState } from 'react';
import { FOOD_PAYMENT_METHODS, type FoodPaymentMethod } from '../../lib/food-types';
import { readBranchPaymentMethods } from './read-action';
import { branchMethodsShown } from './shown';

/**
 * Способы оплаты филиала для форм приёма денег (DATA_MODEL §21.7): включённые в порядке настройки. Пока список не
 * прочитан или не прочитался, форма показывает все шесть, как до настройки: выключенный способ всё равно отклонит
 * сервер словами «выключен в настройках филиала». Возвраты и расход «из» способа берут полный список сами.
 */
export function useBranchPaymentMethods(scopeKey: string): FoodPaymentMethod[] {
  const [enabled, setEnabled] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    void readBranchPaymentMethods().then((list) => {
      if (live) setEnabled(list);
    });
    return () => {
      live = false;
    };
  }, [scopeKey]);
  return branchMethodsShown(FOOD_PAYMENT_METHODS, enabled);
}
