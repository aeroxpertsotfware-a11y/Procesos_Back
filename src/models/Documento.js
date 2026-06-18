const mongoose = require("mongoose");

const documentoSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    tipo: {
      type: String,
      required: true,
      trim: true,
    },
    estado: {
      type: String,
      enum: ["Aprobado", "Pendiente", "Rechazado"],
      default: "Pendiente",
    },
    fechaSubida: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Documento", documentoSchema);
