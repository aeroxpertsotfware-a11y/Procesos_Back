const express = require("express");
const geminiService = require("../services/gemini.service");
const { loadManualTemplate } = require("../utils/manualTemplates");
const ManualJob = require("../models/ManualJob");
const ManualChapter = require("../models/ManualChapter");

const router = express.Router();

router.get("/test", async (_req, res) => {
  try {
    const reply = await geminiService.testConnection();
    return res.json({ ok: true, reply });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "No fue posible probar Gemini",
      details: error.message,
    });
  }
});

router.post("/jobs", async (req, res) => {
  try {
    const { manualKey } = req.body || {};
    if (!manualKey) {
      return res.status(400).json({ ok: false, message: "manualKey es requerido" });
    }

    const template = loadManualTemplate(manualKey);
    const chapter = template.chapters?.[0];
    if (!chapter) {
      return res.status(400).json({
        ok: false,
        message: "El template no contiene capitulo placeholder",
      });
    }

    const totalChapters = Array.isArray(template.chapters) ? template.chapters.length : 0;
    const userId = req.user?._id || null;

    const job = await ManualJob.create({
      manualKey: template.manualKey,
      manualName: template.manualName,
      userId,
      status: "pending",
      progress: 0,
      currentChapterIndex: 0,
      totalChapters,
    });

    await ManualChapter.create({
      jobId: job._id,
      chapterId: chapter.id,
      title: chapter.title,
      index: 0,
      status: "pending",
      content: "",
      wordCount: 0,
    });

    return res.status(201).json({
      ok: true,
      jobId: job._id.toString(),
      manualName: template.manualName,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "No fue posible crear el job",
      details: error.message,
    });
  }
});

router.post("/jobs/:jobId/generar-capitulo", async (req, res) => {
  try {
    const { jobId } = req.params;
    const chapterIndex = Number(req.body?.chapterIndex ?? 0);
    const extraPrompt = String(req.body?.extraPrompt || "").trim();

    if (!jobId) {
      return res.status(400).json({ ok: false, message: "jobId es requerido" });
    }

    if (Number.isNaN(chapterIndex) || chapterIndex < 0) {
      return res.status(400).json({ ok: false, message: "chapterIndex invalido" });
    }

    const job = await ManualJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ ok: false, message: "Job no encontrado" });
    }

    const chapter = await ManualChapter.findOne({ jobId: job._id, index: chapterIndex });
    if (!chapter) {
      return res.status(404).json({ ok: false, message: "Capitulo no encontrado" });
    }

    const template = loadManualTemplate(job.manualKey);
    const globalInstructions = Array.isArray(template.globalInstructions)
      ? template.globalInstructions.join("\n")
      : "";

    const prompt = [
      `Manual: ${job.manualName}`,
      `Capitulo: ${chapter.title}`,
      `Instrucciones globales: ${globalInstructions || "Sin instrucciones globales."}`,
      `Indicaciones extra: ${extraPrompt || "Sin indicaciones adicionales."}`,
      "Genera contenido tecnico y claro para este capitulo."
    ].join("\n\n");

    chapter.status = "running";
    job.status = "running";
    await Promise.all([chapter.save(), job.save()]);

    const content = await geminiService.generateChapter({ prompt });
    const normalizedContent = String(content || "").trim();
    const wordCount = normalizedContent ? normalizedContent.split(/\s+/).length : 0;

    chapter.content = normalizedContent;
    chapter.wordCount = wordCount;
    chapter.status = "done";

    job.currentChapterIndex = chapterIndex;
    job.progress = 100;
    job.status = "done";
    job.errorMessage = "";

    await Promise.all([chapter.save(), job.save()]);

    return res.json({
      ok: true,
      chapter: {
        title: chapter.title,
        content: chapter.content,
      },
    });
  } catch (error) {
    const { jobId } = req.params;
    if (jobId) {
      await ManualJob.findByIdAndUpdate(jobId, {
        status: "error",
        errorMessage: error.message,
      }).catch(() => null);
    }

    return res.status(500).json({
      ok: false,
      message: "No fue posible generar el capitulo",
      details: error.message,
    });
  }
});

module.exports = router;
