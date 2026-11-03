# The Rising Sun Inn menu, November 2026, from the owner's list.
# Each drink: name, sizes [(label, pence)], abv (None = leave blank), description,
# allergens, flags (things for the owner to check). Category-level defaults below.

G = "Cereals containing gluten"
S = "Sulphites"
M = "Milk"

HALF_PINT = lambda half, pint: [("Half pint", half), ("Pint", pint)]
SPIRIT = [("Single 25ml", 300), ("Double 50ml", 560)]
SMALL_LARGE = [("Small glass", 300), ("Large glass", 560)]
HOUSE_WINE = [("175ml glass", 520), ("250ml glass", 680), ("Bottle", 1975)]
SOFT = lambda a, b: [("16oz", a), ("20oz", b)]

# category name, defaults, drinks
MENU = []

def cat(name, drinks, alcohol=True, no_ice=False, groups=(), note=None):
    MENU.append(dict(name=name, alcohol=alcohol, no_ice=no_ice, groups=list(groups), note=note, drinks=drinks))

def d(name, sizes, abv, desc, allergens=(), flags=(), welsh=False, groups=None, alcohol=None, no_ice=None):
    return dict(name=name, sizes=sizes, abv=abv, desc=desc, allergens=list(allergens), flags=list(flags),
                welsh=welsh, groups=groups, alcohol=alcohol, no_ice=no_ice)

cat("Draught Lager", [
    d("Cruzcampo", HALF_PINT(270, 540), 4.4, "Crisp, easy-drinking Spanish lager from Seville with a light malt sweetness.", [G]),
    d("Birra Moretti", HALF_PINT(270, 540), 4.6, "Classic Italian lager with a balanced bitterness and gentle hoppy aroma.", [G]),
    d("Heineken", HALF_PINT(275, 550), 5.0, "Crisp, refreshing Dutch lager with subtle fruity notes and a clean finish.", [G],
      ["ABV: Heineken's UK draught strength has changed over the years; check the font or pump clip."]),
    d("Amstel", HALF_PINT(260, 520), 4.1, "Smooth, full-flavoured Dutch lager with a light, rounded taste.", [G]),
    d("Hawkstone Premium Lager", HALF_PINT(275, 550), 4.8, "Crisp, full-flavoured lager brewed in the Cotswolds, with a clean, refreshing finish.", [G],
      ["ABV not certain: check the pump clip."]),
])

cat("Draught Beer", [
    d("John Smith's", HALF_PINT(260, 520), 3.6, "Smooth Yorkshire bitter with a creamy head and a mellow, malty taste.", [G],
      ["ABV: 3.6% is John Smith's Extra Smooth; Original is 3.8%. Check which you pour."]),
    d("Neck Oil", HALF_PINT(275, 550), 4.3, "Beavertown's light, zesty session IPA, full of fresh citrus hop flavour.", [G]),
    d("Hawkstone IPA", HALF_PINT(275, 550), None, "Hoppy Cotswold IPA with tropical fruit and citrus notes and a crisp, bitter finish.", [G],
      ["ABV unknown: please add it from the pump clip."]),
])

cat("Draught Cider", [
    d("Inch's", HALF_PINT(260, 520), 4.5, "Crisp, refreshing apple cider from Herefordshire with a clean, dry finish.", [S]),
    d("Hawkstone Cider", HALF_PINT(275, 550), None, "Crisp, refreshing cider made with English apples, with a balanced sweetness.", [S],
      ["ABV unknown: please add it from the pump clip."]),
], no_ice=False)

cat("Draught Stout", [
    d("Guinness", HALF_PINT(275, 550), 4.2, "The famous Irish stout: smooth and creamy, with roasted malt and a hint of coffee.", [G]),
    d("Hawkstone Stout", HALF_PINT(275, 550), None, "Rich, dark stout with roasted malt, chocolate and coffee notes and a smooth finish.", [G],
      ["ABV unknown: please add it from the pump clip."]),
])

