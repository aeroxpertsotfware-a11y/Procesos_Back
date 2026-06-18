const mongoose = require("mongoose");

const normalizeRole = (value) => String(value || "").trim().toLowerCase();

const userSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    rol: {
      type: String,
      enum: ["admin", "colaborador", "cliente", "revisor"],
      lowercase: true,
      trim: true,
      default: "cliente",
      set: normalizeRole,
    },
    activo: {
      type: Boolean,
      default: true,
    },
    isActivated: {
      type: Boolean,
      default: false,
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    activationCodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ActivationCode",
      default: null,
    },
    sessions: [
      {
        sessionId: {
          type: String,
          required: true,
          trim: true,
        },
        userAgent: {
          type: String,
          default: "",
          trim: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        lastSeenAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

userSchema.pre("validate", function normalizeUserFields() {
  this.nombre = String(this.nombre || "").trim();
  this.email = String(this.email || "").trim().toLowerCase();
  this.rol = normalizeRole(this.rol || "cliente");
});

module.exports = mongoose.model("User", userSchema);
