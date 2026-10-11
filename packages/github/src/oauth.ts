const GITHUB = "https://github.com";
const API = "https://api.github.com";

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "read:user user:email repo",
  });
  return `${GITHUB}/login/oauth/authorize?${params}`;
}

export async function exchangeCodeForToken(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<OAuthTokenResponse> {
  const res = await fetch(`${GITHUB}/login/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  });
  if (!res.ok) throw new Error(`GitHub OAuth token exchange failed: ${res.status}`);
  return (await res.json()) as OAuthTokenResponse;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export async function fetchAuthenticatedUser(token: string): Promise<GitHubUser> {
  const res = await fetch(`${API}/user`, {
    headers: githubHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to fetch GitHub user: ${res.status}`);
  return (await res.json()) as GitHubUser;
}

export function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "CodeLens",
  };
}
