const DEFAULT_SETTINGS = Object.freeze({ focus: 25, short: 5, long: 15, roundsBeforeLong: 4, autoStart: false, soundEnabled: true });
const MODE_COPY = Object.freeze({
  focus: { title: "Focus session", action: "Start focus" },
  short: { title: "Short break", action: "Start break" },
  long: { title: "Long break", action: "Start break" }
});
const STORAGE_KEYS = Object.freeze({ settings: "tomato-settings", stats: "tomato-stats" });
const RING_CIRCUMFERENCE = 2 * Math.PI * 146;
const select = (selector) => document.querySelector(selector);
const selectAll = (selector) => [...document.querySelectorAll(selector)];

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

function localDateKey() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

class PomodoroTimer {
  constructor() {
    this.elements = {
      timer: select("#timer"), modeTitle: select("#modeTitle"), roundLabel: select("#roundLabel"),
      startButton: select("#startButton"), ring: select("#ringProgress"), todayCount: select("#todayCount"),
      tomatoes: select("#tomatoes"), settingsDialog: select("#settingsDialog"), settingsForm: select("#settingsForm")
    };
    this.settings = { ...DEFAULT_SETTINGS, ...readJson(STORAGE_KEYS.settings, {}) };
    this.state = { mode: "focus", round: 1, running: false, endAt: 0, ticker: null };
    this.setDuration();
    this.bindEvents();
    this.render();
    this.renderStats();
  }

  setDuration() {
    this.state.totalSeconds = this.settings[this.state.mode] * 60;
    this.state.remainingSeconds = this.state.totalSeconds;
  }

  bindEvents() {
    this.elements.startButton.addEventListener("click", () => this.handleStartClick());
    select("#resetButton").addEventListener("click", () => this.reset());
    select("#skipButton").addEventListener("click", () => this.skip());
    select("#settingsButton").addEventListener("click", () => this.openSettings());
    select("#saveSettings").addEventListener("click", (event) => this.saveSettings(event));
    select("#clearToday").addEventListener("click", () => this.clearToday());
    selectAll(".mode-tab").forEach((tab) => tab.addEventListener("click", () => this.changeMode(tab.dataset.mode)));
    this.elements.settingsDialog.addEventListener("click", (event) => {
      if (event.target === this.elements.settingsDialog) this.elements.settingsDialog.close();
    });
    document.addEventListener("keydown", (event) => this.handleKeyboard(event));
    document.addEventListener("visibilitychange", () => { if (!document.hidden && this.state.running) this.tick(); });
  }

  async handleStartClick() {
    if (!this.state.running && "Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch { /* Notifications remain optional. */ }
    }
    this.toggle();
  }

