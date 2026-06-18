const buildSmsValidationReport = ({ dataMap = {}, template = {} }) => {
  const chapterKeys = (template.chapters || [])
    .map((chapter) => String(chapter.placeholder || "").replace(/[{}]/g, "").trim())
    .filter(Boolean);

  const fullText = chapterKeys
    .map((key) => String(dataMap[key] || "").trim())
    .filter(Boolean)
    .join("\n\n")
    .toLowerCase();

  const rules = [
    {
      key: "estructura_sms",
      label: "Estructura SMS",
      test: /(4 componentes|cuatro componentes)/.test(fullText) && /(12 elementos|doce elementos)/.test(fullText),
      severity: "critical",
    },
    {
      key: "politica_seguridad",
      label: "Politica de seguridad operacional",
      test: /politica de seguridad operacional/.test(fullText),
      severity: "critical",
    },
    {
      key: "cultura_justa",
      label: "Cultura justa",
      test: /cultura justa/.test(fullText),
      severity: "high",
    },
    {
      key: "gestion_cambio",
      label: "Gestion del cambio",
      test: /gestion del cambio/.test(fullText),
      severity: "high",
    },
    {
      key: "indicadores_spi",
      label: "Indicadores SPI o SPT",
      test: /spi/.test(fullText) || /spt/.test(fullText),
      severity: "medium",
    },
    {
      key: "respuesta_emergencias",
      label: "Respuesta ante emergencias",
      test: /emergenc/.test(fullText),
      severity: "high",
    },
    {
      key: "analisis_gap",
      label: "Analisis GAP o brechas",
      test: /analisis gap/.test(fullText) || /analisis de brechas/.test(fullText),
      severity: "medium",
    },
    {
      key: "sin_mcm",
      label: "Sin contenido MCM o mantenimiento dominante",
      test: !/manual del control del mantenimiento/.test(fullText) && !/programa de mantenimiento/.test(fullText),
      severity: "critical",
    },
    {
      key: "sin_por_definir_excesivo",
      label: "Sin exceso de POR DEFINIR",
      test: (fullText.match(/\[por definir\]/g) || []).length <= 12,
      severity: "medium",
    },
  ];

  const items = rules.map((rule) => ({
    key: rule.key,
    label: rule.label,
    severity: rule.severity,
    status: rule.test ? "pass" : "fail",
  }));

  const passed = items.filter((item) => item.status === "pass").length;
  const total = items.length;
  const score = Math.round((passed / total) * 100);
  const canDownload = items.every(
    (item) => item.status === "pass" || !["critical", "high"].includes(item.severity)
  );

  return {
    score,
    passed,
    total,
    canDownload,
    summary:
      canDownload
        ? "El manual cumple los criterios minimos de verificacion automatica."
        : "El manual presenta hallazgos relevantes frente a la circular informativa base.",
    items,
  };
};

module.exports = {
  buildSmsValidationReport,
};
