import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements } from '../combatDictionary.js';
import { Modifier, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, modifiers, currentAction, eventState } from '../modifier.js'
import { Unit, allUnits } from './unit.js';

export const Mannequin = new Unit("Mannequin", [800, 45, 22, 140, 130, 150, 70, 145, 50, "mid", 120, 100, 10], 3, ["perfection/precision", "independence/loneliness", "passion/hatred"]);

Mannequin.description = "3-star physical midline unit with high offensive stats and speed but low defense and crit/debuff resist. Has strong attacks with reload mechanics."

Mannequin.skills = {
    special: [
        {
            name: "A Wish to be an Artificial",
            properties: ["physical", "stamina-block", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Increased accuracy/focus/speed and decreased presence & resist for 5 turns",
            code() {
                basicModifier("A Wish to be an Artificial buff", "Accuracy, focus, and speed increase", { target: this, duration: 6, properties: ["physical", "buff"], stats: { accuracy: 60, focus: 50, speed: 25 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("A Wish to be an Artificial penalty", "Resist and presence decrease", { target: this, duration: 6, properties: ["physical", "penalty"], stats: { resist: -25, presence: -35 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        },
        {
            name: "Emergency Aid",
            properties: ["physical", "stamina-block", "stamina", "heal", "positional"],
            cost: { stamina: 50 },
            description: "Heals self and all allies (around ~25% max hp) in the same position",
            code() {
                const targets = allUnits.filter(u => u.position === this.position && u.team === this.team);
                if (eventState.targets.length) handleEvent('targets', { selectedTargets: targets, count: targets.length });
                heal(this, targets, Array(targets.length).fill(2.5));
            }
        },
        {
            name: "Ex-Revolutionary",
            properties: ["physical", "stamina-block", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Increased attack/accuracy/focus and decreased defense/evasion/resist/presence for 5 turns",
            code() {
                basicModifier("Ex-Revolutionary buff", "Attack, accuracy, and focus increase", { target: this, duration: 6, properties: ["physical", "buff"], stats: { attack: 40, accuracy: 80, focus: 60 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("Ex-Revolutionary penalty", "Defense, evasion, resist, and presence decrease", { target: this, duration: 6, properties: ["physical", "penalty"], stats: { defense: -10, evasion: -25, resist: -30, presence: -50 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        },
        {
            name: "Dual Wield",
            properties: ["physical", "stamina-block", "stamina", "attack", "multi-target", "pseudo-resource"],
            cost: { stamina: 40, position: "front" },
            description: "Attacks with increased attack to a single target 8 times or two targets 4 times, adds two hits if reloaded",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team), 2, false) },
            code(targets) { attack(this, targets, (this.custom?.dualWield ? this.custom.dualWield-- && 10 : 8) / targets.length, { attacker: { attack: { bonus: 25 } } }) }
        },
        {
            name: "Snipe",
            properties: ["physical", "stamina-block", "stamina", "attack", "pseudo-resource"],
            cost: { stamina: 40, position: "back" },
            description: "Attacks a single target with increased attack/accuracy/focus, can target backline, adds extra attack if reloaded",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.team !== this.team)) },
            code(target) { attack(this, target, 1, { attacker: { attack: { bonus: this.custom?.snipe ? this.custom.snipe-- && 90 : 60 }, accuracy: { bonus: 70 }, focus: { bonus: 80 } } }) }
        },
        {
            name: "Focus Fire",
            properties: ["physical", "stamina-block", "stamina", "attack", "pseudo-resource"],
            cost: { stamina: 40 },
            description: "Attacks a single target 4 times with increased attack/accuracy/focus, adds two hits and extra attack if reloaded",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
            code(target) {
                const bonus = this.custom?.focusFire ? !!this.custom.focusFire-- : 0;
                attack(this, target, 4 + 2*bonus, { attacker: { attack: { bonus: 50*(1 + bonus) }, accuracy: { bonus: 35 }, focus: { bonus: 40 } } });
            }
        },
        {
            name: "Reload",
            properties: ["physical", "stamina-block", "stamina", "pseudo-resource"],
            cost: { stamina: 50 },
            description: `Ignore reload mechanic for next 5 turns, reloads attacks afterwards. If currently active, refreshes duration and refund 10 stamina for each turn remaining`,
            code() {
                const dur = refreshModifier([{ name: "Reload", vars: { caster: this, target: this, parent: this.skills.special } }], 5)[0];
                dur ? resourceChange(this, { stamina: 10*dur }) : logAction(`${this.name}'s weapons turn automatic!`, "buff") || new Modifier("Reload", `Ignores reload mechanic`,
                    { target: this, duration: 5, properties: ["physical", "pseudo-resource"], listeners: { turnStart: true }, focus: true },
                    function() {
                        this.custom?.dualWield !== undefined && (this.custom.dualWield = 1);
                        this.custom?.snipe !== undefined && (this.custom.snipe = 1);
                        this.custom?.focusFire !== undefined && (this.custom.focusFire = 1);
                        logAction(`${this.vars.target.name} reloads all weapons!`, "buff");
                    },
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            this.custom?.dualWield !== undefined && (this.custom.dualWield = 1);
                            this.custom?.snipe !== undefined && (this.custom.snipe = 1);
                            this.custom?.focusFire !== undefined && (this.custom.focusFire = 1);
                            this.vars.duration--;
                        }
                        if (this.vars.duration <= 0);
                    }
                );
            }
        },
        {
            name: "Switch Position",
            properties: ["physical", "stamina-block", "stamina", "positional"],
            cost: { stamina: 10 },
            description: "Switch between front and backline positions and immediately gain next turn",
            code() {
                this.switchPosition();
                this.timer -= 1000;
            }
        }
    ],
    basic: [
        {
            name: "A Wish to be an Artificial",
            properties: ["physical", "stamina-block", "buff", "penalty"],
            description: "Increased accuracy & speed and decreased presence & resist for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                const mod = refreshModifier([{ name: "A Wish to be an Artificial buff", vars: { caster: this, target: this, parent: this.skills.basic } }, { name: "A Wish to be an Artificial penalty", vars: { caster: this, target: this, parent: this.skills.basic } }]);
                if (!mod[0]) basicModifier("A Wish to be an Artificial buff", "Accuracy, focus, and speed increase", { target: this, duration: 3, properties: ["physical", "buff"], stats: { accuracy: 50, focus: 25, speed: 20 }, listeners: { turnEnd: true }, focus: true });
                if (!mod[1]) basicModifier("A Wish to be an Artificial penalty", "Resist and presence decrease", { target: this, duration: 3, properties: ["physical", "penalty"], stats: { resist: -20, presence: -30 }, listeners: { turnEnd: true }, focus: true, penalty: true });
                if (mod[0]+mod[1]) this.previousAction[0] = false;
            }
        },
        {
            name: "Emergency Aid",
            properties: ["physical", "stamina-block", "stamina", "heal", "positional"],
            cost: { stamina: 20 },
            description: "Heals lowest hp ally (around ~25% max hp) in the same position",
            code() { heal(this, unitByStat(allUnits.filter(u => u.position === this.position && u.team === this.team), 'hp', 'percent', false), [2.5]) }
        },
        {
            name: "Ex-Revolutionary",
            properties: ["physical", "stamina-block", "buff", "penalty"],
            description: "Increased attack & accuracy and decreased evasion/resist/presence for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                const mod = refreshModifier([{ name: "Ex-Revolutionary buff", vars: { caster: this, target: this, parent: this.skills.basic } }, { name: "Ex-Revolutionary penalty", vars: { caster: this, target: this, parent: this.skills.basic } }]);
                if (!mod[0]) basicModifier("Ex-Revolutionary buff", "Attack, accuracy, and focus increase", { target: this, duration: 3, properties: ["physical", "buff"], stats: { attack: 40, accuracy: 60, focus: 30 }, listeners: { turnEnd: true }, focus: true });
                if (!mod[1]) basicModifier("Ex-Revolutionary penalty", "Defense, evasion, resist, and presence decrease", { target: this, duration: 3, properties: ["physical", "penalty"], stats: { defense: -10, evasion: -10, resist: -30, presence: -50 }, listeners: { turnEnd: true }, focus: true, penalty: true });
                if (mod[0]+mod[1]) this.previousAction[0] = false;
            }
        },
        {
            name: "Dual Wield",
            properties: ["physical", "stamina-block", "attack", "multi-target", "pseudo-resource"],
            cost: { position: "front" },
            description: "Attacks with increased attack to a single target 4 times or two targets 2 times, requires reload to be used again",
            code() {
                (this.custom ??= {}).dualWield ??= 1;
                if (this.custom.dualWield) {
                    this.custom.dualWield--;
                    const targets = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team), Math.ceil(Math.random() * 2));
                    attack(this, targets, 4 / targets.length, { attacker: { attack: { bonus: 25 } } });
                } else {
                    this.custom.dualWield++;
                    this.previousAction[0] = false;
                    logAction(`${this.name} is reloading weapons!`, "info");
                }
            }
        },
        {
            name: "Snipe",
            properties: ["physical", "stamina-block", "attack", "pseudo-resource"],
            cost: { position: "back" },
            description: "Attacks a single target with increased attack/accuracy/focus, can target backline, requires reload to be used again",
            code() {
                (this.custom ??= {}).snipe ??= 1;
                if (this.custom.snipe) this.custom.snipe--, attack(this, randTarget(allUnits.filter(u => u.hp && u.team !== this.team)), 1, { attacker: { attack: { bonus: 30 }, accuracy: { bonus: 35 }, focus: { bonus: 40 } } });
                else {
                    this.custom.snipe++;
                    this.previousAction[0] = false;
                    logAction(`${this.name} is reloading a weapon!`, "info");
                }
            }
        },
        {
            name: "Focus Fire",
            properties: ["physical", "stamina-block", "attack", "pseudo-resource"],
            description: "Attacks a single target 2 times with increased attack/accuracy/focus, doubles the hits and attack if reloaded",
            code() {
                const bonus = (this.custom?.focusFire ? !!this.custom.focusFire-- : 0)+1;
                attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 2*bonus, { attacker: { attack: { bonus: 25*bonus }, accuracy: { bonus: 15 }, focus: { bonus: 20 } } });
            }
        },
        {
            name: "Switch Position",
            properties: ["physical", "stamina-block", "positional"],
            description: "Switch between front & backline positions and reduce timer by 50% for next turn",
            code() {
                this.switchPosition();
                this.timer -= 500;
            }
        }
    ],
    secondary: [
        {
            name: "A Wish to be an Artificial",
            properties: ["physical", "buff", "penalty"],
            description: "Increased accuracy & speed and decreased presence & resist for 1 turn",
            code() {
                const mod = refreshModifier([{ name: "A Wish to be an Artificial buff", vars: { caster: this, target: this, parent: this.skills.secondary } }, { name: "A Wish to be an Artificial penalty", vars: { caster: this, target: this, parent: this.skills.secondary } }]);
                if (!mod[0]) basicModifier("A Wish to be an Artificial buff", "Accuracy and speed increase", { target: this, duration: 2, properties: ["physical", "buff"], stats: { accuracy: 40, speed: 20 }, listeners: { turnEnd: true }, focus: true });
                if (!mod[1]) basicModifier("A Wish to be an Artificial penalty", "Resist and presence decrease", { target: this, duration: 2, properties: ["physical", "penalty"], stats: { resist: -15, presence: -25 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        },
        {
            name: "Emergency Aid",
            properties: ["physical", "stamina-block", "heal", "positional"],
            description: "Heals lowest hp ally (around ~15% max hp) in the same position",
            code() { heal(this, unitByStat(allUnits.filter(u => u.position === this.position && u.team === this.team), 'hp', 'percent', false), [1.5]) }
        },
        {
            name: "Ex-Revolutionary",
            properties: ["physical", "buff", "penalty"],
            description: "Increased attack & accuracy and decreased evasion/resist/presence for 1 turn",
            code() {
                const mod = refreshModifier([{ name: "Ex-Revolutionary buff", vars: { caster: this, target: this, parent: secondary } }, { name: "Ex-Revolutionary penalty", vars: { caster: this, target: this, parent: this.skills.secondary } }]);
                if (!mod[0]) basicModifier("Ex-Revolutionary buff", "Attack and accuracy increase", { target: this, duration: 2, properties: ["physical", "buff"], stats: { attack: 30, accuracy: 20 }, listeners: { turnEnd: true }, focus: true });
                if (!mod[1]) basicModifier("Ex-Revolutionary penalty", "Evasion, resist, and presence decrease", { target: this, duration: 2, properties: ["physical", "penalty"], stats: { evasion: -10, resist: -30, presence: -50 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        },
        {
            name: "Reload",
            properties: ["physical", "pseudo-resource"],
            description: `Reloads all attacks`,
            code() {
                this.custom?.dualWield !== undefined && (this.custom.dualWield = 2);
                this.custom?.snipe !== undefined && (this.custom.snipe = 2);
                this.custom?.focusFire !== undefined && (this.custom.focusFire = 2);
                logAction(`${this.name} reloads all attacks.`, "action");
            }
        },
        {
            name: "Switch Position",
            properties: ["physical", "positional"],
            description: "Switch between front and backline positions",
            code() { this.switchPosition() }
        }
    ],
    passive: [
        {
            name: "A Wish to be an Artificial",
            properties: ["physical", "buff", "penalty"],
            description: "Increased accuracy & speed and decreased presence & resist",
            code() {
                basicModifier("A Wish to be an Artificial buff", "Accuracy and speed increase", { target: this, properties: ["physical", "buff"], stats: { accuracy: 30, speed: 15 }, focus: true, passive: true });
                basicModifier("A Wish to be an Artificial penalty", "Resist and presence decrease", { target: this, properties: ["physical", "penalty"], stats: { resist: -25, presence: -35 }, focus: true, penalty: true, passive: true });
            }
        },
        {
            name: "Emergency Aid",
            properties: ["physical", "heal", "positional"],
            reduction: { stamina: 20, staminaRegen: 2 },
            description: "Heals lowest hp ally (around ~5% max hp) in the same position times number of alive non-summon allies in same position",
            code() {
                new Modifier("Emergency Aid", `Heals lowest hp ally (around ~5% max hp) in the same position times number of alive non-summon allies in same position`,
                    { target: this, properties: ["physical", "heal", "positional"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true, passive: true },
                    function() {},
                    function(context) {
                        if (context.unit !== this.vars.caster) return;
                        let list = allUnits.filter(u => u.position === this.position && u.team === this.team);
                        if (this.vars.applied) heal(this.vars.caster, unitByStat(list, 'hp', 'percent', false), [(list.filter(u => u.hp > 0 && !u.custom?.summoner).length - 1)/2]);
                    }
                );
            }
        },
        {
            name: "Ex-Revolutionary",
            properties: ["physical", "buff", "penalty"],
            description: "Increased attack/accuracy/focus and decreased defense/evasion/resist/presence",
            code() {
                basicModifier("Ex-Revolutionary buff", "attack, accuracy, and focus increase", { target: this, properties: ["physical", "buff"], stats: { attack: 20, accuracy: 20, focus: 15 }, focus: true, passive: true } );
                basicModifier("Ex-Revolutionary penalty", "Defense, evasion, resist, and presence decrease", { target: this, properties: ["physical", "penalty"], stats: { defense: -20, evasion: -25, resist: -50, presence: -50 }, focus: true, penalty: true, passive: true });
            }
        },
        {
            name: "Reload",
            properties: ["physical", "stamina", "pseudo-resource"],
            cost: { stamina: 10 },
            description: `Spends stamina to instantly reload attacks, doesn't reload if stamina is too low`,
            code() {
                new Modifier("Reload", `Ignores reload mechanic`,
                    { target: this, properties: ["physical", "stamina", "pseudo-resource"], listeners: { turnEnd: true }, cancelListeners: ['turnEnd'], cost: this.skills.passive.cost, focus: true, passive: true},
                    function() { this.vars.caster.custom = { dualWield: 1, snipe: 1, focusFire: 1 } },
                    function(context) {
                        if (context.unit === this.vars.caster && this.vars.applied) {
                            if (!this.vars.caster.custom.dualWield && resourceChange(this.vars.caster, this.vars.cost, false)) this.vars.caster.custom.dualWield = 1;
                            if (!this.vars.caster.custom.snipe && resourceChange(this.vars.caster, this.vars.cost, false)) this.vars.caster.custom.snipe = 1;
                            if (!this.vars.caster.custom.focusFire && resourceChange(this.vars.caster, this.vars.cost, false)) this.vars.caster.custom.focusFire = 1;
                        }
                    }
                );
            }
        },
    ],
    augment: [
        {
            name: "A Wish to be an Artificial",
            properties: ["physical", "buff", "penalty"],
            description: "Increased accuracy & speed and decreased presence & resist",
            code() {
                basicModifier("A Wish to be an Artificial buff", "Accuracy and speed increase", { target: this, properties: ["physical", "buff"], stats: { accuracy: 40, speed: 30 }, focus: true, passive: true });
                basicModifier("A Wish to be an Artificial penalty", "Resist and presence decrease", { target: this, properties: ["physical", "penalty"], stats: { resist: -15, presence: -25 }, focus: true, penalty: true, passive: true });
            }
        },
        {
            name: "Emergency Aid",
            properties: ["physical", "stamina", "heal", "positional"],
            reduction: { stamina: 20, staminaRegen: 2 },
            description: "Reduce max stamina by 20 and base stamina regen by 2\nHeals lowest hp ally (around ~7.5% max hp) in the same position times number of alive non-summon allies in same position",
            code() {
                new Modifier("Emergency Aid", `Heals lowest hp ally (around ~7.5% max hp) in the same position times number of alive non-summon allies in same position`,
                    { target: this, properties: ["physical", "stamina", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.augment.reduction, focus: true, passive: true },
                    function() {},
                    function(context) {
                        if (context.unit !== this.vars.caster) return;
                        let list = allUnits.filter(u => u.position === this.position && u.team === this.team);
                        if (this.vars.applied) heal(this.vars.caster, unitByStat(list, 'hp', 'percent', false), [(list.filter(u => u.hp > 0 && !u.custom?.summoner).length - 1) * .75]);
                    }
                );
            }
        },
        {
            name: "Ex-Revolutionary",
            properties: ["physical", "buff", "penalty"],
            description: "Increased attack/accuracy/focus and decreased defense/evasion/resist/presence",
            code() {
                basicModifier("Ex-Revolutionary buff", "attack, accuracy, and focus increase", { target: this, properties: ["physical", "buff"], stats: { attack: 40, accuracy: 40, focus: 30 }, focus: true, passive: true });
                basicModifier("Ex-Revolutionary penalty", "Defense, evasion, resist, and presence decrease", { target: this, properties: ["physical", "penalty"], stats: { defense: -10, evasion: -15, resist: -30, presence: -40 }, focus: true, penalty: true, passive: true });
            }
        },
    ]
}

Mannequin.frontDefaultSkills = [
    { category: 'special', name: 'Switch Position' },
    { category: 'basic', name: 'Dual Wield' },
    { category: 'secondary', name: 'Emergency Aid' },
    { category: 'passive', name: 'Reload' },
    { category: 'augment', name: 'A Wish to be an Artificial' }
];

Mannequin.backDefaultSkills = [
    { category: 'special', name: 'Switch Position' },
    { category: 'basic', name: 'Snipe' },
    { category: 'secondary', name: 'Emergency Aid' },
    { category: 'passive', name: 'Reload' },
    { category: 'augment', name: 'A Wish to be an Artificial' }
];

Mannequin.switchPosition = function(silent = false) {
    if (this.position === "back") {
        this.position = "front";
        this.base = { ...this.base, attack: 55, evasion: 90, resist: 55, speed: 165, presence: 100 };
        this.skills = {...this.frontSkills}
    } else {
        this.position = "back";
        this.base = { ...this.base, attack: 45, evasion: 130, resist: 70, speed: 145, presence: 50 };
        this.skills = {...this.backSkills}
    }
    logAction(`${this.name} moves to the ${this.position}line.`, "info");
    resetStat(this, ["attack", "evasion", "resist", "speed", "presence"]);
    if (!silent && eventState.positionChange.length) handleEvent('positionChange', { unit: this, position: this.position });
}