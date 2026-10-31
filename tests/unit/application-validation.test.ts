import { describe, expect, it } from "vitest";
import {
  applicationBulkCreateSchema,
  applicationBulkStatusSchema,
  applicationCreateSchema,
  ipoCategorySchema,
} from "@ipo-mania/validation";

const validApplication = {
  ipo_id: "88888888-8888-4888-8888-888888888888",
  demat_account_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  category_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  lots: 1,
  price_type: "CUT_OFF",
  price: "125.00",
  shareholder_shares: null,
  eligibility_answers: {},
};

describe("application boundary validation", () => {
  it("defaults new and imported applications to independent draft and unknown statuses", () => {
    expect(applicationCreateSchema.parse(validApplication)).toMatchObject({
      application_status: "DRAFT",
      mandate_status: "UNKNOWN",
      allotment_status: "UNKNOWN",
    });
  });

  it("accepts each supported application category and lifecycle status", () => {
    expect(ipoCategorySchema.options).toEqual(["RETAIL", "SHNI", "BHNI", "SHAREHOLDER"]);
    expect(
      ["DRAFT", "SUBMITTED", "UNDER_PROCESSING", "REJECTED", "FAILED", "COMPLETED"].every(
        (status) =>
          applicationCreateSchema.safeParse({
            ...validApplication,
            application_status: status,
          }).success,
      ),
    ).toBe(true);
  });

  it("requires positive lots and rejects forged ownership and arbitrary fields", () => {
    expect(applicationCreateSchema.safeParse({ ...validApplication, lots: 0 }).success).toBe(false);
    expect(
      applicationCreateSchema.safeParse({ ...validApplication, user_id: "forged" }).success,
    ).toBe(false);
    expect(applicationCreateSchema.safeParse({ ...validApplication, unknown: true }).success).toBe(
      false,
    );
  });

  it("validates bulk requests and only permits status changes when a status is supplied", () => {
    expect(
      applicationBulkCreateSchema.safeParse({ applications: [validApplication] }).success,
    ).toBe(true);
    expect(applicationBulkCreateSchema.safeParse({ applications: [] }).success).toBe(false);
    expect(
      applicationBulkStatusSchema.safeParse({
        application_ids: [validApplication.ipo_id],
        mandate_status: "APPROVED",
      }).success,
    ).toBe(true);
    expect(
      applicationBulkStatusSchema.safeParse({ application_ids: [validApplication.ipo_id] }).success,
    ).toBe(false);
  });
});
