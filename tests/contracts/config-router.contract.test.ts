import { createConfigRouter } from "../../packages/trpc/src/routers/frontend/config";

function createImplementations() {
  return {
    getSignupDisabled: vi.fn(async () => false),
    setSignupDisabled: vi.fn(async () => ({ success: true })),
    getSsoSignupDisabled: vi.fn(async () => false),
    setSsoSignupDisabled: vi.fn(async () => ({ success: true })),
    getBasicAuthDisabled: vi.fn(async () => false),
    setBasicAuthDisabled: vi.fn(async () => ({ success: true })),
    getMcpResetTimeoutOnProgress: vi.fn(async () => true),
    setMcpResetTimeoutOnProgress: vi.fn(async () => ({ success: true })),
    getMcpTimeout: vi.fn(async () => 30_000),
    setMcpTimeout: vi.fn(async () => ({ success: true })),
    getMcpMaxTotalTimeout: vi.fn(async () => 120_000),
    setMcpMaxTotalTimeout: vi.fn(async () => ({ success: true })),
    getMcpMaxAttempts: vi.fn(async () => 3),
    setMcpMaxAttempts: vi.fn(async () => ({ success: true })),
    getSessionLifetime: vi.fn(async () => 3_600_000),
    setSessionLifetime: vi.fn(async () => ({ success: true })),
    getAllConfigs: vi.fn(async () => []),
    setConfig: vi.fn(async () => ({ success: true })),
    getAuthProviders: vi.fn(async () => []),
  };
}

describe("shared config router contract", () => {
  it("allows public reads without authentication", async () => {
    const implementations = createImplementations();
    const caller = createConfigRouter(implementations).createCaller({});

    await expect(caller.getMcpTimeout()).resolves.toBe(30_000);
    expect(implementations.getMcpTimeout).toHaveBeenCalledTimes(1);
  });

  it("blocks protected mutations when the caller is not authenticated", async () => {
    const implementations = createImplementations();
    const caller = createConfigRouter(implementations).createCaller({});

    await expect(
      caller.setSignupDisabled({
        disabled: true,
      }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(implementations.setSignupDisabled).not.toHaveBeenCalled();
  });

  it("validates protected mutation input before calling implementations", async () => {
    const implementations = createImplementations();
    const caller = createConfigRouter(implementations).createCaller({
      user: { id: "user-1" },
      session: { id: "session-1" },
    });

    await expect(
      caller.setMcpMaxAttempts({
        maxAttempts: 99,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(implementations.setMcpMaxAttempts).not.toHaveBeenCalled();
  });

  it("forwards valid authenticated config writes with the shared schema payload", async () => {
    const implementations = createImplementations();
    const caller = createConfigRouter(implementations).createCaller({
      user: { id: "user-1" },
      session: { id: "session-1" },
    });

    await expect(
      caller.setConfig({
        key: "MCP_TIMEOUT",
        value: "45000",
        description: "Repo-level contract test",
      }),
    ).resolves.toEqual({ success: true });

    expect(implementations.setConfig).toHaveBeenCalledWith({
      key: "MCP_TIMEOUT",
      value: "45000",
      description: "Repo-level contract test",
    });
  });
});
