"use client";

import { createUploadSignature, registerMedia } from "@/lib/api/admin";

/**
 * Takes a File from the browser to a registered PropertyMedia record.
 *
 * The image goes straight to Cloudinary rather than through our API (scope §10.3):
 * agents upload 8MB phone photos over connections that drop, and proxying would cross
 * the network twice for no benefit. Our API only issues the signature and, afterwards,
 * verifies the result.
 */

/**
 * Largest file accepted.
 *
 * Chosen to sit under Cloudinary's 20MB single-request limit, which is why there is no
 * chunked/resumable path here: a `Content-Range` branch that never executes is a
 * branch that is never right. If this ceiling is ever raised past 20MB, that is when
 * chunking gets written — and tested.
 */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** Mirrors the server's signed `allowed_formats`; Cloudinary rejects anything else. */
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * POSTs a FormData to Cloudinary with upload progress.
 *
 * XMLHttpRequest rather than fetch: fetch has no request-progress event, and an 8MB
 * photo on a slow connection with no progress bar looks frozen.
 *
 * Takes: url (string), form (FormData), onProgress (function|undefined),
 *        signal (AbortSignal|undefined).
 * Returns: a promise resolving to Cloudinary's parsed response.
 * Throws: an Error carrying Cloudinary's own message where it gave one.
 */
function postToCloudinary(url, form, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", url);

    // Only fires while the body is being sent, which is the part that takes time.
    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      let body = null;

      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // Left null — handled by the status check below.
      }

      if (xhr.status >= 200 && xhr.status < 300 && body) {
        resolve(body);
        return;
      }

      reject(new Error(body?.error?.message ?? "The upload failed. Please try again."));
    };

    xhr.onerror = () => reject(new Error("The upload failed. Please try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled"));

    signal?.addEventListener("abort", () => xhr.abort(), { once: true });

    xhr.send(form);
  });
}

/**
 * Uploads one image and registers it against a listing.
 *
 * Takes: propertyId (string), file (File), options — { onProgress, signal }.
 * Returns: a promise resolving to the created PropertyMedia record.
 * Throws: an Error with a message fit to show the user.
 */
export async function uploadPropertyImage(propertyId, file, options = {}) {
  const { onProgress, signal } = options;

  // Validated before the signature request, not after: that endpoint is rate-limited
  // server-side, and spending a call on an upload that cannot succeed eats the user's
  // budget for the ones that can.
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error(`${file.name} is not a JPG, PNG, WebP or AVIF image.`);
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const limitMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
    throw new Error(`${file.name} is too large — the limit is ${limitMb}MB.`);
  }

  const signature = await createUploadSignature(propertyId);

  const form = new FormData();

  // Exactly the parameters the server signed, and no others. Cloudinary recomputes
  // the signature over what it receives, so one extra or missing field fails every
  // upload with "Invalid Signature". Adding one here means adding it to
  // backend/utils/mediaSignature.js in the same change.
  form.append("file", file);
  form.append("api_key", signature.apiKey);
  form.append("timestamp", String(signature.timestamp));
  form.append("signature", signature.signature);
  form.append("folder", signature.folder);
  form.append("allowed_formats", signature.allowedFormats.join(","));
  form.append("eager", signature.eager);

  const uploaded = await postToCloudinary(
    signature.uploadUrl,
    form,
    onProgress,
    signal,
  );

  // Only after Cloudinary confirms. Registering first — or after a failure — would
  // write a database row pointing at an asset that does not exist.
  return registerMedia(propertyId, { publicId: uploaded.public_id });
}
