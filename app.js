
// M.S.D. ENGLISH ACADEMY - SCHOOL APP
// Corrected Admin + Student Login System

const firebaseConfig = {
  apiKey: "AIzaSyDUbpRqEsJpPWiug7HnQMMcfAP6MsQKnCk",
  authDomain: "school-management-system-a02e7.firebaseapp.com",
  projectId: "school-management-system-a02e7",
  storageBucket: "school-management-system-a02e7.firebasestorage.app",
  messagingSenderId: "958260851540",
  appId: "1:958260851540:web:a5a1ee0719f29fc2588ec1",
  measurementId: "G-PMY610FVNQ"
};

// Firebase initialize
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

// Attach event safely
function on(id, eventName, callback) {
  const element = $(id);
  if (element) {
    element.addEventListener(eventName, callback);
  } else {
    console.warn("HTML element not found:", id);
  }
}

// Timeout helper
function withTimeout(promise, seconds, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), seconds * 1000);
    })
  ]);
}

// Normalize Firebase text values
function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function cleanRollNumber(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function studentLoginEmail(rollNumber) {
  return cleanRollNumber(rollNumber).toLowerCase()
    + "@students.msd-school.app";
}

// Show one screen at a time
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

  const target = $(screenId);
  if (target) {
    target.classList.remove("hidden");
  } else {
    console.error("Screen not found:", screenId);
  }
}

// Show messages
function showMessage(id, message, success = false) {
  const element = $(id);
  if (!element) {
    console.warn("Message element not found:", id, message);
    return;
  }

  element.textContent = message;
  element.className = success ? "success" : "";
}

// =====================================
// STUDENT LOGIN
// =====================================

on("studentLoginForm", "submit", async event => {
  event.preventDefault();

  if (loginInProgress) return;
  loginInProgress = true;

  const rollInput = $("rollNumber");
  const passwordInput = $("studentPassword");
  const form = $("studentLoginForm");
  const button = form?.querySelector("button[type='submit']");

  const roll = cleanRollNumber(rollInput?.value);
  const password = passwordInput?.value || "";

  if (!roll || !password) {
    showMessage("message", "Please enter Roll Number and Password.");
    loginInProgress = false;
    return;
  }

  if (button) button.disabled = true;

  showMessage("message", "Connecting to Firebase...");

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
      showMessage(
        "message",
        "Student profile not found. Contact school administration."
      );
      return;
    }

    const profile = userDoc.data() || {};

    const profileStatus = normalizeText(profile.status);
    const profileRole = normalizeText(profile.role);
    const profileRoll = cleanRollNumber(profile.rollNumber || "");

    if (
      profileStatus !== "active" ||
      profileRole !== "student" ||
      profileRoll !== roll
    ) {
      await auth.signOut();

      showMessage(
        "message",
        "Student profile does not match or is inactive. Please contact school administration."
      );
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
      "Student Login Error: " +
      (error.code || "unknown") + " - " +
      (error.message || "Please try again.")
    );

  } finally {
    loginInProgress = false;
    if (button) button.disabled = false;
  }
});

// =====================================
// SUPER ADMIN LOGIN
// =====================================

on("adminLoginForm", "submit", async event => {
  event.preventDefault();

  if (loginInProgress) return;
  loginInProgress = true;

  const email = $("adminEmail")?.value.trim() || "";
  const password = $("adminPassword")?.value || "";
  const form = $("adminLoginForm");
  const button = form?.querySelector("button[type='submit']");

  if (!email || !password) {
    showMessage("adminMessage", "Please enter Admin Email and Password.");
    loginInProgress = false;
    return;
  }

  if (button) button.disabled = true;

  try {
    showMessage(
      "adminMessage",
      "Step 1: Connecting to Firebase Authentication..."
    );

    const credential = await withTimeout(
      auth.signInWithEmailAndPassword(email, password),
      20,
      "Authentication timed out. Check your internet connection."
    );

    showMessage(
      "adminMessage",
      "Step 2: Authentication successful. Checking Admin document..."
    );

    const uid = credential.user.uid;

    const adminDoc = await withTimeout(
      db.collection("admins").doc(uid).get(),
      15,
      "Firestore request timed out. Check Firestore Rules and connection."
    );

    if (!adminDoc.exists) {
      await auth.signOut();

      showMessage(
        "adminMessage",
        "Admin document not found for this Authentication UID: " + uid
      );
      return;
    }

    const adminData = adminDoc.data() || {};

    // Normalize values to avoid spaces or letter-case problems
    const adminRole = normalizeText(adminData.role);
    const adminStatus = normalizeText(adminData.status);

    console.log("ADMIN LOGIN CHECK:", {
      authenticationUID: uid,
      firestoreDocumentID: adminDoc.id,
      role: adminData.role,
      normalizedRole: adminRole,
      status: adminData.status,
      normalizedStatus: adminStatus
    });

    // Check role
    if (adminRole !== "superadmin") {
      await auth.signOut();

      showMessage(
        "adminMessage",
        "Admin role mismatch. Firebase returned role = [" +
        String(adminData.role) +
        "]. Required value is superAdmin."
      );
      return;
    }

    // Check status
    if (adminStatus !== "active") {
      await auth.signOut();

      showMessage(
        "adminMessage",
        "Admin status mismatch. Firebase returned status = [" +
        String(adminData.status) +
        "]. Required value is active."
      );
      return;
    }

    // Admin verified successfully
    currentUser = credential.user;
    currentRole = "superAdmin";
    studentProfile = null;

    showScreen("adminDashboard");

    showMessage(
      "adminMessage",
      "Super Admin login successful!",
      true
    );

    loadNotices("adminNotices");

  } catch (error) {
    console.error("ADMIN LOGIN ERROR:", error);

    showMessage(
      "adminMessage",
      "Admin Login Error: " +
      (error.code || "unknown") + " - " +
      (error.message || "Please try again.")
    );

  } finally {
    loginInProgress = false;
    if (button) button.disabled = false;
  }
});

