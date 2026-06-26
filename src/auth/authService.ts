/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_AUTH_ENDPOINT, GOOGLE_TOKEN_ENDPOINT, GOOGLE_REVOKE_ENDPOINT, HEALTH_API_SCOPES, OAUTH } from "../config";
import { generateRandomString, generateCodeChallenge } from "./pkce";
import { AuthState } from "../types";

const ACCESS_TOKEN_KEY = "myhealth_access_token";
const REFRESH_TOKEN_KEY = "myhealth_refresh_token";
const EXPIRES_AT_KEY = "myhealth_expires_at";
const SCOPES_KEY = "myhealth_scopes";
const PKCE_VERIFIER_KEY = "myhealth_pkce_verifier";
const PKCE_STATE_KEY = "myhealth_pkce_state";

/**
 * Service managing Google OAuth 2.0 authentication with PKCE on the client-side.
 */
export class AuthService {
  private static listeners: ((authState: AuthState) => void)[] = [];

  /**
   * Subscribes to authentication state changes.
   */
  static subscribe(listener: (authState: AuthState) => void): () => void {
    this.listeners.push(listener);
    // Initial call
    listener(this.getAuthState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private static notifyChange() {
    const state = this.getAuthState();
    this.listeners.forEach((listener) => listener(state));
  }

  /**
   * Retrieves the current authentication state from browser storage.
   */
  static getAuthState(): AuthState {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const expiresAtStr = localStorage.getItem(EXPIRES_AT_KEY);
    const scopesStr = localStorage.getItem(SCOPES_KEY);

    return {
      accessToken,
      refreshToken,
      expiresAt: expiresAtStr ? parseInt(expiresAtStr, 10) : null,
      scopes: scopesStr ? JSON.parse(scopesStr) : [],
    };
  }

  /**
   * Verifies if the user is authenticated and the token is valid (or refreshable).
   */
  static isAuthenticated(): boolean {
    const state = this.getAuthState();
    return !!state.accessToken && (!!state.refreshToken || !this.isTokenExpired(state.expiresAt));
  }

  private static isTokenExpired(expiresAt: number | null): boolean {
    if (!expiresAt) return true;
    // Buffer of 2 minutes to avoid edge cases
    return Date.now() + 2 * 60 * 1000 >= expiresAt;
  }

  /**
   * Initiates the OAuth login flow by opening a secure popup window directly pointing to Google.
   */
  static async login(): Promise<AuthState> {
    if (GOOGLE_CLIENT_ID.startsWith("REPLACE_WITH")) {
      throw new Error("Setup needed: paste your OAuth Client ID into src/config.ts (see checklist at top of that file).");
    }
    if (!GOOGLE_CLIENT_SECRET) {
      throw new Error("Setup needed: add GOOGLE_CLIENT_SECRET in AI Studio's Secrets panel.");
    }
    const verifier = generateRandomString(64);
    const state = generateRandomString(16);

    // Persist PKCE verifier and state for verification on callback
    localStorage.setItem(PKCE_VERIFIER_KEY, verifier);
    localStorage.setItem(PKCE_STATE_KEY, state);

    const codeChallenge = await generateCodeChallenge(verifier);

    // Use configured redirect URI
    const redirectUri = OAUTH.redirectUri;

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: HEALTH_API_SCOPES.join(" "),
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state: state,
      access_type: "offline", // Required to fetch a refresh token
      prompt: "consent",      // Force consent screen to guarantee receipt of refresh token
    });

    const url = `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;

    // Open Google OAuth authorize page directly in a popup (retains iframe-friendliness)
    const popup = window.open(
      url,
      "myhealth_sync_google_oauth",
      "width=550,height=650,left=100,top=100,resizable=yes,scrollbars=yes"
    );

    if (!popup) {
      throw new Error("Popup blocked! Please allow popups for this site to sync Fitbit.");
    }

    return new Promise((resolve, reject) => {
      const processOAuthData = async (data: any) => {
        if (data && data.type === "GOOGLE_OAUTH_CODE") {
          clearInterval(timer);
          window.removeEventListener("message", handleMessage);
          window.removeEventListener("storage", handleStorage);

          const { code, state: callbackState } = data;

          const savedState = localStorage.getItem(PKCE_STATE_KEY);
          if (callbackState !== savedState) {
            reject(new Error("Security violation: State validation failed (CSRF protection activated)."));
            return;
          }

          try {
            const authState = await this.exchangeCodeForTokens(code);
            resolve(authState);
          } catch (err) {
            reject(err);
          }
        } else if (data && data.type === "GOOGLE_OAUTH_ERROR") {
          clearInterval(timer);
          window.removeEventListener("message", handleMessage);
          window.removeEventListener("storage", handleStorage);
          reject(new Error(`Authentication error: ${data.error}`));
        }
      };

      const handleMessage = async (event: MessageEvent) => {
        // Validate origin matches current window to maintain secure sandbox
        if (!event.origin.endsWith('.run.app') && !event.origin.includes('localhost')) {
          return;
        }
        processOAuthData(event.data);
      };

      const handleStorage = (event: StorageEvent) => {
        if (event.key === 'GOOGLE_OAUTH_RESPONSE' && event.newValue) {
          try {
            const data = JSON.parse(event.newValue);
            // Ensure we only process new events
            if (data.timestamp > Date.now() - 60000) {
              processOAuthData(data);
              localStorage.removeItem('GOOGLE_OAUTH_RESPONSE');
            }
          } catch (e) {
            // ignore JSON parse errors
          }
        }
      };

      window.addEventListener("message", handleMessage);
      window.addEventListener("storage", handleStorage);

      // Check popup status and poll location as fallback/robust detection
      const timer = setInterval(() => {
        if (!popup) {
          clearInterval(timer);
          window.removeEventListener("message", handleMessage);
          window.removeEventListener("storage", handleStorage);
          reject(new Error("Connecting cancelled: authentication window was blocked."));
          return;
        }

        try {
          // Same-origin policy allows reading this once redirected back to our app
          if (popup.location && popup.location.origin === window.location.origin) {
            const urlParams = new URLSearchParams(popup.location.search || popup.location.hash.substring(1));
            const code = urlParams.get("code");
            const state = urlParams.get("state");
            const error = urlParams.get("error");

            if (code || error) {
              clearInterval(timer);
              window.removeEventListener("message", handleMessage);
              window.removeEventListener("storage", handleStorage);
              popup.close();

              if (code) {
                processOAuthData({ type: "GOOGLE_OAUTH_CODE", code, state });
              } else {
                processOAuthData({ type: "GOOGLE_OAUTH_ERROR", error });
              }
              return;
            }
          }
        } catch (e) {
          // Cross-origin exception is expected while the popup is on Google's domain
        }

        if (popup.closed) {
          clearInterval(timer);
          window.removeEventListener("message", handleMessage);
          window.removeEventListener("storage", handleStorage);
          // Wait briefly in case a final message or storage event is in flight.
          setTimeout(() => {
            reject(new Error("Connecting cancelled: authentication window closed."));
          }, 1000);
        }
      }, 500);
    });
  }

  /**
   * Exchanges authorization code for Access & Refresh tokens using Google PKCE parameters.
   */
  private static async exchangeCodeForTokens(code: string): Promise<AuthState> {
    const verifier = localStorage.getItem(PKCE_VERIFIER_KEY);
    if (!verifier) {
      throw new Error("Missing PKCE code verifier in local device storage.");
    }

    const redirectUri = OAUTH.redirectUri;

    const body = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      // Google "Web application" OAuth clients require the secret at the token
      // endpoint even when PKCE is used. Set GOOGLE_CLIENT_SECRET in AI Studio Secrets.
      client_secret: GOOGLE_CLIENT_SECRET,
      code_verifier: verifier,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    try {
      const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error_description || `Token exchange failed with status ${response.status}`);
      }

      const data = await response.json();
      return this.saveTokens(data);
    } finally {
      // Clean up single-use values
      localStorage.removeItem(PKCE_VERIFIER_KEY);
      localStorage.removeItem(PKCE_STATE_KEY);
    }
  }

  /**
   * Handles Token Refreshing using Google's offline token exchange endpoint.
   */
  static async refreshAccessToken(): Promise<string> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      this.clearTokensAndNotify();
      throw new Error("Missing refresh token. Please sign in again.");
    }

    const body = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        // Refresh token might have been revoked
        this.clearTokensAndNotify();
        throw new Error("Session expired or credentials revoked. Please connect again.");
      }
      throw new Error(`Failed to refresh credentials (${response.status})`);
    }

    const data = await response.json();
    const authState = this.saveTokens(data, true); // Keep existing refresh token if not returned
    return authState.accessToken!;
  }

  /**
   * Helper that checks expiry and returns a valid access token. Handles automated background refreshes.
   */
  static async getValidAccessToken(): Promise<string> {
    const state = this.getAuthState();
    if (!state.accessToken) {
      throw new Error("Authentication required. Please connect your Google/Fitbit account.");
    }

    if (this.isTokenExpired(state.expiresAt)) {
      return await this.refreshAccessToken();
    }

    return state.accessToken;
  }

  /**
   * Saves tokens into LocalStorage, calculates expiresAt timetamps, and notifies observers.
   */
  private static saveTokens(data: any, partialRefresh = false): AuthState {
    const accessToken = data.access_token;
    const refreshToken = data.refresh_token || (partialRefresh ? localStorage.getItem(REFRESH_TOKEN_KEY) : null);
    const expiresAt = Date.now() + data.expires_in * 1000;
    const scopes = data.scope ? data.scope.split(" ") : [];

    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    localStorage.setItem(EXPIRES_AT_KEY, expiresAt.toString());
    localStorage.setItem(SCOPES_KEY, JSON.stringify(scopes));

    this.notifyChange();

    return {
      accessToken,
      refreshToken,
      expiresAt,
      scopes,
    };
  }

  /**
   * Disconnects client session and triggers a token revocation from Google's auth servers.
   */
  static async disconnectAndRevoke(): Promise<void> {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (accessToken) {
      try {
        // Try revoking the token from Google Server
        await fetch(`${GOOGLE_REVOKE_ENDPOINT}?token=${accessToken}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });
      } catch (err) {
        console.warn("Failed to contact Google server for token revocation", err);
      }
    }

    this.clearTokensAndNotify();
  }

  private static clearTokensAndNotify() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(EXPIRES_AT_KEY);
    localStorage.removeItem(SCOPES_KEY);
    this.notifyChange();
  }
}

/**
 * Backward compatibility wrapper for healthApi.ts.
 */
export async function getAccessToken(): Promise<string> {
  return await AuthService.getValidAccessToken();
}