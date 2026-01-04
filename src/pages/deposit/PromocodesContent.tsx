import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@src/app/providers/useLanguage';
import { promocodeApi, type PromocodeValidation } from '@src/shared/api/promocode/promocodeApi';
import './PromocodesContent.css';

interface SavedPromocode {
  code: string;
  validatedAt: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  minAmount?: number | null;
  maxDiscount?: number | null;
  description?: string | null;
  name?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  isActive?: boolean;
  isValid: boolean;
  error?: string;
}

const STORAGE_KEY = 'user_promocodes';

export function PromocodesContent() {
  const { t } = useLanguage();
  const [promocodeInput, setPromocodeInput] = useState<string>('');
  const [validating, setValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<PromocodeValidation | null>(null);
  const [savedPromocodes, setSavedPromocodes] = useState<SavedPromocode[]>([]);

  // Загружаем сохраненные промокоды из localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSavedPromocodes(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error('[PromocodesContent] Error loading saved promocodes:', error);
    }
  }, []);

  // Сохраняем промокоды в localStorage
  const savePromocodes = useCallback((promocodes: SavedPromocode[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(promocodes));
      setSavedPromocodes(promocodes);
    } catch (error) {
      console.error('[PromocodesContent] Error saving promocodes:', error);
    }
  }, []);

  // Валидация промокода
  const validatePromocode = useCallback(async (code: string) => {
    if (!code.trim()) {
      setValidationResult({ valid: false, error: t('promocodes.enterCode', { defaultValue: 'Please enter a promocode' }) });
      return;
    }

    setValidating(true);
    setValidationResult(null);

    try {
      // Используем дефолтную сумму 100 для валидации
      const defaultAmount = 100;
      const validation = await promocodeApi.validate(code.trim().toUpperCase(), defaultAmount);
      setValidationResult(validation);

      if (validation.valid) {
        // Сохраняем промокод
        const newPromocode: SavedPromocode = {
          code: code.trim().toUpperCase(),
          validatedAt: new Date().toISOString(),
          discountType: validation.discountType || (validation.discount ? 'fixed' : 'percentage'),
          discountValue: validation.discountValue || validation.discount,
          minAmount: validation.minAmount,
          isValid: true,
        };

        const existing = savedPromocodes.find(p => p.code === newPromocode.code);
        if (existing) {
          // Обновляем существующий
          const updated = savedPromocodes.map(p =>
            p.code === newPromocode.code ? { ...newPromocode, validatedAt: p.validatedAt } : p
          );
          savePromocodes(updated);
        } else {
          // Добавляем новый
          savePromocodes([...savedPromocodes, newPromocode]);
        }
      }
    } catch (error) {
      console.error('[PromocodesContent] Error validating promocode:', error);
      setValidationResult({
        valid: false,
        error: t('promocodes.validationError', { defaultValue: 'Error validating promocode' })
      });
    } finally {
      setValidating(false);
    }
  }, [savedPromocodes, savePromocodes, t]);

  // Удаление промокода
  const removePromocode = useCallback((code: string) => {
    const updated = savedPromocodes.filter(p => p.code !== code);
    savePromocodes(updated);
  }, [savedPromocodes, savePromocodes]);

  // Обработка отправки формы
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    validatePromocode(promocodeInput);
  }, [promocodeInput, validatePromocode]);

  return (
    <div className="promocodes-content">
      <div className="promocodes-header">
        <h2 className="promocodes-title">{t('promocodes.title', { defaultValue: 'Promocodes' })}</h2>
        <p className="promocodes-description">
          {t('promocodes.description', { defaultValue: 'Add and manage your promocodes. Validate them to see discount information.' })}
        </p>
      </div>

      <div className="promocodes-add-section">
        <h3 className="promocodes-section-title">
          {t('promocodes.addPromocode', { defaultValue: 'Add Promocode' })}
        </h3>
        <form onSubmit={handleSubmit} className="promocodes-form">
          <div className="promocodes-form-row">
            <div className="promocodes-form-field">
              <label htmlFor="promocode-input" className="promocodes-label">
                {t('promocodes.promocodeLabel', { defaultValue: 'Promocode' })}
              </label>
              <input
                id="promocode-input"
                type="text"
                className="promocodes-input"
                value={promocodeInput}
                onChange={(e) => setPromocodeInput(e.target.value.toUpperCase())}
                placeholder={t('promocodes.enterCode', { defaultValue: 'Enter promocode' })}
                disabled={validating}
              />
            </div>
            <div className="promocodes-form-field">
              <label className="promocodes-label">&nbsp;</label>
              <button
                type="submit"
                className="promocodes-submit-btn"
                disabled={validating || !promocodeInput.trim()}
              >
                {validating
                  ? t('promocodes.validating', { defaultValue: 'Validating...' })
                  : t('promocodes.validate', { defaultValue: 'Validate' })}
              </button>
            </div>
          </div>

          {validationResult && !validationResult.valid && (
            <div className={`promocodes-validation-result invalid`}>
              <div className="promocodes-validation-error">
                <span className="promocodes-validation-icon">✗</span>
                <div className="promocodes-validation-message">
                  {validationResult.error || t('promocodes.invalidMessage', { defaultValue: 'Promocode is invalid' })}
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      <div className="promocodes-list-section">
        <h3 className="promocodes-section-title">
          {t('promocodes.myPromocodes', { defaultValue: 'My Promocodes' })} ({savedPromocodes.length})
        </h3>
        {savedPromocodes.length === 0 ? (
          <div className="promocodes-empty">
            <div className="promocodes-empty-icon">🎟️</div>
            <div className="promocodes-empty-text">
              {t('promocodes.noPromocodes', { defaultValue: 'No promocodes yet' })}
            </div>
            <div className="promocodes-empty-subtext">
              {t('promocodes.noPromocodesDescription', { defaultValue: 'Add a promocode above to get started' })}
            </div>
          </div>
        ) : (
          <div className="promocodes-list">
            {savedPromocodes.map((promocode) => (
              <div key={promocode.code} className="promocode-card">
                <div className="promocode-card-header">
                  <div className="promocode-code">{promocode.code}</div>
                  <button
                    className="promocode-remove-btn"
                    onClick={() => removePromocode(promocode.code)}
                    title={t('promocodes.remove', { defaultValue: 'Remove' })}
                  >
                    ×
                  </button>
                </div>
                <div className="promocode-card-body">
                  {promocode.isValid && (
                    <div className="promocode-status valid">
                      {t('promocodes.statusValid', { defaultValue: 'Valid' })}
                    </div>
                  )}
                  {promocode.name && (
                    <div className="promocode-info">
                      <span className="promocode-info-label">Name:</span>
                      <span className="promocode-info-value">{promocode.name}</span>
                    </div>
                  )}
                  {promocode.discountValue !== undefined && (
                    <div className="promocode-info">
                      <span className="promocode-info-label">
                        {t('promocodes.discount', { defaultValue: 'Discount' })}:
                      </span>
                      <span className="promocode-info-value">
                        {promocode.discountType === 'percentage' 
                          ? `${promocode.discountValue}%`
                          : `$${promocode.discountValue.toFixed(2)}`}
                        {promocode.maxDiscount && ` (max $${promocode.maxDiscount.toFixed(2)})`}
                      </span>
                    </div>
                  )}
                  {promocode.maxDiscount && (
                    <div className="promocode-info">
                      <span className="promocode-info-label">Max discount:</span>
                      <span className="promocode-info-value">${promocode.maxDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {promocode.minAmount !== null && promocode.minAmount !== undefined && (
                    <div className="promocode-info">
                      <span className="promocode-info-label">Min deposit:</span>
                      <span className="promocode-info-value">${promocode.minAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {promocode.description && (
                    <div className="promocode-description">{promocode.description}</div>
                  )}
                  {promocode.validFrom && (
                    <div className="promocode-info">
                      <span className="promocode-info-label">Valid from:</span>
                      <span className="promocode-info-value">
                        {new Date(promocode.validFrom).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {promocode.validUntil && (
                    <div className="promocode-info">
                      <span className="promocode-info-label">Valid until:</span>
                      <span className="promocode-info-value">
                        {new Date(promocode.validUntil).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {promocode.isActive !== undefined && (
                    <div className="promocode-info">
                      <span className="promocode-info-label">Status:</span>
                      <span className="promocode-info-value">
                        {promocode.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  )}
                  <div className="promocode-date">
                    {t('promocodes.validatedAt', { defaultValue: 'Validated at' })}:{' '}
                    {new Date(promocode.validatedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


