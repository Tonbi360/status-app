const SUPABASE_URL = "https://nxmngjyiivylzovwqpki.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bW5nanlpaXZ5bHpvdndxcGtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDc4OTksImV4cCI6MjA5MTE4Mzg5OX0.D0ysMqpxxpFBzUuTfNe4aN0OrxuOqVEu4WC_hRgcRYQ";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxNFRzxTH00ccLcapzKhZ_oMtYcXliOOkzBbjYXPECP4PvlBa6fnNhVL1_xiBX2GEMn/exec";

let userId = localStorage.getItem('status_userId');
let username = localStorage.getItem('status_username');
let allStatuses = [];

function init() {
    if (userId && username) {
        document.getElementById('main-area').classList.remove('hidden');
        document.getElementById('user-display').innerText = username.toUpperCase();
        loadFeed();
    } else {
        document.getElementById('setup-area').classList.remove('hidden');
    }
}

function saveUser() {
    const val = document.getElementById('username-input').value;
    if (val.length < 2) return;
    userId = 'uid_' + Math.random().toString(36).substr(2, 9);
    username = val;
    localStorage.setItem('status_userId', userId);
    localStorage.setItem('status_username', username);
    location.reload();
}

async function handleFile(input) {
    const file = input.files[0];
    if (!file) return;
    const msg = document.getElementById('status-msg');
    msg.innerText = "UPLOADING...";
    const fileName = `${userId}_${Date.now()}.${file.name.split('.').pop()}`;
    try {
        const up = await fetch(`${SUPABASE_URL}/storage/v1/object/status-media/${fileName}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY, 'Content-Type': file.type },
            body: file
        });
        if (!up.ok) throw new Error();
        const url = `${SUPABASE_URL}/storage/v1/object/public/status-media/${fileName}`;
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ userId, username, mediaUrl: url, type: file.type.startsWith('video') ? 'video' : 'image' })
        });
        msg.innerText = "POSTED!";
        setTimeout(() => msg.innerText = "", 2000);
        loadFeed();
    } catch (e) { msg.innerText = "ERROR"; }
}

async function loadFeed() {
    const grid = document.getElementById('feed-grid');
    grid.innerHTML = "";
    try {
        const res = await fetch(GOOGLE_SCRIPT_URL);
        allStatuses = await res.json();
        allStatuses.reverse().forEach((s, index) => {
            const el = document.createElement('div');
            el.className = "relative aspect-vertical bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 cursor-pointer active:scale-95 transition-transform";
            el.onclick = () => openViewer(index);
            if (s.Type === 'image') {
                el.innerHTML = `<img src="${s.MediaURL}" class="w-full h-full object-cover">`;
            } else {
                el.innerHTML = `<video src="${s.MediaURL}" class="w-full h-full object-cover" muted playsinline></video>`;
            }
            el.innerHTML += `<div class="absolute bottom-0 p-3 w-full bg-gradient-to-t from-black/80 text-[10px] font-black uppercase tracking-wider">${s.Username}</div>`;
            grid.appendChild(el);
        });
    } catch (e) {}
}

function openViewer(index) {
    const s = allStatuses[index];
    const viewer = document.getElementById('viewer');
    const content = document.getElementById('viewer-content');
    document.getElementById('viewer-name').innerText = s.Username;
    if (s.Type === 'image') {
        content.innerHTML = `<img src="${s.MediaURL}" class="max-w-full max-h-full object-contain">`;
    } else {
        content.innerHTML = `<video src="${s.MediaURL}" class="max-w-full max-h-full" autoplay playsinline controls></video>`;
    }
    viewer.classList.add('active');
}

function closeViewer() {
    document.getElementById('viewer').classList.remove('active');
    document.getElementById('viewer-content').innerHTML = "";
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
