import unitData from './unitData.js';
import { gacha, collectionDisplay } from './gacha.js';
import { protoField, protoSquad } from './banner.js';

let totalCost = 0;
let totalPity = 0;
const costDisplay = document.getElementById("costDisplay");
const pityDisplay = document.getElementById("pityDisplay");

export function initPitySystem() {
    setupPullListeners();
    setupRedemptionListeners();
    populatePityShop();
}

function setupPullListeners() {
    document.getElementById('field10').addEventListener('click', () => {
        totalCost += 10;
        totalPity += 10;
        updateDisplays();
        gacha(protoField, 10, 1);
    });
    document.getElementById('field100').addEventListener('click', () => {
        totalCost += 110;
        totalPity += 100;
        updateDisplays();
        gacha(protoField, 100, 15, 2);
    });
    document.getElementById('squad1').addEventListener('click', () => {
        totalCost += 40;
        totalPity += 20;
        updateDisplays();
        gacha(protoSquad, 1);
    });
    document.getElementById('squad10').addEventListener('click', () => {
        totalCost += 440;
        totalPity += 200;
        updateDisplays();
        gacha(protoSquad, 10, 0, 0, 1);
    });
}

function setupRedemptionListeners() {
    document.getElementById('redeem5Star').addEventListener('click', redeem5Star);
    document.getElementById('redeem6Star').addEventListener('click', redeem6Star);
}

function updateDisplays() {
    costDisplay.textContent = `Total Spent: ${totalCost} Credits`;
    pityDisplay.textContent = `Pity Points: ${totalPity}pp`;
}

function populatePityShop() {
    const fiveStarSelect = document.getElementById('fiveStarSelect');
    const sixStarSelect = document.getElementById('sixStarSelect');
    protoSquad.fiveStar.units.forEach(unit => {fiveStarSelect.appendChild(createOption(unit));});
    protoSquad.sixStar.units.forEach(unit => {sixStarSelect.appendChild(createOption(unit));});
}

function createOption(unit) {
    const option = document.createElement('option');
    option.value = unit;
    option.textContent = unit;
    return option;
}

function redeem5Star() {
    if (totalPity >= 2500) {
        const unit = document.getElementById('fiveStarSelect').value;
        totalPity -= 2500;
        unitData[unit].count++;
        updateDisplays();
        document.getElementById("collection").innerHTML = `<b>Collection:</b><br>${collectionDisplay()}`;
    }
}

function redeem6Star() {
    if (totalPity >= 10000) {
        const unit = document.getElementById('sixStarSelect').value;
        totalPity -= 10000;
        unitData[unit].count++;
        updateDisplays();
        document.getElementById("collection").innerHTML = `<b>Collection:</b><br>${collectionDisplay()}`;
    }
}