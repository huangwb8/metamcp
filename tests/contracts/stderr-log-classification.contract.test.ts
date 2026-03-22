import { classifyStderrMessage } from "../../apps/backend/src/lib/metamcp/stderr-log-classification";

describe("stderr log classification contract", () => {
  it("keeps normal stderr output out of the error state", () => {
    expect(classifyStderrMessage("Debugger attached.\n")).toMatchObject({
      level: "warn",
      event: "stderr",
      status: "stderr",
      message: "Debugger attached.",
    });
  });

  it("preserves real startup failures as error-level stderr events", () => {
    expect(
      classifyStderrMessage("Error: Cannot find module 'tsx'"),
    ).toMatchObject({
      level: "error",
      event: "stderr",
      status: "error",
      message: "Error: Cannot find module 'tsx'",
    });
  });

  it("ignores empty stderr chunks", () => {
    expect(classifyStderrMessage("   \n\t  ")).toBeUndefined();
  });
});
