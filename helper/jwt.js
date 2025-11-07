const jwt = require("jsonwebtoken")

const signInToken = (user)=>{
       return jwt.sign({id:user._id,email:user.email},process.env.SECRET,{expiresIn:"1h"})
}


module.exports=signInToken