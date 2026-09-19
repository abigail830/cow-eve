import bcrypt from "bcryptjs";
import { deps } from "../../composition/deps";

const BCRYPT_ROUNDS = 12;

export type PlatformUserPublic = {
  email: string;
  displayName: string;
  lastLoginAt: string | null;
  createdAt: string;
};

export type CreateUserInput = {
  email: string;
  password: string;
};

function toPublic(user: {
  email: string;
  displayName: string;
  lastLoginAt: Date | null;
  createdAt: Date;
}): PlatformUserPublic {
  return {
    email: user.email,
    displayName: user.displayName,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim();
  return local || email;
}

function validateEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return "Enter a valid email address";
  }
  return null;
}

function validatePassword(password: string): string | null {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  return null;
}

export async function listUsers(): Promise<PlatformUserPublic[]> {
  const users = await deps.userRepository.list();
  return users.map(toPublic);
}

export async function createUser(
  input: CreateUserInput,
): Promise<PlatformUserPublic> {
  const emailError = validateEmail(input.email);
  if (emailError) throw new Error(emailError);

  const passwordError = validatePassword(input.password);
  if (passwordError) throw new Error(passwordError);

  const email = input.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const created = await deps.userRepository.create({
    email,
    displayName: displayNameFromEmail(email),
    passwordHash,
  });
  return toPublic(created);
}

export async function deleteUser(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Email is required");

  const users = await deps.userRepository.list();
  if (users.length <= 1) {
    throw new Error("Keep at least one user");
  }

  const deleted = await deps.userRepository.delete(normalized);
  if (!deleted) throw new Error("User not found");
}

export async function findUserByEmail(email: string) {
  return deps.userRepository.findByEmail(email);
}

export async function recordUserLogin(email: string): Promise<void> {
  await deps.userRepository.recordLogin(email);
}
