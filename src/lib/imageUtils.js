export async function compressImage(file) {
  // Use arrayBuffer() instead of FileReader — Android can revoke the content URI
  // before an async FileReader completes (e.g. Google Photos cloud files).
  let arrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (err) {
    throw new Error(`Could not read file: ${err?.message ?? err}`);
  }

  const mimeType = file.type || "image/jpeg";
  const objectUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: mimeType }));

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const MAX = 1920;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas toBlob returned null"));
            return;
          }
          const outName = file.name.replace(/\.[^.]+$/, ".jpg") || "image.jpg";
          resolve(new File([blob], outName, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image decode failed — unsupported format?"));
    };

    img.src = objectUrl;
  });
}
