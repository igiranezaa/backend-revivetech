import multer from "multer";

const storage = multer.memoryStorage();

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env["MAX_UPLOAD_SIZE_BYTES"] || 5 * 1024 * 1024),
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error("Unsupported file type"));
      return;
    }

    cb(null, true);
  },
});

export const imageUpload = multer({
  storage,
  limits: {
    fileSize: Number(process.env["MAX_UPLOAD_SIZE_BYTES"] || 5 * 1024 * 1024),
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedImageMimeTypes.has(file.mimetype)) {
      cb(new Error("Unsupported image type"));
      return;
    }

    cb(null, true);
  },
});
