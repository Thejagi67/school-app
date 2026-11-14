// M.S.D. ENGLISH ACADEMY - SCHOOL APP
// Updated Login System with Error Diagnostics

const firebaseConfig = {
  apiKey: "AIzaSyDUbpRqEsJpPWiug7HnQMMcfAP6MsQKnCk",
  authDomain: "school-management-system-a02e7.firebaseapp.com",
  projectId: "school-management-system-a02e7",
  storageBucket: "school-management-system-a02e7.firebasestorage.app",
  messagingSenderId: "958260851540",
  appId: "1:958260851540:web:a5a1ee0719f29fc2588ec1",
  measurementId: "G-PMY610FVNQ"
};

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

// Timeout helper
function withTimeout(promise, seconds, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), seconds * 1000);
    })
  ]);
}

// Screen management
function showScreen(screenId) {
  [
    "loginPage",
    "adminLoginPage",
    "studentDashboard",
    "adminDashboard"
  ].forEach(id => {
    const element = $(id);
    if (element) element.classList.add("hidden");
  });

  if ($(screenId)) {
    $(screenId).classList.remove("hidden");
  }
}

// Message management
function showMessage(id, message, success = false) {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.className = success ? "success" : "";
}

function cleanRollNumber(value) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function studentLoginEmail(rollNumber) {
  return cleanRollNumber(rollNumber).toLowerCase()
    + "@students.msd-school.app";
}

// =====================================
// STUDENT LOGIN
// =====================================

$("studentLoginForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (loginInProgress) return;
  loginInProgress = true;

  const roll = cleanRollNumber($("rollNumber").value);
  const password = $("studentPassword").value;
  const button = $("studentLoginForm").querySelector("button[type='submit']");

  button.disabled = true;
  showMessage("message", "Connecting to Firebase Authentication...");

  try {
    const credential = await withTimeout(
      auth.signInWithEmailAndPassword(
        studentLoginEmail(roll),
        password
      ),
      20,
      "Authentication timed out. Check your internet connection."
    );

    showMessage("message", "Checking student profile...");

    const userDoc = await withTimeout(
      db.collection("students").doc(credential.user.uid).get(),
      15,
      "Student profile request timed out."
    );

    if (!userDoc.exists) {
      await auth.signOut();
      showMessage("message", "Student profile not found. Contact school administration.");
      return;
    }

    const profile = userDoc.data();

    if (
      profile.status !== "active" ||
      profile.role !== "student" ||
      cleanRollNumber(profile.rollNumber || "") !== roll
    ) {
      await auth.signOut();
      showMessage("message", "Student account is inactive or profile details do not match.");
      return;
    }

    currentUser = credential.user;
    currentRole = "student";
    studentProfile = profile;

    showMessage("message", "Student login successful!", true);
    openStudentDashboard();

  } catch (error) {
    console.error("STUDENT LOGIN ERROR:", error);

    showMessage(
      "message",
      "Error: " + (error.code || "unknown") + " - " + error.message
    );

  } finally {
    loginInProgress = false;
    button.disabled = false;
  }
});

// =====================================
// SUPER ADMIN LOGIN
// =====================================

$("adminLoginForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (loginInProgress) return;
  loginInProgress = true;

  const email = $("adminEmail").value.trim();
  const password = $("adminPassword").value;
  const button = $("adminLoginForm").querySelector("button[type='submit']");

  button.disabled = true;

  try {
    showMessage(
      "adminMessage",
      "Step 1: Connecting to Firebase Authentication..."
    );

    const credential = await withTimeout(
      auth.signInWithEmailAndPassword(email, password),
      20,
      "Authentication timed out. Check internet and Firebase settings."
    );

    showMessage(
      "adminMessage",
      "Step 2: Authentication successful. Checking Admin record..."
    );

    const adminDoc = await withTimeout(
      db.collection("admins").doc(credential.user.uid).get(),
      15,
      "Firestore request timed out. Check Firestore connection and Rules."
    );

    if (!adminDoc.exists) {
      await auth.signOut();

      showMessage(
        "adminMessage",
        "Error: Admin document not found for this UID."
      );
      return;
    }

    const adminData = adminDoc.data();

    if (adminData.role !== "superAdmin") {
      await auth.signOut();

      showMessage(
        "adminMessage",
        "Error: Admin role is incorrect."
      );
      return;
    }

    if (adminData.status !== "active") {
      await auth.signOut();

      showMessage(
        "adminMessage",
        "Error: Admin status is not active."
      );
      return;
    }

    currentUser = credential.user;
    currentRole = "superAdmin";

    showScreen("adminDashboard");
    showMessage("adminMessage", "Super Admin login successful!", true);

    loadNotices("adminNotices");

  } catch (error) {
    console.error("ADMIN LOGIN ERROR:", error);

    showMessage(
      "adminMessage",
      "Error: " + (error.code || "unknown") + " - " + error.message
    );

  } finally {
    loginInProgress = false;
    button.disabled = false;
  }
});

// =====================================
// LOGIN SCREEN NAVIGATION
// =====================================

