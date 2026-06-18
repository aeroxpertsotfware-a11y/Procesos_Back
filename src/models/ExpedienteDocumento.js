const mongoose = require("mongoose");

const documentoTipos = [
  "DIS",
  "MANUAL_SMS",
  "MANUAL_OPERACIONES",
  "MCM",
  "MMP",
  "OTRO",
];

const documentoEstados = ["CARGADO", "GENERADO", "APROBADO", "RECHAZADO"];

const expedienteDocumentoSchema = new mongoose.Schema(
  {
    clienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    expedienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CertificationExpediente",
      default: null,
      index: true,
    },
    tipo: {
      type: String,
      enum: documentoTipos,
      required: true,
      index: true,
    },
    nombreOriginal: {
      type: String,
      required: true,
      trim: true,
    },
    nombreAlmacenado: {
      type: String,
      required: true,
      trim: true,
    },
    r2Key: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    estado: {
      type: String,
      enum: documentoEstados,
      default: "CARGADO",
      index: true,
    },
    observacion: {
      type: String,
      default: "",
      trim: true,
    },
    creadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: "creadoEn",
      updatedAt: "actualizadoEn",
    },
  }
);

expedienteDocumentoSchema.index({ clienteId: 1, tipo: 1 });
expedienteDocumentoSchema.index({ clienteId: 1, creadoEn: -1 });

module.exports = mongoose.model("ExpedienteDocumento", expedienteDocumentoSchema);
