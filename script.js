const SUPABASE_URL = "https://nxmngjyiivylzovwqpki.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bW5nanlpaXZ5bHpvdndxcGtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDc4OTksImV4cCI6MjA5MTE4Mzg5OX0.D0ysMqpxxpFBzUuTfNe4aN0OrxuOqVEu4WC_hRgcRYQ";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxNFRzxTH00ccLcapzKhZ_oMtYcXliOOkzBbjYXPECP4PvlBa6fnNhVL1_xiBX2GEMn/exec";

let userId = localStorage.getItem('status_userId');
let username = localStorage.getItem('status_username');

let groupedStatuses = []; // Array of arrays: [[user1_s1, user1_s2], [user2_s1]]
let personIndex = 0;      // Current person (Vertical)
let mediaIndex = 0;       // Current status of that person (Horizontal)

let storyTimeout, progressInterval;
let touchStartY = 0;
const STORY_DURATION = 5000;
let isMuted = true;

function init() {
    if (userId && username) {
        document.getElementById('setup-area').classList.add('hidden');
        document.getElementById('user-display').innerText = username.toUpperCase();
        switchTab('home');
        fetchData();
    } else {
        document.getElementById('setup-area').classList.remove('hidden');
    }

    // Vertical Swipe Setup
    const home = document.getElementById('view-home');
    home.addEventListener('touchstart', e => touchStartY = e.touches[0].clientY, {passive: true});
    home.addEventListener('touchend', handleSwipe, {passive: true});
    
    // Horizontal Tap Setup
    document.getElementById('tap-left').onclick = (e) => { e.stopPropagation(); prevMedia(); };
    document.getElementById('tap-right').onclick = (e) => { e.stopPropagation(); nextMedia(); };
}

// 1. DATA LOADING & GROUPING
async function fetchData() {
    const streamContainer = document.getElementById('stream-container');
    streamContainer.innerHTML = "<p class='text-white font-black animate-pulse tracking-tighter text-xl'>FETCHING STREAM...</p>";

    try {
        const res = await fetch(GOOGLE_SCRIPT_URL);
        const raw = await res.json();
        
        if (!raw || raw.length === 0) {
            streamContainer.innerHTML = "<p class='text-gray-500'>No statuses yet.</p>";
            return;
        }

        // Handle Rankings (Tab 3)
        const sortedForPoll = [...raw].sort((a, b) => (Number(b.Likes) || 0) - (Number(a.Likes) || 0));
        renderPoll(sortedForPoll);

        // Grouping by UserID
        const groups = {};
        raw.forEach(s => {
            const uid = s.UserID || s.userId;
            if (!groups[uid]) groups[uid] = [];
            groups[uid].push(s);
        });
        
        // Convert to array of arrays, newest first
        groupedStatuses = Object.values(groups).reverse();
        renderStream();

    } catch (e) { 
        streamContainer.innerHTML = "<p class='text-red-600 font-bold'>OFFLINE</p>";
    }
}

// 2. STREAM RENDERING
function renderStream() {
    clearTimers();
    if (groupedStatuses.length === 0) return;

    const person = groupedStatuses[personIndex];
    const status = person[mediaIndex];
    
    const container = document.getElementById('stream-container');
    const progContainer = document.getElementById('progress-container');
    
    // Update UI Labels
    document.getElementById('stream-username').innerText = status.Username || status.username;
    document.getElementById('stream-view-count').innerText = status.Views || 0;
    document.getElementById('stream-vote-count').innerText = status.Likes || 0;

    // Reset & Build Progress Bars
    progContainer.innerHTML = "";
    person.forEach((_, i) => {
        const bar = document.createElement('div');
        bar.className = "progress-bar";
        const filler = document.createElement('div');
        filler.className = "progress-filler";
        if (i < mediaIndex) filler.style.width = "100%";
        bar.appendChild(filler);
        progContainer.appendChild(bar);
    });

    // Render Media
    if (status.Type === 'image' || status.type === 'image') {
        container.innerHTML = `<img src="${status.MediaURL || status.mediaUrl}" class="w-full h-full object-cover">`;
        startTimer(STORY_DURATION);
    } else {
        container.innerHTML = `<video id="active-video" src="${status.MediaURL || status.mediaUrl}" autoplay playsinline ${isMuted ? 'muted' : ''} class="w-full h-full object-cover"></video>`;
        const vid = document.getElementById('active-video');
        vid.onloadedmetadata = () => startTimer(vid.duration * 1000);
        vid.onended = () => nextMedia();
    }
    
    countView(status.MediaURL || status.mediaUrl);
}

