const express = require('express');
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.appspot.com`
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const app = express();
app.use(express.json());

// Simple endpoint to list files
app.get('/files', async (req, res) => {
  try {
    const snapshot = await db.collection('files').get();
    const files = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(files);
  } catch (e) {
    console.error(e);
    res.status(500).send('error');
  }
});

// Endpoint to delete old files older than EXPIRY_DAYS (default 3)
app.post('/cleanup', async (req, res) => {
  const EXPIRY_DAYS = req.body.expiryDays || 3;
  const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();

  try {
    const snapshot = await db.collection('files').get();
    const deletes = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (now - data.uploadTime >= expiryMs) {
        deletes.push(db.collection('files').doc(doc.id).delete());
        if (data.url) {
          // delete from storage by file path extracted from URL
          try {
            const file = bucket.file(decodeURIComponent(new URL(data.url).pathname.replace(/^\//, '')));
            deletes.push(file.delete().catch(err => console.warn('storage delete failed', err)));
          } catch (e) {
            console.warn('invalid url for storage delete', data.url, e);
          }
        }
      }
    }

    await Promise.all(deletes);
    res.json({ deleted: deletes.length });
  } catch (e) {
    console.error(e);
    res.status(500).send('error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Admin server listening on ${PORT}`));
