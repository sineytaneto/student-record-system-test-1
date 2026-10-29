// ==========================================
// 1. FIREBASE INITIALIZATION WITH YOUR CONFIG
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDoxmg4vrOJI8qYOrIJQMvxqPFI9WcRIbs",
  authDomain: "student-record-system-9e3cd.firebaseapp.com",
  projectId: "student-record-system-9e3cd",
  storageBucket: "student-record-system-9e3cd.firebasestorage.app",
  messagingSenderId: "136299612704",
  appId: "1:136299612704:web:42ffcaf03f35e5b22c4a45",
  measurementId: "G-H0JK04G4WC"
};

// Initialize Firebase & Firestore
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Global App State
let currentRole = 'student';
let currentUser = null;
let selectedFileBase64 = null;
let selectedFileName = '';
let activeSubjectToUpload = '';
let activeReviewId = null;
let activeReviewFileUrl = '';
let activeReviewFileName = '';

// ==========================================
// 2. AUTHENTICATION & STRICT VALIDATION
// ==========================================
function setRole(role) {
  currentRole = role;
  document.getElementById('btn-role-student').classList.toggle('active', role === 'student');
  document.getElementById('btn-role-teacher').classList.toggle('active', role === 'teacher');
}

function toggleAuthMode(mode) {
  document.getElementById('tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('tab-signup').classList.toggle('active', mode === 'signup');
  
  document.getElementById('login-form-container').style.display = mode === 'login' ? 'block' : 'none';
  document.getElementById('signup-form-container').style.display = mode === 'signup' ? 'block' : 'none';
}

function clearAuthInputs() {
  document.getElementById('login-identifier').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('signup-fullname').value = '';
  document.getElementById('signup-email').value = '';
  document.getElementById('signup-password').value = '';
}

function togglePasswordVisibility(inputId, iconElem) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    iconElem.classList.remove('fa-eye');
    iconElem.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    iconElem.classList.remove('fa-eye-slash');
    iconElem.classList.add('fa-eye');
  }
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

