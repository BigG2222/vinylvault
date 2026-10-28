/**
 * The one place the server's support / privacy contact address is set. The HTML pages in
 * server/public write {{SUPPORT_EMAIL}} and the server fills it in when it serves them.
 * The app has its own single constant: SUPPORT_EMAIL in src/config/index.ts. Keep the two the same.
 */
export const SUPPORT_EMAIL = 'lanansipsip@gmail.com';

export function fillContact(html: string): string {
  return html.replaceAll('{{SUPPORT_EMAIL}}', SUPPORT_EMAIL);
}
