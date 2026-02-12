
import { toast } from "react-toastify";

/**
 * Processes an image file, converting HEIC/HEIF to JPEG if necessary.
 * @param file The file to process.
 * @returns A Promise that resolves to the processed File (JPEG) or the original file if no conversion was needed.
 */
export async function processImageFile(file: File): Promise<File> {
  // Check for HEIC/HEIF
  if (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif")
  ) {
    try {
      const heic2any = (await import("heic2any")).default;
      const convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.8,
      });

      // normalize: convertedBlob can be Blob or Blob[]
      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

      const newFile = new File(
        [blob],
        file.name.replace(/\.(heic|heif)$/i, ".jpg"),
        {
          type: "image/jpeg",
        }
      );

      return newFile;
    } catch (err) {
      console.error("HEIC conversion failed:", err);
      toast.error("Failed to process HEIC image");
      throw err;
    }
  }

  return file;
}

export const SUPPORTED_IMAGE_TYPES = "image/png, image/jpeg, image/jpg, image/webp, image/heic, image/heif, .heic, .heif";
