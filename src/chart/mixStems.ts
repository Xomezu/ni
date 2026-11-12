/**
 * When a song folder has instrument stems but no song.*, mix them into one playable buffer.
 */
export async function mixAudioFiles(files: File[]): Promise<{ url: string; name: string; revoke: () => void } | null> {
  if (files.length === 0) return null;
  if (files.length === 1) {
    const url = URL.createObjectURL(files[0]);
    return { url, name: files[0].name, revoke: () => URL.revokeObjectURL(url) };
  }

  const ctx = new AudioContext();
  try {
    const decoded: AudioBuffer[] = [];
    for (const file of files) {
      const data = await file.arrayBuffer();
      try {
        decoded.push(await ctx.decodeAudioData(data.slice(0)));
      } catch {
        // Skip undecodable stems (e.g. some flac builds)
      }
    }
    if (decoded.length === 0) return null;
    if (decoded.length === 1) {
      const wav = audioBufferToWav(decoded[0]);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      return { url, name: 'mixed-stems.wav', revoke: () => URL.revokeObjectURL(url) };
    }

    const channels = Math.max(...decoded.map((b) => b.numberOfChannels));
    const sampleRate = decoded[0].sampleRate;
    const length = Math.max(...decoded.map((b) => b.length));
    const offline = new OfflineAudioContext(channels, length, sampleRate);

    for (const buffer of decoded) {
      const src = offline.createBufferSource();
      src.buffer = buffer;
      const gain = offline.createGain();
      gain.gain.value = 1 / Math.sqrt(decoded.length);
      src.connect(gain);
      gain.connect(offline.destination);
      src.start(0);
    }

    const mixed = await offline.startRendering();
    const wav = audioBufferToWav(mixed);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    return {
      url,
      name: `mixed-${decoded.length}-stems.wav`,
      revoke: () => URL.revokeObjectURL(url),
    };
  } finally {
    await ctx.close();
  }
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const samples = buffer.length;
  const blockAlign = (numChannels * bitDepth) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}
