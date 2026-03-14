import mongoose from "mongoose";
const doctorSchema = new mongoose.Schema({
    fullName:{
        type:String,
        required:true,

    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true,

    },
    specialization:{
        type:String,
        required:true,
    },
    experience:{
        type:Number,
        required:true,
    },
    phoneNumber:{
        type:String,
        required:true,
    },
    clinicAddress:{
        type:String,
        required:true,
    },
    licenseNumber:{
        type:String,
        required:true,
    },
    clinicName:{
        type:String,
        required:true,
    },
    city:{
        type:String,
        required:true,
    }
})
export default mongoose.model("Doctor",doctorSchema);