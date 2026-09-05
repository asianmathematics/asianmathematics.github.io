import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements } from '../combatDictionary.js';
import { Modifier, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, modifiers, currentAction, eventState } from '../modifier.js'
import { Unit, allUnits } from './unit.js';

export const CouncilMagician = new Unit("Magic Council Member", [800, 45, 30, 60, 80, 100, 140, 80, 150, "back", 90, 70, 5, 140, 16], 3, ["independence/loneliness"]);

CouncilMagician.skills = {
    special: [
        {
            name: "Fireball",
            properties: ["mystic", "mana-block", "mana", "attack", "aoe", "fire"],
            cost: { mana: 30 },
            description: "Attacks target and a random number of random targets (including allies) twice with increased attack and halved accuracy",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
            code(target) { 
                const front = allUnits.filter(u => u.hp && u.position === target[0].position);
                attack(this, target.concat(randTarget(front, Math.floor((front.length-1)*Math.min(Math.random(), Math.random(), Math.random())+1), true)), 2, { attack: { bonus: 50 }, accuracy: { div: 2 }});
            }
        },
        {
            name: "Arcane Missile",
            properties: ["mystic", "mana-block", "mana", "attack", "auto-hit"],
            cost: { mana: 40 },
            description: "Makes 8 non-crit guaranteed hits distributed to up to 8 enemies",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team), 8, false) },
            code(targets) { damage(this, targets, targets.map((_, i) => Array(Math.floor(8/targets.length) + (i < 8%targets.length)).fill(.5))) }
        },
        {
            name: "Dispel",
            properties: ["mystic", "mana-block", "mana", "debuff", "cancel"],
            cost: { mana: 40 },
            description: "Ends non-passive mystic modifiers target is focusing, cancels mystic modifiers on target, and disables mana regen for a few turns depending on chance, 1% chance to fail",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
            code(target) {
                const will = resistDebuff(this, target)[0];
                will >= 2 ? attribCancelMod("Dispel", { target: target[0], duration: will > 99 ? 4 : Math.ceil(will/33), properties: ["mystic", "debuff", "cancel"], listeners: { turnEnd: true }, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 2 } }, 'mystic' ) : logAction(`${target[0].name} resists Dispel!`, 'miss');
            }
        },
        {
            name: "Restore Mana",
            properties: ["physical", "stamina-block", "stamina", "mana-gain"],
            cost: { stamina: 30 },
            description: "Recover a lot of mana (~45% max mana)",
            code() {
                resourceChange(this, { mana: 4.5 * this.manaRegen });
                logAction(`${this.name} recovers mana!`, "buff");
            }
        },
        {
            name: "Wild Magic",
            properties: ["mystic", "mana-block", "mana", "random", "buff", "penalty"],
            cost: { mana: 50 },
            description: "Creates a random effect with a 1% chance of backfiring",
            code() { wildMagic.call(this, Math.random() >= .01) }
        },
        {
            name: "Pursuit of Knowledge",
            properties: ["physical", "stamina-block", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Increases accuracy/focus/speed and decreases defense/resist/presence for 5 turns",
            code() {
                basicModifier("Pursuit of Knowledge buff", "Accuracy, focus, and speed increase", { target: this, duration: 6, properties: ["physical", "buff"], stats: { accuracy: 60, focus: 120, speed: 50 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("Pursuit of Knowledge penalty", "Defense, resist, and presence decrease", { target: this, duration: 6, properties: ["physical", "penalty"], stats: { defense: -10, resist: -30, presence: -60 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        }
    ],
    basic: [
        {
            name: "Fireball",
            properties: ["mystic", "mana-block", "attack", "fire"],
            description: "Attacks target 2 times with increased damage",
            code() { attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 2, { attack: { bonus: 50 } }) }
        },
        {
            name: "Arcane Missile",
            properties: ["mystic", "mana-block", "mana", "attack", "auto-hit"],
            cost: { mana: 20 },
            description: "Makes 6 non-crit guaranteed hits distributed to up to 6 enemies",
            code() {
                const targets = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team), Math.floor(Math.random()*6)+1);
                damage(this, targets, targets.map((_, i) => Array(Math.floor(6/targets.length) + (i < 6%targets.length)).fill(.5)));
            }
        },
        {
            name: "Dispel",
            properties: ["mystic", "mana-block", "mana", "debuff", "cancel"],
            cost: { energy: 10 },
            description: "Chance to end non-passive mystic modifiers target is focusing, cancel mystic modifiers on target, and disables mana regen for 1 turn",
            code() {
                const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team));
                resistDebuff(this, target)[0] >= 25 ? attribCancelMod("Dispel", { target: target[0], duration: 1, properties: ["mystic", "debuff", "cancel"], listeners: { turnEnd: true }, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 25 } }, 'mystic') : logAction(`${target[0].name} resists Dispel!`, 'miss');
            }
        },
        {
            name: "Restore Mana",
            properties: ["physical", "stamina-block", "stamina", "mana-gain"],
            cost: { stamina: 10 },
            description: "Recover a lot of mana (~25% max mana)",
            code() {
                resourceChange(this, { mana: 2.5 * this.manaRegen });
                logAction(`${this.name} recovers mana!`, "buff");
            }
        },
        {
            name: "Wild Magic",
            properties: ["mystic", "mana-block", "mana", "random", "buff", "penalty"],
            cost: { mana: 20 },
            description: "Creates a random effect with a 12.5% chance of backfiring",
            code() { wildMagic.call(this, Math.random() >= .125) }
        },
        {
            name: "Pursuit of Knowledge",
            properties: ["physical", "stamina-block", "buff", "penalty"],
            description: "Increases accuracy/focus/speed and decreases defense/resist/presence for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                const mod = refreshModifier([{ name: "Pursuit of Knowledge buff", vars: { caster: this, target: this, parent: this.skills.basic } }, { name: "Pursuit of Knowledge penalty", vars: { caster: this, target: this, parent: this.skills.basic } }]);
                if (!mod[0]) basicModifier("Pursuit of Knowledge buff", "Accuracy, focus, and speed increase", { target: this, duration: 3, properties: ["physical", "buff"], stats: { accuracy: 30, focus: 100, speed: 40 }, listeners: { turnEnd: true }, focus: true });
                if (!mod[1]) basicModifier("Pursuit of Knowledge penalty", "Defense, resist, and presence decrease", { target: this, duration: 3, properties: ["physical", "penalty"], stats: { defense: -5, resist: -20, presence: -40 }, listeners: { turnEnd: true }, focus: true, penalty: true });
                if (mod[0]+mod[1]) this.previousAction[0] = false;
            }
        }
    ],
    secondary: [
        {
            name: "Fireball",
            properties: ["mystic", "attack", "fire"],
            description: "Attacks target 2 times with increased damage",
            code() { attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 2, { attack: { bonus: 25 } }) }
        },
        {
            name: "Arcane Missile",
            properties: ["mystic", "mana-block", "attack", "auto-hit"],
            description: "Makes 4 non-crit guaranteed hits distributed to up to 4 enemies",
            code() {
                const targets = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team), Math.floor(Math.random()*6)+1);
                damage(this, targets, targets.map((_, i) => Array(Math.floor(6/targets.length) + (i < 6%targets.length)).fill(.5)));
            }
        },
        {
            name: "Restore Mana",
            properties: ["physical", "stamina-block", "mana-gain"],
            description: "Recover a lot of mana (~15% max mana)",
            code() {
                resourceChange(this, { mana: 1.5 * this.manaRegen });
                logAction(`${this.name} recovers mana!`, "buff");
            }
        },
        {
            name: "Wild Magic",
            properties: ["mystic", "mana-block", "random", "buff", "penalty"],
            description: "Creates a random effect with a 25% chance of backfiring",
            code() { wildMagic.call(this, Math.random() >= .25) }
        },
        {
            name: "Pursuit of Knowledge",
            properties: ["physical", "buff", "penalty"],
            description: "Increases focus/speed and decreases resist/presence for 1 turn",
            code() {
                const mod = refreshModifier([{ name: "Pursuit of Knowledge buff", vars: { caster: this, target: this, parent: this.skills.secondary } }, { name: "Pursuit of Knowledge penalty", vars: { caster: this, target: this, parent: this.skills.secondary } }], 2);
                if (!mod[0]) basicModifier("Pursuit of Knowledge buff", "Focus and speed increase", { target: this, duration: 2, properties: ["physical", "buff"], stats: { focus: 80, speed: 30 }, listeners: { turnEnd: true }, focus: true });
                if (!mod[1]) basicModifier("Pursuit of Knowledge penalty", "Resist and presence decrease", { target: this, duration: 2, properties: ["physical", "penalty"], stats: { resist: -10, presence: -30 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        }
    ],
    passive: [
        {
            name: "Restore Mana",
            properties: ["physical", "mana-gain"],
            reduction: { stamina: 20, staminaRegen: 2 },
            description: "Regen mana (~10% max mana) each turn",
            code() {
                new Modifier("Restore Mana", `Regen mana (~10% max mana) each turn`,
                    { target: this, properties: ["physical", "mana-gain"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.passive.reduction, focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster) resourceChange(this.vars.target, { mana: this.vars.target.manaRegen }) }
                );
            }
        },
        {
            name: "Wild Magic",
            properties: ["mystic", "random", "buff", "penalty"],
            description: "Creates a random effect every turn with a 37.5% chance of backfiring",
            code() { 
                new Modifier("Wild Magic", "Creates a random effect with a 37.5% chance of backfiring",
                    { target: this, properties: ["mystic", "random", "buff", "penalty"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster) wildMagic.call(this.vars.caster, Math.random() >= .375)}
                );
            }
        },
        {
            name: "Pursuit of Knowledge",
            properties: ["physical", "buff", "penalty"],
            description: "Increases focus/speed and decreases resist/presence",
            code() {
                basicModifier("Pursuit of Knowledge buff", "Focus and speed increase", { target: this, properties: ["physical", "buff"], stats: { focus: 120, speed: 20 }, passive: true, focus: true });
                basicModifier("Pursuit of Knowledge penalty", "Resist and presence decrease", { target: this,properties: ["physical", "penalty"], stats: { resist: -20, presence: -40 }, passive: true, focus: true, penalty: true });
            }
        }
    ],
    augment: [
        {
            name: "Restore Mana",
            properties: ["physical", "mana-gain"],
            reduction: { stamina: 20, staminaRegen: 2 },
            description: "Regen mana (~15% max mana) each turn",
            code() {
                new Modifier("Restore Mana", `Regen mana (~10% max mana) each turn`,
                    { target: this, properties: ["physical", "mana-gain"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.passive.reduction, focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster) resourceChange(this.vars.target, { mana: this.vars.target.manaRegen * 1.5 }) }
                );
            }
        },
        {
            name: "Wild Magic",
            properties: ["mystic", "random", "buff", "penalty"],
            description: "Creates a random effect every turn with a 25% chance of backfiring",
            code() { 
                new Modifier("Wild Magic", "Creates a random effect with a 25% chance of backfiring",
                    { target: this, properties: ["mystic", "random", "buff", "penalty"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster) wildMagic.call(this.vars.caster, Math.random() >= .25)}
                );
            }
        },
        {
            name: "Pursuit of Knowledge",
            properties: ["physical", "buff", "penalty"],
            description: "Increases accuracy/focus/speed and decreases resist/presence",
            code() {
                basicModifier("Pursuit of Knowledge buff", "Accuracy, focus, and speed increase", { target: this, properties: ["physical", "buff"], stats: { accuracy: 30, focus: 120, speed: 30 }, passive: true, focus: true });
                basicModifier("Pursuit of Knowledge penalty", "Resist and presence decrease", { target: this, properties: ["physical", "penalty"], stats: { resist: -10, presence: -20 }, passive: true, focus: true, penalty: true });
            }
        }
    ]
}

CouncilMagician.defaultSkills = [
    { category: 'special', name: 'Fireball' },
    { category: 'basic', name: 'Arcane Missile' },
    { category: 'secondary', name: 'Restore Mana' },
    { category: 'passive', name: 'Wild Magic' },
    { category: 'augment', name: 'Pursuit of Knowledge' }
];

function wildMagic(buff) {
    switch (Math.floor(Math.random()*8)+1) {
        case 1: {
            if (buff) {
                const targets = allUnits.filter(u => u.hp && u.base.position === "mid" && u.team !== this.team), target = targets.length ? targets[Math.floor(Math.random()*targets.length)] : 0;
                (target && resistDebuff(this, [target]) >= 2) ? target.switchPosition() : logAction(`${this.name}'s wild magic fails to teleport anyone`, 'miss');
            } else new Modifier("Wild Magic: Teleport backfire", "Teleports caster to frontline for 1 turn",
                { target: this, duration: 1, properties: ["mystic", "positional"], listeners: { turnStart: true }, penalty: true, perm: true },
                function() {
                    this.vars.caster.position = "front";
                    this.vars.caster.base = { ...this.vars.caster.base, defense: 20, evasion: 60, focus: 80, speed: 120, presence: 180 };
                    logAction(`${this.vars.caster.name} teleports into the frontline.`, "info");
                    resetStat(this.vars.caster, ["defense", "evasion", "focus", "speed", "presence"]);
                    if (eventState.positionChange.length) handleEvent('positionChange', { unit: this.vars.caster, position: "front" });
                },
                function(context) {
                    if (context.unit === this.vars.caster) this.vars.duration--;
                    if (this.vars.duration <= 0) {
                        this.vars.caster.position = "back";
                        this.vars.caster.base = { ...this.vars.caster.base, defense: 30, evasion: 80, focus: 100, speed: 80, presence: 150 };
                        logAction(`${this.vars.caster.name} teleports back to the backline.`, "info");
                        resetStat(this.vars.caster, ["defense", "evasion", "focus", "speed", "presence"]);
                        if (eventState.positionChange.length) handleEvent('positionChange', { unit: this.vars.caster, position: "back" });
                        return !(this.vars.perm = false);
                    }
                },
                function() {}, function() {}
            );
            break;
        }
        case 2:
            auraModifier(`Wild Magic: Defense${buff ? '' : ' backfire'}`, `Increases defense and resist of all frontline ${buff ? "allies" : "enemies"}`,
                { targets: allUnits.filter(u => u.position === "front" && buff === (u.team === this.team)), duration: 1, properties: ["mystic", "buff"], listeners: { turnStart: true, positionChange: true }, cancelListeners: ['positionChange'] },
                function(target) { basicModifier("Wild Magic: Defense buff", "Increases defense and resist", {target, properties: ["mystic", "buff"], stats: { defense: 30, resist: 100 } }) },
                (u) => u.position === "front" && buff === (u.team === this.team)
            );
            break;
        case 3:
            currentAction.push([this, CouncilMagician.skills.special[0]]);
            CouncilMagician.skills.special[0].code.call(this, buff ? randTarget(allUnits.filter(u => u.hp && u.team !== this.team), 1, true) : [this]);
            currentAction.pop();
            break;
        case 4:
            new Modifier(`Wild Magic: Poison${buff ? '' : ' backfire'}`, 'Immediate and start of turn poison damage until resisted',
                { target: randTarget(allUnits.filter(u => u.hp && buff === (u.team === this.team)), 1, true)[0], properties: ["mystic", "attack", "dot", "poison"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 2 } },
                function() { return this.vars.debuff.call(this, this.vars.target) ? damage(this.vars.caster, [this.vars.target], [[.5]]) && false : logAction(`${this.vars.target.name} resisted ${this.vars.caster.name}'s wild magic poison`, 'miss') || true },
                function(context) { if (context.unit === this.vars.target) return resistDebuff(this.vars.caster, [this.vars.target]) >= 50 ? this.vars.applied && damage(this.vars.caster, [this.vars.target], [[.5]]) && false : true }
            );
            break;
        case 5: {
            const target = randTarget(allUnits.filter(u => u.hp < u.base.hp && buff === (u.team === this.team)), 1, true);
            target.length ? heal(this, target, [5]) : logAction(`${this.name}'s wild magic failed to heal anyone!`, 'miss');
            break;
        }
        case 6:
            blockModifier(`Wild Magic: Resource Block${buff ? '' : ' backfire'}`, { target: randTarget(allUnits.filter(u => u.hp && buff === (u.team === this.team)), 1, true)[0], duration: 2, properties: ["mystic", "debuff"], listeners: { turnEnd: true }, cancelListeners: ['resourceChange'], debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 2 } }, 'all')
            break;
        case 7:
            attack(randTarget(allUnits.filter(u => u.hp && buff === (u.team === this.team)), 1, true)[0], randTarget(allUnits.filter(u => u.hp && buff === (u.team === this.team)), 1, true), 3);
            break;
        case 8: {
            const target = randTarget(allUnits.filter(u => u.hp && buff === (u.team === this.team), '', false), 1, true);
            if (resistDebuff(this, target)[0] >= 2) stunModifier(`Wild Magic: Stun${buff ? '' : ' backfire'}`, { target: target[0], duration: 1, properties: ["mystic", "stun", "debuff"], listeners: { turnEnd: true }, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 2 } });
        }
    }
}