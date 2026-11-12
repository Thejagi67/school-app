// ==========================================
// M.S.D. ENGLISH ACADEMY
// REAL SCHOOL MANAGEMENT APP
// Firebase Application
// ==========================================

// 1. FIREBASE CONFIGURATION

const firebaseConfig = {
  apiKey: "AIzaSyDUbpRqEsJpPWiug7HnQMMcfAP6MsQKnCk",
  authDomain: "school-management-system-a02e7.firebaseapp.com",
  projectId: "school-management-system-a02e7",
  storageBucket: "school-management-system-a02e7.firebasestorage.app",
  messagingSenderId: "958260851540",
  appId: "1:958260851540:web:a5a1ee0719f29fc2588ec1",
  measurementId: "G-PMY610FVNQ"
};

// 2. INITIALIZE FIREBASE

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

const $ = id => document.getElementById(id);

let currentUser = null;
let isAdmin = false;
let previous = "home";
let notices = [];
let students = [];

// 3. SCREEN NAVIGATION

function go(id) {
  const old = document.querySelector(".screen.active");

  if (old && old.id !== "adminLogin") {
    previous = old.id;
  }

  if (id === "admin" && !isAdmin) {
    msg("Admin permission required");
    return;
  }

  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.toggle("active", screen.id === id);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (id === "notices") renderNotices();
  if (id === "admin") renderAdmin();
  if (id === "students") renderStudents();
}

// 4. MESSAGE

