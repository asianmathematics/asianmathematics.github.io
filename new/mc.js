import { DexSoldier } from './unit/dexSoldier.js';
import { FourArcher } from './unit/fourArcher.js';
import { Mannequin } from './unit/mannequin.js';
import { Silhouette } from './unit/silhouette.js';
import { Doctor } from './unit/doctor.js';
import { Electric } from './unit/electric.js';
import { ClassicJoy } from './unit/classicJoy.js';
import { enemy } from './unit/enemy.js';
import { ArtificialSoldier } from './unit/artificialSoldier.js';
import { CouncilMagician } from './unit/councilMagician.js';
import { CouncilScientist } from './unit/councilScientist.js';
import { Experiment } from './unit/experiment.js';
import { Reject } from './unit/reject.js';
import { Revolutionary } from './unit/revolutionary.js';
import { regenerateResources, specialTarget, randTarget, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements, combatSpeedMultiplier } from './combatDictionary.js';
import { allUnits, Modifier, toggleListeners, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, comma, capital, modifiers, currentAction, eventState, stopOnErr } from './modifier.js';
import { Unit, createUnit, cloneUnit } from './unit/unit.js';
import { appendFileSync } from 'node:fs';

let seed;
let id;
const unitList = [DexSoldier, FourArcher, Mannequin, Silhouette, Doctor, Electric, ClassicJoy, enemy, ArtificialSoldier, CouncilMagician, CouncilScientist, Experiment, Reject, Revolutionary];
combatSpeedMultiplier[0] = 1e9;
stopOnErr[0] = true;

const mod = new Modifier("Simulation Log", "Logs all events", { caster: { name: "System" }, target: { name: "system" }, properties: ["system"], listeners: {}, list: [], perm: true },
    function() {
        Object.keys(eventState).forEach(e => this.vars.listeners[e] = true);
        delete this.vars.listeners.critStart;
        delete this.vars.listeners.damageStart;
        delete this.vars.listeners.healStart;
        this.vars.off = true;
    },
    function(context) {
        if (context.temp || context.filter) return;
        this.vars.list.push(context);
        if (!this.vars.off) {
            for (let i = 0; i < this.vars.list.length-1; i++) appendFileSync("../../greanandin/log.jsonl", JSON.stringify({ id, ...clean(this.vars.list[i]) }) + '\n');
            this.vars.list = [this.vars.list.at(-1)];
        }
    },
    function() {},
    function() {}
);

function generateHash(str) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489917);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489917);
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

function clean(obj = {}, expand = false, weak = new WeakSet()) {
    if (obj instanceof Modifier) return { name: obj.name, vars: { caster: obj.vars.caster.name, ...(obj.vars.targets ? { targets: obj.vars.targets.map(u => u.name) } : { target: obj.vars.target?.name }) }};
    if (obj?.name && !expand) return obj.name;
    if (obj === null || typeof obj !== 'object') return obj = (Number.isFinite(obj) || typeof obj === 'string' || typeof obj == 'boolean' || obj === undefined ? obj : String(obj));
    const out = {};
    Object.keys(obj).forEach(k => {
        if (typeof obj[k] === 'function') return undefined;
        if (obj[k] === null || typeof obj[k] !== 'object') return out[k] = (Number.isFinite(obj[k]) || typeof obj[k] === 'string' || typeof obj[k] == 'boolean' || obj[k] === undefined ? obj[k] : String(obj[k]));
        if (obj[k] instanceof Modifier) return out[k] = { name: obj[k].name, vars: { caster: obj[k].vars.caster.name, ...(obj[k].vars.targets ? { targets: obj[k].vars.targets.map(u => u.name) } : { target: obj[k].vars.target?.name }) }};
        if (obj[k]?.name) return out[k] = obj[k].name;
        if (weak.has(obj[k])) return out[k] = 'Circular';
        weak.add(obj[k]);
        const o = Array.isArray(obj[k]) ? obj[k].map(x => clean(x, false, weak)) : Object.fromEntries(Object.entries(obj[k]).filter(([,x]) => x !== undefined && typeof x !== 'function').map(([v,x]) => [v, clean(x, false, weak)]));
        weak.delete(obj[k]);
        return out[k] = o;
    });
    return out
}

