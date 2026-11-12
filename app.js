// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDUbpRqEsJpPWiug7HnQMMcfAP6MsQKnCk",
  authDomain: "school-management-system-a02e7.firebaseapp.com",
  projectId: "school-management-system-a02e7",
  storageBucket: "school-management-system-a02e7.firebasestorage.app",
  messagingSenderId: "958260851540",
  appId: "1:958260851540:web:a5a1ee0719f29fc2588ec1",
  measurementId: "G-PMY610FVNQ"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

const $=id=>document.getElementById(id);
const students=[{name:"Aarav Sharma",roll:"CIC1001",password:"student123",cls:"Class 10-A",attendance:"92%",initials:"AS"},{name:"Ananya Verma",roll:"CIC1002",password:"student123",cls:"Class 9-B",attendance:"96%",initials:"AV"},{name:"Rohan Singh",roll:"CIC1003",password:"student123",cls:"Class 8-A",attendance:"89%",initials:"RS"},{name:"Priya Gupta",roll:"CIC1004",password:"student123",cls:"Class 11-B",attendance:"94%",initials:"PG"}];
const sample=[{id:1,title:"Welcome to the new school portal",category:"General",date:"2026-10-09",details:"This is the Christ Inter College demo website. Explore the student dashboard and school information features."},{id:2,title:"Holiday notice — demo example",category:"Holiday",date:"2026-10-07",details:"Sample holiday information only. Confirm actual dates with the school office."},{id:3,title:"Examination information",category:"Exam",date:"2026-10-04",details:"Examination schedules would be shared here in a real system. This is a placeholder."}];
function load(k,d){try{return JSON.parse(localStorage.getItem(k))||d}catch{return d}}function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
let notices=load("cicV2Notices",sample),enquiries=load("cicV2Enquiries",[]),student=null,previous="home";
function go(id){let old=document.querySelector(".screen.active");if(old&&old.id!=="adminLogin")previous=old.id;document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active",s.id===id));scrollTo({top:0,behavior:"smooth"});if(id==="dashboard")renderDashboard();if(id==="students")renderStudents();if(id==="notices")renderNotices();if(id==="admin")renderAdmin()}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}function msg(s){$("toast").textContent=s;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2300)}
function fillLogin(){$("roll").value="CIC1001";$("pass").value="student123"}
$("loginForm").onsubmit=e=>{e.preventDefault();student=students.find(s=>s.roll===$("roll").value.trim().toUpperCase()&&s.password===$("pass").value);if(!student){$("loginError").textContent="Login not recognized. Try one of the demo accounts.";return}$("loginError").textContent="";go("dashboard");msg("Demo login successful")};
function renderDashboard(){if(!student){go("login");return}$("greeting").textContent="Hello, "+student.name.split(" ")[0]+"!";$("pname").textContent=student.name;$("proll").textContent=student.roll;$("pclass").textContent=student.cls;$("attendance").textContent=student.attendance;$("dashNotice").innerHTML=notices[0]?`<b>${esc(notices[0].title)}</b><p>${esc(notices[0].details)}</p>`:"No notices yet."}
function logout(){student=null;$("roll").value="";$("pass").value="";go("home");msg("Logged out")}function switchAccount(){student=null;$("roll").value="";$("pass").value="";go("login")}
function renderStudents(){let q=($("search")?.value||"").toLowerCase().trim(),found=students.filter(s=>(s.name+" "+s.roll+" "+s.cls).toLowerCase().includes(q));$("studentResults").innerHTML=found.length?found.map(s=>`<div class="record"><span class="initials">${s.initials}</span><div><strong>${esc(s.name)}</strong><small>${s.roll} · ${s.cls}</small></div></div>`).join(""):'<div class="empty">No matching sample students found.</div>';$("adminStudents").innerHTML=students.map(s=>`<div class="record"><span class="initials">${s.initials}</span><div><strong>${esc(s.name)}</strong><small>${s.roll} · ${s.cls}</small></div></div>`).join("")}
function renderNotices(){$("latest").textContent=notices[0]?.title||"No notices yet.";$("noticeList").innerHTML=notices.length?[...notices].sort((a,b)=>b.id-a.id).map(n=>`<article class="notice"><small>${esc(n.category)} · ${esc(n.date)}</small><h3>${esc(n.title)}</h3><p>${esc(n.details)}</p></article>`).join(""):'<div class="empty">No notices yet.</div>'}
$("admissionForm").onsubmit=e=>{e.preventDefault();let d=Object.fromEntries(new FormData(e.target).entries());enquiries.unshift({...d,date:new Date().toLocaleDateString("en-IN")});save("cicV2Enquiries",enquiries);e.target.reset();$("admissionMsg").textContent="Demo enquiry saved in this browser. No message was sent to the school.";msg("Demo enquiry saved")};

$("adminForm").onsubmit = async e => {
  e.preventDefault();

  const email = $("adminEmail").value.trim();
  const password = $("adminPass").value;

  $("adminError").textContent = "Checking login...";

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

    if (
      !adminDoc.exists ||
      adminDoc.data().role !== "superAdmin" ||
      adminDoc.data().status !== "active"
    ) {
      await auth.signOut();
      throw new Error("Admin access not authorized.");
    }

    $("adminError").textContent = "";
    go("admin");
    msg("Admin login successful");

  } catch (error) {
    $("adminError").textContent =
      error.message === "Admin access not authorized."
        ? error.message
        : "Login failed. Check your email and password.";
  }
};

$("noticeForm").onsubmit=e=>{e.preventDefault();let d=Object.fromEntries(new FormData(e.target).entries());notices.unshift({id:Date.now(),title:d.title.trim(),category:d.category,date:new Date().toISOString().slice(0,10),details:d.details.trim()});save("cicV2Notices",notices);e.target.reset();renderAdmin();renderNotices();msg("Notice published in this browser")};
function renderAdmin(){$("studentCount").textContent=students.length;$("enquiryCount").textContent=enquiries.length;$("noticeCount").textContent=notices.length;$("enquiryList").innerHTML=enquiries.length?enquiries.map(e=>`<div class="record"><div><strong>${esc(e.student)} · ${esc(e.className)}</strong><small>Guardian: ${esc(e.guardian)} · Contact: ${esc(e.contact)} · ${esc(e.date)}</small>${e.message?`<p>${esc(e.message)}</p>`:""}</div></div>`).join(""):'<div class="empty">No demo enquiries yet. Try the admission form.</div>';renderStudents()}
function clearEnquiries(){if(!enquiries.length){msg("No entries to clear");return}if(confirm("Clear demo enquiries saved in this browser?")){enquiries=[];save("cicV2Enquiries",enquiries);renderAdmin();msg("Demo entries cleared")}}
renderNotices();renderStudents();
