import { DexSoldier } from './unit/dexSoldier.js';
import { FourArcher } from './unit/fourArcher.js';
import { Mannequin } from './unit/mannequin.js';
import { Silhouette } from './unit/silhouette.js';
import { Doctor } from './unit/doctor.js';
import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements } from './combatDictionary.js';
import { Modifier, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, modifiers, currentAction, eventState } from './modifier.js'
import { Unit, createUnit, cloneUnit, allUnits } from './unit/unit.js';

const availableUnits = [DexSoldier, FourArcher, Mannequin, Silhouette, Doctor];

let selectedUnits = [];
let currentEditingUnit = null;
let currentEditingPosition = null;

const categoryColors = {
    special: '#ff9800',   // Orange
    basic: '#4caf50',     // Green
    secondary: '#2196f3', // Blue
    passive: '#9c27b0',   // Purple
    augment: '#f44336'    // Red
};

function initUnitSelection() {
    const roster = document.getElementById('unit-roster');
    const selectedContainer = document.getElementById('selected-units');
    roster.innerHTML = '';
    selectedContainer.innerHTML = '<h4>Selected Units (0 front, 0 back)</h4>';
    selectedUnits = [];
    availableUnits.forEach(unit => {
        const card = document.createElement('div');
        card.className = 'unit-card';
        card.dataset.unit = unit.name;
        card.innerHTML = `<strong>${unit.name}</strong>`;
        card.addEventListener('click', () => {
            updateInfoDisplay(unit);
            if (selectedUnits.length >= 6 && !card.classList.contains('selected')) return showMessage('Maximum 6 units allowed!', 'warning', 'selection');
            card.classList.toggle('selected');
            if (card.classList.contains('selected')) {
                const unitConfig = {
                    id: crypto.randomUUID(),
                    template: unit,
                    skills: unit.base.position === 'mid' ? { front: getDefaultSkills(unit, 'front'), back: getDefaultSkills(unit, 'back') } : getDefaultSkills(unit),
                    startingPosition: unit.base.position === 'mid' ? 'back' : unit.base.position,
                    autoBehavior: unit.skills.basic ? 'basic' : unit.skills.secondary ? 'secondary' : 'none'
                };
                selectedUnits.push(unitConfig);
                card.dataset.configId = unitConfig.id;
            } else {
                selectedUnits = selectedUnits.filter(u => u.id !== card.dataset.configId);
                delete card.dataset.configId;
            }
            selectedContainer.innerHTML = `<h4>Selected Units (${selectedUnits.filter(u => u.startingPosition === 'front').length} front, ${selectedUnits.filter(u => u.startingPosition === 'back').length} back)</h4>`;
            renderSelectedUnits();
        });
        roster.appendChild(card);
    });
    document.getElementById('start-with-selected').addEventListener('click', () => {
        if (selectedUnits.length === 0) return showMessage('Please select at least 1 unit!', 'error', 'selection');
        if (!selectedUnits.find(u => u.startingPosition === "front")) return showMessage('Please select at least 1 non-backline unit!', 'error', 'selection');
        startCombatWithSelected();
    });
}

function getAllSkills(unitTemplate) {
    let allSkills = [];
    for (const category in unitTemplate.skills) allSkills.push(...unitTemplate.skills[category]);
    return allSkills;
}

function getDefaultSkills(unitTemplate, position = null) {
    if (unitTemplate.base.position === 'mid' && position) {
        const key = `${position}DefaultSkills`;
        if (unitTemplate[key]) return resolveDefaultSkills(unitTemplate, unitTemplate[key]);
        return [];
    }
    if (unitTemplate.defaultSkills && Array.isArray(unitTemplate.defaultSkills)) return resolveDefaultSkills(unitTemplate, unitTemplate.defaultSkills);
    return [];
}

function resolveDefaultSkills(template, defaultsArray) { return defaultsArray.map(def => template.skills[def.category] ? template.skills[def.category].find(s => s.name === def.name) : null).filter(Boolean) }

