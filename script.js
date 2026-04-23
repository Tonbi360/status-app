const SUPABASE_URL = "https://nxmngjyiivylzovwqpki.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bW5nanlpaXZ5bHpvdndxcGtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDc4OTksImV4cCI6MjA5MTE4Mzg5OX0.D0ysMqpxxpFBzUuTfNe4aN0OrxuOqVEu4WC_hRgcRYQ";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxNFRzxTH00ccLcapzKhZ_oMtYcXliOOkzBbjYXPECP4PvlBa6fnNhVL1_xiBX2GEMn/exec";

let userId = localStorage.getItem('status_userId');
let username = localStorage.getItem('status_username');

let groupedStatuses = []; 
let personIndex = 0;      
let mediaIndex = 0;       

let storyTimeout, progressInterval;
let touchStartY = 0;
const STORY_DURATION = 5000;
let isMuted = true;

// 🆕 FIX #3: Debounce timer for votes
let voteTimeout;

function init() {
    // Check Identity
    if (!userId || !username) {
        document.getElementById('setup-area').classList.remove('hidden');
    } else {
        document.getElementById('setup-area').classList.add('hidden');
        // Initial Startup
        fetchData();
    }

    // Bind Vertical Swipes
    const homeView = document.getElementById('view-home');
    homeView.addEventListener('touchstart', e => touchStartY = e.touches[0].clientY, {passive: true});
    homeView.addEventListener('touchend', e => {
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchStartY - touchEndY;
        if (Math.abs(diff) > 50) {
            if (diff > 0) nextPerson(); else prevPerson();
        }
    }, {passive: true});

    // Bind Horizontal Taps
    document.getElementById('tap-left').onclick = (e) => { e.stopPropagation(); prevMedia(); };
    document.getElementById('tap-right').onclick = (e) => { e.stopPropagation(); nextMedia(); };
}

// --- DATA LOGIC ---

async function fetchData() {
    const container = document.getElementById('stream-container');
    container.innerHTML = "<div class='text-white font-black animate-pulse text-xl tracking-tighter'>LOADING...</div>";
    try {
        const res = await fetch(GOOGLE_SCRIPT_URL);
        const raw = await res.json();
        
        if (!raw || raw.length === 0) {
            container.innerHTML = "<div class='text-gray-500 font-bold'>NO STATUSES YET</div>";
            return;
        }

        // 1. Group by UserID (using exact JSON keys)
        const groups = {};
        raw.forEach(item => {
            const uid = item.UserID;
            if (!groups[uid]) groups[uid] = [];
            groups[uid].push(item);
        });
        
        // 2. Sort groups by latest timestamp (reverse)
        groupedStatuses = Object.values(groups).reverse();
        
        // 3. Render Rankings (Tab 3)
        const sortedForPoll = [...raw].sort((a, b) => (Number(b.Likes) || 0) - (Number(a.Likes) || 0));
        renderPoll(sortedForPoll);

        // 4. Trigger first view
        switchTab('home');
    } catch (e) {
        container.innerHTML = "<div class='text-red-500'>CONNECTION ERROR</div>";
    }
}

function renderStream() {
    clearTimers();
    if (groupedStatuses.length === 0) return;

    const person = groupedStatuses[personIndex];
    const status = person[mediaIndex];
    
    const container = document.getElementById('stream-container');
    const progContainer = document.getElementById('progress-container');
    
    // Update Labels
    document.getElementById('stream-username').innerText = status.Username;
    document.getElementById('stream-view-count').innerText = status.Views || 0;
    document.getElementById('stream-vote-count').innerText = status.Likes || 0;

    // Reset Progress Bars
    progContainer.innerHTML = "";
    person.forEach((_, i) => {        const bar = document.createElement('div');
        bar.className = "progress-bar";
        const filler = document.createElement('div');
        filler.className = "progress-filler";
        if (i < mediaIndex) filler.style.width = "100%";
        bar.appendChild(filler);
        progContainer.appendChild(bar);
    });

    // Display Media
    if (status.Type === 'image') {
        container.innerHTML = `<img src="${status.MediaURL}" class="media-box fade-in">`;
        startTimer(STORY_DURATION);
    } else {
        container.innerHTML = `<video id="active-video" src="${status.MediaURL}" autoplay playsinline ${isMuted ? 'muted' : ''} class="media-box"></video>`;
        const vid = document.getElementById('active-video');
        
        vid.play().catch(() => {
            isMuted = true;
            vid.muted = true;
            vid.play();
        });

        // 🆕 FIX #2: Video error handler
        vid.onerror = () => {
          document.getElementById('stream-container').innerHTML = 
            "<div class='text-red-500 font-black'>MEDIA FAILED • SWIPE TO SKIP</div>";
        };

        vid.onloadedmetadata = () => startTimer(vid.duration * 1000);
        vid.onended = () => nextMedia();
    }
    
    countView(status.MediaURL);
}

