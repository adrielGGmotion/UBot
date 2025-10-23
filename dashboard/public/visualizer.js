document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    const elements = {
        backgroundBlur: document.querySelector('.background-blur'),
        albumArt: document.querySelector('.album-art'),
        trackTitle: document.querySelector('.track-title'),
        trackArtist: document.querySelector('.track-artist'),
        progressBar: document.querySelector('.progress-bar'),
        currentTime: document.querySelector('.current-time'),
        totalTime: document.querySelector('.total-time'),
        repeatBtn: document.getElementById('repeat-btn'),
        playPauseBtn: document.getElementById('play-pause-btn'),
        skipBtn: document.getElementById('skip-btn'),
        volumeBtn: document.getElementById('volume-btn'),
        volumeSlider: document.querySelector('.volume-slider'),
        queueBtn: document.getElementById('queue-btn'),
        lyricsContainer: document.querySelector('.lyrics-container'),
        toast: document.getElementById('toast-notification'),
    };

    let guildId = null;
    let sessionToken = null;
    let lrcLyrics = null;
    let currentLineIndex = -1;
    let progressUpdateInterval = null;

    function getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        guildId = params.get('guildId');
        sessionToken = params.get('token');
    }

    function formatTime(ms) {
        if (isNaN(ms)) return '00:00';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function updateTrackProgress(position, duration) {
        elements.currentTime.textContent = formatTime(position);
        elements.progressBar.max = duration || 100;
        elements.progressBar.value = position;
    }

    function startProgressUpdater(track) {
        if (progressUpdateInterval) clearInterval(progressUpdateInterval);
        if (track.isPaused) return;

        let currentPosition = track.position;
        progressUpdateInterval = setInterval(() => {
            currentPosition += 1000;
            if (currentPosition > track.duration) {
                clearInterval(progressUpdateInterval);
                currentPosition = track.duration;
            }
            updateTrackProgress(currentPosition, track.duration);
            if (lrcLyrics) {
                updateLyrics(currentPosition);
            }
        }, 1000);
    }

    function parseLRC(lrcText) {
        if (!lrcText) return null;
        const lines = lrcText.split('\n');
        const timings = [];
        const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

        for (const line of lines) {
            const match = line.match(timeRegex);
            if (match) {
                const minutes = parseInt(match[1], 10);
                const seconds = parseInt(match[2], 10);
                let milliseconds = parseInt(match[3], 10);
                if (match[3].length === 2) milliseconds *= 10;

                const time = (minutes * 60 + seconds) * 1000 + milliseconds;
                const text = line.replace(timeRegex, '').trim();
                if (text) {
                    timings.push({ time, text });
                }
            }
        }
        return timings.length > 0 ? timings : null;
    }


    function updateLyrics(currentTime) {
        if (!lrcLyrics) return;

        let nextLineIndex = lrcLyrics.findIndex(line => line.time > currentTime);
        if (nextLineIndex === -1) nextLineIndex = lrcLyrics.length;
        const newCurrentLineIndex = nextLineIndex - 1;

        if (newCurrentLineIndex !== currentLineIndex && newCurrentLineIndex >= 0) {
            currentLineIndex = newCurrentLineIndex;

            const activeLine = elements.lyricsContainer.children[currentLineIndex];
            const oldActiveLine = document.querySelector('.lyrics-line.active');

            if (oldActiveLine) oldActiveLine.classList.remove('active');
            if (activeLine) {
                activeLine.classList.add('active');
                activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    function setupUI(data) {
        if (!data || !data.track) {
            elements.trackTitle.textContent = "Nothing Playing";
            elements.trackArtist.textContent = " ";
            elements.albumArt.src = "";
            elements.backgroundBlur.style.backgroundImage = "";
            elements.totalTime.textContent = '00:00';
            updateTrackProgress(0, 1);
            if (progressUpdateInterval) clearInterval(progressUpdateInterval);
            return;
        }

        const { track, isPaused, volume, loop } = data;

        elements.backgroundBlur.style.backgroundImage = `url(${track.artworkUrl})`;
        elements.albumArt.src = track.artworkUrl;
        elements.trackTitle.textContent = track.title;
        elements.trackArtist.textContent = track.author;
        elements.totalTime.textContent = formatTime(track.duration);
        elements.progressBar.max = track.duration;

        updateTrackProgress(track.position, track.duration);
        startProgressUpdater({ ...track, isPaused });

        elements.playPauseBtn.innerHTML = isPaused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
        elements.volumeSlider.value = volume;

        lrcLyrics = parseLRC(data.lyrics);
        elements.lyricsContainer.innerHTML = '';
        if (lrcLyrics) {
            lrcLyrics.forEach(line => {
                const p = document.createElement('p');
                p.classList.add('lyrics-line');
                p.textContent = line.text;
                elements.lyricsContainer.appendChild(p);
            });
            updateLyrics(track.position);
        } else {
            const p = document.createElement('p');
            p.classList.add('lyrics-line');
            p.textContent = data.lyrics || "Lyrics not available for this track.";
            elements.lyricsContainer.appendChild(p);
        }
    }

    function showToast(message) {
        elements.toast.textContent = message;
        elements.toast.classList.add('show');
        setTimeout(() => {
            elements.toast.classList.remove('show');
        }, 3000);
    }

    function controlPlayback(action, value = null) {
        if (!guildId || !sessionToken) {
            showToast("Only the session owner can control playback.");
            return;
        }
        socket.emit('musicControl', { guildId, sessionToken, action, value });
    }

    // --- Event Listeners ---
    elements.playPauseBtn.addEventListener('click', () => controlPlayback('play_pause'));
    elements.skipBtn.addEventListener('click', () => controlPlayback('skip'));
    elements.repeatBtn.addEventListener('click', () => controlPlayback('repeat'));
    elements.progressBar.addEventListener('input', (e) => {
        controlPlayback('seek', { position: parseInt(e.target.value, 10) });
    });
    elements.volumeSlider.addEventListener('input', (e) => {
        controlPlayback('volume', { level: e.target.value });
    });


    // --- Socket.IO Event Handlers ---
    socket.on('connect', () => {
        console.log('Connected to server via WebSocket.');
        getUrlParams();
        if (guildId) {
            socket.emit('joinVisualizer', guildId);
        }
    });

    socket.on('playerUpdate', (data) => {
        setupUI(data);
    });

    socket.on('unauthorized', () => {
        showToast("Only the session owner can control playback.");
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server.');
        if (progressUpdateInterval) clearInterval(progressUpdateInterval);
    });

    getUrlParams();
});
