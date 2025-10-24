import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementInteraction, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Idol = new Unit("Idol", [600, 30, 13, 85, 30, 130, 50, 60, 200, "back", 60, 120, 8, 150, 10, 90, 6], ["Light/Illusion", "Harmonic/Change", "Radiance/Purity", "Anomaly/Synthetic"], function() {
    this.actions.soothingMelody = {
        name: "Soothing Melody [stamina, mana, techno]",
        properties: ["physical", "stamina", "mystic", "mana", "techno", "light/illusion", "harmonic/change", "radiance/purity", "heal", "buff"],
        cost: { stamina: 10, mana: 20 },
        description: "Costs 10 stamina & 20 mana\nHeals and increases defensive stats and presence of ally, benefits increase if used multiple times on the same target in a row",
        points: 60,
        target: () => {
            if (this.resource.mana < 20 || this.resource.stamina < 10) {
                showMessage("Not enough resources!", "error", "selection");
                return;
            }
            selectTarget(this.actions.soothingMelody, () => { playerTurn(this) }, [1, true, unitFilter("player", "")]);
        },
        code: (target) => {
            const statIncrease = [16, 16, 12, 20];
            let mod = modifiers.find(m => m.name === "Soothing Melody" && m.caster === this);
            let effect = 1;
            this.previousAction = [true, true, true];
            this.resource.stamina -= 10;
            this.resource.mana -= 20;
            if (mod) {
                if (mod.vars.targets[0] !== target[0]) { effect = Math.max(mod.vars.effect - 1, 1) }
                else { effect += mod.vars.effect }
                removeModifier(mod);
            }
            new Modifier("Soothing Melody", "Heal and increase defensive stats and presence", { caster: this, targets: target, duration: 2, attributes: ["physical", "mystic", "techno"], elements: ["light/illusion", "harmonic/change", "radiance/purity"], stats: ["presence", "defense", "evasion", "resist"], values: statIncrease, effect: effect, listeners: { turnEnd: true }, cancel: false, applied: true, focus: true },
                function() {
                    if (this.vars.effect > 1) { for (val of this.vars.values) { val *= (3 + this.vars.effect)/4} }
                    resetStat(this.vars.targets[0], this.vars.stats, this.vars.values);
                },
                function(context) {
                    if (this.vars.cancel && this.vars.applied) {
                        resetStat(this.vars.targets[0], this.vars.stats, this.vars.values, false);
                        this.vars.applied = false;
                    } else if (!this.vars.cancel && !this.vars.applied) {
                        resetStat(this.vars.targets[0], this.vars.stats, this.vars.values);
                        this.vars.applied = true;
                    }
                    if (context.unit === this.vars.caster) {
                        this.vars.duration--;
                        if (this.vars.duration === 0) { return true }
                        if (this.vars.applied) {
                            if (eventState.resourceChange.flag) { handleEvent('resourceChange', {unit: this.vars.targets[0], resource: ['hp'], amount: [this.vars.targets[0].resource.healFactor * (3 + this.vars.effect)/4]}) }
                            this.vars.targets[0].hp = Math.min(this.vars.targets[0].hp + (this.vars.targets[0].resource.healFactor * (3 + this.vars.effect)/4), this.vars.targets[0].base.hp);
                            logAction(`${this.vars.caster.name} sings a soothing melody, healing ${this.vars.targets[0].name} ${this.vars.targets[0].resource.healFactor * (3 + this.vars.effect)/4} HP!`, "heal");
                        }
                    }
                }
            );
        }
    };

    this.actions.rhythmicFrenzy = {
        name: "Rhythmic Frenzy [stamina, mystic, energy]",
        properties: ["physical", "stamina", "mystic", "techno", "energy", "light/illusion", "harmonic/change", "radiance/purity", "heal", "buff"],
        cost: { stamina: 20, energy: 10 },
        description: "Costs 20 stamina & 10 energy\nIncreases offensive stats of all frontline allies, benefits increase if used multiple times in a row",
        points: 60,
        code: () => {
            if (this.resource.stamina < 20 || this.resource.energy < 10) {
                showMessage("Not enough resources!", "error", "selection");
                return;
            }
            const statIncrease = [8, 4, 20];
            let mod = modifiers.find(m => m.name === "Rhythmic Frenzy" && m.caster === this);
            let effect = 1;
            this.previousAction = [true, true, true];
            this.resource.stamina -= 20;
            this.resource.energy -= 10;
            if (mod) {
                effect += mod.vars.effect;
                removeModifier(mod);
            }
            new Modifier("Rhythmic Frenzy", "Offensive stat increase", { caster: this, targets: unitFilter("player", "front"), duration: 2, attributes: ["physical", "mystic", "techno"], elements: ["light/illusion", "harmonic/change", "radiance/purity"], stats: ["attack", "accuracy", "focus"], values: statIncrease, effect: effect, listeners: { turnEnd: true }, cancel: false, applied: true, focus: true },
                function() {
                    if (this.vars.effect > 1) { for (val of this.vars.values) { val *= (3 + this.vars.effect)/4} }
                    for (const unit in this.vars.targets ) { resetStat(unit, this.vars.stats, this.vars.values) }
                },
                function(context) {
                    if (this.vars.cancel && this.vars.applied) {
                        for (const unit in this.vars.targets ) { resetStat(unit, this.vars.stats, this.vars.values, false) }
                        this.vars.applied = false;
                    } else if (!this.vars.cancel && !this.vars.applied) {
                        for (const unit in this.vars.targets ) { resetStat(unit, this.vars.stats, this.vars.values) }
                        this.vars.applied = true;
                    }
                    if (context.unit === this.vars.caster) { this.vars.duration-- }
                    if (this.vars.duration === 0) { return true }
                }
            );
        }
    };

    this.actions.rebelliousDiscord = {
        name: "Rebellious Discord [physical, mana, energy]",
        properties: ["physical", "mystic", "mana", "techno", "energy", "light/illusion", "harmonic/change", "radiance/purity", "heal", "buff"],
        cost: { mana: 10, energy: 20 },
        description: "Costs 10 mana & 20 energy\nChance to decrease defensive stats of each frontline enemy, chances to apply debuff increases if used multiple times in a row",
        points: 60,
        code: () => {
            if (this.resource.mana < 10 || this.resource.energy < 20) {
                showMessage("Not enough resources!", "error", "selection");
                return;
            }
            const statDecrease = [-17, -15, -15];
            let mod = modifiers.find(m => m.name === "Rebellious Discord" && m.caster === this);
            let effect = 1;
            this.previousAction = [true, true, true];
            this.resource.mana -= 10;
            this.resource.energy -= 20;
            if (mod) {
                effect += mod.vars.effect;
                removeModifier(mod);
            }
            new Modifier("Rebellious Discord", "Defensive stat decrease", { caster: this, targets: unitFilter("enemy", "front"), duration: 2, attributes: ["physical", "mystic", "techno"], elements: ["light/illusion", "harmonic/change", "radiance/purity"], stats: ["defense", "evasion", "resist"], values: statDecrease, effect: effect, listeners: { turnEnd: true }, cancel: false, applied: true, focus: true },
                function() {
                    for (const unit in this.vars.targets ) {
                        if (resistDebuff(this.vars.caster, [unit]) > 75 - (6.25 * (this.vars.effect - 1))) { resetStat(unit, this.vars.stats, this.vars.values) }
                        else { this.vars.targets.splice(this.vars.targets.indexOf(unit), 1) }
                    }
                },
                function(context) {
                    if (this.vars.cancel && this.vars.applied) {
                        for (const unit in this.vars.targets ) { resetStat(unit, this.vars.stats, this.vars.values, false) }
                        this.vars.applied = false;
                    } else if (!this.vars.cancel && !this.vars.applied) {
                        for (const unit in this.vars.targets ) { resetStat(unit, this.vars.stats, this.vars.values) }
                        this.vars.applied = true;
                    }
                    if (context.unit === this.vars.caster) { this.vars.duration-- }
                    if (this.vars.duration === 0) { return true }
                }
            );
        }
    };

    this.actions.personalRequest = {
        name: "Personal Request [stamina, mana, energy]",
        properties: ["physical", "stamina", "mystic", "mana", "techno", "energy", "light/illusion", "harmonic/change", "radiance/purity", "heal", "buff"],
        cost: { stamina: 10, mana: 10, energy: 10 },
        description: `Costs 10 stamina & 10 mana & 10 energy\nIncreases or decreases targets stats with a percent of ${this.name}'s stats depending if targeting on ally or enemy, benefits increase if used multiple times on the same target in a row`,
        points: 60,
        target: () => {
            if (this.resource.mana < 10 || this.resource.stamina < 10 || this.resource.energy < 10) {
                showMessage("Not enough resources!", "error", "selection");
                return;
            }
            selectTarget(this.actions.personalRequest, () => { playerTurn(this) }, [1, true, unitFilter("", "", false)]);
        },
        code: (target) => {
            const statIncrease = target[0].team === "player" ? .33 : -.33;
            let mod = modifiers.find(m => m.name === "Personal Request" && m.caster === this);
            let effect = 1;
            this.previousAction = [true, true, true];
            this.resource.stamina -= 10;
            this.resource.mana -= 10;
            this.resource.energy -= 10;
            if (mod) {
                if (mod.vars.targets[0] !== target[0]) { effect = Math.max(mod.vars.effect - 1, 1) }
                else { effect += mod.vars.effect }
                removeModifier(mod);
            }
            new Modifier("Personal Request", "Changes stats", { caster: this, targets: target, duration: 2, attributes: ["physical", "mystic", "techno"], elements: ["light/illusion", "harmonic/change", "radiance/purity"], stats: ["attack", "defense", "accuracy", "evasion", "focus", "resist", "speed", "presence"], values: [], effect: effect, baseVal: statIncrease, changeStat: false, listeners: { turnEnd: true, statChange: true }, cancel: false, applied: true, focus: true },
                function() {
                    for (const stat of this.vars.stats) { this.vars.values.push(Math.floor(this.vars.caster[stat] * this.vars.baseVal * (3 + this.vars.effect)/4)) }
                    resetStat(this.vars.targets[0], this.vars.stats, this.vars.values);
                },
                function(context) {
                    if (this.vars.cancel && this.vars.applied) {
                        resetStat(this.vars.targets[0], this.vars.stats, this.vars.values, false);
                        this.vars.applied = false;
                    } else if (!this.vars.cancel && !this.vars.applied) {
                        resetStat(this.vars.targets[0], this.vars.stats, this.vars.values);
                        this.vars.applied = true;
                    }
                    if (!this.vars.changeStat && context.statList && context.unit === this.vars.caster && context.statList.filter(s => this.vars.stats.includes(s)).length > 0) { this.vars.changeStat = true }
                    else if (!context?.statList) {
                        if (this.vars.changeStat) {
                            resetStat(this.vars.targets[0], this.vars.stats, this.vars.values, false);
                            this.vars.values.length = 0;
                            for (const stat of this.vars.stats) { this.vars.values.push(Math.floor(this.vars.caster[stat] * this.vars.baseVal * (3 + this.vars.effect)/4)) }
                            resetStat(this.vars.targets[0], this.vars.stats, this.vars.values);
                            this.vars.changeStat = false;
                        }
                        if (context.unit === this.vars.caster) { this.vars.duration-- }
                    }
                    if (this.vars.duration === 0) { return true }
                }
            );
        }
    };
})