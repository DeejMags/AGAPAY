const { admin, db } = require('../config/firebaseAdmin');
const cloudinary = require('../config/cloudinary');
const nodemailer = require('nodemailer');

// Create a nodemailer transporter if SMTP env vars are present
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function notifyAdmins(subject, text, html) {
  const toList = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (!toList.length || !transporter) {
    console.log('Admin notify skipped', { subject, toList: toList.length });
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: toList.join(','),
      subject,
      text,
      html: html || `<p>${text}</p>`,
    });
  } catch (e) { console.warn('notifyAdmins failed', e && e.message); }
}

function isAdminUser(user) {
  // Dev bypass when Firebase is disabled or auth skipped in dev
  if (process.env.DISABLE_FIREBASE === 'true' || (process.env.SKIP_AUTH === 'true' && process.env.NODE_ENV === 'development')) {
    return true;
  }
  if (!user) return false;
  const role = user.role && String(user.role).toLowerCase();
  if (role === 'admin') return true;
  if (user.isAdmin === true) return true;
  if (user.admin === true) return true;
  const rolesArr = Array.isArray(user.roles) ? user.roles.map(r => String(r).toLowerCase()) : [];
  if (rolesArr.includes('admin')) return true;
  // Env-based allow lists
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const adminUids = (process.env.ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const email = (user.email || '').toLowerCase();
  const uid = String(user.uid || user.id || '');
  if (adminEmails.includes(email)) return true;
  if (adminUids.includes(uid)) return true;
  // Custom claims attached upstream
  if (user.customClaims && (user.customClaims.role === 'admin' || user.customClaims.isAdmin === true || user.customClaims.admin === true)) return true;
  return false;
}

exports.createReport = async (req, res) => {
  try {
    const authUser = req.user || {};
    const { reportedUserId, reportedUserEmail, reportedUserName, reason, details, context } = req.body || {};
    if (!reportedUserId && !reportedUserEmail) return res.status(400).json({ error: 'reportedUserId or reportedUserEmail required' });
    if (!reason && !details) return res.status(400).json({ error: 'reason or details required' });

    const stamp = admin.firestore.FieldValue.serverTimestamp();
    const payload = {
      reporterId: authUser.uid || authUser.id || null,
      reporterEmail: authUser.email || null,
      reporterName: authUser.username || authUser.name || null,
      reportedUserId: reportedUserId || null,
      reportedUserEmail: reportedUserEmail || null,
      reportedUserName: reportedUserName || null,
      reason: reason || null,
      details: details || null,
      context: context || null,
      status: 'open',
      createdAt: stamp,
      updatedAt: stamp,
    };

    // Optional image upload via Cloudinary
    if (req.file && cloudinary && process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        const folder = process.env.CLOUDINARY_FOLDER || 'agapay';
        const opts = { folder: `${folder}/reports`, resource_type: 'image', overwrite: false, transformation: [{ quality: 'auto', fetch_format: 'auto' }] };
        const { PassThrough } = require('stream');
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(opts, (err, res) => err ? reject(err) : resolve(res));
          const pass = new PassThrough();
          pass.end(req.file.buffer);
          pass.pipe(stream);
        });
        payload.imageUrl = result.secure_url;
        payload.imagePublicId = result.public_id;
        payload.imageWidth = result.width;
        payload.imageHeight = result.height;
        payload.imageFormat = result.format;
      } catch (e) {
        console.warn('report image upload failed', e && e.message);
      }
    } else if (req.body && req.body.imageUrl) {
      // Allow direct URL fallback
      payload.imageUrl = req.body.imageUrl;
    }

    const ref = await db.collection('reports').add(payload);
    const snap = await ref.get();
    const data = snap.data() || {};

    // Notify admins
    const subject = 'New user report submitted';
    const text = `A report was filed by ${payload.reporterEmail || payload.reporterId || 'Unknown'} about ${payload.reportedUserEmail || payload.reportedUserId || 'a user'} for ${payload.reason || 'unspecified reason'}.`;
    notifyAdmins(subject, text, `<p>${text}</p>${payload.imageUrl ? `<p><a href="${payload.imageUrl}">View image</a></p>` : ''}`).catch(()=>{});

    res.status(201).json({ id: ref.id, ...data });
  } catch (e) {
    console.error('createReport error', e);
    res.status(500).json({ error: 'failed_to_create_report' });
  }
};

