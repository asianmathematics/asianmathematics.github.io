import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const DexSoldier = new Unit("DeX (Soldier)", [770, 50, 20, 20, 90, 20, 95, 50, 85, 150, "front", 99, 200, 25], ["Harmonic/Change", "Inertia/Cold", "Radiance/Purity"], function() {
    this.actions.hammer = {
        name: "Hammer [physical]",
        properties: ["physical", "attack", "buff"],
        description: "Attacks a single target with increased damage and accuracy and increases speed for 1 turn.",
        target: () => { selectTarget(this.actions.hammer, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) },
        code: (target) => {
            const statIncrease = [0.5];
            this.previousAction[0] = true;
            logAction(`${this.name} swings a hammer at ${target[0].name}`, "action");
            attack(this, target, 1, { attacker: { accuracy: this.accuracy * 2, attack: this.attack * 3 } });
            const self = this;
            basicModifier("Hammer Speed", "Temporary speed boost", { caster: self, targets: [self], duration: 1, attributes: ["physical"], stats: ["speed"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.quake = {
        name: "Quake [stamina]",
        properties: ["physical", "stamina", "attack", "multitarget"],
        cost: { stamina: 40 },
        description: "Costs 40 stamina\nAttacks all frontline twice at reduced damage and acccuracy.",
        code: () => {
            if (this.resource.stamina < 40) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            this.resource.stamina -= 40;
            this.previousAction[0] = true;
            logAction(`${this.name} hits the ground to create a tremor!`, "action");
            attack(this, unitFilter("enemy", "front", false), 2, { attacker: { accuracy: this.accuracy * 0.75, attack: this.attack * 0.5 } });
        }
    };

    this.actions.determination = {
        name: "Determination [stamina]",
        properties: ["physical", "stamina", "harmonic/change", "inertia/cold", "radiance/purity", "heal", "buff"],
        cost: { stamina: 80 },
        description: `Costs 80 stamina\nModerately heals (${this.resource.healFactor} HP) this turn and the next 2 turns`,
        code: () => {
            if (this.resource.stamina < 80) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            this.resource.stamina -= 80;
            this.previousAction[0] = true;
            logAction(`${this.name} held onto hope!`, "action");
            const self = this;
            new Modifier("Determination", "Healing over time",
                { caster: self, targets: [self], duration: 2, attributes: ["physical"], stats: "hp", values: self.resource.healFactor, listeners: {turnStart: true}, cancel: false, applied: true, focus: true, mod },
                (vars) => {
                    vars.mod = modifiers.find(m => m.name === "Determination" && m.vars.caster === vars.caster);
                    if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: vars.mod, unit: vars.caster, resource: ['hp'], value: [vars.value] }) }
                    this.hp = Math.min(vars.caster.hp + vars.caster.values, vars.caster.base.hp);
                },
                (vars, context) => {
                    if (vars.caster === context.unit) {
                        if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: vars.mod, unit: vars.caster, resource: ['hp'], value: [vars.value] }) }
                        if (vars.applied) { context.unit.hp = Math.min(context.unit.hp + vars.values, context.unit.base.hp) }
                        vars.duration--;
                    }
                    if (vars.duration === 0) { return true }
                }
            );
        }
    };

    this.actions.guard = {
        name: "Guard [stamina]",
        properties: ["physical", "stamina", "inertia/cold", "buff"],
        cost: { stamina: 20 },
        description: "Costs 20 stamina\nIncreases defense and presence for 1 turn",
        code: () => {
            if (this.resource.stamina < 20) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            const statIncrease = [1, 1];
            this.resource.stamina -= 20;
            this.previousAction[0] = true;
            logAction(`${this.name} protects the team!`, "action");
            const self = this;
            basicModifier("Guard", "Defense and presence increase", { caster: self, targets: [self], duration: 1, attributes: ["physical"], elements: ["inertia/cold"], stats: ["defense", "presence"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.block = {
        name: "Block [physical]",
        properties: ["physical", "buff"],
        description: "Increases defense for 1 turn",
        code: () => {
            const statIncrease = [1];
            this.previousAction[0] = true;
            logAction(`${this.name} blocks.`, "buff");
            const self = this;
            basicModifier("Block", "Defense increased", { caster: self, targets: [self], duration: 1, attributes: ["physical"], stats: ["defense"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };
});