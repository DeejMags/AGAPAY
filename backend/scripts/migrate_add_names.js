/**
 * Migration script to add firstName and lastName to existing user documents
 * Run: node scripts/migrate_add_names.js
 */
const { admin, db } = require('../config/firebaseAdmin');
const { buildUserNameData, splitName } = require('../utils/nameUtils');

// Better email parsing: extract meaningful parts
function extractNamesFromEmail(email) {
  if (!email) return { firstName: '', lastName: '' };
  
  const localPart = email.split('@')[0].toLowerCase();
  // Replace common separators with spaces
  const readable = localPart.replace(/[._-]+/g, ' ').trim();
  
  // Split into parts
  const parts = readable.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) {
    // For single-part emails like "john", capitalize
    return {
      firstName: parts[0].charAt(0).toUpperCase() + parts[0].slice(1),
      lastName: ''
    };
  }
  
  // For multi-part emails like "john doe", capitalize each
  return {
    firstName: parts[0].charAt(0).toUpperCase() + parts[0].slice(1),
    lastName: parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
  };
}

async function migrateUsers() {
  try {
    console.log('Starting user name migration...\n');
    const snapshot = await db.collection('users').get();
    
    if (snapshot.empty) {
      console.log('No users found');
      return;
    }

    console.log(`Found ${snapshot.size} users to migrate\n`);
    let updated = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
      const user = doc.data();
      
      // Skip if already has real firstName/lastName (not empty)
      if (user.firstName && user.firstName.trim() && user.lastName && user.lastName.trim()) {
        console.log(`✓ ${doc.id}: Already has names "${user.firstName} ${user.lastName}", skipping`);
        skipped++;
        continue;
      }

      // Try to extract from existing fullName/displayName first
      let extractedFirst = '';
      let extractedLast = '';

      if (user.fullName && user.fullName.trim()) {
        const split = splitName(user.fullName);
        extractedFirst = split.firstName;
        extractedLast = split.lastName;
      } else if (user.displayName && user.displayName.trim()) {
        const split = splitName(user.displayName);
        extractedFirst = split.firstName;
        extractedLast = split.lastName;
      } else if (user.name && user.name.trim()) {
        const split = splitName(user.name);
        extractedFirst = split.firstName;
        extractedLast = split.lastName;
      } else {
        // Last resort: extract from email
        const emailExtract = extractNamesFromEmail(user.email);
        extractedFirst = emailExtract.firstName;
        extractedLast = emailExtract.lastName;
      }

      // Build full nameData for consistency
      const nameData = buildUserNameData({
        firstName: extractedFirst,
        lastName: extractedLast,
        email: user.email,
      });

      // Update document with new name fields
      const updatePayload = {
        firstName: nameData.firstName || '',
        lastName: nameData.lastName || '',
        fullName: nameData.fullName || '',
        displayName: nameData.displayName || '',
        username: nameData.username || '',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await doc.ref.set(updatePayload, { merge: true });

      console.log(`✓ Updated ${doc.id}:`);
      console.log(`  → firstName: "${nameData.firstName}"`);
      console.log(`  → lastName: "${nameData.lastName}"`);
      console.log(`  → fullName: "${nameData.fullName}"\n`);
      updated++;
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`- Updated: ${updated}`);
    console.log(`- Skipped: ${skipped}`);
    console.log(`- Total: ${snapshot.size}`);
    
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrateUsers();