function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

function init(s = 1, units = [{ unit: enemy, team: "player", skills: 'random', count: 4 }, { unit: enemy, team: "enemy", skills: 'random', count: 4 }]) {
    seed = s;
    Math.random = mulberry32(seed);
    for (const template of units) {
        if (template.unit === 'random') template.unit = unitList[Math.floor(Math.random()*unitList.length)];
        if (template.skills === 'random') for (let i = template.count || 1; i > 0; i--) assignEnemySkills(createUnit(template.unit, template.team || 'player'), template.unit);
    }
    Math.random = mulberry32(seed);
    if (eventState.waveChange.length) handleEvent('waveChange', { wave: 1 });
    id = generateHash(JSON.stringify({ seed, allUnits: allUnits.map(u => ({ name: u.name, skills: Object.keys(u.skills).map(s => ({ [s]: u.skills[s].name })) })) }));
    appendFileSync("../../greanandin/log.jsonl", JSON.stringify({ id, seed, allUnits: allUnits.map(u => clean(u, true)) })+ '\n');
    mod.vars.off = false;
    combatTick();
}

function end() {
    for (const c of mod.vars.list) appendFileSync("../../greanandin/log.jsonl", JSON.stringify({ id, ...clean(c) }) + '\n');
    appendFileSync("../../greanandin/log.jsonl", JSON.stringify({ id, allUnits: allUnits.map(u => clean(u, true))}) + '\n');
}

function combatTick() {
    try {
        let round = 0;
        while (!frontTest()) {
            if (round++ > 3000) throw new Error("Simulation ran too long");
            let turn;
            const alive = allUnits.filter(u => u.hp);
            while (turn == undefined) {
                const list = alive.filter(u => u.timer <= 0);
                if (!list.length) for (const unit of alive) unit.timer -= unit.speed;
                else turn = list.reduce((low, cur) => cur.timer < low.timer ? cur : low);
            }
            if (eventState.turnStart.length) handleEvent('turnStart', { unit: turn });
            if (!turn.stun) {
                regenerateResources(turn);
                action(turn);
            }
            if (eventState.turnEnd.length) handleEvent('turnEnd', { unit: turn });
            turn.timer += 1000;
        }
    } catch (e) {
        console.error("An error occurred:", e);
        mod.vars.list.push({ error: Object.fromEntries(Object.getOwnPropertyNames(e).map(key => [key, e[key]])) });
    }
    finally { end(); }
}

function action(unit) {
    if (unit.skills.special && unit.stamina >= (unit.skills.special.cost?.stamina || 0) && (unit.mana || 0) >= (unit.skills.special.cost?.mana || 0) && (unit.energy || 0) >= (unit.skills.special.cost?.energy || 0) && Math.random() < 0.2) return executeAction(unit, unit.skills.special);
    if (Math.random() < 1/16){
        if (eventState.actionStart.length) handleEvent('actionStart', { unit, action: 'skip' });
        regenerateResources(unit);
        return;
    }
    const availableActions = [];
    if (unit.skills.basic && unit.stamina >= (unit.skills.basic.cost?.stamina || 0) && (unit.mana || 0) >= (unit.skills.basic.cost?.mana || 0) && (unit.energy || 0) >= (unit.skills.basic.cost?.energy || 0)) availableActions.push(unit.skills.basic);
    if (unit.skills.secondary && unit.stamina >= (unit.skills.secondary.cost?.stamina || 0) && (unit.mana || 0) >= (unit.skills.secondary.cost?.mana || 0) && (unit.energy || 0) >= (unit.skills.secondary.cost?.energy || 0)) availableActions.push(unit.skills.secondary);
    if (availableActions.length) return executeAction(unit, availableActions[Math.floor(Math.random() * availableActions.length)]);
}

