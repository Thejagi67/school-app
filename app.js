
// M.S.D. ENGLISH ACADEMY - SCHOOL APP

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

const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentRole = null;
let studentProfile = null;

// Show one screen at a time
function showScreen(screenId) {
  [
    "loginPage",
    "adminLoginPage",
    "studentDashboard",
    "adminDashboard"
  ].forEach(id => $(id).classList.add("hidden"));

  $(screenId).classList.remove("hidden");
}

function showMessage(id, message, success = false) {
  const element = $(id);
  element.textContent = message;
  element.className = success ? "success" : "";
}

function cleanRollNumber(value) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

// Student accounts use this email format in Firebase Authentication.
// Example: roll number 25 becomes 25@students.msd-school.app
function studentLoginEmail(rollNumber) {
  return cleanRollNumber(rollNumber).toLowerCase()
    + "@students.msd-school.app";
}

// Student Login
$("studentLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const roll = cleanRollNumber($("rollNumber").value);
  const password = $("studentPassword").value;

  showMessage("message", "Logging in...");

  try {
    const credential = await auth.signInWithEmailAndPassword(
      studentLoginEmail(roll),
      password
    );

    const userDoc = await db.collection("students")
      .doc(credential.user.uid).get();

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
      showMessage("message", "This student account is not active or is not valid.");
      return;
    }

    currentUser = credential.user;
    currentRole = "student";
    studentProfile = profile;

    openStudentDashboard();

  } catch (error) {
    console.error(error);
    showMessage("message", "Login failed. Check your Roll Number and Password.");
  }
});

// Super Admin Login
$("adminLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("adminEmail").value.trim();
  const password = $("adminPassword").value;

  showMessage("adminMessage", "Checking admin account...");

  try {
    const credential = await auth.signInWithEmailAndPassword(email, password);
    const adminDoc = await db.collection("admins")
      .doc(credential.user.uid).get();

    if (
      !adminDoc.exists ||
      adminDoc.data().role !== "superAdmin" ||
      adminDoc.data().status !== "active"
    ) {
      await auth.signOut();
      showMessage("adminMessage", "This account is not an active Super Admin.");
      return;
    }

    currentUser = credential.user;
    currentRole = "superAdmin";
    showScreen("adminDashboard");
    loadNotices("adminNotices");

  } catch (error) {
    console.error(error);
    showMessage("adminMessage", "Admin login failed. Check email and password.");
  }
});

// Switch login screens
$("showAdminLogin").addEventListener("click", () => {
  showMessage("adminMessage", "");
  showScreen("adminLoginPage");
});

$("backToStudentLogin").addEventListener("click", () => {
  showMessage("message", "");
  showScreen("loginPage");
});

// Open student dashboard
function openStudentDashboard() {
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

// Load homework for the logged-in student's class only
async function loadHomework(classId) {
  const container = $("homeworkList");
  container.textContent = "Loading homework...";

  if (!classId) {
    container.textContent = "Your class has not been assigned. Contact school administration.";
    return;
  }

  try {
    const snapshot = await db.collection("homework")
      .where("classId", "==", classId)
      .get();

    if (snapshot.empty) {
      container.textContent = "No homework or classwork has been published yet.";
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
      subject.textContent = "Subject: " + (data.subject || "Not specified");

      const details = document.createElement("p");
      details.textContent = data.details || "";

      const type = document.createElement("small");
      type.textContent = data.type || "Homework";

      item.append(title, subject, details, type);
      container.appendChild(item);
    });

  } catch (error) {
    console.error(error);
    container.textContent = "Could not load homework. Please try again.";
  }
}

// Load notices
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
    console.error(error);
    container.textContent = "Could not load notices.";
  }
}

// Super Admin publishes a notice
$("noticeForm").addEventListener("submit", async (event) => {
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
      title,
      details,
      createdBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    $("noticeForm").reset();
    showMessage("noticeMessage", "Notice published successfully.", true);
    loadNotices("adminNotices");

  } catch (error) {
    console.error(error);
    showMessage("noticeMessage", "Notice could not be published.");
  }
});

// Student Logout
$("studentLogout").addEventListener("click", async () => {
  await auth.signOut();
  currentUser = null;
  currentRole = null;
  studentProfile = null;
  $("studentLoginForm").reset();
  showScreen("loginPage");
});

// Admin Logout
$("adminLogout").addEventListener("click", async () => {
  await auth.signOut();
  currentUser = null;
  currentRole = null;
  showScreen("loginPage");
});

// Restore session safely when app opens
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    currentUser = null;
    currentRole = null;
    studentProfile = null;
    showScreen("loginPage");
    return;
  }

  try {
    const adminDoc = await db.collection("admins").doc(user.uid).get();

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

    const studentDoc = await db.collection("students").doc(user.uid).get();

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
    console.error(error);
    await auth.signOut();
    showScreen("loginPage");
  }
});
