const mongoose = require("mongoose");

const managementRoleOptions = [
  "Ejecutivo responsable",
  "Jefe de pilotos",
  "Gerente Seguridad Operacional - SMS",
  "Responsable gestion mantenimiento",
];

const disStatusOptions = ["borrador", "enviado"];
const possessionOptions = ["", "Propia", "Arriendo"];
const requestTypeOptions = [
  "Certificacion inicial",
  "Modificacion permiso",
  "Adicion permiso",
];

const managementPersonSchema = new mongoose.Schema(
  {
    cargo: {
      type: String,
      enum: managementRoleOptions,
      required: true,
      trim: true,
    },
    nombre: {
      type: String,
      default: "",
      trim: true,
    },
    correoElectronico: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    telefono: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const uasSchema = new mongoose.Schema(
  {
    marca: { type: String, default: "", trim: true },
    modelo: { type: String, default: "", trim: true },
    cantidad: { type: Number, default: null, min: 0 },
    pbmo: { type: String, default: "", trim: true },
    posesion: { type: String, enum: possessionOptions, default: "" },
    tipoOperacion: { type: String, default: "", trim: true },
    numeroRegistroRUAS: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const etaSchema = new mongoose.Schema(
  {
    marca: { type: String, default: "", trim: true },
    modelo: { type: String, default: "", trim: true },
    cantidad: { type: Number, default: null, min: 0 },
    posesion: { type: String, enum: possessionOptions, default: "" },
    tipoOperacion: { type: String, default: "", trim: true },
    numeroRegistroRETA: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const disSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    sectionA: {
      nombreSolicitanteOrganizacion: { type: String, default: "", trim: true },
      nit: { type: String, default: "", trim: true },
      direccionOficinaAdministrativa: { type: String, default: "", trim: true },
      departamento: { type: String, default: "", trim: true },
      ciudad: { type: String, default: "", trim: true },
      lugarInspeccionOperacional: { type: String, default: "", trim: true },
      departamentoInspeccion: { type: String, default: "", trim: true },
      ciudadInspeccion: { type: String, default: "", trim: true },
    },
    sectionB: {
      personalGestion: {
        type: [managementPersonSchema],
        default: [],
      },
    },
    sectionC: {
      normativaRAC100: { type: Boolean, default: true },
      tipoSolicitud: {
        type: String,
        enum: requestTypeOptions,
        default: "Certificacion inicial",
      },
      serviciosComerciales: { type: Boolean, default: false },
      tiposOperacion: { type: [String], default: [] },
      otroTipoOperacion: { type: String, default: "", trim: true },
      tipoContactoVisual: {
        type: String,
        enum: ["VLOS", "EVLOS", "BVLOS", ""],
        default: "",
      },
      vuelosEspeciales: { type: [String], default: [] },
      otroVueloEspecial: { type: String, default: "", trim: true },
    },
    sectionD: {
      uas: {
        type: [uasSchema],
        default: [],
      },
    },
    sectionE: {
      eta: {
        type: [etaSchema],
        default: [],
      },
    },
    sectionF: {
      informacionAdicional: { type: String, default: "", trim: true },
      fechaReunionOrientacion: { type: Date, default: null },
    },
    sectionG: {
      nombreDeclarante: { type: String, default: "", trim: true },
      cargo: { type: String, default: "", trim: true },
      fecha: { type: Date, default: null },
      firma: { type: String, default: "", trim: true },
    },
    estado: {
      type: String,
      enum: disStatusOptions,
      default: "borrador",
    },
    documentGeneration: {
      status: {
        type: String,
        enum: ["pending", "generated"],
        default: "pending",
      },
      lastGeneratedAt: {
        type: Date,
        default: null,
      },
      format: {
        type: String,
        default: "",
        trim: true,
      },
      documentKey: {
        type: String,
        default: "",
        trim: true,
      },
      documentUrl: {
        type: String,
        default: "",
        trim: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("DIS", disSchema);
