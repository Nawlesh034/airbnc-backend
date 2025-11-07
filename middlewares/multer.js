 const multer =require('multer');
 
 
 const photoMiddleware = multer({dest:'uploads'})
 
 module.exports = photoMiddleware