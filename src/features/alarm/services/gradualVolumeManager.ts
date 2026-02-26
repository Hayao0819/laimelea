const STEP_INTERVAL_MS = 500;

export class GradualVolumeManager {
  private durationSec: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private elapsedMs = 0;
  private currentVolume = 0;

  constructor(durationSec: number) {
    this.durationSec = durationSec;
  }

  start(onVolumeChange: (volume: number) => void): void {
    this.stop();
    this.elapsedMs = 0;

    if (this.durationSec <= 0) {
      this.currentVolume = 1.0;
      onVolumeChange(1.0);
      return;
    }

    this.currentVolume = 0;
    onVolumeChange(0);

    const durationMs = this.durationSec * 1000;

    this.intervalId = setInterval(() => {
      this.elapsedMs += STEP_INTERVAL_MS;
      this.currentVolume = Math.min(this.elapsedMs / durationMs, 1.0);
      onVolumeChange(this.currentVolume);

      if (this.currentVolume >= 1.0) {
        this.stop();
      }
    }, STEP_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getCurrentVolume(): number {
    return this.currentVolume;
  }
}
