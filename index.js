const express = require('express');
const cors = require('cors');// it is for communicating the backend to frontend
const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');
const jwt =require('jsonwebtoken');
const UserMo = require('./models/User.js');
const Places = require('./models/Place.js');
const Booking = require('./models/Booking.js')
const cookieParser = require('cookie-parser');
require('dotenv').config();
const imageDownloader =require('image-downloader')
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');


const multer =require('multer');
const fs =require('fs');
const app = express();
const secret = bcrypt.genSaltSync(10);// sync means it block the execution of the further task until it execute first
const jwtSecret='fwefhhdfdsn5fvvv6bbkkbacke';

app.use(express.json());
app.use(cookieParser());
app.use('/uploads',express.static(__dirname+'/uploads'));

app.use(cors({
  origin: ['https://airbnc-frontend.vercel.app', 'http://localhost:5173'],
  credentials: true,
}));

mongoose.connect(process.env.MONGO_URL);





//Cloudinary Setup
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'my_uploads', // Cloud folder name
    allowed_formats: ['jpg', 'png', 'jpeg']
  }
});


app.get('/test', (req, res) => {
    res.json('test ok');
});

app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        const hashedPassword = bcrypt.hashSync(password, secret);
        const userDoc = await UserMo.create({
            name,
            email,
            password: hashedPassword,
        });
        res.json(userDoc);//here responding to the data
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.post('/login',async(req,res)=>{
    const{email,password}=req.body;
    const userDoc=await UserMo.findOne({email});
    if(userDoc){
        // res.json('found');
        const passok=bcrypt.compareSync(password,userDoc.password);
        if(passok){
            jwt.sign({email:userDoc.email, id:userDoc._id},jwtSecret,{},(err,token)=>{
                if (err) throw err;
               res.cookie('token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
}).json(userDoc);

            });
            
           
        }
        else{
            res.json('Password is incorrect');
        }

    }
    else{
        res.json('Not Found');
    }
})
function getUserDataFromToken(req) {
  return new Promise((resolve, reject) => {
    const token = req.cookies?.token;
   

    if (!token) {
      return reject(new Error('No token provided'));
    }

    jwt.verify(token, jwtSecret, {}, (err, user) => {
      if (err) return reject(err);
      resolve(user);
    });
  });
}
app.get('/profile',(req,res)=>{
    const {token}=req.cookies;
    if(token){
        jwt.verify(token,jwtSecret,{},async (err,user)=>{
            if(err) throw err;
           const {name,email,_id}= await UserMo.findById(user.id)
            res.json({name,email,_id});
        })
    }
    else{
        res.json(null);
    }
   
})

app.post('/logout',(req,res)=>{
    res.cookie('token','').json(true);
})
// console.log(__dirname);
app.post("/upload-by-link", async (req, res) => {
  const { link } = req.body;

  if (!link) {
    return res.status(400).json({ error: "Link is required" });
  }

  try {
    const result = await cloudinary.uploader.upload(link, {
      folder: 'my_uploads', // Optional folder inside Cloudinary
      public_id: "photo" + Date.now() // Optional custom name
    });

    res.json({
      url: result.secure_url,
      public_id: result.public_id
    });
  } catch (err) {
    console.error("Cloudinary upload failed:", err);
    res.status(500).json({ error: "Failed to upload to Cloudinary" });
  }
});

   const photoMiddleware = multer({dest:'uploads'})
  

app.post('/upload', photoMiddleware.array('photos', 100), async (req, res) => {
  const uploadedFiles = [];

  for (let i = 0; i < req.files.length; i++) {
    const { path: tempPath, originalname } = req.files[i];
    const ext = path.extname(originalname);

    try {
      const result = await cloudinary.uploader.upload(tempPath, {
        folder: 'my_uploads',
        public_id: path.parse(originalname).name + '-' + Date.now()
      });

      uploadedFiles.push({
        url: result.secure_url,
        public_id: result.public_id
      });

      fs.unlinkSync(tempPath); // Clean up local temp file
    } catch (err) {
      console.error('Cloudinary upload failed:', err);
    }
  }

  res.json(uploadedFiles);
});

app.post('/places', (req, res) => {
  const { token } = req.cookies;
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
    price
  } = req.body;

  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, user) => {
      if (err) throw err;

      // ✅ Convert array of objects to array of URL strings
      const photoUrls = Array.isArray(addPhoto)
        ? addPhoto.map(photo => photo.url)
        : [];

      const placeDoc = await Places.create({
        owner: user.id,
        title,
        address,
        addPhoto: photoUrls, // ✅ Only URLs now
        description,
        perks,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
        price
      });

      res.json(placeDoc);
    });
  }
});


  app.get('/user-places',(req,res)=>{
    const {token}=req.cookies;
    
    jwt.verify(token,jwtSecret,{},async (err,user)=>{
       
        const {id}=user;
        res.json(await Places.find({owner:id}));
    })
  })
  app.get('/places/:id',async(req,res)=>{
    const {id} = req.params;
    res.json(await Places.findById(id))
  })
  app.put('/places',async(req,res)=>{
    
    const {token}=req.cookies;
    const{
       id, title,address, addPhoto,description
        ,perks,extraInfo,checkIn,checkOut, maxGuests,price
    } = req.body;

   
    jwt.verify(token,jwtSecret,{},async (err,user)=>{
        if(err) throw err;
        const placeDoc=await Places.findById(id);
       if(user.id===placeDoc.owner.toString()){
        placeDoc.set({
            title,address,addPhoto,description
            ,perks,extraInfo,checkIn,checkOut, maxGuests,price
        })
       await placeDoc.save()
        res.json('oknawlesh');
       }
    })

  })
  app.get('/places',async(req,res)=>{
    res.json(await Places.find());

  })
app.post('/booking', async (req, res) => {
 
  try {
    const userData = await getUserDataFromToken(req);
   

    const {
      place, checkIn, checkOut, guests, name,
      mobile, price,
    } = req.body;

    const booking = await Booking.create({
      place, checkIn, checkOut, guests, name,
      mobile, price,
      user: userData.id,
    });

    res.json(booking);
  } catch (err) {
    console.error("Booking route error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
 

// ✅ Moved outside
app.get('/booking', async (req, res) => {
  try {
    const userData = await getUserDataFromToken(req);
    const bookings = await Booking.find({ user: userData.id }).populate('place');
    res.json(bookings);
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});


app.listen(4000);
