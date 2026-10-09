import type {
  ExposureBucket,
  GrokCandidate,
  RejectionReason,
  SuggestedDecision,
  VerificationFlag,
} from "./contract";
import type { Vertical } from "./verticals";

/**
 * Portes puis tiers, à la place de la somme pondérée du §19 : dans une somme, un sujet déjà
 * exposé mais excellent passait devant la pépite sous-exposée. Ici l'exposition est calculée par le code
 * (tranches d'abonnés), le mérite est jugé par le modèle sur une grille 1–5, et les deux se croisent.
 */

export function exposureBucket(followers: number | null, t: Vertical["exposure"]): ExposureBucket {
  if (followers === null) return "unknown";
  if (followers < t.nano) return "nano";
  if (followers < t.micro) return "micro";
  if (followers < t.small) return "small";
  if (followers < t.mid) return "mid";
  return "large";
}

const UNDEREXPOSURE: Record<ExposureBucket, number> = {
  nano: 1,
  micro: 0.9,
  small: 0.7,
  unknown: 0.5,
  mid: 0.3,
  large: 0,
};

export function meritOf(c: GrokCandidate): number {
  return (c.quality + c.originality) / 2;
}

/** Ordre d'affichage 0–100. Pas une mesure : un classement, dérivé du mérite, de l'exposition et de l'histoire. */
export function priorityOf(c: GrokCandidate, bucket: ExposureBucket): number {
  const merit = (meritOf(c) - 1) / 4;
  const story = (c.story - 1) / 4;
  return Math.round(100 * (0.6 * merit + 0.25 * UNDEREXPOSURE[bucket] + 0.15 * story));
}

const BLOCKING: VerificationFlag[] = ["EVIDENCE_NOT_X_POST", "EVIDENCE_NOT_CITED", "NO_SEARCH_PERFORMED"];

export function suggestDecision(
  c: GrokCandidate,
  bucket: ExposureBucket,
  flags: VerificationFlag[],
): { decision: SuggestedDecision; reason: RejectionReason | null; note: string } {
  if (flags.some((f) => BLOCKING.includes(f))) {
    return { decision: "REJECT", reason: "INSUFFICIENT_EVIDENCE", note: "preuve non vérifiable dans la réponse" };
  }
  if (flags.includes("DUPLICATE_IN_SCAN")) {
    return { decision: "REJECT", reason: "DUPLICATE", note: "doublon d'un autre candidat du scan" };
  }
  if (bucket === "large") {
    return { decision: "REJECT", reason: "ALREADY_MAINSTREAM", note: "déjà très exposé" };
  }
  const merit = meritOf(c);
  if (merit < 3) {
    return { decision: "REJECT", reason: c.originality < 3 ? "NOT_ORIGINAL" : "LOW_QUALITY", note: "mérite insuffisant" };
  }
  if (bucket === "mid") {
    return { decision: "WATCH", reason: null, note: "exposition moyenne : il faut un angle nouveau" };
  }
  if (merit >= 4 && c.story >= 3) {
    if (bucket === "unknown") {
      return { decision: "WATCH", reason: null, note: "prometteur, mais exposition inconnue : à mesurer" };
    }
    return { decision: "SHORTLIST", reason: null, note: "mérite élevé, sous-exposé, histoire racontable" };
  }
  if (c.story < 3) {
    return { decision: "WATCH", reason: null, note: "intéressant mais pas encore d'angle éditorial" };
  }
  return { decision: "WATCH", reason: null, note: "à surveiller : mérite correct, pas encore décisif" };
}

const BUCKET_LABEL: Record<ExposureBucket, string> = {
  unknown: "exposition inconnue",
  nano: "nano",
  micro: "micro",
  small: "petit",
  mid: "moyen",
  large: "large",
};

export function summaryLine(c: GrokCandidate, bucket: ExposureBucket, note: string): string {
  const followers =
    c.declared_followers === null
      ? ""
      : ` (${new Intl.NumberFormat("fr-FR").format(c.declared_followers)} abonnés déclarés, non vérifié)`;
  const merit = meritOf(c).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  return `mérite ${merit}/5 · histoire ${c.story}/5 · ${BUCKET_LABEL[bucket]}${followers} — ${note}`;
}
