export type UserRole = "admin" | "staff" | "professor" | "family";

export function getRoleRedirectPath(role: UserRole) {
  switch (role) {
    case "admin":
      return "/admin";
    case "staff":
      return "/staff";
    case "professor":
      return "/professor";
    case "family":
    default:
      return "/family";
  }
}
