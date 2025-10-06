import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const ClassicJoy = new Unit("Classical (Joy)", [380, 60, 8, 60, 110, 15, 120, 30, 90, 110, "back", 40, 120, 15, undefined, undefined, 90, 10], ["Death/Darkness", "Goner/Entropy", "Anomaly/Synthetic", "Independence/Loneliness", "Ingenuity/Insanity"], function() {
    this.actions.rapidFire = {
        name: "Rapid Fire [physical, energy]",
        properties: ["physical", "techno", "energy", "attack", "buff"],
        cost: { energy: 10 },
        description: "Costs 10 energy\nAttacks a single target twice but increases speed for 1 turn",
        target: () => {
            if (this.resource.energy < 10) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.rapidFire, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 10;
            const statIncrease = [0.4];
            this.previousAction[0] = this.previousAction[2] = true;
            attack(this, target, 2);
            logAction(`${this.name} performs a Rapid Fire, boosting speed for 1 turn!`, "buff");
            const self = this;
            basicModifier("Rapid Fire Speed", "Temporary speed boost", { caster: self, targets: [self], duration: 1, attributes: ["physical"], stats: ["speed"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.energyRifle = {
        name: "Energy Rifle [energy]",
        properties: ["techno", "energy", "attack"],
        cost: { energy: 30 },
        description: "Costs 30 energy\nAttacks a single target 4 times with increased accuracy and crit damage",
        target: () => {
            if (this.resource.energy < 30) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.energyRifle, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 30;
            this.previousAction[2] = true;
            logAction(`${this.name} fires at ${target[0].name}!`, "action");
            attack(this, target, 4, { attacker: { accuracy: this.accuracy * 1.75, lethality: this.lethality * 2 } });
        }
    };

    this.actions.emp = {
        name: "EMP [energy]",
        properties: ["techno", "energy", "inertia/cold", "debuff", "resource"],
        cost: { energy: 55 },
        description: "Costs 55 energy\nSets energy of target to 0 and disables energy regeneration for next turn",
        target: () => {
            if (this.resource.energy < 55) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.emp, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 55;
            this.previousAction[2] = true;
            const will = resistDebuff(this, target);
            if (target[0].resource.energy !== undefined) {
                if (will[0] > 35) {
                    const self = this
                    if (eventState.resourceChange.flag) {handleEvent('resourceChange', { effect: self.actions.emp, unit: target[0], resource: ['energy'], value: [-target[0].resource.energy] }) }
                    target[0].resource.energy = 0;
                    target[0].previousAction[2] = true;
                    logAction(`${this.name} disables ${target[0].name}'s energy!`, "action");
                } else { logAction(`${target[0].name} resists the emp`, "miss") }
            } else { logAction(`${target[0].name} has no energy to disable!`, "warning") }
        }
    };

    this.actions.synthesizeMedicine = {
        name: "Synthesize Medicine [techno]",
        properties: ["techno", "anomaly/synthetic", "heal"],
        description: "Moderately heals target (~10% max HP)",
        target: () => { selectTarget(this.actions.synthesizeMedicine, () => { playerTurn(this) }, [1, true, unitFilter("player", "")]) },
        code: (target) => {
            this.previousAction[2] = true;
            let elementBonus = 0;
            if (target[0].elements.includes("Anomaly/Synthetic")) { elementBonus++ }
            if (target[0].elements.includes("Radiance/Purity") || target[0].elements.includes("Nature/Life")) { elementBonus-- }
            const self = this
            if (eventState.elementEffect.flag) { handleEvent('elementEffect', { effect: self.actions.synthesizeMedicine, target: target[0], elementBonus }) }
            if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: self.actions.synthesizeMedicine, unit: target[0], resource: ['hp'], value: [(2 ** elementBonus) * target[0].resource.healFactor] }) }
            target[0].hp = Math.min(target[0].base.hp, target[0].hp + (2 ** elementBonus) * target[0].resource.healFactor);
            logAction(`${this.name} heals ${target[0].name} for ${(2 ** elementBonus) * target[0].resource.healFactor} HP!`, "heal");
        }
    };

    this.actions.joy = {
        name: "Joy [stamina]",
        properties: ["physical", "stamina", "death/darkness", "goner/entropy", "harmonic/change", "anomaly/synthetic", "ingenuity/insanity", "buff", "debuff"],
        cost: { stamina: 40 },
        description: "Costs 40 stamina & 10% HP\nDelayed consequences",
        target: () => {
            if (this.resource.stamina < 40) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            selectTarget(this.actions.joy, () => { playerTurn(this) }, [1, true, unitFilter("player", "", false)]);
        },
        code: (target) => {
            const statIncrease = [((target[0].base.accuracy + 25) / target[0].base.accuracy) - 1, ((target[0].base.focus + 40) / target[0].base.focus) - 1, ((target[0].base.defense + 5) / target[0].base.defense) - 1, ((target[0].base.resist + 15) / target[0].base.resist) - 1];
            const statDecrease = [((target[0].base.attack - 10) / target[0].base.attack) - 1, ((target[0].base.defense - 5) / target[0].base.defense) - 1, ((target[0].base.evasion - 5) / target[0].base.evasion) - 1, ((target[0].base.speed - 10) / target[0].base.speed) - 1, ((target[0].base.accuracy - 25) / target[0].base.accuracy) - 1];
            this.previousAction[0] = true;
            this.resource.stamina -= 40;
            if (eventState.singleDamage.flag) { handleEvent('singleDamage', {attacker: this, defender: this, damageSingle: -0.1 * this.base.hp }) }
            this.hp = Math.max(this.hp - (.1 * this.base.hp), 0);
            const mod = modifiers.find(m => m.name === "Joy" && m.vars.targets.includes(target[0]));
            if (mod) {
                if (!mod.applied) {
                    if (mod.vars.duration < 10) {
                        mod.description = "Overall increase?";
                        resetStat(target[0], mod.vars.debuffs, mod.vars.debuffValues, false);
                    }
                    else { resetStat(target[0], mod.vars.buffs, mod.vars.buffValues, false) }
                }
                logAction(`${this.name} reapplies Joy on ${target[0].name}!`, "buff");
                mod.vars.duration = 15;
                mod.vars.elements = ["death/darkness", "goner/entropy", "harmonic/change", "anomaly/synthetic", "ingenuity/insanity"];
                mod.vars.buffs = ["accuracy", "focus", "defense", "resist"];
                mod.vars.buffValues = statIncrease;
                mod.vars.debuffs = ["attack", "defense", "evasion", "speed", "accuracy"];
                mod.vars.debuffValues = statDecrease;
                mod.vars.listeners = { turnStart: true, actionStart: false };
                mod.vars.cancel = false;
                mod.vars.applied = true;
                mod.vars.focus = false;
                mod.vars.penality = false;
                mod.vars.mod = null;
                mod.init();
            } else {
                const self = this;
                logAction(`${this.name} gives ${target[0].name} some joy!`, "buff");
                new Modifier("Joy", "Overall increase?",
                    { caster: self, targets: target, duration: 15, elements: ["death/darkness", "goner/entropy", "harmonic/change", "anomaly/synthetic", "ingenuity/insanity"], buffs: ["accuracy", "focus", "defense", "resist"], buffValues: statIncrease, debuffs: ["attack", "defense", "evasion", "speed", "accuracy"], debuffValues: statDecrease, listeners: { turnStart: true, actionStart: false }, cancel: false, applied: true, focus: false, penality: false, mod: null },
                    (vars) => {
                        vars.mod = modifiers.find(m => m.name === "Joy" && m.vars.targets[0] === vars.targets[0]);
                        let elementBonus = 0;
                        if (vars.targets[0].elements.includes("Death/Darkness")) { elementBonus++ }
                        if (vars.targets[0].elements.includes("Anomaly/Synthetic")) { elementBonus++ }
                        if (vars.targets[0].elements.includes("Light/Illusion") || vars.targets[0].elements.includes("Radiance/Purity")) { elementBonus-- }
                        if (vars.targets[0].elements.includes("Radiance/Purity") || vars.targets[0].elements.includes("Nature/Life")) { elementBonus-- }
                        if (vars.targets[0].elements.includes("Ingenuity/Insanity")) { elementBonus += 2 }
                        if (eventState.elementEffect.flag) { handleEvent('elementEffect', { effect: vars.mod, target: vars.targets[0], elementBonus }) }
                        if (elementBonus !== 0) {
                            for (let i = 0; i < vars.buffValues.length; i++) { vars.buffValues[i] *= 1.5 ** elementBonus }
                            for (let i = 0; i < vars.debuffValues.length; i++) { vars.debuffValues[i] *= (2/3) ** elementBonus }
                        }
                        resetStat(vars.targets[0], vars.buffs, vars.buffValues);
                    },
                    (vars, context) => {
                        if (vars.cancel && vars.applied) {
                            if (vars.penality) { resetStat(vars.targets[0], vars.debuffs, vars.debuffValues, false) }
                            else { resetStat(vars.targets[0], vars.buffs, vars.buffValues, false) }
                            vars.applied = false;
                        } else if (!vars.cancel && !vars.applied) {
                            if (vars.penality) { resetStat(vars.targets[0], vars.debuffs, vars.debuffValues) }
                            else { resetStat(vars.targets[0], vars.buffs, vars.buffValues) }
                            vars.applied = true;
                        }
                        if (vars.listeners.actionStart && context.unit === vars.targets[0]) {
                            if (vars.penality) {
                                for (const element of ["light/illusion", "knowledge/memory", "goner/entropy", "harmonic/change", "inertia/cold", "radiance/purity", "nature/life"]) {
                                    if (vars.targets[0].shield.includes(element)) { vars.targets[0].shield.splice(vars.targets[0].shield.indexOf(element), 1) }
                                    else if (!vars.targets[0].absorb.includes(element)) { vars.targets[0].absorb.push(element) }
                                }
                            } else { vars.targets[0].shield.push("death/darkness", "goner/entropy", "harmonic/change", "anomaly/synthetic") }
                            vars.listeners.actionStart = false;
                            eventState.actionStart.listeners.splice(eventState.actionStart.listeners.indexOf(vars.mod), 1)
                            if (eventState.actionStart.listeners.length === 0) { eventState.actionStart.flag = false }
                            return;
                        }
                        if (vars.targets[0] === context.unit) {
                            vars.duration--;
                            if (vars.applied) {
                                vars.listeners.actionStart = eventState.actionStart.flag = true;
                                eventState.actionStart.listeners.push(vars.mod);
                            }
                        }
                        if (vars.duration === 9) {
                            if (vars.applied) {
                                resetStat(vars.targets[0], vars.buffs, vars.buffValues, false);
                                resetStat(vars.targets[0], vars.debuffs, vars.debuffValues);
                            }
                            vars.penality = true;
                            logAction(`${vars.targets[0].name} is feeling the side effects!`, "debuff");
                            vars.mod.description = "Long side effect period";
                        }
                        if (vars.duration === 0) { return true }
                    }
                );
            }
        }
    };
});