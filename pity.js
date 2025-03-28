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
        gacha(protoSquad, 10);
    });
}

function setupRedemptionListeners() {
    document.getElementById('redeem4Star').addEventListener('click', redeem4Star);
    document.getElementById('redeem5Star').addEventListener('click', redeem5Star);
}

function updateDisplays() {
    costDisplay.textContent = `Total Spent: ${totalCost} Credits`;
    pityDisplay.textContent = `Pity Points: ${totalPity}pp`;
}

function populatePityShop() {
    const fourStarSelect = document.getElementById('fourStarSelect');
    const fiveStarSelect = document.getElementById('fiveStarSelect');
    protoSquad.fourStar.units.forEach(unit => {fourStarSelect.appendChild(createOption(unit));});
    protoSquad.fiveStar.units.forEach(unit => {fiveStarSelect.appendChild(createOption(unit));});
}

function createOption(unit) {
    const option = document.createElement('option');
    option.value = unit;
    option.textContent = unit;
    return option;
}

function redeem4Star() {
    if (totalPity >= 500) {
        const unit = document.getElementById('fourStarSelect').value;
        totalPity -= 500;
        unitData[unit].count++;
        updateDisplays();
        document.getElementById("collection").innerHTML = `<b>Collection:</b><br>${collectionDisplay()}`;
    }
}

function redeem5Star() {
    if (totalPity >= 1500) {
        const unit = document.getElementById('fiveStarSelect').value;
        totalPity -= 1500;
        unitData[unit].count++;
        updateDisplays();
        document.getElementById("collection").innerHTML = `<b>Collection:</b><br>${collectionDisplay()}`;
    }
}