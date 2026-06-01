export const SESSION_COOKIE_NAME = "kv_planner_session";
export const CSRF_COOKIE_NAME = "kv_planner_csrf";
export const INTERNAL_API_CLIENT_HEADER = "x-kv-internal-client";
export const INTERNAL_API_CLIENT_VALUE = "planner-ui";
export const SESSION_DURATION_SECONDS = 60 * 60 * 8;
export const SESSION_AUDIENCE = "kriminalvarden-personal";
export const SESSION_ISSUER = "kriminalvarden-planner";
export const MAX_NOTE_LENGTH = 300;

export function generateCsrfToken() {
  return (
    crypto.randomUUID().replaceAll("-", "") +
    crypto.randomUUID().replaceAll("-", "")
  );
}
