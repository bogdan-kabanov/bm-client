// ТОЛЬКО логика расчета статистики, БЕЗ работы с БД напрямую!
import type { UserWinLossConfig, UserWinLossStats } from '../model/types';

/**
 * Обновляет статистику Win/Loss после завершения сделки
 * @param config - конфигурация Win/Loss
 * @param stats - текущая статистика
 * @param tradeId - ID завершенной сделки
 * @param outcome - исход сделки ('win' | 'loss')
 * @returns обновленные статистика и конфигурация (если нужно)
 */
export function updateWinLossStats(
  config: UserWinLossConfig,
  stats: UserWinLossStats,
  tradeId: number,
  outcome: 'win' | 'loss'
): { 
  updatedStats: UserWinLossStats; 
  updatedConfig?: UserWinLossConfig 
} {
  if (config.active_variant === 1) {
    return updateVariant1Stats(config, stats, tradeId, outcome);
  } else if (config.active_variant === 2) {
    return updateVariant2Stats(config, stats, tradeId, outcome);
  }

  return { updatedStats: stats };
}

/**
 * Обновляет статистику для Варианта 1
 */
function updateVariant1Stats(
  config: UserWinLossConfig,
  stats: UserWinLossStats,
  tradeId: number,
  outcome: 'win' | 'loss'
): { updatedStats: UserWinLossStats } {
  const updatedVariant1Stats = { ...stats.variant1 };
  const windowTrades = [...updatedVariant1Stats.window_trades];
  
  // Добавляем новую сделку
  windowTrades.push({ 
    trade_id: tradeId, 
    outcome, 
    timestamp: Date.now() 
  });

  // Если окно заполнено, удаляем старые сделки
  if (windowTrades.length > config.variant1.window_size) {
    windowTrades.shift();
  }

  updatedVariant1Stats.window_trades = windowTrades;
  updatedVariant1Stats.window_win_count = windowTrades.filter(t => t.outcome === 'win').length;
  updatedVariant1Stats.window_loss_count = windowTrades.filter(t => t.outcome === 'loss').length;
  updatedVariant1Stats.total_wins += (outcome === 'win' ? 1 : 0);
  updatedVariant1Stats.total_losses += (outcome === 'loss' ? 1 : 0);
  updatedVariant1Stats.last_updated = new Date().toISOString();

  return {
    updatedStats: {
      ...stats,
      variant1: updatedVariant1Stats,
      total_wins: stats.total_wins + (outcome === 'win' ? 1 : 0),
      total_losses: stats.total_losses + (outcome === 'loss' ? 1 : 0),
      last_updated: new Date().toISOString(),
    }
  };
}

/**
 * Обновляет статистику для Варианта 2 (прогрессивная система)
 */
function updateVariant2Stats(
  config: UserWinLossConfig,
  stats: UserWinLossStats,
  tradeId: number,
  outcome: 'win' | 'loss'
): { 
  updatedStats: UserWinLossStats; 
  updatedConfig: UserWinLossConfig 
} {
  const updatedVariant2Stats = { ...stats.variant2 };
  const updatedVariant2Config = { ...config.variant2 };
  const updatedConfig = { ...config, variant2: updatedVariant2Config };

  if (outcome === 'win') {
    // Выиграл - увеличиваем счетчик подряд выигрышей и снижаем процент
    updatedVariant2Stats.consecutive_wins += 1;
    updatedVariant2Config.current_percent = Math.max(
      config.variant2.min_percent,
      config.variant2.current_percent - config.variant2.step_percent
    );
    updatedVariant2Stats.total_wins += 1;
  } else {
    // Проиграл - сбрасываем счетчик подряд выигрышей и откатываем процент к стартовому
    updatedVariant2Stats.consecutive_wins = 0;
    updatedVariant2Config.current_percent = config.variant2.start_percent;
    updatedVariant2Stats.total_losses += 1;
  }

  updatedVariant2Stats.last_updated = new Date().toISOString();

  return {
    updatedStats: {
      ...stats,
      variant2: updatedVariant2Stats,
      total_wins: stats.total_wins + (outcome === 'win' ? 1 : 0),
      total_losses: stats.total_losses + (outcome === 'loss' ? 1 : 0),
      last_updated: new Date().toISOString(),
    },
    updatedConfig
  };
}