BOTTLE = lambda p: [("Bottle", p)]
cat("Bottled Cider", [
    d("Old Mout Berries & Cherries", BOTTLE(490), 4.0, "Fruity cider bursting with summer berries and cherries. Served over ice.", [S]),
    d("Old Mout Kiwi & Lime", BOTTLE(490), 4.0, "Refreshing cider with zingy kiwi and a squeeze of lime. Served over ice.", [S]),
    d("Thatchers Blood Orange", BOTTLE(490), 4.0, "Crisp apple cider with a burst of zesty blood orange.", [S]),
    d("Thatchers Blackcurrant", BOTTLE(490), 4.0, "Somerset apple cider blended with sweet, tangy blackcurrant.", [S], ["ABV not certain: check the bottle."]),
    d("Thatchers Rosy", BOTTLE(490), 4.0, "Light, refreshing rosé cider made from Somerset apples.", [S], ["ABV not certain: check the bottle."]),
    d("Thatchers Katy", BOTTLE(550), 7.4, "Sparkling single-variety cider made only from Katy apples: fruity and refreshing.", [S]),
    d("Thatchers Rascal", BOTTLE(530), 4.5, "Medium cider from Somerset with a rich, fruity apple taste.", [S]),
], no_ice=False)

cat("Alcohol-Free", [
    d("Old Mout Alcohol Free", BOTTLE(450), 0.0, "All the fruity flavour of Old Mout, without the alcohol.", [S],
      ["Flavour: Old Mout makes several alcohol-free ciders. Which one do you stock?"]),
    d("Heineken 0.0", [("330ml bottle", 300)], 0.0, "Refreshing alcohol-free lager with a light malty body and fruity notes.", [G]),
    d("Thatchers Blood Orange Alcohol Free", BOTTLE(450), 0.0, "Crisp apple cider and zesty blood orange, alcohol-free.", [S]),
], alcohol=False)

WHISKY_GROUP = ["How would you like it?"]
cat("Whisky", [
    d("Jack Daniel's Old No. 7", SPIRIT, 40.0, "The classic Tennessee whiskey: smooth, with caramel, vanilla and toasted oak."),
    d("Jack Daniel's Tennessee Fire", SPIRIT, 35.0, "Jack Daniel's blended with a warming red-hot cinnamon liqueur."),
    d("Jack Daniel's Bonded", SPIRIT, 50.0, "Bottled-in-bond Tennessee whiskey: bold and rich, with deep oak, caramel and spice."),
    d("Jack Daniel's Winter Jack", SPIRIT, 15.0, "A seasonal blend of Jack Daniel's, apple cider liqueur and winter spices. Lovely warm.",
      flags=["Winter Jack is a 15% liqueur. Should it go under Liqueurs instead?"]),
    d("Jack Daniel's Tennessee Apple", SPIRIT, 35.0, "Jack Daniel's with crisp green apple liqueur. Great with lemonade or ginger."),
    d("Jack Daniel's Tennessee Blackberry", SPIRIT, 35.0, "Jack Daniel's blended with a juicy blackberry liqueur."),
    d("Jack Daniel's McLaren Edition", SPIRIT, None, "Limited-edition Jack Daniel's released with the McLaren Formula 1 team.",
      flags=["ABV unknown: please add it from the bottle."]),
    d("Gentleman Jack", SPIRIT, 40.0, "Double charcoal-mellowed Tennessee whiskey: exceptionally smooth, with fruit and vanilla."),
    d("Jura Winter Edition", SPIRIT, None, "Seasonal single malt from the Isle of Jura, with rich, warming winter spice.",
      flags=["ABV unknown: please add it from the bottle."]),
    d("Jura 14 Year Old American Rye Cask", SPIRIT, 40.0, "Island single malt finished in rye whiskey casks: spicy, with toffee and ripe fruit."),
    d("Jura 10 Year Old", SPIRIT, 40.0, "Smooth island single malt with notes of honey, vanilla and a gentle hint of smoke."),
    d("Jura Bourbon Cask", SPIRIT, None, "Island single malt matured in American oak bourbon casks: sweet vanilla and toffee.",
      flags=["ABV unknown: please add it from the bottle."]),
    d("Jura Journey", SPIRIT, 40.0, "Easy-going island single malt with sweet vanilla, citrus and a touch of smoke."),
    d("Jura Pale Ale Cask Edition", SPIRIT, 40.0, "Island single malt finished in pale ale casks: fresh citrus, malt and spice.",
      flags=["ABV not certain: check the bottle."]),
    d("Monkey Shoulder Original", SPIRIT, 40.0, "Smooth, mellow blended malt Scotch with vanilla, honey and spice. Made for mixing."),
    d("Cardhu Gold Reserve", SPIRIT, 40.0, "Speyside single malt: rich and sweet, with honey, pear and toffee."),
    d("The Singleton Malt Master's Selection", SPIRIT, 40.0, "Smooth, approachable single malt with notes of dark fruit, toffee and chocolate."),
    d("Aber Falls Sherry Cask", SPIRIT, None, "Welsh single malt from Abergwyngregyn, finished in sherry casks: rich dried fruit and spice.",
      welsh=True, flags=["ABV unknown: please add it from the bottle."]),
    d("Paddy Irish Whiskey", SPIRIT, 40.0, "Smooth, easy-drinking blended Irish whiskey with a mellow, slightly sweet taste."),
    d("The Sexton Single Malt Irish Whiskey", SPIRIT, 40.0, "Irish single malt aged in sherry casks: rich, with dried fruit, honey and spice."),
    d("Penderyn Madeira Finish", SPIRIT, 46.0, "Single malt Welsh whisky from the Brecon Beacons, finished in Madeira casks: rich and fruity.",
      welsh=True),
    d("Penderyn Celt", SPIRIT, 41.0, "Lightly peated Welsh single malt with a fresh, gently smoky character.", welsh=True),
    d("Dalwhinnie Winter's Gold", SPIRIT, 43.0, "Highland single malt with honey, vanilla and a gentle spiced sweetness. Lovely chilled."),
    d("Ardbeg Ten", SPIRIT, 46.0, "Bold, smoky Islay single malt: peaty, with sweet citrus and chocolate notes."),
    d("Haig Club Clubman", SPIRIT, 40.0, "Light, smooth single grain Scotch with sweet vanilla and toffee. Great with a mixer."),
    d("Haig Club Clubman Bourbon Cask", SPIRIT, 40.0, "Single grain Scotch from bourbon casks: soft vanilla and caramel.",
      flags=["Product not recognised: please check the name and ABV on the bottle."]),
    d("Laphroaig Oak Select", SPIRIT, 40.0, "Islay single malt with Laphroaig's peaty smoke softened by sweet oak and vanilla."),
], groups=["Add a mixer"] + WHISKY_GROUP, note="Single £3.00 · Double £5.60")

