import "dotenv/config";

import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

import { connectDB, disconnectDB } from "../config/db.js";
import logger from "../utils/logger.js";
import { slugify } from "../utils/slugify.js";

import Agent from "../model/agentModel.js";
import Location from "../model/locationModel.js";
import LocationAlias from "../model/locationAliasModel.js";
import Taxonomy from "../model/taxonomyModel.js";
import Page from "../model/pageModel.js";
import Settings from "../model/settingsModel.js";
import Property from "../model/propertyModel.js";
import PropertyMedia from "../model/propertyMediaModel.js";

import {
  TAXONOMY_SEED,
  LOCATION_SEED,
  LOCATION_ALIAS_SEED,
  PAGE_SEED,
  SETTINGS_SEED,
} from "./seedData.js";
import { importDemoListings } from "./importDemoListings.js";

/**
 * Seed script — provisions a client copy with default pages, taxonomy, location data
 * and placeholder content in minutes (§9).
 *
 * Usage (from /backend):
 *   npm run seed              baseline only — what a real client copy needs
 *   npm run seed -- --demo    baseline + the 200 sample listings (development only)
 *   npm run seed -- --reset   wipe seeded collections first (refuses in production)
 *
 * Idempotent by default: re-running without --reset upserts rather than duplicating,
 * so it is safe to run again after adding a location or a page.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sample data lives at the repo root, outside the backend package — it is a
// development artefact, not part of the deployable API.
const DEFAULT_DEMO_FILE = path.resolve(
  __dirname,
  "../../nigerian_real_estate_dummy_data_200.json"
);

/**
 * Wipes every collection this script populates.
 *
 * Takes: nothing.
 * Returns: a promise resolving once the collections are empty.
 * Throws: when NODE_ENV is production — a seed script must never be the thing that
 *         empties a live agency's listings.
 */
export async function resetCollections() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset seeded collections in production");
  }

  logger.warn("Resetting seeded collections");

  await Promise.all([
    Agent.deleteMany({}),
    Location.deleteMany({}),
    LocationAlias.deleteMany({}),
    Taxonomy.deleteMany({}),
    Page.deleteMany({}),
    Settings.deleteMany({}),
    Property.deleteMany({}),
    PropertyMedia.deleteMany({}),
  ]);
}

/**
 * Seeds the taxonomy vocabulary.
 *
 * Takes: nothing.
 * Returns: a promise resolving to the number of terms upserted.
 */
export async function seedTaxonomy() {
  // Upsert on the stable key so re-running never duplicates a term, and an edited
  // label in the admin panel isn't clobbered by a name that hasn't changed.
  await Promise.all(
    TAXONOMY_SEED.map((term, index) =>
      Taxonomy.updateOne(
        { key: term.key },
        { $setOnInsert: { ...term, displayOrder: index } },
        { upsert: true }
      )
    )
  );

  return TAXONOMY_SEED.length;
}

/**
 * Seeds canonical locations and their aliases.
 *
 * Takes: nothing.
 * Returns: a promise resolving to { locations, aliases } counts.
 */
export async function seedLocations() {
  await Promise.all(
    LOCATION_SEED.map((location) =>
      Location.updateOne(
        { slug: slugify(`${location.name}-${location.state}`) },
        {
          $setOnInsert: {
            // Area pages start unpublished by default — they need client copy before
            // they are worth anything to organic search. A handful of LOCATION_SEED
            // entries set isPublished: true themselves, with real copy attached; the
            // spread below lets those win over this default.
            isPublished: false,
            ...location,
            slug: slugify(`${location.name}-${location.state}`),
          },
        },
        { upsert: true }
      )
    )
  );

  const locations = await Location.find({});
  const byName = new Map(locations.map((l) => [l.name.toLowerCase(), l._id]));

  // Aliases whose target location isn't seeded are skipped rather than pointing at
  // nothing — a dangling alias would silently resolve searches to nowhere.
  const aliases = LOCATION_ALIAS_SEED.filter((entry) =>
    byName.has(entry.location.toLowerCase())
  );

  await Promise.all(
    aliases.map((entry) =>
      LocationAlias.updateOne(
        { alias: entry.alias },
        { $setOnInsert: { alias: entry.alias, location: byName.get(entry.location.toLowerCase()) } },
        { upsert: true }
      )
    )
  );

  return { locations: LOCATION_SEED.length, aliases: aliases.length };
}

/**
 * Seeds the default pages.
 *
 * Takes: nothing.
 * Returns: a promise resolving to the number of pages upserted.
 */
