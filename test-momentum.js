/**
 * Test script for momentum analysis
 * Run with: node test-momentum.js
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  console.error('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🔍 Checking database state...\n');

  // 1. Check projects
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name, signal_instructions')
    .limit(5);

  if (projectsError) {
    console.error('Error fetching projects:', projectsError);
    return;
  }

  console.log(`📁 Found ${projects.length} projects:`);
  projects.forEach((p) => {
    console.log(`   - ${p.name} (${p.id})`);
  });
  console.log();

  if (projects.length === 0) {
    console.log('❌ No projects found. Please create a project first.');
    return;
  }

  const testProjectId = projects[0].id;
  console.log(`✅ Using project: ${projects[0].name} (${testProjectId})\n`);

  // 2. Check raw ingestions
  const { data: ingestions, error: ingestionsError } = await supabase
    .from('raw_ingestions')
    .select('id, created_at, processed, sources!inner(project_id)')
    .eq('sources.project_id', testProjectId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (ingestionsError) {
    console.log('⚠️  Error fetching ingestions:', ingestionsError.message);
    console.log('   This might be OK if the table structure is different\n');
  } else if (ingestions) {
    console.log(`📥 Found ${ingestions.length} ingestions for this project`);
    if (ingestions.length > 0) {
      const processed = ingestions.filter((i) => i.processed).length;
      const unprocessed = ingestions.length - processed;
      console.log(`   - Processed: ${processed}`);
      console.log(`   - Unprocessed: ${unprocessed}`);
    }
    console.log();
  }

  // 3. Check signals
  const { data: signals, error: signalsError } = await supabase
    .from('signals')
    .select('id, headline, status, momentum, detected_at')
    .eq('project_id', testProjectId)
    .order('detected_at', { ascending: false });

  if (signalsError) {
    console.error('Error fetching signals:', signalsError);
    return;
  }

  console.log(`🚨 Found ${signals.length} signals:`);
  signals.forEach((s) => {
    const age = Math.round((Date.now() - new Date(s.detected_at).getTime()) / (1000 * 60 * 60));
    console.log(`   - ${s.headline.substring(0, 50)}...`);
    console.log(`     Status: ${s.status} | Momentum: ${s.momentum} | Age: ${age}h`);
  });
  console.log();

  // 4. Test endpoints
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = 'http://localhost:3000';

  if (!cronSecret) {
    console.log('⚠️  CRON_SECRET not found in .env.local');
    console.log('You can still test manually with user auth\n');
    console.log('Test commands:');
    console.log(`
curl -X POST ${baseUrl}/api/analysis/analyze-momentum \\
  -H "Authorization: Bearer YOUR_CRON_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"projectId": "${testProjectId}"}'

curl -X POST ${baseUrl}/api/analysis/run \\
  -H "Authorization: Bearer YOUR_CRON_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"projectId": "${testProjectId}"}'
    `);
    return;
  }

  console.log('🧪 Testing endpoints...\n');

  // Test 1: Momentum Analysis
  console.log('1️⃣  Testing /api/analysis/analyze-momentum');
  try {
    const response = await fetch(`${baseUrl}/api/analysis/analyze-momentum`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ projectId: testProjectId }),
    });

    const result = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Signals analyzed: ${result.signals_analyzed}`);
    console.log(`   Signals updated: ${result.signals_updated}`);
    console.log(`   Signals unchanged: ${result.signals_unchanged}`);
    console.log(`   Token usage: ${result.token_usage?.total_tokens || 0} tokens`);
    console.log(`   Cost: $${result.token_usage?.estimated_cost?.toFixed(6) || 0}`);
    console.log(`   Notes: ${result.analysis_notes}`);

    if (result.updated_signals && result.updated_signals.length > 0) {
      console.log('\n   Updated signals:');
      result.updated_signals.forEach((s) => {
        console.log(`   - ${s.headline}`);
        console.log(`     ${s.old_status}/${s.old_momentum} → ${s.new_status}/${s.new_momentum}`);
        console.log(`     Reason: ${s.reason}`);
      });
    }
  } catch (error) {
    console.error('   Error:', error.message);
  }

  console.log('\n2️⃣  Testing /api/analysis/run (full pipeline)');
  try {
    const response = await fetch(`${baseUrl}/api/analysis/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ projectId: testProjectId }),
    });

    const result = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${result.success}`);
    console.log('\n   Signal Detection:');
    console.log(`   - New signals: ${result.new_signals?.count || 0}`);
    console.log(`   - Ingestions analyzed: ${result.new_signals?.ingestions_analyzed || 0}`);
    console.log('\n   Momentum Updates:');
    console.log(`   - Signals updated: ${result.momentum_updates?.count || 0}`);
    console.log(`   - Signals unchanged: ${result.momentum_updates?.unchanged_count || 0}`);
    console.log('\n   Token Usage:');
    console.log(`   - Detection: ${result.token_usage?.detection?.total_tokens || 0} tokens`);
    console.log(`   - Momentum: ${result.token_usage?.momentum?.total_tokens || 0} tokens`);
    console.log(`   - Total: ${result.token_usage?.total?.total_tokens || 0} tokens`);
    console.log(`   - Total Cost: $${result.token_usage?.total?.estimated_cost?.toFixed(6) || 0}`);

    if (result.error) {
      console.log(`\n   ⚠️  Errors: ${result.error}`);
    }
  } catch (error) {
    console.error('   Error:', error.message);
  }

  console.log('\n✅ Testing complete!');
}

main().catch(console.error);
