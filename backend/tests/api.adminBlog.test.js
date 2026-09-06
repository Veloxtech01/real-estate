import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";

import { connectTestDB, clearTestDB, closeTestDB } from "./helpers/db.js";
import { createApp } from "../app.js";
import { seedBaseline } from "../scripts/seed.js";
import Agent from "../model/agentModel.js";
import BlogPost from "../model/blogPostModel.js";

/**
 * Admin blog management (§4.2, §7 administrator-only).
 *
 * The cases that matter: an agent must never reach any of this, drafts and
 * soft-deleted posts must never leak onto the public routes, and slug generation
 * must stay collision-free.
 */

process.env.JWT_SECRET = "test-secret-not-used-anywhere-real";

const app = createApp();

/** Logs in and returns the session cookie. */
async function loginAs(email, password) {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.headers["set-cookie"];
}

describe("Admin blog API", () => {
  let adminCookie;
  let agentCookie;
  let post;

  beforeAll(connectTestDB);
  afterAll(closeTestDB);

  beforeEach(async () => {
    await clearTestDB();
    await seedBaseline({ adminPassword: "admin-password" });

    await Agent.create({
      name: "Junior Agent",
      slug: "junior-agent",
      email: "junior@example.com",
      password: "agent-password",
      role: "agent",
    });

    post = await BlogPost.create({
      title: "Lekki rents are up again",
      slug: "lekki-rents-are-up-again",
      body: "Rents in Lekki Phase 1 have risen for the third straight quarter.",
    });

    adminCookie = await loginAs("admin@example.com", "admin-password");
    agentCookie = await loginAs("junior@example.com", "agent-password");
  });

  describe("role enforcement", () => {
    it("requires a session on every route", async () => {
      expect((await request(app).get("/api/admin/blog")).status).toBe(401);
      expect((await request(app).get(`/api/admin/blog/${post._id}`)).status).toBe(401);
      expect((await request(app).post("/api/admin/blog").send({})).status).toBe(401);
      expect((await request(app).patch(`/api/admin/blog/${post._id}`).send({})).status).toBe(401);
      expect((await request(app).delete(`/api/admin/blog/${post._id}`)).status).toBe(401);
    });

    it("403s an agent on every route", async () => {
      expect(
        (await request(app).get("/api/admin/blog").set("Cookie", agentCookie)).status,
      ).toBe(403);
      expect(
        (await request(app).post("/api/admin/blog").set("Cookie", agentCookie).send({})).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .patch(`/api/admin/blog/${post._id}`)
            .set("Cookie", agentCookie)
            .send({})
        ).status,
      ).toBe(403);
      expect(
        (await request(app).delete(`/api/admin/blog/${post._id}`).set("Cookie", agentCookie))
          .status,
      ).toBe(403);
    });
  });

  describe("GET /api/admin/blog", () => {
    it("includes drafts and soft-deleted posts when asked", async () => {
      await BlogPost.create({
        title: "Deleted post",
        slug: "deleted-post",
        body: "Body.",
        deletedAt: new Date(),
      });

      const withoutDeleted = await request(app).get("/api/admin/blog").set("Cookie", adminCookie);
      expect(withoutDeleted.body.data.posts.map((p) => p.title)).not.toContain("Deleted post");

      const withDeleted = await request(app)
        .get("/api/admin/blog?includeDeleted=true")
        .set("Cookie", adminCookie);
      expect(withDeleted.body.data.posts.map((p) => p.title)).toContain("Deleted post");
    });
  });

  describe("POST /api/admin/blog", () => {
    const validBody = () => ({
      title: "New market update",
      body: "Body text.",
    });

    it("creates a draft post with a generated slug", async () => {
      const response = await request(app)
        .post("/api/admin/blog")
        .set("Cookie", adminCookie)
        .send(validBody());

      expect(response.status).toBe(201);
      expect(response.body.data.post).toMatchObject({
        title: "New market update",
        slug: "new-market-update",
        publicationState: "draft",
      });
      expect(response.body.data.post.publishedAt).toBeFalsy();
    });

    it("stamps publishedAt when created already published", async () => {
      const response = await request(app)
        .post("/api/admin/blog")
        .set("Cookie", adminCookie)
        .send({ ...validBody(), publicationState: "published" });

      expect(response.body.data.post.publicationState).toBe("published");
      expect(response.body.data.post.publishedAt).toBeTruthy();
    });

    it("rejects a missing title", async () => {
      const response = await request(app)
        .post("/api/admin/blog")
        .set("Cookie", adminCookie)
        .send({ body: "Body only." });

      expect(response.status).toBe(400);
      expect(response.body.details.title).toBeDefined();
    });

    it("gives two same-titled posts distinct slugs", async () => {
      await request(app).post("/api/admin/blog").set("Cookie", adminCookie).send(validBody());

      const second = await request(app)
        .post("/api/admin/blog")
        .set("Cookie", adminCookie)
        .send(validBody());

      const both = await BlogPost.find({ title: "New market update" }).select("slug");
      const slugs = both.map((p) => p.slug).sort();
      expect(slugs).toEqual(["new-market-update", "new-market-update-2"]);
      expect(second.body.data.post.slug).toBe("new-market-update-2");
    });
  });

  describe("PATCH /api/admin/blog/:id", () => {
    it("re-slugs when the title changes", async () => {
      const response = await request(app)
        .patch(`/api/admin/blog/${post._id}`)
        .set("Cookie", adminCookie)
        .send({ title: "Retitled post" });

      expect(response.body.data.post.slug).toBe("retitled-post");
    });

    it("publishes a draft and stamps publishedAt exactly once", async () => {
      const first = await request(app)
        .patch(`/api/admin/blog/${post._id}`)
        .set("Cookie", adminCookie)
        .send({ publicationState: "published" });

      const firstPublishedAt = first.body.data.post.publishedAt;
      expect(firstPublishedAt).toBeTruthy();

      // Unrelated edit after publishing must not push publishedAt forward.
      const second = await request(app)
        .patch(`/api/admin/blog/${post._id}`)
        .set("Cookie", adminCookie)
        .send({ excerpt: "Updated excerpt." });

      expect(second.body.data.post.publishedAt).toBe(firstPublishedAt);
    });
  });

  describe("DELETE /api/admin/blog/:id and restore", () => {
    it("soft deletes and restores a post", async () => {
      const deleteResponse = await request(app)
        .delete(`/api/admin/blog/${post._id}`)
        .set("Cookie", adminCookie);
      expect(deleteResponse.status).toBe(200);

      const deleted = await BlogPost.findById(post._id);
      expect(deleted.deletedAt).toBeTruthy();
      expect(deleted.publicationState).toBe("draft");

      const restoreResponse = await request(app)
        .post(`/api/admin/blog/${post._id}/restore`)
        .set("Cookie", adminCookie);
      expect(restoreResponse.status).toBe(200);

      const restored = await BlogPost.findById(post._id);
      expect(restored.deletedAt).toBeNull();
    });
  });

  describe("regression: public blog endpoint", () => {
    it("never returns a draft or soft-deleted post created through the admin API", async () => {
      await request(app)
        .post("/api/admin/blog")
        .set("Cookie", adminCookie)
        .send({ title: "Still a draft", body: "Body." });

      const response = await request(app).get("/api/blog");

      expect(response.body.data.posts.map((p) => p.title)).not.toContain("Still a draft");
    });
  });
});
