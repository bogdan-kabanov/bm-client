import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ampayApi } from '@src/shared/api/ampay/ampayApi';
import type { AmpayMethodConfig, CreateAmpayMethodConfigRequest, UpdateAmpayMethodConfigRequest } from '@src/shared/api/ampay/types';
import { getAllMethods } from '@src/shared/api/ampay/configs';
import { availableMethods, getAllMethodNames, getSubMethodsForMethod } from '@src/shared/api/ampay/configs/methodsList';
import { apiClient } from '@src/shared/api/client/apiClient';
import './AmpayMethodsAdminPage.css';

interface MediaFile {
    name: string;
    url: string;
    size: number;
    createdAt: string;
    type: 'image' | 'video' | 'file' | 'folder';
    folder?: string;
    isFolder?: boolean;
}

export const AmpayMethodsAdminPage: React.FC = () => {
    const [methods, setMethods] = useState<AmpayMethodConfig[]>([]);
    const [selectedMethod, setSelectedMethod] = useState<AmpayMethodConfig | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingMethod, setEditingMethod] = useState<AmpayMethodConfig | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [filterCurrency, setFilterCurrency] = useState<string>('');
    const [filterDirection, setFilterDirection] = useState<'IN' | 'OUT' | ''>('');
    const [showImportForm, setShowImportForm] = useState(false);

    const [formData, setFormData] = useState<Partial<CreateAmpayMethodConfigRequest>>({
        method: '',
        sub_method: '',
        currency: '',
        direction: 'IN',
        commission: 0,
        additional_commission: null,
        test_mode: false,
        is_active: true,
        display_name: null,
        category: null,
        icon_url: null,
        min_amount: null,
        order: 0
    });
    const [iconPreview, setIconPreview] = useState<string | null>(null);
    const [iconFile, setIconFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showMediaSelector, setShowMediaSelector] = useState(false);
    const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);

    useEffect(() => {
        loadMethods();
    }, []);

    useEffect(() => {
        if (showMediaSelector) {
            loadMediaFiles();
        }
    }, [showMediaSelector]);

    const loadMediaFiles = async () => {
        try {
            const response = await apiClient<{ success: boolean; data: MediaFile[] }>('/media', {
                method: 'GET'
            });
            if (response.success) {
                const imageFiles = response.data.filter(file => file.type === 'image');
                setMediaFiles(imageFiles);
            }
        } catch (err) {
            console.error('Ошибка загрузки медиа файлов:', err);
        }
    };

    const handleSelectMedia = (file: MediaFile) => {
        setFormData({ ...formData, icon_url: file.url });
        setIconPreview(file.url);
        setIconFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setShowMediaSelector(false);
    };

    const loadMethods = async () => {
        try {
            setLoading(true);
            const response = await ampayApi.admin.getAllMethods();
            const data = Array.isArray(response) ? response : (response as any)?.data || [];
            setMethods(data);
        } catch (err: any) {
            setError(err?.message || 'Ошибка загрузки методов');
        } finally {
            setLoading(false);
        }
    };

    const handleMethodSelect = (method: AmpayMethodConfig) => {
        setSelectedMethod(method);
        setShowForm(false);
        setEditingMethod(null);
    };

    const handleAddMethod = () => {
        setEditingMethod(null);
        setFormData({
            method: '',
            sub_method: '',
            currency: '',
            direction: 'IN',
            commission: 0,
            additional_commission: null,
            test_mode: false,
            is_active: true,
            display_name: null,
            category: null,
            icon_url: null,
            min_amount: null,
            order: 0
        });
        setIconPreview(null);
        setIconFile(null);
        setShowForm(true);
    };

    const handleEditMethod = (method: AmpayMethodConfig) => {
        setEditingMethod(method);
        setFormData({
            method: method.method,
            sub_method: method.sub_method,
            currency: method.currency,
            direction: method.direction,
            commission: method.commission,
            additional_commission: method.additional_commission,
            test_mode: method.test_mode,
            is_active: method.is_active,
            display_name: method.display_name,
            category: method.category,
            icon_url: method.icon_url,
            min_amount: method.min_amount,
            order: method.order
        });
        setIconPreview(method.icon_url || null);
        setIconFile(null);
        setShowForm(true);
    };

    const handleIconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Выберите файл изображения');
                return;
            }
            // Ограничиваем размер до 500KB для base64 (рекомендуется использовать URL для больших файлов)
            if (file.size > 500 * 1024) {
                setError('Размер файла не должен превышать 500KB. Для больших изображений рекомендуется использовать URL.');
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                return;
            }
            setError(null);
            setIconFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setIconPreview(result);
                setFormData({ ...formData, icon_url: result });
            };
            reader.onerror = () => {
                setError('Ошибка чтения файла');
                setIconFile(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveIcon = () => {
        setIconFile(null);
        setIconPreview(null);
        setFormData({ ...formData, icon_url: null });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            setError(null);
            
            // Если загружен новый файл, проверяем размер base64
            let finalIconUrl: string | null = iconFile ? iconPreview : formData.icon_url;
            
            // Если base64 слишком длинный (больше 100KB), предупреждаем пользователя
            if (finalIconUrl && finalIconUrl.startsWith('data:image')) {
                const base64Length = finalIconUrl.length;
                if (base64Length > 100000) {
                    setError('Изображение слишком большое. Пожалуйста, используйте URL или уменьшите размер изображения (рекомендуется до 50KB).');
                    setLoading(false);
                    return;
                }
            }
            
            if (editingMethod && editingMethod.id) {
                const updateData: UpdateAmpayMethodConfigRequest = {
                    commission: formData.commission,
                    additional_commission: formData.additional_commission ?? null,
                    test_mode: formData.test_mode,
                    is_active: formData.is_active,
                    display_name: formData.display_name ?? null,
                    category: formData.category ?? null,
                    icon_url: finalIconUrl ?? null,
                    min_amount: formData.min_amount ?? null,
                    order: formData.order
                };
                
                try {
                    await ampayApi.admin.updateMethod(editingMethod.id, updateData);
                    setSuccess('Метод успешно обновлен');
                } catch (updateErr: any) {
                    // Обработка ошибок валидации
                    if (updateErr?.response?.data?.errors && Array.isArray(updateErr.response.data.errors)) {
                        const errorMessages = updateErr.response.data.errors.map((err: any) => 
                            typeof err === 'string' ? err : err.msg || err.message || JSON.stringify(err)
                        ).join(', ');
                        setError(`Ошибка валидации: ${errorMessages}`);
                    } else if (updateErr?.response?.data?.message) {
                        setError(updateErr.response.data.message);
                    } else {
                        setError(updateErr?.message || 'Ошибка обновления метода');
                    }
                    throw updateErr;
                }
            } else {
                const createData: CreateAmpayMethodConfigRequest = {
                    method: formData.method!,
                    sub_method: formData.sub_method!,
                    currency: formData.currency!,
                    direction: formData.direction!,
                    commission: formData.commission!,
                    additional_commission: formData.additional_commission ?? null,
                    test_mode: formData.test_mode!,
                    is_active: formData.is_active!,
                    display_name: formData.display_name ?? null,
                    category: formData.category ?? null,
                    icon_url: finalIconUrl ?? null,
                    min_amount: formData.min_amount ?? null,
                    order: formData.order ?? 0
                };
                
                try {
                    await ampayApi.admin.createMethod(createData);
                    setSuccess('Метод успешно создан');
                } catch (createErr: any) {
                    // Обработка ошибок валидации
                    if (createErr?.response?.data?.errors && Array.isArray(createErr.response.data.errors)) {
                        const errorMessages = createErr.response.data.errors.map((err: any) => 
                            typeof err === 'string' ? err : err.msg || err.message || JSON.stringify(err)
                        ).join(', ');
                        setError(`Ошибка валидации: ${errorMessages}`);
                    } else if (createErr?.response?.data?.message) {
                        setError(createErr.response.data.message);
                    } else {
                        setError(createErr?.message || 'Ошибка создания метода');
                    }
                    throw createErr;
                }
            }
            await loadMethods();
            setShowForm(false);
            setEditingMethod(null);
            setIconPreview(null);
            setIconFile(null);
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            // Ошибка уже обработана выше
            if (!err?.response) {
                setError(err?.message || 'Ошибка сохранения метода');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteMethod = async (id: number) => {
        if (!confirm('Вы уверены, что хотите удалить этот метод?')) {
            return;
        }

        try {
            setLoading(true);
            await ampayApi.admin.deleteMethod(id);
            setSuccess('Метод успешно удален');
            await loadMethods();
            if (selectedMethod?.id === id) {
                setSelectedMethod(null);
            }
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(err?.message || 'Ошибка удаления метода');
        } finally {
            setLoading(false);
        }
    };

    const handleImportFromConfig = async () => {
        try {
            setLoading(true);
            setError(null);
            const configMethods = getAllMethods();
            let imported = 0;
            let errors = 0;

            for (const method of configMethods) {
                try {
                    await ampayApi.admin.createMethod(method);
                    imported++;
                } catch (err) {
                    errors++;
                    console.error(`Ошибка импорта метода ${method.method}-${method.sub_method}:`, err);
                }
            }

            setSuccess(`Импортировано методов: ${imported}, ошибок: ${errors}`);
            await loadMethods();
            setShowImportForm(false);
            setTimeout(() => setSuccess(null), 5000);
        } catch (err: any) {
            setError(err?.message || 'Ошибка импорта методов');
        } finally {
            setLoading(false);
        }
    };

    const filteredMethods = methods.filter(method => {
        if (filterCurrency && method.currency !== filterCurrency) return false;
        if (filterDirection && method.direction !== filterDirection) return false;
        return true;
    });

    const currencies = Array.from(new Set(methods.map(m => m.currency))).sort();
    const allMethodNames = getAllMethodNames();
    
    // Получаем доступные sub_methods для выбранного метода
    const availableSubMethods = useMemo(() => {
        if (!formData.method) return [];
        return getSubMethodsForMethod(formData.method);
    }, [formData.method]);

    return (
        <div className="ampay-methods-admin-page">
            <div className="admin-header">
                <h1>Управление методами AmPay</h1>
                <div className="admin-header-actions">
                    <button onClick={() => setShowImportForm(true)} className="import-btn" disabled={loading}>
                        Импорт из конфигов
                    </button>
                    <button onClick={handleAddMethod} className="add-btn">
                        + Добавить метод
                    </button>
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    {error}
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            {success && (
                <div className="success-banner">
                    {success}
                    <button onClick={() => setSuccess(null)}>×</button>
                </div>
            )}

            {showImportForm && (
                <div className="import-modal">
                    <div className="import-modal-content">
                        <h2>Импорт методов из конфигураций</h2>
                        <p>Будут импортированы все методы из конфигурационных файлов. Существующие методы не будут перезаписаны.</p>
                        <div className="import-actions">
                            <button onClick={handleImportFromConfig} className="import-confirm-btn" disabled={loading}>
                                Импортировать
                            </button>
                            <button onClick={() => setShowImportForm(false)} className="cancel-btn" disabled={loading}>
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="edit-modal-overlay" onClick={() => {
                    if (!loading) {
                        setShowForm(false);
                        setEditingMethod(null);
                        setIconPreview(null);
                        setIconFile(null);
                    }
                }}>
                    <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="edit-modal-header">
                            <h2>{editingMethod ? 'Редактировать метод' : 'Добавить метод'}</h2>
                            <button
                                className="edit-modal-close"
                                onClick={() => {
                                    if (!loading) {
                                        setShowForm(false);
                                        setEditingMethod(null);
                                        setIconPreview(null);
                                        setIconFile(null);
                                    }
                                }}
                                disabled={loading}
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={handleFormSubmit} className="ampay-method-form">
                            <div className="form-section">
                                <h3>Основная информация</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Метод оплаты *</label>
                                        <select
                                            value={formData.method || ''}
                                            onChange={(e) => {
                                                const newMethod = e.target.value;
                                                setFormData({ 
                                                    ...formData, 
                                                    method: newMethod,
                                                    sub_method: '' // Сбрасываем sub_method при смене метода
                                                });
                                            }}
                                            required
                                            disabled={!!editingMethod}
                                        >
                                            <option value="">Выберите метод оплаты</option>
                                            {allMethodNames.map(method => (
                                                <option key={method} value={method}>
                                                    {method}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Sub Method</label>
                                        {availableSubMethods.length > 0 ? (
                                            <select
                                                value={formData.sub_method || ''}
                                                onChange={(e) => setFormData({ ...formData, sub_method: e.target.value })}
                                                disabled={!!editingMethod}
                                            >
                                                <option value="">(пусто)</option>
                                                {availableSubMethods.map(subMethod => (
                                                    <option key={subMethod} value={subMethod}>
                                                        {subMethod || '(пусто)'}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                value={formData.sub_method || ''}
                                                onChange={(e) => setFormData({ ...formData, sub_method: e.target.value })}
                                                disabled={!!editingMethod}
                                                placeholder="Введите sub_method или оставьте пустым"
                                            />
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label>Валюта *</label>
                                        <select
                                            value={formData.currency || ''}
                                            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                            required
                                            disabled={!!editingMethod}
                                        >
                                            <option value="">Выберите валюту</option>
                                            {currencies.map(curr => (
                                                <option key={curr} value={curr}>{curr}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Направление *</label>
                                        <select
                                            value={formData.direction || 'IN'}
                                            onChange={(e) => setFormData({ ...formData, direction: e.target.value as 'IN' | 'OUT' })}
                                            required
                                            disabled={!!editingMethod}
                                        >
                                            <option value="IN">IN</option>
                                            <option value="OUT">OUT</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>Комиссии и настройки</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Комиссия (%) *</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={formData.commission || 0}
                                            onChange={(e) => setFormData({ ...formData, commission: parseFloat(e.target.value) || 0 })}
                                            required
                                            min="0"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Доп. комиссия</label>
                                        <input
                                            type="number"
                                            value={formData.additional_commission ?? ''}
                                            onChange={(e) => setFormData({ 
                                                ...formData, 
                                                additional_commission: e.target.value ? parseFloat(e.target.value) : null 
                                            })}
                                            min="0"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Test Mode</label>
                                        <input
                                            type="checkbox"
                                            checked={formData.test_mode ?? false}
                                            onChange={(e) => setFormData({ ...formData, test_mode: e.target.checked })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Активен</label>
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active ?? true}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Min Amount</label>
                                        <input
                                            type="number"
                                            value={formData.min_amount ?? ''}
                                            onChange={(e) => setFormData({ 
                                                ...formData, 
                                                min_amount: e.target.value ? parseFloat(e.target.value) : null 
                                            })}
                                            min="0"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Order</label>
                                        <input
                                            type="number"
                                            value={formData.order || 0}
                                            onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                                            min="0"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>Дополнительная информация</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Display Name</label>
                                        <input
                                            type="text"
                                            value={formData.display_name || ''}
                                            onChange={(e) => setFormData({ ...formData, display_name: e.target.value || null })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Category</label>
                                        <input
                                            type="text"
                                            value={formData.category || ''}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value || null })}
                                        />
                                    </div>
                                    <div className="form-group full-width">
                                        <label>Иконка</label>
                                        <div className="icon-upload-container">
                                            {iconPreview ? (
                                                <div className="icon-preview-wrapper">
                                                    <img src={iconPreview} alt="Preview" className="icon-preview" />
                                                    <button
                                                        type="button"
                                                        onClick={handleRemoveIcon}
                                                        className="remove-icon-btn"
                                                        disabled={loading}
                                                    >
                                                        Удалить
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="icon-upload-placeholder">
                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleIconFileChange}
                                                        className="icon-file-input"
                                                        id="icon-upload"
                                                        disabled={loading}
                                                    />
                                                    <label htmlFor="icon-upload" className="icon-upload-label">
                                                        <span>📷</span>
                                                        <span>Загрузить изображение</span>
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                        <div className="icon-url-input-wrapper">
                                            <label htmlFor="icon-url-input" className="icon-url-label">Или введите URL:</label>
                                            <div className="icon-url-input-container">
                                                <input
                                                    id="icon-url-input"
                                                    type="url"
                                                    value={formData.icon_url && !iconFile ? (formData.icon_url.startsWith('data:') ? '' : formData.icon_url) : ''}
                                                    onChange={(e) => {
                                                        if (!iconFile) {
                                                            const url = e.target.value || null;
                                                            setFormData({ ...formData, icon_url: url });
                                                            setIconPreview(url);
                                                        }
                                                    }}
                                                    placeholder="https://example.com/icon.png"
                                                    disabled={loading || !!iconFile}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn-select-media"
                                                    onClick={() => setShowMediaSelector(true)}
                                                    disabled={loading}
                                                >
                                                    📁 Медиа
                                                </button>
                                            </div>
                                            {iconFile && (
                                                <p className="icon-upload-hint">
                                                    ⚠️ Для больших изображений рекомендуется использовать URL вместо загрузки файла
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="save-btn" disabled={loading}>
                                    {loading ? 'Сохранение...' : 'Сохранить'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowForm(false);
                                        setEditingMethod(null);
                                        setIconPreview(null);
                                        setIconFile(null);
                                    }}
                                    className="cancel-btn"
                                    disabled={loading}
                                >
                                    Отмена
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showMediaSelector && (
                <div className="media-selector-modal-overlay" onClick={() => setShowMediaSelector(false)}>
                    <div className="media-selector-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="media-selector-header">
                            <h3>Выберите файл из медиа-библиотеки</h3>
                            <button className="media-selector-close" onClick={() => setShowMediaSelector(false)}>×</button>
                        </div>
                        <div className="media-list">
                            {mediaFiles.length === 0 ? (
                                <div className="media-empty">Нет доступных изображений</div>
                            ) : (
                                mediaFiles.map((file, index) => (
                                    <div
                                        key={file.url || `${file.name}-${index}`}
                                        className="media-item"
                                        onClick={() => handleSelectMedia(file)}
                                    >
                                        <img src={file.url} alt={file.name} />
                                        <span>{file.name}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="admin-content">
                <div className="methods-list">
                        <div className="filters">
                            <div className="filter-group">
                                <label>Валюта:</label>
                                <select
                                    value={filterCurrency}
                                    onChange={(e) => setFilterCurrency(e.target.value)}
                                >
                                    <option value="">Все</option>
                                    {currencies.map(curr => (
                                        <option key={curr} value={curr}>{curr}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filter-group">
                                <label>Направление:</label>
                                <select
                                    value={filterDirection}
                                    onChange={(e) => setFilterDirection(e.target.value as 'IN' | 'OUT' | '')}
                                >
                                    <option value="">Все</option>
                                    <option value="IN">IN</option>
                                    <option value="OUT">OUT</option>
                                </select>
                            </div>
                        </div>

                        {loading && !methods.length ? (
                            <div className="loading-state">Загрузка...</div>
                        ) : filteredMethods.length === 0 ? (
                            <div className="empty-state">Методы не найдены</div>
                        ) : (
                            <div className="methods-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>№</th>
                                            <th>Method</th>
                                            <th>Sub Method</th>
                                            <th>Валюта</th>
                                            <th>Направление</th>
                                            <th>Комиссия</th>
                                            <th>Доп. комиссия</th>
                                            <th>Test Mode</th>
                                            <th>Активен</th>
                                            <th>Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredMethods.map((method, index) => (
                                            <tr
                                                key={method.id}
                                                className={selectedMethod?.id === method.id ? 'selected' : ''}
                                                onClick={() => handleMethodSelect(method)}
                                            >
                                                <td>{index + 1}</td>
                                                <td>{method.method}</td>
                                                <td>{method.sub_method || '-'}</td>
                                                <td>{method.currency}</td>
                                                <td>
                                                    <span className={`direction ${method.direction.toLowerCase()}`}>
                                                        {method.direction}
                                                    </span>
                                                </td>
                                                <td>{method.commission}%</td>
                                                <td>{method.additional_commission ?? '-'}</td>
                                                <td>
                                                    <span className={`status ${method.test_mode ? 'test' : 'prod'}`}>
                                                        {method.test_mode ? '✓' : '✗'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`status ${method.is_active ? 'active' : 'inactive'}`}>
                                                        {method.is_active ? '✓' : '✗'}
                                                    </span>
                                                </td>
                                                <td onClick={(e) => e.stopPropagation()}>
                                                    <div className="action-buttons">
                                                        <button
                                                            onClick={() => handleEditMethod(method)}
                                                            className="edit-btn"
                                                            disabled={loading}
                                                        >
                                                            Редактировать
                                                        </button>
                                                        <button
                                                            onClick={() => method.id && handleDeleteMethod(method.id)}
                                                            className="delete-btn"
                                                            disabled={loading}
                                                        >
                                                            Удалить
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

