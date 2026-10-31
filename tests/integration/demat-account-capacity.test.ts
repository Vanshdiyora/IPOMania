import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DEMAT_TEST_DATABASE_URL;
const isLoopbackDatabase = (() => {
  if (!databaseUrl) return false;
  const hostname = new URL(databaseUrl).hostname;
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
})();

describe.skipIf(!databaseUrl)("demat account capacity concurrency", () => {
  let sql: ReturnType<typeof postgres>;
  let userId: string;

  beforeAll(async () => {
    if (!isLoopbackDatabase) {
      throw new Error(
        "DEMAT_TEST_DATABASE_URL must point to a loopback-only isolated test database.",
      );
    }

    sql = postgres(databaseUrl!, { max: 2, connect_timeout: 5 });
    const [user] = await sql<{ id: string }[]>`
      insert into auth.users (
        id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) values (
        gen_random_uuid(), 'authenticated', 'authenticated',
        ${`capacity-${crypto.randomUUID()}@example.test`}, '',
        now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Capacity Test"}',
        now(), now()
      )
      returning id
    `;
    userId = user.id;

    await sql`
      insert into public.demat_accounts (
        user_id, holder_name, broker_name, depository_type, masked_demat_identifier
      )
      select
        ${userId}::uuid,
        'Concurrency seed ' || account_number,
        'Capacity Test Broker',
        'NSDL',
        'XXXXCONC' || lpad(account_number::text, 6, '0')
      from generate_series(1, 499) as account_number
    `;
  });

  afterAll(async () => {
    if (!sql) return;
    if (userId) await sql`delete from auth.users where id = ${userId}::uuid`;
    await sql.end();
  });

  it("serializes simultaneous creates so the active count cannot exceed 500", async () => {
    const createAccount = (suffix: string) =>
      sql.begin(async (transaction) => {
        await transaction`set local role authenticated`;
        await transaction`select set_config('request.jwt.claim.sub', ${userId}, true)`;
        await transaction`
          insert into public.demat_accounts (
            user_id, holder_name, broker_name, depository_type, masked_demat_identifier
          ) values (
            ${userId}::uuid, ${`Concurrent ${suffix}`}, 'Capacity Test Broker',
            'CDSL', ${`XXXXCONCURRENT${suffix}`}
          )
        `;
      });

    const attempts = await Promise.allSettled([createAccount("A"), createAccount("B")]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    const rejected = attempts.find((attempt) => attempt.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason.code).toBe("23514");

    const [result] = await sql<{ count: string }[]>`
      select count(*)::text as count
      from public.demat_accounts
      where user_id = ${userId}::uuid
        and account_status = 'active'
        and archived_at is null
    `;
    expect(Number(result.count)).toBe(500);
  });
});
