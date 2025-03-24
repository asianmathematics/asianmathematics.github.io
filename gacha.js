import { protoBanner } from './banner.js';
import unitData from './unitData.js';

export function gacha(banner, pull, twostar = 0, threestar = 0, fourstar = 0, fivestar = 0) {
    // console.log("Gacha function called with:", pull, twostar, threestar, fourstar, fivestar);
    let stars = [0, 0, 0, 0, 0];
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
                        stars[4]++;
                        primativeUnitList.push(assignUnits(banner, "fiveStar"));
                    } else {
                        stars[3]++;
                        primativeUnitList.push(assignUnits(banner, "fourStar"));
                    }
                } else {
                    stars[2]++;
                    primativeUnitList.push(assignUnits(banner, "threeStar"));
                }
            } else {
                stars[1]++;
                primativeUnitList.push(assignUnits(banner, "twoStar"));
            }
        } else {
            stars[0]++;
            primativeUnitList.push(assignUnits(banner, "oneStar"));
        }
    }
    
    const results = "One Star: " + stars[0] + 
                    "<br>Two Star: " + stars[1] + 
                    "<br>Three Star: " + stars[2] + 
                    "<br>Four Star: " + stars[3] + 
                    "<br>Five Star: " + stars[4];
    
    console.log("Results:", stars[0], stars[1], stars[2], stars[3], stars[4]);

    primativeUnitList.forEach((x) => completeUnitList[x] = (completeUnitList[x] || 0) + 1);
    console.log(completeUnitList);
    const unitCount = completeUnitList;
    
    document.getElementById("results").innerHTML = results + "<br>" + objectToHTML(unitCount, banner, stars);
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

function objectToHTML(obj, banner, stars) {
    const colors = ['white', 'green', 'blue', 'purple', 'gold'];
    let html = '<div>';
    for (let i = 0; i < stars.length; i++) {
        const starLevel = i + 1;
        html += `<p style="margin: 1px; font-size: .75em;"><b style="color: ${colors[i]}">${starLevel} Star:</b> ${stars[i]}</p>`;
    }
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            let starLevel = 0;
            const bannerArrays = ["oneStar", "twoStar", "threeStar", "fourStar", "fiveStar"];
            for (let i = 0; i < bannerArrays.length; i++) {
                if (banner[bannerArrays[i]].includes(key)) {
                    starLevel = i;
                    break;
                }
            }
            
            html += `<p style="margin: 1px; font-size: .75em;"><b style="color: ${colors[starLevel]}">${key}:</b> ${obj[key]}</p>`;
        }
    }
    html += '</div>';
    return html;
}