export async function seedPages() {
  // $setOnInsert only: re-running the seed must never overwrite copy the client has
  // already edited, which is the whole point of content living in the database (§9).
  await Promise.all(
    PAGE_SEED.map((page) =>
      Page.updateOne({ key: page.key }, { $setOnInsert: page }, { upsert: true })
    )
  );

  return PAGE_SEED.length;
}

/**
 * Seeds the settings singleton.
 *
 * Takes: nothing.
 * Returns: a promise resolving to the Settings document.
 */
export async function seedSettings() {
  const settings = await Settings.get();

  // Only fill in a fresh install — never reset a client's configured branding.
  if (settings.agencyName === "Untitled Agency") {
    settings.set(SETTINGS_SEED);
    await settings.save();
  }

  return settings;
}

/**
 * Creates the initial administrator account.
 *
 * Takes: password (string).
 * Returns: a promise resolving to { created, email }.
 *
 * The password is never hardcoded: it comes from SEED_ADMIN_PASSWORD, or is randomly
 * generated and printed once. A committed default password is a live credential on
 * every client copy that forgets to change it.
 */
export async function seedAdmin(password) {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@example.com").toLowerCase();

  const existing = await Agent.findOne({ email });
  if (existing) return { created: false, email };

  await Agent.create({
    name: process.env.SEED_ADMIN_NAME || "Site Administrator",
    slug: "site-administrator",
    email,
    password,
    role: "administrator",
    // Administrators publish directly by definition; the §7 approval question only
    // concerns agents.
    canPublish: true,
    isPublic: false,
  });

  return { created: true, email };
}

/**
 * Seeds the baseline content a client copy needs.
 *
 * Assumes a connection is already open, so tests can call it against an in-memory
 * database without the CLI's connection handling.
 *
 * Takes: options — { adminPassword }.
 * Returns: a promise resolving to a summary of what was seeded.
 */
export async function seedBaseline({ adminPassword }) {
  const taxonomy = await seedTaxonomy();
  const { locations, aliases } = await seedLocations();
  const pages = await seedPages();
  await seedSettings();
  const admin = await seedAdmin(adminPassword);

  return { taxonomy, locations, aliases, pages, admin };
}

/**
 * CLI entry point.
 *
 * Takes: nothing — reads flags from process.argv.
 * Returns: nothing; sets a non-zero exit code on failure.
 */
async function run() {
  const args = process.argv.slice(2);
  const withDemo = args.includes("--demo");
  const withReset = args.includes("--reset");

  if (!process.env.MONGODB_URI) {
    logger.error("MONGODB_URI is not set — nothing to seed into.");
    process.exit(1);
  }

  // Generated rather than defaulted, so no copy of this repo ships with a known
  // administrator password.
  const generatedPassword = randomBytes(12).toString("base64url");
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || generatedPassword;

  try {
    await connectDB();

    if (withReset) await resetCollections();

    const summary = await seedBaseline({ adminPassword });

    logger.info(
      `Seeded: ${summary.taxonomy} taxonomy terms, ${summary.locations} locations, ` +
        `${summary.aliases} aliases, ${summary.pages} pages, settings`
    );

    if (summary.admin.created) {
      logger.info(`Administrator created: ${summary.admin.email}`);

      // Printed once, and only when we generated it — there is no other way for the
      // operator to learn it, and it is not stored anywhere in plaintext.
      if (!process.env.SEED_ADMIN_PASSWORD) {
        logger.warn(`Generated administrator password: ${generatedPassword}`);
        logger.warn("Save it now — it is not recoverable and will not be shown again.");
      }
    } else {
      logger.info(`Administrator already exists: ${summary.admin.email} (left unchanged)`);
    }

    if (withDemo) {
      const demoFile = process.env.DEMO_DATA_FILE || DEFAULT_DEMO_FILE;
      const result = await importDemoListings({
        filePath: demoFile,
        demoPassword: adminPassword,
      });

      logger.info(
        `Demo data: ${result.properties} properties, ${result.media} media, ${result.agents} demo agents`
      );
      logger.warn("Demo listings are development data — do not run --demo for a client.");
    }
  } catch (error) {
    logger.error(`Seed failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    // Always close, or the script hangs with an open connection.
    await disconnectDB();
    await mongoose.disconnect();
  }
}

// Only run when invoked directly (`npm run seed`), so importing this module in a
// test doesn't kick off a real seed against whatever MONGODB_URI happens to be set.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
