/**
 * Определяет количество знаков после запятой для форматирования цены
 * в зависимости от величины цены
 * 
 * @param price - цена для форматирования
 * @returns количество знаков после запятой
 */
export function getPriceDecimals(price: number): number {
  if (!Number.isFinite(price) || price <= 0) {
    return 2; // Значение по умолчанию
  }

  // Для очень мелких валют (< 0.01) показываем 6-8 знаков
  if (price < 0.01) {
    return 8;
  }
  
  // Для мелких валют (< 0.1) показываем 8 знаков для максимальной точности
  if (price < 0.1) {
    return 8;
  }
  
  // Для небольших валют (< 1) показываем 6 знаков для видимости изменений
  if (price < 1) {
    return 6;
  }
  
  // Для средних валют (< 100) показываем 3 знака
  if (price < 100) {
    return 3;
  }
  
  // Для крупных валют (>= 100) показываем 2 знака
  return 2;
}

/**
 * Форматирует цену с автоматическим определением количества знаков после запятой
 * 
 * @param price - цена для форматирования
 * @param prefix - префикс (например, '$')
 * @returns отформатированная строка цены
 */
export function formatPrice(price: number, prefix: string = '$'): string {
  if (!Number.isFinite(price)) {
    return `${prefix}--`;
  }
  
  const decimals = getPriceDecimals(price);
  return `${prefix}${price.toFixed(decimals)}`;
}

/**
 * Форматирует цену для оси Y графика
 * Использует текущую цену или диапазон цен для определения точности
 * 
 * @param value - значение для форматирования
 * @param currentPrice - текущая цена (опционально, для более точного определения)
 * @returns отформатированная строка цены
 */
export function formatPriceForAxis(value: number, currentPrice?: number): string {
  // Используем текущую цену или само значение для определения точности
  const referencePrice = currentPrice !== undefined && Number.isFinite(currentPrice) 
    ? currentPrice 
    : value;
  
  const decimals = getPriceDecimals(referencePrice);
  return '$' + Number(value).toFixed(decimals);
}

