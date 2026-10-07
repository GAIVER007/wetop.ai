export function qaPorts(raw = process.env.WETOP_QA_PORT_BASE) {
  const web = Number(raw ?? '55823');
  if (!Number.isInteger(web) || web < 1024 || web > 65533) {
    throw new Error('QA port range must start between 1024 and 65533');
  }
  return { web, api: web + 1, proxy: web + 2, url: `http://127.0.0.1:${web + 2}` };
}
export const fullQaPorts = qaPorts();
