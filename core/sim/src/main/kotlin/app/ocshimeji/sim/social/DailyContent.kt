package app.ocshimeji.sim.social

/**
 * 2.1.0: the built-in daily events, as data in the one content format (`Content`). Adding one = adding an entry here;
 * `ContentTest` checks every entry with `Content.problems`. (Kept in a Kotlin string so it is inside the APK without a resource step.)
 */
object DailyContent {
    val JSON = """
[
 {
  "id": "sunset",
  "name": "一起看夕陽",
  "category": "daily",
  "hours": [
   17,
   19
  ],
  "script": "A:{對方}，你看，夕陽。@LOOK / B:好漂亮……@LOOK / A:每天都看得到，可是每天都不一樣。#sparkle",
  "like": 3,
  "when": {
   "furniture": [
    "window"
   ]
  }
 },
 {
  "id": "lost",
  "name": "找東西",
  "category": "daily",
  "hours": [
   8,
   21
  ],
  "script": "A:我的{物}不見了…… / B:我幫你找！@LOOK / B:是不是這個？在沙發下面。 / A:找到了！謝謝你！@HAPPY#heart",
  "like": 3
 },
 {
  "id": "sofadoze",
  "name": "靠在沙發上一起打瞌睡",
  "category": "daily",
  "hours": [
   13,
   17
  ],
  "script": "A:……（打哈欠）@SIT / B:……（打哈欠）@SIT / A:（頭慢慢歪到{對方}肩上）zzz@LIE / B:……（沒有推開）zzz@LIE#heart",
  "like": 3,
  "fun": 4.0,
  "when": {
   "a": {
    "needBelow": {
     "ENERGY": 55
    }
   },
   "b": {
    "needBelow": {
     "ENERGY": 55
    }
   }
  }
 },
 {
  "id": "hair",
  "name": "互相整理頭髮",
  "category": "daily",
  "hours": [
   6,
   10
  ],
  "script": "A:你頭髮翹起來了。 / B:你的也是。 / A:那我們互相整理一下。@PRIMP / B:好了，很可愛。#sparkle",
  "like": 2
 },
 {
  "id": "arm",
  "name": "比腕力",
  "category": "daily",
  "hours": [
   10,
   20
  ],
  "script": "A:來比腕力！@SWING / B:好啊！ / A:嗚嗚嗚嗚……！@ANGRY#fire / B:……我要用力了喔。#shock",
  "like": 1,
  "fun": 16.0,
  "when": {
   "a": {
    "axisMin": {
     "ACTIVE": 0.2
    }
   }
  }
 },
 {
  "id": "hanky",
  "name": "遞手帕",
  "category": "daily",
  "hours": [
   0,
   24
  ],
  "script": "B:（偷偷擦眼淚）@SAD / A:……給你。（遞出手帕） / B:……謝謝。#heart",
  "like": 4,
  "fun": 2.0,
  "closeup": true,
  "when": {
   "b": {
    "moodMax": -2
   }
  }
 },
 {
  "id": "headpat",
  "name": "摸頭安慰",
  "category": "daily",
  "hours": [
   0,
   24
  ],
  "script": "B:今天好糟喔……@SAD#gloom / A:（摸摸{對方}的頭）辛苦了。 / B:……嗯。（好一點了）",
  "like": 3,
  "fun": 2.0,
  "when": {
   "b": {
    "moodMax": -2
   }
  }
 },
 {
  "id": "caught",
  "name": "偷吃冰箱被抓包",
  "category": "daily",
  "hours": [
   21,
   3
  ],
  "script": "A:（打開冰箱，拿出布丁）@EAT / B:……你在做什麼？ / A:沒、沒有！我在……檢查冰箱有沒有壞！#sweat / B:那順便幫我也檢查一個。#heart",
  "like": 2,
  "fun": 16.0,
  "when": {
   "a": {
    "likesFood": true
   }
  }
 },
 {
  "id": "bathqueue",
  "name": "早上搶浴室",
  "category": "daily",
  "hours": [
   6,
   9
  ],
  "script": "A:（敲門）還沒好嗎？ / B:再五分鐘！ / A:你五分鐘前也這樣說！@ANGRY#anger / B:好啦好啦，出來了！#sweat",
  "like": 0,
  "fun": 6.0,
  "when": {
   "furnitureCount": {
    "tub": 1
   },
   "minPeople": 3
  }
 },
 {
  "id": "tvcry",
  "name": "看電視看到哭",
  "category": "daily",
  "hours": [
   19,
   23
  ],
  "script": "A:（看電視）……嗚……@WATCH / B:你在哭嗎？ / A:才沒有……是眼睛在流汗……@SAD#gloom / B:……給你衛生紙。#heart",
  "like": 2,
  "when": {
   "a": {
    "cryMin": 0.2
   }
  }
 },
 {
  "id": "overheard",
  "name": "背後說好話",
  "category": "daily",
  "hours": [
   9,
   21
  ],
  "script": "A:跟你說，{第三人}其實人很好。 / B:我也這麼覺得。 / A:（沒發現{第三人}就在旁邊聽到了）#sparkle",
  "like": 2,
  "when": {
   "minPeople": 3
  }
 },
 {
  "id": "morningrun",
  "name": "拉對方晨練",
  "category": "daily",
  "hours": [
   6,
   9
  ],
  "script": "A:早安！一起去做體操！@SWING / B:……現在？ / A:一、二、三、四！@SWING / B:（跟著動了一下）……其實還不錯。#sparkle",
  "like": 2,
  "fun": 12.0,
  "when": {
   "a": {
    "axisMin": {
     "ACTIVE": 0.2
    }
   }
  }
 },
 {
  "id": "stars",
  "name": "看星星",
  "category": "daily",
  "hours": [
   21,
   24
  ],
  "script": "A:今晚的星星好多。@LOOK / B:那顆最亮的，好像在對我們眨眼。@LOOK / A:我們來許個願吧。#sparkle",
  "like": 3,
  "when": {
   "furniture": [
    "window"
   ]
  }
 },
 {
  "id": "teatime",
  "name": "下午茶",
  "category": "daily",
  "hours": [
   15,
   17
  ],
  "script": "A:下午茶時間到！@HAPPY / B:有什麼點心？ / A:只有茶。 / B:……那也很好。@EAT#heart",
  "like": 2
 },
 {
  "id": "ghoststory",
  "name": "講鬼故事",
  "category": "daily",
  "hours": [
   21,
   2
  ],
  "script": "A:我講一個鬼故事……走廊盡頭有一扇門…… / B:不、不要講了……@SHY#sweat / A:門打開，裡面是……一盒布丁。 / B:……什麼啦！#anger",
  "like": 1,
  "fun": 16.0
 },
 {
  "id": "firsttalk",
  "name": "第一次好好聊天",
  "category": "daily",
  "hours": [
   9,
   21
  ],
  "script": "A:我們好像還沒好好聊過。 / B:對耶……你平常喜歡做什麼？ / A:我喜歡{物}。 / B:真的嗎！我也有點興趣。#sparkle",
  "like": 4,
  "closeup": true,
  "when": {
   "rel": {
    "maxFamiliar": 24
   }
  }
 },
 {
  "id": "secret",
  "name": "交換秘密",
  "category": "daily",
  "hours": [
   20,
   24
  ],
  "script": "A:跟你說一個秘密，你不能說出去喔。@SHY / B:嗯，我發誓。 / A:……其實我會怕打雷。 / B:那下次打雷，我陪你。#heart",
  "like": 4,
  "closeup": true,
  "when": {
   "rel": {
    "minStage": 3
   }
  }
 },
 {
  "id": "cookhelp",
  "name": "一起做飯",
  "category": "daily",
  "hours": [
   11,
   19
  ],
  "script": "A:我要煮飯了，來幫忙！@TIDY / B:我負責切菜！@TIDY / A:那個是……糖，不是鹽。#sweat / B:……甜的咖哩也不錯吧？",
  "like": 2,
  "fun": 12.0
 },
 {
  "id": "plantname",
  "name": "幫盆栽取名字",
  "category": "daily",
  "hours": [
   8,
   18
  ],
  "script": "A:這盆植物還沒有名字耶。@WATER / B:叫它「小綠」？ / A:太普通了。叫它「葉之騎士」。 / B:……好，葉之騎士。#sparkle",
  "like": 2,
  "fun": 12.0,
  "when": {
   "furniture": [
    "plant"
   ]
  }
 },
 {
  "id": "misread",
  "name": "誤會劇場：最愛的點心",
  "category": "daily",
  "hours": [
   12,
   20
  ],
  "script": "A:（從門口看到{對方}和{第三人}在分我最愛的布丁）……@SHY#shock / A:你們……居然不等我！@ANGRY#anger / B:咦？這是特地幫你留的那一半啦！@HAPPY / A:……原來如此。對不起，我想太多了。#heart",
  "like": 3,
  "closeup": true,
  "when": {
   "minPeople": 3
  }
 },
 {
  "id": "mishear",
  "name": "誤會劇場：聽錯了",
  "category": "daily",
  "hours": [
   9,
   21
  ],
  "script": "A:{對方}說要「搬走」？！@SHY#shock / B:我是說要把沙發「搬走」一點點，打掃後面。 / A:……嚇死我了。@HAPPY#sweat / B:你以為我要搬家喔？#sparkle",
  "like": 3
 },
 {
  "id": "misgift",
  "name": "誤會劇場：神秘的禮物",
  "category": "daily",
  "hours": [
   9,
   21
  ],
  "script": "A:桌上有一個禮物……是{對方}送的嗎？@SHY#heart / B:不是我耶……是{第三人}吧？ / A:咦？那我剛剛對你道謝道了三次……@SHY#sweat / B:沒關係，你的謝謝我收下了。#sparkle",
  "like": 2,
  "when": {
   "minPeople": 3
  }
 },
 {
  "id": "birthday",
  "name": "幫壽星慶生",
  "category": "daily",
  "hours": [
   8,
   22
  ],
  "script": "A:{對方}，生日快樂！@HAPPY#sparkle / B:你記得！ / A:當然記得。來，許個願吧。 / B:（閉上眼睛）……許好了。#heart",
  "like": 5,
  "fun": 12.0,
  "closeup": true,
  "when": {
   "b": {
    "hasMood": [
     "birthday"
    ]
   }
  }
 }
]
"""
    val ALL: List<ContentEvent> by lazy { Content.parse(JSON) }
}
