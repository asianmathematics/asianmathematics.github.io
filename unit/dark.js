import { Unit } from './unit.js';
import { logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, createMod, resetStat } from '../combatDictionary.js';

export const Dark = new Unit("Dark", [550, 75, 18, 50, 115, 45, 120, 35, 125, 175, "front", 150, 18, 250, 30], ["Death/Darkness", "Inertia/Cold", "Independence/Loneliness"], function() {
    this.actions.iceshock = {
        name: "Iceshock [mystic]",
        properties: ["mystic", "intertia/cold", "attack"],
        description: "Attacks a single target 4 times.",
        target: () => { selectTarget(this.actions.iceshock, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]); },
        code: (target) => {
            this.previousAction = [false, true, false];
            logAction(`${this.name} fires magic projectiles at ${target[0].name}`, "action");
            attack(this, target, 4);
        }
    };

    this.actions.perfectFreeze = {
        name: "Perfect Freeze [mana]",
        properties: ["mystic", "mana", "intertia/cold", "debuff", "stun"],
        cost: { mana: 90 },
        description: "Costs 90 mana\nStuns a single target for a turn",
        target: () => {
            if (this.resource.mana < 90) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.perfectFreeze, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.mana -= 90;
            this.previousAction = [false, true, false];
            const will = resistDebuff(this, target);
            if (will > 50) {
                logAction(`${this.name} freezes ${target[0].name}!`, "action");
                const self = this;
                createMod("Perfect Freeze", "stun effect",
                    { caster: self, targets: target, duration: 1, stats: ["evasion"], values: [1.5] },
                    (vars) => { vars.targets[0].stun = true },
                    (vars, unit) => {
                        vars.targets[0].stun = false;
                        return true;
                    }
                );
            } else { logAction(`${target[0].name} resists the freeze!`, "miss") }
        }
    };

    this.actions.danmaku = {
        name: "Danmaku [mana]",
        properties: ["mystic", "mana", "attack", "debuff", "multitarget"],
        cost: { mana: 40 },
        description: "Costs 40 mana\nDecreases evasion for 1 turn\nHits up to 6 random enemies 10 times with decreased accuracy and damage",
        code: () => {
            if (this.resource.mana < 40) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            this.resource.mana -= 40;
            this.previousAction = [false, true, false];
            this.attack *= .5;
            this.accuracy *= .75;
            logAction(`${this.name} shoots some damaku!`, "action");
            let target = unitFilter("enemy", "front", false);
            while (target.length > 6) { target = target.filter(unit => unit !== target[Math.floor(Math.random() * target.length)]); }
            attack(this, target, 10);
            resetStat(this, ["attack", "accuracy"]);
            const self = this;
            createMod("Evasion Penalty", "Evasion reduced during bullet hell",
                { caster: self, targets: [self], duration: 1, stats: ["evasion"], values: [-0.5] },
                (vars) => {
                    vars.stats.forEach((stat, i) => {
                        vars.targets[0].mult[stat] += vars.values[i];
                        resetStat(vars.targets[0], [stat]);
                    });
                },
                (vars, unit) => {
                    if(vars.caster === unit) {
                        vars.stats.forEach((stat, i) => {
                            vars.targets[0].mult[stat] -= vars.values[i];
                            resetStat(vars.targets[0], [stat]);
                        });
                        return true;
                    }
                }
            );
        }
    };

    this.actions.dispelMagic = {
        name: "Dispel Magic [mana]",
        properties: ["mystic", "mana", "intertia/cold", "debuff", "resource"],
        cost: { mana: 60 },
        description: "Costs 60 mana\nSets mana of target to 0 and disables mana regeneration for next turn",
        target: () => {
            if (this.resource.mana < 60) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.dispelMagic, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.mana -= 60;
            this.previousAction = [false, true, false];
            const will = resistDebuff(this, target);
            if (target[0].resource.mana !== undefined) {
                if (will[0] > 45) {
                    target[0].resource.mana = 0;
                    target[0].previousAction[1] = true;
                    logAction(`${this.name} dispels ${target[0].name}'s magic!`, "action");
                } else { logAction(`${target[0].name} resists dispel magic`, "miss"); }
            }
            else { logAction(`${target[0].name} has no magic to dispel!`, "warning"); }
        }
    };

    this.actions.dodge = {
        name: "Dodge [stamina]",
        properties: ["physical", "stamina", "buff"],
        cost: { stamina: 20 },
        description: "Costs 20 stamina\nIncreases evasion for 1 turn",
        code: () => {
            if (this.resource.stamina < 20) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            this.resource.stamina -= 20;
            this.previousAction = [true, false, false];
            const self = this;
            createMod("Dodge", "Evasion increased",
                { caster: self, targets: [self], duration: 1, stat: "evasion", value: 2 },
                (vars) => {
                    vars.caster.mult[vars.stat] += vars.value;
                    resetStat(vars.caster, [vars.stat]);
                    logAction(`${vars.caster.name} dodges.`, "buff");
                },
                (vars, unit) => {
                    if (vars.caster === unit) {
                        unit.mult[vars.stat] -= vars.value;
                        resetStat(unit, [vars.stat]);
                        return true;
                    }
                }
            );
        }
    };
});