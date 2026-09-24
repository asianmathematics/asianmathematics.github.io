import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements } from '../combatDictionary.js';
import { allUnits, Modifier, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, modifiers, currentAction, eventState } from '../modifier.js';
import { Unit } from './unit.js';

export const ClassicJoy = new Unit("Classical (Joy)", [900, 45, 50, 180, 160, 200, 140, 140, 170, "mid", 90, 90, 9], 4, ["ingenuity/insanity"]);