/**
 * Unit tests for device-login request reuse (one login attempt = one request).
 *
 * Run with:  pnpm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_EXPIRES_IN_SECONDS,
  MIN_REMAINING_MS,
  decideReuse,
  isReusablePendingLogin,
  pendingLoginFromResponse,
  type PendingLogin,
} from "./pendingLogin";

const NOW = 1_800_000_000_000;
const API = "https://try.postking.app";

function pending(overrides: Partial<PendingLogin> = {}): PendingLogin {
  return {
    device_code: "d".repeat(64),
    user_code: "ABCD-1234",
    verification_uri: `${API}/activate/ABCD-1234`,
    apiUrl: API,
    startedAt: NOW - 60_000,
    expiresAt: NOW + 30 * 60 * 1000,
    ...overrides,
  };
}

describe("isReusablePendingLogin", () => {
  it("reuses a request that is still comfortably valid", () => {
    assert.equal(isReusablePendingLogin(pending(), API, NOW), true);
  });

  it("does not reuse when there is none", () => {
    assert.equal(isReusablePendingLogin(null, API, NOW), false);
  });

  it("does not reuse an expired or nearly expired request", () => {
    assert.equal(isReusablePendingLogin(pending({ expiresAt: NOW - 1 }), API, NOW), false);
    assert.equal(isReusablePendingLogin(pending({ expiresAt: NOW + MIN_REMAINING_MS }), API, NOW), false);
    assert.equal(isReusablePendingLogin(pending({ expiresAt: NOW + MIN_REMAINING_MS + 1 }), API, NOW), true);
  });

  it("does not reuse a request created on another API", () => {
    assert.equal(isReusablePendingLogin(pending(), "http://localhost:3000", NOW), false);
  });

  it("does not reuse a file from a release that saved no link or expiry", () => {
    const legacy: PendingLogin = { device_code: "x", apiUrl: API, startedAt: NOW };
    assert.equal(isReusablePendingLogin(legacy, API, NOW), false);
    assert.equal(isReusablePendingLogin(pending({ user_code: undefined }), API, NOW), false);
    assert.equal(isReusablePendingLogin(pending({ verification_uri: undefined }), API, NOW), false);
  });
});

describe("decideReuse", () => {
  it("redeems a request the user already approved", () => {
    assert.equal(decideReuse({ access_token: "pk_live_x" }), "logged_in");
  });

  it("shows the same link again while approval is pending", () => {
    assert.equal(decideReuse({ error: "authorization_pending" }), "show_again");
    assert.equal(decideReuse({ error: "slow_down" }), "show_again");
  });

  it("starts over on expiry, an unknown code, a denial or no answer", () => {
    assert.equal(decideReuse({ error: "expired_token" }), "start_new");
    assert.equal(decideReuse({ error: "invalid_grant" }), "start_new");
    assert.equal(decideReuse({ error: "access_denied" }), "start_new");
    assert.equal(decideReuse({}), "start_new");
    assert.equal(decideReuse(null), "start_new");
  });
});

describe("pendingLoginFromResponse", () => {
  const response = { device_code: "dc", user_code: "ABCD-1234", verification_uri: `${API}/activate/ABCD-1234` };

  it("uses the server's lifetime", () => {
    const saved = pendingLoginFromResponse({ ...response, expires_in: 600 }, API, NOW);
    assert.equal(saved.expiresAt, NOW + 600_000);
    assert.equal(saved.startedAt, NOW);
    assert.equal(isReusablePendingLogin(saved, API, NOW), true);
  });

  it("falls back to the default lifetime", () => {
    const saved = pendingLoginFromResponse(response, API, NOW);
    assert.equal(saved.expiresAt, NOW + DEFAULT_EXPIRES_IN_SECONDS * 1000);
  });
});
