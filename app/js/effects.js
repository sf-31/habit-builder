// Notifications, sound and the screen wake lock. Every call is optional:
// a missing or failing browser feature never stops the flow.

let audio = null;
let wakeLock = null;

export function primeAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch {}
}

export function chime() {
  if (!audio) return;
  try {
    audio.resume();
    const now = audio.currentTime;
    [[659.25, 0], [880, 0.4], [1318.5, 0.8]].forEach(([f, d]) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + d);
      g.gain.exponentialRampToValueAtTime(0.22, now + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + d + 1.8);
      o.connect(g).connect(audio.destination);
      o.start(now + d);
      o.stop(now + d + 1.9);
    });
  } catch {}
}

export function askNotify() {
  if ('Notification' in window && Notification.permission === 'default') {
    try { Notification.requestPermission(); } catch {}
  }
}

export function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag: 'fifteen' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch {}
}

export async function requestWake() {
  try {
    if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch {}
}

export function releaseWake() {
  try { wakeLock && wakeLock.release(); } catch {}
  wakeLock = null;
}
