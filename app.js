
import { createClient } from
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const URL = window.SUPABASE_URL;
const KEY = window.SUPABASE_PUBLISHABLE_KEY;

if (!URL || !KEY) {
  throw new Error("Supabase settings are missing from config.js");
}

const db = createClient(URL, KEY);
const $ = id => document.getElementById(id);

$("year").textContent = new Date().getFullYear();

const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));

function safeURL(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

async function loadProjects() {
  const { data, error } = await db.from("projects")
    .select("*").order("created_at", { ascending: false });

  if (error) {
    $("projectList").innerHTML =
      '<article class="card">Projects could not be loaded. Check the Supabase table and policies.</article>';
    $("projectStatus").textContent = "Database error: " + error.message;
    return;
  }

  if (!data?.length) {
    $("projectList").innerHTML =
      '<article class="card">No projects yet. Add your first project after Admin Login.</article>';
    return;
  }

  $("projectList").innerHTML = data.map(p => {
    const link = safeURL(p.project_url || "");
    return `<article class="card project">
      <p class="eyebrow">${escapeHTML(p.technology || "PROJECT")}</p>
      <h3>${escapeHTML(p.title)}</h3>
      <p class="muted">${escapeHTML(p.description)}</p>
      ${link ? `<a href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer">View Project ↗</a>` : ""}
    </article>`;
  }).join("");
}

$("contactForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  $("contactStatus").textContent = "Sending...";

  const payload = {
    name: $("contactName").value.trim(),
    email: $("contactEmail").value.trim(),
    message: $("contactMessage").value.trim()
  };

  if (!payload.name || !payload.email || !payload.message) {
    $("contactStatus").textContent = "Please complete every field.";
    button.disabled = false;
    return;
  }

  const { error } = await db.from("contact_messages").insert(payload);

  $("contactStatus").textContent = error
    ? "Message could not be sent: " + error.message
    : "Message sent successfully.";

  if (!error) $("contactForm").reset();
  button.disabled = false;
});

const dialog = $("loginDialog");

$("loginOpen").addEventListener("click", () => dialog.showModal());
$("loginCancel").addEventListener("click", () => dialog.close());

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  $("loginStatus").textContent = "Signing in...";

  const { error } = await db.auth.signInWithPassword({
    email: $("adminEmail").value.trim(),
    password: $("adminPassword").value
  });

  if (error) {
    $("loginStatus").textContent = "Login failed: " + error.message;
    return;
  }

  $("loginStatus").textContent = "Login successful.";
  $("loginForm").reset();
  dialog.close();
  await refreshAdmin();
  $("adminPanel").scrollIntoView({ behavior: "smooth" });
});

async function refreshAdmin() {
  const { data } = await db.auth.getSession();
  const session = data?.session;
  $("adminPanel").classList.toggle("show", !!session);

  if (session) {
    await loadAdminProjects();
    await loadMessages();
  }
}

db.auth.onAuthStateChange(() => setTimeout(refreshAdmin, 0));

$("logoutButton").addEventListener("click", async () => {
  const { error } = await db.auth.signOut();
  $("adminStatus").textContent = error ? error.message : "Signed out.";
  $("adminPanel").classList.remove("show");
});

$("projectForm").addEventListener("submit", async event => {
  event.preventDefault();
  const title = $("projectTitle").value.trim();
  const description = $("projectDescription").value.trim();
  const technology = $("projectTech").value.trim();
  const rawURL = $("projectUrl").value.trim();
  const project_url = rawURL ? safeURL(rawURL) : null;

  if (!title || !description || (rawURL && !project_url)) {
    $("adminProjectStatus").textContent =
      "Enter a title, description and a valid HTTP/HTTPS project URL.";
    return;
  }

  $("adminProjectStatus").textContent = "Saving...";

  const { error } = await db.from("projects").insert({
    title, description, technology, project_url
  });

  if (error) {
    $("adminProjectStatus").textContent = "Could not save: " + error.message;
    return;
  }

  $("projectForm").reset();
  $("adminProjectStatus").textContent = "Project added.";
  await loadProjects();
  await loadAdminProjects();
});

async function loadAdminProjects() {
  const { data, error } = await db.from("projects")
    .select("*").order("created_at", { ascending: false });

  if (error) {
    $("adminProjectList").textContent = "Could not load projects: " + error.message;
    return;
  }

  if (!data?.length) {
    $("adminProjectList").textContent = "No projects yet.";
    return;
  }

  $("adminProjectList").innerHTML = data.map(p => `
    <div class="admin-item">
      <strong>${escapeHTML(p.title)}</strong>
      <button class="secondary" type="button"
        data-delete-id="${escapeHTML(p.id)}">Delete</button>
    </div>`).join("");
}

$("adminProjectList").addEventListener("click", async event => {
  const button = event.target.closest("[data-delete-id]");
  if (!button || !confirm("Delete this project?")) return;

  const { error } = await db.from("projects")
    .delete().eq("id", button.dataset.deleteId);

  $("adminStatus").textContent = error ? error.message : "Project deleted.";
  if (!error) {
    await loadProjects();
    await loadAdminProjects();
  }
});

async function loadMessages() {
  const { data, error } = await db.from("contact_messages")
    .select("*").order("created_at", { ascending: false }).limit(50);

  if (error) {
    $("adminMessages").textContent = "Could not load messages: " + error.message;
    return;
  }

  if (!data?.length) {
    $("adminMessages").textContent = "No messages yet.";
    return;
  }

  $("adminMessages").innerHTML = data.map(m => `
    <article class="admin-item">
      <strong>${escapeHTML(m.name)}</strong>
      <p>${escapeHTML(m.email)}</p>
      <p>${escapeHTML(m.message)}</p>
      <small>${escapeHTML(m.created_at || "")}</small>
    </article>`).join("");
}

loadProjects();
refreshAdmin();
