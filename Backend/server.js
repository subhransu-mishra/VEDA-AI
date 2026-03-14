import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDb from "./config/db.js";
import authRoutes from "./routes/AuthRoutes/AuthRoute.js";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth", authRoutes);

const startServer = async () => {
  await connectDb();

  app.listen(PORT, () => {
    console.log("Running on PORT " + PORT);
    console.log("Backend2 Running from Tapu and MB");
  });
};

startServer();

app.get("/", (req, res) => {
  res.send("Running Well");
});
