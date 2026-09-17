import { MemoryError } from "./errors.js";
import type {
  CandidateChannelLimits,
  HybridMemoryReadPolicy,
  HybridRetrievalWeights,
  RetrievalChannel,
} from "./retrieval-types.js";

export interface HybridMemoryReadPolicyOptions {
  readonly candidateThreshold?: number;
  readonly projectionThreshold?: number;
  readonly projectionMaximum?: number;
  readonly maxCandidateItems?: number;
  readonly maxProjectionItems?: number;
  readonly channelLimits?: Partial<CandidateChannelLimits>;
  readonly weights?: Partial<HybridRetrievalWeights>;
}

function unit(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new MemoryError(
      "invalid_input",
      `${field} must be a finite number between 0 and 1`,
    );
  }
  return value;
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new MemoryError(
      "invalid_input",
      `${field} must be a positive safe integer`,
    );
  }
  return value;
}

export class NeutralHybridMemoryReadPolicy implements HybridMemoryReadPolicy {
  readonly candidateThreshold: number;
  readonly projectionThreshold: number;
  readonly projectionMaximum: number;
  readonly maxCandidateItems: number;
  readonly maxProjectionItems: number;
  readonly channelLimits: CandidateChannelLimits;
  readonly weights: HybridRetrievalWeights;

  constructor(options: HybridMemoryReadPolicyOptions = {}) {
    this.candidateThreshold = unit(
      options.candidateThreshold ?? 0.1,
      "candidateThreshold",
    );
    this.projectionThreshold = unit(
      options.projectionThreshold ?? 0.25,
      "projectionThreshold",
    );
    if (this.projectionThreshold < this.candidateThreshold) {
      throw new MemoryError(
        "invalid_input",
        "projectionThreshold cannot be lower than candidateThreshold",
      );
    }
    this.projectionMaximum = positiveInteger(
      options.projectionMaximum ?? 8_192,
      "projectionMaximum",
    );
    this.maxCandidateItems = positiveInteger(
      options.maxCandidateItems ?? 32,
      "maxCandidateItems",
    );
    this.maxProjectionItems = positiveInteger(
      options.maxProjectionItems ?? 8,
      "maxProjectionItems",
    );
    const limits = options.channelLimits ?? {};
    this.channelLimits = {
      exact: positiveInteger(limits.exact ?? 16, "channelLimits.exact"),
      lexical: positiveInteger(limits.lexical ?? 24, "channelLimits.lexical"),
      tag: positiveInteger(limits.tag ?? 16, "channelLimits.tag"),
      domain: positiveInteger(limits.domain ?? 16, "channelLimits.domain"),
      semantic: positiveInteger(
        limits.semantic ?? 24,
        "channelLimits.semantic",
      ),
    };
    const weights = options.weights ?? {};
    this.weights = {
      exact: unit(weights.exact ?? 0.25, "weights.exact"),
      lexical: unit(weights.lexical ?? 0.2, "weights.lexical"),
      tag: unit(weights.tag ?? 0.1, "weights.tag"),
      domain: unit(weights.domain ?? 0.1, "weights.domain"),
      semantic: unit(weights.semantic ?? 0.2, "weights.semantic"),
      strength: unit(weights.strength ?? 0.05, "weights.strength"),
      authority: unit(weights.authority ?? 0.1, "weights.authority"),
    };
    const weightSum = Object.values(this.weights).reduce(
      (sum, value) => sum + value,
      0,
    );
    if (Math.abs(weightSum - 1) > 1e-9) {
      throw new MemoryError(
        "invalid_input",
        "hybrid retrieval weights must sum to 1",
      );
    }
  }
}

export function isExactChannelCandidate(
  channels: Iterable<RetrievalChannel>,
): boolean {
  for (const channel of channels) {
    if (channel === "exact") {
      return true;
    }
  }
  return false;
}

export function strengthWeightForChannels(
  weights: HybridRetrievalWeights,
  channels: Iterable<RetrievalChannel>,
): number {
  return isExactChannelCandidate(channels) ? 0 : weights.strength;
}