// =====================================
// LOGIN SCREEN NAVIGATION
// =====================================

on("showAdminLogin", "click", () => {
  showMessage("adminMessage", "");
  showScreen("adminLoginPage");
});

on("backToStudentLogin", "click", () => {
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

  if ($("studentName")) {
    $("studentName").textContent = name;
  }

  if ($("studentInfo")) {
    $("studentInfo").textContent =
      "Roll Number: " + roll + " | Class: " + classId;
  }

  showScreen("studentDashboard");

  loadHomework(classId);
  loadNotices("studentNotices");
}

// =====================================
// LOAD HOMEWORK FOR STUDENT'S CLASS
// =====================================

async function loadHomework(classId) {
  const container = $("homeworkList");
  if (!container) return;

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
      const data = doc.data() || {};

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
  if (!container) return;

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
      const data = doc.data() || {};

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

    container.textContent =
      "Notice loading failed: " + error.message;
  }
}

// =====================================
// SUPER ADMIN PUBLISHES NOTICE
// =====================================

on("noticeForm", "submit", async event => {
  event.preventDefault();

  if (!currentUser || currentRole !== "superAdmin") {
    showMessage(
      "noticeMessage",
      "Only Super Admin can publish notices."
    );
    return;
  }

  const title = $("noticeTitle")?.value.trim() || "";
  const details = $("noticeDetails")?.value.trim() || "";

  if (!title || !details) {
    showMessage("noticeMessage", "Please enter notice title and details.");
    return;
  }

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

    showMessage(
      "noticeMessage",
      "Notice error: " + error.message
    );
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

    if ($("studentLoginForm")) {
      $("studentLoginForm").reset();
    }

    if ($("adminLoginForm")) {
      $("adminLoginForm").reset();
    }

    showScreen("loginPage");

  } catch (error) {
    console.error("LOGOUT ERROR:", error);
    alert("Logout failed: " + error.message);
  }
}

on("studentLogout", "click", logoutUser);
on("adminLogout", "click", logoutUser);

// =====================================
// RESTORE EXISTING LOGIN SESSION
// =====================================

auth.onAuthStateChanged(async user => {
  // Login handler is already checking this user's profile
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

    if (adminDoc.exists) {
      const adminData = adminDoc.data() || {};

      if (
        normalizeText(adminData.role) === "superadmin" &&
        normalizeText(adminData.status) === "active"
      ) {
        currentUser = user;
        currentRole = "superAdmin";
        studentProfile = null;

        showScreen("adminDashboard");
        loadNotices("adminNotices");
        return;
      }
    }

    const studentDoc = await db.collection("students")
      .doc(user.uid).get();

    if (studentDoc.exists) {
      const profile = studentDoc.data() || {};

      if (
        normalizeText(profile.role) === "student" &&
        normalizeText(profile.status) === "active"
      ) {
        currentUser = user;
        currentRole = "student";
        studentProfile = profile;

        openStudentDashboard();
        return;
      }
    }

    await auth.signOut();

    currentUser = null;
    currentRole = null;
    studentProfile = null;

    showScreen("loginPage");

  } catch (error) {
    console.error("SESSION RESTORE ERROR:", error);

    currentUser = null;
    currentRole = null;
    studentProfile = null;

    showScreen("loginPage");

    showMessage(
      "message",
      "Session error: " +
      (error.code || "") + " " +
      error.message
    );
  }
});

console.log("M.S.D. English Academy App Loaded - Login Fix");
