import { collect as steam } from "./steam.mjs";
import { collect as xbox } from "./xbox.mjs";
import { collect as steamvr } from "./steamvr.mjs";
import { collect as metaQuest } from "./meta-quest.mjs";

export const collectors = {
  steam,
  xbox,
  steamvr,
  "meta-quest": metaQuest,
};