function openSkillSelection(unitConfig, targetPosition = null) {
    const isUnitChanged = currentEditingUnit !== unitConfig;
    currentEditingUnit = unitConfig;
    if (targetPosition) currentEditingPosition = targetPosition;
    else if (unitConfig.template.base.position === 'mid') if (isUnitChanged || !currentEditingPosition) currentEditingPosition = unitConfig.startingPosition;
    else currentEditingPosition = null;
    const panel = document.getElementById('skill-selection-panel');
    panel.style.display = 'block';
    const unitNameHeader = document.getElementById('skill-unit-name');
    unitNameHeader.textContent = `${unitConfig.template.name} - Skill Setup`;
    const oldToggle = document.getElementById('skill-pos-toggle');
    if (oldToggle) oldToggle.remove();
    if (unitConfig.template.base.position === 'mid') {
        const toggleDiv = document.createElement('div');
        toggleDiv.id = 'skill-pos-toggle';
        toggleDiv.style.cssText = 'text-align: center; margin-bottom: 15px;';
        toggleDiv.innerHTML = `
            <p style="margin: 0 0 5px 0; font-size: 12px; color: #aaa;">Currently adding skills to:</p> 
            <button id="pos-front-btn" style="padding: 5px 15px; background: ${currentEditingPosition === 'front' ? '#060' : '#555'}; color: white; border: none; cursor: pointer; border-radius: 4px; margin-right: 10px;">Frontline</button> 
            <button id="pos-back-btn" style="padding: 5px 15px; background: ${currentEditingPosition === 'back' ? '#060' : '#555'}; color: white; border: none; cursor: pointer; border-radius: 4px;">Backline</button>
        `;
        unitNameHeader.after(toggleDiv);
        document.getElementById('pos-front-btn').onclick = () => { openSkillSelection(unitConfig, 'front') };
        document.getElementById('pos-back-btn').onclick = () => { openSkillSelection(unitConfig, 'back') };
    }
    
    renderSkillRoster();
    renderSelectedSkills();
    
    document.getElementById('confirm-skills').onclick = () => {
        const positionsToCheck = currentEditingUnit.template.base.position === 'mid' ? ['front', 'back'] : [null];
        for (const pos of positionsToCheck) {
            const skills = pos ? currentEditingUnit.skills[pos] : currentEditingUnit.skills;
            
            const names = skills.map(s => s.name);
            const duplicateNames = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
            if (duplicateNames.length > 0) return showMessage(`Duplicate skill names${pos ? `for ${pos}line` : ''}: ${duplicateNames.join(', ')}.`, 'error', 'selection');
            
            const categories = skills.map(s => getSkillCategory(currentEditingUnit.template, s));
            const duplicateCategories = [...new Set(categories.filter((cat, index) => categories.indexOf(cat) !== index))];
            if (duplicateCategories.length > 0) return showMessage(`Duplicate skill types${pos ? `for ${pos}line` : ''}: ${duplicateCategories.join(', ')}.`, 'error', 'selection');
        }
        panel.style.display = 'none';
        renderSelectedUnits();
    };
    
    document.getElementById('cancel-skills').onclick = () => { panel.style.display = 'none' };
    
    document.getElementById('reset-defaults').onclick = () => {
        if (currentEditingPosition) currentEditingUnit.skills[currentEditingPosition] = getDefaultSkills(currentEditingUnit.template, currentEditingPosition);
        else currentEditingUnit.skills = getDefaultSkills(currentEditingUnit.template);
        renderSelectedSkills();
        renderSkillRoster();
    };
}

function getSkillCategory(template, skillObj) {
    for (const cat in template.skills) if (template.skills[cat].includes(skillObj)) return cat;
    return 'unknown';
}

function renderSkillRoster() {
    const roster = document.getElementById('skill-roster');
    roster.innerHTML = '';
    if (currentEditingUnit.template.base.position === 'mid' && !currentEditingPosition) currentEditingPosition = currentEditingUnit.startingPosition;
    const activeSkills = currentEditingUnit.template.base.position === 'mid' ? currentEditingUnit.skills[currentEditingPosition] : currentEditingUnit.skills;
    for (const category of Object.keys(currentEditingUnit.template.skills)) {
        if (!currentEditingUnit.template.skills[category] || currentEditingUnit.template.skills[category].length === 0) continue;
        const header = document.createElement('h4');
        header.style.cssText = `color: ${categoryColors[category]}; text-transform: uppercase; margin: 15px 0 5px 0; border-bottom: 1px solid ${categoryColors[category]}; padding-bottom: 4px; font-size: 14px;`;
        header.textContent = category;
        roster.appendChild(header);
        currentEditingUnit.template.skills[category].forEach(skill => {
            const requiredPos = skill.cost?.position;
            if (currentEditingPosition && requiredPos && requiredPos !== currentEditingPosition) return; 
            const isAlreadySelected = activeSkills.includes(skill); 
            const skillDiv = document.createElement('div');
            skillDiv.style.cssText = `padding: 8px; margin: 5px 0; background: ${isAlreadySelected ? '#222' : '#333'}; border-left: 4px solid ${categoryColors[category]}; border-radius: 4px; cursor: ${isAlreadySelected ? 'not-allowed' : 'pointer'}; opacity: ${isAlreadySelected ? '0.5' : '1'}; transition: background 0.2s;`;
            skillDiv.innerHTML = `<strong>${skill.name}</strong><br><small style="color: #ccc;">${alterDesc(skill, category)}</small>`;
            if (!isAlreadySelected) {
                skillDiv.addEventListener('mouseenter', () => skillDiv.style.background = '#444');
                skillDiv.addEventListener('mouseleave', () => skillDiv.style.background = '#333');
                skillDiv.addEventListener('click', () => {
                    currentEditingPosition ? currentEditingUnit.skills[currentEditingPosition] = [...currentEditingUnit.skills[currentEditingPosition].filter(s => s.name !== skill.name && !currentEditingUnit.template.skills[category].includes(s)), skill] : currentEditingUnit.skills = [...currentEditingUnit.skills.filter(s => s.name !== skill.name && !currentEditingUnit.template.skills[category].includes(s)), skill];
                    renderSkillRoster();
                    renderSelectedSkills();
                });
            }
            roster.appendChild(skillDiv);
        });
    }
}

