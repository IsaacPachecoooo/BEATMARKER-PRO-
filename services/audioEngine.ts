
import { AnalysisConfig, Marker } from '../types';

/**
 * Robust Onset Detection Logic
 * Uses Energy Difference in specific frequency bands to detect percussive events.
 */
export const analyzeBeats = async (
  audioBuffer: AudioBuffer,
  config: AnalysisConfig
): Promise<Marker[]> => {
  const sampleRate = audioBuffer.sampleRate;
  const rawData = audioBuffer.getChannelData(0); // Analyze first channel
  const frameSize = 1024;
  const hopSize = 512;
  const threshold = (1.1 - config.sensitivity) * 0.15; // Inverse mapping for sensitivity
  const minDistanceSamples = config.minDistance * sampleRate;

  const markers: Marker[] = [];
  let lastMarkerSample = -minDistanceSamples;

  // Simplified Energy-based Onset Detection
  for (let i = frameSize; i < rawData.length - frameSize; i += hopSize) {
    // 1. Calculate local energy
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      energy += Math.abs(rawData[i + j]);
    }
    energy /= frameSize;

    // 2. Calculate previous energy
    let prevEnergy = 0;
    for (let j = 0; j < frameSize; j++) {
      prevEnergy += Math.abs(rawData[i - hopSize + j]);
    }
    prevEnergy /= frameSize;

    // 3. Peak picking with delta
    const delta = energy - prevEnergy;
    
    // Aggressive mode lowers the delta requirement
    const activeThreshold = config.aggressiveMode ? threshold * 0.6 : threshold;

    if (delta > activeThreshold && (i - lastMarkerSample) > minDistanceSamples) {
      const time = i / sampleRate;
      markers.push({
        id: Math.random().toString(36).substr(2, 9),
        time: parseFloat(time.toFixed(3)),
        label: `Beat ${markers.length + 1}`,
        color: '#3b82f6'
      });
      lastMarkerSample = i;
    }
  }

  return markers;
};

export const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
};
