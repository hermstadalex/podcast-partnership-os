export const E2E_AUTH_COOKIE_NAME = 'podcastpartnership_e2e_role';
export const E2E_ADMIN_EMAIL = 'podcastpartnership@gmail.com';

export function isE2EBypassEnabled() {
  return process.env.PLAYWRIGHT_E2E_BYPASS === '1';
}

export function getE2ERole(
  cookieStore: Pick<{ get(name: string): { value?: string } | undefined }, 'get'>
) {
  if (!isE2EBypassEnabled()) {
    return null;
  }

  const role = cookieStore.get(E2E_AUTH_COOKIE_NAME)?.value;
  return role === 'admin' ? role : null;
}