cat("Gin", [
    d("Tanqueray London Dry Gin", SPIRIT, 41.3, "Classic London dry gin with bold juniper, coriander and a crisp, clean finish."),
    d("Crabbie's 1891 Old Tom Gin", SPIRIT, None, "Slightly sweeter Old Tom style gin with juniper and warm spice.",
      flags=["ABV unknown: please add it from the bottle."]),
    d("Limehouse Rhubarb & Ginger Gin", SPIRIT, None, "Fruity pink gin with tart rhubarb and a warming ginger kick.",
      flags=["ABV unknown: please add it from the bottle."]),
    d("Gordon's Premium Pink Gin", SPIRIT, 37.5, "Gordon's gin with raspberry, strawberry and redcurrant. Lovely with lemonade or tonic."),
    d("Gordon's Mediterranean Orange Gin", SPIRIT, 37.5, "Gordon's gin with sun-ripened Mediterranean oranges."),
    d("Gordon's Sicilian Lemon Gin", SPIRIT, 37.5, "Gordon's gin with zesty Sicilian lemons. Bright and refreshing."),
    d("Gordon's Mulled Gin", SPIRIT, None, "Seasonal Gordon's with warming mulled spices and dark fruit.",
      flags=["ABV unknown: please add it from the bottle."]),
    d("Gordon's Berry Gin", SPIRIT, None, "Gordon's gin with juicy mixed berries.",
      flags=["Product and ABV: please check the exact name and ABV on the bottle."]),
    d("Bombay Sapphire London Dry Gin", SPIRIT, 40.0, "Light, aromatic London dry gin made with 10 vapour-infused botanicals."),
], groups=["Add a mixer"])

cat("Vodka", [
    d("Smirnoff No. 21 Vodka", SPIRIT, 37.5, "Triple-distilled, smooth and clean. The world's favourite vodka."),
    d("Smirnoff Spicy Tamarind", SPIRIT, None, "Smirnoff with tangy tamarind and a chilli kick.",
      flags=["ABV unknown: please add it from the bottle."]),
    d("Absolut Original Vodka", SPIRIT, 40.0, "Swedish vodka, rich and full-bodied with a hint of dried fruit."),
], groups=["Add a mixer"])

