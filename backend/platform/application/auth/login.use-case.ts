import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from "../../domain/auth/auth.constants";
import { findUserByEmail } from "../../domain/auth/user.entity";
import { getJwtSecret } from "../../infrastructure/config/env.config";

export type LoginSuccess = {
  token: string;
  user: { email: string; displayName: string };
};

export type LoginFailure = { error: string };

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<LoginSuccess | LoginFailure> {
  const user = findUserByEmail(email);
  if (!user) {
    return { error: "Invalid email or password" };
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return { error: "Invalid email or password" };
  }

  const secret = new TextEncoder().encode(getJwtSecret());
  const token = await new SignJWT({
    name: user.displayName,
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(user.email)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  return {
    token,
    user: { email: user.email, displayName: user.displayName },
  };
}
