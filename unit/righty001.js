import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Righty001 = new Unit("Righty_001", [1750, 100, 40, 250, 60, 250, 60, 200, 140, "mid", 175, 130, 14, undefined, undefined, 90, 10], ["light/illusion", "anomaly/synthetic", "independence/loneliness", "ingenuity/insanity"], function() {
    this.actions.trickShot = {
        name: "Trick Shot [stamina, energy]",
        properties: ["physical", "stamina", "techno", "energy", "attack", "multitarget"],
        cost: { stamina: 20, energy: 35 },
        description: "Costs 20 stamina & 35 energy\nMakes 4 attacks against multiple targets with increased accuracy and crit chance, attacks per target decreases by number of targets",
        points: 60,
        target: () => {
            if (this.resource.stamina < 20 || this.resource.energy < 35) {
                showMessage("Not enough resources!", "error", "selection");
                return;
            }
            this.team === "player" ? selectTarget(this.actions.trickShot, () => { playerTurn(this) }, [4, false, unitFilter("enemy", "front", false)]) : this.actions.trickShot.code(randTarget(unitFilter("player", "front", false), Math.random() < .5 ? 1 : Math.random() < .5 ? 2 : 4));
        },
        code: (targets) => {
            this.resource.stamina -= 20;
            this.resource.energy -= 35;
            this.previousAction[0] = this.previousAction[2] = true;
            logAction(`${this.name} goes for a trickshot!`, "action");
            attack(this, targets, Math.floor(4 / targets.length), { attacker: { accuracy: this.accuracy + 100, focus: this.focus + 100 } });
        }
    };

    this.actions.snipe = {
        name: "Snipe [stamina, energy]",
        properties: ["physical", "stamina", "techno", "energy", "attack"],
        cost: { position: "back", stamina: 10, energy: 20 },
        description: "Costs 10 stamina & 20 energy\nBackline only\nAttacks a single target with increased accuracy, crit chance, and crit damage, decrease speed and evasion for 1 turn, can target backline",
        points: 60,
        target: () => {
            if (this.resource.stamina < 10 || this.resource.energy < 20) {
                showMessage("Not enough resources!", "error", "selection");
                return;
            }
            this.team === "player" ? selectTarget(this.actions.snipe, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "", false)]) : this.actions.snipe.code(randTarget(unitFilter("player", "", false)));
        },
        code: (target) => {
            const statDecrease = [5, 10]
            this.resource.stamina -= 10;
            this.resource.energy -= 20;
            this.previousAction[0] = this.previousAction[2] = true;
            logAction(`${this.name} headshots ${target[0].name}!`, "action");
            attack(this, target, 1, { attacker: { attack: this.attack + 38, accuracy: this.accuracy + 60, focus: this.focus + 70 } });
            basicModifier("Snipe cooldown", "decreased evasion and speed", { caster: this, target: this, duration: 1, stats: ["evasion", "speed"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: false, penalty: true });
        }
    };

    this.actions.fastReload = {
        name: "Fast Reload [physical]",
        properties: ["physical", "attack"],
        cost: { position: "back" },
        description: `Backline only\nRegains some of energy (${this.resource.energyRegen * 2})`,
        points: 60,
        code: () => {
            this.previousAction[0] = true;
            logAction(`${this.name} reloads instead of switching to secondary!`, "heal");
            if (eventState.resourceChange.length) {handleEvent('resourceChange', { effect: this.actions.fastReload, unit: this, resource: ['energy'], value: [this.resource.energyRegen * 2] }) }
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + this.resource.energyRegen * 2);
        }
    };

    this.actions.flashbang = {
        name: "Flashbang [energy]",
        properties: ["techno", "energy", "light/illusion", "debuff", "stun"],
        cost: { position: "front", energy: 30 },
        description: "Costs 30 energy\nFrontline only\nChance to reduce speed and evasion of a single target for 1 turn, smaller chance to also stun",
        points: 60,
        target: () => {
            if (this.resource.energy < 30) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            this.team === "player" ? selectTarget(this.actions.flashbang, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.flashbang.code(randTarget(unitFilter("player", "front", false)));
        },
        code: (target) => {
            this.resource.energy -= 30;
            this.previousAction[2] = true;
            const bonus = 2 ** (elementBonus(this, this.actions.flashbang) - elementBonus(target[0], this.actions.flashbang));
            const statDecrease = [Math.floor(-50 * bonus + Number.EPSILON), Math.floor(-30 * bonus + Number.EPSILON)];
            const will = resistDebuff(this, target);
            switch (true) {
                case will[0] > 93 - (31 * bonus):
                    logAction(`${this.name} stuns ${target[0].name}!`, "debuff");
                    new Modifier("Flashbang stun", "stun effect",
                        { caster: this, target: target[0], duration: 1, attributes: ["techno"], elements: ["light/illusion"], listeners: {turnEnd: true}, cancel: false, applied: true, focus: false, modlist: null },
                        function() {
                            this.vars.target.stun++;
                            if (eventState.stun.length) {handleEvent('stun', { effect: this, unit: this.vars.target, stun: true }) }
                            if (this.vars.targets[0].stun) {
                                this.vars.modlist = modifiers.filter( m => m.vars.caster === this.vars.target && m.vars.focus === true);
                                for (const mod of this.vars.modlist) {
                                    modifiers.push(mod);
                                    mod.cancel();
                                    modifiers.pop();
                                }
                            }
                        },
                        function(context) {
                            if (this.vars.target === context?.unit) { this.vars.duration-- }
                            if (this.vars.duration === 0) { return true }
                        },
                        function() {
                            if (this.vars.cancel && this.vars.applied) {
                                this.vars.target.stun--;
                                this.vars.applied = false;
                                if (eventState.stun.length) {handleEvent('stun', { effect: this, unit: this.vars.target, stun: false }) }
                                if (!this.vars.target.stun) {
                                    for (const mod of this.vars.modlist) {
                                        modifiers.push(mod);
                                        mod.cancel(false);
                                        modifiers.pop();
                                    }
                                }
                            }
                            else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.targets[0].stun++;
                                this.vars.applied = true;
                                if (eventState.stun.length) {handleEvent('stun', { effect: this, unit: this.vars.target, stun: true }) }
                                if (this.vars.target.stun) {
                                    this.vars.modlist = modifiers.filter( m => m.vars.caster === this.vars.target && m.vars.focus === true);
                                    for (const mod of this.vars.modlist) {
                                        modifiers.push(mod);
                                        mod.cancel();
                                        modifiers.pop();
                                    }
                                }
                            }
                        }
                    );
                    will.push(1);
                case will[0] > 30 - (10 * bonus):
                    if (!will[1]) { logAction(`${this.name} partially disorients ${target[0].name}!`, "debuff") }
                    const mod = basicModifier("Flashbang", "Reduced speed and evasion", { caster: this, target: target[0], duration: 1, attributes: ["techno"], elements: ["light/illusion"], stats: ["speed", "evasion"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: false, penalty: true });
                    mod.changeTarget = function(unit) {
                        if (unit === this.vars.target) { removeModifier(this) }
                        else {
                            if (this.vars.applied) { resetStat(this.vars.target, this.vars.stats, this.vars.values, false) }
                            const bonus = 2 ** (elementBonus(this, this.actions.flashbang) - elementBonus(target[0], this.actions.flashbang));
                            this.vars.target = unit;
                            this.vars.values = [Math.floor(-50 * bonus + Number.EPSILON), Math.floor(-30 * bonus + Number.EPSILON)];
                            if (this.vars.applied) { resetStat(unit, this.vars.stats, this.vars.values) }
                        }
                    }
                    break;
                default:
                    logAction(`${target[0].name} fully resists the flashbang!`, "miss");
            }
        }
    };

    this.actions.dodge = {
        name: "Dodge [physical]",
        properties: ["physical", "buff"],
        cost: { position: "front" },
        description: "Frontline only\nSlightly increases defense and resist, slightly decreases presence, and increases evasion for 1 turn",
        points: 60,
        code: () => {
            const statIncrease = [2, 12, 7, -2];
            this.previousAction[0] = true;
            logAction(`${this.name} dodges.`, "buff");
            basicModifier("Dodge", "Evasion and resist increased", { caster: this, target: this, duration: 1, attributes: ["physical"], stats: ["defense", "evasion", "resist", "presence"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.adrenalinePack = {
        name: "Adrenaline Pack [physical, techno]",
        properties: ["physical", "techno", "anomaly/synthetic", "attack"],
        description: `Greatly increases presence, greatly decreases accuracy and crit chance and resist, increases attack, evasion, and speed, and regains stamina (${this.resource.staminaRegen}) and HP (${this.resource.healFactor}) for 4 turns`,
        points: 60,
        code: () => {
            const statIncrease = [100, 22, 5, 10];
            const statDecrease = [-50, -50, -25];
            this.previousAction[0] = this.previousAction[2] = true;
            new Modifier("Adrenaline Pack", "Healing and resource regen and additional stats",
                { caster: this, target: this, duration: 4, attributes: ["physical"], elements: ["anomaly/synthetic", "independence/loneliness", "ingenuity/insanity"], buffs: ["presence", "attack", "evasion", "speed"], buffValues: statIncrease, debuffs: ["accuracy", "focus", "resist"], debuffValues: statDecrease, listeners: {turnEnd: true}, cancel: false, applied: true, focus: false },
                function() { resetStat(this.vars.target, [ ...this.vars.buffs, ...this.vars.debuffs], [...this.vars.buffValues, ...this.vars.debuffValues]) },
                function(context) {
                    if (this.vars.target === context?.unit) {
                        if (this.vars.applied) {
                            if (eventState.resourceChange.length) { handleEvent('resourceChange', { effect: this.vars.mod, unit: this.vars.target, resource: ['hp', 'stamina'], value: [this.vars.target.resource.healFactor, this.vars.target.resource.staminaRegen] }) }
                            this.vars.target.hp = Math.min(this.vars.target.hp + (this.vars.target.resource.healFactor), this.vars.target.base.hp);
                            this.vars.target.resource.stamina = Math.min(this.vars.target.resource.stamina + this.vars.target.resource.staminaRegen, this.vars.target.base.resource.stamina);
                        }
                        this.vars.duration--;
                    }
                    if (this.vars.duration <= 0) { return true }
                },
                function() {
                    if (this.vars.cancel && this.vars.applied) {
                        resetStat(this.vars.target, [ ...this.vars.buffs, ...this.vars.debuffs], [...this.vars.buffValues, ...this.vars.debuffValues], false);
                        this.vars.applied = false;
                    }
                    else if (!this.vars.cancel && !this.vars.applied) {
                        resetStat(this.vars.target, [ ...this.vars.buffs, ...this.vars.debuffs], [...this.vars.buffValues, ...this.vars.debuffValues]);
                        this.vars.applied = true;
                    }
                }
            );
        }
    };

    this.actions.switchPosition = {
        name: "Switch Position [physical]",
        properties: ["physical", "position"],
        description: "Switch between front and back line positions",
        code: () => {
            this.previousAction[0] = true;
            if (eventState.positionChange.length) {handleEvent('positionChange', { unit: this, position: this.position === "back" ? "front" : "back" }) }
            if (this.position === "back") {
                this.position = "front";
                logAction(`${this.name} moves to the frontline.`, "info");
                this.base.attack = 120;
                this.base.defense = 30;
                this.base.accuracy = 280;
                this.base.evasion = 40;
                this.base.focus = 280;
                this.base.resist = 75;
                this.base.speed = 290;
                this.base.presence = 155;
                this.actions.actionWeight = { 
                    trickShot: 0.3,
                    snipe: 0,
                    fastReload: 0,
                    flashbang: 0.25,
                    dodge: 0.25,
                    adrenalinePack: 0.1,
                    switchPosition: 0.1
                };
            } else {
                this.position = "back";
                logAction(`${this.name} moves to the backline.`, "info");
                this.base.attack = 100;
                this.base.defense = 40;
                this.base.accuracy = 250;
                this.base.evasion = 60;
                this.base.focus = 250;
                this.base.resist = 60;
                this.base.speed = 200;
                this.base.presence = 140;
                this.actions.actionWeight = { 
                    trickShot: 0.3,
                    snipe: 0.25,
                    fastReload: 0.25,
                    flashbang: 0,
                    dodge: 0,
                    adrenalinePack: 0.1,
                    switchPosition: 0.1
                };
            }
            resetStat(this, ["attack", "defense", "accuracy", "evasion", "focus", "resist", "speed", "presence"]);
        }
    };

    this.actions.actionWeight = { 
        trickShot: 0.3,
        snipe: 0.25,
        fastReload: 0.25,
        flashbang: 0,
        dodge: 0,
        adrenalinePack: 0.1,
        switchPosition: 0.1
    };
})