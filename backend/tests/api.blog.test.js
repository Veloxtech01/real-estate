import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import request from "supertest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import BlogPost from "../model/blogPostModel.js";

/**
 * Public blog API (§4.1) — the index and individual post pages.
 *
 * Each test creates its own posts for isolation, same style as api.agent.test.js
 * and api.testimonial.test.js.
 */
describe("Public blog API", () => {
  const app = createApp();

  beforeAll(connectTestDB);
  afterEach(clearTestDB);
  afterAll(closeTestDB);

  /** Creates a published post with sane defaults, overridable per test. */
  async function createPost(overrides = {}) {
    return BlogPost.create({
      title: "Lekki rents are up again",
      slug: "lekki-rents-are-up-again",
      excerpt: "A look at the numbers.",
      body: "Rents in Lekki Phase 1 have risen for the third straight quarter.",
      publicationState: "published",
      publishedAt: new Date(),
      ...overrides,
    });
  }

  it("lists only published, non-deleted posts, newest first", async () => {
    await createPost({
      title: "Oldest",
      slug: "oldest",
      publishedAt: new Date("2026-01-01"),
    });
    await createPost({
      title: "Newest",
      slug: "newest",
      publishedAt: new Date("2026-03-01"),
    });
    await createPost({ title: "Draft", slug: "draft", publicationState: "draft" });
    await createPost({
      title: "Deleted",
      slug: "deleted",
      deletedAt: new Date(),
    });

    const response = await request(app).get("/api/blog");

    expect(response.status).toBe(200);
    expect(response.body.data.posts.map((p) => p.title)).toEqual(["Newest", "Oldest"]);
  });

  it("paginates with ?page and ?limit", async () => {
    await createPost({ title: "A", slug: "a" });
    await createPost({ title: "B", slug: "b" });
    await createPost({ title: "C", slug: "c" });

    const response = await request(app).get("/api/blog?limit=2&page=1");

    expect(response.body.data.posts).toHaveLength(2);
    expect(response.body.data.pagination).toMatchObject({ page: 1, limit: 2, total: 3, pages: 2 });
  });

  it("returns one post by slug with its body", async () => {
    await createPost();

    const response = await request(app).get("/api/blog/lekki-rents-are-up-again");

    expect(response.status).toBe(200);
    expect(response.body.data.post).toMatchObject({
      title: "Lekki rents are up again",
      body: "Rents in Lekki Phase 1 have risen for the third straight quarter.",
    });
  });

  it("404s identically for a draft, a soft-deleted post, and an unknown slug", async () => {
    await createPost({ title: "Draft", slug: "draft-post", publicationState: "draft" });
    await createPost({
      title: "Deleted",
      slug: "deleted-post",
      deletedAt: new Date(),
    });

    const draftResponse = await request(app).get("/api/blog/draft-post");
    const deletedResponse = await request(app).get("/api/blog/deleted-post");
    const unknownResponse = await request(app).get("/api/blog/does-not-exist");

    expect(draftResponse.status).toBe(404);
    expect(deletedResponse.status).toBe(404);
    expect(unknownResponse.status).toBe(404);
  });
});
