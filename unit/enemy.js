import { Unit } from './unit.js';
import { Modifier, refreshState, updateMod, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo } from '../combatDictionary.js';

export const enemy = new Unit("Basic Enemy", [500, 40, 10, 25, 100, 20, 100, 35, 100, 100, "front", 50, 100, 10], [], function() {
    this.actions.basicAttack = {
        name: "Basic Attack",
        properties: ["attack"],
        description: "Attacks a single target three times.",
        code: () => {
            const target = [randTarget(unitFilter("player", "front", false))];
            logAction(`${this.name} attacks ${target[0].name}`, "action");
            attack(this, target, 3);
        }
    };

    this.actions.strongAttack = {
        name: "Strong Attack [stamina]",
        properties: ["physical", "stamina", "attack"],
        cost: { stamina: 30 },
        description: "Costs 30 stamina\nAttacks a single target 3 times with increased damage and accuracy",
        code: () => {
            this.resource.stamina -= 30;
            this.previousAction[0] = true;
            const target = [randTarget(unitFilter("player", "front", false))];
            logAction(`${this.name} unleashes two powerful strikes against ${target[0].name}!`, "action");
            attack(this, target, 3, { attacker: { accuracy: this.accuracy * 1.5, attack: this.attack * 2 } });
        }
    };

    this.actions.dodge = {
        name: "Dodge [stamina]",
        properties: ["physical", "stamina", "buff"],
        cost: { stamina: 20 },
        description: "Costs 20 stamina\nIncreases evasion for 1 turn",
        code: () => {
            if (this.resource.stamina < 20) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            const statIncrease = 2;
            this.resource.stamina -= 20;
            this.previousAction[0] = true;
            logAction(`${this.name} dodges.`, "buff");
            const self = this;
            new Modifier("Dodge", "Evasion increased",
                { caster: self, targets: [self], duration: 1, stats: "evasion", values: statIncrease },
                (vars) => { resetStat(vars.caster, [vars.stats], [vars.values]) },
                (vars, unit) => {
                    if (vars.caster === unit) { vars.duration-- }
                    if (vars.duration === 0) {
                        resetStat(vars.caster, [vars.stats], [vars.values], false);
                        return true;
                    }
                }
            );
        }
    };

    this.actions.block = {
        name: "Block [physical]",
        properties: ["physical", "buff"],
        description: "Increases defense for 1 turn",
        code: () => {
            const statIncrease = 1;
            this.previousAction[0] = true;
            logAction(`${this.name} blocks.`, "buff");
            const self = this;
            new Modifier("Block", "Defense increased",
                { caster: self, targets: [self], duration: 1, stats: "defense", values: statIncrease },
                (vars) => { resetStat(vars.caster, [vars.stats], [vars.values]) },
                (vars, unit) => {
                    if (vars.caster === unit) { vars.duration-- }
                    if (vars.duration === 0) {
                        resetStat(vars.caster, [vars.stats], [vars.values], false);
                        return true;
                    }
                }
            );
        }
    };

    this.actions.actionWeight = { 
        basicAttack: 0.25, 
        strongAttack: 0.6, 
        dodge: 0.1, 
        block: 0.05 
    };
});