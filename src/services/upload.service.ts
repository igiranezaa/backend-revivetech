import { cloudinary } from "../config/cloudinary.js";

const TRADE_IN_FOLDER = "revivetech/trade-in";

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env["CLOUDINARY_CLOUD_NAME"] &&
      process.env["CLOUDINARY_API_KEY"] &&
      process.env["CLOUDINARY_API_SECRET"]
  );
}

export async function uploadImageBuffer(buffer: Buffer, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: TRADE_IN_FOLDER,
        resource_type: "image",
        public_id: filename.replace(/\.[^.]+$/, ""),
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

export async function uploadTradeInImages(
  files: { buffer: Buffer; originalname: string }[]
): Promise<string[]> {
  if (!files.length) return [];
  if (!isCloudinaryConfigured()) {
    throw new Error("Image upload is not configured. Set CLOUDINARY_* environment variables.");
  }

  const urls: string[] = [];
  for (const file of files) {
    const url = await uploadImageBuffer(file.buffer, `${Date.now()}-${file.originalname}`);
    urls.push(url);
  }
  return urls;
}
