import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Servant = new Unit("Servant", [1800, 60, 24, 110, 35, 125, 65, 160, 60, "front", 200, 160, 17], ["death/darkness", "knowledge/memory", "anomaly/synthetic", "passion/hatred"], function() {
    this.actions.meleeAttack = {
        name: "Melee Attack",
        properties: ["attack"],
        description: "Attacks a single target twice with increased damage.",
        points: 60,
        target: () => { this.team === "player" ? selectTarget(this.actions.meleeAttack, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.meleeAttack.code(randTarget(unitFilter("player", "front", false))) },
        code: (target) => {
            logAction(`${this.name} deals with ${target[0].name}`, "action");
            attack(this, target, 2, { attacker: { attack: this.attack + 8 } });
        }
    };

    this.actions.takingOutTrash = {
        name: "Taking Out Trash [stamina]",
        properties: ["physical", "stamina", "death/darkness", "attack", "autohit"],
        cost: { stamina: 50 },
        description: "Costs 50 stamina\nDirect attack on a single target with near guaranteed critical hit.",
        points: 60,
        target: () => {
            if (this.resource.stamina < 50) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            this.team === "player" ? selectTarget(this.actions.takingOutTrash, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.takingOutTrash.code(randTarget(unitFilter("player", "front", false)));
        },
        code: (target) => {
            this.resource.stamina -= 50;
            this.previousAction[0] = true;
            logAction(`${this.name} takes out the trash!`, "action");
            damage(this, target, [[1 + (this.focus / Math.min(25, target[0].resist / 2))]]);
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
            logAction(`${this.name} drew attention away from himself!`, "buff");
            basicModifier("Sneak Adjustment", "Combat focus modification", { caster: this, target: this, duration: 1, attributes: ["physical"], stats: ["focus", "resist", "presence"], values: statIncrease, listeners: { turnEnd: true }, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.dodge = {
        name: "Dodge [physical]",
        properties: ["physical", "buff"],
        description: "Slightly increases defense and resist, slightly decreases presence, and increases evasion for 1 turn",
        points: 60,
        code: () => {
            const statIncrease = [2, 12, 7, -2];
            this.previousAction[0] = true;
            logAction(`${this.name} dodges.`, "buff");
            basicModifier("Dodge", "Evasion and resist increased", { caster: this, target: this, duration: 1, attributes: ["physical"], stats: ["defense", "evasion", "resist", "presence"], values: statIncrease, listeners: { turnStart: true }, cancel: false, applied: true, focus: true, passive: true });
        }
    };

    this.actions.actionWeight = {
        meleeAttack: 0.4,
        takingOutTrash: 0.25,
        sneak: 0.24,
        dodge: 0.1,
        skip: 0.01
    };
}, function() {
    this.passives.feast = {
        name: "Feast [passive, physical]",
        properties: ["passive", "physical", "death/darkness", "knowledge/memory", "anomaly/synthetic", "buff"],
        description: "When finishing off an enemy or skips turn with a dead enemy, it is removed from battle (one enemy per turn)",
        code: () => {
            new Modifier("Feast", "When finishing off an enemy or skips turn with a dead enemy, it is removed from battle (one enemy per turn)",
                { caster: this, target: this, attributes: ["physical"], listeners: { unitChange: true, turnEnd: false }, cancel: false, applied: true, focus: true, passive: true },
                function() {},
                function(context) {
                    if (this.vars.applied && context.type === "downed" && context.unit.team !== this.vars.caster.team && currentUnit === this.vars.caster) {
                        for (const mod of modifiers.filter(m => (m.vars.caster === context.unit && (m.vars.focus || m.vars.penalty)) || m.vars?.target === context.unit)) {
                            mod.passive = false;
                            removeModifier(mod);
                        }
                        for (const mod of modifiers.filter(m => m.vars?.targets?.includes(context.unit))) { mod.changeTarget(context.unit) }
                        allUnits.splice(allUnits.indexOf(context.unit), 1);
                    } else if (this.vars.applied && !context.type && context.unit === this.vars.caster && currentAction === "Skip") {
                        const unit = randTarget(unitFilter(this.vars.caster.team === "player" ? "enemy" : "player", "", true), 1, true);
                        for (const mod of modifiers.filter(m => (m.vars.caster === unit && (m.vars.focus || m.vars.penalty)) || m.vars?.target === unit)) {
                            mod.passive = false
                            removeModifier(mod);
                        }
                        for (const mod of modifiers.filter(m => m.vars?.targets?.includes(unit))) { mod.changeTarget(unit) }
                        allUnits.splice(allUnits.indexOf(unit), 1);
                    } else if (this.vars.applied && !this.vars.listeners.turnEnd && context.type === "downed" && context.unit.team !== this.vars.caster.team && currentUnit !== this.vars.caster) {
                        this.vars.listeners.turnEnd = true;
                        eventState.turnEnd.push(this);
                    } 
                    if (this.vars.listeners.turnEnd && context.unit === this.vars.caster) {
                        this.vars.listeners.turnEnd = false;
                        eventState.turnEnd.splice(eventState.turnEnd.indexOf(this), 1);
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
    }
});
