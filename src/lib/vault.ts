export type VaultProduct = { slug: string; name: string; set: string; number: string; category: string; illustration: string; condition: string; art: string };

export const vaultProducts: VaultProduct[] = [
  { slug: "ember-keeper", name: "Ember Keeper", set: "Ember Archive", number: "014", category: "Flame / Keeper", illustration: "ember", condition: "Near mint", art: "A small lantern fox waits beside an imagined observatory." },
  { slug: "tideglass-heron", name: "Tideglass Heron", set: "Tidal Index", number: "008", category: "Tide / Warden", illustration: "heron", condition: "Light play", art: "A glass-feathered bird crosses a quiet reef at dusk." },
  { slug: "moss-oracle", name: "Moss Oracle", set: "Verdant Atlas", number: "021", category: "Grove / Seer", illustration: "moss", condition: "Near mint", art: "A forest moth carries a map of imaginary trails." },
  { slug: "star-forager", name: "Star Forager", set: "Ember Archive", number: "031", category: "Sky / Scout", illustration: "star", condition: "Moderate play", art: "A little night creature gathers a handful of small stars." },
];
