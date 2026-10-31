/* Daily Fuel - food database (approximate values, per the serving shown).
   kcal and protein (g) are estimates from standard nutrition tables; brands, recipes
   and restaurants vary, so check labels when you can. */
(function () {
  const f = (id, cat, name, unit, kcal, p) => ({ id, cat, name, unit, kcal, p });

  const FOODS = [
    // ---- Protein
    f('chicken_breast', 'Protein', 'Grilled chicken breast', '100 g cooked', 165, 31),
    f('chicken_thigh', 'Protein', 'Grilled chicken thigh, skinless', '100 g cooked', 209, 26),
    f('tawook', 'Protein', 'Chicken tawook / tikka', '100 g cooked', 175, 27),
    f('bbq_drumstick', 'Protein', 'BBQ chicken drumstick', '1 medium (~75 g meat)', 140, 19),
    f('fish', 'Protein', 'Grilled fish (hammour / kingfish)', '100 g cooked', 130, 24),
    f('shrimp', 'Protein', 'Grilled shrimp', '100 g cooked', 110, 22),
    f('tuna', 'Protein', 'Tuna in water', '1 small can (~100 g)', 115, 25),
    f('lean_meat', 'Protein', 'Grilled lean beef / lamb / kofta', '100 g cooked', 250, 26),

    // ---- Eggs & dairy
    f('egg', 'Eggs & dairy', 'Boiled egg', '1 large', 78, 6),
    f('omelet', 'Eggs & dairy', 'Vegetable omelet (2 eggs)', '1 serving', 190, 13),
    f('shakshuka', 'Eggs & dairy', 'Shakshuka (3 eggs)', '1 serving', 300, 19),
    f('greek_yogurt', 'Eggs & dairy', 'Greek yogurt, plain low-fat', '3/4 cup (170 g)', 125, 17),
    f('cottage', 'Eggs & dairy', 'Cottage cheese', '1/2 cup (113 g)', 90, 12),
    f('labneh', 'Eggs & dairy', 'Labneh', '1/2 cup (~100 g)', 150, 6),
    f('white_cheese', 'Eggs & dairy', 'White cheese (feta / akawi)', '30 g', 80, 5),
    f('milk', 'Eggs & dairy', 'Low-fat milk', '1 glass (240 ml)', 105, 8),
    f('laban', 'Eggs & dairy', 'Laban / ayran', '1 cup (240 ml)', 95, 7),
    f('whey', 'Eggs & dairy', 'Whey protein powder', '1 scoop (30 g)', 120, 24),
    f('whey_shake', 'Eggs & dairy', 'Whey shake with low-fat milk', '1 shake (scoop + 150 ml milk)', 185, 29),

    // ---- Soups & legumes
    f('lentil_soup', 'Soups & legumes', 'Lentil soup', '1 bowl (250 ml)', 150, 9),
    f('chicken_soup', 'Soups & legumes', 'Chicken & vegetable soup', '1 bowl (250 ml)', 110, 9),
    f('ful', 'Soups & legumes', 'Ful medames', '1/2 cup (130 g)', 130, 7),
    f('chickpeas', 'Soups & legumes', 'Chickpeas, cooked', '1/2 cup (82 g)', 135, 7),
    f('white_beans', 'Soups & legumes', 'White beans, cooked', '1/2 cup (90 g)', 125, 8),
    f('lentils', 'Soups & legumes', 'Lentils, cooked', '1/2 cup (100 g)', 115, 9),
    f('hummus', 'Soups & legumes', 'Hummus', '2 tbsp (30 g)', 55, 2.5),

    // ---- Carbs
    f('rice', 'Carbs', 'Basmati rice, cooked', '1/2 cup (80 g)', 105, 2),
    f('brown_rice', 'Carbs', 'Brown rice, cooked', '1/2 cup (80 g)', 110, 2.5),
    f('khubz', 'Carbs', 'Flatbread (khubz / tanoor)', '1 small piece (45 g)', 120, 4),
    f('toast', 'Carbs', 'Whole-wheat toast', '1 slice', 80, 4),
    f('wrap', 'Carbs', 'Whole-wheat wrap, small', '1 wrap', 140, 5),
    f('oats', 'Carbs', 'Rolled oats', '2 tbsp (20 g)', 75, 2.5),
    f('potato', 'Carbs', 'Boiled potato', '1 small (100 g)', 87, 2),

    // ---- Fruit & veg
    f('banana', 'Fruit & veg', 'Banana', '1 medium', 105, 1),
    f('berries', 'Fruit & veg', 'Berries', '1/2 cup', 40, 0.5),
    f('apple', 'Fruit & veg', 'Apple', '1 medium', 95, 0.5),
    f('orange', 'Fruit & veg', 'Orange', '1 medium', 62, 1),
    f('dates', 'Fruit & veg', 'Dates', '2 medium', 60, 0.5),
    f('green_salad', 'Fruit & veg', 'Green salad with lemon', '1 cup (70 g)', 20, 1),
    f('fattoush', 'Fruit & veg', 'Fattoush with fried pita', '1 small plate', 200, 4),
    f('veg_grilled', 'Fruit & veg', 'Grilled or steamed vegetables', '1 cup', 60, 2.5),
    f('cucumber_tomato', 'Fruit & veg', 'Cucumber & tomato salad', '1 cup', 35, 1.5),
    f('spinach', 'Fruit & veg', 'Cooked spinach', '1/2 cup', 21, 3),
    f('avocado', 'Fruit & veg', 'Avocado', '1/2 fruit', 160, 2),

    // ---- Fats & extras
    f('olive_oil', 'Fats & extras', 'Olive oil', '1 tsp', 40, 0),
    f('almonds', 'Fats & extras', 'Almonds', '10 nuts (14 g)', 80, 3),
    f('chia', 'Fats & extras', 'Chia seeds', '1 tbsp (12 g)', 58, 2),
    f('sugar', 'Fats & extras', 'Sugar', '1 tsp', 16, 0),

    // ---- Meals & wraps (restaurant portions vary a lot)
    f('shawarma_wrap', 'Meals & wraps', 'Chicken shawarma wrap', '1 regular wrap', 480, 28),
    f('tuna_wrap', 'Meals & wraps', 'Tuna wrap', '1 wrap', 300, 24),
    f('biryani', 'Meals & wraps', 'Chicken biryani / machboos', '1 small plate (250 g)', 400, 22),
    f('chicken_salad', 'Meals & wraps', 'Grilled chicken salad', '1 bowl (150 g chicken)', 330, 40),

    // ---- Drinks
    f('coffee', 'Drinks', 'Black coffee / Americano', '1 cup', 5, 0),
    f('latte', 'Drinks', 'Latte, regular milk', '1 cup (350 ml)', 150, 8),
    f('tea_milk', 'Drinks', 'Tea with milk, no sugar', '1 cup', 40, 2),
    f('juice', 'Drinks', 'Fresh fruit juice', '1 glass (240 ml)', 110, 1)
  ];

  // Suggested starter day: roughly 1,600 kcal and 135 g protein, six small mini-meals.
  const MEALS = [
    { id: 'm1', name: 'Breakfast', time: '07:30', hint: 'Yogurt, oats and berries' },
    { id: 'm2', name: 'Mid-morning', time: '10:30', hint: 'Eggs and a few nuts' },
    { id: 'm3', name: 'Lunch', time: '13:30', hint: 'Grilled chicken or fish, rice, vegetables' },
    { id: 'm4', name: 'Afternoon', time: '16:30', hint: 'Whey shake' },
    { id: 'm5', name: 'Dinner', time: '19:00', hint: 'Soup, egg and salad' },
    { id: 'm6', name: 'Evening', time: '20:30', hint: 'Cottage cheese' }
  ];

  const TEMPLATE = [
    ['m1', 'greek_yogurt', 1], ['m1', 'berries', 1], ['m1', 'oats', 1],
    ['m2', 'egg', 2], ['m2', 'almonds', 1], ['m2', 'khubz', 0.5],
    ['m3', 'chicken_breast', 1], ['m3', 'rice', 1], ['m3', 'veg_grilled', 1], ['m3', 'olive_oil', 1],
    ['m4', 'whey_shake', 1],
    ['m5', 'lentil_soup', 1], ['m5', 'egg', 1], ['m5', 'green_salad', 1], ['m5', 'olive_oil', 1], ['m5', 'khubz', 0.5],
    ['m6', 'cottage', 1], ['m6', 'almonds', 1]
  ];

  // Quick protein boosters offered when the day is short on protein.
  const BOOSTERS = ['whey_shake', 'tuna', 'greek_yogurt', 'cottage', 'tawook'];

  window.DF_DATA = { FOODS, MEALS, TEMPLATE, BOOSTERS };
})();
