const rawBase = import.meta.env.BASE_URL || "/";

export const basePath = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

export function withBase(path = "/") {
  if (path === "/") {
    return basePath;
  }

  return `${basePath}${path.replace(/^\//, "")}`;
}
