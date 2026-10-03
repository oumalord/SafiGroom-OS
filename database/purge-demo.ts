import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const sql = neon(databaseUrl);
const demoSalonIds = ['salon-amalia', 'salon-braidy'];
const demoAccountIds = ['account-salon-amalia', 'account-salon-braidy'];
const demoOwnerEmails = ['owner@amaliasalon.demo', 'owner@braidyssalon.demo'];

await sql.transaction([
  sql`DROP TRIGGER IF EXISTS app_records_no_delete ON app_records`,
  sql`DROP TRIGGER IF EXISTS app_records_no_committed_update ON app_records`,
  sql`DELETE FROM app_records WHERE collection = 'sessions' AND record->>'accountId' IN (
    SELECT id FROM app_records WHERE collection = 'accounts' AND (
      record->>'tenantId' = ANY(${demoSalonIds}) OR id = ANY(${demoAccountIds}) OR record->>'email' = ANY(${demoOwnerEmails})
    )
  )`,
  sql`DELETE FROM app_records WHERE collection NOT IN ('salons', 'branches', 'accounts', 'sessions') AND (
    tenant_id = ANY(${demoSalonIds}) OR record->>'tenantId' = ANY(${demoSalonIds})
    OR record->>'salonName' IN ('AMALIA SALON', 'BRAIDYS SALON')
  )`,
  sql`DELETE FROM app_records WHERE collection = 'accounts' AND (
    record->>'tenantId' = ANY(${demoSalonIds}) OR id = ANY(${demoAccountIds}) OR record->>'email' = ANY(${demoOwnerEmails})
  )`,
  sql`DELETE FROM app_records WHERE collection = 'branches' AND (
    record->>'salonId' = ANY(${demoSalonIds}) OR id IN ('salon-amalia-main', 'salon-braidy-main')
  )`,
  sql`DELETE FROM app_records WHERE collection = 'salons' AND id = ANY(${demoSalonIds})`,
  sql`CREATE TRIGGER app_records_no_delete BEFORE DELETE ON app_records FOR EACH ROW EXECUTE FUNCTION prevent_safigroom_record_delete()`,
  sql`CREATE TRIGGER app_records_no_committed_update BEFORE UPDATE ON app_records FOR EACH ROW EXECUTE FUNCTION prevent_safigroom_committed_update()`,
]);

console.log('Demo salon data removed. Database schema and platform admin account preserved.');
