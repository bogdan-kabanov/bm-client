// ТОЛЬКО бизнес-логика определения требуемого исхода, БЕЗ работы с БД напрямую!
import type { UserWinLossConfig, UserWinLossStats } from '../model/types';

/**
 * Определяет требуемый исход (win/loss) для сделки на основе конфигурации и статистики
 * @param config - конфигурация Win/Loss пользователя
 * @param stats - статистика Win/Loss пользователя
 * @returns 'win' | 'loss' | null (null если система не активна)
 */
export function determineRequiredOutcome(
  config: UserWinLossConfig,
  stats: UserWinLossStats
): 'win' | 'loss' | null {
  // Проверка: система должна быть включена и должен быть выбран вариант
  if (!config.enabled || !config.active_variant) {
    return null;
  }

  // ВАЖНО: проверяем, что активен только один вариант
  if (config.active_variant === 1 && !config.variant1.enabled) {

    return null;
  }
  if (config.active_variant === 2 && !config.variant2.enabled) {

    return null;
  }

  if (config.active_variant === 1) {
    return determineVariant1Outcome(config.variant1, stats.variant1);
  } else if (config.active_variant === 2) {
    return determineVariant2Outcome(config.variant2);
  }

  return null;
}

/**
 * Определяет требуемый исход для Варианта 1 (процент выигрыша от N сделок)
 */
function determineVariant1Outcome(
  variantConfig: UserWinLossConfig['variant1'],
  variantStats: UserWinLossStats['variant1']
): 'win' | 'loss' {
  const windowTrades = variantStats.window_trades || [];
  const requiredWins = Math.ceil(
    variantConfig.window_size * variantConfig.winrate_percent / 100
  );
  const currentWins = windowTrades.filter(t => t.outcome === 'win').length;
  const currentLosses = windowTrades.filter(t => t.outcome === 'loss').length;

  // Если не достигнут требуемый процент выигрышей - нужно выиграть
  if (currentWins < requiredWins) {
    return 'win';
  }

  // Если достигнут требуемый процент, но окно не заполнено - можно проиграть
  if (currentLosses < (variantConfig.window_size - requiredWins)) {
    return 'loss';
  }

  // Окно заполнено - начинаем новое окно
  // Если текущий процент выигрышей меньше требуемого - нужно выиграть
  return currentWins < requiredWins ? 'win' : 'loss';
}

/**
 * Определяет требуемый исход для Варианта 2 (прогрессивная система)
 */
function determineVariant2Outcome(
  variantConfig: UserWinLossConfig['variant2']
): 'win' | 'loss' {
  const currentPercent = variantConfig.current_percent;
  // Вероятность выигрыша = currentPercent%
  const random = Math.random() * 100;
  return random < currentPercent ? 'win' : 'loss';
}

