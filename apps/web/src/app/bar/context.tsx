export interface BarFormContext {
  propertyId: string;
  currency: string;
}
export function BarContextFields({ context }: { context: BarFormContext }) {
  return (
    <>
      <input type="hidden" name="barPropertyId" value={context.propertyId} />
      <input type="hidden" name="barCurrency" value={context.currency} />
    </>
  );
}
