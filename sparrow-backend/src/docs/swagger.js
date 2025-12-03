const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const fs = require('fs');

/**
 * Swagger Documentation Setup
 * 
 * Loads all YAML files and merges them into a single OpenAPI specification.
 * Modular structure with separate YAML files for each feature group.
 */

// Load base index.yaml
const baseSpec = YAML.load(path.join(__dirname, 'index.yaml'));

// Load all schema files
const schemasDir = path.join(__dirname, 'schemas');
const schemaFiles = fs.existsSync(schemasDir) 
  ? fs.readdirSync(schemasDir).filter(file => file.endsWith('.yaml'))
  : [];

schemaFiles.forEach(file => {
  const schemaPath = path.join(schemasDir, file);
  const schemaContent = YAML.load(schemaPath);
  
  // Merge schemas into base spec
  if (schemaContent.components && schemaContent.components.schemas) {
    if (!baseSpec.components) {
      baseSpec.components = {};
    }
    if (!baseSpec.components.schemas) {
      baseSpec.components.schemas = {};
    }
    Object.assign(baseSpec.components.schemas, schemaContent.components.schemas);
  }
});

// Load all endpoint YAML files
const endpointFiles = [
  'auth.yaml',
  'mobileAuth.yaml',
  'oidcAuth.yaml',
  'user.yaml',
  'friend.yaml',
  'message.yaml',
  'notification.yaml',
  'health.yaml'
];

endpointFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const endpointContent = YAML.load(filePath);
    
    // Merge paths into base spec
    if (endpointContent.paths) {
      Object.assign(baseSpec.paths, endpointContent.paths);
    }
    
    // Merge components if any
    if (endpointContent.components) {
      if (!baseSpec.components) {
        baseSpec.components = {};
      }
      Object.keys(endpointContent.components).forEach(key => {
        if (!baseSpec.components[key]) {
          baseSpec.components[key] = {};
        }
        Object.assign(baseSpec.components[key], endpointContent.components[key]);
      });
    }
  }
});

// Replace server URL with environment variable if set, or use PORT from env
if (baseSpec.servers && baseSpec.servers.length > 0) {
  const port = process.env.PORT || 5000;
  const baseUrl = process.env.API_BASE_URL || `http://localhost:${port}`;
  
  // Update the first server URL to match actual server port
  baseSpec.servers[0].url = baseUrl;
  baseSpec.servers[0].description = `Development server (running on port ${port})`;
}

