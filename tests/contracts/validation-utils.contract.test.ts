import {
  getTranslatedFieldError,
  translateZodError,
  translateZodIssue,
} from "../../apps/frontend/lib/validation-utils";

type TranslationIssue = Parameters<typeof translateZodIssue>[0];
type TranslationError = Parameters<typeof translateZodError>[0];

describe("frontend validation translation contract", () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

  it("keeps explicit validation keys stable for i18n lookups", () => {
    const issue = {
      code: "custom",
      message: "validation:namespaceName.required",
      path: ["name"],
    } as TranslationIssue;

    expect(translateZodIssue(issue, t)).toBe(
      "validation:namespaceName.required",
    );
  });

  it("maps known custom backend messages to their translation keys", () => {
    const issue = {
      code: "custom",
      message: "Passwords do not match",
      path: ["confirmPassword"],
    } as TranslationIssue;

    expect(translateZodIssue(issue, t)).toBe("validation:password.mismatch");
  });

  it("injects size parameters for string length violations", () => {
    const issue = {
      code: "too_small",
      type: "string",
      minimum: 8,
      inclusive: true,
      exact: false,
      message: "String must contain at least 8 character(s)",
      path: ["password"],
    } as TranslationIssue;

    expect(translateZodIssue(issue, t)).toBe(
      'validation:minLength:{"min":8}',
    );
  });

  it("merges multiple issues for the same field into one translated entry", () => {
    const error = {
      issues: [
        {
          code: "custom",
          message: "Name is required",
          path: ["name"],
        } as TranslationIssue,
        {
          code: "too_small",
          type: "string",
          minimum: 3,
          inclusive: true,
          exact: false,
          message: "String must contain at least 3 character(s)",
          path: ["name"],
        } as TranslationIssue,
      ],
    } as TranslationError;

    expect(translateZodError(error, t)).toEqual({
      name: 'validation:nameRequired; validation:minLength:{"min":3}',
    });
  });

  it("returns a single translated field error when the field exists", () => {
    const error = {
      issues: [
        {
          code: "custom",
          message: "Command is required for stdio servers",
          path: ["command"],
        } as TranslationIssue,
      ],
    } as TranslationError;

    expect(getTranslatedFieldError(error, "command", t)).toBe(
      "validation:command.required",
    );
    expect(getTranslatedFieldError(error, "url", t)).toBeUndefined();
  });
});
