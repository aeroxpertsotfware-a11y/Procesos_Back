const ActivationCode = require("../models/ActivationCode");

const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const DEFAULT_LENGTH = 10;

const randomCode = (length = DEFAULT_LENGTH) => {
  let output = "";
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * CODE_ALPHABET.length);
    output += CODE_ALPHABET[index];
  }
  return output;
};

const generateUniqueActivationCode = async () => {
  let attempts = 0;
  while (attempts < 20) {
    const code = randomCode(10 + Math.floor(Math.random() * 3));
    // eslint-disable-next-line no-await-in-loop
    const exists = await ActivationCode.exists({ code });
    if (!exists) {
      return code;
    }
    attempts += 1;
  }

  throw new Error("No fue posible generar un codigo unico");
};

module.exports = {
  generateUniqueActivationCode,
};
