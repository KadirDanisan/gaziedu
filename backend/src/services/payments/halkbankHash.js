import crypto from "node:crypto";

/**
 * NestPay ver3 hash: parametre adları büyük/küçük harf duyarsız doğal sırayla dizilir,
 * değerlerde "\" → "\\" ve "|" → "\|" kaçışı yapılır, "|" ile birleştirilip sonuna
 * kaçışlı StoreKey eklenir; SHA-512 özetinin Base64 hali alınır.
 * İstek ve yanıt hash'i aynı kuralla hesaplanır; yalnızca hariç tutulan alanlar farklıdır.
 */

const REQUEST_EXCLUDED = new Set(["hash", "encoding"]);
const RESPONSE_EXCLUDED = new Set(["hash", "encoding", "countdown"]);

const escapeValue = (value) => String(value ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|");

/** PHP natcasesort ile uyumlu doğal sıralama (büyük/küçük harf duyarsız). */
const naturalCaseCompare = (a, b) => {
  const ax = String(a).toLowerCase().match(/\d+|\D+/g) || [];
  const bx = String(b).toLowerCase().match(/\d+|\D+/g) || [];
  for (let i = 0; i < Math.min(ax.length, bx.length); i += 1) {
    const x = ax[i];
    const y = bx[i];
    if (x === y) continue;
    const xNum = /^\d+$/.test(x);
    const yNum = /^\d+$/.test(y);
    if (xNum && yNum) return Number(x) - Number(y);
    return x < y ? -1 : 1;
  }
  return ax.length - bx.length;
};

const computeHash = (params, storeKey, excluded) => {
  const keys = Object.keys(params)
    .filter((key) => !excluded.has(key.toLowerCase()))
    .sort(naturalCaseCompare);
  const plain = `${keys.map((key) => escapeValue(params[key])).join("|")}|${escapeValue(storeKey)}`;
  return crypto.createHash("sha512").update(plain, "utf8").digest("base64");
};

export const computeRequestHash = (fields, storeKey) => computeHash(fields, storeKey, REQUEST_EXCLUDED);

export const verifyResponseHash = (body, storeKey) => {
  const received = String(body?.HASH ?? body?.hash ?? "");
  if (!received || !storeKey) return false;
  const expected = computeHash(body, storeKey, RESPONSE_EXCLUDED);
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
