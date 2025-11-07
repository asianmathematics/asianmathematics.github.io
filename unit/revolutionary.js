import { Unit } from './unit.js';
import { Modifier, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Revolutionary = new Unit("Revolutionary", [800, 40, 12, 100, 15, 110, 20, 90, 90, "mid", 80, 120, 15, , , 70, 9], ["anomaly/synthetic", "passion/hatred"], function() {
    this.actions.energyRifle = {
        name: "Energy Rifle [energy]",
        properties: ["techno", "energy", "radiance/purity", "attack"],
        cost: { energy: 20 },
        description: "Costs 20 energy\nAttacks a single target 4 times with increased accuracy and damage",
        points: 60,
        target: () => {
            if (this.resource.energy < 20) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            this.team === "player" ? selectTarget(this.actions.energyRifle, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.energyRifle.code(randTarget(unitFilter("player", "front", false)));
        },
        code: (target) => {
            this.resource.energy -= 20;
            this.previousAction[2] = true;
            logAction(`${this.name} fires at ${target[0].name}!`, "action");
            attack(this, target, 4, { attacker: { accuracy: this.accuracy + 35, attack: this.attack + 10 } });
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
                            } else if (!this.vars.cancel && !this.vars.applied) {
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
                    basicModifier("Flashbang", "Reduced speed and evasion", { caster: this, target: target[0], duration: 1, attributes: ["techno"], elements: ["light/illusion"], stats: ["speed", "evasion"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: false, penalty: true },
                        function(unit) {
                            if (unit === this.vars.target) { removeModifier(this) }
                            else {
                                if (this.vars.applied) { resetStat(this.vars.target, this.vars.stats, this.vars.values, false) }
                                const bonus = 2 ** (elementBonus(this, this.actions.flashbang) - elementBonus(target[0], this.actions.flashbang));
                                this.vars.target = unit;
                                this.vars.values = [Math.floor(-50 * bonus + Number.EPSILON), Math.floor(-30 * bonus + Number.EPSILON)];
                                if (this.vars.applied) { resetStat(unit, this.vars.stats, this.vars.values) }
                            }
                        }
                    );
                    break;
                default:
                    logAction(`${target[0].name} fully resists the flashbang!`, "miss");
            }
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
            const statDecrease = [5, 10];
            this.resource.stamina -= 10;
            this.resource.energy -= 20;
            this.previousAction[0] = this.previousAction[2] = true;
            logAction(`${this.name} headshots ${target[0].name}!`, "action");
            attack(this, target, 1, { attacker: { attack: this.attack + 38, accuracy: this.accuracy + 60, focus: this.focus + 70 } });
            basicModifier("Snipe cooldown", "decreased evasion and speed", { caster: this, target: this, duration: 1, stats: ["evasion", "speed"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: false, penalty: true });
        }
    };

    this.actions.sneak = {
        name: "Sneak [stamina]",
        properties: ["physical", "stamina", "buff"],
        cost: { stamina: 30 },
        description: "Costs 30 stamina\nLowers presence and increases crit chance and resist for 1 turn",
        points: 60,
        code: () => {
            if (this.resource.stamina < 30) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            const statIncrease = [30, 15, -50];
            this.resource.stamina -= 30;
            this.previousAction[0] = true;
            logAction(`${this.name} drew attention away!`, "buff");
            basicModifier("Sneak", "Combat focus modification", { caster: this, target: this, duration: 2, attributes: ["physical"], stats: ["focus", "resist", "presence"], values: statIncrease, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true });
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
                this.base.attack = 46;
                this.base.defense = 9;
                this.base.accuracy = 110;
                this.base.evasion = 10;
                this.base.focus = 120;
                this.base.resist = 15;
                this.base.speed = 100;
                this.base.presence = 100;
                this.actions.actionWeight = {
                    energyRifle: 0.2,
                    flashbang: 0.4,
                    snipe: 0,
                    sneak: 0.2,
                    switchPosition: 0.2
                };
            } else {
                this.position = "back";
                logAction(`${this.name} moves to the backline.`, "info");
                this.base.attack = 40;
                this.base.defense = 12;
                this.base.accuracy = 100;
                this.base.evasion = 15;
                this.base.focus = 110;
                this.base.resist = 20;
                this.base.speed = 90;
                this.base.presence = 90;
                this.actions.actionWeight = {
                    energyRifle: 0.35,
                    flashbang: 0,
                    snipe: 0.35,
                    sneak: 0.1,
                    switchPosition: 0.2
                };
            }
            resetStat(this, ["attack", "defense", "accuracy", "evasion", "focus", "resist", "speed", "presence"]);
        }
    };

    this.actions.actionWeight = {
        energyRifle: 0.35,
        flashbang: 0,
        snipe: 0.35,
        sneak: 0.1,
        switchPosition: 0.2
    };
})