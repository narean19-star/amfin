const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// WARNING: Use the service_role key, which has admin privileges.
// Do NOT expose this in your frontend or commit it to git.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function migrate() {
  const dataPath = path.resolve(__dirname, '..', 'data.json');
  if (!fs.existsSync(dataPath)) { console.log('data.json not found, skipping migration.'); return; }
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  console.log('Starting migration...');

  // Helper to convert string arrays to objects for insertion
  const toNameObjects = (arr) => (arr || []).map(name => ({ name }));
  // Helper to add a UUID to records if they don't have one
  const addId = (records) => (records || []).map(r => ({ ...r, id: r.id || randomUUID() }));

  // Map your JSON arrays to table names
  const migrations = {
    expense_categories: toNameObjects(data.expenseCategories),
    suppliers: toNameObjects(data.suppliers),
    items: toNameObjects(data.items),
    customers: toNameObjects(data.customers),
    owners: toNameObjects(data.owners),
    entries: addId(data.entries),
    purchases: addId(data.purchases),
    expenses: addId(data.expenses),
    cheques: addId(data.cheques),
  };

  for (const [table, records] of Object.entries(migrations)) {
    if (records && records.length > 0) {
      // We'll insert in chunks to avoid hitting Supabase limits
      const chunkSize = 100;
      for (let i = 0; i < records.length; i += chunkSize) {
          const chunk = records.slice(i, i + chunkSize);
          const { error } = await supabase.from(table).insert(chunk);
          if (error) {
            console.error(`Error migrating chunk to ${table}:`, error.message);
          } else {
            console.log(`Successfully migrated ${chunk.length} records to ${table}.`);
          }
      }
    }
  }

  console.log('Migration complete.');
}

migrate();