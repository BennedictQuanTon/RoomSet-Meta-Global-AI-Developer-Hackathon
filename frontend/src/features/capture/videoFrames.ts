// Turns a short video into evenly spaced JPEG frames in the browser, so no video is uploaded.
// The frames then go through the same checks as photos.

const MAX_EDGE = 1920;

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    video.onseeked = () => resolve();
    video.onerror = () => reject(new Error("Could not read this video."));
    video.currentTime = time;
  });
}

export async function extractFrames(file: File, count: number): Promise<Blob[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Could not read this video."));
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error("Could not read this video.");

    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not read this video.");

    const frames: Blob[] = [];
    for (let index = 0; index < count; index += 1) {
      await seek(video, ((index + 0.5) / count) * video.duration);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (blob) frames.push(blob);
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}
