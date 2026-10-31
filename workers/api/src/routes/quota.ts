import { Hono, type Context } from "hono";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { z } from "zod";
import {
  validateApplicationConfiguration,
  type CategoryRules,
  type CalculationInput,
} from "@ipo-mania/financial-engine";
import type { EnvironmentBindings } from "../env";
import { authenticate } from "../middleware/authenticate";
import { validateJson } from "../middleware/validate-json";
import { ipoCalculationSchema } from "@ipo-mania/validation";

type QuotaContext = {
  Bindings: EnvironmentBindings;
  Variables: { authenticatedUser: User; rlsSupabase: SupabaseClient };
};
type QuotaRouteContext = Context<QuotaContext>;
type CalculationRequest = z.infer<typeof ipoCalculationSchema>;

const ipoPricingColumns =
  "id, issue_price_min, issue_price_max, cut_off_price, lot_size, archived_at";
const categoryColumns =
  "id, category, rule_version, lot_limit_status, minimum_lots, maximum_lots, lot_increment, investment_limit_status, minimum_investment, maximum_investment, shareholder_record_date, minimum_shareholding, eligibility_conditions, allowed_price_types, minimum_price_increment";

export const quotaRoutes = new Hono<QuotaContext>();
quotaRoutes.use("*", authenticate);

quotaRoutes.post(
  "/calculate",
  validateJson(ipoCalculationSchema),
  async (context) => calculate(context, context.req.valid("json"), true),
);
quotaRoutes.post(
  "/validate",
  validateJson(ipoCalculationSchema),
  async (context) => calculate(context, context.req.valid("json"), false),
);

async function calculate(
  context: QuotaRouteContext,
  request: CalculationRequest,
  save: boolean,
) {
  const supabase = context.get("rlsSupabase");
  const userId = context.get("authenticatedUser").id;
  const { data: ipo, error: ipoError } = await supabase
    .from("ipos")
    .select(ipoPricingColumns)
    .eq("id", request.ipo_id)
    .eq("user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  if (ipoError) throw ipoError;
  if (!ipo) return notFound(context, "IPO_NOT_FOUND", "The IPO record was not found.");

  const { data: account, error: accountError } = await supabase
    .from("demat_accounts")
    .select("id")
    .eq("id", request.demat_account_id)
    .eq("user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  if (accountError) throw accountError;
  if (!account)
    return notFound(context, "DEMAT_ACCOUNT_NOT_FOUND", "The demat account was not found.");

  const { data: rule, error: ruleError } = await supabase
    .from("ipo_categories")
    .select(categoryColumns)
    .eq("ipo_id", request.ipo_id)
    .eq("user_id", userId)
    .eq("category", request.category)
    .order("rule_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ruleError) throw ruleError;
  if (!rule) {
    return context.json(
      {
        data: {
          eligible: false,
          total_shares: null,
          application_amount: null,
          category: request.category,
          rule_version: null,
          eligibility_verified: false,
          calculation_details: null,
          validation_errors: [
            {
              code: "CATEGORY_RULES_NOT_FOUND",
              message: "Configure issue-specific rules before calculating this category.",
            },
          ],
        },
      },
      422,
    );
  }

  const rules: CategoryRules = {
    category: request.category,
    rule_version: rule.rule_version as number,
    lot_limit_status: rule.lot_limit_status as CategoryRules["lot_limit_status"],
    minimum_lots: rule.minimum_lots as number | null,
    maximum_lots: rule.maximum_lots as number | null,
    lot_increment: rule.lot_increment as number,
    investment_limit_status: rule.investment_limit_status as CategoryRules["investment_limit_status"],
    minimum_investment: rule.minimum_investment as string | null,
    maximum_investment: rule.maximum_investment as string | null,
    shareholder_record_date: rule.shareholder_record_date as string | null,
    minimum_shareholding: rule.minimum_shareholding as number | null,
    eligibility_conditions: rule.eligibility_conditions as CategoryRules["eligibility_conditions"],
    allowed_price_types: rule.allowed_price_types as CategoryRules["allowed_price_types"],
    minimum_price_increment: rule.minimum_price_increment as string | null,
  };
  const calculationInput: CalculationInput = {
    ipo: {
      issue_price_min: ipo.issue_price_min as string,
      issue_price_max: ipo.issue_price_max as string,
      cut_off_price: ipo.cut_off_price as string | null,
      lot_size: ipo.lot_size as number,
    },
    category: request.category,
    rules,
    lots: request.lots,
    price_type: request.price_type,
    price: request.price,
    shareholder_shares: request.shareholder_shares,
    eligibility_answers: request.eligibility_answers,
  };
  const result = validateApplicationConfiguration(calculationInput);

  if (!save) return context.json({ data: result });

  const { data: audit, error: auditError } = await supabase
    .from("ipo_quota_calculations")
    .insert({
      user_id: userId,
      ipo_id: request.ipo_id,
      category_configuration_id: rule.id,
      demat_account_id: account.id,
      category: request.category,
      rule_version: rules.rule_version,
      input_snapshot: {
        ipo: calculationInput.ipo,
        category_configuration: rule,
        demat_account_id: account.id,
        category: request.category,
        lots: request.lots,
        price_type: request.price_type,
        price: request.price,
        shareholder_shares: request.shareholder_shares,
        eligibility_answers: request.eligibility_answers,
      },
      result_snapshot: result,
    })
    .select("id, calculation_timestamp")
    .single();
  if (auditError) throw auditError;
  return context.json({
    data: {
      ...result,
      calculation_id: audit.id,
      calculation_timestamp: audit.calculation_timestamp,
    },
  });
}

function notFound(context: QuotaRouteContext, code: string, message: string) {
  return context.json({ error: { code, message } }, 404);
}
