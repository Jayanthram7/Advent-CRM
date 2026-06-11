const fs = require('fs');
const path = require('path');

const BACKEND_URL = 'http://localhost:5000';

async function runTests() {
  console.log('🚀 Starting integration test for Events...');

  try {
    // 1. Login to get token
    console.log('\n🔑 Logging in...');
    const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'jayanthramnithin@gmail.com',
        password: '181104'
      })
    });

    if (!loginRes.ok) {
      const errText = await loginRes.text();
      throw new Error(`Login failed (${loginRes.status}): ${errText}`);
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('✅ Logged in successfully!');

    // Helper fetch with Auth header
    const authFetch = async (url, options = {}) => {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      };
      return fetch(`${BACKEND_URL}${url}`, { ...options, headers });
    };

    // 2. Parse sample_event.csv
    console.log('\n📄 Parsing sample_event.csv...');
    const csvPath = path.join(__dirname, '..', 'sample_event.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      records.push(row);
    }
    console.log(`Parsed ${records.length} records from CSV.`);

    // 3. Post to /api/events/import
    console.log('\n📤 Importing dataset "TechExpo 2026"...');
    const importRes = await authFetch('/api/events/import', {
      method: 'POST',
      body: JSON.stringify({
        name: 'TechExpo 2026',
        records
      })
    });

    if (!importRes.ok) {
      const errText = await importRes.text();
      throw new Error(`Import failed (${importRes.status}): ${errText}`);
    }

    const importData = await importRes.json();
    console.log('✅ Import response:', JSON.stringify(importData, null, 2));

    // 4. Fetch all datasets to verify
    console.log('\n📂 Fetching event datasets...');
    const datasetsRes = await authFetch('/api/events/datasets');
    if (!datasetsRes.ok) throw new Error('Failed to fetch datasets');
    const datasets = await datasetsRes.json();
    console.log(`Found ${datasets.length} datasets.`);
    
    const testDataset = datasets.find(d => d.name === 'TechExpo 2026');
    if (!testDataset) throw new Error('Created dataset "TechExpo 2026" not found in datasets list!');
    console.log(`✅ TechExpo 2026 dataset found with ID: ${testDataset._id}`);

    // 5. Fetch records for the dataset
    console.log('\n📋 Fetching records for dataset...');
    const recordsRes = await authFetch(`/api/events/datasets/${testDataset._id}/records`);
    if (!recordsRes.ok) throw new Error('Failed to fetch records');
    const recordsData = await recordsRes.json();
    const importedRecords = recordsData.records || recordsData; // support both response formats

    console.log(`Found ${importedRecords.length} records in dataset.`);
    if (importedRecords.length !== 4) {
      throw new Error(`Expected exactly 4 records, but got ${importedRecords.length}`);
    }

    // 6. Verify hall/stall rendering details
    const acme = importedRecords.find(r => r.companyName === 'Acme Corp');
    const beta = importedRecords.find(r => r.companyName === 'Beta Industries');
    const delta = importedRecords.find(r => r.companyName === 'Delta Ltd');
    const omega = importedRecords.find(r => r.companyName === 'Omega LLC');

    if (!acme || acme.hallNumber !== '1' || acme.stallNumber !== 'A-101') {
      throw new Error(`Acme Corp record incorrect: ${JSON.stringify(acme)}`);
    }
    console.log('✅ Acme Corp has correct Hall: 1, Stall: A-101');

    if (!beta || beta.hallNumber !== '2' || beta.stallNumber !== '') {
      throw new Error(`Beta Industries record incorrect: ${JSON.stringify(beta)}`);
    }
    console.log('✅ Beta Industries has correct Hall: 2, Stall: "" (empty)');

    if (!delta || delta.hallNumber !== '' || delta.stallNumber !== 'B-202') {
      throw new Error(`Delta Ltd record incorrect: ${JSON.stringify(delta)}`);
    }
    console.log('✅ Delta Ltd has correct Hall: "" (empty), Stall: B-202');

    if (!omega || omega.hallNumber !== '' || omega.stallNumber !== '') {
      throw new Error(`Omega LLC record incorrect: ${JSON.stringify(omega)}`);
    }
    console.log('✅ Omega LLC has correct Hall: "" (empty), Stall: "" (empty)');

    // 7. Add a note to Acme Corp record
    console.log('\n📝 Adding a note to Acme Corp...');
    const noteRes = await authFetch(`/api/events/records/${acme._id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content: 'Spoke with CEO John Doe. Interested in pricing.' })
    });

    if (!noteRes.ok) throw new Error('Failed to create note');
    console.log('✅ Note added successfully!');

    // 8. Fetch notes to verify
    console.log('\n🔍 Fetching notes for Acme Corp...');
    const getNotesRes = await authFetch(`/api/events/records/${acme._id}/notes`);
    if (!getNotesRes.ok) throw new Error('Failed to fetch notes');
    const notes = await getNotesRes.json();
    console.log(`Found ${notes.length} note(s).`);
    if (notes[0].content !== 'Spoke with CEO John Doe. Interested in pricing.') {
      throw new Error(`Note content mismatch: ${JSON.stringify(notes[0])}`);
    }
    console.log('✅ Note content matches.');

    // 9. Fetch activities to verify timeline
    console.log('\n📈 Fetching activity timeline for Acme Corp...');
    const activitiesRes = await authFetch(`/api/events/records/${acme._id}/activities`);
    if (!activitiesRes.ok) throw new Error('Failed to fetch activities');
    const activities = await activitiesRes.json();
    console.log(`Found ${activities.length} activity logs.`);
    
    // We expect a Creation activity and a Note activity
    const creationAct = activities.find(a => a.type === 'Creation');
    const noteAct = activities.find(a => a.type === 'Note');

    if (!creationAct) throw new Error('Missing Creation activity log');
    if (!noteAct) throw new Error('Missing Note activity log');
    console.log('✅ Activity timeline logged successfully!');

    // 10. Delete the entire dataset and verify
    console.log('\n🗑️ Deleting the entire event dataset...');
    const deleteRes = await authFetch(`/api/events/datasets/${testDataset._id}`, {
      method: 'DELETE'
    });
    if (!deleteRes.ok) throw new Error('Failed to delete dataset');
    console.log('✅ Dataset delete response received.');

    // Verify dataset is gone
    const verifyDatasetsRes = await authFetch('/api/events/datasets');
    const verifyDatasets = await verifyDatasetsRes.json();
    const foundDataset = verifyDatasets.find(d => d._id === testDataset._id);
    if (foundDataset) throw new Error('Dataset still exists in DB after deletion');
    console.log('✅ Dataset successfully removed from DB list!');

    // Verify records are gone
    const verifyRecordsRes = await authFetch(`/api/events/datasets/${testDataset._id}/records`);
    const verifyRecords = await verifyRecordsRes.json();
    const remainingRecords = verifyRecords.records || verifyRecords;
    if (remainingRecords.length > 0) {
      throw new Error(`Records still exist in DB for deleted dataset: ${remainingRecords.length} records found`);
    }
    console.log('✅ All associated records successfully cascade-deleted from DB!');

    console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (err) {
    console.error('\n❌ Test failed with error:', err.message);
    process.exit(1);
  }
}

runTests();
