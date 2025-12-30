/**
 * Check actual database schema
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('🔍 Checking actual database schema...\n');

  // Check signals table
  console.log('📊 SIGNALS TABLE:');
  const { data: signals, error: signalsError } = await supabase
    .from('signals')
    .select('*')
    .limit(1);

  if (signalsError) {
    console.log('Error:', signalsError.message);
  } else if (signals && signals.length > 0) {
    console.log('Columns:', Object.keys(signals[0]).join(', '));
  } else {
    console.log('No data in table to check columns');
  }

  // Check raw_ingestions table
  console.log('\n📥 RAW_INGESTIONS TABLE:');
  const { data: ingestions, error: ingestionsError } = await supabase
    .from('raw_ingestions')
    .select('*')
    .limit(1);

  if (ingestionsError) {
    console.log('Error:', ingestionsError.message);
  } else if (ingestions && ingestions.length > 0) {
    console.log('Columns:', Object.keys(ingestions[0]).join(', '));
  } else {
    console.log('No data in table to check columns');
  }

  // Check projects table
  console.log('\n📁 PROJECTS TABLE:');
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .limit(1);

  if (projectsError) {
    console.log('Error:', projectsError.message);
  } else if (projects && projects.length > 0) {
    console.log('Columns:', Object.keys(projects[0]).join(', '));
  } else {
    console.log('No data in table to check columns');
  }
}

checkSchema().catch(console.error);
