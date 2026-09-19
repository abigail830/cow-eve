/**
 * Preset users for the Agent Platform (no self-registration in v0).
 * Passwords are bcrypt hashes only — never store plaintext here.
 */
export type PlatformUser = {
  email: string;
  displayName: string;
  /** bcrypt hash */
  passwordHash: string;
};

export const PRESET_USERS: readonly PlatformUser[] = [
  {
    email: "abigail830@163.com",
    displayName: "Sara Qian",
    // bcrypt of the seed password; generated with bcryptjs cost 12
    passwordHash:
      "$2b$12$.NoBHp1pyqGtiPjQ3CgSt.AkCLA..0NPRMKfx9RufeUsAObDiOffq",
  },
];

export function findUserByEmail(email: string): PlatformUser | undefined {
  const normalized = email.trim().toLowerCase();
  return PRESET_USERS.find((u) => u.email.toLowerCase() === normalized);
}
