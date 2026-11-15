import type { GiftKind } from "./types";

export interface GiftDef {
  label: string;
  cost: number;
  weight: number;
  blurb: string;
}

/** Banner text matches the original reference: short, loud and uppercase. */
export const GIFTS: Record<GiftKind, GiftDef> = {
  ghost: { label: "GHOST", cost: 40, weight: 3, blurb: "Slip through tiles and walls for 5 seconds" },
  eclipse: { label: "ECLIPSE GHOST", cost: 70, weight: 1, blurb: "A larger ghost that cuts a wide path for 6 seconds" },
  nitro: { label: "NITRO", cost: 30, weight: 4, blurb: "Faster ball for 5 seconds" },
  blackhole: { label: "BLACK HOLE", cost: 60, weight: 2, blurb: "Swallows nearby enemy tiles for 4 seconds" },
  colossus: { label: "COLOSSUS", cost: 55, weight: 2, blurb: "A giant ball that crushes 3 by 3 tiles for 6 seconds" },
  trinity: { label: "TRINITY", cost: 50, weight: 3, blurb: "Two extra balls for 8 seconds" },
  wrecking: { label: "WRECKING BALL", cost: 45, weight: 2, blurb: "Your next hit shatters a 5 by 5 block" },
  infiltrator: { label: "INFILTRATOR + 10 SECONDS", cost: 55, weight: 2, blurb: "A colony grows inside enemy land for 10 seconds" },
  wormhole: { label: "WORMHOLE", cost: 40, weight: 2, blurb: "Blink into the enemy heartland and claim 3 by 3" },
};

export const ALL_GIFTS = Object.keys(GIFTS) as GiftKind[];