function renderSelectedSkills() {
    const list = document.getElementById('selected-skills-list');
    const countDisplay = document.getElementById('selected-skills-count');
    const maxSlots = Object.keys(currentEditingUnit.template.skills).length;
    list.innerHTML = '';
    if (currentEditingUnit.template.base.position === 'mid') {
        countDisplay.textContent = `Skill Loadouts (${maxSlots} slots each)`;
        const frontHeader = document.createElement('h4');
        frontHeader.style.cssText = 'color: #4caf50; margin: 10px 0 5px 0; border-bottom: 1px solid #4caf50; padding-bottom: 4px;';
        frontHeader.textContent = `Frontline (${currentEditingUnit.skills.front.length}/${maxSlots})`;
        list.appendChild(frontHeader);
        if (currentEditingUnit.skills.front.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.style.cssText = 'color: #888; text-align: center; font-size: 12px; margin: 5px 0;';
            emptyMsg.textContent = 'No frontline skills selected';
            list.appendChild(emptyMsg);
        } else currentEditingUnit.skills.front.forEach((skill, index) => { list.appendChild(createSkillItem(skill, 'front', index)) });
        const backHeader = document.createElement('h4');
        backHeader.style.cssText = 'color: #2196f3; margin: 15px 0 5px 0; border-bottom: 1px solid #2196f3; padding-bottom: 4px;';
        backHeader.textContent = `Backline (${currentEditingUnit.skills.back.length}/${maxSlots})`;
        list.appendChild(backHeader);
        if (currentEditingUnit.skills.back.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.style.cssText = 'color: #888; text-align: center; font-size: 12px; margin: 5px 0;';
            emptyMsg.textContent = 'No backline skills selected';
            list.appendChild(emptyMsg);
        } else currentEditingUnit.skills.back.forEach((skill, index) => { list.appendChild(createSkillItem(skill, 'back', index)) });
    } else {
        countDisplay.textContent = `Selected Skills (${currentEditingUnit.skills.length}/${maxSlots})`;
        if (currentEditingUnit.skills.length === 0) return list.innerHTML = '<p style="color: #888; text-align: center;">No skills selected (Not Recommended)</p>';
        currentEditingUnit.skills.forEach((skill, index) => { list.appendChild(createSkillItem(skill, null, index)) });
    }
}

// Helper function to generate the HTML for a selected skill card
function createSkillItem(skill, position, index) {
    const category = getSkillCategory(currentEditingUnit.template, skill);
    const color = categoryColors[category] || '#888';
    const skillDiv = document.createElement('div');
    skillDiv.style.cssText = `padding: 8px; margin: 5px 0; background: #1a1a1a; border-left: 4px solid ${color}; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;`;
    skillDiv.innerHTML = `
        <span>
            <strong>${skill.name}</strong> 
            <span style="background: ${color}; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; text-transform: uppercase; margin-left: 8px;">${category}</span>
        </span>
        <button style="background: #600; color: white; border: none; padding: 4px 10px; cursor: pointer; border-radius: 4px;">Remove</button>
    `;
    skillDiv.querySelector('button').addEventListener('click', () => {
        if (position) currentEditingUnit.skills[position].splice(index, 1);
        else currentEditingUnit.skills.splice(index, 1);
        renderSkillRoster();
        renderSelectedSkills();
    });
    return skillDiv;
}

