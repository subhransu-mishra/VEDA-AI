import mongoose, { mongo } from "mongoose";
const patientSchema = new mongoose.Schema({
    fullName:{
         type:String,
            required:true,
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    age:{
        type:Number,
        required:true,
    },
    phoneNumber:{
        type:String,
        required:true,
    },
    gender:{
        type:String,
        required:true,
    },
    height:{
        type:Number,
        required:true,
    },
    weight:{
        type:Number,
        required:true,
    },
    bloodType:{
        type:String,
        required:true,
    },
    address:{
        type:String,
        required:true,
    },
    emergencyContact:{
       type:String,
       required:true,
    },

})
export default mongoose.model("Patient",patientSchema);