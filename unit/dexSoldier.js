import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const DexSoldier = new Unit("DeX (Soldier)", [1500, 36, 32, 85, 10, 50, 50, 50, 200, "front", 150, 120, 25], ["harmonic/change", "inertia/cold", "radiance/purity"], function() {
    this.actions.hammer = {
        name: "Hammer [physical]",
        properties: ["physical", "attack", "buff"],
        description: "Attacks a single target with increased accuracy and increases speed for 1 turn.",
        points: 60,
        target: () => { selectTarget(this.actions.hammer, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) },
        code: (target) => {
            const statIncrease = [20];
            this.previousAction[0] = true;
            logAction(`${this.name} swings a hammer at ${target[0].name}`, "action");
            attack(this, target, 1, { attacker: { accuracy: this.accuracy + 31 } });
            basicModifier("Hammer Speed", "Temporary speed boost", { caster: this, targets: [this], duration: 1, attributes: ["physical"], stats: ["speed"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.quake = {
        name: "Quake [stamina]",
        properties: ["physical", "stamina", "attack", "multitarget"],
        cost: { stamina: 20 },
        description: "Costs 20 stamina\nAttacks all frontline with slightly increased accuracy and damage.",
        points: 60,
        code: () => {
            if (this.resource.stamina < 20) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            this.resource.stamina -= 20;
            this.previousAction[0] = true;
            logAction(`${this.name} hits the ground to create a tremor!`, "action");
            attack(this, unitFilter("enemy", "front", false), 1, { attacker: { attack: this.attack + 4, accuracy: this.accuracy + 10 } });
        }
    };

    this.actions.determination = {
        name: "Determination [stamina]",
        properties: ["physical", "stamina", "harmonic/change", "inertia/cold", "radiance/purity", "heal"],
        cost: { stamina: 50 },
        description: `Costs 50 stamina\nModerately heals (${Math.floor(0.5 * this.resource.healFactor + Number.EPSILON)} HP) for 4 turns`,
        points: 60,
        code: () => {
            if (this.resource.stamina < 50) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            this.resource.stamina -= 50;
            this.previousAction[0] = true;
            logAction(`${this.name} held onto hope!`, "heal");
            new Modifier("Determination", "Healing over time",
                { caster: this, targets: [this], duration: 3, attributes: ["physical"], stats: ["hp"], listeners: {turnStart: true}, cancel: false, applied: true, focus: true },
                function() {
                    if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: this, unit: this.vars.caster, resource: ['hp'], value: [Math.floor(0.5 * this.vars.caster.resource.healFactor + Number.EPSILON)] }) }
                    this.vars.caster.hp = Math.min(this.vars.caster.hp + Math.floor(0.5 * this.vars.caster.resource.healFactor + Number.EPSILON), this.vars.caster.base.hp);
                },
                function(context) {
                    if (this.vars.caster === context?.unit) {
                        if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: this, unit: this.vars.caster, resource: ['hp'], value: [Math.floor(0.5 * this.vars.caster.resource.healFactor + Number.EPSILON)] }) }
                        if (this.vars.applied) {
                            this.vars.caster.hp = Math.min(this.vars.caster.hp + Math.floor(0.5 * this.vars.caster.resource.healFactor + Number.EPSILON), this.vars.caster.base.hp);
                            logAction(`${this.vars.caster.name} held onto hope!`, "heal");
                        }
                        this.vars.duration--;
                    }
                    if (this.vars.duration === 0) { return true }
                }
            );
        }
    };

    this.actions.guard = {
        name: "Guard [physical]",
        properties: ["physical", "inertia/cold", "buff"],
        description: "Increases defense, resist, and presence for 1 turn",
        points: 60,
        code: () => {
            const statIncrease = [12, 10, 100];
            this.previousAction[0] = true;
            logAction(`${this.name} protects the team!`, "action");
            basicModifier("Guard", "Defense, resist, and presence increase", { caster: this, targets: [this], duration: 1, attributes: ["physical"], elements: ["inertia/cold"], stats: ["defense", "resist", "presence"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };
});