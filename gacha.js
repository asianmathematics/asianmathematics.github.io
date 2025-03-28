import { protoField, protoSquad } from './banner.js';
import unitData from './unitData.js';

export function gacha(banner, pull, twostar = 0, threestar = 0, fourstar = 0, fivestar = 0) {
    let stars = [0, 0, 0, 0, 0];
    let primativeUnitList = [];
    let completeUnitList = {};
    for (let i = pull; i > 0; i--) {
        const star = guarantee(banner, i, fivestar, fourstar, threestar, twostar);
        switch (star) {
            case "oneStar":
                stars[0]++;
                break;
            case "twoStar":
                stars[1]++;
                twostar--;
                break;
            case "threeStar":
                stars[2]++;
                twostar--;
                threestar--;
                break;
            case "fourStar":
                stars[3]++;
                twostar--;
                threestar--;
                fourstar--;
                break;
            case "fiveStar":
                stars[4]++;
                twostar--;
                threestar--;
                fourstar--;
                fivestar--;
                break;
        }
        primativeUnitList.push(assignUnits(banner, star));
    }
    const results = "One Star: " + stars[0] + "<br>Two Star: " + stars[1] + "<br>Three Star: " + stars[2] + "<br>Four Star: " + stars[3] + "<br>Five Star: " + stars[4];
    console.log("Results:", stars[0], stars[1], stars[2], stars[3], stars[4]);
    primativeUnitList.forEach((x) => {
        completeUnitList[x] = (completeUnitList[x] || 0) + 1;
        unitData[x].count += + 1;
    });
    console.log(completeUnitList);
    document.getElementById("results").innerHTML = results + "<br>" + unitDisplay(completeUnitList, banner, stars);
    document.getElementById("collection").innerHTML = "<b>Collection:</b><br>" + collectionDisplay();
}

function guarantee(banner, i, fivestar, fourstar, threestar, twostar) {
    let randStar = Math.random();
    let star = '';
    for (star in banner) {
        if (banner[star].rate !== 0) {
            randStar -= banner[star].rate;
        }
        if (randStar < 0) {
            switch (true) {
                case (i <= fivestar):
                    return "fiveStar";
                case (star !== "fiveStar" && i <= fourstar):
                    return "fourStar";
                case (star !== "fourStar" && star !== "fiveStar" && i <= threestar):
                    return "threeStar";
                case (star !== "threeStar" && star !== "fourStar" && star !== "fiveStar" && i <= twostar):
                    return "twoStar";
                default:
                    return star; 
            }
        }
    }
}


function assignUnits(banner, star) {
    const list = banner[star].units;
    const rates = banner[star].rates;
    const randChoice = Math.random() * rates.reduce((sum, rate) => sum + rate, 0);
    let cumulativeRate = 0;
    for (let i = 0; i < list.length; i++) {
        cumulativeRate += rates[i];
        if (randChoice <= cumulativeRate) {
            return list[i];
        }
    }
    return list[list.length -1];
}

export function collectionDisplay() {
    const colors = ['white', 'green', 'blue', 'purple', 'gold'];
    let html = '<div>';
    const collectedUnits = Object.entries(unitData)
        .filter(([_, data]) => data.count > 0)
        .sort(([aName, aData], [bName, bData]) => {
            return bData.rarity - aData.rarity || aName.localeCompare(bName);
        });
    for (const [unit, data] of collectedUnits) {
        const rarityIndex = data.rarity - 1;
        html += `<p style="margin: 1px; font-size: .75em;">
            <b style="color: ${colors[rarityIndex]}">${unit}:</b> ${data.count}
        </p>`;
    }
    return html + '</div>';
}

function unitDisplay(obj, banner) {
    const colors = ['white', 'green', 'blue', 'purple', 'gold'];
    let html = '<div>';
    const sortedUnits = Object.keys(obj).sort((a, b) => {
        const aRarity = unitData[a].rarity;
        const bRarity = unitData[b].rarity;
        return bRarity - aRarity || a.localeCompare(b);
    });
    for (const key of sortedUnits) {
        const rarityIndex = unitData[key].rarity - 1;
        html += `<p style="margin: 1px; font-size: .75em;">
            <b style="color: ${colors[rarityIndex]}">${key}:</b> ${obj[key]}
        </p>`;
    }
    return html + '</div>';
}