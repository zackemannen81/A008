import { PRODUCT_NAME, PRODUCT_TAGLINE } from "./identity.js";

/** A008-0037 product mark. Keep the BrandMark export. Product name is A008. */

export function BrandMark() {
  return (
    <span className="a008-brand" aria-label={PRODUCT_NAME}>
      <img
        className="a008-brand-mark"
        src="/app-icon.png"
        alt=""
        width={256}
        height={256}
      />
      <span className="a008-brand-copy">
        <span className="a008-brand-name">{PRODUCT_NAME}</span>
        <span className="a008-brand-tagline">{PRODUCT_TAGLINE}</span>
      </span>
    </span>
  );
}
