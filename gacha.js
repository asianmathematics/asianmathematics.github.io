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
    primativeUnitList.forEach((x) => completeUnitList[x] = (completeUnitList[x] || 0) + 1);
    console.log(completeUnitList);
    document.getElementById("results").innerHTML = results + "<br>" + unitDisplay(completeUnitList, banner, stars);
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
                case (star !== "threeStar" && star !== "fourStar" && star !== "fiveStar" && i <= fivestar):
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

function unitDisplay(obj, banner, stars) {
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
                if (banner[bannerArrays[i]].units.includes(key)) {
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
