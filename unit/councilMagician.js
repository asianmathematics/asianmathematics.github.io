import { Unit } from './unit.js';
import { Modifier, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const CouncilMagician = new Unit("Magic Council Member", [700, 50, 12, 60, 15, 100, 50, 60, 150, "back", 80, 50, 5, 90, 15], ["harmonic/change", "anomaly/synthetic", "independence/loneliness"], function() {
    this.actions.spellAttack = {
        name: "Spell Attack [mystic]",
        properties: ["mystic", "attack"],
        description: "Attacks a single target 4 times.",
        points: 60,
        target: () => { this.team === "player" ? selectTarget(this.actions.spellAttack, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.spellAttack.code(randTarget(unitFilter("player", "front", false))) },
        code: (target) => {
            this.previousAction[1] = true;
            logAction(`${this.name} fires magic projectiles at ${target[0].name}`, "action");
            attack(this, target, 4);
        }
    };

    this.actions.magicMissile = {
        name: "Magic Missile [mana]",
        properties: ["mystic", "mana", "physical", "attack", "autohit"],
        cost: { mana: 10 },
        description: "Costs 10 mana\nAuto hits a single target 9 times with decreased damage",
        points: 60,
        target: () => {
            if (this.resource.mana < 10) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            this.team === "player" ? selectTarget(this.actions.magicMissile, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.magicMissile.code(randTarget(unitFilter("player", "front", false)));
        },
        code: (target) => {
            this.resource.mana -= 10;
            this.previousAction[0] = this.previousAction[1] = true;
            logAction(`${this.name} fires force missiles on ${target[0].name}!`, "action");
            damage(this, target, [Array(9).fill(0.5)], { attacker: { attack: this.attack - 8 } });
        }
    };
    
    this.actions.dispelMagic = {
        name: "Dispel Magic [mana]",
        properties: ["mystic", "mana", "intertia/cold", "debuff", "resource"],
        cost: { mana: 40 },
        description: "Costs 40 mana\nChance to set target&#39;s mana to 0, disable mana regeneration for next turn, and end all mystic modifiers it focuses or cast on it",
        points: 60,
        target: () => { this.actions.dispelMagic.code(randTarget(unitFilter("player", "front", false).filter(u => u.base.resource.mana))) },
        code: (target) => {
            if (target.length) {
                this.resource.mana -= 40;
                this.previousAction[1] = true;
                const bonus = 2 ** (elementBonus(this, this.actions.dispelMagic) - elementBonus(target[0], this.actions.dispelMagic));
                if (resistDebuff(this, target)[0] > 50 - (25 * bonus)) {
                    if (eventState.resourceChange.length) { handleEvent('resourceChange', { effect: this.actions.dispelMagic, unit: target[0], resource: ['mana'], value: [-target[0].resource.mana] }) }
                    target[0].resource.mana = 0;
                    target[0].previousAction[1] = true;
                    for (const mod of modifiers.filter(m => m?.attributes?.includes("mystic") && ((m.vars.caster === target[0] && m.vars.focus) || m.vars?.target === target[0]))) { removeModifier(mod) }
                    for (const mod of modifiers.filter(m => m?.attributes?.includes("mystic") && m.vars?.targets?.includes(target[0]))) { mod.changeTarget(target) }
                    window.updateModifiers();
                    logAction(`${this.name} dispels ${target[0].name}'s magic!`, "action");
                } else { logAction(`${target[0].name} resists dispel magic`, "miss") }
            } else {
                currentAction[currentAction.length - 1] = this.actions.drainLife;
                this.actions.drainLife.target();
            }
        }
    };

    this.actions.meditate = {
        name: "Meditate [physical]",
        properties: ["physical", "harmonic/change", "resource"],
        description: `Recovers some mana (${this.resource.manaRegen * 2})`,
        points: 60,
        code: () => {
            this.previousAction[0] = true;
            if (eventState.resourceChange.length) { handleEvent('resourceChange', { effect: this.actions.meditate, unit: this, resource: ['mana'], value: [this.resource.manaRegen * 2] }) }
            this.resource.mana = Math.min(this.base.resource.mana, this.resource.mana + (this.resource.manaRegen * 2));
            logAction(`${this.name} meditates and recovers mana!`, "heal");
        }
    };

    this.actions.actionWeight = {
        spellAttack: 0.25,
        magicMissile: 0.5,
        dispelMagic: 0.2,
        meditate: 0.05
    };
})