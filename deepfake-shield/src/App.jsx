import { useState } from "react";
import "./App.css";

const TOOLS = [
  { id: "metadata", icon: "📍", name: "Metadata Scanner", desc: "Find & strip hidden GPS, device info from photos" },
  { id: "watermark", icon: "💧", name: "Invisible Watermark", desc: "Embed & extract hidden messages in images" },
  { id: "forensics", icon: "🔬", name: "Photo Forensics", desc: "Detect if an image has been edited or manipulated" },
  { id: "scanner", icon: "🤖", name: "AI Face Scanner", desc: "See what AI detects in your photos" },
];

function App() {
  const [activeTool, setActiveTool] = useState(null);

  return (
    <div className="app">
      <header className="navbar">
        <div className="container nav-inner">
          <div className="logo" onClick={() => setActiveTool(null)} style={{ cursor: "pointer" }}>
            <div className="dot" />
            <span>SafeHer <span className="accent">Shield</span></span>
          </div>
          <nav className="nav-links">
            <a href="#tools" onClick={() => setActiveTool(null)}>Tools</a>
            <a href="#how">How It Works</a>
          </nav>
        </div>
      </header>

      {!activeTool && <HeroSection />}
      {!activeTool && <ToolsGrid onSelect={setActiveTool} />}
      {activeTool === "metadata" && <MetadataTool onBack={() => setActiveTool(null)} />}
      {activeTool === "watermark" && <WatermarkTool onBack={() => setActiveTool(null)} />}
      {activeTool === "forensics" && <ForensicsTool onBack={() => setActiveTool(null)} />}
      {activeTool === "scanner" && <ScannerTool onBack={() => setActiveTool(null)} />}
      {!activeTool && <HowItWorks />}

      <footer className="footer">
        <div className="container">© 2026 SafeHer Shield — Women's Digital Safety Toolkit</div>
      </footer>
    </div>
  );
}

/* ========== HERO ========== */
function HeroSection() {
  return (
    <section className="hero">
      <div className="glow" />
      <div className="container hero-inner">
        <div className="badge">🛡️ Women's Digital Safety Toolkit</div>
        <h1>SafeHer <span className="accent">Shield</span></h1>
        <p className="hero-sub">
          Protect your photos, trace unauthorized sharing, detect manipulated images — all in one toolkit built for women's digital safety.
        </p>
        <div className="hero-stats">
          <div className="hero-stat"><strong>4</strong> Safety Tools</div>
          <div className="hero-stat"><strong>100%</strong> Client-Side Privacy</div>
          <div className="hero-stat"><strong>0</strong> Data Stored</div>
        </div>
      </div>
    </section>
  );
}

