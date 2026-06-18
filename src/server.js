require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const colaboradorRoutes = require("./routes/colaborador.routes");
const iaManualsRoutes = require("./routes/iaManuals.routes");
const adminRoutes = require("./routes/admin.routes");
const clienteRoutes = require("./routes/cliente.routes");
const clientRoutes = require("./routes/client.routes");
const disRoutes = require("./routes/dis.routes");
const collaboratorProcessesRoutes = require("./routes/collaboratorProcesses.routes");
const expedienteDocsRoutes = require("./routes/expedienteDocs.routes");
const manualsRoutes = require("./routes/manuals.routes");

const app = express();

// Conectar BD
connectDB();

// Middlewares
app.use(
  cors({
    exposedHeaders: ["Content-Disposition", "Content-Type"],
  })
);
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/colaborador", colaboradorRoutes);
app.use("/api/ia/manuales", iaManualsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/cliente", clienteRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/dis", disRoutes);
app.use("/api/collaborator/processes", collaboratorProcessesRoutes);
app.use("/api/colaborador/expedientes", expedienteDocsRoutes);
app.use("/api/manuales", manualsRoutes);

// Ruta test
app.get("/", (req, res) => {
  res.json({ message: "Backend Certificación UAS funcionando " });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(` Servidor corriendo en puerto ${PORT}`);
});
