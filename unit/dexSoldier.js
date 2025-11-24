import { Unit } from './unit.js';
import { Modifier, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const DexSoldier = new Unit("DeX (Soldier)", [1900, 40, 50, 85, 27, 80, 65, 60, 190, "front", 190, 120, 12], ["harmonic/change", "inertia/cold", "radiance/purity"], function() {
    this.actions.hammer = {
        name: "Hammer [physical]",
        properties: ["physical", "attack", "buff"],
        description: "Attacks a single target with increased accuracy and increases speed for 1 turn.",
        points: 60,
        target: () => { this.team === "player" ? selectTarget(this.actions.hammer, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.hammer.code(randTarget(unitFilter("player", "front", false))) },
        code: (target) => {
            const statIncrease = [20];
            this.previousAction[0] = true;
            logAction(`${this.name} swings a hammer at ${target[0].name}`, "action");
            attack(this, target, 1, { attacker: { accuracy: this.accuracy + 31 } });
            basicModifier("Hammer Speed", "Temporary speed boost", { caster: this, target: this, duration: 1, attributes: ["physical"], stats: ["speed"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
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
            attack(this, unitFilter(this.team === "player" ? "enemy" : "player", "front", false), 1, { attacker: { attack: this.attack + 4, accuracy: this.accuracy + 10 } });
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
            basicModifier("Guard", "Defense, resist, and presence increase", { caster: this, target: this, duration: 1, attributes: ["physical"], elements: ["inertia/cold"], stats: ["defense", "resist", "presence"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.actionWeight = {
        hammer: 0.7,
        quake: 0.2,
        guard: 0.05,
        skip: 0.05,
    };
}, function() {
    this.passives.determination = {
        name: "Determination [passive, stamina]",
        properties: ["physical", "stamina", "harmonic/change", "inertia/cold", "radiance/purity", "heal"],
        cost: { stamina: this.base.resource.stamina / 2 },
        description: `Moderately heals (${Math.round(0.8 * this.resource.healFactor)} HP) at start of turn whenever stamina is at least half`,
        points: 30,
        code: () => {
            new Modifier("Determination", `Moderately heals${this.team === "player" ? ` (${Math.round(0.8 * this.resource.healFactor)} HP)` : ''} at start of turn whenever stamina is at least half`,
                { caster: this, target: this, attributes: ["physical"], elements: ["harmonic/change", "inertia/cold", "radiance/purity"], stats: ["hp"], listeners: { turnStart: true, unitChange: false }, cancel: false, applied: true, focus: true, passive: true },
                function() {},
                function(context) {
                    if (this.vars.listeners.unitChange && context.unit === this.vars.caster && context.type === "revive") { this.cancel(false) }
                    else if (this.vars.applied && this.vars.target === context?.unit && 2 * this.vars.target.resource.stamina >= this.vars.target.base.resource.stamina) {
                        if (eventState.resourceChange.length) { handleEvent('resourceChange', { effect: this, unit: this.vars.target, resource: ['hp'], value: [Math.round(0.8 * this.vars.target.resource.healFactor)] }) }
                        this.vars.target.hp = Math.min(this.vars.target.hp + Math.round(0.8 * this.vars.target.resource.healFactor), this.vars.caster.base.hp);
                        logAction(`${this.vars.target.name} held onto hope and healed${this.vars.caster.team === "player" ? ` ${Math.round(0.8 * this.vars.target.resource.healFactor)} HP` : ''}!`, "heal");
                    }
                },
                function(cancel, temp) {
                    if (!temp) {
                        if (this.vars.cancel && this.vars.applied) {
                            this.vars.applied = false;
                            this.vars.listeners.turnStart = false;
                            eventState.turnStart.splice(eventState.turnStart.indexOf(this), 1);
                            this.vars.listeners.unitChange = true;
                            eventState.unitChange.push(this);
                        } else if (!this.vars.cancel && !this.vars.applied) {
                            this.vars.applied = true;
                            this.vars.listeners.unitChange = false;
                            eventState.unitChange.splice(eventState.unitChange.indexOf(this), 1);
                            this.vars.listeners.turnStart = true;
                            eventState.turnStart.push(this);
                        }
                    }
                }
            );
        }
    };
});

DexSoldier.description = "3 star unit with high tank abilities and low speed";