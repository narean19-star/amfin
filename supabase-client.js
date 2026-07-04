const SUPABASE_URL = 'https://tnjnxuxpmyqvohkmkirp.supabase.co'; // From Project Settings -> API
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuam54dXhwbXlxdm9oa21raXJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNzA3MzgsImV4cCI6MjA5ODc0NjczOH0.QXUmD59fOOnCoyjwOVOlykPM0WVcoIJAyOtDNpA9EY4'; // From Project Settings -> API

const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Fetches all data from Supabase tables and reconstructs the original data object shape.
 */
async function loadDataFromSupabase() {
  console.log('Loading data from Supabase...');
  const [
    { data: expenseCategoriesData }, { data: suppliersData }, { data: itemsData },
    { data: customersData }, { data: ownersData }, { data: entries },
    { data: purchases }, { data: expenses }, { data: cheques }
  ] = await Promise.all([
    supabase.from('expense_categories').select('name'),
    supabase.from('suppliers').select('name'),
    supabase.from('items').select('name'),
    supabase.from('customers').select('name'),
    supabase.from('owners').select('name'),
    supabase.from('entries').select('*'),
    supabase.from('purchases').select('*'),
    supabase.from('expenses').select('*'),
    supabase.from('cheques').select('*'),
  ]);

  // Reconstruct the object that the application expects
  const data = {
    expenseCategories: (expenseCategoriesData || []).map(r => r.name),
    suppliers: (suppliersData || []).map(r => r.name),
    items: (itemsData || []).map(r => r.name),
    customers: (customersData || []).map(r => r.name),
    owners: (ownersData || []).map(r => r.name),
    entries: entries || [],
    purchases: purchases || [],
    expenses: expenses || [],
    cheques: cheques || [],
    lastSaved: new Date().toISOString(),
  };

  console.log('Data loaded successfully from Supabase.');
  return data;
}

/**
 * Saves the entire data object to Supabase tables using upsert.
 * Note: Transactional data requires an 'id' property. Master data requires a unique 'name' property.
 */
async function saveDataToSupabase(data) {
  console.log('Saving data to Supabase...');
  const {
      expenseCategories, suppliers, items, customers, owners,
      entries, purchases, expenses, cheques
  } = data;

  // Helper to convert string arrays to objects for upsert
  const toObjects = (arr) => (arr || []).map(name => ({ name }));

  // Use Promise.all to run saves in parallel
  const results = await Promise.all([
    // Master data (onConflict on 'name' which must be unique)
    supabase.from('expense_categories').upsert(toObjects(expenseCategories), { onConflict: 'name' }),
    supabase.from('suppliers').upsert(toObjects(suppliers), { onConflict: 'name' }),
    supabase.from('items').upsert(toObjects(items), { onConflict: 'name' }),
    supabase.from('customers').upsert(toObjects(customers), { onConflict: 'name' }),
    supabase.from('owners').upsert(toObjects(owners), { onConflict: 'name' }),

    // Transactional data (onConflict on 'id')
    supabase.from('entries').upsert(entries, { onConflict: 'id' }),
    supabase.from('purchases').upsert(purchases, { onConflict: 'id' }),
    supabase.from('expenses').upsert(expenses, { onConflict: 'id' }),
    supabase.from('cheques').upsert(cheques, { onConflict: 'id' }),
  ]);

  const errors = results.map(({ error }) => error).filter(Boolean);
  if (errors.length > 0) {
    errors.forEach(error => console.error('Error saving data:', error));
    throw new Error('One or more saves to Supabase failed.');
  }
  
  console.log('Data saved successfully to Supabase.');
}

/**
 * Deletes all records from all application tables in Supabase.
 * This is a destructive operation.
 */
async function clearAllSupabaseData() {
    console.warn('DESTRUCTIVE ACTION: Clearing all data from Supabase...');
    const tables = ['entries', 'purchases', 'expenses', 'cheques', 'owners', 'customers', 'items', 'suppliers', 'expense_categories'];
    
    const results = await Promise.all(
        tables.map(table => supabase.from(table).delete().neq('id', -1)) // A condition to delete all rows
    );

    const errors = results.map(({ error }) => error).filter(Boolean);
    if (errors.length > 0) {
        errors.forEach(error => console.error('Error clearing table:', error));
        throw new Error('One or more tables could not be cleared.');
    }
    console.log('All Supabase tables have been cleared.');
}