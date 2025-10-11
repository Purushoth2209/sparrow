const { Issuer } = require('openid-client');

/**
 * OIDC Clients Configuration
 * 
 * This module configures OpenID Connect clients for various identity providers.
 * Currently supports: Google
 * 
 * To add more providers (GitHub, Microsoft, etc.):
 * 1. Add their discovery URL
 * 2. Create a getXXXClient() function similar to getGoogleClient()
 * 3. Export the function
 */

// Cache for OIDC clients (avoid re-discovering on every request)
let googleClient = null;

/**
 * Initialize and return Google OIDC Client
 * 
 * Uses OpenID Connect Discovery to automatically fetch:
 * - Authorization endpoint
 * - Token endpoint  
 * - UserInfo endpoint
 * - JWKS (JSON Web Key Set) for token verification
 * 
 * @returns {Promise<Client>} Configured Google OIDC client
 */
async function getGoogleClient() {
  // Return cached client if already initialized
  if (googleClient) {
    return googleClient;
  }

  try {
    // Step 1: Discover Google's OIDC configuration
    // This fetches https://accounts.google.com/.well-known/openid-configuration
    const googleIssuer = await Issuer.discover('https://accounts.google.com');
    
    console.log('✅ Google OIDC Issuer discovered:', googleIssuer.metadata.issuer);

    // Step 2: Create client with your app's credentials
    googleClient = new googleIssuer.Client({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uris: [process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback'],
      response_types: ['code'], // Authorization code flow
    });

    console.log('✅ Google OIDC Client initialized');
    return googleClient;
  } catch (error) {
    console.error('❌ Failed to initialize Google OIDC client:', error);
    throw new Error('OIDC client initialization failed');
  }
}

/**
 * Example: Add GitHub OIDC Client
 * 
 * Uncomment and configure when adding GitHub authentication:
 * 
 * let githubClient = null;
 * 
 * async function getGitHubClient() {
 *   if (githubClient) return githubClient;
 *   
 *   const githubIssuer = await Issuer.discover('https://token.actions.githubusercontent.com');
 *   githubClient = new githubIssuer.Client({
 *     client_id: process.env.GITHUB_CLIENT_ID,
 *     client_secret: process.env.GITHUB_CLIENT_SECRET,
 *     redirect_uris: ['http://localhost:5000/auth/github/callback'],
 *     response_types: ['code'],
 *   });
 *   
 *   return githubClient;
 * }
 */

/**
 * Example: Add Microsoft OIDC Client
 * 
 * async function getMicrosoftClient() {
 *   if (microsoftClient) return microsoftClient;
 *   
 *   const msIssuer = await Issuer.discover('https://login.microsoftonline.com/common/v2.0');
 *   microsoftClient = new msIssuer.Client({
 *     client_id: process.env.MICROSOFT_CLIENT_ID,
 *     client_secret: process.env.MICROSOFT_CLIENT_SECRET,
 *     redirect_uris: ['http://localhost:5000/auth/microsoft/callback'],
 *     response_types: ['code'],
 *   });
 *   
 *   return microsoftClient;
 * }
 */

module.exports = {
  getGoogleClient,
  // Export additional clients here when implemented:
  // getGitHubClient,
  // getMicrosoftClient,
};

