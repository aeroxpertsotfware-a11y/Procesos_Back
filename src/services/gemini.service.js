const { GoogleGenerativeAI } = require("@google/generative-ai");

const recommendedModel = "gemini-1.5-flash";
const fallbackModels = ["gemini-1.5-flash-latest", "gemini-2.0-flash", "gemini-2.0-flash-exp"];
const DEFAULT_TIMEOUT_MS = Number(
  process.env.LLM_TIMEOUT_MS || process.env.GEMINI_TIMEOUT_MS || 180000
);
const DEFAULT_RETRIES = Number(
  process.env.LLM_RETRIES || process.env.GEMINI_RETRIES || 3
);
const OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENAI_FALLBACK_MODELS = ["gpt-4.1-mini"];

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta GEMINI_API_KEY en variables de entorno");
  }

  return new GoogleGenerativeAI(apiKey);
};

const getProvider = () => String(process.env.LLM_PROVIDER || "gemini").trim().toLowerCase();

const getOpenAIApiKey = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY en variables de entorno");
  }

  return apiKey;
};

const getOpenAIModels = () => {
  const primary = String(process.env.OPENAI_MODEL || "gpt-4.1-mini").trim();
  return [primary, ...OPENAI_FALLBACK_MODELS.filter((model) => model !== primary)];
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async (promise, timeoutMs) => {
  let timer = null;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("La IA tardó demasiado en responder. Intenta nuevamente.")),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const isRetryableError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("deadline") ||
    message.includes("timed out") ||
    message.includes("429") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("rate limit") ||
    message.includes("unavailable")
  );
};

