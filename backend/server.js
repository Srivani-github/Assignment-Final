import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import { File } from "./models/File.js"; // Your File schema (updated with relativePath)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

let allEvents = [];

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    loadEventDataFromMongoDB();
  })
  .catch((err) => console.error("MongoDB connection error:", err));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads/");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, fileExtension);
    const readableBaseName = baseName
      .substring(0, 20)
      .replace(/[^a-zA-Z0-9]/g, "");
    cb(null, `${readableBaseName}-${uniqueSuffix}${fileExtension}`);
  },
});
const upload = multer({ storage: storage });

function parseEventLine(line, sourceFile) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 15) {
    return null;
  }

  const [
    serialno,
    version,
    account_id,
    instance_id,
    srcaddr,
    dstaddr,
    srcport,
    dstport,
    protocol,
    packets,
    bytes,
    starttime,
    endtime,
    action,
    log_status,
  ] = parts;

  return {
    serialno: parseInt(serialno, 10),
    version: parseInt(version, 10),
    accountId: account_id,
    instanceId: instance_id,
    srcaddr,
    dstaddr,
    srcport: parseInt(srcport, 10),
    dstport: parseInt(dstport, 10),
    protocol: parseInt(protocol, 10),
    packets: parseInt(packets, 10),
    bytes: parseInt(bytes, 10),
    starttime: parseInt(starttime, 10),
    endtime: parseInt(endtime, 10),
    action,
    logStatus: log_status,
    _sourceFile: sourceFile,
  };
}

async function loadEventDataFromMongoDB() {
  try {
    const filesInDB = await File.find({});
    let tempAllEvents = [];

    if (filesInDB.length === 0) {
      console.log("No event data files found in MongoDB.");
    }

    for (const dbFile of filesInDB) {
      if (dbFile.data) {
        const fileContent = dbFile.data.toString("utf8");
        const lines = fileContent
          .split("\n")
          .filter((line) => line.trim() !== "");

        const parsedEventsFromFile = lines
          .map((line) =>
            parseEventLine(line, dbFile.relativePath || dbFile.name)
          )
          .filter((event) => event !== null);

        tempAllEvents = tempAllEvents.concat(parsedEventsFromFile);
      }
    }
    allEvents = tempAllEvents;
  } catch (error) {
    console.error("Error loading event data from MongoDB:", error);
  }
}

app.post("/upload", upload.array("myFiles"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded." });
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      const tempFilePath = file.path;
      const relativePath = file.originalname;
      const baseFileName = path.basename(file.originalname);

      const fileBuffer = fs.readFileSync(tempFilePath);

      const newFile = new File({
        name: baseFileName,

        data: fileBuffer,
        contentType: file.mimetype,
        relativePath: relativePath,
      });

      await newFile.save();
      uploadedFiles.push(newFile);

      fs.unlink(tempFilePath, (err) => {
        if (err) {
          console.error(`Error deleting temporary file ${tempFilePath}:`, err);
        }
      });
    }

    await loadEventDataFromMongoDB();

    res.status(201).json({
      success: true,
      uploadedCount: uploadedFiles.length,
    });
  } catch (error) {
    console.error("Error during folder upload:", error);
    res.status(500).json({ message: "Server error during folder upload." });
  }
});

app.post("/api/search", (req, res) => {
  const { searchString, startTime, endTime } = req.body;
  const startSearchTime = process.hrtime.bigint();
  const searchStartTime = parseInt(startTime, 10);
  const searchEndTime = parseInt(endTime, 10);

  if (isNaN(searchStartTime) || isNaN(searchEndTime)) {
    return res.status(400).json({ message: "Invalid start or end time." });
  }

  let matchingEvents = [];
  const foundInFiles = new Set();

  try {
    const timeFilteredEvents = allEvents.filter((event) => {
      return (
        event.starttime >= searchStartTime && event.endtime <= searchEndTime
      );
    });

    if (searchString) {
      const searchLower = searchString.toLowerCase();

      const fieldValuePair = searchLower.split("=");
      if (fieldValuePair.length === 2) {
        const field = fieldValuePair[0].trim();
        const value = fieldValuePair[1].trim();

        matchingEvents = timeFilteredEvents.filter((event) => {
          const eventValue = event[field];
          if (
            eventValue !== undefined &&
            (typeof eventValue === "string" || typeof eventValue === "number")
          ) {
            const matches = String(eventValue).toLowerCase().includes(value);
            if (matches && event._sourceFile) {
              foundInFiles.add(event._sourceFile);
            }
            return matches;
          }
          return false;
        });
      } else {
        matchingEvents = timeFilteredEvents.filter((event) => {
          const matches = Object.values(event).some(
            (val) =>
              (typeof val === "string" || typeof val === "number") &&
              String(val).toLowerCase().includes(searchLower)
          );
          if (matches && event._sourceFile) {
            foundInFiles.add(event._sourceFile);
          }
          return matches;
        });
      }
    } else {
      matchingEvents = timeFilteredEvents;
      matchingEvents.forEach((event) => {
        if (event._sourceFile) {
          foundInFiles.add(event._sourceFile);
        }
      });
    }

    const endSearchTime = process.hrtime.bigint();
    const searchDurationMs =
      Number(endSearchTime - startSearchTime) / 1_000_000;

    res.json({
      message: "Search successful",
      results: matchingEvents,
      foundInFiles: Array.from(foundInFiles),
      searchTimeTakenMs: searchDurationMs,
    });
  } catch (error) {
    console.error("Error during event search:", error);
    res.status(500).json({ message: "Server error during event search." });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
