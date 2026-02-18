import { createHash } from "crypto";

const COOKIE_NAME = "fel-auth";

function getAuthToken(): string {
  const login = process.env.AUTH_LOGIN || "";
  const password = process.env.AUTH_PASSWORD || "";
  return createHash("sha256").update(`${login}:${password}`).digest("hex");
}

export function validateCredentials(login: string, password: string): boolean {
  return login === process.env.AUTH_LOGIN && password === process.env.AUTH_PASSWORD;
}

export function getAuthCookieName(): string {
  return COOKIE_NAME;
}

export function getExpectedToken(): string {
  return getAuthToken();
}

export function isValidToken(token: string): boolean {
  return token === getAuthToken();
}
