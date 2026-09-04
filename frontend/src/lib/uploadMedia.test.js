import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { uploadPropertyImage, MAX_UPLOAD_BYTES } from "./uploadMedia";
import * as admin from "./api/admin";

/**
 * The browser half of the upload.
 *
 * The order of operations is the whole point: a registration call that happens
 * before Cloudinary confirms, or after a failure, writes a database row pointing at
 * an asset that does not exist. XMLHttpRequest is stubbed because jsdom has no real
 * one and the upload never leaves the test.
 */

/** Minimal XHR double capturing what was sent and letting the test resolve it. */
class MockXHR {
  static instances = [];

  constructor() {
    this.upload = { onprogress: null };
    this.status = 0;
    this.responseText = "";
    this.onload = null;
    this.onerror = null;
    this.onabort = null;
    MockXHR.instances.push(this);
  }

  open(method, url) {
    this.method = method;
    this.url = url;
  }

  send(body) {
    this.body = body;
  }

  abort() {
    this.onabort?.();
  }

  /** Test helper: finish the request with a Cloudinary-shaped response. */
  succeed(payload) {
    this.status = 200;
    this.responseText = JSON.stringify(payload);
    this.onload?.();
  }

  /** Test helper: finish the request as a failure. */
  fail(status = 500) {
    this.status = status;
    this.responseText = JSON.stringify({ error: { message: "nope" } });
    this.onload?.();
  }
}

const signature = {
  timestamp: 1_700_000_000,
  signature: "sig-abc",
  apiKey: "test-key",
  cloudName: "test-cloud",
  folder: "properties/REF1042",
  uploadUrl: "https://api.cloudinary.com/v1_1/test-cloud/image/upload",
  allowedFormats: ["jpg", "jpeg", "png", "webp", "avif"],
  maxFileSize: 15 * 1024 * 1024,
  eager: "c_fill,w_400,h_300,q_auto,f_auto",
};

/** A File reporting `bytes` as its size, without allocating that much memory. */
function fakeFile(name = "house.jpg", type = "image/jpeg", bytes = 1024) {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

beforeEach(() => {
  MockXHR.instances = [];
  vi.stubGlobal("XMLHttpRequest", MockXHR);
  vi.spyOn(admin, "createUploadSignature").mockResolvedValue(signature);
  vi.spyOn(admin, "registerMedia").mockResolvedValue({
    _id: "m1",
    url: "https://res.cloudinary.com/test-cloud/image/upload/x.jpg",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("uploadPropertyImage", () => {
  it("requests a signature, uploads to Cloudinary, then registers the result", async () => {
    const promise = uploadPropertyImage("p1", fakeFile());

    // Let the signature request settle before the XHR exists.
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(1));

    const [xhr] = MockXHR.instances;
    expect(xhr.url).toBe(signature.uploadUrl);
    expect(admin.registerMedia).not.toHaveBeenCalled();

    xhr.succeed({ public_id: "properties/REF1042/abc123" });
    await promise;

    // The API is told only the public id — it re-reads everything else from
    // Cloudinary, so sending more would be pointless and misleading.
    expect(admin.registerMedia).toHaveBeenCalledWith("p1", {
      publicId: "properties/REF1042/abc123",
    });
  });

  it("sends exactly the signed parameters", async () => {
    const promise = uploadPropertyImage("p1", fakeFile());
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(1));

    const [xhr] = MockXHR.instances;
    const sent = [...xhr.body.keys()];

    // Cloudinary recomputes the signature over the params it receives. One extra
    // or missing field and every upload fails with "Invalid Signature".
    expect(sent.sort()).toEqual(
      [
        "allowed_formats",
        "api_key",
        "eager",
        "file",
        "folder",
        "signature",
        "timestamp",
      ].sort(),
    );
    expect(xhr.body.get("folder")).toBe(signature.folder);
    expect(xhr.body.get("signature")).toBe(signature.signature);

    xhr.succeed({ public_id: "properties/REF1042/abc123" });
    await promise;
  });

  it("reports progress", async () => {
    const onProgress = vi.fn();
    const promise = uploadPropertyImage("p1", fakeFile(), { onProgress });
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(1));

    const [xhr] = MockXHR.instances;
    xhr.upload.onprogress({ lengthComputable: true, loaded: 50, total: 200 });

    expect(onProgress).toHaveBeenCalledWith(25);

    xhr.succeed({ public_id: "properties/REF1042/abc123" });
    await promise;
  });

  it("does not register anything when the upload fails", async () => {
    const promise = uploadPropertyImage("p1", fakeFile());
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(1));

    MockXHR.instances[0].fail(500);

    await expect(promise).rejects.toThrow();
    // A row pointing at an asset that was never stored is worse than no row.
    expect(admin.registerMedia).not.toHaveBeenCalled();
  });

  it("rejects a file that is too large before asking for a signature", async () => {
    await expect(
      uploadPropertyImage(
        "p1",
        fakeFile("huge.jpg", "image/jpeg", MAX_UPLOAD_BYTES + 1),
      ),
    ).rejects.toThrow(/too large/i);

    // Requesting a signature costs a rate-limited call; a doomed upload must not
    // spend one.
    expect(admin.createUploadSignature).not.toHaveBeenCalled();
  });

  it("rejects a file type Cloudinary would refuse", async () => {
    await expect(
      uploadPropertyImage("p1", fakeFile("plan.pdf", "application/pdf")),
    ).rejects.toThrow(/JPG, PNG, WebP or AVIF/i);

    expect(admin.createUploadSignature).not.toHaveBeenCalled();
  });
});
