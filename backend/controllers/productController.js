// controllers/productController.js
const { admin, db } = require('../config/firebaseAdmin');
const nodemailer = require('nodemailer');
const cloudinary = require('../config/cloudinary');
const { evaluateBadgeProgress, badgeLabelFromTier } = require('../config/badges');
const {
  calculatePointsFromKilograms,
  calculateEstimatedEarnings,
  getTypeByKeys,
  getAllCategories: getRecyclableCategories,
} = require('../config/recyclables');

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
  if (/metal|scrap|iron|aluminum|copper/.test(s)) return 'Metals';
  if (/plastic|bottle|container/.test(s)) return 'Plastics';
  if (/paper|carton|newspaper|bond/.test(s)) return 'Paper';
  if (/glass|bottle/.test(s)) return 'Glass';
  if (/electronic|gadget|phone|laptop|pc|tablet|camera|wire|appliance/.test(s)) return 'Electronics';
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
    'Metals': { seller: 15, buyer: 8 },
    'Plastics': { seller: 8, buyer: 4 },
    'Paper': { seller: 6, buyer: 3 },
    'Electronics': { seller: 12, buyer: 6 },
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
        dropoffJunkshop: !!data.dropoffJunkshop,
        status: data.status || 'pending',
        imageUrl: publicImageUrl,
        photo: data.photo || publicImageUrl || null,
        images: data.images || (publicImageUrl ? [publicImageUrl] : []),
        imagePath: data.imagePath || null,
        archived: !!data.archived,
        archivedReason: data.archivedReason || null,
        archivedAt: data.archivedAt ? (data.archivedAt.toDate ? data.archivedAt.toDate().toISOString() : new Date(data.archivedAt).toISOString()) : null,
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : new Date(data.createdAt).toISOString()) : null,
        publishedAt: data.publishedAt ? (data.publishedAt.toDate ? data.publishedAt.toDate().toISOString() : new Date(data.publishedAt).toISOString()) : null,
        deniedAt: data.deniedAt ? (data.deniedAt.toDate ? data.deniedAt.toDate().toISOString() : new Date(data.deniedAt).toISOString()) : null,
        updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : new Date(data.updatedAt).toISOString()) : null,
        adminMessage: data.adminMessage || null,
        sellerName: data.sellerName || data.seller || '',
        location: data.location || null,
        // Recyclable fields (new)
        isRecyclable: !!data.isRecyclable,
        recyclableCategoryKey: data.recyclableCategoryKey || null,
        recyclableTypeKey: data.recyclableTypeKey || null,
        weight: data.weight || null,
        numberOfSacks: data.numberOfSacks || null,
        deliveryMethod: data.deliveryMethod || null,
        pickupAddress: data.pickupAddress || null,
        pickupDate: data.pickupDate || null,
        pickupTime: data.pickupTime || null,
        transportationFee: data.transportationFee || 0,
        estimatedMinEarnings: data.estimatedMinEarnings || null,
        estimatedMaxEarnings: data.estimatedMaxEarnings || null,
        estimatedNetPayment: data.estimatedNetPayment || null,
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

    // Exclude drop-off items from marketplace (public view): only admins should see them in product list
    // Drop-off items should only appear in the dedicated drop-off management section
    if (!isAdmin && !mine) {
      products = products.filter(p => !p.dropoffJunkshop);
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
      dropoffJunkshop: typeof data.dropoffJunkshop === 'boolean' ? data.dropoffJunkshop : false,
      dropoffDate: data.dropoffDate || null,
      dropoffTime: data.dropoffTime || null,
      
      // Recyclable product fields (new)
      isRecyclable: data.isRecyclable === true || data.isRecyclable === 'true',
      recyclableCategoryKey: data.recyclableCategoryKey || null,
      recyclableTypeKey: data.recyclableTypeKey || null,
      weight: data.weight ? parseFloat(data.weight) : null,
      numberOfSacks: data.numberOfSacks ? parseInt(data.numberOfSacks, 10) : null,
      deliveryMethod: data.deliveryMethod || null, // 'pickup' or 'dropoff'
      pickupAddress: data.pickupAddress || null,
      pickupDate: data.pickupDate || null,
      pickupTime: data.pickupTime || null,
      transportationFee: data.transportationFee ? parseFloat(data.transportationFee) : 0,
      estimatedMinEarnings: data.estimatedMinEarnings ? parseFloat(data.estimatedMinEarnings) : null,
      estimatedMaxEarnings: data.estimatedMaxEarnings ? parseFloat(data.estimatedMaxEarnings) : null,
      estimatedNetPayment: data.estimatedNetPayment ? parseFloat(data.estimatedNetPayment) : null,
      nonAcceptableItemsWarningAccepted: data.nonAcceptableItemsWarningAccepted === true || data.nonAcceptableItemsWarningAccepted === 'true',
      
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
      dropoffJunkshop: !!createdData.dropoffJunkshop,
      dropoffDate: createdData.dropoffDate || null,
      dropoffTime: createdData.dropoffTime || null,
      status: createdData.status || 'pending',
      imageUrl: createdImageUrl,
      imagePath: createdData.imagePath || null,
      location: createdData.location || null,
      // Recyclable fields (new)
      isRecyclable: !!createdData.isRecyclable,
      recyclableCategoryKey: createdData.recyclableCategoryKey || null,
      recyclableTypeKey: createdData.recyclableTypeKey || null,
      weight: createdData.weight || null,
      numberOfSacks: createdData.numberOfSacks || null,
      deliveryMethod: createdData.deliveryMethod || null,
      pickupAddress: createdData.pickupAddress || null,
      pickupDate: createdData.pickupDate || null,
      pickupTime: createdData.pickupTime || null,
      transportationFee: createdData.transportationFee || 0,
      estimatedMinEarnings: createdData.estimatedMinEarnings || null,
      estimatedMaxEarnings: createdData.estimatedMaxEarnings || null,
      estimatedNetPayment: createdData.estimatedNetPayment || null,
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
      // Recyclable fields (new)
      isRecyclable: !!d.isRecyclable,
      recyclableCategoryKey: d.recyclableCategoryKey || null,
      recyclableTypeKey: d.recyclableTypeKey || null,
      weight: d.weight || null,
      numberOfSacks: d.numberOfSacks || null,
      deliveryMethod: d.deliveryMethod || null,
      pickupAddress: d.pickupAddress || null,
      pickupDate: d.pickupDate || null,
      pickupTime: d.pickupTime || null,
      transportationFee: d.transportationFee || 0,
      estimatedMinEarnings: d.estimatedMinEarnings || null,
      estimatedMaxEarnings: d.estimatedMaxEarnings || null,
      estimatedNetPayment: d.estimatedNetPayment || null,
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
    
    // Ensure drop-off fields are properly typed if provided
    if (typeof data.dropoffJunkshop === 'boolean') updates.dropoffJunkshop = data.dropoffJunkshop;
    if (data.dropoffDate !== undefined) updates.dropoffDate = data.dropoffDate || null;
    if (data.dropoffTime !== undefined) updates.dropoffTime = data.dropoffTime || null;

    // Handle archived field
    if (typeof data.archived === 'boolean') updates.archived = data.archived;

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
      dropoffJunkshop: !!pd.dropoffJunkshop,
      dropoffDate: pd.dropoffDate || null,
      dropoffTime: pd.dropoffTime || null,
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
    const productId = req.params.id;
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });

    const isAdmin = !!(req.user.isAdmin || req.user.admin || req.user.role === 'admin' ||
      (Array.isArray(req.user.roles) && req.user.roles.includes('admin')) ||
      (req.user.customClaims && (req.user.customClaims.isAdmin || req.user.customClaims.role === 'admin')));

    const docRef = db.collection('products').doc(productId);
    const docSnap = await docRef.get();

    // Only the product owner or an admin can delete
    if (!isAdmin) {
      const sellerId = docSnap.exists ? (docSnap.data().sellerId || docSnap.data().owner) : null;
      const requesterId = req.user.id || req.user.uid;
      if (!sellerId || sellerId !== requesterId) {
        return res.status(403).json({ error: 'forbidden' });
      }
    }

    if (docSnap.exists) {
      const data = docSnap.data();
      if (data && data.imagePath) {
        try { await deleteFileFromBucket(data.imagePath); } catch (e) { console.warn('Failed to delete product image from storage', e && e.message); }
      }
    }
    
    // Also delete related dropoffs when product is deleted
    try {
      const dropoffsSnapshot = await db.collection('dropoffs').where('productId', '==', productId).get();
      const batch = db.batch();
      dropoffsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`Deleted ${dropoffsSnapshot.docs.length} dropoff(s) for product ${productId}`);
    } catch (e) {
      console.warn('Failed to delete related dropoffs:', e && e.message);
    }
    
    await docRef.delete();
    res.json({ success: true, message: 'Product and related dropoffs deleted successfully' });
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
    
    // For recyclable products, calculate points based on weight (kg)
    let sellerPoints, buyerPoints;
    if (product.isRecyclable && product.weight) {
      sellerPoints = calculatePointsFromKilograms(product.weight);
      buyerPoints = 0; // Buyers don't earn points for recyclables in this system
    } else {
      // For regular products, use category-based points
      const pointsInfo = getPointsForCategory(product.category || '');
      sellerPoints = pointsInfo.sellerPoints;
      buyerPoints = pointsInfo.buyerPoints;
    }
    
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
          category: product.category || '',
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
      category: product.category || '',
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

