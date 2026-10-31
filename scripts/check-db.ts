import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "DATABASE_URL is required. Set it to a local or Supabase PostgreSQL connection string.",
  );
  process.exitCode = 1;
} else {
  const sql = postgres(connectionString, { max: 1, connect_timeout: 5 });
  try {
    const result = await sql`select 1 as connected`;
    if (result[0]?.connected !== 1) {
      throw new Error("Database returned an unexpected connectivity result.");
    }
    console.log("Database connectivity verified (SELECT 1).");
  } catch (error) {
    console.error("Database connectivity verification failed.", error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}
