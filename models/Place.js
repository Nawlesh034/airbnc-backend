const mongoose = require('mongoose');

const PlaceSchema= new mongoose.Schema({
    owner:{type:mongoose.Schema.Types.ObjectId,ref:'User'},
    title: String,
    address: String,
    addPhoto: [String],
    description: String,
    perks : [String],
    extraInfo: String,
    checkIn: String,
    checkOut: String,
    maxGuests: String,
    price:Number

})

const PlaceModel=mongoose.model('Place',PlaceSchema);
module.exports = PlaceModel;