const mongoose = require("mongoose");

const manualGenerationJobLogSchema = new mongoose.Schema(
  {
    at: {
      type: Date,
      default: Date.now,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const manualGenerationJobResultSchema = new mongoose.Schema(
  {
    r2Key: {
      type: String,
      default: "",
      trim: true,
    },
    filename: {
      type: String,
      default: "",
      trim: true,
    },
    mimeType: {
      type: String,
      default: "",
      trim: true,
    },
    createdAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const manualGenerationValidationItemSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "",
      trim: true,
    },
    label: {
      type: String,
      default: "",
      trim: true,
    },
    severity: {
      type: String,
      enum: ["critical", "high", "medium", "low"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["pass", "fail"],
      default: "fail",
    },
  },
  { _id: false }
);

const manualGenerationValidationSchema = new mongoose.Schema(
  {
    score: {
      type: Number,
      default: 0,
    },
    passed: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    canDownload: {
      type: Boolean,
      default: true,
    },
    summary: {
      type: String,
      default: "",
      trim: true,
    },
    items: {
      type: [manualGenerationValidationItemSchema],
      default: [],
    },
  },
  { _id: false }
);

const manualGenerationRequestedBySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    nombre: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const manualGenerationTargetClientSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    nombre: {
      type: String,
      default: "",
      trim: true,
    },
    empresa: {
      type: String,
      default: "",
      trim: true,
    },
    nit: {
      type: String,
      default: "",
      trim: true,
    },
    tipoOperacion: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const manualGenerationJobChapterSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    placeholder: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "running", "done", "error"],
      default: "pending",
    },
    preview: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const manualGenerationJobSchema = new mongoose.Schema(
  {
    manualKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    requestedBy: {
      type: manualGenerationRequestedBySchema,
      default: () => ({}),
    },
    targetClient: {
      type: manualGenerationTargetClientSchema,
      default: () => ({}),
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
    currentStep: {
      type: String,
      default: "",
      trim: true,
    },
    currentChapter: {
      type: String,
      default: "",
      trim: true,
    },
    currentChapterTitle: {
      type: String,
      default: "",
      trim: true,
    },
    completedChapters: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalChapters: {
      type: Number,
      default: 0,
      min: 0,
    },
    latestChapterPreview: {
      type: String,
      default: "",
    },
    documentPreview: {
      type: String,
      default: "",
    },
    chapters: {
      type: [manualGenerationJobChapterSchema],
      default: [],
    },
    logs: {
      type: [manualGenerationJobLogSchema],
      default: [],
    },
    result: {
      type: manualGenerationJobResultSchema,
      default: () => ({}),
    },
    validation: {
      type: manualGenerationValidationSchema,
      default: () => ({}),
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

module.exports = mongoose.model("ManualGenerationJob", manualGenerationJobSchema);