function executeAction(unit, action) {
    const type = Object.keys(unit.skills).find(s => unit.skills[s] === action);
    if (eventState.actionStart.length) handleEvent('actionStart', { unit, action: type });
    if (!action.cost || resourceChange(unit, action.cost, false, false)) {
        unit.previousAction = [unit.previousAction[0] || action.properties.includes('stamina-block'), unit.previousAction[1] || action.properties.includes('mana-block'), unit.previousAction[2] || action.properties.includes('energy-block')];
        currentAction.push([action, unit]);
        action.target ? action.target.call(unit) : action.code.call(unit);
        currentAction.pop();
    }
}

function frontTest() {
    if (!allUnits.filter(u => u.hp && u.position === 'front' && u.team === 'player').length) {
        const midLine = allUnits.filter(u => u.hp && u.base.position === 'mid' && u.team === 'player');
        if (midLine.length) {
            for (const unit of midLine) {
                unit.switchPosition();
                unit.timer += 1000;
            }
        } else return true;
    }
    if (!allUnits.filter(u => u.hp && u.position === 'front' && u.team === 'enemy').length) {
        const midLine = allUnits.filter(u => u.hp && u.base.position === 'mid' && u.team === 'enemy');
        if (midLine.length) {
            for (const unit of midLine) {
                unit.switchPosition();
                unit.timer += 1000;
            }
        } else return true;
    }
}

function assignEnemySkills(newUnit, template) {
    const categories = ['special', 'basic', 'secondary', 'passive', 'augment', 'conditional'];
    const getLoadoutForPosition = (pos) => {
        const defaultLoadout = (pos === 'front' ? template.frontDefaultSkills : template.backDefaultSkills) || template.defaultSkills;
        for (let attempt = 0;; attempt++) {
            const loadout = {};
            const usedNames = new Set();
            let isFullLoadout = true;
            for (const category of categories) {
                const availableSkills = template.skills[category];
                if (!availableSkills) continue;
                const validSkills = availableSkills.filter(skill => (!skill.cost?.position || skill.cost.position === pos) && !usedNames.has(skill.name) );
                let selectedSkill = null;
                if (Math.random() < 0.5 && defaultLoadout) {
                    const defaultDef = defaultLoadout.find(def => def.category === category);
                    if (defaultDef) {
                        const defSkill = availableSkills.find(s => s.name === defaultDef.name);
                        if (defSkill && !usedNames.has(defSkill.name) && (!defSkill.cost?.position || defSkill.cost.position === pos)) selectedSkill = defSkill;
                    }
                }
                if (!selectedSkill && validSkills.length > 0) selectedSkill = validSkills[Math.floor(Math.random() * validSkills.length)];
                if (selectedSkill) {
                    loadout[category] = selectedSkill;
                    usedNames.add(selectedSkill.name);
                } else isFullLoadout = false;
            }
            if (isFullLoadout || attempt === 4) return loadout;
        }
    };
    if (!newUnit) return template.base.position === 'mid' ? [getLoadoutForPosition('front'), getLoadoutForPosition('back')] : getLoadoutForPosition(template.base.position);
    newUnit.skills = {};
    if (template.base.position === 'mid') {
        newUnit.position = 'back'; 
        newUnit.frontSkills = getLoadoutForPosition('front');
        newUnit.backSkills = getLoadoutForPosition('back');
        newUnit.skills = {...newUnit.backSkills};
        if (Math.random() > 0.5) newUnit.switchPosition(true);
    } else newUnit.skills = getLoadoutForPosition(newUnit.position);
    (newUnit.traits || []).forEach(s => {
        currentAction.push([s, newUnit]);
        s.code.call(newUnit);
        currentAction.pop();
    });
    (newUnit.synergy || []).forEach(s => {
        currentAction.push([s, newUnit]);
        s.code.call(newUnit);
        currentAction.pop();
    });
    for (const skill of ['passive', 'augment', 'conditional']) {
        if (newUnit.skills[skill]) {
            currentAction.push([newUnit.skills[skill], newUnit]);
            newUnit.skills[skill].code.call(newUnit);
            currentAction.pop();
        }
    }
}

init(Date.now(), Array.from({ length: 8 }, (_, i) => ({ unit: 'random', skills: 'random', ...(i >= 4 && { team: 'enemy' }) })));