const buildChapterPrompt = ({
  manualKey,
  chapter,
  context = {},
  globalInstructions = [],
  referenceText = "",
}) => {
  const instructions = Array.isArray(chapter?.instructions) ? chapter.instructions : [];
  const globalRules = Array.isArray(globalInstructions) ? globalInstructions : [];
  const objective = String(chapter?.objective || "").trim() || "No definido";
  const targetWords = chapter?.targetWords ? String(chapter.targetWords) : "Sin objetivo fijo";
  const minWords = chapter?.minWords ? String(chapter.minWords) : "Sin minimo";
  const maxWords = chapter?.maxWords ? String(chapter.maxWords) : "Sin maximo";
  const empresa = String(context?.empresa || "").trim() || "[POR DEFINIR]";
  const nit = String(context?.nit || "").trim() || "[POR DEFINIR]";
  const nombreSolicitante = String(context?.nombreSolicitante || "").trim() || empresa;
  const tipoOperacion = String(context?.tipoOperacion || "").trim() || "Operacion UAS en categoria especifica";
  const ciudad = String(context?.ciudad || "").trim() || "la zona de operacion autorizada";
  const departamento = String(context?.departamento || "").trim() || "la jurisdiccion aplicable";
  const contactoVisual = String(context?.contactoVisual || "").trim() || "VLOS o la modalidad autorizada";
  const tipoSolicitud = String(context?.tipoSolicitud || "").trim() || "certificacion inicial";

  return [
    "Eres un redactor tecnico senior especializado en manuales aeronauticos en espanol para explotadores UAS.",
    `Genera el contenido del manual "${manualKey}" exclusivamente para el capitulo solicitado.`,
    "Debes redactar un MANUAL SMS, no un manual de mantenimiento, no un MCM, no un MO y no un documento generico de operaciones.",
    "Esta prohibido escribir contenido de control de mantenimiento, mantenimiento preventivo, mantenimiento correctivo, programa de mantenimiento, ATA 100, factores humanos de mantenimiento o listas de tareas tecnicas propias del MCM.",
    "No inventes normativa especifica, numerales exactos ni datos regulatorios falsos.",
    "Usa [POR DEFINIR] solo para datos identificatorios o aprobaciones que realmente no existan. Para el resto, redacta de forma generica valida para un explotador UAS.",
    "Escribe en tono formal, tecnico, institucional y estructurado.",
    "La salida debe verse como una seccion final de manual lista para pegar en Word.",
    "Cada capitulo debe incluir titulo principal y subtitulos numerados obligatorios cuando asi se indique.",
    "No uses markdown.",
    "No uses literales a), b), c), d) ni formatos similares en el contenido final.",
    "Cuando necesites listar elementos, usa viñetas con punto y deja cada elemento en su propia linea.",
    "No conviertas los subtitulos en listas. Los subtitulos deben quedar como texto normal numerado, por ejemplo 2.1, 2.2, 2.3.",
    "La profundidad maxima permitida es de tres niveles: 2, 2.1 y 2.1.1. Esta prohibido usar 2.1.2.1, 2.2.3.4 o cualquier cuarto nivel.",
    "Despues de un subtitulo como 2.1.1 debe venir un parrafo o, si aplica, frases cortas separadas por punto y aparte, no una cascada de nuevos numerales consecutivos.",
    "Evita repetir [POR DEFINIR]. Si un dato no critico falta, escribe una formulacion general valida para un explotador UAS.",
    "No agregues introducciones meta, notas al modelo, advertencias ni explicaciones fuera del contenido final del capitulo.",
    "",
    "Contexto disponible de la empresa:",
    `- Empresa: ${empresa}`,
    `- NIT: ${nit}`,
    `- Responsable solicitante: ${nombreSolicitante}`,
    `- Tipo de operacion: ${tipoOperacion}`,
    `- Ciudad: ${ciudad}`,
    `- Departamento: ${departamento}`,
    `- Tipo de contacto visual: ${contactoVisual}`,
    `- Tipo de solicitud: ${tipoSolicitud}`,
    "",
    "Reglas globales del manual:",
    globalRules.length
      ? globalRules.map((item, index) => `${index + 1}. ${item}`).join("\n")
      : "1. Mantener coherencia tecnica del SMS.",
    referenceText
      ? `\n\nReferencia doctrinal base:\n${referenceText}\n\nConvierte esta referencia en contenido de manual institucional. No la copies literalmente ni la cites como circular.`
      : "",
    "",
    `Titulo del capitulo: ${chapter?.title || "Sin titulo"}`,
    `Objetivo del capitulo: ${objective}`,
    `Palabras objetivo: ${targetWords}`,
    `Minimo aproximado: ${minWords}`,
    `Maximo aproximado: ${maxWords}`,
    "",
    "Instrucciones obligatorias del capitulo:",
    instructions.length
      ? instructions.map((item, index) => `${index + 1}. ${item}`).join("\n")
      : "1. Desarrollar el contenido tecnico solicitado.",
    "",
    "Validaciones finales obligatorias antes de responder:",
    "1. Verifica que el contenido trate realmente de SMS y no de mantenimiento.",
    "2. Verifica que la numeracion interna siga el esquema pedido para este capitulo.",
    "3. Verifica que no aparezcan encabezados ajenos como MCM, mantenimiento, aeronavegabilidad o programa de mantenimiento, salvo menciones de interfaz si el capitulo lo requiere.",
    "4. Verifica que el texto quede listo para insertarse directamente en Word.",
    "5. Verifica que no existan bullets decorativos o markdown en la respuesta.",
    "",
    "Entrega unicamente el contenido del capitulo listo para insertarse en un documento Word.",
  ].join("\n");
};