$("showAdminLogin").addEventListener("click", () => {
  showMessage("adminMessage", "");
  showScreen("adminLoginPage");
});

$("backToStudentLogin").addEventListener("click", () => {
  showMessage("message", "");
  showScreen("loginPage");
});

// =====================================
// STUDENT DASHBOARD
// =====================================

function openStudentDashboard() {
  if (!studentProfile) return;

  const name = studentProfile.fullName || "Student";
  const roll = studentProfile.rollNumber || "";
  const classId = studentProfile.classId || "";

  $("studentName").textContent = name;

  $("studentInfo").textContent =
    "Roll Number: " + roll + " | Class: " + classId;

  showScreen("studentDashboard");

  loadHomework(classId);
  loadNotices("studentNotices");
}

// =====================================
// LOAD HOMEWORK
// =====================================

async function loadHomework(classId) {
  const container = $("homeworkList");

  container.textContent = "Loading homework...";

  if (!classId) {
    container.textContent =
      "Your class has not been assigned. Contact school administration.";
    return;
  }

  try {
    const snapshot = await db.collection("homework")
      .where("classId", "==", classId)
      .get();

    if (snapshot.empty) {
      container.textContent = "No homework or classwork available.";
      return;
    }

    container.innerHTML = "";

    snapshot.forEach(doc => {
      const data = doc.data();

      const item = document.createElement("div");
      item.className = "item";

      const title = document.createElement("h4");
      title.textContent = data.title || "Homework";

      const subject = document.createElement("p");
      subject.textContent =
        "Subject: " + (data.subject || "Not specified");

      const details = document.createElement("p");
      details.textContent = data.details || "";

      const type = document.createElement("small");
      type.textContent = data.type || "Homework";

      item.append(title, subject, details, type);
      container.appendChild(item);
    });

  } catch (error) {
    console.error("HOMEWORK ERROR:", error);
    container.textContent =
      "Homework loading failed: " + error.message;
  }
}

// =====================================
// LOAD NOTICES
// =====================================

async function loadNotices(containerId) {
  const container = $(containerId);

  container.textContent = "Loading notices...";

  try {
    const snapshot = await db.collection("notices")
      .orderBy("createdAt", "desc")
      .get();

    if (snapshot.empty) {
      container.textContent = "No notices available.";
      return;
    }

    container.innerHTML = "";

    snapshot.forEach(doc => {
      const data = doc.data();

      const item = document.createElement("div");
      item.className = "item";

      const title = document.createElement("h4");
      title.textContent = data.title || "School Notice";

      const details = document.createElement("p");
      details.textContent = data.details || "";

      item.append(title, details);
      container.appendChild(item);
    });

  } catch (error) {
    console.error("NOTICE ERROR:", error);
    container.textContent = "Notice loading failed: " + error.message;
  }
}

// =====================================
// PUBLISH NOTICE
// =====================================

$("noticeForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser || currentRole !== "superAdmin") {
    showMessage("noticeMessage", "Only Super Admin can publish notices.");
    return;
  }

  const title = $("noticeTitle").value.trim();
  const details = $("noticeDetails").value.trim();

  if (!title || !details) return;

  try {
    await db.collection("notices").add({
      title: title,
      details: details,
      createdBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    $("noticeForm").reset();

    showMessage(
      "noticeMessage",
      "Notice published successfully.",
      true
    );

    loadNotices("adminNotices");

  } catch (error) {
    console.error("PUBLISH NOTICE ERROR:", error);
    showMessage("noticeMessage", "Notice error: " + error.message);
  }
});

// =====================================
// LOGOUT
// =====================================

async function logoutUser() {
  try {
    await auth.signOut();

    currentUser = null;
    currentRole = null;
    studentProfile = null;

    $("studentLoginForm").reset();
    $("adminLoginForm").reset();

    showScreen("loginPage");

  } catch (error) {
    console.error("LOGOUT ERROR:", error);
    alert("Logout failed: " + error.message);
  }
}

$("studentLogout").addEventListener("click", logoutUser);
$("adminLogout").addEventListener("click", logoutUser);

// =====================================
// RESTORE EXISTING LOGIN SESSION
// =====================================

auth.onAuthStateChanged(async user => {
  // Do not run a second profile check while
  // the Login button is already checking it.
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
      .doc(user.uid).get();

    if (
      adminDoc.exists &&
      adminDoc.data().role === "superAdmin" &&
      adminDoc.data().status === "active"
    ) {
      currentUser = user;
      currentRole = "superAdmin";

      showScreen("adminDashboard");
      loadNotices("adminNotices");
      return;
    }

    const studentDoc = await db.collection("students")
      .doc(user.uid).get();

    if (
      studentDoc.exists &&
      studentDoc.data().role === "student" &&
      studentDoc.data().status === "active"
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
    console.error("SESSION RESTORE ERROR:", error);

    currentUser = null;
    currentRole = null;
    studentProfile = null;

    showScreen("loginPage");
    showMessage(
      "message",
      "Session error: " + (error.code || "") + " " + error.message
    );
  }
});

console.log("M.S.D. English Academy App Loaded");

