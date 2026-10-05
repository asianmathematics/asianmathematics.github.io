import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements } from '../combatDictionary.js';
import { allUnits, Modifier, toggleListeners, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, comma, capital, modifiers, currentAction, eventState } from '../modifier.js';
import { Unit } from './unit.js';

export const Mannequin = new Unit("Mannequin", [750, 45, 22, 120, 120, 125, 70, 130, 50, "mid", 100, 100, 10], 3, ["perfection/precision", "independence/loneliness", "passion/hatred"]);

Mannequin.description = "3-star physical midline unit with high offensive stats and speed but low defense and crit/debuff resist. Has strong attacks with reload mechanics.";

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
            code() { heal(this, allUnits.filter(u => u.position === this.position && u.team === this.team), 2.5+.25*(allUnits.some(u => u.name === "Classical (Joy)" && u.team === this.team && !u.custom?.summoner))); }
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
            description: "Attacks with increased attack to a single target 6 times or two targets 3 times, adds two hits if reloaded",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team), 2, false); },
            code(targets) { attack(this, targets, (this.custom?.dualWield ? this.custom.dualWield-- && 8 : 6) / targets.length, { attacker: { attack: { bonus: 10 } } }); }
        },
        {
            name: "Snipe",
            properties: ["physical", "stamina-block", "stamina", "attack", "pseudo-resource"],
            cost: { stamina: 40, position: "back" },
            description: "Attacks a single target with increased attack/accuracy/focus, can target backline, adds extra attack if reloaded",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.team !== this.team)); },
            code(target) { attack(this, target, 1, { attacker: { attack: { bonus: this.custom?.snipe ? this.custom.snipe-- && 180 : 120 }, accuracy: { bonus: 50 }, focus: { bonus: 60 } } }); }
        },
        {
            name: "Focus Fire",
            properties: ["physical", "stamina-block", "stamina", "attack", "pseudo-resource"],
            cost: { stamina: 40 },
            description: "Attacks a single target 3 times with increased attack/accuracy/focus, adds a hit and extra attack if reloaded",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)); },
            code(target) {
                const bonus = this.custom?.focusFire ? +!!this.custom.focusFire-- : 0;
                attack(this, target, 3+bonus, { attacker: { attack: { bonus: 25*(2 + bonus) }, accuracy: { bonus: 50 }, focus: { bonus: 60 } } });
            }
        },
        {
            name: "Reload",
            properties: ["physical", "stamina-block", "stamina", "pseudo-resource"],
            cost: { stamina: 50 },
            description: `Ignore reload mechanic for next 5 turns, reloads attacks afterwards. If currently active, refreshes duration and refund 10 stamina for each turn remaining`,
            code() {
                const dur = refreshModifier([{ name: "Reload", vars: { caster: this, target: this, parent: this.skills.special } }], 5)[0];
                dur ? resourceChange(this, { stamina: 10*dur }) : new Modifier("Reload", `Ignores reload mechanic`,
                    { target: this, duration: 5, properties: ["physical", "pseudo-resource"], listeners: { turnStart: true }, focus: true },
                    function() {
                        if (this.vars.cancel) return;
                        this.custom?.dualWield !== undefined && (this.custom.dualWield = 1);
                        this.custom?.snipe !== undefined && (this.custom.snipe = 1);
                        this.custom?.focusFire !== undefined && (this.custom.focusFire = 1);
                        logAction(`${this.vars.target.name} weapons turn automatic!`, "action");
                    },
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            this.custom?.dualWield !== undefined && (this.custom.dualWield = 1);
                            this.custom?.snipe !== undefined && (this.custom.snipe = 1);
                            this.custom?.focusFire !== undefined && (this.custom.focusFire = 1);
                            this.vars.duration--;
                        }
                        return this.vars.duration <= 0;
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
            code() { heal(this, unitByStat(allUnits.filter(u => u.position === this.position && u.team === this.team), 'hp', 'percent', false), [2.5+.5*(allUnits.some(u => u.name === "Classical (Joy)" && u.team === this.team && !u.custom?.summoner))]); }
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
                    attack(this, targets, 4 / targets.length, { attacker: { attack: { bonus: 10 } } });
                } else {
                    this.custom.dualWield++;
                    this.previousAction[0] = false;
                    logAction(`${this.name} is reloading weapons`);
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
                if (this.custom.snipe) this.custom.snipe--, attack(this, randTarget(allUnits.filter(u => u.hp && u.team !== this.team)), 1, { attacker: { attack: { bonus: 60 }, accuracy: { bonus: 35 }, focus: { bonus: 40 } } });
                else {
                    this.custom.snipe++;
                    this.previousAction[0] = false;
                    logAction(`${this.name} is reloading a weapon`);
                }
            }
        },
        {
            name: "Focus Fire",
            properties: ["physical", "stamina-block", "attack", "pseudo-resource"],
            description: "Attacks a single target 2 times with increased attack/accuracy/focus, increases attack and add a hit if reloaded",
            code() {
                const bonus = this.custom?.focusFire ? +!!this.custom.focusFire-- : 0;
                attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 2+bonus, { attacker: { attack: { bonus: 10*(2+bonus) }, accuracy: { bonus: 30 }, focus: { bonus: 40 } } });
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
            code() { heal(this, unitByStat(allUnits.filter(u => u.position === this.position && u.team === this.team), 'hp', 'percent', false), [1.5+.5*(allUnits.some(u => u.name === "Classical (Joy)" && u.team === this.team && !u.custom?.summoner))]); }
        },
        {
            name: "Ex-Revolutionary",
            properties: ["physical", "buff", "penalty"],
            description: "Increased attack & accuracy and decreased evasion/resist/presence for 1 turn",
            code() {
                const mod = refreshModifier([{ name: "Ex-Revolutionary buff", vars: { caster: this, target: this, parent: this.skills.secondary } }, { name: "Ex-Revolutionary penalty", vars: { caster: this, target: this, parent: this.skills.secondary } }]);
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
                logAction(`${this.name} reloads all attacks`, "action");
            }
        },
        {
            name: "Switch Position",
            properties: ["physical", "positional"],
            description: "Switch between front and backline positions",
            code() { this.switchPosition(); }
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
                        const list = allUnits.filter(u => u.position === this.vars.caster.position && u.team === this.vars.caster.team);
                        heal(this.vars.caster, unitByStat(list, 'hp', 'percent', false), [(list.filter(u => u.hp > 0 && !u.custom?.summoner).length - !allUnits.some(u => u.name === "Classical (Joy)" && u.team === this.team && !u.custom?.summoner))/2]);
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
                    function() { this.vars.caster.custom = { ...this.vars.caster.custom, dualWield: +!this.vars.cancel, snipe: +!this.vars.cancel, focusFire: +!this.vars.cancel }; },
                    function(context) {
                        if (context.unit === this.vars.caster && this.vars.applied) {
                            if (!this.vars.caster.custom.dualWield && resourceChange(this.vars.caster, this.vars.cost, false, false)) this.vars.caster.custom.dualWield = 1;
                            if (!this.vars.caster.custom.snipe && resourceChange(this.vars.caster, this.vars.cost, false, false)) this.vars.caster.custom.snipe = 1;
                            if (!this.vars.caster.custom.focusFire && resourceChange(this.vars.caster, this.vars.cost, false, false)) this.vars.caster.custom.focusFire = 1;
                        }
                    }
                );
            }
        }
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
                        const list = allUnits.filter(u => u.position === this.vars.caster.position && u.team === this.vars.caster.team);
                        heal(this.vars.caster, unitByStat(list, 'hp', 'percent', false), [(list.filter(u => u.hp > 0 && !u.custom?.summoner).length - !allUnits.some(u => u.name === "Classical (Joy)" && u.team === this.team && !u.custom?.summoner)) * .75]);
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
};

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
        this.base = { ...this.base, attack: 55, evasion: 80, resist: 55, speed: 150, presence: 100 };
        this.skills = {...this.frontSkills};
    } else {
        this.position = "back";
        this.base = { ...this.base, attack: 45, evasion: 120, resist: 70, speed: 130, presence: 50 };
        this.skills = {...this.backSkills};
    }
    logAction(`${this.name} moves to the ${this.position}line.`, "info");
    resetStat(this, ["attack", "evasion", "resist", "speed", "presence"]);
    if (!silent && eventState.positionChange.length) handleEvent('positionChange', { unit: this, position: this.position });
};

Mannequin.synergy = [
    {
        name: "Familiar Face",
        properties: ["synergy", "physical", "heal"],
        description: "Boosts Mannequin's healing skills when Classical (Joy) is an ally. When healing Classical (Joy), or when Classical (Joy) heals Mannequin, doubles heal rate",
        targets: ["Classical (Joy)"],
        code() {
            new Modifier("Familiar Face", "When healing Classical (Joy), or when Classical (Joy) heals Mannequin, doubles heal rate",
                { targets: [], properties: ["physical", "heal"], listeners: { singleHeal: true }, cancelListeners: ['singleHeal'], passive: true, synergy: true },
                function() {},
                function(context) { if ((context.healer.source.name === "Classical (Joy)" && !context.healer.custom?.summoner && context.target === this.vars.caster) || (context.target.source.name === "Classical (Joy)" && !context.target.custom?.summoner && context.healer === this.vars.caster)) context.mult = 2; }
            );
        }
    }
]