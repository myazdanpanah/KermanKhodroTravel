/**
 * Office notification chime synthesized with Web Audio API.
 * Elegant, soft, gentle dual-tone bell suitable for office environments.
 * Zero external audio files or network requests required.
 */
export function playOfficeChime(): void {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const now = ctx.currentTime

    // Master volume with smooth envelope
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.001, now)
    masterGain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65)
    masterGain.connect(ctx.destination)

    // Primary bell tone (D5 - 587.33 Hz)
    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now)
    osc1.connect(masterGain)
    osc1.start(now)
    osc1.stop(now + 0.65)

    // Harmonious accent chime (A5 - 880 Hz) with slight 60ms delay
    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880.0, now + 0.06)

    const gain2 = ctx.createGain()
    gain2.gain.setValueAtTime(0.001, now)
    gain2.gain.setValueAtTime(0.001, now + 0.06)
    gain2.gain.exponentialRampToValueAtTime(0.07, now + 0.08)
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)

    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.06)
    osc2.stop(now + 0.65)

    // Clean up AudioContext after sound completes
    setTimeout(() => {
      try {
        void ctx.close()
      } catch {
        // Ignore close errors
      }
    }, 850)
  } catch {
    // AudioContext might be blocked if user has not interacted with page yet
  }
}
