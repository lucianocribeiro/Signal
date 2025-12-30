/**
 * Setup test data for momentum analysis testing
 * Run AFTER applying the schema: node setup-test-data.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupTestData() {
  console.log('🚀 Setting up test data for momentum analysis...\n');

  try {
    // Get existing user for ownership
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    let userId = null;

    if (!userError && user) {
      userId = user.id;
    } else {
      // Try to get first user from user_profiles
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1)
        .single();

      if (profiles) {
        userId = profiles.id;
      }
    }

    if (!userId) {
      console.log('⚠️  No user found. Creating a test user profile...');

      // Create a test user in auth.users first (this would normally be done by Supabase Auth)
      // For testing, we'll create the profile directly with a UUID
      const testUserId = '00000000-0000-0000-0000-000000000001';

      // Try to create user profile (will fail if auth.users entry doesn't exist)
      // So instead, let's query for ANY existing user
      const { data: existingUsers } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1);

      if (existingUsers && existingUsers.length > 0) {
        userId = existingUsers[0].id;
        console.log(`   ✅ Using existing user: ${userId}`);
      } else {
        console.log('\n❌ No users found in database.');
        console.log('Please create a user first by:');
        console.log('1. Going to Supabase Dashboard → Authentication → Users');
        console.log('2. Click "Add User" → Enter email & password');
        console.log('3. Then run this script again\n');
        return;
      }
    }

    console.log(`👤 Using user ID: ${userId}\n`);

    // 1. Create test project
    console.log('1️⃣  Creating test project...');
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: 'Momentum Test Project',
        description: 'Test project for Epic 4.3 momentum analysis',
        owner_id: userId,
        signal_instructions: 'Detectar narrativas sobre elecciones presidenciales, crisis económica, y escándalos políticos.',
      })
      .select()
      .single();

    if (projectError) {
      console.error('Error creating project:', projectError);
      return;
    }

    console.log(`   ✅ Created project: ${project.name} (${project.id})\n`);

    // 2. Create test source
    console.log('2️⃣  Creating test source...');
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .insert({
        project_id: project.id,
        name: 'Test News Source',
        source_type: 'web_scraper',
        url: 'https://test-news.com',
        platform: 'news',
        is_active: true,
      })
      .select()
      .single();

    if (sourceError) {
      console.error('Error creating source:', sourceError);
      return;
    }

    console.log(`   ✅ Created source: ${source.name} (${source.id})\n`);

    // 3. Create raw ingestions (mix of old and recent)
    console.log('3️⃣  Creating raw ingestions...');

    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    const ingestions = [
      {
        source_id: source.id,
        raw_data: {
          title: 'Escándalo político domina las redes',
          text: 'El escándalo de corrupción sigue generando reacciones en redes sociales. Múltiples figuras políticas han sido mencionadas.',
          url: 'https://test-news.com/articulo-1',
          wordCount: 150,
          platform: 'news',
        },
        ingested_at: twoDaysAgo.toISOString(),
        processed: true,
        processed_at: twoDaysAgo.toISOString(),
        metadata: { contentHash: 'hash1' },
      },
      {
        source_id: source.id,
        raw_data: {
          title: 'Crisis económica: nuevas medidas anunciadas',
          text: 'El gobierno anuncia medidas de emergencia ante la crisis económica. Los ciudadanos expresan preocupación.',
          url: 'https://test-news.com/articulo-2',
          wordCount: 120,
          platform: 'news',
        },
        ingested_at: oneDayAgo.toISOString(),
        processed: true,
        processed_at: oneDayAgo.toISOString(),
        metadata: { contentHash: 'hash2' },
      },
      {
        source_id: source.id,
        raw_data: {
          title: 'Escándalo se intensifica: nuevas revelaciones',
          text: 'Nuevas pruebas emergen en el caso de corrupción. La investigación se expande. Más políticos están bajo investigación. El tema se vuelve viral en redes sociales.',
          url: 'https://test-news.com/articulo-3',
          wordCount: 200,
          platform: 'news',
        },
        ingested_at: sixHoursAgo.toISOString(),
        processed: false, // New unprocessed content
        metadata: { contentHash: 'hash3' },
      },
      {
        source_id: source.id,
        raw_data: {
          title: 'Candidato presidencial gana terreno',
          text: 'Encuestas muestran que el candidato de la oposición está ganando popularidad. Las elecciones presidenciales se acercan.',
          url: 'https://test-news.com/articulo-4',
          wordCount: 180,
          platform: 'news',
        },
        ingested_at: sixHoursAgo.toISOString(),
        processed: false, // New unprocessed content
        metadata: { contentHash: 'hash4' },
      },
    ];

    const { error: ingestionsError } = await supabase
      .from('raw_ingestions')
      .insert(ingestions);

    if (ingestionsError) {
      console.error('Error creating ingestions:', ingestionsError);
      return;
    }

    console.log(`   ✅ Created ${ingestions.length} raw ingestions\n`);

    // 4. Create test signals (various ages and statuses)
    console.log('4️⃣  Creating test signals...');

    const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    const signals = [
      {
        project_id: project.id,
        source_id: source.id,
        headline: 'Escándalo de corrupción en el gobierno',
        summary: 'Múltiples funcionarios están siendo investigados por presunta corrupción. El caso está ganando atención mediática.',
        status: 'New',
        momentum: 'medium',
        tags: ['corrupción', 'gobierno', 'investigación'],
        detected_at: threeDaysAgo.toISOString(), // Old enough for momentum analysis
        metadata: {
          raw_ingestion_ids: ['dummy-id-1'],
          sources: ['https://test-news.com/articulo-1'],
          ai_model: 'gemini-1.5-flash',
        },
      },
      {
        project_id: project.id,
        source_id: source.id,
        headline: 'Crisis económica preocupa a ciudadanos',
        summary: 'La situación económica continúa deteriorándose. El gobierno busca soluciones urgentes.',
        status: 'Accelerating',
        momentum: 'high',
        tags: ['economía', 'crisis', 'gobierno'],
        detected_at: twoDaysAgo.toISOString(),
        metadata: {
          raw_ingestion_ids: ['dummy-id-2'],
          sources: ['https://test-news.com/articulo-2'],
          ai_model: 'gemini-1.5-flash',
        },
      },
      {
        project_id: project.id,
        source_id: source.id,
        headline: 'Elecciones presidenciales: panorama electoral',
        summary: 'Los candidatos presidenciales intensifican sus campañas. Las encuestas muestran una carrera reñida.',
        status: 'Stabilizing',
        momentum: 'medium',
        tags: ['elecciones', 'presidencial', 'campaña'],
        detected_at: threeDaysAgo.toISOString(),
        metadata: {
          raw_ingestion_ids: ['dummy-id-3'],
          sources: ['https://test-news.com'],
          ai_model: 'gemini-1.5-flash',
        },
      },
    ];

    const { data: createdSignals, error: signalsError } = await supabase
      .from('signals')
      .insert(signals)
      .select();

    if (signalsError) {
      console.error('Error creating signals:', signalsError);
      return;
    }

    console.log(`   ✅ Created ${createdSignals.length} test signals\n`);

    // Summary
    console.log('✅ Test data setup complete!\n');
    console.log('📊 Summary:');
    console.log(`   - Project: ${project.name}`);
    console.log(`   - Project ID: ${project.id}`);
    console.log(`   - Signals: ${createdSignals.length} (ages: 72h, 48h, 72h)`);
    console.log(`   - Raw Ingestions: ${ingestions.length} (2 processed, 2 unprocessed)\n`);

    console.log('🧪 Ready to test! Run:');
    console.log(`   node test-momentum.js\n`);
    console.log('Or test endpoints directly:');
    console.log(`
curl -X POST http://localhost:3000/api/analysis/run \\
  -H "Authorization: Bearer ${process.env.CRON_SECRET}" \\
  -H "Content-Type: application/json" \\
  -d '{"projectId": "${project.id}"}'
    `);

    return project.id;
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

setupTestData().catch(console.error);
