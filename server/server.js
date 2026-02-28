const express = require("express");
const cors = require("cors");
const path = require("path");
const imageRoutes = require("./routes/imageRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

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

app.listen(PORT, () => {
  console.log(`\n🛡️  DeepFake Shield Server running on http://localhost:${PORT}`);
  console.log(`📁 Uploads folder: ${path.join(__dirname, "uploads")}`);
  console.log(`🔒 Protected folder: ${path.join(__dirname, "protected")}\n`);
});
