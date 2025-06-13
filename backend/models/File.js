import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  relativePath: { type: String, required: true },
  uploadDate: { type: Date, default: Date.now },
});

export const File = mongoose.model("File", fileSchema);
