import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';

const databaseUrl = process.env.DATABASE_URL;
const adminEmail = String(process.env.PLATFORM_ADMIN_EMAIL || '').trim().toLowerCase();
const adminName = String(process.env.PLATFORM_ADMIN_NAME || 'Platform Administrator').trim();

if (!databaseUrl) throw new Error('DATABASE_URL is required.');
if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
  throw new Error('Set PLATFORM_ADMIN_EMAIL to a valid administrator email.');
}

function readHidden(prompt: string): Promise<string> {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    return Promise.reject(new Error('Run this command in an interactive terminal so the password is not echoed.'));
  }

  return new Promise((resolve, reject) => {
    let value = '';
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {
          input.setRawMode(false);
          input.pause();
          input.off('data', onData);
          process.stdout.write('\n');
          reject(new Error('Operation cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          input.setRawMode(false);
          input.pause();
          input.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          if (value.length) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        if (character >= ' ') {
          value += character;
          process.stdout.write('*');
        }
      }
    };
    input.on('data', onData);
  });
}

const password = await readHidden('Enter a NEW platform-admin password (16+ characters): ');
const confirmation = await readHidden('Confirm the new password: ');
if (password.length < 16) throw new Error('Use a password with at least 16 characters; no data was changed.');
if (password !== confirmation) throw new Error('Passwords did not match; no data was changed.');

const sql = neon(databaseUrl);
const matches = await sql`
  SELECT id FROM app_records
  WHERE collection = 'accounts' AND LOWER(record->>'email') = ${adminEmail}
  ORDER BY created_at ASC
` as { id: string }[];

if (matches.length > 1) {
  throw new Error(`Multiple accounts use ${adminEmail}; resolve the duplicate accounts before resetting credentials.`);
}

const existingId = matches[0]?.id;
const reservedAccountId = existingId === 'account-platform-admin';
const accountId = existingId && !reservedAccountId ? existingId : `account-${randomUUID()}`;
const now = Date.now();
const salt = randomBytes(16).toString('hex');
const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const account = {
  id: accountId,
  tenantId: 'platform',
  salonName: 'All Salons',
  branchId: '',
  name: adminName,
  email: adminEmail,
  phone: '',
  role: 'admin',
  status: 'active',
  passwordHash,
  passwordResetAt: now,
  createdAt: now,
};

const statements = [];
if (reservedAccountId) {
  statements.push(sql`UPDATE app_records
    SET record = jsonb_set(
      jsonb_set(record, '{email}', to_jsonb(${'retired-platform-admin+' + now + '@invalid.local'}::text), true),
      '{status}', '"inactive"'::jsonb, true
    )
    WHERE collection = 'accounts' AND id = 'account-platform-admin'`);
}
statements.push(sql`INSERT INTO app_records (id, collection, tenant_id, record)
  VALUES (${accountId}, 'accounts', NULL, ${JSON.stringify(account)}::jsonb)
  ON CONFLICT (id) DO UPDATE SET tenant_id = NULL, record = EXCLUDED.record
  WHERE app_records.collection = 'accounts'`);
if (existingId) {
  const previousAccountIds = reservedAccountId ? [existingId, accountId] : [existingId];
  statements.push(sql`UPDATE app_records
    SET record = jsonb_set(record, '{expiresAt}', to_jsonb(${now}::bigint), true)
    WHERE collection = 'sessions' AND record->>'accountId' = ANY(${previousAccountIds})`);
}

await sql.transaction(statements);
console.log(`Platform administrator credentials updated for ${adminEmail}. Existing sessions for this account were expired; salon data was not modified.`);
