// controllers/productController.js
const { admin, db } = require('../config/firebaseAdmin');
const nodemailer = require('nodemailer');
const cloudinary = require('../config/cloudinary');
const { evaluateBadgeProgress, badgeLabelFromTier } = require('../config/badges');

// Create a nodemailer transporter if SMTP env vars are present
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendNotificationEmail(to, subject, text, html) {
  if (!to) return;
  if (!transporter) {
    console.log('Email not sent (no transporter). To:', to, 'Subject:', subject, 'Text:', text);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
    console.log('Sent notification email to', to, 'subject', subject);
  } catch (err) {
    console.error('Error sending notification email:', err);
  }
}

// Helper to parse price values (accept number, numeric string -> number, empty/null -> null)
function parsePrice(value) {
  // Treat empty-ish values as null
  if (value === null || value === undefined) return null;
  if (value === '') return null;

  // If already a valid number
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  // If it's a string, try to clean it up
  if (typeof value === 'string') {
    let s = value.trim();

    // Remove common currency symbols and spaces
    s = s.replace(/[\s\$£€₱¥₹]/g, '');

    // If there is a comma and no dot, treat comma as decimal separator
    // else remove commas as thousand separators
    if (s.includes(',') && !s.includes('.')) {
      s = s.replace(/,/g, '.');
    } else {
      s = s.replace(/,/g, '');
    }

    // Strip any characters except digits, dot, and minus
    s = s.replace(/[^0-9.\-]/g, '');

    if (s === '' || s === '.' || s === '-' || s === '-.') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  // For other types try coercion
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function currentTotalPoints(profile) {
  if (!profile || typeof profile !== 'object') return 0;
  if (profile.totalPoints !== undefined) {
    const total = Number(profile.totalPoints);
    if (Number.isFinite(total)) return total;
  }
  const sellerPoints = Number(profile.sellerPoints || 0);
  const buyerPoints = Number(profile.buyerPoints || 0);
  const miscPoints = Number(profile.points || 0);
  const total = sellerPoints + buyerPoints + miscPoints;
  return Number.isFinite(total) ? total : 0;
}

function buildBadgeNotifications(summary, role) {
  if (!summary || !Array.isArray(summary.newlyUnlocked) || summary.newlyUnlocked.length === 0) return [];
  const totalPoints = summary.totalPoints || null;
  return summary.newlyUnlocked.map((tier, index) => {
    const label = badgeLabelFromTier(tier) || (tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : `Badge ${index + 1}`);
    return {
      tier,
      label,
      role,
      totalPoints,
      type: 'unlock',
    };
  });
}

// Normalize status strings to a canonical value
// Include 'sold' so sellers can mark items as sold
const VALID_STATUSES = ['pending', 'active', 'denied', 'offline', 'sold'];
function normalizeStatus(raw) {
  if (!raw) return 'pending';
  if (typeof raw !== 'string') return 'pending';
  const parts = raw.split(/[,;|/]+/).map(p => p.trim()).filter(Boolean);
  for (const p of parts) {
    const cand = p.toLowerCase();
    if (VALID_STATUSES.includes(cand)) return cand;
  }
  const lower = raw.toLowerCase();
  for (const s of VALID_STATUSES) if (lower.includes(s)) return s;
  return 'pending';
}

// Upload a product image to Cloudinary and return a secure URL
exports.uploadImageCloudinary = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    if (!cloudinary || !process.env.CLOUDINARY_CLOUD_NAME) return res.status(500).json({ error: 'cloudinary_not_configured' });
    const folder = process.env.CLOUDINARY_FOLDER || 'agapay/products';
    const opts = { folder, resource_type: 'image', overwrite: false, transformation: [{ quality: 'auto', fetch_format: 'auto' }] };

    const { PassThrough } = require('stream');
    const stream = cloudinary.uploader.upload_stream(opts, (err, result) => {
      if (err) return res.status(500).json({ error: 'upload_failed', details: err.message });
      return res.json({ url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height, format: result.format });
    });
    if (req.file.buffer) {
      const pass = new PassThrough();
      pass.end(req.file.buffer);
      pass.pipe(stream);
    } else if (req.file.path) {
      // If using disk storage, stream file contents
      const fs = require('fs');
      const pass = new PassThrough();
      fs.createReadStream(req.file.path).pipe(stream).on('close', () => { try { fs.unlinkSync(req.file.path); } catch {} });
    } else {
      return res.status(400).json({ error: 'no_buffer' });
    }
  } catch (e) {
    console.error('cloudinary upload error', e);
    res.status(500).json({ error: 'upload_failed' });
  }
}

