//backend/middleware/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let dir = 'uploads/';
    if (file.fieldname === 'logo') dir += 'logos/';
    else if (file.fieldname === 'coverPhoto') dir += 'covers/';
    else if (file.fieldname === 'bannerImage') dir += 'banners/';
    else if (file.fieldname === 'receiptImage') dir += 'receipts/';
    else if (file.fieldname === 'profilePhoto') dir += 'logos/';
    else if (file.fieldname === 'merchImage') dir += 'merchitems/';

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) return cb(null, true);
  cb(new Error('Images and PDFs only! (jpeg, jpg, png, pdf)'), false);
};

const uploadConfig = { storage, fileFilter };

const uploadLogo = multer({ ...uploadConfig, limits: { fileSize: 2 * 1024 * 1024 } });
const uploadCover = multer({ ...uploadConfig, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadBanner = multer({ ...uploadConfig, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadReceipt = multer({ ...uploadConfig, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadProfile = multer({ ...uploadConfig, limits: { fileSize: 2 * 1024 * 1024 } });
const uploadMerchImage = multer({ ...uploadConfig, limits: { fileSize: 5 * 1024 * 1024 } }); // merch items

const uploadClubImages = multer({
  ...uploadConfig,
  limits: { fileSize: 5 * 1024 * 1024 }
}).fields([
  { name: 'logo', maxCount: 1 },
  { name: 'coverPhoto', maxCount: 1 }
]);

module.exports = {
  uploadLogo,
  uploadCover,
  uploadBanner,
  uploadReceipt,
  uploadProfile,
  uploadMerchImage,
  uploadClubImages
};
