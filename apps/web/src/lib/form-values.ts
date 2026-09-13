/** Only return known text fields to the submitting form; never echo arbitrary FormData. */
export function formValues(form: FormData, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    names.flatMap((name) => {
      const value = form.get(name);
      return typeof value === 'string' ? [[name, value]] : [];
    }),
  );
}
