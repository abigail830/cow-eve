import type { PlatformUser } from "./user.entity";

export type PlatformUserRecord = PlatformUser & {
  lastLoginAt: Date | null;
  createdAt: Date;
};

export type CreateUserRecord = {
  email: string;
  displayName: string;
  passwordHash: string;
};

export interface UserRepository {
  list(): Promise<PlatformUserRecord[]>;
  findByEmail(email: string): Promise<PlatformUserRecord | undefined>;
  create(user: CreateUserRecord): Promise<PlatformUserRecord>;
  delete(email: string): Promise<boolean>;
  recordLogin(email: string): Promise<void>;
}