function renderSelectedUnits() {
    const container = document.getElementById('selected-units');
    container.querySelectorAll('.unit-card').forEach(card => card.remove());
    selectedUnits.forEach(unitConfig => {
        const card = document.createElement('div');
        card.className = 'unit-card selected';
        let positionToggleHTML = '';
        if (unitConfig.template.base.position === 'mid') {
            positionToggleHTML = `
                <div style="margin-top: 8px; display: flex; gap: 5px; justify-content: center;">
                    <button class="pos-btn" data-pos="front" style="padding: 2px 8px; background: ${unitConfig.startingPosition === 'front' ? '#060' : '#555'}; color: white; border: none; cursor: pointer; border-radius: 4px; font-size: 12px;">Front</button>
                    <button class="pos-btn" data-pos="back" style="padding: 2px 8px; background: ${unitConfig.startingPosition === 'back' ? '#060' : '#555'}; color: white; border: none; cursor: pointer; border-radius: 4px; font-size: 12px;">Back</button>
                </div>
            `;
        }
        let skillCountHTML = '';
        if (unitConfig.template.base.position === 'mid') {
            const maxSlots = Object.keys(unitConfig.template.skills).length;
            skillCountHTML = `
                <div style="font-size: 12px; color: #aaa; margin-top: 5px;">Front: ${unitConfig.skills.front.length} / ${maxSlots}</div>
                <div style="font-size: 12px; color: #aaa;">Back: ${unitConfig.skills.back.length} / ${maxSlots}</div>
            `;
        } else skillCountHTML = `<div style="font-size: 12px; color: #aaa; margin-top: 5px;">Skills: ${unitConfig.skills.length} / ${Object.keys(unitConfig.template.skills).length}</div>`;
        const hasBasic = !!unitConfig.template.skills.basic;
        const hasSecondary = !!unitConfig.template.skills.secondary;

        let behaviorHTML = `<select class="behavior-select" data-id="${unitConfig.id}" style="margin-top: 5px; padding: 2px; background: #222; color: #fff; border: 1px solid #555; border-radius: 4px; font-size: 11px; width: 100%; cursor: pointer;">`;
        if (hasBasic) behaviorHTML += `<option value="basic" ${unitConfig.autoBehavior === 'basic' ? 'selected' : ''}>Behavior: Basic</option>`;
        if (hasSecondary) behaviorHTML += `<option value="secondary" ${unitConfig.autoBehavior === 'secondary' ? 'selected' : ''}>Behavior: Secondary</option>`;
        if (hasBasic && hasSecondary) behaviorHTML += `<option value="both" ${unitConfig.autoBehavior === 'both' ? 'selected' : ''}>Behavior: Both</option>`;
        behaviorHTML += `<option value="none" ${unitConfig.autoBehavior === 'none' ? 'selected' : ''}>Behavior: None</option>`;
        behaviorHTML += `</select>`;
        card.innerHTML = `
            <strong>${unitConfig.template.name}</strong>
            ${skillCountHTML}
            ${behaviorHTML}
            ${positionToggleHTML}
        `;
        container.appendChild(card);
        const select = card.querySelector('.behavior-select');
        if (select) {
            select.addEventListener('change', (e) => {
                e.stopPropagation();
                const config = selectedUnits.find(u => u.id === select.dataset.id);
                if (config) config.autoBehavior = e.target.value;
            });
            select.addEventListener('click', (e) => e.stopPropagation());
        }
        if (unitConfig.template.base.position === 'mid') {
            card.querySelectorAll('.pos-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const newPos = btn.dataset.pos;
                    if (unitConfig.startingPosition !== newPos) {
                        unitConfig.startingPosition = newPos;
                        unitConfig.skills[newPos] = unitConfig.skills[newPos].filter(skill => !skill.cost?.position || skill.cost?.position === newPos);
                        renderSelectedUnits();
                        const selectedContainer = document.getElementById('selected-units');
                        const countDisplay = selectedContainer.querySelector('h4');
                        countDisplay.innerHTML = `Selected Units (${selectedUnits.filter(u => u.startingPosition === 'front').length} front, ${selectedUnits.filter(u => u.startingPosition === 'back').length} back)`;
                    }
                });
            });
        }
        card.addEventListener('click', () => {
            updateInfoDisplay(unitConfig.template);
            openSkillSelection(unitConfig);
        });
    });
}