// ---- Points matrix helpers (configurable) ----
// Normalize category strings into one of our supported buckets
function normalizeCategory(input) {
  if (!input) return 'Others';
  const s = String(input).trim().toLowerCase();
  if (/electronic|gadget|phone|laptop|pc|tablet|camera/.test(s)) return 'Electronics';
  if (/home|living|kitchen|appliance|decor|garden|clean/.test(s)) return 'Home and Living';
  if (/furniture|sofa|table|chair|bed|cabinet|desk/.test(s)) return 'Furniture';
  if (/sport|fitness|gym|bike|bicycle|ball|racket|yoga/.test(s)) return 'Sports';
  if (/fashion|clothes|apparel|shirt|pants|dress|shoe|bag|wear/.test(s)) return 'Fashion';
  return 'Others';
}

// Default points matrix; can be overridden via env JSON (AGAPAY_POINTS_MATRIX)
// Structure: { [Category]: { seller: number, buyer: number } }
function loadPointsMatrix() {
  try {
    if (process.env.AGAPAY_POINTS_MATRIX) {
      const obj = JSON.parse(process.env.AGAPAY_POINTS_MATRIX);
      // basic shape validation
      if (obj && typeof obj === 'object') return obj;
    }
  } catch (e) {
    console.warn('Invalid AGAPAY_POINTS_MATRIX env:', e && e.message);
  }
  return {
    'Electronics': { seller: 10, buyer: 5 },
    'Home and Living': { seller: 8, buyer: 4 },
    'Furniture': { seller: 6, buyer: 6 },
    'Sports': { seller: 6, buyer: 3 },
    'Fashion': { seller: 6, buyer: 3 },
    'Others': { seller: 3, buyer: 3 },
  };
}

const POINTS_MATRIX = loadPointsMatrix();

function getPointsForCategory(category) {
  const cat = normalizeCategory(category);
  const row = POINTS_MATRIX[cat] || POINTS_MATRIX['Others'] || { seller: 0, buyer: 0 };
  return { category: cat, sellerPoints: Number(row.seller) || 0, buyerPoints: Number(row.buyer) || 0 };
}


