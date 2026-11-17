
// ==========================================
// M.S.D. ENGLISH ACADEMY
// STUDENT + SUPER ADMIN LOGIN SYSTEM
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyDUbpRqEsJpPWiug7HnQMMcfAP6MsQKnCk",
  authDomain: "school-management-system-a02e7.firebaseapp.com",
  projectId: "school-management-system-a02e7",
  storageBucket: "school-management-system-a02e7.firebasestorage.app",
  messagingSenderId: "958260851540",
  appId: "1:958260851540:web:a5a1ee0719f29fc2588ec1",
  measurementId: "G-PMY610FVNQ"
};

// FIREBASE INITIALIZATION
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

const $ = id => document.getElementById(id);

let currentUser = null;
let currentRole = null;
let studentProfile = null;
let loginInProgress = false;

// ==========================================
// COMMON FUNCTIONS
// ==========================================

function on(id, eventName, callback) {
  const element = $(id);

  if (element) {
    element.addEventListener(eventName, callback);
  }
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanRollNumber(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function studentLoginEmail(roll) {
  return cleanRollNumber(roll).toLowerCase()
    + "@students.msd-school.app";
}

function showMessage(id, message, success = false) {
  const element = $(id);

  if (!element) return;

  element.textContent = message;
  element.className = success ? "success" : "message";
}

// ==========================================
// SCREEN NAVIGATION - FIXED
// ==========================================

function showScreen(screenId) {
  const screens = [
    "loginPage",
    "adminLoginPage",
    "studentDashboard",
    "adminDashboard"
  ];

  screens.forEach(id => {
    const screen = $(id);

    if (screen) {
      screen.hidden = id !== screenId;
    }
  });
}

// ==========================================
// ADMIN CHECK
// ==========================================

function isActiveAdmin() {
  return currentUser && currentRole === "superAdmin";
}

// ==========================================
// STUDENT PROFILE
// ==========================================

function showStudentProfile(profile) {
  const photo = $("studentPhoto");
  const name = $("studentName");
  const info = $("studentInfo");
  const address = $("studentHomeAddress");

  if (name) {
    name.textContent = profile.fullName || "Student";
  }

  if (info) {
    info.textContent =
      "Roll Number: " + (profile.rollNumber || "N/A") +
      " | Class: " + (profile.classId || "N/A");
  }

  if (address) {
    address.textContent =
      profile.homeAddress || "Address not available";
  }

  if (photo) {
    const photoURL =
      profile.photoURL || profile.photoUrl || "";

    if (
      photoURL &&
      /^https:\/\//i.test(photoURL)
    ) {
      photo.src = photoURL;
      photo.hidden = false;

      photo.onerror = () => {
        photo.removeAttribute("src");
        photo.hidden = true;
      };
    } else {
      photo.removeAttribute("src");
      photo.hidden = true;
    }
  }
}

// ==========================================
// STUDENT LOGIN
// ==========================================

on("studentLoginForm", "submit", async event => {
  event.preventDefault();

  if (loginInProgress) return;

  const roll = cleanRollNumber($("rollNumber")?.value);
  const password = $("studentPassword")?.value || "";

  if (!roll || !password) {
    showMessage("message", "Roll Number and Password required.");
    return;
  }

  loginInProgress = true;
  showMessage("message", "Checking student login...");

  try {
    const credential =
      await auth.signInWithEmailAndPassword(
        studentLoginEmail(roll),
        password
      );

    const doc = await db.collection("students")
      .doc(credential.user.uid)
      .get();

    if (!doc.exists) {
      await auth.signOut();
      showMessage("message", "Student profile not found.");
      return;
    }

    const profile = doc.data();

    if (
      normalizeText(profile.role) !== "student" ||
      normalizeText(profile.status) !== "active" ||
      cleanRollNumber(profile.rollNumber) !== roll
    ) {
      await auth.signOut();
      showMessage("message", "Student profile is inactive or invalid.");
      return;
    }

    currentUser = credential.user;
    currentRole = "student";
    studentProfile = profile;

    $("studentLoginForm")?.reset();

    openStudentDashboard();

  } catch (error) {
    console.error("STUDENT LOGIN ERROR:", error);

    showMessage(
      "message",
      "Student Login Error: " + error.message
    );

  } finally {
    loginInProgress = false;
  }
});

// ==========================================
// SUPER ADMIN LOGIN
// ==========================================

on("adminLoginForm", "submit", async event => {
  event.preventDefault();

  if (loginInProgress) return;

  const email = $("adminEmail")?.value.trim();
  const password = $("adminPassword")?.value || "";

  if (!email || !password) {
    showMessage("adminMessage", "Email and Password required.");
    return;
  }

  loginInProgress = true;

  showMessage("adminMessage", "Checking Admin...");

  try {
    const credential =
      await auth.signInWithEmailAndPassword(
        email,
        password
      );

    const doc = await db.collection("admins")
      .doc(credential.user.uid)
      .get();

    if (!doc.exists) {
      await auth.signOut();

      showMessage(
        "adminMessage",
        "Admin account not found in Firestore."
      );

      return;
    }

    const admin = doc.data();

    if (
      normalizeText(admin.role) !== "superadmin" ||
      normalizeText(admin.status) !== "active"
    ) {
      await auth.signOut();

      showMessage(
        "adminMessage",
        "Active Super Admin account not found."
      );

      return;
    }

    currentUser = credential.user;
    currentRole = "superAdmin";
    studentProfile = null;

    $("adminLoginForm")?.reset();

    showScreen("adminDashboard");

    loadNotices("adminNotices");

  } catch (error) {
    console.error("ADMIN LOGIN ERROR:", error);

    showMessage(
      "adminMessage",
      "Admin Login Error: " + error.message
    );

  } finally {
    loginInProgress = false;
  }
});

// ==========================================
// LOGIN PAGE NAVIGATION
// ==========================================

on("showAdminLogin", "click", () => {
  showMessage("adminMessage", "");
  showScreen("adminLoginPage");
});

on("backToStudentLogin", "click", () => {
  showMessage("message", "");
  showScreen("loginPage");
});

// ==========================================
// STUDENT DASHBOARD
// ==========================================

function openStudentDashboard() {
  if (!studentProfile) return;

  showStudentProfile(studentProfile);

  showScreen("studentDashboard");

  loadHomework(studentProfile.classId);
  loadNotices("studentNotices");
}

// ==========================================
// HOMEWORK
// ==========================================

async function loadHomework(classId) {
  const container = $("homeworkList");

  if (!container) return;

  container.textContent = "Loading homework...";

  if (!classId) {
    container.textContent = "Class not assigned.";
    return;
  }

  try {
    const snapshot = await db.collection("homework")
      .where("classId", "==", classId)
      .get();

    container.innerHTML = "";

    if (snapshot.empty) {
      container.textContent = "No homework available.";
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();

      const item = document.createElement("div");
      item.className = "item";

      const title = document.createElement("h4");
      title.textContent = data.title || "Homework";

      const subject = document.createElement("p");
      subject.textContent =
        "Subject: " + (data.subject || "");

      const details = document.createElement("p");
      details.textContent = data.details || "";

      item.append(title, subject, details);

      container.appendChild(item);
    });

  } catch (error) {
    console.error("HOMEWORK ERROR:", error);

    container.textContent =
      "Homework Error: " + error.message;
  }
}

// ==========================================
// NOTICES
// ==========================================

async function loadNotices(containerId) {
  const container = $(containerId);

  if (!container) return;

  container.textContent = "Loading notices...";

  try {
    const snapshot = await db.collection("notices")
      .orderBy("createdAt", "desc")
      .get();

    container.innerHTML = "";

    if (snapshot.empty) {
      container.textContent = "No notices available.";
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();

      const item = document.createElement("div");
      item.className = "item";

      const title = document.createElement("h4");
      title.textContent = data.title || "Notice";

      const details = document.createElement("p");
      details.textContent = data.details || "";

      item.append(title, details);

      container.appendChild(item);
    });

  } catch (error) {
    console.error("NOTICE ERROR:", error);

    container.textContent =
      "Notice Error: " + error.message;
  }
}

