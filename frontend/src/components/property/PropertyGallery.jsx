"use client";

import { useState } from "react";
import Image from "next/image";
import { FiX, FiChevronLeft, FiChevronRight } from "react-icons/fi";

/**
 * Listing gallery with a lightbox.
 *
 * "No way to explore the property beyond one image" is a named anti-pattern for this
 * product type — a real gallery is a requirement, not a nicety.
 *
 * @param {Array<{_id:string,url:string,alt:string}>} images Ordered by displayOrder.
 * @param {string} title Used as fallback alt text.
 */
export default function PropertyGallery({ images = [], title }) {
  // null = lightbox closed; a number = the index being viewed.
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // A listing with no media still needs a hero area, handled by the caller.
  if (images.length === 0) return null;

  const [hero, ...rest] = images;
  const thumbs = rest.slice(0, 4);

  const move = (delta) => {
    setLightboxIndex((current) => (current + delta + images.length) % images.length);
  };

  return (
    <>
      {/* Hero image plus a thumbnail column on wide screens. */}
      <div className="grid gap-2 md:grid-cols-[2fr_1fr]">
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          className="relative aspect-[3/2] w-full cursor-pointer overflow-hidden rounded-lg bg-ink/5"
          aria-label="Open gallery"
        >
          <Image
            src={hero.url}
            alt={hero.alt || title}
            fill
            sizes="(min-width: 768px) 66vw, 100vw"
            // The hero is the page's largest contentful paint — load it eagerly.
            priority
            className="object-cover"
          />
        </button>

        {thumbs.length > 0 && (
          <div className="grid grid-cols-4 gap-2 md:grid-cols-1">
            {thumbs.map((image, index) => (
              <button
                key={image._id}
                type="button"
                onClick={() => setLightboxIndex(index + 1)}
                className="relative aspect-[3/2] cursor-pointer overflow-hidden rounded bg-ink/5"
                aria-label={`Open image ${index + 2}`}
              >
                <Image
                  src={image.url}
                  alt={image.alt || title}
                  fill
                  sizes="(min-width: 768px) 20vw, 25vw"
                  className="object-cover"
                />
                {/* The last thumbnail shows the remaining count rather than hiding it. */}
                {index === thumbs.length - 1 && images.length > 5 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/60 text-sm font-medium text-white">
                    +{images.length - 5}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-ink/95 p-4"
          style={{ zIndex: "var(--z-lightbox)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Property images"
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close gallery"
            className="absolute right-4 top-4 flex h-11 w-11 cursor-pointer items-center justify-center text-white"
          >
            <FiX size={24} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Previous image"
            className="absolute left-4 flex h-11 w-11 cursor-pointer items-center justify-center text-white"
          >
            <FiChevronLeft size={28} aria-hidden="true" />
          </button>

          <div className="relative h-[80vh] w-full max-w-5xl">
            <Image
              src={images[lightboxIndex].url}
              alt={images[lightboxIndex].alt || title}
              fill
              sizes="90vw"
              className="object-contain"
            />
          </div>

          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Next image"
            className="absolute right-4 flex h-11 w-11 cursor-pointer items-center justify-center text-white"
          >
            <FiChevronRight size={28} aria-hidden="true" />
          </button>

          <p className="tabular absolute bottom-6 text-sm text-white/70">
            {lightboxIndex + 1} / {images.length}
          </p>
        </div>
      )}
    </>
  );
}
