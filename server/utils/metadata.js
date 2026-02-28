/**
 * METADATA UTILITY
 * ================
 * Extract and strip EXIF/GPS metadata from images.
 * Prevents location stalking and device fingerprinting.
 */

const exifr = require("exifr");
const sharp = require("sharp");

/**
 * Extract all metadata from an image file.
 * Returns categorized metadata: GPS, device, camera settings, timestamps.
 */
async function extractMetadata(filePath) {
  try {
    // Get full EXIF data
    const full = await exifr.parse(filePath, { 
      tiff: true, exif: true, gps: true, icc: false,
      iptc: true, xmp: true, jfif: true
    });

    if (!full) {
      return { found: false, message: "No metadata found in this image.", categories: {} };
    }

    // Categorize the metadata for clear display
    const categories = {};

    // GPS / Location
    const gpsFields = {};
    if (full.latitude !== undefined) gpsFields["Latitude"] = full.latitude.toFixed(6);
    if (full.longitude !== undefined) gpsFields["Longitude"] = full.longitude.toFixed(6);
    if (full.GPSAltitude) gpsFields["Altitude"] = `${full.GPSAltitude}m`;
    if (full.GPSSpeed) gpsFields["Speed"] = full.GPSSpeed;
    if (Object.keys(gpsFields).length > 0) {
      categories["📍 Location (GPS)"] = gpsFields;
    }

    // Device Info
    const deviceFields = {};
    if (full.Make) deviceFields["Device Make"] = full.Make;
    if (full.Model) deviceFields["Device Model"] = full.Model;
    if (full.Software) deviceFields["Software"] = full.Software;
    if (full.LensMake) deviceFields["Lens Make"] = full.LensMake;
    if (full.LensModel) deviceFields["Lens Model"] = full.LensModel;
    if (full.SerialNumber) deviceFields["Serial Number"] = full.SerialNumber;
    if (full.HostComputer) deviceFields["Host Computer"] = full.HostComputer;
    if (Object.keys(deviceFields).length > 0) {
      categories["📱 Device Info"] = deviceFields;
    }

    // Timestamps
    const timeFields = {};
    if (full.DateTimeOriginal) timeFields["Date Taken"] = new Date(full.DateTimeOriginal).toISOString();
    if (full.CreateDate) timeFields["Created"] = new Date(full.CreateDate).toISOString();
    if (full.ModifyDate) timeFields["Modified"] = new Date(full.ModifyDate).toISOString();
    if (full.GPSDateStamp) timeFields["GPS Timestamp"] = full.GPSDateStamp;
    if (Object.keys(timeFields).length > 0) {
      categories["🕐 Timestamps"] = timeFields;
    }

    // Camera Settings
    const cameraFields = {};
    if (full.ExposureTime) cameraFields["Exposure"] = `1/${Math.round(1/full.ExposureTime)}s`;
    if (full.FNumber) cameraFields["Aperture"] = `f/${full.FNumber}`;
    if (full.ISO) cameraFields["ISO"] = full.ISO;
    if (full.FocalLength) cameraFields["Focal Length"] = `${full.FocalLength}mm`;
    if (full.Flash) cameraFields["Flash"] = full.Flash;
    if (full.WhiteBalance) cameraFields["White Balance"] = full.WhiteBalance;
    if (full.ImageWidth) cameraFields["Width"] = full.ImageWidth;
    if (full.ImageHeight) cameraFields["Height"] = full.ImageHeight;
    if (full.Orientation) cameraFields["Orientation"] = full.Orientation;
    if (Object.keys(cameraFields).length > 0) {
      categories["📷 Camera Settings"] = cameraFields;
    }

    // Count risks
    const risks = [];
    if (categories["📍 Location (GPS)"]) risks.push("GPS location embedded — anyone can see where this was taken");
    if (categories["📱 Device Info"]) risks.push("Device fingerprint exposed — phone model, serial number visible");
    if (categories["🕐 Timestamps"]) risks.push("Exact timestamps reveal when and patterns of activity");
    if (full.SerialNumber) risks.push("Camera serial number can uniquely identify your device");

    const totalFields = Object.values(categories).reduce((sum, cat) => sum + Object.keys(cat).length, 0);

    return {
      found: true,
      totalFields,
      risks,
      riskLevel: risks.length >= 3 ? "High" : risks.length >= 1 ? "Medium" : "Low",
      categories,
      raw: full
    };
  } catch (err) {
    // Some images (PNG) don't support EXIF
    return { found: false, message: "No metadata found (format may not support EXIF).", categories: {} };
  }
}

/**
 * Strip ALL metadata from an image.
 * Uses sharp to re-encode the image without any EXIF/GPS/IPTC data.
 * Returns the path to the cleaned image.
 */
async function stripMetadata(inputPath, outputPath) {
  const meta = await sharp(inputPath).metadata();
  
  // Re-encode without metadata — sharp drops all EXIF by default when you process
  const pipeline = sharp(inputPath).rotate(); // .rotate() auto-rotates based on EXIF then strips

  if (meta.format === "jpeg" || meta.format === "jpg") {
    await pipeline.jpeg({ quality: 95 }).toFile(outputPath);
  } else if (meta.format === "png") {
    await pipeline.png().toFile(outputPath);
  } else if (meta.format === "webp") {
    await pipeline.webp({ quality: 95 }).toFile(outputPath);
  } else {
    await pipeline.png().toFile(outputPath);
  }

  // Verify the strip worked
  const afterMeta = await extractMetadata(outputPath);
  
  return {
    stripped: true,
    fieldsRemoved: (await extractMetadata(inputPath)).totalFields || 0,
    fieldsRemaining: afterMeta.totalFields || 0
  };
}

module.exports = { extractMetadata, stripMetadata };
