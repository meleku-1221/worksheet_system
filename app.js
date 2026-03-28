// NOTE: This file uses the Firebase CDN (global `firebase` namespace).
// Add these scripts to your HTML before this script:
// <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js"></script>


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
      document.getElementById("welcome").innerText =
      `Welcome ${user.name} (${user.role}) - ${user.grade} ${user.section}`;

      // initialize element references used on dashboard
      window.teacherTable = document.getElementById('teacherTable');
      window.studentTable = document.getElementById('studentTable');
      window.fileInput = document.getElementById('fileInput');

      await cleanupOldFiles(); // 🔥 AUTO DELETE RUN HERE
      await loadFiles();
    }
  }
})();

/* LOGOUT */
function logout(){
localStorage.removeItem("currentUser");
window.location.href="login.html";
}

/* UPLOAD */
async function uploadFile(){
let file = fileInput.files[0];
let subject = document.getElementById("subject").value;

if(!file || !subject){
alert("Select file and subject");
return;
}

try {
  // Upload to Firebase Storage
  const storageRef = storage.ref(`files/${Date.now()}_${file.name}`);
  await storageRef.put(file);
  const downloadURL = await storageRef.getDownloadURL();

  // Save metadata to Firestore
  await db.collection('files').add({
    name: file.name,
    url: downloadURL,
    grade: user.grade,
    section: user.section,
    subject,
    user: user.name,
    role: user.role,
    owner: user.id,
    uploadTime: Date.now()
  });

  await cleanupOldFiles(); // Run after upload
  await loadFiles();
  alert("File uploaded!");
} catch (error) {
  console.error("Error uploading file:", error);
  alert("Upload failed. Try again.");
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
      // Delete from Storage (use refFromURL)
      try {
        const fileRef = storage.refFromURL(fileData.url);
        await fileRef.delete();
      } catch (e) {
        // ignore storage delete errors
        console.warn('Storage delete failed for', fileData.url, e);
      }
    }
  }
} catch (error) {
  console.error("Error cleaning up old files:", error);
}
}

/* LOAD FILES */
async function loadFiles(){
  teacherTable.innerHTML="";
  studentTable.innerHTML="";

  try {
    const querySnapshot = await db.collection('files')
      .where('grade', '==', user.grade)
      .where('section', '==', user.section)
      .get();

    querySnapshot.forEach((document) => {
      const f = document.data();
      let tr = document.createElement("tr");

      tr.innerHTML = `
<td>${f.name}</td>
<td>${f.grade}</td>
<td>${f.section}</td>
<td>${f.subject}</td>
<td>${f.user}</td>
<td>
<button onclick="downloadFile('${f.url}', '${f.name}')">Download</button>
${(user.id === f.owner || user.role === "admin") ?
`<button class="deleteBtn" onclick="deleteFile('${document.id}', '${f.url}')">Delete</button>` : ""}
</td>
`;

      if(f.role === "teacher"){
        teacherTable.appendChild(tr);
      } else {
        studentTable.appendChild(tr);
      }
    });
  } catch (error) {
    console.error("Error loading files:", error);
  }
}

/* DOWNLOAD */
function downloadFile(url, name){
  let a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}

/* DELETE */
async function deleteFile(docId, url){
  if(confirm("Delete file?")){
    try {
      // Delete from Firestore
      await db.collection('files').doc(docId).delete();
      // Delete from Storage
      try {
        const fileRef = storage.refFromURL(url);
        await fileRef.delete();
      } catch (e) {
        console.warn('Storage delete failed', e);
      }
      await loadFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Delete failed. Try again.");
    }
  }
}