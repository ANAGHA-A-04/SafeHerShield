import { useState } from "react";
import "./App.css";

function App() {
  const [file, setFile] = useState(null);

  return (
    <div className="app">

      {/* NAVBAR */}
      <header className="navbar">
        <div className="container nav-inner">
          <div className="logo">
            <div className="dot"></div>
            <span>
              DeepFake <span className="green">Shield</span>
            </span>
          </div>

          <nav className="nav-links">
            <a href="#">How It Works</a>
            <a href="#">About</a>
          </nav>

          <button className="btn-primary">Get Started</button>
        </div>
      </header>

      {/* HERO */}
      <section className="hero">
        <div className="glow"></div>

        <div className="container hero-inner">
          <h1>
            <span className="green">DeepFake</span> Shield
          </h1>

          <p>
            AI-powered deepfake detection system protecting your digital identity.
          </p>
        </div>
      </section>

      {/* MEDIA LAB */}
      <section className="lab">
        <div className="container">

          <div className="lab-header">
            <h2>Photo Analysis Lab</h2>
          </div>

          <div className="lab-grid">

            {/* Upload */}
            <div className="card">
              <h3>Upload Media</h3>

              <div className="upload-area">
                <p>Drag & Drop Media</p>
                <span>MP4, MOV, JPG, PNG (max 100MB)</span>

                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files[0])}
                />

                {file && <div className="file-name">{file.name}</div>}
              </div>
            </div>

            {/* Preview */}
            <div className="card">
              <div className="card-header">
                <span>Detection Status</span>
                <span className="ready">READY</span>
              </div>

              <div className="preview-box">
                {file ? file.name : "Preview Area"}
              </div>

              <div className="button-row">
                <button className="btn-primary">Analyze</button>
                <button className="btn-secondary">Download</button>
              </div>
            </div>

          </div>
        </div>
      </section>

      <footer className="footer">
        © 2026 DeepFake Shield | Hackathon Demo
      </footer>
    </div>
  );
}

export default App;