function msg(message) {
  const toast = $("toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// 5. SAFE TEXT

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// 6. ADMIN LOGIN

if ($("adminForm")) {
  $("adminForm").onsubmit = async event => {
    event.preventDefault();

    const email = $("adminEmail").value.trim();
    const password = $("adminPass").value;

    $("adminError").textContent = "Verifying admin account...";

    try {
      const result = await auth.signInWithEmailAndPassword(
        email,
        password
      );

      const user = result.user;

      const adminDoc = await db
        .collection("admins")
        .doc(user.uid)
        .get();

      if (!adminDoc.exists) {
        await auth.signOut();
        throw new Error("Admin record not found.");
      }

      const adminData = adminDoc.data();

      if (
        adminData.role !== "superAdmin" ||
        adminData.status !== "active"
      ) {
        await auth.signOut();
        throw new Error("Admin access not authorized.");
      }

      currentUser = user;
      isAdmin = true;

      $("adminError").textContent = "";

      go("admin");
      msg("Welcome, Super Admin!");

    } catch (error) {
      $("adminError").textContent =
        error.code === "auth/invalid-credential"
          ? "Incorrect email or password."
          : error.message;

      console.error("Admin login:", error);
    }
  };
}

// 7. ADMIN SESSION CHECK

auth.onAuthStateChanged(async user => {
  currentUser = user;

  if (!user) {
    isAdmin = false;
    return;
  }

  try {
    const doc = await db.collection("admins").doc(user.uid).get();

    if (
      doc.exists &&
      doc.data().role === "superAdmin" &&
      doc.data().status === "active"
    ) {
      isAdmin = true;
    } else {
      isAdmin = false;
      await auth.signOut();
    }
  } catch (error) {
    isAdmin = false;
    console.error("Admin verification failed:", error);
  }
});

// 8. ADMIN LOGOUT

async function adminLogout() {
  try {
    await auth.signOut();

    currentUser = null;
    isAdmin = false;

    go("home");
    msg("Admin logged out");

  } catch (error) {
    msg("Logout failed");
    console.error(error);
  }
}

// 9. STUDENT LOGIN
// Student accounts will be enabled after
// Admin creates real student accounts.

if ($("loginForm")) {
  $("loginForm").onsubmit = event => {
    event.preventDefault();

    $("loginError").textContent =
      "Student accounts are not created yet. Please contact the school administration.";
  };
}

// 10. STUDENT DASHBOARD

function renderDashboard() {
  if (!currentUser || !isAdmin) {
    go("home");
    return;
  }

  if ($("greeting")) {
    $("greeting").textContent = "School Administration";
  }

  if ($("pname")) {
    $("pname").textContent = "M.S.D. ENGLISH ACADEMY";
  }

  if ($("proll")) {
    $("proll").textContent = "Administrator";
  }

  if ($("pclass")) {
    $("pclass").textContent = "Super Admin";
  }

  if ($("attendance")) {
    $("attendance").textContent = "N/A";
  }
}

// 11. LOAD SCHOOL NOTICES

async function renderNotices() {
  const list = $("noticeList");
  const latest = $("latest");

  if (!list) return;

  list.innerHTML = '<p>Loading school notices...</p>';

  try {
    const snapshot = await db
      .collection("notices")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    notices = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (latest) {
      latest.textContent = notices[0]?.title ||
        "Welcome to M.S.D. English Academy";
    }

    list.innerHTML = notices.length
      ? notices.map(notice => `
        <article class="notice">
          <small>${esc(notice.category)} ·
          ${esc(notice.date || "")}</small>
          <h3>${esc(notice.title)}</h3>
          <p>${esc(notice.details)}</p>
        </article>
      `).join("")
      : '<div class="empty">No school notices published yet.</div>';

  } catch (error) {
    list.innerHTML =
      '<div class="empty">Unable to load notices. Please try again.</div>';

    console.error("Notice loading:", error);
  }
}

// 12. PUBLISH NOTICE

if ($("noticeForm")) {
  $("noticeForm").onsubmit = async event => {
    event.preventDefault();

    if (!isAdmin || !currentUser) {
      msg("Admin login required");
      return;
    }

    const data = Object.fromEntries(
      new FormData(event.target).entries()
    );

    try {
      await db.collection("notices").add({
        title: data.title.trim(),
        category: data.category,
        details: data.details.trim(),
        date: new Date().toLocaleDateString("en-IN"),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: currentUser.uid
      });

      event.target.reset();

      await renderNotices();

      msg("School notice published successfully");

    } catch (error) {
      msg("Notice could not be published");
      console.error("Notice publishing:", error);
    }
  };
}

// 13. ONLINE ADMISSION ENQUIRY

if ($("admissionForm")) {
  $("admissionForm").onsubmit = async event => {
    event.preventDefault();

    const data = Object.fromEntries(
      new FormData(event.target).entries()
    );

    try {
      await db.collection("admissions").add({
        student: data.student.trim(),
        className: data.className,
        guardian: data.guardian.trim(),
        contact: data.contact.trim(),
        message: data.message.trim(),
        status: "pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      event.target.reset();

      $("admissionMsg").textContent =
        "Your admission enquiry has been submitted successfully.";

      msg("Admission enquiry submitted");

    } catch (error) {
      $("admissionMsg").textContent =
        "Unable to submit enquiry. Please try again.";

      console.error("Admission:", error);
    }
  };
}

// 14. STUDENT DIRECTORY

function renderStudents() {
  const results = $("studentResults");

  if (results) {
    results.innerHTML =
      '<div class="empty">Student accounts will appear here after secure registration by Admin.</div>';
  }

  const adminList = $("adminStudents");

  if (adminList) {
    adminList.innerHTML =
      '<div class="empty">No student accounts registered yet.</div>';
  }
}

// 15. ADMIN PANEL

async function renderAdmin() {
  if (!isAdmin || !currentUser) return;

  renderStudents();

  const enquiryList = $("enquiryList");

  if (enquiryList) {
    enquiryList.innerHTML = "<p>Loading admission enquiries...</p>";

    try {
      const snapshot = await db
        .collection("admissions")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();

      enquiryList.innerHTML = snapshot.empty
        ? '<div class="empty">No admission enquiries yet.</div>'
        : snapshot.docs.map(doc => {
            const item = doc.data();

            return `
              <div class="record">
                <div>
                  <strong>${esc(item.student)} · ${esc(item.className)}</strong>
                  <small>Guardian: ${esc(item.guardian)}</small>
                  <small>Contact: ${esc(item.contact)}</small>
                  <small>Status: ${esc(item.status)}</small>
                  ${item.message
                    ? `<p>${esc(item.message)}</p>`
                    : ""}
                </div>
              </div>
            `;
          }).join("");

    } catch (error) {
      enquiryList.innerHTML =
        '<div class="empty">Unable to load admission enquiries.</div>';

      console.error("Admission loading:", error);
    }
  }
}

// 16. LOGOUT

function logout() {
  if (isAdmin) {
    adminLogout();
    return;
  }

  go("home");
}

function switchAccount() {
  go("login");
}

// 17. INITIAL SCREEN

renderStudents();

renderNotices();

console.log(
  "M.S.D. English Academy School App initialized."
);
