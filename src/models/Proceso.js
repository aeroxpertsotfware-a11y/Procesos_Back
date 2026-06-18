const mongoose = require("mongoose");

const procesoSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    estado: {
      type: String,
      enum: ["En revisión", "Aprobado", "Requiere ajustes"],
      default: "En revisión",
    },
    progreso: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    observaciones: {
      type: Number,
      default: 0,
      min: 0,
    },
    ultimaActualizacion: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Proceso", procesoSchema);