/* ========== TOOLS GRID ========== */
function ToolsGrid({ onSelect }) {
  return (
    <section className="tools-section" id="tools">
      <div className="container">
        <h2>Safety Tools</h2>
        <p className="section-sub">Choose a tool to protect your digital identity</p>
        <div className="tools-grid">
          {TOOLS.map((t) => (
            <div key={t.id} className="tool-card" onClick={() => onSelect(t.id)}>
              <div className="tool-icon">{t.icon}</div>
              <h3>{t.name}</h3>
              <p>{t.desc}</p>
              <span className="tool-arrow">→</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========== SHARED: FILE UPLOAD ========== */
function FileUpload({ onFile, file, preview, accept = "image/jpeg,image/png,image/webp" }) {
  const handleDrop = (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); };
  return (
    <div className="upload-area" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}
      onClick={() => document.getElementById("fu").click()} style={{ cursor: "pointer" }}>
      {preview ? <img src={preview} alt="Preview" className="preview-img" /> : (
        <><p>Drag & Drop or Click to Upload</p><span>JPG, PNG, WebP — max 10 MB</span></>
      )}
      <input id="fu" type="file" accept={accept} onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} style={{ display: "none" }} />
      {file && <div className="file-name">{file.name} ({(file.size / 1024).toFixed(0)} KB)</div>}
    </div>
  );
}

/* ========== TOOL 1: METADATA ========== */
function MetadataTool({ onBack }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [stripResult, setStripResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = (f) => { setFile(f); setPreview(URL.createObjectURL(f)); setScanResult(null); setStripResult(null); setError(null); };

  const handleScan = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const fd = new FormData(); fd.append("image", file);
      const res = await fetch("/api/tools/metadata/scan", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setScanResult(data.data);
      else setError(data.error);
    } catch { setError("Connection failed"); }
    setLoading(false);
  };

  const handleStrip = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const fd = new FormData(); fd.append("image", file);
      const res = await fetch("/api/tools/metadata/strip", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setStripResult(data.data);
      else setError(data.error);
    } catch { setError("Connection failed"); }
    setLoading(false);
  };

  return (
    <section className="tool-page">
      <div className="container">
        <button className="back-btn" onClick={onBack}>← Back to Tools</button>
        <div className="tool-header">
          <span className="tool-page-icon">📍</span>
          <div>
            <h2>Metadata Scanner & Stripper</h2>
            <p>Photos contain hidden data: GPS coordinates, device model, timestamps. Anyone who gets your photo can see where you live, what phone you use, and when the photo was taken.</p>
          </div>
        </div>

        <div className="tool-layout">
          <div className="card">
            <h3>Upload Photo</h3>
            <FileUpload onFile={handleFile} file={file} preview={preview} />
            <div className="button-row">
              <button className="btn-primary" onClick={handleScan} disabled={!file || loading}>
                {loading ? "Scanning..." : "🔍 Scan Metadata"}
              </button>
              <button className="btn-danger" onClick={handleStrip} disabled={!file || loading}>
                🧹 Strip All Metadata
              </button>
            </div>
          </div>

          <div className="card results-card">
            {!scanResult && !stripResult && <div className="placeholder">Upload a photo to scan for hidden data</div>}

            {scanResult && (
              <div className="scan-results">
                <div className={`risk-badge risk-${scanResult.riskLevel?.toLowerCase()}`}>
                  Risk Level: {scanResult.riskLevel || "None"}
                </div>
                <div className="meta-stat">Found <strong>{scanResult.totalFields || 0}</strong> metadata fields</div>

                {scanResult.risks && scanResult.risks.length > 0 && (
                  <div className="risks-list">
                    <h4>⚠️ Privacy Risks Found:</h4>
                    {scanResult.risks.map((r, i) => <div key={i} className="risk-item">• {r}</div>)}
                  </div>
                )}

                {scanResult.categories && Object.entries(scanResult.categories).map(([cat, fields]) => (
                  <div key={cat} className="meta-category">
                    <h4>{cat}</h4>
                    <div className="meta-fields">
                      {Object.entries(fields).map(([k, v]) => (
                        <div key={k} className="meta-field">
                          <span className="meta-key">{k}</span>
                          <span className="meta-val">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {stripResult && (
              <div className="strip-results">
                <div className="success-badge">✅ Metadata Stripped Successfully</div>
                <p>Removed <strong>{stripResult.fieldsRemoved}</strong> fields → <strong>{stripResult.fieldsRemaining}</strong> remaining</p>
                <a href={stripResult.cleanUrl} download className="btn-primary" style={{ display: "inline-block", marginTop: 12, textDecoration: "none" }}>
                  📥 Download Clean Photo
                </a>
              </div>
            )}
          </div>
        </div>
        {error && <div className="error-msg">{error}</div>}
      </div>
    </section>
  );
}

/* ========== TOOL 2: WATERMARK ========== */
function WatermarkTool({ onBack }) {
  const [mode, setMode] = useState("embed");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = (f) => { setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setError(null); };

  const handleEmbed = async () => {
    if (!file || !message.trim()) return;
    setLoading(true); setError(null);
    try {
      const fd = new FormData(); fd.append("image", file); fd.append("message", message.trim());
      const res = await fetch("/api/tools/watermark/embed", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setResult(data.data);
      else setError(data.error);
    } catch { setError("Connection failed"); }
    setLoading(false);
  };

  const handleExtract = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const fd = new FormData(); fd.append("image", file);
      const res = await fetch("/api/tools/watermark/extract", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setResult(data.data);
      else setError(data.error);
    } catch { setError("Connection failed"); }
    setLoading(false);
  };

  return (
    <section className="tool-page">
      <div className="container">
        <button className="back-btn" onClick={onBack}>← Back to Tools</button>
        <div className="tool-header">
          <span className="tool-page-icon">💧</span>
          <div>
            <h2>Invisible Watermark</h2>
            <p>Hide a secret message inside your photo using LSB steganography. If your photo is shared without permission, extract the watermark to prove ownership and trace the leak.</p>
          </div>
        </div>

        <div className="mode-tabs">
          <button className={`tab ${mode === "embed" ? "active" : ""}`} onClick={() => { setMode("embed"); setResult(null); }}>Embed Watermark</button>
          <button className={`tab ${mode === "extract" ? "active" : ""}`} onClick={() => { setMode("extract"); setResult(null); }}>Extract Watermark</button>
        </div>

        <div className="tool-layout">
          <div className="card">
            <h3>{mode === "embed" ? "Embed Secret Message" : "Extract Hidden Message"}</h3>
            <FileUpload onFile={handleFile} file={file} preview={preview} />
            {mode === "embed" && (
              <div className="input-group">
                <label>Secret Message:</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g., Property of Jane Doe — shared with X on 2026-02-28"
                  rows={3} className="text-input" />
              </div>
            )}
            <button className="btn-primary" onClick={mode === "embed" ? handleEmbed : handleExtract}
              disabled={!file || loading || (mode === "embed" && !message.trim())}>
              {loading ? "Processing..." : mode === "embed" ? "💧 Embed Watermark" : "🔎 Extract Watermark"}
            </button>
          </div>

          <div className="card results-card">
            {!result && <div className="placeholder">{mode === "embed" ? "Embed a hidden message into your photo" : "Upload a watermarked PNG to extract the hidden message"}</div>}

            {result && mode === "embed" && result.success && (
              <div className="wm-result">
                <div className="success-badge">✅ Watermark Embedded!</div>
                <div className="wm-stats">
                  <div className="meta-field"><span className="meta-key">Message</span><span className="meta-val">"{result.message}"</span></div>
                  <div className="meta-field"><span className="meta-key">Bits Used</span><span className="meta-val">{result.bitsEmbedded}</span></div>
                  <div className="meta-field"><span className="meta-key">Capacity Used</span><span className="meta-val">{result.capacityUsed}</span></div>
                </div>
                <div className="wm-warning">⚠️ Save as PNG only — JPEG compression will destroy the watermark!</div>
                <a href={result.watermarkedUrl} download className="btn-primary" style={{ display: "inline-block", marginTop: 12, textDecoration: "none" }}>
                  📥 Download Watermarked Photo
                </a>
              </div>
            )}

            {result && mode === "extract" && (
              <div className="wm-result">
                {result.found ? (
                  <>
                    <div className="success-badge">✅ Watermark Found!</div>
                    <div className="extracted-msg">"{result.message}"</div>
                    <div className="meta-field"><span className="meta-key">Method</span><span className="meta-val">{result.method}</span></div>
                  </>
                ) : (
                  <>
                    <div className="risk-badge risk-low">No Watermark Detected</div>
                    <p>{result.message}</p>
                    {result.hint && <p className="dim">{result.hint}</p>}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {error && <div className="error-msg">{error}</div>}
      </div>
    </section>
  );
}

/* ========== TOOL 3: FORENSICS ========== */
function ForensicsTool({ onBack }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = (f) => { setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setError(null); };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const fd = new FormData(); fd.append("image", file);
      const res = await fetch("/api/tools/forensics/ela", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setResult(data.data);
      else setError(data.error);
    } catch { setError("Connection failed"); }
    setLoading(false);
  };

  return (
    <section className="tool-page">
      <div className="container">
        <button className="back-btn" onClick={onBack}>← Back to Tools</button>
        <div className="tool-header">
          <span className="tool-page-icon">🔬</span>
          <div>
            <h2>Photo Forensics (ELA)</h2>
            <p>Error Level Analysis detects image tampering by revealing regions that have been edited, spliced, or manipulated. The same technique used by forensic analysts and journalists.</p>
          </div>
        </div>

        <div className="tool-layout">
          <div className="card">
            <h3>Upload Suspicious Image</h3>
            <FileUpload onFile={handleFile} file={file} preview={preview} />
            <button className="btn-primary" onClick={handleAnalyze} disabled={!file || loading}>
              {loading ? "Analyzing..." : "🔬 Run Forensic Analysis"}
            </button>
          </div>

          <div className="card results-card">
            {!result && <div className="placeholder">Upload an image to check for manipulation</div>}

            {result && (
              <div className="ela-results">
                <div className={`verdict-badge ${result.verdict.includes("Authentic") ? "verdict-safe" : result.verdict.includes("Likely") ? "verdict-danger" : "verdict-warn"}`}>
                  {result.verdict}
                </div>
                <div className="ela-confidence">Confidence: {result.confidence}</div>

                <div className="ela-stats">
                  <div className="meta-field"><span className="meta-key">Avg Error Level</span><span className="meta-val">{result.avgErrorLevel}</span></div>
                  <div className="meta-field"><span className="meta-key">Max Error Level</span><span className="meta-val">{result.maxErrorLevel}</span></div>
                  <div className="meta-field"><span className="meta-key">Suspicious Regions</span><span className="meta-val">{result.suspiciousPercent}%</span></div>
                </div>

                <p className="ela-explanation">{result.explanation}</p>

                <div className="ela-images">
                  <div className="ela-img-box">
                    <h4>Original</h4>
                    <img src={result.originalUrl} alt="Original" />
                  </div>
                  <div className="ela-img-box">
                    <h4>Error Level Analysis</h4>
                    <img src={result.elaUrl} alt="ELA" />
                  </div>
                  <div className="ela-img-box">
                    <h4>Heatmap</h4>
                    <img src={result.heatmapUrl} alt="Heatmap" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {error && <div className="error-msg">{error}</div>}
      </div>
    </section>
  );
}

/* ========== TOOL 4: AI FACE SCANNER ========== */
function ScannerTool({ onBack }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = (f) => { setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setError(null); };

  const handleScan = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      // Upload first to get an ID
      const fd = new FormData(); fd.append("image", file); fd.append("strength", "low");
      const uploadRes = await fetch("/api/images/upload", { method: "POST", body: fd });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) { setError(uploadData.error); setLoading(false); return; }

      // Now run detection
      const detectRes = await fetch(`/api/images/detect/${uploadData.data.id}`);
      const detectData = await detectRes.json();
      if (detectData.success) setResult({ ...detectData.data, uploadData: uploadData.data });
      else setError(detectData.error || "Detection failed");
    } catch { setError("Connection failed"); }
    setLoading(false);
  };

  return (
    <section className="tool-page">
      <div className="container">
        <button className="back-btn" onClick={onBack}>← Back to Tools</button>
        <div className="tool-header">
          <span className="tool-page-icon">🤖</span>
          <div>
            <h2>AI Face Scanner</h2>
            <p>See exactly what artificial intelligence detects in your photos — face locations, confidence levels, and landmark points. Know your digital exposure.</p>
          </div>
        </div>

        <div className="tool-layout">
          <div className="card">
            <h3>Upload Photo</h3>
            <FileUpload onFile={handleFile} file={file} preview={preview} />
            <button className="btn-primary" onClick={handleScan} disabled={!file || loading}>
              {loading ? "Scanning with AI..." : "🤖 Scan with AI"}
            </button>
          </div>

          <div className="card results-card">
            {!result && <div className="placeholder">Upload a photo to see what AI detects</div>}

            {result && (
              <div className="scanner-results">
                <div className="scanner-headline">
                  AI detected <strong>{result.original.facesDetected}</strong> face(s) at <strong>{result.original.avgConfidence}%</strong> confidence
                </div>

                <div className="scanner-faces">
                  {result.original.faces.map((face, i) => (
                    <div key={i} className="scanner-face">
                      <h4>Face #{face.faceIndex}</h4>
                      <div className="meta-field"><span className="meta-key">Confidence</span><span className="meta-val">{face.confidence}%</span></div>
                      <div className="meta-field"><span className="meta-key">Location</span><span className="meta-val">({face.box.x}, {face.box.y})</span></div>
                      <div className="meta-field"><span className="meta-key">Size</span><span className="meta-val">{face.box.width}×{face.box.height}px</span></div>
                      <div className="meta-field"><span className="meta-key">Landmarks</span><span className="meta-val">{face.landmarks} points</span></div>
                    </div>
                  ))}
                </div>

                <div className="scanner-model">
                  <span className="meta-key">Model Used:</span> {result.original.modelUsed}
                </div>

                <div className="scanner-warning">
                  <h4>⚠️ What This Means</h4>
                  <p>Any application using face detection AI can identify faces in your photos with this level of accuracy. This includes social media platforms, surveillance systems, and deepfake generators.</p>
                </div>
              </div>
            )}
          </div>
        </div>
        {error && <div className="error-msg">{error}</div>}
      </div>
    </section>
  );
}

/* ========== HOW IT WORKS ========== */
function HowItWorks() {
  return (
    <section className="how-section" id="how">
      <div className="container">
        <h2>Why This Matters</h2>
        <p className="section-sub">Digital photos carry more information than you think</p>
        <div className="why-grid">
          <div className="why-card">
            <div className="why-icon">📍</div>
            <h4>Location Tracking</h4>
            <p>Photos shared online can reveal your home address, workplace, and daily routines through embedded GPS coordinates.</p>
          </div>
          <div className="why-card">
            <div className="why-icon">🔎</div>
            <h4>Identity Theft</h4>
            <p>Device serial numbers and timestamps in photo metadata create a digital fingerprint that can be used to track you.</p>
          </div>
          <div className="why-card">
            <div className="why-icon">📸</div>
            <h4>Fake Evidence</h4>
            <p>Manipulated images can be used for harassment, blackmail, or creating false evidence. ELA helps detect this.</p>
          </div>
          <div className="why-card">
            <div className="why-icon">💧</div>
            <h4>Photo Leaks</h4>
            <p>Invisible watermarks help trace how and where your private photos were leaked, providing evidence for action.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default App;
