import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDb from "./config/db.js";
import authRoutes from "./routes/AuthRoutes/AuthRoute.js";
import diagnosisRoutes from "./routes/DiagnosisRoutes/DiagnosisRoute.js";
import caseRoutes from "./routes/CaseRoutes/CaseRoute.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import consultationRoutes from "./routes/consultationRoutes.js";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth", authRoutes);
app.use("/api/diagnosis", diagnosisRoutes);
app.use("/api/case", caseRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/consultation", consultationRoutes);

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