// --- NAVIGATION ---

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
        mediaIndex--;        renderStream();
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

function switchTab(tab) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const target = document.getElementById(`view-${tab}`);
    const nav = document.getElementById(`nav-${tab}`);
    
    if (target) target.classList.remove('hidden');
    if (nav) nav.classList.add('active');

    if (tab === 'home') {
        renderStream();
    } else {
        clearTimers();
    }
}

// --- CONTROLS ---

function toggleMute() {
    isMuted = !isMuted;
    const vid = document.getElementById('active-video');
    if (vid) vid.muted = isMuted;
    document.getElementById('mute-btn').innerText = isMuted ? '🔇' : '🔊';
}

function togglePlay() {
    const vid = document.getElementById('active-video');    if (!vid) return;
    if (vid.paused) {
        vid.play();
        document.getElementById('play-btn').innerText = '⏸';
    } else {
        vid.pause();
        document.getElementById('play-btn').innerText = '▶';
    }
}

// --- UI HELPERS ---

function renderPoll(list) {
    const pollArea = document.getElementById('poll-list');
    pollArea.innerHTML = "";
    list.slice(0, 100).forEach((s, i) => {
        const card = document.createElement('div');
        card.className = `rank-card ${i < 3 ? 'top-3' : ''}`;
        card.innerHTML = `
            <div class="rank-number">${i + 1}</div>
            <div class="flex-1">
                <div class="font-black uppercase text-[13px] tracking-tight">${s.Username}</div>
                <div class="text-[9px] text-gray-500 font-bold tracking-widest">${s.Views || 0} VIEWS</div>
            </div>
            <div class="text-orange-500 font-black text-xs">🔥 ${s.Likes || 0}</div>
        `;
        card.onclick = () => {
            const pIdx = groupedStatuses.findIndex(g => g[0].UserID === s.UserID);
            if (pIdx !== -1) {
                personIndex = pIdx;
                mediaIndex = groupedStatuses[pIdx].findIndex(m => m.MediaURL === s.MediaURL);
                switchTab('home');
            }
        };
        pollArea.appendChild(card);
    });
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

// --- SHARED ACTIONS ---

// 🆕 FIX #3: Debounced vote function
async function voteCurrent() {
  clearTimeout(voteTimeout);
  voteTimeout = setTimeout(() => {
    const s = groupedStatuses[personIndex][mediaIndex];
    const el = document.getElementById('stream-vote-count');
    el.innerText = Number(el.innerText) + 1;
    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ action: "incrementVote", mediaUrl: s.MediaURL, userId: userId })
    });
  }, 200);
}

async function countView(url) {
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action: "incrementView", mediaUrl: url, userId: userId })
    });
}

// 🆕 FIX #1: File size validation in handleFile
async function handleFile(input) {
    const file = input.files[0];
    if (!file) return;
    
    // Check file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      document.getElementById('status-msg').innerText = "FILE TOO LARGE (20MB MAX)";
      input.value = '';
      return;
    }
    
    const msg = document.getElementById('status-msg');
    msg.innerText = "UPLOADING...";
    const fileName = `${userId}_${Date.now()}.${file.name.split('.').pop()}`;
    try {
        const up = await fetch(`${SUPABASE_URL}/storage/v1/object/status-media/${fileName}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY, 'Content-Type': file.type },
            body: file        });
        if (!up.ok) throw new Error();
        const url = `${SUPABASE_URL}/storage/v1/object/public/status-media/${fileName}`;
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ userId, username, mediaUrl: url, type: file.type.startsWith('video') ? 'video' : 'image' })
        });
        msg.innerText = "DONE!";
        setTimeout(() => { msg.innerText = ""; switchTab('home'); fetchData(); }, 1000);
    } catch (e) { msg.innerText = "FAIL"; }
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