function startCombatWithSelected() {
    // 1. Serialize the squad data (Names + Skill Categories to handle duplicate names)
    const squadData = selectedUnits.map(config => {
        const extractSkillInfo = (skill) => ({ name: skill.name, category: getSkillCategory(config.template, skill) });
        // Handle midline front/back skills or standard skills
        const skillsData = config.template.base.position === 'mid' ? { front: config.skills.front.map(extractSkillInfo), back: config.skills.back.map(extractSkillInfo) } : config.skills.map(extractSkillInfo);
        return { templateName: config.template.name, startingPosition: config.startingPosition, skills: skillsData, autoBehavior: config.autoBehavior };
    });
    // 2. Save to localStorage
    localStorage.setItem('pendingSquad', JSON.stringify(squadData));
    // 3. Navigate to the combat page
    window.location.href = 'combat.html';
}

function updateInfoDisplay(unit) {
    const infoDisplay = document.querySelector('.info-display');
    if (!infoDisplay || !unit) return;
    let html = `<div class="left-column"> <h2>${unit.name}</h2> <p>${unit.description}</p> <h4>Stats (Current)</h4>`;
    for (const statName of Object.keys(unit.base).filter(s => s !== "elements")) {
        if (['hp', 'stamina', 'mana', 'energy'].includes(statName)) html += `<div class="stat-line"><span><strong>${statName.charAt(0).toUpperCase() + statName.slice(1)}</strong></span><span>${Math.max(0, unit[statName])} / ${unit.base[statName]}</span></div>`  
        else if (unit[statName] !== undefined) html += `<div class="stat-line"><span>${statName.charAt(0).toUpperCase() + statName.slice(1)}</span><span>${unit[statName]}</span></div>`  
        else if (unit.base[statName] !== undefined) html += `<div class="stat-line"><span>${statName.charAt(0).toUpperCase() + statName.slice(1)}</span><span>${unit.base[statName]}</span></div>`
    }
    html += `</div>`;
    html += `<div class="right-column"><h3>Skills</h3>`;
    for (const skillName in unit.skills) {
        if (Array.isArray(unit.skills[skillName])) {
            html += `<h4>${skillName} skills</h4>`;
            for (const skill of unit.skills[skillName]) html += `<div class="skill-info-box"><div class="skill-name">${skill.name}</div><p><strong>Description:</strong><br>${skill.description ? alterDesc(skill, skillName) : 'No description available.'}</p></div><hr>`;
        } else html += `<h4>${skillName} skill</h4><div class="skill-info-box"><div class="skill-name">${unit.skills[skillName].name}</div><p><strong>Description:</strong><br>${unit.skills[skillName].description ? alterDesc(unit.skills[skillName], skillName) : 'No description available.'}</p></div><hr>`;
    }
    infoDisplay.innerHTML = html + '</div>';
}

export function startCombat() {
    document.getElementById('unit-selection-panel').style.display = 'block';
    //document.getElementById('game-controls').style.display = 'none';
    initUnitSelection();
}

function alterDesc(skill, category) {
    if (!skill.description) return '';
    let desc = '';
    if (skill.reduction) {
        desc += "Reduce ";
        for (const stat in skill.reduction) desc += ['hp', 'stamina', 'mana', 'energy'].includes(stat) ? `max ${stat === 'hp' ? 'HP' : stat.charAt(0).toUpperCase() + stat.slice(1)} by ${skill.reduction[stat]}, ` : `base ${stat.charAt(0).toUpperCase() + stat.slice(1)} by ${skill.reduction[stat]}, `;
        desc = desc.slice(0, -2) + '<br>';
    }
    if (skill.cost) {
        if (skill.cost.position) desc += `${skill.cost.position.charAt(0).toUpperCase() + skill.cost.position.slice(1)}line only, `;
        const list = Object.keys(skill.cost).filter(s => s !== 'position');
        if (list.length) {
            desc += 'Cost ';
            for (const stat of list) desc += `${skill.cost[stat]} ${stat.charAt(0).toUpperCase() + stat.slice(1)}, `;
        }
        desc = desc.slice(0, -2) + '<br>';
    }
    const block = [];
    if (['special', 'basic', 'secondary'].includes(category)) for (const [res, attrib] of [['stamina', 'physical'], ['mana', 'mystic'], ['energy', 'techno']]) if (!(skill.cost && Object.keys(skill.cost).includes(res)) && skill.properties.includes(attrib)) block.push(res);
    if (block.length) {
        desc += "Blocks next turn's regeneration of ";
        for (const stat of block) desc += `${stat.charAt(0).toUpperCase() + stat.slice(1)}, `;
        desc = desc.slice(0, -2) + '<br>';
    }
    return desc + skill.description.replace(/\n/g, '<br>');
}