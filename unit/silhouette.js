import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Silhouette = new Unit("Silhouette", [660, 26, 16, 100, 24, 100, 50, 65, 77, "mid", 66, 60, 6, 80, 8], ["death/darkness", "anomaly/synthetic", "independence/loneliness"], function() {
    this.actions.shadowBlade = {
        name: "Shadow Blade [physical, mystic]",
        properties: ["physical", "mystic", "death/darkness", "attack"],
        cost: { position: "front" },
        description: "Attacks a single target twice with increased damage.",
        points: 60,
        target: () => { selectTarget(this.actions.shadowBlade, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) },
        code: (target) => {
            logAction(`${this.name} deals with ${target[0].name}`, "action");
            attack(this, target, 2, { attacker: { attack: this.attack + 8, accuracy: this.accuracy + 22, focus: this.focus + 10 } });
        }
    };

    this.actions.meditate = {
        name: "Meditate [physical]",
        properties: ["physical", "harmonic/change", "resource"],
        cost: { position: "back" },
        description: `Recovers some mana (${this.resource.manaRegen * 2})`,
        points: 60,
        code: () => {
            this.previousAction[0] = true;
            if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: this.actions.meditate, unit: this, resource: ['mana'], value: [this.resource.manaRegen * 2] }) }
            this.resource.mana = Math.min(this.base.resource.mana, this.resource.mana + (this.resource.manaRegen * 2));
            logAction(`${this.name} meditates and recovers mana!`, "heal");
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
            basicModifier("Sneak Adjustment", "Combat focus modification", { caster: this, targets: [this], duration: 1, attributes: ["physical"], stats: ["focus", "resist", "presence"], values: statIncrease, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.dispelMagic = {
        name: "Dispel Magic [mana]",
        properties: ["mystic", "mana", "intertia/cold", "debuff", "resource"],
        cost: { mana: 40 },
        description: "Costs 40 mana\nChance to set target&#39;s mana to 0, disable mana regeneration for next turn, and end all mystic modifiers it focuses or cast on it",
        points: 60,
        target: () => {
            if (this.resource.mana < 40) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.dispelMagic, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.mana -= 40;
            this.previousAction[1] = true;
            if (target[0].resource.mana !== undefined) {
                if (resistDebuff(this, target)[0] > 25) {
                    if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: this.actions.dispelMagic, unit: target[0], resource: ['mana'], value: [-target[0].resource.mana] }) }
                    target[0].resource.mana = 0;
                    target[0].previousAction[1] = true;
                    for (const mod of modifiers.filter(m => m?.attributes?.includes("mystic") && ((m.vars.caster === target[0] && m.vars.focus) || m.vars.targets[0] === target[0]))) { removeModifier(mod) }
                    for (const mod of modifiers.filter(m => m.vars.targets.includes(target[0]) && m?.attributes?.includes("mystic"))) {
                        if (mod.vars.applied) {
                            mod.vars.cancel++;
                            if (eventState.cancel.flag) {handleEvent('cancel', { effect: this.actions.dispelMagic, target: mod, cancel: true }) }
                            mod.onTurn.call(mod.vars, {})
                            mod.vars.targets.splice(mod.vars.targets.indexOf(target[0]), 1);
                            mod.vars.cancel--;
                            if (eventState.cancel.flag) {handleEvent('cancel', { effect: this.actions.dispelMagic, target: mod, cancel: false }) }
                            mod.onTurn.call(mod.vars, {})
                        } else { mod.vars.targets.splice(mod.vars.targets.indexOf(target[0]), 1) }
                     }
                    window.updateModifiers();
                    logAction(`${this.name} dispels ${target[0].name}'s magic!`, "action");
                } else { logAction(`${target[0].name} resists dispel magic`, "miss") }
            } else { logAction(`${target[0].name} has no magic to dispel!`, "warning") }
        }
    };

    this.actions.switchPosition = {
        name: "Switch Position [mystic]",
        properties: ["mystic", "position"],
        description: "Switch between front and back line positions",
        code: () => {
            this.previousAction[0] = true;
            if (eventState.positionChange.flag) {handleEvent('positionChange', { unit: this, position: this.position === "back" ? "front" : "back" }) }
            if (this.position === "back") {
                this.position = "front";
                logAction(`${this.name} teleports to the frontline.`, "info");
                this.base.attack = 36;
                this.base.defense = 10;
                this.base.accuracy = 120;
                this.base.evasion = 18;
                this.base.focus = 120;
                this.base.resist = 40;
                this.base.speed = 86;
                this.base.presence = 100;
            } else {
                this.position = "back";
                logAction(`${this.name} teleports to the backline.`, "info");
                this.base.attack = 26;
                this.base.defense = 16;
                this.base.accuracy = 100;
                this.base.evasion = 24;
                this.base.focus = 100;
                this.base.resist = 50;
                this.base.speed = 65;
                this.base.presence = 77;
            }
            resetStat(this, ["attack", "defense", "accuracy", "evasion", "focus", "resist", "speed", "presence"]);
        }
    };
})