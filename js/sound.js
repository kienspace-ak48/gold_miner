const Sound = (function () {
  "use strict";

  let ctx = null;
  let enabled = true;
  let bgmGain = null;
  let bgmTimer = null;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    return ctx;
  }

  function play(freq, duration, opts = {}) {
    if (!enabled) return;
    const audio = getCtx();
    const t = audio.currentTime;
    const {
      type = "sine",
      volume = 0.15,
      attack = 0.01,
      decay = 0.08,
      freqEnd = freq,
      pan = 0,
    } = opts;

    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const panner = audio.createStereoPanner();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 20), t + duration);
    }

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    panner.pan.value = pan;

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(audio.destination);

    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  function noiseBurst(duration, volume = 0.08) {
    if (!enabled) return;
    const audio = getCtx();
    const t = audio.currentTime;
    const bufferSize = audio.sampleRate * duration;
    const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = audio.createBufferSource();
    const gain = audio.createGain();
    const filter = audio.createBiquadFilter();

    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value = 0.5;

    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);

    source.start(t);
    source.stop(t + duration);
  }

  function chord(notes, duration, volume = 0.1) {
    notes.forEach((n, i) => {
      setTimeout(() => play(n, duration, { volume: volume * 0.7, type: "triangle" }), i * 60);
    });
  }

  function startBgm() {
    if (!enabled || bgmTimer) return;
    const audio = getCtx();
    if (bgmGain) return;

    bgmGain = audio.createGain();
    bgmGain.gain.value = 0.03;
    bgmGain.connect(audio.destination);

    const notes = [196, 220, 247, 220];
    let idx = 0;

    function tick() {
      if (!enabled || !bgmGain) return;
      const osc = audio.createOscillator();
      const g = audio.createGain();
      osc.type = "triangle";
      osc.frequency.value = notes[idx % notes.length];
      g.gain.setValueAtTime(0.04, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.35);
      osc.connect(g);
      g.connect(bgmGain);
      osc.start();
      osc.stop(audio.currentTime + 0.4);
      idx++;
    }

    tick();
    bgmTimer = setInterval(tick, 900);
  }

  function stopBgm() {
    if (bgmTimer) {
      clearInterval(bgmTimer);
      bgmTimer = null;
    }
    if (bgmGain) {
      bgmGain.disconnect();
      bgmGain = null;
    }
  }

  return {
    init() {
      getCtx();
    },

    isEnabled() {
      return enabled;
    },

    toggle() {
      enabled = !enabled;
      if (!enabled) stopBgm();
      return enabled;
    },

    hookDrop() {
      play(180, 0.12, { type: "sawtooth", volume: 0.12, freqEnd: 90 });
      noiseBurst(0.06, 0.05);
    },

    grab(itemType) {
      if (itemType === "rock") {
        play(120, 0.2, { type: "square", volume: 0.18, freqEnd: 80 });
        noiseBurst(0.1, 0.1);
      } else if (itemType === "diamond") {
        play(880, 0.15, { type: "sine", volume: 0.2 });
        play(1320, 0.2, { type: "sine", volume: 0.12 });
      } else {
        play(320, 0.1, { type: "triangle", volume: 0.16, freqEnd: 200 });
      }
    },

    retractEmpty() {
      play(100, 0.08, { type: "square", volume: 0.08 });
    },

    collect(value) {
      if (value >= 500) {
        chord([523, 659, 784, 1047], 0.25, 0.14);
      } else if (value >= 100) {
        play(660, 0.1, { type: "sine", volume: 0.14 });
        play(880, 0.15, { type: "sine", volume: 0.1 });
      } else if (value >= 50) {
        play(523, 0.12, { type: "triangle", volume: 0.12, freqEnd: 784 });
      } else {
        play(300, 0.08, { type: "triangle", volume: 0.08 });
      }
    },

    tick(urgent) {
      play(urgent ? 880 : 440, 0.06, {
        type: "square",
        volume: urgent ? 0.12 : 0.06,
      });
    },

    win() {
      stopBgm();
      chord([523, 659, 784, 1047, 1319], 0.3, 0.13);
    },

    lose() {
      stopBgm();
      play(330, 0.3, { type: "sawtooth", volume: 0.12, freqEnd: 110 });
      play(220, 0.4, { type: "triangle", volume: 0.1, freqEnd: 80 });
    },

    startLevel() {
      startBgm();
      play(392, 0.1, { type: "triangle", volume: 0.1 });
      play(523, 0.15, { type: "triangle", volume: 0.1 });
    },

    stopBgm,
  };
})();
