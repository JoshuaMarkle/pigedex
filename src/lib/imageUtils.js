import imageCompression from "browser-image-compression";

export async function compressImage(file) {
  return imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  });
}
