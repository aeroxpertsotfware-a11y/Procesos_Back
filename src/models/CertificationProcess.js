const mongoose = require("mongoose");

const processDocumentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    estado: {
      type: String,
      enum: ["pendiente", "cargado", "aprobado", "rechazado"],
      default: "pendiente",
    },
    archivoKey: { type: String, default: "", trim: true },
    archivoUrl: { type: String, default: "", trim: true },
    observacion: { type: String, default: "", trim: true },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const observationSchema = new mongoose.Schema(
  {
    mensaje: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdByName: { type: String, default: "", trim: true },
    tipo: { type: String, default: "nota", trim: true },
  },
  { _id: false }
);

const certificationProcessSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    estadoGeneral: {
      type: String,
      enum: ["Activado", "En proceso", "Con observaciones", "Finalizado"],
      default: "Activado",
    },
    porcentajeAvance: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    documentos: {
      type: [processDocumentSchema],
      default: [],
    },
    dis: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    observaciones: {
      type: [observationSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CertificationProcess", certificationProcessSchema);