// ==========================================
// PUBLISH NOTICE
// ==========================================

on("noticeForm", "submit", async event => {
  event.preventDefault();

  if (!isActiveAdmin()) {
    showMessage(
      "noticeMessage",
      "Only Super Admin can publish notices."
    );

    return;
  }

  const title = $("noticeTitle")?.value.trim();
  const details = $("noticeDetails")?.value.trim();

  if (!title || !details) {
    showMessage("noticeMessage", "Please fill all fields.");
    return;
  }

  try {
    await db.collection("notices").add({
      title,
      details,
      createdBy: currentUser.uid,
      createdAt:
        firebase.firestore.FieldValue.serverTimestamp()
    });

    $("noticeForm")?.reset();

    showMessage(
      "noticeMessage",
      "Notice published successfully!",
      true
    );

    loadNotices("adminNotices");

  } catch (error) {
    console.error("PUBLISH NOTICE ERROR:", error);

    showMessage(
      "noticeMessage",
      "Notice Error: " + error.message
    );
  }
});

// ==========================================
// LOGOUT
// ==========================================

async function logoutUser() {
  try {
    await auth.signOut();

    currentUser = null;
    currentRole = null;
    studentProfile = null;

    $("studentLoginForm")?.reset();
    $("adminLoginForm")?.reset();

    showScreen("loginPage");

  } catch (error) {
    console.error("LOGOUT ERROR:", error);

    alert("Logout Error: " + error.message);
  }
}

on("studentLogout", "click", logoutUser);
on("adminLogout", "click", logoutUser);

// ==========================================
// RESTORE LOGIN SESSION
// ==========================================

auth.onAuthStateChanged(async user => {
  if (loginInProgress) return;

  if (!user) {
    currentUser = null;
    currentRole = null;
    studentProfile = null;

    showScreen("loginPage");

    return;
  }

  try {
    const adminDoc = await db.collection("admins")
      .doc(user.uid)
      .get();

    if (
      adminDoc.exists &&
      normalizeText(adminDoc.data().role) === "superadmin" &&
      normalizeText(adminDoc.data().status) === "active"
    ) {
      currentUser = user;
      currentRole = "superAdmin";

      showScreen("adminDashboard");

      loadNotices("adminNotices");

      return;
    }

    const studentDoc = await db.collection("students")
      .doc(user.uid)
      .get();

    if (
      studentDoc.exists &&
      normalizeText(studentDoc.data().role) === "student" &&
      normalizeText(studentDoc.data().status) === "active"
    ) {
      currentUser = user;
      currentRole = "student";
      studentProfile = studentDoc.data();

      openStudentDashboard();

      return;
    }

    await auth.signOut();

    showScreen("loginPage");

  } catch (error) {
    console.error("SESSION ERROR:", error);

    await auth.signOut();

    showScreen("loginPage");

    showMessage(
      "message",
      "Session Error: " + error.message
    );
  }
});

console.log(
  "M.S.D. ENGLISH ACADEMY APP LOADED SUCCESSFULLY"
);
