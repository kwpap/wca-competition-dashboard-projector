import { useEffect, useRef, useState } from 'react';
import { createNoiseDetector, feedNoise } from '../model/noiseDetector';
import type { NoiseSensitivity, NoiseStatus } from '../state/storage';

const SAMPLE_MS = 250;
const STATUS_MS = 2000;
/** Floor for silence, so log10(0) never happens. */
const MIN_RMS = 1e-6;

/**
 * Listens to the microphone while `enabled` and returns true while the room is too loud.
 * Reports the live level through `onStatus` every few seconds.
 */
export function useNoiseMonitor(
  enabled: boolean,
  sensitivity: NoiseSensitivity,
  onStatus: (status: NoiseStatus) => void,
): boolean {
  const [alert, setAlert] = useState(false);
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => {
    if (!enabled) {
      setAlert(false);
      return;
    }

    let stopped = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;

    // Browsers may start audio only after a click or key press in the window.
    function resume() {
      void context?.resume();
    }
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);

    async function start() {
      // Raw signal: the browser's voice processing would flatten the room level.
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      if (stopped) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = media;
      context = new AudioContext();
      void context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.createMediaStreamSource(media).connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);
      const detector = createNoiseDetector(Date.now());
      let lastStatus = 0;

      timer = setInterval(() => {
        const now = Date.now();
        const blocked = context?.state !== 'running';
        let reading = { level: -Infinity, average: null as number | null, alert: false };
        if (!blocked) {
          analyser.getFloatTimeDomainData(buffer);
          let sum = 0;
          for (const value of buffer) sum += value * value;
          const rms = Math.max(MIN_RMS, Math.sqrt(sum / buffer.length));
          reading = feedNoise(detector, 20 * Math.log10(rms), now, sensitivityRef.current);
          setAlert(reading.alert);
        }
        if (now - lastStatus >= STATUS_MS) {
          lastStatus = now;
          onStatusRef.current({ ...reading, blocked, updatedAt: now });
        }
      }, SAMPLE_MS);
    }

    start().catch((error) => console.error('Noise meter: no microphone', error));

    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
      setAlert(false);
    };
  }, [enabled]);

  return alert;
}