const normalizeGeneratedContent = (content) => {
  let normalized = String(content || "");

  normalized = normalized.replace(/\r\n/g, "\n");
  normalized = normalized.replace(/^\s*[-*]\s+/gm, "• ");
  normalized = normalized.replace(/^\s*\d+\.\s+(?=\d+\.)/gm, "");
  normalized = normalized.replace(/(\b\d+\.\d+\.\d+)\.\d+\b/g, "$1");
  normalized = normalized.replace(/([^\n])(\d+\.\d+(?:\.\d+)?\s+[A-ZÁÉÍÓÚÑ])/g, "$1\n\n$2");
  normalized = normalized.replace(/([^\n])((?:Anexo\s+[A-Z]\.|B\.\d+|A\.\d+)\s+[A-ZÁÉÍÓÚÑ])/g, "$1\n\n$2");
  normalized = normalized.replace(/^\s*[a-z]\)\s+/gim, "• ");
  normalized = normalized.replace(/([^\n])\s+([a-z]\)\s+)/gim, "$1\n$2");
  normalized = normalized.replace(/\*\*(.*?)\*\*/g, "$1");
  normalized = normalized.replace(/__(.*?)__/g, "$1");
  normalized = normalized.replace(/\n{3,}/g, "\n\n");

  return normalized.trim();
};

const runPromptWithGemini = async (prompt) => {
  const client = getGeminiClient();
  const candidates = [process.env.GEMINI_MODEL || recommendedModel, ...fallbackModels];
  let lastError = null;

  for (const modelName of candidates) {
    for (let attempt = 0; attempt <= DEFAULT_RETRIES; attempt += 1) {
      try {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            maxOutputTokens: 8192,
          },
        });
        const result = await withTimeout(model.generateContent(String(prompt)), DEFAULT_TIMEOUT_MS);
        const response = result.response;
        return normalizeGeneratedContent(response.text());
      } catch (error) {
        lastError = error;
        const message = String(error?.message || "");
        const isModelNotFound = message.includes("is not found") || message.includes("[404 Not Found]");
        if (isModelNotFound) {
          break;
        }

        if (!isRetryableError(error) || attempt === DEFAULT_RETRIES) {
          throw error;
        }

        await wait(800 * (attempt + 1));
      }
    }
  }

  throw lastError || new Error("No fue posible resolver un modelo Gemini compatible");
};

const runPromptWithOpenAI = async (prompt) => {
  const apiKey = getOpenAIApiKey();
  let lastError = null;

  for (const model of getOpenAIModels()) {
    for (let attempt = 0; attempt <= DEFAULT_RETRIES; attempt += 1) {
      try {
        const response = await withTimeout(
          fetch(`${OPENAI_BASE_URL}/responses`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              input: String(prompt),
            }),
          }),
          DEFAULT_TIMEOUT_MS
        );

        if (!response.ok) {
          const errorPayload = await response.text().catch(() => "");
          throw new Error(`OpenAI ${response.status}: ${errorPayload || response.statusText}`);
        }

        const payload = await response.json();
        const text =
          payload?.output_text ||
          payload?.output
            ?.flatMap((item) => item?.content || [])
            .find((item) => item?.type === "output_text")?.text ||
          "";

        if (!String(text || "").trim()) {
          throw new Error("OpenAI no devolvio contenido para el capitulo");
        }

        return normalizeGeneratedContent(String(text));
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error) || attempt === DEFAULT_RETRIES) {
          break;
        }

        await wait(1200 * (attempt + 1));
      }
    }
  }

  throw lastError || new Error("No fue posible generar contenido con OpenAI");
};

const runPrompt = async (prompt) => {
  const provider = getProvider();

  if (provider === "openai") {
    return runPromptWithOpenAI(prompt);
  }

  if (provider === "gemini") {
    return runPromptWithGemini(prompt);
  }

  throw new Error(`Proveedor LLM no soportado: ${provider}`);
};

const testConnection = async () => {
  return runPrompt("Responde solo con: OK");
};

const generateChapter = async ({ prompt, ...chapterPayload }) => {
  let finalPrompt = String(prompt || "").trim();

  if (!finalPrompt) {
    finalPrompt = buildChapterPrompt(chapterPayload || {});
  }

  if (!finalPrompt) {
    throw new Error("Prompt vacio");
  }

  return runPrompt(finalPrompt);
};

module.exports = {
  buildChapterPrompt,
  normalizeGeneratedContent,
  testConnection,
  generateChapter,
};
