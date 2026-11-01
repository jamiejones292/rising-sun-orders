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
  // iPads pause sound when the screen sleeps; wake it before playing.
  if (audio.state !== "running") void audio.resume();
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

// The browser drops the wake lock and pauses sound when the screen is hidden or
// locked; ask again on return, and on any tap (iPads only allow sound to resume
// after a touch).
function rewake() {
  if (audio && audio.state !== "running") void audio.resume();
  if (wakeLock || audio) void keepAwake();
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") rewake();
  });
  document.addEventListener("pointerdown", () => {
    if (audio && audio.state !== "running") rewake();
  });
}
