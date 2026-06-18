const mongoose = require("mongoose");

const manualJobSchema = new mongoose.Schema(
  {
    manualKey: {
      type: String,
      required: true,
      trim: true,
    },
    manualName: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "running", "done", "error"],
      default: "pending",
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    currentChapterIndex: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalChapters: {
      type: Number,
      default: 0,
      min: 0,
    },
    errorMessage: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ManualJob", manualJobSchema);
