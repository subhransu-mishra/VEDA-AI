import express from "express";
const app = express();
const PORT = process.env.PORT || 5000;
app.use(express.json());
app.listen(PORT,()=>{
    console.log("Running on PORT "+PORT);
    console.log("Backend2 Running from Tapu and MB")
    console.log("Hello")
})

app.get("/", (req, res) => {
  res.send("Running Well");
  
});
