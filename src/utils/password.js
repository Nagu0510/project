// Mirrors the server policy (backend/app/models/user.py check_password_policy).
export const PASSWORD_HINT = 'Password must be 8-72 characters and include at least one letter and one number.';

export const isStrongPassword = (pw) =>
  typeof pw === 'string'
  && pw.length >= 8
  && new TextEncoder().encode(pw).length <= 72
  && /[A-Za-z]/.test(pw)
  && /\d/.test(pw);
