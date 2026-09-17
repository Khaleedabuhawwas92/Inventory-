const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

function makeUploader(subfolder) {
  const dest = path.join(__dirname, '..', '..', 'uploads', subfolder);
  fs.mkdirSync(dest, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!ALLOWED_MIME.includes(file.mimetype)) {
        return cb(ApiError.badRequest('صيغة الملف غير مدعومة، يُسمح فقط بـ PNG وJPEG وWEBP وSVG'));
      }
      cb(null, true);
    },
  });
}

function publicUrlFor(subfolder, filename) {
  return `/uploads/${subfolder}/${filename}`;
}

// Best-effort cleanup of a previously uploaded file (e.g. when replacing or
// removing a company logo). Never throws — a missing/already-deleted file is
// not an error for the caller.
function deleteUploadedFile(publicUrl) {
  if (!publicUrl || !publicUrl.startsWith('/uploads/')) return;
  const relative = publicUrl.replace('/uploads/', '');
  const filePath = path.join(__dirname, '..', '..', 'uploads', ...relative.split('/'));
  fs.unlink(filePath, () => {});
}

module.exports = { makeUploader, publicUrlFor, deleteUploadedFile };
