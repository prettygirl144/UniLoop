import React from 'react';
import { Auth0Provider as Auth0ProviderBase } from '@auth0/auth0-react';

interface Auth0ProviderProps {
  children: React.ReactNode;
}

export default function Auth0Provider({ children }: Auth0ProviderProps) {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  // If Auth0 is not configured, render children without Auth0 provider
  if (!domain || !clientId || !audience) {
    console.warn('Auth0 not configured, falling back to existing authentication');
    return <>{children}</>;
  }

  const redirectUri = window.location.origin;

  return (
    <Auth0ProviderBase
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience: audience,
        scope: "openid profile email",
        // Force Google login only
        connection: "google-oauth2"
      }}
      useRefreshTokens={true}
      cacheLocation="localstorage"
    >
      {children}
    </Auth0ProviderBase>
  );
}