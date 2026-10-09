// Pixel Toys price formula:
//   cost  = grams × (price per kg ÷ 1000) + hours × rate per hour
//   price = cost + profit % of cost + electricity % of cost, rounded to the nearest R5
window.pixelPrice = function (grams, hours, s) {
  var plastic = (Number(grams) || 0) * (Number(s.price_per_kg) || 0) / 1000;
  var printing = (Number(hours) || 0) * (Number(s.rate_per_hour) || 0);
  var cost = plastic + printing;
  var profit = cost * (Number(s.profit_pct) || 0) / 100;
  var electricity = cost * (Number(s.electricity_pct) || 0) / 100;
  var exact = cost + profit + electricity;
  return { plastic: plastic, printing: printing, cost: cost, profit: profit, electricity: electricity, exact: exact, price: Math.round(exact / 5) * 5 };
};
