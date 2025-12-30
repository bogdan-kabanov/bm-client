// ТОЛЬКО логика переключения вариантов, БЕЗ работы с БД напрямую!
import type { UserWinLossConfig } from '../model/types';

/**
 * Переключает активный вариант Win/Loss системы
 * @param config - текущая конфигурация
 * @param newVariant - новый вариант (1, 2 или null для отключения)
 * @returns обновленная конфигурация
 */
export function switchVariant(
  config: UserWinLossConfig,
  newVariant: 1 | 2 | null
): UserWinLossConfig {
  const updated = {
    ...config,
    variant1: { ...config.variant1 },
    variant2: { ...config.variant2 }
  };

  if (newVariant === 1) {
    updated.active_variant = 1;
    updated.variant1.enabled = true;
    updated.variant2.enabled = false;
    updated.enabled = true;
  } else if (newVariant === 2) {
    updated.active_variant = 2;
    updated.variant2.enabled = true;
    updated.variant1.enabled = false;
    updated.enabled = true;
  } else {
    // Отключить все
    updated.active_variant = null;
    updated.variant1.enabled = false;
    updated.variant2.enabled = false;
    updated.enabled = false;
  }

  return updated;
}

/**
 * Валидирует конфигурацию вариантов
 * @param config - конфигурация для валидации
 * @returns результат валидации
 */
export function validateVariantConfig(
  config: UserWinLossConfig
): { valid: boolean; error?: string } {
  // Проверка, что только один вариант активен
  if (config.active_variant === 1 && !config.variant1.enabled) {
    return { valid: false, error: 'Вариант 1 выбран как активный, но не включен' };
  }
  
  if (config.active_variant === 2 && !config.variant2.enabled) {
    return { valid: false, error: 'Вариант 2 выбран как активный, но не включен' };
  }

  // Проверка варианта 1
  if (config.variant1.enabled) {
    if (config.variant1.winrate_percent < 0 || config.variant1.winrate_percent > 100) {
      return { valid: false, error: 'Процент выигрыша для варианта 1 должен быть от 0 до 100' };
    }
    if (config.variant1.window_size < 1) {
      return { valid: false, error: 'Размер окна для варианта 1 должен быть не менее 1' };
    }
  }

  // Проверка варианта 2
  if (config.variant2.enabled) {
    if (config.variant2.start_percent < 0 || config.variant2.start_percent > 100) {
      return { valid: false, error: 'Стартовый процент для варианта 2 должен быть от 0 до 100' };
    }
    if (config.variant2.min_percent < 0 || config.variant2.min_percent > 100) {
      return { valid: false, error: 'Минимальный процент для варианта 2 должен быть от 0 до 100' };
    }
    if (config.variant2.step_percent < 0) {
      return { valid: false, error: 'Шаг снижения для варианта 2 не может быть отрицательным' };
    }
    if (config.variant2.min_percent > config.variant2.start_percent) {
      return { valid: false, error: 'Минимальный процент не может быть больше стартового' };
    }
  }

  return { valid: true };
}

