/** Access to this console is restricted to Trustap staff accounts. */
export const ALLOWED_EMAIL_DOMAIN = "trustap.com";

export function isAllowedEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}