cat("Rum & Tequila", [
    d("Malibu Original", SPIRIT, 21.0, "Caribbean rum with coconut flavour: sweet, smooth and summery."),
    d("Captain Morgan Original Spiced Gold", SPIRIT, 35.0, "Smooth spiced rum with vanilla, caramel and warm spice. Perfect with cola."),
    d("Captain Morgan Dark Rum", SPIRIT, 40.0, "Rich, full-bodied dark rum with notes of molasses and spice."),
    d("Jose Cuervo Especial Silver", SPIRIT, 38.0, "Smooth silver tequila with agave, citrus and a hint of pepper."),
], groups=["Add a mixer"])

cat("Liqueurs", [
    d("Archers Peach Schnapps", SPIRIT, 18.0, "Sweet, fruity peach schnapps. A classic with lemonade."),
    d("Disaronno Velvet", SPIRIT, 17.0, "Creamy liqueur with Disaronno's signature amaretto taste.", [M]),
    d("Cointreau", SPIRIT, 40.0, "French orange liqueur made with sweet and bitter orange peel."),
    d("Jägermeister Original", SPIRIT, 35.0, "German herbal liqueur with 56 botanicals. Best served ice cold."),
    d("Jägermeister Orange", SPIRIT, 33.0, "Jägermeister's herbal recipe with a twist of bitter orange."),
    d("Drambuie", SPIRIT, 40.0, "Scotch whisky liqueur with heather honey, herbs and spice."),
    d("Grand Marnier Cordon Rouge", SPIRIT, 40.0, "Cognac and bitter orange liqueur: rich, smooth and warming."),
    d("Fireball Cinnamon Whisky Liqueur", SPIRIT, 33.0, "Whisky liqueur with a fiery red-hot cinnamon kick."),
    d("Southern Comfort Original", SPIRIT, 35.0, "Fruity, spiced whiskey liqueur from New Orleans. Great with lemonade or cola."),
    d("Sourz Apple", SPIRIT, 15.0, "Sweet and sour green apple liqueur."),
    d("Aperol", SPIRIT, 11.0, "Italian orange aperitif with a bittersweet taste. The base of an Aperol Spritz."),
], groups=["Add a mixer"])

cat("Brandy, Port & Sherry", [
    d("Courvoisier VS Cognac", SPIRIT, 40.0, "Smooth cognac with notes of fresh fruit, spring flowers and oak.", groups=["Add a mixer"]),
    d("Harveys Bristol Cream Sherry", SMALL_LARGE, 17.5, "Rich, smooth cream sherry with dried fruit and nutty notes.", [S],
      ["Price: small and large glasses at the single and double prices (£3.00 / £5.60). Tell me if they should differ."]),
    d("Taylor's Late Bottled Vintage Port 2018", SMALL_LARGE, 20.0, "Rich, full-bodied port with blackberry, cherry and chocolate notes.", [S],
      ["Price: small and large glasses at the single and double prices (£3.00 / £5.60). Tell me if they should differ."]),
])

cat("House Wine", [
    d("Pinot Grigio", HOUSE_WINE, None, "House white. Light and crisp, with fresh pear and citrus.", [S]),
    d("Sauvignon Blanc", HOUSE_WINE, None, "House white. Zesty and refreshing, with gooseberry and citrus.", [S]),
    d("Chardonnay", HOUSE_WINE, None, "House white. Smooth and rounded, with ripe peach and melon.", [S]),
    d("Rosé", HOUSE_WINE, None, "House rosé. Light and fruity, with red berry flavours.", [S]),
    d("Blush", HOUSE_WINE, None, "House rosé. Soft and gently sweet, with strawberry notes.", [S]),
    d("Zinfandel", HOUSE_WINE, None, "House rosé. Juicy and sweet, with raspberry and strawberry.", [S]),
    d("Shiraz", HOUSE_WINE, None, "House red. Rich and spicy, with dark berry fruit.", [S]),
    d("Merlot", HOUSE_WINE, None, "House red. Soft and smooth, with plum and cherry.", [S]),
    d("Malbec", HOUSE_WINE, None, "House red. Full and juicy, with blackberry and a hint of spice.", [S]),
], note="175ml £5.20 · 250ml £6.80 · Bottle £19.75")

def wine(name, pence, origin, diet, desc, flags=()):
    full = f"{origin} · {diet}. {desc}"
    return d(name, [("Bottle", pence)], None, full, [S], list(flags) + (
        [] if diet == "Vegan" else ["Vegetarian wines can be fined with egg or milk. Add those allergens if the supplier says so."]))

