/** Session attribute set by platform route auth when a bearer JWT is presented. */
export const PLATFORM_ACCESS_TOKEN_ATTR = "platformAccessToken";

type AuthLike = {
  principalType?: string;
  attributes?: Readonly<Record<string, string | readonly string[]>>;
};

type PlatformAccessTokenContext = {
  session: {
    auth: {
      current?: AuthLike | null;
      initiator?: AuthLike | null;
    };
  };
};

function readAttribute(
  attributes: Readonly<Record<string, string | readonly string[]>> | undefined,
  key: string,
): string | null {
  const value = attributes?.[key];
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

/** Returns the platform JWT for the active user session, if available. */
export function readPlatformAccessToken(ctx: PlatformAccessTokenContext): string | null {
  const auth = ctx.session.auth.current ?? ctx.session.auth.initiator;
  if (!auth || auth.principalType !== "user") return null;
  return readAttribute(auth.attributes, PLATFORM_ACCESS_TOKEN_ATTR);
}