exports.listReports = async (req, res) => {
  try {
    if (!db) {
      return res.status(501).json({ error: 'Reporting disabled: Firestore is not configured (db unavailable).' });
    }
    const user = req.user || {};
    const uid = String(user.uid || user.id || '');
    const email = String(user.email || '');

  // In development, allow listing all reports even if admin detection isn't configured yet
  const allowAll = process.env.REPORTS_DEV_ALLOW_ALL === 'true' || process.env.NODE_ENV !== 'production';
    if (isAdminUser(user) || allowAll) {
      // Use broad fetch: support both 'reports' and legacy 'report' collection names, if any
      const itemsMap = new Map();
      async function addFromCollection(name) {
        try {
          const snap = await db.collection(name).get();
          snap.docs.forEach(d => itemsMap.set(`${name}:${d.id}`, { id: d.id, ...d.data(), __col: name }));
        } catch (e) { /* ignore missing */ }
      }
      await addFromCollection('reports');
      if (itemsMap.size === 0) await addFromCollection('report');
      const items = Array.from(itemsMap.values()).sort((a,b)=>{
        const ta = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
        const tb = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
        return tb - ta;
      });
      return res.json({ items, note: allowAll ? 'dev_allow_all' : undefined });
    }

    // Non-admin fallback: show reports you filed OR where you are the subject
    if (!uid && !email) return res.status(401).json({ error: 'unauthorized' });

    const itemsMap = new Map();
    if (uid) {
      const byReporterId = await db.collection('reports').where('reporterId', '==', uid).get();
      byReporterId.docs.forEach(d => itemsMap.set(d.id, { id: d.id, ...d.data() }));
      const byReportedId = await db.collection('reports').where('reportedUserId', '==', uid).get();
      byReportedId.docs.forEach(d => itemsMap.set(d.id, { id: d.id, ...d.data() }));
    }
    if (email) {
      const byReporterEmail = await db.collection('reports').where('reporterEmail', '==', email).get();
      byReporterEmail.docs.forEach(d => itemsMap.set(d.id, { id: d.id, ...d.data() }));
      const byReportedEmail = await db.collection('reports').where('reportedUserEmail', '==', email).get();
      byReportedEmail.docs.forEach(d => itemsMap.set(d.id, { id: d.id, ...d.data() }));
    }
    const items = Array.from(itemsMap.values()).sort((a,b)=>{
      const ta = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
      const tb = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
      return tb - ta;
    });
    return res.json({ items, note: 'limited_to_own_reports' });
  } catch (e) {
    console.error('listReports error', e);
    res.status(500).json({ error: 'failed_to_list_reports' });
  }
};

exports.updateReport = async (req, res) => {
  try {
    const allowAll = process.env.REPORTS_DEV_ALLOW_ALL === 'true' || process.env.NODE_ENV !== 'production';
    if (!isAdminUser(req.user) && !allowAll) return res.status(403).json({ error: 'forbidden' });
    const { id } = req.params;
    const { status } = req.body || {};
    const ref = db.collection('reports').doc(String(id));
    const stamp = admin.firestore.FieldValue.serverTimestamp();
    await ref.set({ status: status || 'open', updatedAt: stamp }, { merge: true });
    const snap = await ref.get();
    res.json({ id: snap.id, ...snap.data() });
  } catch (e) {
    console.error('updateReport error', e);
    res.status(500).json({ error: 'failed_to_update_report' });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const allowAll = process.env.REPORTS_DEV_ALLOW_ALL === 'true' || process.env.NODE_ENV !== 'production';
    if (!isAdminUser(req.user) && !allowAll) return res.status(403).json({ error: 'forbidden' });
    const { id } = req.params;
    await db.collection('reports').doc(String(id)).delete();
    res.json({ ok: true });
  } catch (e) {
    console.error('deleteReport error', e);
    res.status(500).json({ error: 'failed_to_delete_report' });
  }
};
