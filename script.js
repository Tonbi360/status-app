const SUPABASE_URL = "https://nxmngjyiivylzovwqpki.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bW5nanlpaXZ5bHpvdndxcGtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDc4OTksImV4cCI6MjA5MTE4Mzg5OX0.D0ysMqpxxpFBzUuTfNe4aN0OrxuOqVEu4WC_hRgcRYQ";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxNFRzxTH00ccLcapzKhZ_oMtYcXliOOkzBbjYXPECP4PvlBa6fnNhVL1_xiBX2GEMn/exec";

let userId = localStorage.getItem('status_userId');
let username = localStorage.getItem('status_username');
let allStatuses = [];
let currentIndex = 0;
let storyTimeout;
let progressInterval;
const STORY_DURATION = 5000;

function init() {
    if (userId && username) {
        document.getElementById('main-area').classList.remove('hidden');
        document.getElementById('user-display').innerText = username.toUpperCase();
        loadFeed();
    } else {
        document.getElementById('setup-area').classList.remove('hidden');
    }
    document.getElementById('tap-left').onclick = (e) => { e.stopPropagation(); prevStatus(); };
    document.getElementById('tap-right').onclick = (e) => { e.stopPropagation(); nextStatus(); };
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
            
            const mediaHtml = s.Type === 'image' 
                ? `<img src="${s.MediaURL}" class="w-full h-full object-cover">`
                : `<video src="${s.MediaURL}" class="w-full h-full object-cover" muted playsinline></video>`;
            
            el.innerHTML = `
                ${mediaHtml}
                <div class="absolute bottom-0 p-3 w-full bg-gradient-to-t from-black/90 flex justify-between items-end">
                    <span class="text-[10px] font-black uppercase tracking-wider truncate mr-2">${s.Username}</span>
                    <span class="text-[9px] font-bold text-gray-400 flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        ${s.Views || 0}
                    </span>
                </div>`;
            grid.appendChild(el);
        });
    } catch (e) {}
}

function openViewer(index) {
    currentIndex = index;
    document.getElementById('viewer').classList.add('active');
    renderStatus();
    countView(allStatuses[index].MediaURL);
}

// NEW: Function to send view increment to Google Sheets
async function countView(url) {
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action: "incrementView", mediaUrl: url })
    });
}

function renderStatus() {
    clearTimers();
    const s = allStatuses[currentIndex];
    const content = document.getElementById('viewer-content');
    const container = document.getElementById('progress-container');
    document.getElementById('viewer-name').innerText = s.Username;

    container.innerHTML = "";
    allStatuses.forEach((_, i) => {
        const bar = document.createElement('div');
        bar.className = "progress-bar";
        const filler = document.createElement('div');
        filler.className = "progress-filler";
        if (i < currentIndex) filler.style.width = "100%";
        bar.appendChild(filler);
        container.appendChild(bar);
    });

    if (s.Type === 'image') {
        content.innerHTML = `<img src="${s.MediaURL}" class="max-w-full max-h-full object-contain">`;
        startTimer(STORY_DURATION);
    } else {
        content.innerHTML = `<video id="story-video" src="${s.MediaURL}" class="max-w-full max-h-full" autoplay playsinline></video>`;
        const vid = document.getElementById('story-video');
        vid.onloadedmetadata = () => startTimer(vid.duration * 1000);
    }
}

function startTimer(duration) {
    const start = Date.now();
    const filler = document.querySelectorAll('.progress-filler')[currentIndex];
    progressInterval = setInterval(() => {
        const elapsed = Date.now() - start;
        const progress = (elapsed / duration) * 100;
        filler.style.width = Math.min(progress, 100) + "%";
    }, 50);
    storyTimeout = setTimeout(() => { nextStatus(); }, duration);
}

function nextStatus() {
    if (currentIndex < allStatuses.length - 1) {
        currentIndex++;
        renderStatus();
        countView(allStatuses[currentIndex].MediaURL);
    } else {
        closeViewer();
    }
}

function prevStatus() {
    if (currentIndex > 0) {
        currentIndex--;
        renderStatus();
    } else {
        renderStatus();
    }
}

function clearTimers() {
    clearTimeout(storyTimeout);
    clearInterval(progressInterval);
}

function closeViewer() {
    clearTimers();
    document.getElementById('viewer').classList.remove('active');
    document.getElementById('viewer-content').innerHTML = "";
    loadFeed(); // Refresh feed to show new view counts
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