// 3. NAVIGATION (SWIPES & TAPS)
function handleSwipe(e) {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY - touchEndY;
    if (Math.abs(diff) < 50) return;
    
    if (diff > 0) nextPerson(); // Swipe Up
    else prevPerson();         // Swipe Down
}

function nextMedia() {
    if (mediaIndex < groupedStatuses[personIndex].length - 1) {
        mediaIndex++;
        renderStream();
    } else {
        nextPerson();
    }
}

function prevMedia() {
    if (mediaIndex > 0) {
        mediaIndex--;
        renderStream();
    } else {
        prevPerson();
    }
}

function nextPerson() {
    if (personIndex < groupedStatuses.length - 1) {
        personIndex++;
        mediaIndex = 0;
        renderStream();
    }
}

function prevPerson() {
    if (personIndex > 0) {
        personIndex--;
        mediaIndex = 0;
        renderStream();
    }
}

// 4. TAB & UI CONTROLS
function switchTab(tab) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`view-${tab}`).classList.remove('hidden');
    document.getElementById(`nav-${tab}`).classList.add('active');

    clearTimers();
    if (tab === 'home' && groupedStatuses.length > 0) renderStream();
}

function toggleMute() {
    isMuted = !isMuted;
    const vid = document.getElementById('active-video');
    if (vid) vid.muted = isMuted;
    document.getElementById('mute-btn').innerText = isMuted ? '🔇' : '🔊';
}

function togglePlay() {
    const vid = document.getElementById('active-video');
    if (!vid) return;
    if (vid.paused) {
        vid.play();
        document.getElementById('play-btn').innerText = '⏸';
    } else {
        vid.pause();
        document.getElementById('play-btn').innerText = '▶';
    }
}

// 5. RANKINGS & BACKEND
function renderPoll(list) {
    const pollArea = document.getElementById('poll-list');
    pollArea.innerHTML = "";
    list.slice(0, 100).forEach((s, i) => {
        const card = document.createElement('div');
        card.className = `rank-card ${i < 3 ? 'top-3' : ''}`;
        card.innerHTML = `
            <div class="rank-number">${i + 1}</div>
            <div class="flex-1">
                <div class="font-black uppercase text-sm">${s.Username || s.username}</div>
                <div class="text-[10px] text-gray-500 font-bold">${s.Views || 0} VIEWS</div>
            </div>
            <div class="text-orange-500 font-black">🔥 ${s.Likes || 0}</div>
        `;
        card.onclick = () => {
            const pIdx = groupedStatuses.findIndex(g => (g[0].UserID || g[0].userId) === (s.UserID || s.userId));
            if (pIdx !== -1) {
                personIndex = pIdx;
                mediaIndex = 0;
                switchTab('home');
            }
        };
        pollArea.appendChild(card);
    });
}

async function voteCurrent() {
    const s = groupedStatuses[personIndex][mediaIndex];
    document.getElementById('stream-vote-count').innerText = Number(document.getElementById('stream-vote-count').innerText) + 1;
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action: "incrementVote", mediaUrl: s.MediaURL || s.mediaUrl, userId: userId })
    });
}

async function countView(url) {
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action: "incrementView", mediaUrl: url, userId: userId })
    });
}

// 6. UPLOAD & TIMERS
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
        setTimeout(() => { msg.innerText = ""; switchTab('home'); fetchData(); }, 1500);
    } catch (e) { msg.innerText = "ERROR"; }
}

function startTimer(duration) {
    const start = Date.now();
    const fillers = document.querySelectorAll('.progress-filler');
    if (!fillers[mediaIndex]) return;

    progressInterval = setInterval(() => {
        const elapsed = Date.now() - start;
        fillers[mediaIndex].style.width = Math.min((elapsed / duration) * 100, 100) + "%";
    }, 50);
    storyTimeout = setTimeout(() => nextMedia(), duration);
}

function clearTimers() {
    clearTimeout(storyTimeout);
    clearInterval(progressInterval);
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

init();
