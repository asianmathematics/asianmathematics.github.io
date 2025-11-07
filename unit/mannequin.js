import { Unit } from './unit.js';
import { Modifier, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Mannequin = new Unit("Mannequin", [750, 35, 9, 110, 15, 120, 25, 80, 65, "mid", 75, 70, 15, , , 100, 15], [], function() {
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

    this.actions.dualWield = {
        name: "Dual Wield [stamina, energy]",
        properties: ["physical", "stamina", "techno", "energy", "attack", "multitarget"],
        cost: { position: "front", stamina: 20, energy: 15 },
        description: "Costs 20 stamina & 15 energy\nFrontline only\nMakes either 2 attacks against 1 target or 1 attack against 2 targets each with increased accuracy and crit chance",
        points: 60,
        target: () => {
            if (this.resource.stamina < 20 || this.resource.energy < 15) {
                showMessage("Not enough resources!", "error", "selection");
                return;
            }
            this.team === "player" ? selectTarget(this.actions.dualWield, () => { playerTurn(this) }, [2, false, unitFilter("enemy", "front", false)]) : this.actions.dualWield.code(randTarget(unitFilter("player", "front", false), Math.random() < .5 ? 1 : 2));
        },
        code: (targets) => {
            this.resource.stamina -= 20;
            this.resource.energy -= 15;
            this.previousAction[0] = this.previousAction[2] = true;
            logAction(`${this.name} dual wields!`, "action");
            attack(this, targets, Math.floor(2 / targets.length), { attacker: { accuracy: this.accuracy + 100, focus: this.focus + 100 } });
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
                this.base.attack = 40;
                this.base.defense = 6;
                this.base.accuracy = 120;
                this.base.evasion = 10;
                this.base.focus = 130;
                this.base.resist = 20;
                this.base.speed = 95;
                this.base.presence = 75;
                this.actions.actionWeight = {
                    energyRifle: 0.2,
                    dualWield: 0.4,
                    snipe: 0,
                    sneak: 0.2,
                    switchPosition: 0.2
                };
            } else {
                this.position = "back";
                logAction(`${this.name} moves to the backline.`, "info");
                this.base.attack = 35;
                this.base.defense = 9;
                this.base.accuracy = 110;
                this.base.evasion = 15;
                this.base.focus = 120;
                this.base.resist = 25;
                this.base.speed = 80;
                this.base.presence = 65;
                this.actions.actionWeight = {
                    energyRifle: 0.35,
                    dualWield: 0,
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
        dualWield: 0,
        snipe: 0.35,
        sneak: 0.1,
        switchPosition: 0.2
    };
})