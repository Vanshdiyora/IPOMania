import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DEMAT_TEST_DATABASE_URL;
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const isLoopbackDatabase = (() => {
  if (!databaseUrl) return false;
  try {
    return loopbackHosts.has(new URL(databaseUrl).hostname);
  } catch {
    return false;
  }
})();

describe.skipIf(!databaseUrl)("application external-reference concurrency", () => {
  let sql: ReturnType<typeof postgres>;
  let userId: string;
  let ipoId: string;
  let accountId: string;
  let categoryId: string;

  beforeAll(async () => {
    if (!isLoopbackDatabase) {
      throw new Error(
        "DEMAT_TEST_DATABASE_URL must point to a loopback-only isolated test database.",
      );
    }
    sql = postgres(databaseUrl!, { max: 3, connect_timeout: 5 });
    const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
    const [user] = await sql<{ id: string }[]>`
      insert into auth.users (
        id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) values (
        gen_random_uuid(), 'authenticated', 'authenticated',
        ${`application-race-${suffix}@example.test`}, '',
        now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Application Race"}',
        now(), now()
      )
      returning id
    `;
    userId = user.id;
    const [ipo] = await sql<{ id: string }[]>`
      insert into public.ipos (
        user_id, company_name, symbol, ipo_type, exchange, issue_price_min, issue_price_max,
        cut_off_price, lot_size, issue_size, opening_date, closing_date, status
      ) values (
        ${userId}::uuid, 'Application race test', ${`RACE${suffix}`}, 'Test', 'Test Exchange',
        10, 20, 20, 10, 100000, '2026-11-01', '2026-11-03', 'UPCOMING'
      )
      returning id
    `;
    ipoId = ipo.id;
    const [category] = await sql<{ id: string }[]>`
      insert into public.ipo_categories (
        user_id, ipo_id, category, lot_limit_status, minimum_lots, maximum_lots, lot_increment,
        investment_limit_status, eligibility_conditions, allowed_price_types
      ) values (
        ${userId}::uuid, ${ipoId}::uuid, 'RETAIL', 'CONFIGURED', 1, 2, 1,
        'NO_PUBLISHED_LIMIT', '[]'::jsonb, array['CUT_OFF']
      )
      returning id
    `;
    categoryId = category.id;
    const [account] = await sql<{ id: string }[]>`
      insert into public.demat_accounts (
        user_id, holder_name, broker_name, depository_type, masked_demat_identifier
      ) values (
        ${userId}::uuid, 'Application Race', 'Race Test Broker', 'NSDL', ${`XXXX${suffix}`}
      )
      returning id
    `;
    accountId = account.id;
  });

  afterAll(async () => {
    if (!sql) return;
    if (userId) {
      await sql.begin(async (transaction) => {
        // Auth-user cascade cleanup must remove this fixture's immutable ledger entry.
        await transaction`alter table public.capital_ledger disable trigger capital_ledger_immutable`;
        await transaction`delete from auth.users where id = ${userId}::uuid`;
        await transaction`alter table public.capital_ledger enable trigger capital_ledger_immutable`;
      });
    }
    await sql.end();
  });

  it("allows only one simultaneous application with the same stable external reference", async () => {
    let insertedResolve: (() => void) | undefined;
    let releaseFirstResolve: (() => void) | undefined;
    const inserted = new Promise<void>((resolve) => {
      insertedResolve = resolve;
    });
    const releaseFirst = new Promise<void>((resolve) => {
      releaseFirstResolve = resolve;
    });
    const insert = (transaction: postgres.TransactionSql) =>
      transaction`
        insert into public.applications (
          user_id, ipo_id, demat_account_id, category_id, lots, total_shares,
          application_amount, external_reference, rule_version, calculation_snapshot
        ) values (
          ${userId}::uuid, ${ipoId}::uuid, ${accountId}::uuid, ${categoryId}::uuid,
          1, 10, 200, 'concurrent-stable-reference', 1, '{"source":"integration-test"}'::jsonb
        )
      `;
    const first = sql.begin(async (transaction) => {
      await transaction`set local role authenticated`;
      await transaction`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      await insert(transaction);
      insertedResolve?.();
      await releaseFirst;
    });
    await inserted;
    const second = sql.begin(async (transaction) => {
      await transaction`set local role authenticated`;
      await transaction`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      await insert(transaction);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    releaseFirstResolve?.();
    const [firstResult, secondResult] = await Promise.allSettled([first, second]);
    expect(firstResult.status).toBe("fulfilled");
    expect(secondResult.status).toBe("rejected");
    if (secondResult.status === "rejected") {
      expect(secondResult.reason.code).toBe("23505");
    }
    const [result] = await sql<{ count: string }[]>`
      select count(*)::text as count
      from public.applications
      where user_id = ${userId}::uuid and external_reference = 'concurrent-stable-reference'
    `;
    expect(Number(result.count)).toBe(1);
  });
});
