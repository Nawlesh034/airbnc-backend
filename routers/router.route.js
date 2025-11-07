const express = require('express');

const {
  healthCheck,
  register,
  login,
  getProfile,
  logout,
  uploadByLink,
  upload,
  createPlace,
  getUserPlaces,
  getPlaceById,
  updatePlace,
  getAllPlaces,
  createBooking,
  getBookings,
} = require('../controllers/controller');
const photoMiddleware = require('../middlewares/multer');
const authenticationToken = require('../middlewares/authmiddlewares');

const router = express.Router();

router.get('/test', healthCheck);
router.post('/register', register);
router.post('/login', login);
router.get('/places', getAllPlaces);
router.get('/places/:id', getPlaceById);

router.use(authenticationToken);

router.get('/profile', getProfile);
router.post('/logout', logout);
router.post('/upload-by-link', uploadByLink);
router.post('/upload', photoMiddleware.array('photos', 100), upload);
router.post('/places', createPlace);
router.get('/user-places', getUserPlaces);
router.put('/places', updatePlace);
router.post('/booking', createBooking);
router.get('/booking', getBookings);

module.exports = router;