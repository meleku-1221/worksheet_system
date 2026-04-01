// NOTE: This file uses the Firebase CDN (global `firebase` namespace).
// Add these scripts to your HTML before this script:
// <script src="https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/11.0.0/firebase-storage-compat.js"></script>


// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDvHACAO05OYh5N9Xk_El3XaiHwJK8VfmY",
  authDomain: "online-worksheet--system.firebaseapp.com",
  projectId: "online-worksheet--system",
  storageBucket: "online-worksheet--system.firebasestorage.app",
  messagingSenderId: "1098490363098",
  appId: "1:1098490363098:web:0332425f28580f21a179e3",
//   measurementId: "G-4PJFRKL6KH"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

let user = null;
const EXPIRY_DAYS = 3; // change days here

/* REGISTER */
async function register(){
let name = document.getElementById("name").value;
let id = document.getElementById("id").value;
let role = document.getElementById("role").value;
let grade = document.getElementById("grade").value;
let section = document.getElementById("section").value;

if(!name || !id || !role || !grade || !section){
alert("Fill all fields");
return;
}

try {
  // Check if ID exists
  const querySnapshot = await db.collection('users').where('id', '==', id).get();
  if (!querySnapshot.empty) {
    alert("ID exists");
    return;
  }

  // Add user to Firestore
  await db.collection('users').add({name, id, role, grade, section});
  alert("Registered!");
  window.location.href="login.html";
} catch (error) {
  console.error("Error registering user:", error);
  alert("Registration failed. Try again.");
}
}

/* LOGIN */
async function login(){
let id = document.getElementById("loginId").value;

try {
  const querySnapshot = await db.collection('users').where('id', '==', id).get();
  if (querySnapshot.empty) {
    alert("User not found");
    return;
  }

  const found = querySnapshot.docs[0].data();
  localStorage.setItem("currentUser", JSON.stringify(found));  // Keep for session
  window.location.href="dashboard.html";
} catch (error) {
  console.error("Error logging in:", error);
  alert("Login failed. Try again.");
}
}

/* LOAD USER */
(async () => {
  if(window.location.pathname.includes("dashboard")){
    user = JSON.parse(localStorage.getItem("currentUser"));

    if(!user){
      window.location.href="login.html";
    }else{
      // Render welcome message
      const welcomeEl = document.getElementById("welcome");
      if (welcomeEl) {
        welcomeEl.innerHTML =
          `<span>${user.name}</span> &mdash; ${user.role} &bull; ${user.grade} ${user.section}`;
      }

      // Initialize element references
      window.teacherTable = document.getElementById('teacherTable');
      window.studentTable = document.getElementById('studentTable');
      window.fileInput    = document.getElementById('fileInput');

      // Drag & Drop
      const dropZone = document.getElementById('dropZone');
      if (dropZone && fileInput) {
        dropZone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropZone.classList.remove('dragover');
          const dt = e.dataTransfer;
          if (dt.files.length) {
            // Assign dropped file to the input
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(dt.files[0]);
            fileInput.files = dataTransfer.files;
            document.getElementById('fileName').textContent = '✓ ' + dt.files[0].name;
          }
        });
        fileInput.addEventListener('change', () => {
          if (fileInput.files[0]) {
            document.getElementById('fileName').textContent = '✓ ' + fileInput.files[0].name;
          }
        });
      }

      await cleanupOldFiles();
      await loadFiles();
    }
  }
})();

/* LOGOUT */
function logout(){
  localStorage.removeItem("currentUser");
  window.location.href="login.html";
}

/* TOAST NOTIFICATION */
let _toastTimer = null;
function showToast(message, type = 'loading') {
  const toast   = document.getElementById('uploadStatus');
  const spinner = document.getElementById('statusSpinner');
  const textEl  = document.getElementById('statusText');
  if (!toast) return;

  if (_toastTimer) clearTimeout(_toastTimer);

  toast.className = 'show';
  textEl.textContent = message;

  if (type === 'loading') {
    spinner.style.display = 'block';
    toast.classList.remove('success', 'error');
    // Safety: auto-dismiss after 30s in case something silently fails
    _toastTimer = setTimeout(() => { toast.className = ''; }, 30000);
  } else if (type === 'success') {
    spinner.style.display = 'none';
    toast.classList.add('success');
    toast.classList.remove('error');
    _toastTimer = setTimeout(() => { toast.className = ''; }, 3500);
  } else if (type === 'error') {
    spinner.style.display = 'none';
    toast.classList.add('error');
    toast.classList.remove('success');
    _toastTimer = setTimeout(() => { toast.className = ''; }, 4000);
  }
}

/* UPLOAD */
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

