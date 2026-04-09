/**
 * timer.js — Practice timer for jokes and sets
 */

import UI from './ui.js';

let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;

const Timer = {
  /** Render the practice timer view */
  renderTimer() {
    const app = document.getElementById('app-content');

    app.innerHTML = `
      <div class="editor-header">
        <button class="btn-icon" onclick="window.location.hash='#/more'" aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <h2>Practice Timer</h2>
        <div></div>
      </div>

      <div class="timer-display">
        <div class="timer-time" id="timer-time">${Timer.formatTime(timerSeconds)}</div>
        <div class="timer-controls">
          <button class="btn btn-primary timer-btn" id="timer-toggle">
            ${timerRunning ? 'Pause' : 'Start'}
          </button>
          <button class="btn btn-secondary timer-btn" id="timer-reset">Reset</button>
        </div>
        <p class="section-hint" style="margin-top:24px">Time your joke or set delivery. Tap Start and perform!</p>
      </div>
    `;

    document.getElementById('timer-toggle').addEventListener('click', () => {
      if (timerRunning) {
        Timer.pause();
      } else {
        Timer.start();
      }
    });

    document.getElementById('timer-reset').addEventListener('click', () => {
      Timer.reset();
    });
  },

  formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },

  start() {
    timerRunning = true;
    timerInterval = setInterval(() => {
      timerSeconds++;
      const el = document.getElementById('timer-time');
      if (el) el.textContent = Timer.formatTime(timerSeconds);
    }, 1000);

    const btn = document.getElementById('timer-toggle');
    if (btn) { btn.textContent = 'Pause'; }
  },

  pause() {
    timerRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;

    const btn = document.getElementById('timer-toggle');
    if (btn) { btn.textContent = 'Start'; }
  },

  reset() {
    Timer.pause();
    timerSeconds = 0;
    const el = document.getElementById('timer-time');
    if (el) el.textContent = Timer.formatTime(0);
  }
};

export default Timer;