// Custom CSS to make responses more visible and clear
const customCss = `
  .swagger-ui .topbar { display: none }
  
  /* Protected Route Indicators */
  .swagger-ui .opblock.opblock-post[data-tag="Auth"] .opblock-summary,
  .swagger-ui .opblock.opblock-get[data-tag="Auth"] .opblock-summary,
  .swagger-ui .opblock.opblock-put[data-tag="Auth"] .opblock-summary,
  .swagger-ui .opblock.opblock-delete[data-tag="Auth"] .opblock-summary {
    border-left: 4px solid #28a745;
  }
  
  /* Protected routes with security - add lock icon */
  .swagger-ui .opblock.opblock-post[data-tag]:not([data-tag="Auth"]):not([data-tag="Mobile Auth"]):not([data-tag="Health"]) .opblock-summary::before,
  .swagger-ui .opblock.opblock-get[data-tag]:not([data-tag="Auth"]):not([data-tag="Mobile Auth"]):not([data-tag="Health"]):not([data-tag="OIDC Auth"]) .opblock-summary::before,
  .swagger-ui .opblock.opblock-put[data-tag]:not([data-tag="Auth"]):not([data-tag="Mobile Auth"]):not([data-tag="Health"]) .opblock-summary::before,
  .swagger-ui .opblock.opblock-delete[data-tag]:not([data-tag="Auth"]):not([data-tag="Mobile Auth"]):not([data-tag="Health"]) .opblock-summary::before {
    content: "🔒 ";
    color: #dc3545;
    font-weight: bold;
    margin-right: 5px;
  }
  
  /* Public routes indicator */
  .swagger-ui .opblock.opblock-post[data-tag="Auth"] .opblock-summary::before,
  .swagger-ui .opblock.opblock-get[data-tag="Auth"] .opblock-summary::before,
  .swagger-ui .opblock.opblock-post[data-tag="Mobile Auth"] .opblock-summary::before,
  .swagger-ui .opblock.opblock-get[data-tag="Mobile Auth"] .opblock-summary::before,
  .swagger-ui .opblock.opblock-get[data-tag="Health"] .opblock-summary::before,
  .swagger-ui .opblock.opblock-get[data-tag="OIDC Auth"] .opblock-summary::before {
    content: "🌐 ";
    color: #28a745;
    font-weight: bold;
    margin-right: 5px;
  }
  
  /* Highlight protected routes with border */
  .swagger-ui .opblock.opblock-post[data-tag]:not([data-tag="Auth"]):not([data-tag="Mobile Auth"]):not([data-tag="Health"]) .opblock-summary,
  .swagger-ui .opblock.opblock-get[data-tag]:not([data-tag="Auth"]):not([data-tag="Mobile Auth"]):not([data-tag="Health"]):not([data-tag="OIDC Auth"]) .opblock-summary,
  .swagger-ui .opblock.opblock-put[data-tag]:not([data-tag="Auth"]):not([data-tag="Mobile Auth"]):not([data-tag="Health"]) .opblock-summary,
  .swagger-ui .opblock.opblock-delete[data-tag]:not([data-tag="Auth"]):not([data-tag="Mobile Auth"]):not([data-tag="Health"]) .opblock-summary {
    border-left: 4px solid #dc3545;
    background-color: #fff5f5;
  }
  
  /* Public routes styling */
  .swagger-ui .opblock.opblock-post[data-tag="Auth"] .opblock-summary,
  .swagger-ui .opblock.opblock-get[data-tag="Auth"] .opblock-summary,
  .swagger-ui .opblock.opblock-post[data-tag="Mobile Auth"] .opblock-summary,
  .swagger-ui .opblock.opblock-get[data-tag="Mobile Auth"] .opblock-summary,
  .swagger-ui .opblock.opblock-get[data-tag="Health"] .opblock-summary,
  .swagger-ui .opblock.opblock-get[data-tag="OIDC Auth"] .opblock-summary {
    border-left: 4px solid #28a745;
    background-color: #f0fff4;
  }
  
  /* Security badge in operation */
  .swagger-ui .opblock.opblock-post .opblock-summary-method,
  .swagger-ui .opblock.opblock-get .opblock-summary-method,
  .swagger-ui .opblock.opblock-put .opblock-summary-method,
  .swagger-ui .opblock.opblock-delete .opblock-summary-method {
    position: relative;
  }
  
  /* Add security indicator badge */
  .swagger-ui .opblock-summary .opblock-summary-operation-id,
  .swagger-ui .opblock-summary .opblock-summary-path {
    position: relative;
  }
  
  /* Security section styling */
  .swagger-ui .opblock-section .opblock-section-request-body,
  .swagger-ui .opblock-section .opblock-section-request-body + .opblock-section-header {
    border-top: 2px solid #e9ecef;
  }
  
  /* Make response section more prominent */
  .swagger-ui .responses-wrapper {
    margin-top: 20px;
    padding: 15px;
    background-color: #f8f9fa;
    border-radius: 4px;
    border: 2px solid #e9ecef;
  }
  
  /* Highlight response headers */
  .swagger-ui .response-col_status {
    font-weight: bold;
    font-size: 16px;
  }
  
  /* Make successful responses green */
  .swagger-ui .response[data-code="200"] .response-col_status,
  .swagger-ui .response[data-code="201"] .response-col_status {
    color: #28a745;
  }
  
  /* Make error responses red */
  .swagger-ui .response[data-code^="4"] .response-col_status,
  .swagger-ui .response[data-code^="5"] .response-col_status {
    color: #dc3545;
  }
  
  /* Style the executed response section */
  .swagger-ui .response-controls {
    margin-top: 15px;
    padding: 15px;
    background-color: #fff;
    border: 2px solid #007bff;
    border-radius: 4px;
  }
  
  /* Make curl command more visible */
  .swagger-ui .curl-command {
    background-color: #f8f9fa;
    padding: 10px;
    border-radius: 4px;
    margin: 10px 0;
    border-left: 4px solid #007bff;
  }
  
  /* Highlight response body */
  .swagger-ui .response-body {
    background-color: #fff;
    padding: 15px;
    border-radius: 4px;
    margin-top: 10px;
    border: 1px solid #dee2e6;
  }
  
  /* Make response headers section stand out */
  .swagger-ui .response-headers {
    background-color: #e9ecef;
    padding: 10px;
    border-radius: 4px;
    margin-top: 10px;
  }
  
  /* Style the "Server response" section */
  .swagger-ui .response-controls-wrapper {
    background-color: #f8f9fa;
    padding: 20px;
    border-radius: 4px;
    margin-top: 20px;
    border: 2px solid #007bff;
  }
  
  /* Make request URL more visible */
  .swagger-ui .request-url {
    font-weight: bold;
    color: #007bff;
    font-size: 14px;
    margin: 10px 0;
  }
  
  /* Expand responses by default */
  .swagger-ui .response {
    margin-bottom: 15px;
  }
  
  /* Better spacing for response examples */
  .swagger-ui .response-content-type {
    margin-top: 10px;
    padding: 10px;
    background-color: #fff;
    border-radius: 4px;
  }
  
  /* Highlight the response section title */
  .swagger-ui .responses-inner h4 {
    color: #007bff;
    font-size: 18px;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 2px solid #007bff;
  }
  
  /* Make the "Execute" button more prominent */
  .swagger-ui .btn.execute {
    background-color: #28a745;
    border-color: #28a745;
    font-weight: bold;
    padding: 10px 20px;
    font-size: 14px;
  }
  
  .swagger-ui .btn.execute:hover {
    background-color: #218838;
    border-color: #1e7e34;
  }
  
  /* Style response code badges */
  .swagger-ui .response-col_links {
    font-weight: bold;
  }
`;

