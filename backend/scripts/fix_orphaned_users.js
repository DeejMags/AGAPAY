const { admin, db } = require('../config/firebaseAdmin');
const { buildUserNameData } = require('../utils/nameUtils');

async function fixOrphanedUsers() {
  try {
    console.log('🔍 Finding orphaned users (missing email and name fields)...\n');
    
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Find users with empty email and empty firstName/lastName
    const orphaned = users.filter(u => 
      !u.email && 
      (!u.firstName || u.firstName === '') && 
      (!u.lastName || u.lastName === '')
    );
    
    if (orphaned.length === 0) {
      console.log('✅ No orphaned users found!');
      process.exit(0);
    }
    
    console.log(`📋 Found ${orphaned.length} orphaned users:\n`);
    orphaned.forEach(u => console.log(`  - ${u.id}`));
    console.log('\n');
    
    let fixed = 0;
    let deleted = 0;
    
    for (const user of orphaned) {
      try {
        // Try to get Firebase Auth user
        let authUser;
        try {
          authUser = await admin.auth().getUser(user.id);
        } catch (e) {
          if (e.code === 'auth/user-not-found') {
            authUser = null;
          } else {
            throw e;
          }
        }
        
        if (!authUser) {
          // No Firebase Auth record - delete the orphaned Firestore profile
          console.log(`🗑️  Deleting orphaned user (no Firebase Auth): ${user.id}`);
          await db.collection('users').doc(user.id).delete();
          deleted++;
          continue;
        }
        
        // Firebase Auth record exists - populate from it
        const nameData = buildUserNameData({
          name: authUser.displayName,
          email: authUser.email,
          firstName: user.firstName,
          lastName: user.lastName,
        });
        
        const updates = {
          email: authUser.email || '',
          firstName: nameData.firstName || '',
          lastName: nameData.lastName || '',
          fullName: nameData.fullName || authUser.displayName || authUser.email.split('@')[0],
          displayName: nameData.displayName || authUser.displayName || authUser.email.split('@')[0],
          username: nameData.username || authUser.displayName || authUser.email.split('@')[0],
          name: nameData.fullName || authUser.displayName || authUser.email.split('@')[0],
          updatedAt: new Date(),
        };
        
        console.log(`✅ Fixed orphaned user: ${user.id}`);
        console.log(`   Email: ${updates.email}`);
        console.log(`   Name: ${updates.fullName}\n`);
        
        await db.collection('users').doc(user.id).update(updates);
        fixed++;
        
      } catch (err) {
        console.error(`❌ Error processing ${user.id}:`, err.message);
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   🗑️  Deleted: ${deleted}`);
    console.log(`   📋 Total processed: ${fixed + deleted}\n`);
    
    process.exit(0);
    
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

fixOrphanedUsers();
