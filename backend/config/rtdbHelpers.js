const { admin, rtdb } = require('./firebaseAdmin');

/**
 * Realtime Database Helper Functions
 * Provides utilities for common RTDB operations
 */

/**
 * Emulate a "get all" like Firestore
 * Returns array of {id, ...data}
 */
async function getAllRecords(path) {
  if (!rtdb) throw new Error('Realtime Database not initialized');
  try {
    const snapshot = await rtdb.ref(path).once('value');
    const data = snapshot.val();
    if (!data || typeof data !== 'object') return [];
    
    return Object.entries(data).map(([id, value]) => ({
      id,
      ...value
    }));
  } catch (err) {
    console.error(`Error getting all records from ${path}:`, err);
    throw err;
  }
}

/**
 * Get a single record by ID
 */
async function getRecord(path, id) {
  if (!rtdb) throw new Error('Realtime Database not initialized');
  try {
    const snapshot = await rtdb.ref(`${path}/${id}`).once('value');
    if (!snapshot.exists()) return null;
    return { id, ...snapshot.val() };
  } catch (err) {
    console.error(`Error getting record from ${path}/${id}:`, err);
    throw err;
  }
}

/**
 * Add a new record and return the key
 */
async function addRecord(path, data) {
  if (!rtdb) throw new Error('Realtime Database not initialized');
  try {
    const ref = rtdb.ref(path).push();
    await ref.set({
      ...data,
      createdAt: admin.database.ServerValue.TIMESTAMP
    });
    return ref.key;
  } catch (err) {
    console.error(`Error adding record to ${path}:`, err);
    throw err;
  }
}

/**
 * Update a record
 */
async function updateRecord(path, id, data) {
  if (!rtdb) throw new Error('Realtime Database not initialized');
  try {
    await rtdb.ref(`${path}/${id}`).update({
      ...data,
      updatedAt: admin.database.ServerValue.TIMESTAMP
    });
  } catch (err) {
    console.error(`Error updating record at ${path}/${id}:`, err);
    throw err;
  }
}

/**
 * Set a record (overwrites)
 */
async function setRecord(path, id, data) {
  if (!rtdb) throw new Error('Realtime Database not initialized');
  try {
    await rtdb.ref(`${path}/${id}`).set({
      ...data,
      createdAt: data.createdAt || admin.database.ServerValue.TIMESTAMP,
      updatedAt: admin.database.ServerValue.TIMESTAMP
    });
  } catch (err) {
    console.error(`Error setting record at ${path}/${id}:`, err);
    throw err;
  }
}

/**
 * Delete a record
 */
async function deleteRecord(path, id) {
  if (!rtdb) throw new Error('Realtime Database not initialized');
  try {
    await rtdb.ref(`${path}/${id}`).remove();
  } catch (err) {
    console.error(`Error deleting record at ${path}/${id}:`, err);
    throw err;
  }
}

/**
 * Find records by filtering locally
 * Useful for queries like .where('email', '==', value)
 */
async function findRecordsByField(path, fieldName, value) {
  if (!rtdb) throw new Error('Realtime Database not initialized');
  try {
    const allRecords = await getAllRecords(path);
    return allRecords.filter(record => String(record[fieldName]) === String(value));
  } catch (err) {
    console.error(`Error finding records by field ${fieldName} in ${path}:`, err);
    throw err;
  }
}

/**
 * Find a single record by field
 */
async function findRecordByField(path, fieldName, value) {
  if (!rtdb) throw new Error('Realtime Database not initialized');
  try {
    const records = await findRecordsByField(path, fieldName, value);
    return records.length > 0 ? records[0] : null;
  } catch (err) {
    console.error(`Error finding record by field ${fieldName} in ${path}:`, err);
    throw err;
  }
}

/**
 * Get child records (like subcollections in Firestore)
 * e.g., getChildRecords('conversation/convId', 'messages')
 */
async function getChildRecords(parentPath, childName) {
  if (!rtdb) throw new Error('Realtime Database not initialized');
  try {
    const path = `${parentPath}/${childName}`;
    const snapshot = await rtdb.ref(path).once('value');
    const data = snapshot.val();
    if (!data || typeof data !== 'object') return [];
    
    return Object.entries(data).map(([id, value]) => ({
      id,
      ...value
    }));
  } catch (err) {
    console.error(`Error getting child records from ${parentPath}/${childName}:`, err);
    throw err;
  }
}

/**
 * Add a child record
 */
async function addChildRecord(parentPath, childName, data) {
  if (!rtdb) throw new Error('Realtime Database not initialized');
  try {
    const ref = rtdb.ref(`${parentPath}/${childName}`).push();
    await ref.set({
      ...data,
      createdAt: admin.database.ServerValue.TIMESTAMP
    });
    return ref.key;
  } catch (err) {
    console.error(`Error adding child record to ${parentPath}/${childName}:`, err);
    throw err;
  }
}

/**
 * Update a child record
 */
async function updateChildRecord(parentPath, childName, id, data) {
  if (!rtdb) throw new Error('Realtime Database not initialized');
  try {
    await rtdb.ref(`${parentPath}/${childName}/${id}`).update({
      ...data,
      updatedAt: admin.database.ServerValue.TIMESTAMP
    });
  } catch (err) {
    console.error(`Error updating child record at ${parentPath}/${childName}/${id}:`, err);
    throw err;
  }
}

/**
 * Delete a child record
 */
async function deleteChildRecord(parentPath, childName, id) {
  if (!rtdb) throw new Error('Realtime Database not initialized');
  try {
    await rtdb.ref(`${parentPath}/${childName}/${id}`).remove();
  } catch (err) {
    console.error(`Error deleting child record at ${parentPath}/${childName}/${id}:`, err);
    throw err;
  }
}

/**
 * Convert timestamp to milliseconds
 */
function millisFromRTDB(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp === 'number') return timestamp;
  if (typeof timestamp === 'object' && timestamp.getTime) return timestamp.getTime();
  try {
    return new Date(timestamp).getTime();
  } catch (e) {
    return null;
  }
}

module.exports = {
  getAllRecords,
  getRecord,
  addRecord,
  updateRecord,
  setRecord,
  deleteRecord,
  findRecordsByField,
  findRecordByField,
  getChildRecords,
  addChildRecord,
  updateChildRecord,
  deleteChildRecord,
  millisFromRTDB,
  rtdb,
  admin
};
