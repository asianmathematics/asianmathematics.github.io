# **Game Design Document: IDA gacha**

## **1\. Core Identity**

* **Genre**: Tactical Gacha RPG    
* **Elevator Pitch**: Command armies of expendable cannon fodder and elite squads, where strategic sacrifices and dynamic risks shape your progression.  
* **Main Mechanics**:  
  * Different niches for different unit rarities.  
  * Dual unit progression, Level vs. Power.  
  * Synergies between Units and an esoteric element system.  
  * Retro/terminal look. Plan to do pixel art.

## **2\. Game Modes**

1. ### Battlefield Mode

* **Units**: Battalions of 1★/2★ duplicate units \+ a compatible commander of a higher star (2★/3★) for each. At late game, battlefield mode variants of 3★ duplicates and 4★ commanders are available.  
* **Objective**: Large-scale grid battles (e.g. capture points, destroy enemy army).  
* **Risk**: permadeath chance for defeated units that loses their duplicates (gives back some materials for gacha), increased chance after battalion wipeout  
* **Map**: Hex grid map with emphasis on Battalion positioning. Can have different terrain for each tile.

2. ### Squad Mode

* **Units**: A few 3★/4★/5★ units  
* **Objective**: Tactical missions (e.g. survive waves).  
* **Risk**: Lower permadeath chance but almost guaranteed after squad wipe.  
* **Automation**: Choice to have actions determined from a pre-made or customizable algorithm. Certain variants require automatic mode.

3. ### Both Modes

* **Rewards**: Materials for gacha, level XP for units.  
* **Special Mechanics**:    
  * 6★ units act as "Planeswalkers" (game-changing abilities) and locked to certain game mode variants. Can not Perma-die.  
  * Dynamic difficulty on certain battles dependent on recent wins and losses  
  * Retreat option to minimize perma-death (counts as loss).  
  * Environmental Effects.(e.g. Wild Magic Field randomizes magic skill effects, Solar Flare disables techno skills)  
  * PVP battles. Usually automated.

## **3\. Units**

1. ### Stats

* **HP**: Unit’s health. Reaching 0 has a small chance of losing that duplicate. Battalion HP is equal to 1/10th Unit HP times number of units, once Battalion HP drops by 1/10th Unit HP, number of units decrease.  
* **Attack**: Amount of damage dealt to enemy from an attack.  
* **Defense**: Amount of damage reduced from attacks. Can reduce up to 90% of the damage..  
* **Lethality**: Bonus damage from criticals. Only in Squad mode.  
* **Accuracy**: Increase chance to hit an attack. Minimum chance to hit of 15%. Only in Squad mode.  
* **Evasion**: Decrease chance to get attacked. Only in Squad mode.  
* **Crit**: Increase critical and debuff chance. Multiple criticals can stack. Only in Squad mode.  
* **Resist**: Decrease critical and debuff chance. Only in Squad mode.  
* **Speed**: Increases turn frequency. More units a Battalion has, the lower its speed.  
* **Presence**: Increases chance to get targeted, and adds onto crit and resist for debuff calculations.

2. ### Progression