  handleKeyboard(event) {
    if (this.elements.settingsDialog.open || ["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
    if (event.code === "Space") { event.preventDefault(); this.toggle(); }
    if (event.key.toLowerCase() === "r") this.reset();
    if (event.key.toLowerCase() === "s") this.skip();
  }

  start() {
    if (this.state.running) return;
    this.state.running = true;
    this.state.endAt = Date.now() + this.state.remainingSeconds * 1000;
    this.state.ticker = window.setInterval(() => this.tick(), 250);
    this.render();
  }

  pause() {
    this.state.running = false;
    window.clearInterval(this.state.ticker);
    this.state.ticker = null;
    this.render();
  }

  toggle() { this.state.running ? this.pause() : this.start(); }

  tick() {
    this.state.remainingSeconds = Math.max(0, Math.ceil((this.state.endAt - Date.now()) / 1000));
    this.render();
    if (this.state.remainingSeconds === 0) this.completeStage();
  }

  reset() {
    this.pause();
    this.state.remainingSeconds = this.state.totalSeconds;
    this.render();
  }

  changeMode(mode) {
    this.pause();
    this.state.mode = mode;
    this.setDuration();
    this.render();
  }

  skip() {
    const nextMode = this.state.mode === "focus" ? (this.state.round >= this.settings.roundsBeforeLong ? "long" : "short") : "focus";
    this.changeMode(nextMode);
  }

  completeStage() {
    const completedMode = this.state.mode;
    this.pause();
    if (this.settings.soundEnabled) this.playChime();
    this.notify(completedMode);
    if (completedMode === "focus") {
      this.recordSession();
      const isLongBreak = this.state.round >= this.settings.roundsBeforeLong;
      this.state.round = isLongBreak ? 1 : this.state.round + 1;
      this.changeMode(isLongBreak ? "long" : "short");
    } else {
      this.changeMode("focus");
    }
    if (this.settings.autoStart) this.start();
  }

  notify(completedMode) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const title = completedMode === "focus" ? "Focus session complete" : "Break complete";
    const body = completedMode === "focus" ? "Nice work. Take a moment to recharge." : "Ready for another focused session?";
    new Notification(title, { body });
  }

  playChime() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    [0, 0.16].forEach((delay, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = index ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.14, context.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + 0.38);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + 0.4);
    });
  }

  getStats() { return readJson(STORAGE_KEYS.stats, {}); }

  recordSession() {
    const stats = this.getStats();
    const key = localDateKey();
    stats[key] = (stats[key] || 0) + 1;
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
    this.renderStats();
  }

  clearToday() {
    const stats = this.getStats();
    delete stats[localDateKey()];
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
    this.renderStats();
  }

  openSettings() {
    select("#focusMinutes").value = this.settings.focus;
    select("#shortMinutes").value = this.settings.short;
    select("#longMinutes").value = this.settings.long;
    select("#roundsBeforeLong").value = this.settings.roundsBeforeLong;
    select("#autoStart").checked = this.settings.autoStart;
    select("#soundEnabled").checked = this.settings.soundEnabled;
    this.elements.settingsDialog.showModal();
  }

  saveSettings(event) {
    event.preventDefault();
    if (!this.elements.settingsForm.reportValidity()) return;
    this.settings = {
      focus: Number(select("#focusMinutes").value), short: Number(select("#shortMinutes").value),
      long: Number(select("#longMinutes").value), roundsBeforeLong: Number(select("#roundsBeforeLong").value),
      autoStart: select("#autoStart").checked, soundEnabled: select("#soundEnabled").checked
    };
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(this.settings));
    this.changeMode(this.state.mode);
    this.elements.settingsDialog.close();
  }

  render() {
    const minutes = Math.floor(this.state.remainingSeconds / 60).toString().padStart(2, "0");
    const seconds = (this.state.remainingSeconds % 60).toString().padStart(2, "0");
    const copy = MODE_COPY[this.state.mode];
    this.elements.timer.textContent = `${minutes}:${seconds}`;
    this.elements.timer.dateTime = `PT${this.state.remainingSeconds}S`;
    this.elements.modeTitle.textContent = copy.title;
    this.elements.roundLabel.textContent = this.state.mode === "focus" ? `Session ${this.state.round} of ${this.settings.roundsBeforeLong}` : "Pause, breathe, and reset";
    this.elements.startButton.textContent = this.state.running ? "Pause" : copy.action;
    this.elements.ring.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - this.state.remainingSeconds / this.state.totalSeconds);
    selectAll(".mode-tab").forEach((tab) => {
      const selected = tab.dataset.mode === this.state.mode;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    document.body.classList.toggle("break-mode", this.state.mode !== "focus");
    document.title = `${minutes}:${seconds} · ${copy.title}`;
  }

  renderStats() {
    const count = this.getStats()[localDateKey()] || 0;
    this.elements.todayCount.textContent = count;
    const markers = Array.from({ length: Math.min(count, 16) }, () => {
      const marker = document.createElement("span");
      marker.className = "tomato-dot";
      return marker;
    });
    this.elements.tomatoes.replaceChildren(...markers);
    this.elements.tomatoes.setAttribute("aria-label", `${count} sessions completed today`);
  }
}

new PomodoroTimer();
