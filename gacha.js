import protoBanner from './banner.js';
import unitData from './unitData.js';

export function gacha(banner, pull, twostar = 0, threestar = 0, fourstar = 0, fivestar = 0) {
    // console.log("Gacha function called with:", pull, twostar, threestar, fourstar, fivestar);
    
    let S = 0;
    let SS = 0;
    let SSS = 0;
    let SSSS = 0;
    let SSSSS = 0;
    let primativeUnitList = [];
    let completeUnitList = {};
    
    for (let i = pull; i > 0; i--) {
        if (rateup(.05, i, twostar)) {
            twostar--;
            if (rateup(.1, i, threestar)) {
                threestar--;
                if (rateup(.15, i, fourstar)) {
                    fourstar--;
                    if (rateup(.2, i, fivestar)) {
                        fivestar--;
                        SSSSS++;
                        primativeUnitList.push(assignUnits(banner, "fiveStar"));
                    } else {
                        SSSS++;
                        primativeUnitList.push(assignUnits(banner, "fourStar"));
                    }
                } else {
                    SSS++;
                    primativeUnitList.push(assignUnits(banner, "threeStar"));
                }
            } else {
                SS++;
                primativeUnitList.push(assignUnits(banner, "twoStar"));
            }
        } else {
            S++;
            primativeUnitList.push(assignUnits(banner, "oneStar"));
        }
    }
    
    const results = "One Star: " + S + "<br>Two Star: " + SS + "<br>Three Star: " + SSS + "<br>Four Star: " + SSSS + "<br>Five Star: " + SSSSS;
    console.log("Results:", S, SS, SSS, SSSS, SSSSS);

    primativeUnitList.forEach((x) => completeUnitList[x] = ( completeUnitList[x] || 0) + 1 );
    console.log(completeUnitList);
    const unitCount = completeUnitList;

    
    document.getElementById("results").innerHTML = results + "<br>" + objectToHTML(unitCount);
}

function rateup(rarity, i = 1, star = 0) {
    if (i === star) {return true}
    if (Math.random() < rarity) {return true}
    return false
}

function assignUnits(banner, star) {
    let unitPool = banner[star];
    return unitPool[Math.floor(Math.random() * unitPool.length)];
}

function objectToHTML(obj) {
    let html = '<div>';
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        html += `<p style="margin: 1px; font-size: .75em;"><b>${key}:</b> ${obj[key]}</p>`;
      }
    }
    html += '</div>';
    return html;
}