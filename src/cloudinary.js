//load .env to access the env variable
require("dotenv").config(); 
const cloudinary = require("cloudinary").v2;

//configuration, to use cloudinary API to upload images
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, //access fundamental feature like generte url etc
  api_key: process.env.CLOUDINARY_API_KEY, //access upload and other mgment api
  api_secret: process.env.CLOUDINARY_API_SECRET, //access the .env with process.env
});

//export the Cloudinary client
module.exports = cloudinary;



















