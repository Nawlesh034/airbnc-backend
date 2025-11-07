const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;

const User = require('../models/User');
const Place = require('../models/Place');
const Booking = require('../models/Booking');

require('../storage/storage');

const salt = bcrypt.genSaltSync(10);
const jwtSecret = process.env.SECRET;
const getCookieOptions = (req, { withExpiry = false } = {}) => {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const origin = req.get('origin');
  const isSecure =
    req.secure ||
    forwardedProto === 'https' ||
    (Array.isArray(forwardedProto) && forwardedProto.includes('https')) ||
    (origin && origin.startsWith('https://'));

  const options = {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    path: '/',
  };

  if (withExpiry) {
    options.maxAge = 24 * 60 * 60 * 1000; // 1 day
  }

  return options;
};

const hashPassword = (password) => bcrypt.hashSync(password, salt);

const sanitizeUser = (userDoc) => ({
  _id: userDoc._id,
  name: userDoc.name,
  email: userDoc.email,
});

const healthCheck = (req, res) => {
  res.json('test ok');
};

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists. Please login.' });
    }

    const userDoc = await User.create({
      name,
      email,
      password: hashPassword(password),
    });

    return res.status(201).json(sanitizeUser(userDoc));
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const login = async (req, res) => {
  try {
  const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const userDoc = await User.findOne({ email });
    if (!userDoc) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = bcrypt.compareSync(password, userDoc.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    jwt.sign({ email: userDoc.email, id: userDoc._id }, jwtSecret, {}, (err, token) => {
      if (err) {
        console.error('JWT sign error:', err);
        return res.status(500).json({ message: 'Failed to sign token' });
      }

      return res.cookie('token', token, getCookieOptions(req, { withExpiry: true })).json(sanitizeUser(userDoc));
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(sanitizeUser(userDoc));
  } catch (error) {
    console.error('Profile error:', error);
    return res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

const logout = (req, res) => {
  res.clearCookie('token', getCookieOptions(req)).json({ success: true });
};

const uploadByLink = async (req, res) => {
  const { link } = req.body;

  if (!link) {
    return res.status(400).json({ error: 'Link is required' });
  }

  try {
    const result = await cloudinary.uploader.upload(link, {
      folder: 'my_uploads',
      public_id: `photo-${Date.now()}`,
    });

    return res.json({
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error('Cloudinary upload failed:', error);
    return res.status(500).json({ error: 'Failed to upload to Cloudinary' });
  }
};

const upload = async (req, res) => {
  const uploadedFiles = [];

  for (const file of req.files || []) {
    const { path: tempPath, originalname } = file;

    try {
      const result = await cloudinary.uploader.upload(tempPath, {
        folder: 'my_uploads',
        public_id: `${path.parse(originalname).name}-${Date.now()}`,
      });

      uploadedFiles.push({
        url: result.secure_url,
        public_id: result.public_id,
      });
    } catch (error) {
      console.error('Cloudinary upload failed:', error);
    } finally {
      if (tempPath && fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }

  return res.json(uploadedFiles);
};

const createPlace = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

     const {
      title,
      address,
      addPhoto,
      description,
      perks,
      extraInfo,
      checkIn,
      checkOut,
      maxGuests,
      price,
    } = req.body;

    const photoUrls = Array.isArray(addPhoto)
      ? addPhoto.map((photo) => (typeof photo === 'string' ? photo : photo?.url)).filter(Boolean)
      : [];

    const placeDoc = await Place.create({
      owner: userId,
      title,
      address,
      addPhoto: photoUrls,
      description,
      perks,
      extraInfo,
      checkIn,
      checkOut,
      maxGuests,
      price,
    });

    return res.status(201).json(placeDoc);
  } catch (error) {
    console.error('Error creating place:', error);
    return res.status(500).json({ error: 'Failed to create place' });
  }
};

const getUserPlaces = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const places = await Place.find({ owner: userId });
    return res.json(places);
  } catch (error) {
    console.error('Error fetching user places:', error);
    return res.status(500).json({ error: 'Failed to fetch user places' });
  }
};

const getPlaceById = async (req, res) => {
  try {
    const place = await Place.findById(req.params.id);
    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }
    return res.json(place);
  } catch (error) {
    console.error('Error fetching place:', error);
    return res.status(500).json({ error: 'Failed to fetch place' });
  }
};

const updatePlace = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      id,
      title,
      address,
      addPhoto,
      description,
      perks,
      extraInfo,
      checkIn,
      checkOut,
      maxGuests,
      price,
    } = req.body;

    const placeDoc = await Place.findById(id);

    if (!placeDoc) {
      return res.status(404).json({ error: 'Place not found' });
    }

    if (placeDoc.owner.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this place' });
    }

    const updates = {
      title,
      address,
      description,
      perks,
      extraInfo,
      checkIn,
      checkOut,
      maxGuests,
      price,
    };

    if (addPhoto) {
      updates.addPhoto = Array.isArray(addPhoto)
        ? addPhoto.map((photo) => (typeof photo === 'string' ? photo : photo?.url)).filter(Boolean)
        : [addPhoto];
    }

    Object.keys(updates).forEach((key) => {
      if (updates[key] === undefined) {
        delete updates[key];
      }
    });

    placeDoc.set(updates);

    await placeDoc.save();

    return res.json({ message: 'Place updated successfully' });
  } catch (error) {
    console.error('Error updating place:', error);
    return res.status(500).json({ error: 'Failed to update place' });
  }
};

const getAllPlaces = async (req, res) => {
  try {
    const places = await Place.find();
    return res.json(places);
  } catch (error) {
    console.error('Error fetching places:', error);
    return res.status(500).json({ error: 'Failed to fetch places' });
  }
};

 const createBooking = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { place, checkIn, checkOut, guests, name, mobile, price } = req.body;

    const bookingDoc = await Booking.create({
      place,
      checkIn,
      checkOut,
      guests,
      name,
      mobile,
      price,
      user: userId,
    });

    return res.status(201).json(bookingDoc);
  } catch (error) {
    console.error('Booking route error:', error);
    return res.status(500).json({ error: 'Failed to create booking' });
  }
};

const getBookings = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const bookings = await Booking.find({ user: userId }).populate('place');
    return res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

module.exports = {
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
};