/**
 * Get all recyclable categories, types, and price ranges
 */
exports.getRecyclableCategories = async (req, res) => {
  try {
    const categories = getRecyclableCategories();
    res.json({ categories });
  } catch (err) {
    console.error('Error fetching recyclable categories:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Calculate estimated earnings for a recyclable product
 * Request body: { categoryKey, typeKey, weight }
 */
exports.calculateEarnings = async (req, res) => {
  try {
    const { categoryKey, typeKey, weight, transportationFee } = req.body;

    if (!categoryKey || !typeKey) {
      return res.status(400).json({ error: 'categoryKey and typeKey are required' });
    }

    if (!weight || weight <= 0) {
      return res.status(400).json({ error: 'weight must be a positive number' });
    }

    const earnings = calculateEstimatedEarnings(categoryKey, typeKey, parseFloat(weight));
    const fee = transportationFee ? parseFloat(transportationFee) : 0;
    const netMin = Math.max(0, earnings.min - fee);
    const netMax = Math.max(0, earnings.max - fee);

    res.json({
      estimatedMinEarnings: earnings.min,
      estimatedMaxEarnings: earnings.max,
      transportationFee: fee,
      estimatedNetMin: netMin,
      estimatedNetMax: netMax,
      points: calculatePointsFromKilograms(parseFloat(weight)),
    });
  } catch (err) {
    console.error('Error calculating earnings:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Submit a drop-off request for a product to junkshop
 * Seller creates a drop-off appointment
 */
exports.submitDropoff = async (req, res) => {
  try {
    const sellerId = (req.user && (req.user.id || req.user.uid)) || req.body.sellerId;
    if (!sellerId) return res.status(401).json({ error: 'seller_not_authenticated' });

    const { productId, productTitle, delivery, pickup, dropoffJunkshop, dropoffDate, dropoffTime, notes } = req.body;
    if (!productId || !dropoffDate) {
      return res.status(400).json({ error: 'productId and dropoffDate are required' });
    }

    // Get seller info — try direct UID doc first, then authId query (profiles use auto-gen IDs)
    const sellerDoc = await db.collection('users').doc(sellerId).get();
    let sellerData = sellerDoc.exists ? sellerDoc.data() : {};

    // If the UID doc has no display name, the real profile is stored with authId == sellerId
    if (!sellerData.name && !sellerData.displayName && !sellerData.username) {
      try {
        const byAuth = await db.collection('users').where('authId', '==', sellerId).limit(1).get();
        if (!byAuth.empty) {
          sellerData = { ...sellerData, ...byAuth.docs[0].data() };
        }
      } catch (e) { /* ignore */ }
    }

    // Get product info
    const productDoc = await db.collection('products').doc(productId).get();
    const productData = productDoc.exists ? productDoc.data() : {};

    // Last resort: Firebase Auth display name
    let authDisplayName = null;
    if (!sellerData.name && !sellerData.displayName && !sellerData.username) {
      try {
        const authUser = await admin.auth().getUser(sellerId);
        authDisplayName = authUser.displayName || null;
      } catch (e) { /* ignore */ }
    }

    const resolvedSellerName = sellerData.name || sellerData.displayName || sellerData.username || sellerData.fullName || authDisplayName || 'Unknown Seller';

    const dropoffRecord = {
      productId,
      productTitle: productTitle || productData.title || 'Unknown Product',
      productImage: productData.imageUrl || productData.photo || null,
      productCategory: productData.category || productData.productCategory || '',
      sellerId,
      sellerName: resolvedSellerName,
      sellerEmail: sellerData.email || sellerData.emailAddress || null,
      sellerPhone: sellerData.phone || sellerData.phoneNumber || null,
      location: sellerData.location || null,
      delivery: !!delivery,
      pickup: !!pickup,
      dropoffJunkshop: !!dropoffJunkshop,
      dropoffDate,
      dropoffTime: dropoffTime || null,
      status: 'pending', // pending, approved, declined, completed
      adminNotes: '',
      notes: notes || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection('dropoffs').add(dropoffRecord);

    // Notify admins about new drop-off submission
    try {
      const toList = (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      if (toList.length && typeof sendNotificationEmail === 'function') {
        const subject = 'New drop-off appointment requested';
        const timeStr = dropoffTime ? ` at ${dropoffTime}` : '';
        const text = `${sellerData.name || 'A seller'} requested to drop off "${productData.title || productTitle}" on ${dropoffDate}${timeStr}`;
        await Promise.all(toList.map(email => sendNotificationEmail(email, subject, text, `<p>${text}</p>`)));
      }
    } catch (e) {
      console.warn('Failed to notify admins about drop-off', e && e.message);
    }

    // Create in-app notification for seller
    try {
      const timeStr = dropoffTime ? ` at ${dropoffTime}` : '';
      await db.collection('notifications').add({
        userId: sellerId,
        dropoffId: ref.id,
        type: 'dropoff_pending',
        title: 'Drop-off appointment submitted',
        message: `Your drop-off appointment for "${productData.title}" on ${dropoffDate}${timeStr} is awaiting admin approval.`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn('Failed to create seller notification for drop-off', e && e.message);
    }

    // Create admin notification
    try {
      const timeStr = dropoffTime ? ` at ${dropoffTime}` : '';
      await db.collection('notifications').add({
        forAdmin: true,
        dropoffId: ref.id,
        type: 'dropoff_pending_admin',
        title: 'Drop-off appointment awaiting review',
        message: `${sellerData.name || 'A seller'} requested drop-off for "${productData.title}" on ${dropoffDate}${timeStr}`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn('Failed to create admin notification for drop-off', e && e.message);
    }

    res.status(201).json({ id: ref.id, ...dropoffRecord });
  } catch (err) {
    console.error('Error submitting drop-off:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Complete a drop-off appointment (admin only).
 * Marks the drop-off as completed, sets the product as sold,
 * and automatically awards the seller points based on product category.
 */
exports.completeDropoff = async (req, res) => {
  try {
    const isAdmin = !!(req.user && (req.user.isAdmin || req.user.admin || req.user.role === 'admin' || (req.user.roles || []).includes('admin') || (req.user.customClaims && (req.user.customClaims.isAdmin || req.user.customClaims.admin || req.user.customClaims.role === 'admin'))));
    if (!isAdmin) return res.status(403).json({ error: 'admin_only' });

    const { dropoffId } = req.params;
    const { adminNotes } = req.body || {};
    if (!dropoffId) return res.status(400).json({ error: 'dropoffId required' });

    const dropoffRef = db.collection('dropoffs').doc(dropoffId);
    const dropoffDoc = await dropoffRef.get();
    if (!dropoffDoc.exists) return res.status(404).json({ error: 'dropoff_not_found' });

    const data = dropoffDoc.data();
    const sellerId = data.sellerId;
    const productId = data.productId;
    const stamp = admin.firestore.FieldValue.serverTimestamp();

    // Mark the drop-off appointment as completed
    await dropoffRef.update({
      status: 'completed',
      completedAt: stamp,
      adminNotes: adminNotes || data.adminNotes || '',
      updatedAt: stamp,
      sellerPoints: 0, // will be updated after transaction
    });

    // --- Award seller points + mark product as sold (inside a transaction for consistency) ---
    let sellerPoints = 0;
    let sellerBadgeSummary = null;
    let sellerBadgeNotifications = [];
    let alreadyAwarded = false;

    if (productId && sellerId) {
      const productRef = db.collection('products').doc(productId);
      const sellerRef = db.collection('users').doc(String(sellerId));
      const historyId = `dropoff_${dropoffId}`;
      const historyRef = db.collection('points_history').doc(historyId);

      await db.runTransaction(async (tx) => {
        const [productSnap, sellerSnap, histSnap] = await Promise.all([
          tx.get(productRef),
          tx.get(sellerRef),
          tx.get(historyRef),
        ]);

        // Idempotency: skip if points already awarded for this drop-off
        if (histSnap.exists) { alreadyAwarded = true; }

        const product = productSnap.exists ? (productSnap.data() || {}) : {};
        const sellerData = sellerSnap.exists ? (sellerSnap.data() || {}) : {};

        // Calculate points from category (or weight for recyclables)
        if (product.isRecyclable && product.weight) {
          sellerPoints = calculatePointsFromKilograms(product.weight);
        } else {
          sellerPoints = getPointsForCategory(product.category || data.productCategory || '').sellerPoints;
        }

        // Mark product as sold
        tx.set(productRef, {
          status: 'sold',
          soldAt: stamp,
          updatedAt: stamp,
          dropoffStatus: 'completed',
          dropoffCompletedAt: stamp,
          pointsAwarded: true,
        }, { merge: true });

        if (!alreadyAwarded && sellerPoints > 0) {
          const sellerTotalBefore = currentTotalPoints(sellerData);
          const sellerTotalAfter = sellerTotalBefore + sellerPoints;

          const sellerBadge = evaluateBadgeProgress(
            sellerTotalAfter,
            sellerData.badgesUnlocked || [],
            sellerData.highestBadgeTier || sellerData.badgeTier
          );

          const sellerUpdate = {
            sellerPoints: admin.firestore.FieldValue.increment(sellerPoints),
            totalPoints: admin.firestore.FieldValue.increment(sellerPoints),
            updatedAt: stamp,
          };
          if (sellerBadge.changed) {
            sellerUpdate.badgesUnlocked = sellerBadge.unlocked;
            sellerUpdate.highestBadgeTier = sellerBadge.highestTier;
            sellerUpdate.badgeTier = sellerBadge.highestTier;
            sellerUpdate.badgeUpdatedAt = stamp;
            if (!sellerData.equippedBadge && sellerBadge.highestTier) {
              sellerUpdate.equippedBadge = sellerBadge.highestTier;
            }
          }
          tx.set(sellerRef, sellerUpdate, { merge: true });

          // Record points history for the drop-off
          tx.set(historyRef, {
            productId,
            productTitle: data.productTitle || product.title || '',
            productImageUrl: product.imageUrl || product.photo || '',
            sellerId,
            buyerId: null,
            category: product.category || data.productCategory || '',
            sellerPoints,
            buyerPoints: 0,
            totalPoints: sellerPoints,
            source: 'dropoff',
            dropoffId,
            createdAt: stamp,
            ...(sellerBadge.newlyUnlocked && sellerBadge.newlyUnlocked.length > 0
              ? { sellerBadgeUnlocks: sellerBadge.newlyUnlocked, sellerBadgeHighestTier: sellerBadge.highestTier }
              : {}),
          }, { merge: true });

          sellerBadgeSummary = { ...sellerBadge, totalPoints: sellerTotalAfter };
          sellerBadgeNotifications = buildBadgeNotifications(sellerBadgeSummary, 'seller');
        }
      });
    }

    // Update the dropoff doc with final sellerPoints so SellerDashboard can display them
    if (!alreadyAwarded && sellerPoints > 0) {
      try { await dropoffRef.update({ sellerPoints }); } catch (_) { /* non-critical */ }
    }

    // Notify seller: drop-off received + points awarded
    const pointsMsg = sellerPoints > 0 && !alreadyAwarded ? ` You earned +${sellerPoints} points!` : '';
    try {
      if (data.sellerEmail) {
        const subject = '🏁 Drop-off received — points awarded!';
        const text = `Your item "${data.productTitle}" has been received at the junkshop.${pointsMsg}${adminNotes ? '\n\nAdmin Notes: ' + adminNotes : ''}`;
        const html = `<p>Your item <strong>"${data.productTitle}"</strong> has been <strong style="color:blue;">received</strong> at the junkshop.</p>${sellerPoints > 0 && !alreadyAwarded ? `<p>🎉 You earned <strong>+${sellerPoints} points</strong>!</p>` : ''}${adminNotes ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>` : ''}`;
        await sendNotificationEmail(data.sellerEmail, subject, text, html);
      }
    } catch (e) {
      console.warn('Failed to email seller about drop-off completion', e && e.message);
    }

    // In-app notification for seller
    try {
      await db.collection('notifications').add({
        userId: sellerId,
        dropoffId,
        productId,
        type: 'dropoff_completed',
        title: '🏁 Item received at junkshop!',
        message: `Your item "${data.productTitle}" has been received.${pointsMsg}${adminNotes ? ' Admin notes: ' + adminNotes : ''}`,
        sellerPoints,
        adminNotes: adminNotes || '',
        read: false,
        createdAt: stamp,
      });
    } catch (e) {
      console.warn('Failed to create seller notification for drop-off completion', e && e.message);
    }

    const updated = await dropoffRef.get();
    const updatedData = updated.data();
    res.json({
      id: dropoffId,
      ...updatedData,
      sellerPoints,
      alreadyAwarded,
      badgeNotifications: { seller: sellerBadgeNotifications },
      createdAt: updatedData.createdAt && updatedData.createdAt.toDate ? updatedData.createdAt.toDate().toISOString() : null,
      updatedAt: updatedData.updatedAt && updatedData.updatedAt.toDate ? updatedData.updatedAt.toDate().toISOString() : null,
    });
  } catch (err) {
    console.error('Error completing drop-off:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get drop-offs for the currently authenticated seller
 */
exports.getMyDropoffs = async (req, res) => {
  try {
    const sellerId = req.user && (req.user.id || req.user.uid);
    if (!sellerId) return res.status(401).json({ error: 'unauthorized' });

    const snap = await db.collection('dropoffs')
      .where('sellerId', '==', sellerId)
      .orderBy('createdAt', 'desc')
      .get();

    const dropoffs = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : null,
        updatedAt: data.updatedAt && data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : null,
      };
    });

    res.json(dropoffs);
  } catch (err) {
    console.error('getMyDropoffs error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get all drop-offs (admin view) with filtering
 */
exports.getDropoffs = async (req, res) => {
  try {
    // Admin-only endpoint
    const isAdmin = !!(req.user && (req.user.isAdmin || req.user.admin || req.user.role === 'admin' || (req.user.roles || []).includes('admin') || (req.user.customClaims && (req.user.customClaims.isAdmin || req.user.customClaims.admin || req.user.customClaims.role === 'admin'))));
    console.log('getDropoffs: isAdmin check =', isAdmin, 'user =', req.user ? { uid: req.user.uid, email: req.user.email, role: req.user.role, isAdmin: req.user.isAdmin, admin: req.user.admin } : null);
    if (!isAdmin) return res.status(403).json({ error: 'admin_only', user: req.user ? { uid: req.user.uid, email: req.user.email } : null });

    const { status, page = 0, limit = 20 } = req.query;
    const pageNum = Math.max(0, parseInt(page) || 0);
    const size = Math.max(1, parseInt(limit) || 20);

    let query = db.collection('dropoffs');
    
    // Build query - orderBy first to avoid composite index issues
    query = query.orderBy('createdAt', 'desc');
    
    if (status) {
      query = query.where('status', '==', status);
    }

    let total = 0;
    let dropoffs = [];
    
    try {
      const totalSnapshot = await query.count().get();
      total = totalSnapshot.data().count;
      
      const snapshot = await query.offset(pageNum * size).limit(size).get();
      dropoffs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : null,
          updatedAt: data.updatedAt && data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : null,
        };
      });
    } catch (queryErr) {
      // If query fails due to missing index, fall back to simple query without where clause
      console.warn('getDropoffs: composite index query failed, trying fallback:', queryErr.message);
      const simpleSnapshot = await db.collection('dropoffs').orderBy('createdAt', 'desc').get();
      let allDropoffs = simpleSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : null,
          updatedAt: data.updatedAt && data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : null,
        };
      });
      
      // Apply status filter in memory if needed
      if (status) {
        allDropoffs = allDropoffs.filter(d => d.status === status);
      }
      
      total = allDropoffs.length;
      dropoffs = allDropoffs.slice(pageNum * size, (pageNum + 1) * size);
    }

    // Enrich dropoffs with live user data (name, location, photoURL)
    // User profiles use auto-generated Firestore IDs with authId == Firebase UID
    const sellerIds = [...new Set(dropoffs.map(d => d.sellerId).filter(Boolean))];
    const sellerMap = {};
    await Promise.all(sellerIds.map(async (sid) => {
      try {
        // Try direct UID doc first
        const userDoc = await db.collection('users').doc(sid).get();
        let userData = userDoc.exists ? userDoc.data() : {};

        // If no name found, the real profile is at authId == sid (auto-gen ID from signup)
        if (!userData.name && !userData.displayName && !userData.username && !userData.fullName) {
          try {
            const byAuth = await db.collection('users').where('authId', '==', sid).limit(1).get();
            if (!byAuth.empty) {
              userData = { ...userData, ...byAuth.docs[0].data() }; // profile data wins
            }
          } catch (e) { /* ignore */ }
        }

        // Still no name? Fall back to Firebase Auth
        if (!userData.name && !userData.displayName && !userData.username && !userData.fullName) {
          try {
            const authUser = await admin.auth().getUser(sid);
            userData.name = authUser.displayName;
            userData.displayName = authUser.displayName;
            userData.photoURL = userData.photoURL || authUser.photoURL;
          } catch (e) { /* ignore */ }
        }

        sellerMap[sid] = userData;
      } catch (e) { /* ignore */ }
    }));

    dropoffs = dropoffs.map(d => {
      const s = sellerMap[d.sellerId] || {};
      const resolvedName = s.name || s.displayName || s.username || d.sellerName;
      const resolvedLocation = s.location || d.location || null;
      const resolvedPhoto = s.photoURL || s.profilePic || d.productImage ? undefined : undefined; // photo from user profile
      return {
        ...d,
        sellerName: (resolvedName && resolvedName !== 'Unknown Seller') ? resolvedName : (d.sellerName || 'Unknown Seller'),
        location: resolvedLocation,
        sellerProfilePic: s.photoURL || s.profilePic || null,
        sellerDisplayName: s.name || s.displayName || s.username || null,
      };
    });

    res.json({ page: pageNum, pageSize: size, total, items: dropoffs });
  } catch (err) {
    console.error('Error fetching drop-offs:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Approve a drop-off appointment
 */
exports.approveDropoff = async (req, res) => {
  try {
    const isAdmin = !!(req.user && (req.user.isAdmin || req.user.admin || req.user.role === 'admin' || (req.user.roles || []).includes('admin') || (req.user.customClaims && (req.user.customClaims.isAdmin || req.user.customClaims.admin || req.user.customClaims.role === 'admin'))));
    if (!isAdmin) return res.status(403).json({ error: 'admin_only' });

    const { dropoffId } = req.params;
    const { dropoffTime, adminNotes } = req.body || {};

    if (!dropoffId) return res.status(400).json({ error: 'dropoffId required' });

    const ref = db.collection('dropoffs').doc(dropoffId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'dropoff_not_found' });

    const data = doc.data();

    await ref.update({
      status: 'approved',
      dropoffTime: dropoffTime || data.dropoffTime || null,
      adminNotes: adminNotes || data.adminNotes || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Track approval on the product but do NOT activate it yet —
    // product stays 'pending' until the seller physically arrives and admin marks complete
    try {
      if (data.productId) {
        await db.collection('products').doc(data.productId).update({
          dropoffStatus: 'approved',
          dropoffApprovedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (e) {
      console.warn('Failed to update product dropoff status on approval', e && e.message);
    }

    // Notify seller about approval
    try {
      if (data.sellerEmail) {
        const subject = '✅ Drop-off appointment approved';
        const text = `Your drop-off appointment for "${data.productTitle}" on ${data.dropoffDate} at ${dropoffTime} has been approved.\n\nPlease arrive on time. ${adminNotes ? 'Additional notes: ' + adminNotes : ''}`;
        const html = `<p>Your drop-off appointment for <strong>"${data.productTitle}"</strong> has been <strong style="color:green;">APPROVED</strong>.</p><p><strong>Date:</strong> ${data.dropoffDate}<br><strong>Time:</strong> ${dropoffTime}</p>${adminNotes ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>` : ''}<p>Please arrive on time for your drop-off appointment.</p>`;
        await sendNotificationEmail(data.sellerEmail, subject, text, html);
      }
    } catch (e) {
      console.warn('Failed to email seller about drop-off approval', e && e.message);
    }

    // Create seller notification with appointment time
    try {
      await db.collection('notifications').add({
        userId: data.sellerId,
        dropoffId,
        type: 'dropoff_approved',
        title: '✅ Drop-off appointment approved',
        message: `Your drop-off appointment for "${data.productTitle}" on ${data.dropoffDate} at ${dropoffTime} has been approved. Please arrive on time.${adminNotes ? ' Admin notes: ' + adminNotes : ''}`,
        appointmentDate: data.dropoffDate,
        appointmentTime: dropoffTime,
        adminNotes: adminNotes || '',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn('Failed to create seller notification for drop-off approval', e && e.message);
    }

    const updated = await ref.get();
    const updatedData = updated.data();

    res.json({
      id: dropoffId,
      ...updatedData,
      createdAt: updatedData.createdAt && updatedData.createdAt.toDate ? updatedData.createdAt.toDate().toISOString() : null,
      updatedAt: updatedData.updatedAt && updatedData.updatedAt.toDate ? updatedData.updatedAt.toDate().toISOString() : null,
    });
  } catch (err) {
    console.error('Error approving drop-off:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Decline a drop-off appointment
 */
exports.declineDropoff = async (req, res) => {
  try {
    const isAdmin = !!(req.user && (req.user.isAdmin || req.user.admin || req.user.role === 'admin' || (req.user.roles || []).includes('admin') || (req.user.customClaims && (req.user.customClaims.isAdmin || req.user.customClaims.admin || req.user.customClaims.role === 'admin'))));
    if (!isAdmin) return res.status(403).json({ error: 'admin_only' });

    const { dropoffId } = req.params;
    const { reason, adminNotes } = req.body || {};

    if (!dropoffId) return res.status(400).json({ error: 'dropoffId required' });

    const ref = db.collection('dropoffs').doc(dropoffId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'dropoff_not_found' });

    const data = doc.data();

    await ref.update({
      status: 'declined',
      declineReason: reason || 'Not specified',
      adminNotes: adminNotes || data.adminNotes || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update product status to mark drop-off as declined
    try {
      if (data.productId) {
        await db.collection('products').doc(data.productId).update({
          archived: true,
          archivedAt: admin.firestore.FieldValue.serverTimestamp(),
          archivedReason: 'Drop-off declined by admin: ' + (reason || 'Not specified'),
          dropoffStatus: 'declined',
          dropoffDeclineReason: reason || 'Not specified',
        });
        console.log('Product archived:', data.productId);
      }
    } catch (e) {
      console.warn('Failed to archive product on drop-off decline', e && e.message);
    }

    // Notify seller about decline with detailed message
    try {
      if (data.sellerEmail) {
        const fullMessage = `Your drop-off appointment for "${data.productTitle}" on ${data.dropoffDate} at ${data.dropoffTime} has been DECLINED.\n\nDecline Reason: ${reason || 'Not specified'}\n\n${adminNotes ? 'Admin Notes: ' + adminNotes : ''}\n\nThe item has been moved to your Archive. You can restore or delete it from there.`;
        const htmlMessage = `<p>Your drop-off appointment for <strong>"${data.productTitle}"</strong> on <strong>${data.dropoffDate} at ${data.dropoffTime}</strong> has been <strong style="color:red;">DECLINED</strong>.</p><p><strong>Decline Reason:</strong> ${reason || 'Not specified'}</p>${adminNotes ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>` : ''}<p>The item has been moved to your <strong>Archive</strong>. You can restore or delete it from there.</p>`;
        await sendNotificationEmail(data.sellerEmail, '❌ Drop-off Appointment Declined', fullMessage, htmlMessage);
      }
    } catch (e) {
      console.warn('Failed to email seller about drop-off decline', e && e.message);
    }

    // Create seller notification with full details
    try {
      await db.collection('notifications').add({
        userId: data.sellerId,
        dropoffId,
        productId: data.productId,
        type: 'dropoff_declined',
        title: '❌ Drop-off appointment declined',
        message: `Your drop-off appointment for "${data.productTitle}" has been declined. Reason: ${reason || 'Not specified'}${adminNotes ? ' | Admin Notes: ' + adminNotes : ''}`,
        declineReason: reason || 'Not specified',
        adminNotes: adminNotes || '',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn('Failed to create seller notification for drop-off decline', e && e.message);
    }

    const updated = await ref.get();
    const updatedData = updated.data();

    res.json({
      id: dropoffId,
      ...updatedData,
      createdAt: updatedData.createdAt && updatedData.createdAt.toDate ? updatedData.createdAt.toDate().toISOString() : null,
      updatedAt: updatedData.updatedAt && updatedData.updatedAt.toDate ? updatedData.updatedAt.toDate().toISOString() : null,
    });
  } catch (err) {
    console.error('Error declining drop-off:', err);
    res.status(500).json({ error: err.message });
  }
};