async function uploadFile(){
  let file = fileInput.files[0];
  let subject = document.getElementById("subject").value;

  if(!file && !subject){
    showToast('⚠️ Please choose a file and select a subject first.', 'error');
    return;
  }
  if(!file){
    showToast('⚠️ No file selected. Click the upload area to pick a file.', 'error');
    return;
  }
  if(!subject){
    showToast('⚠️ Please select a subject before uploading.', 'error');
    return;
  }

  const btn = document.getElementById('uploadBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }
  showToast('Uploading file...', 'loading');

  try {
    const content = await readFileAsDataURL(file);

    await db.collection('files').add({
      name: file.name,
      content: content,
      grade: user.grade,
      section: user.section,
      subject,
      user: user.name,
      role: user.role,
      owner: user.id,
      uploadTime: Date.now()
    });

    await cleanupOldFiles();
    await loadFiles();

    // Reset upload form
    fileInput.value = '';
    document.getElementById('fileName').textContent = '';
    document.getElementById('subject').value = '';

    showToast(`✅ "${file.name}" uploaded successfully!`, 'success');
  } catch (error) {
    console.error("Error uploading file:", error);
    showToast('❌ Upload failed — check your connection and try again.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⬆ Upload File'; }
  }
}

/* AUTO DELETE OLD FILES */
async function cleanupOldFiles(){
try {
  const now = Date.now();
  const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const querySnapshot = await db.collection('files').get();

  for (const document of querySnapshot.docs) {
    const fileData = document.data();
    if (now - fileData.uploadTime >= expiryMs) {
      // Delete from Firestore
      await db.collection('files').doc(document.id).delete();
      // If using Storage urls (legacy), try delete; ignore failures
      if (fileData.url) {
        try {
          const fileRef = storage.refFromURL(fileData.url);
          await fileRef.delete();
        } catch (e) {
          console.warn('Storage delete failed for', fileData.url, e);
        }
      }
    }
  }
} catch (error) {
  console.error("Error cleaning up old files:", error);
}
}

/* LOAD FILES */
async function loadFiles(){
  teacherTable.innerHTML = '';
  studentTable.innerHTML = '';

  try {
    const querySnapshot = await db.collection('files')
      .where('grade', '==', user.grade)
      .where('section', '==', user.section)
      .get();

    let teacherCount = 0, studentCount = 0;

    querySnapshot.forEach((docSnapshot) => {
      const f = docSnapshot.data();
      const tr = document.createElement('tr');

      const canDelete = user.id === f.owner || user.role === 'admin';

      tr.innerHTML = `
        <td><span class="file-name" title="${f.name}">${f.name}</span></td>
        <td>${f.grade}</td>
        <td>${f.section}</td>
        <td>${f.subject}</td>
        <td>${f.user}</td>
        <td>${f.owner}</td>
        <td>
          <button class="btn-sm btn-download" onclick="downloadFile('${docSnapshot.id}')">⬇ Download</button>
          ${canDelete ? `<button class="btn-sm btn-delete" onclick="deleteFile('${docSnapshot.id}')">🗑 Delete</button>` : ''}
        </td>
      `;

      if (f.role === 'teacher') {
        // Teacher files are visible to everyone in the class
        teacherTable.appendChild(tr);
        teacherCount++;
      } else {
        // Student files: students only see their own; teachers & admins see all
        const canSeeStudentFile = user.role !== 'student' || f.owner === user.id;
        if (canSeeStudentFile) {
          studentTable.appendChild(tr);
          studentCount++;
        }
      }
    });

    // Update counters & empty states
    const tc = document.getElementById('teacherCount');
    const sc = document.getElementById('studentCount');
    const te = document.getElementById('teacherEmpty');
    const se = document.getElementById('studentEmpty');

    if (tc) tc.textContent = teacherCount ? `${teacherCount} file${teacherCount > 1 ? 's' : ''}` : '';
    if (sc) sc.textContent = studentCount ? `${studentCount} file${studentCount > 1 ? 's' : ''}` : '';
    if (te) te.style.display = teacherCount === 0 ? 'block' : 'none';
    if (se) se.style.display = studentCount === 0 ? 'block' : 'none';

  } catch (error) {
    console.error('Error loading files:', error);
  }
}

/* DOWNLOAD */
async function downloadFile(docId){
  try {
    const doc = await db.collection('files').doc(docId).get();
    if (!doc.exists) return;
    const f = doc.data();

    if (f.content) {
      const a = document.createElement('a');
      a.href = f.content;
      a.download = f.name;
      a.click();
    } else if (f.url) {
      const a = document.createElement('a');
      a.href = f.url;
      a.download = f.name;
      a.click();
    } else {
      alert('No file content available for download.');
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    alert('Download failed. Try again.');
  }
}

/* DELETE */
async function deleteFile(docId){
  if(confirm("Delete file?")){
    try {
      // Delete from Firestore
      await db.collection('files').doc(docId).delete();
      await loadFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Delete failed. Try again.");
    }
  }
}