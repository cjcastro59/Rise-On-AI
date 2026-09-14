export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

export const PASSWORD_REQUIREMENTS_MESSAGE =
  "New password must be at least 8 characters and include uppercase, lowercase, number, and special character.";

export function validatePasswordStrength(password: string): string | null {
  if (!PASSWORD_REGEX.test(password)) {
    return PASSWORD_REQUIREMENTS_MESSAGE;
  }

  return null;
}
