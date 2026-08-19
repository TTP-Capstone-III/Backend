//create multer config for file uploads
const multer = require("multer");

//memory storage keeps file in memory as a buffer
const storage = multer.memoryStorage();

//file filter to only allow images
const fileFilter = (req, file, callback) => {
    if(file.mimetype.startsWith('image/')){
        callback(null, true);
    }else{
        callback(new Error('Only image files are allowed'), false);
    }
}

//create the multer upload middleware
const upload = multer({
  storage:storage,
  fileFilter:fileFilter,
  limits:{fileSize:5*1024*1024},//limit files to 5MB
});

module.exports = upload;