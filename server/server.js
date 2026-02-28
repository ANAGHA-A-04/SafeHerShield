const express = require("express");
const cors = require("cors");
const path = require("path");
const imageRoutes = require("./routes/imageRoutes");
const { loadModels } = require("./utils/faceDetect");

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (uploaded & protected images)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/protected", express.static(path.join(__dirname, "protected")));

// Routes
app.use("/api/images", imageRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "DeepFake Shield API is running 🛡️" });
});

app.listen(PORT, async () => {
  console.log(`\n🛡️  DeepFake Shield Server running on http://localhost:${PORT}`);
  console.log(`📁 Uploads folder: ${path.join(__dirname, "uploads")}`);
  console.log(`🔒 Protected folder: ${path.join(__dirname, "protected")}`);
  
  // Load ML face detection models on startup
  try {
    await loadModels();
  } catch (err) {
    console.log("⚠️  Face detection models will load on first use.");
  }
  console.log("");
});