* **Level**: Gain xp from battle, 128 cap, grants skills and increases skill efficiency. Certain skills and environments can modify a unit or skill’s level.  
* **Power**: Gain xp from unspent duplicates or sacrifices, 128 hard cap, increases base stats. Only 3★/4★/5★ has power, 1★/2★ rely more on duplicates. Certain skills and environments can modify a unit's power.  
* **Power Chains**: Higher-star units can only have as much power as the power of specific lower-star units (e.g., a 5★ power is soft capped by a specific 4★’s power, but 3★ is not capped by 2★'s power).  
* **Sacrifice**: Sacrifice a unit to the same unit or a compatible higher star unit. Sacrificing a unit loses the duplicate, but gives a lot of power (e.g. 2★ sacrifice \> 4★ unspent duplicate).  
* **Prestige**: At max level, reset a 3★/4★ unit's level to boost a 4★/5★ unit’s power and level. Loses a duplicate of that unit.

3. ### Attributes

* **Physical**: Uses Stamina. All units have Stamina and Physical skills.  
* **Mystic**: Uses Mana.  
* **Techno**: Uses Energy.  
* **Resource Regeneration**: When a unit uses an action tagged with an attribute or resource, the unit doesn't regenerate that resource next turn.  
* **Multi-Attribute Units**: Stronger but more vulnerable to skills and environmental debuffs that target Mystic or Techno attributes (e.g. Dispel Magic and EMP skills removing the Mana and Energy resources respectively).

4. ### Elements

* **Main**: The 9 main elements pairs are mostly used for environment and action interactions. Units without an element is rare.  
  * Death/Darkness  
  * Light/Illusion  
  * Knowledge/Memory  
  * Goner/Entropy  
  * Harmonic/Change  
  * Inertia/Cold  
  * Radiance/Purity  
  * Anomaly/Synthetic  
  * Nature/Life  
* **Special**: The 4 special elements pairs are mostly used for synergies. Only 3★ and higher can have these elements and having more than one is rare.  
  * Precision/Perfection  
  * Independence/Loneliness  
  * Passion/Hatred  
  * Ingenuity/Insanity  
* **Relations**: Each main element has a pair it's related to and an opposite it conflicts with (e.g. Darkness pairs with Death and opposes Light).  
* **Interactions**: To exploit an elemental weakness, a unit with an elemental pair must be hit by attacks tagged with the elemental pair's opposites (e.g. Death/Darkness unit hit with Nature/Life and Light/Illusion attacks). Healing and Buffs from an opposing pair of the unit weakens the effect while using the same pair as the unit increases effectiveness.

5. ### Synergies

* **Power Up**: Depending on the synergy, it will increase certain stats, skills, and behaviors of the units involved. Mixed rarity synergies are less common.  
* **Squad**: 3★ are weaker but have more synergies, while 5★ are more powerful and have less synergies. 4★ are more balanced between the two.  
* **Battlefield**: Position based synergies. 3★ commanders have more positional synergies than 2★.  
* **Elements**: Special element synergies only available with 6★ or other special circumstances.

6. ### Other

* **Skills**: Actions that are mostly unique to the unit. Can be either an active or passive skill. Active skills are actions that can be selected on turn, while passive skills are effects that are active throughout combat. Units can only bring a limited number of skills depending on their level, rarity, and other factors.  
* **Position**: More emphasized in Squad mode due to lack of grid. Switching between Frontline and Backline in Squad changes stats depending on the unit (e.g. base speed and presence decreases when put in the backline). Units can have one of three position properties:  
  * **Frontline**: Protects the backline in close combat. Most Squad modes game over after frontline is defeated. Can't enter Squad Backline in normal circumstances. Has debuffs with ranged attacks in Battlefield.  
  * **Backline**: Supports or attacks from far away. Usually slower than Frontline units, but enemies are rarely able to target them. Can't enter Squad Frontline in normal circumstances, so is usually not counted for win/defeat conditions. Has debuffs with close combat in Battlefield.  
  * **Midline**: Switches position from the Frontline and Backline. Weaker than a pure Frontline or Backline unit, but is more versatile. Certain actions are restricted by positioning. When Squad Frontline is gone, Midline units automatically move up.

## **4\. Other**

1. ### Gacha

* **Banner**: Default banner and monthly banner. Each Banner has two sub-banners:  
  * Field: Features units of all rarities. Usually prioritizes Squad Banner compatible units.  
  * Squad: Features 3★/4★/5★/6★ units. Gives less quantity of units at a higher cost for better quality.  
* **Additions**:   
  * 1★: Fixed roster (no updates).  
  * 2★: Rare additions.  
  * 3★+: Frequent new units.

2. ### Resources

* **Materials**: Currency for gacha pulls for units. Gain from sacrificing/prestiging units, quests, battle rewards (win/lose), and plenty for early game.  
* **Pity Points**: Gain from pulls to exchange for specific 5★/6★ units of choice from an available banner. Universal for all banners. Can also be used to buy duplicates of units pulled at least once.  
* **Time Dilation**: Similar to AP in other games. Spend to participate in battles. Can be used to speed up cooldowns but is expensive. Regains slowly real time and certain quests.  
* **Orbs**: Main currency for miscellaneous stuff. Gained from Quests, battle rewards (win/lose), and plenty for early game.  
* **Restart Tickets**: Rare tickets that undos the effect of a failed battle. Dupe numbers and resources are reset to before the battle.  
* **Heart Piece**: Premium currency used to improve pull rates, effectively reduce large cooldowns, and exchange for other materials.

3. ### Monetization (unlikely)

* **Resources**: Can buy Heart Pieces. Weekly spending limit that can carry over to other weeks up to a month.  
* **Subscription**: Monthly subscription on Patreon or other monetization platforms that gives bonus resources and resource drops by tier, early access to updates, and greater influence over future content. Doesn't count towards the spending limit.  
* **PVP**: All player battles and leaderboards are split between F2P and P2W.

## **5\. Development Roadmap**

- [ ] **Phase 1**: Prototype Squad, Battlefield, and Gacha mechanics.  
- [ ] **Phase 2**: Implement Power and Level up systems. Add Synergies and Elements.  
- [ ] **Phase 3**: Balance resources and progression. Soft Launch afterwards.  
- [ ] **Post-Launch**: Game mode variants, special banners, specific character prestiges.

