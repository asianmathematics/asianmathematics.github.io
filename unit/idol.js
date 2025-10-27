import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Idol = new Unit("Idol", [750, 44, 20, 125, 30, 130, 50, 60, 240, "back", 70, 120, 16, 150, 20, 90, 15], ["light/illusion", "harmonic/change", "radiance/purity", "anomaly/synthetic"], function() {
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
            const mod = modifiers.find(m => m.name === "Soothing Melody" && m.vars.caster === this);
            let effect = 1;
            this.previousAction = [true, true, true];
            this.resource.stamina -= 10;
            this.resource.mana -= 20;
            if (mod) {
                if (mod.vars.targets[0] !== target[0]) { effect = Math.max(mod.vars.effect - 1, 1) }
                else { effect += mod.vars.effect }
                removeModifier(mod);
            }
            new Modifier("Soothing Melody", "Heal and increase defensive stats and presence", { caster: this, targets: target, duration: 2, attributes: ["physical", "mystic", "techno"], elements: ["light/illusion", "harmonic/change", "radiance/purity"], stats: ["presence", "defense", "evasion", "resist"], values: statIncrease, elementBonus: 0, effect: effect, listeners: { turnEnd: true }, cancel: false, applied: true, focus: true },
                function() {
                    if (eventState.resourceChange.flag) { handleEvent('resourceChange', {unit: this.vars.targets[0], resource: ['hp'], amount: [Math.floor(this.vars.targets[0].resource.healFactor * (3 + this.vars.effect)/4 * (1.5 ** this.vars.elementBonus))]}) }
                    this.vars.targets[0].hp = Math.min(this.vars.targets[0].hp + Math.floor(this.vars.targets[0].resource.healFactor * (3 + this.vars.effect)/4 * (1.5 ** this.vars.elementBonus)), this.vars.targets[0].base.hp);
                    logAction(`${this.vars.caster.name} sings a soothing melody, healing ${this.vars.targets[0].name} for ${Math.floor(this.vars.targets[0].resource.healFactor * (3 + this.vars.effect)/4 * (1.5 ** this.vars.elementBonus))} HP!`, "heal");
                    this.vars.elementBonus = elementBonus(this.vars.targets[0], this)
                    this.vars.values = this.vars.values.map(val => val *= (3 + this.vars.effect)/4 * (1.5 ** this.vars.elementBonus));
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
                    if (context.unit === this.vars.caster) { this.vars.duration-- }
                    if (this.vars.duration === 0) { return true }
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
            const mod = modifiers.find(m => m.name === "Rhythmic Frenzy" && m.vars.caster === this);
            let effect = 1;
            this.previousAction = [true, true, true];
            this.resource.stamina -= 20;
            this.resource.energy -= 10;
            if (mod) {
                effect += mod.vars.effect;
                removeModifier(mod);
            }
            new Modifier("Rhythmic Frenzy", "Offensive stat increase", { caster: this, targets: unitFilter("player", "front"), duration: 2, attributes: ["physical", "mystic", "techno"], elements: ["light/illusion", "harmonic/change", "radiance/purity"], stats: ["attack", "accuracy", "focus"], values: statIncrease, effect: effect, listeners: { turnEnd: true, positionChange: true }, cancel: false, applied: true, focus: true },
                function() {
                    if (this.vars.effect > 1) { this.vars.values = this.vars.values.map(v => Math.floor(v * ((3 + this.vars.effect) / 4))) }
                    for (const unit of this.vars.targets ) { resetStat(unit, this.vars.stats, this.vars.values) }
                },
                function(context) {
                    if (this.vars.cancel && this.vars.applied) {
                        for (const unit of this.vars.targets ) { resetStat(unit, this.vars.stats, this.vars.values, false) }
                        this.vars.applied = false;
                    } else if (!this.vars.cancel && !this.vars.applied) {
                        for (const unit of this.vars.targets ) { resetStat(unit, this.vars.stats, this.vars.values) }
                        this.vars.applied = true;
                    }
                    if (context.unit === this.vars.caster) { this.vars.duration-- }
                    if (context.position && context.unit.team === "player") {
                        if (context.position === "front") {
                            this.vars.targets.push(context.unit);
                            resetStat(context.unit, this.vars.stats, this.vars.values)
                        } else {
                            this.vars.targets.splice(this.vars.targets.findIndex(unit => unit === context.unit), 1);
                            resetStat(context.unit, this.vars.stats, this.vars.values, false)
                        }
                    }
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
            const mod = modifiers.find(m => m.name === "Rebellious Discord" && m.vars.caster === this);
            let effect = 1;
            this.previousAction = [true, true, true];
            this.resource.mana -= 10;
            this.resource.energy -= 20;
            if (mod) {
                effect += mod.vars.effect;
                removeModifier(mod);
            }
            new Modifier("Rebellious Discord", "Defensive stat decrease", { caster: this, targets: unitFilter("enemy", "front"), duration: 2, attributes: ["physical", "mystic", "techno"], elements: ["light/illusion", "harmonic/change", "radiance/purity"], stats: ["defense", "evasion", "resist"], values: statDecrease, effect: effect, listeners: { turnEnd: true, positionChange: true, waveChange: true }, cancel: false, applied: true, focus: true },
                function() {
                    for (let i = this.vars.target.length-1; i > -1; i--) {
                        if (resistDebuff(this.vars.caster, [this.vars.target[i]]) > 75 - (6.25 * (this.vars.effect - 1))) { resetStat(this.vars.target[i], this.vars.stats, this.vars.values) }
                        else { this.vars.targets.splice(i, 1) }
                    }
                },
                function(context) {
                    if (this.vars.cancel && this.vars.applied) {
                        for (const unit of this.vars.targets ) { resetStat(unit, this.vars.stats, this.vars.values, false) }
                        this.vars.applied = false;
                    } else if (!this.vars.cancel && !this.vars.applied) {
                        for (const unit of this.vars.targets ) { resetStat(unit, this.vars.stats, this.vars.values) }
                        this.vars.applied = true;
                    }
                    if (context.position && context.unit.team === "enemy") {
                        if (context.position === "back") {
                            this.vars.targets.splice(this.vars.targets.findIndex(unit => unit === context.unit), 1);
                            resetStat(context.unit, this.vars.stats, this.vars.values, false);
                        } else if (resistDebuff(this.vars.caster, [unit]) > 75 - (6.25 * (this.vars.effect - 1))) {
                            this.vars.targets.push(context.unit);
                            resetStat(context.unit, this.vars.stats, this.vars.values);
                        }
                    }
                    if (context.wave) {
                        this.vars.targets = unitFilter("enemy", "front");
                        for (let i = this.vars.target.length-1; i > -1; i--) {
                            if (resistDebuff(this.vars.caster, [this.vars.target[i]]) > 75 - (6.25 * (this.vars.effect - 1))) { resetStat(this.vars.target[i], this.vars.stats, this.vars.values) }
                            else { this.vars.targets.splice(i, 1) }
                        }
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
        description: `Costs 10 stamina & 10 mana & 10 energy\nIncreases or decreases targets stats with a percent of ${this.name}&#39;s stats depending if targeting on ally or enemy, benefits increase if used multiple times on the same target in a row`,
        points: 60,
        target: () => {
            if (this.resource.mana < 10 || this.resource.stamina < 10 || this.resource.energy < 10) {
                showMessage("Not enough resources!", "error", "selection");
                return;
            }
            selectTarget(this.actions.personalRequest, () => { playerTurn(this) }, [1, true, unitFilter("", "", false).filter(unit => unit !== this)]);
        },
        code: (target) => {
            const statIncrease = target[0].team === "player" ? .33 : -.33;
            const mod = modifiers.find(m => m.name === "Personal Request" && m.vars.caster === this);
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
            new Modifier("Personal Request", "Changes stats", { caster: this, targets: target, duration: 2, attributes: ["physical", "mystic", "techno"], elements: ["light/illusion", "harmonic/change", "radiance/purity"], stats: ["attack", "defense", "accuracy", "evasion", "focus", "resist", "speed", "presence"], values: [], elementBonus: 0, effect: effect, baseVal: statIncrease, changeStat: false, listeners: { turnEnd: true, statChange: true }, cancel: false, applied: true, focus: true },
                function() {
                    this.vars.elementBonus = elementBonus(this.vars.targets[0], this)
                    for (const stat of this.vars.stats) { this.vars.values.push(Math.floor(this.vars.caster[stat] * this.vars.baseVal * (3 + this.vars.effect)/4 * (1.5 ** this.vars.elementBonus))) }
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
                            for (const stat of this.vars.stats) { this.vars.values.push(Math.floor(this.vars.caster[stat] * this.vars.baseVal * (3 + this.vars.effect)/4 * (1.5 ** this.vars.elementBonus))) }
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

    this.actions.retune = {
        name: "Retune [physical, mystic, techno]",
        properties: ["physical", "mystic", "techno", "light/illusion", "harmonic/change", "radiance/purity", "heal", "buff"],
        description: `Regains some resources at the start and end of ${this.name}&#39;s turn, benefits increase if used multiple times in a row`,
        points: 60,
        code: () => {
            const statIncrease = [.5];
            const mod = modifiers.find(m => m.name === "Retune" && m.vars.caster === this);
            let effect = 1;
            this.previousAction = [true, true, true];
            if (mod) {
                effect += mod.vars.effect;
                removeModifier(mod);
            }
            new Modifier("Retune", "Increased resource regen", { caster: this, targets: [this], duration: 4, attributes: ["physical", "mystic", "techno"], elements: ["light/illusion", "harmonic/change", "radiance/purity"], values: statIncrease, effect: effect, listeners: { turnStart: true, turnEnd: true }, cancel: false, applied: true, focus: true },
                function() {},
                function(context) {
                    if (context.unit === this.vars.caster) {
                        this.vars.duration--;
                        if (this.vars.duration === 0) { return true }
                        if (this.vars.applied) {
                            if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: this, unit: this.vars.caster, resource: ['stamina' ,'mana', 'energy'], value: [Math.floor(this.resource.staminaRegen * this.vars.values[0] * (this.vars.effect + 3)/4), Math.floor(this.resource.manaRegen * this.vars.values[0] * (this.vars.effect + 3)/4), Math.floor(this.resource.energyRegen * this.vars.values[0] * (this.vars.effect + 3)/4)] }) }
                            this.vars.caster.resource.stamina = Math.min(this.vars.caster.base.resource.stamina, this.vars.caster.resource.stamina + Math.floor(this.vars.caster.resource.staminaRegen * this.vars.values[0] * (this.vars.effect + 3)/4));
                            this.vars.caster.resource.mana = Math.min(this.vars.caster.base.resource.mana, this.vars.caster.resource.mana + Math.floor(this.vars.caster.resource.manaRegen * this.vars.values[0] * (this.vars.effect + 3)/4));
                            this.vars.caster.resource.energy = Math.min(this.vars.caster.base.resource.energy, this.vars.caster.resource.energy + Math.floor(this.vars.caster.resource.energyRegen * this.vars.values[0] * (this.vars.effect + 3)/4));
                        }
                    }
                }
            );
        }
    };
})