/**
 * Ops script: create an organisation and its first admin user.
 *
 * Usage:
 *   DATABASE_URL=... pnpm --filter @workspace/api-server create-org -- \
 *     --name "Firm B" --admin-user firmb.admin --admin-pass 'SecurePass12' \
 *     [--admin-display "Firm B Admin"] [--plan basic]
 */
import { withRlsBypass } from "./db";
import { provisionOrganisation } from "./provision-organisation";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function usage(): never {
  console.error(`Usage: create-org --name <firm> --admin-user <user> --admin-pass <pass> [--admin-display <name>] [--plan basic|pro]`);
  process.exit(1);
}

async function main() {
  const name = arg("--name");
  const adminUser = arg("--admin-user");
  const adminPass = arg("--admin-pass");
  const adminDisplay = arg("--admin-display") || adminUser;
  const plan = arg("--plan") || "basic";

  if (!name || !adminUser || !adminPass) usage();
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const { initDatabase } = await import("./init-db");
  await initDatabase();

  try {
    const result = await withRlsBypass(async () =>
      provisionOrganisation({
        name: name!,
        adminUser: adminUser!,
        adminPass: adminPass!,
        adminDisplay: adminDisplay!,
        plan,
      }),
    );
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  } catch (err: any) {
    console.error(err?.message || err);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
