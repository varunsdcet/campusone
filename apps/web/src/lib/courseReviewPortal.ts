export function courseReviewPortal(roles: string[]) {
  return roles.includes("admin") || roles.includes("registrar") ? "admin" : "instructor";
}
