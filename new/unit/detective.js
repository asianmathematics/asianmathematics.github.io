import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements, combatSpeedMultiplier } from '../combatDictionary.js';
import { allUnits, Modifier, toggleListeners, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, comma, capital, modifiers, currentAction, eventState } from '../modifier.js';
import { Unit } from './unit.js';

export const Detective = new Unit("Detective", [750, 28, 27, 50, 150, 180, 140, 90, 75, "front", 80, 60, 7, , , 90, 10], 3);

Detective.skills = {
    special: [
        {
            name: "Self Defense",
            properties: ["physical", "stamina-block", "stamina", "attack"],
            cost: { stamina: 20 },
            description: "Makes 3 attacks with increased attack and focus",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)); },
            code(target) { attack(this, target, 3, { attacker: { attack: { bonus: 20 }, focus: { mult: 3 } } } ) }
        },
        {
            name: "Camera Flash",
            properties: ["techno", "energy-block", "energy", "debuff", "stun"],
            cost: { energy: 30 },
            description: "Decrease target accuracy/focus/resist for a few turns depending on chance and chance to stun target, 1% chance to fail",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)); },
            code(target) {
                const will = resistDebuff(this, target)[0];
                switch (true) {
                    case will >= 50:
                        stunModifier("Camera Flash: Stun", { target: target[0], duration: 1, properties: ["techno", "stun", "debuff"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 75; } });
                    case will >= 2:
                        basicModifier("Camera Flash", "Accuracy, focus, and resist decrease", { target: target[0], duration: will > 99 ? 5 : Math.ceil(will/33), properties: ["techno", "debuff"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 2; } });
                        break;
                    default:
                        logAction(`${target[0].name} resists the flash!`, "miss");
                }
            }
        },
        {
            name: "Red String",
            properties: ["physical", "stamina-block", "stamina", "techno", "energy-block", "energy", "conditional", "redirect"],
            cost: { stamina: 25, energy: 35 },
            description: "Links two frontline units together, 1% chance to fail for each enemy link. If two allies are linked, they share buffs & heals and when one takes damage, the higher hp target takes half the damage while the lower hp target takes 25%. If two enemies are linked, they have a chance to share debuffs & penalties and when one takes damage, the other takes the same amount of damage. If an ally and enemy are linked, chance for buffs & and heals are redirected to the ally and chance for damage, debuff, & penalties to be redirected to the enemy. Last until resist or more than 3 links are made.",
            target() { specialTarget(this, allUnits.filter(u => u.position === "front"), 2); },
            code(targets) {
                if ((targets = targets.filter(u => u.team === this.team || resistDebuff(this, [u])[0] >= 2)).length < 2) {
                    logAction("Not enough targets selected!", "warning");
                    resourceChange(this, this.skills.special.cost);
                    this.previousAction[0] = this.previousAction[1] = false;
                    return;
                }
                new Modifier("Red String", "Links frontline units together. If two allies are linked, they share buffs & heals and when one takes damage, the higher hp target takes half the damage while the lower hp target takes 25%. If two enemies are linked, they have a chance to share debuffs & penalties and when one takes damage, the other takes the same amount of damage. If an ally and enemy are linked, chance for buffs & and heals are redirected to the ally and chance for damage, debuff, & penalties to be redirected to the enemy.",
                    { targets, properties: ["physical", "techno", "conditional", "redirect"], listeners: { damageSingle: true, healSingle: false, modifierStart: true, modifierEnd: true }, debuff: function(targets, calcMods) { return resistDebuff(targets, calcMods).map(v => v >= 2 ); } },
                    function() { if (this.vars.targets.some(u => u.team !== this.vars.caster.team)) this.vars.listeners.healSingle = true; },
                    function(context) {
                        if (context.modifier) {
                            if (context) {}
                        }
                        else if (this.vars.targets.includes(context.unit)) {}
                    }
                )
            }
        }
    ]
}