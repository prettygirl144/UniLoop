export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

// Auth0 logout function
export function logout() {
  const isAuth0Configured = !!(import.meta.env.VITE_AUTH0_DOMAIN && 
                               import.meta.env.VITE_AUTH0_CLIENT_ID);

  if (isAuth0Configured) {
    // For Auth0, we need to use the logout from useAuth0 hook
    window.location.href = '/logout';
  } else {
    // Fallback to existing logout
    window.location.href = '/api/logout';
  }
}