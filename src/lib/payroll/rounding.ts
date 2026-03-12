export const roundingV1 = {
  version: "rounding_v1",
  /**
   * Arrondit un montant à 2 décimales (centimes).
   * Utilise Math.round (arrondi au plus proche) plutôt que toFixed (banker's rounding).
   * Lève une erreur si la valeur est NaN ou infinie — cela indique un bug calcul amont.
   */
  money(value: number) {
    if (!isFinite(value)) {
      throw new Error(`rounding_invalid_value: ${value}`);
    }
    return Math.round(value * 100) / 100;
  },
};
