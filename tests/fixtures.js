const base = require('@playwright/test');
const MCR = require('monocart-coverage-reports');
const options = require('./coverage-options');

// Every test collects JS coverage, and starts with browser APIs replaced by
// recorders so we can check chimes, notifications and wake locks.
const test = base.test.extend({
  stubs: [{}, { option: true }],
  page: async ({ page, stubs }, use) => {
    // Never wait on Google Fonts.
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '' }));
    await page.addInitScript(installStubs, stubs);
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await use(page);
    const coverage = await page.coverage.stopJSCoverage();
    await MCR(options).add(coverage);
  },
});

// Runs in the page before any app code.
function installStubs(opts) {
  const calls = (window.__calls = []);
  const log = (...a) => calls.push(a.join(':'));

  if (opts.noAudio) {
    delete window.AudioContext;
    delete window.webkitAudioContext;
  } else {
    window.AudioContext = class {
      constructor() {
        if (opts.audioThrows) throw new Error('no audio');
        log('audio');
        this.state = 'suspended';
        this.currentTime = 0;
        this.destination = {};
      }
      resume() { log('resume'); this.state = 'running'; }
      createOscillator() {
        if (opts.chimeThrows) throw new Error('no oscillator');
        log('osc');
        const node = { frequency: {}, connect: () => node, start() {}, stop() {} };
        return node;
      }
      createGain() {
        const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
        const node = { gain: param, connect: () => node };
        return node;
      }
    };
  }

  if (opts.noNotification) {
    delete window.Notification;
  } else {
    window.Notification = class {
      static get permission() { return opts.permission || 'default'; }
      static requestPermission() {
        if (opts.permissionThrows) throw new Error('nope');
        log('requestPermission');
        return Promise.resolve('granted');
      }
      constructor(title, o) {
        if (opts.notifyThrows) throw new Error('nope');
        log('notify', title, o.body);
        window.__lastNotification = this;
      }
      close() { log('close'); }
    };
  }
  window.focus = () => log('focus');

  if (opts.noWakeLock) {
    delete Navigator.prototype.wakeLock;
  } else {
    Object.defineProperty(Navigator.prototype, 'wakeLock', {
      configurable: true,
      get: () => ({
        request: async () => {
          if (opts.wakeThrows) throw new Error('denied');
          log('wake');
          const listeners = [];
          const sentinel = {
            addEventListener: (_t, fn) => listeners.push(fn),
            release() {
              if (opts.releaseThrows) throw new Error('nope');
              log('release');
              listeners.forEach((fn) => fn());
            },
          };
          window.__sentinel = sentinel;
          return sentinel;
        },
      }),
    });
  }

  Object.defineProperty(Navigator.prototype, 'vibrate', {
    configurable: true,
    value: opts.noVibrate
      ? undefined
      : (p) => { if (opts.vibrateThrows) throw new Error('nope'); log('vibrate', p.join(',')); return true; },
  });

  // Lets a test pretend the tab is hidden.
  window.__hidden = false;
  Object.defineProperty(Document.prototype, 'visibilityState', {
    configurable: true,
    get: () => (window.__hidden ? 'hidden' : 'visible'),
  });
}

module.exports = { test, expect: base.expect };
