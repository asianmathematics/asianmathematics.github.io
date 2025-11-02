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
            this.team === "player" ? selectTarget(this.actions.soothingMelody, () => { playerTurn(this) }, [1, true, unitFilter("player", "")]) : this.actions.soothingMelody.code(randTarget(unitFilter("enemy", "")));
        },
        code: (target) => {
            const bonus = this === target[0] ? 1 : 1.5 ** elementBonus(target[0], this.actions.soothingMelody);
            const statIncrease = [16 * bonus, 16 * bonus, 12 * bonus, 20 * bonus];
            const mod = modifiers.find(m => m.vars.caster === this);
            let effect = 1;
            this.previousAction = [true, true, true];
            this.resource.stamina -= 10;
            this.resource.mana -= 20;
            if (mod) {
                if (mod.name === "Soothing Melody") {
                    if (mod.vars.target !== target[0]) { effect = Math.max(mod.vars.effect - 1, 1) }
                    else { effect += mod.vars.effect }
                }
                removeModifier(mod);
            }
            new Modifier("Soothing Melody", "Heal and increase defensive stats and presence", { caster: this, target: target[0], duration: 2, attributes: ["physical", "mystic", "techno"], elements: ["light/illusion", "harmonic/change", "radiance/purity"], stats: ["presence", "defense", "evasion", "resist"], values: statIncrease, effect: effect, listeners: { turnEnd: true }, cancel: false, applied: true, focus: true },
                function() {
                    if (eventState.resourceChange.length) { handleEvent('resourceChange', {unit: this.vars.target, resource: ['hp'], value: [Math.floor(this.vars.target.resource.healFactor * (3 + this.vars.effect)/4 + Number.EPSILON)]}) }
                    this.vars.target.hp = Math.min(this.vars.target.hp + Math.floor(this.vars.target.resource.healFactor * (3 + this.vars.effect)/4 + Number.EPSILON), this.vars.target.base.hp);
                    logAction(`${this.vars.caster.name} sings a soothing melody, healing ${this.vars.target.name} for ${Math.floor(this.vars.target.resource.healFactor * (3 + this.vars.effect)/4 + Number.EPSILON)} HP!`, "heal");
                    this.vars.values = this.vars.values.map(val => val *= (3 + this.vars.effect)/4);
                    resetStat(this.vars.target, this.vars.stats, this.vars.values);
                },
                function(context) {
                    if (context.unit === this.vars.caster) { this.vars.duration-- }
                    if (this.vars.duration === 0) { return true }
                },
                function() {
                    if (this.vars.cancel && this.vars.applied) {
                        resetStat(this.vars.target, this.vars.stats, this.vars.values, false);
                        this.vars.applied = false;
                    } else if (!this.vars.cancel && !this.vars.applied) {
                        resetStat(this.vars.target, this.vars.stats, this.vars.values);
                        this.vars.applied = true;
                    }
                },
                function(unit) {
                    if (unit === this.vars.target) {
                        if (this.vars.applied) { resetStat(this.vars.target, this.vars.stats, this.vars.values, false) }
                        this.vars.target = null;
                    } else {
                        if (this.vars.applied) { resetStat(this.vars.target, this.vars.stats, this.vars.values, false) }
                        const bonus = (2 ** elementBonus(unit, this)) * (3 + this.vars.effect)/4;
                        this.vars.target = unit;
                        this.vars.values = [16 * bonus, 16 * bonus, 12 * bonus, 20 * bonus];
                        if (this.vars.applied) { resetStat(unit, this.vars.stats, this.vars.values) }
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
            const mod = modifiers.find(m => m.vars.caster === this);
            let effect = 1;
            this.previousAction = [true, true, true];
            this.resource.stamina -= 20;
            this.resource.energy -= 10;
            if (mod) {
                if (mod.name === "Rhythmic Frenzy") { effect += mod.vars.effect }
                removeModifier(mod);
            }
            new Modifier("Rhythmic Frenzy", "Offensive stat increase", { caster: this, targets: unitFilter(this.team, "front"), duration: 2, attributes: ["physical", "mystic", "techno"], elements: ["light/illusion", "harmonic/change", "radiance/purity"], stats: ["attack", "accuracy", "focus"], values: statIncrease, bonusArray: [], effect: effect, listeners: { turnEnd: true, positionChange: true }, cancel: false, applied: true, focus: true },
                function() {
                    logAction(`${this.vars.caster.name} is exciting the frontlines!`, "buff");
                    if (this.vars.effect > 1) { this.vars.values = this.vars.values.map(v => Math.floor(v * ((3 + this.vars.effect) / 4) + Number.EPSILON)) }
                    for (let i = 0; i < this.vars.targets.length; i++) {
                        this.vars.bonusArray[i] = elementBonus(this.vars.targets[i], this);
                        resetStat(this.vars.targets[i], this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[i] + Number.EPSILON)));
                    }
                },
                function(context) {
                    if (context.unit === this.vars.caster) { this.vars.duration-- }
                    if (context.position && context.unit.team === this.vars.caster.team) {
                        if (context.position === "front") {
                            this.vars.bonusArray[this.vars.bonusArray.length] = elementBonus(context.unit, this);
                            this.vars.targets.push(context.unit);
                            resetStat(context.unit, this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[this.vars.bonusArray.length - 1] + Number.EPSILON)))
                        } else {
                            resetStat(context.unit, this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[this.vars.targets.indexOf(context.unit)] + Number.EPSILON)), false)
                            this.vars.bonusArray.splice(this.vars.targets.indexOf(context.unit), 1);
                            this.vars.targets.splice(this.vars.targets.indexOf(context.unit), 1);
                        }
                    }
                    if (this.vars.duration === 0) { return true }
                },
                function() {
                    if (this.vars.cancel && this.vars.applied) {
                        for (let i = this.vars.targets.length - 1; i >= 0; i--) { resetStat(this.vars.targets[i], this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[i] + Number.EPSILON), false)) }
                        this.vars.applied = false;
                    }
                    else if (!this.vars.cancel && !this.vars.applied) {
                        for (let i = this.vars.targets.length - 1; i >= 0; i--) { resetStat(this.vars.targets[i], this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[i] + Number.EPSILON))) }
                        this.vars.applied = true;
                    }
                },
                function(remove = [], add = []) {
                    if (remove.length - add.length >= this.vars.targets.length) {
                        if (this.vars.applied) { for (let i = this.vars.targets.length - 1; i >= 0; i--) { resetStat(this.vars.targets[i], this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[i] + Number.EPSILON), false)) } }
                        this.vars.targets = this.vars.bonusArray = [];
                    } else {
                        if (this.vars.applied) { for (let i = this.vars.targets.length - 1; i >= 0; i--) { resetStat(this.vars.targets[i], this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[i] + Number.EPSILON), false)) } }
                        for (let i = this.vars.targets.length - 1; i >= 0; i--) {
                            if (remove.includes(this.vars.targets[i])) {
                                if (this.vars.applied) { resetStat(this.vars.targets[i], this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[i] + Number.EPSILON), false)) }
                                this.vars.targets.splice(i, 1);
                                this.vars.bonusArray.splice(i, 1);
                            }
                        }
                        let index = this.vars.targets.length;
                        this.vars.targets.push(...add);
                        this.vars.bonusArray.push(...add.map(unit => elementBonus(unit, this)));
                        if (this.vars.applied) { for (let i = index; i < this.vars.targets.length; i++) { resetStat(this.vars.targets[i], this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[i] + Number.EPSILON))) } }
                    }
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
            const mod = modifiers.find(m => m.vars.caster === this);
            let effect = 1;
            this.previousAction = [true, true, true];
            this.resource.mana -= 10;
            this.resource.energy -= 20;
            if (mod) {
                if (mod.name === "Rebellious Discord") { effect += mod.vars.effect }
                removeModifier(mod);
            }
            new Modifier("Rebellious Discord", "Defensive stat decrease", { caster: this, targets: unitFilter(this.team === "player" ? "enemy" : "player", "front"), duration: 2, attributes: ["physical", "mystic", "techno"], elements: ["light/illusion", "harmonic/change", "radiance/purity"], stats: ["defense", "evasion", "resist"], values: statDecrease, bonusArray: [], effect: effect, listeners: { turnEnd: true, positionChange: true, waveChange: this.team === "player" }, cancel: false, applied: true, focus: true, debuff: function(unit) { return resistDebuff(this.vars.caster, unit) > 75 - (6.25 * (this.vars.effect - 1)) * (4 ** (elementBonus(this.vars.caster, this) - elementBonus(unit, this))) } },
                function() {
                    logAction(`${this.vars.caster.name} is riling up the otherside!`, "debuff");
                    this.vars.bonusArray.length = this.vars.targets.length;
                    for (let i = this.vars.targets.length - 1; i > -1; i--) {
                        this.vars.bonusArray[i] = 2 ** (elementBonus(this.vars.caster, this) - elementBonus(this.vars.targets[i], this));
                        if (resistDebuff(this.vars.caster, [this.vars.targets[i]]) > 75 - (6.25 * (this.vars.effect - 1) * this.vars.bonusArray[i])) { resetStat(this.vars.targets[i], this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[i] + Number.EPSILON))) }
                        else {
                            this.vars.targets.splice(i, 1);
                            this.vars.bonusArray.splice(i, 1)
                        }
                    }
                },
                function(context) {
                    if (context.position && context.unit.team === (this.vars.caster.team === "player" ? "enemy" : "player")) {
                        if (context.position === "back") {
                            resetStat(context.unit, this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[this.vars.targets.indexOf(context.unit)] + Number.EPSILON)), false)
                            this.vars.bonusArray.splice(this.vars.targets.indexOf(context.unit), 1);
                            this.vars.targets.splice(this.vars.targets.indexOf(context.unit), 1);
                        } else if (resistDebuff(this.vars.caster, [context.unit]) > 75 - (6.25 * (this.vars.effect - 1))) {
                            this.vars.bonusArray[this.vars.bonusArray.length] = elementBonus(context.unit, this);
                            this.vars.targets.push(context.unit);
                            resetStat(context.unit, this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[this.vars.bonusArray.length - 1] + Number.EPSILON)))
                        }
                    }
                    if (context.wave) {
                        this.vars.targets = unitFilter("enemy", "front");
                        this.vars.bonusArray.length = this.vars.targets.length;
                        for (let i = this.vars.targets.length - 1; i > -1; i--) {
                            this.vars.bonusArray[i] = 2 ** (elementBonus(this.vars.caster, this) - elementBonus(this.vars.targets[i], this));
                            if (resistDebuff(this.vars.caster, [this.vars.targets[i]]) > 75 - (6.25 * (this.vars.effect - 1) * this.vars.bonusArray[i])) { resetStat(this.vars.targets[i], this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[i] + Number.EPSILON))) }
                            else {
                                this.vars.targets.splice(i, 1);
                                this.vars.bonusArray.splice(i, 1)
                            }
                        }
                    }
                    if (context.unit === this.vars.caster) { this.vars.duration-- }
                    if (this.vars.duration === 0) { return true }
                },
                function() {
                    if (this.vars.cancel && this.vars.applied) {
                        for (let i = this.vars.targets.length - 1; i >= 0; i--) { resetStat(this.vars.targets[i], this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[i] + Number.EPSILON), false)) }
                        this.vars.applied = false;
                    }
                    else if (!this.vars.cancel && !this.vars.applied) {
                        for (let i = this.vars.targets.length - 1; i >= 0; i--) { resetStat(this.vars.targets[i], this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[i] + Number.EPSILON))) }
                        this.vars.applied = true;
                    }
                },
                function(remove = [], add = []) {
                    if (remove.length - add.length >= this.vars.targets.length) {
                        if (this.vars.applied) { for (let i = this.vars.targets.length - 1; i >= 0; i--) { resetStat(this.vars.targets[i], this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[i] + Number.EPSILON), false)) } }
                        this.vars.targets = this.vars.bonusArray = [];
                    } else {
                        if (this.vars.applied) { for (let i = this.vars.targets.length - 1; i >= 0; i--) { resetStat(this.vars.targets[i], this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[i] + Number.EPSILON), false)) } }
                        for (let i = this.vars.targets.length - 1; i >= 0; i--) {
                            if (remove.includes(this.vars.targets[i])) {
                                if (this.vars.applied) { resetStat(this.vars.targets[i], this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[i] + Number.EPSILON), false)) }
                                this.vars.targets.splice(i, 1);
                                this.vars.bonusArray.splice(i, 1);
                            }
                        }
                        let index = this.vars.targets.length;
                        this.vars.targets.push(...add);
                        this.vars.bonusArray.push(...add.map(unit => elementBonus(unit, this)));
                        if (this.vars.applied) { for (let i = index; i < this.vars.targets.length; i++) { resetStat(this.vars.targets[i], this.vars.stats, this.vars.values.map(value => Math.floor(value * this.vars.bonusArray[i] + Number.EPSILON))) } }
                    }
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
            this.team === "player" ? selectTarget(this.actions.personalRequest, () => { playerTurn(this) }, [1, true, unitFilter("", "", false).filter(unit => unit !== this)]) : this.actions.personalRequest.code(randTarget(unitFilter("", "", false).filter(unit => unit !== this)));
        },
        code: (target) => {
            const statIncrease = target[0].team === this.team ? .33 * (1.5 ** elementBonus(target[0], this.actions.personalRequest)): -.33 * (1.5 ** (elementBonus(this, this.actions.personalRequest) - elementBonus(target[0], this.actions.personalRequest)));
            const mod = modifiers.find(m => m.vars.caster === this);
            let effect = 1;
            this.previousAction = [true, true, true];
            this.resource.stamina -= 10;
            this.resource.mana -= 10;
            this.resource.energy -= 10;
            if (mod) {
                if (mod.name === "Personal Request") {
                    if (mod.vars.target !== target[0]) { effect = Math.max(mod.vars.effect - 1, 1) }
                    else { effect += mod.vars.effect }
                }
                removeModifier(mod);
            }
            new Modifier("Personal Request", "Changes stats", { caster: this, target: target[0], duration: 2, attributes: ["physical", "mystic", "techno"], elements: ["light/illusion", "harmonic/change", "radiance/purity"], stats: ["attack", "defense", "accuracy", "evasion", "focus", "resist", "speed", "presence"], values: [], effect: effect, baseVal: statIncrease, changeStat: false, listeners: { turnEnd: true, statChange: true }, cancel: false, applied: true, focus: true },
                function() {
                    logAction(`${this.vars.caster.name} sings a song just for ${this.vars.target.name}!`, "action");
                    for (const stat of this.vars.stats) { this.vars.values.push(Math.floor(this.vars.caster[stat] * this.vars.baseVal * (3 + this.vars.effect)/4 + Number.EPSILON)) }
                    resetStat(this.vars.target, this.vars.stats, this.vars.values);
                },
                function(context) {
                    if (!this.vars.changeStat && context.statList && context.unit === this.vars.caster && context.statList.filter(s => this.vars.stats.includes(s)).length > 0) { this.vars.changeStat = true }
                    else if (!context?.statList) {
                        if (this.vars.changeStat) {
                            if (this.vars.applied) { resetStat(this.vars.target, this.vars.stats, this.vars.values, false) }
                            this.vars.values.length = 0;
                            for (const stat of this.vars.stats) { this.vars.values.push(Math.floor(this.vars.caster[stat] * this.vars.baseVal * (3 + this.vars.effect)/4 + Number.EPSILON)) }
                            if (this.vars.applied) { resetStat(this.vars.target, this.vars.stats, this.vars.values) }
                            this.vars.changeStat = false;
                        }
                        if (context.unit === this.vars.caster) { this.vars.duration-- }
                    }
                    if (this.vars.duration === 0) { return true }
                },
                function() {
                    if (this.vars.cancel && this.vars.applied) {
                        resetStat(this.vars.target, this.vars.stats, this.vars.values, false);
                        this.vars.applied = false;
                    } else if (!this.vars.cancel && !this.vars.applied) {
                        resetStat(this.vars.target, this.vars.stats, this.vars.values);
                        this.vars.applied = true;
                    }
                },
                function(unit) {
                    if (unit === this.vars.target) {
                        resetStat(this.vars.target, this.vars.stats, this.vars.values, false);
                        this.vars.target = null;
                    }
                    else {
                        if (this.vars.applied) { resetStat(this.vars.target, this.vars.stats, this.vars.values, false) }
                        this.vars.target = unit;
                        this.vars.values.length = 0;
                        this.vars.baseVal =  this.vars.baseVal > 0 ? .33 * (1.5 ** elementBonus(unit, this)) : -.33 * (1.5 ** (elementBonus(this.vars.caster, this) - elementBonus(unit, this)));
                        for (const stat of this.vars.stats) { this.vars.values.push(Math.floor(this.vars.caster[stat] * this.vars.baseVal * (3 + this.vars.effect)/4 + Number.EPSILON)) }
                        if (this.vars.applied) { resetStat(unit, this.vars.stats, this.vars.values) }
                    }
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
            const mod = modifiers.find(m => m.vars.caster === this);
            let effect = 1;
            this.previousAction = [true, true, true];
            if (mod) {
                if (mod.name === "Retune") { effect += mod.vars.effect }
                removeModifier(mod);
            }
            new Modifier("Retune", "Increased resource regen", { caster: this, target: this, duration: 4, attributes: ["physical", "mystic", "techno"], elements: ["light/illusion", "harmonic/change", "radiance/purity"], values: statIncrease, effect: effect, listeners: { turnEnd: true }, cancel: false, applied: true, focus: true },
                function() { logAction(`${this.vars.caster.name} is preparing for the next performance!`, "action") },
                function(context) {
                    if (context.unit === this.vars.target) {
                        this.vars.duration--;
                        if (this.vars.duration === 0) { return true }
                        if (this.vars.applied) {
                            if (eventState.resourceChange.length) { handleEvent('resourceChange', { effect: this, unit: this.vars.target, resource: ['stamina' ,'mana', 'energy'], value: [Math.floor(this.vars.target.resource.staminaRegen * (1 + (this.vars.values[0] * (this.vars.effect + 3)/4)) + Number.EPSILON), Math.floor(this.vars.target.resource.manaRegen * (1 + (this.vars.values[0] * (this.vars.effect + 3)/4)) + Number.EPSILON), Math.floor(this.vars.target.resource.energyRegen * (1 + (this.vars.values[0] * (this.vars.effect + 3)/4)) + Number.EPSILON)] }) }
                            this.vars.target.resource.stamina = Math.min(this.vars.target.base.resource.stamina, this.vars.target.resource.stamina + Math.floor(this.vars.target.resource.staminaRegen * (1 + (this.vars.values[0] * (this.vars.effect + 3)/4)) + Number.EPSILON));
                            this.vars.target.resource.mana = Math.min(this.vars.target.base.resource.mana, this.vars.target.resource.mana + Math.floor(this.vars.target.resource.manaRegen * (1 + (this.vars.values[0] * (this.vars.effect + 3)/4)) + Number.EPSILON));
                            this.vars.target.resource.energy = Math.min(this.vars.target.base.resource.energy, this.vars.target.resource.energy + Math.floor(this.vars.target.resource.energyRegen * (1 + (this.vars.values[0] * (this.vars.effect + 3)/4)) + Number.EPSILON));
                        }
                    }
                },
                function(cancel, temp) {
                    if (!temp) {
                        if (this.vars.cancel && this.vars.applied) { this.vars.applied = false }
                        else if (!this.vars.cancel && !this.vars.applied) { this.vars.applied = true }
                    }
                }
            );
        }
    };
    
    this.actions.actionWeight = { 
        soothingMelody: 0.25,
        rhythmicFrenzy: 0.2,
        rebelliousDiscord: 0.2,
        personalRequest: 0.1,
        retune: 0.25
    };
})