cat("White Wine", [
    wine("Frunza Pinot Grigio Feteasca Alba", 2025, "Banat, Romania", "Vegetarian",
         "A refreshing blend with fresh pear, citrus and white peach and subtle floral aromas. Crisp acidity and a clean, lightly textured finish."),
    wine("Rue Des Amis Sauvignon Blanc", 2150, "South West France", "Vegan",
         "A lively, zesty Sauvignon Blanc with mouth-watering freshness. Tropical orchard fruits and citrus notes create a confident, refreshing wine."),
    wine("AUS Estate Chardonnay, De Bortoli", 2400, "New South Wales, Australia", "Vegan",
         "A soft, lightly oaked Chardonnay from family producers De Bortoli. Ripe peach and vanilla oak lead to a creamy palate of stone fruits and a long, smooth finish."),
    wine("Seafarer Sauvignon Blanc", 2950, "Marlborough, New Zealand", "Vegan",
         "Vibrant and refreshing, with lime, grapefruit, passion fruit and gooseberry. Crisp and lively: excellent with seafood and salads."),
    wine("Cuvee Prestige Picpoul de Pinet", 3300, "Languedoc, France", "Vegetarian",
         "A dry white with a delicate pale-gold colour. Fresh fruity and floral aromas lead to a refreshing palate with subtle citrus notes."),
], note="Specialist wines · by the bottle")

cat("Rosé Wine", [
    wine("Soprano Pinot Grigio Rosé", 2025, "Lombardia, Italy", "Vegetarian",
         "A fresh, fruity rosé with inviting summer fruit aromas. Strawberry flavours and refreshing acidity create a light, enjoyable wine."),
    wine("Terrazzo Zinfandel Rosé", 1925, "California, USA", "Vegan",
         "A juicy, approachable rosé for warm summer days or cooler evenings. Raspberry, strawberry and sweet melon make it deliciously fruity."),
    wine("Villanelle Cinsault Rosé", 2275, "Languedoc, France", "Vegan",
         "An elegant, vibrant rosé with red berries, rose petals and a touch of citrus. Light-bodied with crisp acidity and a smooth, refreshing finish."),
], note="Specialist wines · by the bottle")

cat("Red Wine", [
    wine("San Elian Merlot", 2175, "Central Valley, Chile", "Vegan",
         "A smooth, medium-bodied Merlot with aromas of black cherries. Juicy red and black fruit and soft tannins give an approachable finish."),
    wine("De Bortoli AUS Estate Shiraz", 2450, "New South Wales, Australia", "Vegan",
         "A fresh, fruity Shiraz from family producers De Bortoli. Juicy berry flavours, gentle spice and soft tannins. Medium-bodied, generous and smooth."),
    wine("Oscuro Mendoza Malbec", 2125, "Mendoza, Argentina", "Vegan",
         "A rich, juicy Malbec with plum and blackberry and subtle chocolate and vanilla from oak ageing. Elegant and smooth with a long finish."),
    wine("Showdown Cabernet Sauvignon", 3175, "California, USA", "Vegan",
         "Ripe blackcurrant and wild berry aromas with sweet vanilla oak. Cassis and black cherry lead to a soft, juicy, long-lasting finish."),
    wine("Milhojas Crianza, Rioja", 2775, "Rioja, Spain", "Vegan",
         "Full-bodied yet smooth, made with 75% Tempranillo and 25% Garnacha. Vanilla spice and baked red fruit: approachable, and lovely on its own."),
], note="Specialist wines · by the bottle")

cat("Prosecco & Champagne", [
    wine("Botter Spumante Prosecco", 2400, "Veneto, Italy", "Vegan",
         "A lively, refreshing Prosecco with delicate fruity notes, sherbet-like freshness and a soft, creamy finish."),
    wine("Baron De Villeboerg Brut Champagne", 6850, "Champagne, France", "Vegan",
         "An elegant Champagne from Ville-sur-Arce in southern Champagne. Blossom and yellow fruit aromas, fine balance, pear notes and a long finish."),
], note="By the bottle")

cat("Soft Drinks", [
    d("Lemonade", SOFT(260, 300), None, "Crisp, sparkling lemonade."),
    d("Pepsi", SOFT(260, 300), None, "Ice-cold Pepsi cola."),
    d("Pepsi Max", SOFT(260, 300), None, "Maximum taste, no sugar."),
    d("Soda & Lime", SOFT(200, 240), None, "Soda water with a splash of lime cordial."),
    d("Soda & Blackcurrant", SOFT(200, 240), None, "Soda water with a splash of blackcurrant cordial."),
], alcohol=False, no_ice=True)

