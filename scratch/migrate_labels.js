const path = require('path');
module.paths.push(path.join(__dirname, '../server/node_modules'));
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
const mongoose = require('mongoose');

const Lead = require('../server/models/Lead');
const Call = require('../server/models/Call');
const EventRecord = require('../server/models/EventRecord');
const TssRecord = require('../server/models/TssRecord');

async function migrate() {
  console.log('🚀 Connecting to MongoDB...');
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in env!');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB.');

  const models = [
    { name: 'Lead', model: Lead, isTss: false },
    { name: 'Call', model: Call, isTss: false },
    { name: 'EventRecord', model: EventRecord, isTss: false },
    { name: 'TssRecord', model: TssRecord, isTss: true }
  ];

  const removedLabels = ['Interested', 'Not Interested', 'Hot Lead', 'Cold Lead', 'Hot Call', 'Cold Call'];

  for (const { name, model, isTss } of models) {
    console.log(`\n⏳ Migrating ${name} collection...`);

    // 1. Migrate Completed/Closed labels to Closed
    // Find all records where labels contain Completed
    const completedRes = await model.updateMany(
      { labels: 'Completed' },
      { 
        $set: { 
          'labels.$': 'Closed',
          status: 'Closed',
          ...(isTss ? {} : { isConverted: true })
        } 
      }
    );
    console.log(`  - Migrated Completed labels to Closed: ${completedRes.modifiedCount} records.`);

    // 2. Ensure all existing Closed records have the correct status and isConverted values as per plan
    if (!isTss) {
      const closedRes = await model.updateMany(
        { labels: 'Closed' },
        {
          $set: {
            status: 'Closed',
            isConverted: true
          }
        }
      );
      console.log(`  - Aligned existing Closed records: ${closedRes.modifiedCount} records.`);
    } else {
      const closedRes = await model.updateMany(
        { labels: 'Closed' },
        { $set: { status: 'Closed' } }
      );
      console.log(`  - Aligned existing Closed TSS records: ${closedRes.modifiedCount} records.`);
    }

    // 3. Migrate removed labels (Interested, Not Interested, Hot Call, Cold Call, etc.) to Open
    for (const oldLabel of removedLabels) {
      const oldRes = await model.updateMany(
        { labels: oldLabel },
        { 
          $set: { 
            'labels.$': 'Open',
            status: 'Open',
            ...(isTss ? {} : { isConverted: false })
          } 
        }
      );
      if (oldRes.modifiedCount > 0) {
        console.log(`  - Migrated label "${oldLabel}" to "Open": ${oldRes.modifiedCount} records.`);
      }
    }

    // 4. Fallback: Clean up any empty labels array or sync mismatch
    const fallbackRes = await model.updateMany(
      { labels: { $size: 0 } },
      { 
        $set: { 
          labels: ['Open'],
          status: 'Open',
          ...(isTss ? {} : { isConverted: false })
        } 
      }
    );
    if (fallbackRes.modifiedCount > 0) {
      console.log(`  - Cleaned up records with empty labels: ${fallbackRes.modifiedCount} records.`);
    }
  }

  console.log('\n🎉 Migration completed successfully!');
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  mongoose.disconnect();
});
