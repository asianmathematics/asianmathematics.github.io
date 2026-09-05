import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements } from '../combatDictionary.js';
import { Modifier, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, modifiers, currentAction, eventState } from '../modifier.js'
import { Unit, allUnits, createUnit } from './unit.js';

export const CouncilScientist = new Unit("Science Council Member", [1000, 21, 28, 100, 80, 120, 80, 80, 130, "back", 100, 70, 6, , , 80, 9], 3, ["independence/loneliness"]);

CouncilScientist.skills = {
    special: [
        {
            name: "Laser Turret",
            properties: ["physical", "stamina-block", "stamina", "techno", "energy-block", "energy", "attack", "dot"],
            cost: { stamina: 10, energy: 15 },
            description: "Attacks a single target with increased attack and accuracy at the end of this and the next 5 turns",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
            code(target) {
                new Modifier("Laser Turret", "Attacks target at end of caster's turn", 
                    { target: target[0], duration: 6, properties: ["techno", "attack", "dot"], listeners: { turnEnd: true } },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            if (this.vars.applied) attack(this.vars.caster, [this.vars.target], 1, { attack: { bonus: 60 }, accuracy: { bonus: 40 } });
                            this.vars.duration;
                        }
                        return this.vars.duration >= 0;
                    }
                );
            }
        },
        {
            name: "Drone",
            properties: ["techno", "energy-block", "energy", "summon"],
            cost: { energy: 50 },
            description: "Summons a 2-star drone to the frontline for 5 turns. If currently active, refreshes drone duration/HP and refunds 10 energy for each turn remaining",
            code() {
                let drone = modifiers.find(m => m.name === "Drone" && m.vars.caster === this);
                if (drone) {
                    resourceChange(this, { stamina: drone.vars.duration * 10 });
                    drone.vars.duration = 5;
                    hpChange(this, [drone.vars.target], [drone.vars.target.base.hp]);
                    resourceChange(drone.vars.target, { stamina: drone.vars.target.base.stamina, energy: drone.vars.target.base.energy });
                } else {
                    drone = createUnit({ ...Drone, name: "Deka Drone", star: 2 }, this.team);
                    drone.skills = droneSkills(this);
                    drone.custom = { ...drone.custom, summoner: this };
                    Object.keys(drone.base).filter(stat => stat !== "position" && stat !== "elements").forEach(stat => { drone.base[stat] = Math.ceil(drone.base[stat] * 1.5) });
                    resetStat(drone, Object.keys(drone.base).filter(s => s !== "position" && s !== "elements" ));
                    if (eventState.unitChange.length) handleEvent('unitChange', { type: 'summon', unit: drone });
                    new Modifier("Drone", "Summon 2-star drone",
                        { target: drone, duration: 5, properties: ["techno", "summon"], listeners: { turnEnd: true, unitChange: true }, perm: true },
                        function() {},
                        function(context) {
                            if (context.unit === this.vars.target) {
                                if (context.type === "death") return !(this.vars.perm = this.vars.listeners.unitChange = false);
                                if (context.event === "turnEnd") this.vars.duration--;
                            }
                            if (this.vars.duration <= 0 && this.vars.perm) {
                                this.vars.perm = false;
                                allUnits.splice(allUnits.indexOf(this.vars.target), 1);
                                if (eventState.unitChange.length) handleEvent('unitChange', { type: 'unsummon', unit: this.vars.target});
                                for (let i = modifiers.length - 1; i >= 0; i--) if (modifiers[i].vars.caster === this.vars.target) removeModifier(modifiers[i]);
                                return true;
                            }
                        },
                        function() {},
                        function() {}
                    );
                }
            }
        },
        {
            name: "EMP",
            properties: ["techno", "energy-block", "energy", "debuff", "cancel"],
            cost: { energy: 40 },
            description: "Ends non-passive techno modifiers target is focusing, cancels techno modifiers on target, and disables energy regen for a few turns depending on chance, 1% chance to fail",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
            code(target) {
                const will = resistDebuff(this, target)[0];
                will >= 2 ? attribCancelMod("EMP", { target: target[0], duration: will > 99 ? 4 : Math.ceil(will/33), properties: ["techno", "debuff", "cancel"], listeners: { turnEnd: true }, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 2 } }, 'techno') : logAction(`${target[0].name} resists the EMP!`, 'miss');
            }
        },
        {
            name: "Backup Power",
            properties: ["physical", "stamina-block", "stamina", "energy-gain"],
            cost: { stamina: 30 },
            description: "Recover a lot of energy (~45% max energy)",
            code() {
                resourceChange(this, { energy: 4.5 * this.energyRegen });
                logAction(`${this.name} turns on backup power!`, "buff");
            }
        },
        {
            name: "First Aid",
            properties: ["techno", "energy-block", "energy", "heal"],
            cost: { energy: 50 },
            description: "Heal all allies (~10% max HP)",
            code() { 
                const targets = allUnits.filter(u => u.team === this.team);
                if (eventState.targets.length) handleEvent('targets', { selectedTargets: targets, count: targets.length });
                heal(this, targets, Array(targets.length).fill(1));
            }
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
            name: "Laser Turret",
            properties: ["physical", "stamina-block", "techno", "energy-block", "attack", "dot"],
            description: "Attacks a target with increased attack and accuracy at the end of this and the next 5 turns",
            code() {
                new Modifier("Laser Turret", "Attacks target at end of caster's turn", 
                    { target: this, duration: 6, properties: ["techno", "attack", "dot"], listeners: { turnEnd: true } },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            if (this.vars.applied) attack(this.vars.caster, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 1, { attack: { bonus: 30 }, accuracy: { bonus: 40 } });
                            this.vars.duration;
                        }
                        return this.vars.duration >= 0;
                    }
                );
            }
        },
        {
            name: "Drone",
            properties: ["techno", "energy-block", "energy", "summon"],
            cost: { energy: 10 },
            description: "Summons a 1-star drone to the frontline for 3 turns. If currently active, refreshes drone duration/HP and refunds 5 energy for each turn remaining",
            code() {
                let drone = modifiers.find(m => m.name === "Drone" && m.vars.caster === this);
                if (drone) {
                    resourceChange(this, { stamina: drone.vars.duration * 5 });
                    drone.vars.duration = 3;
                    hpChange(this, [drone.vars.target], [drone.vars.target.base.hp]);
                    resourceChange(drone.vars.target, { stamina: drone.vars.target.base.stamina, energy: drone.vars.target.base.energy });
                } else {
                    drone = createUnit(Drone, this.team);
                    drone.skills = droneSkills(this);
                    drone.custom = { ...drone.custom, summoner: this };
                    if (eventState.unitChange.length) handleEvent('unitChange', { type: 'summon', unit: drone });
                    new Modifier("Drone", "Summon 2-star drone",
                        { target: drone, duration: 3, properties: ["techno", "summon"], listeners: { turnEnd: true, unitChange: true }, perm: true },
                        function() {},
                        function(context) {
                            if (context.unit === this.vars.target) {
                                if (context.type === "death") return !(this.vars.perm = this.vars.listeners.unitChange = false);
                                if (context.event === "turnEnd") this.vars.duration--;
                            }
                            if (this.vars.duration <= 0 && this.vars.perm) {
                                this.vars.perm = false;
                                allUnits.splice(allUnits.indexOf(this.vars.target), 1);
                                if (eventState.unitChange.length) handleEvent('unitChange', { type: 'unsummon', unit: this.vars.target});
                                for (let i = modifiers.length - 1; i >= 0; i--) if (modifiers[i].vars.caster === this.vars.target) removeModifier(modifiers[i]);
                                return true;
                            }
                        },
                        function() {},
                        function() {}
                    );
                }
            }
        },
        {
            name: "EMP",
            properties: ["techno", "energy-block", "energy", "debuff", "cancel"],
            cost: { energy: 10 },
            description: "Chance to end non-passive techno modifiers target is focusing, cancel techno modifiers on target, and disables energy regen for 1 turn",
            code() {
                const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team));
                resistDebuff(this, target)[0] >= 25 ? attribCancelMod("EMP", { target: target[0], duration: 1, properties: ["techno", "debuff", "cancel"], listeners: { turnEnd: true }, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 25 } }, 'techno') : logAction(`${target[0].name} resists the EMP!`, 'miss');
            }
        },
        {
            name: "Backup Power",
            properties: ["physical", "stamina-block", "stamina", "energy-gain"],
            cost: { stamina: 10 },
            description: "Recover a lot of energy (~25% max energy)",
            code() {
                resourceChange(this, { energy: 2.5 * this.energyRegen });
                logAction(`${this.name} turns on backup power.`, "buff");
            }
        },
        {
            name: "First Aid",
            properties: ["techno", "energy-block", "energy", "heal"],
            cost: { energy: 10 },
            description: "Heal lowest hp ally (~15% max HP)",
            code() { heal(this, unitByStat(allUnits.filter(u => u.team === this.team), 'hp', 'percent', false), [1.5]) }
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
            name: "Laser Turret",
            properties: ["physical", "techno", "attack", "dot"],
            description: "Attacks a target with increased attack and accuracy at the end of this and the next 2 turns",
            code() {
                new Modifier("Laser Turret", "Attacks target at end of caster's turn", 
                    { target: this, duration: 3, properties: ["techno", "attack", "dot"], listeners: { turnEnd: true } },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            if (this.vars.applied) attack(this.vars.caster, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 1, { attack: { bonus: 30 }, accuracy: { bonus: 40 } });
                            this.vars.duration;
                        }
                        return this.vars.duration >= 0;
                    }
                );
            }
        },
        {
            name: "Backup Power",
            properties: ["physical", "stakmina-block", "energy-gain"],
            description: "Recover some energy (~15% max energy)",
            code() {
                resourceChange(this, { energy: 1.5 * this.energyRegen });
                logAction(`${this.name} turns on backup power.`, "buff");
            }
        },
        {
            name: "First Aid",
            properties: ["techno", "energy-block", "heal"],
            description: "Heal lowest hp ally (~10% max HP)",
            code() { heal(this, unitByStat(allUnits.filter(u => u.team === this.team), 'hp', 'percent', false), [1]) }
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
            name: "Laser Turret",
            properties: ["physical", "techno", "attack", "dot"],
            reduction: { energy: 10 },
            description: "Attacks a target with increased attack and accuracy at the end of each turn",
            code() {
                new Modifier("Laser Turret", "Attacks a target at end of caster's turn", 
                    { target: this, properties: ["techno", "attack", "dot"], listeners: { turnEnd: true }, cancelListeners: ['turnEnd'], reduction: this.skills.passive.reduction, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster && this.vars.applied) attack(this.vars.caster, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 1, { attack: { bonus: 30 }, accuracy: { bonus: 40 } }) }
                );
            }
        },
        {
            name: "Drone",
            properties: ["techno", "summon"],
            reduction: { energy: 20, energyRegen: 2 },
            description: "Summons a 1-star drone to the frontline.",
            code() {
                const drone = createUnit(Drone, this.team);
                drone.skills = droneSkills(this);
                drone.custom = { ...drone.custom, summoner: this };
                if (eventState.unitChange.length) handleEvent('unitChange', { type: 'summon', unit: drone });
                new Modifier("Drone", "Summon 2-star drone",
                    { target: drone, properties: ["techno", "summon"], listeners: { unitChange: true }, reduction: this.skills.passive.reduction, perm: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.target && context.type === "death") return !(this.vars.perm = false) },
                    function() {},
                    function() {}
                );
            }
        },
        {
            name: "Backup Power",
            properties: ["physical", "energy-gain"],
            reduction: { stamina: 20, staminaRegen: 2 },
            description: "Regen energy (~10% max energy) each turn",
            code() {
                new Modifier("Backup Power", `Regen energy (~10% max energy) each turn`,
                    { target: this, properties: ["physical", "energy-gain"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.passive.reduction, focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster) resourceChange(this.vars.target, { energy: this.vars.target.energyRegen }) }
                );
            }
        },
        {
            name: "First Aid",
            properties: ["techno", "heal"],
            reduction: { energy: 10, energyRegen: 1 },
            description: `Heals lowest hp ally slightly (~5% max HP) at start of turn`,
            code() {
                new Modifier("First Aid", `Heals at start of turn`,
                    { target: this, properties: ["techno", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.passive.reduction, focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster) heal(this.vars.caster, unitByStat(allUnits.filter(u => u.team === this.vars.caster.team), 'hp', 'percent', false), [.5]) }
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
            name: "Backup Power",
            properties: ["physical", "energy-gain"],
            reduction: { stamina: 20, staminaRegen: 2 },
            description: "Regen energy (~15% max energy) each turn",
            code() {
                new Modifier("Backup Power", `Regen energy (~15% max energy) each turn`,
                    { target: this, properties: ["physical", "energy-gain"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.passive.reduction, focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster) resourceChange(this.vars.target, { energy: this.vars.target.energyRegen * 1.5 }) }
                );
            }
        },
        {
            name: "First Aid",
            properties: ["techno", "heal"],
            reduction: { energy: 10, energyRegen: 1 },
            description: `Heals lowlest hp ally slightly (~7.5% max HP) at start of turn`,
            code() {
                new Modifier("First Aid", `Heals at start of turn`,
                    { target: this, properties: ["techno", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.passive.reduction, focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster) heal(this.vars.caster, unitByStat(allUnits.filter(u => u.team === this.vars.caster.team), 'hp', 'percent', false), [.75]) }
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

CouncilScientist.defaultSkills = [
    { category: 'special', name: 'Drone' },
    { category: 'basic', name: 'First Aid' },
    { category: 'secondary', name: 'Backup Power' },
    { category: 'passive', name: 'Laser Turret' },
    { category: 'augment', name: 'Pursuit of Knowledge' }
];

const Drone = new Unit("Drone", [450, 10, 14, 44, 36, 50, 36, 36, 60, "front", 44, 30, 4, , , 44, 6], 2);

Drone.skills = [
    {
        special: [
            {
                name: "Laser",
                properties: ["techno", "energy-block", "energy", "attack"],
                cost: { energy: 15 },
                description: "Makes 3 attacks at a single target with increased accuracy",
                target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
                code(target) { attack(this, target, 3, { accuracy: { bonus: 40 } }) }
            },
            {
                name: "Heal",
                properties: ["techno", "energy-block", "energy", "heal"],
                cost: { energy: 25 },
                description: "Heal ally (~25% max HP)",
                target() { specialTarget(this, allUnits.filter(u => u.team === this.team)) },
                code(target) { heal(this, target, [2]) }
            },
            {
                name: "Disrupt Energy",
                properties: ["techno", "energy-block", "energy", "debuff"],
                cost: { energy: 20 },
                description: "Block target energy regen for 1 turn, 1% chance to fail",
                target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
                code(target) {
                    const will = resistDebuff(this, target)[0];
                    will >= 2 ? blockModifier("Disrupt Energy", { target: target[0], duration: 1, properties: ["techno", "debuff"], listeners: { turnEnd: true }, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 2 } }, 'energy') : logAction(`${target[0].name} resists Disrupt Energy!`, 'miss');
                } 
            }
        ],
        basic: [
            {
                name: "Laser",
                properties: ["techno", "energy-block", "attack"],
                description: "Makes 2 attacks at a single target",
                code() { attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 2) }
            },
            {
                name: "Heal",
                properties: ["techno", "energy-block", "energy", "heal"],
                cost: { energy: 10 },
                description: "Heal lowest hp frontline ally (~15% max HP)",
                code() { heal(this, unitByStat(allUnits.filter(u => u.position === "front" && u.team === this.team), 'hp', 'percent', false), [1.5]) }
            },
            {
                name: "Disrupt Energy",
                properties: ["techno", "energy-block", "debuff"],
                description: "Chance to block target energy regen for 1 turn",
                code() {
                    const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), will = resistDebuff(this, target)[0];
                    will >= 60 ? blockModifier("Disrupt Energy", { target: target[0], duration: 1, properties: ["techno", "debuff"], listeners: { turnEnd: true }, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 2 } }, 'energy') : logAction(`${target[0].name} resists Disrupt Energy!`, 'miss');
                }
            }
        ],
        passive: [
            {
                name: "Heal",
                properties: ["techno", "heal"],
                description: `Heals lowest hp frontline ally slightly (~5% max HP) at start of turn`,
                code() {
                    new Modifier("First Aid", `Heals lowest hp frontline ally at start of turn`,
                        { target: this, properties: ["techno", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true, passive: true },
                        function() {},
                        function(context) { if (context.unit === this.vars.caster) heal(this.vars.caster, unitByStat(allUnits.filter(u => u.position === "front" && u.team === this.vars.caster.team), 'hp', 'percent', false), [.5]) }
                    );
                }
            },
        ]
    },
    {
        special: [
            {
                name: "Laser",
                properties: ["techno", "energy-block", "energy", "attack"],
                cost: { energy: 20 },
                description: "Makes 3 attacks at a single target with increased attack and accuracy",
                target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
                code(target) { attack(this, target, 3, { attack: { bonus: 10 }, accuracy: { bonus: 60 } }) }
            },
            {
                name: "Heal",
                properties: ["techno", "energy-block", "energy", "heal"],
                cost: { energy: 40 },
                description: "Heal all allies in the same position (~15% max HP)",
                target() { specialTarget(this, allUnits.filter(u => u.team === this.team)) },
                code(target) {
                    const targets = allUnits.filter(u => u.position === target[0].position && u.team === target[0].team);
                    heal(this, targets, Array(targets.length).fill(1.5));
                }
            },
            {
                name: "Disrupt Energy",
                properties: ["techno", "energy-block", "energy", "debuff"],
                cost: { energy: 30 },
                description: "Block target energy regen for a few turns depending on chance, 1% chance to fail",
                target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
                code(target) {
                    const will = resistDebuff(this, target)[0];
                    will >= 2 ? blockModifier("Disrupt Energy", { target: target[0], duration: Math.ceil(will/33), properties: ["techno", "debuff"], listeners: { turnEnd: true }, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 2 } }, 'energy') : logAction(`${target[0].name} resists Disrupt Energy!`, 'miss');
                } 
            },
            {
                name: "Recharge",
                properties: ["physical", "stamina-block", "stamina", "energy-gain"],
                cost: { stamina: 20 },
                description: "Recover a lot of energy (~35% max energy)",
                code() {
                    resourceChange(this, { energy: 3.5 * this.energyRegen });
                    logAction(`${this.name} recharges!`, "buff");
                }
            }
        ],
        basic: [
            {
                name: "Laser",
                properties: ["techno", "energy-block", "attack"],
                description: "Makes 3 attacks at a single target",
                code() { attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 3) }
            },
            {
                name: "Heal",
                properties: ["techno", "energy-block", "energy", "heal"],
                cost: { energy: 5 },
                description: "Heal lowest hp frontline ally (~15% max HP)",
                code() { heal(this, unitByStat(allUnits.filter(u => u.position === "front" && u.team === this.team), 'hp', 'percent', false), [1.5]) }
            },
            {
                name: "Disrupt Energy",
                properties: ["techno", "energy-block", "debuff"],
                description: "Chance to block target energy regen for 1 turn",
                code() {
                    const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), will = resistDebuff(this, target)[0];
                    will >= 30 ? blockModifier("Disrupt Energy", { target: target[0], duration: 1, properties: ["techno", "debuff"], listeners: { turnEnd: true }, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 2 } }, 'energy') : logAction(`${target[0].name} resists Disrupt Energy!`, 'miss');
                }
            },
            {
                name: "Recharge",
                properties: ["physical", "stamina-block", "stamina", "energy-gain"],
                cost: { stamina: 10 },
                description: "Recover a lot of energy (~25% max energy)",
                code() {
                    resourceChange(this, { energy: 2.5 * this.energyRegen });
                    logAction(`${this.name} recharges.`, "buff");
                }
            }
        ],
        secondary: [
            {
                name: "Laser",
                properties: ["techno", "attack"],
                description: "Makes 2 attacks at a single target",
                code() { attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 2) }
            },
            {
                name: "Heal",
                properties: ["techno", "energy-block", "heal"],
                description: "Heal lowest hp ally (~7.5% max HP)",
                code() { heal(this, unitByStat(allUnits.filter(u => u.position === "front" && u.team === this.team), 'hp', 'percent', false), [.75]) }
            },
            {
                name: "Recharge",
                properties: ["physical", "stamina-block", "energy"],
                description: "Recover some energy (~15% max energy)",
                code() {
                    resourceChange(this, { energy: 1.5 * this.energyRegen });
                    logAction(`${this.name} recharges.`, "buff");
                }
            }
        ],
        passive: [
            {
                name: "Heal",
                properties: ["techno", "heal"],
                reduction: { energy: 10, energyRegen: 2 },
                description: `Heals lowest hp frontline ally slightly (~5% max HP) at start of turn`,
                code() {
                    new Modifier("First Aid", `Heals lowest hp frontline ally at start of turn`,
                        { target: this, properties: ["techno", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.passive.reduction, focus: true, passive: true },
                        function() {},
                        function(context) { if (context.unit === this.vars.caster) heal(this.vars.caster, unitByStat(allUnits.filter(u => u.position === "front" && u.team === this.vars.caster.team), 'hp', 'percent', false), [.5]) }
                    );
                }
            },
            {
                name: "Recharge",
                properties: ["physical", "energy-gain"],
                reduction: { stamina: 20, staminaRegen: 2 },
                description: "Regen energy (~10% max energy) each turn",
                code() {
                    new Modifier("Recharge", `Regen energy (~10% max energy) each turn`,
                        { target: this, properties: ["physical", "energy-gain"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.passive.reduction, focus: true, passive: true },
                        function() {},
                        function(context) { if (context.unit === this.vars.caster && this.vars.applied ) resourceChange(this.vars.target, { energy: this.vars.target.energyRegen }) }
                    );
                }
            },
        ]
    }
]

const droneSkills = function(unit) {
    const two = unit.skills.special?.name === "Drone";
    const has = n => Object.values(unit.skills).some(s => s?.name === n);
    const list = {
        laser: [has("Laser Turret"), "Laser"],
        heal: [has("First Aid"), "Heal"],
        disrupt: [has("EMP"), "Disrupt Energy"],
        ...(two ? { recharge: [has("Backup Power"), "Recharge"]} : {})
    }
    const skills = { passive: (two && !list.recharge[0]) ? 'Recharge' : 'Heal'};
    for (const skill of (two ? ['basic', 'secondary', 'special'] : ['basic', 'special'])) skills[skill] = list[Object.keys(list).filter(s => !list[s][0] && !Object.values(skills).includes(list[s][1]) && !(skill === 'secondary' && s === 'disrupt'))[0] || Object.keys(list).find(s => !Object.values(skills).includes(list[s][1]) && !(skill === 'secondary' && s === 'disrupt'))][1];
    return Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, Drone.skills[+two][k].find(s => s.name === v)]));
}