import pg from "pg";

export async function initDatabase() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS organisations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      subscription_plan TEXT NOT NULL DEFAULT 'basic',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'assistant',
      department TEXT NOT NULL DEFAULT 'both',
      organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'both';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes JSONB DEFAULT '[]';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

    CREATE TABLE IF NOT EXISTS matters (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_email TEXT,
      property_address TEXT NOT NULL,
      price TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      current_stage TEXT NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      matter_id INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      stage TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      due_date TIMESTAMP,
      notes TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      completed_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS draft_emails (
      id SERIAL PRIMARY KEY,
      matter_id INTEGER REFERENCES matters(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      recipient TEXT,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id SERIAL PRIMARY KEY,
      matter_id INTEGER REFERENCES matters(id) ON DELETE CASCADE,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      due_date TIMESTAMP NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id SERIAL PRIMARY KEY,
      journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    ALTER TABLE matters ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP;
    ALTER TABLE matters ADD COLUMN IF NOT EXISTS is_company_remortgage BOOLEAN DEFAULT FALSE;
    ALTER TABLE matters ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id);

    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      matter_id INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      document_type TEXT NOT NULL DEFAULT 'other',
      file_path TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enquiry_packs (
      id SERIAL PRIMARY KEY,
      matter_id INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      pack_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'review_required',
      created_by TEXT NOT NULL DEFAULT 'system',
      source_document_ids JSONB DEFAULT '[]',
      content_json JSONB DEFAULT '{}',
      content_markdown TEXT NOT NULL DEFAULT '',
      risk_flags JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      approved_at TIMESTAMP,
      approved_by TEXT,
      sent_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      matter_id INTEGER REFERENCES matters(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      performed_by TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_resources (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      extracted_text TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enquiries_library (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      subcategory TEXT,
      title TEXT NOT NULL,
      enquiry_text TEXT NOT NULL,
      applies_to TEXT NOT NULL DEFAULT 'both',
      tags TEXT[] DEFAULT '{}',
      when_to_use TEXT,
      grace_paragraph TEXT,
      is_default BOOLEAN NOT NULL DEFAULT TRUE,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enquiries_builder_packs (
      id SERIAL PRIMARY KEY,
      matter_id INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      pack_type TEXT NOT NULL DEFAULT 'custom',
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT NOT NULL,
      selected_items_json JSONB DEFAULT '[]',
      export_count INTEGER NOT NULL DEFAULT 0,
      last_exported_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS financial_items (
      id SERIAL PRIMARY KEY,
      matter_id INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      amount TEXT NOT NULL DEFAULT '0',
      vat_rate TEXT DEFAULT '0',
      vat_amount TEXT DEFAULT '0',
      total_amount TEXT DEFAULT '0',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matter_financials (
      id SERIAL PRIMARY KEY,
      matter_id INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      monies_on_account TEXT DEFAULT '0',
      mortgage_advance TEXT DEFAULT '0',
      redemption_amount TEXT DEFAULT '0',
      sale_price TEXT DEFAULT '0',
      purchase_price TEXT DEFAULT '0',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS control_checks (
      id SERIAL PRIMARY KEY,
      organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
      matter_id INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      required BOOLEAN NOT NULL DEFAULT TRUE,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      completed_by INTEGER REFERENCES users(id),
      completed_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rule_templates (
      id SERIAL PRIMARY KEY,
      module_type TEXT NOT NULL DEFAULT 'conveyancing',
      matter_type TEXT NOT NULL DEFAULT 'purchase',
      stage TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      required BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS risk_assessments (
      id SERIAL PRIMARY KEY,
      matter_id INTEGER NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'draft',
      form_data JSONB NOT NULL DEFAULT '{}',
      overall_client_risk TEXT,
      overall_matter_risk TEXT,
      completed_by INTEGER REFERENCES users(id),
      completed_at TIMESTAMP,
      updated_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    ALTER TABLE matters ADD COLUMN IF NOT EXISTS completion_date TIMESTAMP;

    ALTER TABLE control_checks ADD COLUMN IF NOT EXISTS rule_key TEXT;
    ALTER TABLE rule_templates ADD COLUMN IF NOT EXISTS rule_key TEXT;

    ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS activity TEXT;
    ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS learning TEXT;
    ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reflection TEXT;
    ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS entry_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL;

    CREATE INDEX IF NOT EXISTS journal_entries_user_idx ON journal_entries(user_id);
    CREATE INDEX IF NOT EXISTS journal_entries_user_date_idx ON journal_entries(user_id, entry_date);

    CREATE INDEX IF NOT EXISTS matters_org_idx ON matters(organisation_id);
    CREATE INDEX IF NOT EXISTS control_checks_matter_idx ON control_checks(matter_id);
    CREATE INDEX IF NOT EXISTS control_checks_org_idx ON control_checks(organisation_id);
    CREATE INDEX IF NOT EXISTS risk_assessments_matter_idx ON risk_assessments(matter_id);
    CREATE INDEX IF NOT EXISTS risk_assessments_org_idx ON risk_assessments(organisation_id);
    CREATE UNIQUE INDEX IF NOT EXISTS risk_assessments_matter_org_idx ON risk_assessments(matter_id, organisation_id);

    ALTER TABLE organisations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
    ALTER TABLE organisations ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
    ALTER TABLE organisations ADD COLUMN IF NOT EXISTS is_platform BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE organisations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id);
    CREATE INDEX IF NOT EXISTS audit_logs_org_idx ON audit_logs(organisation_id);

    CREATE TABLE IF NOT EXISTS processed_stripe_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload_json JSONB NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'received',
      error TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE;
    ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE;
    ALTER TABLE knowledge_resources ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE;
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE;
    ALTER TABLE enquiries_library ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE;
    ALTER TABLE rule_templates ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE;

    -- Backfill firm-owned rows from user org, else first organisation
    UPDATE journal_entries je
      SET organisation_id = u.organisation_id
      FROM users u
      WHERE je.organisation_id IS NULL AND je.user_id = u.id;
    UPDATE journal_entries
      SET organisation_id = (SELECT id FROM organisations ORDER BY id LIMIT 1)
      WHERE organisation_id IS NULL AND EXISTS (SELECT 1 FROM organisations);
    UPDATE time_entries te
      SET organisation_id = je.organisation_id
      FROM journal_entries je
      WHERE te.organisation_id IS NULL AND te.journal_entry_id = je.id;
    UPDATE time_entries
      SET organisation_id = (SELECT id FROM organisations ORDER BY id LIMIT 1)
      WHERE organisation_id IS NULL AND EXISTS (SELECT 1 FROM organisations);
    UPDATE knowledge_resources
      SET organisation_id = (SELECT id FROM organisations ORDER BY id LIMIT 1)
      WHERE organisation_id IS NULL AND EXISTS (SELECT 1 FROM organisations);
    UPDATE conversations
      SET organisation_id = (SELECT id FROM organisations ORDER BY id LIMIT 1)
      WHERE organisation_id IS NULL AND EXISTS (SELECT 1 FROM organisations);
    UPDATE matters
      SET organisation_id = (SELECT id FROM organisations ORDER BY id LIMIT 1)
      WHERE organisation_id IS NULL AND EXISTS (SELECT 1 FROM organisations);

    -- Shared catalogs stay NULL; firm-owned columns become NOT NULL when orgs exist
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM organisations) THEN
        ALTER TABLE journal_entries ALTER COLUMN organisation_id SET NOT NULL;
        ALTER TABLE time_entries ALTER COLUMN organisation_id SET NOT NULL;
        ALTER TABLE knowledge_resources ALTER COLUMN organisation_id SET NOT NULL;
        ALTER TABLE conversations ALTER COLUMN organisation_id SET NOT NULL;
        ALTER TABLE matters ALTER COLUMN organisation_id SET NOT NULL;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS journal_entries_org_idx ON journal_entries(organisation_id);
    CREATE INDEX IF NOT EXISTS time_entries_org_idx ON time_entries(organisation_id);
    CREATE INDEX IF NOT EXISTS knowledge_resources_org_idx ON knowledge_resources(organisation_id);
    CREATE INDEX IF NOT EXISTS conversations_org_idx ON conversations(organisation_id);
    CREATE INDEX IF NOT EXISTS enquiries_library_org_idx ON enquiries_library(organisation_id);
    CREATE INDEX IF NOT EXISTS rule_templates_org_idx ON rule_templates(organisation_id);

    -- Per-org username uniqueness (drop legacy global unique if present)
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
    DROP INDEX IF EXISTS users_username_key;
    CREATE UNIQUE INDEX IF NOT EXISTS users_org_username_idx ON users(organisation_id, username);
  `);

  await applyTenantRls(pool);

  await pool.end();
}

const RLS_BYPASS = `current_setting('app.rls_bypass', true) = 'on'`;
const RLS_ORG = `NULLIF(current_setting('app.current_org_id', true), '')::integer`;

async function applyTenantRls(pool: pg.Pool) {
  const orgPolicy = (table: string) => `
    ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS ${table}_tenant ON ${table};
    CREATE POLICY ${table}_tenant ON ${table}
      USING (
        ${RLS_BYPASS}
        OR (organisation_id IS NOT NULL AND organisation_id = ${RLS_ORG})
      )
      WITH CHECK (
        ${RLS_BYPASS}
        OR (organisation_id IS NOT NULL AND organisation_id = ${RLS_ORG})
      );
  `;

  const matterChildPolicy = (table: string, matterCol = "matter_id") => `
    ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS ${table}_tenant ON ${table};
    CREATE POLICY ${table}_tenant ON ${table}
      USING (
        ${RLS_BYPASS}
        OR ${table}.${matterCol} IS NULL
        OR EXISTS (
          SELECT 1 FROM matters m
          WHERE m.id = ${table}.${matterCol}
            AND m.organisation_id IS NOT NULL
            AND m.organisation_id = ${RLS_ORG}
        )
      )
      WITH CHECK (
        ${RLS_BYPASS}
        OR ${table}.${matterCol} IS NULL
        OR EXISTS (
          SELECT 1 FROM matters m
          WHERE m.id = ${table}.${matterCol}
            AND m.organisation_id IS NOT NULL
            AND m.organisation_id = ${RLS_ORG}
        )
      );
  `;

  /** Shared catalog: NULL organisation_id is platform-wide; firm rows are org-scoped. */
  const catalogPolicy = (table: string) => `
    ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS ${table}_tenant ON ${table};
    CREATE POLICY ${table}_tenant ON ${table}
      USING (
        ${RLS_BYPASS}
        OR organisation_id IS NULL
        OR organisation_id = ${RLS_ORG}
      )
      WITH CHECK (
        ${RLS_BYPASS}
        OR organisation_id IS NULL
        OR organisation_id = ${RLS_ORG}
      );
  `;

  const conversationChildPolicy = `
    ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
    ALTER TABLE messages FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS messages_tenant ON messages;
    CREATE POLICY messages_tenant ON messages
      USING (
        ${RLS_BYPASS}
        OR EXISTS (
          SELECT 1 FROM conversations c
          WHERE c.id = messages.conversation_id
            AND c.organisation_id IS NOT NULL
            AND c.organisation_id = ${RLS_ORG}
        )
      )
      WITH CHECK (
        ${RLS_BYPASS}
        OR EXISTS (
          SELECT 1 FROM conversations c
          WHERE c.id = messages.conversation_id
            AND c.organisation_id IS NOT NULL
            AND c.organisation_id = ${RLS_ORG}
        )
      );
  `;

  await pool.query(`
    ${orgPolicy("users")}
    ${orgPolicy("matters")}
    ${orgPolicy("control_checks")}
    ${orgPolicy("risk_assessments")}
    ${orgPolicy("journal_entries")}
    ${orgPolicy("time_entries")}
    ${orgPolicy("knowledge_resources")}
    ${orgPolicy("conversations")}
    ${catalogPolicy("enquiries_library")}
    ${catalogPolicy("rule_templates")}
    ${conversationChildPolicy}
    ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS audit_logs_tenant ON audit_logs;
    CREATE POLICY audit_logs_tenant ON audit_logs
      USING (
        ${RLS_BYPASS}
        OR (organisation_id IS NOT NULL AND organisation_id = ${RLS_ORG})
        OR (
          organisation_id IS NULL
          AND matter_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM matters m
            WHERE m.id = audit_logs.matter_id
              AND m.organisation_id IS NOT NULL
              AND m.organisation_id = ${RLS_ORG}
          )
        )
      )
      WITH CHECK (
        ${RLS_BYPASS}
        OR (organisation_id IS NOT NULL AND organisation_id = ${RLS_ORG})
        OR (
          organisation_id IS NULL
          AND (
            matter_id IS NULL
            OR EXISTS (
              SELECT 1 FROM matters m
              WHERE m.id = audit_logs.matter_id
                AND m.organisation_id IS NOT NULL
                AND m.organisation_id = ${RLS_ORG}
            )
          )
        )
      );
    ${matterChildPolicy("tasks")}
    ${matterChildPolicy("draft_emails")}
    ${matterChildPolicy("reminders")}
    ${matterChildPolicy("documents")}
    ${matterChildPolicy("enquiry_packs")}
    ${matterChildPolicy("enquiries_builder_packs")}
    ${matterChildPolicy("financial_items")}
    ${matterChildPolicy("matter_financials")}
  `);
}
