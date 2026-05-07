import { describe, expect, it } from "vitest";
import { formatProviderSettingsJSON } from "./formatters";

describe("formatProviderSettingsJSON", () => {
  it("preserves the Claude env wrapper when formatting provider settings", () => {
    const formatted = formatProviderSettingsJSON(
      `{"env":{"ANTHROPIC_AUTH_TOKEN":"","ANTHROPIC_BASE_URL":""}}`,
      "claude",
    );

    expect(JSON.parse(formatted)).toEqual({
      env: {
        ANTHROPIC_AUTH_TOKEN: "",
        ANTHROPIC_BASE_URL: "",
      },
    });
  });

  it("wraps root-level Claude env fragments back into env", () => {
    const formatted = formatProviderSettingsJSON(
      `{"ANTHROPIC_AUTH_TOKEN":"","ANTHROPIC_BASE_URL":""}`,
      "claude",
    );

    expect(JSON.parse(formatted)).toEqual({
      env: {
        ANTHROPIC_AUTH_TOKEN: "",
        ANTHROPIC_BASE_URL: "",
      },
    });
  });
});
