import { collect as steam } from "./steam.mjs";
import { collect as xbox } from "./xbox.mjs";
import { collect as steamvr } from "./steamvr.mjs";
import { collect as metaQuest } from "./meta-quest.mjs";
import { collectEneba, collectG2a } from "./keys.mjs";

export const collectors = {
  steam,
  xbox,
  steamvr,
  "meta-quest": metaQuest,
  eneba: collectEneba,
  g2a: collectG2a,
};
