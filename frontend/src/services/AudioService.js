class AudioService {
  constructor() {
    this.ctx = null
    this.unlocked = false
    this.currentPreset = 'beep'
    this.PRESETS = {
      beep: '_playBeep',
      chime: '_playChime',
      alert: '_playAlert',
      soft: '_playSoft',
    }
    this._setupUnlock()
  }

  _setupUnlock() {
    const unlock = () => {
      if (this.unlocked) return
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        gain.gain.value = 0
        osc.connect(gain)
        gain.connect(this.ctx.destination)
        osc.start()
        osc.stop(this.ctx.currentTime + 0.001)
        this.unlocked = true
      } catch (_) {}
      document.removeEventListener('touchstart', unlock)
      document.removeEventListener('click', unlock)
    }
    document.addEventListener('touchstart', unlock, { once: false })
    document.addEventListener('click', unlock, { once: false })
  }

  _ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  _playBeep() {
    this._ensureContext()
    const ctx = this.ctx
    ;[0, 0.8].forEach(offset => {
      ;[880, 1100, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.connect(g)
        g.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        const t = ctx.currentTime + offset + i * 0.22
        g.gain.setValueAtTime(0.25, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
        osc.start(t)
        osc.stop(t + 0.22)
      })
    })
  }

  _playChime() {
    this._ensureContext()
    const ctx = this.ctx
    ;[0, 1.0].forEach(offset => {
      ;[523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.connect(g)
        g.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        const t = ctx.currentTime + offset + i * 0.3
        g.gain.setValueAtTime(0.2, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
        osc.start(t)
        osc.stop(t + 0.45)
      })
    })
  }

  _playAlert() {
    this._ensureContext()
    const ctx = this.ctx
    ;[0, 0.6].forEach(offset => {
      ;[1000, 800, 1000, 800].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.connect(g)
        g.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'square'
        const t = ctx.currentTime + offset + i * 0.12
        g.gain.setValueAtTime(0.15, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
        osc.start(t)
        osc.stop(t + 0.12)
      })
    })
  }

  _playSoft() {
    this._ensureContext()
    const ctx = this.ctx
    ;[0, 1.2].forEach(offset => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.connect(g)
      g.connect(ctx.destination)
      osc.frequency.value = 440
      osc.type = 'sine'
      const t = ctx.currentTime + offset
      g.gain.setValueAtTime(0.2, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.8)
      osc.start(t)
      osc.stop(t + 0.85)
    })
  }

  _vibrate() {
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200])
    }
  }

  play(preset = null) {
    const p = preset || this.currentPreset
    const method = this.PRESETS[p]
    if (method && this.ctx && this.unlocked) {
      try {
        this[method]()
      } catch (_) {}
    }
    this._vibrate()
    window.dispatchEvent(new CustomEvent('timer-alarm'))
  }

  setPreset(name) {
    if (this.PRESETS[name]) {
      this.currentPreset = name
    }
  }

  getPresets() {
    return Object.keys(this.PRESETS)
  }
}

const audioService = new AudioService()
export default audioService
