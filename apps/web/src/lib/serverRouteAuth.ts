import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "./api";

export type VerifiedWebSession = {
  accountId: string;
  institutionId: string;
  personId: string;
  roles: string[];
  authorization: string;
};

export async function requireWebApiSession(
  req: NextRequest,
  allowedRoles?: string[],
): Promise<VerifiedWebSession | NextResponse> {
  const authorization = req.headers.get("authorization")?.trim() || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }

  const response = await fetch(`${API_URL.replace(/\/$/, "")}/auth/session`, {
    headers: { authorization },
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) {
    return NextResponse.json({ error: "Your session is invalid or expired." }, { status: 401 });
  }
  const session = (await response.json()) as Omit<VerifiedWebSession, "authorization">;
  if (allowedRoles?.length && !session.roles.some((role) => allowedRoles.includes(role))) {
    return NextResponse.json({ error: "You do not have access to this service." }, { status: 403 });
  }
  return { ...session, authorization };
}