// Custom JavaScript to auto-clear tokens on logout
const customJs = `
<script>
(function() {
  // Wait for Swagger UI to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  function init() {
    // Override fetch to intercept logout responses
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      return originalFetch.apply(this, args).then(response => {
        const url = args[0] || '';
        const urlString = typeof url === 'string' ? url : url.url || '';
        
        // Check if this is a logout endpoint
        const isMobileLogout = urlString.includes('/api/auth/mobile/logout');
        const isWebLogout = urlString.includes('/api/auth/logout');
        
        if ((isMobileLogout || isWebLogout) && response.status === 200) {
          // Clone response to read body without consuming it
          const clonedResponse = response.clone();
          clonedResponse.json().then(data => {
            if (data && data.success === true) {
              // Logout was successful, clear tokens
              setTimeout(() => {
                if (isMobileLogout) {
                  clearBearerAuthToken();
                }
                if (isWebLogout) {
                  clearSessionCookie();
                }
              }, 100);
            }
          }).catch(() => {
            // If response is not JSON, still try to clear (might be successful)
            if (response.status === 200) {
              setTimeout(() => {
                if (isMobileLogout) {
                  clearBearerAuthToken();
                }
                if (isWebLogout) {
                  clearSessionCookie();
                }
              }, 100);
            }
          });
        }
        
        return response;
      });
    };
    
    // Function to clear bearerAuth token
    function clearBearerAuthToken() {
      try {
        const authKey = 'authorized';
        
        // Clear from localStorage
        const authData = localStorage.getItem(authKey);
        if (authData) {
          const parsed = JSON.parse(authData);
          if (parsed.bearerAuth) {
            delete parsed.bearerAuth;
            localStorage.setItem(authKey, JSON.stringify(parsed));
            console.log('✅ Cleared bearerAuth token from Swagger UI');
          }
        }
        
        // Clear from sessionStorage
        const sessionAuthData = sessionStorage.getItem(authKey);
        if (sessionAuthData) {
          const sessionParsed = JSON.parse(sessionAuthData);
          if (sessionParsed.bearerAuth) {
            delete sessionParsed.bearerAuth;
            sessionStorage.setItem(authKey, JSON.stringify(sessionParsed));
          }
        }
        
        // Trigger Swagger UI to refresh authorization display
        if (window.ui && window.ui.authActions) {
          window.ui.authActions.logout(['bearerAuth']);
        }
        
        // Show notification
        showNotification('✅ Access token cleared from Swagger UI');
      } catch (e) {
        console.error('Error clearing bearerAuth token:', e);
      }
    }
    
    // Function to clear session cookie
    function clearSessionCookie() {
      try {
        const cookieName = 'connect.sid';
        const domain = window.location.hostname;
        const paths = ['/', '/api', '/api-docs'];
        
        paths.forEach(path => {
          // Clear with domain
          document.cookie = cookieName + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=' + path + '; domain=' + domain;
          // Clear without domain (for localhost)
          document.cookie = cookieName + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=' + path;
        });
        
        console.log('✅ Cleared session cookie');
        showNotification('✅ Session cookie cleared');
      } catch (e) {
        console.error('Error clearing session cookie:', e);
      }
    }
    
    // Function to show notification
    function showNotification(message) {
      // Create notification element
      const notification = document.createElement('div');
      notification.textContent = message;
      notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #28a745; color: white; padding: 15px 20px; border-radius: 4px; z-index: 10000; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-weight: bold;';
      document.body.appendChild(notification);
      
      // Remove after 3 seconds
      setTimeout(() => {
        notification.style.transition = 'opacity 0.5s';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 500);
      }, 3000);
    }
  }
})();
</script>
`;

