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

const multer =require('multer');
const fs =require('fs');
const app = express();
const secret = bcrypt.genSaltSync(10);// sync means it block the execution of the further task until it execute first
const jwtSecret='fwefhhdfdsn5fvvv6bbkkbacke';

app.use(express.json());
app.use(cookieParser());
app.use('/uploads',express.static(__dirname+'/uploads'));

app.use(cors({   // for connecting frontend to backend
    credentials: true,
    origin: ['https://airbnc-frontend.vercel.app','http://localhost:5173']
}));

mongoose.connect(process.env.MONGO_URL);


function getUserDataFromToken(req){
    return new Promise((resolve,request)=>{
        jwt.verify(req.cookies.token,jwtSecret,{},async(err,user)=>{
            if(err) throw err;
            resolve(user);
        })
    })

}

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
                res.cookie('token',token).json(userDoc);

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
    const newName = "photo" + Date.now() + ".jpg";
    await imageDownloader.image({
      url: link,
      dest: `${__dirname}/uploads/${newName}`, // Added a forward slash before newName
    });
    res.json(newName); // Return only the filename instead of the full path
  });

   const photoMiddleware = multer({dest:'uploads'})

  app.post('/upload',photoMiddleware.array('photos',100),(req,res)=>{
    const uploadedFiles = []; 
    for(let i=0;i<req.files.length;i++){
        const {path,originalname}=req.files[i];
       const parts= originalname.split('.');
       const ext = parts[parts.length-1];
        const newPath =path + '.' + ext;
        fs.renameSync(path, newPath);
        uploadedFiles.push(newPath.replace('uploads',''));
    }
    res.json(uploadedFiles);
  })

  app.post('/places',(req,res)=>{
    const {token}=req.cookies;
    const{
        title,address,addPhoto,description
        ,perks,extraInfo,checkIn,checkOut, maxGuests,price
    } = req.body
    if(token){
        jwt.verify(token,jwtSecret,{},async (err,user)=>{
            if(err) throw err;
         const placeDoc =   await Places.create({
                owner:user.id,
                title,address, addPhoto,description
                ,perks,extraInfo,checkIn,checkOut, maxGuests,price
            })
            res.json(placeDoc);
        })
    }
  })

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
  app.post('/booking',async(req,res)=>{
    const userData= await getUserDataFromToken(req)
    const{
      place,checkIn,checkOut,guests,name,
      mobile,price,
    }=req.body;

    Booking.create({
        place,checkIn,checkOut,guests,name,
        mobile,price,
        user:userData.id,
    }).then((doc)=>{
       
        res.json(doc)
    }).catch((err)=>{
        throw err;
    })
    app.get('/booking',async(req,res)=>{
        const userData=  await getUserDataFromToken(req)
        // becoz it returning promise so that's why we have to wait here     
      res.json(await Booking.find({user:userData.id}).populate('place'))
   
    })

  })

app.listen(4000);
