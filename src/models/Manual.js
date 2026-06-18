const mongoose = require("mongoose");

const manualVersionSchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      required: true,
      min: 1,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const manualSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    versions: {
      type: [manualVersionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Manual", manualSchema);