async function handleSignup(e) {
  e.preventDefault();
  const fullname = document.getElementById('signup-fullname').value.trim();
  const email = document.getElementById('signup-email').value.trim().toLowerCase();
  const password = document.getElementById('signup-password').value;

  if (!fullname || !email || !password) {
    alert('Please fill out all registration fields.');
    return;
  }

  if (!validateEmail(email)) {
    alert('Please enter a valid email address (e.g., user@gmail.com).');
    return;
  }

  if (password.length < 6) {
    alert('Password must be at least 6 characters long.');
    return;
  }

  try {
    const userDoc = await db.collection("users").doc(email).get();
    if (userDoc.exists) {
      alert('This email address is already registered! Please use a different email or log in.');
      return;
    }

    const newUser = {
      fullname,
      email,
      password,
      role: currentRole,
      photoUrl: '',
      phone: '',
      bio: ''
    };

    await db.collection("users").doc(email).set(newUser);
    alert(`Account created successfully! Welcome, ${fullname}. Logging you in...`);
    clearAuthInputs();
    loginUser(newUser);
  } catch (error) {
    console.error("Firestore Signup Error:", error);
    alert("Error creating account. Please verify network connection.");
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const identifier = document.getElementById('login-identifier').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;

  if (!identifier || !password) {
    alert('Please enter both email/username and password.');
    return;
  }

  try {
    let userDoc = await db.collection("users").doc(identifier).get();
    let user = null;
    
    if (userDoc.exists) {
      user = userDoc.data();
    } else {
      const snapshot = await db.collection("users").where("email", "==", identifier).get();
      if (!snapshot.empty) {
        user = snapshot.docs[0].data();
      } else {
        const snapshotName = await db.collection("users").where("fullname", "==", identifier).get();
        if (!snapshotName.empty) {
          user = snapshotName.docs[0].data();
        }
      }
    }

    if (!user) {
      alert('Account not found! Please check your credentials or sign up.');
      return;
    }

    if (user.password !== password) {
      alert('Incorrect password! Please try again.');
      return;
    }

    if (user.role !== currentRole) {
      alert(`Role mismatch! This account is registered as a ${user.role}. Please select the correct role tab.`);
      return;
    }

    clearAuthInputs();
    loginUser(user);
  } catch (error) {
    console.error("Firestore Login Error:", error);
    alert("Login failed. Check your connection.");
  }
}

function loginUser(user) {
  currentUser = user;
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('app-view').style.display = 'flex';

  updateUserHeaderDisplay();
  setupSidebar(user.role);
  attachRealtimeListeners();

  if (user.role === 'teacher') {
    document.getElementById('teacher-welcome-title').innerText = `Good morning, ${user.fullname}!`;
    switchView('teacher-dashboard');
  } else {
    document.getElementById('student-welcome-title').innerText = `Good morning, ${user.fullname}!`;
    switchView('student-dashboard');
  }
}

function logout() {
  currentUser = null;
  document.getElementById('app-view').style.display = 'none';
  document.getElementById('login-view').style.display = 'flex';
  clearAuthInputs();
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  sidebar.classList.toggle('active');
}

// ==========================================
// 3. REAL-TIME FIRESTORE LISTENERS
// ==========================================
function attachRealtimeListeners() {
  db.collection("schedules").onSnapshot(snapshot => {
    const schedules = [];
    snapshot.forEach(doc => schedules.push({ id: doc.id, ...doc.data() }));
    renderSchedulesUI(schedules);
  });

  db.collection("submissions").onSnapshot(snapshot => {
    const submissions = [];
    snapshot.forEach(doc => submissions.push({ id: doc.id, ...doc.data() }));
    renderSubmissionsUI(submissions);
  });

  db.collection("attendance").onSnapshot(snapshot => {
    const attendance = [];
    snapshot.forEach(doc => attendance.push({ id: doc.id, ...doc.data() }));
    renderAttendanceUI(attendance);
  });
}

// ==========================================
// 4. TEACHER-OWNED SUBJECT & SCHEDULE MANAGER
// ==========================================
async function promptAddSchedule() {
  if (currentUser.role !== 'teacher') return;

  const subject = prompt("Enter Subject Name:");
  if (!subject || !subject.trim()) return;

  const time = prompt("Enter Schedule Time (e.g., 8:00 AM - 10:00 AM):");
  if (!time || !time.trim()) return;

  await db.collection("schedules").add({
    subject: subject.trim(),
    time: time.trim(),
    teacherEmail: currentUser.email,
    teacherName: currentUser.fullname,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert('Subject & Schedule added successfully!');
}

async function removeSchedule(docId) {
  if (currentUser.role !== 'teacher') return;
  await db.collection("schedules").doc(docId).delete();
}

function renderSchedulesUI(schedules) {
  const studentSchedList = document.getElementById('dashboard-schedule-list');
  if (studentSchedList) {
    studentSchedList.innerHTML = schedules.length === 0 ? '<p class="sub-text">No subjects/schedules created by teachers yet.</p>' : '';
    schedules.forEach(s => {
      studentSchedList.innerHTML += `
        <div class="schedule-item">
          <div>
            <strong>${s.subject}</strong>
            <div class="sub-text">Teacher: ${s.teacherName || 'Faculty Member'}</div>
          </div>
          <span>${s.time}</span>
        </div>
      `;
    });
  }

  const teacherSchedTable = document.getElementById('teacher-schedule-table');
  if (teacherSchedTable && currentUser && currentUser.role === 'teacher') {
    const mySchedules = schedules.filter(s => s.teacherEmail === currentUser.email);
    teacherSchedTable.innerHTML = mySchedules.length === 0 ? '<tr><td colspan="3" style="text-align:center;">You have not created any subjects yet. Click "+ Add Class Schedule" to add one.</td></tr>' : '';
    
    mySchedules.forEach(s => {
      teacherSchedTable.innerHTML += `
        <tr>
          <td><strong>${s.subject}</strong></td>
          <td>${s.time}</td>
          <td><button class="btn-sm" style="color:#dc2626; border-color:#fca5a5;" onclick="removeSchedule('${s.id}')">Delete</button></td>
        </tr>
      `;
    });

    const statCount = document.getElementById('stat-schedules-count');
    if (statCount) statCount.innerText = mySchedules.length;
  }
}

// ==========================================
// 5. SUBMISSIONS & FILE DOWNLOAD FIX
// ==========================================
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    selectedFileName = file.name;
    document.getElementById('upload-file-label').innerText = selectedFileName;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
      selectedFileBase64 = evt.target.result;
    };
    reader.readAsDataURL(file);
  }
}

