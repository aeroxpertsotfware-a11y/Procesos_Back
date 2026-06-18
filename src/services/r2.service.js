const { randomUUID } = require("crypto");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl: createSignedUrl } = require("@aws-sdk/s3-request-presigner");

const endpoint = process.env.R2_ENDPOINT || process.env.S3_ENDPOINT;
const bucket = process.env.R2_BUCKET || process.env.S3_BUCKET;
const accessKeyId = process.env.R2_ACCESS_KEY || process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_KEY || process.env.S3_SECRET_ACCESS_KEY;

const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true,
});

const sanitizeFileName = (fileName = "") =>
  fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const ensureConfig = () => {
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Configuracion R2 incompleta");
  }
};

const buildSafeFileName = (fileName = "", fallbackExtension = "bin") => {
  const safeFileName = sanitizeFileName(fileName);
  if (safeFileName) {
    return safeFileName;
  }

  return `${randomUUID()}.${fallbackExtension}`;
};

const uploadFile = async (buffer, fileName, contentType, customKey = "") => {
  ensureConfig();
  const safeFileName = buildSafeFileName(fileName, "pdf");
  const key =
    customKey || `certification-expedientes/${Date.now()}-${randomUUID()}-${safeFileName}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return { key };
};

const getSignedUrl = async (key) => {
  ensureConfig();
  if (!key) {
    return "";
  }

  return createSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn: 60 * 60 }
  );
};

const uploadBuffer = async (buffer, key, contentType) => {
  const fallbackName = String(key || "").split("/").pop() || "archivo.bin";
  return uploadFile(buffer, fallbackName, contentType, key);
};

const buildContentDisposition = (filename = "") => {
  if (!filename) {
    return "attachment";
  }

  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${filename}"; filename*=UTF-8''${encoded}`;
};

const getSignedDownloadUrl = async (key, filename = "") => {
  ensureConfig();
  if (!key) {
    return "";
  }

  return createSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: buildContentDisposition(filename),
    }),
    { expiresIn: 60 * 60 }
  );
};

const deleteFile = async (key) => {
  ensureConfig();
  if (!key) {
    return;
  }

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
};

module.exports = {
  buildSafeFileName,
  uploadFile,
  uploadBuffer,
  getSignedUrl,
  getSignedDownloadUrl,
  deleteFile,
};