cat("Cans, Juices & Mixers", [
    d("Coca-Cola", [("330ml can", 200)], None, "The original. Served with ice and a glass.", no_ice=True),
    d("Diet Coke", [("330ml can", 200)], None, "Great Coke taste, no sugar. Served with ice and a glass.", no_ice=True),
    d("Coke Zero", [("330ml can", 200)], None, "Real Coca-Cola taste, zero sugar. Served with ice and a glass.", no_ice=True),
    d("J2O Orange & Passion Fruit", [("275ml bottle", 240)], None, "Orange and passion fruit juice drink, lightly sparkling.", no_ice=True),
    d("J2O Mango & Apple", [("275ml bottle", 240)], None, "Mango and apple juice drink, lightly sparkling.", no_ice=True),
    d("J2O Apple & Blackcurrant", [("275ml bottle", 240)], None, "Apple and blackcurrant juice drink, lightly sparkling.", no_ice=True),
    d("Appletiser", [("275ml bottle", 220)], None, "Sparkling 100% apple juice.", no_ice=True),
    d("Water", [("500ml bottle", 120)], None, "Still bottled water.", no_ice=True),
    d("Slimline Britvic Tonic", [("200ml bottle", 240)], None, "Low-calorie Indian tonic water.", no_ice=True),
    d("Fever-Tree Low Calorie Tonic", [("200ml bottle", 280)], None, "Fever-Tree's refreshingly light Indian tonic, with fewer calories.",
      no_ice=True, flags=["Name: your list says 'Low Calorie Fever-Tree'. I've called it 'Fever-Tree Low Calorie Tonic'."]),
    d("Britvic Orange", [("200ml bottle", 240)], None, "Orange juice drink. A classic mixer.", no_ice=True),
    d("Chocolate Milkshake", [("Bottle", 250)], None, "Rich, creamy chocolate milkshake.", [M],
      flags=["Size: bottle, carton or made at the bar? I've put 'Bottle'."]),
    d("Strawberry Milkshake", [("Bottle", 250)], None, "Creamy strawberry milkshake.", [M]),
    d("Vanilla Milkshake", [("Bottle", 250)], None, "Smooth, creamy vanilla milkshake.", [M]),
    d("Fruit Shoot Orange & Blackcurrant", [("Bottle", 120)], None, "Kids' fruit drink, no added sugar."),
], alcohol=False)

# Spirits' "Add a mixer" list: (label, extra pence, drink it follows). PROPOSED prices.
MIXERS = [
    ("No mixer", 0, None),
    ("Lemonade", 60, "Lemonade"),
    ("Pepsi", 60, "Pepsi"),
    ("Pepsi Max", 60, "Pepsi Max"),
    ("Coca-Cola", 180, "Coca-Cola"),
    ("Diet Coke", 180, "Diet Coke"),
    ("Coke Zero", 180, "Coke Zero"),
    ("Slimline Britvic Tonic", 200, "Slimline Britvic Tonic"),
    ("Fever-Tree Low Calorie Tonic", 240, "Fever-Tree Low Calorie Tonic"),
    ("Britvic Orange", 200, "Britvic Orange"),
]

# Owner's decision (Nov 2026): no ABVs on the menu. Clear them, and drop or
# reword the checks that were only about ABV.
_REWORD = {
    "Name and ABV: Old Mout's mango cider is usually 'Mango & Passion Fruit' at 4%. Check the bottle.":
        "Name: Old Mout's mango cider is usually 'Mango & Passion Fruit'. Check the bottle.",
    "Name and ABV: Old Mout's is usually 'Strawberry & Apple' at 4%. Check the bottle.":
        "Name: Old Mout's is usually 'Strawberry & Apple'. Check the bottle.",
    "Winter Jack is a 15% liqueur. Should it go under Liqueurs instead?":
        "Winter Jack is a liqueur. Should it go under Liqueurs instead?",
    "Product not recognised: please check the name and ABV on the bottle.":
        "Product not recognised: please check the name on the bottle.",
    "Product and ABV: please check the exact name and ABV on the bottle.":
        "Product: please check the exact name on the bottle.",
}
for _c in MENU:
    for _x in _c["drinks"]:
        _x["abv"] = None
        _x["flags"] = [_REWORD.get(f, f) for f in _x["flags"] if _REWORD.get(f) or "ABV" not in f]