async function submitRequirement() {
  if (!selectedFileBase64 || !selectedFileName) {
    alert('Please choose a file to upload first.');
    return;
  }

  const submissionData = {
    studentName: currentUser.fullname,
    studentEmail: currentUser.email,
    subject: activeSubjectToUpload,
    fileName: selectedFileName,
    fileData: selectedFileBase64,
    status: 'Pending',
    remarks: '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const docRef = `${currentUser.email}_${activeSubjectToUpload.replace(/\s+/g, '_')}`;
  await db.collection("submissions").doc(docRef).set(submissionData);

  alert(`Requirement for ${activeSubjectToUpload} uploaded successfully!`);
  selectedFileBase64 = null;
  selectedFileName = '';
  switchView('student-dashboard');
}

function downloadSubmissionFile() {
  if (!activeReviewFileUrl) {
    alert('No downloadable file attached or file is missing.');
    return;
  }
  const a = document.createElement('a');
  a.href = activeReviewFileUrl;
  a.download = activeReviewFileName || 'Submission_Document';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function filterStudentSubjects() {
  const query = document.getElementById('subject-search-input')?.value.toLowerCase() || '';
  db.collection("schedules").get().then(snapshot => {
    const schedules = [];
    snapshot.forEach(doc => schedules.push({ id: doc.id, ...doc.data() }));
    db.collection("submissions").get().then(subSnap => {
      const submissions = [];
      subSnap.forEach(d => submissions.push({ id: d.id, ...d.data() }));
      renderStudentSubjectTable(schedules, submissions, query);
    });
  });
}

function renderStudentSubjectTable(schedules, submissions, searchQuery = '') {
  const studentSubjList = document.getElementById('student-subjects-list');
  if (!studentSubjList || !currentUser) return;

  studentSubjList.innerHTML = '';
  
  if (schedules.length === 0) {
    studentSubjList.innerHTML = '<tr><td colspan="4" style="text-align:center;">No active subjects created by teachers yet.</td></tr>';
    document.getElementById('student-progress-val').innerText = '0%';
    document.getElementById('student-progress-sub').innerText = '0 subjects approved';
    return;
  }

  const filtered = schedules.filter(s => s.subject.toLowerCase().includes(searchQuery) || (s.teacherName && s.teacherName.toLowerCase().includes(searchQuery)));
  
  let approvedCount = 0;

  filtered.forEach(s => {
    const rec = submissions.find(sub => sub.studentEmail === currentUser.email && sub.subject === s.subject);
    const status = rec ? rec.status : 'Pending';
    if (status === 'Approved') approvedCount++;

    let badgeClass = status === 'Approved' ? 'badge-approved' : (status === 'Under Review' ? 'badge-review' : 'badge-pending');

    studentSubjList.innerHTML += `
      <tr>
        <td><strong>${s.subject}</strong></td>
        <td>${s.teacherName || 'Faculty Member'}</td>
        <td><span class="badge ${badgeClass}">${status}</span></td>
        <td><button class="btn-sm" onclick="prepareUpload('${s.subject}')">View / Submit</button></td>
      </tr>
    `;
  });

  const totalSubjects = schedules.length;
  const percent = totalSubjects > 0 ? Math.round((approvedCount / totalSubjects) * 100) : 0;
  document.getElementById('student-progress-val').innerText = `${percent}%`;
  document.getElementById('student-progress-sub').innerText = `${approvedCount} of ${totalSubjects} subjects approved`;
  const circ = document.querySelector('.circle-progress');
  if (circ) circ.style.background = `conic-gradient(var(--accent-blue) ${percent}%, #e2e8f0 0)`;
}

function renderSubmissionsUI(submissions) {
  db.collection("schedules").get().then(snapshot => {
    const schedules = [];
    snapshot.forEach(doc => schedules.push({ id: doc.id, ...doc.data() }));
    renderStudentSubjectTable(schedules, submissions);
  });

  const teacherSubList = document.getElementById('teacher-submissions-list');
  if (teacherSubList && currentUser && currentUser.role === 'teacher') {
    db.collection("schedules").where("teacherEmail", "==", currentUser.email).get().then(schedSnap => {
      const mySubjectNames = [];
      schedSnap.forEach(d => mySubjectNames.push(d.data().subject));

      const mySubmissions = submissions.filter(sub => mySubjectNames.includes(sub.subject));
      teacherSubList.innerHTML = mySubmissions.length === 0 ? '<tr><td colspan="5" style="text-align:center;">No submissions for your subjects yet.</td></tr>' : '';

      let pending = 0, approved = 0;
      mySubmissions.forEach(sub => {
        if (sub.status === 'Pending' || sub.status === 'Under Review') pending++;
        if (sub.status === 'Approved') approved++;

        let badgeClass = sub.status === 'Approved' ? 'badge-approved' : 'badge-pending';
        teacherSubList.innerHTML += `
          <tr>
            <td>${sub.studentName}</td>
            <td>${sub.subject}</td>
            <td>${sub.fileName}</td>
            <td><span class="badge ${badgeClass}">${sub.status}</span></td>
            <td><button class="btn-sm" onclick="openTeacherReview('${sub.id}')">Review</button></td>
          </tr>
        `;
      });

      const pElem = document.getElementById('stat-pending-count');
      const aElem = document.getElementById('stat-approved-count');
      if (pElem) pElem.innerText = pending;
      if (aElem) aElem.innerText = approved;
    });
  }
}

async function updateRequirementStatus(status) {
  if (!activeReviewId) return;

  const remarks = document.getElementById('teacher-remarks').value;
  await db.collection("submissions").doc(activeReviewId).update({
    status: status,
    remarks: remarks,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert(`Status updated to ${status}!`);
  switchView('teacher-dashboard');
}

// ==========================================
// 6. ATTENDANCE & PROFILE
// ==========================================
async function markSelfAttendance() {
  if (!currentUser) return;
  const todayStr = new Date().toLocaleDateString();
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const docId = `${currentUser.email}_${todayStr.replace(/\//g, '-')}`;

  await db.collection("attendance").doc(docId).set({
    userName: currentUser.fullname,
    userEmail: currentUser.email,
    date: todayStr,
    time: timeStr,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert('Attendance recorded!');
}

function renderAttendanceUI(records) {
  const tbody = document.getElementById('attendance-history-list');
  if (!tbody || !currentUser) return;

  const userRecords = records.filter(r => currentUser.role === 'teacher' ? true : r.userEmail === currentUser.email);
  tbody.innerHTML = userRecords.length === 0 ? '<tr><td colspan="4" style="text-align:center;">No attendance records found.</td></tr>' : '';

  userRecords.forEach(rec => {
    tbody.innerHTML += `
      <tr>
        <td>${rec.date}</td>
        <td>${rec.userName}</td>
        <td>${rec.time}</td>
        <td><span class="badge badge-approved">Present</span></td>
      </tr>
    `;
  });
}

function handleProfilePhotoUpload(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = async function(evt) {
      const base64Photo = evt.target.result;
      currentUser.photoUrl = base64Photo;
      await db.collection("users").doc(currentUser.email).update({ photoUrl: base64Photo });
      updateUserHeaderDisplay();
      alert('Profile picture updated!');
    };
    reader.readAsDataURL(file);
  }
}

async function saveProfileChanges(e) {
  e.preventDefault();
  const newName = document.getElementById('profile-input-fullname').value.trim();
  const newPhone = document.getElementById('profile-input-phone').value.trim();
  const newBio = document.getElementById('profile-input-bio').value.trim();

  currentUser.fullname = newName;
  currentUser.phone = newPhone;
  currentUser.bio = newBio;

  await db.collection("users").doc(currentUser.email).update({
    fullname: newName,
    phone: newPhone,
    bio: newBio
  });

  updateUserHeaderDisplay();
  alert('Profile updated successfully!');
}

function updateUserHeaderDisplay() {
  if (!currentUser) return;
  document.getElementById('nav-name').innerText = currentUser.fullname;
  document.getElementById('nav-role').innerText = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
  document.getElementById('nav-avatar').innerText = currentUser.fullname.charAt(0).toUpperCase();

  const profileImg = document.getElementById('profile-img-preview');
  const profileAvatar = document.getElementById('profile-avatar-big');
  if (currentUser.photoUrl) {
    profileImg.src = currentUser.photoUrl;
    profileImg.style.display = 'block';
    profileAvatar.style.display = 'none';
  } else {
    profileImg.style.display = 'none';
    profileAvatar.style.display = 'flex';
    profileAvatar.innerText = currentUser.fullname.charAt(0).toUpperCase();
  }

  document.getElementById('profile-fullname-text').innerText = currentUser.fullname;
  document.getElementById('profile-role-text').innerText = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
  document.getElementById('profile-input-fullname').value = currentUser.fullname;
  document.getElementById('profile-input-email').value = currentUser.email || '';
  document.getElementById('profile-input-phone').value = currentUser.phone || '';
  document.getElementById('profile-input-bio').value = currentUser.bio || '';
}

function setupSidebar(role) {
  const menu = document.getElementById('sidebar-menu');
  if (role === 'student') {
    menu.innerHTML = `
      <a class="nav-item active" onclick="switchView('student-dashboard')"><i class="fa-solid fa-house"></i> <span>Dashboard</span></a>
      <a class="nav-item" onclick="switchView('student-submit-req')"><i class="fa-solid fa-file-arrow-up"></i> <span>Submit Requirements</span></a>
      <a class="nav-item" onclick="switchView('attendance-view')"><i class="fa-solid fa-user-check"></i> <span>Attendance</span></a>
      <a class="nav-item" onclick="switchView('profile-view')"><i class="fa-solid fa-user"></i> <span>Profile</span></a>
    `;
  } else {
    menu.innerHTML = `
      <a class="nav-item active" onclick="switchView('teacher-dashboard')"><i class="fa-solid fa-house"></i> <span>Dashboard</span></a>
      <a class="nav-item" onclick="switchView('attendance-view')"><i class="fa-solid fa-user-check"></i> <span>Attendance Records</span></a>
      <a class="nav-item" onclick="switchView('profile-view')"><i class="fa-solid fa-user"></i> <span>Profile</span></a>
    `;
  }
}

function switchView(viewId) {
  const views = document.querySelectorAll('.view-section');
  views.forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');

  // Close mobile sidebar on navigation click
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) sidebar.classList.remove('active');
}

function prepareUpload(sub) {
  activeSubjectToUpload = sub;
  document.getElementById('upload-subject-title').innerText = sub;
  document.getElementById('upload-file-label').innerText = 'Choose File';
  selectedFileBase64 = null;
  selectedFileName = '';
  switchView('student-submit-req');
}

async function openTeacherReview(id) {
  activeReviewId = id;
  const doc = await db.collection("submissions").doc(id).get();
  if (doc.exists) {
    const data = doc.data();
    document.getElementById('review-student-name').innerText = data.studentName;
    document.getElementById('review-subject').innerText = `Subject: ${data.subject}`;
    document.getElementById('review-file-name').innerText = data.fileName;
    document.getElementById('teacher-remarks').value = data.remarks || '';
    
    activeReviewFileUrl = data.fileData || '';
    activeReviewFileName = data.fileName || 'document';
    switchView('teacher-review-req');
  }
}
