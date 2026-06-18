const mongoose = require("mongoose");

const documentStatus = ["pendiente", "cargado", "aprobado", "rechazado"];
const processStatus = ["pendiente", "en_revision", "aprobado", "rechazado"];

const documentoSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "",
      trim: true,
    },
    url: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: documentStatus,
      default: "pendiente",
    },
    uploadedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const companyDataSchema = new mongoose.Schema(
  {
    razonSocial: { type: String, default: "", trim: true },
    nit: { type: String, default: "", trim: true },
    direccion: { type: String, default: "", trim: true },
    telefono: { type: String, default: "", trim: true },
    emailEmpresa: { type: String, default: "", trim: true, lowercase: true },
    tipoOperacion: { type: [String], default: [] },
    actividadCIIU: { type: [String], default: [] },
    fechaRegistro: { type: Date, default: null },
  },
  { _id: false }
);

const certificationExpedienteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    companyData: {
      type: companyDataSchema,
      default: () => ({}),
    },
    documentos: {
      camaraComercio: { type: documentoSchema, default: () => ({}) },
      ruas: { type: documentoSchema, default: () => ({}) },
      reta: { type: documentoSchema, default: () => ({}) },
      hojaVidaJefePilotos: { type: documentoSchema, default: () => ({}) },
      hojaVidaGerenteSeguridad: { type: documentoSchema, default: () => ({}) },
    },
    estadoProceso: {
      type: String,
      enum: processStatus,
      default: "pendiente",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CertificationExpediente", certificationExpedienteSchema);
