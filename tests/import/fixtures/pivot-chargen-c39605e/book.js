export const AB=['str','dex','con','int','wis','cha'];
export const ABN={str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'};
export const ABS={str:'Str',dex:'Dex',con:'Con',int:'Int',wis:'Wis',cha:'Cha'};
export const MENTAL=['int','wis','cha'];

export const WEAPONS=['Light Melee','Medium Melee','Heavy Melee','Two-Handed Heavy Melee','Improvised','Bows','Crossbows','Slings','Thrown'];
export const MELEE=['Light Melee','Medium Melee','Heavy Melee','Two-Handed Heavy Melee'];
export const RANGED=['Bows','Crossbows','Slings','Thrown'];
export const WSTR={'Medium Melee':12,'Heavy Melee':15,'Two-Handed Heavy Melee':15};
export const WDIE={'Light Melee':'1d4','Medium Melee':'1d6','Heavy Melee':'1d8 (1d10 two hands)','Two-Handed Heavy Melee':'1d12'};
export const ARMOUR_GRADES=['None','Light','Medium','Heavy'];
export const ASTR={Medium:13,Heavy:16};
export const ARMOUR_STATS={Light:{ac:1,dexcap:99,str:0},Medium:{ac:3,dexcap:2,str:13},Heavy:{ac:6,dexcap:0,str:16}};
export const SHIELD_STATS={Small:{ac:1,str:0},Large:{ac:2,str:13}};

export const SKILLS=[
 ['Acrobatics','dex'],['Alchemy','int'],['Animal Handling','wis'],['Athletics','str'],['Control Magic','magic'],
 ['Deception','cha'],['Insight','wis'],['Intimidation','cha'],['Investigation','int'],['Medicine','int'],
 ['Medicine: Holistic','wis'],['Nature','int'],['Navigation','int'],['Perception','wis'],['Performance','cha'],
 ['Persuasion','cha'],['Religion','wis'],['Sleight of Hand','dex'],['Stealth','dex'],['Survival','wis'],['Thievery','dex']
];
export const SKILL_AB=Object.fromEntries(SKILLS);
export const CRAFT_AB={'Armourer':'str','Bowyer':'dex','Cooking':'wis','Fine Arts':'dex','Fletching':'dex','Leatherworking':'dex','Metalworking':'str','Prose':'int','Rune Etching':'int','Stoneworking':'str','Tattooing':'dex','Textile Craft':'dex'};
export const ACADEMIA=['Arcane','Commerce','Dungeoneering','Engineering','Geography','Geology','History','Languages','Local','Nobility and Royalty','Realms','Religion'];
export const SOCIAL_CHA=['Deception','Intimidation','Performance','Persuasion'];

export const FOCI=[
 {n:'Up-close fighter',lean:'Str and Con (Dex for Light Melee)',groups:['Body','Grit and Luck','Combat'],buys:'A melee weapon category, armour, maybe a shield'},
 {n:'Archer or thrower',lean:'Dex plus Wis or Con',groups:['Senses','Body','Combat'],buys:'Bows, Crossbows, Slings or Thrown, light armour'},
 {n:'Sneak',lean:'Dex plus Int or Wis',groups:['Senses','Social','Body'],buys:'Stealth, Sleight of Hand, Thievery, light armour'},
 {n:'Talker',lean:'Cha plus Wis or Int',groups:['Social'],buys:'Persuasion, Deception, Insight'},
 {n:'Thinker',lean:'Int plus Wis',groups:['Mind'],buys:'Academia, Investigation, Medicine, Crafting'},
 {n:'Caster',lean:'Your magic ability plus Con',groups:['Magic'],buys:'Awakened first, then Control Magic'},
 {n:'Survivor',lean:'Con plus anything',groups:['Grit and Luck','Toughness and Movement'],buys:'Survival, Medicine, armour'}
];

export const SPECIES={
 human:{name:'Human',asi:{str:1,dex:1,con:1,int:1,wis:1,cha:1},size:'Medium',speed:10,
  sum:'+1 to all six. Medium, 10 m.',who:'Free General feat plus the Origin feat. Extra language. Flexible, or undecided.',
  traits:['Skilful: one free skill or weapon proficiency','Versatile: one free Origin feat and one free General feat','Experienced: a free Background','Extra language of your choice','Speed 10 m']},
 dwarf:{name:'Dwarf',asi:{con:2,wis:1},size:'Medium',speed:8,
  sum:'Con +2, Wis +1. Medium, 8 m.',who:'Darkvision 18 m. Advantage and Resistance against poison. One melee grade plus Shield. Front-line.',
  traits:['Darkvision 18 m','Advantage on saves against poison, Resistance to poison damage','Strong Backs: carry 10% more','Academia: Geology (+2 on stonework origin checks)','Languages: Common, Dwarvish','Speed 8 m']},
 elf:{name:'Elf',asi:{dex:2,int:1},size:'Medium',speed:10,
  sum:'Dex +2, Int +1. Medium, 10 m.',who:'Low Light Vision. Perception. Bow plus Light or Medium melee. Advantage against charm. +1 MP per level if Awakened. Archery, scouting, quick casters.',
  traits:['Low Light Vision','Keen Senses: Perception proficiency','Fey Ancestry: Advantage against charm, magic cannot put you to sleep','Trance: 4 hours of meditation replaces sleep','If Awakened: +1 MP per level','Languages: Common, Elvish','Speed 10 m']},
 halfling:{name:'Halfling',asi:{dex:2,cha:1},size:'Small',speed:7,
  sum:'Dex +2, Cha +1. Small, 7 m.',who:'Reroll a natural 1. Advantage against fear. Hide behind larger creatures. Sneaky, lucky, likeable.',
  traits:['Happy Go Lucky: reroll a natural 1 on a d20','Brave: Advantage on saves against fear','Halfling Nimbleness: move through larger creatures’ spaces','Naturally Stealthy: hide behind a creature one size larger','Medium or larger creatures give half cover','Languages: Common, Halfling','Speed 7 m']},
 gnome:{name:'Gnome',asi:{int:2,con:1},size:'Small',speed:7,
  sum:'Int +2, Con +1. Small, 7 m.',who:'Darkvision 18 m. Advantage on Int, Wis and Cha saves against magic. Academia: Arcane. A Craft skill. +1 MP per level if Awakened. Casters, tinkerers.',
  traits:['Darkvision 18 m','Gnome Cunning: Advantage on Int, Wis, Cha saves against magic','Artificer’s Academia: Academia: Arcane (+2 on magic items, alchemy, technology)','Tinker: a Craft skill with +2 when using it','If Awakened: +1 MP per level','Medium or larger creatures give half cover','Languages: Common, Gnomish','Speed 7 m']},
 custom:{name:'Custom Humanoid',asi:{},size:'Medium',speed:10,gm:true,
  sum:'One +2 and one +1. Small, Medium or Large.',who:'Extra 2 BP, only for Humanoid Abilities or Thaumaturgic body mods. Size changes BP: Small +1, Medium none, Large -3. Something the list lacks.',
  traits:['Versatile: one free Origin feat','Experienced: a free Background','Extra 2 BP restricted to Humanoid Abilities and body mods','Languages: Common and one native tongue (GM approves)']}
};
export const SIZE_BP={Small:1,Medium:0,Large:-3};
export const SIZE_NOTE={Small:'Speed 7, -1 Strength, +1 Dexterity, half cover from bigger creatures.',Medium:'Speed 10.',Large:'Speed 12, +1 Strength or Constitution, -1 Dexterity, four squares on the map, Large armour only.'};
export const SIZE_SPEED={Small:7,Medium:10,Large:12};

export const BG={
 'Colonist/Settler':{tier:2,slots:[['W','S:Survival'],['S:Animal Handling','S:Athletics'],['C'],['A','L']],
   feat:'Make Do: once a day, Advantage on a Craft or Survival check to build a shelter, trap or repair. No weaknesses.',
   pack:'Craft tool kit worth up to 10 gp matching your Craft skill, shovel, hammer, hunting trap, fishing tackle, two-person tent, Type I poultice.'},
 'Conditioned':{tier:2,needsAw:true,fixed:['S:Control Magic','AC:Arcane'],slots:[['AC'],['L']],aggregate:true,
   feat:'Requires the Awakened feat. Gives Control Magic, Academia: Arcane and one more Academia skill, a language, and the Aggregate stream at Core free, on top of your starting streams.',
   pack:'Writing set (parchment, ink, pen, scroll case), three Type I poultices, chalk (10 pieces).'},
 'Delinquent':{tier:1,slots:[['S:Sleight of Hand','S:Stealth'],['S:Deception','S:Insight','W'],['S:Thievery','C'],['A','L']],
   feat:'Moving Goods: in town, you can find a fence. No weaknesses.',pack:'Thieves’ Tools, chalk (10 pieces).'},
 'Devoted':{tier:2,slots:[['S:Religion','S:Nature'],['S:Persuasion','W'],['AC','C'],['A','L']],
   feat:'Fellowship: temples of your god or an allied god offer shelter, a meal and supplies. You may trade your weapon and armour proficiencies for the Martial Arts Training feat (GM table call, handle it in the Feats step).',
   pack:'Herbalism Kit, three Type I poultices, robe, candles (dozen), writing set (parchment, ink, pen, scroll case).'},
 'Indentured':{tier:1,slots:[['S:Athletics','S:Perception'],['S:Intimidation','W:Improvised'],['C'],['A','L']],
   feat:'The Connection: bound labourers and servants tell you what they know about their masters. No weaknesses.',
   pack:'Craft tool kit worth up to 10 gp matching your Craft skill, manacles, crowbar, Type I poultice.'},
 'Intellectual':{tier:2,needsLit:true,slots:[['AC','S:Alchemy'],['S:Investigation','W'],['AC'],['A','L']],
   feat:'Needs literacy. The Illiterate Flaw bars this Background. Bookclubs: a day of research in a town with a scholar or library gets you a fact the GM would otherwise withhold.',
   pack:'Blank book, writing set (parchment, ink, pen, scroll case).'},
 'Peasant':{tier:1,slots:[['ANYS'],['W','ANYS'],['C'],['A','L']],
   feat:'Earn Your Supper: a day’s honest labour buys a meal and a bed in any village. No weaknesses.',
   pack:'Craft tool kit worth up to 10 gp matching your Craft skill, shovel, hammer, Type I poultice.'},
 'Privileged':{tier:3,issue:'priv',slots:[['S:Persuasion','S:Insight'],['W','S:Deception'],['AC','L']],
   feat:'Bank of Mummsie (family money, GM sets the amount). Standing: heard before commoners, Advantage on Persuasion against them in formal settings. Right of Hospitality at noble households. Obligations and Called to Arms can cost you all of it.',
   pack:'Fine Clothes, signet ring, vial of perfume, writing set (parchment, ink, pen, scroll case), Winter Clothes, and your Privileged Issue.'},
 'Prodigy':{tier:2,slots:[['EXP'],['C','AC'],['W']],noArmour:true,noLang:true,penalty:'Costs you -2 on every skill you are not proficient in. No armour or language proficiency.',
   feat:'Expertise in one Intelligence, Dexterity or Wisdom skill (not Control Magic), plus a Craft or Academia skill and one weapon type.',
   pack:'One tool kit or musical instrument matching your talent, worth up to 25 gp, writing set (parchment, ink, pen, scroll case).'},
 'Recluse':{tier:2,slots:[['S:Investigation','S:Stealth'],['S:Survival'],['W'],['C'],['A','L']],
   feat:'Stillness: after a minute of silence, Advantage on your next Perception check to listen or observe. No weaknesses.',
   pack:'Hunting trap, fishing tackle, two-person tent, Winter Clothes, two Type I poultices, writing set (parchment, ink, pen, scroll case).'},
 'Sailor':{tier:2,slots:[['S:Acrobatics'],['S:Navigation'],['W','S:Nature'],['AC','C'],['A','L']],
   feat:'Like A Monkey: Advantage on rolls to climb ropes. No weaknesses.',pack:'Compass, fishing tackle, block and tackle.'},
 'Smooth Talker':{tier:1,slots:[['S:Persuasion','S:Intimidation'],['S:Deception','W'],['C','AC'],['A','L']],
   feat:'Ooh, Tell Me More: once per social scene, Advantage on one Persuasion check to draw out gossip or secrets. No weaknesses.',pack:'Disguise Kit, playing cards.'},
 'Street Mage':{tier:1,needsAw:true,fixed:['S:Control Magic'],slots:[['W:Light Melee','S:Insight'],['C','S:Deception'],['A','L']],
   feat:'Requires the Awakened feat. One fewer MGP when you spend PP on Magic Growth (minimum 1), but +3 Mana Points per level. Without Aggregate you cannot read arcane script and you struggle with scrolls at level 1, so consider picking it as a starting stream.',
   pack:'Writing set (parchment, ink, pen, scroll case), two Type I poultices, steel mirror, chalk (10 pieces).'},
 'Survivor':{tier:1,slots:[['S:Stealth','S:Survival'],['S:Perception','W:Improvised'],['C'],['A','L']],survFeat:true,
   penalty:'-2 on Charisma-based social skills and a standing hatred of whoever destroyed your home.',
   feat:'Free feat (Alert or Fearless).',pack:'Hunting trap, fishing tackle, two-person tent, two Type I poultices.'},
 'Thug':{tier:1,slots:[['S:Athletics','S:Intimidation'],['S:Acrobatics','W'],['C'],['A','L']],
   feat:'Know What’s What: a day in the seedy bars finds you a snitch or a way into the local underworld. No weaknesses.',pack:'3 m of chain, manacles, crowbar, two Type I poultices.'},
 'Veteran':{tier:2,issue:'vet',slots:[['S:Athletics','S:Intimidation'],['WW','S:Medicine'],['L']],
   feat:'Reserve: your old lord or captain can call you back, and ignoring the summons makes you a deserter.',pack:'Hammer, whetstone, and your Veteran’s Issue.'},
 'Wanderer':{tier:2,slots:[['S:Deception','S:Survival'],['S:Stealth','W:Improvised'],['S:Thievery','C'],['A','L']],
   feat:'You Know The Roads: you always get there in the end, and the GM adds a complication. No weaknesses.',
   pack:'Two-person tent, hunting trap, fishing tackle, Winter Clothes, two Type I poultices.'}
};
export const ISSUES={
 vet:[{n:'Heavy',a:'Heavy',shield:null,gear:'Heavy armour'},
      {n:'Sword and Board',a:'Medium',shield:'Large',gear:'Medium armour, Large Shield'},
      {n:'Crunchy Recruit',a:'Light',shield:'Small',gear:'Light armour, Small Shield, holy symbol'}],
 priv:[{n:'Heavy',a:'Heavy',shield:null,gear:'Heavy armour'},
      {n:'Medium and Shield',a:'Medium',shield:'Large',gear:'Medium armour, Large Shield'},
      {n:'Light and Shield',a:'Light',shield:'Small',gear:'Light armour, Small Shield'}]
};
export const TIER_INFO={1:{blocks:1,dice:[2,6,2]},2:{blocks:2,dice:[3,6,3]},3:{blocks:3,dice:[4,6,4]}};

export const FLAWS=[
 ['Body and Senses'],
 {n:'Allergies',bp:[1,3],t:'DC 15 Con save after five minutes of exposure, -4 to all rolls until you pass. At 3 points it is deadly: Poisoned and 1d6 damage a round.'},
 {n:'Anaemic',bp:[2],bars:['con'],t:'Con saves at Disadvantage against poison and contaminants. Con cannot be Primary.'},
 {n:'Chronically Ill',bp:[3],bars:['con'],t:'One fewer Hit Die in your Pool. DC 12 Con save after strenuous activity or gain Exhaustion, and recovery is harder. Con cannot be Primary.'},
 {n:'Clumsy',bp:[2],bars:['dex'],t:'Dex saves at Disadvantage, and so are untrained Dex skills. Dex cannot be Primary.'},
 {n:'Colour Blind',bp:[1],t:'You see only shades of grey.'},
 {n:'Deaf',bp:[1],t:'Permanently Deafened. You fail hearing checks and know Trade Sign Language. Restoring hearing costs a PP.'},
 {n:'Deep Sleeper',bp:[1],t:'Enemies have Advantage to find you asleep. Disadvantage on Perception to wake.'},
 {n:'Night Blind',bp:[1],t:'Low Light counts as Darkness for you.'},
 {n:'Short-Winded',bp:[2],bars:['con'],t:'Speed -2. Dash moves half. Con save (DC 12, rising) or you are stunned after dashing. Con cannot be Primary.'},
 {n:'Strict Diet',bp:[1],t:'Meals cost three times as much, 25% chance a place has nothing for you, and one safe ration.'},
 {n:'Thin Skinned',bp:[1],t:'Vulnerable to one damage type you choose.'},
 ['Mind and Habit'],
 {n:'Addiction',bp:[1,2],t:'Need the substance several times a day. Without it: -4 to all rolls. At 2 points, also Disadvantage, and you take risks to get it.'},
 {n:'Coward',bp:[3],t:'In combat, a DC 10 Wis save every round to do anything but run or cower. The DC climbs as you take damage.'},
 {n:'Gambling',bp:[1],t:'You cannot resist a wager. Wis save to hold back.'},
 {n:'Greed',bp:[1],t:'Wis save to resist a chance to take the cash. Breeds Enemies.'},
 {n:'Naive',bp:[1],t:'Disadvantage on Insight and Perception to spot dodgy behaviour.'},
 {n:'Pacifist',bp:[3],t:'You never harm a sentient creature. Indirect and non-damaging effects are fine.'},
 {n:'Phobia',bp:[1,2],gm:true,t:'The GM approves the fear. Tier 1: -4 to all rolls within 3 m of it. Tier 2: Frightened while it is in sight, Disadvantage on most rolls.'},
 {n:'Short Fuse',bp:[2],t:'DC 12 Wis save when damaged, or your next turn goes to attacking that creature. The DC rises by 2 each time in a fight.'},
 {n:'Strict Code',bp:[2],t:'Write 6 to 10 tenets with your GM, and agree the cost of breaking them.'},
 {n:'Wannabe Hero',bp:[1],t:'You escalate to look heroic and cannot resist an audience.'},
 ['Social and Story'],
 {n:'Distinctive',bp:[1],t:'Easy to recognise. Disadvantage with Disguise Kits and disguise magic.'},
 {n:'Ego / Arrogant',bp:[1],bars:['cha'],t:'Disadvantage on friendly social interaction. Cha cannot be Primary.'},
 {n:'Enemy',bp:[1,2,3,4],gmAt:3,t:'Someone wants you ruined. 1: now and then. 2: most sessions. 3: a faction or major foe (GM approves). 4: campaign-defining (GM approves).'},
 {n:'Hated by the Gods',bp:[2],t:'Your first natural 20 each session counts as a 1. Once per Long Rest, the GM can swap a contested result.'},
 {n:'Honest to a Fault',bp:[2],t:'You cannot lie. Disadvantage on Deception, Advantage on Persuasion with people who know you.'},
 {n:'Illiterate',bp:[4],bars:[],t:'You cannot read or write. Reading-based skills fail or are at Disadvantage. Bars the Conditioned and Intellectual Backgrounds.'},
 {n:'Inarticulate',bp:[1],t:'-4 to social skills that involve speaking.'},
 {n:'Known Criminal',bp:[1],t:'Visible criminal mark. Disadvantage dealing with law enforcement.'},
 {n:'Obligation',bp:[2],t:'A creditor calls it in once per adventure. Refusing costs you Disadvantage with their people, and more.'},
 {n:'Semi-Literate',bp:[2],t:'Basic reading only. Disadvantage on reading skills, and complex writing fails.'},
 {n:'Ugly',bp:[1],bars:['cha'],t:'-2 to charm and persuasion checks. +1 Intimidation if proficient. Cha cannot be Primary.'},
 {n:'Uncouth',bp:[2],bars:['cha'],asi:{cha:-2},t:'Cha score -2, Disadvantage on charm and manners checks. Cha cannot be Primary.'}
];

export const STREAMS=[
 {n:'Aggregate',ab:'Any',core:'Hocus-Pocus, Slice Magic, Mind Ping, Privacy, Detect Magic, Light, Brain Shank'},
 {n:'Transmutation',ab:'int',core:'Alchemist’s Touch, Acid Splash, Change Liquid, Identify Substance'},
 {n:'Elemental Control: Fire',ab:'int,wis',core:'Produce Flame, Fire Resistance, Flaming Bolt'},
 {n:'Elemental Control: Air',ab:'Any',core:'Gust, Shocking Grasp, Air Resistance'},
 {n:'Elemental Control: Earth',ab:'wis,int',core:'Mould Earth, Stone Throw, Earth Resistance'},
 {n:'Elemental Control: Water',ab:'wis',core:'Shape Water, Frost Bolt, Cold Resistance'},
 {n:'Impetus',ab:'int',core:'Jump, Force Armour, Force Throw'},
 {n:'Resonance',ab:'Any',core:'Sound Resistance, Burst of Sound, Throw Voice'},
 {n:'Divinity',ab:'cha,wis',core:'Sacred Flame, Divine Resistance, Turn Undead, Sacred Rite'},
 {n:'Spirit',ab:'wis,cha',core:'Spirit Sense, Alarm, Soothe, Telepathic Bond, Metaphysical Sense'},
 {n:'Manipulation',ab:'cha',core:'Vicious Mockery, Message, Silent Image'},
 {n:'Abjuration',ab:'Any',core:'Mage Armour, Resistance, Bane'},
 {n:'Affect Flora',ab:'wis',core:'Impact Plants, Detect Poison or Disease, Poison Spray, Vine Lash'},
 {n:'Affect Fauna',ab:'wis,cha',core:'Animal Friendship, Beast’s Instinct, Call of Kin, Sense Animals'},
 {n:'Healing',ab:'wis',core:'Spare the Dying, Cure Wounds'},
 {n:'Necromancy',ab:'int,cha',core:'Chill Touch, False Life, Cause Fear, Control Undead'},
 {n:'Corruption',ab:'wis,cha',core:'Poison Touch, Wither, Sap Strength, Corrode'}
];

// req(c): c.sc score (before feat and body mod bonuses), c.prim Set, c.aw, c.skills Set, c.wp Set, c.feats Set, c.flaws Set, c.crafts count
const hi=(c,abs,n)=>abs.some(a=>c.sc[a]>=n);
const anyMelee=c=>MELEE.some(w=>c.wp.has(w));
const anyRanged=c=>RANGED.some(w=>c.wp.has(w));
export const FEATS=[
 {n:'Acute Hearing',t:'o',g:'Senses',needs:'-',d:'Advantage on hearing-based Perception when you concentrate. Fails in noisy places or if you are deafened.'},
 {n:'Acute Smell',t:'o',g:'Senses',needs:'-',d:'Advantage on smell-based Perception when you concentrate. Detect creatures by scent within 3 m. Disadvantage on saves against smell effects.'},
 {n:'Acute Taste',t:'o',g:'Senses',needs:'-',d:'Advantage on taste-based Perception and Investigation, such as spotting poison. With Crafting: Cooking, Short Rest meals give +1 hp per Hit Die spent.'},
 {n:'Acute Touch',t:'o',g:'Senses',needs:'-',d:'Advantage on touch-based rolls when you concentrate, including Thievery on locks and safes. Not in combat or under time pressure, and no gloves.'},
 {n:'Acute Vision',t:'o',g:'Senses',needs:'Int or Wis 13+',req:c=>hi(c,['int','wis'],13),d:'+2 to Insight, Investigation or Perception (your pick) and +2 Passive Perception for sight. Searching becomes a Bonus Action at half speed.'},
 {n:'Alert',t:'o',g:'Senses',needs:'-',d:'Passive Perception +2. Advantage once per Short Rest on Perception checks made as an Action. +2 Insight when watching for dodgy behaviour.'},
 {n:'Sixth Sense',t:'o',g:'Senses',needs:'Not Awakened',req:c=>!c.aw,d:'Once per Short Rest, Advantage on Insight, Perception or Initiative. You cannot be surprised, and you roll Initiative at Advantage.'},
 {n:'Artistic',t:'o',g:'Social',needs:'Cha or Dex is a Primary Ability, 13+',req:c=>['cha','dex'].some(a=>c.prim.has(a)&&c.sc[a]>=13),pick:['cha','dex'],d:'+1 to that score. Pick an art form: Advantage on Performance, Crafting and critique checks for it, and you can earn a living at it.'},
 {n:'Bland',t:'o',g:'Social',needs:'Cha 12 or lower',req:c=>c.sc.cha<=12,d:'Forgettable. Advantage on Deception and Stealth to slip past in plain view. Witnesses have Disadvantage to remember you.'},
 {n:'Famous',t:'o',g:'Social',needs:'Cha 13+',req:c=>c.sc.cha>=13,d:'Once per Long Rest, Advantage on a Persuasion or Deception check by invoking your reputation. Harder to stay unnoticed.'},
 {n:'Hey, Ma! Look at Me!',t:'o',g:'Social',needs:'Cha 13+, Wis 13 or lower',req:c=>c.sc.cha>=13&&c.sc.wis<=13,d:'Once per Short Rest, when doing something heroic in front of onlookers: Advantage on your saves and enemies have Disadvantage to hit you.'},
 {n:'Natural Charisma',t:'o',g:'Social',needs:'Cha 13+',req:c=>c.sc.cha>=13,skillPick:['Deception','Persuasion','Intimidation'],d:'Advantage on Cha checks to blend into a social setting. Proficiency in Deception, Persuasion or Intimidation, and a once per Long Rest reroll on a failed Cha skill check.'},
 {n:'Sensual',t:'o',g:'Social',needs:'Cha 13+',req:c=>c.sc.cha>=13,asi:{cha:1},d:'+1 Cha. Advantage on Persuasion and Deception against anyone who might find you attractive, and they have Disadvantage on Perception toward others.'},
 {n:'Slick',t:'o',g:'Social',needs:'Cha 13+',req:c=>c.sc.cha>=13,asi:{cha:1},d:'+1 Cha. Spend a Hit Die for Advantage on a Deception, Intimidation or Persuasion check.'},
 {n:'Great Memory',t:'o',g:'Mind',needs:'Int 13+',req:c=>c.sc.int>=13,asi:{int:1},d:'+1 Int. Advantage on Int checks about memory. +2 to Academia checks if you are proficient.'},
 {n:'Handyman',t:'o',g:'Mind',needs:'Dex 13+, two Crafting specialisations',req:c=>c.sc.dex>=13&&c.crafts>=2,d:'Use makeshift or wrong tools without Disadvantage. Sacrifice a tool set to turn a failed check into a success.'},
 {n:'Ink Stained',t:'o',g:'Mind',needs:'Int 13+',req:c=>c.sc.int>=13,asi:{int:2},d:'+2 Int. Proficiency in one Academia skill, with a once per Long Rest reroll on it. Disadvantage on Athletics and Acrobatics.',grantsAcademia:true},
 {n:'Jack of All Trades',t:'o',g:'Mind',needs:'Int 13+ or Wis 13+',req:c=>hi(c,['int','wis'],13),d:'Spend Hit Dice to attempt untrained Academia or Crafting tasks: 1 for an easy one (DC 10 or lower), 2 for anything at Disadvantage, 3 for anything, 5 to succeed with complications.'},
 {n:'Linguist',t:'o',g:'Mind',needs:'Int 13+',req:c=>c.sc.int>=13,asi:{int:1},d:'+1 Int. Languages equal to your Int bonus, plus proficiency in Academia: Languages.',grantsSkill:'Academia: Languages'},
 {n:'Obscure Knowledge',t:'o',g:'Mind',needs:'Int and Wis 12 or lower',req:c=>c.sc.int<=12&&c.sc.wis<=12,d:'Once per Long Rest, treat an untrained Int or Wis skill as trained for recalling information only. A Hit Die gives Advantage, or the answer to the problem.'},
 {n:'Ambidexterity',t:'o',g:'Body',needs:'Dex 13+',req:c=>c.sc.dex>=13,asi:{dex:1},d:'+1 Dex. Spend a Hit Die to use a Dexterity-based skill as a Bonus Action in a fight.'},
 {n:'Athletic',t:'o',g:'Body',needs:'Str or Dex 13+',req:c=>hi(c,['str','dex'],13),pick:['str','dex'],d:'+1 Str or Dex. Climb speed equal to Speed on natural surfaces. Easier standing and jumping. Spend a Hit Die to reroll a physical skill check.'},
 {n:'Olympian',t:'o',g:'Body',needs:'Str, Con or Dex 13+',req:c=>hi(c,['str','con','dex'],13),pick:['str','con','dex'],d:'+1 to one of them. Spend a Hit Die when Dashing for +2 m and ignore difficult terrain. Faster travel pace and resistance to the first Exhaustion from exertion.'},
 {n:'Power to Weight Ratio',t:'o',g:'Body',needs:'Dex 13+ or Str 13+',req:c=>hi(c,['dex','str'],13),d:'You may use Dexterity instead of Strength for Athletics. Carry weight as if one size larger.'},
 {n:'Brutish',t:'o',g:'Grit and Luck',needs:'Con and Str 14+',req:c=>c.sc.con>=14&&c.sc.str>=14,asi:{con:1,str:1},hp:2,d:'+1 Con and Str. +2 hp per level, Damage Reduction 1 against bludgeoning, spend a Hit Die to double melee damage. You are Large: custom gear at 1.5 times cost, heavy mounts only, 1.5 times the rations.'},
 {n:'Fearless',t:'o',g:'Grit and Luck',needs:'-',asi:{wis:1},d:'+1 Wis. Advantage on saves against fear and on checks to resist Intimidation.'},
 {n:'Intestinal Fortitude',t:'o',g:'Grit and Luck',needs:'Con 13+',req:c=>c.sc.con>=13,d:'Advantage on saves against stench, nausea and disgust. Spend a Hit Die to succeed automatically.'},
 {n:'Lucky',t:'o',g:'Grit and Luck',needs:'-',d:'Roll a d20 each Long Rest and swap it in for any roll, yours, an ally’s or an enemy’s. A Hit Die rerolls it, two refresh it. Advantage on Sleight of Hand at games of chance.'},
 {n:'Tough Guy',t:'o',g:'Grit and Luck',needs:'-',hp:2,d:'+2 maximum hit points now, and +2 more at every level.'},
 {n:'I Don’t Give a Rat’s Ass',t:'o',g:'Magic',needs:'Awakened',req:c=>c.aw,asi:{int:1,cha:-2},d:'+1 Int, -2 Cha (minimum 6). You wake from a Long Rest at full MP. The Getting Your Head Right check does not apply to you.'},
 {n:'Magic Sensitive',t:'o',g:'Magic',needs:'Int, Wis or Cha 13+, not Awakened',req:c=>!c.aw&&hi(c,MENTAL,13),d:'Against magic that calls for a save, roll Control Magic or your normal save, whichever is higher. You cannot wield magic, but you can try a scroll with a Control Magic roll.'},
 {n:'Mind Over Matter',t:'o',g:'Magic',needs:'Awakened',req:c=>c.aw,asi:{str:-1,dex:-1,con:-1},magicAsi:2,d:'+2 to your magic ability (maximum 21). -1 Str, Dex and Con. Disadvantage on Athletics and Acrobatics.'},
 {n:'Basher',t:'g',g:'Combat',needs:'Str 16+, melee proficiency',req:c=>c.sc.str>=16&&anyMelee(c),asi:{str:1},d:'+1 Str. Bludgeoning weapon damage dice step up one size.'},
 {n:'Slasher',t:'g',g:'Combat',needs:'Str 16+, melee proficiency',req:c=>c.sc.str>=16&&anyMelee(c),asi:{str:1},d:'+1 Str. Slashing weapon damage dice step up one size.'},
 {n:'Stabby Stabby',t:'g',g:'Combat',needs:'Str 16+, melee proficiency',req:c=>c.sc.str>=16&&anyMelee(c),asi:{str:1},d:'+1 Str. Piercing weapon damage dice step up one size.'},
 {n:'Combat Reflexes',t:'g',g:'Combat',needs:'Dex 13+',req:c=>c.sc.dex>=13,d:'Free Attacks of Opportunity each turn equal to your Dex bonus. Spend Hit Dice for more, including lunging at creatures that come within 1 m. Disengage still provokes.'},
 {n:'Finesse',t:'g',g:'Combat',needs:'Dex higher than Str',req:c=>c.sc.dex>c.sc.str,d:'Light slashing weapons use Dex for damage. Once per turn after a light melee hit, move 1 m away without provoking.'},
 {n:'Get Down',t:'g',g:'Combat',needs:'Str 13+',req:c=>c.sc.str>=13,d:'Once per Short Rest, Reaction to protect an ally within 2 m: the attack has Disadvantage and the ally gains Advantage on Dex saves against area damage (they lose their bonus action).'},
 {n:'I Am A Warrior',t:'g',g:'Combat',needs:'-',d:'Extra attack at level 5 and again at level 11. Before those levels, spend a Hit Die for an extra attack.'},
 {n:'Intelligent Fighter',t:'g',g:'Combat',needs:'Int 13+, Light or Medium Melee',req:c=>c.sc.int>=13&&(c.wp.has('Light Melee')||c.wp.has('Medium Melee')),d:'Use Int instead of Dex for light melee and crossbow attacks. Spend a Hit Die for Advantage on an attack or your Int bonus to damage.'},
 {n:'Martial Arts Training',t:'g',g:'Combat',needs:'Dex or Str 13+, no Street Fighter',req:c=>hi(c,['dex','str'],13)&&!c.feats.has('Street Fighter'),pick:['dex','str'],d:'+1 Dex or Str. Unarmed Strike does 1d4 + Str, rising to 1d10 by level 15. Proficiency on grapples and automatic grapple damage.'},
 {n:'Mounted Archer',t:'g',g:'Combat',needs:'-',d:'No Disadvantage on ranged attacks from a mount moving up to its full Speed. If the mount Dashes, you still have it.'},
 {n:'Ranged Specialist',t:'g',g:'Combat',needs:'Dex 13+, proficient in Bows, Crossbows, Slings or Thrown',req:c=>c.sc.dex>=13&&anyRanged(c),asi:{dex:1},d:'+1 Dex. Ranged weapon damage dice step up one size, two at level 6+. If the weapon adds no Strength, add half your Dex bonus to damage.'},
 {n:'Far Throw',t:'g',g:'Combat',needs:'Thrown Weapon proficiency',req:c=>c.wp.has('Thrown'),d:'Thrown weapons: Normal range 10 m, Long range 25 m.'},
 {n:'Sniper: Bows',t:'g',g:'Combat',needs:'Bows, Dex 13+',req:c=>c.wp.has('Bows')&&c.sc.dex>=13,asi:{dex:1},d:'+1 Dex. Reduce target cover one step. Damage dice step up if you moved half your Speed or less. Hit Dice buy aimed long range shots at Advantage or double damage.'},
 {n:'Sniper: Crossbows',t:'g',g:'Combat',needs:'Crossbows, Dex 13+',req:c=>c.wp.has('Crossbows')&&c.sc.dex>=13,asi:{dex:1},d:'The same as Sniper: Bows, for crossbows.'},
 {n:'Street Fighter',t:'g',g:'Combat',needs:'No Martial Arts Training',req:c=>!c.feats.has('Martial Arts Training'),d:'Unarmed Strike does 1d4 + Str, reroll 1s on damage. Improvised Weapon proficiency. Push a target 2 m instead of dealing damage.',grantsWeapon:'Improvised'},
 {n:'Storm In!',t:'g',g:'Combat',needs:'Str and Dex 13+',req:c=>c.sc.str>=13&&c.sc.dex>=13,pick:['str','dex'],d:'+1 Str or Dex. After a 3 m straight line charge, +1d8 damage or a 3 m push (both with a Hit Die). Once per Short Rest, a 7 m charge becomes a three square cleave.'},
 {n:'This is my Betsy',t:'g',g:'Combat',needs:'Proficiency with your Betsy',req:c=>c.wp.size>0,d:'Your favourite weapon gets +2 to hit and +1 damage. Any other weapon gets -2 and -1.'},
 {n:'Vigilant',t:'g',g:'Combat',needs:'Dex is a Primary Ability',req:c=>c.prim.has('dex'),d:'Add your Proficiency Bonus to Initiative, and swap Initiative with a willing ally.'},
 {n:'Dodgy',t:'g',g:'Toughness and Movement',needs:'Dex 12+',req:c=>c.sc.dex>=12,d:'When you Dash, add your Dex bonus to AC again until your next round.'},
 {n:'Get Me Outta Here',t:'g',g:'Toughness and Movement',needs:'-',d:'Bonus Action to Disengage, Dodge or Dash.'},
 {n:'Just a Scratch',t:'g',g:'Toughness and Movement',needs:'Con 13+',req:c=>c.sc.con>=13,d:'Once per Short Rest, turn a critical hit into a normal hit, or a normal hit into minimum damage. A Hit Die refreshes it.'},
 {n:'Like A Billy Goat',t:'g',g:'Toughness and Movement',needs:'Dex or Con 13+',req:c=>hi(c,['dex','con'],13),pick:['dex','con'],d:'+1 Dex or Con. Dashing over difficult terrain costs no extra. Attacks of Opportunity against you have Disadvantage.'},
 {n:'Meat Shield',t:'g',g:'Toughness and Movement',needs:'Con 13+',req:c=>c.sc.con>=13,asi:{con:1},d:'+1 Con. Reaction: take the damage meant for someone within 2 m (halved if they have fewer maximum hp than you). Heal with a Hit Die as a Bonus Action.'},
 {n:'Refuse to Die',t:'g',g:'Toughness and Movement',needs:'Con 13+',req:c=>c.sc.con>=13,asi:{con:1},d:'+1 Con. Advantage on Death saves. Once per Short Rest, spend Hit Dice as a Bonus Action to gain temporary hp instead of healing.'},
 {n:'Acting',t:'g',g:'Social and Skill',needs:'Cha 13+',req:c=>c.sc.cha>=13,asi:{cha:1},d:'+1 Cha. Advantage on Deception or Performance to impersonate someone, and to pass forged papers when you are present.'},
 {n:'A Girl’s Got Secrets',t:'g',g:'Social and Skill',needs:'Sleight of Hand',req:c=>c.skills.has('Sleight of Hand'),d:'Always conceal one light one-handed weapon and up to three small knives. Searchers have Disadvantage to find them in concealing clothing.'},
 {n:'Empathy',t:'g',g:'Social and Skill',needs:'Wis and Cha 13+',req:c=>c.sc.wis>=13&&c.sc.cha>=13,asi:{wis:1},d:'+1 Wis. Once per Short Rest, Advantage on a Deception, Insight, Intimidation or Persuasion check you are proficient in.'},
 {n:'Expert Rider',t:'g',g:'Social and Skill',needs:'Animal Handling, Dex 12+ or Wis 12+',req:c=>c.skills.has('Animal Handling')&&hi(c,['dex','wis'],12),d:'Advantage to stay mounted and control mounts. Mount in 1 m, use Animal Handling for mounted manoeuvres, and several other mounted bonuses.'},
 {n:'I Got A Guy',t:'g',g:'Social and Skill',needs:'Cha 13+',req:c=>c.sc.cha>=13,d:'Advantage on Persuasion to get hard-to-find gear or knowledge, and you always hear of good jobs. Burning a contact gives you a 1 point Enemy.'},
 {n:'Inspirational',t:'g',g:'Social and Skill',needs:'Cha 13+',req:c=>c.sc.cha>=13,asi:{cha:1},d:'+1 Cha. After a rest, give Advantage on the next save to creatures equal to your Cha bonus. Once per Long Rest, one of them gains temporary hp.'},
 {n:'Urban Instincts',t:'g',g:'Social and Skill',needs:'-',d:'+2 Insight to read lies and tension. Read a settlement crowd’s mood in a minute. Once per Long Rest, reroll Insight against a deceiver.'},
 {n:'Live, Damn You',t:'g',g:'Social and Skill',needs:'Medicine',req:c=>c.skills.has('Medicine'),asi:{int:1},d:'+1 Int. Spend a Hit Die and use a Physician’s Bag to bring a downed creature to 1 hp, or heal one above 0. Out of combat, 10 minutes of care costs no Hit Die. A Clinical Tincture (brewed with Alchemy) adds 1d6 hp.'},
 {n:'Wise Healer',t:'g',g:'Social and Skill',needs:'Medicine: Holistic, Wis 13+',req:c=>c.skills.has('Medicine: Holistic')&&c.sc.wis>=13,d:'Apply a Type I Poultice as an Action to heal 1d4 + Proficiency Bonus. Spend a Hit Die to boost an ally’s next save by your Proficiency Bonus.'},
 {n:'Magic Recuperation',t:'g',g:'Magic',needs:'Awakened',req:c=>c.aw,magicAsi:1,d:'+1 to your magic ability. Once per Long Rest, collect yourself under cover (a Hit Die, or an Action and a Control Magic check) to regain MP equal to your magic ability bonus.'},
 {n:'Steady Mind',t:'g',g:'Magic',needs:'Awakened',req:c=>c.aw,d:'Burn Hit Dice for +5 each on Concentration checks. Unlocks the Concentration feat chain.'}
];
export const FEAT_BY=Object.fromEntries(FEATS.map(f=>[f.n,f]));
export const OGROUPS=['Senses','Social','Mind','Body','Grit and Luck','Magic'];
export const GGROUPS=['Combat','Toughness and Movement','Social and Skill','Magic'];

export const MODS=[
 ['Defence'],
 {n:'Beast Hide (Tier 1)',bp:1,conf:['Thermal Hide (Tier 1)'],asi:{cha:-1},d:'Resistance to slashing damage and cold. A big fire hit strips the fur for a week. -1 Cha score.'},
 {n:'Thermal Hide (Tier 1)',bp:1,conf:['Beast Hide (Tier 1)'],d:'Resistance to fire or cold (your pick). Disadvantage on Persuasion and Deception with creatures unused to your look.'},
 {n:'Iron Bound (Tier 1)',bp:1,d:'Body weight four times normal: you sink in water and cannot serve in the cavalry. Half fall damage.'},
 ['Attributes'],
 {n:'Forged Flesh',bp:2,conf:['Windrunner (Tier 1)','Stone-Sinew Reweaving (Tier 1)'],asi:{str:1,dex:1,con:1,int:-1,wis:-1,cha:-1},d:'+1 Str, Dex and Con. -1 Int, Wis and Cha. Permanent.'},
 {n:'Mind Ascension (Tier 1)',bp:1,conf:['Heart Song Infusion (Tier 1)','Siren Soul (Tier 1)'],pick:['int','wis'],asi:{cha:-1},d:'+1 Int or Wis (your pick), -1 Cha. Tier 3 cannot be reversed.'},
 {n:'Stone-Sinew Reweaving (Tier 1)',bp:1,conf:['Windrunner (Tier 1)','Forged Flesh'],asi:{str:2,int:-1},d:'+2 Str, -1 Int.'},
 {n:'Windrunner (Tier 1)',bp:1,conf:['Forged Flesh','Stone-Sinew Reweaving (Tier 1)'],asi:{dex:2,wis:-1},d:'+2 Dex, -1 Wis.'},
 ['Senses and Voice'],
 {n:'Predator Sense (Tier 1)',bp:1,d:'Darkvision 40 m and Advantage on hearing-based Perception. Vulnerable to Thunder damage, Disadvantage on saves against thunder and smell effects.'},
 {n:'Echo Wisp (Tier 1)',bp:1,asi:{cha:1},d:'+1 Cha. Advantage on singing Performance checks. +2 Deception to mimic voices you have heard.'},
 {n:'Siren Soul (Tier 1)',bp:1,conf:['Mind Ascension (Tier 1)'],asi:{cha:2},d:'+2 Cha. Advantage on Persuasion against creatures who hear you. DC 12 Wis save or you are Charmed by striking beauty.'},
 {n:'Heart Song Infusion (Tier 1)',bp:1,conf:['Mind Ascension (Tier 1)'],asi:{cha:2,int:-2},d:'+2 Cha, -2 Int. An instinctive pull toward fey creatures.'},
 ['Combat and Movement'],
 {n:'Heart Fire (Tier 1)',bp:2,d:'Once per Long Rest, as a Bonus Action: +2 to attack and damage rolls until the end of your next turn.'},
 {n:'Tail: Scorpion Stinger',bp:2,d:'1d4 piercing tail strike. Once per Short Rest, DC 12 Con save or the target is Poisoned for 1 minute.'},
 {n:'Tail: Prehensile Grip',bp:1,d:'Stabilise, carry light loads, grapple, or whip-strike as an unarmed attack. No fine motor control.'},
 {n:'Tail: Balance Core',bp:1,asi:{dex:1},d:'+1 Dex. +2 Acrobatics. Half fall damage.'},
 {n:'Webbed',bp:1,d:'Swim speed 10 m. Swim in armour or while encumbered without penalty.'},
 ['Survival and Utility'],
 {n:'Blood Forge',bp:1,conf:['Sun-Fed Skin'],asi:{con:1},d:'+1 Con. Regain 1 hp a minute out of combat. Spend Hit Dice to heal as a Bonus Action. Advantage on poison and disease saves. Medics treat you at Disadvantage.'},
 {n:'Sun-Fed Skin',bp:1,conf:['Blood Forge'],d:'Regain 1 Hit Die per hour in bright light (needs bare skin). Half the usual food. Nothing in darkness or underground.'},
 {n:'Iron Gut (Tier 1)',bp:1,d:'Advantage on saves against ingested poisons and diseases. You can eat things that would make anyone else sick.'},
 {n:'Deep Lungs (Tier 1)',bp:1,conf:['Gill Bloom'],d:'Hold your breath twice as long.'},
 {n:'Gill Bloom',bp:1,conf:['Deep Lungs (Tier 1)'],d:'Breathe underwater indefinitely.'}
];
export const MOD_BY=Object.fromEntries(MODS.filter(m=>!Array.isArray(m)).map(m=>[m.n,m]));

export const HABIL=[
 ['Combat and Defence'],
 {n:'Natural Weaponry',bp:1,d:'Claws, fangs or spikes: 1d4 slashing, piercing or bludgeoning. One more point makes it 1d6.',up:'1d6 (+1 BP)'},
 {n:'Venomous Upgrade',bp:1,needs:'Natural Weaponry',d:'Once per Short Rest, a natural weapon hit forces a DC 12 Con save or the target is Poisoned for 1 minute.'},
 {n:'Bio-Storm-Touched',bp:2,d:'Once per Short Rest, Reaction: 1d10 lightning to a creature that hits you in melee. Grows by 1d10 at levels 5, 11 and 17.'},
 {n:'Chitinous Carapace',bp:2,ac:{base:12,dex:true,unarmoured:true,ignore:['Medium','Heavy']},d:'Unarmoured AC 12 + Dex. Light armour only. Advantage on saves against slashing effects.'},
 {n:'Thick Hide',bp:2,ac:{base:12},asi:{cha:-1},d:'Base AC 12 (no Dex). Resistance to slashing damage. -1 Cha score.'},
 {n:'Furry',bp:1,ac:{base:11,dex:true,unarmoured:true},d:'Unarmoured AC 11 + Dex. Warm and Cuddly. Advantage on saves against Exhaustion caused by cold.'},
 {n:'Uncanny Resilience',bp:2,d:'Once per Long Rest, drop to 1 hp instead of 0 (unless killed outright).'},
 ['Senses and Stealth'],
 {n:'Adapted Vision',bp:1,d:'Darkvision, Low-Light Vision or Thermal Vision (your pick). Tremorsense if you are weird.'},
 {n:'Multi-Faceted Vision',bp:2,d:'Advantage on sight-based Perception, cannot be surprised while conscious, Advantage on saves against blinding.'},
 {n:'Adaptive Camouflage',bp:2,d:'Bonus Action to match your surroundings. Advantage on Stealth without medium or heavy armour. Standing still gives creatures Disadvantage to spot you.'},
 ['Body and Presence'],
 {n:'Multi-Limbed Coordination',bp:2,d:'Four arms: two free object interactions a turn, Advantage to grapple and climb. The extra arms cannot fight.'},
 {n:'Prehensile Feet and Digitigrade Movement',bp:1,d:'Climb speed equal to Speed. Advantage on Acrobatics checks to keep your balance. No boots.'},
 {n:'Hibernation Recovery',bp:1,d:'A death-like 4 hour trance counts as a Long Rest. Spotting that you are alive takes a DC 20 Medicine check.'},
 {n:'Unnerving Presence',bp:2,d:'Action: a creature within 2 m makes a Wis save (DC 8 + Cha + Proficiency) or is charmed or frightened until the end of its next turn. Not magic.'}
];

export const BUNDLES=[
 {n:'Heavy Arms',d:'One Heavy Melee weapon, or one Two-Handed Heavy Melee weapon.',need:'Heavy Melee or Two-Handed Heavy Melee proficiency',ok:c=>c.wp.has('Heavy Melee')||c.wp.has('Two-Handed Heavy Melee')},
 {n:'Ranged Arms',d:'One of: a Recurve Bow, quiver and 20 arrows; a Hand Crossbow, quiver and 20 bolts; or a Sling with 20 lead bullets and two bundles of Medium Thrown weapons.',need:'The matching proficiency',
   opts:['Recurve Bow, quiver and 20 arrows','Hand Crossbow, quiver and 20 bolts','Sling with 20 lead bullets and two bundles of Medium Thrown weapons'],
   okOpt:(c,o)=>o===0?c.wp.has('Bows'):o===1?c.wp.has('Crossbows'):(c.wp.has('Slings')||c.wp.has('Thrown')),ok:c=>RANGED.some(w=>c.wp.has(w))},
 {n:'Sidearms',d:'Two weapons from Light Melee, Medium Melee, Slings or Thrown (a Light or Medium bundle), each from a category you are proficient in, with ammunition.',need:'Light Melee, Medium Melee, Slings or Thrown proficiency',ok:c=>['Light Melee','Medium Melee','Slings','Thrown'].some(w=>c.wp.has(w))},
 {n:'Shield',d:'A Large Shield, a hammer, a crowbar and pitons; or a Small Shield and a leather cap (no AC).',need:'Shield proficiency',opts:['Large Shield, hammer, crowbar and pitons','Small Shield and a leather cap (no AC)'],ok:c=>c.shield},
 {n:'Herbalist',d:'A Herbalism Kit and four Type I Poultices.',ok:()=>true},
 {n:'Physician',d:'A Physician’s Bag, two extra bundles of bandages, a splint and two Type I Poultices.',ok:()=>true},
 {n:'Tool',d:'One tool kit worth up to 25 gp.',opts:['Thieves’ Tools','a Crafting kit','a Disguise Kit','a Climber’s Kit'],ok:()=>true},
 {n:'Alchemist',d:'An Alchemist’s Kit and one Common reagent.',need:'Alchemy skill',ok:c=>c.skills.has('Alchemy')},
 {n:'Explorer',d:'15 m of silk rope, a grappling hook, pitons, a hammer, a crowbar, a bag of caltrops, a bag of ball bearings and a steel mirror.',ok:()=>true},
 {n:'Frontier',d:'A hunting trap, fishing tackle, a two-person tent, Winter Clothes, a shovel, a hammer, five extra days of rations and a donkey. The donkey needs feed and carries a light load.',ok:()=>true},
 {n:'Performer',d:'One musical instrument worth up to 35 gp, a hat and a dice set.',ok:()=>true},
 {n:'Court or Scholar',d:'Pick one. Court: Fine Clothes, a signet ring, a vial of perfume and a writing set. Scholar: a blank book and a writing set.',opts:['Court','Scholar'],ok:()=>true}
];
export const ROAD_BLOCK='The Basic Outfit (Adventurer’s Pack, Traveller’s Clothes, boots, cloak, belt pouch, bandages and two torches), a hooded lantern and two flasks of oil, a stick of chalk, a signal whistle, and one Light or Medium Melee weapon or a Sling.';
export function blank(){
 return {v:1,step:0,name:'',concept:'',focus:'',
  species:'',cust:{plus2:'str',plus1:'dex',size:'Medium',nativeLang:''},
  sp:{skType:'skill',skVal:'',vOrigin:'',vGeneral:'',lang:'',craft:'',grade:'',elfGrade:''},
  bg:'',bgp:{},issue:'',survFeat:'',
  scores:{str:'',dex:'',con:'',int:'',wis:'',cha:''},adj:{str:0,dex:0,con:0,int:0,wis:0,cha:0},prim:[],magicAb:'',
  flaws:[],hd:2,hpRoll:'',
  aw:false,streams:[],
  wprof:[],aprof:'None',shield:false,
  feats:[],asiPicks:{},freeO:'',freeG:'',
  skills:[],
  mods:[],modPicks:{},habil:[],
  gearBP:false,roadWeapon:'',roadType:'Light or Medium Melee weapon',blocks:[],blockPicks:{},armourBlock:'',money:'',moneyRolls:[],
  look:'',home:'',loyalty:'',notes:''};
}
const mod=n=>Math.floor((n-10)/2);
export const num=v=>{const n=parseInt(v,10);return isNaN(n)?null:n};
export const HD_SIDES=[4,6,8,10,12];
const MIN_LEVEL1_HP=0;
export function hitDiePool(level,ill){return ill?Math.max(1,level-1):level}
export function attacks(D){
 const rows=[];const prof=2;
 WEAPONS.forEach(w=>{
  const p=D.wpAll.has(w);
  const dex=['Light Melee',...RANGED].includes(w);
  const ab=dex?'dex':'str';
  const atk=D.mod[ab]+(p?prof:0);
  rows.push({w,p,atk,ab,die:WDIE[w]||'',melee:MELEE.includes(w)||w==='Improvised'});
 });
 return rows;
}
export function createSession(choices,gmOverride){
const S=choices;
const GMO=gmOverride;
function hitDieSides(){return HD_SIDES[S.hd]||0}
function hpRollInRange(v){
 if(!/^[1-9]\d*$/.test(v))return false;
 const n=+v;
 return n>=1&&n<=hitDieSides();
}
function hpRollRangeMessage(){return 'Hit point roll must be a whole number from 1 to '+hitDieSides()+'.'}
const bgDef=()=>BG[S.bg]||null;
function issueDef(){const b=bgDef();if(!b||!b.issue)return null;return ISSUES[b.issue].find(i=>i.n===S.issue)||null}
function speciesBonus(){
 const sp=SPECIES[S.species];const o={str:0,dex:0,con:0,int:0,wis:0,cha:0};
 if(!sp)return o;
 if(S.species==='custom'){
  const c=S.cust;
  if(c.plus2)o[c.plus2]+=2;if(c.plus1&&c.plus1!==c.plus2)o[c.plus1]+=1
  if(c.size==='Small'){o.str-=1;o.dex+=1}
  if(c.size==='Large'){o.dex-=1;o[c.largeAb||'str']+=1}
 }else{AB.forEach(a=>o[a]+=sp.asi[a]||0)}
 return o;
}
function flawAsi(){const o={str:0,dex:0,con:0,int:0,wis:0,cha:0};S.flaws.forEach(f=>{const d=FLAWS.find(x=>x.n===f.n);if(d&&d.asi)for(const a in d.asi)o[a]+=d.asi[a]});return o}
function barredPrimaries(){const s=new Set();S.flaws.forEach(f=>{const d=FLAWS.find(x=>x.n===f.n);if(d&&d.bars)d.bars.forEach(a=>s.add(a))});return s}

function grants(){
 const g={skills:new Map(),weapons:new Map(),armour:'None',shield:false,langs:['Common'],expert:new Set(),feats:new Map(),notes:[],aggregate:false,problems:[]};
 const addSkill=(n,src)=>{if(!n)return;if(g.skills.has(n))g.problems.push(n);else g.skills.set(n,src)};
 const addW=(n,src)=>{if(!n)return;if(g.weapons.has(n))g.problems.push(n+' (weapon)');else g.weapons.set(n,src)};
 const armRank=a=>ARMOUR_GRADES.indexOf(a||'None');
 const addA=a=>{if(armRank(a)>armRank(g.armour))g.armour=a};
 const sp=SPECIES[S.species];
 if(sp){
  g.langs.push(S.species==='human'?(S.sp.lang||'(extra language)'):S.species==='custom'?(S.cust.nativeLang||'(native tongue)'):({dwarf:'Dwarvish',elf:'Elvish',halfling:'Halfling',gnome:'Gnomish'})[S.species]);
  if(S.species!=='custom'){
   if(S.sp.skType==='skill'&&S.sp.skVal){addSkill(S.sp.skVal,'S')}
   else if(S.sp.skType==='weapon'&&S.sp.skVal){addW(S.sp.skVal,'S')}
  }
  if(S.species==='dwarf'){g.shield=true;if(S.sp.grade)addW(S.sp.grade,'S');addSkill('Academia: Geology','S');if(S.sp.craft)addSkill('Crafting: '+S.sp.craft,'S')}
  if(S.species==='elf'){addSkill('Perception','S');addW('Bows','S');if(S.sp.elfGrade)addW(S.sp.elfGrade,'S')}
  if(S.species==='gnome'){addSkill('Academia: Arcane','S');if(S.sp.craft)addSkill('Crafting: '+S.sp.craft,'S')}
 }
 const b=bgDef();
 if(b){
  (b.fixed||[]).forEach(f=>{if(f.startsWith('S:'))addSkill(f.slice(2),'B');else if(f.startsWith('AC:'))addSkill('Academia: '+f.slice(3),'B')});
  if(b.aggregate)g.aggregate=true;
  b.slots.forEach((slot,i)=>{
   const p=S.bgp[i]||{};
   let oi=slot.length===1?0:(p.o==null?-1:p.o);
   if(oi<0||oi>=slot.length)return;
   const code=slot[oi];
   if(code.startsWith('S:'))addSkill(code.slice(2),'B');
   else if(code.startsWith('W:'))addW(code.slice(2),'B');
   else if(code==='W')addW(p.v,'B');
   else if(code==='WW'){addW(p.v,'B');addW(p.v2,'B')}
   else if(code==='A')addA(p.v);
   else if(code==='L'){if(p.v)g.langs.push(p.v)}
   else if(code==='C'){if(p.v)addSkill('Crafting: '+p.v,'B')}
   else if(code==='AC'){if(p.v)addSkill('Academia: '+p.v,'B')}
   else if(code==='ANYS')addSkill(p.v,'B');
   else if(code==='EXP'){if(p.v){addSkill(p.v,'B');g.expert.add(p.v)}}
  });
  if(b.survFeat&&S.survFeat)g.feats.set(S.survFeat,'B');
 }
 const is=issueDef();
 if(is){addA(is.a);if(is.shield)g.shield=true}
 return g;
}
function spVers(){
 if(!S.species)return {o:false,g:false};
 return {o:true,g:S.species==='human'};
}
function derive(){
 const D={};
 D.g=grants();
 const sb=speciesBonus(),fa=flawAsi();
 D.sb=sb;
 D.pre={};D.final={};D.mod={};
 AB.forEach(a=>{const b=num(S.scores[a]);D.hasScore=D.hasScore||b!=null;D.pre[a]=(b==null?0:b)+sb[a]+fa[a]+(S.adj[a]||0)});
 D.allScores=AB.every(a=>num(S.scores[a])!=null);
 const featNames=[...S.feats];
 if(S.freeO)featNames.push(S.freeO);if(S.freeG)featNames.push(S.freeG);
 D.featNames=[...new Set([...featNames,...D.g.feats.keys(),...(S.aw?['Awakened']:[])])];
 D.featGrants=[];
 featNames.forEach(n=>{const d=FEAT_BY[n];if(!d)return;let grant=d.grantsSkill;if(d.skillPick){const chosen=S.asiPicks[n];if(chosen&&d.skillPick.includes(chosen))grant=chosen}if(grant&&!D.g.skills.has(grant))D.g.skills.set(grant,'E')});
 if(featNames.includes('Ink Stained')&&S.asiPicks.InkAcad){const k='Academia: '+S.asiPicks.InkAcad.trim();if(!D.g.skills.has(k))D.g.skills.set(k,'E')}
 if(featNames.includes('Street Fighter')&&!D.g.weapons.has('Improvised'))D.g.weapons.set('Improvised','E');
 const fx={str:0,dex:0,con:0,int:0,wis:0,cha:0};let magicBonus=0,hpBonus=0,speedBonus=0;
 D.src={str:[],dex:[],con:[],int:[],wis:[],cha:[]};
 AB.forEach(a=>{if(sb[a])D.src[a].push(['species',sb[a]]);if(fa[a])D.src[a].push(['Flaw',fa[a]]);if(S.adj[a])D.src[a].push(['GM',S.adj[a]])});
 const applyAsi=(def,pickKey,picks)=>{
  const nm=def.n.replace(' (Tier 1)','');
  if(def.asi)for(const a in def.asi){fx[a]+=def.asi[a];D.src[a].push([nm,def.asi[a]])}
  if(def.pick){const p=picks[pickKey];if(p&&def.pick.includes(p)){fx[p]+=1;D.src[p].push([nm,1])}}
 };
 featNames.forEach(n=>{const d=FEAT_BY[n];if(!d)return;applyAsi(d,n,S.asiPicks);if(d.magicAsi)magicBonus+=d.magicAsi;if(d.hp)hpBonus+=d.hp;if(d.speed)speedBonus+=d.speed});
 D.g.feats.forEach((_,n)=>{if(!featNames.includes(n)){const d=FEAT_BY[n];if(d){applyAsi(d,n,S.asiPicks);if(d.hp)hpBonus+=d.hp}}});
 S.mods.forEach(n=>{const d=MOD_BY[n];if(d)applyAsi(d,'m:'+n,S.modPicks)});
 S.habil.forEach(n=>{const d=HABIL.find(h=>h.n===n);if(d)applyAsi(d,'h:'+n,{})});
 const ma=S.magicAb;
 AB.forEach(a=>{
  let v=D.pre[a]+fx[a]+(a===ma&&S.aw?magicBonus:0);
  const cap=(a===ma&&S.aw&&featNames.includes('Mind Over Matter'))?21:20;
  if(a===ma&&S.aw&&magicBonus)D.src[a].push(['magic feats',magicBonus]);
  D.cap=D.cap||{};D.cap[a]=cap;
  D.capped=D.capped||{};D.capped[a]=v>cap;
  v=Math.min(cap,v);
  if(a==='cha'&&featNames.includes('I Don’t Give a Rat’s Ass')){const drop=FEAT_BY['I Don’t Give a Rat’s Ass'].asi.cha;const before=v-drop;const next=Math.max(Math.min(before,6),before+drop);v=Math.min(cap,next);const applied=next-before;const i=D.src.cha.findIndex(s=>s[0]==='I Don’t Give a Rat’s Ass');if(i>=0){if(applied===0)D.src.cha.splice(i,1);else D.src.cha[i][1]=applied}}
  D.final[a]=v;D.mod[a]=mod(v);
 });
 D.fx=fx;D.hpBonus=hpBonus;D.speedBonus=speedBonus;
 D.strPre=D.pre.str;
 const owned=new Set(D.g.skills.keys());S.skills.forEach(s=>owned.add(s));
 const wp=new Set([...D.g.weapons.keys(),...S.wprof]);
 if(S.feats.includes('Street Fighter'))wp.add('Improvised');
 D.ctx={sc:D.pre,prim:new Set(S.prim),aw:S.aw,skills:owned,wp,feats:new Set(D.featNames),flaws:new Set(S.flaws.map(f=>f.n)),
        crafts:[...owned].filter(s=>s.startsWith('Crafting:')).length,shield:S.shield||D.g.shield};
 D.skillsAll=owned;D.wpAll=wp;
 const rank=a=>ARMOUR_GRADES.indexOf(a);
 D.armourProf=rank(S.aprof)>rank(D.g.armour)?S.aprof:D.g.armour;
 D.armourPaid=rank(S.aprof)>rank(D.g.armour);
 D.shieldProf=D.g.shield||S.shield;
 D.shieldPaid=S.shield&&!D.g.shield;
 D.freeSkillN=Math.max(2,4+D.mod.int);
 const picked=S.skills.filter(s=>!D.g.skills.has(s));
 D.skillSrc=new Map();
 D.g.skills.forEach((v,k)=>D.skillSrc.set(k,v));
 picked.forEach((s,i)=>D.skillSrc.set(s,i<D.freeSkillN?'F':'P'));
 D.skillsPaid=Math.max(0,picked.length-D.freeSkillN);
 D.skillsFreeLeft=Math.max(0,D.freeSkillN-picked.length);
 const L={inc:[],exp:[]};
 L.inc.push(['Starting',8]);
 if(S.species==='custom'){L.inc.push(['Custom Humanoid bonus (restricted)',2]);const sz=SIZE_BP[S.cust.size]||0;if(sz)L.inc.push(['Size: '+S.cust.size,sz])}
 S.flaws.forEach(f=>L.inc.push(['Flaw: '+f.n,f.bp]));
 const hdStep=S.hd-2;
 if(hdStep<0)L.inc.push(['Hit Die steps down',-hdStep]);
 if(hdStep>0)L.exp.push(['Hit Die steps up',hdStep]);
 if(S.aw)L.exp.push(['Awakened',2]);
 if(D.skillsPaid)L.exp.push(['Extra skills ('+D.skillsPaid+')',D.skillsPaid]);
 const wpPaid=S.wprof.filter(w=>!D.g.weapons.has(w)).length;
 D.wpPaid=wpPaid;
 if(wpPaid)L.exp.push(['Weapon proficiencies ('+wpPaid+')',wpPaid]);
 if(D.armourPaid)L.exp.push(['Armour proficiency ('+S.aprof+')',1]);
 if(D.shieldPaid)L.exp.push(['Shield proficiency',1]);
 let fo=0,fg=0;
 S.feats.forEach(n=>{
  if(n===S.freeO||n===S.freeG)return;
  if(D.g.feats.has(n))return;
  fo++;
 });
 D.featPaid=fo;
 S.feats.forEach(n=>{
  if(n===S.freeO||n===S.freeG||D.g.feats.has(n))return;
  L.exp.push(['Feat: '+n,1]);
 });
 let restricted=0;
 S.mods.forEach(n=>{const d=MOD_BY[n];if(d){L.exp.push(['Body mod: '+n.replace(' (Tier 1)',''),d.bp]);restricted+=d.bp}});
 S.habil.forEach(n=>{
  const d=HABIL.find(x=>x.n===n);if(!d)return;
  let c=d.bp;if(n==='Natural Weaponry'&&S.blockPicks['NW6'])c+=1;
  L.exp.push(['Humanoid Ability: '+n,c]);restricted+=c;
 });
 if(S.gearBP)L.exp.push(['Extra gear blocks',1]);
 D.restricted=S.species==='custom'?restricted:0;
 D.restrictedLeft=S.species==='custom'?Math.max(0,2-restricted):0;
 D.inc=L.inc.reduce((a,x)=>a+x[1],0);
 D.exp=L.exp.reduce((a,x)=>a+x[1],0);
 D.remain=D.inc-D.exp;D.ledger=L;
 const b=bgDef();D.tier=b?b.tier:0;
 D.blocks=b?TIER_INFO[b.tier].blocks+(S.gearBP?2:0):0;
 D.blocksUsed=S.blocks.length+(S.armourBlock&&S.armourBlock!=='None'?1:0);
 D.magicMod=ma?D.mod[ma]:0;
 D.startStreams=S.aw?Math.max(1,Math.floor(D.magicMod/2)):0;
 if(S.aw&&ma){
  let mp=Math.floor(D.final[ma]/2)+D.magicMod*1;
  if(S.species==='elf'||S.species==='gnome')mp+=1;
  if(S.bg==='Street Mage')mp+=3;
  D.mp=Math.max(0,mp);
 }
 const hdSides=hitDieSides();D.hdSides=hdSides;
 const rollText=S.hpRoll==null?'':String(S.hpRoll);
 const roll=hpRollInRange(rollText)?+rollText:null;
 const raw=roll==null?null:roll+D.mod.con+D.hpBonus;
 D.hp=raw==null?null:Math.max(MIN_LEVEL1_HP,raw);
 const arm=[];
 const is=issueDef();
 if(is&&is.a!=='None')arm.push({g:is.a,src:'Issue'});
 if(S.armourBlock&&S.armourBlock!=='None')arm.push({g:S.armourBlock,src:'Block'});
 D.armours=arm;
 const taken=S.habil.map(n=>HABIL.find(h=>h.n===n)).filter(Boolean);
 const ignore=new Set();
 taken.forEach(h=>{if(h.ac&&h.ac.ignore)h.ac.ignore.forEach(g=>ignore.add(g))});
 const worn=arm.filter(x=>!ignore.has(x.g));
 const profRank=ARMOUR_GRADES.indexOf(D.armourProf);
 const overGrade=g=>ARMOUR_GRADES.indexOf(g)>profRank;
 const wornOver=worn.some(x=>overGrade(x.g));
 const ac=[
  ...worn.map(x=>{const st=ARMOUR_STATS[x.g];const over=overGrade(x.g);const dex=over?Math.min(D.mod.dex,0):(st.dexcap===0?0:Math.min(D.mod.dex,st.dexcap));return {ac:10+dex+st.ac,src:x.g+' armour'}}),
  ...taken.filter(h=>h.ac&&!(h.ac.unarmoured&&worn.length)).map(h=>({ac:h.ac.base+(h.ac.dex?D.mod.dex:0),src:h.n})),
  ...(wornOver?[]:[{ac:10+D.mod.dex,src:'Unarmoured'}])];
 const best=ac.reduce((b,c)=>c.ac>b.ac?c:b);
 D.armourPenalty=wornOver;
 D.armourPenaltyNote=D.armourPenalty?'Armour worn without proficiency: no Dex bonus to AC, speed -2, +1 Exhaustion level per day worn, armour magic abilities can\'t be activated (L2088).':'';
 const shields=[is&&is.shield, S.blocks.includes('Shield')&&(S.blockPicks.Shield===1?'Small':'Large')].filter(Boolean);
 const shield=shields.reduce((b,g)=>!b||SHIELD_STATS[g].ac>SHIELD_STATS[b].ac?g:b,'');
 D.shieldBonus=shield?SHIELD_STATS[shield].ac:0;
 D.shieldName=shield?shield+' Shield':'';
 D.ac=best.ac+D.shieldBonus;
 D.acArmour=best.src;
 let sp=SPECIES[S.species]?(S.species==='custom'?SIZE_SPEED[S.cust.size]:SPECIES[S.species].speed):0;
 sp+=speedBonus;
 if(S.flaws.some(f=>f.n==='Short-Winded'))sp-=2;
 if(shield&&D.allScores&&D.final.str<SHIELD_STATS[shield].str)sp-=2;
 if(D.armourPenalty)sp-=2;
 D.speed=sp;
 const level=1;
 D.pool=hitDiePool(level,S.flaws.some(f=>f.n==='Chronically Ill'));
 D.hdpool=D.pool;
 D.hasBlockHeavy=false;
 return D;
}
function featStatus(f,D){
 if(GMO)return {ok:true,why:''};
 if(f.req&&!f.req(D.ctx))return {ok:false,why:'Needs: '+f.needs};
 return {ok:true,why:''};
}
function checks(D){
 const out=[];const add=(st,msg)=>out.push({st,msg});
 add(S.species?'ok':'fail','Species chosen.');
 add(S.bg?'ok':'fail','Background chosen.');
 const b=bgDef();
 if(b){
  let bad=false;
  b.slots.forEach((slot,i)=>{
   const p=S.bgp[i]||{};
   const oi=slot.length===1?0:(p.o==null?-1:p.o);
   if(oi<0){bad=true;return}
   const code=slot[oi];
   if(['W','A','L','C','AC','ANYS','EXP'].includes(code)&&!p.v)bad=true;
   if(code==='WW'&&(!p.v||!p.v2))bad=true;
  });
  if(b.issue&&!S.issue)bad=true;
  if(b.survFeat&&!S.survFeat)bad=true;
  add(bad?'fail':'ok','Every free Background pick is made.');
  if(b.needsAw)add(S.aw?'ok':'fail',S.bg+' needs the Awakened feat.');
  if(b.needsLit)add(S.flaws.some(f=>f.n==='Illiterate')?'fail':'ok','Intellectual needs literacy (no Illiterate Flaw).');
 }
 const sp=S.sp;let spbad=false;
 if(S.species&&S.species!=='custom'&&!sp.skVal)spbad=true;
 if(S.species==='dwarf'&&(!sp.grade||!sp.craft))spbad=true;
 if(S.species==='elf'&&!sp.elfGrade)spbad=true;
 if(S.species==='gnome'&&!sp.craft)spbad=true;
 add(spbad?'fail':'ok','Species free picks are made (Skilful and species training).');
 const v=spVers();
 if(v.o)add(S.freeO?'ok':'warn','Versatile free Origin feat chosen.');
 if(v.g)add(S.freeG?'ok':'warn','Human free General feat chosen.');
 add(D.allScores?'ok':'fail','All six ability scores entered.');
 AB.forEach(a=>{if(D.final[a]>20&&!(a===S.magicAb&&D.featNames.includes('Mind Over Matter')))add('fail',ABN[a]+' is above 20.')});
 add(S.prim.length===2?'ok':'fail','Two Primary Abilities chosen.');
 const barred=barredPrimaries();
 if(S.prim.some(a=>barred.has(a)))add('fail','A Flaw bars one of your Primary Abilities.');
 if(S.aw){
  add(S.magicAb?'ok':'fail','Magic ability chosen.');
  if(S.magicAb){
   add(S.prim.includes(S.magicAb)?'ok':'fail','Magic ability is a Primary Ability.');
   add(D.pre[S.magicAb]>=13?'ok':'fail','Magic ability is 13 or higher after species bonuses.');
   add(S.streams.length===D.startStreams?'ok':'fail','Starting streams chosen ('+S.streams.length+' of '+D.startStreams+').');
  }
 }
 let preBad=[];
 [...S.feats,S.freeO,S.freeG].filter(Boolean).forEach(n=>{const f=FEAT_BY[n];if(f&&f.req&&!f.req(D.ctx))preBad.push(n)});
 add(preBad.length?'fail':'ok',preBad.length?'Prerequisites not met: '+preBad.join(', ')+'.':'Every feat prerequisite is met.');
 const noPick=[...S.feats,S.freeO,S.freeG].filter(Boolean).filter(n=>{const f=FEAT_BY[n];return f&&f.pick&&!(S.asiPicks[n]&&f.pick.includes(S.asiPicks[n]))});
 if(noPick.length)add('fail','Choose which score to raise for: '+noPick.join(', ')+'.');
 const noSkill=[...S.feats,S.freeO,S.freeG].filter(Boolean).filter(n=>{const f=FEAT_BY[n];return f&&f.skillPick&&!(S.asiPicks[n]&&f.skillPick.includes(S.asiPicks[n]))});
 if(noSkill.length)add('fail','Choose a skill for: '+noSkill.join(', ')+'.');
 const noMod=S.mods.filter(n=>{const m=MOD_BY[n];return m&&m.pick&&!(S.modPicks['m:'+n]&&m.pick.includes(S.modPicks['m:'+n]))});
 if(noMod.length)add('fail','Choose which score to raise for: '+noMod.join(', ')+'.');
 AB.forEach(a=>{if(D.capped&&D.capped[a])add('warn',ABN[a]+' hits the cap of '+D.cap[a]+' at creation, so some bonus is wasted.')});
 let sb=[];
 D.wpAll.forEach(w=>{if(WSTR[w]&&D.pre.str<WSTR[w])sb.push(w+' (Str '+WSTR[w]+')')});
 if(ARMOUR_STATS[D.armourProf]&&D.pre.str<ARMOUR_STATS[D.armourProf].str)sb.push(D.armourProf+' armour (Str '+ARMOUR_STATS[D.armourProf].str+')');
 add(sb.length?'fail':'ok',sb.length?'Strength requirement not met: '+sb.join(', ')+'.':'Armour and weapon Strength requirements are met.');
 add(D.remain===0?'ok':'fail','BP remaining is zero (now '+D.remain+').');
 if(S.species==='custom')add(D.restrictedLeft===0?'ok':'fail','Custom Humanoid: the extra 2 BP are fully spent on Humanoid Abilities or body mods.');
 if(S.skills.some(s=>D.g.skills.has(s)))add('warn','You picked a skill that is already free from Species or Background. Drop it and use that point elsewhere.');
 if(b){
  add(D.blocksUsed===D.blocks?'ok':'fail','Gear: all '+D.blocks+' blocks spent ('+D.blocksUsed+' used). Unspent blocks are lost.');
 }
 if(D.g.problems.length)add('warn','Species and Background both grant: '+[...new Set(D.g.problems)].join(', ')+'. The second one is wasted, so pick something else if the choice was yours.');
 add(S.loyalty?'ok':'warn','Loyalty filled in.');
 const rollText=S.hpRoll==null?'':String(S.hpRoll);
 if(rollText!==''&&!hpRollInRange(rollText))add('fail',hpRollRangeMessage());
 else add(D.hp!=null?'ok':'warn','Hit points rolled and recorded.');
 const gm=[];
 if(S.species==='custom')gm.push('custom Humanoid');
 if(S.flaws.some(f=>f.n==='Phobia'))gm.push('Phobia');
 if(S.flaws.some(f=>f.n==='Enemy'&&f.bp>=3))gm.push('3 or 4 point Enemy');
 if(S.mods.length)gm.push('body modifications');
 if(gm.length)add('warn','GM approvals to line up: '+gm.join(', ')+'.');
 if(S.flaws.length>1)add('warn','The book recommends one Flaw at creation. Make sure your GM is OK with '+S.flaws.length+'.');
 return out;
}
function skillBonus(n,D){
 let ab;
 if(n.startsWith('Academia'))ab='int';
 else if(n.startsWith('Crafting')){const sp=n.split(':')[1].trim();ab=CRAFT_AB[sp]||'dex'}
 else{ab=SKILL_AB[n];if(ab==='magic')ab=S.magicAb||null}
 if(n==='Athletics'&&D.featNames.includes('Power to Weight Ratio')&&D.final.dex>D.final.str)ab='dex';
 const prof=D.skillSrc.has(n);
 let b=ab?D.mod[ab]:0;
 if(prof)b+=D.g.expert.has(n)?4:2;
 else if(S.bg==='Prodigy')b-=2;
 if(S.bg==='Survivor'&&SOCIAL_CHA.includes(n))b-=2;
 if(S.species==='gnome'&&n.startsWith('Crafting')&&S.sp.craft&&n==='Crafting: '+S.sp.craft)b+=2;
 return {b,ab,prof};
}
return {derive,checks,skillBonus,featStatus,hitDieSides,hpRollInRange,hpRollRangeMessage,bgDef,issueDef,speciesBonus,flawAsi,barredPrimaries,grants,spVers};
}
