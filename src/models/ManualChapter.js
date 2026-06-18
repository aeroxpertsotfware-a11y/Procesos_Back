const mongoose = require("mongoose");

const manualChapterSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ManualJob",
      required: true,
      index: true,
    },
    chapterId: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    index: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "running", "done", "error"],
      default: "pending",
    },
    content: {
      type: String,
      default: "",
    },
    wordCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ManualChapter", manualChapterSchema);