// Create Swagger UI middleware with Postman-like features
const swaggerDocs = swaggerUi.setup(baseSpec, {
  customCss: customCss,
  customJs: customJs,
  customSiteTitle: 'Sparrow API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    // Enable "Try it out" feature (Postman-like testing)
    tryItOutEnabled: true,
    // Persist authorization tokens across page reloads
    persistAuthorization: true,
    // Show request duration
    displayRequestDuration: true,
    // Enable filtering/search
    filter: true,
    // Show operation ID
    displayOperationId: false,
    // Default models expansion depth
    defaultModelsExpandDepth: 2,
    // Default model expansion depth
    defaultModelExpandDepth: 2,
    // Expand responses by default
    docExpansion: 'list',
    // Enable deep linking
    deepLinking: true,
    // Show request/response examples
    showExtensions: true,
    // Show common extensions
    showCommonExtensions: true,
    // Supported submit methods
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
    // Enable validator
    validatorUrl: null,
    // Show response examples by default
    defaultModelRendering: 'example',
    // Enable credentials (cookies) to be sent with requests
    requestInterceptor: (request) => {
      // Ensure cookies are sent with requests
      request.credentials = 'include';
      return request;
    },
    // Enable response interceptor to handle cookies and auto-clear tokens on logout
    responseInterceptor: async (response) => {
      try {
        // Get response URL and status
        const url = response.url || '';
        const status = response.status || 0;
        const isMobileLogout = url.includes('/api/auth/mobile/logout');
        const isWebLogout = url.includes('/api/auth/logout');
        
        // Check if logout was successful (200 status)
        if (status === 200 && (isMobileLogout || isWebLogout)) {
          // Clone response to read body
          const clonedResponse = response.clone();
          let responseData = null;
          
          try {
            responseData = await clonedResponse.json();
          } catch (e) {
            // If response is not JSON, that's okay
          }
          
          // Only proceed if logout was actually successful
          if (responseData && responseData.success === true) {
            // Use setTimeout to ensure Swagger UI has processed the response
            setTimeout(() => {
              if (isMobileLogout) {
                // Clear bearerAuth token from Swagger UI storage
                try {
                  // Swagger UI stores auth in localStorage with key 'authorized'
                  const authKey = 'authorized';
                  const authData = localStorage.getItem(authKey);
                  if (authData) {
                    const parsed = JSON.parse(authData);
                    if (parsed.bearerAuth) {
                      delete parsed.bearerAuth;
                      localStorage.setItem(authKey, JSON.stringify(parsed));
                      console.log('✅ Cleared bearerAuth token from Swagger UI');
                    }
                  }
                  
                  // Also check sessionStorage
                  const sessionAuthData = sessionStorage.getItem(authKey);
                  if (sessionAuthData) {
                    const sessionParsed = JSON.parse(sessionAuthData);
                    if (sessionParsed.bearerAuth) {
                      delete sessionParsed.bearerAuth;
                      sessionStorage.setItem(authKey, JSON.stringify(sessionParsed));
                    }
                  }
                  
                  // Trigger Swagger UI to refresh authorization display
                  if (typeof window !== 'undefined' && window.ui && window.ui.authActions) {
                    window.ui.authActions.logout(['bearerAuth']);
                    // Force UI update
                    if (window.ui.specActions) {
                      window.ui.specActions.updateSpec(window.ui.specSelectors.specJson());
                    }
                  }
                } catch (e) {
                  console.error('Error clearing bearerAuth token:', e);
                }
              }
              
              if (isWebLogout) {
                // Clear session cookie (server should do this, but clear client-side too)
                try {
                  // Clear the connect.sid cookie for all paths
                  const cookieName = 'connect.sid';
                  const paths = ['/', '/api', '/api-docs'];
                  paths.forEach(path => {
                    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; domain=${window.location.hostname};`;
                    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path};`;
                  });
                  console.log('✅ Cleared session cookie');
                } catch (e) {
                  console.error('Error clearing session cookie:', e);
                }
              }
            }, 200);
          }
        }
      } catch (error) {
        // Silently handle errors in interceptor
        console.error('Response interceptor error:', error);
      }
      
      // Return original response
      return response;
    }
  }
});

// Export both the spec and the middleware
module.exports = {
  spec: baseSpec,
  serve: swaggerUi.serve,
  setup: swaggerDocs
};

