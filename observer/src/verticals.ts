import type { ScanType } from "./contract";

export interface QueryIntent {
  id: string;
  scanTypes: ScanType[];
  text: string;
}

export interface Vertical {
  id: string;
  label: string;
  scope: string;
  exclusions: string;
  intents: QueryIntent[];
  /** Gros comptes exclus de x_search (20 max) : ils relaient ce qui est déjà exposé. */
  excludedHandles: string[];
  /** Bornes hautes d'abonnés par tranche d'exposition, propres à la verticale. */
  exposure: { nano: number; micro: number; small: number; mid: number };
}

/**
 * Verticale V1 recommandée : jeux indépendants (visuels, vérifiables hors X via Steam/itch.io,
 * créateurs motivés à repartager). D'autres verticales s'ajoutent ici sans toucher au moteur.
 */
export const INDIE_GAMES: Vertical = {
  id: "indie-games",
  label: "Jeux indépendants",
  scope:
    "Jeux vidéo créés par des développeurs solo ou de petites équipes indépendantes : jeux sortis, démos, pages Steam/itch.io, prototypes et jeux de game jam montrés par leurs créateurs.",
  exclusions:
    "Exclure : gros studios et éditeurs, jeux déjà largement couverts par la presse, comptes de plus d'environ 50 000 abonnés, crypto/NFT/play-to-earn, giveaways et concours, posts d'engagement (« like si… »), compilations « 10 jeux indés à suivre » faites par des tiers, contenus haineux ou sexuels, comptes qui semblent tenus par des mineurs.",
  intents: [
    {
      id: "first-person-show",
      scanTypes: ["morning", "evening"],
      text: "Développeurs qui montrent LEUR propre jeu avec une vidéo ou un GIF : formulations à la première personne comme « I made », « my first game », « solo dev », « after 2 years », « I've been working on », « j'ai créé », « mon jeu ».",
    },
    {
      id: "release-demo",
      scanTypes: ["morning", "noon"],
      text: "Petits jeux qui viennent de sortir ou d'ouvrir une démo ou une page Steam : « just released », « demo is out », « Steam page is live », « out now on itch.io », « wishlist ».",
    },
    {
      id: "early-traction",
      scanTypes: ["noon"],
      text: "Posts de jeux indés publiés aujourd'hui qui suscitent des réactions organiques inhabituelles pour un petit compte (citations et réponses d'autres développeurs), sans être déjà viraux.",
    },
    {
      id: "community-rituals",
      scanTypes: ["evening", "morning"],
      text: "Rituels communautaires : #screenshotsaturday, #indiedev, #gamedev, #madewithgodot, #madewithunity, #PitchYaGame, #WishlistWednesday — garder uniquement les petits comptes avec un rendu original.",
    },
    {
      id: "francophone",
      scanTypes: ["evening", "noon"],
      text: "Développeurs indépendants francophones : #indiedevfr, #gamedevfr, « jeu indé », « j'ai développé », « mon premier jeu ».",
    },
    {
      id: "jams-prototypes",
      scanTypes: ["evening"],
      text: "Jeux de game jam et prototypes (itch.io, « game jam », « made in 48h ») d'une qualité ou d'une idée surprenante.",
    },
    {
      id: "unusual-mechanics",
      scanTypes: ["morning", "evening"],
      text: "Mécaniques de jeu ou directions artistiques inhabituelles montrées en vidéo par de petits comptes : idée qu'on n'a jamais vue, contrainte originale, style visuel singulier.",
    },
  ],
  excludedHandles: [
    "IGN",
    "Kotaku",
    "PlayStation",
    "Xbox",
    "NintendoAmerica",
    "Steam",
    "PCGamer",
    "GameSpot",
    "Polygon",
    "EpicGames",
    "thegameawards",
    "Wario64",
  ],
  exposure: { nano: 1_000, micro: 10_000, small: 50_000, mid: 250_000 },
};

export const VERTICALS: Record<string, Vertical> = {
  [INDIE_GAMES.id]: INDIE_GAMES,
};

export function getVertical(id: string): Vertical {
  const v = VERTICALS[id];
  if (!v) throw new Error(`Verticale inconnue : ${id} (disponibles : ${Object.keys(VERTICALS).join(", ")})`);
  return v;
}

/**
 * Le code choisit les intentions de recherche, pas le modèle : rotation déterministe par jour,
 * pour couvrir toute la banque sur plusieurs scans et pouvoir rejouer un scan à l'identique.
 */
export function pickIntents(vertical: Vertical, type: ScanType, day: string, count = 3): QueryIntent[] {
  const eligible = vertical.intents.filter((i) => i.scanTypes.includes(type));
  if (eligible.length <= count) return eligible;
  const dayNumber = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  const start = ((dayNumber % eligible.length) + eligible.length) % eligible.length;
  return Array.from({ length: count }, (_, k) => eligible[(start + k) % eligible.length]!);
}
