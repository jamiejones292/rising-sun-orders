// New-order chime and keeping the iPad screen awake.
// iPads only allow sound after someone taps the screen, so the chime is
// switched on from a button. Visual alerts never depend on sound.

let audio: AudioContext | null = null;
let wakeLock: { release: () => Promise<void> } | null = null;

export function soundOn() {
  return audio !== null;
}

export async function enableSound(): Promise<boolean> {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audio = new Ctx();
    await audio.resume();
    chime();
    return true;
  } catch {
    audio = null;
    return false;
  }
}

export function disableSound() {
  void audio?.close();
  audio = null;
}

export function chime() {
  if (!audio) return;
  const t = audio.currentTime;
  for (const [freq, delay] of [
    [880, 0],
    [1175, 0.18],
  ] as const) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t + delay);
    gain.gain.linearRampToValueAtTime(0.4, t + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.6);
    osc.connect(gain).connect(audio.destination);
    osc.start(t + delay);
    osc.stop(t + delay + 0.65);
  }
}

export async function keepAwake() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    if (nav.wakeLock && document.visibilityState === "visible") wakeLock = await nav.wakeLock.request("screen");
  } catch {
    wakeLock = null; // not supported or refused: Auto-Lock "Never" on the iPad covers it
  }
}

// The browser drops the wake lock when the screen is hidden; ask again on return.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && wakeLock) void keepAwake();
  });
}