exports.getAllProducts = async (req, res) => {
  try {
    const { status, page = 1, pageSize = 50, sortBy = 'createdAt', sortDir = 'desc', includeSeller } = req.query;
    const mine = req.query.mine === 'true';

    const isAdminRequest = !!(req.user && (req.user.role === 'admin' || req.user.isAdmin === true));
    const explicitAdmin = req.query.admin === 'true';

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 50));

 
  let q = db.collection('products');
  let snapshot;

    if (mine) {
        if (!req.user) {
        try {
          const authHeader = (req.headers && req.headers.authorization) || '';
          const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader || null;
          if (!token) return res.status(401).json({ error: 'Unauthorized' });
          const decoded = await admin.auth().verifyIdToken(token);
          req.user = { id: decoded.uid, email: decoded.email, name: decoded.name, uid: decoded.uid };
        } catch (err) {
          console.warn('Failed to verify token for mine=true request:', err && err.message);
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }
      q = db.collection('products').where('sellerId', '==', req.user.id);
      const initialSnap = await q.limit(1).get();
      if (initialSnap.empty && req.user && req.user.email) {
        const emailQ = db.collection('products').where('owner', '==', req.user.email);
        const emailSnap = await emailQ.limit(size).get();
        snapshot = emailSnap;
      }
    }

  const statusParam = status;
  const isAdmin = isAdminRequest || explicitAdmin;
    console.log(`Fetching products as ${isAdmin ? 'admin' : 'public'} (status=${statusParam || (isAdmin ? 'all' : 'active')})`);

    if (!mine) {
      if (statusParam) {
        q = q.where('status', '==', statusParam);
      } else if (!isAdmin) {
        q = q.where('status', '==', 'active');
      }
    } else {
      if (statusParam) q = q.where('status', '==', statusParam);
    }

    if (mine) {
      if (!snapshot) snapshot = await q.limit(size).get();
    } else {
      // If we have a status filter (default public 'active'), skip orderBy to avoid composite index requirement
      const hasStatusFilter = !!statusParam || (!isAdmin && !mine);
      if (hasStatusFilter) {
        // simple equality query + limit, sort in memory below
        snapshot = await q.limit(size).get();
      } else {
        // No status filter: safe to order by createdAt or requested field
        const direction = sortDir.toLowerCase() === 'asc' ? 'asc' : 'desc';
        q = q.orderBy(sortBy, direction);
        const offset = (pageNum - 1) * size;
        snapshot = await q.offset(offset).limit(size).get();
      }
    }

    let products = snapshot.docs.map(doc => {
      const data = doc.data();
      // Build a public URL from imagePath if imageUrl is missing
      let publicImageUrl = '';
      if (data.imageUrl) publicImageUrl = data.imageUrl;
      else if (data.photo) publicImageUrl = data.photo;
      else if (data.imagePath) {
        try {
          const bucketName = admin.storage().bucket().name;
          publicImageUrl = `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(data.imagePath)}`;
        } catch (e) {
          publicImageUrl = '';
        }
      } else {
        publicImageUrl = 'https://via.placeholder.com/300';
      }

      return {
        id: doc.id,
        title: data.title || data.name || 'Untitled Product',
        description: data.description || data.desc || '',
        price: parsePrice(data.price),
        category: data.category || '',
        sellerId: data.sellerId || data.owner || '',
        delivery: !!data.delivery,
        pickup: !!data.pickup,
        status: data.status || 'pending',
        imageUrl: publicImageUrl,
        imagePath: data.imagePath || null,
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : new Date(data.createdAt).toISOString()) : null,
        publishedAt: data.publishedAt ? (data.publishedAt.toDate ? data.publishedAt.toDate().toISOString() : new Date(data.publishedAt).toISOString()) : null,
        deniedAt: data.deniedAt ? (data.deniedAt.toDate ? data.deniedAt.toDate().toISOString() : new Date(data.deniedAt).toISOString()) : null,
        updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : new Date(data.updatedAt).toISOString()) : null,
        adminMessage: data.adminMessage || null,
        sellerName: data.sellerName || data.seller || '',
        location: data.location || null,
      };
    });

    // De-duplicate potential double-creates: if multiple items from the same seller
    // with the same title and price are created within a short window, keep the newest.
    if (products.length > 1) {
      const norm = s => (s || '').toString().trim().toLowerCase();
      const byKey = new Map();
      for (const p of products) {
        const key = [p.sellerId || '', norm(p.title), Number.isFinite(p.price) ? p.price : null].join('|');
        const ts = p.createdAt ? new Date(p.createdAt).getTime() : 0;
        const prev = byKey.get(key);
        if (!prev) {
          byKey.set(key, [p]);
        } else {
          prev.push(p);
        }
      }
      const deduped = [];
      for (const group of byKey.values()) {
        if (group.length === 1) { deduped.push(group[0]); continue; }
        // Sort by createdAt desc and filter out items within 60s window as duplicates
        group.sort((a,b)=>{
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
        const kept = [];
        for (const item of group) {
          const t = item.createdAt ? new Date(item.createdAt).getTime() : 0;
          const isDup = kept.some(k => Math.abs(((k.createdAt ? new Date(k.createdAt).getTime() : 0) - t)) <= 60000);
          if (!isDup) kept.push(item);
        }
        deduped.push(...kept);
      }
      products = deduped;
    }

    // If we fetched without ordering (mine or public with status filter), sort in-memory by createdAt desc
    if ((mine || (!!statusParam || (!isAdmin && !mine))) && products.length > 0) {
      products.sort((a,b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
    }

    // Optionally enrich products with seller/user info. Default to include when requester is admin
    const shouldIncludeSeller = includeSeller === 'true' || isAdminRequest || explicitAdmin;
    if (shouldIncludeSeller && products.length > 0) {
      const sellerIds = Array.from(new Set(products.map(p => p.sellerId).filter(Boolean)));
      if (sellerIds.length > 0) {
        // Fetch user docs in parallel
        const userDocs = await Promise.all(sellerIds.map(id => db.collection('users').doc(id).get()));
        const userMap = {};
        userDocs.forEach(d => {
          if (d && d.exists) userMap[d.id] = d.data();
        });

        // Attach seller info to products
        for (const p of products) {
          if (p.sellerId && userMap[p.sellerId]) {
            const u = userMap[p.sellerId];
            p.seller = {
              id: p.sellerId,
              name: u.name || u.displayName || p.sellerName || '',
              email: u.email || u.emailAddress || null,
              phone: u.phone || u.phoneNumber || u.phoneNumber || null,
              profilePic: u.profilePic || u.photoURL || u.avatar || null,
            };
          } else {
            p.seller = null;
          }
        }
      }
    }

    res.json({ page: pageNum, pageSize: size, items: products });
  } catch (err) {
    console.error('Error fetching products:', err);
    const msg = err && err.message ? err.message : String(err);
    // Try to extract the Firebase Console create-index URL if present in the message
    const urlMatch = msg.match(/https:\/\/console\.firebase\.google\.com\S+/);
    const createIndexUrl = urlMatch ? urlMatch[0] : null;
    const payload = { error: msg };
    if (createIndexUrl) payload.createIndexUrl = createIndexUrl;
    res.status(500).json(payload);
  }
};

async function uploadFileToBucket(file, destinationPath) {
  const bucket = admin.storage().bucket();
  const options = { destination: destinationPath, resumable: false, metadata: { contentType: file.mimetype } };
  await bucket.upload(file.path, options);
  try { await bucket.file(destinationPath).makePublic(); } catch (e) { console.error('Failed to make file public', e); }
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(destinationPath)}`;
  return { path: destinationPath, url: publicUrl };
}

async function deleteFileFromBucket(path) {
  if (!path) return;
  const bucket = admin.storage().bucket();
  try {
    await bucket.file(path).delete();
  } catch (err) {
    console.warn('Failed to delete file from bucket', path, err.message || err);
  }
}

exports.createProduct = async (req, res) => {
  try {
    const uploadedFile = req.file;
    const data = req.body || {};
    const createdAt = admin.firestore.FieldValue.serverTimestamp();

    const authUser = req.user || {};
    const sellerId = authUser.id || authUser.uid || data.sellerId || '';
    const sellerName = authUser.name || authUser.displayName || data.sellerName || data.seller || '';

    let imageUrl = data.imageUrl || data.photo || '';
    let imagePath = data.imagePath || null;

    if (uploadedFile) {
      const destPath = `products/${sellerId || 'anonymous'}/${Date.now()}_${uploadedFile.originalname}`;
      const uploaded = await uploadFileToBucket(uploadedFile, destPath);
      imageUrl = uploaded.url;
      imagePath = uploaded.path;
      try { require('fs').unlinkSync(uploadedFile.path); } catch (e) { /* ignore */ }
    }

    const newProduct = {
      title: data.title || data.name || 'Untitled Product',
      description: data.description || data.desc || '',
      price: parsePrice(data.price),
      category: data.category || '',
      sellerId: sellerId,
      sellerName: sellerName,
      status: 'pending',
      imageUrl,
      imagePath,
      location: data.location || null,
      delivery: typeof data.delivery === 'boolean' ? data.delivery : false,
      pickup: typeof data.pickup === 'boolean' ? data.pickup : false,
      createdAt,
    };

  const ref = await db.collection('products').add(newProduct);

    const createdDoc = await ref.get();
    const createdData = createdDoc.data();
    let createdImageUrl = '';
    if (createdData.imageUrl) createdImageUrl = createdData.imageUrl;
    else if (createdData.photo) createdImageUrl = createdData.photo;
    else if (createdData.imagePath) {
      try { createdImageUrl = `https://storage.googleapis.com/${admin.storage().bucket().name}/${encodeURIComponent(createdData.imagePath)}`; } catch (e) { createdImageUrl = ''; }
    }
    const resp = {
      id: ref.id,
      title: createdData.title,
      description: createdData.description,
      price: parsePrice(createdData.price),
      category: createdData.category || '',
      sellerId: createdData.sellerId || '',
      delivery: !!createdData.delivery,
      pickup: !!createdData.pickup,
      status: createdData.status || 'pending',
      imageUrl: createdImageUrl,
      imagePath: createdData.imagePath || null,
      location: createdData.location || null,
      createdAt: createdData.createdAt && createdData.createdAt.toDate ? createdData.createdAt.toDate().toISOString() : null,
    };

    // Notify admins about a new product submission for review
    try {
      const toList = (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      if (toList.length && typeof sendNotificationEmail === 'function') {
        const subject = 'New product submitted for review';
        const text = `${newProduct.sellerName || 'A seller'} submitted "${newProduct.title}" for approval.`;
        await Promise.all(toList.map(email => sendNotificationEmail(email, subject, text, `<p>${text}</p>`)));
      }
    } catch (e) { console.warn('Admin notify for new product failed', e && e.message); }

    // Create in-app notification for the seller that their product is awaiting approval
    try {
      if (sellerId) {
        await db.collection('notifications').add({
          userId: sellerId,
          productId: ref.id,
          type: 'product_pending',
          title: 'Product submitted for review',
          message: `Your product "${newProduct.title}" is awaiting admin approval.`,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (e) {
      console.warn('Failed to create in-app notification for seller on product submission', e && e.message);
    }

    // Create a lightweight admin-targeted notification (forAdmin flag) so admins can see a stream
    try {
      await db.collection('notifications').add({
        forAdmin: true,
        productId: ref.id,
        type: 'product_pending_admin',
        title: 'New product awaiting review',
        message: `${newProduct.sellerName || 'A seller'} submitted "${newProduct.title}" for approval.`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn('Failed to create admin in-app notification for product submission', e && e.message);
    }

    res.status(201).json(resp);
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const docRef = db.collection('products').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const d = doc.data();
    let docImageUrl = '';
    if (d.imageUrl) docImageUrl = d.imageUrl;
    else if (d.photo) docImageUrl = d.photo;
    else if (d.imagePath) {
      try { docImageUrl = `https://storage.googleapis.com/${admin.storage().bucket().name}/${encodeURIComponent(d.imagePath)}`; } catch(e) { docImageUrl = ''; }
    }
    res.json({
      id: doc.id,
      title: d.title || d.name || '',
      description: d.description || d.desc || '',
      price: parsePrice(d.price),
      delivery: !!d.delivery,
      pickup: !!d.pickup,
      category: d.category || '',
      sellerId: d.sellerId || '',
      sellerName: d.sellerName || d.seller || '',
      owner: d.owner || null,
      status: d.status || 'pending',
      imageUrl: docImageUrl,
      imagePath: d.imagePath || null,
      location: d.location || null,
      createdAt: d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toISOString() : null,
      updatedAt: d.updatedAt && d.updatedAt.toDate ? d.updatedAt.toDate().toISOString() : (d.updatedAt ? new Date(d.updatedAt).toISOString() : null),
    });
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const data = req.body || {};
    const uploadedFile = req.file;

    const normalizedStatus = data.status ? normalizeStatus(data.status) : undefined;

    const updates = { ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (normalizedStatus) updates.status = normalizedStatus;
    
    // Ensure delivery and pickup are boolean if provided
    if (typeof data.delivery === 'boolean') updates.delivery = data.delivery;
    if (typeof data.pickup === 'boolean') updates.pickup = data.pickup;

    if (updates.status === 'active') {
      updates.publishedAt = admin.firestore.FieldValue.serverTimestamp();
      updates.deniedAt = null;
      updates.adminMessage = null;
    }
    if (updates.status === 'denied') {
      updates.deniedAt = admin.firestore.FieldValue.serverTimestamp();
      if (typeof data.adminMessage === 'string') updates.adminMessage = data.adminMessage;
    }

  // Retrieve current product to detect status change and seller info
  const docRef = db.collection('products').doc(req.params.id);
  const beforeDoc = await docRef.get();
  const beforeData = beforeDoc.exists ? beforeDoc.data() : {};

  // If a new file was uploaded, upload it and update image fields; also delete previous image if present
  if (uploadedFile) {
    const destPath = `products/${beforeData && beforeData.sellerId ? beforeData.sellerId : (req.user && req.user.uid) || 'anonymous'}/${Date.now()}_${uploadedFile.originalname}`;
    try {
      const uploaded = await uploadFileToBucket(uploadedFile, destPath);
      // delete old image if present
      if (beforeData && beforeData.imagePath) await deleteFileFromBucket(beforeData.imagePath).catch(()=>{});
      updates.imageUrl = uploaded.url;
      updates.imagePath = uploaded.path;
    } finally {
      try { require('fs').unlinkSync(uploadedFile.path); } catch (e) {}
    }
  }

  await docRef.update(updates);

  // After update, fetch latest doc to return
  const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Product not found' });
    const pd = doc.data();

    // If status changed from non-active to active, notify seller
    const prevStatus = beforeData.status || 'pending';
    const newStatus = pd.status || 'pending';
    if (prevStatus !== 'active' && newStatus === 'active') {
      // try to find seller's email from users collection by sellerId
      try {
        const sellerId = pd.sellerId;
        if (sellerId) {
          const userDoc = await db.collection('users').doc(sellerId).get();
          const user = userDoc.exists ? userDoc.data() : null;
          const email = (user && (user.email || user.emailAddress)) || pd.sellerEmail || null;
          if (email) {
            const subject = 'Your product has been approved';
            const text = `Your product "${pd.title || 'untitled'}" has been approved and is now live on the marketplace.`;
            await sendNotificationEmail(email, subject, text, `<p>${text}</p>`);
            // Also create an in-app notification document for the seller
            try {
              const adminId = (req.user && (req.user.id || req.user.uid || req.user.authId)) || null;
              const adminName = (req.user && (req.user.displayName || req.user.name || req.user.username || req.user.email)) || null;
              await db.collection('notifications').add({
                userId: sellerId,
                productId: doc.id,
                type: 'product_approved',
                title: subject,
                message: text,
                read: false,
                adminId,
                adminName,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            } catch (e) {
              console.warn('Failed to create in-app notification for approve', e && e.message);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to notify seller on approve:', err.message || err);
      }
    }

    // If status is denied, notify seller with adminMessage
    if (newStatus === 'denied') {
      try {
        const sellerId = pd.sellerId;
        if (sellerId) {
          const userDoc = await db.collection('users').doc(sellerId).get();
          const user = userDoc.exists ? userDoc.data() : null;
          const email = (user && (user.email || user.emailAddress)) || pd.sellerEmail || null;
          if (email) {
            const subject = 'Your product has been denied';
            const message = pd.adminMessage || 'Your product was denied by the admin.';
            const text = `Your product "${pd.title || 'untitled'}" was denied. Reason: ${message}`;
            await sendNotificationEmail(email, subject, text, `<p>${text}</p>`);
            try {
              const adminId = (req.user && (req.user.id || req.user.uid || req.user.authId)) || null;
              const adminName = (req.user && (req.user.displayName || req.user.name || req.user.username || req.user.email)) || null;
              await db.collection('notifications').add({
                userId: sellerId,
                productId: doc.id,
                type: 'product_denied',
                title: subject,
                message: text,
                read: false,
                adminId,
                adminName,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            } catch (e) {
              console.warn('Failed to create in-app notification for deny', e && e.message);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to notify seller on deny:', err.message || err);
      }
    }
    // derive public image url if necessary
    let pdImageUrl = '';
    if (pd.imageUrl) pdImageUrl = pd.imageUrl;
    else if (pd.photo) pdImageUrl = pd.photo;
    else if (pd.imagePath) {
      try { pdImageUrl = `https://storage.googleapis.com/${admin.storage().bucket().name}/${encodeURIComponent(pd.imagePath)}`; } catch(e) { pdImageUrl = ''; }
    }
    res.json({
      id: doc.id,
      title: pd.title || pd.name || '',
      description: pd.description || pd.desc || '',
      price: parsePrice(pd.price),
      delivery: !!pd.delivery,
      pickup: !!pd.pickup,
      status: pd.status || 'pending',
      category: pd.category || '',
      location: pd.location || null,
      imageUrl: pdImageUrl,
      imagePath: pd.imagePath || null,
      sellerId: pd.sellerId || '',
      publishedAt: pd.publishedAt && pd.publishedAt.toDate ? pd.publishedAt.toDate().toISOString() : (pd.publishedAt ? new Date(pd.publishedAt).toISOString() : null),
      deniedAt: pd.deniedAt && pd.deniedAt.toDate ? pd.deniedAt.toDate().toISOString() : (pd.deniedAt ? new Date(pd.deniedAt).toISOString() : null),
      adminMessage: pd.adminMessage || null,
      createdAt: pd.createdAt && pd.createdAt.toDate ? pd.createdAt.toDate().toISOString() : (pd.createdAt ? new Date(pd.createdAt).toISOString() : null),
      updatedAt: pd.updatedAt && pd.updatedAt.toDate ? pd.updatedAt.toDate().toISOString() : (pd.updatedAt ? new Date(pd.updatedAt).toISOString() : null),
    });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const docRef = db.collection('products').doc(req.params.id);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data && data.imagePath) {
        try { await deleteFileFromBucket(data.imagePath); } catch (e) { console.warn('Failed to delete product image from storage', e && e.message); }
      }
    }
    await docRef.delete();
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Mark product as sold and award points (idempotent)
// Auth: seller of the product or admin
// Body: { buyerId: string, finalPrice?: number }
exports.markSold = async (req, res) => {
  try {
    const productId = String(req.params.id);
    const buyerId = req.body && (req.body.buyerId || req.body.buyer || req.body.userId);
    const finalPrice = parsePrice(req.body && (req.body.finalPrice ?? req.body.price));

    if (!buyerId) return res.status(400).json({ error: 'buyerId_required' });

    const productRef = db.collection('products').doc(productId);
    const productSnap = await productRef.get();
    if (!productSnap.exists) return res.status(404).json({ error: 'product_not_found' });
    const product = productSnap.data() || {};

    const sellerId = product.sellerId || product.owner || null;
    if (!sellerId) return res.status(400).json({ error: 'product_missing_seller' });

    // Authorization: seller or admin
    const isAdmin = !!(req.user && (req.user.isAdmin || req.user.admin || req.user.role === 'admin' || (req.user.roles || []).includes('admin') || (req.user.customClaims && (req.user.customClaims.isAdmin || req.user.customClaims.admin || req.user.customClaims.role === 'admin'))));
    const isSeller = !!(req.user && (req.user.id === sellerId || req.user.uid === sellerId));
    if (!isAdmin && !isSeller) return res.status(403).json({ error: 'forbidden' });

    const now = admin.firestore.FieldValue.serverTimestamp();
    const { category: normCat, sellerPoints, buyerPoints } = getPointsForCategory(product.category || '');
    const historyId = `${productId}_${buyerId}`; // de-dupe per product-buyer
    const historyRef = db.collection('points_history').doc(historyId);
    const sellerRef = db.collection('users').doc(String(sellerId));
    const buyerRef = db.collection('users').doc(String(buyerId));

    // Capture current product presentation details for history (so transactions keep showing even if product is later deleted)
    const productTitle = (product.title || product.name || '');
    let productImageUrl = '';
    try {
      if (product.imageUrl) productImageUrl = product.imageUrl;
      else if (product.photo) productImageUrl = product.photo;
      else if (product.imagePath) {
        productImageUrl = `https://storage.googleapis.com/${admin.storage().bucket().name}/${encodeURIComponent(product.imagePath)}`;
      }
    } catch (e) { productImageUrl = ''; }

    let alreadyAwarded = false;
    let sellerBadgeSummary = null;
    let buyerBadgeSummary = null;
    let sellerBadgeNotifications = [];
    let buyerBadgeNotifications = [];

    await db.runTransaction(async (tx) => {
      const freshProduct = await tx.get(productRef);
      if (!freshProduct.exists) throw new Error('product_not_found');
      const pdata = freshProduct.data() || {};

      // If already sold and points awarded, exit early
      if (pdata.status === 'sold' && pdata.pointsAwarded) { alreadyAwarded = true; return; }

      // Check for existing history (idempotency safeguard)
      const histSnap = await tx.get(historyRef);
      if (histSnap.exists) { alreadyAwarded = true; }

      let sellerData = {};
      let buyerData = {};
      if (!alreadyAwarded) {
        const sellerDoc = await tx.get(sellerRef);
        const buyerDoc = await tx.get(buyerRef);
        sellerData = sellerDoc.exists ? (sellerDoc.data() || {}) : {};
        buyerData = buyerDoc.exists ? (buyerDoc.data() || {}) : {};
      }

      // All reads complete; proceed with writes
      const productUpdate = {
        status: 'sold',
        soldAt: now,
        updatedAt: now,
        pointsAwarded: true,
        buyerId: String(buyerId),
      };
      if (finalPrice !== null && finalPrice !== undefined) productUpdate.salePrice = finalPrice;
      tx.set(productRef, productUpdate, { merge: true });

      if (!alreadyAwarded) {
        const sellerTotalBefore = currentTotalPoints(sellerData);
        const buyerTotalBefore = currentTotalPoints(buyerData);
        const sellerTotalAfter = sellerTotalBefore + (Number(sellerPoints) || 0);
        const buyerTotalAfter = buyerTotalBefore + (Number(buyerPoints) || 0);

        const sellerBadge = evaluateBadgeProgress(sellerTotalAfter, sellerData.badgesUnlocked || [], sellerData.highestBadgeTier || sellerData.badgeTier);
        const buyerBadge = evaluateBadgeProgress(buyerTotalAfter, buyerData.badgesUnlocked || [], buyerData.highestBadgeTier || buyerData.badgeTier);

        const sellerUpdate = {
          sellerPoints: admin.firestore.FieldValue.increment(sellerPoints),
          totalPoints: admin.firestore.FieldValue.increment(sellerPoints),
          updatedAt: now,
        };
        if (sellerBadge.changed) {
          sellerUpdate.badgesUnlocked = sellerBadge.unlocked;
          sellerUpdate.highestBadgeTier = sellerBadge.highestTier;
          sellerUpdate.badgeTier = sellerBadge.highestTier;
          sellerUpdate.badgeUpdatedAt = now;
          if (!sellerData.equippedBadge && sellerBadge.highestTier) {
            sellerUpdate.equippedBadge = sellerBadge.highestTier;
          }
        }

        const buyerUpdate = {
          buyerPoints: admin.firestore.FieldValue.increment(buyerPoints),
          totalPoints: admin.firestore.FieldValue.increment(buyerPoints),
          updatedAt: now,
        };
        if (buyerBadge.changed) {
          buyerUpdate.badgesUnlocked = buyerBadge.unlocked;
          buyerUpdate.highestBadgeTier = buyerBadge.highestTier;
          buyerUpdate.badgeTier = buyerBadge.highestTier;
          buyerUpdate.badgeUpdatedAt = now;
          if (!buyerData.equippedBadge && buyerBadge.highestTier) {
            buyerUpdate.equippedBadge = buyerBadge.highestTier;
          }
        }

        tx.set(sellerRef, sellerUpdate, { merge: true });
        tx.set(buyerRef, buyerUpdate, { merge: true });

        // Record history
        const historyPayload = {
          productId,
          productTitle,
          productImageUrl,
          sellerId,
          buyerId: String(buyerId),
          category: normCat,
          sellerPoints,
          buyerPoints,
          totalPoints: (sellerPoints + buyerPoints),
          createdAt: now,
        };

        if (sellerBadge && Array.isArray(sellerBadge.newlyUnlocked) && sellerBadge.newlyUnlocked.length > 0) {
          historyPayload.sellerBadgeUnlocks = sellerBadge.newlyUnlocked;
          historyPayload.sellerBadgeHighestTier = sellerBadge.highestTier || sellerBadge.previousHighest || null;
        }

        if (buyerBadge && Array.isArray(buyerBadge.newlyUnlocked) && buyerBadge.newlyUnlocked.length > 0) {
          historyPayload.buyerBadgeUnlocks = buyerBadge.newlyUnlocked;
          historyPayload.buyerBadgeHighestTier = buyerBadge.highestTier || buyerBadge.previousHighest || null;
        }

        tx.set(historyRef, historyPayload, { merge: true });

        sellerBadgeSummary = { ...sellerBadge, totalPoints: sellerTotalAfter };
        buyerBadgeSummary = { ...buyerBadge, totalPoints: buyerTotalAfter };
        sellerBadgeNotifications = buildBadgeNotifications(sellerBadgeSummary, 'seller');
        buyerBadgeNotifications = buildBadgeNotifications(buyerBadgeSummary, 'buyer');
      }
    });

    // respond with updated product doc
    const updated = await productRef.get();
    const ud = updated.data() || {};
    res.json({
      id: updated.id,
      status: ud.status || 'sold',
      buyerId: ud.buyerId || String(buyerId),
      salePrice: parsePrice(ud.salePrice),
      pointsAwarded: !!ud.pointsAwarded,
      category: normCat,
      sellerPoints,
      buyerPoints,
      alreadyAwarded,
      badgeUpdates: {
        seller: sellerBadgeSummary,
        buyer: buyerBadgeSummary,
      },
      badgeNotifications: {
        seller: sellerBadgeNotifications,
        buyer: buyerBadgeNotifications,
      },
    });
  } catch (err) {
    console.error('markSold error:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
};

// Create an admin-targeted notification for an order (used by client after creating order)
exports.notifyOrder = async (req, res) => {
  try {
    const { productId, productTitle, buyerId, sellerId, type } = req.body || {};
    await db.collection('notifications').add({
      forAdmin: true,
      productId: productId || null,
      title: `New ${type || 'delivery'} request`,
      message: `${req.user && req.user.displayName ? req.user.displayName : (req.user && req.user.email) || 'A user'} requested ${type || 'delivery'} for "${productTitle || 'an item'}"`,
      orderMeta: { buyerId: buyerId || null, sellerId: sellerId || null, type: type || null },
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ success: true });
  } catch (e) {
    console.error('Failed to create admin notification for order via backend', e && e.message);
    res.status(500).json({ error: 'notify_failed' });
  }
};