// Хук для работы с Win/Loss конфигурацией
import { useState, useEffect, useCallback } from 'react';
import { winLossApi, type UserWinLossConfig, type UserWinLossStats } from '@src/shared/api';
import { switchVariant, validateVariantConfig } from '@src/entities/winloss/lib/variantSwitcher';

export function useWinLossConfig(userId: number | null) {
  const [config, setConfig] = useState<UserWinLossConfig | null>(null);
  const [stats, setStats] = useState<UserWinLossStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await winLossApi.getConfig(userId);
      if (response.success && response.data) {
        setConfig(response.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Ошибка загрузки конфигурации');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadStats = useCallback(async () => {
    if (!userId) return;
    
    try {
      setError(null);
      const response = await winLossApi.getStats(userId);
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Ошибка загрузки статистики';

      if (err?.message?.includes('UNAUTHORIZED') || err?.message?.includes('SESSION_EXPIRED')) {
        setError(errorMessage);
      }
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadConfig();
      loadStats();
    }
  }, [userId, loadConfig, loadStats]);

  const saveConfig = useCallback(async (newConfig: Partial<UserWinLossConfig>) => {
    if (!userId) return false;

    try {
      setLoading(true);
      setError(null);

      // Валидация
      const updatedConfig = { ...config!, ...newConfig };
      const validation = validateVariantConfig(updatedConfig as UserWinLossConfig);
      if (!validation.valid) {
        setError(validation.error || 'Ошибка валидации');
        return false;
      }

      const response = config?.id
        ? await winLossApi.updateConfig(userId, newConfig)
        : await winLossApi.createConfig(userId, newConfig);

      if (response.success && response.data) {
        setConfig(response.data);
        return true;
      }
      return false;
    } catch (err: any) {
      setError(err?.message || 'Ошибка сохранения конфигурации');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId, config]);

  const changeVariant = useCallback(async (newVariant: 1 | 2 | null) => {
    if (!config) return false;

    const updatedConfig = switchVariant(config, newVariant);
    return await saveConfig(updatedConfig);
  }, [config, saveConfig]);

  const resetStats = useCallback(async () => {
    if (!userId) return false;

    try {
      setError(null);
      const response = await winLossApi.resetStats(userId);
      if (response.success) {
        await loadStats();
        return true;
      }
      return false;
    } catch (err: any) {
      setError(err?.message || 'Ошибка сброса статистики');
      return false;
    }
  }, [userId, loadStats]);

  return {
    config,
    stats,
    loading,
    error,
    loadConfig,
    loadStats,
    saveConfig,
    changeVariant,
    resetStats,
  };
}

