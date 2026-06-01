import "server-only";

function isNetlifyFunctionsRuntime() {
  return process.env.SITE_ID != null && process.env.URL != null;
}

export function isNetlifyDemoMode() {
  return isNetlifyFunctionsRuntime() && process.env.NETLIFY_DB_URL == null;
}

export function shouldShowDemoCredentials() {
  return process.env.NODE_ENV !== "production" || isNetlifyDemoMode();
}
