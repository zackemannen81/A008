import { PRODUCT_NAME, PRODUCT_TAGLINE } from "./identity.js";

/** A008-0037 product mark. Keep the BrandMark export. Product name is A008. */
export function BrandMark() {
  return (
    <span className="a008-brand" aria-label={PRODUCT_NAME}>
      <svg
        className="a008-brand-mark"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <rect
          x="2.5"
          y="2.5"
          width="19"
          height="19"
          rx="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M7.5 17.5 12 6.5l4.5 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d="M9.2 13.4h5.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="a008-brand-copy">
        <span className="a008-brand-name">{PRODUCT_NAME}</span>
        <span className="a008-brand-tagline">{PRODUCT_TAGLINE}</span>
      </span>
    </span>
  );
}
