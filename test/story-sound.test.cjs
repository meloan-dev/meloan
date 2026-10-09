const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = ['src/sfx.js', 'src/story-sound.js'].map(file => read(file).replace(/^import .*\n/gm, '').replace(/^export /gm, '')).join('\n');
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

class Target {
  listeners = {};
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  fire(type, target = this) { for (const fn of this.listeners[type] || []) fn({ target }); }
}
function setup(preference = null, loader) {
  let time = 0;
  const button = new Target();
  button.attrs = {};
  button.label = { textContent: '' };
  button.querySelector = () => button.label;
  button.setAttribute = (key, value) => button.attrs[key] = value;
  button.contains = target => target === button || target === button.label;
  const document = new Target();
  document.hidden = false;
  document.getElementById = () => button;
  const window = new Target();
  class AudioContext extends Target {
    state = 'suspended'; currentTime = 0; sampleRate = 16;
    pending = []; starts = 0; resumes = 0;
    constructor() { super(); window.context = this; }
    createGain() {
      const param = () => ({ value: 0, setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} });
      return { connect() {}, gain: param(), frequency: param(), Q: param(), threshold: param(), ratio: param(), start: () => this.starts++, stop() {} };
    }
    createDynamicsCompressor() { return this.createGain(); }
    createBiquadFilter() { return this.createGain(); }
    createOscillator() { return this.createGain(); }
    createBufferSource() { return this.createGain(); }
    createBuffer() { return { getChannelData: () => new Float32Array(32) }; }
    resume() { this.resumes++; return new Promise((resolve, reject) => this.pending.push({ resolve, reject })); }
    run() { this.state = 'running'; this.fire('statechange'); this.pending.splice(0).forEach(p => p.resolve()); }
    suspend() { this.state = 'suspended'; this.fire('statechange'); return Promise.resolve(); }
  }
  window.AudioContext = AudioContext;
  window.__loader = loader;
  const storage = { getItem: () => preference, setItem: (key, value) => { preference = value; } };
  const context = vm.createContext({ window, document, localStorage: storage, addEventListener: window.addEventListener.bind(window), Date: { now: () => time } });
  vm.runInContext(source + '\nthis.sfx = createStorySound();', context);
  return { window, document, button, sfx: context.sfx, storage, time: value => { time = value; } };
}

test('default preference is on, but the button stays pending until audio actually runs', async () => {
  const { window, button, sfx } = setup();
  assert.equal(sfx.enabled, true);
  assert.equal(button.label.textContent, 'Tap for sound');
  assert.equal(button.attrs['aria-pressed'], 'false');
  const before = window.context.starts;
  sfx.play('tick');
  assert.equal(window.context.starts, before);
  window.context.run(); await flush();
  assert.equal(button.label.textContent, 'Sound on');
  sfx.play('tick');
  assert.ok(window.context.starts > before);
});

test('a pending sound-button gesture cannot unlock on pointerdown then mute on click', async () => {
  const { window, button, sfx, storage } = setup();
  const context = window.context;
  const attempts = context.resumes;
  window.fire('pointerdown', button.label);
  window.fire('pointerup', button.label);
  assert.equal(context.resumes, attempts);
  button.fire('click'); window.fire('click', button);
  assert.equal(sfx.enabled, true);
  assert.equal(storage.getItem(), 'on');
  context.run(); await flush();
  assert.equal(button.label.textContent, 'Sound on');
  button.fire('click');
  assert.equal(button.label.textContent, 'Sound off');
});

test('explicit mute is retained, including after tab restore and gestures', async () => {
  const { window, document, button, sfx } = setup('off');
  window.fire('pointerdown'); window.fire('touchend');
  document.fire('visibilitychange'); window.fire('pageshow'); await flush();
  assert.equal(window.context, undefined);
  assert.equal(sfx.enabled, false);
  assert.equal(button.label.textContent, 'Sound off');
});

test('rejected resume stays pending and a later touch retries successfully', async () => {
  const { window, button } = setup();
  window.context.pending.splice(0).forEach(p => p.reject(new Error('blocked')));
  await flush();
  assert.equal(button.label.textContent, 'Tap for sound');
  window.fire('touchend');
  window.context.run(); await flush();
  assert.equal(button.label.textContent, 'Sound on');
});

test('interruption updates the button and visibility restore resumes audio', async () => {
  const { window, document, button, sfx } = setup();
  const context = window.context;
  context.run(); await flush();
  context.state = 'interrupted'; context.fire('statechange');
  assert.equal(button.label.textContent, 'Tap for sound');
  document.hidden = true; document.fire('visibilitychange');
  document.hidden = false; document.fire('visibilitychange');
  context.run(); await flush();
  assert.equal(sfx.running, true);
  assert.equal(button.label.textContent, 'Sound on');
});

test('a delayed suspend is repaired after a quick tab switch', async () => {
  const { window, document } = setup();
  const context = window.context;
  context.run(); await flush();
  let finish;
  context.suspend = () => new Promise(resolve => { finish = () => { context.state = 'suspended'; context.fire('statechange'); resolve(); }; });
  document.hidden = true; document.fire('visibilitychange');
  document.hidden = false; document.fire('visibilitychange');
  const attempts = context.resumes;
  finish(); await flush();
  assert.ok(context.resumes > attempts);
  context.run(); await flush();
});

test('opening effect waits for resume, but muted or stale effects never replay', async () => {
  let launch;
  const { window, sfx, time } = setup(null, { onLaunch: fn => { launch = fn; } });
  launch({ sound: true });
  const context = window.context;
  let before = context.starts;
  context.run(); await flush();
  assert.ok(context.starts > before);
  context.state = 'suspended';
  sfx.playWhenReady('emerge');
  before = context.starts;
  time(1500); context.run(); await flush();
  assert.equal(context.starts, before);
  context.state = 'suspended';
  sfx.playWhenReady('tick'); sfx.setEnabled(false);
  context.run(); await flush();
  assert.equal(context.starts, before);
});

test('late loader registration restores its choice without replaying the plunge', async () => {
  const { window, sfx } = setup(null, { onLaunch: fn => fn({ sound: true, late: true }) });
  const before = window.context.starts;
  window.context.run(); await flush();
  assert.equal(sfx.enabled, true);
  assert.equal(window.context.starts, before);
});

test('storage failure uses the sound-on default', () => {
  const { window, storage } = setup('off');
  storage.getItem = () => { throw new Error('private browsing'); };
  // Check the same initializer again with unavailable storage.
  const context = vm.createContext({ window, document: { hidden: false, getElementById: () => ({ setAttribute() {}, querySelector: () => ({}), addEventListener() {} }), addEventListener() {} }, localStorage: storage, addEventListener() {} });
  vm.runInContext(source + '\nthis.sfx = createStorySound();', context);
  assert.equal(context.sfx.enabled, true);
});
